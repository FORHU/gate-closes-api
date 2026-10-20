import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MConversation, TConversation } from "../models/conversation.model";
import { ConversationType } from "../domain/conversation/conversation.types";

export type TConversationLatestEventUpdate = {
  type: string;
  at: Date;
  actorId: ObjectId;
  actorName: string;
  payload: Record<string, unknown> | null;
  text: string;
};

export default class ConversationRepo {
  static collection() {
    return getDB().collection("conversations");
  }

  private static escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static readStateAndUnreadStages(userId: ObjectId) {
    return [
      {
        $lookup: {
          from: "conversationReadStates",
          let: { conversationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$conversationId", "$$conversationId"] },
                    { $eq: ["$userId", userId] },
                  ],
                },
              },
            },
            { $project: { _id: 0, lastReadAt: 1 } },
            { $limit: 1 },
          ],
          as: "readState",
        },
      },
      {
        $addFields: {
          lastReadAt: {
            $ifNull: [{ $arrayElemAt: ["$readState.lastReadAt", 0] }, null],
          },
        },
      },
      {
        $addFields: {
          hasUnread: {
            $and: [
              { $ne: ["$lastEventAt", null] },
              { $ne: ["$lastEventActorId", userId] },
              {
                $or: [{ $eq: ["$lastReadAt", null] }, { $gt: ["$lastEventAt", "$lastReadAt"] }],
              },
            ],
          },
        },
      },
    ];
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

  static dmKey(type: ConversationType, a: ObjectId, b: ObjectId): string {
    const sa = a.toHexString();
    const sb = b.toHexString();
    const sorted = sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    return `${type}:${sorted}`;
  }

  static async listByUserIdWithParticipants(userId: ObjectId, type?: ConversationType) {
    const match: Record<string, unknown> = { participants: userId };
    if (type) match.type = type;

    return this.collection()
      .aggregate([
        { $match: match },
        { $sort: { lastEventAt: -1, updatedAt: -1, createdAt: -1 } },
        this.participantsLookupStage(),
        ...this.readStateAndUnreadStages(userId),
        { $project: { readState: 0 } },
      ])
      .toArray();
  }

  static async searchByUserIdAndParticipantName(
    userId: ObjectId,
    q: string,
    type?: ConversationType
  ) {
    const rx = new RegExp(this.escapeRegex(q.trim()), "i");
    const match: Record<string, unknown> = { participants: userId };
    if (type) match.type = type;

    return this.collection()
      .aggregate([
        { $match: match },
        this.participantsLookupStage(),
        {
          $addFields: {
            otherParticipantsDetail: {
              $filter: {
                input: "$participantsDetail",
                as: "p",
                cond: { $ne: ["$$p._id", userId] },
              },
            },
          },
        },
        { $match: { "otherParticipantsDetail.username": rx } },
        { $sort: { lastEventAt: -1, updatedAt: -1, createdAt: -1 } },
        ...this.readStateAndUnreadStages(userId),
        { $project: { readState: 0, otherParticipantsDetail: 0 } },
      ])
      .toArray();
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

  static async create(convo: TConversation) {
    return this.collection().insertOne(new MConversation(convo));
  }

  static async updateLatestEvent(
    conversationId: ObjectId,
    latestEvent: TConversationLatestEventUpdate
  ) {
    return this.collection().updateOne(
      { _id: conversationId },
      {
        $set: {
          lastEventType: latestEvent.type,
          lastEventAt: latestEvent.at,
          lastEventActorId: latestEvent.actorId,
          lastEventActorName: latestEvent.actorName,
          lastEventPayload: latestEvent.payload,
          lastEventText: latestEvent.text,
          updatedAt: new Date(),
        },
      }
    );
  }

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }
}
