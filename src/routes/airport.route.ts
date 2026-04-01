import express from "express";
const router = express.Router();

import AirportCtrl from "../controllers/airport.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

router.get("/search", AirportCtrl.search);

router.get("/nearby", AirportCtrl.findNearby);

router.get("/check-inside-airport", AirportCtrl.checkInsideAirport);

router.get("/check-inside-airport-boundary", AirportCtrl.checkInsideAirportByBoundary);

router.get("/check-inside-specific-airport", AirportCtrl.checkInsideSpecificAirport);

router.post("/boundary/sync", AirportCtrl.syncBoundaries);

router.get("/geojson", sessionMiddleware, AirportCtrl.getAllAsGeoJson);

export default router;
