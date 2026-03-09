import express from "express";
const router = express.Router();

import AirportCtrl from "../controllers/airport.controller";

// Find nearby airports by coordinates
router.get("/nearby", AirportCtrl.findNearby);

// Find nearest airport and check radius
router.get("/check-inside-airport", AirportCtrl.checkInsideAirport);

export default router;
