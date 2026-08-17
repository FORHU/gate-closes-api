import { Document, ObjectId } from "mongodb";
import { ERROR_MESSAGE } from "../const";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationReadStateRepo from "../repositories/ps.conversation.read.state.repository";
import UserRepo from "../repositories/user.repository";
import { isDuplicateKeyError } from "../utils/error.util";

type TPsLatestEventType =
  | "message_sent"
  | "message_reacted"
  | "message_reaction_removed";

type TPsLatestEventPayload = Record<string, unknown> | null;

export default class PsConversationSvc {
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

  static latestEventTextForType(type: TPsLatestEventType, actorName: string) {
    if (type === "message_reacted") {
      return `${actorName} reacted to a message`;
    }
    if (type === "message_reaction_removed") {
      return `${actorName} removed a reaction`;
    }
    return `${actorName} sent a new message`;
  }

  static buildLatestEvent(params: {
    type: TPsLatestEventType;
    at?: Date;
    actorId: ObjectId;
    actorName?: string | null;
    payload?: TPsLatestEventPayload;
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
    type: TPsLatestEventType;
    actorId: ObjectId;
    payload?: TPsLatestEventPayload;
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
    await PsConversationRepo.updateLatestEvent(params.conversationId, latestEvent);
    return latestEvent;
  }

  static shapeConversationForUser(convo: Document, requesterId: ObjectId) {
    const participants: Document[] = convo.participants ?? [];
    const participantsDetail: Document[] = convo.participantsDetail ?? [];
    const participantById = new Map(
      participantsDetail.map((p) => [String(p._id), p])
    );

    const orderedParticipantsDetail = participants
      .map((id) => participantById.get(String(id)))
      .filter((p): p is Document => Boolean(p))
      .map((p) => ({
        ...p,
        name: p.username ?? null,
      } as Document));

    const normalizedParticipantsDetail =
      orderedParticipantsDetail.length > 0
        ? orderedParticipantsDetail
        : participantsDetail.map((p) => ({
            ...p,
            name: p.username ?? null,
          } as Document));

    const otherUser =
      normalizedParticipantsDetail.find(
        (p) => String(p._id) !== String(requesterId)
      ) ?? null;

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

  // Use to avoid duplication of conversation. If 2 users has conversation already then they cannot create another one
  static dmKeyForUsers(a: ObjectId, b: ObjectId) {
    const sa = a.toHexString();
    const sb = b.toHexString();
    return sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
  }

  // Create conversation. Throws if conversation already exists.
  // Eligibility: same route (fromAirport + toAirport) as the other user —
  // matches terminal.echo.service.ts's computeType() PARALLEL_SOUL branch
  // exactly, so a map pin classified as Parallel Soul is always actually
  // eligible to start a conversation (previously this checked an exact
  // flightNumber + departureDateTime match, which was stricter than what
  // computeType used to decide the pin/CTA — a ticket entered a few
  // minutes off from another user's would show the Parallel Soul CTA and
  // then 409 here).
  static async createDm(params: {
    requesterId: ObjectId;
    otherUserId: ObjectId;
  }) {
    const { requesterId, otherUserId } = params;

    if (requesterId.equals(otherUserId)) {
      throw new Error("Cannot create conversation with yourself.");
    }

    const [myTicket, otherTicket] = await Promise.all([
      FlightTicketRepo.findActiveOrLatestByUserId(requesterId),
      FlightTicketRepo.findActiveOrLatestByUserId(otherUserId),
    ]);

    if (!myTicket?.fromAirport || !myTicket?.toAirport) {
      throw new Error("No active flight ticket found for user.");
    }
    if (!otherTicket?.fromAirport || !otherTicket?.toAirport) {
      throw new Error("Other user has no active flight ticket.");
    }

    const sameRoute =
      myTicket.fromAirport === otherTicket.fromAirport &&
      myTicket.toAirport === otherTicket.toAirport;

    if (!sameRoute) {
      throw new Error("Users are not traveling the same route to be eligible for Parallel Soul.");
    }

    const dmKey = this.dmKeyForUsers(requesterId, otherUserId);

    const existing = await PsConversationRepo.findByDmKey(dmKey);
    if (existing) {
      throw new Error("Conversation already exists.");
    }

    try {
      const result = await PsConversationRepo.create({
        participants: [requesterId, otherUserId],
        dmKey,
      });
      return PsConversationRepo.collection().findOne({ _id: result.insertedId });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new Error("Conversation already exists.", { cause: err });
      }
      throw err;
    }
  }

  static async createDmForUsers(params: {
    requesterId: string;
    otherUserId: string;
  }) {
    const requesterObjectId = FlightTicketRepo.parseObjectId(
      params.requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const otherUserObjectId = PsConversationRepo.parseObjectId(
      params.otherUserId,
      ERROR_MESSAGE.INVALID_OTHER_USER_ID
    );

    return this.createDm({
      requesterId: requesterObjectId,
      otherUserId: otherUserObjectId,
    });
  }

  // List all created conversation of user
  static async listMyConversations(psUserId: ObjectId) {
    return PsConversationRepo.listByUserIdWithParticipants(psUserId);
  }

  static async listMyConversationsForUser(requesterId: string) {
    const requesterObjectId = FlightTicketRepo.parseObjectId(
      requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const convos = await this.listMyConversations(requesterObjectId);
    return convos.map((convo) =>
      this.shapeConversationForUser(convo, requesterObjectId)
    );
  }

  // Search the requester's own conversations by the other participant's name
  static async searchConversationsForUser(requesterId: string, q: string) {
    const requesterObjectId = FlightTicketRepo.parseObjectId(
      requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const convos = await PsConversationRepo.searchByUserIdAndParticipantName(
      requesterObjectId,
      q
    );
    return convos.map((convo) =>
      this.shapeConversationForUser(convo, requesterObjectId)
    );
  }

  // Check whether a DM conversation already exists for two users
  static async getExistingDm(params: {
    requesterId: ObjectId;
    otherUserId: ObjectId;
  }) {
    const { requesterId, otherUserId } = params;
    if (requesterId.equals(otherUserId)) {
      throw new Error("Cannot check conversation with yourself.");
    }

    return PsConversationRepo.findByUsersWithParticipants(requesterId, otherUserId);
  }

  static async checkExistingDmForUsers(params: {
    requesterId: string;
    otherUserId: string;
  }) {
    const requesterObjectId = FlightTicketRepo.parseObjectId(
      params.requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const otherUserObjectId = PsConversationRepo.parseObjectId(
      params.otherUserId,
      ERROR_MESSAGE.INVALID_OTHER_USER_ID
    );

    const otherUser = await UserRepo.collection().findOne(
      { _id: otherUserObjectId },
      {
        projection: {
          _id: 1,
          username: 1,
          gender: 1,
        },
      }
    );

    const convo = await this.getExistingDm({
      requesterId: requesterObjectId,
      otherUserId: otherUserObjectId,
    });

    return {
      exists: !!convo,
      conversation: convo
        ? this.shapeConversationForUser(convo, requesterObjectId)
        : null,
      otherUser: otherUser
        ? {
            ...otherUser,
            name: otherUser.username ?? null,
          }
        : null,
    };
  }

  static async getConversationDetail(params: {
    conversationId: ObjectId;
    requesterId: ObjectId;
  }) {
    const conversation =
      await PsConversationRepo.findByIdAndParticipantWithParticipants({
        conversationId: params.conversationId,
        participantId: params.requesterId,
      });
    if (conversation) return conversation;

    const conversationById = await PsConversationRepo.findByIdWithParticipants(
      params.conversationId
    );
    if (conversationById) {
      throw new Error("Not a participant.");
    }

    return null;
  }

  static async getConversationDetailForUser(params: {
    conversationId: string;
    requesterId: string;
  }) {
    const requesterObjectId = FlightTicketRepo.parseObjectId(
      params.requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const conversationObjectId = PsConversationRepo.parseObjectId(
      params.conversationId,
      ERROR_MESSAGE.INVALID_CONVERSATION_ID
    );

    const conversation = await this.getConversationDetail({
      conversationId: conversationObjectId,
      requesterId: requesterObjectId,
    });
    if (!conversation) return null;

    return this.shapeConversationForUser(conversation, requesterObjectId);
  }

  static async markConversationRead(params: {
    conversationId: ObjectId;
    requesterId: ObjectId;
  }) {
    const conversation = await this.getConversationDetail({
      conversationId: params.conversationId,
      requesterId: params.requesterId,
    });
    if (!conversation) return null;

    const targetReadAt = conversation.lastEventAt ?? new Date();
    await PsConversationReadStateRepo.upsertLastReadAt({
      psConversationId: params.conversationId,
      userId: params.requesterId,
      lastReadAt: targetReadAt,
    });

    return {
      conversationId: params.conversationId,
      lastReadAt: targetReadAt,
      hasUnread: false,
    };
  }

  static async getConversationRealtimeStateForUser(params: {
    conversationId: ObjectId;
    requesterId: ObjectId;
  }) {
    const [conversation, readState] = await Promise.all([
      this.getConversationDetail({
        conversationId: params.conversationId,
        requesterId: params.requesterId,
      }),
      PsConversationReadStateRepo.findOneByConversationAndUser(
        params.conversationId,
        params.requesterId
      ),
    ]);
    if (!conversation) return null;

    const lastReadAt = readState?.lastReadAt ?? null;
    const shaped = this.shapeConversationForUser(conversation, params.requesterId);
    const hasUnread = this.computeHasUnread({
      requesterId: params.requesterId,
      lastEventAt: shaped.lastEventAt,
      lastEventActorId: shaped.lastEventActorId,
      lastReadAt,
    });

    return {
      conversationId: String(params.conversationId),
      userId: String(params.requesterId),
      lastReadAt,
      hasUnread,
      lastEventAt: shaped.lastEventAt ?? null,
      lastEventActorId: shaped.lastEventActorId
        ? String(shaped.lastEventActorId)
        : null,
      lastEventType: shaped.lastEventType ?? null,
      lastEventText: shaped.lastEventText ?? null,
    };
  }

  static async markConversationReadForUser(params: {
    conversationId: string;
    requesterId: string;
  }) {
    const requesterObjectId = FlightTicketRepo.parseObjectId(
      params.requesterId,
      ERROR_MESSAGE.INVALID_USER_ID
    );
    const conversationObjectId = PsConversationRepo.parseObjectId(
      params.conversationId,
      ERROR_MESSAGE.INVALID_CONVERSATION_ID
    );
    return this.markConversationRead({
      conversationId: conversationObjectId,
      requesterId: requesterObjectId,
    });
  }
}
