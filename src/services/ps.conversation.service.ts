import { ObjectId } from "mongodb";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationMessageRepo from "../repositories/ps.conversation.message.repository";
import PsConversationMessageReactionRepo from "../repositories/ps.conversation.message.reaction.repository";
import FileSvc from "./file.service";
import { ObjectId as MongoObjectId } from "mongodb";

export default class PsConversationSvc {
  static dmKeyForUsers(a: ObjectId, b: ObjectId) {
    const sa = a.toHexString();
    const sb = b.toHexString();
    return sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
  }

  static async listEligibleUsers(params: {
    requesterId: ObjectId;
  }) {
    const { requesterId } = params;

    const myTicket = await FlightTicketRepo.findActiveOrLatestByUserId(
      requesterId
    );
    if (!myTicket?.flightNumber || !myTicket?.departureDateTime) {
      throw new Error("No active flight ticket found for user.");
    }

    const ids = await FlightTicketRepo.findUserIdsByFlight({
      flightNumber: myTicket.flightNumber,
      departureDateTime: myTicket.departureDateTime,
      excludeUserId: requesterId,
    });

    return ids;
  }

  static async createOrGetDm(params: {
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
    if (existing) return existing;

    try {
      await PsConversationRepo.create({
        participants: [requesterId, otherUserId],
        dmKey,
      } as any);
    } catch (err: any) {
      // Handle race: if unique index exists on dmKey, second insert fails with duplicate key
      if (err?.code !== 11000) throw err;
    }

    const createdOrFound = await PsConversationRepo.findByDmKey(dmKey);
    return createdOrFound;
  }

  static async listMyConversations(psUserId: ObjectId) {
    return PsConversationRepo.listByUserId(psUserId);
  }

  static async sendMessage(params: {
    psConversationId: ObjectId;
    psSenderId: ObjectId;
    fileUrl: string;
    fileName: string;
  }) {
    const { psConversationId, psSenderId, fileUrl, fileName } = params;

    const fileCreateResult = await FileSvc.create({
      fileUrl,
      fileName,
    });

    return PsConversationMessageRepo.create({
      psConversationId,
      psSenderId,
      fileId: fileCreateResult.insertedId,
    } as any);
  }

  static async listMessages(params: {
    psConversationId: ObjectId;
    limit: number;
    requesterId?: ObjectId;
  }) {
    const messages = await PsConversationMessageRepo.listByConversationId(
      params.psConversationId,
      params.limit
    );

    if (!params.requesterId || !messages.length) {
      return messages.map((m: any) => ({
        ...m,
        currentUserReactions: m.currentUserReactions ?? [],
      }));
    }

    const messageIds = messages.map((m: any) => m._id);
    const reactions =
      await PsConversationMessageReactionRepo.findByUserIdAndMessageIds(
        params.requesterId,
        messageIds
      );

    const byMessageId = new Map<string, string[]>();
    for (const r of reactions as any[]) {
      const id = (r.psConversationMessageId as MongoObjectId).toString();
      if (!byMessageId.has(id)) byMessageId.set(id, []);
      byMessageId.get(id)!.push(r.reaction);
    }

    return messages.map((m: any) => ({
      ...m,
      currentUserReactions: byMessageId.get(m._id.toString()) ?? [],
    }));
  }

  static async updateMessageReaction(params: {
    psConversationMessageId: string;
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    userId: ObjectId;
  }) {
    const { psConversationMessageId, reaction, userId } = params;

    const existing = await PsConversationMessageReactionRepo.findOne({
      psConversationMessageId,
      userId,
      reaction,
    });

    if (existing) {
      await PsConversationMessageReactionRepo.deleteOne({
        psConversationMessageId,
        userId,
        reaction,
      });
      return PsConversationMessageRepo.updateReaction(
        psConversationMessageId,
        reaction,
        "decrement"
      );
    }

    await PsConversationMessageReactionRepo.create({
      psConversationMessageId: new ObjectId(psConversationMessageId),
      userId,
      reaction,
    } as any);

    return PsConversationMessageRepo.updateReaction(
      psConversationMessageId,
      reaction,
      "increment"
    );
  }
}
