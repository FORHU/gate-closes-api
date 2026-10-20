/**
 * Which airports GateCloses keeps, and how big their circle is. Used by the
 * crawl, the nearby import and `npm run airports:clean`, so all three agree.
 */

/** Places in the source data that aren't airline airports. */
const NOT_AN_AIRLINE_AIRPORT = /heliport|helipad|sea ?plane|water ?aerodrome|air ?base|military/i;

/**
 * An airport travelers fly from: it has an airline (IATA) code and isn't a
 * heliport, seaplane base or air base. (The type and scheduled-service
 * checks stay where the data is read.)
 */
export function isAirlineAirport(airport: { iata?: string | null; airport?: string | null }) {
  const iata = airport.iata?.trim();
  if (!iata) return false;
  return !NOT_AN_AIRLINE_AIRPORT.test(airport.airport ?? "");
}

/**
 * Radius around the reference point that counts as "at the airport", in km.
 * Sized to the airport itself (a large hub is ~4-5 km across) plus room for
 * the reference point being up to ~1 km off, not to its neighborhood.
 */
export const AIRPORT_RADIUS_KM = {
  large_airport: 4,
  medium_airport: 2.5,
  small_airport: 1.5,
} as const;

/** By type; by runway length (feet) when the type is unknown. */
export function airportRadiusKm(type?: string | null, runwayLengthFt?: number | null) {
  if (type && type in AIRPORT_RADIUS_KM) {
    return AIRPORT_RADIUS_KM[type as keyof typeof AIRPORT_RADIUS_KM];
  }
  if (runwayLengthFt) {
    if (runwayLengthFt >= 10000) return AIRPORT_RADIUS_KM.large_airport;
    if (runwayLengthFt >= 6000) return AIRPORT_RADIUS_KM.medium_airport;
    if (runwayLengthFt > 0) return AIRPORT_RADIUS_KM.small_airport;
  }
  return undefined;
}
