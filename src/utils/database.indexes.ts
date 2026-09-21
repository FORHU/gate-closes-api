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
  {
    collection: "flight.ticket",
    spec: { userId: 1, status: 1, departureDateTime: 1 },
    options: { name: "idx_userId_status_departure" },
  },
];

/**
 * Ensures all target database indexes exist in MongoDB.
 * Idempotent: safe to run on every startup or as an explicit CLI task.
 */
export async function ensureDatabaseIndexes(db: Db): Promise<{ created: string[]; errors: string[] }> {
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
