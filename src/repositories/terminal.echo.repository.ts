import { ObjectId } from "mongodb";
import { MTerminalEcho, TTerminalEcho, TTerminalEchoUpdateOptions } from "../models/terminal.echo.model";
import { getDB } from "../utils/mongo";

export default class TerminalEchoRepo {
  static collection() {
    return getDB().collection("terminal.echo");
  }

  /**
   * Returns all terminal echoes sorted latest -> oldest.
   * Includes file + user lookup and replyCount like airport search.
   */
  static async findAllWithFile() {
    return this.collection()
      .aggregate([
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

  static async createForAudio(
    senderId: string | ObjectId,
    fileId: string | ObjectId,
    location?: { type: "Point"; coordinates: [number, number] },
    airportName?: string
  ) {
    try {
      senderId = new ObjectId(senderId);
      fileId = new ObjectId(fileId);
    } catch (error) {
      return Promise.reject("Invalid sender id or file id.");
    }
    const echo: TTerminalEcho = {
      senderId,
      airportName,
      fileId,
      location: location ?? { type: "Point", coordinates: [0, 0] },
    };
    return this.collection().insertOne(new MTerminalEcho(echo));
  }

  static async createForTextMessage(
    senderId: string | ObjectId,
    textMessage: string,
    location?: { type: "Point"; coordinates: [number, number] },
    airportName?: string
  ) {
    try {
      senderId = new ObjectId(senderId);
    } catch (error) {
      return Promise.reject("Invalid sender id.");
    }
    const echo: TTerminalEcho = {
      senderId,
      airportName,
      textMessage,
      location: location ?? { type: "Point", coordinates: [0, 0] },
    };
    return this.collection().insertOne(new MTerminalEcho(echo));
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

  static async findLatestBySenderIdsWithFile(senderIds: ObjectId[]) {
    if (!senderIds?.length) return [];

    return this.collection()
      .aggregate([
        { $match: { senderId: { $in: senderIds } } },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$senderId",
            echo: { $first: "$$ROOT" },
          },
        },
        { $replaceRoot: { newRoot: "$echo" } },
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
      ])
      .toArray();
  }

  /**
   * Returns all terminal echoes for the given senderIds (batch), sorted latest -> oldest.
   * Includes `file` lookup like other echo queries.
   */
  static async findBySenderIdsWithFileSorted(senderIds: ObjectId[]) {
    if (!senderIds?.length) return [];

    return this.collection()
      .aggregate([
        { $match: { senderId: { $in: senderIds } } },
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
      ])
      .toArray();
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
