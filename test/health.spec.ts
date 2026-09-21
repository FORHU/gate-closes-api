import { expect } from "chai";
import express from "express";
import request from "supertest";
import healthRoutes from "../src/routes/health.route";

describe("Health & Readiness Probes (Operational Maturity)", () => {
  let app: express.Express;

  before(() => {
    app = express();
    app.use(healthRoutes);
  });

  describe("GET /health (Liveness Probe)", () => {
    it("should return 200 with status ok and uptime", async () => {
      const res = await request(app).get("/health");

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("status", "ok");
      expect(res.body).to.have.property("uptime").that.is.a("number");
      expect(res.body).to.have.property("timestamp").that.is.a("string");
    });
  });

  describe("GET /readiness (Readiness Probe)", () => {
    it("should return diagnostic checks containing mongodb, redis, and socketAdapter", async () => {
      const res = await request(app).get("/readiness");

      // In unit test without live mongo, it should return either 200 (if connected) or 503 (if down)
      expect([200, 503]).to.include(res.status);
      expect(res.body).to.have.property("checks");
      expect(res.body.checks).to.have.property("mongodb");
      expect(res.body.checks).to.have.property("redis");
      expect(res.body.checks).to.have.property("socketAdapter");
      expect(res.body).to.have.property("timestamp");
    });
  });
});
