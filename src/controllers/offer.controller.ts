import { Request, Response } from "express";
import Joi from "joi";
import OfferSvc, { OfferClaimError, OfferNotFoundError } from "../services/offer.service";
import { ALL_AIRPORTS, OFFER_PLACEMENTS, OFFER_STATUSES } from "../models/offer.model";

const objectId = Joi.string().hex().length(24);
const iata = Joi.string()
  .trim()
  .pattern(/^[A-Za-z0-9]{3}$/)
  .message("Airport must be a 3-letter code.");

/** Every field an admin can set; `create` requires the first few. */
const offerFields = {
  // Free text so new kinds need no deploy: "ad", "voucher", "lounge"...
  kind: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z][a-z0-9_-]{0,31}$/)
    .message("Kind: lowercase letters, digits, - or _, up to 32."),
  title: Joi.string().trim().min(1).max(120),
  body: Joi.string().max(2000).allow("", null),
  imageUrl: Joi.string().uri().allow(null),
  ctaLabel: Joi.string().max(40).allow("", null),
  ctaUrl: Joi.string().uri().allow(null),
  airports: Joi.array()
    .items(Joi.alternatives(iata, Joi.string().valid(ALL_AIRPORTS)))
    .min(1)
    .max(500),
  placements: Joi.array()
    .items(Joi.string().valid(...OFFER_PLACEMENTS))
    .min(1)
    .unique(),
  status: Joi.string().valid(...OFFER_STATUSES),
  startsAt: Joi.date().iso().allow(null),
  endsAt: Joi.date()
    .iso()
    .allow(null)
    .when("startsAt", {
      is: Joi.date().required(),
      then: Joi.date().greater(Joi.ref("startsAt")),
    }),
  weight: Joi.number().min(0).max(1000),
  data: Joi.object().unknown(true),
  reward: Joi.object().unknown(true),
  limits: Joi.object({
    maxClaims: Joi.number().integer().min(0).allow(null),
    maxClaimsPerUser: Joi.number().integer().min(0).allow(null),
  }),
};

const createSchema = Joi.object(offerFields).fork(["kind", "title", "airports"], (f) =>
  f.required()
);
const updateSchema = Joi.object(offerFields).min(1);

function fail(res: Response, err: unknown) {
  if (err instanceof OfferNotFoundError) return res.status(404).json({ message: err.message });
  if (err instanceof OfferClaimError) return res.status(409).json({ message: err.message });
  const message = err instanceof Error ? err.message : "Server error.";
  return res.status(500).json({ message });
}

export default class OfferCtrl {
  // --- App ----------------------------------------------------------------

  /** `GET /offers?airport=MNL`: pin offers as GeoJSON plus one card offer. */
  static async forAirport(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { error, value } = iata.required().validate(req.query.airport);
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.json({ data: await OfferSvc.forAirport(value, userId) });
    } catch (err) {
      return fail(res, err);
    }
  }

  /** `POST /offers/:id/events` with `{type: "view"|"click", airport?}`. */
  static async track(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { error, value } = Joi.object({
      id: objectId.required(),
      type: Joi.string().valid("view", "click").required(),
      airport: iata.optional(),
    }).validate({ id: req.params.id, ...req.body });
    if (error) return res.status(400).json({ message: error.message });
    try {
      await OfferSvc.track({
        offerId: value.id,
        userId,
        type: value.type,
        airportIata: value.airport,
      });
      return res.status(204).end();
    } catch (err) {
      return fail(res, err);
    }
  }

  /** `POST /offers/:id/claim`: 409 when sold out or already claimed. */
  static async claim(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { error, value } = Joi.object({
      id: objectId.required(),
      airport: iata.optional(),
    }).validate({ id: req.params.id, ...req.body });
    if (error) return res.status(400).json({ message: error.message });
    try {
      const data = await OfferSvc.claim({
        offerId: value.id,
        userId,
        airportIata: value.airport,
      });
      return res.json({ data });
    } catch (err) {
      return fail(res, err);
    }
  }

  // --- Admin --------------------------------------------------------------

  static async adminList(req: Request, res: Response) {
    const { error, value } = Joi.object({
      status: Joi.string().valid(...OFFER_STATUSES),
      kind: offerFields.kind,
      airport: iata,
    }).validate(req.query);
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.json({ data: await OfferSvc.list(value) });
    } catch (err) {
      return fail(res, err);
    }
  }

  static async adminGet(req: Request, res: Response) {
    const { error } = objectId.required().validate(req.params.id);
    if (error) return res.status(400).json({ message: "Invalid offer id." });
    try {
      return res.json({ data: await OfferSvc.get(req.params.id) });
    } catch (err) {
      return fail(res, err);
    }
  }

  static async adminCreate(req: Request, res: Response) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    try {
      const offer = await OfferSvc.create(value, req.user?.userId as string);
      return res.status(201).json({ data: offer });
    } catch (err) {
      return fail(res, err);
    }
  }

  static async adminUpdate(req: Request, res: Response) {
    if (objectId.validate(req.params.id).error) {
      return res.status(400).json({ message: "Invalid offer id." });
    }
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.json({ data: await OfferSvc.update(req.params.id, value) });
    } catch (err) {
      return fail(res, err);
    }
  }

  static async adminDelete(req: Request, res: Response) {
    if (objectId.validate(req.params.id).error) {
      return res.status(400).json({ message: "Invalid offer id." });
    }
    try {
      await OfferSvc.remove(req.params.id);
      return res.status(204).end();
    } catch (err) {
      return fail(res, err);
    }
  }

  static async adminStats(req: Request, res: Response) {
    const { error, value } = Joi.object({
      id: objectId.required(),
      days: Joi.number().integer().min(1).max(365).default(30),
    }).validate({ id: req.params.id, days: req.query.days });
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.json({ data: await OfferSvc.stats(value.id, value.days) });
    } catch (err) {
      return fail(res, err);
    }
  }
}
