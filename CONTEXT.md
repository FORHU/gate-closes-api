# Gate Closes API

Backend for detecting whether a user's device is physically located inside an airport, and serving airport reference data (search, nearby lookup, map display).

## Language

### Airport

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

### User & Profile

**Signup Completion** (`signupCompleted`):
Marks that a user has finished the core signup flow — email verified and password set — or authenticated via Google. Does *not* imply their profile (username + gender) is filled in; those are separate.
_Avoid_: "registered", "verified" (verified refers only to the email-verification step within signup).

**Profile Completion** (`isCompleteProfile`):
Marks that a user has set both username and gender. Set once, during signup's **Set Username & Gender** step for manual signups. A Google sign-in can be Signup Completed while still not Profile Completed, until it goes through that step separately — `login`/`loginOrRegisterGoogle` check both flags independently.
_Avoid_: "onboarded".

**Set Username & Gender**:
The signup-completing step where a user picks their username and gender together; on success it flips Profile Completion to true. Distinct from Change Username / Change Gender below, which are post-signup edits and never touch Profile Completion.

**Change Username** / **Change Gender**:
Authenticated, one-field-at-a-time edits to an existing profile's username or gender, independent of the signup flow. Each is its own endpoint — there is no combined "update profile" endpoint.
_Avoid_: "update profile" (removed; was a redundant duplicate of Change Username, plus an unused picture field).

## Flagged ambiguities

- **"Boundary" sounds authoritative but is derived, not measured.** Any feature reasoning about boundary accuracy should be reminded it's a circle, not a surveyed airport perimeter.
- **Signup Completion vs Profile Completion look interchangeable but aren't.** A Google-authenticated user can be Signup Completed with Profile Completion still false. Any gate on "is this user fully set up" needs to check the specific one it means, not assume either implies the other.
