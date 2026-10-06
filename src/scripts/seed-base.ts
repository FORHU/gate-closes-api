import "dotenv/config";
import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import { ensureDatabaseIndexes } from "../utils/database.indexes";
import { runBaseSeeders } from "../seeders";
import UserRepo from "../repositories/user.repository";
import { SUPER_ADMIN_ROLE } from "../domain/access/permissions";
import { printDbTarget } from "./check-db-target";

/**
 * Base data, safe on any database (creates or updates, never deletes):
 * system roles, one staff test account per role, sample offers.
 *
 *   npm run seed:base                                   roles, staff users, sample offers
 *   npm run seed:base -- --reset-roles                  also put system roles back to defaults
 *   npm run seed:base -- --super-admin you@example.com  also make a real account super admin
 */
const args = process.argv.slice(2);
const superAdminAt = args.indexOf("--super-admin");
const superAdminEmail = superAdminAt >= 0 ? args[superAdminAt + 1] : undefined;

const main = async () => {
  if (superAdminAt >= 0 && (!superAdminEmail || superAdminEmail.startsWith("--"))) {
    throw new Error("--super-admin needs an email.");
  }

  printDbTarget("seed:base");
  await connectToMongo();
  const db = getDB();
  await ensureDatabaseIndexes(db);

  await runBaseSeeders(db, { resetRoles: args.includes("--reset-roles") });

  if (superAdminEmail) {
    const user = await db
      .collection("user")
      .findOne({ email: superAdminEmail }, { projection: { _id: 1 } });
    if (!user) throw new Error(`no user with email ${superAdminEmail}.`);
    await UserRepo.setRole(user._id, SUPER_ADMIN_ROLE);
    console.log(`[seed:base] ${superAdminEmail} is now ${SUPER_ADMIN_ROLE}`);
  }
  console.log("[seed:base] done.");
};

main()
  .catch((error) => {
    console.error(`[seed:base] failed: ${(error as Error)?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await useMongoClient()?.close();
    // Imported app modules keep handles open (as in init-indexes.ts).
    process.exit();
  });
