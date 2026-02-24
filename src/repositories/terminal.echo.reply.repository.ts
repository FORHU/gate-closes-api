import { ObjectId } from "mongodb";
import { MTerminalEchoReply, TTerminalEchoReply, TTerminalEchoReplyUpdateOptions } from "../models/terminal.echo.reply.model";
import { getDB } from "../utils/mongo";

export default class TerminalEchoReplyRepo {
  static collection() {
    return getDB().collection("terminal.echo.reply");
  }

  static async createForAudio(terminalEchoId: string | ObjectId, audioUrl: string) {
    try {
      terminalEchoId = new ObjectId(terminalEchoId);
    } catch (error) {
      return Promise.reject("Invalid terminal echo id.");
    }
    const reply: TTerminalEchoReply = {
      terminalEchoId,
      audioUrl
    };
    return this.collection().insertOne(new MTerminalEchoReply(reply));
  }

  static async createForTextMessage(terminalEchoId: string | ObjectId, textMessage: string) {
    try {
      terminalEchoId = new ObjectId(terminalEchoId);
    } catch (error) {
      return Promise.reject("Invalid terminal echo id.");
    }
    const reply: TTerminalEchoReply = {
      terminalEchoId,
      textMessage
    };
    return this.collection().insertOne(new MTerminalEchoReply(reply));
  }

  static async create(reply: TTerminalEchoReply) {
    return this.collection().insertOne(new MTerminalEchoReply(reply));
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch (error) {
      return Promise.reject("Invalid terminal echo reply id.");
    }
    return this.collection().findOne({ _id });
  }

  static async findByTerminalEchoId(terminalEchoId: string | ObjectId) {
    try {
      terminalEchoId = new ObjectId(terminalEchoId);
    } catch (error) {
      return Promise.reject("Invalid terminal echo id.");
    }
    return this.collection().find({ terminalEchoId }).toArray();
  }

  static async update(reply: TTerminalEchoReplyUpdateOptions) {
    try {
      reply._id = new ObjectId(reply._id as string);
    } catch (error) {
      return Promise.reject("Invalid terminal echo reply id.");
    }

    const updatedAt = new Date();
    const setFields: any = { updatedAt };
    if (reply.terminalEchoId !== undefined)
      setFields.terminalEchoId = new ObjectId(reply.terminalEchoId as string);
    if (reply.audioUrl !== undefined) setFields.audioUrl = reply.audioUrl;
    if (reply.textMessage !== undefined) setFields.textMessage = reply.textMessage;
    if (reply.countReactLike !== undefined) setFields.countReactLike = reply.countReactLike;
    if (reply.countReactLove !== undefined) setFields.countReactLove = reply.countReactLove;
    if (reply.countReactHaha !== undefined) setFields.countReactHaha = reply.countReactHaha;
    if (reply.countReactWow !== undefined) setFields.countReactWow = reply.countReactWow;
    if (reply.countReactSad !== undefined) setFields.countReactSad = reply.countReactSad;
    if (reply.countReactAngry !== undefined) setFields.countReactAngry = reply.countReactAngry;

    return this.collection().updateOne({ _id: reply._id }, { $set: setFields });
  }

  static async delete(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch (error) {
      return Promise.reject("Invalid terminal echo reply id.");
    }

    try {
      await this.collection().deleteOne({ _id });
      return Promise.resolve("Successfully deleted terminal echo reply.");
    } catch (error) {
      return Promise.reject("Server internal error.");
    }
  }
}
