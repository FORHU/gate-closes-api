import { ObjectId } from "mongodb";

export type TSovereignFutureSignal = {
  _id?: ObjectId;
  userId: ObjectId;
  audioUrl: string;
  location?: { type: "Point", coordinates: [number, number]};
  createdAt?: Date;
  updatedAt?: Date;
};

export type TSovereignFutureSignalUpdateOptions = {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  audioUrl: string;
  location?: { type: "Point", coordinates: [number, number]};
};

export class MSovereignFutureSignal implements Partial<TSovereignFutureSignal> {
  _id?: ObjectId;
  userId: ObjectId;
  audioUrl: string;
  location?: { type: "Point", coordinates: [number, number] };
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), userId, audioUrl = "", location = { type: "Point", coordinates: [0, 0] }, createdAt = new Date(), updatedAt } = {} as TSovereignFutureSignal) {
    this._id = _id;
    this.userId = userId;
    this.audioUrl = audioUrl;
    this.location = location;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
