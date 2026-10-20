import express from "express";
import OfferCtrl from "../controllers/offer.controller";

/** App side, behind `sessionMiddleware`. */
const router = express.Router();

router.get("/", OfferCtrl.forAirport);
router.post("/:id/events", OfferCtrl.track);
router.post("/:id/claim", OfferCtrl.claim);

export default router;
