import { Request, Response } from "express";
import Joi from "joi";
import TerminalEchoSvc from "../services/terminal.echo.service";

export default class TerminalEchoCtrl {
  static async createAudio(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { audioUrl, location, airportName } = req.body;

    const locationSchema = Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    });

    const schema = Joi.object({
      audioUrl: Joi.string().uri().required(),
      location: locationSchema.required(),
      airportName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({ audioUrl, location, airportName });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.createAudio(
        userId,
        value.audioUrl,
        value.location,
        value.airportName
      );
      return res.status(201).json({
        message: "Terminal echo audio created.",
        insertedId: result.insertedId,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }

  static async createTextMessage(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { textMessage, location, airportName } = req.body;

    const locationSchema = Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    });

    const schema = Joi.object({
      textMessage: Joi.string().min(1).max(128).required(),
      location: locationSchema.required(),
      airportName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({ textMessage, location, airportName });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.createTextMessage(
        userId,
        value.textMessage,
        value.location,
        value.airportName
      );
      return res.status(201).json({
        message: "Terminal echo text message created.",
        insertedId: result.insertedId,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }
}

