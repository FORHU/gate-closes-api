import { expect } from "chai";
import { describe, it } from "mocha";
import type { Db } from "mongodb";
import { applyCollectionSchemas, TARGET_COLLECTION_SCHEMAS } from "../src/utils/database.schemas";
import { ROLE_JSON_SCHEMA } from "../src/models/role.model";
import { PERMISSIONS, SYSTEM_ROLES } from "../src/domain/access/permissions";

// Validators shown in Atlas (Validation tab), applied by `npm run db:schemas`.
describe("Database schemas", () => {
  it("role schema follows the code: every permission, every seeded name", () => {
    expect(ROLE_JSON_SCHEMA.properties.permissions.items.enum).to.deep.equal([...PERMISSIONS]);
    const pattern = new RegExp(ROLE_JSON_SCHEMA.properties.name.pattern);
    for (const role of SYSTEM_ROLES) expect(pattern.test(role.name), role.name).to.equal(true);
    expect(pattern.test("Bad Name")).to.equal(false);
  });

  it("creates a missing collection with its validator, updates an existing one", async () => {
    const calls: string[] = [];
    const db = {
      listCollections: ({ name }: { name: string }) => ({
        toArray: async () => (name === "role" ? [{ name }] : []),
      }),
      command: async (cmd: { collMod: string; validator: unknown }) => {
        calls.push(`collMod ${cmd.collMod}`);
        expect(cmd.validator).to.deep.equal({ $jsonSchema: ROLE_JSON_SCHEMA });
      },
      createCollection: async (name: string) => {
        calls.push(`create ${name}`);
      },
    } as unknown as Db;
    const applied = await applyCollectionSchemas(db);
    expect(applied).to.deep.equal(TARGET_COLLECTION_SCHEMAS.map((s) => s.collection));
    expect(calls).to.deep.equal(["collMod role"]);
  });
});
