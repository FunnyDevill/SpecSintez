const express = require('express');
const path = require('path');
const pool = require('../../db');
const ejs = require('ejs');
const { requireFields } = require('../../middleware/validation');
const optimizeAndReplace = require('../../middleware/uploadOptimize');
const { slugify } = require('../../utils/slugify');

module.exports = (upload, deleteFile) => {
   const router = express.Router();

const renderBody = async (viewPath, data, req) => {
   const csrfToken = req.csrfToken || '';
   const nonce = req.nonce || '';
   const safeJson = function(d) {
      if (d === undefined || d === null) return '""';
      return JSON.stringify(d).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
   };
   return await ejs.renderFile(path.join(__dirname, '..', '..', 'views', viewPath), { ...data, csrfToken, nonce, safeJson });
};

   async function generateUniqueSlug(baseSlug, excludeId = null) {
      let slug = baseSlug, counter = 1;
      while (true) {
         const query = excludeId ? 'SELECT id FROM categories WHERE slug = $1 AND id != $2' : 'SELECT id FROM categories WHERE slug = $1';
         const params = excludeId ? [slug, excludeId] : [slug];
         const result = await pool.query(query, params);
         if (result.rows.length === 0) break;
         slug = `${baseSlug}-${counter}`; counter++;
      }
      return slug;
   }

   // GET /admin/categories
   router.get('/', async (req, res) => {
      try {
         const result = await pool.query(`
            WITH RECURSIVE cat_tree AS (
                SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_active, c.description, c.icon_svg,
                    0 AS level, ARRAY[c.id] AS path,
                    EXISTS(SELECT 1 FROM categories WHERE parent_id = c.id) AS has_children
                FROM categories c WHERE c.parent_id IS NULL
                UNION ALL
                SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_active, c.description, c.icon_svg,
                    ct.level + 1, ct.path || c.id,
                    EXISTS(SELECT 1 FROM categories WHERE parent_id = c.id) AS has_children
                FROM categories c INNER JOIN cat_tree ct ON c.parent_id = ct.id WHERE ct.level < 1
            )
            SELECT * FROM cat_tree ORDER BY path
         `);
         const directions = await pool.query('SELECT * FROM directions ORDER BY sort_order');

         const body = await renderBody('admin/categories/index.ejs', {
            categories: result.rows,
            directions: directions.rows
         }, req);
         res.render('admin/layout', { title: 'Категории и направления', body, currentSection: 'categories' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки категорий');
      }
   });

   // GET /admin/categories/create
   router.get('/create', async (req, res) => {
      const parents = await pool.query('SELECT id, name FROM categories ORDER BY name');
      const body = await renderBody('admin/categories/form.ejs', {
         category: null, action: '/admin/categories/create', parents: parents.rows, errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание категории', body, currentSection: 'categories' });
   });

   // POST /admin/categories/create
   router.post('/create', upload.single('icon'), optimizeAndReplace, requireFields('name'), async (req, res) => {
      try {
         let { name, slug, parent_id, sort_order, description, is_active } = req.body;
         if (!slug || !slug.trim()) slug = await generateUniqueSlug(slugify(name));
         else { slug = slug.trim(); const ex = await pool.query('SELECT id FROM categories WHERE slug = $1', [slug]); if (ex.rows.length > 0) slug = await generateUniqueSlug(slug); }

         const errors = req.validationErrors || [];
         if (errors.length > 0) {
            const parents = await pool.query('SELECT id, name FROM categories ORDER BY name');
            const body = await renderBody('admin/categories/form.ejs', { category: { ...req.body, slug }, errors, action: '/admin/categories/create', parents: parents.rows }, req);
            return res.render('admin/layout', { title: 'Создание категории', body, currentSection: 'categories' });
         }

         const pid = (parent_id && parent_id !== 'null' && parent_id !== '') ? parseInt(parent_id, 10) : null;
         const srt = parseInt(sort_order, 10) || 0;
         let icon_svg = null;
         if (req.file) icon_svg = `/uploads/icons/${req.file.filename}`;
         await pool.query(`INSERT INTO categories (name, slug, parent_id, sort_order, description, is_active, icon_svg) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [name.trim(), slug, pid, srt, description, is_active === 'on', icon_svg]);
         res.redirect('/admin/categories');
      } catch (err) { console.error(err); res.status(500).send('Ошибка сохранения'); }
   });

   // GET /admin/categories/:id/edit
   router.get('/:id/edit', async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         const cat = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
         if (cat.rows.length === 0) return res.status(404).send('Категория не найдена');
         const parents = await pool.query('SELECT id, name FROM categories WHERE id != $1 ORDER BY name', [id]);
         const body = await renderBody('admin/categories/form.ejs', { category: cat.rows[0], action: `/admin/categories/${id}/edit`, parents: parents.rows, errors: [] }, req);
         res.render('admin/layout', { title: 'Редактирование категории', body, currentSection: 'categories' });
      } catch (err) { console.error(err); res.status(500).send('Ошибка загрузки'); }
   });

   // POST /admin/categories/:id/edit
   router.post('/:id/edit', upload.single('icon'), optimizeAndReplace, requireFields('name'), async (req, res) => {
      try {
         let { name, slug, parent_id, sort_order, description, is_active, remove_icon } = req.body;
         const id = parseInt(req.params.id, 10);
         if (!slug || !slug.trim()) slug = await generateUniqueSlug(slugify(name), id);
         else { slug = slug.trim(); const ex = await pool.query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [slug, id]); if (ex.rows.length > 0) slug = await generateUniqueSlug(slug, id); }

         const errors = req.validationErrors || [];
         if (errors.length > 0) {
            const parents = await pool.query('SELECT id, name FROM categories WHERE id != $1 ORDER BY name', [id]);
            const cat = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
            const body = await renderBody('admin/categories/form.ejs', { category: { ...cat.rows[0], ...req.body, slug }, errors, action: `/admin/categories/${id}/edit`, parents: parents.rows }, req);
            return res.render('admin/layout', { title: 'Редактирование категории', body, currentSection: 'categories' });
         }

         const pid = (parent_id && parent_id !== 'null' && parent_id !== '') ? parseInt(parent_id, 10) : null;
         const srt = parseInt(sort_order, 10) || 0;
         const old = await pool.query('SELECT icon_svg FROM categories WHERE id = $1', [id]);
         const oldIcon = old.rows[0]?.icon_svg;
         let icon_svg = oldIcon;

         if (remove_icon === 'true') { if (oldIcon) deleteFile(oldIcon); icon_svg = null; }
         else if (req.file) { if (oldIcon) deleteFile(oldIcon); icon_svg = `/uploads/icons/${req.file.filename}`; }

         await pool.query(`UPDATE categories SET name=$1, slug=$2, parent_id=$3, sort_order=$4, description=$5, is_active=$6, icon_svg=$7 WHERE id=$8`, [name.trim(), slug, pid, srt, description, is_active === 'on', icon_svg, id]);
         res.redirect('/admin/categories');
      } catch (err) { console.error(err); res.status(500).send('Ошибка обновления'); }
   });

   // POST /admin/categories/:id/delete
   router.post('/:id/delete', async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         const childCats = await pool.query('SELECT id FROM categories WHERE parent_id = $1', [id]);
         if (childCats.rows.length > 0) return res.status(400).send('Сначала удалите или переназначьте дочерние категории');
         const products = await pool.query('SELECT id FROM products WHERE category_id = $1', [id]);
         if (products.rows.length > 0) return res.status(400).send('Сначала удалите или переназначьте товары этой категории');
         const cat = await pool.query('SELECT icon_svg FROM categories WHERE id = $1', [id]);
         if (cat.rows[0]?.icon_svg) deleteFile(cat.rows[0].icon_svg);
         await pool.query('DELETE FROM product_categories WHERE category_id = $1', [id]);
         await pool.query('DELETE FROM categories WHERE id = $1', [id]);
         res.redirect('/admin/categories');
      } catch (err) { console.error(err); res.status(500).send('Ошибка удаления'); }
   });

   return router;
};