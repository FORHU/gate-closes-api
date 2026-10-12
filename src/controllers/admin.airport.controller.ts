import { Request, Response } from "express";
import Joi from "joi";
import AirportSvc, { AirportNotFoundError } from "../services/airport.service";

/** Smallest and largest radius an admin can set, in km. */
export const RADIUS_LIMITS_KM = { min: 0.5, max: 30 } as const;

export default class AdminAirportCtrl {
  /**
   * `GET /admin/airports?q=MNL&page=1&limit=10`: one page of airports by code
   * or name (exact code first; manual radii first), plus totals so the client
   * can render page controls without fetching everything.
   */
  static async list(req: Request, res: Response) {
    const { error, value } = Joi.object({
      q: Joi.string().trim().max(100).allow("").default(""),
      page: Joi.number().integer().min(1).max(10_000).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
    }).validate(req.query);
    if (error) return res.status(400).json({ message: error.message });
    try {
      const { airports, total } = await AirportSvc.listForAdmin(value);
      return res.json({
        data: airports,
        pagination: {
          page: value.page,
          limit: value.limit,
          total,
          totalPages: Math.ceil(total / value.limit),
        },
      });
    } catch {
      return res.status(500).json({ message: "Server error." });
    }
  }

  /**
   * `PATCH /admin/airports/:id/radius` with `{radiusKm}`: sets this airport's
   * radius, or `{radiusKm: null}` to go back to the default for its type.
   */
  static async setRadius(req: Request, res: Response) {
    const { error, value } = Joi.object({
      id: Joi.string().hex().length(24).required(),
      radiusKm: Joi.number()
        .min(RADIUS_LIMITS_KM.min)
        .max(RADIUS_LIMITS_KM.max)
        .allow(null)
        .required(),
    }).validate({ id: req.params.id, radiusKm: req.body?.radiusKm });
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.json({ data: await AirportSvc.setRadius(value.id, value.radiusKm) });
    } catch (err) {
      if (err instanceof AirportNotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      return res.status(400).json({ message: (err as Error).message });
    }
  }
}
