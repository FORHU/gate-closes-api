import { ObjectId } from "mongodb";

/**
 * Something promoted to people at an airport: an ad, a voucher, a lounge
 * pass... `kind` is free text so the admin can add new kinds without a
 * deploy; per-kind fields live in `data` (e.g. a voucher's code).
 */
export const OFFER_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Where an offer appears: a pin at a random spot inside the airport radius, the airport sheet's card slot, or both. */
export const OFFER_PLACEMENTS = ["pin", "card"] as const;
export type OfferPlacement = (typeof OFFER_PLACEMENTS)[number];

/** Every airport, instead of a list of codes. */
export const ALL_AIRPORTS = "*";

export type TOfferLimits = {
  /** Claims across everyone (vouchers); null = unlimited. */
  maxClaims?: number | null;
  /** Claims per user; null = unlimited. */
  maxClaimsPerUser?: number | null;
};

export type TOfferStats = {
  views: number;
  clicks: number;
  claims: number;
};

export type TOffer = {
  _id?: ObjectId;
  kind: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  /** IATA codes, uppercase; `["*"]` for every airport. */
  airports: string[];
  placements: OfferPlacement[];
  status: OfferStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  /** Relative chance of being picked against other offers at the same airport. */
  weight: number;
  /** Per-kind fields shown to everyone (e.g. a voucher's discount). */
  data?: Record<string, unknown>;
  /** Per-kind fields shown only to whoever claims it (e.g. a voucher code). */
  reward?: Record<string, unknown>;
  limits?: TOfferLimits;
  stats?: TOfferStats;
  createdBy?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TOfferUpdateOptions = Partial<
  Omit<TOffer, "_id" | "stats" | "createdBy" | "createdAt" | "updatedAt">
>;

export class MOffer implements TOffer {
  _id: ObjectId;
  kind: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  airports: string[];
  placements: OfferPlacement[];
  status: OfferStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  weight: number;
  data: Record<string, unknown>;
  reward: Record<string, unknown>;
  limits: TOfferLimits;
  stats: TOfferStats;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    kind,
    title,
    body = null,
    imageUrl = null,
    ctaLabel = null,
    ctaUrl = null,
    airports,
    placements = ["pin", "card"],
    status = "draft",
    startsAt = null,
    endsAt = null,
    weight = 1,
    data = {},
    reward = {},
    limits = {},
    stats = { views: 0, clicks: 0, claims: 0 },
    createdBy,
    createdAt = new Date(),
    updatedAt,
  }: TOffer) {
    this._id = _id;
    this.kind = kind;
    this.title = title;
    this.body = body;
    this.imageUrl = imageUrl;
    this.ctaLabel = ctaLabel;
    this.ctaUrl = ctaUrl;
    this.airports = airports;
    this.placements = placements;
    this.status = status;
    this.startsAt = startsAt;
    this.endsAt = endsAt;
    this.weight = weight;
    this.data = data;
    this.reward = reward;
    this.limits = limits;
    this.stats = stats;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export const OFFER_EVENT_TYPES = ["view", "click", "claim"] as const;
export type OfferEventType = (typeof OFFER_EVENT_TYPES)[number];

/** One view/click/claim, for stats and per-user claim limits. */
export type TOfferEvent = {
  _id?: ObjectId;
  offerId: ObjectId;
  userId: ObjectId;
  type: OfferEventType;
  airportIata?: string | null;
  createdAt: Date;
};
