import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import RoleSvc from "../services/role.service";
import UserRepo from "../repositories/user.repository";

/**
 * Sets a user's role from the command line: how the first super admin is
 * made (after that, super admins change roles in the admin web app).
 *   npm run role:set -- someone@example.com super_admin
 */
async function run() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role) {
    console.error("Usage: npm run role:set -- <email> <role name>");
    process.exit(1);
  }

  await connectToMongo();
  await RoleSvc.seedSystemRoles();
  const close = async (code: number) => {
    await useMongoClient()?.close();
    process.exit(code);
  };

  if (!(await RoleSvc.exists(role))) {
    const names = (await RoleSvc.list()).map((r) => r.name).join(", ");
    console.error(`[role:set] No role named "${role}". Roles: ${names}`);
    return close(1);
  }
  const user = await getDB()
    .collection("user")
    .findOne({ email }, { projection: { _id: 1 } });
  if (!user) {
    console.error(`[role:set] No user with email ${email}.`);
    return close(1);
  }
  await UserRepo.setRole(user._id, role);
  console.log(`[role:set] ${email} is now ${role}.`);
  return close(0);
}

run().catch((err) => {
  console.error("[role:set] Failed:", err);
  process.exit(1);
});
