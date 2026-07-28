import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MFile, TFile, TFileUpdateOptions } from "../models/file.model";

export default class FileRepo {
  static collection() {
    return getDB().collection("file");
  }

  static async create(file: TFile) {
    return this.collection().insertOne(new MFile(file));
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid file id.");
    }
    return this.collection().findOne({ _id });
  }

  static async update(file: TFileUpdateOptions) {
    try {
      file._id = new ObjectId(file._id as string);
    } catch {
      return Promise.reject("Invalid file id.");
    }

    const updatedAt = new Date();
    const setFields: Record<string, unknown> = { updatedAt };
    if (file.fileUrl !== undefined) setFields.fileUrl = file.fileUrl;
    if (file.fileName !== undefined) setFields.fileName = file.fileName;
    if (file.metaData !== undefined) setFields.metaData = file.metaData;
    if (file.deletedAt !== undefined) setFields.deletedAt = file.deletedAt;

    return this.collection().updateOne({ _id: file._id }, { $set: setFields });
  }
}

