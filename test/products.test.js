const request = require("supertest");
const { expect } = require("chai");
const app = require("../server");
const { createTables, clearTables } = require("./setup");

describe("Admin Products API", () => {
  before(async () => {
    await createTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  describe("POST /admin/products/create", () => {
    it("should create a product and redirect", async () => {
      await request(app)
        .post("/admin/categories/create")
        .send({ name: "Cat1", slug: "cat1", is_active: "on" })
        .expect(302);

      const res = await request(app)
        .post("/admin/products/create")
        .send({
          name: "Test Product",
          slug: "test-product",
          excerpt: "test excerpt",
          description: "<p>desc</p>",
          sort_order: 0,
          is_active: "on",
          categories: [1],
        });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.match(/\/admin\/products\/\d+\/edit/);
    });

    it("should return validation errors for missing name", async () => {
      const res = await request(app)
        .post("/admin/products/create")
        .send({ slug: "test" });

      expect(res.status).to.equal(200);
      expect(res.text).to.include("обязательно для заполнения");
    });
  });
});
