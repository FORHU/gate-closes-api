import { Db, IndexSpecification, CreateIndexesOptions } from "mongodb";
import logger from "./logger";

export interface IndexDefinition {
  collection: string;
  spec: IndexSpecification;
  options?: CreateIndexesOptions;
}

export const TARGET_DATABASE_INDEXES: IndexDefinition[] = [
  // Airport collection
  {
    collection: "airport",
    spec: { location: "2dsphere" },
    options: { name: "geo_location_2dsphere" },
  },
  {
    collection: "airport",
    spec: { iata: 1 },
    options: { unique: true, sparse: true, name: "idx_iata_unique" },
  },

  // Terminal Echo collection
  {
    collection: "terminal.echo",
    spec: { location: "2dsphere" },
    options: { name: "geo_location_2dsphere" },
  },
  {
    collection: "terminal.echo",
    spec: { airportIata: 1, createdAt: -1 },
    options: { name: "idx_airportIata_createdAt" },
  },
  {
    collection: "terminal.echo",
    spec: { senderId: 1, createdAt: -1 },
    options: { name: "idx_senderId_createdAt" },
  },

  // Unified Conversation collection
  {
    collection: "conversations",
    spec: { dmKey: 1 },
    options: { unique: true, sparse: true, name: "idx_dmKey_unique" },
  },
  {
    collection: "conversations",
    spec: { participants: 1, lastEventAt: -1 },
    options: { name: "idx_participants_lastEventAt" },
  },

  // Conversation Messages
  {
    collection: "conversation.messages",
    spec: { conversationId: 1, createdAt: -1 },
    options: { name: "idx_conversationId_createdAt" },
  },

  // Flight Tickets
  // NOTE: the real collection is "flightTicket" (see FlightTicketRepo.collection()
  // and scripts/seed.ts) — this entry previously said "flight.ticket" (dotted),
  // which doesn't exist, so this index was silently never applied to any real
  // data in any environment. Fixed alongside the idempotencyKey index below.
  {
    collection: "flightTicket",
    spec: { userId: 1, status: 1, departureDateTime: 1 },
    options: { name: "idx_userId_status_departure" },
  },
  // Enforces the idempotency guarantee §4.2 of gate-closes-app-v2/docs/BOARDING_PASS_INTELLIGENCE_PLAN.md
  // describes: unique(userId, idempotencyKey). Partial (not sparse) because
  // MFlightTicket always writes an explicit `idempotencyKey: null` when one
  // isn't supplied (the constructor defaults to null, it's never actually
  // omitted from the document) — a sparse index only excludes documents where
  // the field is *missing*, so it would NOT exclude these explicit-null
  // documents and would incorrectly enforce uniqueness across every ticket
  // that never set an idempotencyKey. $type: "string" excludes both missing
  // and null, matching only tickets that actually have a key.
  {
    collection: "flightTicket",
    spec: { userId: 1, idempotencyKey: 1 },
    options: {
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: "string" } },
      name: "idx_userId_idempotencyKey_unique",
    },
  },
];

/**
 * Ensures all target database indexes exist in MongoDB.
 * Idempotent: safe to run on every startup or as an explicit CLI task.
 */
export async function ensureDatabaseIndexes(
  db: Db
): Promise<{ created: string[]; errors: string[] }> {
  const created: string[] = [];
  const errors: string[] = [];

  for (const indexDef of TARGET_DATABASE_INDEXES) {
    const { collection, spec, options } = indexDef;
    try {
      const indexName = await db.collection(collection).createIndex(spec, options || {});
      created.push(`${collection}.${indexName}`);
    } catch (err) {
      const msg = `Failed to create index on ${collection} with spec ${JSON.stringify(spec)}: ${(err as Error).message}`;
      logger.warn(`[DatabaseIndexes] ${msg}`);
      errors.push(msg);
    }
  }

  return { created, errors };
}
