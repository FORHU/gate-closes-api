import { ObjectId } from "mongodb";

export type TFlightTicket = {
  _id?: ObjectId;
  userId: ObjectId;
  flightNumber?: string;
  fromCity?: string;
  toCity?: string;
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
  fromCity?: string;
  toCity?: string;
  departureDateTime?: Date;
  returnDateTime?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), userId, flightNumber = "", fromCity = "", toCity = "", departureDateTime, returnDateTime, createdAt = new Date(), updatedAt} = {} as TFlightTicket) {
    this._id = _id;
    this.userId = userId;
    this.flightNumber = flightNumber;
    this.fromCity = fromCity;
    this.toCity = toCity;
    this.departureDateTime = departureDateTime;
    this.returnDateTime = returnDateTime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}