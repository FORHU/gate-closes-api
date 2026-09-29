import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import FlightTicketSvc, { estimateArrivalDateTime } from "../src/services/flight.ticket.service";
import FlightTicketRepo from "../src/repositories/flight.ticket.repository";
import AirportRepo from "../src/repositories/airport.repository";

describe("FlightTicketSvc & Arrival Time Resolution", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: unknown) => {
    const original = obj[key];
    (obj as Record<K, unknown>)[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  const setupRepoStubs = () => {
    stub(FlightTicketRepo, "findByIdempotencyKey", async () => null);
    stub(FlightTicketRepo, "findExistingTicket", async () => null);
  };

  it("preserves explicitly provided arrivalDateTime", async () => {
    setupRepoStubs();
    stub(AirportRepo, "findByIataOrIcao", async (code: string) => ({
      iata: code,
      airport: `${code} Airport`,
      countryCode: "US",
    }));

    let savedDoc: any = null;
    stub(FlightTicketRepo, "create", async (doc: any) => {
      savedDoc = doc;
      return { acknowledged: true, insertedId: new ObjectId() };
    });

    const departure = new Date("2026-06-01T10:00:00Z");
    const explicitArrival = new Date("2026-06-01T14:30:00Z");
    const returnDate = new Date("2026-06-10T10:00:00Z");

    await FlightTicketSvc.create({
      userId: new ObjectId("650000000000000000000001"),
      flightNumber: "SQ12",
      fromAirport: "SIN",
      toAirport: "NRT",
      departureDateTime: departure,
      arrivalDateTime: explicitArrival,
      returnDateTime: returnDate,
    });

    expect(savedDoc).to.exist;
    expect(savedDoc.arrivalDateTime).to.deep.equal(explicitArrival);
  });

  it("estimates arrivalDateTime from airport coordinates when omitted", async () => {
    setupRepoStubs();
    stub(AirportRepo, "findByIataOrIcao", async (code: string) => {
      if (code === "SIN") {
        return {
          iata: "SIN",
          airport: "Singapore Changi Airport",
          countryCode: "SG",
          location: { type: "Point", coordinates: [103.9915, 1.3644] },
        };
      }
      if (code === "KUL") {
        return {
          iata: "KUL",
          airport: "Kuala Lumpur International Airport",
          countryCode: "MY",
          location: { type: "Point", coordinates: [101.7099, 2.7456] },
        };
      }
      return null;
    });

    let savedDoc: any = null;
    stub(FlightTicketRepo, "create", async (doc: any) => {
      savedDoc = doc;
      return { acknowledged: true, insertedId: new ObjectId() };
    });

    const departure = new Date("2026-06-01T08:00:00Z");
    const returnDate = new Date("2026-06-10T10:00:00Z");

    await FlightTicketSvc.create({
      userId: new ObjectId("650000000000000000000001"),
      flightNumber: "MH602",
      fromAirport: "SIN",
      toAirport: "KUL",
      departureDateTime: departure,
      returnDateTime: returnDate,
    });

    expect(savedDoc).to.exist;
    expect(savedDoc.arrivalDateTime).to.be.instanceOf(Date);
    // SIN to KUL is ~300km, ~22 min flying + 30 min buffer => ~52 min
    const diffMinutes = (savedDoc.arrivalDateTime.getTime() - departure.getTime()) / (60 * 1000);
    expect(diffMinutes).to.be.greaterThan(30);
    expect(diffMinutes).to.be.lessThan(120);
  });

  it("falls back to departure + 2h when airport coordinates are missing", () => {
    const departure = new Date("2026-06-01T12:00:00Z");
    const estimated = estimateArrivalDateTime(departure, null, null);
    expect(estimated.getTime() - departure.getTime()).to.equal(2 * 3600 * 1000);
  });
});
