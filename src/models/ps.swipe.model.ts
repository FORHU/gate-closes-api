import { ObjectId } from "mongodb";

export type TPsSwipeAction = "like" | "pass";

export type TPsSwipe = {
  _id?: ObjectId;
  fromUserId: ObjectId;
  toUserId: ObjectId;
  flightNumber: string;
  departureDateTime: Date;
  action: TPsSwipeAction;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MPsSwipe implements Partial<TPsSwipe> {
  _id?: ObjectId;
  fromUserId: ObjectId;
  toUserId: ObjectId;
  flightNumber: string;
  departureDateTime: Date;
  action: TPsSwipeAction;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    fromUserId,
    toUserId,
    flightNumber,
    departureDateTime,
    action,
    createdAt = new Date(),
    updatedAt = new Date(),
  } = {} as TPsSwipe) {
    this._id = _id;
    this.fromUserId = fromUserId;
    this.toUserId = toUserId;
    this.flightNumber = flightNumber;
    this.departureDateTime = departureDateTime;
    this.action = action;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

