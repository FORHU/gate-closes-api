import { ObjectId } from "mongodb";

export type TFsConversation = {
  _id?: ObjectId;
  sovereignFutureSignalId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TFsConversationUpdateOptions = {
  _id?: ObjectId | string;
  sovereignFutureSignalId: ObjectId | string;
};

export class MFsConversation implements Partial<TFsConversation> {
  _id?: ObjectId;
  sovereignFutureSignalId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), sovereignFutureSignalId, createdAt = new Date(), updatedAt } = {} as TFsConversation) {
    this._id = _id;
    this.sovereignFutureSignalId = sovereignFutureSignalId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
