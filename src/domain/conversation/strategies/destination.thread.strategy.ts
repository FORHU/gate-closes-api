import {
  EligibilityContext,
  EligibilityResult,
  IEligibilityStrategy,
} from "../conversation.types";

export class DestinationThreadStrategy implements IEligibilityStrategy {
  private readonly windowMs: number;

  constructor(windowMs: number = 24 * 60 * 60 * 1000) {
    this.windowMs = windowMs;
  }

  async checkEligibility(context: EligibilityContext): Promise<EligibilityResult> {
    const { requesterId, otherUserId, myTicket, otherTicket } = context;

    if (requesterId.equals(otherUserId)) {
      return {
        eligible: false,
        reason: "SELF_CONVERSATION",
        message: "Cannot create conversation with yourself.",
      };
    }

    if (!myTicket?.toAirport) {
      return {
        eligible: false,
        reason: "NO_TICKET",
        message: "No active flight ticket found for user.",
      };
    }

    if (!otherTicket?.toAirport) {
      return {
        eligible: false,
        reason: "OTHER_NO_TICKET",
        message: "Other user has no active flight ticket.",
      };
    }

    const myTo = myTicket.toAirport.trim().toUpperCase();
    const otherTo = otherTicket.toAirport.trim().toUpperCase();

    if (myTo !== otherTo) {
      return {
        eligible: false,
        reason: "DIFFERENT_DESTINATION",
        message: "Users are not eligible for destination threads.",
      };
    }

    const myFrom = (myTicket.fromAirport ?? "").trim().toUpperCase();
    const otherFrom = (otherTicket.fromAirport ?? "").trim().toUpperCase();

    if (myFrom && otherFrom && myFrom === otherFrom) {
      return {
        eligible: false,
        reason: "SAME_ORIGIN",
        message:
          "Users are from the same airport. Not eligible for destination threads.",
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

    const authArrival = myTicket.arrivalDateTime
      ? new Date(myTicket.arrivalDateTime)
      : myTicket.departureDateTime
      ? new Date(myTicket.departureDateTime)
      : null;
    const otherArrival = otherTicket.arrivalDateTime
      ? new Date(otherTicket.arrivalDateTime)
      : otherTicket.departureDateTime
      ? new Date(otherTicket.departureDateTime)
      : null;

    if (
      !authArrival ||
      !otherArrival ||
      Number.isNaN(authArrival.getTime()) ||
      Number.isNaN(otherArrival.getTime())
    ) {
      return {
        eligible: false,
        reason: "INVALID_DATES",
        message: "Flight ticket departure/arrival dates are invalid.",
      };
    }

    if (Math.abs(authArrival.getTime() - otherArrival.getTime()) > this.windowMs) {
      return {
        eligible: false,
        reason: "OUTSIDE_TIME_WINDOW",
        message:
          "Users are not arriving within the destination thread window (24 hours).",
      };
    }

    return {
      eligible: true,
      reason: "ELIGIBLE",
    };
  }
}
