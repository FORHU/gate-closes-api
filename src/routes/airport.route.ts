import express from "express";
const router = express.Router();

import AirportCtrl from "../controllers/airport.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";
import requirePermission from "../middleware/permission.middleware";

router.get("/search", AirportCtrl.searchByName);

router.get("/nearby", AirportCtrl.findNearby);

router.get("/check-inside-airport", AirportCtrl.checkInsideAirport);

router.get("/check-inside-airport-boundary", AirportCtrl.checkInsideAirportByBoundary);

router.get("/check-inside-specific-airport", AirportCtrl.checkInsideSpecificAirport);

router.post("/boundary/sync", requirePermission("airports:manage"), AirportCtrl.syncBoundaries);

router.post("/crawl", requirePermission("airports:manage"), AirportCtrl.crawl);

router.get("/geojson", sessionMiddleware, AirportCtrl.getAllAsGeoJson);

export default router;
