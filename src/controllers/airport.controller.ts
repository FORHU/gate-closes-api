import { Request, Response } from "express";
import Joi from "joi";
import AirportSvc from "../services/airport.service";
import { getErrorMessage } from "../utils/error.util";
    
export default class AirportCtrl {

  // GET /airport/search?q=ninoy
  static async searchByName(req: Request, res: Response) {
    const { q } = req.query;

    const schema = Joi.object({
      q: Joi.string().trim().min(1).required(),
    });

    const { error, value } = schema.validate({ q });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const results = await AirportSvc.searchByName(value.q);
      return res.json({ data: results });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
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
    } catch (error) {
      return res.status(500).json({ message: getErrorMessage(error) });
    }
  }

  // GET /airport/check-inside-airport-boundary?lat=14.5995&lng=120.9842
  static async checkInsideAirportByBoundary(req: Request, res: Response) {
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
      const result = await AirportSvc.checkInsideAirportByBoundary({
        lat: Number(lat),
        lng: Number(lng),
      });

      if (!result) {
        return res.status(404).json({ message: "No airport boundary contains this point." });
      }

      return res.json({ data: result });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
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
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  // POST /airport/boundary/sync
  static async syncBoundaries(req: Request, res: Response) {
    const { force } = req.body ?? {};

    const schema = Joi.object({
      force: Joi.boolean().optional(),
    });

    const { error, value } = schema.validate(
      { force },
      { convert: true }
    );

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await AirportSvc.syncBoundaries({
        force: value.force ?? false,
      });

      return res.json({
        message: "Airport boundary sync completed.",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  // POST /airport/crawl
  static async crawl(req: Request, res: Response) {
    try {
      const result = await AirportSvc.crawlFromAssetFile();
      return res.json({
        message: "Airport crawl completed.",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  // GET /airport/geojson
  static async getAllAsGeoJson(req: Request, res: Response) {
    try {
      const geojson = await AirportSvc.getAllAsGeoJson();
      return res.json({ data: geojson });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }
}
