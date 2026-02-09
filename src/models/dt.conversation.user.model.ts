import { ObjectId } from "mongodb";

export type TDtConversationUser = {
  _id?: ObjectId;
  dtUserId: ObjectId;
  dtConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TDtConversationUserUpdateOptions = {
  _id?: ObjectId | string;
  dtUserId: ObjectId | string;
  dtConversationId: ObjectId | string;
  freeAudioCount: number;
};

export class MDtConversationUser implements Partial<TDtConversationUser> {
  _id?: ObjectId;
  dtUserId: ObjectId;
  dtConversationId: ObjectId;
  freeAudioCount: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), dtUserId, dtConversationId, freeAudioCount = 2, createdAt = new Date(), updatedAt } = {} as TDtConversationUser) {
    this._id = _id;
    this.dtUserId = dtUserId;
    this.dtConversationId = dtConversationId;
    this.freeAudioCount = freeAudioCount;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}