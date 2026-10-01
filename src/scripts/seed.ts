import "dotenv/config";
import bcrypt from "bcrypt";
import { Db, ObjectId } from "mongodb";
import { MONGO_DB } from "../config";
import { connectToMongo, getDB, useMongoClient } from "../utils/mongo";
import { MUser } from "../models/user.model";
import { MUserAuth } from "../models/user.auth.model";
import { MFlightTicket } from "../models/flight.ticket.model";
import { MFile } from "../models/file.model";
import { MTerminalEcho } from "../models/terminal.echo.model";
import { MTerminalEchoReply } from "../models/terminal.echo.reply.model";
import { MVerificationCode } from "../models/verification.code.model";

// Scope: every collection actually read/written by live code (REST routes or
// socket events). Deliberately excludes:
//  - "airport": populated by the real Airport Crawl from crawled data, never
//    fake-seeded (see CONTEXT.md).
//  - "organizations" (todo.model.ts) and every fs.conversation*/
//    sovereignFutureSignal collection: unused template/unfinished-feature
//    scaffolding with no repository, service, controller, or route wired up.

const SEED_PASSWORD = "Password123!";
const REACTIONS = ["like", "love", "haha", "wow", "sad", "angry"] as const;
type Reaction = (typeof REACTIONS)[number];
const reactionCountField = (reaction: Reaction) =>
  `countReact${reaction[0].toUpperCase()}${reaction.slice(1)}`;

const randomItem = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const dateOffsetDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const dmKeyForUsers = (a: ObjectId, b: ObjectId) => {
  const sa = a.toHexString();
  const sb = b.toHexString();
  return sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
};

const uniquePairs = (ids: ObjectId[], count: number): [ObjectId, ObjectId][] => {
  const seen = new Set<string>();
  const pairs: [ObjectId, ObjectId][] = [];
  let attempts = 0;
  while (pairs.length < count && attempts < count * 25) {
    attempts += 1;
    const a = randomItem(ids);
    const b = randomItem(ids);
    if (a.equals(b)) continue;
    const key = dmKeyForUsers(a, b);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
  }
  return pairs;
};

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SEED_USERS: Array<{
  email: string;
  username: string;
  gender: "Male" | "Female";
  provider: "local" | "google";
  googleId?: string;
}> = [
  { email: "ava.morgan@example.com", username: "ava_morgan", gender: "Female", provider: "local" },
  { email: "liam.chen@example.com", username: "liam_chen", gender: "Male", provider: "local" },
  {
    email: "sofia.reyes@example.com",
    username: "sofia_reyes",
    gender: "Female",
    provider: "local",
  },
  { email: "noah.becker@example.com", username: "noah_becker", gender: "Male", provider: "local" },
  { email: "mia.tanaka@example.com", username: "mia_tanaka", gender: "Female", provider: "local" },
  {
    email: "ethan.oconnor@example.com",
    username: "ethan_oconnor",
    gender: "Male",
    provider: "local",
  },
  { email: "zara.khan@example.com", username: "zara_khan", gender: "Female", provider: "local" },
  { email: "lucas.silva@example.com", username: "lucas_silva", gender: "Male", provider: "local" },
  {
    email: "amelia.novak@example.com",
    username: "amelia_novak",
    gender: "Female",
    provider: "google",
    googleId: "100000000000000001",
  },
  {
    email: "oliver.dubois@example.com",
    username: "oliver_dubois",
    gender: "Male",
    provider: "google",
    googleId: "100000000000000002",
  },
];

