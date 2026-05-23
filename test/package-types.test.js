const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const { createTables, clearTables } = require('./setup');

describe('Admin Package Types API', () => {
  before(async () => {
    await createTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  describe('POST /admin/package-types/create', () => {
    it('should create a package type and redirect', async () => {
      const res = await request(app)
        .post('/admin/package-types/create')
        .send({ name: 'Canister' });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/package-types');
    });

    it('should return validation error for missing name', async () => {
      const res = await request(app)
        .post('/admin/package-types/create')
        .send({ name: '' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Название обязательно');
    });
  });

  describe('POST /admin/package-types/:id/edit', () => {
    it('should update a package type', async () => {
      await request(app)
        .post('/admin/package-types/create')
        .send({ name: 'Old' });

      const res = await request(app)
        .post('/admin/package-types/1/edit')
        .send({ name: 'New' });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/package-types');
    });

    it('should return validation error for empty name', async () => {
      await request(app)
        .post('/admin/package-types/create')
        .send({ name: 'Old' });

      const res = await request(app)
        .post('/admin/package-types/1/edit')
        .send({ name: '' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Название обязательно');
    });
  });

  describe('POST /admin/package-types/:id/delete', () => {
    it('should delete an unused package type', async () => {
      await request(app)
        .post('/admin/package-types/create')
        .send({ name: 'To delete' });

      const res = await request(app)
        .post('/admin/package-types/1/delete')
        .send({});

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/package-types');
    });

    // для проверки использования в товарах нужен более сложный тест с созданием товара и привязкой
    it('should prevent deletion if used by a product', async () => {
      // создаём тип упаковки и товар, затем привязываем
      await request(app)
        .post('/admin/package-types/create')
        .send({ name: 'Used' });
      await request(app)
        .post('/admin/categories/create')
        .send({ name: 'Cat', slug: 'cat' });
      await request(app)
        .post('/admin/products/create')
        .send({ name: 'Prod', slug: 'prod', category_id: 1 });
      // привязываем тип к товару (через маршрут привязки)
      await request(app)
        .post('/admin/products/1/package-types')
        .send({ package_type_ids: [1], volume_1: '5l' });

      const res = await request(app)
        .post('/admin/package-types/1/delete')
        .send({});

      expect(res.status).to.equal(400);
      expect(res.text).to.include('Тип упаковки используется в товарах');
    });
  });
});