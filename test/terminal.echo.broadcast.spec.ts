import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import { airportRoom, broadcastToAirportRoom } from "../src/events/terminal.echo.broadcast";
import TerminalEchoRepo from "../src/repositories/terminal.echo.repository";

/**
 * MERGE_HARDENING_PLAN.md Blocker 1 — Terminal Echo Broadcast Isolation.
 *
 * Verifies the single choke point every Terminal Echo real-time event
 * now goes through: a canonical airport room is derived server-side,
 * and — critically — no event falls back to a namespace-wide broadcast
 * when that room can't be determined. Room-level fan-out itself (does
 * everyone in `.to(room)` actually receive the event, and nobody
 * outside it) is Socket.IO's own responsibility and is exercised at
 * the transport layer in Phase 10's multi-instance testing; what's
 * unit-testable here — and where all four original bugs lived — is
 * which room string gets computed and whether `.emit()` is ever
 * called without one.
 */
describe("terminal.echo.broadcast (airport room isolation)", () => {
  describe("airportRoom", () => {
    it("builds a canonical uppercased airport room for a valid IATA", () => {
      expect(airportRoom("sin")).to.equal("airport:SIN");
      expect(airportRoom("LHR")).to.equal("airport:LHR");
    });

    it("returns null for missing/empty/whitespace-only IATA", () => {
      expect(airportRoom(undefined)).to.equal(null);
      expect(airportRoom(null)).to.equal(null);
      expect(airportRoom("")).to.equal(null);
      expect(airportRoom("   ")).to.equal(null);
    });
  });

  describe("broadcastToAirportRoom", () => {
    // Minimal fake matching the io.of(nsp).to(room).emit(event, payload) chain.
    const fakeIo = () => {
      const calls: Array<{ room: string; event: string; payload: unknown }> = [];
      let nsPath: string | null = null;
      const fake: any = {
        of: (path: string) => {
          nsPath = path;
          return fake;
        },
        to: (room: string) => {
          calls.push({ room, event: "", payload: undefined });
          return {
            emit: (event: string, payload: unknown) => {
              const last = calls[calls.length - 1];
              last.event = event;
              last.payload = payload;
            },
          };
        },
        // If broadcastToAirportRoom ever regresses to calling emit()
        // directly on the namespace (bypassing .to(room)), this
        // records it distinctly so the "no global fallback" tests
        // below can assert it was never touched.
        emit: (event: string, payload: unknown) => {
          calls.push({ room: "__NAMESPACE_WIDE__", event, payload });
        },
      };
      return { fake, calls, getNamespace: () => nsPath };
    };

    it("scopes the emit to the resolved airport room and the /terminal-echo namespace", () => {
      const { fake, calls, getNamespace } = fakeIo();

      broadcastToAirportRoom(fake, "sin", "terminal_echo:changed", { type: "create", data: {} });

      expect(getNamespace()).to.equal("/terminal-echo");
      expect(calls).to.have.length(1);
      expect(calls[0].room).to.equal("airport:SIN");
      expect(calls[0].event).to.equal("terminal_echo:changed");
    });

    it("does NOT broadcast at all when no canonical airport can be resolved (fail-safe, not global fallback)", () => {
      const { fake, calls } = fakeIo();

      broadcastToAirportRoom(fake, null, "terminal_echo:changed", { type: "create", data: {} });
      broadcastToAirportRoom(fake, undefined, "terminal_echo:changed", { type: "create", data: {} });
      broadcastToAirportRoom(fake, "", "terminal_echo:changed", { type: "create", data: {} });

      // The old bug: falling through to a bare namespace-wide .emit().
      // The fix: silently skip rather than reach every airport's clients.
      expect(calls).to.have.length(0);
    });

    it("isolates two airports to two distinct rooms — events for SIN never target LHR's room and vice versa", () => {
      const { fake, calls } = fakeIo();

      broadcastToAirportRoom(fake, "SIN", "terminal_echo:changed", { echoId: "echo-a" });
      broadcastToAirportRoom(fake, "LHR", "terminal_echo:changed", { echoId: "echo-b" });

      expect(calls).to.have.length(2);
      const sinCall = calls.find((c) => (c.payload as any).echoId === "echo-a");
      const lhrCall = calls.find((c) => (c.payload as any).echoId === "echo-b");
      expect(sinCall!.room).to.equal("airport:SIN");
      expect(lhrCall!.room).to.equal("airport:LHR");
      expect(sinCall!.room).to.not.equal(lhrCall!.room);
    });
  });

  describe("TerminalEchoRepo.findAirportIataById", () => {
    const originalCollection = TerminalEchoRepo.collection;
    afterEach(() => {
      TerminalEchoRepo.collection = originalCollection;
    });

    it("returns the persisted airportIata for a valid echo id", async () => {
      const echoId = new ObjectId();
      let capturedFilter: any = null;
      let capturedOptions: any = null;
      (TerminalEchoRepo as any).collection = () => ({
        findOne: async (filter: any, options: any) => {
          capturedFilter = filter;
          capturedOptions = options;
          return { _id: echoId, airportIata: "SIN" };
        },
      });

      const result = await TerminalEchoRepo.findAirportIataById(echoId);

      expect(result).to.equal("SIN");
      expect(capturedFilter._id.toString()).to.equal(echoId.toString());
      expect(capturedOptions.projection).to.deep.equal({ airportIata: 1 });
    });

    it("returns null when the echo has no resolved airport", async () => {
      (TerminalEchoRepo as any).collection = () => ({
        findOne: async () => ({ _id: new ObjectId() }),
      });

      const result = await TerminalEchoRepo.findAirportIataById(new ObjectId());
      expect(result).to.equal(null);
    });

    it("returns null for an invalid id instead of throwing", async () => {
      const result = await TerminalEchoRepo.findAirportIataById("not-an-object-id");
      expect(result).to.equal(null);
    });
  });
});
