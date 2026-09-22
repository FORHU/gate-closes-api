import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
// `io` (and the app.ts -> routes -> controller chain it pulls in) must be
// imported before the controllers below: those controllers themselves
// import `{ io } from "../app"`, and resolving app.ts's chain first here
// avoids a circular-require partial-exports issue if this file ever runs
// in isolation rather than as part of the full glob-loaded suite.
import { io } from "../src/app";
import TerminalEchoCtrl from "../src/controllers/terminal.echo.controller";
import TerminalEchoReplyCtrl from "../src/controllers/terminal.echo.reply.controller";
import TerminalEchoSvc from "../src/services/terminal.echo.service";
import TerminalEchoReplySvc from "../src/services/terminal.echo.reply.service";

/**
 * MERGE_HARDENING_PLAN.md Blocker 1 — end-to-end behavioral verification.
 *
 * Unlike terminal.echo.broadcast.spec.ts (which unit-tests the
 * `broadcastToAirportRoom` helper and repo lookup in isolation), this
 * file drives the actual controller methods — Create, Echo Reaction,
 * Reply, Reply Reaction — through stubbed services/repos, and asserts
 * on the REAL `io` singleton's `.of().to().emit()` calls. This proves
 * the controllers correctly extract airportIata from real service
 * results and wire it into the shared broadcast helper, not just that
 * the helper works when handed a room string directly.
 */
