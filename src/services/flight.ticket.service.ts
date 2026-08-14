import { ObjectId } from "mongodb";
import { TFlightTicket } from "../models/flight.ticket.model";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import AirportRepo from "../repositories/airport.repository";

// fromCountry/toCountry/fromAirportName/toAirportName are never accepted
// from the client — they're always derived here from the submitted
// fromAirport/toAirport code, so they can never drift out of sync with the
// airport they're supposed to describe.
async function resolveAirportDetails(code: string): Promise<{ name: string | null; countryCode: string | null }> {
  const airport = await AirportRepo.findByIataOrIcao(code);
  if (!airport) {
    throw new Error(`Unknown airport code: ${code}`);
  }
  return { name: airport.airport ?? null, countryCode: airport.countryCode ?? null };
}

export default class FlightTicketSvc {
  static async create(ticket: TFlightTicket) {
    const doc: TFlightTicket = { ...ticket };

    if (doc.fromAirport) {
      const details = await resolveAirportDetails(doc.fromAirport);
      doc.fromAirportName = details.name;
      doc.fromCountry = details.countryCode;
    }
    if (doc.toAirport) {
      const details = await resolveAirportDetails(doc.toAirport);
      doc.toAirportName = details.name;
      doc.toCountry = details.countryCode;
    }

    return FlightTicketRepo.create(doc);
  }

  static async getByUserId(userId: ObjectId) {
    return FlightTicketRepo.findActiveOrLatestByUserId(userId);
  }

  static async update(userId: ObjectId, updateData: Record<string, unknown>) {
    const nextUpdate: Record<string, unknown> = { ...updateData };

    if (typeof nextUpdate.fromAirport === "string" && nextUpdate.fromAirport) {
      const details = await resolveAirportDetails(nextUpdate.fromAirport);
      nextUpdate.fromAirportName = details.name;
      nextUpdate.fromCountry = details.countryCode;
    }
    if (typeof nextUpdate.toAirport === "string" && nextUpdate.toAirport) {
      const details = await resolveAirportDetails(nextUpdate.toAirport);
      nextUpdate.toAirportName = details.name;
      nextUpdate.toCountry = details.countryCode;
    }

    const result = await FlightTicketRepo.updateByUserId(userId, nextUpdate);

    if (!result) {
      throw new Error("Flight ticket not found or could not be updated");
    }

    return result.value ?? result;
  }

  static async deleteByUserId(userId: ObjectId) {
    const result = await FlightTicketRepo.deleteAllByUserId(userId);

    if (!result.deletedCount) {
      throw new Error("Flight ticket not found");
    }

    return result;
  }
}


