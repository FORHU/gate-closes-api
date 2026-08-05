import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MBtConversation, TBtConversation } from "../models/bt.conversation.model";

type TBtConversationLatestEventUpdate = {
  type: "message_sent" | "message_reacted" | "message_reaction_removed";
  at: Date;
  actorId: ObjectId;
  actorName: string;
  payload: Record<string, unknown> | null;
  text: string;
};

export default class BtConversationRepo {
  static collection() {
    return getDB().collection("btConversation");
  }

  private static escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Shared read-state + hasUnread stages, appended after participantsLookupStage()
  static readStateAndUnreadStages(btUserId: ObjectId) {
    return [
      {
        $lookup: {
          from: "btConversationReadState",
          let: { conversationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$btConversationId", "$$conversationId"] },
                    { $eq: ["$userId", btUserId] },
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
              { $ne: ["$lastEventActorId", btUserId] },
              {
                $or: [
                  { $eq: ["$lastReadAt", null] },
                  { $gt: ["$lastEventAt", "$lastReadAt"] },
                ],
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

  static async findByUsers(a: ObjectId, b: ObjectId) {
    const sa = a.toHexString();
    const sb = b.toHexString();
    const dmKey = sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    return this.findByDmKey(dmKey);
  }

  static async listByUserId(btUserId: ObjectId) {
    return this.collection()
      .find({ participants: btUserId })
      .sort({ lastEventAt: -1, updatedAt: -1, createdAt: -1 })
      .toArray();
  }

  static async listByUserIdWithParticipants(btUserId: ObjectId) {
    return this.collection()
      .aggregate([
        { $match: { participants: btUserId } },
        { $sort: { lastEventAt: -1, updatedAt: -1, createdAt: -1 } },
        this.participantsLookupStage(),
        ...this.readStateAndUnreadStages(btUserId),
        { $project: { readState: 0 } },
      ])
      .toArray();
  }

  // Search the user's own conversations by the other participant's username.
  static async searchByUserIdAndParticipantName(btUserId: ObjectId, q: string) {
    const rx = new RegExp(this.escapeRegex(q.trim()), "i");

    return this.collection()
      .aggregate([
        { $match: { participants: btUserId } },
        this.participantsLookupStage(),
        {
          $addFields: {
            otherParticipantsDetail: {
              $filter: {
                input: "$participantsDetail",
                as: "p",
                cond: { $ne: ["$$p._id", btUserId] },
              },
            },
          },
        },
        { $match: { "otherParticipantsDetail.username": rx } },
        { $sort: { lastEventAt: -1, updatedAt: -1, createdAt: -1 } },
        ...this.readStateAndUnreadStages(btUserId),
        { $project: { readState: 0, otherParticipantsDetail: 0 } },
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

  static async create(convo: TBtConversation) {
    return this.collection().insertOne(new MBtConversation(convo));
  }

  static async updateLatestEvent(
    conversationId: ObjectId,
    latestEvent: TBtConversationLatestEventUpdate
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

  static async createInboxSortIndex() {
    return this.collection().createIndex({
      participants: 1,
      lastEventAt: -1,
      updatedAt: -1,
      createdAt: -1,
    });
  }

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }
}
