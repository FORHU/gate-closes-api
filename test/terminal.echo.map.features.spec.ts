import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { ObjectId } from "mongodb";
import TerminalEchoSvc from "../src/services/terminal.echo.service";
import ConversationSvc from "../src/services/conversation.service";
import ConversationRepo from "../src/repositories/conversation.repository";
import TerminalEchoRepo from "../src/repositories/terminal.echo.repository";
import { TERMINAL_ECHO_TYPE } from "../src/const";

describe("Map pins & DM existence contract", () => {
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

  it("map features carry createdAt and activity, never the sender", () => {
    const createdAt = new Date("2026-09-29T10:00:00.000Z");
    const fc = TerminalEchoSvc.toFeatureCollection([
      {
        _id: new ObjectId("650000000000000000000011"),
        senderId: new ObjectId("650000000000000000000001"),
        type: TERMINAL_ECHO_TYPE.TERMINAL_ECHO,
        location: { type: "Point", coordinates: [121.02, 14.51] },
        createdAt,
        listenCount: 9,
        reactionCount: 3,
      },
    ]);

    const feature = fc.features[0];
    expect(feature.id).to.equal("650000000000000000000011");
    expect(feature.properties).to.deep.equal({
      type: TERMINAL_ECHO_TYPE.TERMINAL_ECHO,
      createdAt: createdAt.toISOString(),
      listenCount: 9,
      reactionCount: 3,
    });
    expect(JSON.stringify(fc)).to.not.include("650000000000000000000001");
  });

  it("existence check returns the caller's conversation id", async () => {
    const convoId = new ObjectId("650000000000000000000099");
    stub(ConversationRepo, "findByDmKey", async () => ({ _id: convoId }));

    const result = await ConversationSvc.checkDmExists({
      type: "parallel_soul",
      userId: new ObjectId("650000000000000000000001"),
      otherUserId: new ObjectId("650000000000000000000002"),
    });

    expect(result).to.deep.equal({
      exists: true,
      conversationId: convoId.toString(),
    });
  });

  it("existence check without a conversation returns no id", async () => {
    stub(ConversationRepo, "findByDmKey", async () => null);

    const result = await ConversationSvc.checkDmExists({
      type: "parallel_soul",
      userId: new ObjectId("650000000000000000000001"),
      otherUserId: new ObjectId("650000000000000000000002"),
    });

    expect(result).to.deep.equal({ exists: false, conversationId: null });
  });
});

describe("Map view bounds filter", () => {
  const lng = "location.coordinates.0";
  const lat = "location.coordinates.1";

  it("matches a plain lng/lat range for a normal view", () => {
    expect(
      TerminalEchoRepo.mapBoundsMatch([
        [116, 4],
        [127, 21],
      ])
    ).to.deep.equal({
      "location.type": "Point",
      [lat]: { $gte: 4, $lte: 21 },
      [lng]: { $gte: 116, $lte: 127 },
    });
  });

  it("splits a view crossing the antimeridian into two lng ranges", () => {
    expect(
      TerminalEchoRepo.mapBoundsMatch([
        [100, -60],
        [-100, 60],
      ])
    ).to.deep.equal({
      "location.type": "Point",
      [lat]: { $gte: -60, $lte: 60 },
      $or: [{ [lng]: { $gte: 100 } }, { [lng]: { $lte: -100 } }],
    });
  });

  it("drops the lng filter for a whole-world view", () => {
    // A >180°-wide $geoWithin polygon matched nothing here.
    expect(
      TerminalEchoRepo.mapBoundsMatch([
        [-180, -85],
        [180, 85],
      ])
    ).to.deep.equal({
      "location.type": "Point",
      [lat]: { $gte: -85, $lte: 85 },
    });
  });
});
