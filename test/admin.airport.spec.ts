import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import type { Request, Response } from "express";
import * as turf from "@turf/turf";
import { ObjectId } from "mongodb";
import AirportSvc from "../src/services/airport.service";
import AirportRepo from "../src/repositories/airport.repository";
import RedisUtil from "../src/utils/redis.util";
import AdminAirportCtrl from "../src/controllers/admin.airport.controller";

// Admins set one airport's radius (or reset it to its type's default); the
// circle is redrawn, the map cache cleared, and imports keep it.
describe("Admin airport radius", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });
  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: unknown) => {
    const original = obj[key];
    (obj as Record<K, unknown>)[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  type MockRes = Response & { statusCode: number; body: { message?: string; data?: unknown } };
  const mockRes = () => {
    const res = { statusCode: 200, body: {} } as MockRes;
    res.status = ((code: number) => {
      res.statusCode = code;
      return res;
    }) as MockRes["status"];
    res.json = ((body: MockRes["body"]) => {
      res.body = body;
      return res;
    }) as MockRes["json"];
    return res;
  };

  const loakan = {
    _id: new ObjectId(),
    iata: "BAG",
    type: "medium_airport",
    radiusKm: 2.5,
    location: { type: "Point", coordinates: [120.6197, 16.3751] },
  };

  /** Records the update and whether the map cache was cleared. */
  const stubWrites = () => {
    const seen: { update?: Record<string, unknown>; cacheCleared: boolean } = {
      cacheCleared: false,
    };
    stub(AirportRepo, "findById", async () => loakan);
    stub(AirportRepo, "update", async (fields: Record<string, unknown>) => {
      seen.update = fields;
      return { matchedCount: 1 };
    });
    stub(RedisUtil, "del", async () => {
      seen.cacheCleared = true;
    });
    return seen;
  };

  const edgeKm = (boundary: unknown) => {
    const ring = (boundary as { coordinates: number[][][] }).coordinates[0];
    return turf.distance(
      turf.point(loakan.location.coordinates),
      turf.point(ring[0] as [number, number])
    );
  };

  it("sets a radius by hand: kept by imports, circle redrawn, cache cleared", async () => {
    const seen = stubWrites();
    const result = await AirportSvc.setRadius(loakan._id.toHexString(), 5);

    expect(seen.update).to.include({ radiusKm: 5, radiusManual: true });
    expect(edgeKm(seen.update!.boundary)).to.be.closeTo(5, 0.01);
    expect(seen.cacheCleared).to.equal(true);
    expect(result).to.include({ radiusKm: 5, radiusManual: true });
  });

  it("null goes back to the default size for the airport's type", async () => {
    const seen = stubWrites();
    await AirportSvc.setRadius(loakan._id.toHexString(), null);

    expect(seen.update).to.include({ radiusKm: 2.5, radiusManual: false });
    expect(edgeKm(seen.update!.boundary)).to.be.closeTo(2.5, 0.01);
  });

  it("the nearby import never overwrites an airport's radius or circle", async () => {
    let update: Record<string, Record<string, unknown>> = {};
    stub(AirportRepo, "collection", () => ({
      updateOne: async (_filter: unknown, u: Record<string, Record<string, unknown>>) => {
        update = u;
        return { acknowledged: true };
      },
    }));
    await AirportRepo.upsertByIataOrIcao({
      iata: "BAG",
      type: "medium_airport",
      radiusKm: 2.5,
      boundary: { type: "Polygon", coordinates: [] },
    });

    expect(update.$set).to.not.have.any.keys("radiusKm", "boundary", "createdAt", "radiusManual");
    expect(update.$setOnInsert).to.include.keys("radiusKm", "boundary", "createdAt");
  });

  it("refuses a radius outside 0.5-30 km", async () => {
    stubWrites();
    for (const radiusKm of [0, 0.2, 31, "big"]) {
      const res = mockRes();
      await AdminAirportCtrl.setRadius(
        { params: { id: loakan._id.toHexString() }, body: { radiusKm } } as unknown as Request,
        res
      );
      expect(res.statusCode, String(radiusKm)).to.equal(400);
    }
  });

  it("an unknown airport is 404", async () => {
    stub(AirportRepo, "findById", async () => null);
    const res = mockRes();
    await AdminAirportCtrl.setRadius(
      { params: { id: new ObjectId().toHexString() }, body: { radiusKm: 3 } } as unknown as Request,
      res
    );
    expect(res.statusCode).to.equal(404);
  });
});
