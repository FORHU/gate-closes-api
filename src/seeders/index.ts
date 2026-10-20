import { Db } from "mongodb";
import { seedRoles } from "./roles.seeder";
import { seedStaffUsers } from "./staff-users.seeder";
import { seedOffers } from "./offers.seeder";
import { wipeDemoData } from "./wipe-demo-data";
import { seedDemoUsers } from "./demo-users.seeder";
import { seedFlightTickets } from "./flight-tickets.seeder";
import { seedFiles } from "./files.seeder";
import { seedTerminalEcho } from "./terminal-echo.seeder";
import { seedConversations } from "./conversations.seeder";
import { seedVerificationCodes } from "./verification-codes.seeder";

/**
 * Every seeder, in the order they run. One file per seeder in this folder.
 *
 *   Base   (npm run seed:base)  safe on any database: creates or updates,
 *                               never deletes.
 *   Demo   (npm run seed)       wipes the demo collections and recreates
 *                               fake travelers, tickets, echoes and chats,
 *                               then runs Base again.
 */

/** Roles first: staff users point at them by name. */
export async function runBaseSeeders(db: Db, { resetRoles = false } = {}) {
  await seedRoles({ reset: resetRoles });
  await seedStaffUsers(db);
  await seedOffers(db);
}

/** Users first: everything else belongs to one; files before what plays them. */
export async function runDemoSeeders(db: Db) {
  await wipeDemoData(db);
  const users = await seedDemoUsers(db);
  await seedFlightTickets(db, users);
  const files = await seedFiles(db);
  await seedTerminalEcho(db, users, files);
  await seedConversations(db, users, files);
  await seedVerificationCodes(db, users);
}
