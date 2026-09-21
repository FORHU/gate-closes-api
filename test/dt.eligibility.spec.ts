import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import DtConversationSvc from "../src/services/dt.conversation.service";
import FlightTicketRepo from "../src/repositories/flight.ticket.repository";
import DtConversationRepo from "../src/repositories/dt.conversation.repository";

describe("DtConversationSvc (Destination Thread Eligibility)", () => {
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
      await DtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userA,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Cannot create conversation with yourself.");
    }
  });

  it("rejects when requester has no flight ticket", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async () => null);

    try {
      await DtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("No active flight ticket found for user.");
    }
  });

  it("rejects when users are departing from the same origin airport", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (userId: ObjectId) => {
      if (userId.equals(userA)) {
        return {
          userId: userA,
          fromAirport: "LHR",
          toAirport: "HND",
          flightNumber: "BA007",
          departureDateTime: new Date("2026-06-01T10:00:00Z"),
          arrivalDateTime: new Date("2026-06-02T06:00:00Z"),
        };
      }
      return {
        userId: userB,
        fromAirport: "LHR", // Same origin!
        toAirport: "HND",
        flightNumber: "JL044",
        departureDateTime: new Date("2026-06-01T11:00:00Z"),
        arrivalDateTime: new Date("2026-06-02T07:00:00Z"),
      };
    });

    stub(FlightTicketRepo, "userHasSameDestination", async () => true);

    try {
      await DtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Users are from the same airport. Not eligible for destination threads.");
    }
  });

  it("rejects when users are on the exact same flight (should use parallel soul)", async () => {
    const flightDate = new Date("2026-06-01T10:00:00Z");
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (userId: ObjectId) => {
      return {
        userId,
        fromAirport: userId.equals(userA) ? "LHR" : "CDG",
        toAirport: "HND",
        flightNumber: "JL044",
        departureDateTime: flightDate,
        arrivalDateTime: new Date("2026-06-02T06:00:00Z"),
      };
    });
    stub(FlightTicketRepo, "userHasSameDestination", async () => true);

    try {
      await DtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Users are on the same flight. Use parallel soul instead.");
    }
  });

  it("rejects cross-year flights with identical month/day (preserves year)", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (userId: ObjectId) => {
      if (userId.equals(userA)) {
        return {
          userId: userA,
          fromAirport: "LHR",
          toAirport: "HND",
          flightNumber: "BA007",
          departureDateTime: new Date("2025-06-01T10:00:00Z"),
          arrivalDateTime: new Date("2025-06-02T06:00:00Z"),
        };
      }
      return {
        userId: userB,
        fromAirport: "ICN",
        toAirport: "HND",
        flightNumber: "KE701",
        departureDateTime: new Date("2026-06-01T10:00:00Z"), // Different year!
        arrivalDateTime: new Date("2026-06-02T06:00:00Z"),
      };
    });
    stub(FlightTicketRepo, "userHasSameDestination", async () => true);

    try {
      await DtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Users are not arriving within the destination thread window (24 hours).");
    }
  });

  it("rejects arrivals separated by more than 24 hours", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (userId: ObjectId) => {
      if (userId.equals(userA)) {
        return {
          userId: userA,
          fromAirport: "LHR",
          toAirport: "HND",
          flightNumber: "BA007",
          departureDateTime: new Date("2026-06-01T10:00:00Z"),
          arrivalDateTime: new Date("2026-06-02T06:00:00Z"),
        };
      }
      return {
        userId: userB,
        fromAirport: "ICN",
        toAirport: "HND",
        flightNumber: "KE701",
        departureDateTime: new Date("2026-06-03T18:00:00Z"),
        arrivalDateTime: new Date("2026-06-03T20:30:00Z"), // 38 hours after user A
      };
    });
    stub(FlightTicketRepo, "userHasSameDestination", async () => true);

    try {
      await DtConversationSvc.createDm({
        requesterId: userA,
        otherUserId: userB,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.message).to.equal("Users are not arriving within the destination thread window (24 hours).");
    }
  });

  it("accepts arrivals within 24 hours even across midnight UTC calendar date boundary", async () => {
    stub(FlightTicketRepo, "findActiveOrLatestByUserId", async (userId: ObjectId) => {
      if (userId.equals(userA)) {
        return {
          userId: userA,
          fromAirport: "LHR",
          toAirport: "HND",
          flightNumber: "BA007",
          departureDateTime: new Date("2026-06-01T12:00:00Z"),
          arrivalDateTime: new Date("2026-06-01T23:30:00Z"), // Day 1 late night
        };
      }
      return {
        userId: userB,
        fromAirport: "ICN",
        toAirport: "HND",
        flightNumber: "KE701",
        departureDateTime: new Date("2026-06-01T23:00:00Z"),
        arrivalDateTime: new Date("2026-06-02T01:30:00Z"), // Day 2 early morning (2 hours apart!)
      };
    });
    stub(FlightTicketRepo, "userHasSameDestination", async () => true);
    stub(DtConversationRepo, "findByDmKey", async () => null);

    let insertedRecord: any = null;
    stub(DtConversationRepo, "create", async (data: any) => {
      insertedRecord = data;
      return { insertedId: new ObjectId("650000000000000000000050") };
    });
    stub(DtConversationRepo, "collection", () => ({
      findOne: async (query: any) => ({ _id: query._id, ...insertedRecord }),
    }));

    const result = await DtConversationSvc.createDm({
      requesterId: userA,
      otherUserId: userB,
    });

    expect(result).to.exist;
    expect(insertedRecord).to.exist;
    expect(insertedRecord.participants).to.deep.equal([userA, userB]);
  });
});
