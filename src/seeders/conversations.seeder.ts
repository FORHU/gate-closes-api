import { Db, ObjectId } from "mongodb";
import {
  REACTIONS,
  dateOffsetDays,
  dmKeyForUsers,
  log,
  randomInt,
  randomItem,
  reactionCountField,
  uniquePairs,
  type Reaction,
  type SeededUser,
} from "./helpers";

// bt/dt/ps conversations are structurally identical parallel features (1:1
// DM threads), differing only by field-name prefix (btSenderId vs dtSenderId
// vs psSenderId, etc.) — seeded through one generic namespace-driven helper
// rather than three copy-pasted blocks.
export const CONVERSATION_NAMESPACES = [
  {
    prefix: "bt",
    conversation: "btConversation",
    message: "btConversationMessage",
    reaction: "btConversationMessage.reaction",
    readState: "btConversationReadState",
  },
  {
    prefix: "dt",
    conversation: "dtConversation",
    message: "dtConversationMessage",
    reaction: "dtConversationMessage.reaction",
    readState: "dtConversationReadState",
  },
  {
    prefix: "ps",
    conversation: "psConversation",
    message: "psConversationMessage",
    reaction: "psConversationMessage.reaction",
    readState: "psConversationReadState",
  },
] as const;

/** 4 conversations per kind (Baton Touch, Destination Thread, Parallel Soul). */
export async function seedConversations(db: Db, users: SeededUser[], files: ObjectId[]) {
  for (const ns of CONVERSATION_NAMESPACES) {
    await seedConversationNamespace(db, ns, users, files);
  }
}

async function seedConversationNamespace(
  db: Db,
  ns: (typeof CONVERSATION_NAMESPACES)[number],
  users: SeededUser[],
  files: ObjectId[]
) {
  const conversationCollection = db.collection(ns.conversation);
  const messageCollection = db.collection(ns.message);
  const reactionCollection = db.collection(ns.reaction);
  const readStateCollection = db.collection(ns.readState);

  const senderIdField = `${ns.prefix}SenderId`;
  const conversationIdField = `${ns.prefix}ConversationId`;
  const messageIdField = `${ns.prefix}ConversationMessageId`;

  const usersById = new Map(users.map((u) => [u._id.toHexString(), u]));
  const pairs = uniquePairs(
    users.map((u) => u._id),
    4
  );

  let conversationCount = 0;
  let messageCount = 0;
  let reactionCount = 0;
  let readStateCount = 0;

  for (const [a, b] of pairs) {
    const createdAt = dateOffsetDays(-randomInt(1, 20));
    const conversationId = new ObjectId();
    await conversationCollection.insertOne({
      _id: conversationId,
      participants: [a, b],
      dmKey: dmKeyForUsers(a, b),
      createdAt,
    });
    conversationCount += 1;

    const messageTotal = randomInt(3, 6);
    let lastMessage: { _id: ObjectId; senderId: ObjectId; createdAt: Date } | null = null;

    for (let m = 0; m < messageTotal; m += 1) {
      const senderId = Math.random() < 0.5 ? a : b;
      const messageId = new ObjectId();
      const messageCreatedAt = dateOffsetDays(-randomInt(0, 19));
      await messageCollection.insertOne({
        _id: messageId,
        [senderIdField]: senderId,
        [conversationIdField]: conversationId,
        fileId: randomItem(files),
        countReactLike: 0,
        countReactLove: 0,
        countReactHaha: 0,
        countReactWow: 0,
        countReactSad: 0,
        countReactAngry: 0,
        createdAt: messageCreatedAt,
      });
      messageCount += 1;

      if (Math.random() < 0.3) {
        const reactorId = senderId.equals(a) ? b : a;
        const reaction: Reaction = randomItem(REACTIONS);
        await reactionCollection.insertOne({
          _id: new ObjectId(),
          [messageIdField]: messageId,
          userId: reactorId,
          reaction,
          createdAt: new Date(),
        });
        await messageCollection.updateOne(
          { _id: messageId },
          { $inc: { [reactionCountField(reaction)]: 1 } }
        );
        reactionCount += 1;
      }

      if (!lastMessage || messageCreatedAt > lastMessage.createdAt) {
        lastMessage = { _id: messageId, senderId, createdAt: messageCreatedAt };
      }
    }

    if (lastMessage) {
      const actorName = usersById.get(lastMessage.senderId.toHexString())?.username ?? "Someone";
      await conversationCollection.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastEventType: "message_sent",
            lastEventAt: lastMessage.createdAt,
            lastEventActorId: lastMessage.senderId,
            lastEventActorName: actorName,
            lastEventText: `${actorName} sent a new message`,
          },
        }
      );
    }

    // Read state per participant — one reads up to the last message
    // (no unread badge), the other reads slightly earlier (has an unread).
    for (const participant of [a, b]) {
      const lastReadAt = lastMessage
        ? Math.random() < 0.5
          ? lastMessage.createdAt
          : dateOffsetDays(-randomInt(0, 5))
        : createdAt;
      await readStateCollection.insertOne({
        _id: new ObjectId(),
        [conversationIdField]: conversationId,
        userId: participant,
        lastReadAt,
        createdAt,
      });
      readStateCount += 1;
    }
  }

  log(
    `${ns.conversation}: ${conversationCount}, messages: ${messageCount}, ` +
      `reactions: ${reactionCount}, read states: ${readStateCount}`
  );
}
