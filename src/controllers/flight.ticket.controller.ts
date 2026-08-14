import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketSvc from "../services/flight.ticket.service";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import { ERROR_MESSAGE } from "../const";
import { getErrorMessage } from "../utils/error.util";

export default class FlightTicketCtrl {
  // POST /flight-ticket
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const {
      flightNumber,
      fromAirport,
      toAirport,
      departureDateTime,
      returnDateTime,
    } = req.body;

    const schema = Joi.object({
      flightNumber: Joi.string().trim().required(),
      fromAirport: Joi.string().trim().required(),
      toAirport: Joi.string().trim().required(),
      departureDateTime: Joi.date().required(),
      returnDateTime: Joi.date().required(),
    });

    const { error, value } = schema.validate(
      {
        flightNumber,
        fromAirport,
        toAirport,
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
        fromAirport: value.fromAirport,
        toAirport: value.toAirport,
        departureDateTime: value.departureDateTime,
        returnDateTime: value.returnDateTime,
      });

      return res.json({ message: result });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
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
    } catch (err) {
      const message = getErrorMessage(err);
      const status = message === ERROR_MESSAGE.INVALID_USER_ID ? 400 : 500;
      return res.status(status).json({ message });
    }
  }


  // PUT /flight-ticket
  static async update(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const {
      flightNumber,
      fromAirport,
      toAirport,
      departureDateTime,
      returnDateTime,
    } = req.body;

  // Fields are marked .optional() because an edit might only change one thing
    const schema = Joi.object({
      flightNumber: Joi.string().trim().optional(),
      fromAirport: Joi.string().trim().optional(),
      toAirport: Joi.string().trim().optional(),
      departureDateTime: Joi.date().optional(),
      returnDateTime: Joi.date().optional(),
    });

    const { error, value } = schema.validate(
      { flightNumber, fromAirport, toAirport, departureDateTime, returnDateTime },
      { convert: true, stripUnknown: true }
    );

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userObjectId = FlightTicketRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );

      const updatedTicket = await FlightTicketSvc.update(userObjectId, value);

      return res.json({ message: "Ticket updated successfully", data: updatedTicket });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }
}


