import { ObjectId } from "mongodb";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsSwipeRepo from "../repositories/ps.swipe.repository";
import PsConversationSvc from "./ps.conversation.service";
import { TPsSwipeAction } from "../models/ps.swipe.model";

export default class PsMatchSvc {
  static async swipe(params: {
    requesterId: ObjectId;
    otherUserId: ObjectId;
    action: TPsSwipeAction;
  }) {
    const { requesterId, otherUserId, action } = params;

    if (requesterId.equals(otherUserId)) {
      throw new Error("Cannot swipe on yourself.");
    }

    const myTicket = await FlightTicketRepo.findActiveOrLatestByUserId(
      requesterId
    );
    if (!myTicket?.flightNumber || !myTicket?.departureDateTime) {
      throw new Error("No active flight ticket found for user.");
    }

    const flightNumber = myTicket.flightNumber;
    const departureDateTime = myTicket.departureDateTime;

    const otherEligible = await FlightTicketRepo.userHasFlight({
      userId: otherUserId,
      flightNumber,
      departureDateTime,
    });
    if (!otherEligible) {
      throw new Error("Users are not eligible to match for this flight.");
    }

    await PsSwipeRepo.upsertSwipe({
      fromUserId: requesterId,
      toUserId: otherUserId,
      flightNumber,
      departureDateTime,
      action,
    });

    if (action !== "like") {
      return { matched: false as const };
    }

    const reverseLike = await PsSwipeRepo.findLike({
      fromUserId: otherUserId,
      toUserId: requesterId,
      flightNumber,
      departureDateTime,
    });

    if (!reverseLike) {
      return { matched: false as const };
    }

    const convo = await PsConversationSvc.createOrGetDm({
      requesterId,
      otherUserId,
    });

    return { matched: true as const, conversation: convo };
  }
}

