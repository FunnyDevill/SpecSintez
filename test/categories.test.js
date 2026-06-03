const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const { createTables, clearTables } = require('./setup');

describe('Admin Categories API', () => {
   before(async () => {
      await createTables();
   });

   afterEach(async () => {
      await clearTables();
   });

   describe('POST /admin/categories/create', () => {
      it('should create a root category and redirect', async () => {
         const res = await request(app)
            .post('/admin/categories/create')
            .send({ name: 'Root Category', slug: 'root-category', is_active: 'on' });

         expect(res.status).to.equal(302);
         expect(res.headers.location).to.equal('/admin/categories');
      });

      it('should return validation error for missing name', async () => {
         const res = await request(app)
            .post('/admin/categories/create')
            .send({ slug: 'no-name' });

         expect(res.status).to.equal(200);
         expect(res.text).to.include('обязательно для заполнения');
      });

      it('should auto-generate slug if not provided', async () => {
         const res = await request(app)
            .post('/admin/categories/create')
            .send({ name: 'Auto Slug Test Category', is_active: 'on' });

         expect(res.status).to.equal(302);
      });
   });

   describe('POST /admin/categories/:id/edit', () => {
      it('should update a category', async () => {
         await request(app)
            .post('/admin/categories/create')
            .send({ name: 'Old Cat', slug: 'old-cat' });

         const res = await request(app)
            .post('/admin/categories/1/edit')
            .send({ name: 'New Cat', slug: 'new-cat', is_active: 'on' });

         expect(res.status).to.equal(302);
      });
   });

   describe('POST /admin/categories/:id/delete', () => {
      it('should delete a leaf category', async () => {
         await request(app)
            .post('/admin/categories/create')
            .send({ name: 'Leaf Cat', slug: 'leaf-cat' });

         const res = await request(app)
            .post('/admin/categories/1/delete')
            .send({});

         expect(res.status).to.equal(302);
      });

      it('should not delete a category with children', async () => {
         await request(app)
            .post('/admin/categories/create')
            .send({ name: 'Parent Cat', slug: 'parent-cat' });
         await request(app)
            .post('/admin/categories/create')
            .send({ name: 'Child Cat', slug: 'child-cat', parent_id: 1 });

         const res = await request(app)
            .post('/admin/categories/1/delete')
            .send({});

         expect(res.status).to.equal(400);
         expect(res.text).to.include('Сначала удалите');
      });
   });
});