import { Request, Response } from "express";
import Joi from "joi";
import TerminalEchoSvc from "../services/terminal.echo.service";

export default class TerminalEchoCtrl {
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { fileUrl, fileName, textMessage, location, airportName } = req.body;

    const locationSchema = Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    });

    const schema = Joi.object({
      fileUrl: Joi.string().uri().required(),
      fileName: Joi.string().min(1).required(),
      textMessage: Joi.string().max(128).optional(),
      location: locationSchema.required(),
      airportName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({
      fileUrl,
      fileName,
      textMessage,
      location,
      airportName,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.createTerminalEcho({
        userId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
        textMessage: value.textMessage,
        location: value.location,
        airportName: value.airportName,
      });
      return res.status(201).json({
        message: "Terminal echo created.",
        insertedId: result.insertedId,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }

  static async search(req: Request, res: Response) {
    const { airportName } = req.query;

    const schema = Joi.object({
      airportName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({ airportName });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const echoes = await TerminalEchoSvc.findByAirportName(
        value.airportName as string
      );
      return res.json({ data: echoes });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  static async incrementListen(req: Request, res: Response) {
    const { id } = req.params;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ id });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.incrementListen(value.id);
      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  static async updateReaction(req: Request, res: Response) {
    const { id } = req.params;
    const { reaction, action } = req.body;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
      reaction: Joi.string()
        .valid("like", "love", "haha", "wow", "sad", "angry")
        .required(),
      action: Joi.string().valid("increment", "decrement").required(),
    });

    const { error, value } = schema.validate({ id, reaction, action });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.updateReaction({
        terminalEchoId: value.id,
        reaction: value.reaction,
        action: value.action,
      });
      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }
}

