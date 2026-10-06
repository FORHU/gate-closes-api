import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import AirportSvc from "../src/services/airport.service";
import AirportRepo from "../src/repositories/airport.repository";
import RedisUtil from "../src/utils/redis.util";

// Plain `require()` (not `import * as X`) so we get the actual shared
// CommonJS module object — the same singleton airport.service.ts's own
// `require("fs")` / `require("airport-data-js")` resolves to. An `import *
// as X` binding here would go through TypeScript's __importStar helper,
// which wraps the module in a fresh, getter-only (unwritable) object.
const fsModule = require("fs") as typeof import("fs");
const airportDataJsModule = require("airport-data-js") as {
  getAirportByIata: (code: string) => Promise<unknown>;
  getAirportByIcao: (code: string) => Promise<unknown>;
  findNearbyAirports: (lat: number, lng: number, radiusKm: number) => Promise<unknown>;
};

// Every test in this file stubs the module-level dependency it needs and
// restores it in `afterEach` — same monkeypatch-and-restore convention the
// existing bt/dt/ps read-state specs use, so no real Mongo/Redis/network
// connection is ever touched.
describe("AirportSvc", () => {
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

  describe("inferRadiusKm (private, via mapRawAirport)", () => {
    const inferRadiusKm = (type?: string, runwayLength?: number) =>
      (AirportSvc as any).inferRadiusKm(type, runwayLength);

    it("returns 4 for large_airport regardless of runway length", () => {
      expect(inferRadiusKm("large_airport", 0)).to.equal(4);
    });

    it("returns 2.5 for medium_airport", () => {
      expect(inferRadiusKm("medium_airport")).to.equal(2.5);
    });

    it("returns 1.5 for small_airport", () => {
      expect(inferRadiusKm("small_airport")).to.equal(1.5);
    });

    it("falls back to runway length when type is unrecognized", () => {
      expect(inferRadiusKm("heliport", 10500)).to.equal(4);
      expect(inferRadiusKm("heliport", 6000)).to.equal(2.5);
      expect(inferRadiusKm("heliport", 500)).to.equal(1.5);
    });

    it("returns undefined when neither a known type nor a usable runway length is given", () => {
      expect(inferRadiusKm(undefined, undefined)).to.equal(undefined);
      expect(inferRadiusKm("seaplane_base", 0)).to.equal(undefined);
    });
  });

  describe("mapRawAirport (private, via getByIataWithCache's fetch-and-store path)", () => {
    it("uppercases codes, builds a location point, and infers a boundary from type", async () => {
      stub(AirportRepo, "findByIata", async () => null);
      let stored: any = null;
      stub(AirportRepo, "upsertByIataOrIcao", async (airport: any) => {
        stored = airport;
        return { acknowledged: true };
      });
      stub(airportDataJsModule, "getAirportByIata", async () => ({
        iata: "sin",
        icao: "wsss",
        type: "large_airport",
        latitude: "1.3644",
        longitude: "103.9915",
        elevation: "22",
        runway_length: "13123",
        country_code: "SG",
        scheduled_service: true,
      }));

      const result = await AirportSvc.getByIataWithCache("sin");

      expect(result?.iata).to.equal("SIN");
      expect(result?.icao).to.equal("WSSS");
      expect(result?.location).to.deep.equal({ type: "Point", coordinates: [103.9915, 1.3644] });
      expect(result?.radiusKm).to.equal(4);
      expect(result?.boundary?.type).to.equal("Polygon");
      expect(result?.elevation).to.equal(22);
      expect(result?.scheduledService).to.equal(true);
      expect(stored?.iata).to.equal("SIN");
    });

    it("treats blank numeric strings as null rather than NaN", async () => {
      stub(AirportRepo, "findByIcao", async () => null);
      stub(AirportRepo, "upsertByIataOrIcao", async () => ({ acknowledged: true }));
      stub(airportDataJsModule, "getAirportByIcao", async () => ({
        icao: "test",
        elevation: "",
        runway_length: "not-a-number",
      }));

      const result = await AirportSvc.getByIcaoWithCache("test");

      expect(result?.elevation).to.equal(null);
      expect(result?.runwayLength).to.equal(null);
      expect(result?.location).to.equal(undefined);
    });

    it("returns null without storing anything when the external lookup finds nothing", async () => {
      stub(AirportRepo, "findByIata", async () => null);
      let upsertCalled = false;
      stub(AirportRepo, "upsertByIataOrIcao", async () => {
        upsertCalled = true;
        return { acknowledged: true };
      });
      stub(airportDataJsModule, "getAirportByIata", async () => null);

      const result = await AirportSvc.getByIataWithCache("zzz");

      expect(result).to.equal(null);
      expect(upsertCalled).to.equal(false);
    });
  });

  describe("getByIataWithCache / getByIcaoWithCache", () => {
    it("returns the DB record directly and skips the external API when already cached", async () => {
      const dbRecord = { _id: new ObjectId(), iata: "JFK" };
      let externalCalled = false;
      stub(AirportRepo, "findByIata", async () => dbRecord as any);
      stub(airportDataJsModule, "getAirportByIata", async () => {
        externalCalled = true;
        return null;
      });

      const result = await AirportSvc.getByIataWithCache("jfk");

      expect(result).to.equal(dbRecord);
      expect(externalCalled).to.equal(false);
    });
  });

  describe("findNearbyAndStore", () => {
    it("maps and persists only airline airports from the external lookup", async () => {
      stub(airportDataJsModule, "findNearbyAirports", async () => [
        { iata: "lhr", latitude: "51.47", longitude: "-0.4543", type: "large_airport" },
        // Out of scope like in the crawl: small airport, heliport, no IATA code.
        { iata: "lcy", latitude: "51.5053", longitude: "0.0553", type: "small_airport" },
        {
          iata: "jre",
          airport: "East 60th Street Heliport",
          latitude: "40.7542",
          longitude: "-73.9708",
          type: "medium_airport",
        },
        { icao: "egll", latitude: "51.4", longitude: "-0.4", type: "medium_airport" },
      ]);
      const stored: any[] = [];
      stub(AirportRepo, "upsertByIataOrIcao", async (airport: any) => {
        stored.push(airport);
        return { acknowledged: true };
      });

      const result = await AirportSvc.findNearbyAndStore(51.5, -0.1, 50);

      expect(result).to.have.length(1);
      expect(stored).to.have.length(1);
      expect(result[0].iata).to.equal("LHR");
      expect(result[0].radiusKm).to.equal(4);
    });
  });

  describe("checkInsideAirport / checkInsideSpecificAirport delegation", () => {
    it("passes lat/lng straight through to the nearest-with-distance query", async () => {
      let receivedParams: any = null;
      stub(AirportRepo, "findNearestWithDistance", async (params: any) => {
        receivedParams = params;
        return { insideRadius: true };
      });

      const result = await AirportSvc.checkInsideAirport({ lat: 1.1, lng: 2.2 });

      expect(receivedParams).to.deep.equal({ lat: 1.1, lng: 2.2 });
      expect(result).to.deep.equal({ insideRadius: true });
    });

    it("passes airportName through for the specific-airport check", async () => {
      let receivedParams: any = null;
      stub(AirportRepo, "findNearestForAirport", async (params: any) => {
        receivedParams = params;
        return null;
      });

      await AirportSvc.checkInsideSpecificAirport({
        lat: 1.1,
        lng: 2.2,
        airportName: "NAIA Terminal 1",
      });

      expect(receivedParams).to.deep.equal({ lat: 1.1, lng: 2.2, airportName: "NAIA Terminal 1" });
    });
  });

  describe("checkInsideAirportByBoundary", () => {
    it("returns null when no boundary contains the point", async () => {
      stub(AirportRepo, "findInsideBoundary", async () => null);
      const result = await AirportSvc.checkInsideAirportByBoundary({ lat: 0, lng: 0 });
      expect(result).to.equal(null);
    });

    it("shapes the matched airport with insideBoundary: true", async () => {
      const airportId = new ObjectId();
      stub(AirportRepo, "findInsideBoundary", async () => ({
        _id: airportId,
        iata: "NAIA",
        icao: null,
        airport: "Ninoy Aquino International Airport",
      }));

      const result = await AirportSvc.checkInsideAirportByBoundary({ lat: 14.5995, lng: 120.9842 });

      expect(result).to.deep.equal({
        _id: airportId,
        iata: "NAIA",
        airport: "Ninoy Aquino International Airport",
        icao: null,
        insideBoundary: true,
      });
    });
  });

  describe("searchByName", () => {
    it("forwards the query and the fixed result limit to the repository", async () => {
      let received: any = null;
      stub(AirportRepo, "searchByName", async (q: string, limit: number) => {
        received = { q, limit };
        return [];
      });

      await AirportSvc.searchByName("heathrow");

      expect(received).to.deep.equal({ q: "heathrow", limit: 5 });
    });
  });

  describe("crawlFromAssetFile", () => {
    const fixtureRecords = [
      // eligible, has location + radiusKm -> gets a boundary
      {
        iata: "aaa",
        icao: "kaaa",
        type: "large_airport",
        scheduledService: "TRUE",
        location: { type: "Point", coordinates: [1, 2] },
        radiusKm: 15,
      },
      {
        iata: "bbb",
        icao: "kbbb",
        type: "medium_airport",
        scheduledService: "TRUE",
        location: { type: "Point", coordinates: [3, 4] },
        radiusKm: 8,
      },
      // eligible but no location -> no boundary
      { iata: "ccc", type: "large_airport", scheduledService: "TRUE", radiusKm: 15 },
      // eligible; the source's radiusKm (0) is ignored: sized by type instead
      {
        iata: "ddd",
        type: "medium_airport",
        scheduledService: "TRUE",
        location: { type: "Point", coordinates: [5, 6] },
        radiusKm: 0,
      },
      // out of scope: not a scheduled-service airport
      {
        iata: "eee",
        type: "large_airport",
        scheduledService: "FALSE",
        location: { type: "Point", coordinates: [7, 8] },
        radiusKm: 15,
      },
      // out of scope: small airport
      {
        iata: "fff",
        type: "small_airport",
        scheduledService: "TRUE",
        location: { type: "Point", coordinates: [9, 10] },
        radiusKm: 4,
      },
      // out of scope: no type at all
      { iata: "ggg", scheduledService: "TRUE", location: { type: "Point", coordinates: [11, 12] } },
      // out of scope: a heliport, whatever its type says
      {
        iata: "hhh",
        airport: "East 34th Street Heliport",
        type: "medium_airport",
        scheduledService: "TRUE",
        location: { type: "Point", coordinates: [13, 14] },
      },
      // out of scope: no airline (IATA) code
      {
        icao: "kiii",
        type: "medium_airport",
        scheduledService: "TRUE",
        location: { type: "Point", coordinates: [15, 16] },
      },
    ];

    it("scopes to scheduled large/medium airline airports, sizes them by type, and never overwrites existing rows", async () => {
      stub(fsModule, "readFileSync", (() => JSON.stringify(fixtureRecords)) as any);
      const batches: any[][] = [];
      stub(AirportRepo, "bulkInsertMissing", async (airports: any[]) => {
        batches.push(airports);
        return { upsertedCount: airports.length, matchedCount: 0 };
      });

      const result = await AirportSvc.crawlFromAssetFile();

      expect(result).to.deep.equal({
        totalInSource: 9,
        eligible: 4,
        skippedOutOfScope: 5,
        skippedNoBoundary: 1,
        insertedCount: 3,
        skippedAlreadyStored: 0,
      });
      expect(batches).to.have.length(1);
      expect(batches[0]).to.have.length(3);
      expect(batches[0].map((a: any) => [a.iata, a.radiusKm])).to.deep.equal([
        ["AAA", 4],
        ["BBB", 2.5],
        ["DDD", 2.5],
      ]);
      for (const airport of batches[0]) {
        expect(airport.boundary?.type).to.equal("Polygon");
        expect(airport.scheduledService).to.equal(true);
      }
    });

    it("reports already-stored rows as skipped rather than as inserted", async () => {
      stub(fsModule, "readFileSync", (() => JSON.stringify(fixtureRecords)) as any);
      stub(AirportRepo, "bulkInsertMissing", async (airports: any[]) => ({
        upsertedCount: 0,
        matchedCount: airports.length,
      }));

      const result = await AirportSvc.crawlFromAssetFile();

      expect(result.insertedCount).to.equal(0);
      expect(result.skippedAlreadyStored).to.equal(3);
    });
  });

  describe("syncBoundaries", () => {
    it("skips airports that already have a boundary unless force is set", async () => {
      const withBoundary = {
        _id: new ObjectId(),
        location: { type: "Point", coordinates: [1, 2] },
        radiusKm: 8,
        boundary: { type: "Polygon", coordinates: [[[0, 0]]] },
      };
      stub(AirportRepo, "findForBoundarySync", async () => [withBoundary] as any);
      let updateCalled = false;
      stub(AirportRepo, "updateBoundaryById", async () => {
        updateCalled = true;
        return { acknowledged: true };
      });

      const result = await AirportSvc.syncBoundaries();

      expect(updateCalled).to.equal(false);
      expect(result).to.deep.equal({ updatedCount: 0, skippedCount: 1, total: 1 });
    });

    it("rebuilds the boundary for every eligible row when force is true", async () => {
      const withBoundary = {
        _id: new ObjectId(),
        location: { type: "Point", coordinates: [1, 2] },
        radiusKm: 8,
        boundary: { type: "Polygon", coordinates: [[[0, 0]]] },
      };
      stub(AirportRepo, "findForBoundarySync", async () => [withBoundary] as any);
      let updatedBoundary: any = null;
      stub(AirportRepo, "updateBoundaryById", async (_id: any, boundary: any) => {
        updatedBoundary = boundary;
        return { acknowledged: true };
      });

      const result = await AirportSvc.syncBoundaries({ force: true });

      expect(result).to.deep.equal({ updatedCount: 1, skippedCount: 0, total: 1 });
      expect(updatedBoundary.type).to.equal("Polygon");
    });

    it("skips rows with a missing location or a non-positive radius, with or without force", async () => {
      const missingLocation = { _id: new ObjectId(), radiusKm: 8 };
      const zeroRadius = {
        _id: new ObjectId(),
        location: { type: "Point", coordinates: [1, 2] },
        radiusKm: 0,
      };
      stub(AirportRepo, "findForBoundarySync", async () => [missingLocation, zeroRadius] as any);
      stub(AirportRepo, "updateBoundaryById", async () => ({ acknowledged: true }));

      const result = await AirportSvc.syncBoundaries({ force: true });

      expect(result).to.deep.equal({ updatedCount: 0, skippedCount: 2, total: 2 });
    });
  });

  describe("getAllAsGeoJson", () => {
    it("returns the cached value without querying the repository when present", async () => {
      const cached = { type: "FeatureCollection", features: [] };
      stub(RedisUtil, "getJson", async () => cached);
      let repoCalled = false;
      stub(AirportRepo, "findAllWithBoundary", async () => {
        repoCalled = true;
        return [];
      });

      const result = await AirportSvc.getAllAsGeoJson();

      expect(result).to.equal(cached);
      expect(repoCalled).to.equal(false);
    });

    it("builds, caches, and returns a FeatureCollection from boundaried airports on a cache miss", async () => {
      stub(RedisUtil, "getJson", async () => null);
      let cachedPayload: any = null;
      stub(RedisUtil, "setJson", async (_key: string, value: unknown) => {
        cachedPayload = value;
        return "OK";
      });
      const airportId = new ObjectId();
      stub(
        AirportRepo,
        "findAllWithBoundary",
        async () =>
          [
            {
              _id: airportId,
              airport: "Changi Airport",
              countryCode: "SG",
              boundary: { type: "Polygon", coordinates: [[[0, 0]]] },
            },
            // Missing a proper boundary -> must be filtered out of the output.
            { _id: new ObjectId(), airport: "No Boundary Airport", countryCode: "US" },
          ] as any
      );

      const result: any = await AirportSvc.getAllAsGeoJson();

      expect(result.type).to.equal("FeatureCollection");
      expect(result.features).to.have.length(1);
      expect(result.features[0]).to.deep.equal({
        type: "Feature",
        id: airportId.toString(),
        geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
        properties: { airport: "Changi Airport", country_code: "SG" },
      });
      expect(cachedPayload).to.deep.equal(result);
    });
  });
});
