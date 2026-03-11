import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MFlightTicket, TFlightTicket } from "../models/flight.ticket.model";

export default class FlightTicketRepo {
  static collection() {
    return getDB().collection("flightTicket");
  }

  static async create(ticket: TFlightTicket) {
    return this.collection().insertOne(new MFlightTicket(ticket));
  }

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }
}

