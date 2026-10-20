import express from "express";
import AdminRoleCtrl from "../controllers/admin.role.controller";
import requirePermission from "../middleware/permission.middleware";

/** Admin web app, behind `sessionMiddleware`. Seeing roles: `users:read`. */
const router = express.Router();
const read = requirePermission("users:read");
const manage = requirePermission("roles:manage");

router.get("/", read, AdminRoleCtrl.list);
router.post("/", manage, AdminRoleCtrl.create);
router.patch("/:name", manage, AdminRoleCtrl.update);
router.delete("/:name", manage, AdminRoleCtrl.remove);

export default router;
