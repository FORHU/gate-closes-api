import { Db } from "mongodb";
import { MOffer, type TOffer } from "../models/offer.model";
import { log } from "./helpers";

/**
 * Sample offers to see the feature work: an ad, a voucher and a gift at
 * Baguio (BAG, where most testing happens) and Manila (MNL), so every offer
 * group (voucher, gift, ad) can be found on the map. Active, no end date.
 * Matched by title + kind, so a re-run updates them instead of duplicating.
 */
export const SAMPLE_OFFERS: Omit<TOffer, "status" | "weight">[] = [
  {
    kind: "ad",
    title: "Strawberry taho at the arrivals hall",
    body: "Warm taho with Baguio strawberries, right outside arrivals.",
    ctaLabel: "See the menu",
    ctaUrl: "https://example.com/taho",
    airports: ["BAG"],
    placements: ["pin", "card"],
    data: { hours: "6 am to 8 pm" },
  },
  {
    kind: "voucher",
    title: "Free coffee at Loakan",
    body: "Show your code at the café by gate 1.",
    airports: ["BAG"],
    placements: ["pin"],
    data: { value: "1 brewed coffee" },
    reward: { code: "GATE-BAG-COFFEE" },
    limits: { maxClaims: 50, maxClaimsPerUser: 1 },
  },
  {
    kind: "voucher",
    title: "20% off at the NAIA Terminal 3 bookstore",
    airports: ["MNL"],
    placements: ["pin", "card"],
    data: { discount: "20%" },
    reward: { code: "GATE-MNL-20" },
    limits: { maxClaims: 100, maxClaimsPerUser: 1 },
  },
  {
    kind: "gift",
    title: "Welcome gift: a NAIA travel pouch",
    body: "Pick it up at the Terminal 3 information desk.",
    airports: ["MNL"],
    placements: ["pin"],
    data: { item: "travel pouch" },
    reward: { code: "GATE-MNL-POUCH" },
    limits: { maxClaims: 30, maxClaimsPerUser: 1 },
  },
  {
    kind: "ad",
    title: "Lounge day pass at Terminal 3",
    body: "Showers, Wi-Fi and a quiet corner before your flight.",
    ctaLabel: "See the lounge",
    ctaUrl: "https://example.com/lounge",
    airports: ["MNL"],
    placements: ["pin"],
    data: { hours: "open 24 hours" },
  },
  {
    kind: "gift",
    title: "Ube jam for the road",
    body: "A small jar from the Good Shepherd stall, on us.",
    airports: ["BAG"],
    placements: ["pin"],
    data: { item: "ube jam" },
    reward: { code: "GATE-BAG-UBE" },
    limits: { maxClaims: 30, maxClaimsPerUser: 1 },
  },
];

export async function seedOffers(db: Db) {
  const offers = db.collection<TOffer>("offer");
  let created = 0;

  for (const sample of SAMPLE_OFFERS) {
    const existing = await offers.findOne({ title: sample.title, kind: sample.kind });
    if (existing) {
      // Back to the sample's content; its stats and claims are kept.
      await offers.updateOne(
        { _id: existing._id },
        { $set: { ...sample, status: "active", weight: 1, updatedAt: new Date() } }
      );
    } else {
      await offers.insertOne(new MOffer({ ...sample, status: "active", weight: 1 }));
      created += 1;
    }
  }

  log(
    `offers: ${SAMPLE_OFFERS.length} samples (${created} new) at ` +
      [...new Set(SAMPLE_OFFERS.flatMap((o) => o.airports))].join(", ")
  );
}
