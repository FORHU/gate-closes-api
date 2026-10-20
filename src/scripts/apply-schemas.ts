import "dotenv/config";
import * as dns from "dns";
import { MongoClient } from "mongodb";
import { MONGO_DB, MONGO_URI } from "../config";
import { applyCollectionSchemas } from "../utils/database.schemas";

/**
 * Applies the schemas in `src/utils/database.schemas.ts` to the database.
 *   npm run db:schemas
 *
 * Changing a collection's validator needs an Atlas database user with the
 * "dbAdmin" role; the API's user doesn't have it (and shouldn't). Put that
 * user's connection string in `.env` as MONGO_ADMIN_URI; the API never
 * reads it. Without it, MONGO_URI is tried (and usually refused).
 */
const main = async () => {
  const uri = process.env.MONGO_ADMIN_URI || MONGO_URI;
  if (!process.env.MONGO_ADMIN_URI) {
    console.warn("[db:schemas] MONGO_ADMIN_URI not set, trying MONGO_URI");
  }
  dns.setServers(["8.8.8.8", "1.1.1.1"]); // as in utils/mongo.ts
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const applied = await applyCollectionSchemas(client.db(MONGO_DB));
    console.log(`[db:schemas] database "${MONGO_DB}": schema applied to ${applied.join(", ")}`);
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    console.error(`[db:schemas] failed: ${message}`);
    if (message.includes("not allowed")) {
      console.error(
        "[db:schemas] This database user can't change validators. In Atlas: Database Access →" +
          ' add a user with "dbAdmin" on this database, then set MONGO_ADMIN_URI in .env.'
      );
    }
    process.exitCode = 1;
  } finally {
    await client.close();
  }
};

main();
