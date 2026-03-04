import { ObjectId } from "mongodb";
import {
  MTerminalEchoReaction,
  TTerminalEchoReaction,
  TTerminalEchoReactionQuery,
} from "../models/terminal.echo.reaction.model";
import { getDB } from "../utils/mongo";

export default class TerminalEchoReactionRepo {
  static collection() {
    return getDB().collection("terminal.echo.reaction");
  }

  static async create(reaction: TTerminalEchoReaction) {
    return this.collection().insertOne(new MTerminalEchoReaction(reaction));
  }

  static async findOne(query: TTerminalEchoReactionQuery) {
    const filter: any = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.terminalEchoId)
      filter.terminalEchoId = new ObjectId(query.terminalEchoId as string);
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().findOne(filter);
  }

  static async deleteOne(query: TTerminalEchoReactionQuery) {
    const filter: any = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.terminalEchoId)
      filter.terminalEchoId = new ObjectId(query.terminalEchoId as string);
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().deleteOne(filter);
  }

  /** Batch: all reactions by this user for the given echo ids. Used to enrich search results. */
  static async findByUserIdAndTerminalEchoIds(
    userId: string | ObjectId,
    terminalEchoIds: (string | ObjectId)[]
  ) {
    const ids = terminalEchoIds.map((id) => new ObjectId(id));
    return this.collection()
      .find({
        userId: new ObjectId(userId as string),
        terminalEchoId: { $in: ids },
      })
      .toArray();
  }
}

