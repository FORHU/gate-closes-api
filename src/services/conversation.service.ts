import { Document, ObjectId } from "mongodb";
import { ERROR_MESSAGE } from "../const";
import { TFlightTicket } from "../models/flight.ticket.model";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import ConversationRepo from "../repositories/conversation.repository";
import ConversationReadStateRepo from "../repositories/conversation.read.state.repository";
import ConversationMessageRepo from "../repositories/conversation.message.repository";
import ConversationMessageReactionRepo from "../repositories/conversation.message.reaction.repository";
import FileSvc from "./file.service";
import UserRepo from "../repositories/user.repository";
import { isDuplicateKeyError } from "../utils/error.util";
import { ConversationType } from "../domain/conversation/conversation.types";
import { EligibilityFactory } from "../domain/conversation/eligibility.factory";
import { TConversationLatestEventType } from "../models/conversation.model";

type TLatestEventPayload = Record<string, unknown> | null;

export default class ConversationSvc {
  static computeHasUnread(params: {
    requesterId: ObjectId;
    lastEventAt?: Date | null;
    lastEventActorId?: ObjectId | null;
    lastReadAt?: Date | null;
  }) {
    const { requesterId, lastEventAt, lastEventActorId, lastReadAt } = params;
    if (!lastEventAt) return false;
    if (lastEventActorId && String(lastEventActorId) === String(requesterId)) {
      return false;
    }
    if (!lastReadAt) return true;
    return new Date(lastEventAt).getTime() > new Date(lastReadAt).getTime();
  }

  static safeActorName(actorName?: string | null) {
    return actorName?.trim() || "Someone";
  }

  static latestEventTextForType(type: string, actorName: string) {
    if (type === "message_reacted") {
      return `${actorName} reacted to a message`;
    }
    if (type === "message_reaction_removed") {
      return `${actorName} removed a reaction`;
    }
    return `${actorName} sent a new message`;
  }

  static buildLatestEvent(params: {
    type: TConversationLatestEventType | string;
    at?: Date;
    actorId: ObjectId;
    actorName?: string | null;
    payload?: TLatestEventPayload;
  }) {
    const actorName = this.safeActorName(params.actorName);
    const normalizedPayload = params.payload ?? null;
    const eventAt = params.at ?? new Date();

    const text = this.latestEventTextForType(params.type, actorName);

    return {
      type: params.type,
      at: eventAt,
      actorId: params.actorId,
      actorName,
      payload: normalizedPayload,
      text,
    };
  }

  static async resolveActorName(actorId: ObjectId) {
    const actor = await UserRepo.collection().findOne(
      { _id: actorId },
      { projection: { username: 1 } }
    );
    return this.safeActorName(actor?.username ?? null);
  }

  static async refreshConversationLatestEvent(params: {
    conversationId: ObjectId;
    type: TConversationLatestEventType | string;
    actorId: ObjectId;
    payload?: TLatestEventPayload;
    at?: Date;
  }) {
    const actorName = await this.resolveActorName(params.actorId);
    const latestEvent = this.buildLatestEvent({
      type: params.type,
      actorId: params.actorId,
      actorName,
      payload: params.payload,
      at: params.at,
    });
    await ConversationRepo.updateLatestEvent(params.conversationId, latestEvent);
    return latestEvent;
  }

