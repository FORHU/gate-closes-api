import { EligibilityContext, EligibilityResult, IEligibilityStrategy } from "../conversation.types";

export class BatonTouchStrategy implements IEligibilityStrategy {
  async checkEligibility(context: EligibilityContext): Promise<EligibilityResult> {
    const { requesterId, otherUserId, myTicket, otherTicket } = context;

    if (requesterId.equals(otherUserId)) {
      return {
        eligible: false,
        reason: "SELF_CONVERSATION",
        message: "Cannot create conversation with yourself.",
      };
    }

    if (!myTicket) {
      return {
        eligible: false,
        reason: "NO_TICKET",
        message: "No active flight ticket found for user.",
      };
    }

    if (!otherTicket) {
      return {
        eligible: false,
        reason: "OTHER_NO_TICKET",
        message: "Other user has no active flight ticket.",
      };
    }

    const myTo = (myTicket.toAirport ?? "").trim().toUpperCase();
    const myFrom = (myTicket.fromAirport ?? "").trim().toUpperCase();
    const otherTo = (otherTicket.toAirport ?? "").trim().toUpperCase();
    const otherFrom = (otherTicket.fromAirport ?? "").trim().toUpperCase();

    const isCrossDirectionalMatch =
      (myTo && otherFrom && myTo === otherFrom) || (myFrom && otherTo && myFrom === otherTo);

    if (!isCrossDirectionalMatch) {
      return {
        eligible: false,
        reason: "NOT_CROSS_DIRECTIONAL",
        message: "Users are not eligible for baton touch.",
      };
    }

    if (
      myTicket.flightNumber &&
      otherTicket.flightNumber &&
      myTicket.flightNumber.trim().toUpperCase() ===
        otherTicket.flightNumber.trim().toUpperCase() &&
      myTicket.departureDateTime &&
      otherTicket.departureDateTime &&
      new Date(myTicket.departureDateTime).getTime() ===
        new Date(otherTicket.departureDateTime).getTime()
    ) {
      return {
        eligible: false,
        reason: "SAME_FLIGHT",
        message: "Users are on the same flight. Use parallel soul instead.",
      };
    }

    return {
      eligible: true,
      reason: "ELIGIBLE",
    };
  }
}
