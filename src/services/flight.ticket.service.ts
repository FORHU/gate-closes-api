import { ObjectId } from "mongodb";
import { TFlightTicket } from "../models/flight.ticket.model";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import AirportRepo from "../repositories/airport.repository";

// fromCountry/toCountry are never accepted from the client — they're always
// derived here from the submitted fromAirport/toAirport code, so they can
// never drift out of sync with the airport they're supposed to describe.
async function resolveAirportCountry(code: string): Promise<string | null> {
  const airport = await AirportRepo.findByIataOrIcao(code);
  if (!airport) {
    throw new Error(`Unknown airport code: ${code}`);
  }
  return airport.countryCode ?? null;
}

export default class FlightTicketSvc {
  static async create(ticket: TFlightTicket) {
    const doc: TFlightTicket = { ...ticket };

    if (doc.fromAirport) {
      doc.fromCountry = await resolveAirportCountry(doc.fromAirport);
    }
    if (doc.toAirport) {
      doc.toCountry = await resolveAirportCountry(doc.toAirport);
    }

    return FlightTicketRepo.create(doc);
  }

  static async getByUserId(userId: ObjectId) {
    return FlightTicketRepo.findActiveOrLatestByUserId(userId);
  }

  static async update(userId: ObjectId, updateData: Record<string, unknown>) {
    const nextUpdate: Record<string, unknown> = { ...updateData };

    if (typeof nextUpdate.fromAirport === "string" && nextUpdate.fromAirport) {
      nextUpdate.fromCountry = await resolveAirportCountry(nextUpdate.fromAirport);
    }
    if (typeof nextUpdate.toAirport === "string" && nextUpdate.toAirport) {
      nextUpdate.toCountry = await resolveAirportCountry(nextUpdate.toAirport);
    }

    const result = await FlightTicketRepo.updateByUserId(userId, nextUpdate);

    if (!result) {
      throw new Error("Flight ticket not found or could not be updated");
    }

    return result.value ?? result;
  }
}


