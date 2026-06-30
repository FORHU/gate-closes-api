import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MFlightTicket, TFlightTicket } from "../models/flight.ticket.model";

export default class FlightTicketRepo {
  static collection() {
    return getDB().collection("flightTicket");
  }

  static async create(ticket: TFlightTicket) {
    return this.collection().insertOne(new MFlightTicket(ticket));
  }

  // FIXED: Sort by updatedAt instead of departureDateTime
  // This ensures we return the most recently updated record
  static async findActiveOrLatestByUserId(userId: ObjectId) {
    const latest = await this.collection().findOne(
      { userId },
      { sort: { updatedAt: -1, createdAt: -1 } }
    );
    return (latest as any) ?? null;
  }

  static async findActiveOrLatestByUserIds(userIds: ObjectId[]) {
    if (!userIds?.length) return new Map<string, any>();

    const latest = await this.collection()
      .aggregate([
        { $match: { userId: { $in: userIds } } },
        { $sort: { userId: 1, updatedAt: -1, createdAt: -1 } },
        {
          $group: {
            _id: "$userId",
            ticket: { $first: "$$ROOT" },
          },
        },
      ])
      .toArray();

    const map = new Map<string, any>();
    for (const row of latest as any[]) {
      map.set(String(row._id), row.ticket);
    }
    return map;
  }

  static async findUserIdsByFlight(params: {flightNumber: string; departureDateTime: Date; excludeUserId?: ObjectId; }): Promise<ObjectId[]> {
    const { flightNumber, departureDateTime, excludeUserId } = params;

    const filter: any = { flightNumber, departureDateTime };
    if (excludeUserId) filter.userId = { $ne: excludeUserId };

    const docs = await this.collection()
      .find(filter, { projection: { userId: 1 } })
      .toArray();

    const seen = new Set<string>();
    const ids: ObjectId[] = [];
    for (const d of docs as any[]) {
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

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }

  // FIXED: Don't include userId in $set, return the correct value shape
  static async updateByUserId(userId: ObjectId, updateData: Record<string, any>) {
    const { userId: _, ...dataToUpdate } = updateData;

    const data = {
      ...dataToUpdate,
      updatedAt: new Date()
    };

    const result = await this.collection().findOneAndUpdate(
      { userId },
      { $set: data },
      { 
        upsert: false,           //  Don't create duplicates
        returnDocument: "after" 
      }
    );

    return result?.value ?? result;
  }
}
