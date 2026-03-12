import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import {
  MPsConversationMessage,
  TPsConversationMessage,
} from "../models/ps.conversation.message.model";

export default class PsConversationMessageRepo {
  static collection() {
    return getDB().collection("psConversationMessage");
  }

  static async create(message: TPsConversationMessage) {
    return this.collection().insertOne(new MPsConversationMessage(message));
  }

  static async listByConversationId(
    psConversationId: ObjectId,
    limit: number
  ) {
    return this.collection()
      .aggregate([
        { $match: { psConversationId } },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "file",
            localField: "fileId",
            foreignField: "_id",
            as: "file",
          },
        },
        {
          $unwind: {
            path: "$file",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "user",
            let: { senderId: "$psSenderId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$senderId"] },
                },
              },
              {
                $project: {
                  _id: 1,
                  username: 1,
                  gender: 1,
                },
              },
            ],
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();
  }
}

