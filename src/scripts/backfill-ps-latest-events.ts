import "dotenv/config";
import { ObjectId } from "mongodb";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationSvc from "../services/ps.conversation.service";
import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";

type TArgs = {
  dryRun: boolean;
  batchSize: number;
  fromId?: ObjectId;
  createIndex: boolean;
};

const parseArgs = (): TArgs => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const createIndex = args.includes("--create-index");

  const batchSizeIndex = args.indexOf("--batch-size");
  const batchSize =
    batchSizeIndex > -1 && args[batchSizeIndex + 1]
      ? Number(args[batchSizeIndex + 1])
      : 200;

  const fromIndex = args.indexOf("--from");
  const fromRaw = fromIndex > -1 ? args[fromIndex + 1] : undefined;
  const fromId = fromRaw ? new ObjectId(fromRaw) : undefined;

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Invalid --batch-size. Must be a positive integer.");
  }

  return { dryRun, batchSize, fromId, createIndex };
};

const buildLatestFromConversation = async (conversationId: ObjectId) => {
  const db = getDB();
  const messageCollection = db.collection("psConversationMessage");
  const reactionCollection = db.collection("psConversationMessage.reaction");

  const [latestMessage] = await messageCollection
    .find({ psConversationId: conversationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .toArray();

  const [latestReaction] = await reactionCollection
    .aggregate([
      {
        $lookup: {
          from: "psConversationMessage",
          localField: "psConversationMessageId",
          foreignField: "_id",
          as: "message",
        },
      },
      {
        $unwind: {
          path: "$message",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "message.psConversationId": conversationId,
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 },
    ])
    .toArray();

  if (!latestMessage && !latestReaction) return null;

  const latestMessageAt = latestMessage?.createdAt
    ? new Date(latestMessage.createdAt)
    : null;
  const latestReactionAt = latestReaction?.createdAt
    ? new Date(latestReaction.createdAt)
    : null;

  if (
    latestReaction &&
    latestReactionAt &&
    (!latestMessageAt || latestReactionAt >= latestMessageAt)
  ) {
    return {
      type: "message_reacted" as const,
      at: latestReactionAt,
      actorId: latestReaction.userId as ObjectId,
      payload: {
        messageId: latestReaction.psConversationMessageId,
        reaction: latestReaction.reaction,
      },
    };
  }

  return {
    type: "message_sent" as const,
    at: latestMessageAt ?? new Date(),
    actorId: latestMessage.psSenderId as ObjectId,
    payload: {
      messageId: latestMessage._id,
    },
  };
};

const main = async () => {
  const args = parseArgs();
  await connectToMongo();

  if (args.createIndex && !args.dryRun) {
    await PsConversationRepo.createInboxSortIndex();
  }

  let lastSeenId = args.fromId;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  while (true) {
    const filter = lastSeenId ? { _id: { $gt: lastSeenId } } : {};
    const conversations = await PsConversationRepo.collection()
      .find(filter)
      .sort({ _id: 1 })
      .limit(args.batchSize)
      .toArray();

    if (!conversations.length) break;

    for (const conversation of conversations as any[]) {
      processed += 1;
      lastSeenId = conversation._id as ObjectId;

      try {
        const event = await buildLatestFromConversation(conversation._id as ObjectId);
        if (!event) {
          skipped += 1;
          continue;
        }

        if (args.dryRun) {
          updated += 1;
          continue;
        }

        await PsConversationSvc.refreshConversationLatestEvent({
          conversationId: conversation._id as ObjectId,
          type: event.type,
          actorId: event.actorId,
          payload: event.payload,
          at: event.at,
        });
        updated += 1;
      } catch (error) {
        errors += 1;
        console.error(
          `[backfill-ps-latest-events] conversation=${String(
            conversation._id
          )} error=${(error as Error)?.message ?? error}`
        );
      }
    }

    console.log(
      JSON.stringify({
        processed,
        updated,
        skipped,
        errors,
        checkpoint: lastSeenId?.toHexString() ?? null,
        dryRun: args.dryRun,
      })
    );
  }

  console.log(
    `[backfill-ps-latest-events] done processed=${processed} updated=${updated} skipped=${skipped} errors=${errors} checkpoint=${
      lastSeenId?.toHexString() ?? "none"
    }`
  );
};

main()
  .catch((error) => {
    console.error(
      `[backfill-ps-latest-events] fatal: ${(error as Error)?.message ?? error}`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = useMongoClient();
    if (client) await client.close();
  });
