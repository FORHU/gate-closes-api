import { ObjectId } from "mongodb";
import { MTerminalEcho, TTerminalEcho, TTerminalEchoUpdateOptions } from "../models/terminal.echo.model";
import { getDB } from "../utils/mongo";

export default class TerminalEchoRepo {
  static collection() {
    return getDB().collection("terminal.echo");
  }

  static async create(echo: TTerminalEcho) {
    return this.collection().insertOne(new MTerminalEcho(echo));
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch (error) {
      return Promise.reject("Invalid terminal echo id.");
    }
    return this.collection().findOne({ _id });
  }

  static async findBySenderId(senderId: string | ObjectId) {
    try {
      senderId = new ObjectId(senderId);
    } catch (error) {
      return Promise.reject("Invalid sender id.");
    }
    return this.collection().find({ senderId }).toArray();
  }

  static async update(echo: TTerminalEchoUpdateOptions) {
    try {
      echo._id = new ObjectId(echo._id as string);
    } catch (error) {
      return Promise.reject("Invalid terminal echo id.");
    }

    const updatedAt = new Date();
    const setFields: any = { updatedAt };
    if (echo.senderId !== undefined) setFields.senderId = new ObjectId(echo.senderId as string);
    if (echo.airportName !== undefined) setFields.airportName = echo.airportName;
    if (echo.audioUrl !== undefined) setFields.audioUrl = echo.audioUrl;
    if (echo.textMessage !== undefined) setFields.textMessage = echo.textMessage;
    if (echo.location !== undefined) setFields.location = echo.location;
    if (echo.countListens !== undefined) setFields.countListens = echo.countListens;
    if (echo.countReactLike !== undefined) setFields.countReactLike = echo.countReactLike;
    if (echo.countReactLove !== undefined) setFields.countReactLove = echo.countReactLove;
    if (echo.countReactHaha !== undefined) setFields.countReactHaha = echo.countReactHaha;
    if (echo.countReactWow !== undefined) setFields.countReactWow = echo.countReactWow;
    if (echo.countReactSad !== undefined) setFields.countReactSad = echo.countReactSad;
    if (echo.countReactAngry !== undefined) setFields.countReactAngry = echo.countReactAngry;

    return this.collection().updateOne({ _id: echo._id }, { $set: setFields });
  }

  static async delete(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch (error) {
      return Promise.reject("Invalid terminal echo id.");
    }

    try {
      await this.collection().deleteOne({ _id });
      return Promise.resolve("Successfully deleted terminal echo.");
    } catch (error) {
      return Promise.reject("Server internal error.");
    }
  }
}
