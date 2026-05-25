const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const ejs = require('ejs');
const { requireFields, checkSlugUnique } = require('./middleware/validation');

module.exports = (upload) => {
   const router = express.Router();

   const renderBody = async (viewPath, data, req) => {
      const csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : '';
      const nonce = req.nonce || '';
      const mergedData = { ...data, csrfToken, nonce };
      return await ejs.renderFile(path.join(__dirname, 'views', viewPath), mergedData);
   };

   // =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
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

   function buildProductFilter(search, sort, order, page, limit = 20) {
      let where = '';
      const params = [];
      if (search && search.trim() !== '') {
         where = `WHERE (p.name ILIKE $1 OR p.slug ILIKE $1)`;
         params.push(`%${search.trim()}%`);
      }

      const allowedSortFields = ['name', 'slug', 'sort_order', 'id'];
      const sortField = allowedSortFields.includes(sort) ? sort : 'id';
      const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

      const offset = ((page || 1) - 1) * limit;

      const query = `
         SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${where}
         ORDER BY ${sortField} ${sortOrder}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      const countQuery = `SELECT COUNT(*) FROM products p ${where}`;

      return { query, countQuery, params: [...params, limit, offset] };
   }

   // =================== ГЛАВНАЯ ===================
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

   // =================== НОВОСТИ ===================
   router.get('/news', async (req, res) => {
      try {
         const news = await pool.query('SELECT * FROM news ORDER BY published_at DESC');
         const body = await renderBody('admin/news/index.ejs', { news: news.rows }, req);
         res.render('admin/layout', { title: 'Новости', body, currentSection: 'news' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки новостей');
      }
   });

   router.get('/news/create', async (req, res) => {
      const body = await renderBody('admin/news/form.ejs', {
         news: null,
         action: '/admin/news/create',
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание новости', body, currentSection: 'news' });
   });

   router.post('/news/create',
      upload.single('image'),
      requireFields('title', 'slug'),
      checkSlugUnique('news', 'slug'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const body = await renderBody('admin/news/form.ejs', {
                  news: req.body,
                  errors,
                  action: '/admin/news/create'
               }, req);
               return res.render('admin/layout', { title: 'Создание новости', body, currentSection: 'news' });
            }

            const { title, slug, excerpt, content, published_at, meta_title, meta_description, is_active, is_hero } = req.body;
            let image_url = null;
            if (req.file) image_url = `/uploads/${req.file.filename}`;
            const active = (is_active === 'on' || is_active === true || is_active === 'true');
            const hero = (is_hero === 'on' || is_hero === true || is_hero === 'true');
            await pool.query(
               `INSERT INTO news (title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, is_active, is_hero)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
               [title.trim(), slug.trim(), excerpt, content, published_at, image_url, meta_title, meta_description, active, hero]
            );
            res.redirect('/admin/news');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка сохранения');
         }
      }
   );

   router.get('/news/:id/edit', async (req, res) => {
      try {
         const result = await pool.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
         if (result.rows.length === 0) return res.status(404).send('Новость не найдена');
         const body = await renderBody('admin/news/form.ejs', {
            news: result.rows[0],
            action: `/admin/news/${req.params.id}/edit`,
            errors: []
         }, req);
         res.render('admin/layout', { title: 'Редактирование новости', body, currentSection: 'news' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/news/:id/edit',
      upload.single('image'),
      requireFields('title', 'slug'),
      checkSlugUnique('news', 'slug', 'id'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const id = req.params.id;
               const oldNews = await pool.query('SELECT * FROM news WHERE id = $1', [id]);
               const body = await renderBody('admin/news/form.ejs', {
                  news: { ...oldNews.rows[0], ...req.body },
                  errors,
                  action: `/admin/news/${id}/edit`
               }, req);
               return res.render('admin/layout', { title: 'Редактирование новости', body, currentSection: 'news' });
            }

            const { title, slug, excerpt, content, published_at, meta_title, meta_description, is_active, is_hero, remove_image } = req.body;
            const id = req.params.id;

            const old = await pool.query('SELECT image_url FROM news WHERE id = $1', [id]);
            const oldImage = old.rows[0]?.image_url;
            let image_url = oldImage;

            if (remove_image === 'true') {
               if (oldImage) {
                  try {
                     const filePath = path.join(__dirname, '..', 'public', oldImage);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  } catch (e) { console.error('Ошибка удаления изображения:', e); }
               }
               image_url = null;
            } else if (req.file) {
               if (oldImage) {
                  try {
                     const filePath = path.join(__dirname, '..', 'public', oldImage);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  } catch (e) { console.error('Ошибка удаления старого изображения:', e); }
               }
               image_url = `/uploads/${req.file.filename}`;
            }

            const active = (is_active === 'on' || is_active === true || is_active === 'true');
            const hero = (is_hero === 'on' || is_hero === true || is_hero === 'true');
            await pool.query(
               `UPDATE news SET title=$1, slug=$2, excerpt=$3, content=$4, published_at=$5, image_url=$6, meta_title=$7, meta_description=$8, is_active=$9, is_hero=$10 WHERE id=$11`,
               [title.trim(), slug.trim(), excerpt, content, published_at, image_url, meta_title, meta_description, active, hero, id]
            );
            res.redirect('/admin/news');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка обновления');
         }
      }
   );

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
         const body = await renderBody('admin/categories/index.ejs', { categories: result.rows, allCategories: allCats.rows }, req);
         res.render('admin/layout', { title: 'Категории', body, currentSection: 'categories' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки категорий');
      }
   });

   router.get('/categories/create', async (req, res) => {
      const parents = await pool.query('SELECT id, name FROM categories ORDER BY name');
      const body = await renderBody('admin/categories/form.ejs', {
         category: null,
         action: '/admin/categories/create',
         parents: parents.rows,
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание категории', body, currentSection: 'categories' });
   });

   router.post('/categories/create',
      upload.single('icon'),
      requireFields('name', 'slug'),
      checkSlugUnique('categories', 'slug'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const parents = await pool.query('SELECT id, name FROM categories ORDER BY name');
               const body = await renderBody('admin/categories/form.ejs', {
                  category: req.body,
                  errors,
                  action: '/admin/categories/create',
                  parents: parents.rows
               }, req);
               return res.render('admin/layout', { title: 'Создание категории', body, currentSection: 'categories' });
            }

            const { name, slug, parent_id, sort_order, description, is_active } = req.body;
            let icon_svg = null;
            if (req.file) icon_svg = `/uploads/${req.file.filename}`;
            await pool.query(
               `INSERT INTO categories (name, slug, parent_id, sort_order, description, image_url, is_active, icon_svg)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
               [name.trim(), slug.trim(), parent_id || null, sort_order || 0, description, null, is_active === 'on', icon_svg]
            );
            res.redirect('/admin/categories');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка сохранения');
         }
      }
   );

   router.get('/categories/:id/edit', async (req, res) => {
      try {
         const cat = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
         if (cat.rows.length === 0) return res.status(404).send('Категория не найдена');
         const parents = await pool.query('SELECT id, name FROM categories WHERE id != $1 ORDER BY name', [req.params.id]);
         const body = await renderBody('admin/categories/form.ejs', {
            category: cat.rows[0],
            action: `/admin/categories/${req.params.id}/edit`,
            parents: parents.rows,
            errors: []
         }, req);
         res.render('admin/layout', { title: 'Редактирование категории', body, currentSection: 'categories' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/categories/:id/edit',
      upload.single('icon'),
      requireFields('name', 'slug'),
      checkSlugUnique('categories', 'slug', 'id'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const id = req.params.id;
               const parents = await pool.query('SELECT id, name FROM categories WHERE id != $1 ORDER BY name', [id]);
               const cat = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
               const body = await renderBody('admin/categories/form.ejs', {
                  category: { ...cat.rows[0], ...req.body },
                  errors,
                  action: `/admin/categories/${id}/edit`,
                  parents: parents.rows
               }, req);
               return res.render('admin/layout', { title: 'Редактирование категории', body, currentSection: 'categories' });
            }

            const { name, slug, parent_id, sort_order, description, is_active, remove_icon } = req.body;
            const id = req.params.id;

            const old = await pool.query('SELECT icon_svg FROM categories WHERE id = $1', [id]);
            const oldIcon = old.rows[0]?.icon_svg;
            let icon_svg = oldIcon;

            if (remove_icon === 'true') {
               if (oldIcon) {
                  try {
                     const filePath = path.join(__dirname, '..', 'public', oldIcon);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  } catch (e) { console.error('Ошибка удаления иконки:', e); }
               }
               icon_svg = null;
            } else if (req.file) {
               if (oldIcon) {
                  try {
                     const filePath = path.join(__dirname, '..', 'public', oldIcon);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  } catch (e) { console.error('Ошибка удаления старой иконки:', e); }
               }
               icon_svg = `/uploads/${req.file.filename}`;
            }

            await pool.query(
               `UPDATE categories SET name=$1, slug=$2, parent_id=$3, sort_order=$4, description=$5, image_url=$6, is_active=$7, icon_svg=$8 WHERE id=$9`,
               [name.trim(), slug.trim(), parent_id || null, sort_order || 0, description, null, is_active === 'on', icon_svg, id]
            );
            res.redirect('/admin/categories');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка обновления');
         }
      }
   );

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
         const { search, sort, order, page } = req.query;
         const currentPage = parseInt(page, 10) || 1;
         const { query, countQuery, params } = buildProductFilter(search, sort, order, currentPage);

         const products = await pool.query(query, params);
         const totalResult = await pool.query(countQuery, params.slice(0, params.length - 2));
         const totalProducts = parseInt(totalResult.rows[0].count, 10);
         const totalPages = Math.ceil(totalProducts / 20);

         const body = await renderBody('admin/products/index.ejs', {
            products: products.rows,
            currentSearch: search || '',
            sortField: sort || 'id',
            sortOrder: order || 'asc',
            currentPage,
            totalPages,
         }, req);
         res.render('admin/layout', { title: 'Товары', body, currentSection: 'products' });
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
         selectedCategories: [],
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание товара', body, currentSection: 'products' });
   });

   router.post('/products/create',
      requireFields('name', 'slug'),
      checkSlugUnique('products', 'slug'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const categories = await getCategoriesWithLevel();
               const body = await renderBody('admin/products/form.ejs', {
                  product: req.body,
                  errors,
                  action: '/admin/products/create',
                  categories,
                  selectedCategories: req.body.categories || []
               }, req);
               return res.render('admin/layout', { title: 'Создание товара', body, currentSection: 'products' });
            }

            const { name, slug, excerpt, description, category_id, sort_order, is_active } = req.body;
            const result = await pool.query(
               `INSERT INTO products (name, slug, excerpt, description, image_url, category_id, sort_order, is_active)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
               [name.trim(), slug.trim(), excerpt, description, null, category_id || null, sort_order || 0, is_active === 'on']
            );
            const productId = result.rows[0].id;

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
      }
   );

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
            selectedCategories: selectedCategories,
            errors: []
         }, req);
         res.render('admin/layout', { title: 'Редактирование товара', body, currentSection: 'products' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/products/:id/edit',
      requireFields('name', 'slug'),
      checkSlugUnique('products', 'slug', 'id'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const allCategories = await getCategoriesWithLevel();
               const selectedCategoriesRes = await pool.query('SELECT category_id FROM product_categories WHERE product_id = $1', [req.params.id]);
               const selectedCategories = selectedCategoriesRes.rows.map(row => row.category_id);
               const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
               const body = await renderBody('admin/products/form.ejs', {
                  product: { ...product.rows[0], ...req.body },
                  errors,
                  action: `/admin/products/${req.params.id}/edit`,
                  categories: allCategories,
                  selectedCategories
               }, req);
               return res.render('admin/layout', { title: 'Редактирование товара', body, currentSection: 'products' });
            }

            const { name, slug, excerpt, description, category_id, sort_order, is_active } = req.body;
            await pool.query(
               `UPDATE products SET name=$1, slug=$2, excerpt=$3, description=$4, category_id=$5, sort_order=$6, is_active=$7 WHERE id=$8`,
               [name.trim(), slug.trim(), excerpt, description, category_id || null, sort_order || 0, is_active === 'on', req.params.id]
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
      }
   );

   router.post('/products/:id/delete', async (req, res) => {
      try {
         const images = await pool.query('SELECT image_url FROM product_images WHERE product_id = $1', [req.params.id]);
         for (const img of images.rows) {
            try {
               const filePath = path.join(__dirname, '..', 'public', img.image_url);
               if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (fileErr) {
               console.error('Ошибка удаления файла изображения:', fileErr);
            }
         }
         await pool.query('DELETE FROM product_images WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM product_package_types WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM product_categories WHERE product_id = $1', [req.params.id]);
         await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
         res.redirect('/admin/products');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   // =================== ИЗОБРАЖЕНИЯ ТОВАРА (AJAX) ===================
   router.get('/products/:id/images/list', async (req, res) => {
      try {
         const images = await pool.query(
            `SELECT id, image_url, is_main, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order`,
            [req.params.id]
         );
         res.json(images.rows);
      } catch (err) {
         console.error(err);
         res.status(500).json({ error: 'Ошибка загрузки изображений' });
      }
   });

   router.post('/products/:id/images/upload', upload.array('images', 10), async (req, res) => {
      try {
         const productId = req.params.id;
         const files = req.files;
         if (!files || files.length === 0) return res.status(400).json({ error: 'Файлы не выбраны' });

         const mainCheck = await pool.query('SELECT id FROM product_images WHERE product_id = $1 AND is_main = true', [productId]);
         let mainExists = mainCheck.rows.length > 0;

         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileUrl = `/uploads/${file.filename}`;
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

   router.post('/products/:productId/images/:imageId/set-main', async (req, res) => {
      try {
         const { productId, imageId } = req.params;
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

   router.post('/products/:productId/images/:imageId/delete', async (req, res) => {
      try {
         const { productId, imageId } = req.params;
         const image = await pool.query('SELECT image_url, is_main FROM product_images WHERE id = $1 AND product_id = $2', [imageId, productId]);
         if (image.rows.length) {
            try {
               const filePath = path.join(__dirname, '..', 'public', image.rows[0].image_url);
               if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) { console.error('Ошибка удаления файла:', e); }
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

   // =================== ТИПЫ УПАКОВОК ===================
   router.get('/package-types', async (req, res) => {
      try {
         const types = await pool.query('SELECT id, name, icon_url FROM package_types ORDER BY name');
         const body = await renderBody('admin/package-types/index.ejs', { types: types.rows }, req);
         res.render('admin/layout', { title: 'Типы упаковок', body, currentSection: 'package-types' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.get('/package-types/create', async (req, res) => {
      const body = await renderBody('admin/package-types/form.ejs', {
         type: null,
         action: '/admin/package-types/create',
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание типа упаковки', body, currentSection: 'package-types' });
   });

   router.post('/package-types/create',
      upload.single('icon'),
      requireFields('name'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const body = await renderBody('admin/package-types/form.ejs', {
                  type: req.body,
                  errors,
                  action: '/admin/package-types/create'
               }, req);
               return res.render('admin/layout', { title: 'Создание типа упаковки', body, currentSection: 'package-types' });
            }

            const { name } = req.body;
            let icon_url = null;
            if (req.file) icon_url = `/uploads/${req.file.filename}`;
            await pool.query(
               `INSERT INTO package_types (name, icon_url) VALUES ($1, $2)`,
               [name.trim(), icon_url]
            );
            res.redirect('/admin/package-types');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка сохранения');
         }
      }
   );

   router.get('/package-types/:id/edit', async (req, res) => {
      try {
         const type = await pool.query('SELECT * FROM package_types WHERE id = $1', [req.params.id]);
         if (type.rows.length === 0) return res.status(404).send('Тип не найден');
         const body = await renderBody('admin/package-types/form.ejs', {
            type: type.rows[0],
            action: `/admin/package-types/${req.params.id}/edit`,
            errors: []
         }, req);
         res.render('admin/layout', { title: 'Редактирование типа упаковки', body, currentSection: 'package-types' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   router.post('/package-types/:id/edit',
      upload.single('icon'),
      requireFields('name'),
      async (req, res) => {
         try {
            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const id = req.params.id;
               const old = await pool.query('SELECT * FROM package_types WHERE id = $1', [id]);
               const body = await renderBody('admin/package-types/form.ejs', {
                  type: { ...old.rows[0], ...req.body },
                  errors,
                  action: `/admin/package-types/${id}/edit`
               }, req);
               return res.render('admin/layout', { title: 'Редактирование типа упаковки', body, currentSection: 'package-types' });
            }

            const { name, remove_icon } = req.body;
            const id = req.params.id;
            const old = await pool.query('SELECT icon_url FROM package_types WHERE id = $1', [id]);
            const oldIcon = old.rows[0]?.icon_url;
            let icon_url = oldIcon;

            if (remove_icon === 'true') {
               if (oldIcon) {
                  try {
                     const filePath = path.join(__dirname, '..', 'public', oldIcon);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  } catch (e) { console.error('Ошибка удаления иконки:', e); }
               }
               icon_url = null;
            } else if (req.file) {
               if (oldIcon) {
                  try {
                     const filePath = path.join(__dirname, '..', 'public', oldIcon);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  } catch (e) { console.error('Ошибка удаления старой иконки:', e); }
               }
               icon_url = `/uploads/${req.file.filename}`;
            }

            await pool.query(
               `UPDATE package_types SET name=$1, icon_url=$2 WHERE id=$3`,
               [name.trim(), icon_url, id]
            );
            res.redirect('/admin/package-types');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка обновления');
         }
      }
   );

   router.post('/package-types/:id/delete', async (req, res) => {
      try {
         const used = await pool.query(
            'SELECT 1 FROM product_package_types WHERE package_type_id = $1 LIMIT 1',
            [req.params.id]
         );
         if (used.rows.length > 0) {
            return res.status(400).send('Тип упаковки используется в товарах, сначала удалите связи');
         }
         const type = await pool.query('SELECT icon_url FROM package_types WHERE id = $1', [req.params.id]);
         if (type.rows[0]?.icon_url) {
            try {
               const filePath = path.join(__dirname, '..', 'public', type.rows[0].icon_url);
               if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) { console.error('Ошибка удаления иконки:', e); }
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
         }, req);
         res.render('admin/layout', { title: `Типы упаковок для ${product.rows[0].name}`, body, currentSection: 'products' });
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