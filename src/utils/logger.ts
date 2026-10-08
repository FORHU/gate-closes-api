import * as dns from "dns";
import winston from "winston";
import "winston-mongodb";
import { MONGO_DB, MONGO_URI } from "../config";

const isTest = process.env.NODE_ENV === "test";

const transports: winston.transport[] = [
  new winston.transports.Console({
    silent: isTest,
  }),
  new winston.transports.File({ filename: "error.log", level: "error" }),
  new winston.transports.File({ filename: "combined.log" }),
];

// Only attach MongoDB transport outside of test environments when configured
const transportsRecord = winston.transports as unknown as Record<
  string,
  new (opts: Record<string, unknown>) => winston.transport
>;
if (!isTest && MONGO_URI && transportsRecord.MongoDB) {
  try {
    // The transport connects at import time, before connectToMongo() runs,
    // so it needs the same SRV-lookup workaround (see utils/mongo.ts).
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    const MongoTransport = transportsRecord.MongoDB;
    transports.push(
      new MongoTransport({
        db: MONGO_URI,
        dbName: MONGO_DB,
        options: { useUnifiedTopology: true },
        collection: "logs",
        capped: true,
        cappedMax: 10000,
        cappedSize: 10000000,
        level: "info",
      })
    );
  } catch (err) {
    console.warn("[Logger] Could not initialize MongoDB transport:", (err as Error).message || err);
  }
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports,
});

export default logger;
