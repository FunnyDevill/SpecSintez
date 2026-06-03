const express = require('express');
const path = require('path');
const pool = require('../../db');
const ejs = require('ejs');
const cache = require('../../cache');
const optimizeAndReplace = require('../../middleware/uploadOptimize');
const { slugify } = require('../../utils/slugify');

const deleteFile = (filePath) => {
   try {
      const fullPath = require('path').join(__dirname, '..', '..', 'public', filePath);
      if (require('fs').existsSync(fullPath)) {
         require('fs').unlinkSync(fullPath);
         console.log('Удалён файл:', filePath);
      }
   } catch (e) {
      console.error('Ошибка удаления файла:', filePath, e);
   }
};

const renderBody = async (viewPath, data, req) => {
   const csrfToken = req.csrfToken || '';
   const nonce = req.nonce || '';
   const safeJson = function(d) {
      if (d === undefined || d === null) return '""';
      return JSON.stringify(d).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
   };
   return await ejs.renderFile(path.join(__dirname, '..', '..', 'views', viewPath), { ...data, csrfToken, nonce, safeJson });
};
module.exports = (upload) => {
   const router = express.Router();

   router.use((req, res, next) => {
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
         cache.clear();
      }
      next();
   });

   // Главная страница админки
   router.get('/', async (req, res) => {
      try {
         const newsCount = (await pool.query('SELECT COUNT(*) FROM news')).rows[0].count;
         const prodCount = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;
         const catCount = (await pool.query('SELECT COUNT(*) FROM categories')).rows[0].count;
         const body = await renderBody('admin/index.ejs', { newsCount, prodCount, catCount }, req);
         res.render('admin/layout', { title: 'Главная', body, currentSection: 'dashboard' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки статистики');
      }
   });

   // ===== НАПРАВЛЕНИЯ =====

   // GET /admin/directions/:id — получить одно направление
   router.get('/directions/:id', async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         const result = await pool.query('SELECT * FROM directions WHERE id = $1', [id]);
         if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
         res.json(result.rows[0]);
      } catch (err) {
         console.error(err);
         res.status(500).json({ error: 'Database error' });
      }
   });

   // POST /admin/directions/create
   router.post('/directions/create', upload.single('icon'), optimizeAndReplace, async (req, res) => {
      try {
         let { name, slug, sort_order } = req.body;
         if (!slug || !slug.trim()) slug = slugify(name);
         let image_url = null;
         if (req.file) image_url = `/uploads/icons/${req.file.filename}`;
         await pool.query('INSERT INTO directions (name, slug, sort_order, image_url) VALUES ($1,$2,$3,$4)', [name.trim(), slug.trim(), parseInt(sort_order) || 0, image_url]);
         res.redirect('/admin/categories#tab-directions');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка сохранения направления');
      }
   });

   // POST /admin/directions/:id/edit
   router.post('/directions/:id/edit', upload.single('icon'), optimizeAndReplace, async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         let { name, slug, sort_order } = req.body;
         if (!slug || !slug.trim()) slug = slugify(name);
         const old = await pool.query('SELECT image_url FROM directions WHERE id = $1', [id]);
         let image_url = old.rows[0]?.image_url;
         if (req.file) {
            if (image_url) deleteFile(image_url);
            image_url = `/uploads/icons/${req.file.filename}`;
         }
         await pool.query('UPDATE directions SET name=$1, slug=$2, sort_order=$3, image_url=$4 WHERE id=$5', [name.trim(), slug.trim(), parseInt(sort_order) || 0, image_url, id]);
         res.redirect('/admin/categories#tab-directions');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка обновления направления');
      }
   });

   // POST /admin/directions/:id/delete
   router.post('/directions/:id/delete', async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         const dir = await pool.query('SELECT image_url FROM directions WHERE id = $1', [id]);
         if (dir.rows[0]?.image_url) deleteFile(dir.rows[0].image_url);
         await pool.query('DELETE FROM product_directions WHERE direction_id = $1', [id]);
         await pool.query('DELETE FROM directions WHERE id = $1', [id]);
         res.redirect('/admin/categories#tab-directions');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления направления');
      }
   });

   // Подключаем модули
   const newsRouter = require('./news')(upload, deleteFile);
   const categoriesRouter = require('./categories')(upload, deleteFile);
   const productsRouter = require('./products')(upload, deleteFile);
   const packageTypesRouter = require('./package-types')(upload, deleteFile);
   const imagesRouter = require('./images')(upload, deleteFile);

   router.use('/news', newsRouter);
   router.use('/categories', categoriesRouter);
   router.use('/products', productsRouter);
   router.use('/package-types', packageTypesRouter);
   router.use('/products', imagesRouter);

   return router;
};