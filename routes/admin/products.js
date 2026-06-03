const express = require('express');
const path = require('path');
const pool = require('../../db');
const ejs = require('ejs');
const { requireFields } = require('../../middleware/validation');
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
         const query = excludeId ? 'SELECT id FROM products WHERE slug = $1 AND id != $2' : 'SELECT id FROM products WHERE slug = $1';
         const params = excludeId ? [slug, excludeId] : [slug];
         const result = await pool.query(query, params);
         if (result.rows.length === 0) break;
         slug = `${baseSlug}-${counter}`; counter++;
      }
      return slug;
   }

   async function getCategoriesWithLevel() {
      const result = await pool.query(`
         WITH RECURSIVE cat_tree AS (
            SELECT id, name, slug, parent_id, sort_order, is_active, icon_svg, 0 AS level, ARRAY[id] AS path
            FROM categories WHERE parent_id IS NULL
            UNION ALL
            SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_active, c.icon_svg, ct.level + 1, ct.path || c.id
            FROM categories c INNER JOIN cat_tree ct ON c.parent_id = ct.id WHERE ct.level < 1
         )
         SELECT id, name, level, path, parent_id FROM cat_tree ORDER BY path
      `);
      return result.rows;
   }

   function buildProductFilter(search, sort, order, page, limit = 20) {
      let where = '', params = [];
      if (search && search.trim()) { where = 'WHERE (p.name ILIKE $1 OR p.slug ILIKE $1)'; params.push(`%${search.trim()}%`); }
      const sortField = ['name', 'slug', 'sort_order', 'id'].includes(sort) ? sort : 'id';
      const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
      const offset = (currentPage - 1) * limit;
      const query = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      const countQuery = `SELECT COUNT(*) FROM products p ${where}`;
      return { query, countQuery, params: [...params, limit, offset] };
   }

   // GET /admin/products
   router.get('/', async (req, res) => {
      try {
         const { search, sort, order, page } = req.query;
         const currentPage = parseInt(page, 10) || 1;
         let where = '', params = [];
         if (search && search.trim()) { where = 'WHERE (p.name ILIKE $1 OR p.slug ILIKE $1)'; params.push(`%${search.trim()}%`); }
         const sortField = ['name', 'slug', 'sort_order', 'id'].includes(sort) ? sort : 'id';
         const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
         const offset = (currentPage - 1) * 20;
         const products = await pool.query(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, 20, offset]);
         const totalResult = await pool.query(`SELECT COUNT(*) FROM products p ${where}`, params);
         const totalPages = Math.ceil(parseInt(totalResult.rows[0].count, 10) / 20);
         const body = await renderBody('admin/products/index.ejs', { products: products.rows, currentSearch: search || '', sortField, sortOrder, currentPage, totalPages }, req);
         res.render('admin/layout', { title: 'Товары', body, currentSection: 'products' });
      } catch (err) { console.error(err); res.status(500).send('Ошибка загрузки товаров'); }
   });

   // GET /admin/products/create
   router.get('/create', async (req, res) => {
      const categories = await getCategoriesWithLevel();
      const allPackageTypes = await pool.query('SELECT * FROM package_types ORDER BY name');
      const allDirections = await pool.query('SELECT * FROM directions ORDER BY sort_order');
      const body = await renderBody('admin/products/form.ejs', {
         product: null, action: '/admin/products/create',
         categories, selectedCategories: [],
         allPackageTypes: allPackageTypes.rows, selectedPackageTypes: [],
         allDirections: allDirections.rows, selectedDirections: [],
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание товара', body, currentSection: 'products' });
   });

   // POST /admin/products/create
   router.post('/create', requireFields('name'), async (req, res) => {
      try {
         let { name, slug, excerpt, description, properties, category_id, sort_order, is_active } = req.body;
         if (!slug || !slug.trim()) slug = await generateUniqueSlug(slugify(name));
         else { slug = slug.trim(); const ex = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]); if (ex.rows.length > 0) slug = await generateUniqueSlug(slug); }

         const errors = req.validationErrors || [];
         if (errors.length > 0) {
            const categories = await getCategoriesWithLevel();
            const allPackageTypes = await pool.query('SELECT * FROM package_types ORDER BY name');
            const allDirections = await pool.query('SELECT * FROM directions ORDER BY sort_order');
            const body = await renderBody('admin/products/form.ejs', {
               product: { ...req.body, slug }, errors, action: '/admin/products/create',
               categories, selectedCategories: req.body.categories || [],
               allPackageTypes: allPackageTypes.rows, selectedPackageTypes: [],
               allDirections: allDirections.rows, selectedDirections: req.body.directions || [],
               errors
            }, req);
            return res.render('admin/layout', { title: 'Создание товара', body, currentSection: 'products' });
         }

         const catId = (category_id && category_id !== 'null' && category_id !== '') ? parseInt(category_id, 10) : null;
         const sort = parseInt(sort_order, 10) || 0;
         const result = await pool.query(
            `INSERT INTO products (name, slug, excerpt, description, properties, image_url, category_id, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [name.trim(), slug, excerpt, description, properties || null, null, catId, sort, is_active === 'on']
         );
         const productId = result.rows[0].id;

         // Категории
         let catIds = Array.isArray(req.body.categories) ? req.body.categories : (req.body.categories ? [req.body.categories] : []);
         for (const cId of catIds) { if (cId) await pool.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1,$2)', [productId, cId]); }

         // Упаковки
         let pkgIds = Array.isArray(req.body.package_type_ids) ? req.body.package_type_ids : (req.body.package_type_ids ? [req.body.package_type_ids] : []);
         const volumesMap = {};
         for (const key in req.body) { if (key.startsWith('volume_')) volumesMap[key.split('_')[1]] = req.body[key]?.trim() || ''; }
         for (const ptid of pkgIds) { await pool.query('INSERT INTO product_package_types (product_id, package_type_id, volume) VALUES ($1,$2,$3)', [productId, ptid, volumesMap[ptid] || '']); }

         // Направления
         let dirIds = Array.isArray(req.body.directions) ? req.body.directions : (req.body.directions ? [req.body.directions] : []);
         for (const dirId of dirIds) { if (dirId) await pool.query('INSERT INTO product_directions (product_id, direction_id) VALUES ($1,$2)', [productId, dirId]); }

         res.redirect(`/admin/products/${productId}/edit`);
      } catch (err) { console.error(err); res.status(500).send('Ошибка сохранения'); }
   });

   // GET /admin/products/:id/edit
   router.get('/:id/edit', async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
         if (product.rows.length === 0) return res.status(404).send('Товар не найден');
         const allCategories = await getCategoriesWithLevel();
         const selCatRes = await pool.query('SELECT category_id FROM product_categories WHERE product_id = $1', [id]);
         const allPackageTypes = await pool.query('SELECT * FROM package_types ORDER BY name');
         const selPkgRes = await pool.query('SELECT package_type_id, volume FROM product_package_types WHERE product_id = $1', [id]);
         const allDirections = await pool.query('SELECT * FROM directions ORDER BY sort_order');
         const selDirRes = await pool.query('SELECT direction_id FROM product_directions WHERE product_id = $1', [id]);

         const body = await renderBody('admin/products/form.ejs', {
            product: product.rows[0], action: `/admin/products/${id}/edit`,
            categories: allCategories, selectedCategories: selCatRes.rows.map(r => r.category_id),
            allPackageTypes: allPackageTypes.rows, selectedPackageTypes: selPkgRes.rows,
            allDirections: allDirections.rows, selectedDirections: selDirRes.rows.map(r => r.direction_id),
            errors: []
         }, req);
         res.render('admin/layout', { title: 'Редактирование товара', body, currentSection: 'products' });
      } catch (err) { console.error(err); res.status(500).send('Ошибка загрузки'); }
   });

   // POST /admin/products/:id/edit
   router.post('/:id/edit', requireFields('name'), async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         let { name, slug, excerpt, description, properties, category_id, sort_order, is_active } = req.body;
         if (!slug || !slug.trim()) slug = await generateUniqueSlug(slugify(name), id);
         else { slug = slug.trim(); const ex = await pool.query('SELECT id FROM products WHERE slug = $1 AND id != $2', [slug, id]); if (ex.rows.length > 0) slug = await generateUniqueSlug(slug, id); }

         const errors = req.validationErrors || [];
         if (errors.length > 0) {
            const allCategories = await getCategoriesWithLevel();
            const selCatRes = await pool.query('SELECT category_id FROM product_categories WHERE product_id = $1', [id]);
            const allPackageTypes = await pool.query('SELECT * FROM package_types ORDER BY name');
            const selPkgRes = await pool.query('SELECT package_type_id, volume FROM product_package_types WHERE product_id = $1', [id]);
            const allDirections = await pool.query('SELECT * FROM directions ORDER BY sort_order');
            const selDirRes = await pool.query('SELECT direction_id FROM product_directions WHERE product_id = $1', [id]);
            const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
            const body = await renderBody('admin/products/form.ejs', {
               product: { ...product.rows[0], ...req.body, slug }, errors, action: `/admin/products/${id}/edit`,
               categories: allCategories, selectedCategories: selCatRes.rows.map(r => r.category_id),
               allPackageTypes: allPackageTypes.rows, selectedPackageTypes: selPkgRes.rows,
               allDirections: allDirections.rows, selectedDirections: selDirRes.rows.map(r => r.direction_id)
            }, req);
            return res.render('admin/layout', { title: 'Редактирование товара', body, currentSection: 'products' });
         }

         const catId = (category_id && category_id !== 'null' && category_id !== '') ? parseInt(category_id, 10) : null;
         const sort = parseInt(sort_order, 10) || 0;
         await pool.query(
            `UPDATE products SET name=$1, slug=$2, excerpt=$3, description=$4, properties=$5, category_id=$6, sort_order=$7, is_active=$8 WHERE id=$9`,
            [name.trim(), slug, excerpt, description, properties || null, catId, sort, is_active === 'on', id]
         );

         // Категории
         await pool.query('DELETE FROM product_categories WHERE product_id = $1', [id]);
         let catIds = Array.isArray(req.body.categories) ? req.body.categories : (req.body.categories ? [req.body.categories] : []);
         for (const cId of catIds) { if (cId) await pool.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1,$2)', [id, cId]); }

         // Упаковки
         await pool.query('DELETE FROM product_package_types WHERE product_id = $1', [id]);
         let pkgIds = Array.isArray(req.body.package_type_ids) ? req.body.package_type_ids : (req.body.package_type_ids ? [req.body.package_type_ids] : []);
         const volumesMap = {};
         for (const key in req.body) { if (key.startsWith('volume_')) volumesMap[key.split('_')[1]] = req.body[key]?.trim() || ''; }
         for (const ptid of pkgIds) { await pool.query('INSERT INTO product_package_types (product_id, package_type_id, volume) VALUES ($1,$2,$3)', [id, ptid, volumesMap[ptid] || '']); }

         // Направления
         await pool.query('DELETE FROM product_directions WHERE product_id = $1', [id]);
         let dirIds = Array.isArray(req.body.directions) ? req.body.directions : (req.body.directions ? [req.body.directions] : []);
         for (const dirId of dirIds) { if (dirId) await pool.query('INSERT INTO product_directions (product_id, direction_id) VALUES ($1,$2)', [id, dirId]); }

         res.redirect('/admin/products');
      } catch (err) { console.error(err); res.status(500).send('Ошибка обновления'); }
   });

   // POST /admin/products/:id/delete
   router.post('/:id/delete', async (req, res) => {
      try {
         const id = parseInt(req.params.id, 10);
         const images = await pool.query('SELECT image_url FROM product_images WHERE product_id = $1', [id]);
         for (const img of images.rows) { if (img.image_url) deleteFile(img.image_url); }
         const product = await pool.query('SELECT image_url FROM products WHERE id = $1', [id]);
         if (product.rows[0]?.image_url) deleteFile(product.rows[0].image_url);
         await pool.query('DELETE FROM product_images WHERE product_id = $1', [id]);
         await pool.query('DELETE FROM product_package_types WHERE product_id = $1', [id]);
         await pool.query('DELETE FROM product_categories WHERE product_id = $1', [id]);
         await pool.query('DELETE FROM product_directions WHERE product_id = $1', [id]);
         await pool.query('DELETE FROM products WHERE id = $1', [id]);
         res.redirect('/admin/products');
      } catch (err) { console.error(err); res.status(500).send('Ошибка удаления'); }
   });

   return router;
};