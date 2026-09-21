import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import ConversationSvc from "../src/services/conversation.service";
import ConversationRepo from "../src/repositories/conversation.repository";
import FlightTicketRepo from "../src/repositories/flight.ticket.repository";

describe("ConversationSvc (Unified Conversation Domain)", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: unknown) => {
    const original = obj[key];
    (obj as Record<K, unknown>)[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  const userA = new ObjectId("650000000000000000000001");
  const userB = new ObjectId("650000000000000000000002");

  it("generates type-aware deterministic dmKeys", () => {
    const keyPs = ConversationSvc.dmKeyForUsers("parallel_soul", userB, userA);
    const keyDt = ConversationSvc.dmKeyForUsers("destination_thread", userA, userB);
    const keyBt = ConversationSvc.dmKeyForUsers("baton_touch", userB, userA);

    expect(keyPs).to.equal(`parallel_soul:${userA.toHexString()}:${userB.toHexString()}`);
    expect(keyDt).to.equal(`destination_thread:${userA.toHexString()}:${userB.toHexString()}`);
    expect(keyBt).to.equal(`baton_touch:${userA.toHexString()}:${userB.toHexString()}`);
  });

  it("creates a unified Parallel Soul conversation via strategy dispatch", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => ({
      userId: id,
      fromAirport: "SIN",
      toAirport: "HND",
      flightNumber: "SQ12",
      departureDateTime: new Date("2026-06-01T10:00:00Z"),
      arrivalDateTime: new Date("2026-06-01T18:00:00Z"),
    }));
    stub(ConversationRepo, "findByDmKey", async () => null);

    let insertedDoc: any = null;
    stub(ConversationRepo, "create", async (doc: any) => {
      insertedDoc = doc;
      return { insertedId: new ObjectId("650000000000000000000111") };
    });
    stub(ConversationRepo, "collection", () => ({
      findOne: async (q: any) => ({ _id: q._id, ...insertedDoc }),
    }));

    const result = await ConversationSvc.createDm({
      type: "parallel_soul",
      requesterId: userA,
      otherUserId: userB,
    });

    expect(result).to.exist;
    expect(insertedDoc.type).to.equal("parallel_soul");
    expect(insertedDoc.dmKey).to.include("parallel_soul:");
    expect(insertedDoc.participants).to.deep.equal([userA, userB]);
  });

  it("creates a unified Destination Thread conversation via strategy dispatch", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      if (id.equals(userA)) {
        return {
          userId: userA,
          fromAirport: "SIN",
          toAirport: "HND",
          flightNumber: "SQ12",
          departureDateTime: new Date("2026-06-01T10:00:00Z"),
          arrivalDateTime: new Date("2026-06-01T18:00:00Z"),
        };
      }
      return {
        userId: userB,
        fromAirport: "BKK", // Different origin
        toAirport: "HND", // Same destination
        flightNumber: "TG642",
        departureDateTime: new Date("2026-06-01T11:00:00Z"),
        arrivalDateTime: new Date("2026-06-01T19:00:00Z"), // 1 hour apart
      };
    });
    stub(ConversationRepo, "findByDmKey", async () => null);

    let insertedDoc: any = null;
    stub(ConversationRepo, "create", async (doc: any) => {
      insertedDoc = doc;
      return { insertedId: new ObjectId("650000000000000000000222") };
    });
    stub(ConversationRepo, "collection", () => ({
      findOne: async (q: any) => ({ _id: q._id, ...insertedDoc }),
    }));

    const result = await ConversationSvc.createDm({
      type: "destination_thread",
      requesterId: userA,
      otherUserId: userB,
    });

    expect(result).to.exist;
    expect(insertedDoc.type).to.equal("destination_thread");
    expect(insertedDoc.dmKey).to.include("destination_thread:");
  });

  it("creates a unified Baton Touch conversation via strategy dispatch", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      if (id.equals(userA)) {
        return {
          userId: userA,
          fromAirport: "SIN",
          toAirport: "HND",
          flightNumber: "SQ12",
          departureDateTime: new Date("2026-06-01T10:00:00Z"),
        };
      }
      return {
        userId: userB,
        fromAirport: "HND", // Cross-directional
        toAirport: "SIN",
        flightNumber: "JL711",
        departureDateTime: new Date("2026-06-02T10:00:00Z"),
      };
    });
    stub(ConversationRepo, "findByDmKey", async () => null);

    let insertedDoc: any = null;
    stub(ConversationRepo, "create", async (doc: any) => {
      insertedDoc = doc;
      return { insertedId: new ObjectId("650000000000000000000333") };
    });
    stub(ConversationRepo, "collection", () => ({
      findOne: async (q: any) => ({ _id: q._id, ...insertedDoc }),
    }));

    const result = await ConversationSvc.createDm({
      type: "baton_touch",
      requesterId: userA,
      otherUserId: userB,
    });

    expect(result).to.exist;
    expect(insertedDoc.type).to.equal("baton_touch");
    expect(insertedDoc.dmKey).to.include("baton_touch:");
  });
});
