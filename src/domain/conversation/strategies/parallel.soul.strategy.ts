import { EligibilityContext, EligibilityResult, IEligibilityStrategy } from "../conversation.types";

export class ParallelSoulStrategy implements IEligibilityStrategy {
  async checkEligibility(context: EligibilityContext): Promise<EligibilityResult> {
    const { requesterId, otherUserId, myTicket, otherTicket } = context;

    if (requesterId.equals(otherUserId)) {
      return {
        eligible: false,
        reason: "SELF_CONVERSATION",
        message: "Cannot create conversation with yourself.",
      };
    }

    if (!myTicket?.fromAirport || !myTicket?.toAirport) {
      return {
        eligible: false,
        reason: "NO_TICKET",
        message: "No active flight ticket found for user.",
      };
    }

    if (!otherTicket?.fromAirport || !otherTicket?.toAirport) {
      return {
        eligible: false,
        reason: "OTHER_NO_TICKET",
        message: "Other user has no active flight ticket.",
      };
    }

    const sameRoute =
      myTicket.fromAirport.trim().toUpperCase() === otherTicket.fromAirport.trim().toUpperCase() &&
      myTicket.toAirport.trim().toUpperCase() === otherTicket.toAirport.trim().toUpperCase();

    if (!sameRoute) {
      return {
        eligible: false,
        reason: "DIFFERENT_ROUTE",
        message: "Users are not traveling the same route to be eligible for Parallel Soul.",
      };
    }

    return {
      eligible: true,
      reason: "ELIGIBLE",
    };
  }
}
