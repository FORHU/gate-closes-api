import { expect } from "chai";
import { describe, it } from "mocha";
import { ObjectId } from "mongodb";

/**
 * Unified Conversation Read-State Tests
 * ──────────────────────────────────────
 * Replaces the three identical bt/dt/ps.conversation.read-state.spec.ts files
 * (confirmed byte-for-byte duplicates at 6,444 bytes each). Those files tested
 * the legacy per-type services (BtConversationSvc, DtConversationSvc,
 * PsConversationSvc) which all shared the same computeHasUnread and
 * markConversationRead implementations via copy-paste.
 *
 * This file tests the canonical ConversationSvc once. The unified service owns
 * all conversation types (parallel_soul / destination_thread / baton_touch) so
 * parameterizing by ConversationType is now a behavioral concern only in the
 * eligibility layer — read-state logic is type-independent.
 */

import ConversationSvc from "../src/services/conversation.service";
import ConversationReadStateRepo from "../src/repositories/conversation.read.state.repository";
import ConversationRepo from "../src/repositories/conversation.repository";

// ─── computeHasUnread (pure function — no I/O) ────────────────────────────────

describe("ConversationSvc.computeHasUnread", () => {
  const requesterId = new ObjectId();
  const otherUserId = new ObjectId();
  const now = new Date("2026-01-01T00:00:00.000Z");
  const older = new Date("2025-12-31T00:00:00.000Z");

  it("returns false when lastEventAt is missing", () => {
    const result = ConversationSvc.computeHasUnread({
      requesterId,
      lastEventAt: null,
      lastEventActorId: otherUserId,
      lastReadAt: null,
    });
    expect(result).to.equal(false);
  });

  it("returns false for outgoing latest event (requester is actor)", () => {
    const result = ConversationSvc.computeHasUnread({
      requesterId,
      lastEventAt: now,
      lastEventActorId: requesterId,
      lastReadAt: null,
    });
    expect(result).to.equal(false);
  });

  it("returns true for incoming event with no lastReadAt", () => {
    const result = ConversationSvc.computeHasUnread({
      requesterId,
      lastEventAt: now,
      lastEventActorId: otherUserId,
      lastReadAt: null,
    });
    expect(result).to.equal(true);
  });

  it("returns false when lastReadAt equals lastEventAt", () => {
    const result = ConversationSvc.computeHasUnread({
      requesterId,
      lastEventAt: now,
      lastEventActorId: otherUserId,
      lastReadAt: now,
    });
    expect(result).to.equal(false);
  });

  it("returns false when lastReadAt is newer than lastEventAt", () => {
    const result = ConversationSvc.computeHasUnread({
      requesterId,
      lastEventAt: older,
      lastEventActorId: otherUserId,
      lastReadAt: now,
    });
    expect(result).to.equal(false);
  });

  it("returns true when lastReadAt is older than lastEventAt", () => {
    const result = ConversationSvc.computeHasUnread({
      requesterId,
      lastEventAt: now,
      lastEventActorId: otherUserId,
      lastReadAt: older,
    });
    expect(result).to.equal(true);
  });
});

// ─── markConversationRead ─────────────────────────────────────────────────────

describe("ConversationSvc.markConversationRead", () => {
  it("records the lastEventAt snapshot and is idempotent across two calls", async () => {
    const conversationId = new ObjectId();
    const userId = new ObjectId();
    const snapshotAt = new Date("2026-01-02T10:00:00.000Z");

    const originalCollection = ConversationRepo.collection;
    const originalUpsert = ConversationReadStateRepo.upsertLastReadAt;
    const recorded: Date[] = [];

    try {
      (ConversationRepo as any).collection = () => ({
        findOne: async () => ({
          _id: conversationId,
          participants: [userId],
          lastEventAt: snapshotAt,
        }),
      });

      (ConversationReadStateRepo as any).upsertLastReadAt = async (params: any) => {
        recorded.push(params.lastReadAt);
        return { acknowledged: true };
      };

      const first = await ConversationSvc.markConversationRead({
        conversationId,
        userId,
      });
      const second = await ConversationSvc.markConversationRead({
        conversationId,
        userId,
      });

      // Both calls should succeed with no unread state
      expect(first).to.have.property("conversationId");
      expect(second).to.have.property("conversationId");

      // Both should stamp the same lastEventAt snapshot
      expect(recorded).to.have.length(2);
      expect(recorded[0].toISOString()).to.equal(snapshotAt.toISOString());
      expect(recorded[1].toISOString()).to.equal(snapshotAt.toISOString());
    } finally {
      (ConversationRepo as any).collection = originalCollection;
      (ConversationReadStateRepo as any).upsertLastReadAt = originalUpsert;
    }
  });

  it("throws when conversation is not found or user is not a participant", async () => {
    const conversationId = new ObjectId();
    const userId = new ObjectId();

    const originalCollection = ConversationRepo.collection;
    try {
      (ConversationRepo as any).collection = () => ({
        findOne: async () => null, // conversation not found
      });

      let threw = false;
      try {
        await ConversationSvc.markConversationRead({ conversationId, userId });
      } catch {
        threw = true;
      }
      expect(threw).to.equal(true);
    } finally {
      (ConversationRepo as any).collection = originalCollection;
    }
  });
});

