import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MAirport, TAirport, TAirportUpdateOptions } from "../models/airport.model";

export default class AirportRepo {
  static collection() {
    return getDB().collection("airport");
  }

  private static escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static async searchByName(q: string, limit: number) {
    const trimmed = q.trim();
    const rx = new RegExp(this.escapeRegex(trimmed), "i");

    return this.collection()
      .find(
        { airport: rx },
        {
          projection: {
            _id: 0,
            airport: 1,
            iata: 1,
            icao: 1,
            location: 1,
          },
        }
      )
      .limit(limit)
      .toArray();
  }

  static async create(airport: TAirport) {
    return this.collection().insertOne(new MAirport(airport));
  }

  static async upsertByIataOrIcao(airport: TAirport) {
    const filter: Record<string, string> = {};

    if (airport.iata) {
      filter.iata = airport.iata;
    } else if (airport.icao) {
      filter.icao = airport.icao;
    } else {
      return this.create(airport);
    }

    const updatedAt = new Date();
    const doc: Record<string, unknown> = { ...new MAirport({ ...airport, updatedAt }) };
    delete doc._id;

    return this.collection().updateOne(filter, { $set: doc }, { upsert: true });
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid airport id.");
    }
    return this.collection().findOne({ _id });
  }

  static async findByIata(iata: string) {
    return this.collection().findOne({ iata: iata.toUpperCase() });
  }

  static async findByIcao(icao: string) {
    return this.collection().findOne({ icao: icao.toUpperCase() });
  }

  static async update(airport: TAirportUpdateOptions) {
    try {
      airport._id = new ObjectId(airport._id as string);
    } catch {
      return Promise.reject("Invalid airport id.");
    }

    const updatedAt = new Date();
    const setFields: Record<string, unknown> = { updatedAt };

    if (airport.iata !== undefined && airport.iata !== null) {
      setFields.iata = airport.iata.toUpperCase();
    } else if (airport.iata === null) {
      setFields.iata = null;
    }

    if (airport.icao !== undefined && airport.icao !== null) {
      setFields.icao = airport.icao.toUpperCase();
    } else if (airport.icao === null) {
      setFields.icao = null;
    }
    if (airport.time !== undefined) setFields.time = airport.time;
    if (airport.countryCode !== undefined) setFields.countryCode = airport.countryCode;
    if (airport.continent !== undefined) setFields.continent = airport.continent;
    if (airport.airport !== undefined) setFields.airport = airport.airport;
    if (airport.elevation !== undefined) setFields.elevation = airport.elevation;
    if (airport.type !== undefined) setFields.type = airport.type;
    if (airport.scheduledService !== undefined) setFields.scheduledService = airport.scheduledService;
    if (airport.wikipedia !== undefined) setFields.wikipedia = airport.wikipedia;
    if (airport.website !== undefined) setFields.website = airport.website;
    if (airport.runwayLength !== undefined) setFields.runwayLength = airport.runwayLength;
    if (airport.flightradar24Url !== undefined) setFields.flightradar24Url = airport.flightradar24Url;
    if (airport.radarboxUrl !== undefined) setFields.radarboxUrl = airport.radarboxUrl;
    if (airport.flightawareUrl !== undefined) setFields.flightawareUrl = airport.flightawareUrl;
    if (airport.location !== undefined) setFields.location = airport.location;
    if (airport.boundary !== undefined) setFields.boundary = airport.boundary;
    if (airport.radiusKm !== undefined) setFields.radiusKm = airport.radiusKm;

    return this.collection().updateOne({ _id: airport._id }, { $set: setFields });
  }

  static async findNearestWithDistance(params: { lat: number; lng: number }) {
    const { lat, lng } = params;

    const results = await this.collection()
      .aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lng, lat],
            },
            key: "location",
            distanceField: "distanceMeters",
            spherical: true,
            query: {
              location: { $exists: true },
            },
          },
        },
        {
          $addFields: {
            distanceKm: { $divide: ["$distanceMeters", 1000] },
            radiusKmSafe: { $ifNull: ["$radiusKm", 0] },
          },
        },
        {
          $addFields: {
            insideRadius: { $lte: ["$distanceKm", "$radiusKmSafe"] },
          },
        },
        {
          $project: {
            _id: 1,
            iata: 1,
            icao: 1,
            airport: 1,
            radiusKm: 1,
            distanceKm: 1,
            insideRadius: 1,
          },
        },
        { $limit: 1 },
      ])
      .toArray();

    return results[0] ?? null;
  }

  static async findNearestForAirport(params: {
    lat: number;
    lng: number;
    airportName: string;
  }) {
    const { lat, lng, airportName } = params;

    const results = await this.collection()
      .aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lng, lat],
            },
            key: "location",
            distanceField: "distanceMeters",
            spherical: true,
            query: {
              location: { $exists: true },
              airport: airportName,
            },
          },
        },
        {
          $addFields: {
            distanceKm: { $divide: ["$distanceMeters", 1000] },
            radiusKmSafe: { $ifNull: ["$radiusKm", 0] },
          },
        },
        {
          $addFields: {
            insideRadius: { $lte: ["$distanceKm", "$radiusKmSafe"] },
          },
        },
        {
          $project: {
            _id: 1,
            iata: 1,
            icao: 1,
            airport: 1,
            radiusKm: 1,
            distanceKm: 1,
            insideRadius: 1,
          },
        },
        { $limit: 1 },
      ])
      .toArray();

    return results[0] ?? null;
  }

  static async findForBoundarySync() {
    const filter: Record<string, unknown> = {
      location: { $exists: true },
      radiusKm: { $gt: 0 },
    };

    return this.collection()
      .find(filter, {
        projection: {
          _id: 1,
          location: 1,
          radiusKm: 1,
          boundary: 1,
        },
      })
      .toArray();
  }

  static async updateBoundaryById(
    _id: ObjectId,
    boundary: { type: "Polygon"; coordinates: number[][][] }
  ) {
    return this.collection().updateOne(
      { _id },
      { $set: { boundary, updatedAt: new Date() } }
    );
  }

  static async findAllWithBoundary() {
    return this.collection()
      .find(
        {
          boundary: { $exists: true },
        },
        {
          projection: {
            _id: 1,
            boundary: 1,
            airport: 1,
            countryCode: 1,
          },
        }
      )
      .toArray();
  }

  // Insert-if-absent per record, keyed by iata (falling back to icao). Never
  // overwrites an already-stored airport — see ADR-0001.
  static async bulkInsertMissing(airports: TAirport[]) {
    if (airports.length === 0) {
      return { upsertedCount: 0, matchedCount: 0 };
    }

    const ops = airports.map((airport) => {
      const filter: Record<string, string> = airport.iata
        ? { iata: airport.iata }
        : { icao: airport.icao as string };

      return {
        updateOne: {
          filter,
          update: { $setOnInsert: new MAirport(airport) },
          upsert: true,
        },
      };
    });

    const result = await this.collection().bulkWrite(ops, { ordered: false });
    return {
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
    };
  }

  static async findInsideBoundary(params: { lat: number; lng: number }) {
    const { lat, lng } = params;

    return this.collection().findOne(
      {
        boundary: {
          $geoIntersects: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
          },
        },
      },
      {
        projection: {
          _id: 1,
          iata: 1,
          icao: 1,
          airport: 1,
          radiusKm: 1,
          location: 1,
        },
      }
    );
  }
}

