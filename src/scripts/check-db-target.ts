import { MONGO_DB, MONGO_URI } from "../config";

/**
 * Says out loud which database a script is about to write to, before it
 * writes anything. The connection string's password is never printed.
 */
export function printDbTarget(script: string) {
  let host = "(unparseable MONGO_URI)";
  try {
    host = new URL(MONGO_URI).host;
  } catch {
    // Keep the placeholder: the connect step will fail with its own error.
  }
  console.log(`[${script}] database "${MONGO_DB}" @ ${host}`);
}
