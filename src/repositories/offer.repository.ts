import { ObjectId } from "mongodb";
import {
  ALL_AIRPORTS,
  MOffer,
  OfferEventType,
  OfferStatus,
  TOffer,
  TOfferEvent,
  TOfferUpdateOptions,
} from "../models/offer.model";
import { getDB } from "../utils/mongo";

const STAT_FIELD: Record<OfferEventType, string> = {
  view: "stats.views",
  click: "stats.clicks",
  claim: "stats.claims",
};

export default class OfferRepo {
  static collection() {
    return getDB().collection<TOffer>("offer");
  }

  static eventCollection() {
    return getDB().collection<TOfferEvent>("offer.event");
  }

  static async create(offer: TOffer) {
    const doc = new MOffer(offer);
    await this.collection().insertOne(doc);
    return doc;
  }

  static async findById(id: string | ObjectId) {
    return this.collection().findOne({ _id: new ObjectId(id) });
  }

  /** Admin list, newest first. */
  static async list(filter: { status?: OfferStatus; kind?: string; airport?: string } = {}) {
    const match: Record<string, unknown> = {};
    if (filter.status) match.status = filter.status;
    if (filter.kind) match.kind = filter.kind;
    if (filter.airport) match.airports = { $in: [filter.airport.toUpperCase(), ALL_AIRPORTS] };
    return this.collection().find(match).sort({ createdAt: -1 }).limit(500).toArray();
  }

  static async update(id: string | ObjectId, fields: TOfferUpdateOptions) {
    return this.collection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...fields, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  }

  static async delete(id: string | ObjectId) {
    const result = await this.collection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  /** Active, in-date offers for one airport (or every airport). */
  static async findLiveForAirport(airportIata: string, now = new Date()) {
    return this.collection()
      .find({
        status: "active",
        airports: { $in: [airportIata.toUpperCase(), ALL_AIRPORTS] },
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        ],
      })
      .limit(200)
      .toArray();
  }

  static async incrementStat(id: ObjectId, type: OfferEventType) {
    await this.collection().updateOne({ _id: id }, { $inc: { [STAT_FIELD[type]]: 1 } });
  }

  /**
   * Takes one claim if any are left: the count check and the increment are
   * one atomic update, so two people can't take the last voucher.
   */
  static async takeClaim(id: ObjectId) {
    const result = await this.collection().updateOne(
      {
        _id: id,
        $or: [
          { "limits.maxClaims": null },
          { "limits.maxClaims": { $exists: false } },
          { $expr: { $lt: ["$stats.claims", "$limits.maxClaims"] } },
        ],
      },
      { $inc: { "stats.claims": 1 } }
    );
    return result.modifiedCount === 1;
  }

  static async insertEvent(event: TOfferEvent) {
    await this.eventCollection().insertOne(event);
  }

  static async countUserEvents(offerId: ObjectId, userId: ObjectId, type: OfferEventType) {
    return this.eventCollection().countDocuments({ offerId, userId, type });
  }

  /** Events per day and type, for an offer's stats page. */
  static async dailyStats(offerId: ObjectId, since: Date) {
    const rows = await this.eventCollection()
      .aggregate<{ _id: { day: string; type: OfferEventType }; count: number }>([
        { $match: { offerId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: "$type",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.day": 1 } },
      ])
      .toArray();
    return rows.map((r) => ({ day: r._id.day, type: r._id.type, count: r.count }));
  }
}