  static shapeConversationForUser(convo: Document, requesterId: ObjectId) {
    const participants: Document[] = convo.participants ?? [];
    const participantsDetail: Document[] = convo.participantsDetail ?? [];
    const participantById = new Map(participantsDetail.map((p) => [String(p._id), p]));

    const orderedParticipantsDetail = participants
      .map((id) => participantById.get(String(id)))
      .filter((p): p is Document => Boolean(p))
      .map(
        (p) =>
          ({
            ...p,
            name: p.username ?? null,
          }) as Document
      );

    const normalizedParticipantsDetail =
      orderedParticipantsDetail.length > 0
        ? orderedParticipantsDetail
        : participantsDetail.map(
            (p) =>
              ({
                ...p,
                name: p.username ?? null,
              }) as Document
          );

    const otherUser =
      normalizedParticipantsDetail.find((p) => String(p._id) !== String(requesterId)) ?? null;

    const normalizedLatestEventPayload = convo.lastEventPayload ?? null;
    const normalizedLatestEventText =
      convo.lastEventText?.trim() ||
      (() => {
        if (!convo.lastEventType) return null;
        return this.latestEventTextForType(
          convo.lastEventType,
          this.safeActorName(convo.lastEventActorName ?? null)
        );
      })();

    return {
      ...convo,
      participantsDetail: normalizedParticipantsDetail,
      otherUser,
      lastEventType: convo.lastEventType ?? null,
      lastEventAt: convo.lastEventAt ?? null,
      lastEventActorId: convo.lastEventActorId ?? null,
      lastEventActorName: convo.lastEventType
        ? this.safeActorName(convo.lastEventActorName ?? null)
        : null,
      lastEventPayload: normalizedLatestEventPayload,
      lastEventText: normalizedLatestEventText,
      lastReadAt: convo.lastReadAt ?? null,
      hasUnread:
        typeof convo.hasUnread === "boolean"
          ? convo.hasUnread
          : this.computeHasUnread({
              requesterId,
              lastEventAt: convo.lastEventAt ?? null,
              lastEventActorId: convo.lastEventActorId ?? null,
              lastReadAt: convo.lastReadAt ?? null,
            }),
    };
  }

  static dmKeyForUsers(type: ConversationType, a: ObjectId, b: ObjectId) {
    return ConversationRepo.dmKey(type, a, b);
  }

