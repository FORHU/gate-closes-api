import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import { ensureDatabaseIndexes } from "../utils/database.indexes";

async function run() {
  console.log("[init-indexes] Connecting to MongoDB...");
  await connectToMongo();
  const db = getDB();

  console.log("[init-indexes] Ensuring required database indexes...");
  const result = await ensureDatabaseIndexes(db);

  console.log(`[init-indexes] Successfully verified/created ${result.created.length} indexes.`);
  if (result.errors.length > 0) {
    console.warn(`[init-indexes] Encountered ${result.errors.length} warnings/errors:`);
    result.errors.forEach((err) => console.warn(`  - ${err}`));
  }

  const client = useMongoClient();
  if (client) {
    await client.close();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("[init-indexes] Fatal error initializing indexes:", err);
  process.exit(1);
});
