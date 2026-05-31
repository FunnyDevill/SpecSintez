require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./db');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const nodemailer = require('nodemailer');
const adminRouter = require('./admin');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');


const app = express();
const port = process.env.PORT || 5500;
const isTest = process.env.NODE_ENV === 'test';

// ========== СОБСТВЕННАЯ CSRF-ЗАЩИТА (без внешних пакетов) ==========
function customCsrfProtection(req, res, next) {
   // Для GET‑запросов генерируем токен, сохраняем в сессии и ставим куку
   if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      if (!req.session.csrfToken) {
         req.session.csrfToken = crypto.randomUUID();
      }
      // Устанавливаем куку, чтобы она была доступна на всех страницах админки
      res.cookie('csrfToken', req.session.csrfToken, { httpOnly: true, sameSite: 'strict' });
      res.locals.csrfToken = req.session.csrfToken;
      req.csrfToken = req.session.csrfToken;
      return next();
   }

   // Для изменяющих методов проверяем токен из куки
   if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const token = req.cookies.csrfToken;
      if (token !== req.session.csrfToken) {
         console.warn('CSRF token mismatch');
         return res.status(403).json({ error: 'Недействительный CSRF-токен' });
      }
   }
   next();
}

// ========== БЕЗОПАСНОСТЬ И ПРОИЗВОДИТЕЛЬНОСТЬ ==========
if (!isTest) {
   app.use((req, res, next) => {
      const nonce = crypto.randomUUID();
      res.locals.nonce = nonce;
      req.nonce = nonce;
      next();
   });

   // Строгая CSP для публичной части (по умолчанию)
   app.use(helmet({
      contentSecurityPolicy: {
         directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
            styleSrc: ["'self'"],
            fontSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
         }
      }
   }));

   // Отдельная CSP для админ-панели: разрешаем 'unsafe-inline' для стилей
   app.use('/admin', (req, res, next) => {
      helmet.contentSecurityPolicy({
         directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
            styleSrc: ["'self'", "'unsafe-inline'"],  // ← нужно для Quill
            fontSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
         }
      })(req, res, next);
   });
}

// ========== НАСТРОЙКА ШАБЛОНИЗАТОРА ==========
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== НАСТРОЙКА MULTER ==========
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
   limits: { fileSize: 5 * 1024 * 1024 },
   fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|gif|webp/;
      const ext = allowed.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowed.test(file.mimetype);
      if (ext && mimetype) cb(null, true);
      else cb(new Error('Только изображения'));
   }
});

// ========== СЕССИИ ==========
app.use(cookieParser());
app.use(session({
   secret: process.env.SESSION_SECRET || 'default-secret',
   resave: false,
   saveUninitialized: false,
   cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

// ========== ПАРСЕРЫ ТЕЛА ==========
app.use(cors({
   origin: [
      'https://specsintez.com',
      'https://www.specsintez.com',
      'https://admin.specsintez.com'
   ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== НАСТРОЙКА NODEMAILER ==========
const transporter = nodemailer.createTransport({
   host: process.env.SMTP_HOST || 'smtp.mail.ru',
   port: parseInt(process.env.SMTP_PORT, 10) || 465,
   secure: process.env.SMTP_SECURE === 'true' || true,
   auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
   }
});

// ========== МАРШРУТ ДЛЯ ОТПРАВКИ ФОРМ ==========
app.post('/api/send-form', async (req, res) => {
   try {
      if (!req.body || Object.keys(req.body).length === 0) {
         return res.status(400).json({ error: 'Пустой запрос' });
      }

      const { name, phone, email, city, message, department, form_type } = req.body;

      const phonePattern = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/;
      if (!phone || !phonePattern.test(phone.trim())) {
         return res.status(400).json({ error: 'Введите корректный номер телефона (например, +7 (123) 456-78-90)' });
      }

      const typeLabel = form_type === 'cta' ? 'CTA (футер)' : 'Контрактное производство';
      const mailOptions = {
         from: process.env.SMTP_USER,
         to: 'artem-korytov@mail.ru',
         subject: `Новая заявка с сайта СпецСинтез (${typeLabel})`,
         html: `
            <h2>Новая заявка – ${typeLabel}</h2>
            <p><strong>Имя:</strong> ${name || '—'}</p>
            <p><strong>Телефон:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email || '—'}</p>
            <p><strong>Город:</strong> ${city || '—'}</p>
            <p><strong>Сообщение:</strong> ${message || '—'}</p>
            <p><strong>Отдел:</strong> ${department || '—'}</p>
         `
      };
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
   } catch (err) {
      console.error('Ошибка отправки письма:', err);
      res.status(500).json({ error: 'Ошибка при отправке' });
   }
});

// ========== ПУБЛИЧНАЯ СТАТИКА ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/quill', express.static(path.join(__dirname, 'node_modules/quill/dist')));
app.use('/login-assets', express.static(path.join(__dirname, 'public', 'login-assets')));

// ========== TinyMCE ==========
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules/tinymce')));

// ========== МАРШРУТЫ ЛОГИНА ==========
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

// ========== MIDDLEWARE ЗАЩИТЫ АДМИН-ПАНЕЛИ ==========
const isAuthenticated = (req, res, next) => {
   if (isTest) return next();
   if (req.session && req.session.isAdmin) return next();
   res.redirect('/admin/login');
};

// ========== ПРИМЕНЯЕМ CSRF-ЗАЩИТУ К АДМИНКЕ (САМОДЕЛЬНУЮ) ==========
if (!isTest) {
   app.use('/admin', isAuthenticated, customCsrfProtection);
}

// ========== ЗАЩИЩЁННЫЕ СТАТИЧЕСКИЕ РЕСУРСЫ АДМИНКИ ==========
app.use('/admin', isAuthenticated, express.static(path.join(__dirname, 'public', 'admin')));

// ========== АДМИН-API ==========
app.use('/admin', isAuthenticated, adminRouter(upload));

// ========== ПУБЛИЧНЫЕ API ==========
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
   const { category_id, all, search } = req.query;
   try {
      let query, params = [];
      if (search) {
         query = `SELECT p.* FROM products p WHERE p.is_active = true AND LOWER(p.name) = LOWER($1) ORDER BY p.sort_order, p.id`;
         params = [search.trim()];
      } else if (category_id) {
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

app.get('/api/products-by-slug/:slug', async (req, res) => {
   try {
      const productResult = await pool.query(
         `SELECT id, name, slug, excerpt, description, image_url, category_id, is_active
          FROM products WHERE slug = $1 AND is_active = true`,
         [req.params.slug]
      );
      if (productResult.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      const product = productResult.rows[0];

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

// ========== ЕДИНЫЙ ОБРАБОТЧИК ОШИБОК ==========
app.use((err, req, res, next) => {
   console.error('Unhandled error:', err.stack);
   res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ========== ЭКСПОРТ ДЛЯ ТЕСТОВ ==========
module.exports = app;

// ========== ЗАПУСК ==========
if (require.main === module) {
   app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
   });
}