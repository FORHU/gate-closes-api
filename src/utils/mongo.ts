import * as dns from "dns";
import { MongoClient, Db, TransactionOptions } from "mongodb";
import { MONGO_URI, MONGO_DB } from "../config";

let db: Db;
let mongoClient: MongoClient;

export const connectToMongo = async () => {
  // Node's c-ares resolver can fail SRV lookups (mongodb+srv://) when the
  // system's configured nameserver is an IPv6 link-local address, even
  // though the OS's own resolver handles it fine. Point Node at public
  // resolvers so the SRV lookup Atlas relies on always succeeds.
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  const client = new MongoClient(MONGO_URI, { maxPoolSize: 10, maxIdleTimeMS: 60000, connectTimeoutMS: 60000 });

  await client.connect();
  db = client.db(MONGO_DB);
  mongoClient = client;
};

export const getDB = () => {
  if (!db) {
    throw new Error("Database not connected!");
  }
  return db;
};

export const useMongoClient = () => {
  return mongoClient;
};

export const useTransactionOptions: TransactionOptions = {
  readPreference: "primary",
  readConcern: { level: "local" },
  writeConcern: { w: "majority" },
};
