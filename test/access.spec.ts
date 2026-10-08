import { expect } from "chai";
import { describe, it, afterEach, beforeEach } from "mocha";
import type { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongodb";
import requirePermission from "../src/middleware/permission.middleware";
import AdminUserCtrl from "../src/controllers/admin.user.controller";
import AdminRoleCtrl from "../src/controllers/admin.role.controller";
import UserRepo from "../src/repositories/user.repository";
import RoleRepo from "../src/repositories/role.repository";
import RoleSvc, { RoleConflictError } from "../src/services/role.service";
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  roleNameOf,
  type Permission,
} from "../src/domain/access/permissions";
import type { TRole } from "../src/models/role.model";

// Roles live in the `role` collection (super admins edit them); permissions
// are fixed in code. Routes check permissions, read on every request.
describe("Roles and permissions", () => {
  const originals: Array<() => void> = [];
  beforeEach(() => RoleSvc.clearCache());
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

  type MockRes = Response & { statusCode: number; body: { message?: string; data?: unknown } };
  const mockRes = () => {
    const res = { statusCode: 200, body: {} } as MockRes;
    res.status = ((code: number) => {
      res.statusCode = code;
      return res;
    }) as MockRes["status"];
    res.json = ((body: MockRes["body"]) => {
      res.body = body;
      return res;
    }) as MockRes["json"];
    res.end = (() => res) as MockRes["end"];
    return res;
  };

  const userId = "650000000000000000000001";

  /** The `role` collection as the seeded system roles plus [extra]. */
  const stubRoles = (extra: TRole[] = []) => {
    const roles: TRole[] = [...SYSTEM_ROLES.map((r) => ({ ...r, isSystem: true })), ...extra];
    let reads = 0;
    stub(RoleRepo, "findByName", async (name: string) => {
      reads++;
      return roles.find((r) => r.name === name) ?? null;
    });
    return { roles, reads: () => reads };
  };

  describe("seed", () => {
    it("system roles: user has nothing, super admin everything", () => {
      const by = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.name, r.permissions]));
      expect(Object.keys(by)).to.deep.equal([
        "user",
        "user_premium",
        "developer",
        "admin",
        "super_admin",
      ]);
      expect(by.user).to.deep.equal([]);
      expect(by.super_admin).to.have.members([...PERMISSIONS]);
    });

    it("inserts only missing roles, as system roles", async () => {
      const inserted: TRole[] = [];
      stub(RoleRepo, "insertIfAbsent", async (r: TRole) => {
        if (r.name === "admin") return false; // already there, maybe edited
        inserted.push(r);
        return true;
      });
      const added = await RoleSvc.seedSystemRoles();
      expect(added).to.not.include("admin");
      expect(added).to.have.lengthOf(SYSTEM_ROLES.length - 1);
      expect(inserted.every((r) => r.isSystem)).to.equal(true);
    });
  });

  describe("permissionsFor", () => {
    it("reads a custom role from the database", async () => {
      stubRoles([
        {
          name: "voucher_manager",
          label: "Vouchers",
          permissions: ["offers:read"],
          isSystem: false,
        },
      ]);
      expect(await RoleSvc.permissionsFor("voucher_manager")).to.deep.equal(["offers:read"]);
    });

    it("super admin is everything even if its stored list was cut", async () => {
      const { roles } = stubRoles();
      roles.find((r) => r.name === "super_admin")!.permissions = [];
      expect(await RoleSvc.permissionsFor("super_admin")).to.have.members([...PERMISSIONS]);
    });

    it("an unknown or deleted role gets what user has, not more", async () => {
      stubRoles();
      expect(await RoleSvc.permissionsFor("ghost")).to.deep.equal([]);
      expect(roleNameOf({})).to.equal("user");
    });

    it("caches, and a role change clears the cache", async () => {
      const { reads } = stubRoles();
      await RoleSvc.permissionsFor("admin");
      await RoleSvc.permissionsFor("admin");
      expect(reads()).to.equal(1);
      stub(RoleRepo, "update", async () => ({ name: "admin" }));
      await RoleSvc.update("admin", { label: "Admins" });
      await RoleSvc.permissionsFor("admin");
      expect(reads()).to.equal(2);
    });
  });

  describe("requirePermission", () => {
    const run = async (role: unknown, ...permissions: Permission[]) => {
      stubRoles([
        {
          name: "voucher_manager",
          label: "Vouchers",
          permissions: ["offers:write"],
          isSystem: false,
        },
      ]);
      stub(UserRepo, "findById", async () => ({ _id: new ObjectId(userId), role }));
      const res = mockRes();
      let passed = false;
      await requirePermission(...permissions)(
        { user: { userId } } as unknown as Request,
        res,
        (() => {
          passed = true;
        }) as NextFunction
      );
      return { res, passed };
    };

    it("lets a role with the permission through, custom roles included", async () => {
      expect((await run("admin", "offers:write")).passed).to.equal(true);
      expect((await run("developer", "airports:manage")).passed).to.equal(true);
      expect((await run("voucher_manager", "offers:write")).passed).to.equal(true);
    });

    it("refuses with 403 when the role lacks it", async () => {
      const dev = await run("developer", "offers:write");
      expect(dev.passed).to.equal(false);
      expect(dev.res.statusCode).to.equal(403);
      expect((await run(undefined, "offers:read")).passed).to.equal(false);
      expect((await run("admin", "roles:manage")).passed).to.equal(false);
    });

    it("needs every listed permission", async () => {
      expect((await run("admin", "offers:write", "users:role")).passed).to.equal(false);
      expect((await run("super_admin", "offers:write", "users:role")).passed).to.equal(true);
    });

    it("401 without a session", async () => {
      const res = mockRes();
      await requirePermission("offers:read")({} as Request, res, (() => {}) as NextFunction);
      expect(res.statusCode).to.equal(401);
    });
  });

  describe("managing roles", () => {
    it("refuses to delete a system role, or a role users still have", async () => {
      stubRoles([{ name: "temp", label: "Temp", permissions: [], isSystem: false }]);
      stub(UserRepo, "countWithRole", async () => 2);
      for (const name of ["admin", "temp"]) {
        try {
          await RoleSvc.remove(name);
          expect.fail("delete should be refused");
        } catch (err) {
          expect(err).to.be.instanceOf(RoleConflictError);
        }
      }
    });

    it("refuses to edit super admin's permissions", async () => {
      try {
        await RoleSvc.update("super_admin", { permissions: ["premium"] });
        expect.fail("edit should be refused");
      } catch (err) {
        expect(err).to.be.instanceOf(RoleConflictError);
      }
    });

    it("creates a custom role, refusing unknown permissions and taken names", async () => {
      stubRoles();
      stub(RoleRepo, "create", async (r: TRole) => r);
      const ok = mockRes();
      await AdminRoleCtrl.create(
        {
          body: { name: "Voucher_Manager", label: "Vouchers", permissions: ["offers:read"] },
        } as unknown as Request,
        ok
      );
      expect(ok.statusCode).to.equal(201);
      expect((ok.body.data as TRole).name).to.equal("voucher_manager");

      const unknown = mockRes();
      await AdminRoleCtrl.create(
        { body: { name: "x_role", label: "X", permissions: ["root"] } } as unknown as Request,
        unknown
      );
      expect(unknown.statusCode).to.equal(400);

      const taken = mockRes();
      await AdminRoleCtrl.create(
        { body: { name: "admin", label: "Admin 2", permissions: [] } } as unknown as Request,
        taken
      );
      expect(taken.statusCode).to.equal(409);
    });
  });

  describe("admin users list (server-side pagination)", () => {
    const req = (query: Record<string, string>) => ({ query }) as unknown as Request;
    type Body = { data: unknown[]; pagination: Record<string, number> };

    it("rejects invalid or oversized page and limit", async () => {
      stub(UserRepo, "listForAdmin", async () => {
        throw new Error("should not query");
      });
      const invalid: Record<string, string>[] = [
        { page: "0" },
        { page: "abc" },
        { limit: "500" },
        { limit: "0" },
        { sort: "email" },
      ];
      for (const query of invalid) {
        const res = mockRes();
        await AdminUserCtrl.list(req(query), res);
        expect(res.statusCode, JSON.stringify(query)).to.equal(400);
      }
    });

    it("asks the database for one page and returns the totals", async () => {
      let asked: Record<string, unknown> = {};
      stub(UserRepo, "listForAdmin", async (filter: Record<string, unknown>) => {
        asked = filter;
        return { users: [{ email: "a@x.com" }, { email: "b@x.com", role: "admin" }], total: 45 };
      });
      const res = mockRes();
      await AdminUserCtrl.list(req({ page: "2", limit: "20", q: "a", sort: "username_desc" }), res);
      const body = res.body as unknown as Body;
      expect(res.statusCode).to.equal(200);
      expect(asked).to.include({ page: 2, limit: 20, q: "a", sort: "username_desc" });
      expect(body.pagination).to.deep.equal({ page: 2, limit: 20, total: 45, totalPages: 3 });
      expect(body.data).to.have.length(2);
      expect((body.data[0] as { role: string }).role).to.equal("user");
    });

    it("defaults to page 1 of 10, newest first", async () => {
      let asked: Record<string, unknown> = {};
      stub(UserRepo, "listForAdmin", async (filter: Record<string, unknown>) => {
        asked = filter;
        return { users: [], total: 0 };
      });
      const res = mockRes();
      await AdminUserCtrl.list(req({}), res);
      expect(asked).to.include({ page: 1, limit: 10, sort: "newest" });
      expect((res.body as unknown as Body).pagination).to.deep.equal({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe("changing a user's role", () => {
    const req = (id: string, role: unknown) =>
      ({ user: { userId }, params: { id }, body: { role } }) as unknown as Request;

    it("sets an existing role", async () => {
      stubRoles([{ name: "voucher_manager", label: "V", permissions: [], isSystem: false }]);
      let saved: unknown;
      stub(UserRepo, "setRole", async (_id: ObjectId, role: string) => {
        saved = role;
        return { matchedCount: 1 };
      });
      const res = mockRes();
      await AdminUserCtrl.setRole(req(new ObjectId().toHexString(), "voucher_manager"), res);
      expect(res.statusCode).to.equal(200);
      expect(saved).to.equal("voucher_manager");
    });

    it("refuses a role that doesn't exist, and your own role", async () => {
      stubRoles();
      stub(UserRepo, "setRole", async () => {
        throw new Error("should not save");
      });
      const unknown = mockRes();
      await AdminUserCtrl.setRole(req(new ObjectId().toHexString(), "ghost"), unknown);
      expect(unknown.statusCode).to.equal(400);

      const self = mockRes();
      await AdminUserCtrl.setRole(req(userId, "user"), self);
      expect(self.statusCode).to.equal(409);
    });

    it("stores user as no field", async () => {
      let update: Record<string, unknown> = {};
      stub(UserRepo, "collection", () => ({
        updateOne: async (_f: unknown, u: Record<string, unknown>) => {
          update = u;
          return { matchedCount: 1 };
        },
      }));
      await UserRepo.setRole(new ObjectId(), "user");
      expect(update.$unset).to.deep.equal({ role: "" });
      await UserRepo.setRole(new ObjectId(), "developer");
      expect(update.$set).to.include({ role: "developer" });
    });
  });
});
