const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const ejs = require('ejs');

module.exports = (upload) => {
   const router = express.Router();

   // Вспомогательная функция для рендеринга вложенного содержимого
   const renderBody = async (viewPath, data) => {
      return await ejs.renderFile(path.join(__dirname, 'views', viewPath), data);
   };

   // =================== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ КАТЕГОРИЙ С УРОВНЕМ ===================
   async function getCategoriesWithLevel() {
      const result = await pool.query(`
         WITH RECURSIVE cat_tree AS (
            SELECT 
                id, name, slug, parent_id, sort_order, is_active, icon_svg,
                0 AS level,
                ARRAY[id] AS path
            FROM categories
            WHERE parent_id IS NULL
            UNION ALL
            SELECT 
                c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_active, c.icon_svg,
                ct.level + 1,
                ct.path || c.id
            FROM categories c
            INNER JOIN cat_tree ct ON c.parent_id = ct.id
         )
         SELECT id, name, level, path, parent_id
         FROM cat_tree
         ORDER BY path
      `);
      return result.rows;
   }

   // =================== ГЛАВНАЯ ===================
   router.get('/', async (req, res) => {
      try {
         const newsCount = (await pool.query('SELECT COUNT(*) FROM news')).rows[0].count;
         const prodCount = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;
         const catCount = (await pool.query('SELECT COUNT(*) FROM categories')).rows[0].count;
         const body = await renderBody('admin/index.ejs', { newsCount, prodCount, catCount });
         res.render('admin/layout', { title: 'Главная', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки статистики');
      }
   });

   // =================== НОВОСТИ ===================
   router.get('/news', async (req, res) => {
      try {
         const news = await pool.query('SELECT * FROM news ORDER BY published_at DESC');
         const body = await renderBody('admin/news/index.ejs', { news: news.rows });
         res.render('admin/layout', { title: 'Новости', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки новостей');
      }
   });

   router.get('/news/create', async (req, res) => {
      const body = await renderBody('admin/news/form.ejs', { news: null, action: '/admin/news/create' });
      res.render('admin/layout', { title: 'Создание новости', body });
   });

   router.post('/news/create', async (req, res) => {
      try {
         const { title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, is_active, is_hero } = req.body;
         const active = (is_active === 'on' || is_active === true || is_active === 'true');
         const hero = (is_hero === 'on' || is_hero === true || is_hero === 'true');
         await pool.query(
            `INSERT INTO news (title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, is_active, is_hero)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, active, hero]
         );
         res.redirect('/admin/news');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка сохранения новости');
      }
   });

   router.get('/news/:id/edit', async (req, res) => {
      try {
         const result = await pool.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
         if (result.rows.length === 0) return res.status(404).send('Новость не найдена');
         const body = await renderBody('admin/news/form.ejs', { news: result.rows[0], action: `/admin/news/${req.params.id}/edit` });
         res.render('admin/layout', { title: 'Редактирование новости', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/news/:id/edit', async (req, res) => {
      try {
         const { title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, is_active, is_hero } = req.body;
         const active = (is_active === 'on' || is_active === true || is_active === 'true');
         const hero = (is_hero === 'on' || is_hero === true || is_hero === 'true');
         await pool.query(
            `UPDATE news SET title=$1, slug=$2, excerpt=$3, content=$4, published_at=$5, image_url=$6, meta_title=$7, meta_description=$8, is_active=$9, is_hero=$10
             WHERE id=$11`,
            [title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, active, hero, req.params.id]
         );
         res.redirect('/admin/news');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка обновления');
      }
   });

   router.post('/news/:id/delete', async (req, res) => {
      try {
         await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
         res.redirect('/admin/news');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   // =================== КАТЕГОРИИ ===================
   router.get('/categories', async (req, res) => {
      try {
         const result = await pool.query(`
            WITH RECURSIVE cat_tree AS (
                SELECT 
                    c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_active, 
                    c.description, c.image_url, c.icon_svg,
                    0 AS level, 
                    ARRAY[c.id] AS path,
                    EXISTS(SELECT 1 FROM categories WHERE parent_id = c.id) AS has_children
                FROM categories c
                WHERE c.parent_id IS NULL
                UNION ALL
                SELECT 
                    c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_active,
                    c.description, c.image_url, c.icon_svg,
                    ct.level + 1,
                    ct.path || c.id,
                    EXISTS(SELECT 1 FROM categories WHERE parent_id = c.id) AS has_children
                FROM categories c
                INNER JOIN cat_tree ct ON c.parent_id = ct.id
            )
            SELECT * FROM cat_tree ORDER BY path
        `);
         const allCats = await pool.query('SELECT id, name FROM categories ORDER BY name');
         const body = await renderBody('admin/categories/index.ejs', { categories: result.rows, allCategories: allCats.rows });
         res.render('admin/layout', { title: 'Категории', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки категорий');
      }
   });

   router.get('/categories/create', async (req, res) => {
      const parents = await pool.query('SELECT id, name FROM categories ORDER BY name');
      const body = await renderBody('admin/categories/form.ejs', { category: null, action: '/admin/categories/create', parents: parents.rows });
      res.render('admin/layout', { title: 'Создание категории', body });
   });

   router.post('/categories/create', async (req, res) => {
      try {
         const { name, slug, parent_id, sort_order, description, image_url, is_active, icon_svg } = req.body;
         await pool.query(
            `INSERT INTO categories (name, slug, parent_id, sort_order, description, image_url, is_active, icon_svg)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [name, slug, parent_id || null, sort_order || 0, description, image_url, is_active === 'on', icon_svg]
         );
         res.redirect('/admin/categories');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка сохранения');
      }
   });

   router.get('/categories/:id/edit', async (req, res) => {
      try {
         const cat = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
         if (cat.rows.length === 0) return res.status(404).send('Категория не найдена');
         const parents = await pool.query('SELECT id, name FROM categories WHERE id != $1 ORDER BY name', [req.params.id]);
         const body = await renderBody('admin/categories/form.ejs', { category: cat.rows[0], action: `/admin/categories/${req.params.id}/edit`, parents: parents.rows });
         res.render('admin/layout', { title: 'Редактирование категории', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/categories/:id/edit', async (req, res) => {
      try {
         const { name, slug, parent_id, sort_order, description, image_url, is_active, icon_svg } = req.body;
         await pool.query(
            `UPDATE categories SET name=$1, slug=$2, parent_id=$3, sort_order=$4, description=$5, image_url=$6, is_active=$7, icon_svg=$8
             WHERE id=$9`,
            [name, slug, parent_id || null, sort_order || 0, description, image_url, is_active === 'on', icon_svg, req.params.id]
         );
         res.redirect('/admin/categories');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка обновления');
      }
   });

   router.post('/categories/:id/delete', async (req, res) => {
      try {
         const childCats = await pool.query('SELECT id FROM categories WHERE parent_id = $1', [req.params.id]);
         if (childCats.rows.length > 0) {
            return res.status(400).send('Сначала удалите или переназначьте дочерние категории');
         }
         const products = await pool.query('SELECT id FROM products WHERE category_id = $1', [req.params.id]);
         if (products.rows.length > 0) {
            return res.status(400).send('Сначала удалите или переназначьте товары этой категории');
         }
         await pool.query('DELETE FROM product_categories WHERE category_id = $1', [req.params.id]);
         await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
         res.redirect('/admin/categories');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   // =================== ТОВАРЫ ===================
   router.get('/products', async (req, res) => {
      try {
         const products = await pool.query(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.sort_order, p.id
         `);
         const body = await renderBody('admin/products/index.ejs', { products: products.rows });
         res.render('admin/layout', { title: 'Товары', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки товаров');
      }
   });

   router.get('/products/create', async (req, res) => {
      const categories = await getCategoriesWithLevel();
      const body = await renderBody('admin/products/form.ejs', {
         product: null,
         action: '/admin/products/create',
         categories: categories,
         selectedCategories: []
      });
      res.render('admin/layout', { title: 'Создание товара', body });
   });

   router.post('/products/create', async (req, res) => {
      try {
         const { name, slug, excerpt, description, image_url, category_id, sort_order, is_active } = req.body;
         const result = await pool.query(
            `INSERT INTO products (name, slug, excerpt, description, image_url, category_id, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [name, slug, excerpt, description, image_url, category_id || null, sort_order || 0, is_active === 'on']
         );
         const productId = result.rows[0].id;

         // Сохраняем выбранные отрасли (многие ко многим)
         let categoryIds = [];
         if (req.body.categories) {
            categoryIds = Array.isArray(req.body.categories) ? req.body.categories : [req.body.categories];
         }
         for (const catId of categoryIds) {
            if (catId) {
               await pool.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)', [productId, catId]);
            }
         }

         res.redirect(`/admin/products/${productId}/edit`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка сохранения');
      }
   });

   router.get('/products/:id/edit', async (req, res) => {
      try {
         const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
         if (product.rows.length === 0) return res.status(404).send('Товар не найден');
         const allCategories = await getCategoriesWithLevel();
         const selectedCategoriesRes = await pool.query('SELECT category_id FROM product_categories WHERE product_id = $1', [req.params.id]);
         const selectedCategories = selectedCategoriesRes.rows.map(row => row.category_id);
         const body = await renderBody('admin/products/form.ejs', {
            product: product.rows[0],
            action: `/admin/products/${req.params.id}/edit`,
            categories: allCategories,
            selectedCategories: selectedCategories
         });
         res.render('admin/layout', { title: 'Редактирование товара', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/products/:id/edit', async (req, res) => {
      try {
         const { name, slug, excerpt, description, image_url, category_id, sort_order, is_active } = req.body;
         await pool.query(
            `UPDATE products SET name=$1, slug=$2, excerpt=$3, description=$4, image_url=$5, category_id=$6, sort_order=$7, is_active=$8
             WHERE id=$9`,
            [name, slug, excerpt, description, image_url, category_id || null, sort_order || 0, is_active === 'on', req.params.id]
         );

         await pool.query('DELETE FROM product_categories WHERE product_id = $1', [req.params.id]);
         let categoryIds = [];
         if (req.body.categories) {
            categoryIds = Array.isArray(req.body.categories) ? req.body.categories : [req.body.categories];
         }
         for (const catId of categoryIds) {
            if (catId) {
               await pool.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)', [req.params.id, catId]);
            }
         }

         res.redirect('/admin/products');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка обновления');
      }
   });

   router.post('/products/:id/delete', async (req, res) => {
      try {
         const images = await pool.query('SELECT image_url FROM product_images WHERE product_id = $1', [req.params.id]);
         for (const img of images.rows) {
            const filePath = path.join(__dirname, '..', 'public', img.image_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
         }
         await pool.query('DELETE FROM product_images WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM product_options WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM product_package_types WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM product_categories WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
         res.redirect('/admin/products');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   // =================== ИЗОБРАЖЕНИЯ ТОВАРА ===================
   router.get('/products/:id/images', async (req, res) => {
      try {
         const product = await pool.query('SELECT id, name FROM products WHERE id = $1', [req.params.id]);
         if (product.rows.length === 0) return res.status(404).send('Товар не найден');
         const images = await pool.query(`
            SELECT pi.*, pt.name as package_name 
            FROM product_images pi
            LEFT JOIN package_types pt ON pi.package_type_id = pt.id
            WHERE pi.product_id = $1
            ORDER BY pi.is_main DESC, pi.sort_order
         `, [req.params.id]);
         const packageTypes = await pool.query('SELECT id, name FROM package_types ORDER BY name');
         const body = await renderBody('admin/products/images.ejs', { product: product.rows[0], images: images.rows, packageTypes: packageTypes.rows });
         res.render('admin/layout', { title: `Изображения товара ${product.rows[0].name}`, body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/products/:id/upload-images', upload.array('images', 10), async (req, res) => {
      try {
         const productId = req.params.id;
         const files = req.files;
         if (!files || files.length === 0) return res.status(400).send('Файлы не выбраны');
         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileUrl = `/uploads/${file.filename}`;
            const existingMain = await pool.query('SELECT id FROM product_images WHERE product_id = $1 AND is_main = true', [productId]);
            const isMain = (existingMain.rows.length === 0 && i === 0);
            await pool.query(
               `INSERT INTO product_images (product_id, image_url, is_main, sort_order) VALUES ($1, $2, $3, $4)`,
               [productId, fileUrl, isMain, i]
            );
         }
         res.redirect(`/admin/products/${productId}/images`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки изображений');
      }
   });

   router.post('/products/:productId/images/:imageId/delete', async (req, res) => {
      try {
         const { productId, imageId } = req.params;
         const image = await pool.query('SELECT image_url FROM product_images WHERE id = $1 AND product_id = $2', [imageId, productId]);
         if (image.rows.length) {
            const filePath = path.join(__dirname, '..', 'public', image.rows[0].image_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
         }
         await pool.query('DELETE FROM product_images WHERE id = $1 AND product_id = $2', [imageId, productId]);
         res.redirect(`/admin/products/${productId}/images`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления изображения');
      }
   });

   router.post('/products/:productId/images/:imageId/set-main', async (req, res) => {
      try {
         const { productId, imageId } = req.params;
         await pool.query('UPDATE product_images SET is_main = false WHERE product_id = $1', [productId]);
         await pool.query('UPDATE product_images SET is_main = true WHERE id = $1 AND product_id = $2', [imageId, productId]);
         res.redirect(`/admin/products/${productId}/images`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка установки главного изображения');
      }
   });

   // =================== ОПЦИИ ТОВАРА ===================
   router.get('/products/:id/options', async (req, res) => {
      try {
         const product = await pool.query('SELECT id, name FROM products WHERE id = $1', [req.params.id]);
         if (product.rows.length === 0) return res.status(404).send('Товар не найден');
         const options = await pool.query('SELECT * FROM product_options WHERE product_id = $1 ORDER BY sort_order', [req.params.id]);
         const body = await renderBody('admin/products/options.ejs', { product: product.rows[0], options: options.rows });
         res.render('admin/layout', { title: `Опции товара ${product.rows[0].name}`, body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/products/:id/options', upload.single('image'), async (req, res) => {
      try {
         const productId = req.params.id;
         const { name } = req.body;
         let imageUrl = null;
         if (req.file) imageUrl = `/uploads/${req.file.filename}`;
         await pool.query(
            `INSERT INTO product_options (product_id, name, image_url, sort_order)
             VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM product_options WHERE product_id = $1))`,
            [productId, name, imageUrl]
         );
         res.redirect(`/admin/products/${productId}/options`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка создания опции');
      }
   });

   router.post('/products/:productId/options/:optionId/edit', upload.single('image'), async (req, res) => {
      try {
         const { productId, optionId } = req.params;
         const { name } = req.body;
         if (req.file) {
            const old = await pool.query('SELECT image_url FROM product_options WHERE id = $1', [optionId]);
            if (old.rows[0]?.image_url) {
               const oldPath = path.join(__dirname, '..', 'public', old.rows[0].image_url);
               if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            const newUrl = `/uploads/${req.file.filename}`;
            await pool.query('UPDATE product_options SET name = $1, image_url = $2 WHERE id = $3 AND product_id = $4', [name, newUrl, optionId, productId]);
         } else {
            await pool.query('UPDATE product_options SET name = $1 WHERE id = $2 AND product_id = $3', [name, optionId, productId]);
         }
         res.redirect(`/admin/products/${productId}/options`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка обновления опции');
      }
   });

   router.post('/products/:productId/options/:optionId/delete', async (req, res) => {
      try {
         const { productId, optionId } = req.params;
         const imgRes = await pool.query('SELECT image_url FROM product_options WHERE id = $1', [optionId]);
         if (imgRes.rows[0]?.image_url) {
            const filePath = path.join(__dirname, '..', 'public', imgRes.rows[0].image_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
         }
         await pool.query('DELETE FROM product_options WHERE id = $1 AND product_id = $2', [optionId, productId]);
         res.redirect(`/admin/products/${productId}/options`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления опции');
      }
   });

   // =================== ТИПЫ УПАКОВОК (справочник) ===================
   router.get('/package-types', async (req, res) => {
      try {
         const types = await pool.query('SELECT id, name, icon_url, sort_order FROM package_types ORDER BY sort_order');
         const body = await renderBody('admin/package-types/index.ejs', { types: types.rows });
         res.render('admin/layout', { title: 'Типы упаковок', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.get('/package-types/create', async (req, res) => {
      const body = await renderBody('admin/package-types/form.ejs', { type: null, action: '/admin/package-types/create' });
      res.render('admin/layout', { title: 'Создание типа упаковки', body });
   });

   router.post('/package-types/create', async (req, res) => {
      try {
         const { name, icon_url, sort_order } = req.body;
         await pool.query(
            `INSERT INTO package_types (name, icon_url, sort_order) VALUES ($1, $2, $3)`,
            [name, icon_url, sort_order || 0]
         );
         res.redirect('/admin/package-types');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка сохранения');
      }
   });

   router.get('/package-types/:id/edit', async (req, res) => {
      try {
         const type = await pool.query('SELECT * FROM package_types WHERE id = $1', [req.params.id]);
         if (type.rows.length === 0) return res.status(404).send('Тип не найден');
         const body = await renderBody('admin/package-types/form.ejs', { type: type.rows[0], action: `/admin/package-types/${req.params.id}/edit` });
         res.render('admin/layout', { title: 'Редактирование типа упаковки', body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/package-types/:id/edit', async (req, res) => {
      try {
         const { name, icon_url, sort_order } = req.body;
         await pool.query(
            `UPDATE package_types SET name=$1, icon_url=$2, sort_order=$3 WHERE id=$4`,
            [name, icon_url, sort_order || 0, req.params.id]
         );
         res.redirect('/admin/package-types');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка обновления');
      }
   });

   router.post('/package-types/:id/delete', async (req, res) => {
      try {
         const used = await pool.query(
            'SELECT id FROM product_package_types WHERE package_type_id = $1 LIMIT 1',
            [req.params.id]
         );
         if (used.rows.length > 0) {
            return res.status(400).send('Тип упаковки используется в товарах, сначала удалите связи');
         }
         await pool.query('DELETE FROM package_types WHERE id = $1', [req.params.id]);
         res.redirect('/admin/package-types');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   // =================== ПРИВЯЗКА ТИПОВ УПАКОВОК К ТОВАРУ ===================
   router.get('/products/:id/package-types', async (req, res) => {
      try {
         const product = await pool.query('SELECT id, name FROM products WHERE id = $1', [req.params.id]);
         if (product.rows.length === 0) return res.status(404).send('Товар не найден');
         const allTypes = await pool.query('SELECT * FROM package_types ORDER BY name');
         const selected = await pool.query(
            'SELECT package_type_id, volume FROM product_package_types WHERE product_id = $1',
            [req.params.id]
         );
         const body = await renderBody('admin/products/package-types.ejs', {
            product: product.rows[0],
            allTypes: allTypes.rows,
            selected: selected.rows
         });
         res.render('admin/layout', { title: `Типы упаковок для ${product.rows[0].name}`, body });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/products/:id/package-types', async (req, res) => {
      try {
         const productId = req.params.id;
         let ids = [];
         if (req.body.package_type_ids) {
            ids = Array.isArray(req.body.package_type_ids) ? req.body.package_type_ids : [req.body.package_type_ids];
         }

         const volumesMap = {};
         for (const key in req.body) {
            if (key.startsWith('volume_')) {
               const typeId = key.split('_')[1];
               volumesMap[typeId] = req.body[key] ? req.body[key].trim() : '';
            }
         }

         await pool.query('DELETE FROM product_package_types WHERE product_id = $1', [productId]);

         for (const ptid of ids) {
            const volume = volumesMap[ptid] || '';
            await pool.query(
               'INSERT INTO product_package_types (product_id, package_type_id, volume) VALUES ($1, $2, $3)',
               [productId, ptid, volume]
            );
         }

         res.redirect(`/admin/products/${productId}/edit`);
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка сохранения');
      }
   });

   return router;
};