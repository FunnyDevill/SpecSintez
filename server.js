require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./db');
const session = require('express-session');
const bcrypt = require('bcrypt');
const adminRouter = require('./admin');

const app = express();
const port = process.env.PORT || 5500;

// ========== НАСТРОЙКА ШАБЛОНИЗАТОРА ==========
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== НАСТРОЙКА MULTER (ЗАГРУЗКА ИЗОБРАЖЕНИЙ) ==========
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
   },
   filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
   }
});

const upload = multer({
   storage,
   limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
   fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|gif|webp/;
      const ext = allowed.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowed.test(file.mimetype);
      if (ext && mimetype) {
         cb(null, true);
      } else {
         cb(new Error('Только изображения (jpeg, jpg, png, gif, webp)'));
      }
   }
});

// ========== СЕССИИ ==========
app.use(session({
   secret: process.env.SESSION_SECRET || 'default-secret',
   resave: false,
   saveUninitialized: false,
   cookie: {
      secure: false, // для разработки (http)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
   }
}));

// ========== ПАРСЕРЫ ТЕЛА ==========
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ПУБЛИЧНАЯ СТАТИКА (ОТКРЫТАЯ) ==========
app.use(express.static(path.join(__dirname, 'public'))); 

// Раздача статики для Quill из node_modules
app.use('/quill', express.static(path.join(__dirname, 'node_modules/quill/dist')));

app.use('/login-assets', express.static(path.join(__dirname, 'public', 'login-assets'))); // для страницы входа

