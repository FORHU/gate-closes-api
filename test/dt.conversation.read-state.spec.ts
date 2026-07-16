import { expect } from "chai";
import { describe, it } from "mocha";
import { ObjectId } from "mongodb";
import DtConversationSvc from "../src/services/dt.conversation.service";
import DtConversationReadStateRepo from "../src/repositories/dt.conversation.read.state.repository";
import DtConversationRepo from "../src/repositories/dt.conversation.repository";

describe("DtConversationSvc read-state", () => {
  describe("computeHasUnread", () => {
    const requesterId = new ObjectId();
    const otherUserId = new ObjectId();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const older = new Date("2025-12-31T00:00:00.000Z");

    it("returns false when lastEventAt is missing", () => {
      const result = DtConversationSvc.computeHasUnread({
        requesterId,
        lastEventAt: null,
        lastEventActorId: otherUserId,
        lastReadAt: null,
      });
      expect(result).to.equal(false);
    });

    it("returns false for outgoing latest event", () => {
      const result = DtConversationSvc.computeHasUnread({
        requesterId,
        lastEventAt: now,
        lastEventActorId: requesterId,
        lastReadAt: null,
      });
      expect(result).to.equal(false);
    });

    it("returns true for incoming event with no lastReadAt", () => {
      const result = DtConversationSvc.computeHasUnread({
        requesterId,
        lastEventAt: now,
        lastEventActorId: otherUserId,
        lastReadAt: null,
      });
      expect(result).to.equal(true);
    });

    it("returns false when lastReadAt is equal or newer than latest event", () => {
      const equal = DtConversationSvc.computeHasUnread({
        requesterId,
        lastEventAt: now,
        lastEventActorId: otherUserId,
        lastReadAt: now,
      });
      const newer = DtConversationSvc.computeHasUnread({
        requesterId,
        lastEventAt: older,
        lastEventActorId: otherUserId,
        lastReadAt: now,
      });
      expect(equal).to.equal(false);
      expect(newer).to.equal(false);
    });
  });

  describe("markConversationRead", () => {
    it("uses lastEventAt snapshot and remains idempotent", async () => {
      const conversationId = new ObjectId();
      const requesterId = new ObjectId();
      const snapshotAt = new Date("2026-01-02T10:00:00.000Z");

      const originalGetConversationDetail = DtConversationSvc.getConversationDetail;
      const originalUpsert = DtConversationReadStateRepo.upsertLastReadAt;

      const recorded: Date[] = [];
      try {
        (DtConversationSvc as any).getConversationDetail = async () => ({
          _id: conversationId,
          lastEventAt: snapshotAt,
        });
        (DtConversationReadStateRepo as any).upsertLastReadAt = async (
          params: any
        ) => {
          recorded.push(params.lastReadAt);
          return { acknowledged: true };
        };

        const first = await DtConversationSvc.markConversationRead({
          conversationId,
          requesterId,
        });
        const second = await DtConversationSvc.markConversationRead({
          conversationId,
          requesterId,
        });

        expect(first?.hasUnread).to.equal(false);
        expect(second?.hasUnread).to.equal(false);
        expect(recorded).to.have.length(2);
        expect(recorded[0].toISOString()).to.equal(snapshotAt.toISOString());
        expect(recorded[1].toISOString()).to.equal(snapshotAt.toISOString());
      } finally {
        (DtConversationSvc as any).getConversationDetail =
          originalGetConversationDetail;
        (DtConversationReadStateRepo as any).upsertLastReadAt = originalUpsert;
      }
    });
  });

  describe("upsertLastReadAt", () => {
    it("uses non-conflicting update operators for lastReadAt", async () => {
      const dtConversationId = new ObjectId();
      const userId = new ObjectId();
      const lastReadAt = new Date("2026-01-03T12:00:00.000Z");

      const originalCollection = DtConversationReadStateRepo.collection;
      const calls: any[] = [];

      try {
        (DtConversationReadStateRepo as any).collection = () => ({
          updateOne: async (...args: any[]) => {
            calls.push(args);
            return { acknowledged: true, upsertedCount: 1 };
          },
        });

        await DtConversationReadStateRepo.upsertLastReadAt({
          dtConversationId,
          userId,
          lastReadAt,
        });
        await DtConversationReadStateRepo.upsertLastReadAt({
          dtConversationId,
          userId,
          lastReadAt,
        });

        expect(calls).to.have.length(2);
        const [, updateDoc] = calls[0];
        expect(updateDoc.$set.lastReadAt.toISOString()).to.equal(
          lastReadAt.toISOString()
        );
        expect(updateDoc.$setOnInsert).to.have.property("createdAt");
        expect(updateDoc.$setOnInsert).to.not.have.property("lastReadAt");
        expect(updateDoc.$setOnInsert).to.not.have.property("updatedAt");
      } finally {
        (DtConversationReadStateRepo as any).collection = originalCollection;
      }
    });
  });

  describe("list unread computation", () => {
    it("flips unread to false once lastReadAt catches up", async () => {
      const requesterId = new ObjectId();
      const lastEventAt = new Date("2026-01-04T00:00:00.000Z");

      const originalList = DtConversationRepo.listByUserIdWithParticipants;
      try {
        (DtConversationRepo as any).listByUserIdWithParticipants = async () => [
          {
            _id: new ObjectId(),
            participants: [requesterId, new ObjectId()],
            participantsDetail: [],
            lastEventType: "message_sent",
            lastEventAt,
            lastEventActorId: new ObjectId(),
            lastEventText: "Someone sent a new message",
            lastReadAt: lastEventAt,
          },
        ];

        const [convo] = (await DtConversationSvc.listMyConversations(
          requesterId
        )) as any[];
        const shaped = DtConversationSvc.shapeConversationForUser(
          convo,
          requesterId
        ) as any;
        expect(shaped.hasUnread).to.equal(false);
      } finally {
        (DtConversationRepo as any).listByUserIdWithParticipants = originalList;
      }
    });
  });
});
