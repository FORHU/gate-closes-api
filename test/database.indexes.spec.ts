import { expect } from "chai";
import { ensureDatabaseIndexes, TARGET_DATABASE_INDEXES } from "../src/utils/database.indexes";
import { Db } from "mongodb";

describe("Database Indexes Configuration (§27)", () => {
  it("should define unique and performance indexes for all core domain collections", () => {
    const collections = TARGET_DATABASE_INDEXES.map((idx) => idx.collection);
    expect(collections).to.include("airport");
    expect(collections).to.include("terminal.echo");
    expect(collections).to.include("conversations");
    expect(collections).to.include("conversation.messages");
    expect(collections).to.include("flight.ticket");

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
  });
});
