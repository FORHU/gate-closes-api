import { expect } from "chai";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { requestIdMiddleware } from "../src/middleware/request-id.middleware";

describe("Rate Limiting & Correlation Middleware", () => {
  describe("Request Correlation (requestIdMiddleware)", () => {
    let app: express.Express;

    before(() => {
      app = express();
      app.use(requestIdMiddleware);
      app.get("/test-request-id", (req, res) => {
        res.json({ id: req.id });
      });
    });

    it("should generate a UUID X-Request-Id header when omitted", async () => {
      const res = await request(app).get("/test-request-id");

      expect(res.status).to.equal(200);
      expect(res.headers).to.have.property("x-request-id");
      expect(res.body.id).to.equal(res.headers["x-request-id"]);
      expect(res.headers["x-request-id"]).to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should preserve incoming X-Request-Id header when provided", async () => {
      const customId = "client-trace-12345";
      const res = await request(app)
        .get("/test-request-id")
        .set("X-Request-Id", customId);

      expect(res.status).to.equal(200);
      expect(res.headers["x-request-id"]).to.equal(customId);
      expect(res.body.id).to.equal(customId);
    });
  });

  describe("Tiered Rate Limiter Throttling", () => {
    let app: express.Express;

    before(() => {
      app = express();

      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({ message: "Too many requests" });
        },
      });

      app.use("/throttled", testLimiter, (_req, res) => {
        res.status(200).json({ ok: true });
      });
    });

    it("should set standard RateLimit-* headers and allow requests within quota", async () => {
      const res1 = await request(app).get("/throttled");
      expect(res1.status).to.equal(200);
      expect(res1.headers).to.have.property("ratelimit-limit");
      expect(res1.headers).to.have.property("ratelimit-remaining");

      const res2 = await request(app).get("/throttled");
      expect(res2.status).to.equal(200);

      const res3 = await request(app).get("/throttled");
      expect(res3.status).to.equal(200);
    });

    it("should return HTTP 429 when quota is exceeded", async () => {
      const res4 = await request(app).get("/throttled");
      expect(res4.status).to.equal(429);
      expect(res4.body).to.deep.equal({ message: "Too many requests" });
    });
  });
});
