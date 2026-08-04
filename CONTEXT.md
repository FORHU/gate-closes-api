# Gate Closes API

Backend for detecting whether a user's device is physically located inside an airport, and serving airport reference data (search, nearby lookup, map display).

## Language

**Airport Location**:
The single GeoJSON `Point` marking an airport's reference coordinate. Sourced from crawled airport data.

**Airport Radius**:
A distance in kilometers (`radiusKm`) approximating an airport's extent, inferred from its size classification (`large_airport` → 15km, `medium_airport` → 8km, `small_airport` → 4km) or runway length as a fallback. This is the basis for the primary inside-airport check.

**Airport Boundary**:
A synthetic circular polygon (32-sided, via Turf) generated from Airport Location + Airport Radius. It is *not* a real-world airport perimeter/fence line — no such data is ingested anywhere in this system.
_Used by_: the Mapbox-facing `/airport/geojson` endpoint (to render the circle) and the `check-inside-airport-boundary` endpoint (point-in-polygon form of the same radius check).
_Not used by_: the primary `check-inside-airport` endpoint, which checks `distanceKm <= radiusKm` directly and needs no polygon.
_Avoid_: "geofence" (implies precision this data doesn't have), "airport shape"/"airport footprint" (implies real perimeter data).

**Airport Crawl**:
The one-time bulk load of airport records from the static `gate-closes.airport.json` export into the `airport` collection, computing each record's Airport Boundary at load time. Insert-if-absent per record (keyed by `iata`, falling back to `icao`) — safe to re-trigger or resume after an interruption, but never updates an already-stored record. Scoped to airports with scheduled service and `type` of `large_airport`/`medium_airport` — the app only cares about "am I at my gate" for commercial airports, not private airfields, heliports, or seaplane bases. A record is skipped entirely (not stored at all) if it's out of scope, or in scope but can't produce a boundary — every airport this process stores is guaranteed to have one. See [ADR-0001](./docs/adr/0001-airport-crawl-import-strategy.md).
_Avoid_: "seed", "sync" (sync implies it refreshes existing data — it doesn't).

## Flagged ambiguities

- **"Boundary" sounds authoritative but is derived, not measured.** Any feature reasoning about boundary accuracy should be reminded it's a circle, not a surveyed airport perimeter.
