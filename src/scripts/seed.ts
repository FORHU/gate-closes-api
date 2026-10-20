import "dotenv/config";
import { MONGO_DB } from "../config";
import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import { runBaseSeeders, runDemoSeeders } from "../seeders";
import { DEMO_COLLECTIONS } from "../seeders/wipe-demo-data";
import { printDbTarget } from "./check-db-target";

/**
 * Full reset for testing: wipes the demo collections (users, echoes,
 * tickets, conversations...), recreates fake data, then runs the base
 * seeders (roles, staff users, sample offers). The seeders themselves are
 * in src/seeders/ (order in src/seeders/index.ts).
 *
 *   SEED_CONFIRM_DB=<database name> npm run seed
 */
const main = async () => {
  printDbTarget("seed");
  // Wiping is not undoable: refuse unless the caller names the database, so
  // a .env pointing somewhere real can't be emptied by accident.
  if (!MONGO_DB || process.env.SEED_CONFIRM_DB !== MONGO_DB) {
    throw new Error(
      `refusing to wipe ${DEMO_COLLECTIONS.length} collections of "${MONGO_DB}". ` +
        `Re-run with SEED_CONFIRM_DB=${MONGO_DB} if this database holds nothing you need.`
    );
  }

  await connectToMongo();
  const db = getDB();
  await runDemoSeeders(db);
  // After the wipe, which also emptied the staff users.
  await runBaseSeeders(db);
  console.log("[seed] done.");
};

main()
  .catch((error) => {
    console.error(`[seed] fatal: ${(error as Error)?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await useMongoClient()?.close();
    process.exit();
  });
