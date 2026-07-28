import { ObjectId } from "mongodb";
import { MTerminalEchoReply, TTerminalEchoReply, TTerminalEchoReplyUpdateOptions } from "../models/terminal.echo.reply.model";
import { getDB } from "../utils/mongo";

export default class TerminalEchoReplyRepo {
  static collection() {
    return getDB().collection("terminal.echo.reply");
  }

  static async create(reply: TTerminalEchoReply) {
    return this.collection().insertOne(new MTerminalEchoReply(reply));
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo reply id.");
    }
    return this.collection().findOne({ _id });
  }

  static async findByTerminalEchoId(terminalEchoId: string | ObjectId) {
    try {
      terminalEchoId = new ObjectId(terminalEchoId);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }
    return this.collection().find({ terminalEchoId }).toArray();
  }

  /**
   * Fetches ALL replies for a given echo, enriched with:
   *   - `file`: the associated audio file document (if any) — text-only
   *     replies have no fileId, so `preserveNullAndEmptyArrays: true` on
   *     the $unwind is essential; without it, text-only replies would be
   *     silently dropped from the results entirely.
   *   - `user`: sender's username/gender, for alias display.
   *
   * Used for the initial full-thread load (one call per thread open).
   */
  static async findByTerminalEchoIdWithFile(terminalEchoId: string | ObjectId) {
    try {
      terminalEchoId = new ObjectId(terminalEchoId);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }

    return this.collection()
      .aggregate([
        { $match: { terminalEchoId } },
        {
          $lookup: {
            from: "file",
            localField: "fileId",
            foreignField: "_id",
            as: "file",
          },
        },
        {
          $unwind: {
            path: "$file",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "user",
            let: { senderId: "$senderId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$senderId"] },
                },
              },
              {
                $project: {
                  _id: 1,
                  username: 1,
                  gender: 1,
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();
  }

  /**
   * Fetches a SINGLE reply by its own _id, with the same file/user
   * enrichment as findByTerminalEchoIdWithFile above.
   *
   * Used by the "append, don't refetch" real-time flow: when the
   * backend emits `terminal_echo_reply:created` after a new reply is
   * posted, the payload now includes the full reply document directly
   * (built via this method), so no separate client fetch is needed.
   *
   * Returns `null` if no reply with that id exists.
   */
  static async findByIdWithFile(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }

    const results = await this.collection()
      .aggregate([
        { $match: { _id } },
        {
          $lookup: {
            from: "file",
            localField: "fileId",
            foreignField: "_id",
            as: "file",
          },
        },
        {
          $unwind: {
            path: "$file",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "user",
            let: { senderId: "$senderId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$senderId"] } } },
              { $project: { _id: 1, username: 1, gender: 1 } },
            ],
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();

    return results[0] ?? null;
  }

  static async update(reply: TTerminalEchoReplyUpdateOptions) {
    try {
      reply._id = new ObjectId(reply._id as string);
    } catch {
      return Promise.reject("Invalid terminal echo reply id.");
    }

    const updatedAt = new Date();
    const setFields: Record<string, unknown> = { updatedAt };
    if (reply.terminalEchoId !== undefined)
      setFields.terminalEchoId = new ObjectId(reply.terminalEchoId as string);
    if (reply.senderId !== undefined)
      setFields.senderId = new ObjectId(reply.senderId as string);
    if (reply.fileId !== undefined)
      setFields.fileId = new ObjectId(reply.fileId as string);
    if (reply.countListens !== undefined) setFields.countListens = reply.countListens;
    if (reply.countReactLike !== undefined) setFields.countReactLike = reply.countReactLike;
    if (reply.countReactLove !== undefined) setFields.countReactLove = reply.countReactLove;
    if (reply.countReactHaha !== undefined) setFields.countReactHaha = reply.countReactHaha;
    if (reply.countReactWow !== undefined) setFields.countReactWow = reply.countReactWow;
    if (reply.countReactSad !== undefined) setFields.countReactSad = reply.countReactSad;
    if (reply.countReactAngry !== undefined) setFields.countReactAngry = reply.countReactAngry;

    return this.collection().updateOne({ _id: reply._id }, { $set: setFields });
  }

  /**
   * FIX: added `includeResultMetadata: true`.
   *
   * On MongoDB Node driver v6+, `findOneAndUpdate` returns the updated
   * document DIRECTLY by default — the old `{ value, ok, lastErrorObject }`
   * wrapper shape is now opt-in via `includeResultMetadata: true`. This
   * method's callers (the service, then the controller) expect the old
   * wrapped shape (`result.value`), so without this flag `result.value`
   * silently resolves to `undefined` on driver v6+ rather than throwing —
   * which is why this went unnoticed until the equivalent bug in
   * updateReaction below caused a visible symptom (missing socket
   * broadcasts).
   */
  static async incrementListen(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo reply id.");
    }

    return this.collection().findOneAndUpdate(
      { _id },
      {
        $inc: { countListens: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after", includeResultMetadata: true }
    );
  }

  /**
   * FIX: added `includeResultMetadata: true`.
   *
   * Same root cause as incrementListen above. Without this flag, on
   * driver v6+, the returned document has no `.value` wrapper, so
   * `result.value.terminalEchoId` in the controller (used to pick the
   * `thread:<id>` room to broadcast the reaction update to) silently
   * evaluated to `undefined` — the broadcast was skipped every time,
   * with no error anywhere in the chain. Restoring the wrapped shape
   * fixes `result.value.terminalEchoId` in the controller without
   * requiring any service/controller changes.
   */
  static async updateReaction(
    _id: string | ObjectId,
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry",
    action: "increment" | "decrement"
  ) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo reply id.");
    }

    const reactionFieldMap = {
      like: "countReactLike",
      love: "countReactLove",
      haha: "countReactHaha",
      wow: "countReactWow",
      sad: "countReactSad",
      angry: "countReactAngry",
    } as const;

    const fieldName = reactionFieldMap[reaction];

    if (!fieldName) {
      return Promise.reject("Invalid reaction type.");
    }

    const delta = action === "increment" ? 1 : -1;

    return this.collection().findOneAndUpdate(
      { _id },
      [
        { $set: { updatedAt: new Date() } },
        {
          $set: {
            [fieldName]: {
              $max: [
                0,
                {
                  $add: [{ $ifNull: [`$${fieldName}`, 0] }, delta],
                },
              ],
            },
          },
        },
      ],
      { returnDocument: "after", includeResultMetadata: true }
    );
  }

  static async delete(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo reply id.");
    }

    try {
      await this.collection().deleteOne({ _id });
      return Promise.resolve("Successfully deleted terminal echo reply.");
    } catch {
      return Promise.reject("Server internal error.");
    }
  }
}