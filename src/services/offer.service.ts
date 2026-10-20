import { ObjectId, WithId } from "mongodb";
import OfferRepo from "../repositories/offer.repository";
import AirportRepo from "../repositories/airport.repository";
import type { OfferEventType, TOffer, TOfferUpdateOptions } from "../models/offer.model";

export class OfferNotFoundError extends Error {
  constructor() {
    super("Offer not found.");
    this.name = "OfferNotFoundError";
  }
}

/** A claim refused: offer not live, sold out, or the user's limit reached. */
export class OfferClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferClaimError";
  }
}

/** What the app sees: no stats, limits or reward. */
export type PublicOffer = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  data: Record<string, unknown>;
  endsAt: Date | null;
  /** Has a reward to claim (e.g. a voucher code); the reward itself stays hidden. */
  claimable: boolean;
};

/** Pins stay inside this share of the airport radius, clear of its edge. */
const PIN_RADIUS_SHARE = 0.8;
const KM_PER_DEGREE = 111.32;

function toPublic(o: WithId<TOffer>): PublicOffer {
  return {
    id: o._id.toHexString(),
    kind: o.kind,
    title: o.title,
    body: o.body ?? null,
    imageUrl: o.imageUrl ?? null,
    ctaLabel: o.ctaLabel ?? null,
    ctaUrl: o.ctaUrl ?? null,
    data: o.data ?? {},
    endsAt: o.endsAt ?? null,
    claimable: Object.keys(o.reward ?? {}).length > 0,
  };
}

function isLive(o: TOffer, now: Date) {
  return (
    o.status === "active" && (!o.startsAt || o.startsAt <= now) && (!o.endsAt || o.endsAt > now)
  );
}

/** 32-bit FNV-1a: a stable seed from a string. */
function hashSeed(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small seeded random in [0, 1). */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random spot inside the airport radius, the same all day for one user
 * and offer (so the pin doesn't jump while they pan), different per user
 * and per day. Uniform over the disc: radius ∝ √u.
 */
export function randomPinPoint(params: {
  center: [number, number];
  radiusKm: number;
  offerId: string;
  userId: string;
  day: string;
}): [number, number] {
  const rand = seededRandom(hashSeed(`${params.offerId}|${params.userId}|${params.day}`));
  const r = params.radiusKm * PIN_RADIUS_SHARE * Math.sqrt(rand());
  const theta = 2 * Math.PI * rand();
  const [lng, lat] = params.center;
  const dLat = (r * Math.cos(theta)) / KM_PER_DEGREE;
  const dLng = (r * Math.sin(theta)) / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return [round(lng + dLng), round(lat + dLat)];
}

/** One offer, each picked in proportion to its weight. */
export function pickWeighted<T extends { weight: number }>(items: T[], rand = Math.random) {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
  if (total <= 0) return null;
  let x = rand() * total;
  for (const item of items) {
    x -= Math.max(0, item.weight);
    if (x < 0) return item;
  }
  return items[items.length - 1];
}

export default class OfferSvc {
  static toPublic = toPublic;

  /**
   * Offers at one airport: every pin offer as a GeoJSON point at its random
   * spot, and one card offer picked by weight (new pick each call).
   */
  static async forAirport(
    airportIata: string,
    userId: string,
    { now = new Date(), rand = Math.random }: { now?: Date; rand?: () => number } = {}
  ) {
    const iata = airportIata.toUpperCase();
    const empty = { card: null, pins: { type: "FeatureCollection" as const, features: [] } };
    const airport = await AirportRepo.findByIata(iata);
    const center = airport?.location?.coordinates as [number, number] | undefined;
    if (!center) return empty;

    const offers = await OfferRepo.findLiveForAirport(iata, now);
    const day = now.toISOString().slice(0, 10);
    const radiusKm = Number(airport?.radiusKm) || 1;

    const features = offers
      .filter((o) => o.placements.includes("pin"))
      .map((o) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: randomPinPoint({
            center,
            radiusKm,
            offerId: o._id.toHexString(),
            userId,
            day,
          }),
        },
        properties: { ...toPublic(o), airportIata: iata },
      }));

    const card = pickWeighted(
      offers.filter((o) => o.placements.includes("card")),
      rand
    );
    return {
      card: card ? toPublic(card) : null,
      pins: { type: "FeatureCollection" as const, features },
    };
  }

  /** Records a view or click; claims go through [claim]. */
  static async track(params: {
    offerId: string;
    userId: string;
    type: Exclude<OfferEventType, "claim">;
    airportIata?: string | null;
  }) {
    const offer = await OfferRepo.findById(params.offerId);
    if (!offer) throw new OfferNotFoundError();
    await OfferRepo.incrementStat(offer._id, params.type);
    await OfferRepo.insertEvent({
      offerId: offer._id,
      userId: new ObjectId(params.userId),
      type: params.type,
      airportIata: params.airportIata?.toUpperCase() ?? null,
      createdAt: new Date(),
    });
  }

  /** Claims a voucher-like offer and reveals its `reward`. */
  static async claim(params: {
    offerId: string;
    userId: string;
    airportIata?: string | null;
    now?: Date;
  }) {
    const offer = await OfferRepo.findById(params.offerId);
    if (!offer) throw new OfferNotFoundError();
    if (!isLive(offer, params.now ?? new Date())) {
      throw new OfferClaimError("This offer is no longer available.");
    }
    const userId = new ObjectId(params.userId);
    const perUser = offer.limits?.maxClaimsPerUser;
    if (perUser != null) {
      const used = await OfferRepo.countUserEvents(offer._id, userId, "claim");
      if (used >= perUser) throw new OfferClaimError("You already claimed this offer.");
    }
    if (!(await OfferRepo.takeClaim(offer._id))) {
      throw new OfferClaimError("This offer has run out.");
    }
    await OfferRepo.insertEvent({
      offerId: offer._id,
      userId,
      type: "claim",
      airportIata: params.airportIata?.toUpperCase() ?? null,
      createdAt: new Date(),
    });
    return { offer: toPublic(offer), reward: offer.reward ?? {} };
  }

  // --- Admin --------------------------------------------------------------

  static async list(filter: Parameters<typeof OfferRepo.list>[0]) {
    return OfferRepo.list(filter);
  }

  static async create(fields: TOffer, adminId: string) {
    return OfferRepo.create({
      ...fields,
      airports: fields.airports.map((a) => a.toUpperCase()),
      createdBy: new ObjectId(adminId),
    });
  }

  static async update(id: string, fields: TOfferUpdateOptions) {
    const next = fields.airports
      ? { ...fields, airports: fields.airports.map((a) => a.toUpperCase()) }
      : fields;
    const updated = await OfferRepo.update(id, next);
    if (!updated) throw new OfferNotFoundError();
    return updated;
  }

  static async remove(id: string) {
    if (!(await OfferRepo.delete(id))) throw new OfferNotFoundError();
  }

  static async get(id: string) {
    const offer = await OfferRepo.findById(id);
    if (!offer) throw new OfferNotFoundError();
    return offer;
  }

  /** Totals plus per-day views/clicks/claims for the last [days] days. */
  static async stats(id: string, days = 30) {
    const offer = await this.get(id);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return {
      totals: offer.stats ?? { views: 0, clicks: 0, claims: 0 },
      daily: await OfferRepo.dailyStats(offer._id, since),
    };
  }
}
