import bcrypt from "bcrypt";
import { Db } from "mongodb";
import { MVerificationCode } from "../models/verification.code.model";
import { dateOffsetDays, log, type SeededUser } from "./helpers";

/** Two old, expired password-reset codes ("000000"), for the expiry paths. */
export async function seedVerificationCodes(db: Db, users: SeededUser[]) {
  const sample = users.slice(0, 2);
  for (const user of sample) {
    const codeHash = await bcrypt.hash("000000", 10);
    await db.collection("verification.code").insertOne(
      new MVerificationCode({
        userId: user._id,
        codeHash,
        purpose: "reset_password",
        expiresAt: dateOffsetDays(-25),
        resendAfter: dateOffsetDays(-25),
        attempts: 1,
        createdAt: dateOffsetDays(-25),
      })
    );
  }
  log(`verification codes: ${sample.length}`);
}
