import { Db, Document } from "mongodb";
import { ROLE_JSON_SCHEMA } from "../models/role.model";

/**
 * MongoDB validators (`$jsonSchema`) per collection. Mongo stores no schema
 * by default; these make one visible in Atlas/Compass (Validation tab) and
 * enforced by the database. Add a collection here to give it one.
 */
export const TARGET_COLLECTION_SCHEMAS: { collection: string; schema: Document }[] = [
  { collection: "role", schema: ROLE_JSON_SCHEMA },
];

/**
 * Creates each collection with its validator, or replaces the validator on
 * an existing one. Needs the `collMod` right (Atlas "dbAdmin"), which the
 * API's own database user should not have: run it with an admin connection.
 */
export async function applyCollectionSchemas(db: Db) {
  const applied: string[] = [];
  for (const { collection, schema } of TARGET_COLLECTION_SCHEMAS) {
    const validator = { $jsonSchema: schema };
    const exists = (await db.listCollections({ name: collection }).toArray()).length > 0;
    if (exists) {
      await db.command({ collMod: collection, validator, validationLevel: "strict" });
    } else {
      await db.createCollection(collection, { validator, validationLevel: "strict" });
    }
    applied.push(collection);
  }
  return applied;
}
