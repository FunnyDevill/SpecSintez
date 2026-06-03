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
const adminRouter = require('./routes/admin');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cache = require('./cache');
const cacheControl = require('./middleware/cacheControl');

const app = express();
const port = process.env.PORT || 5500;

function isTestEnv() {
   return process.env.NODE_ENV === 'test';
}

function customCsrfProtection(req, res, next) {
   if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      if (!req.session.csrfToken) {
         req.session.csrfToken = crypto.randomUUID();
      }
      res.cookie('csrfToken', req.session.csrfToken, { httpOnly: true, sameSite: 'strict' });
      res.locals.csrfToken = req.session.csrfToken;
      req.csrfToken = req.session.csrfToken;
      return next();
   }
   if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const token = (req.body && req.body._csrf) || (req.headers && req.headers['x-csrf-token']) || (req.cookies && req.cookies.csrfToken);
      if (!token || token !== req.session.csrfToken) {
         console.warn('CSRF token mismatch');
         return res.status(403).json({ error: 'Недействительный CSRF-токен' });
      }
   }
   next();
}

app.use((req, res, next) => {
   const nonce = crypto.randomUUID();
   res.locals.nonce = nonce;
   req.nonce = nonce;
   next();
});

if (!isTestEnv()) {
   app.use(helmet({
      contentSecurityPolicy: {
         directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            styleSrcAttr: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
         }
      }
   }));
}

app.use(compression());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      let uploadDir;
      if (req.originalUrl.includes('/news')) {
         uploadDir = path.join(__dirname, 'public', 'uploads', 'news');
      } else if (req.originalUrl.includes('/package-types') || req.originalUrl.includes('/categories')) {
         uploadDir = path.join(__dirname, 'public', 'uploads', 'icons');
      } else if (req.originalUrl.includes('/products') && req.originalUrl.includes('/images')) {
         uploadDir = path.join(__dirname, 'public', 'uploads', 'products');
      } else {
         uploadDir = path.join(__dirname, 'public', 'uploads');
      }
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
      const allowed = /jpeg|jpg|png|gif|webp|svg/;
      const ext = allowed.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowed.test(file.mimetype) || file.mimetype === 'image/svg+xml';
      if (ext && mimetype) cb(null, true);
      else cb(new Error('Только изображения'));
   }
});

