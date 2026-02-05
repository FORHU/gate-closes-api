import { ObjectId } from "mongodb";

export type TPsConversationUser = {
  _id?: ObjectId;
  psUserId: ObjectId;
  psConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationUserUpdateOptions = {
  _id?: ObjectId | string;
  psUserId: ObjectId | string;
  psConversationId: ObjectId | string;
  freeAudioCount: number;
};

export class MPsConversationUser implements Partial<TPsConversationUser> {
  _id?: ObjectId;
  psUserId: ObjectId;
  psConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), psUserId, psConversationId, freeAudioCount = 2, createdAt = new Date(), updatedAt } = {} as TPsConversationUser) {
    this._id = _id;
    this.psUserId = psUserId;
    this.psConversationId = psConversationId;
    this.freeAudioCount = freeAudioCount;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
