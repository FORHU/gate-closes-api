import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import ConversationSvc from "../src/services/conversation.service";
import FlightTicketRepo from "../src/repositories/flight.ticket.repository";
import ConversationRepo from "../src/repositories/conversation.repository";

describe("Parallel Soul Eligibility (via ConversationSvc)", () => {
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

  it("rejects conversation with self", async () => {
    try {
      await ConversationSvc.createDm({
        type: "parallel_soul",
        requesterId: userA,
        otherUserId: userA,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Cannot create conversation with yourself.");
    }
  });

  it("rejects when either user lacks an active flight ticket", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      if (id.equals(userA)) {
        return { userId: userA, fromAirport: "SIN", toAirport: "NRT" };
      }
      return null;
    });

    try {
      await ConversationSvc.createDm({
        type: "parallel_soul",
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Other user has no active flight ticket.");
    }
  });

  it("rejects when users travel different routes", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      if (id.equals(userA)) {
        return { userId: userA, fromAirport: "SIN", toAirport: "NRT" };
      }
      return { userId: userB, fromAirport: "SIN", toAirport: "LHR" };
    });

    try {
      await ConversationSvc.createDm({
        type: "parallel_soul",
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal(
        "Users are not traveling the same route to be eligible for Parallel Soul."
      );
    }
  });

  it("creates conversation when both users have the exact same route", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => ({
      userId: id,
      fromAirport: "SIN",
      toAirport: "NRT",
    }));

    stub(ConversationRepo, "findByDmKey", async () => null);

    let createdRecord: any = null;
    stub(ConversationRepo, "create", async (data: any) => {
      createdRecord = data;
      return { insertedId: new ObjectId("650000000000000000000099") };
    });

    stub(ConversationRepo, "collection", () => ({
      findOne: async (query: any) => ({ _id: query._id, ...createdRecord }),
    }));

    const result = await ConversationSvc.createDm({
      type: "parallel_soul",
      requesterId: userA,
      otherUserId: userB,
    });

    expect(result).to.exist;
    expect(createdRecord).to.exist;
    expect(createdRecord.participants).to.deep.equal([userA, userB]);
  });
});
