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

// One page at a time: the database filters, orders, skips, limits and
// counts; the API validates the page and returns the totals.
describe("Admin airport list (server-side pagination)", () => {
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

  type MockRes = Response & {
    statusCode: number;
    body: { message?: string; data?: unknown; pagination?: unknown };
  };
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

  it("asks the database for one page, exact codes first, and counts the same match", async () => {
    let pipeline: Record<string, unknown>[] = [];
    let counted: unknown = null;
    stub(AirportRepo, "collection", () => ({
      aggregate: (p: Record<string, unknown>[]) => {
        pipeline = p;
        return { toArray: async () => [] };
      },
      countDocuments: async (m: unknown) => {
        counted = m;
        return 23;
      },
    }));

    const result = await AirportRepo.listForAdmin({ q: " mnl ", page: 2, limit: 10 });

    const match = (pipeline[0] as { $match: { $or: Record<string, unknown>[] } }).$match;
    expect(match.$or[0]).to.deep.equal({ iata: "MNL" });
    expect(match.$or[1]).to.deep.equal({ icao: "MNL" });
    expect((match.$or[2].airport as RegExp).source).to.equal("mnl");
    expect(counted).to.equal(match);
    expect(pipeline[1]).to.have.property("$addFields");
    expect(pipeline[2]).to.deep.equal({
      $sort: { _exact: 1, radiusManual: -1, type: 1, iata: 1, _id: 1 },
    });
    expect(pipeline[3]).to.deep.equal({ $skip: 10 });
    expect(pipeline[4]).to.deep.equal({ $limit: 10 });
    expect(result.total).to.equal(23);
  });

  it("without a search: everything, hand-set radii first", async () => {
    let pipeline: Record<string, unknown>[] = [];
    stub(AirportRepo, "collection", () => ({
      aggregate: (p: Record<string, unknown>[]) => {
        pipeline = p;
        return { toArray: async () => [] };
      },
      countDocuments: async () => 0,
    }));

    await AirportRepo.listForAdmin({});

    expect(pipeline[0]).to.deep.equal({ $match: {} });
    expect(pipeline[1]).to.deep.equal({ $sort: { radiusManual: -1, type: 1, iata: 1, _id: 1 } });
    expect(pipeline[2]).to.deep.equal({ $skip: 0 });
  });

  it("returns the page with its totals and default size", async () => {
    stub(AirportRepo, "listForAdmin", async () => ({
      airports: [
        {
          _id: new ObjectId(),
          iata: "MNL",
          type: "large_airport",
          radiusKm: 1,
          radiusManual: true,
        },
      ],
      total: 23,
    }));
    const res = mockRes();

    await AdminAirportCtrl.list({ query: { q: "MNL", page: "3" } } as unknown as Request, res);

    expect(res.statusCode).to.equal(200);
    expect(res.body.pagination).to.deep.equal({ page: 3, limit: 10, total: 23, totalPages: 3 });
    expect((res.body.data as { defaultRadiusKm: number }[])[0].defaultRadiusKm).to.equal(4);
  });

  it("rejects an invalid page or an oversized limit", async () => {
    for (const query of [{ page: "0" }, { limit: "500" }, { page: "abc" }]) {
      const res = mockRes();
      await AdminAirportCtrl.list({ query } as unknown as Request, res);
      expect(res.statusCode).to.equal(400);
    }
  });
});
