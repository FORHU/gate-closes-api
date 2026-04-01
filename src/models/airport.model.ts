import { ObjectId } from "mongodb";

export type TAirport = {
  _id?: ObjectId;
  iata?: string | null;
  icao?: string | null;
  time?: string | null;
  countryCode?: string | null;
  continent?: string | null;
  airport?: string | null;
  elevation?: number | null;
  type?: string | null;
  scheduledService?: boolean;
  wikipedia?: string | null;
  website?: string | null;
  runwayLength?: number | null;
  flightradar24Url?: string | null;
  radarboxUrl?: string | null;
  flightawareUrl?: string | null;
  location?: { type: "Point"; coordinates: [number, number] };
  boundary?: { type: "Polygon"; coordinates: number[][][] };
  radiusKm?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TAirportUpdateOptions = {
  _id?: ObjectId | string;
  iata?: string | null;
  icao?: string | null;
  time?: string | null;
  countryCode?: string | null;
  continent?: string | null;
  airport?: string | null;
  elevation?: number | null;
  type?: string | null;
  scheduledService?: boolean;
  wikipedia?: string | null;
  website?: string | null;
  runwayLength?: number | null;
  flightradar24Url?: string | null;
  radarboxUrl?: string | null;
  flightawareUrl?: string | null;
  location?: { type: "Point"; coordinates: [number, number] };
  boundary?: { type: "Polygon"; coordinates: number[][][] };
  radiusKm?: number;
};

export class MAirport implements Partial<TAirport> {
  _id?: ObjectId;
  iata?: string | null;
  icao?: string | null;
  time?: string | null;
  countryCode?: string | null;
  continent?: string | null;
  airport?: string | null;
  elevation?: number | null;
  type?: string | null;
  scheduledService?: boolean;
  wikipedia?: string | null;
  website?: string | null;
  runwayLength?: number | null;
  flightradar24Url?: string | null;
  radarboxUrl?: string | null;
  flightawareUrl?: string | null;
  location?: { type: "Point"; coordinates: [number, number] };
  boundary?: { type: "Polygon"; coordinates: number[][][] };
  radiusKm?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    iata,
    icao,
    time,
    countryCode,
    continent,
    airport,
    elevation,
    type,
    scheduledService,
    wikipedia,
    website,
    runwayLength,
    flightradar24Url,
    radarboxUrl,
    flightawareUrl,
    location,
    boundary,
    radiusKm,
    createdAt = new Date(),
    updatedAt,
  } = {} as TAirport) {
    this._id = _id;
    this.iata = iata;
    this.icao = icao;
    this.time = time;
    this.countryCode = countryCode;
    this.continent = continent;
    this.airport = airport;
    this.elevation = elevation;
    this.type = type;
    this.scheduledService = scheduledService;
    this.wikipedia = wikipedia;
    this.website = website;
    this.runwayLength = runwayLength;
    this.flightradar24Url = flightradar24Url;
    this.radarboxUrl = radarboxUrl;
    this.flightawareUrl = flightawareUrl;
    this.location = location;
    this.boundary = boundary;
    this.radiusKm = radiusKm;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

