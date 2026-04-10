import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MBtConversationMessage, TBtConversationMessage } from "../models/bt.conversation.message.model";

export default class BtConversationMessageRepo {
    static collection() {
        return getDB().collection("btConversationMessage");
    }

    static async create (message: TBtConversationMessage) {
        return this.collection().insertOne(new MBtConversationMessage(message));
    }

    static async listByConversationId(btConversationId: ObjectId, limit: number) {
        return this.collection()
        .aggregate([
            { $match: { btConversationId } },
            { $sort: { createdAt: -1 } },
            { $limit: limit },
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
                    let: { senderId: "$btSenderId" },
                    pipeline: [
                        {
                            $match: { $expr: { $eq: ["$_id", "$$senderId"] } },
                        },
                        {
                            $project: {
                                _id: 1,
                                username: 1,
                                gender: 1,
                            },
                        },
                    ],
                    as: "sender",
                },
            },
            {
                $unwind: {
                    path: "$sender",
                    preserveNullAndEmptyArrays: true,
                },
            },
        ]).toArray();
    }
    
    static async updateReaction(_id: ObjectId, reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry", action: "increment" | "decrement") {
        try {
            _id = new ObjectId(_id);
        } catch {
            return Promise.reject("Invalid conversation message id.");
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
                            $max: [0, { $add: [{ $ifNull: [`$${fieldName}`, 0] }, delta] }],
                        },
                    },
                },
            ],
            { returnDocument: "after" }
        );
    }
}