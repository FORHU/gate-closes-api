import { Db } from "mongodb";
import { MFlightTicket } from "../models/flight.ticket.model";
import { demoAirportByCode } from "./demo-airports";
import { dateOffsetDays, log, randomInt, randomItem, type SeededUser } from "./helpers";

/** Routes the demo tickets pick from; several start at MNL for local testing. */
export const FLIGHT_LEGS = [
  { flightNumber: "PR102", from: "MNL", to: "LAX" },
  { flightNumber: "PR501", from: "MNL", to: "SIN" },
  { flightNumber: "SQ916", from: "SIN", to: "MNL" },
  { flightNumber: "PR720", from: "MNL", to: "LHR" },
  { flightNumber: "DL202", from: "JFK", to: "LHR" },
  { flightNumber: "UA837", from: "LAX", to: "NRT" },
  { flightNumber: "EK412", from: "DXB", to: "SIN" },
  { flightNumber: "AF014", from: "CDG", to: "JFK" },
  { flightNumber: "SQ321", from: "SIN", to: "SYD" },
  { flightNumber: "LH441", from: "FRA", to: "ORD" },
  { flightNumber: "QF9", from: "SYD", to: "LAX" },
  { flightNumber: "BA117", from: "LHR", to: "DXB" },
];

/** 1-2 tickets per demo user, departing within ±30 days. */
export async function seedFlightTickets(db: Db, users: SeededUser[]) {
  let count = 0;
  for (const user of users) {
    const ticketsForUser = randomInt(1, 2);
    for (let i = 0; i < ticketsForUser; i += 1) {
      const leg = randomItem(FLIGHT_LEGS);
      const from = demoAirportByCode(leg.from);
      const to = demoAirportByCode(leg.to);
      const departureOffset = randomInt(-30, 30);
      await db.collection("flightTicket").insertOne(
        new MFlightTicket({
          userId: user._id,
          flightNumber: leg.flightNumber,
          fromAirport: leg.from,
          toAirport: leg.to,
          fromAirportName: from.name,
          toAirportName: to.name,
          fromCountry: from.country,
          toCountry: to.country,
          departureDateTime: dateOffsetDays(departureOffset),
          returnDateTime: dateOffsetDays(departureOffset + 7),
        })
      );
      count += 1;
    }
  }
  log(`flight tickets: ${count}`);
}
