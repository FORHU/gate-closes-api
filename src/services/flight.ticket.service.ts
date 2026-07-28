import { ObjectId } from "mongodb";
import { TFlightTicket } from "../models/flight.ticket.model";
import FlightTicketRepo from "../repositories/flight.ticket.repository";

export default class FlightTicketSvc {
  static create(ticket: TFlightTicket) {
    return FlightTicketRepo.create(ticket);
  }

  static async getByUserId(userId: ObjectId) {
    return FlightTicketRepo.findActiveOrLatestByUserId(userId);
  }

  static async update(userId: ObjectId, updateData: Record<string, unknown>) {
  const result = await FlightTicketRepo.updateByUserId(userId, updateData);
  
  if (!result) {
    throw new Error("Flight ticket not found or could not be updated");
  }
  
  return result.value ?? result; 
}
}


