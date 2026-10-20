import bcrypt from "bcrypt";
import { Db } from "mongodb";
import { MUser } from "../models/user.model";
import { MUserAuth } from "../models/user.auth.model";
import { log, type SeededUser } from "./helpers";

/** Every local demo traveler logs in with this password. */
export const DEMO_PASSWORD = "Password123!";

/** Fake travelers who own the demo echoes, tickets and conversations. */
export const DEMO_USERS: Array<{
  email: string;
  username: string;
  gender: "Male" | "Female";
  provider: "local" | "google";
  googleId?: string;
}> = [
  { email: "ava.morgan@example.com", username: "ava_morgan", gender: "Female", provider: "local" },
  { email: "liam.chen@example.com", username: "liam_chen", gender: "Male", provider: "local" },
  {
    email: "sofia.reyes@example.com",
    username: "sofia_reyes",
    gender: "Female",
    provider: "local",
  },
  { email: "noah.becker@example.com", username: "noah_becker", gender: "Male", provider: "local" },
  { email: "mia.tanaka@example.com", username: "mia_tanaka", gender: "Female", provider: "local" },
  {
    email: "ethan.oconnor@example.com",
    username: "ethan_oconnor",
    gender: "Male",
    provider: "local",
  },
  { email: "zara.khan@example.com", username: "zara_khan", gender: "Female", provider: "local" },
  { email: "lucas.silva@example.com", username: "lucas_silva", gender: "Male", provider: "local" },
  {
    email: "amelia.novak@example.com",
    username: "amelia_novak",
    gender: "Female",
    provider: "google",
    googleId: "100000000000000001",
  },
  {
    email: "oliver.dubois@example.com",
    username: "oliver_dubois",
    gender: "Male",
    provider: "google",
    googleId: "100000000000000002",
  },
];

/** Inserts the demo travelers (the wipe ran first) and returns them. */
export async function seedDemoUsers(db: Db): Promise<SeededUser[]> {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: SeededUser[] = [];

  for (const demo of DEMO_USERS) {
    const user = new MUser({
      email: demo.email,
      username: demo.username,
      gender: demo.gender,
      signupStep: "completed",
      signupCompleted: true,
      isCompleteProfile: true,
    });
    await db.collection("user").insertOne(user);
    users.push({ _id: user._id!, username: demo.username });

    const auth = new MUserAuth(
      demo.provider === "google"
        ? { userId: user._id!, provider: "google", googleId: demo.googleId }
        : { userId: user._id!, provider: "local", password: hashedPassword }
    );
    await db.collection("user.auth").insertOne(auth);
  }

  log(`demo users: ${users.length} (local ones: password "${DEMO_PASSWORD}")`);
  return users;
}
