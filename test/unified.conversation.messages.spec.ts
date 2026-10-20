import { expect } from "chai";
import { describe, it, beforeEach } from "mocha";
import { ObjectId } from "mongodb";
import ConversationSvc from "../src/services/conversation.service";
import ConversationRepo from "../src/repositories/conversation.repository";
import ConversationMessageRepo from "../src/repositories/conversation.message.repository";
import ConversationMessageReactionRepo from "../src/repositories/conversation.message.reaction.repository";
import FileSvc from "../src/services/file.service";
import UserRepo from "../src/repositories/user.repository";

describe("Unified Conversation Messages & Reactions Domain (§15, §21)", () => {
  const userA = new ObjectId("650000000000000000000001");
  const userB = new ObjectId("650000000000000000000002");
  const stranger = new ObjectId("650000000000000000000099");
  const testConvoId = new ObjectId("6500000000000000000000aa");

  const mockConvo = {
    _id: testConvoId,
    type: "parallel_soul",
    participants: [userA, userB],
    dmKey: "parallel_soul:650000000000000000000001:650000000000000000000002",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    (ConversationRepo as any).collection = () => ({
      findOne: async (filter: any) => {
        if (filter._id && String(filter._id) === String(testConvoId)) {
          if (filter.participants) {
            const hasP = mockConvo.participants.some(
              (p) => String(p) === String(filter.participants)
            );
            return hasP ? mockConvo : null;
          }
          return mockConvo;
        }
        return null;
      },
      updateOne: async () => ({ acknowledged: true }),
    });

    (UserRepo as any).collection = () => ({
      findOne: async (filter: any) => {
        if (String(filter._id) === String(userA)) {
          return { _id: userA, username: "Alice" };
        }
        if (String(filter._id) === String(userB)) {
          return { _id: userB, username: "Bob" };
        }
        return null;
      },
    });
  });

  it("should reject message creation from non-participants", async () => {
    try {
      await ConversationSvc.sendMessage({
        conversationId: testConvoId,
        senderId: stranger,
        textMessage: "Hello from outside",
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.include("Not a participant");
    }
  });

  it("should persist message, update conversation summary, and return hydrated message", async () => {
    const insertedMessageId = new ObjectId("6500000000000000000000bb");
    let persistedMsg: any = null;
    let fileCreated: any = null;

    (FileSvc as any).create = async (doc: any) => {
      fileCreated = doc;
      return { insertedId: new ObjectId("6500000000000000000000cc") };
    };

    (ConversationMessageRepo as any).create = async (msg: any) => {
      persistedMsg = msg;
      return { insertedId: insertedMessageId };
    };

    (ConversationMessageRepo as any).findByIdWithDetails = async (id: any) => {
      return {
        _id: insertedMessageId,
        conversationId: testConvoId,
        senderId: userA,
        textMessage: "Gate closing soon!",
        fileId: new ObjectId("6500000000000000000000cc"),
        file: {
          fileUrl: "https://example.com/audio.m4a",
          fileName: "audio.m4a",
          metaData: { audioDuration: 8.5 },
        },
        sender: {
          _id: userA,
          username: "Alice",
        },
      };
    };

    let updatedEvent: any = null;
    (ConversationRepo as any).updateLatestEvent = async (convoId: any, event: any) => {
      updatedEvent = event;
    };

    const result = await ConversationSvc.sendMessage({
      conversationId: testConvoId,
      senderId: userA,
      textMessage: "Gate closing soon!",
      fileUrl: "https://example.com/audio.m4a",
      fileName: "audio.m4a",
      audioDuration: 8.5,
      waveformData: [0.1, 0.5, 0.9],
    });

    expect(result).to.exist;
    expect(result.message).to.exist;
    expect(result.message!._id).to.deep.equal(insertedMessageId);
    expect(result.message!.textMessage).to.equal("Gate closing soon!");

    expect(persistedMsg).to.exist;
    expect(persistedMsg.senderId).to.deep.equal(userA);
    expect(persistedMsg.conversationId).to.deep.equal(testConvoId);

    expect(fileCreated).to.exist;
    expect(fileCreated.fileName).to.equal("audio.m4a");

    expect(updatedEvent).to.exist;
    expect(updatedEvent.type).to.equal("message_sent");
    expect(updatedEvent.actorName).to.equal("Alice");
  });

  it("should list messages enriched with current user reactions", async () => {
    const msg1 = new ObjectId();
    const msg2 = new ObjectId();

    (ConversationMessageRepo as any).listByConversationId = async () => [
      { _id: msg1, conversationId: testConvoId, textMessage: "Msg 1" },
      { _id: msg2, conversationId: testConvoId, textMessage: "Msg 2" },
    ];

    (ConversationMessageReactionRepo as any).findByUserIdAndMessageIds = async (
      userId: any,
      ids: any[]
    ) => [
      { messageId: msg1, userId: userA, reaction: "love" },
      { messageId: msg2, userId: userA, reaction: "like" },
    ];

    const messages = await ConversationSvc.listMessages({
      conversationId: testConvoId,
      userId: userA,
      limit: 10,
    });

    expect(messages).to.have.lengthOf(2);
    expect((messages[0] as any).currentUserReactions).to.deep.equal(["love"]);
    expect((messages[1] as any).currentUserReactions).to.deep.equal(["like"]);
  });

  it("should toggle message reaction and update latest event", async () => {
    const targetMsgId = new ObjectId();
    let reactionToggled = false;
    let reactionDelta = 0;

    (ConversationMessageReactionRepo as any).toggleReaction = async () => {
      reactionToggled = true;
      return "increment";
    };

    (ConversationMessageRepo as any).updateReaction = async (
      msgId: any,
      reaction: any,
      delta: number
    ) => {
      reactionDelta = delta;
    };

    (ConversationRepo as any).updateLatestEvent = async () => {};

    const result = await ConversationSvc.updateMessageReaction({
      conversationId: testConvoId,
      messageId: targetMsgId,
      userId: userB,
      reaction: "wow",
    });

    expect(reactionToggled).to.be.true;
    expect(reactionDelta).to.equal(1);
    expect(result.action).to.equal("increment");
    expect(result.reaction).to.equal("wow");
  });
});
