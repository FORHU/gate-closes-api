const {
  getAirportByIata,
  getAirportByIcao,
  findNearbyAirports,
} = require("airport-data-js");
import * as turf from "@turf/turf";
import { ObjectId } from "mongodb";
import AirportRepo from "../repositories/airport.repository";
import { TAirport } from "../models/airport.model";
import RedisUtil from "../utils/redis.util";

type RawAirport = {
  iata?: string;
  icao?: string;
  time?: string;
  country_code?: string;
  continent?: string;
  airport?: string;
  latitude?: string;
  longitude?: string;
  elevation?: string;
  type?: string;
  scheduled_service?: boolean;
  wikipedia?: string;
  website?: string;
  runway_length?: string;
  flightradar24_url?: string;
  radarbox_url?: string;
  flightaware_url?: string;
};

export default class AirportSvc {
  private static buildBoundaryFromLocationAndRadius(params: {
    location: { type: "Point"; coordinates: [number, number] };
    radiusKm: number;
  }) {
    const { location, radiusKm } = params;
    const [lng, lat] = location.coordinates;

    const center = turf.point([lng, lat]);
    const circle = turf.circle(center, radiusKm, {
      units: "kilometers",
      steps: 32,
    });

    return circle.geometry as { type: "Polygon"; coordinates: number[][][] };
  }

  // Fetch nearby airports from airport-data-js, persist them, and return mapped records
  static async findNearbyAndStore(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<TAirport[]> {
    const rawAirports: RawAirport[] = await findNearbyAirports(
      lat,
      lng,
      radiusKm
    );

    const mappedAirports: TAirport[] = rawAirports.map((a) =>
      this.mapRawAirport(a)
    );

    await Promise.all(
      mappedAirports.map(async (airport) =>
        AirportRepo.upsertByIataOrIcao(airport)
      )
    );

    return mappedAirports;
  }

  // Get airport by IATA, prefer DB, otherwise fetch from API and store
  static async getByIataWithCache(code: string): Promise<TAirport | null> {
    const upper = code.toUpperCase();
    const fromDb = await AirportRepo.findByIata(upper);
    if (fromDb) return fromDb as TAirport;

    const raw = await getAirportByIata(upper);
    if (!raw) return null;

    const mapped = this.mapRawAirport(raw);
    await AirportRepo.upsertByIataOrIcao(mapped);
    return mapped;
  }

  // Get airport by ICAO, prefer DB, otherwise fetch from API and store
  static async getByIcaoWithCache(code: string): Promise<TAirport | null> {
    const upper = code.toUpperCase();
    const fromDb = await AirportRepo.findByIcao(upper);
    if (fromDb) return fromDb as TAirport;

    const raw = await getAirportByIcao(upper);
    if (!raw) return null;

    const mapped = this.mapRawAirport(raw);
    await AirportRepo.upsertByIataOrIcao(mapped);
    return mapped;
  }

  static async checkInsideAirport(params: { lat: number; lng: number }) {
    return AirportRepo.findNearestWithDistance(params);
  }

  static async checkInsideAirportByBoundary(params: {
    lat: number;
    lng: number;
  }) {
    const { lat, lng } = params;
    const airport: any = await AirportRepo.findInsideBoundary({ lat, lng });
    if (!airport) return null;

    return {
      _id: airport._id,
      iata: airport.iata ?? null,
      airport: airport.airport ?? null,
      icao: airport.icao ?? null,
      insideBoundary: true,
    };
  }

  static async checkInsideSpecificAirport(params: {lat: number; lng: number; airportName: string;}) {
    return AirportRepo.findNearestForAirport(params);
  }

  static async search(q: string, limit: number): Promise<TAirport[]> {
    return AirportRepo.searchByText(q, limit) as Promise<TAirport[]>;
  }

  static async syncBoundaries(params?: { force?: boolean }) {
    const airports = await AirportRepo.findForBoundarySync();

    const force = Boolean(params?.force);
    let updatedCount = 0;
    let skippedCount = 0;

    for (const airport of airports as any[]) {
      const hasBoundary =
        airport?.boundary?.type === "Polygon" &&
        Array.isArray(airport?.boundary?.coordinates);

      if (hasBoundary && !force) {
        skippedCount += 1;
        continue;
      }

      const location = airport?.location;
      const radiusKm = Number(airport?.radiusKm);

      if (
        location?.type !== "Point" ||
        !Array.isArray(location?.coordinates) ||
        location.coordinates.length !== 2 ||
        Number.isNaN(radiusKm) ||
        radiusKm <= 0
      ) {
        skippedCount += 1;
        continue;
      }

      const boundary = this.buildBoundaryFromLocationAndRadius({
        location: {
          type: "Point",
          coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
        },
        radiusKm,
      });

      await AirportRepo.updateBoundaryById(airport._id as ObjectId, boundary);
      updatedCount += 1;
    }

    return {
      updatedCount,
      skippedCount,
      total: airports.length,
    };
  }

  static async getAllAsGeoJson() {
    const cacheKey = "airport:geojson:v1";
    const cached = await RedisUtil.getJson<any>(cacheKey);
    if (cached) return cached;

    const airports = await AirportRepo.findAllWithBoundary();

    const features = (airports as any[])
      .filter(
        (airport) =>
          airport?.boundary?.type === "Polygon" &&
          Array.isArray(airport?.boundary?.coordinates)
      )
      .map((airport) => ({
        type: "Feature" as const,
        id: airport._id?.toString?.() ?? String(airport._id),
        geometry: airport.boundary,
        properties: {
          airport: airport.airport ?? null,
          country_code: airport.countryCode ?? null,
        },
      }));

    const geojson = {
      type: "FeatureCollection" as const,
      features,
    };
    
    await RedisUtil.setJson(cacheKey, geojson, { ttlSeconds: 60 * 10 });
    return geojson;
  }

  private static toStringOrNull(
    value?: string | number
  ): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  }

