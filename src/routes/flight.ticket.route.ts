import express from "express";
const router = express.Router();

import FlightTicketCtrl from "../controllers/flight.ticket.controller";

router.get("/", FlightTicketCtrl.getByUserId);
router.post("/", FlightTicketCtrl.create);
router.put("/", FlightTicketCtrl.update);

export default router;