// ========== МАРШРУТЫ ЛОГИНА (НЕ ЗАЩИЩЕНЫ) ==========
app.get('/admin/login', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.post('/admin/login', async (req, res) => {
   const { username, password } = req.body;
   const adminUser = process.env.ADMIN_USER;
   const adminPassHash = process.env.ADMIN_PASS;

   if (!adminUser || !adminPassHash) {
      return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
   }

   if (username === adminUser && await bcrypt.compare(password, adminPassHash)) {
      req.session.isAdmin = true;
      return res.json({ success: true });
   }
   res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
});

app.get('/admin/logout', (req, res) => {
   req.session.destroy();
   res.redirect('/admin/login');
});

// ========== MIDDLEWARE ЗАЩИТЫ ==========
const isAuthenticated = (req, res, next) => {
   if (req.session && req.session.isAdmin) return next();
   res.redirect('/admin/login');
};

// ========== ЗАЩИЩЁННЫЕ СТАТИЧЕСКИЕ РЕСУРСЫ АДМИНКИ ==========
app.use('/admin', isAuthenticated, express.static(path.join(__dirname, 'public', 'admin')));

// ========== АДМИН-API (ЗАЩИЩЁННЫЙ) ==========
app.use('/admin', isAuthenticated, adminRouter(upload));

// ========== ПУБЛИЧНЫЕ API (БЕЗ ЗАЩИТЫ) ==========
app.get('/api/news', async (req, res) => {
   try {
      const heroResult = await pool.query(
         `SELECT id, title, slug, excerpt, content, image_url, published_at, is_hero
          FROM news WHERE is_active = true AND is_hero = true
          ORDER BY published_at DESC LIMIT 1`
      );
      const hero = heroResult.rows[0] || null;
      const listResult = await pool.query(
         `SELECT id, title, slug, excerpt, image_url, published_at
          FROM news WHERE is_active = true AND (is_hero IS NOT true OR is_hero = false)
          ORDER BY published_at DESC LIMIT 20`
      );
      res.json({ hero, list: listResult.rows });
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

app.get('/api/news/:slug', async (req, res) => {
   try {
      const result = await pool.query(
         `SELECT id, title, slug, content, excerpt, image_url, published_at, meta_title, meta_description
          FROM news WHERE slug = $1 AND is_active = true`,
         [req.params.slug]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'News not found' });
      res.json(result.rows[0]);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

app.get('/api/categories', async (req, res) => {
   try {
      const { all } = req.query;
      const query = all
         ? 'SELECT id, name, slug, parent_id, sort_order, is_active, icon_svg FROM categories ORDER BY sort_order, id'
         : 'SELECT id, name, slug, parent_id, sort_order, icon_svg FROM categories WHERE is_active = true ORDER BY sort_order, id';
      const result = await pool.query(query);
      res.json(result.rows);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

app.get('/api/products', async (req, res) => {
   const { category_id, all } = req.query;
   try {
      let query, params;
      if (category_id) {
         query = `
            WITH RECURSIVE cat_tree AS (
                SELECT id FROM categories WHERE id = $1
                UNION ALL
                SELECT c.id FROM categories c INNER JOIN cat_tree ct ON c.parent_id = ct.id
            )
            SELECT p.* FROM products p
            WHERE p.category_id IN (SELECT id FROM cat_tree)
            ${all ? '' : 'AND p.is_active = true'}
            ORDER BY p.sort_order, p.id
         `;
         params = [category_id];
      } else {
         query = `SELECT * FROM products ${all ? '' : 'WHERE is_active = true'} ORDER BY sort_order, id`;
         params = [];
      }
      const result = await pool.query(query, params);
      res.json(result.rows);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

app.get('/api/random-products', async (req, res) => {
   const limit = parseInt(req.query.limit) || 4;
   try {
      const result = await pool.query(
         'SELECT * FROM products WHERE is_active = true ORDER BY RANDOM() LIMIT $1',
         [limit]
      );
      res.json(result.rows);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

app.get('/api/products/:id', async (req, res) => {
   try {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      res.json(result.rows[0]);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

// ========== ИСПРАВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ТОВАРА ПО SLUG ==========
app.get('/api/products-by-slug/:slug', async (req, res) => {
   try {
      const productResult = await pool.query(
         `SELECT id, name, slug, excerpt, description, image_url, category_id, is_active
          FROM products WHERE slug = $1 AND is_active = true`,
         [req.params.slug]
      );
      if (productResult.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      const product = productResult.rows[0];

      // Получаем только корневые категории (верхний уровень) для выбранных отраслей товара
      const categoriesResult = await pool.query(`
          WITH RECURSIVE roots AS (
              SELECT category_id as id
              FROM product_categories
              WHERE product_id = $1
              UNION
              SELECT c.parent_id
              FROM roots r
              JOIN categories c ON r.id = c.id
              WHERE c.parent_id IS NOT NULL
          )
          SELECT DISTINCT c.id, c.name, c.slug, c.icon_svg
          FROM categories c
          WHERE c.id IN (SELECT id FROM roots)
          AND c.parent_id IS NULL
      `, [product.id]);

      product.categories = categoriesResult.rows.map(row => ({
         id: row.id,
         slug: row.slug,
         name: row.name,
         icon_svg: row.icon_svg
      }));

      // Остальные подзапросы без изменений
      const packageTypesResult = await pool.query(`
         SELECT pt.id, pt.name, pt.icon_url, ppt.volume
         FROM product_package_types ppt
         JOIN package_types pt ON ppt.package_type_id = pt.id
         WHERE ppt.product_id = $1
         ORDER BY pt.sort_order
      `, [product.id]);
      product.package_types = packageTypesResult.rows;

      const imagesResult = await pool.query(`
         SELECT id, image_url, is_main
         FROM product_images
         WHERE product_id = $1
         ORDER BY is_main DESC, sort_order, id
      `, [product.id]);
      product.images = imagesResult.rows;

      const optionsResult = await pool.query(
         `SELECT id, name, image_url FROM product_options WHERE product_id = $1 ORDER BY sort_order`,
         [product.id]
      );
      product.options = optionsResult.rows;

      res.json(product);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});
// ========== СТРАНИЦЫ ПУБЛИЧНОЙ ЧАСТИ ==========
app.get('/news/:slug', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'news-detail.html'));
});
app.get('/product/:slug', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

// ========== ОБРАБОТЧИК ОШИБОК ==========
app.use((err, req, res, next) => {
   console.error('Unhandled error:', err);
   res.status(500).send('Internal Server Error');
});

// ========== ЗАПУСК ==========
app.listen(port, () => {
   console.log(`Server running at http://localhost:${port}`);
});