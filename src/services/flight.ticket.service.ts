import { TFlightTicket } from "../models/flight.ticket.model";
import FlightTicketRepo from "../repositories/flight.ticket.repository";

export default class FlightTicketSvc {
  static create(ticket: TFlightTicket) {
    return FlightTicketRepo.create(ticket);
  }
}

