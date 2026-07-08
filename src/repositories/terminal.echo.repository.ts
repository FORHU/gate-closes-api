import { ObjectId } from "mongodb";
import { MTerminalEcho, TTerminalEcho, TTerminalEchoUpdateOptions } from "../models/terminal.echo.model";
import type { TerminalEchoMapBounds } from "../const";
import { getDB } from "../utils/mongo";

export default class TerminalEchoRepo {
  static collection() {
    return getDB().collection("terminal.echo");
  }

  /**
   * Terminal echoes for map: no file/user/reply joins.
   * With bounds: geo filter, latest first, max 100. Without bounds: all, sorted latest first.
   */
  static async findAllForMap(mapBounds?: TerminalEchoMapBounds) {
    let pipeline: Record<string, unknown>[];
    if (mapBounds) {
      const [[west, south], [east, north]] = mapBounds;
      pipeline = [
        {
          $match: {
            location: {
              $geoWithin: {
                $geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [west, south],
                      [east, south],
                      [east, north],
                      [west, north],
                      [west, south],
                    ],
                  ],
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 100 },
      ];
    } else {
      pipeline = [{ $sort: { createdAt: -1, _id: -1 } }];
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

  static async findByAirportNameWithFile(airportName: string) {
    const regex = new RegExp(airportName, "i");
    return this.collection()
      .aggregate([
        { $match: { airportName: regex } },
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
      { returnDocument: "after" }
    );
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