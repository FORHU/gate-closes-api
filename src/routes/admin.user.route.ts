import express from "express";
import AdminUserCtrl from "../controllers/admin.user.controller";
import requirePermission from "../middleware/permission.middleware";

/** Admin web app, behind `sessionMiddleware`. */
const router = express.Router();

router.get("/", requirePermission("users:read"), AdminUserCtrl.list);
router.patch("/:id/role", requirePermission("users:role"), AdminUserCtrl.setRole);

export default router;
