import { Request, Response } from "express";
import Joi from "joi";
import AirportSvc from "../services/airport.service";
    
export default class AirportCtrl {

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
}
