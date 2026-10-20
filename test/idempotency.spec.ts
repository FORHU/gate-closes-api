import { expect } from "chai";
import express from "express";
import request from "supertest";
import { idempotencyMiddleware } from "../src/middleware/idempotency.middleware";
import RedisUtil from "../src/utils/redis.util";

describe("Request Idempotency Middleware (§28)", () => {
  let app: express.Express;
  let counter = 0;
  const store: Record<string, string> = {};

  before(() => {
    // Stub RedisUtil with in-memory map for unit test
    (RedisUtil as any).redisClient = {
      isOpen: true,
      get: async (key: string) => store[key] || null,
      set: async (key: string, val: string) => {
        store[key] = val;
        return "OK";
      },
      del: async (key: string) => {
        delete store[key];
        return 1;
      },
    };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      // Simulate authenticated user
      req.user = { userId: "user-test-123" } as any;
      next();
    });

    app.post("/test-mutation", idempotencyMiddleware, (_req, res) => {
      counter += 1;
      res.status(201).json({ success: true, count: counter });
    });
  });

  beforeEach(() => {
    counter = 0;
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("should execute normally on each request when Idempotency-Key is absent", async () => {
    const res1 = await request(app).post("/test-mutation").send({ data: 1 });
    expect(res1.status).to.equal(201);
    expect(res1.body.count).to.equal(1);

    const res2 = await request(app).post("/test-mutation").send({ data: 2 });
    expect(res2.status).to.equal(201);
    expect(res2.body.count).to.equal(2);
  });

  it("should replay cached response on retry with same Idempotency-Key without re-executing handler", async () => {
    const idempotencyKey = "client-tx-uuid-789";

    // First request: executes and caches
    const res1 = await request(app)
      .post("/test-mutation")
      .set("Idempotency-Key", idempotencyKey)
      .send({ data: "initial" });

    expect(res1.status).to.equal(201);
    expect(res1.body.count).to.equal(1);

    // Second request (retry): should return cached response and NOT increment counter
    const res2 = await request(app)
      .post("/test-mutation")
      .set("Idempotency-Key", idempotencyKey)
      .send({ data: "retry" });

    expect(res2.status).to.equal(201);
    expect(res2.headers["x-cache-lookup"]).to.equal("HIT-IDEMPOTENT");
    expect(res2.body.count).to.equal(1); // handler was not re-executed!
    expect(counter).to.equal(1);
  });
});