describe("Terminal Echo airport isolation — controller wiring (§Blocker 1)", () => {
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

  type Call = { namespace: string; room: string; event: string; payload: unknown };

  const stubIo = () => {
    const calls: Call[] = [];
    const globalEmits: Array<{ namespace: string; event: string; payload: unknown }> = [];
    const originalOf = io.of.bind(io);
    stub(io, "of", (path: string) => ({
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          calls.push({ namespace: path, room, event, payload });
        },
      }),
      // Regression guard: if any handler falls back to a bare namespace
      // .emit() (the original bug), it lands here instead of `calls`.
      emit: (event: string, payload: unknown) => {
        globalEmits.push({ namespace: path, event, payload });
      },
    }));
    return { calls, globalEmits, originalOf };
  };

  const fakeRes = () => {
    let status = 200;
    let body: any = null;
    const res = {
      status: (code: number) => {
        status = code;
        return { json: (data: any) => (body = data) };
      },
      // updateReaction on both controllers responds via `res.json(...)`
      // directly (200 implied), unlike create/errors which go through
      // `res.status(code).json(...)`.
      json: (data: any) => (body = data),
    } as unknown as Response;
    return { res, getStatus: () => status, getBody: () => body };
  };

  describe("Echo creation", () => {
    it("SIN and LHR echoes broadcast to their own airport room only, never to each other's", async () => {
      const { calls, globalEmits } = stubIo();

      stub(TerminalEchoSvc, "createTerminalEcho", async (params: { airportName?: string }) => ({
        insertedId: new ObjectId(),
        acknowledged: true,
        airportIata: params.airportName === "LHR-hint" ? "LHR" : "SIN",
        airportName: "Test Airport",
      }));

      const baseBody = {
        fileUrl: "https://example.com/a.m4a",
        fileName: "a.m4a",
        textMessage: "hi",
        location: { type: "Point", coordinates: [0, 0] },
      };

      const { res: resA } = fakeRes();
      await TerminalEchoCtrl.create(
        {
          user: { userId: "u1" },
          body: { ...baseBody, airportName: "SIN-hint" },
        } as unknown as Request,
        resA
      );

      const { res: resB } = fakeRes();
      await TerminalEchoCtrl.create(
        {
          user: { userId: "u2" },
          body: { ...baseBody, airportName: "LHR-hint" },
        } as unknown as Request,
        resB
      );

      expect(globalEmits).to.have.length(0);
      expect(calls).to.have.length(2);
      expect(calls[0].namespace).to.equal("/terminal-echo");
      expect(calls[0].room).to.equal("airport:SIN");
      expect(calls[1].room).to.equal("airport:LHR");
      expect(calls[0].room).to.not.equal(calls[1].room);
    });

    it("never falls back to a namespace-wide broadcast when airport resolution fails", async () => {
      const { calls, globalEmits } = stubIo();

      stub(TerminalEchoSvc, "createTerminalEcho", async () => ({
        insertedId: new ObjectId(),
        acknowledged: true,
        airportIata: "", // resolution failed
        airportName: "",
      }));

      const { res } = fakeRes();
      await TerminalEchoCtrl.create(
        {
          user: { userId: "u1" },
          body: {
            fileUrl: "https://example.com/a.m4a",
            fileName: "a.m4a",
            textMessage: "hi",
            location: { type: "Point", coordinates: [0, 0] },
            airportName: "Somewhere",
          },
        } as unknown as Request,
        res
      );

      expect(calls).to.have.length(0);
      expect(globalEmits).to.have.length(0);
    });
  });

  describe("Echo reaction", () => {
    it("scopes to the reacted echo's airport room, derived from the persisted document", async () => {
      const { calls, globalEmits } = stubIo();

      stub(TerminalEchoSvc, "updateReaction", async () => ({
        ok: 1,
        value: { _id: new ObjectId(), airportIata: "SIN" },
        action: "increment",
      }));

      const { res } = fakeRes();
      await TerminalEchoCtrl.updateReaction(
        {
          user: { userId: "u1" },
          params: { id: new ObjectId().toString() },
          body: { reaction: "like" },
        } as unknown as Request,
        res
      );

      expect(globalEmits).to.have.length(0);
      expect(calls).to.have.length(1);
      expect(calls[0].room).to.equal("airport:SIN");
      expect(calls[0].event).to.equal("terminal_echo:reaction_updated");
    });
  });

  describe("Reply added", () => {
    it("scopes to the PARENT echo's airport room, looked up via TerminalEchoSvc", async () => {
      const { calls, globalEmits } = stubIo();
      const terminalEchoId = new ObjectId().toString();

      stub(TerminalEchoReplySvc, "createReply", async () => ({
        acknowledged: true,
        insertedId: new ObjectId(),
      }));
      stub(TerminalEchoReplySvc, "findReplyById", async () => ({ _id: new ObjectId() }));
      stub(TerminalEchoSvc, "findAirportIataById", async (id: string) => {
        expect(id).to.equal(terminalEchoId);
        return "LHR";
      });

      const { res } = fakeRes();
      await TerminalEchoReplyCtrl.create(
        {
          user: { userId: "u1" },
          body: { terminalEchoId, textMessage: "reply text" },
        } as unknown as Request,
        res
      );

      expect(globalEmits).to.have.length(0);
      // Two scoped emits expected: thread:<id> (full reply content) and
      // airport:<IATA> (reply-count bump for feed/map).
      expect(calls.map((c) => c.room)).to.include.members([
        `thread:${terminalEchoId}`,
        "airport:LHR",
      ]);
      const airportCall = calls.find((c) => c.room === "airport:LHR");
      expect(airportCall!.event).to.equal("terminal_echo:reply_added");
    });

    it("does not broadcast the reply-count bump at all when the parent echo's airport can't be resolved", async () => {
      const { calls, globalEmits } = stubIo();
      const terminalEchoId = new ObjectId().toString();

      stub(TerminalEchoReplySvc, "createReply", async () => ({
        acknowledged: true,
        insertedId: new ObjectId(),
      }));
      stub(TerminalEchoReplySvc, "findReplyById", async () => ({ _id: new ObjectId() }));
      stub(TerminalEchoSvc, "findAirportIataById", async () => null);

      const { res } = fakeRes();
      await TerminalEchoReplyCtrl.create(
        {
          user: { userId: "u1" },
          body: { terminalEchoId, textMessage: "reply text" },
        } as unknown as Request,
        res
      );

      expect(globalEmits).to.have.length(0);
      // Thread room still gets the full reply (targeted, unrelated to airport
      // scoping), but no airport-wide reply-count bump was sent.
      expect(calls.map((c) => c.room)).to.deep.equal([`thread:${terminalEchoId}`]);
    });
  });

  describe("Reply reaction (already thread-scoped, not part of the airport-room bug)", () => {
    it("scopes to the thread room, never the whole namespace or an airport room", async () => {
      const { calls, globalEmits } = stubIo();
      const terminalEchoId = new ObjectId();

      stub(TerminalEchoReplySvc, "updateReaction", async () => ({
        ok: 1,
        value: { _id: new ObjectId(), terminalEchoId },
        action: "increment",
      }));

      const { res } = fakeRes();
      await TerminalEchoReplyCtrl.updateReaction(
        {
          user: { userId: "u1" },
          params: { id: new ObjectId().toString() },
          body: { reaction: "like" },
        } as unknown as Request,
        res
      );

      expect(globalEmits).to.have.length(0);
      expect(calls).to.have.length(1);
      expect(calls[0].room).to.equal(`thread:${terminalEchoId.toString()}`);
      expect(calls[0].room.startsWith("airport:")).to.equal(false);
    });
  });
});
