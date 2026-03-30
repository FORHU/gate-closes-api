import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketSvc from "../services/flight.ticket.service";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import { ERROR_MESSAGE } from "../const";

export default class FlightTicketCtrl {
  // POST /flight-ticket
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;

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
        ERROR_MESSAGE.INVALID_USER_ID
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

  // GET /flight-ticket
  static async getByUserId(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;

    const schema = Joi.object({
      userId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ userId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userObjectId = FlightTicketRepo.parseObjectId(
        value.userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );

      const ticket = await FlightTicketSvc.getByUserId(userObjectId);
      return res.json({ data: ticket });
    } catch (err: any) {
      const message = err?.message ?? err;
      const status = message === ERROR_MESSAGE.INVALID_USER_ID ? 400 : 500;
      return res.status(status).json({ message });
    }
  }
}

