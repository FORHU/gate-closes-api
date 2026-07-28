declare module "airport-data-js" {
  export function getAirportByIata(iata: string): Promise<unknown>;
  export function getAirportByIcao(icao: string): Promise<unknown>;
  export function findNearbyAirports(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<unknown[]>;
}