const AIRPORTS: Array<{
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

// Most local testing happens at NAIA, so it gets a busy feed and map of its
// own on top of the echoes spread across the other airports.
const HOME_AIRPORT_CODE = "MNL";
const HOME_AIRPORT_ECHOES = 12;
const OTHER_AIRPORT_ECHOES = 8;

const FLIGHT_LEGS = [
  { flightNumber: "PR102", from: "MNL", to: "LAX" },
  { flightNumber: "PR501", from: "MNL", to: "SIN" },
  { flightNumber: "SQ916", from: "SIN", to: "MNL" },
  { flightNumber: "PR720", from: "MNL", to: "LHR" },
  { flightNumber: "DL202", from: "JFK", to: "LHR" },
  { flightNumber: "UA837", from: "LAX", to: "NRT" },
  { flightNumber: "EK412", from: "DXB", to: "SIN" },
  { flightNumber: "AF014", from: "CDG", to: "JFK" },
  { flightNumber: "SQ321", from: "SIN", to: "SYD" },
  { flightNumber: "LH441", from: "FRA", to: "ORD" },
  { flightNumber: "QF9", from: "SYD", to: "LAX" },
  { flightNumber: "BA117", from: "LHR", to: "DXB" },
];
const airportByCode = (code: string) =>
  AIRPORTS.find((a) => a.code === code) ?? { code, name: code, country: "Unknown" };

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

// ---------------------------------------------------------------------------
// Section seeders
// ---------------------------------------------------------------------------

type SeededUser = { _id: ObjectId; username: string };

const wipeCollections = async (db: Db) => {
  const names = [
    "user",
    "user.auth",
    "flightTicket",
    "file",
    "verification.code",
    "terminal.echo",
    "terminal.echo.reaction",
    "terminal.echo.reply",
    "terminal.echo.reply.reaction",
    "btConversation",
    "btConversationMessage",
    "btConversationMessage.reaction",
    "btConversationReadState",
    "dtConversation",
    "dtConversationMessage",
    "dtConversationMessage.reaction",
    "dtConversationReadState",
    "psConversation",
    "psConversationMessage",
    "psConversationMessage.reaction",
    "psConversationReadState",
  ];
  console.log(`[seed] wiping ${names.length} collections...`);
  await Promise.all(names.map((name) => db.collection(name).deleteMany({})));
};

const seedUsersAndAuth = async (db: Db): Promise<SeededUser[]> => {
  const userCollection = db.collection("user");
  const userAuthCollection = db.collection("user.auth");
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  const users: SeededUser[] = [];
  for (const seedUser of SEED_USERS) {
    const user = new MUser({
      email: seedUser.email,
      username: seedUser.username,
      gender: seedUser.gender,
      signupStep: "completed",
      signupCompleted: true,
      isCompleteProfile: true,
    });
    await userCollection.insertOne(user);
    users.push({ _id: user._id!, username: seedUser.username });

    const auth = new MUserAuth(
      seedUser.provider === "google"
        ? { userId: user._id!, provider: "google", googleId: seedUser.googleId }
        : { userId: user._id!, provider: "local", password: hashedPassword }
    );
    await userAuthCollection.insertOne(auth);
  }
  return users;
};

const seedFlightTickets = async (db: Db, users: SeededUser[]) => {
  const collection = db.collection("flightTicket");
  let count = 0;
  for (const user of users) {
    const ticketsForUser = randomInt(1, 2);
    for (let i = 0; i < ticketsForUser; i += 1) {
      const leg = randomItem(FLIGHT_LEGS);
      const from = airportByCode(leg.from);
      const to = airportByCode(leg.to);
      const departureOffset = randomInt(-30, 30);
      const ticket = new MFlightTicket({
        userId: user._id,
        flightNumber: leg.flightNumber,
        fromAirport: leg.from,
        toAirport: leg.to,
        fromAirportName: from.name,
        toAirportName: to.name,
        fromCountry: from.country,
        toCountry: to.country,
        departureDateTime: dateOffsetDays(departureOffset),
        returnDateTime: dateOffsetDays(departureOffset + 7),
      });
      await collection.insertOne(ticket);
      count += 1;
    }
  }
  console.log(`[seed] flightTicket: ${count}`);
};

const seedFiles = async (db: Db): Promise<ObjectId[]> => {
  const collection = db.collection("file");
  const ids: ObjectId[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const file = new MFile({
      fileUrl: `https://gate-closes-seed.s3.amazonaws.com/voice-notes/voice-${i}.m4a`,
      fileName: `voice-${i}.m4a`,
      metaData: { mimeType: "audio/m4a", durationSec: randomInt(2, 45) },
    });
    await collection.insertOne(file);
    ids.push(file._id!);
  }
  console.log(`[seed] file: ${ids.length}`);
  return ids;
};

const seedTerminalEcho = async (db: Db, users: SeededUser[], files: ObjectId[]) => {
  const echoCollection = db.collection("terminal.echo");
  const reactionCollection = db.collection("terminal.echo.reaction");
  const replyCollection = db.collection("terminal.echo.reply");
  const replyReactionCollection = db.collection("terminal.echo.reply.reaction");

  let echoCount = 0;
  let reactionCount = 0;
  let replyCount = 0;
  let replyReactionCount = 0;

  const home = AIRPORTS.find((a) => a.code === HOME_AIRPORT_CODE)!;
  const others = AIRPORTS.filter((a) => a.code !== HOME_AIRPORT_CODE);
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
  console.log(
    `[seed] terminal.echo: ${echoCount} reaction: ${reactionCount} reply: ${replyCount} reply.reaction: ${replyReactionCount}`
  );
};

// bt/dt/ps conversations are structurally identical parallel features (1:1
// DM threads), differing only by field-name prefix (btSenderId vs dtSenderId
// vs psSenderId, etc.) — seeded through one generic namespace-driven helper
// rather than three copy-pasted blocks.
const CONVERSATION_NAMESPACES = [
  {
    prefix: "bt",
    conversation: "btConversation",
    message: "btConversationMessage",
    reaction: "btConversationMessage.reaction",
    readState: "btConversationReadState",
  },
  {
    prefix: "dt",
    conversation: "dtConversation",
    message: "dtConversationMessage",
    reaction: "dtConversationMessage.reaction",
    readState: "dtConversationReadState",
  },
  {
    prefix: "ps",
    conversation: "psConversation",
    message: "psConversationMessage",
    reaction: "psConversationMessage.reaction",
    readState: "psConversationReadState",
  },
] as const;

const seedConversationNamespace = async (
  db: Db,
  ns: (typeof CONVERSATION_NAMESPACES)[number],
  users: SeededUser[],
  files: ObjectId[]
) => {
  const conversationCollection = db.collection(ns.conversation);
  const messageCollection = db.collection(ns.message);
  const reactionCollection = db.collection(ns.reaction);
  const readStateCollection = db.collection(ns.readState);

  const senderIdField = `${ns.prefix}SenderId`;
  const conversationIdField = `${ns.prefix}ConversationId`;
  const messageIdField = `${ns.prefix}ConversationMessageId`;

  const usersById = new Map(users.map((u) => [u._id.toHexString(), u]));
  const pairs = uniquePairs(
    users.map((u) => u._id),
    4
  );

  let conversationCount = 0;
  let messageCount = 0;
  let reactionCount = 0;
  let readStateCount = 0;

  for (const [a, b] of pairs) {
    const createdAt = dateOffsetDays(-randomInt(1, 20));
    const conversationId = new ObjectId();
    await conversationCollection.insertOne({
      _id: conversationId,
      participants: [a, b],
      dmKey: dmKeyForUsers(a, b),
      createdAt,
    });
    conversationCount += 1;

    const messageTotal = randomInt(3, 6);
    let lastMessage: { _id: ObjectId; senderId: ObjectId; createdAt: Date } | null = null;

    for (let m = 0; m < messageTotal; m += 1) {
      const senderId = Math.random() < 0.5 ? a : b;
      const messageId = new ObjectId();
      const messageCreatedAt = dateOffsetDays(-randomInt(0, 19));
      await messageCollection.insertOne({
        _id: messageId,
        [senderIdField]: senderId,
        [conversationIdField]: conversationId,
        fileId: randomItem(files),
        countReactLike: 0,
        countReactLove: 0,
        countReactHaha: 0,
        countReactWow: 0,
        countReactSad: 0,
        countReactAngry: 0,
        createdAt: messageCreatedAt,
      });
      messageCount += 1;

      if (Math.random() < 0.3) {
        const reactorId = senderId.equals(a) ? b : a;
        const reaction: Reaction = randomItem(REACTIONS);
        await reactionCollection.insertOne({
          _id: new ObjectId(),
          [messageIdField]: messageId,
          userId: reactorId,
          reaction,
          createdAt: new Date(),
        });
        await messageCollection.updateOne(
          { _id: messageId },
          { $inc: { [reactionCountField(reaction)]: 1 } }
        );
        reactionCount += 1;
      }

      if (!lastMessage || messageCreatedAt > lastMessage.createdAt) {
        lastMessage = { _id: messageId, senderId, createdAt: messageCreatedAt };
      }
    }

    if (lastMessage) {
      const actorName = usersById.get(lastMessage.senderId.toHexString())?.username ?? "Someone";
      await conversationCollection.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastEventType: "message_sent",
            lastEventAt: lastMessage.createdAt,
            lastEventActorId: lastMessage.senderId,
            lastEventActorName: actorName,
            lastEventText: `${actorName} sent a new message`,
          },
        }
      );
    }

    // Read state per participant — one reads up to the last message
    // (no unread badge), the other reads slightly earlier (has an unread).
    for (const participant of [a, b]) {
      const lastReadAt = lastMessage
        ? Math.random() < 0.5
          ? lastMessage.createdAt
          : dateOffsetDays(-randomInt(0, 5))
        : createdAt;
      await readStateCollection.insertOne({
        _id: new ObjectId(),
        [conversationIdField]: conversationId,
        userId: participant,
        lastReadAt,
        createdAt,
      });
      readStateCount += 1;
    }
  }

  console.log(
    `[seed] ${ns.conversation}: ${conversationCount} messages: ${messageCount} reactions: ${reactionCount} readStates: ${readStateCount}`
  );
};

