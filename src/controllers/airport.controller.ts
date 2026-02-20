import { Request, Response } from "express";
import Joi from "joi";

const {
  getAirportByIata,
  getAirportByIcao,
  searchByName,
  findNearbyAirports,
} = require("airport-data-js");

export default class AirportCtrl {
  // GET /airports/iata/:code
  static async getByIata(req: Request, res: Response) {
    const { code } = req.params;

    const schema = Joi.object({
      code: Joi.string().length(3).required(),
    });

    const { error } = schema.validate({ code });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const airports = await getAirportByIata(code.toUpperCase());
      return res.json({ data: airports });
    } catch (error) {
      return res.status(500).json({ message: error });
    }
  }

  // GET /airports/icao/:code
  static async getByIcao(req: Request, res: Response) {
    const { code } = req.params;

    const schema = Joi.object({
      code: Joi.string().length(4).required(),
    });

    const { error } = schema.validate({ code });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const airports = await getAirportByIcao(code.toUpperCase());
      return res.json({ data: airports });
    } catch (error) {
      return res.status(500).json({ message: error });
    }
  }

  // GET /airports/search?name=Singapore
  static async searchByName(req: Request, res: Response) {
    const { name } = req.query;

    const schema = Joi.object({
      name: Joi.string().required(),
    });

    const { error } = schema.validate({ name });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const airports = await searchByName(name as string);
      return res.json({ data: airports });
    } catch (error) {
      return res.status(500).json({ message: error });
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
      const airports = await findNearbyAirports(
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
