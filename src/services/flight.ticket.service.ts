import { ObjectId } from "mongodb";
import { TFlightTicket } from "../models/flight.ticket.model";
import { TAirport } from "../models/airport.model";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import AirportRepo from "../repositories/airport.repository";

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateArrivalDateTime(
  departureDateTime: Date,
  fromAirport?: TAirport | null,
  toAirport?: TAirport | null
): Date {
  const depTime = new Date(departureDateTime).getTime();
  if (
    fromAirport?.location?.coordinates?.length === 2 &&
    toAirport?.location?.coordinates?.length === 2
  ) {
    const [fromLng, fromLat] = fromAirport.location.coordinates;
    const [toLng, toLat] = toAirport.location.coordinates;
    const distanceKm = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
    // Cruising speed 800 km/h + 30 min takeoff/landing/taxi buffer
    const flightHours = distanceKm / 800 + 0.5;
    return new Date(depTime + Math.round(flightHours * 3600 * 1000));
  }
  return new Date(depTime + 2 * 3600 * 1000);
}

// fromCountry/toCountry/fromAirportName/toAirportName are never accepted
// from the client — they're always derived here from the submitted
// fromAirport/toAirport code, so they can never drift out of sync with the
// airport they're supposed to describe.
async function resolveAirportDetails(code: string): Promise<{
  name: string | null;
  countryCode: string | null;
  airport: TAirport | null;
}> {
  const airport = await AirportRepo.findByIataOrIcao(code);
  if (!airport) {
    throw new Error(`Unknown airport code: ${code}`);
  }
  return { name: airport.airport ?? null, countryCode: airport.countryCode ?? null, airport };
}

export default class FlightTicketSvc {
  static async create(ticket: TFlightTicket) {
    const doc: TFlightTicket = { ...ticket };

    let fromAirportRecord: TAirport | null = null;
    let toAirportRecord: TAirport | null = null;

    if (doc.fromAirport) {
      const details = await resolveAirportDetails(doc.fromAirport);
      doc.fromAirportName = details.name;
      doc.fromCountry = details.countryCode;
      fromAirportRecord = details.airport;
    }
    if (doc.toAirport) {
      const details = await resolveAirportDetails(doc.toAirport);
      doc.toAirportName = details.name;
      doc.toCountry = details.countryCode;
      toAirportRecord = details.airport;
    }

    if (doc.arrivalDateTime) {
      doc.arrivalDateTime = new Date(doc.arrivalDateTime);
    } else if (doc.departureDateTime) {
      doc.arrivalDateTime = estimateArrivalDateTime(
        doc.departureDateTime,
        fromAirportRecord,
        toAirportRecord
      );
    }

    return FlightTicketRepo.create(doc);
  }

  static async getByUserId(userId: ObjectId) {
    return FlightTicketRepo.findActiveOrLatestByUserId(userId);
  }

  static async update(userId: ObjectId, updateData: Record<string, unknown>) {
    const nextUpdate: Record<string, unknown> = { ...updateData };

    let fromAirportRecord: TAirport | null = null;
    let toAirportRecord: TAirport | null = null;

    if (typeof nextUpdate.fromAirport === "string" && nextUpdate.fromAirport) {
      const details = await resolveAirportDetails(nextUpdate.fromAirport);
      nextUpdate.fromAirportName = details.name;
      nextUpdate.fromCountry = details.countryCode;
      fromAirportRecord = details.airport;
    }
    if (typeof nextUpdate.toAirport === "string" && nextUpdate.toAirport) {
      const details = await resolveAirportDetails(nextUpdate.toAirport);
      nextUpdate.toAirportName = details.name;
      nextUpdate.toCountry = details.countryCode;
      toAirportRecord = details.airport;
    }

    if (nextUpdate.arrivalDateTime) {
      nextUpdate.arrivalDateTime = new Date(nextUpdate.arrivalDateTime as string | Date);
    } else if (nextUpdate.departureDateTime) {
      nextUpdate.arrivalDateTime = estimateArrivalDateTime(
        new Date(nextUpdate.departureDateTime as string | Date),
        fromAirportRecord,
        toAirportRecord
      );
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


