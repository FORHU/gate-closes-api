import { ObjectId } from "mongodb";
import {
  MTerminalEchoReplyReaction,
  TTerminalEchoReplyReaction,
  TTerminalEchoReplyReactionQuery,
} from "../models/terminal.echo.reply.reaction.model";
import { getDB } from "../utils/mongo";

export default class TerminalEchoReplyReactionRepo {
  static collection() {
    return getDB().collection("terminal.echo.reply.reaction");
  }

  static async create(reaction: TTerminalEchoReplyReaction) {
    return this.collection().insertOne(
      new MTerminalEchoReplyReaction(reaction)
    );
  }

  static async findOne(query: TTerminalEchoReplyReactionQuery) {
    const filter: any = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.terminalEchoReplyId)
      filter.terminalEchoReplyId = new ObjectId(
        query.terminalEchoReplyId as string
      );
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().findOne(filter);
  }

  static async deleteOne(query: TTerminalEchoReplyReactionQuery) {
    const filter: any = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.terminalEchoReplyId)
      filter.terminalEchoReplyId = new ObjectId(
        query.terminalEchoReplyId as string
      );
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().deleteOne(filter);
  }

  /** Batch: all reactions by this user for the given reply ids. Used to enrich reply list. */
  static async findByUserIdAndReplyIds(
    userId: string | ObjectId,
    replyIds: (string | ObjectId)[]
  ) {
    const ids = replyIds.map((id) => new ObjectId(id));
    return this.collection()
      .find({
        userId: new ObjectId(userId as string),
        terminalEchoReplyId: { $in: ids },
      })
      .toArray();
  }
}

