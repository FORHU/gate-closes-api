import { ObjectId } from "mongodb";

export type TFlightTicket = {
  _id?: ObjectId;
  userId: ObjectId;
  flightNumber?: string;
  // fromAirport/toAirport are always a bare IATA/ICAO code (never a name) —
  // PS/DT/BT matching compares these directly, so they must stay a stable,
  // comparable identifier.
  fromAirport?: string;
  toAirport?: string;
  // Derived server-side from fromAirport/toAirport at save time — never
  // accepted directly from a client request. Resolved once at write time
  // (not on every read) so displaying a ticket never needs a second lookup
  // against the airport collection.
  fromAirportName?: string | null;
  toAirportName?: string | null;
  fromCountry?: string | null;
  toCountry?: string | null;
  departureDateTime?: Date;
  returnDateTime?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TFlightTicketUpdateOptions = {
  _id?: ObjectId | string;
};

export class MFlightTicket implements Partial<TFlightTicket> {
  _id?: ObjectId;
  userId: ObjectId;
  flightNumber?: string;
  fromAirport?: string;
  toAirport?: string;
  fromAirportName?: string | null;
  toAirportName?: string | null;
  fromCountry?: string | null;
  toCountry?: string | null;
  departureDateTime?: Date;
  returnDateTime?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), userId, flightNumber = "", fromAirport = "", toAirport = "", fromAirportName = null, toAirportName = null, fromCountry = null, toCountry = null, departureDateTime, returnDateTime, createdAt = new Date(), updatedAt} = {} as TFlightTicket) {
    this._id = _id;
    this.userId = userId;
    this.flightNumber = flightNumber;
    this.fromAirport = fromAirport;
    this.toAirport = toAirport;
    this.fromAirportName = fromAirportName;
    this.toAirportName = toAirportName;
    this.fromCountry = fromCountry;
    this.toCountry = toCountry;
    this.departureDateTime = departureDateTime;
    this.returnDateTime = returnDateTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}