app.use(cookieParser());
app.use(session({
   secret: process.env.SESSION_SECRET || 'default-secret',
   resave: false,
   saveUninitialized: false,
   cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(cors({ origin: ['https://specsintez.com', 'https://www.specsintez.com', 'https://admin.specsintez.com'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ХЕЛПЕР ДЛЯ БЕЗОПАСНОЙ ВСТАВКИ JSON В EJS-ШАБЛОНЫ =====
app.locals.safeJson = function(data) {
   if (data === undefined || data === null) return '""';
   return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
};

const transporter = nodemailer.createTransport({
   host: process.env.SMTP_HOST || 'smtp.mail.ru',
   port: parseInt(process.env.SMTP_PORT, 10) || 465,
   secure: process.env.SMTP_SECURE === 'true' || true,
   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

app.post('/api/send-form', async (req, res) => {
   try {
      if (!req.body || Object.keys(req.body).length === 0) return res.status(400).json({ error: 'Пустой запрос' });
      const { name, phone, email, city, message, department, form_type } = req.body;
      const phonePattern = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/;
      if (!phone || !phonePattern.test(phone.trim())) return res.status(400).json({ error: 'Введите корректный номер телефона' });
      const typeLabel = form_type === 'cta' ? 'CTA (футер)' : 'Контрактное производство';
      await transporter.sendMail({
         from: process.env.SMTP_USER,
         to: 'artem-korytov@mail.ru',
         subject: `Новая заявка с сайта СпецСинтез (${typeLabel})`,
         html: `<h2>Новая заявка – ${typeLabel}</h2>
            <p><strong>Имя:</strong> ${name || '—'}</p>
            <p><strong>Телефон:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email || '—'}</p>
            <p><strong>Город:</strong> ${city || '—'}</p>
            <p><strong>Сообщение:</strong> ${message || '—'}</p>
            <p><strong>Отдел:</strong> ${department || '—'}</p>`
      });
      res.json({ success: true });
   } catch (err) {
      console.error('Ошибка отправки письма:', err);
      res.status(500).json({ error: 'Ошибка при отправке' });
   }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules/tinymce')));
app.use('/login-assets', express.static(path.join(__dirname, 'public', 'login-assets')));

app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html')));
app.post('/admin/login', async (req, res) => {
   const { username, password } = req.body;
   if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) return res.status(500).json({ error: 'Ошибка конфигурации' });
   if (username === process.env.ADMIN_USER && await bcrypt.compare(password, process.env.ADMIN_PASS)) {
      req.session.isAdmin = true;
      return res.json({ success: true });
   }
   res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
});
app.get('/admin/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

const isAuthenticated = (req, res, next) => {
   if (isTestEnv()) return next();
   if (req.session && req.session.isAdmin) return next();
   res.redirect('/admin/login');
};

if (!isTestEnv()) {
   app.use('/admin', isAuthenticated, customCsrfProtection);
   app.use('/admin', isAuthenticated, express.static(path.join(__dirname, 'public', 'admin')));
   app.use('/admin', isAuthenticated, adminRouter(upload));
} else {
   app.use('/admin', adminRouter(upload));
}

// ===== ПУБЛИЧНЫЕ API =====
app.get('/api/news', cacheControl(300), async (req, res) => {
   try {
      const cacheKey = 'news_list';
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
      const heroResult = await pool.query(`SELECT id, title, slug, excerpt, content, image_url, published_at, is_hero FROM news WHERE is_active = true AND is_hero = true ORDER BY published_at DESC LIMIT 1`);
      const listResult = await pool.query(`SELECT id, title, slug, excerpt, image_url, published_at FROM news WHERE is_active = true AND (is_hero IS NOT true OR is_hero = false) ORDER BY published_at DESC LIMIT 20`);
      const data = { hero: heroResult.rows[0] || null, list: listResult.rows };
      cache.set(cacheKey, data, 300);
      res.json(data);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/news/:slug', cacheControl(300), async (req, res) => {
   try {
      const result = await pool.query(`SELECT * FROM news WHERE slug = $1 AND is_active = true`, [req.params.slug]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'News not found' });
      res.json(result.rows[0]);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/categories', cacheControl(600), async (req, res) => {
   try {
      const { all } = req.query;
      const cacheKey = all ? 'categories_all' : 'categories_active';
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
      const query = all
         ? 'SELECT id, name, slug, parent_id, sort_order, is_active, icon_svg FROM categories ORDER BY sort_order, id'
         : 'SELECT id, name, slug, parent_id, sort_order, icon_svg FROM categories WHERE is_active = true ORDER BY sort_order, id';
      const result = await pool.query(query);
      cache.set(cacheKey, result.rows, 600);
      res.json(result.rows);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/categories/:id/children', cacheControl(600), async (req, res) => {
   try {
      const result = await pool.query(`SELECT id, name, slug, sort_order, icon_svg FROM categories WHERE parent_id = $1 AND is_active = true ORDER BY sort_order, id`, [req.params.id]);
      res.json(result.rows);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/directions', cacheControl(600), async (req, res) => {
   try {
      const result = await pool.query('SELECT id, name, slug, image_url FROM directions ORDER BY sort_order');
      res.json(result.rows);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/products', cacheControl(300), async (req, res) => {
   const { category_id, direction_id, all, search } = req.query;
   try {
      let query, params = [];

      if (search) {
         query = `SELECT DISTINCT p.* FROM products p WHERE p.is_active = true AND p.name ILIKE $1 ORDER BY p.sort_order, p.id`;
         params = [`%${search.trim()}%`];
      } else {
         query = `SELECT DISTINCT p.* FROM products p WHERE ${all ? '1=1' : 'p.is_active = true'} ORDER BY p.sort_order, p.id`;
         params = [];
      }

      const result = await pool.query(query, params);
      const products = result.rows;

      if (products.length > 0) {
         const productIds = products.map(p => p.id);

         const categoriesResult = await pool.query(`
            SELECT pc.product_id, c.id, c.name, c.slug, c.parent_id, c.icon_svg
            FROM product_categories pc
            JOIN categories c ON pc.category_id = c.id
            WHERE pc.product_id = ANY($1)
         `, [productIds]);

         const directionsResult = await pool.query(`
            SELECT pd.product_id, d.id, d.name, d.slug, d.image_url
            FROM product_directions pd
            JOIN directions d ON pd.direction_id = d.id
            WHERE pd.product_id = ANY($1)
         `, [productIds]);

         const categoriesMap = {};
         categoriesResult.rows.forEach(row => {
            if (!categoriesMap[row.product_id]) categoriesMap[row.product_id] = [];
            categoriesMap[row.product_id].push(row);
         });

         const directionsMap = {};
         directionsResult.rows.forEach(row => {
            if (!directionsMap[row.product_id]) directionsMap[row.product_id] = [];
            directionsMap[row.product_id].push(row);
         });

         products.forEach(p => {
            p.categories = categoriesMap[p.id] || [];
            p.directions = directionsMap[p.id] || [];
         });
      }

      res.json(products);
   } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
   }
});

app.get('/api/random-products', cacheControl(60), async (req, res) => {
   const limit = parseInt(req.query.limit, 10) || 4;
   try {
      const maxIdResult = await pool.query('SELECT MAX(id) FROM products WHERE is_active = true');
      const maxId = maxIdResult.rows[0]?.max;
      
      if (!maxId) return res.json([]);

      const randomIds = new Set();
      const targetCount = Math.min(limit, maxId);
      
      while (randomIds.size < targetCount) {
         randomIds.add(Math.floor(Math.random() * maxId) + 1);
      }

      const result = await pool.query(
         'SELECT id, name, slug, excerpt, image_url, is_active FROM products WHERE id = ANY($1) AND is_active = true LIMIT $2',
         [Array.from(randomIds), limit]
      );
      res.json(result.rows);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/products/:id', cacheControl(300), async (req, res) => {
   try {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      res.json(result.rows[0]);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/package-types', cacheControl(600), async (req, res) => {
   try {
      const cached = cache.get('package_types');
      if (cached) return res.json(cached);
      const result = await pool.query('SELECT id, name, icon_url FROM package_types ORDER BY name');
      cache.set('package_types', result.rows, 600);
      res.json(result.rows);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/products-by-slug/:slug', cacheControl(300), async (req, res) => {
   try {
      const productResult = await pool.query(
         `SELECT id, name, slug, excerpt, description, properties, image_url, category_id, is_active
    FROM products WHERE slug = $1 AND is_active = true`,
         [req.params.slug]
      );
      
      if (productResult.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      
      const product = productResult.rows[0];

      const categoriesResult = await pool.query(`
         WITH RECURSIVE cat_tree AS (
            SELECT c.id, c.name, c.slug, c.icon_svg, c.parent_id, 0 as level
            FROM categories c
            JOIN product_categories pc ON c.id = pc.category_id
            WHERE pc.product_id = $1 AND c.parent_id IS NULL
            UNION ALL
            SELECT c.id, c.name, c.slug, c.icon_svg, c.parent_id, ct.level + 1
            FROM categories c
            JOIN product_categories pc ON c.id = pc.category_id
            JOIN cat_tree ct ON c.parent_id = ct.id
            WHERE pc.product_id = $1 AND ct.level < 1
         )
         SELECT * FROM cat_tree
      `, [product.id]);
      product.categories = categoriesResult.rows;

      const packageTypesResult = await pool.query(`SELECT pt.id, pt.name, pt.icon_url, ppt.volume FROM product_package_types ppt JOIN package_types pt ON ppt.package_type_id = pt.id WHERE ppt.product_id = $1`, [product.id]);
      product.package_types = packageTypesResult.rows;

      const imagesResult = await pool.query(`SELECT id, image_url, is_main FROM product_images WHERE product_id = $1 ORDER BY is_main DESC, sort_order`, [product.id]);
      product.images = imagesResult.rows;

      const directionsResult = await pool.query(`SELECT d.id, d.name, d.slug, d.image_url
         FROM product_directions pd JOIN directions d ON pd.direction_id = d.id WHERE pd.product_id = $1 ORDER BY d.sort_order`, [product.id]);
      product.directions = directionsResult.rows;

      res.json(product);
   } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

app.get('/news/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'news-detail.html')));

app.use((err, req, res, next) => {
   console.error('Unhandled error:', err.stack);
   res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;

if (require.main === module) {
   app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
}