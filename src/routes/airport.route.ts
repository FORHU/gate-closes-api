import express from "express";
const router = express.Router();

import AirportCtrl from "../controllers/airport.controller";

// Get airport by IATA code
router.get("/iata/:code", AirportCtrl.getByIata);

// Get airport by ICAO code
router.get("/icao/:code", AirportCtrl.getByIcao);

// Search airport by name
router.get("/search", AirportCtrl.searchByName);

// Find nearby airports by coordinates
router.get("/nearby", AirportCtrl.findNearby);

export default router;
