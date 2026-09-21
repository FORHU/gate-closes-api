import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import TerminalEchoSvc from "../src/services/terminal.echo.service";
import TerminalEchoRepo from "../src/repositories/terminal.echo.repository";
import AirportRepo from "../src/repositories/airport.repository";
import FileSvc from "../src/services/file.service";

describe("TerminalEchoSvc (Server-Side Airport Resolution)", () => {
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

  it("should resolve airportIata and airportName server-side from coordinates", async () => {
    // Stub FileSvc.create
    stub(FileSvc, "create", async () => ({
      insertedId: new ObjectId("650000000000000000000010"),
    }));

    // Stub AirportRepo.findNearestWithDistance
    stub(AirportRepo, "findNearestWithDistance", async (params: { lat: number; lng: number }) => {
      expect(params.lat).to.equal(1.3644);
      expect(params.lng).to.equal(103.9915);
      return {
        _id: new ObjectId(),
        iata: "SIN",
        icao: "WSSS",
        airport: "Singapore Changi Airport",
        radiusKm: 15,
        distanceKm: 0.5,
        insideRadius: true,
      };
    });

    let savedEchoDoc: any = null;
    stub(TerminalEchoRepo, "create", async (doc: any) => {
      savedEchoDoc = doc;
      return {
        acknowledged: true,
        insertedId: new ObjectId("650000000000000000000020"),
      };
    });

    const result = await TerminalEchoSvc.createTerminalEcho({
      userId: new ObjectId("650000000000000000000001"),
      fileUrl: "https://example.com/echo.m4a",
      fileName: "echo.m4a",
      textMessage: "At gate B4 waiting for boarding",
      location: {
        type: "Point",
        coordinates: [103.9915, 1.3644], // [lng, lat]
      },
      airportName: "Untrusted Client String",
    });

    expect(result.insertedId.toString()).to.equal("650000000000000000000020");
    expect(result.airportIata).to.equal("SIN");
    expect(result.airportName).to.equal("Singapore Changi Airport");

    expect(savedEchoDoc).to.exist;
    expect(savedEchoDoc.airportIata).to.equal("SIN");
    expect(savedEchoDoc.airportName).to.equal("Singapore Changi Airport");
    expect(savedEchoDoc.fileId.toString()).to.equal("650000000000000000000010");
  });
});
