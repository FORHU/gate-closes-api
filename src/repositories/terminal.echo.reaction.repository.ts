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

  /**
   * toggleReaction
   * ----------------
   * ATOMIC toggle: attempts a delete first, then falls back to an
   * insert. This replaces the old "findOne, then decide create vs
   * delete" pattern, which had a race condition — two near-simultaneous
   * requests for the same user/echo/reaction could both read "doesn't
   * exist yet" before either finished writing, causing both to
   * increment when the correct outcome should have been
   * increment-then-decrement (a net no-op).
   *
   * Relies on a UNIQUE INDEX on {terminalEchoId, userId, reaction}
   * (created in utils/mongo.ts's connectToMongo) to make duplicates
   * physically impossible. If a concurrent insert wins the race
   * between our delete attempt and our own insert, we get a
   * duplicate-key error (Mongo error code 11000) — in that case we
   * simply retry the whole sequence, and the retry's delete step will
   * correctly find and remove the document the other request just
   * created.
   *
   * Returns the direction actually taken: "increment" or "decrement".
   */
  static async toggleReaction(
    params: {
      terminalEchoId: string | ObjectId;
      userId: string | ObjectId;
      reaction: string;
    },
    maxRetries = 3
  ): Promise<"increment" | "decrement"> {
    const terminalEchoId = new ObjectId(params.terminalEchoId as string);
    const userId = new ObjectId(params.userId as string);
    const { reaction } = params;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Step 1: try to delete. deleteOne is atomic — if a document
      // exists, exactly one caller can successfully remove it.
      const deleteResult = await this.collection().deleteOne({
        terminalEchoId,
        userId,
        reaction,
      });

      if (deleteResult.deletedCount === 1) {
        return "decrement";
      }

      // Step 2: nothing existed to delete — try to insert.
      try {
        await this.collection().insertOne(
          new MTerminalEchoReaction({ terminalEchoId, userId, reaction } as any)
        );
        return "increment";
      } catch (err: any) {
        // 11000 = duplicate key error. Someone else's insert won the
        // race between our delete attempt and our own insert — retry
        // the whole sequence; the next delete attempt will now find
        // and remove that just-inserted document correctly.
        if (err?.code === 11000) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      "Failed to toggle reaction after multiple retries — possible sustained contention."
    );
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