import { Db } from "mongodb";
import { MOffer, type TOffer } from "../models/offer.model";
import { log } from "./helpers";

/**
 * Sample offers to see the feature work: an ad and a voucher at Baguio
 * (BAG, where most testing happens) and Manila (MNL). Active, no end date.
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
