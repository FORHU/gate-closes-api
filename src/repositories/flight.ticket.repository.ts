import { Document, ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MFlightTicket, TFlightTicket } from "../models/flight.ticket.model";

export default class FlightTicketRepo {
  static collection() {
    return getDB().collection("flightTicket");
  }

  static async create(ticket: TFlightTicket) {
    return this.collection().insertOne(new MFlightTicket(ticket));
  }

  static async findActiveOrLatestByUserId(userId: ObjectId) {
    const now = new Date();

    const upcoming = await this.collection().findOne(
      { userId, departureDateTime: { $gte: now } },
      { sort: { departureDateTime: 1 } }
    );
    if (upcoming) return upcoming;

    const latest = await this.collection().findOne(
      { userId },
      { sort: { departureDateTime: -1 } }
    );
    return latest ?? null;
  }

  /**
   * Batch version of findActiveOrLatestByUserId:
   * - Prefer the soonest upcoming departureDateTime (>= now) per user
   * - Otherwise fallback to latest (max departureDateTime) per user
   */
  static async findActiveOrLatestByUserIds(userIds: ObjectId[]) {
    if (!userIds?.length) return new Map<string, Document>();

    const now = new Date();

    const upcoming = await this.collection()
      .aggregate([
        {
          $match: {
            userId: { $in: userIds },
            departureDateTime: { $gte: now },
          },
        },
        { $sort: { userId: 1, departureDateTime: 1, _id: 1 } },
        {
          $group: {
            _id: "$userId",
            ticket: { $first: "$$ROOT" },
          },
        },
      ])
      .toArray();

    const latest = await this.collection()
      .aggregate([
        { $match: { userId: { $in: userIds } } },
        { $sort: { userId: 1, departureDateTime: -1, _id: -1 } },
        {
          $group: {
            _id: "$userId",
            ticket: { $first: "$$ROOT" },
          },
        },
      ])
      .toArray();

    const map = new Map<string, Document>();
    for (const row of latest) {
      map.set(String(row._id), row.ticket);
    }
    for (const row of upcoming) {
      map.set(String(row._id), row.ticket);
    }
    return map;
  }

  static async findUserIdsByFlight(params: {flightNumber: string; departureDateTime: Date; excludeUserId?: ObjectId; }): Promise<ObjectId[]> {
    const { flightNumber, departureDateTime, excludeUserId } = params;

    const filter: Record<string, unknown> = { flightNumber, departureDateTime };
    if (excludeUserId) filter.userId = { $ne: excludeUserId };

    const docs = await this.collection()
      .find(filter, { projection: { userId: 1 } })
      .toArray();

    const seen = new Set<string>();
    const ids: ObjectId[] = [];
    for (const d of docs) {
      const id = d.userId as ObjectId | undefined;
      if (!id) continue;
      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(id);
    }
    return ids;
  }

  static async userHasFlight(params: {userId: ObjectId; flightNumber: string; departureDateTime: Date}): Promise<boolean> {
    const { userId, flightNumber, departureDateTime } = params;
    const doc = await this.collection().findOne(
      { userId, flightNumber, departureDateTime },
      { projection: { _id: 1 } }
    );
    return !!doc;
  }

  static async userHasSameDestination(params: {userId: ObjectId; toCity: string}): Promise<boolean> {
    const { userId, toCity } = params;
    const doc = await this.collection().findOne(
      { userId, toCity },
      { projection: { _id: 1 } }
    );
    return !!doc;
  }

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }

static async updateByUserId(userId: ObjectId, updateData: Record<string, unknown>) {

  const dataToUpdate = {
    ...updateData,
    updatedAt: new Date()
  };

  const result = await this.collection().findOneAndUpdate(
    { userId },
    { $set: dataToUpdate },
    { returnDocument: "after" } 
  );

  return result;
}

}

