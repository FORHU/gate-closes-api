import { Request, Response } from "express";
import Joi from "joi";
import AirportSvc from "../services/airport.service";
    
export default class AirportCtrl {

  // GET /airports/search?q=ninoy&limit=10
  static async search(req: Request, res: Response) {
    const { q, limit } = req.query;

    const schema = Joi.object({
      q: Joi.string().trim().min(1).required(),
      limit: Joi.number().integer().min(1).max(50).optional(),
    });

    const { error, value } = schema.validate(
      { q, limit: limit !== undefined ? Number(limit) : undefined },
      { convert: true }
    );
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const results = await AirportSvc.search(value.q, value.limit ?? 10);
      return res.json({ data: results });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }

  // GET /airports/nearby?lat=1.35&lng=103.99&radius=50
  static async findNearby(req: Request, res: Response) {
    const { lat, lng, radius } = req.query;

    const schema = Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      radius: Joi.number().required(),
    });

    const { error } = schema.validate({
      lat: Number(lat),
      lng: Number(lng),
      radius: Number(radius),
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const airports = await AirportSvc.findNearbyAndStore(
        Number(lat),
        Number(lng),
        Number(radius)
      );
      return res.json({ data: airports });
    } catch (error) {
      return res.status(500).json({ message: error });
    }
  }

  // GET /airport/check-inside-airport?lat=14.5995&lng=120.9842
  static async checkInsideAirport(req: Request, res: Response) {
    const { lat, lng } = req.query;

    const schema = Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    });

    const { error } = schema.validate({
      lat: Number(lat),
      lng: Number(lng),
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const nearest = await AirportSvc.checkInsideAirport({
        lat: Number(lat),
        lng: Number(lng),
      });
      return res.json({ data: nearest });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message ?? error });
    }
  }

  // GET /airport/check-inside-specific?airportName=NAIA%20Terminal%201&lat=14.5995&lng=120.9842
  static async checkInsideSpecificAirport(req: Request, res: Response) {
    const { airportName, lat, lng } = req.query;

    const schema = Joi.object({
      airportName: Joi.string().min(1).required(),
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    });

    const { error } = schema.validate({
      airportName,
      lat: Number(lat),
      lng: Number(lng),
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await AirportSvc.checkInsideSpecificAirport({
        airportName: String(airportName),
        lat: Number(lat),
        lng: Number(lng),
      });
      return res.json({ data: result });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}
