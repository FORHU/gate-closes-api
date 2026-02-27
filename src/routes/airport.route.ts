import express from "express";
const router = express.Router();

import AirportCtrl from "../controllers/airport.controller";

// Find nearby airports by coordinates
router.get("/nearby", AirportCtrl.findNearby);

export default router;
