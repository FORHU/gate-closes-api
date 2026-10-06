import bcrypt from "bcrypt";
import { Db } from "mongodb";
import { MUser } from "../models/user.model";
import { MUserAuth } from "../models/user.auth.model";
import UserRepo from "../repositories/user.repository";
import { log } from "./helpers";

/** Every staff test account logs in with this password. */
export const STAFF_PASSWORD = "GateCloses123!";

/** One test account per role, to log in to the app and the admin (`/admin`). */
export const STAFF_USERS = [
  { email: "superadmin@example.com", username: "test_superadmin", role: "super_admin" },
  { email: "admin@example.com", username: "test_admin", role: "admin" },
  { email: "developer@example.com", username: "test_developer", role: "developer" },
  { email: "premium@example.com", username: "test_premium", role: "user_premium" },
  { email: "user@example.com", username: "test_user", role: "user" },
] as const;

/**
 * Creates the staff accounts, or brings existing ones back to a known state
 * (role, password, completed signup), so they always work after a run.
 */
export async function seedStaffUsers(db: Db) {
  const password = await bcrypt.hash(STAFF_PASSWORD, 10);
  let created = 0;

  for (const staff of STAFF_USERS) {
    let user = await db.collection("user").findOne({ email: staff.email });
    if (!user) {
      const doc = new MUser({
        email: staff.email,
        username: staff.username,
        gender: "Male",
        signupStep: "completed",
        signupCompleted: true,
        isCompleteProfile: true,
      });
      await db.collection("user").insertOne(doc);
      user = { ...doc, _id: doc._id! };
      created += 1;
    } else {
      await db
        .collection("user")
        .updateOne(
          { _id: user._id },
          { $set: { signupStep: "completed", signupCompleted: true, isCompleteProfile: true } }
        );
    }
    await UserRepo.setRole(user._id, staff.role);

    const auth = await db.collection("user.auth").findOne({ userId: user._id });
    if (auth) {
      await db
        .collection("user.auth")
        .updateOne({ _id: auth._id }, { $set: { provider: "local", password } });
    } else {
      await db
        .collection("user.auth")
        .insertOne(new MUserAuth({ userId: user._id, provider: "local", password }));
    }
  }

  log(
    `staff users: ${STAFF_USERS.length} (${created} new), password "${STAFF_PASSWORD}": ` +
      STAFF_USERS.map((s) => s.email).join(", ")
  );
}
