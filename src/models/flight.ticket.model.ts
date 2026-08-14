import { ObjectId } from "mongodb";

export type TFlightTicket = {
  _id?: ObjectId;
  userId: ObjectId;
  flightNumber?: string;
  fromAirport?: string;
  toAirport?: string;
  // Derived server-side from fromAirport/toAirport's countryCode — never
  // accepted directly from a client request.
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
  fromCountry?: string | null;
  toCountry?: string | null;
  departureDateTime?: Date;
  returnDateTime?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), userId, flightNumber = "", fromAirport = "", toAirport = "", fromCountry = null, toCountry = null, departureDateTime, returnDateTime, createdAt = new Date(), updatedAt} = {} as TFlightTicket) {
    this._id = _id;
    this.userId = userId;
    this.flightNumber = flightNumber;
    this.fromAirport = fromAirport;
    this.toAirport = toAirport;
    this.fromCountry = fromCountry;
    this.toCountry = toCountry;
    this.departureDateTime = departureDateTime;
    this.returnDateTime = returnDateTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}