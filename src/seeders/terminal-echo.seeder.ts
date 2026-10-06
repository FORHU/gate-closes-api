import { Db, ObjectId } from "mongodb";
import { MTerminalEcho } from "../models/terminal.echo.model";
import { MTerminalEchoReply } from "../models/terminal.echo.reply.model";
import { DEMO_AIRPORTS } from "./demo-airports";
import {
  REACTIONS,
  dateOffsetDays,
  log,
  randomInt,
  randomItem,
  reactionCountField,
  type Reaction,
  type SeededUser,
} from "./helpers";

// Most local testing happens at NAIA, so it gets a busy feed and map of its
// own on top of the echoes spread across the other airports.
const HOME_AIRPORT_CODE = "MNL";
const HOME_AIRPORT_ECHOES = 12;
const OTHER_AIRPORT_ECHOES = 8;

const ECHO_TEXTS = [
  "Anyone else stuck at this gate for the next 2 hours?",
  "Free upgrade vibes only today",
  "Best coffee spot in this terminal?",
  "Delayed again... send help",
  "First time flying solo, kinda nervous!",
  "Layover buddies wanted for the next few hours",
  "Just landed, terminal is packed today",
  "Who else is on the evening flight out?",
];

const REPLY_TEXTS = [
  "Same here, it's brutal",
  "Try the place near the food court",
  "Haha good luck out there",
  "I'm nearby too, let's grab a coffee",
  "No kidding, this is my third delay this month",
  "You'll be fine, safe travels!",
];

/** Echoes (12 at MNL, 8 elsewhere) with reactions, replies and reply reactions. */
export async function seedTerminalEcho(db: Db, users: SeededUser[], files: ObjectId[]) {
  const echoCollection = db.collection("terminal.echo");
  const reactionCollection = db.collection("terminal.echo.reaction");
  const replyCollection = db.collection("terminal.echo.reply");
  const replyReactionCollection = db.collection("terminal.echo.reply.reaction");

  let echoCount = 0;
  let reactionCount = 0;
  let replyCount = 0;
  let replyReactionCount = 0;

  const home = DEMO_AIRPORTS.find((a) => a.code === HOME_AIRPORT_CODE)!;
  const others = DEMO_AIRPORTS.filter((a) => a.code !== HOME_AIRPORT_CODE);
  const placements = [
    ...Array.from({ length: HOME_AIRPORT_ECHOES }, () => home),
    ...Array.from({ length: OTHER_AIRPORT_ECHOES }, () => randomItem(others)),
  ];

  for (const [i, airport] of placements.entries()) {
    const sender = randomItem(users);
    const hasFile = Math.random() < 0.7;
    // Spread pins ~400 m around the terminal so clusters split on zoom-in.
    const jitter = () => (Math.random() - 0.5) * 0.008;
    const [lng, lat] = airport.coordinates;
    // The first few home echoes are minutes old, so the map shows "new" pins.
    const createdAt =
      airport === home && i < 4
        ? new Date(Date.now() - randomInt(1, 15) * 60 * 1000)
        : dateOffsetDays(-randomInt(0, 14));
    const echo = new MTerminalEcho({
      senderId: sender._id,
      fileId: hasFile ? randomItem(files) : undefined,
      textMessage: randomItem(ECHO_TEXTS),
      location: { type: "Point", coordinates: [lng + jitter(), lat + jitter()] },
      airportName: airport.name,
      airportIata: airport.code,
      countListens: randomInt(0, 40),
      createdAt,
    });
    await echoCollection.insertOne(echo);
    echoCount += 1;

    // Reactions from a random subset of other users, tallied into counts.
    const reactors = users.filter((u) => !u._id.equals(sender._id));
    const tally: Partial<Record<Reaction, number>> = {};
    const reactorCount = randomInt(0, Math.min(4, reactors.length));
    const picked = new Set<string>();
    for (let r = 0; r < reactorCount; r += 1) {
      const reactor = randomItem(reactors);
      if (picked.has(reactor._id.toHexString())) continue;
      picked.add(reactor._id.toHexString());
      const reaction = randomItem(REACTIONS);
      await reactionCollection.insertOne({
        _id: new ObjectId(),
        terminalEchoId: echo._id,
        userId: reactor._id,
        reaction,
        createdAt: new Date(),
      });
      tally[reaction] = (tally[reaction] ?? 0) + 1;
      reactionCount += 1;
    }
    if (Object.keys(tally).length > 0) {
      const inc: Record<string, number> = {};
      for (const [reaction, n] of Object.entries(tally))
        inc[reactionCountField(reaction as Reaction)] = n as number;
      await echoCollection.updateOne({ _id: echo._id }, { $inc: inc });
    }

    // Replies on ~half the echoes.
    if (Math.random() < 0.5) {
      const replyTotal = randomInt(1, 3);
      for (let r = 0; r < replyTotal; r += 1) {
        const replier = randomItem(users);
        const replyHasFile = Math.random() < 0.5;
        const reply = new MTerminalEchoReply({
          terminalEchoId: echo._id!,
          senderId: replier._id,
          fileId: replyHasFile ? randomItem(files) : undefined,
          textMessage: randomItem(REPLY_TEXTS),
          countListens: randomInt(0, 15),
        });
        await replyCollection.insertOne(reply);
        replyCount += 1;

        if (Math.random() < 0.4) {
          const reactor = randomItem(users.filter((u) => !u._id.equals(replier._id)));
          const reaction = randomItem(REACTIONS);
          await replyReactionCollection.insertOne({
            _id: new ObjectId(),
            terminalEchoReplyId: reply._id,
            userId: reactor._id,
            reaction,
            createdAt: new Date(),
          });
          await replyCollection.updateOne(
            { _id: reply._id },
            { $inc: { [reactionCountField(reaction)]: 1 } }
          );
          replyReactionCount += 1;
        }
      }
    }
  }
  log(
    `terminal echoes: ${echoCount}, reactions: ${reactionCount}, replies: ${replyCount}, ` +
      `reply reactions: ${replyReactionCount}`
  );
}
