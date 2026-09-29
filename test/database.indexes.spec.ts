import { expect } from "chai";
import { describe, it } from "mocha";
import { ensureDatabaseIndexes, TARGET_DATABASE_INDEXES } from "../src/utils/database.indexes";
import { Db } from "mongodb";

describe("Database Indexes Configuration (§27)", () => {
  it("should define unique and performance indexes for all core domain collections", () => {
    const collections = TARGET_DATABASE_INDEXES.map((idx) => idx.collection);
    expect(collections).to.include("airport");
    expect(collections).to.include("terminal.echo");
    expect(collections).to.include("conversations");
    expect(collections).to.include("conversation.messages");
    // "flightTicket" (camelCase, no dot) — matches FlightTicketRepo.collection()
    // and scripts/seed.ts. A prior version of this index list said
    // "flight.ticket" (dotted), which is not the real collection name, so
    // that index was silently never created against any real data.
    expect(collections).to.include("flightTicket");
    expect(collections).to.not.include("flight.ticket");

    // Verify unique dmKey index on unified conversations
    const convoDmIndex = TARGET_DATABASE_INDEXES.find(
      (idx) => idx.collection === "conversations" && (idx.spec as any).dmKey === 1
    );
    expect(convoDmIndex).to.exist;
    expect(convoDmIndex?.options?.unique).to.be.true;

    // Verify airport iata unique index
    const airportIataIndex = TARGET_DATABASE_INDEXES.find(
      (idx) => idx.collection === "airport" && (idx.spec as any).iata === 1
    );
    expect(airportIataIndex).to.exist;
    expect(airportIataIndex?.options?.unique).to.be.true;

    // Verify 2dsphere indexes for geospatial queries
    const airportGeo = TARGET_DATABASE_INDEXES.find(
      (idx) => idx.collection === "airport" && (idx.spec as any).location === "2dsphere"
    );
    expect(airportGeo).to.exist;

    const echoGeo = TARGET_DATABASE_INDEXES.find(
      (idx) => idx.collection === "terminal.echo" && (idx.spec as any).location === "2dsphere"
    );
    expect(echoGeo).to.exist;

    // Verify the unique partial idempotencyKey index (STEP 16a / B-3): this
    // is what actually enforces unique(userId, idempotencyKey) — the
    // pre-insert lookup in FlightTicketSvc.create is a check, not a lock,
    // and can't close a race between two concurrent identical requests on
    // its own.
    const idempotencyIndex = TARGET_DATABASE_INDEXES.find(
      (idx) =>
        idx.collection === "flightTicket" &&
        (idx.spec as any).userId === 1 &&
        (idx.spec as any).idempotencyKey === 1
    );
    expect(idempotencyIndex).to.exist;
    expect(idempotencyIndex?.options?.unique).to.be.true;
    // Must be a partial filter, not `sparse: true` — MFlightTicket always
    // writes an explicit `idempotencyKey: null` when none is supplied, and
    // a sparse index only excludes documents missing the field entirely, so
    // it would NOT exclude these and would wrongly enforce uniqueness across
    // every ticket that never set a key.
    expect((idempotencyIndex?.options as any)?.partialFilterExpression).to.deep.equal({
      idempotencyKey: { $type: "string" },
    });
    expect(idempotencyIndex?.options?.sparse).to.not.be.true;
  });

  it("should execute createIndex on the MongoDB Db instance idempotently", async () => {
    const createdIndices: Record<string, any[]> = {};

    const mockDb = {
      collection: (colName: string) => ({
        createIndex: async (spec: any, opts: any) => {
          if (!createdIndices[colName]) createdIndices[colName] = [];
          createdIndices[colName].push({ spec, opts });
          return opts.name || "mock_index";
        },
      }),
    } as unknown as Db;

    const result = await ensureDatabaseIndexes(mockDb);

    expect(result.errors).to.be.empty;
    expect(result.created.length).to.equal(TARGET_DATABASE_INDEXES.length);
    expect(createdIndices["conversations"]).to.have.lengthOf(2);
    expect(createdIndices["airport"]).to.have.lengthOf(2);
    expect(createdIndices["terminal.echo"]).to.have.lengthOf(3);
    expect(createdIndices["flightTicket"]).to.have.lengthOf(2);
    expect(createdIndices["flight.ticket"]).to.be.undefined;
  });
});
