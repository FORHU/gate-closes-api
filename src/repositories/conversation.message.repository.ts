import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import {
  MConversationMessage,
  TConversationMessage,
} from "../models/conversation.message.model";

export default class ConversationMessageRepo {
  static collection() {
    return getDB().collection("conversation.messages");
  }

  static async create(message: TConversationMessage) {
    return this.collection().insertOne(new MConversationMessage(message));
  }

  static async listByConversationId(conversationId: ObjectId, limit: number) {
    return this.collection()
      .aggregate([
        { $match: { conversationId } },
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
            let: { senderId: "$senderId" },
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
            let: { senderId: "$senderId" },
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
    messageId: ObjectId,
    emoji: string,
    delta: number
  ) {
    const field = `reactions.${emoji}`;
    return this.collection().updateOne(
      { _id: messageId },
      [
        {
          $set: {
            [field]: {
              $max: [
                0,
                { $add: [{ $ifNull: [`$${field}`, 0] }, delta] },
              ],
            },
          },
        },
      ]
    );
  }
}
