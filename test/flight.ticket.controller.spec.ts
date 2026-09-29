import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import FlightTicketCtrl from "../src/controllers/flight.ticket.controller";
import FlightTicketSvc from "../src/services/flight.ticket.service";

// Calls the controller's handlers directly with minimal req/res doubles,
// stubbing FlightTicketSvc so no real Mongo connection is touched — same
// pattern as airport.controller.spec.ts.
//
// STEP 10c / B-6 regression target: PUT /flight-ticket's Joi schema used to
// have no entries for gate/seat/terminal/boardingDateTime, so
// `stripUnknown: true` silently deleted them from an edit even if the
// client sent them — a ticket edit would wipe fields the user never touched.
describe("FlightTicketCtrl.update", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: T[K]) => {
    const original = obj[key];
    obj[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  const mockRes = () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body: any) => {
      res.body = body;
      return res;
    };
    return res;
  };

  const userId = new ObjectId().toHexString();

  it("forwards gate/seat/terminal/boardingDateTime to the service instead of stripping them", async () => {
    let received: Record<string, unknown> | null = null;
    stub(FlightTicketSvc, "update", async (_uid: ObjectId, value: any) => {
      received = value;
      return { _id: new ObjectId() };
    });
    const res = mockRes();

    await FlightTicketCtrl.update(
      {
        user: { userId },
        body: {
          gate: "12",
          seat: "18A",
          terminal: "3",
          boardingDateTime: "2026-09-25T06:00:00.000Z",
        },
      } as any,
      res
    );

    expect(res.statusCode).to.equal(200);
    expect(received).to.not.be.null;
    expect(received!.gate).to.equal("12");
    expect(received!.seat).to.equal("18A");
    expect(received!.terminal).to.equal("3");
    expect(received!.boardingDateTime).to.be.instanceOf(Date);
  });

  it("allows a partial edit that only touches one field", async () => {
    let received: Record<string, unknown> | null = null;
    stub(FlightTicketSvc, "update", async (_uid: ObjectId, value: any) => {
      received = value;
      return { _id: new ObjectId() };
    });
    const res = mockRes();

    await FlightTicketCtrl.update(
      { user: { userId }, body: { seat: "22C" } } as any,
      res
    );

    // Joi's validated `value` carries every schema key, undefined ones
    // included (pre-existing behavior, not something this fix changes) —
    // assert on the field that matters rather than the whole shape.
    expect(res.statusCode).to.equal(200);
    expect(received).to.not.be.null;
    expect(received!.seat).to.equal("22C");
    expect(received!.gate).to.be.undefined;
    expect(received!.terminal).to.be.undefined;
    expect(received!.boardingDateTime).to.be.undefined;
  });

  it("500s with the error message when the service throws", async () => {
    stub(FlightTicketSvc, "update", async () => {
      throw new Error("Flight ticket not found or could not be updated");
    });
    const res = mockRes();

    await FlightTicketCtrl.update(
      { user: { userId }, body: { seat: "22C" } } as any,
      res
    );

    expect(res.statusCode).to.equal(500);
    expect(res.body).to.deep.equal({
      message: "Flight ticket not found or could not be updated",
    });
  });
});
