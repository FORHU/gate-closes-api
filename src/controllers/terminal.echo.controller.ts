import { Request, Response } from "express";
import Joi from "joi";
import type { TerminalEchoMapBounds } from "../const";
import TerminalEchoSvc from "../services/terminal.echo.service";

export default class TerminalEchoCtrl {
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { fileUrl, fileName, textMessage, location, airportName } = req.body;

    const locationSchema = Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    });

    const schema = Joi.object({
      fileUrl: Joi.string().uri().required(),
      fileName: Joi.string().min(1).required(),
      textMessage: Joi.string().optional().allow(""),
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
      const userId = req.user?.userId as string | undefined;
      const echoes = await TerminalEchoSvc.findByAirportName(
        value.airportName as string,
        userId
      );
      return res.json({ data: echoes });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  static async getMap(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const q = req.query;
    const boundsKeys = ["west", "south", "east", "north"] as const;
    const anyBoundsParam = boundsKeys.some(
      (k) => q[k] !== undefined && String(q[k]).length > 0
    );

    let mapBounds: TerminalEchoMapBounds | undefined;
    if (anyBoundsParam) {
      const boundsSchema = Joi.object({
        west: Joi.number().min(-180).max(180).required(),
        south: Joi.number().min(-90).max(90).required(),
        east: Joi.number().min(-180).max(180).required(),
        north: Joi.number().min(-90).max(90).required(),
      }).custom((v, helpers) => {
        if (v.west > v.east) {
          return helpers.error("any.invalid");
        }
        if (v.south > v.north) {
          return helpers.error("any.invalid");
        }
        return v;
      });

      const { error, value } = boundsSchema.validate(
        {
          west: q.west,
          south: q.south,
          east: q.east,
          north: q.north,
        },
        { convert: true, abortEarly: false }
      );

      if (error) {
        const msg = error.details[0]?.message ?? error.message;
        return res.status(400).json({
          message:
            msg.includes("invalid")
              ? "Bounds must satisfy west ≤ east and south ≤ north."
              : msg,
        });
      }

      mapBounds = [
        [value.west, value.south],
        [value.east, value.north],
      ];
    }

    try {
      const geojson = await TerminalEchoSvc.findAllWithTypeAsGeoJson( userId, mapBounds );
      return res.json({ data: geojson });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  static async getById(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { id } = req.params;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ id });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const echo = await TerminalEchoSvc.findOneWithType(userId, value.id);
      if (!echo) {
        return res.status(404).json({ message: "Terminal echo not found." });
      }
      return res.json({ data: { properties: echo } });
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
    const userId = req.user?.userId as string;

    const { id } = req.params;
    const { reaction } = req.body;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
      reaction: Joi.string()
        .valid("like", "love", "haha", "wow", "sad", "angry")
        .required(),
    });

    const { error, value } = schema.validate({ id, reaction });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoSvc.updateReaction({
        terminalEchoId: value.id,
        reaction: value.reaction,
        userId,
      });
      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }
}

