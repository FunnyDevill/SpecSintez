const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const { createTables, clearTables } = require('./setup');

describe('Admin News API', () => {
  before(async () => {
    await createTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  describe('POST /admin/news/create', () => {
    it('should create a news item and redirect', async () => {
      const res = await request(app)
        .post('/admin/news/create')
        .send({
          title: 'Test News',
          slug: 'test-news',
          excerpt: 'Short description',
          content: '<p>Content</p>',
          published_at: '2026-01-01',
          is_active: 'on',
          is_hero: 'on'
        });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/news');
    });

    it('should return validation errors for missing title', async () => {
      const res = await request(app)
        .post('/admin/news/create')
        .send({ slug: 'no-title' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Заголовок обязателен');
    });

    it('should reject duplicate slug', async () => {
      await request(app)
        .post('/admin/news/create')
        .send({ title: 'First', slug: 'dup', published_at: '2026-01-01' })
        .expect(302);

      const res = await request(app)
        .post('/admin/news/create')
        .send({ title: 'Second', slug: 'dup', published_at: '2026-01-01' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Новость с таким slug уже существует');
    });
  });

  describe('POST /admin/news/:id/edit', () => {
    it('should update an existing news item', async () => {
      // Создаём
      await request(app)
        .post('/admin/news/create')
        .send({ title: 'Old', slug: 'old-slug', published_at: '2026-01-01' });

      const res = await request(app)
        .post('/admin/news/1/edit')
        .send({ title: 'Updated', slug: 'old-slug', published_at: '2026-01-02' });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/news');
    });

    it('should reject duplicate slug when editing different news', async () => {
      await request(app).post('/admin/news/create').send({ title: 'A', slug: 'slug-a' });
      await request(app).post('/admin/news/create').send({ title: 'B', slug: 'slug-b' });

      const res = await request(app)
        .post('/admin/news/1/edit')
        .send({ title: 'A updated', slug: 'slug-b' });

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Новость с таким slug уже существует');
    });
  });

  describe('POST /admin/news/:id/delete', () => {
    it('should delete a news item', async () => {
      await request(app)
        .post('/admin/news/create')
        .send({ title: 'To delete', slug: 'delete-me', published_at: '2026-01-01' });

      const res = await request(app)
        .post('/admin/news/1/delete')
        .send({});

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/admin/news');
    });
  });
});