import { ObjectId } from "mongodb";

export type TBtConversationUser = {
  _id?: ObjectId;
  btUserId: ObjectId;
  btConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TBtConversationUserUpdateOptions = {
  _id?: ObjectId | string;
  btUserId: ObjectId | string;
  btConversationId: ObjectId | string;
  freeAudioCount: number;
};

export class MBtConversationUser implements Partial<TBtConversationUser> {
  _id?: ObjectId;
  btUserId: ObjectId;
  btConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), btUserId, btConversationId, freeAudioCount = 2, createdAt = new Date(), updatedAt } = {} as TBtConversationUser) {
    this._id = _id;
    this.btUserId = btUserId;
    this.btConversationId = btConversationId;
    this.freeAudioCount = freeAudioCount;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
