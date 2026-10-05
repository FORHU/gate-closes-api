import { Document, ObjectId } from "mongodb";
import {
  MTerminalEcho,
  TTerminalEcho,
  TTerminalEchoUpdateOptions,
} from "../models/terminal.echo.model";
import type { TerminalEchoMapBounds } from "../const";
import { getDB } from "../utils/mongo";

export default class TerminalEchoRepo {
  static collection() {
    return getDB().collection("terminal.echo");
  }

  /**
   * `$match` for echoes inside a map view, as a plain lng/lat range on the
   * point's coordinates, the same flat rectangle the map shows.
   *
   * Not `$geoWithin` with a Polygon: Mongo reads polygon edges as geodesics
   * and a ring wider than 180° as the smaller complementary region, so a
   * zoomed-out view (where pins cluster) matched the wrong pins or none.
   * `west > east` is a view crossing the antimeridian.
   */
  static mapBoundsMatch(mapBounds: TerminalEchoMapBounds): Record<string, unknown> {
    const [[west, south], [east, north]] = mapBounds;
    const lng = "location.coordinates.0";
    const lat = "location.coordinates.1";
    const match: Record<string, unknown> = {
      "location.type": "Point",
      [lat]: { $gte: south, $lte: north },
    };
    if (west > east) {
      match.$or = [{ [lng]: { $gte: west } }, { [lng]: { $lte: east } }];
    } else if (west > -180 || east < 180) {
      match[lng] = { $gte: west, $lte: east };
    }
    return match;
  }

  /**
   * Terminal echoes for map: no file/user/reply joins.
   * With bounds: view filter, latest first, max 100. Without bounds: all, sorted latest first.
   */
  static async findAllForMap(mapBounds?: TerminalEchoMapBounds) {
    let pipeline: Record<string, unknown>[];
    if (mapBounds) {
      pipeline = [
        { $match: this.mapBoundsMatch(mapBounds) },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 100 },
      ];
    } else {
      // Unbounded requests still get a cap: returning every echo ever posted
      // grows without limit and is what runs mobile map bridges out of memory.
      pipeline = [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 200 }];
    }

    return this.collection().aggregate(pipeline).toArray();
  }

  /** Single echo with file, user, and replyCount (detail view). */
  static async findByIdWithFile(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }

    const rows = await this.collection()
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
        {
          $lookup: {
            from: "terminal.echo.reply",
            localField: "_id",
            foreignField: "terminalEchoId",
            as: "replies",
          },
        },
        {
          $addFields: {
            replyCount: { $size: "$replies" },
          },
        },
        {
          $project: {
            replies: 0,
          },
        },
      ])
      .toArray();

    return rows[0] ?? null;
  }

  static async create(echo: TTerminalEcho) {
    return this.collection().insertOne(new MTerminalEcho(echo));
  }

  /** Minimal lookup used to scope reply/reaction broadcasts to the parent echo's airport room. */
  static async findAirportIataById(_id: string | ObjectId): Promise<string | null> {
    try {
      _id = new ObjectId(_id);
    } catch {
      return null;
    }
    const doc = await this.collection().findOne<{ airportIata?: string }>(
      { _id },
      { projection: { airportIata: 1 } }
    );
    return doc?.airportIata || null;
  }

  /**
   * Terminal echo feed with file/user/reply joins. Pass airportName to
   * filter to one terminal; omit it to fetch every echo (Feed tab's
   * unfiltered default) — latest first either way.
   */
  /**
   * Feed filter for one airport. Clients send either an IATA code (Flutter:
   * `MNL`) or an airport name (Expo), so match the stored `airportIata`
   * exactly or the name as literal text. The input is escaped: it is user
   * text, never a pattern.
   */
  static feedAirportFilter(airport: string): Document {
    const text = airport.trim();
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      $or: [{ airportIata: text.toUpperCase() }, { airportName: new RegExp(escaped, "i") }],
    };
  }

  static async findByAirportNameWithFile(airportName?: string) {
    const matchStage = airportName?.trim() ? [{ $match: this.feedAirportFilter(airportName) }] : [];
    return this.collection()
      .aggregate([
        ...matchStage,
        { $sort: { createdAt: -1, _id: -1 } },
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
        {
          $lookup: {
            from: "terminal.echo.reply",
            localField: "_id",
            foreignField: "terminalEchoId",
            as: "replies",
          },
        },
        {
          $addFields: {
            replyCount: { $size: "$replies" },
          },
        },
        {
          $project: {
            replies: 0,
          },
        },
      ])
      .toArray();
  }

  static async incrementListen(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }

    return this.collection().findOneAndUpdate(
      { _id },
      {
        $inc: { countListens: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" }
    );
  }

  static async updateReaction(
    _id: string | ObjectId,
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry",
    action: "increment" | "decrement"
  ) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
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

  static async update(echo: TTerminalEchoUpdateOptions) {
    try {
      echo._id = new ObjectId(echo._id as string);
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }

    const updatedAt = new Date();
    const setFields: Record<string, unknown> = { updatedAt };
    if (echo.senderId !== undefined) setFields.senderId = new ObjectId(echo.senderId as string);
    if (echo.airportName !== undefined) setFields.airportName = echo.airportName;
    if (echo.fileId !== undefined) setFields.fileId = new ObjectId(echo.fileId as string);
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
    } catch {
      return Promise.reject("Invalid terminal echo id.");
    }

    try {
      await this.collection().deleteOne({ _id });
      return Promise.resolve("Successfully deleted terminal echo.");
    } catch {
      return Promise.reject("Server internal error.");
    }
  }
}