const seedVerificationCodes = async (db: Db, users: SeededUser[]) => {
  const collection = db.collection("verification.code");
  const sample = users.slice(0, 2);
  for (const user of sample) {
    const codeHash = await bcrypt.hash("000000", 10);
    const code = new MVerificationCode({
      userId: user._id,
      codeHash,
      purpose: "reset_password",
      expiresAt: dateOffsetDays(-25),
      resendAfter: dateOffsetDays(-25),
      attempts: 1,
      createdAt: dateOffsetDays(-25),
    });
    await collection.insertOne(code);
  }
  console.log(`[seed] verification.code: ${sample.length}`);
};

// ---------------------------------------------------------------------------

const main = async () => {
  // The seed wipes users, echoes and conversations first. Refuse unless the
  // caller names the database being wiped, so a .env pointing somewhere real
  // can't be emptied by accident.
  if (!MONGO_DB || process.env.SEED_CONFIRM_DB !== MONGO_DB) {
    throw new Error(
      `refusing to wipe database "${MONGO_DB}". Re-run with SEED_CONFIRM_DB=${MONGO_DB} ` +
        "if this database holds nothing you need."
    );
  }

  await connectToMongo();
  const db = getDB();

  await wipeCollections(db);

  const users = await seedUsersAndAuth(db);
  console.log(`[seed] user: ${users.length}`);

  await seedFlightTickets(db, users);
  const files = await seedFiles(db);
  await seedTerminalEcho(db, users, files);

  for (const ns of CONVERSATION_NAMESPACES) {
    await seedConversationNamespace(db, ns, users, files);
  }

  await seedVerificationCodes(db, users);

  console.log(`[seed] done. All "local" provider users share password="${SEED_PASSWORD}"`);
};

main()
  .catch((error) => {
    console.error(`[seed] fatal: ${(error as Error)?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = useMongoClient();
    if (client) await client.close();
  });
