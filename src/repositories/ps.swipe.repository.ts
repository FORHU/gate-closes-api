import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { TPsSwipeAction } from "../models/ps.swipe.model";

export default class PsSwipeRepo {
  static collection() {
    return getDB().collection("psSwipe");
  }

  static async upsertSwipe(params: {
    fromUserId: ObjectId;
    toUserId: ObjectId;
    flightNumber: string;
    departureDateTime: Date;
    action: TPsSwipeAction;
  }) {
    const { fromUserId, toUserId, flightNumber, departureDateTime, action } =
      params;

    const filter = {
      fromUserId,
      toUserId,
      flightNumber,
      departureDateTime,
    };

    // Note: a unique index on (fromUserId,toUserId,flightNumber,departureDateTime)
    // would fully prevent duplicates in high concurrency situations.
    return this.collection().updateOne(
      filter,
      {
        $set: {
          action,
          updatedAt: new Date(),
        },
        // IMPORTANT: don't include `action` in $setOnInsert (it's already in $set),
        // otherwise MongoDB throws "Updating the path 'action' would create a conflict at 'action'".
        $setOnInsert: {
          _id: new ObjectId(),
          fromUserId,
          toUserId,
          flightNumber,
          departureDateTime,
          createdAt: new Date()
        },
      },
      { upsert: true }
    );
  }

  static async findLike(params: {
    fromUserId: ObjectId;
    toUserId: ObjectId;
    flightNumber: string;
    departureDateTime: Date;
  }) {
    const { fromUserId, toUserId, flightNumber, departureDateTime } = params;
    return this.collection().findOne({
      fromUserId,
      toUserId,
      flightNumber,
      departureDateTime,
      action: "like",
    });
  }
}

