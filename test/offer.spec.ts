import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import OfferCtrl from "../src/controllers/offer.controller";
import OfferSvc, {
  OfferClaimError,
  pickWeighted,
  randomPinPoint,
} from "../src/services/offer.service";
import OfferRepo from "../src/repositories/offer.repository";
import AirportRepo from "../src/repositories/airport.repository";
import { MOffer, type TOffer } from "../src/models/offer.model";

// Offers (ads, vouchers, any admin-defined kind) at airports: pins at a
// random spot inside the airport radius, plus one weighted-random card.
describe("Offers", () => {
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

  type MockRes = Response & {
    statusCode: number;
    body: { message?: string; data?: unknown };
    ended: boolean;
  };
  const mockRes = () => {
    const res = { statusCode: 200, body: {}, ended: false } as MockRes;
    res.status = ((code: number) => {
      res.statusCode = code;
      return res;
    }) as MockRes["status"];
    res.json = ((body: MockRes["body"]) => {
      res.body = body;
      return res;
    }) as MockRes["json"];
    res.end = (() => {
      res.ended = true;
      return res;
    }) as MockRes["end"];
    return res;
  };

  const userId = "650000000000000000000001";
  const MNL: [number, number] = [121.019208, 14.511205];
  const offer = (fields: Partial<TOffer> = {}) =>
    new MOffer({
      kind: "ad",
      title: "Coffee 20% off",
      airports: ["MNL"],
      placements: ["pin", "card"],
      status: "active",
      weight: 1,
      ...fields,
    });

  /** Great-circle distance in km. */
  const km = ([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) => {
    const rad = Math.PI / 180;
    const a =
      Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  };

  describe("randomPinPoint", () => {
    const base = { center: MNL, radiusKm: 15, offerId: "a", userId, day: "2026-10-06" };

    it("stays inside 80% of the airport radius", () => {
      for (let i = 0; i < 200; i++) {
        const p = randomPinPoint({ ...base, offerId: `offer-${i}` });
        expect(km(MNL, p)).to.be.at.most(15 * 0.8 + 0.05);
      }
    });

    it("is the same all day for one user, different per user and per day", () => {
      const p = randomPinPoint(base);
      expect(randomPinPoint(base)).to.deep.equal(p);
      expect(randomPinPoint({ ...base, userId: "other" })).to.not.deep.equal(p);
      expect(randomPinPoint({ ...base, day: "2026-10-07" })).to.not.deep.equal(p);
    });
  });

  describe("pickWeighted", () => {
    const items = [
      { id: "a", weight: 1 },
      { id: "b", weight: 3 },
      { id: "zero", weight: 0 },
    ];

    it("picks in proportion to weight and never a zero weight", () => {
      expect(pickWeighted(items, () => 0)?.id).to.equal("a");
      expect(pickWeighted(items, () => 0.24)?.id).to.equal("a");
      expect(pickWeighted(items, () => 0.26)?.id).to.equal("b");
      expect(pickWeighted(items, () => 0.999)?.id).to.equal("b");
    });

    it("is null with nothing to pick", () => {
      expect(pickWeighted([], () => 0.5)).to.equal(null);
      expect(pickWeighted([{ weight: 0 }], () => 0.5)).to.equal(null);
    });
  });

  describe("forAirport", () => {
    const stubAirport = (location: unknown, radiusKm = 15) =>
      stub(AirportRepo, "findByIata", async () => ({ iata: "MNL", location, radiusKm }));

    it("returns pin offers as points and one card offer, without private fields", async () => {
      stubAirport({ type: "Point", coordinates: MNL });
      const pinOnly = offer({ title: "Pin", placements: ["pin"], reward: { code: "SECRET" } });
      const cardOnly = offer({ title: "Card", placements: ["card"] });
      let askedFor = "";
      stub(OfferRepo, "findLiveForAirport", async (code: string) => {
        askedFor = code;
        return [pinOnly, cardOnly];
      });

      const result = await OfferSvc.forAirport("mnl", userId, { rand: () => 0 });

      expect(askedFor).to.equal("MNL");
      expect(result.pins.features).to.have.lengthOf(1);
      const [pin] = result.pins.features;
      expect(pin.properties.title).to.equal("Pin");
      expect(pin.properties.airportIata).to.equal("MNL");
      expect(pin.properties).to.not.have.any.keys("reward", "stats", "limits", "createdBy");
      expect(km(MNL, pin.geometry.coordinates)).to.be.below(15);
      expect(result.card?.title).to.equal("Card");
      expect(result.card).to.not.have.any.keys("reward", "stats");
      // Says a reward exists without revealing it.
      expect(pin.properties.claimable).to.equal(true);
      expect(result.card?.claimable).to.equal(false);
    });

    it("is empty for an airport without a location", async () => {
      stub(AirportRepo, "findByIata", async () => null);
      stub(OfferRepo, "findLiveForAirport", async () => {
        throw new Error("should not query offers");
      });
      const result = await OfferSvc.forAirport("XXX", userId);
      expect(result).to.deep.equal({
        card: null,
        pins: { type: "FeatureCollection", features: [] },
      });
    });
  });

  describe("claim", () => {
    const stubOffer = (o: MOffer) => stub(OfferRepo, "findById", async () => o);
    const events: unknown[] = [];
    const stubWrites = (takeClaim = true, usedByUser = 0) => {
      events.length = 0;
      stub(OfferRepo, "takeClaim", async () => takeClaim);
      stub(OfferRepo, "countUserEvents", async () => usedByUser);
      stub(OfferRepo, "insertEvent", async (e: unknown) => {
        events.push(e);
      });
    };
    const claim = (id: ObjectId) => OfferSvc.claim({ offerId: id.toHexString(), userId });

    it("reveals the reward and records the claim", async () => {
      const o = offer({ kind: "voucher", reward: { code: "GATE20" } });
      stubOffer(o);
      stubWrites();
      const result = await claim(o._id);
      expect(result.reward).to.deep.equal({ code: "GATE20" });
      expect(events).to.have.lengthOf(1);
      expect(events[0]).to.include({ type: "claim" });
    });

    it("refuses an offer that is paused or past its end", async () => {
      stubWrites();
      for (const o of [
        offer({ status: "paused" }),
        offer({ endsAt: new Date(Date.now() - 1000) }),
        offer({ startsAt: new Date(Date.now() + 60_000) }),
      ]) {
        stub(OfferRepo, "findById", async () => o);
        try {
          await claim(o._id);
          expect.fail("claim should be refused");
        } catch (err) {
          expect(err).to.be.instanceOf(OfferClaimError);
        }
      }
      expect(events).to.have.lengthOf(0);
    });

    it("refuses past the per-user limit, and when sold out", async () => {
      const limited = offer({ limits: { maxClaimsPerUser: 1 } });
      stubOffer(limited);
      stubWrites(true, 1);
      try {
        await claim(limited._id);
        expect.fail("claim should be refused");
      } catch (err) {
        expect((err as Error).message).to.equal("You already claimed this offer.");
      }

      const soldOut = offer({ limits: { maxClaims: 10 } });
      stubOffer(soldOut);
      stubWrites(false);
      try {
        await claim(soldOut._id);
        expect.fail("claim should be refused");
      } catch (err) {
        expect((err as Error).message).to.equal("This offer has run out.");
      }
      expect(events).to.have.lengthOf(0);
    });
  });

  describe("repository", () => {
    it("takes a claim only while some are left, in one update", async () => {
      let filter: Record<string, unknown> = {};
      stub(OfferRepo, "collection", () => ({
        updateOne: async (f: Record<string, unknown>) => {
          filter = f;
          return { modifiedCount: 0 };
        },
      }));
      const id = new ObjectId();
      expect(await OfferRepo.takeClaim(id)).to.equal(false);
      expect(filter._id).to.equal(id);
      expect(filter.$or).to.deep.include({
        $expr: { $lt: ["$stats.claims", "$limits.maxClaims"] },
      });
    });

    it("finds live offers for the airport or every airport", async () => {
      let filter: Record<string, unknown> = {};
      stub(OfferRepo, "collection", () => ({
        find: (f: Record<string, unknown>) => {
          filter = f;
          return { limit: () => ({ toArray: async () => [] }) };
        },
      }));
      await OfferRepo.findLiveForAirport("mnl");
      expect(filter.status).to.equal("active");
      expect(filter.airports).to.deep.equal({ $in: ["MNL", "*"] });
    });
  });

  describe("controller", () => {
    const req = (fields: Record<string, unknown>) =>
      ({ user: { userId }, params: {}, query: {}, body: {}, ...fields }) as unknown as Request;

    it("creates an offer with a new kind, normalized", async () => {
      let saved: TOffer | undefined;
      stub(OfferSvc, "create", async (fields: TOffer) => {
        saved = fields;
        return fields;
      });
      const res = mockRes();
      await OfferCtrl.adminCreate(
        req({
          body: {
            kind: "Lounge_Pass",
            title: "Lounge day pass",
            airports: ["mnl", "*"],
            data: { lounge: "PAL Mabuhay", price: 1500 },
            reward: { code: "LOUNGE1" },
            limits: { maxClaims: 50, maxClaimsPerUser: 1 },
          },
        }),
        res
      );
      expect(res.statusCode).to.equal(201);
      expect(saved?.kind).to.equal("lounge_pass");
      expect(saved?.data).to.deep.equal({ lounge: "PAL Mabuhay", price: 1500 });
    });

    it("refuses a create without a title, or ending before it starts", async () => {
      stub(OfferSvc, "create", async () => {
        throw new Error("should not create");
      });
      const missing = mockRes();
      await OfferCtrl.adminCreate(req({ body: { kind: "ad", airports: ["MNL"] } }), missing);
      expect(missing.statusCode).to.equal(400);

      const backwards = mockRes();
      await OfferCtrl.adminCreate(
        req({
          body: {
            kind: "ad",
            title: "x",
            airports: ["MNL"],
            startsAt: "2026-10-10T00:00:00Z",
            endsAt: "2026-10-01T00:00:00Z",
          },
        }),
        backwards
      );
      expect(backwards.statusCode).to.equal(400);
    });

    it("needs an airport code for the app's offers", async () => {
      const res = mockRes();
      await OfferCtrl.forAirport(req({ query: {} }), res);
      expect(res.statusCode).to.equal(400);
    });

    it("answers 409 to a refused claim", async () => {
      stub(OfferSvc, "claim", async () => {
        throw new OfferClaimError("This offer has run out.");
      });
      const res = mockRes();
      await OfferCtrl.claim(req({ params: { id: new ObjectId().toHexString() } }), res);
      expect(res.statusCode).to.equal(409);
      expect(res.body.message).to.equal("This offer has run out.");
    });
  });
});
