import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import BtConversationSvc from "../src/services/bt.conversation.service";
import FlightTicketRepo from "../src/repositories/flight.ticket.repository";
import BtConversationRepo from "../src/repositories/bt.conversation.repository";

describe("BtConversationSvc (Baton Touch Eligibility Characterization)", () => {
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
      await BtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userA,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Cannot create conversation with yourself.");
    }
  });

  it("rejects when users are not cross-directional", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      if (id.equals(userA)) {
        return { userId: userA, fromAirport: "SIN", toAirport: "NRT" };
      }
      return { userId: userB, fromAirport: "LHR", toAirport: "JFK" };
    });

    try {
      await BtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Users are not eligible for baton touch.");
    }
  });

  it("rejects when users are on the exact same flight", async () => {
    const flightDate = new Date("2026-06-01T10:00:00Z");
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      return {
        userId: id,
        fromAirport: "SIN",
        toAirport: "SIN", // circular match
        flightNumber: "SQ100",
        departureDateTime: flightDate,
      };
    });

    try {
      await BtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Users are on the same flight. Use parallel soul instead.");
    }
  });

  it("creates conversation when users have cross-directional routes (A->B and B->A)", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (id: ObjectId) => {
      if (id.equals(userA)) {
        return { userId: userA, fromAirport: "SIN", toAirport: "NRT", flightNumber: "SQ12" };
      }
      return { userId: userB, fromAirport: "NRT", toAirport: "SIN", flightNumber: "JL711" };
    });

    stub(BtConversationRepo, "findByDmKey", async () => null);

    let createdRecord: any = null;
    stub(BtConversationRepo, "create", async (data: any) => {
      createdRecord = data;
      return { insertedId: new ObjectId("650000000000000000000088") };
    });

    stub(BtConversationRepo, "collection", () => ({
      findOne: async (query: any) => ({ _id: query._id, ...createdRecord }),
    }));

    const result = await BtConversationSvc.createDm({
      requesterId: userA,
      otherUserId: userB,
    });

    expect(result).to.exist;
    expect(createdRecord).to.exist;
    expect(createdRecord.participants).to.deep.equal([userA, userB]);
  });
});
