import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import AirportSvc from "../src/services/airport.service";
import AirportRepo from "../src/repositories/airport.repository";
import AirportTestRepo from "../src/repositories/airport.test.repository";
import TerminalEchoRepo from "../src/repositories/terminal.echo.repository";

// Test airports ("Create Airport Here", dev builds): only their owner ever
// sees them or the echoes posted in them.
describe("Test airports", () => {
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

  const owner = new ObjectId("650000000000000000000001");
  const other = "650000000000000000000002";
  const real = { iata: "MNL", airport: "Manila", insideRadius: false, distanceKm: 9 };
  const testAirport = {
    _id: new ObjectId(),
    ownerId: owner,
    iata: AirportTestRepo.codeFor(owner),
    airport: "Test airport",
    location: { type: "Point" as const, coordinates: [121.0, 14.5] as [number, number] },
    radiusKm: 1,
    createdAt: new Date(),
  };
  const stubDb = () => {
    stub(AirportRepo, "findNearestWithDistance", async () => real);
    stub(AirportTestRepo, "findForOwner", async (id: ObjectId) =>
      id.equals(owner) ? testAirport : null
    );
  };

  it("codes never look like a real IATA code", () => {
    expect(AirportTestRepo.codeFor(owner)).to.equal("T00001");
  });

  it("the owner inside their test airport gets it", async () => {
    stubDb();
    const result = await AirportSvc.checkInsideAirport(
      { lat: 14.5005, lng: 121.0005 },
      owner.toHexString()
    );
    expect(result).to.include({ iata: "T00001", insideRadius: true, isTest: true });
  });

  it("the owner outside it, another user, or no user get the real airport", async () => {
    stubDb();
    const farAway = { lat: 14.6, lng: 121.1 };
    expect(await AirportSvc.checkInsideAirport(farAway, owner.toHexString())).to.equal(real);
    const atTest = { lat: 14.5, lng: 121.0 };
    expect(await AirportSvc.checkInsideAirport(atTest, other)).to.equal(real);
    expect(await AirportSvc.checkInsideAirport(atTest)).to.equal(real);
  });

  it("echo lists hide other people's test echoes", () => {
    expect(TerminalEchoRepo.visibleTo()).to.deep.equal({ testOwnerId: null });
    expect(TerminalEchoRepo.visibleTo(other)).to.deep.equal({
      $or: [{ testOwnerId: null }, { testOwnerId: new ObjectId(other) }],
    });
  });
});
