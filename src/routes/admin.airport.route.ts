import express from "express";
import AdminAirportCtrl from "../controllers/admin.airport.controller";
import requirePermission from "../middleware/permission.middleware";

/** Admin web app, behind `sessionMiddleware`. */
const router = express.Router();
const manage = requirePermission("airports:manage");

router.get("/", manage, AdminAirportCtrl.list);
router.patch("/:id/radius", manage, AdminAirportCtrl.setRadius);

export default router;
