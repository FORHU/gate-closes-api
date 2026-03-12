import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketSvc from "../services/flight.ticket.service";
import FlightTicketRepo from "../repositories/flight.ticket.repository";

export default class FlightTicketCtrl {
  // POST /flight-ticket
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      flightNumber,
      fromCity,
      toCity,
      departureDateTime,
      returnDateTime,
    } = req.body;

    const schema = Joi.object({
      flightNumber: Joi.string().trim().required(),
      fromCity: Joi.string().trim().required(),
      toCity: Joi.string().trim().required(),
      departureDateTime: Joi.date().required(),
      returnDateTime: Joi.date().required(),
    });

    const { error, value } = schema.validate(
      {
        flightNumber,
        fromCity,
        toCity,
        departureDateTime,
        returnDateTime,
      },
      { convert: true }
    );

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userObjectId = FlightTicketRepo.parseObjectId(
        userId,
        "Invalid user id."
      );

      const result = await FlightTicketSvc.create({
        userId: userObjectId,
        flightNumber: value.flightNumber,
        fromCity: value.fromCity,
        toCity: value.toCity,
        departureDateTime: value.departureDateTime,
        returnDateTime: value.returnDateTime,
      });

      return res.json({ message: result });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}

