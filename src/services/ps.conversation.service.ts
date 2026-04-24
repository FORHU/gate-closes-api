import { ObjectId } from "mongodb";
import { ERROR_MESSAGE } from "../const";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import UserRepo from "../repositories/user.repository";

export default class PsConversationSvc {
  static shapeConversationForUser(convo: any, requesterId: ObjectId) {
    const participants = convo.participants ?? [];
    const participantsDetail = convo.participantsDetail ?? [];
    const participantById = new Map(
      participantsDetail.map((p: any) => [String(p._id), p])
    );

    const orderedParticipantsDetail = participants
      .map((id: any) => participantById.get(String(id)))
      .filter(Boolean)
      .map((p: any) => ({
        ...p,
        name: p.username ?? null,
      }));

    const normalizedParticipantsDetail =
      orderedParticipantsDetail.length > 0
        ? orderedParticipantsDetail
        : participantsDetail.map((p: any) => ({
            ...p,
            name: p.username ?? null,
          }));

    const otherUser =
      normalizedParticipantsDetail.find(
        (p: any) => String(p._id) !== String(requesterId)
      ) ?? null;

    return {
      ...convo,
      participantsDetail: normalizedParticipantsDetail,
      otherUser,
    };
  }

  // Use to avoid duplication of conversation. If 2 users has conversation already then they cannot create another one
  static dmKeyForUsers(a: ObjectId, b: ObjectId) {
    const sa = a.toHexString();
    const sb = b.toHexString();
    return sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
  }

  // Create conversation. Throws if conversation already exists.
  static async createDm(params: {
    requesterId: ObjectId;
    otherUserId: ObjectId;
  }) {
    const { requesterId, otherUserId } = params;

    if (requesterId.equals(otherUserId)) {
      throw new Error("Cannot create conversation with yourself.");
    }

    const myTicket = await FlightTicketRepo.findActiveOrLatestByUserId(
      requesterId
    );
    if (!myTicket?.flightNumber || !myTicket?.departureDateTime) {
      throw new Error("No active flight ticket found for user.");
    }

    const flightNumber = myTicket.flightNumber;
    const departureDateTime = myTicket.departureDateTime;

    const [meEligible, otherEligible] = await Promise.all([
      FlightTicketRepo.userHasFlight({
        userId: requesterId,
        flightNumber,
        departureDateTime,
      }),
      FlightTicketRepo.userHasFlight({
        userId: otherUserId,
        flightNumber,
        departureDateTime,
      }),
    ]);

    if (!meEligible || !otherEligible) {
      throw new Error("Users are not eligible to chat for this flight.");
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
      } as any);
      return PsConversationRepo.collection().findOne({ _id: result.insertedId });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new Error("Conversation already exists.");
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
    return (convos as any[]).map((convo: any) =>
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
            name: (otherUser as any).username ?? null,
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
}
