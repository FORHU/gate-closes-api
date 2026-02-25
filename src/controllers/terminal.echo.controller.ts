import { Request, Response } from "express";
import Joi from "joi";
import TerminalEchoSvc from "../services/terminal.echo.service";

export default class TerminalEchoCtrl {
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { audioUrl, textMessage, location, airportName } = req.body;

    const locationSchema = Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    });

    const schema = Joi.object({
      audioUrl: Joi.string().uri().required(),
      textMessage: Joi.string().min(1).max(128).optional().default(null),
      location: locationSchema.required(),
      airportName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({
      audioUrl,
      textMessage,
      location,
      airportName,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.create(
        userId,
        value.audioUrl,
        value.location,
        value.airportName,
        value.textMessage
      );
      return res.status(201).json({
        message: "Terminal echo created.",
        insertedId: result.insertedId,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }
}

