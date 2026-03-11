import express from "express";
const router = express.Router();

import FlightTicketCtrl from "../controllers/flight.ticket.controller";

router.post("/", FlightTicketCtrl.create);

export default router;

