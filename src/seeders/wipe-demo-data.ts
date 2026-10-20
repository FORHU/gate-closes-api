import { Db } from "mongodb";
import { log } from "./helpers";

/**
 * What the demo seeders recreate, emptied first. Never wiped: `airport`
 * (real Airport Crawl data), `role` (admin edits), `offer`/`offer.event`
 * (stats). Unused scaffolding collections (organizations, fs.conversation*,
 * sovereignFutureSignal) aren't seeded at all.
 */
export const DEMO_COLLECTIONS = [
  "user",
  "user.auth",
  "flightTicket",
  "file",
  "verification.code",
  "terminal.echo",
  "terminal.echo.reaction",
  "terminal.echo.reply",
  "terminal.echo.reply.reaction",
  "btConversation",
  "btConversationMessage",
  "btConversationMessage.reaction",
  "btConversationReadState",
  "dtConversation",
  "dtConversationMessage",
  "dtConversationMessage.reaction",
  "dtConversationReadState",
  "psConversation",
  "psConversationMessage",
  "psConversationMessage.reaction",
  "psConversationReadState",
];

export async function wipeDemoData(db: Db) {
  log(`wiping ${DEMO_COLLECTIONS.length} collections...`);
  await Promise.all(DEMO_COLLECTIONS.map((name) => db.collection(name).deleteMany({})));
}
