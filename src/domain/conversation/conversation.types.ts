import { ObjectId } from "mongodb";
import { TFlightTicket } from "../../models/flight.ticket.model";

export type ConversationType = "parallel_soul" | "destination_thread" | "baton_touch";

export type EligibilityReason =
  | "ELIGIBLE"
  | "NO_TICKET"
  | "OTHER_NO_TICKET"
  | "SELF_CONVERSATION"
  | "DIFFERENT_ROUTE"
  | "SAME_ORIGIN"
  | "SAME_FLIGHT"
  | "DIFFERENT_DESTINATION"
  | "NOT_CROSS_DIRECTIONAL"
  | "OUTSIDE_TIME_WINDOW"
  | "INVALID_DATES";

export interface EligibilityContext {
  requesterId: ObjectId;
  otherUserId: ObjectId;
  myTicket: TFlightTicket | null;
  otherTicket: TFlightTicket | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
  message?: string;
}

export interface IEligibilityStrategy {
  checkEligibility(context: EligibilityContext): Promise<EligibilityResult>;
}
