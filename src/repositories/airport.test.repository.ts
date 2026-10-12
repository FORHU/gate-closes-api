import { ObjectId } from "mongodb";
import * as turf from "@turf/turf";
import { getDB } from "../utils/mongo";

/**
 * Test airports: one per staff tester (`airports:simulate`), created with
 * "Create Airport Here" in dev builds of the app. Kept out of the `airport`
 * collection on purpose, so no public airport query (nearby, search, map,
 * crawl, cleanup) ever sees them; only their owner's airport check, echo
 * creation and map circles do.
 */
export type TTestAirport = {
  _id?: ObjectId;
  ownerId: ObjectId;
  /** "T" + 5 hex chars: never a real IATA code (those are 3 letters). */
  iata: string;
  airport: string;
  location: { type: "Point"; coordinates: [number, number] };
  radiusKm: number;
  createdAt: Date;
};

export const TEST_AIRPORT_RADIUS_KM = 1;

export default class AirportTestRepo {
  static collection() {
    return getDB().collection<TTestAirport>("airport.test");
  }

  static codeFor(ownerId: ObjectId) {
    return `T${ownerId.toHexString().slice(-5).toUpperCase()}`;
  }

  /** Creates the owner's test airport, or moves it to the new spot. */
  static async upsertForOwner(ownerId: ObjectId, lng: number, lat: number) {
    const doc: TTestAirport = {
      ownerId,
      iata: this.codeFor(ownerId),
      airport: "Test airport",
      location: { type: "Point", coordinates: [lng, lat] },
      radiusKm: TEST_AIRPORT_RADIUS_KM,
      createdAt: new Date(),
    };
    await this.collection().replaceOne({ ownerId }, doc, { upsert: true });
    return this.findForOwner(ownerId);
  }

  static deleteForOwner(ownerId: ObjectId) {
    return this.collection().deleteOne({ ownerId });
  }

  static findForOwner(ownerId: ObjectId) {
    return this.collection().findOne({ ownerId });
  }

  /**
   * The owner's test airport in the shape of
   * `AirportRepo.findNearestWithDistance`, or null when they have none.
   */
  static async findNearestForOwner(params: { ownerId: ObjectId; lat: number; lng: number }) {
    const test = await this.findForOwner(params.ownerId);
    if (!test) return null;
    const distanceKm = turf.distance([params.lng, params.lat], test.location.coordinates, {
      units: "kilometers",
    });
    return {
      _id: test._id,
      iata: test.iata,
      icao: null,
      airport: test.airport,
      location: test.location,
      radiusKm: test.radiusKm,
      distanceKm,
      insideRadius: distanceKm <= test.radiusKm,
      isTest: true,
    };
  }
}
