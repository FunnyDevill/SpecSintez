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
        .send({ name: 'Root', slug: 'root', is_active: 'on' });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/categories');
    });

    it('should return validation error for missing name', async () => {
      const res = await request(app)
        .post('/admin/categories/create')
        .send({ slug: 'no-name' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Название обязательно');
    });

    it('should reject duplicate slug', async () => {
      await request(app)
        .post('/admin/categories/create')
        .send({ name: 'First', slug: 'dup' });
      const res = await request(app)
        .post('/admin/categories/create')
        .send({ name: 'Second', slug: 'dup' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Категория с таким slug уже существует');
    });
  });

  describe('POST /admin/categories/:id/edit', () => {
    it('should update a category', async () => {
      await request(app)
        .post('/admin/categories/create')
        .send({ name: 'Old', slug: 'old' });

      const res = await request(app)
        .post('/admin/categories/1/edit')
        .send({ name: 'New', slug: 'new', is_active: 'on' });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/categories');
    });

    it('should reject duplicate slug when editing another category', async () => {
      await request(app).post('/admin/categories/create').send({ name: 'A', slug: 'a' });
      await request(app).post('/admin/categories/create').send({ name: 'B', slug: 'b' });

      const res = await request(app)
        .post('/admin/categories/1/edit')
        .send({ name: 'A updated', slug: 'b' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Категория с таким slug уже существует');
    });
  });

  describe('POST /admin/categories/:id/delete', () => {
    it('should delete a leaf category', async () => {
      await request(app)
        .post('/admin/categories/create')
        .send({ name: 'Leaf', slug: 'leaf' });

      const res = await request(app)
        .post('/admin/categories/1/delete')
        .send({});

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/categories');
    });

    it('should not delete a category with children', async () => {
      // создаём родителя и ребёнка
      await request(app)
        .post('/admin/categories/create')
        .send({ name: 'Parent', slug: 'parent' });
      await request(app)
        .post('/admin/categories/create')
        .send({ name: 'Child', slug: 'child', parent_id: 1 });

      const res = await request(app)
        .post('/admin/categories/1/delete')
        .send({});

      expect(res.status).to.equal(400);
      expect(res.text).to.include('Сначала удалите или переназначьте дочерние категории');
    });
  });
});