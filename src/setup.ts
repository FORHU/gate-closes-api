import RedisUtil from "./utils/redis.util";
import { getDB } from "./utils/mongo";

export default async () => {
  await RedisUtil.initialize();

  // Ensure geospatial indexes exist for $geoNear / $geoWithin queries.
  // These are idempotent — safe to run on every startup.
  const db = getDB();
  await Promise.all([
    db.collection("airport").createIndex({ location: "2dsphere" }),
    db.collection("terminal.echo").createIndex({ location: "2dsphere" }),
  ]);
};
