import express from "express";
const router = express.Router();

import AirportCtrl from "../controllers/airport.controller";

// Search airports by name/IATA/ICAO
router.get("/search", AirportCtrl.search);

// Find nearby airports by coordinates
router.get("/nearby", AirportCtrl.findNearby);

// Find nearest airport and check radius
router.get("/check-inside-airport", AirportCtrl.checkInsideAirport);

// Find nearest airport for a specific airport name and check radius
router.get("/check-inside-specific-airport", AirportCtrl.checkInsideSpecificAirport);

export default router;
