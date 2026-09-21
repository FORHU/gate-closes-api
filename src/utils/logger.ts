import winston from "winston";
import "winston-mongodb";
import { MONGO_DB, MONGO_URI, isDev } from "../config";

const isTest = process.env.NODE_ENV === "test";

const transports: winston.transport[] = [
  new winston.transports.Console({
    silent: isTest,
  }),
  new winston.transports.File({ filename: "error.log", level: "error" }),
  new winston.transports.File({ filename: "combined.log" }),
];

// Only attach MongoDB transport outside of test environments when configured
if (!isTest && MONGO_URI && (winston.transports as any).MongoDB) {
  try {
    const MongoTransport = (winston.transports as any).MongoDB;
    transports.push(
      new MongoTransport({
        db: `${MONGO_URI}/${MONGO_DB}`,
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
