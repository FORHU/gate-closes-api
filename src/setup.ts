import RedisUtil from "./utils/redis.util";
import { getDB } from "./utils/mongo";
import { ensureDatabaseIndexes } from "./utils/database.indexes";

export default async () => {
  await RedisUtil.initialize();

  // Ensure all required geospatial, unique, and sorting indexes exist.
  // These are idempotent and safe to execute on startup.
  const db = getDB();
  await ensureDatabaseIndexes(db);
};
