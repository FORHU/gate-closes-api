import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import AirportCtrl from "../src/controllers/airport.controller";
import AirportSvc from "../src/services/airport.service";

// Calls the controller's handlers directly with minimal req/res doubles,
// stubbing AirportSvc so no real Mongo/Redis connection is touched. This
// exercises the Joi validation + status-code contract without the overhead
// (and live-DB side effect) of booting the real Express app via supertest.
describe("AirportCtrl", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: T[K]) => {
    const original = obj[key];
    obj[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  const mockRes = () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body: any) => {
      res.body = body;
      return res;
    };
    return res;
  };

  describe("searchByName", () => {
    it("400s when q is missing", async () => {
      const res = mockRes();
      await AirportCtrl.searchByName({ query: {} } as any, res);
      expect(res.statusCode).to.equal(400);
    });

    it("returns the service's results on success", async () => {
      stub(AirportSvc, "searchByName", async (q: string) => [{ airport: q }] as any);
      const res = mockRes();

      await AirportCtrl.searchByName({ query: { q: "heathrow" } } as any, res);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ data: [{ airport: "heathrow" }] });
    });

    it("500s with the error message when the service throws", async () => {
      stub(AirportSvc, "searchByName", async () => {
        throw new Error("db down");
      });
      const res = mockRes();

      await AirportCtrl.searchByName({ query: { q: "x" } } as any, res);

      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({ message: "db down" });
    });
  });

  describe("findNearby", () => {
    it("400s when radius is missing", async () => {
      const res = mockRes();
      await AirportCtrl.findNearby({ query: { lat: "1", lng: "2" } } as any, res);
      expect(res.statusCode).to.equal(400);
    });

    it("passes numeric lat/lng/radius through to the service", async () => {
      let received: any = null;
      stub(AirportSvc, "findNearbyAndStore", async (lat: number, lng: number, radius: number) => {
        received = { lat, lng, radius };
        return [];
      });
      const res = mockRes();

      await AirportCtrl.findNearby(
        { query: { lat: "1.35", lng: "103.99", radius: "50" } } as any,
        res
      );

      expect(received).to.deep.equal({ lat: 1.35, lng: 103.99, radius: 50 });
      expect(res.statusCode).to.equal(200);
    });
  });

  describe("checkInsideAirport", () => {
    it("400s when lat is out of range", async () => {
      const res = mockRes();
      await AirportCtrl.checkInsideAirport({ query: { lat: "999", lng: "0" } } as any, res);
      expect(res.statusCode).to.equal(400);
    });

    it("200s with the service result on success", async () => {
      stub(AirportSvc, "checkInsideAirport", async () => ({ insideRadius: true } as any));
      const res = mockRes();

      await AirportCtrl.checkInsideAirport({ query: { lat: "1", lng: "2" } } as any, res);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ data: { insideRadius: true } });
    });

    it("500s with the error message when the service throws", async () => {
      stub(AirportSvc, "checkInsideAirport", async () => {
        throw new Error("boom");
      });
      const res = mockRes();

      await AirportCtrl.checkInsideAirport({ query: { lat: "1", lng: "2" } } as any, res);

      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({ message: "boom" });
    });
  });

  describe("checkInsideAirportByBoundary", () => {
    it("400s for an out-of-range longitude", async () => {
      const res = mockRes();
      await AirportCtrl.checkInsideAirportByBoundary(
        { query: { lat: "1", lng: "999" } } as any,
        res
      );
      expect(res.statusCode).to.equal(400);
    });

    it("404s when no boundary contains the point", async () => {
      stub(AirportSvc, "checkInsideAirportByBoundary", async () => null);
      const res = mockRes();

      await AirportCtrl.checkInsideAirportByBoundary(
        { query: { lat: "1", lng: "2" } } as any,
        res
      );

      expect(res.statusCode).to.equal(404);
    });

    it("200s with the matched airport", async () => {
      stub(AirportSvc, "checkInsideAirportByBoundary", async () => ({ insideBoundary: true } as any));
      const res = mockRes();

      await AirportCtrl.checkInsideAirportByBoundary(
        { query: { lat: "1", lng: "2" } } as any,
        res
      );

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ data: { insideBoundary: true } });
    });
  });

  describe("checkInsideSpecificAirport", () => {
    it("400s when airportName is missing", async () => {
      const res = mockRes();
      await AirportCtrl.checkInsideSpecificAirport(
        { query: { lat: "1", lng: "2" } } as any,
        res
      );
      expect(res.statusCode).to.equal(400);
    });

    it("forwards airportName/lat/lng to the service", async () => {
      let received: any = null;
      stub(AirportSvc as any, "checkInsideSpecificAirport", async (params: any) => {
        received = params;
        return null;
      });
      const res = mockRes();

      await AirportCtrl.checkInsideSpecificAirport(
        { query: { airportName: "NAIA T1", lat: "14.5995", lng: "120.9842" } } as any,
        res
      );

      expect(received).to.deep.equal({
        airportName: "NAIA T1", lat: 14.5995, lng: 120.9842,
      });
      expect(res.statusCode).to.equal(200);
    });
  });

  describe("syncBoundaries", () => {
    it("400s when force is not a boolean", async () => {
      const res = mockRes();
      await AirportCtrl.syncBoundaries({ body: { force: "not-a-bool" } } as any, res);
      expect(res.statusCode).to.equal(400);
    });

    it("defaults force to false when omitted", async () => {
      let received: any = null;
      stub(AirportSvc, "syncBoundaries", async (params: any) => {
        received = params;
        return { updatedCount: 0, skippedCount: 0, total: 0 };
      });
      const res = mockRes();

      await AirportCtrl.syncBoundaries({ body: {} } as any, res);

      expect(received).to.deep.equal({ force: false });
      expect(res.statusCode).to.equal(200);
    });

    it("passes force: true through when set", async () => {
      let received: any = null;
      stub(AirportSvc, "syncBoundaries", async (params: any) => {
        received = params;
        return { updatedCount: 1, skippedCount: 0, total: 1 };
      });
      const res = mockRes();

      await AirportCtrl.syncBoundaries({ body: { force: true } } as any, res);

      expect(received).to.deep.equal({ force: true });
    });

    it("500s with the error message when the service throws", async () => {
      stub(AirportSvc, "syncBoundaries", async () => {
        throw new Error("sync failed");
      });
      const res = mockRes();

      await AirportCtrl.syncBoundaries({ body: {} } as any, res);

      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({ message: "sync failed" });
    });
  });

  describe("crawl", () => {
    it("200s with the crawl summary on success", async () => {
      const summary = { totalInSource: 1, eligible: 1, skippedOutOfScope: 0, skippedNoBoundary: 0, insertedCount: 1, skippedAlreadyStored: 0 };
      stub(AirportSvc, "crawlFromAssetFile", async () => summary);
      const res = mockRes();

      await AirportCtrl.crawl({} as any, res);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ message: "Airport crawl completed.", data: summary });
    });

    it("500s with the error message when the crawl throws", async () => {
      stub(AirportSvc, "crawlFromAssetFile", async () => {
        throw new Error("file missing");
      });
      const res = mockRes();

      await AirportCtrl.crawl({} as any, res);

      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({ message: "file missing" });
    });
  });

  describe("getAllAsGeoJson", () => {
    it("200s with the geojson payload", async () => {
      const geojson = { type: "FeatureCollection", features: [] };
      stub(AirportSvc, "getAllAsGeoJson", async () => geojson);
      const res = mockRes();

      await AirportCtrl.getAllAsGeoJson({} as any, res);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ data: geojson });
    });

    it("500s with the error message when the service throws", async () => {
      stub(AirportSvc, "getAllAsGeoJson", async () => {
        throw new Error("redis down");
      });
      const res = mockRes();

      await AirportCtrl.getAllAsGeoJson({} as any, res);

      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({ message: "redis down" });
    });
  });
});
