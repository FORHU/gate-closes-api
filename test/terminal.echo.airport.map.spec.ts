import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
// Imported before the controller: it imports `{ io } from "../app"` (see
// terminal.echo.airport.isolation.spec.ts).
import "../src/app";
import TerminalEchoCtrl from "../src/controllers/terminal.echo.controller";
import TerminalEchoSvc, { EchoOutsideAirportError } from "../src/services/terminal.echo.service";
import TerminalEchoRepo from "../src/repositories/terminal.echo.repository";
import AirportRepo from "../src/repositories/airport.repository";
import FileSvc from "../src/services/file.service";

// Map pins load per airport: zoomed in, `GET /map?airport=MNL`; zoomed out,
// `GET /map/counts` (one point per airport). Echoes therefore must belong
// to an airport, so creation outside every radius is refused.
describe("Terminal echo map per airport", () => {
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

  type MockRes = Response & { statusCode: number; body: { message?: string; data?: unknown } };
  const mockRes = () => {
    const res = { statusCode: 200, body: {} } as MockRes;
    res.status = ((code: number) => {
      res.statusCode = code;
      return res;
    }) as MockRes["status"];
    res.json = ((body: MockRes["body"]) => {
      res.body = body;
      return res;
    }) as MockRes["json"];
    return res;
  };

  /** Captures the aggregate pipeline and returns [rows]. */
  const stubAggregate = (rows: unknown[]) => {
    const seen: { pipeline?: Record<string, unknown>[] } = {};
    stub(TerminalEchoRepo, "collection", () => ({
      aggregate: (pipeline: Record<string, unknown>[]) => {
        seen.pipeline = pipeline;
        return { toArray: async () => rows };
      },
    }));
    return seen;
  };

  const userId = "650000000000000000000001";
  const mapReq = (query: Record<string, string>) =>
    ({ user: { userId }, query }) as unknown as Request;

  describe("repository", () => {
    it("filters one airport by code, newest first, max 100", async () => {
      const seen = stubAggregate([]);
      await TerminalEchoRepo.findAllForMap({ airportIata: "mnl" });
      expect(seen.pipeline).to.deep.equal([
        { $match: { airportIata: "MNL" } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 100 },
      ]);
    });

    it("counts per airport with the airport's own location", async () => {
      const latestAt = new Date("2026-10-05T01:00:00.000Z");
      stubAggregate([
        {
          _id: "MNL",
          count: 12,
          latestAt,
          echoLocation: { type: "Point", coordinates: [121.02, 14.51] },
          airport: [
            {
              airport: "Ninoy Aquino International Airport",
              location: { type: "Point", coordinates: [121.019208, 14.511205] },
            },
          ],
        },
      ]);
      expect(await TerminalEchoRepo.countByAirport()).to.deep.equal([
        {
          airportIata: "MNL",
          airportName: "Ninoy Aquino International Airport",
          count: 12,
          latestAt,
          location: { type: "Point", coordinates: [121.019208, 14.511205] },
        },
      ]);
    });

    it("falls back to an echo's location for an unknown airport code", async () => {
      stubAggregate([
        {
          _id: "RPLL",
          count: 1,
          echoLocation: { type: "Point", coordinates: [121.02, 14.51] },
          airport: [],
        },
      ]);
      const [row] = await TerminalEchoRepo.countByAirport();
      expect(row.airportName).to.equal(null);
      expect(row.latestAt).to.equal(null);
      expect(row.location).to.deep.equal({ type: "Point", coordinates: [121.02, 14.51] });
    });
  });

  describe("service", () => {
    it("builds one feature per airport, dropping rows without a point", async () => {
      stub(TerminalEchoRepo, "countByAirport", async () => [
        {
          airportIata: "MNL",
          airportName: "Ninoy Aquino International Airport",
          count: 12,
          latestAt: new Date("2026-10-05T01:00:00.000Z"),
          location: { type: "Point", coordinates: [121.019208, 14.511205] },
        },
        { airportIata: "XXX", airportName: null, count: 1, latestAt: null, location: null },
      ]);
      expect(await TerminalEchoSvc.airportCountsAsGeoJson()).to.deep.equal({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "MNL",
            geometry: { type: "Point", coordinates: [121.019208, 14.511205] },
            properties: {
              airportIata: "MNL",
              airportName: "Ninoy Aquino International Airport",
              count: 12,
              latestAt: "2026-10-05T01:00:00.000Z",
            },
          },
        ],
      });
    });

    const createParams = {
      userId: new ObjectId(userId),
      fileUrl: "https://example.com/echo.m4a",
      fileName: "echo.m4a",
      location: { type: "Point" as const, coordinates: [120.9, 15.2] as [number, number] },
      airportName: "Client string",
    };

    it("refuses an echo outside the nearest airport's radius", async () => {
      stub(AirportRepo, "findNearestWithDistance", async () => ({
        _id: new ObjectId(),
        iata: "MNL",
        airport: "Ninoy Aquino International Airport",
        radiusKm: 15,
        distanceKm: 80,
        insideRadius: false,
      }));
      let saved = false;
      stub(FileSvc, "create", async () => {
        saved = true;
        return { insertedId: new ObjectId() };
      });
      stub(TerminalEchoRepo, "create", async () => {
        saved = true;
        return { acknowledged: true, insertedId: new ObjectId() };
      });

      let thrown: unknown;
      try {
        await TerminalEchoSvc.createTerminalEcho(createParams as never);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.instanceOf(EchoOutsideAirportError);
      expect(saved).to.equal(false);
    });

    it("refuses an echo when no airport is found", async () => {
      stub(AirportRepo, "findNearestWithDistance", async () => null);
      let thrown: unknown;
      try {
        await TerminalEchoSvc.createTerminalEcho(createParams as never);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.instanceOf(EchoOutsideAirportError);
    });
  });

  describe("controller", () => {
    it("GET /map?airport= passes the upper-cased code to the service", async () => {
      let received: unknown;
      stub(TerminalEchoSvc, "findAllWithTypeAsGeoJson", async (_u: string, q: unknown) => {
        received = q;
        return { type: "FeatureCollection", features: [] };
      });
      const res = mockRes();
      await TerminalEchoCtrl.getMap(mapReq({ airport: " mnl " }), res);
      expect(res.statusCode).to.equal(200);
      expect(received).to.deep.equal({ airportIata: "MNL" });
    });

    it("GET /map rejects airport together with bounds", async () => {
      const res = mockRes();
      await TerminalEchoCtrl.getMap(
        mapReq({ airport: "MNL", west: "120", south: "14", east: "122", north: "15" }),
        res
      );
      expect(res.statusCode).to.equal(400);
    });

    it("GET /map rejects a malformed airport code", async () => {
      const res = mockRes();
      await TerminalEchoCtrl.getMap(mapReq({ airport: "MANILA!" }), res);
      expect(res.statusCode).to.equal(400);
    });

    it("GET /map with bounds still passes them as bounds", async () => {
      let received: unknown;
      stub(TerminalEchoSvc, "findAllWithTypeAsGeoJson", async (_u: string, q: unknown) => {
        received = q;
        return { type: "FeatureCollection", features: [] };
      });
      const res = mockRes();
      await TerminalEchoCtrl.getMap(
        mapReq({ west: "120", south: "14", east: "122", north: "15" }),
        res
      );
      expect(res.statusCode).to.equal(200);
      expect(received).to.deep.equal({
        bounds: [
          [120, 14],
          [122, 15],
        ],
      });
    });

    it("GET /map/counts returns the counts feature collection", async () => {
      const fc = { type: "FeatureCollection", features: [] };
      stub(TerminalEchoSvc, "airportCountsAsGeoJson", async () => fc);
      const res = mockRes();
      await TerminalEchoCtrl.getMapCounts(mapReq({}), res);
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ data: fc });
    });

    it("POST / answers 422 for an echo outside every airport", async () => {
      stub(TerminalEchoSvc, "createTerminalEcho", async () => {
        throw new EchoOutsideAirportError();
      });
      const res = mockRes();
      await TerminalEchoCtrl.create(
        {
          user: { userId },
          body: {
            fileUrl: "https://example.com/echo.m4a",
            fileName: "echo.m4a",
            location: { type: "Point", coordinates: [120.9, 15.2] },
            airportName: "Somewhere",
          },
        } as unknown as Request,
        res
      );
      expect(res.statusCode).to.equal(422);
      expect(res.body.message).to.equal("Echoes can only be posted inside an airport.");
    });
  });
});
