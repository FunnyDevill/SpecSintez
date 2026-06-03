const request = require("supertest");
const { expect } = require("chai");
const app = require("../server");
const { createTables, clearTables } = require("./setup");

describe("Public API", () => {
  before(async () => {
    await createTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  // =================== НОВОСТИ ===================
  describe("GET /api/news", () => {
    it("should return hero and list (empty initially)", async () => {
      const res = await request(app).get("/api/news");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("hero").that.is.null;
      expect(res.body).to.have.property("list").that.is.an("array").that.is
        .empty;
    });

    it("should return active hero and non-hero items", async () => {
      const pool = require("../db");
      await pool.query(`INSERT INTO news (title, slug, is_active, is_hero, published_at) VALUES 
      ('Hero News', 'hero-news', true, true, '2026-01-01'),
      ('Regular News', 'regular-news', true, false, '2026-01-02'),
      ('Inactive News', 'inactive-news', false, false, '2026-01-03')`);

      const cache = require("../cache");
      cache.clear();

      const res = await request(app).get("/api/news");
      expect(res.status).to.equal(200);
      expect(res.body.hero).to.include({
        title: "Hero News",
        slug: "hero-news",
      });
      expect(res.body.list).to.have.lengthOf(1);
      expect(res.body.list[0]).to.include({
        title: "Regular News",
        slug: "regular-news",
      });
    });
  });

  describe("GET /api/news/:slug", () => {
    it("should return a single active news by slug", async () => {
      const pool = require("../db");
      await pool.query(`INSERT INTO news (title, slug, is_active, published_at) VALUES 
        ('Test News', 'test-news', true, '2026-01-01')`);

      const res = await request(app).get("/api/news/test-news");
      expect(res.status).to.equal(200);
      expect(res.body).to.include({ title: "Test News", slug: "test-news" });
    });

    it("should return 404 for inactive news", async () => {
      const pool = require("../db");
      await pool.query(`INSERT INTO news (title, slug, is_active, published_at) VALUES 
        ('Hidden News', 'hidden-news', false, '2026-01-01')`);

      const res = await request(app).get("/api/news/hidden-news");
      expect(res.status).to.equal(404);
    });

    it("should return 404 for non-existent slug", async () => {
      const res = await request(app).get("/api/news/non-existent");
      expect(res.status).to.equal(404);
    });
  });

  // =================== КАТЕГОРИИ ===================
  describe("GET /api/categories", () => {
    it("should return only active categories by default", async () => {
      const pool = require("../db");
      await pool.query(`INSERT INTO categories (name, slug, is_active) VALUES 
        ('Active', 'active', true),
        ('Inactive', 'inactive', false)`);

      const res = await request(app).get("/api/categories");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(1);
      expect(res.body[0]).to.include({ name: "Active", slug: "active" });
    });

    it("should return all categories if ?all=true", async () => {
      const pool = require("../db");
      await pool.query(`INSERT INTO categories (name, slug, is_active) VALUES 
        ('Active', 'active', true),
        ('Inactive', 'inactive', false)`);

      const res = await request(app).get("/api/categories?all=true");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(2);
    });
  });

  // =================== ТОВАРЫ ===================
  describe("GET /api/products", () => {
    it("should return only active products", async () => {
      const pool = require("../db");
      await pool.query(
        `INSERT INTO categories (name, slug, is_active) VALUES ('Cat', 'cat', true)`,
      );
      await pool.query(`INSERT INTO products (name, slug, category_id, is_active) VALUES 
        ('Active Product', 'active-product', 1, true),
        ('Inactive Product', 'inactive-product', 1, false)`);

      const res = await request(app).get("/api/products");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(1);
      expect(res.body[0]).to.include({ name: "Active Product" });
    });

    it("should return all products with ?all=true", async () => {
      const pool = require("../db");
      await pool.query(
        `INSERT INTO categories (name, slug, is_active) VALUES ('Cat', 'cat', true)`,
      );
      await pool.query(`INSERT INTO products (name, slug, category_id, is_active) VALUES 
        ('Active', 'active', 1, true),
        ('Inactive', 'inactive', 1, false)`);

      const res = await request(app).get("/api/products?all=true");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(2);
    });
  });

  describe("GET /api/random-products", () => {
    it("should return up to limit random active products", async () => {
      const pool = require("../db");
      await pool.query(
        `INSERT INTO categories (name, slug, is_active) VALUES ('Cat', 'cat', true)`,
      );
      for (let i = 1; i <= 5; i++) {
        await pool.query(`INSERT INTO products (name, slug, category_id, is_active) VALUES 
          ('Product ${i}', 'product-${i}', 1, true)`);
      }

      const res = await request(app).get("/api/random-products?limit=3");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(3);
      res.body.forEach((p) => expect(p.is_active).to.equal(true));
    });

    it("should return empty array if no active products", async () => {
      const res = await request(app).get("/api/random-products");
      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(0);
    });
  });

  describe("GET /api/products/:id", () => {
    it("should return a single product by id", async () => {
      const pool = require("../db");
      await pool.query(
        `INSERT INTO categories (name, slug, is_active) VALUES ('Cat', 'cat', true)`,
      );
      await pool.query(`INSERT INTO products (name, slug, category_id, is_active) VALUES 
        ('Single', 'single', 1, true)`);

      const res = await request(app).get("/api/products/1");
      expect(res.status).to.equal(200);
      expect(res.body).to.include({ id: 1, name: "Single", slug: "single" });
    });

    it("should return 404 for non-existent id", async () => {
      const res = await request(app).get("/api/products/999");
      expect(res.status).to.equal(404);
    });
  });

   describe('GET /api/products-by-slug/:slug', () => {
      beforeEach(async () => {
         const pool = require('../db');
         await pool.query('DELETE FROM product_package_types');
         await pool.query('DELETE FROM package_types');
         await pool.query('DELETE FROM product_images');
         await pool.query('DELETE FROM product_categories');
         await pool.query('DELETE FROM product_directions');
         await pool.query('DELETE FROM products');
         await pool.query('DELETE FROM categories');
         await pool.query('DELETE FROM directions');
      });

      it('should return full product data', async () => {
         const pool = require('../db');
         // Создаём категорию
         await pool.query(`INSERT INTO categories (id, name, slug, is_active) VALUES (100, 'Test Category', 'test-cat', true)`);
         // Создаём товар и привязываем к категории
         await pool.query(`INSERT INTO products (id, name, slug, category_id, is_active) VALUES (100, 'Test Product', 'test-product', 100, true)`);
         // Привязываем товар к категории через product_categories
         await pool.query(`INSERT INTO product_categories (product_id, category_id) VALUES (100, 100)`);
         // Изображение
         await pool.query(`INSERT INTO product_images (product_id, image_url, is_main) VALUES (100, '/test.jpg', true)`);
         // Тип упаковки
         await pool.query(`INSERT INTO package_types (id, name) VALUES (100, 'Can')`);
         await pool.query(`INSERT INTO product_package_types (product_id, package_type_id, volume) VALUES (100, 100, '5L')`);

         const res = await request(app).get('/api/products-by-slug/test-product');
         expect(res.status).to.equal(200);
         expect(res.body).to.include({ name: 'Test Product', slug: 'test-product' });
         // Проверяем, что категории загрузились (хотя бы одна)
         expect(res.body.categories).to.be.an('array');
         expect(res.body.categories.length).to.be.at.least(1);
         // Проверяем упаковки
         expect(res.body.package_types).to.be.an('array');
         expect(res.body.package_types.length).to.equal(1);
         // Проверяем изображения
         expect(res.body.images).to.be.an('array');
         expect(res.body.images.length).to.equal(1);
      });

      it('should return 404 for inactive product', async () => {
         const pool = require('../db');
         await pool.query(`INSERT INTO categories (id, name, slug, is_active) VALUES (200, 'Cat Inactive', 'cat-200', true)`);
         await pool.query(`INSERT INTO products (id, name, slug, category_id, is_active) VALUES (200, 'Hidden Product', 'hidden', 200, false)`);

         const res = await request(app).get('/api/products-by-slug/hidden');
         expect(res.status).to.equal(404);
      });
   });
});
