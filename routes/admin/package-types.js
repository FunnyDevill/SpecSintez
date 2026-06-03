const express = require('express');
const path = require('path');
const pool = require('../../db');
const ejs = require('ejs');
const { requireFields } = require('../../middleware/validation');
const optimizeAndReplace = require('../../middleware/uploadOptimize');

module.exports = (upload, deleteFile) => {
   const router = express.Router();

   const renderBody = async (viewPath, data, req) => {
      const csrfToken = req.csrfToken || '';
      const nonce = req.nonce || '';
      const mergedData = { ...data, csrfToken, nonce };
      return await ejs.renderFile(path.join(__dirname, '..', '..', 'views', viewPath), mergedData);
   };

   // GET /admin/package-types
   router.get('/', async (req, res) => {
      try {
         const types = await pool.query('SELECT id, name, icon_url FROM package_types ORDER BY name');
         const body = await renderBody('admin/package-types/index.ejs', { types: types.rows }, req);
         res.render('admin/layout', { title: 'Типы упаковок', body, currentSection: 'package-types' });
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка загрузки');
      }
   });

   // GET /admin/package-types/create
   router.get('/create', async (req, res) => {
      const body = await renderBody('admin/package-types/form.ejs', {
         type: null,
         action: '/admin/package-types/create',
         errors: []
      }, req);
      res.render('admin/layout', { title: 'Создание типа упаковки', body, currentSection: 'package-types' });
   });

   // POST /admin/package-types/create
   router.post('/create',
      upload.single('icon'),
      optimizeAndReplace,
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
            if (req.file) icon_url = `/uploads/icons/${req.file.filename}`;
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

   // GET /admin/package-types/:id/edit
   router.get('/:id/edit', async (req, res) => {
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

   // POST /admin/package-types/:id/edit
   router.post('/:id/edit',
      upload.single('icon'),
      optimizeAndReplace,
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
               if (oldIcon) deleteFile(oldIcon);
               icon_url = null;
            } else if (req.file) {
               if (oldIcon) deleteFile(oldIcon);
               icon_url = `/uploads/icons/${req.file.filename}`;
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

   // POST /admin/package-types/:id/delete
   router.post('/:id/delete', async (req, res) => {
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
            deleteFile(type.rows[0].icon_url);
         }
         await pool.query('DELETE FROM package_types WHERE id = $1', [req.params.id]);
         res.redirect('/admin/package-types');
      } catch (err) {
         console.error(err);
         res.status(500).send('Ошибка удаления');
      }
   });

   return router;
};