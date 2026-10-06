import "dotenv/config";
import * as turf from "@turf/turf";
import { ObjectId } from "mongodb";
import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import AirportSvc from "../services/airport.service";
import { airportRadiusKm, isAirlineAirport } from "../domain/airport/airport-scope";
import { printDbTarget } from "./check-db-target";

/**
 * Brings the `airport` collection in line with src/domain/airport/airport-scope.ts:
 *  1. removes what isn't an airline airport (no IATA code, heliports,
 *     seaplane bases, air bases), except airports that echoes or flight
 *     tickets point at;
 *  2. resizes every circle to the airport's real size (large 4 km, medium
 *     2.5 km) and redraws its boundary.
 *
 *   npm run airports:clean              dry run: prints what would change
 *   npm run airports:clean -- --apply   does it; removed airports are copied
 *                                       to `airport.removed` first
 */
const APPLY = process.argv.includes("--apply");
const ELIGIBLE_TYPES = ["large_airport", "medium_airport"];

type AirportRow = {
  _id: ObjectId;
  iata?: string | null;
  icao?: string | null;
  airport?: string | null;
  type?: string | null;
  radiusKm?: number;
  runwayLength?: number | null;
  location?: { type: "Point"; coordinates: [number, number] };
};

const label = (a: AirportRow) => `${a.iata || a.icao || "-"} ${a.airport ?? ""}`.trim();

const main = async () => {
  printDbTarget("airports:clean");
  console.log(
    APPLY ? "[airports:clean] APPLYING changes" : "[airports:clean] dry run (no changes)"
  );
  await connectToMongo();
  const db = getDB();
  const airports = db.collection<AirportRow>("airport");

  // Airports in use are kept whatever they are.
  const used = new Set(
    [
      ...(await db.collection("terminal.echo").distinct("airportIata")),
      ...(await db.collection("flightTicket").distinct("fromAirport")),
      ...(await db.collection("flightTicket").distinct("toAirport")),
    ]
      .filter((code): code is string => typeof code === "string" && code !== "")
      .map((code) => code.toUpperCase())
  );

  const all = await airports
    .find(
      {},
      {
        projection: {
          iata: 1,
          icao: 1,
          airport: 1,
          type: 1,
          radiusKm: 1,
          runwayLength: 1,
          location: 1,
        },
      }
    )
    .toArray();

  const inScope = (a: AirportRow) =>
    !!a.type && ELIGIBLE_TYPES.includes(a.type) && isAirlineAirport(a);
  const remove = all.filter((a) => !inScope(a) && !used.has((a.iata ?? "").toUpperCase()));
  const removeIds = new Set(remove.map((a) => a._id.toHexString()));
  const keep = all.filter((a) => !removeIds.has(a._id.toHexString()));
  const resize = keep.filter((a) => {
    const radius = airportRadiusKm(a.type, a.runwayLength);
    return radius !== undefined && a.location && a.radiusKm !== radius;
  });

  console.log(`  airports now:        ${all.length}`);
  console.log(`  to remove:           ${remove.length}`);
  console.log(`  kept (in use, out of scope): ${keep.filter((a) => !inScope(a)).length}`);
  console.log(`  airports after:      ${keep.length}`);
  console.log(`  circles to resize:   ${resize.length}`);
  const sizes = new Map<string, number>();
  for (const a of resize) {
    const key = `${a.type}: ${a.radiusKm} km -> ${airportRadiusKm(a.type, a.runwayLength)} km`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  for (const [key, n] of sizes) console.log(`    ${key}  (${n})`);

  // What New York looks like afterwards: the example that started this.
  const nyc = turf.point([-73.95, 40.7]);
  const near = (list: AirportRow[]) =>
    list.filter((a) => a.location && turf.distance(nyc, turf.point(a.location.coordinates)) <= 80);
  console.log(`  around New York (80 km): ${near(all).length} -> ${near(keep).length}`);
  for (const a of near(remove)) console.log(`    - remove ${label(a)}`);
  for (const a of near(keep)) console.log(`    + keep   ${label(a)}`);

  // Existing echoes stay; this shows how many were posted farther out than
  // the new circle allows (new echoes from there would be refused).
  const echoes = await db
    .collection("terminal.echo")
    .find({ airportIata: { $nin: [null, ""] } }, { projection: { airportIata: 1, location: 1 } })
    .toArray();
  const byIata = new Map(keep.map((a) => [(a.iata ?? "").toUpperCase(), a]));
  let outside = 0;
  const outsideByAirport = new Map<string, number>();
  for (const echo of echoes) {
    const airport = byIata.get(String(echo.airportIata).toUpperCase());
    const radius = airport && airportRadiusKm(airport.type, airport.runwayLength);
    const coordinates = echo.location?.coordinates as [number, number] | undefined;
    if (!airport?.location || !radius || !coordinates) continue;
    const km = turf.distance(turf.point(airport.location.coordinates), turf.point(coordinates));
    if (km > radius) {
      outside += 1;
      outsideByAirport.set(airport.iata!, (outsideByAirport.get(airport.iata!) ?? 0) + 1);
    }
  }
  console.log(
    `  existing echoes outside their new circle: ${outside} of ${echoes.length}` +
      (outside ? ` (${[...outsideByAirport].map(([iata, n]) => `${iata} ${n}`).join(", ")})` : "")
  );

  if (!APPLY) {
    console.log("[airports:clean] dry run done. Re-run with -- --apply to make these changes.");
    return;
  }

  if (remove.length) {
    const full = await airports.find({ _id: { $in: remove.map((a) => a._id) } }).toArray();
    const removedAt = new Date();
    await db.collection("airport.removed").insertMany(full.map((a) => ({ ...a, removedAt })));
    const deleted = await airports.deleteMany({ _id: { $in: remove.map((a) => a._id) } });
    console.log(`[airports:clean] removed ${deleted.deletedCount} (copies in airport.removed)`);
  }

  if (resize.length) {
    const ops = resize.map((a) => {
      const radiusKm = airportRadiusKm(a.type, a.runwayLength)!;
      return {
        updateOne: {
          filter: { _id: a._id },
          update: {
            $set: {
              radiusKm,
              boundary: AirportSvc.buildBoundaryFromLocationAndRadius({
                location: a.location!,
                radiusKm,
              }),
              updatedAt: new Date(),
            },
          },
        },
      };
    });
    for (let i = 0; i < ops.length; i += 500) {
      await airports.bulkWrite(ops.slice(i, i + 500));
    }
    console.log(`[airports:clean] resized ${resize.length} circles`);
  }
  console.log("[airports:clean] done.");
};

main()
  .catch((error) => {
    console.error(`[airports:clean] failed: ${(error as Error)?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await useMongoClient()?.close();
    process.exit();
  });
