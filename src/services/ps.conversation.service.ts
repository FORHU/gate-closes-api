import { ObjectId } from "mongodb";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationMessageRepo from "../repositories/ps.conversation.message.repository";
import FileSvc from "./file.service";

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

  static async listMessages(params: { psConversationId: ObjectId; limit: number }) {
    return PsConversationMessageRepo.listByConversationId(
      params.psConversationId,
      params.limit
    );
  }
}

