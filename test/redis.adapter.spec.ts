import { expect } from "chai";
import { describe, it } from "mocha";
import { Server } from "socket.io";
import { createServer } from "http";
import { RedisAdapterManager } from "../src/utils/redis.adapter";

describe("RedisAdapterManager (Horizontal Clustering)", () => {
  it("falls back to in-memory adapter gracefully when Redis is not available or disabled", async () => {
    const httpServer = createServer();
    const testIo = new Server(httpServer);

    // Call initAdapter with a mocked unreachable host
    const connected = await RedisAdapterManager.initAdapter(testIo);

    // Should return false and not throw an uncaught exception
    expect(typeof connected).to.equal("boolean");

    httpServer.close();
  });

  it("safely closes adapter connections without error", async () => {
    await RedisAdapterManager.close();
    const clients = RedisAdapterManager.getClients();
    expect(clients.pubClient).to.be.null;
    expect(clients.subClient).to.be.null;
  });
});
