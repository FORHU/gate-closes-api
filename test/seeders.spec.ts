import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import bcrypt from "bcrypt";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import UserRepo from "../src/repositories/user.repository";
import RoleSvc from "../src/services/role.service";
import { runBaseSeeders } from "../src/seeders";
import { seedStaffUsers, STAFF_PASSWORD, STAFF_USERS } from "../src/seeders/staff-users.seeder";
import { seedOffers, SAMPLE_OFFERS } from "../src/seeders/offers.seeder";
import { DEMO_COLLECTIONS } from "../src/seeders/wipe-demo-data";

type Doc = Record<string, unknown> & { _id: ObjectId };

/** Just enough of a Mongo Db for the base seeders: findOne/insertOne/updateOne. */
function fakeDb() {
  const data: Record<string, Doc[]> = {};
  const matches = (doc: Doc, filter: Record<string, unknown>) =>
    Object.entries(filter).every(([k, v]) =>
      v instanceof ObjectId ? (doc[k] as ObjectId)?.equals?.(v) : doc[k] === v
    );
  const db = {
    collection: (name: string) => {
      const rows = (data[name] ??= []);
      return {
        findOne: async (filter: Record<string, unknown>) =>
          rows.find((d) => matches(d, filter)) ?? null,
        insertOne: async (doc: Doc) => {
          rows.push({ ...doc, _id: doc._id ?? new ObjectId() });
          return { insertedId: doc._id };
        },
        updateOne: async (filter: Record<string, unknown>, update: { $set?: object }) => {
          const doc = rows.find((d) => matches(d, filter));
          if (doc && update.$set) Object.assign(doc, update.$set);
          return { matchedCount: doc ? 1 : 0 };
        },
      };
    },
  } as unknown as Db;
  return { db, data };
}

// Base seeders run on any database, any number of times: they create or
// update, never duplicate or delete.
describe("Seeders", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });
  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: unknown) => {
    const original = obj[key];
    (obj as Record<K, unknown>)[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };
  const roles = new Map<string, string>();
  const stubRoles = () => {
    roles.clear();
    stub(UserRepo, "setRole", async (id: ObjectId, role: string) => {
      roles.set(id.toHexString(), role);
      return { matchedCount: 1 };
    });
  };

  it("staff users: one per role, then no duplicates and a known password", async () => {
    stubRoles();
    const { db, data } = fakeDb();

    await seedStaffUsers(db);
    // Someone changed a password and left signup unfinished: a re-run repairs it.
    data["user.auth"][0].password = "something else";
    data.user[0].signupCompleted = false;
    await seedStaffUsers(db);

    expect(data.user).to.have.lengthOf(STAFF_USERS.length);
    expect(data["user.auth"]).to.have.lengthOf(STAFF_USERS.length);
    expect(data.user.every((u) => u.signupCompleted === true)).to.equal(true);
    for (const auth of data["user.auth"]) {
      expect(await bcrypt.compare(STAFF_PASSWORD, auth.password as string)).to.equal(true);
    }
    const byEmail = Object.fromEntries(
      data.user.map((u) => [u.email, roles.get(u._id.toHexString())])
    );
    expect(byEmail["superadmin@example.com"]).to.equal("super_admin");
    expect(byEmail["user@example.com"]).to.equal("user");
  });

  it("offers: re-running updates the samples instead of duplicating them", async () => {
    const { db, data } = fakeDb();

    await seedOffers(db);
    data.offer[0].status = "paused";
    await seedOffers(db);

    expect(data.offer).to.have.lengthOf(SAMPLE_OFFERS.length);
    expect(data.offer.every((o) => o.status === "active")).to.equal(true);
    expect(data.offer.map((o) => o.airports).flat()).to.include.members(["BAG", "MNL"]);
  });

  it("base order: roles before the staff users that point at them", async () => {
    stubRoles();
    const order: string[] = [];
    stub(RoleSvc, "seedSystemRoles", async () => {
      order.push("roles");
      return [];
    });
    stub(UserRepo, "setRole", async () => {
      order.push("staff");
      return { matchedCount: 1 };
    });
    await runBaseSeeders(fakeDb().db);
    expect(order[0]).to.equal("roles");
    expect(order).to.include("staff");
  });

  it("the demo wipe never touches roles, offers or airports", () => {
    for (const kept of ["role", "offer", "offer.event", "airport"]) {
      expect(DEMO_COLLECTIONS).to.not.include(kept);
    }
  });
});
