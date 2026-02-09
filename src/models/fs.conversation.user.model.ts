import { ObjectId } from "mongodb";

export type TFsConversationUser = {
  _id?: ObjectId;
  fsUserId: ObjectId;
  fsConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TFsConversationUserUpdateOptions = {
  _id?: ObjectId | string;
  fsUserId: ObjectId | string;
  fsConversationId: ObjectId | string;
  freeAudioCount: number;
};

export class MFsConversationUser implements Partial<TFsConversationUser> {
  _id?: ObjectId;
  fsUserId: ObjectId;
  fsConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), fsUserId, fsConversationId, freeAudioCount = 2, createdAt = new Date(), updatedAt } = {} as TFsConversationUser) {
    this._id = _id;
    this.fsUserId = fsUserId;
    this.fsConversationId = fsConversationId;
    this.freeAudioCount = freeAudioCount;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}