  private static toNumberOrNull(
    value?: string | number
  ): number | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = String(value).trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return null;
    return num;
  }

  private static mapRawAirport(a: RawAirport): TAirport {
    const latitude = this.toNumberOrNull(a.latitude);
    const longitude = this.toNumberOrNull(a.longitude);
    const elevation = this.toNumberOrNull(a.elevation);
    const runwayLength = this.toNumberOrNull(a.runway_length);

    const location =
      latitude !== undefined &&
      latitude !== null &&
      longitude !== undefined &&
      longitude !== null
        ? {
            type: "Point" as const,
            coordinates: [longitude, latitude] as [number, number],
          }
        : undefined;

    const radiusKm = this.inferRadiusKm(a.type, runwayLength ?? undefined);

    const boundary =
      location && radiusKm && radiusKm > 0
        ? this.buildBoundaryFromLocationAndRadius({
            location,
            radiusKm,
          })
        : undefined;

    const airport: TAirport = {
      iata: a.iata
        ? this.toStringOrNull(a.iata.toUpperCase()) ?? null
        : undefined,
      icao: a.icao
        ? this.toStringOrNull(a.icao.toUpperCase()) ?? null
        : undefined,
      time: this.toStringOrNull(a.time),
      countryCode: this.toStringOrNull(a.country_code),
      continent: this.toStringOrNull(a.continent),
      airport: this.toStringOrNull(a.airport),
      elevation,
      type: this.toStringOrNull(a.type),
      scheduledService: a.scheduled_service,
      wikipedia: this.toStringOrNull(a.wikipedia),
      website: this.toStringOrNull(a.website),
      runwayLength,
      flightradar24Url: this.toStringOrNull(a.flightradar24_url),
      radarboxUrl: this.toStringOrNull(a.radarbox_url),
      flightawareUrl: this.toStringOrNull(a.flightaware_url),
      location,
      boundary,
      radiusKm,
    };

    return airport;
  }

  private static inferRadiusKm(
    type?: string,
    runwayLength?: number
  ): number | undefined {
    if (type === "large_airport") return 15;
    if (type === "medium_airport") return 8;
    if (type === "small_airport") return 4;

    if (runwayLength !== undefined) {
      if (runwayLength >= 10000) return 15;
      if (runwayLength >= 6000) return 8;
      if (runwayLength > 0) return 4;
    }

    return undefined;
  }
}

