const express = require('express');
const pool = require('../../db');
const optimizeAndReplace = require('../../middleware/uploadOptimize');

module.exports = (upload, deleteFile) => {
   const router = express.Router();

   // GET /admin/products/:id/images/list
   router.get('/:id/images/list', async (req, res) => {
      try {
         const productId = parseInt(req.params.id, 10);
         if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });

         const images = await pool.query(
            `SELECT id, image_url, is_main, sort_order 
          FROM product_images 
          WHERE product_id = $1 
          ORDER BY is_main DESC, sort_order`,
            [productId]
         );
         res.json(images.rows);
      } catch (err) {
         console.error(err);
         res.status(500).json({ error: 'Ошибка загрузки изображений' });
      }
   });

   // POST /admin/products/:id/images/upload
   router.post('/:id/images/upload', upload.array('images', 10), optimizeAndReplace, async (req, res) => {
      try {
         const productId = parseInt(req.params.id, 10);
         if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });
         console.log('Загрузка изображений для товара:', productId);
      console.log('Файлы:', req.files?.length || 0);

         const files = req.files;
         if (!files || files.length === 0) return res.status(400).json({ error: 'Файлы не выбраны' });

         const mainCheck = await pool.query('SELECT id FROM product_images WHERE product_id = $1 AND is_main = true', [productId]);
         let mainExists = mainCheck.rows.length > 0;

         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileUrl = `/uploads/products/${file.filename}`;
            const isMain = !mainExists && i === 0;
            await pool.query(
               'INSERT INTO product_images (product_id, image_url, is_main, sort_order) VALUES ($1, $2, $3, $4)',
               [productId, fileUrl, isMain, i]
            );
            if (isMain) {
               mainExists = true;
               await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [fileUrl, productId]);
            }
         }
         res.json({ success: true });
      } catch (err) {
         console.error(err);
         res.status(500).json({ error: 'Ошибка загрузки изображений' });
      }
   });

   // POST /admin/products/:productId/images/:imageId/set-main
   router.post('/:productId/images/:imageId/set-main', async (req, res) => {
      try {
         const productId = parseInt(req.params.productId, 10);
         const imageId = parseInt(req.params.imageId, 10);

         if (isNaN(productId) || isNaN(imageId)) return res.status(400).json({ error: 'Invalid IDs' });

         await pool.query('UPDATE product_images SET is_main = false WHERE product_id = $1', [productId]);
         await pool.query('UPDATE product_images SET is_main = true WHERE id = $1 AND product_id = $2', [imageId, productId]);
         const img = await pool.query('SELECT image_url FROM product_images WHERE id = $1', [imageId]);
         if (img.rows.length) {
            await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [img.rows[0].image_url, productId]);
         }
         res.json({ success: true });
      } catch (err) {
         console.error(err);
         res.status(500).json({ error: 'Ошибка установки главного изображения' });
      }
   });

   // POST /admin/products/:productId/images/:imageId/delete
   router.post('/:productId/images/:imageId/delete', async (req, res) => {
      try {
         const productId = parseInt(req.params.productId, 10);
         const imageId = parseInt(req.params.imageId, 10);

         if (isNaN(productId) || isNaN(imageId)) return res.status(400).json({ error: 'Invalid IDs' });

         const image = await pool.query('SELECT image_url, is_main FROM product_images WHERE id = $1 AND product_id = $2', [imageId, productId]);
         if (image.rows.length) {
            deleteFile(image.rows[0].image_url);

            await pool.query('DELETE FROM product_images WHERE id = $1', [imageId]);
            if (image.rows[0].is_main) {
               await pool.query('UPDATE products SET image_url = NULL WHERE id = $1', [productId]);
               const next = await pool.query('SELECT id, image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order LIMIT 1', [productId]);
               if (next.rows.length) {
                  await pool.query('UPDATE product_images SET is_main = true WHERE id = $1', [next.rows[0].id]);
                  await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [next.rows[0].image_url, productId]);
               }
            }
         }
         res.json({ success: true });
      } catch (err) {
         console.error(err);
         res.status(500).json({ error: 'Ошибка удаления' });
      }
   });

   return router;
};