// ─── ConversationReadStateRepo.upsertLastReadAt ───────────────────────────────

describe("ConversationReadStateRepo.upsertLastReadAt", () => {
  it("uses non-conflicting update operators ($set vs $setOnInsert)", async () => {
    const conversationId = new ObjectId();
    const userId = new ObjectId();
    const lastReadAt = new Date("2026-01-03T12:00:00.000Z");

    const originalCollection = ConversationReadStateRepo.collection;
    const calls: any[] = [];

    try {
      (ConversationReadStateRepo as any).collection = () => ({
        updateOne: async (...args: any[]) => {
          calls.push(args);
          return { acknowledged: true, upsertedCount: 1 };
        },
      });

      await ConversationReadStateRepo.upsertLastReadAt({
        conversationId,
        userId,
        lastReadAt,
      });
      await ConversationReadStateRepo.upsertLastReadAt({
        conversationId,
        userId,
        lastReadAt,
      });

      expect(calls).to.have.length(2);
      const [, updateDoc] = calls[0];

      // $set must contain lastReadAt
      expect(updateDoc.$set.lastReadAt.toISOString()).to.equal(lastReadAt.toISOString());

      // $setOnInsert must NOT overlap with $set keys (MongoDB write conflict)
      expect(updateDoc.$setOnInsert).to.have.property("createdAt");
      expect(updateDoc.$setOnInsert).to.not.have.property("lastReadAt");
      expect(updateDoc.$setOnInsert).to.not.have.property("updatedAt");
    } finally {
      (ConversationReadStateRepo as any).collection = originalCollection;
    }
  });
});

// ─── shapeConversationForUser — unread flip ───────────────────────────────────

describe("ConversationSvc.shapeConversationForUser — hasUnread flip", () => {
  it("sets hasUnread=false once lastReadAt catches up to lastEventAt", () => {
    const requesterId = new ObjectId();
    const lastEventAt = new Date("2026-01-04T00:00:00.000Z");

    const rawConvo = {
      _id: new ObjectId(),
      participants: [requesterId, new ObjectId()],
      participantsDetail: [],
      lastEventType: "message_sent",
      lastEventAt,
      lastEventActorId: new ObjectId(),
      lastEventActorName: "Someone",
      lastEventText: "Someone sent a new message",
      lastReadAt: lastEventAt, // caught up exactly
    };

    const shaped = ConversationSvc.shapeConversationForUser(rawConvo as any, requesterId) as any;

    expect(shaped.hasUnread).to.equal(false);
  });

  it("sets hasUnread=true when lastReadAt is behind lastEventAt from another user", () => {
    const requesterId = new ObjectId();
    const otherUserId = new ObjectId();
    const lastEventAt = new Date("2026-01-04T08:00:00.000Z");
    const lastReadAt = new Date("2026-01-04T07:00:00.000Z");

    const rawConvo = {
      _id: new ObjectId(),
      participants: [requesterId, otherUserId],
      participantsDetail: [],
      lastEventType: "message_sent",
      lastEventAt,
      lastEventActorId: otherUserId,
      lastEventActorName: "OtherUser",
      lastEventText: "OtherUser sent a new message",
      lastReadAt,
    };

    const shaped = ConversationSvc.shapeConversationForUser(rawConvo as any, requesterId) as any;

    expect(shaped.hasUnread).to.equal(true);
  });
});
