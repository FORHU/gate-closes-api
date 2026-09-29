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

  static async findByIdempotencyKey(userId: ObjectId, idempotencyKey: string) {
    return this.collection().findOne({ userId, idempotencyKey });
  }

  static async findExistingTicket(params: {
    userId: ObjectId;
    flightNumber?: string;
    fromAirport?: string;
    toAirport?: string;
    departureDateTime?: Date;
  }) {
    const { userId, flightNumber, fromAirport, toAirport, departureDateTime } = params;
    if (!flightNumber || !fromAirport || !toAirport || !departureDateTime) return null;

    const startOfDay = new Date(departureDateTime);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(departureDateTime);
    endOfDay.setUTCHours(23, 59, 59, 999);

    return this.collection().findOne({
      userId,
      flightNumber,
      fromAirport,
      toAirport,
      departureDateTime: { $gte: startOfDay, $lte: endOfDay },
    });
  }

  static async findActiveOrLatestByUserId(userId: ObjectId) {
    const now = new Date();

    // 1. In-transit check: user has departed and has not yet completed arrival (+1h dwell)
    const inTransit = await this.collection().findOne(
      {
        userId,
        departureDateTime: { $lte: now },
        $or: [
          { arrivalDateTime: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } },
          {
            arrivalDateTime: { $exists: false },
            departureDateTime: { $gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
          },
        ],
      },
      { sort: { departureDateTime: -1 } }
    );
    if (inTransit) return inTransit;

    // 2. Upcoming flight: soonest future departure
    const upcoming = await this.collection().findOne(
      { userId, departureDateTime: { $gte: now } },
      { sort: { departureDateTime: 1 } }
    );
    if (upcoming) return upcoming;

    // 3. Historical fallback: latest past flight
    const latest = await this.collection().findOne({ userId }, { sort: { departureDateTime: -1 } });
    return latest ?? null;
  }

  /**
   * Batch version of findActiveOrLatestByUserId:
   * - Priority 1: In-transit flight (departed, within arrival window)
   * - Priority 2: Soonest upcoming departureDateTime (>= now)
   * - Priority 3: Fallback to latest (max departureDateTime)
   */
  static async findActiveOrLatestByUserIds(userIds: ObjectId[]) {
    if (!userIds?.length) return new Map<string, Document>();

    const now = new Date();

    const inTransit = await this.collection()
      .aggregate([
        {
          $match: {
            userId: { $in: userIds },
            departureDateTime: { $lte: now },
            $or: [
              { arrivalDateTime: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } },
              {
                arrivalDateTime: { $exists: false },
                departureDateTime: { $gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
              },
            ],
          },
        },
        { $sort: { userId: 1, departureDateTime: -1, _id: -1 } },
        {
          $group: {
            _id: "$userId",
            ticket: { $first: "$$ROOT" },
          },
        },
      ])
      .toArray();

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
    for (const row of inTransit) {
      map.set(String(row._id), row.ticket);
    }
    return map;
  }

  static async findUserIdsByFlight(params: {
    flightNumber: string;
    departureDateTime: Date;
    excludeUserId?: ObjectId;
  }): Promise<ObjectId[]> {
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

  static async userHasSameDestination(params: {
    userId: ObjectId;
    toAirport: string;
  }): Promise<boolean> {
    const { userId, toAirport } = params;
    const doc = await this.collection().findOne({ userId, toAirport }, { projection: { _id: 1 } });
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
      updatedAt: new Date(),
    };

    const result = await this.collection().findOneAndUpdate(
      { userId },
      { $set: dataToUpdate },
      { returnDocument: "after" }
    );

    return result;
  }

  // Deletes ALL tickets for the user, not just the active/latest one —
  // findActiveOrLatestByUserId doesn't distinguish, so leaving older rows
  // behind would let a stale one resurface as "latest" once the current
  // one is gone.
  static async deleteAllByUserId(userId: ObjectId) {
    return this.collection().deleteMany({ userId });
  }
}
