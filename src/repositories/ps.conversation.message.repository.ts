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

  static async findByIdWithDetails(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return null;
    }

    const [message] = await this.collection()
      .aggregate([
        { $match: { _id } },
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

    return message ?? null;
  }

  static async updateReaction(
    _id: string | ObjectId,
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry",
    action: "increment" | "decrement"
  ) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid conversation message id.");
    }

    const reactionFieldMap = {
      like: "countReactLike",
      love: "countReactLove",
      haha: "countReactHaha",
      wow: "countReactWow",
      sad: "countReactSad",
      angry: "countReactAngry",
    } as const;

    const fieldName = reactionFieldMap[reaction];

    if (!fieldName) {
      return Promise.reject("Invalid reaction type.");
    }

    const delta = action === "increment" ? 1 : -1;

    return this.collection().findOneAndUpdate(
      { _id },
      [
        { $set: { updatedAt: new Date() } },
        {
          $set: {
            [fieldName]: {
              $max: [
                0,
                {
                  $add: [{ $ifNull: [`$${fieldName}`, 0] }, delta],
                },
              ],
            },
          },
        },
      ],
      { returnDocument: "after" }
    );
  }
}
