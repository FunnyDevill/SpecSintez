const express = require('express');
const path = require('path');
const pool = require('../../db');
const ejs = require('ejs');
const { requireFields, requireDate } = require('../../middleware/validation');
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

   // Генерация уникального slug
   async function generateUniqueSlug(baseSlug, excludeId = null) {
      let slug = baseSlug;
      let counter = 1;

      while (true) {
         const query = excludeId
            ? 'SELECT id FROM news WHERE slug = $1 AND id != $2'
            : 'SELECT id FROM news WHERE slug = $1';
         const params = excludeId ? [slug, excludeId] : [slug];
         const result = await pool.query(query, params);

         if (result.rows.length === 0) break;

         slug = `${baseSlug}-${counter}`;
         counter++;
      }

      return slug;
   }

   // GET /admin/news
   router.get('/', async (req, res) => {
      try {
         const news = await pool.query('SELECT * FROM news ORDER BY published_at DESC');
         const body = await renderBody('admin/news/index.ejs', { news: news.rows }, req);
         res.render('admin/layout', { title: 'Новости', body, currentSection: 'news' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки новостей');
      }
   });

   // GET /admin/news/create
   router.get('/create', async (req, res) => {
      const body = await renderBody('admin/news/form.ejs', {
         news: null,
         action: '/admin/news/create',
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание новости', body, currentSection: 'news' });
   });

   // POST /admin/news/create
   router.post('/create',
      upload.single('image'),
      optimizeAndReplace,
      requireFields('title'),
      requireDate('published_at', 'Дата публикации обязательна'),
      async (req, res) => {
         try {
            let { title, slug, excerpt, content, published_at, meta_title, meta_description, is_active, is_hero } = req.body;

            // Исправляем пустую дату
            if (!published_at || published_at.trim() === '') {
               published_at = null;
            }

            // Автоматическая генерация slug
            if (!slug || slug.trim() === '') {
               slug = await generateUniqueSlug(slugify(title));
            } else {
               slug = slug.trim();
               const existing = await pool.query('SELECT id FROM news WHERE slug = $1', [slug]);
               if (existing.rows.length > 0) {
                  slug = await generateUniqueSlug(slug);
               }
            }

            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const body = await renderBody('admin/news/form.ejs', {
                  news: { ...req.body, slug },
                  errors,
                  action: '/admin/news/create'
               }, req);
               return res.render('admin/layout', { title: 'Создание новости', body, currentSection: 'news' });
            }

            let image_url = null;
            if (req.file) image_url = `/uploads/news/${req.file.filename}`;
            const active = (is_active === 'on' || is_active === true || is_active === 'true');
            const hero = (is_hero === 'on' || is_hero === true || is_hero === 'true');

            await pool.query(
               `INSERT INTO news (title, slug, excerpt, content, published_at, image_url, meta_title, meta_description, is_active, is_hero)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
               [title.trim(), slug, excerpt, content, published_at, image_url, meta_title, meta_description, active, hero]
            );
            res.redirect('/admin/news');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка сохранения');
         }
      }
   );

   // GET /admin/news/:id/edit
   router.get('/:id/edit', async (req, res) => {
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

   // POST /admin/news/:id/edit
   router.post('/:id/edit',
      upload.single('image'),
      optimizeAndReplace,
      requireFields('title'),
      requireDate('published_at', 'Дата публикации обязательна'),
      async (req, res) => {
         try {
            let { title, slug, excerpt, content, published_at, meta_title, meta_description, is_active, is_hero, remove_image } = req.body;
            const id = req.params.id;

            // Исправляем пустую дату
            if (!published_at || published_at.trim() === '') {
               published_at = null;
            }

            // Автоматическая генерация slug
            if (!slug || slug.trim() === '') {
               slug = await generateUniqueSlug(slugify(title), id);
            } else {
               slug = slug.trim();
               const existing = await pool.query('SELECT id FROM news WHERE slug = $1 AND id != $2', [slug, id]);
               if (existing.rows.length > 0) {
                  slug = await generateUniqueSlug(slug, id);
               }
            }

            const errors = req.validationErrors || [];
            if (errors.length > 0) {
               const oldNews = await pool.query('SELECT * FROM news WHERE id = $1', [id]);
               const body = await renderBody('admin/news/form.ejs', {
                  news: { ...oldNews.rows[0], ...req.body, slug },
                  errors,
                  action: `/admin/news/${id}/edit`
               }, req);
               return res.render('admin/layout', { title: 'Редактирование новости', body, currentSection: 'news' });
            }

            const old = await pool.query('SELECT image_url FROM news WHERE id = $1', [id]);
            const oldImage = old.rows[0]?.image_url;
            let image_url = oldImage;

            if (remove_image === 'true') {
               if (oldImage) deleteFile(oldImage);
               image_url = null;
            } else if (req.file) {
               if (oldImage) deleteFile(oldImage);
               image_url = `/uploads/news/${req.file.filename}`;
            }

            const active = (is_active === 'on' || is_active === true || is_active === 'true');
            const hero = (is_hero === 'on' || is_hero === true || is_hero === 'true');

            await pool.query(
               `UPDATE news SET title=$1, slug=$2, excerpt=$3, content=$4, published_at=$5, image_url=$6, meta_title=$7, meta_description=$8, is_active=$9, is_hero=$10 WHERE id=$11`,
               [title.trim(), slug, excerpt, content, published_at, image_url, meta_title, meta_description, active, hero, id]
            );
            res.redirect('/admin/news');
         } catch (err) {
            console.error(err);
            res.status(500).send('Ошибка обновления');
         }
      }
   );

   // POST /admin/news/:id/delete
   router.post('/:id/delete', async (req, res) => {
      try {
         const news = await pool.query('SELECT image_url FROM news WHERE id = $1', [req.params.id]);
         if (news.rows[0]?.image_url) {
            deleteFile(news.rows[0].image_url);
         }
         await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
         res.redirect('/admin/news');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   return router;
};