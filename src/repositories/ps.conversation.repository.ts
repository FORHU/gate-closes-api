import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MPsConversation, TPsConversation } from "../models/ps.conversation.model";

export default class PsConversationRepo {
  static collection() {
    return getDB().collection("psConversation");
  }

  static participantsLookupStage() {
    return {
      $lookup: {
        from: "user",
        let: { participantIds: "$participants" },
        pipeline: [
          {
            $match: {
              $expr: { $in: ["$_id", "$$participantIds"] },
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
        as: "participantsDetail",
      },
    };
  }

  static async findByDmKey(dmKey: string) {
    return this.collection().findOne({ dmKey });
  }

  static async findByUsers(a: ObjectId, b: ObjectId) {
    const sa = a.toHexString();
    const sb = b.toHexString();
    const dmKey = sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    return this.findByDmKey(dmKey);
  }

  static async listByUserId(psUserId: ObjectId) {
    return this.collection()
      .find({ participants: psUserId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();
  }

  static async listByUserIdWithParticipants(psUserId: ObjectId) {
    return this.collection()
      .aggregate([
        { $match: { participants: psUserId } },
        { $sort: { updatedAt: -1, createdAt: -1 } },
        this.participantsLookupStage(),
      ])
      .toArray();
  }

  static async findByUsersWithParticipants(a: ObjectId, b: ObjectId) {
    const sa = a.toHexString();
    const sb = b.toHexString();
    const dmKey = sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    const [conversation] = await this.collection()
      .aggregate([
        { $match: { dmKey } },
        { $limit: 1 },
        this.participantsLookupStage(),
      ])
      .toArray();

    return conversation ?? null;
  }

  static async findByIdWithParticipants(conversationId: ObjectId) {
    const [conversation] = await this.collection()
      .aggregate([
        { $match: { _id: conversationId } },
        { $limit: 1 },
        this.participantsLookupStage(),
      ])
      .toArray();

    return conversation ?? null;
  }

  static async findByIdAndParticipantWithParticipants(params: {
    conversationId: ObjectId;
    participantId: ObjectId;
  }) {
    const [conversation] = await this.collection()
      .aggregate([
        {
          $match: {
            _id: params.conversationId,
            participants: params.participantId,
          },
        },
        { $limit: 1 },
        this.participantsLookupStage(),
      ])
      .toArray();

    return conversation ?? null;
  }

  static async create(convo: TPsConversation) {
    return this.collection().insertOne(new MPsConversation(convo));
  }

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }
}

