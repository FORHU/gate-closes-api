/**
 * Airports the demo data uses (flight tickets and echoes). Not the `airport`
 * collection: that one comes from the real Airport Crawl, never seeded.
 */
export const DEMO_AIRPORTS: Array<{
  code: string;
  name: string;
  country: string;
  coordinates: [number, number];
}> = [
  {
    code: "JFK",
    name: "John F. Kennedy International Airport",
    country: "United States",
    coordinates: [-73.7781, 40.6413],
  },
  {
    code: "LAX",
    name: "Los Angeles International Airport",
    country: "United States",
    coordinates: [-118.4085, 33.9416],
  },
  {
    code: "LHR",
    name: "London Heathrow Airport",
    country: "United Kingdom",
    coordinates: [-0.4543, 51.47],
  },
  {
    code: "DXB",
    name: "Dubai International Airport",
    country: "United Arab Emirates",
    coordinates: [55.3644, 25.2532],
  },
  {
    code: "SIN",
    name: "Singapore Changi Airport",
    country: "Singapore",
    coordinates: [103.9915, 1.3644],
  },
  {
    code: "CDG",
    name: "Charles de Gaulle Airport",
    country: "France",
    coordinates: [2.5479, 49.0097],
  },
  { code: "FRA", name: "Frankfurt Airport", country: "Germany", coordinates: [8.5622, 50.0379] },
  {
    code: "SYD",
    name: "Sydney Kingsford Smith Airport",
    country: "Australia",
    coordinates: [151.1772, -33.9399],
  },
  {
    code: "ORD",
    name: "O'Hare International Airport",
    country: "United States",
    coordinates: [-87.9048, 41.9742],
  },
  {
    code: "MNL",
    name: "Ninoy Aquino International Airport",
    country: "Philippines",
    coordinates: [121.0198, 14.5086],
  },
];

export const demoAirportByCode = (code: string) =>
  DEMO_AIRPORTS.find((a) => a.code === code) ?? { code, name: code, country: "Unknown" };
