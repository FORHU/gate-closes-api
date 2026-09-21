import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import AirportRepo from "../src/repositories/airport.repository";

// Stubs AirportRepo.collection() the same way the existing bt/dt/ps
// read-state specs stub their repositories' collection() — no real Mongo
// connection is ever made.
describe("AirportRepo", () => {
  const originalCollection = AirportRepo.collection;
  afterEach(() => {
    AirportRepo.collection = originalCollection;
  });

  const toArrayResult = (data: unknown[]) => {
    const chain: any = {
      toArray: async () => data,
      limit: () => chain,
    };
    return chain;
  };

  const useFakeCollection = (fake: Record<string, any>) => {
    (AirportRepo as any).collection = () => fake;
  };

  describe("searchByName", () => {
    it("escapes regex metacharacters in the query and searches case-insensitively", async () => {
      let capturedFilter: any = null;
      let capturedOptions: any = null;
      useFakeCollection({
        find: (filter: any, options: any) => {
          capturedFilter = filter;
          capturedOptions = options;
          return toArrayResult([]);
        },
      });

      await AirportRepo.searchByName(" a.b+c ", 5);

      expect(capturedFilter.airport.source).to.equal("a\\.b\\+c");
      expect(capturedFilter.airport.flags).to.equal("i");
      expect(capturedOptions.projection).to.deep.equal({
        _id: 0, airport: 1, iata: 1, icao: 1, countryCode: 1, location: 1,
      });
    });

    it("caps results at the given limit", async () => {
      let limitArg: any = null;
      useFakeCollection({
        find: () => {
          const chain: any = {
            toArray: async () => [],
            limit: (n: number) => {
              limitArg = n;
              return chain;
            },
          };
          return chain;
        },
      });

      await AirportRepo.searchByName("jfk", 5);
      expect(limitArg).to.equal(5);
    });
  });

  describe("upsertByIataOrIcao", () => {
    it("filters by iata when present, strips _id, and upserts", async () => {
      let capturedFilter: any = null;
      let capturedUpdate: any = null;
      let capturedOptions: any = null;
      useFakeCollection({
        updateOne: async (filter: any, update: any, options: any) => {
          capturedFilter = filter;
          capturedUpdate = update;
          capturedOptions = options;
          return { acknowledged: true };
        },
      });

      await AirportRepo.upsertByIataOrIcao({ iata: "JFK", icao: "KJFK", airport: "JFK Intl" });

      expect(capturedFilter).to.deep.equal({ iata: "JFK" });
      expect(capturedUpdate.$set).to.not.have.property("_id");
      expect(capturedUpdate.$set.airport).to.equal("JFK Intl");
      expect(capturedUpdate.$set.updatedAt).to.be.instanceOf(Date);
      expect(capturedOptions).to.deep.equal({ upsert: true });
    });

    it("falls back to icao when iata is absent", async () => {
      let capturedFilter: any = null;
      useFakeCollection({
        updateOne: async (filter: any) => {
          capturedFilter = filter;
          return { acknowledged: true };
        },
      });

      await AirportRepo.upsertByIataOrIcao({ icao: "KJFK" });

      expect(capturedFilter).to.deep.equal({ icao: "KJFK" });
    });

    it("falls back to a plain insert when neither iata nor icao is present", async () => {
      let insertedDoc: any = null;
      useFakeCollection({
        insertOne: async (doc: any) => {
          insertedDoc = doc;
          return { acknowledged: true, insertedId: doc._id };
        },
        updateOne: async () => {
          throw new Error("should not be called");
        },
      });

      await AirportRepo.upsertByIataOrIcao({ airport: "Unnamed Strip" });

      expect(insertedDoc.airport).to.equal("Unnamed Strip");
      expect(insertedDoc._id).to.be.instanceOf(ObjectId);
    });
  });

  describe("findById", () => {
    it("rejects for a malformed id without touching the collection", async () => {
      let collectionCalled = false;
      useFakeCollection({
        findOne: async () => {
          collectionCalled = true;
          return null;
        },
      });

      let error: unknown;
      try {
        await AirportRepo.findById("not-an-object-id");
      } catch (e) {
        error = e;
      }
      expect(error).to.equal("Invalid airport id.");
      expect(collectionCalled).to.equal(false);
    });

    it("looks up by a converted ObjectId for a valid id string", async () => {
      const id = new ObjectId();
      let capturedFilter: any = null;
      useFakeCollection({
        findOne: async (filter: any) => {
          capturedFilter = filter;
          return null;
        },
      });

      await AirportRepo.findById(id.toHexString());

      expect(capturedFilter._id).to.be.instanceOf(ObjectId);
      expect(capturedFilter._id.toHexString()).to.equal(id.toHexString());
    });
  });

  describe("findByIata / findByIcao", () => {
    it("uppercases the code before querying", async () => {
      let capturedIata: any = null;
      let capturedIcao: any = null;
      useFakeCollection({
        findOne: async (filter: any) => {
          if (filter.iata) capturedIata = filter.iata;
          if (filter.icao) capturedIcao = filter.icao;
          return null;
        },
      });

      await AirportRepo.findByIata("sin");
      await AirportRepo.findByIcao("wsss");

      expect(capturedIata).to.equal("SIN");
      expect(capturedIcao).to.equal("WSSS");
    });
  });

  describe("findByIataOrIcao", () => {
    it("tries iata first and short-circuits without an icao lookup on a hit", async () => {
      const match = { iata: "SIN" };
      let icaoCalled = false;
      useFakeCollection({
        findOne: async (filter: any) => {
          if (filter.iata) return match;
          icaoCalled = true;
          return null;
        },
      });

      const result = await AirportRepo.findByIataOrIcao("sin");

      expect(result).to.equal(match);
      expect(icaoCalled).to.equal(false);
    });

    it("falls back to icao when the iata lookup misses", async () => {
      const match = { icao: "WSSS" };
      useFakeCollection({
        findOne: async (filter: any) => (filter.iata ? null : match),
      });

      const result = await AirportRepo.findByIataOrIcao("wsss");

      expect(result).to.equal(match);
    });
  });

  describe("update", () => {
    it("rejects for a malformed id", async () => {
      let error: unknown;
      try {
        await AirportRepo.update({ _id: "bad-id" });
      } catch (e) {
        error = e;
      }
      expect(error).to.equal("Invalid airport id.");
    });

    it("only sets fields that were explicitly provided, distinguishing null from undefined for iata/icao", async () => {
      const id = new ObjectId();
      let capturedSet: any = null;
      useFakeCollection({
        updateOne: async (_filter: any, update: any) => {
          capturedSet = update.$set;
          return { acknowledged: true };
        },
      });

      await AirportRepo.update({
        _id: id.toHexString(),
        iata: null,
        airport: "Renamed Airport",
        // icao intentionally omitted entirely
      });

      expect(capturedSet.iata).to.equal(null);
      expect(capturedSet.airport).to.equal("Renamed Airport");
      expect(capturedSet).to.not.have.property("icao");
      expect(capturedSet.updatedAt).to.be.instanceOf(Date);
    });

    it("uppercases a provided iata/icao", async () => {
      const id = new ObjectId();
      let capturedSet: any = null;
      useFakeCollection({
        updateOne: async (_filter: any, update: any) => {
          capturedSet = update.$set;
          return { acknowledged: true };
        },
      });

      await AirportRepo.update({ _id: id.toHexString(), iata: "sin", icao: "wsss" });

      expect(capturedSet.iata).to.equal("SIN");
      expect(capturedSet.icao).to.equal("WSSS");
    });
  });

  describe("findNearestWithDistance", () => {
    it("builds a $geoNear pipeline with coordinates in [lng, lat] order", async () => {
      let capturedPipeline: any[] = [];
      useFakeCollection({
        aggregate: (pipeline: any[]) => {
          capturedPipeline = pipeline;
          return toArrayResult([{ iata: "SIN", insideRadius: true }]);
        },
      });

      const result = await AirportRepo.findNearestWithDistance({ lat: 1.35, lng: 103.99 });

      const geoNear = capturedPipeline[0].$geoNear;
      expect(geoNear.near.coordinates).to.deep.equal([103.99, 1.35]);
      expect(geoNear.key).to.equal("location");
      expect(result).to.deep.equal({ iata: "SIN", insideRadius: true });
    });

    it("returns null when nothing matches", async () => {
      useFakeCollection({ aggregate: () => toArrayResult([]) });
      const result = await AirportRepo.findNearestWithDistance({ lat: 0, lng: 0 });
      expect(result).to.equal(null);
    });
  });

  describe("findNearestForAirport", () => {
    it("adds an exact airport-name filter to the $geoNear query", async () => {
      let capturedPipeline: any[] = [];
      useFakeCollection({
        aggregate: (pipeline: any[]) => {
          capturedPipeline = pipeline;
          return toArrayResult([]);
        },
      });

      await AirportRepo.findNearestForAirport({
        lat: 14.5995, lng: 120.9842, airportName: "NAIA Terminal 1",
      });

      const geoNear = capturedPipeline[0].$geoNear;
      expect(geoNear.query.airport).to.equal("NAIA Terminal 1");
      expect(geoNear.near.coordinates).to.deep.equal([120.9842, 14.5995]);
    });
  });

  describe("findForBoundarySync", () => {
    it("only selects rows that have a location and a positive radius", async () => {
      let capturedFilter: any = null;
      useFakeCollection({
        find: (filter: any) => {
          capturedFilter = filter;
          return toArrayResult([]);
        },
      });

      await AirportRepo.findForBoundarySync();

      expect(capturedFilter).to.deep.equal({
        location: { $exists: true },
        radiusKm: { $gt: 0 },
      });
    });
  });

  describe("updateBoundaryById", () => {
    it("sets the boundary and bumps updatedAt", async () => {
      const id = new ObjectId();
      const boundary = { type: "Polygon" as const, coordinates: [[[0, 0]]] };
      let capturedFilter: any = null;
      let capturedUpdate: any = null;
      useFakeCollection({
        updateOne: async (filter: any, update: any) => {
          capturedFilter = filter;
          capturedUpdate = update;
          return { acknowledged: true };
        },
      });

      await AirportRepo.updateBoundaryById(id, boundary);

      expect(capturedFilter).to.deep.equal({ _id: id });
      expect(capturedUpdate.$set.boundary).to.equal(boundary);
      expect(capturedUpdate.$set.updatedAt).to.be.instanceOf(Date);
    });
  });

  describe("findAllWithBoundary", () => {
    it("filters to rows that have a boundary", async () => {
      let capturedFilter: any = null;
      useFakeCollection({
        find: (filter: any) => {
          capturedFilter = filter;
          return toArrayResult([]);
        },
      });

      await AirportRepo.findAllWithBoundary();

      expect(capturedFilter).to.deep.equal({ boundary: { $exists: true } });
    });
  });

  describe("bulkInsertMissing", () => {
    it("short-circuits on an empty array without touching the collection", async () => {
      let bulkWriteCalled = false;
      useFakeCollection({
        bulkWrite: async () => {
          bulkWriteCalled = true;
          return { upsertedCount: 0, matchedCount: 0 };
        },
      });

      const result = await AirportRepo.bulkInsertMissing([]);

      expect(result).to.deep.equal({ upsertedCount: 0, matchedCount: 0 });
      expect(bulkWriteCalled).to.equal(false);
    });

    it("keys each upsert filter by iata, falling back to icao, and never overwrites an existing row", async () => {
      let capturedOps: any[] = [];
      useFakeCollection({
        bulkWrite: async (ops: any[]) => {
          capturedOps = ops;
          return { upsertedCount: 1, matchedCount: 1 };
        },
      });

      const result = await AirportRepo.bulkInsertMissing([
        { iata: "SIN", airport: "Changi" } as any,
        { icao: "KJFK", airport: "JFK" } as any,
      ]);

      expect(capturedOps).to.have.length(2);
      expect(capturedOps[0].updateOne.filter).to.deep.equal({ iata: "SIN" });
      expect(capturedOps[0].updateOne.upsert).to.equal(true);
      expect(capturedOps[0].updateOne.update.$setOnInsert.airport).to.equal("Changi");
      expect(capturedOps[1].updateOne.filter).to.deep.equal({ icao: "KJFK" });
      expect(result).to.deep.equal({ upsertedCount: 1, matchedCount: 1 });
    });
  });

  describe("findInsideBoundary", () => {
    it("queries with a $geoIntersects point in [lng, lat] order", async () => {
      let capturedFilter: any = null;
      useFakeCollection({
        findOne: async (filter: any) => {
          capturedFilter = filter;
          return null;
        },
      });

      await AirportRepo.findInsideBoundary({ lat: 14.5995, lng: 120.9842 });

      expect(capturedFilter.boundary.$geoIntersects.$geometry).to.deep.equal({
        type: "Point",
        coordinates: [120.9842, 14.5995],
      });
    });
  });
});
