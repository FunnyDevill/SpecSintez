const request = require("supertest");
const { expect } = require("chai");
const app = require("../server");
const { createTables, clearTables } = require("./setup");

describe("Admin Package Types API", () => {
  before(async () => {
    await createTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  describe("POST /admin/package-types/create", () => {
    it("should create a package type and redirect", async () => {
      const res = await request(app)
        .post("/admin/package-types/create")
        .send({ name: "Canister" });

      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal("/admin/package-types");
    });

    it("should return validation error for missing name", async () => {
      const res = await request(app)
        .post("/admin/package-types/create")
        .send({ name: "" });

      expect(res.status).to.equal(200);
      expect(res.text).to.include("обязательно для заполнения");
    });
  });

  describe("POST /admin/package-types/:id/edit", () => {
    it("should update a package type", async () => {
      await request(app)
        .post("/admin/package-types/create")
        .send({ name: "Old" });

      const res = await request(app)
        .post("/admin/package-types/1/edit")
        .send({ name: "New" });

      expect(res.status).to.equal(302);
    });

    it("should return validation error for empty name", async () => {
      await request(app)
        .post("/admin/package-types/create")
        .send({ name: "Old" });

      const res = await request(app)
        .post("/admin/package-types/1/edit")
        .send({ name: "" });

      expect(res.status).to.equal(200);
      expect(res.text).to.include("обязательно для заполнения");
    });
  });

  describe("POST /admin/package-types/:id/delete", () => {
    it("should delete an unused package type", async () => {
      await request(app)
        .post("/admin/package-types/create")
        .send({ name: "To delete" });

      const res = await request(app)
        .post("/admin/package-types/1/delete")
        .send({});

      expect(res.status).to.equal(302);
    });
  });
});
