import { ObjectId } from "mongodb";
import {
  MTerminalEchoReplyReaction,
  TTerminalEchoReplyReaction,
  TTerminalEchoReplyReactionQuery,
  TTerminalEchoReplyReactionType,
} from "../models/terminal.echo.reply.reaction.model";
import { getDB } from "../utils/mongo";
import { isDuplicateKeyError } from "../utils/error.util";

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
    const filter: Record<string, unknown> = {};
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
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.terminalEchoReplyId)
      filter.terminalEchoReplyId = new ObjectId(
        query.terminalEchoReplyId as string
      );
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().deleteOne(filter);
  }

  /**
   * toggleReaction
   * ----------------
   * Same atomic delete-then-insert-with-retry pattern as
   * TerminalEchoReactionRepo.toggleReaction — see that file's comment
   * for full rationale. Requires a UNIQUE INDEX on
   * {terminalEchoReplyId, userId, reaction} (created in
   * utils/mongo.ts's connectToMongo).
   *
   * Returns the direction actually taken: "increment" or "decrement".
   */
  static async toggleReaction(
    params: {
      terminalEchoReplyId: string | ObjectId;
      userId: string | ObjectId;
      reaction: TTerminalEchoReplyReactionType;
    },
    maxRetries = 3
  ): Promise<"increment" | "decrement"> {
    const terminalEchoReplyId = new ObjectId(params.terminalEchoReplyId as string);
    const userId = new ObjectId(params.userId as string);
    const { reaction } = params;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const deleteResult = await this.collection().deleteOne({
        terminalEchoReplyId,
        userId,
        reaction,
      });

      if (deleteResult.deletedCount === 1) {
        return "decrement";
      }

      try {
        await this.collection().insertOne(
          new MTerminalEchoReplyReaction({
            terminalEchoReplyId,
            userId,
            reaction,
          })
        );
        return "increment";
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      "Failed to toggle reaction after multiple retries — possible sustained contention."
    );
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