import "dotenv/config";
import { MONGO_DB } from "../config";
import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import { ensureDatabaseIndexes } from "../utils/database.indexes";
import RoleSvc from "../services/role.service";
import UserRepo from "../repositories/user.repository";
import { SUPER_ADMIN_ROLE } from "../domain/access/permissions";

/**
 * Seeds the system roles (user, user_premium, developer, admin,
 * super_admin) into the `role` collection.
 * Never deletes anything: safe on any database, run once per environment.
 *
 *   npm run seed:roles                                   add missing roles, keep edited ones
 *   npm run seed:roles -- --reset                        put system roles back to their defaults
 *   npm run seed:roles -- --super-admin you@example.com  also make that user super admin
 */
const args = process.argv.slice(2);
const reset = args.includes("--reset");
const superAdminAt = args.indexOf("--super-admin");
const superAdminEmail = superAdminAt >= 0 ? args[superAdminAt + 1] : undefined;

const main = async () => {
  if (superAdminAt >= 0 && (!superAdminEmail || superAdminEmail.startsWith("--"))) {
    throw new Error("--super-admin needs an email.");
  }

  await connectToMongo();
  console.log(`[seed:roles] database "${MONGO_DB}"`);
  await ensureDatabaseIndexes(getDB());

  if (reset) {
    const names = await RoleSvc.resetSystemRoles();
    console.log(`[seed:roles] reset to defaults: ${names.join(", ")}`);
  } else {
    const added = await RoleSvc.seedSystemRoles();
    console.log(
      added.length
        ? `[seed:roles] added: ${added.join(", ")}`
        : "[seed:roles] all system roles already there (kept as they are)"
    );
  }

  if (superAdminEmail) {
    const user = await getDB()
      .collection("user")
      .findOne({ email: superAdminEmail }, { projection: { _id: 1 } });
    if (!user) throw new Error(`no user with email ${superAdminEmail}.`);
    await UserRepo.setRole(user._id, SUPER_ADMIN_ROLE);
    console.log(`[seed:roles] ${superAdminEmail} is now ${SUPER_ADMIN_ROLE}`);
  }

  for (const role of await RoleSvc.list()) {
    const users = await UserRepo.countWithRole(role.name);
    console.log(
      `  ${role.name.padEnd(16)} ${role.isSystem ? "system" : "custom"}  ` +
        `${String(role.permissions.length).padStart(2)} permissions` +
        (role.name === "user" ? "" : `  ${users} user${users === 1 ? "" : "s"}`)
    );
  }
};

main()
  .catch((error) => {
    console.error(`[seed:roles] failed: ${(error as Error)?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await useMongoClient()?.close();
    // Imported app modules keep handles open (as in init-indexes.ts).
    process.exit();
  });