  static async createDm(params: {
    type: ConversationType;
    requesterId: ObjectId;
    otherUserId: ObjectId;
  }) {
    const { type, requesterId, otherUserId } = params;

    if (requesterId.equals(otherUserId)) {
      throw new Error("Cannot create conversation with yourself.");
    }

    const [myTicket, otherTicket] = await Promise.all([
      FlightTicketRepo.findActiveOrLatestByUserId(requesterId),
      FlightTicketRepo.findActiveOrLatestByUserId(otherUserId),
    ]);

    const strategy = EligibilityFactory.getStrategy(type);
    const eligibilityResult = await strategy.checkEligibility({
      requesterId,
      otherUserId,
      myTicket: myTicket as unknown as TFlightTicket | null,
      otherTicket: otherTicket as unknown as TFlightTicket | null,
    });

    if (!eligibilityResult.eligible) {
      throw new Error(eligibilityResult.message || "Users are not eligible for this conversation.");
    }

    const dmKey = this.dmKeyForUsers(type, requesterId, otherUserId);

    const existing = await ConversationRepo.findByDmKey(dmKey);
    if (existing) {
      throw new Error("Conversation already exists.");
    }

    try {
      const result = await ConversationRepo.create({
        type,
        participants: [requesterId, otherUserId],
        dmKey,
      });
      return ConversationRepo.collection().findOne({ _id: result.insertedId });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new Error("Conversation already exists.", { cause: err });
      }
      throw err;
    }
  }

  static async createDmForUsers(params: {
    type: ConversationType;
    requesterId: string;
    otherUserId: string;
  }) {
    const requesterObjectId = ConversationRepo.parseObjectId(
      params.requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const otherUserObjectId = ConversationRepo.parseObjectId(
      params.otherUserId,
      ERROR_MESSAGE.INVALID_OTHER_USER_ID
    );

    return this.createDm({
      type: params.type,
      requesterId: requesterObjectId,
      otherUserId: otherUserObjectId,
    });
  }

  static async listMyConversations(userId: ObjectId, type?: ConversationType) {
    const list = await ConversationRepo.listByUserIdWithParticipants(userId, type);
    return list.map((convo) => this.shapeConversationForUser(convo, userId));
  }

  static async searchMyConversations(userId: ObjectId, q: string, type?: ConversationType) {
    const list = await ConversationRepo.searchByUserIdAndParticipantName(userId, q, type);
    return list.map((convo) => this.shapeConversationForUser(convo, userId));
  }

  static async getById(conversationId: ObjectId, userId: ObjectId) {
    const convo = await ConversationRepo.findByIdAndParticipantWithParticipants({
      conversationId,
      participantId: userId,
    });
    if (!convo) return null;
    return this.shapeConversationForUser(convo, userId);
  }

  static async markConversationRead(params: { conversationId: ObjectId; userId: ObjectId }) {
    const { conversationId, userId } = params;
    const conversation = await ConversationRepo.collection().findOne(
      { _id: conversationId, participants: userId },
      { projection: { lastEventAt: 1 } }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const lastEventAt = conversation.lastEventAt ? new Date(conversation.lastEventAt) : new Date();

    await ConversationReadStateRepo.upsertLastReadAt({
      conversationId,
      userId,
      lastReadAt: lastEventAt,
    });

    return {
      conversationId,
      userId,
      lastReadAt: lastEventAt,
    };
  }

  static async checkDmExists(params: {
    type: ConversationType;
    userId: ObjectId;
    otherUserId: ObjectId;
  }) {
    const dmKey = this.dmKeyForUsers(params.type, params.userId, params.otherUserId);
    const existing = await ConversationRepo.findByDmKey(dmKey);
    return Boolean(existing);
  }

  static async sendMessage(params: {
    conversationId: ObjectId;
    senderId: ObjectId;
    textMessage?: string;
    fileUrl?: string;
    fileName?: string;
    audioDuration?: number;
    waveformData?: number[];
  }) {
    const {
      conversationId,
      senderId,
      textMessage,
      fileUrl,
      fileName,
      audioDuration,
      waveformData,
    } = params;

    const convo = await ConversationRepo.collection().findOne({
      _id: conversationId,
      participants: senderId,
    });
    if (!convo) {
      throw new Error("Not a participant or conversation does not exist.");
    }

    let fileId: ObjectId | null = null;
    if (fileUrl && fileName) {
      const fileDoc = await FileSvc.create({
        fileUrl,
        fileName,
        metaData: {
          audioDuration: audioDuration ?? 0,
          waveformData: waveformData ?? [],
        },
      });
      fileId = fileDoc.insertedId;
    }

    const insertResult = await ConversationMessageRepo.create({
      conversationId,
      senderId,
      fileId,
      textMessage: textMessage ?? "",
      reactions: {},
      createdAt: new Date(),
    });

    await this.refreshConversationLatestEvent({
      conversationId,
      type: "message_sent",
      actorId: senderId,
      payload: {
        messageId: insertResult.insertedId,
        fileName: fileName ?? null,
      },
    });

    const fullMessage = await ConversationMessageRepo.findByIdWithDetails(insertResult.insertedId);

    return {
      message: fullMessage,
      conversation: convo,
    };
  }

  static async listMessages(params: {
    conversationId: ObjectId;
    userId: ObjectId;
    limit?: number;
  }) {
    const { conversationId, userId, limit = 50 } = params;

    const convo = await ConversationRepo.collection().findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!convo) {
      throw new Error("Not a participant or conversation does not exist.");
    }

    const messages = await ConversationMessageRepo.listByConversationId(conversationId, limit);

    const messageIds = messages.map((m) => m._id);
    const userReactions = await ConversationMessageReactionRepo.findByUserIdAndMessageIds(
      userId,
      messageIds
    );

    const reactionMap = new Map<string, string[]>();
    for (const r of userReactions) {
      const mId = String(r.messageId);
      if (!reactionMap.has(mId)) reactionMap.set(mId, []);
      reactionMap.get(mId)!.push(r.reaction);
    }

    return messages.map((msg) => ({
      ...msg,
      currentUserReactions: reactionMap.get(String(msg._id)) ?? [],
    }));
  }

  static async updateMessageReaction(params: {
    conversationId: ObjectId;
    messageId: ObjectId;
    userId: ObjectId;
    reaction: string;
  }) {
    const { conversationId, messageId, userId, reaction } = params;

    const convo = await ConversationRepo.collection().findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!convo) {
      throw new Error("Not a participant or conversation does not exist.");
    }

    const action = await ConversationMessageReactionRepo.toggleReaction({
      messageId,
      userId,
      reaction,
    });

    const delta = action === "increment" ? 1 : -1;
    await ConversationMessageRepo.updateReaction(messageId, reaction, delta);

    await this.refreshConversationLatestEvent({
      conversationId,
      type: action === "increment" ? "message_reacted" : "message_reaction_removed",
      actorId: userId,
      payload: { messageId, reaction },
    });

    return {
      action,
      messageId,
      reaction,
      conversation: convo,
    };
  }
}
