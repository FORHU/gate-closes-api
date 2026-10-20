import express from "express";
import OfferCtrl from "../controllers/offer.controller";
import requirePermission from "../middleware/permission.middleware";

/** Admin web app, behind `sessionMiddleware`. */
const router = express.Router();
const read = requirePermission("offers:read");
const write = requirePermission("offers:write");

router.get("/", read, OfferCtrl.adminList);
router.post("/", write, OfferCtrl.adminCreate);
router.get("/:id", read, OfferCtrl.adminGet);
router.patch("/:id", write, OfferCtrl.adminUpdate);
router.delete("/:id", write, OfferCtrl.adminDelete);
router.get("/:id/stats", read, OfferCtrl.adminStats);

export default router;
