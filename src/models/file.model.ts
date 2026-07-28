import { ObjectId } from "mongodb";

export type TFile = {
  _id?: ObjectId;
  fileUrl: string;
  fileName: string;
  metaData?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
};

export type TFileUpdateOptions = {
  _id?: ObjectId | string;
  fileUrl?: string;
  fileName?: string;
  metaData?: Record<string, unknown>;
  updatedAt?: Date;
  deletedAt?: Date | null;
};

export class MFile implements Partial<TFile> {
  _id?: ObjectId;
  fileUrl: string;
  fileName: string;
  metaData?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;

  constructor({
    _id = new ObjectId(),
    fileUrl = "",
    fileName = "",
    metaData = {},
    createdAt = new Date(),
    updatedAt,
    deletedAt = null,
  } = {} as TFile) {
    this._id = _id;
    this.fileUrl = fileUrl;
    this.fileName = fileName;
    this.metaData = metaData;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deletedAt = deletedAt;
  }
}
