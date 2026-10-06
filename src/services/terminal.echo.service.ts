import { Document, ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";
import TerminalEchoReactionRepo from "../repositories/terminal.echo.reaction.repository";
import AirportRepo from "../repositories/airport.repository";
import FileSvc from "./file.service";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import { TERMINAL_ECHO_TYPE, type TerminalEchoMapQuery, type TerminalEchoType } from "../const";

/** Thrown when an echo is posted outside every airport's radius. */
export class EchoOutsideAirportError extends Error {
  constructor() {
    super("Echoes can only be posted inside an airport.");
    this.name = "EchoOutsideAirportError";
  }
}

type TerminalEchoMapFeatureSource = {
  _id: ObjectId;
  senderId: ObjectId;
  type: TerminalEchoType;
  location: { type: "Point"; coordinates: [number, number] };
  createdAt?: Date;
  listenCount: number;
  reactionCount: number;
};

const REACTION_COUNT_FIELDS = [
  "countReactLike",
  "countReactLove",
  "countReactHaha",
  "countReactWow",
  "countReactSad",
  "countReactAngry",
] as const;

/** Map-pin activity: listens and total reactions (drives the app heatmap). */
const pinActivity = (echo: Document) => ({
  createdAt: echo.createdAt as Date | undefined,
  listenCount: Number(echo.countListens ?? 0),
  reactionCount: REACTION_COUNT_FIELDS.reduce((sum, field) => sum + Number(echo[field] ?? 0), 0),
});

export default class TerminalEchoSvc {
  private static isPointGeometry(location: unknown): location is {
    type: "Point";
    coordinates: [number, number];
  } {
    return (
      typeof location === "object" &&
      location !== null &&
      (location as { type?: unknown }).type === "Point" &&
      Array.isArray((location as { coordinates?: unknown }).coordinates) &&
      (location as { coordinates: unknown[] }).coordinates.length === 2 &&
      typeof (location as { coordinates: unknown[] }).coordinates[0] === "number" &&
      typeof (location as { coordinates: unknown[] }).coordinates[1] === "number"
    );
  }

  static toFeatureCollection(echoes: TerminalEchoMapFeatureSource[]) {
    const features = (echoes ?? [])
      .filter((echo) => this.isPointGeometry(echo?.location))
      .map((echo) => {
        const { location, _id, type, createdAt, listenCount, reactionCount } = echo;
        return {
          type: "Feature" as const,
          id: _id?.toString?.() ?? String(_id),
          geometry: location,
          // No senderId: the map never reveals who posted a pin.
          properties: {
            type: type ?? null,
            createdAt: createdAt ? new Date(createdAt).toISOString() : null,
            listenCount,
            reactionCount,
          },
        };
      });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }

  private static dateKey(d?: Date) {
    if (!d) return "";
    const dd = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dd.getTime())) return "";
    return dd.toISOString().slice(0, 10);
  }

  private static computeType(params: {
    authTicket: Document | null;
    otherTicket: Document | null;
  }): TerminalEchoType {
    const { authTicket, otherTicket } = params;

    if (!authTicket) return TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
    if (!otherTicket) return TERMINAL_ECHO_TYPE.TERMINAL_ECHO;

    const authDeparture = this.dateKey(authTicket.departureDateTime);
    const otherDeparture = this.dateKey(otherTicket.departureDateTime);

    const authFlightNumber = (authTicket.flightNumber ?? "").trim();
    const authFromAirport = (authTicket.fromAirport ?? "").trim();
    const authToAirport = (authTicket.toAirport ?? "").trim();

    const otherFlightNumber = (otherTicket.flightNumber ?? "").trim();
    const otherFromAirport = (otherTicket.fromAirport ?? "").trim();
    const otherToAirport = (otherTicket.toAirport ?? "").trim();

    // parallel_soul: same route — same fromAirport AND same toAirport.
    // Matches PsConversationSvc.createDm's eligibility check exactly, so a
    // pin classified here is always actually eligible to start a Parallel
    // Soul conversation (previously required an exact flightNumber +
    // departureDateTime match, which was stricter than this classification
    // used to be — a ticket entered a few minutes apart from another
    // user's showed the CTA here but then 409'd there).
    if (
      authFromAirport &&
      authToAirport &&
      authFromAirport === otherFromAirport &&
      authToAirport === otherToAirport
    ) {
      return TERMINAL_ECHO_TYPE.PARALLEL_SOUL;
    }

    // destination_thread: same destination airport, valid arrival window (<= 24h), different flight and different origin
    const authArrival = authTicket.arrivalDateTime
      ? new Date(authTicket.arrivalDateTime)
      : authTicket.departureDateTime
        ? new Date(authTicket.departureDateTime)
        : null;
    const otherArrival = otherTicket.arrivalDateTime
      ? new Date(otherTicket.arrivalDateTime)
      : otherTicket.departureDateTime
        ? new Date(otherTicket.departureDateTime)
        : null;

    const isWithinDtWindow = Boolean(
      authArrival &&
      otherArrival &&
      !Number.isNaN(authArrival.getTime()) &&
      !Number.isNaN(otherArrival.getTime()) &&
      Math.abs(authArrival.getTime() - otherArrival.getTime()) <= 24 * 60 * 60 * 1000
    );

    if (
      authToAirport &&
      otherToAirport &&
      authToAirport === otherToAirport &&
      isWithinDtWindow &&
      authFlightNumber !== otherFlightNumber &&
      authFromAirport !== otherFromAirport
    ) {
      return TERMINAL_ECHO_TYPE.DESTINATION_THREAD;
    }

    // baton_touch: cross-directional — one arriving, one departing
    if (
      ((authToAirport && otherFromAirport && authToAirport === otherFromAirport) ||
        (authFromAirport && otherToAirport && authFromAirport === otherToAirport)) &&
      (authFlightNumber !== otherFlightNumber || authDeparture !== otherDeparture)
    ) {
      return TERMINAL_ECHO_TYPE.BATON_TOUCH;
    }

    return TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
  }

  /**
   * Quantizes coordinates to a given decimal precision to protect user
   * privacy (prevent pinpointing exact bench/seat location inside a terminal).
   * Default precision 3 gives ~110m resolution at equator.
   */
  static quantizeCoordinates(coordinates: [number, number], precision = 3): [number, number] {
    const factor = Math.pow(10, precision);
    return [
      Math.round(coordinates[0] * factor) / factor,
      Math.round(coordinates[1] * factor) / factor,
    ];
  }

  static async createTerminalEcho(params: {
    userId: ObjectId | string;
    fileUrl: string;
    fileName: string;
    textMessage?: string;
    location?: { type: "Point"; coordinates: [number, number] };
    airportName?: string;
    audioDuration?: number;
    waveformData?: number[];
  }) {
    const {
      userId,
      fileUrl,
      fileName,
      textMessage,
      location,
      airportName,
      audioDuration,
      waveformData,
    } = params;

    // Server-authoritative airport resolution (§18.1). Echoes exist only
    // inside an airport's radius: the map loads pins per airport, so an
    // echo outside every radius would never be shown. The app checks this
    // too; the server enforces it.
    const [lng, lat] = location?.coordinates ?? [];
    if (typeof lng !== "number" || typeof lat !== "number") {
      throw new EchoOutsideAirportError();
    }
    const nearest = await AirportRepo.findNearestWithDistance({ lat, lng });
    const canonicalAirportIata = (nearest?.iata || nearest?.icao || "").toUpperCase();
    if (!nearest?.insideRadius || !canonicalAirportIata) {
      throw new EchoOutsideAirportError();
    }
    const resolvedAirportName = nearest.airport || airportName || "";

    const fileCreateResult = await FileSvc.create({
      fileUrl,
      fileName,
      metaData: {
        audioDuration: audioDuration ?? 0,
        waveformData: waveformData ?? [],
      },
    });

    // Quantize coordinates to preserve geospatial privacy (§30)
    let persistedLocation: { type: "Point"; coordinates: [number, number] } = {
      type: "Point",
      coordinates: [0, 0],
    };
    if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      persistedLocation = {
        type: "Point",
        coordinates: this.quantizeCoordinates(location.coordinates as [number, number], 3),
      };
    }

    const inserted = await TerminalEchoRepo.create({
      senderId: new ObjectId(userId),
      fileId: fileCreateResult.insertedId,
      textMessage,
      location: persistedLocation,
      airportName: resolvedAirportName,
      airportIata: canonicalAirportIata,
    });

    return {
      ...inserted,
      airportIata: canonicalAirportIata,
      airportName: resolvedAirportName,
    };
  }

  static async findByAirportName(airportName?: string, userId?: string): Promise<Document[]> {
    const echoes = await TerminalEchoRepo.findByAirportNameWithFile(airportName);
    if (!userId || !echoes.length) {
      return echoes.map(
        (e) =>
          ({
            ...e,
            currentUserReactions: e.currentUserReactions ?? [],
          }) as Document
      );
    }
    const echoIds = echoes.map((e) => e._id);
    const reactions = await TerminalEchoReactionRepo.findByUserIdAndTerminalEchoIds(
      userId,
      echoIds
    );
    const byEchoId = new Map<string, string[]>();
    for (const r of reactions) {
      const id = (r.terminalEchoId as ObjectId).toString();
      if (!byEchoId.has(id)) byEchoId.set(id, []);
      byEchoId.get(id)!.push(r.reaction);
    }
    return echoes.map(
      (e) =>
        ({
          ...e,
          currentUserReactions: byEchoId.get(e._id.toString()) ?? [],
        }) as Document
    );
  }

  /**
   * Lean list for map: `_id`, `senderId`, computed `type`, `location`, plus
   * `createdAt` and listen/reaction counts. No file join.
   */
  static async findAllWithType(
    userId: string,
    query: TerminalEchoMapQuery = {}
  ): Promise<TerminalEchoMapFeatureSource[]> {
    const echoes = await TerminalEchoRepo.findAllForMap(query);
    if (!echoes.length) return [];

    const authUserObjectId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
    const authTicket = await FlightTicketRepo.findActiveOrLatestByUserId(authUserObjectId);

    if (!authTicket) {
      return echoes.map((e) => ({
        _id: e._id as ObjectId,
        senderId: e.senderId as ObjectId,
        type: TERMINAL_ECHO_TYPE.TERMINAL_ECHO,
        location: e.location,
        ...pinActivity(e),
      }));
    }

    const senderIds = Array.from(
      new Set(
        echoes
          .map((e) => (e.senderId as ObjectId | undefined)?.toString?.())
          .filter(Boolean) as string[]
      )
    )
      .filter((id) => id !== authUserObjectId.toString())
      .map((id) => new ObjectId(id));

    const ticketsByUserId = await FlightTicketRepo.findActiveOrLatestByUserIds(senderIds);

    return echoes.map((e) => {
      const senderIdStr = (e.senderId as ObjectId | undefined)?.toString?.() ?? "";

      let type: TerminalEchoType = TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
      if (senderIdStr && senderIdStr !== authUserObjectId.toString()) {
        const otherTicket = ticketsByUserId.get(senderIdStr) ?? null;
        type = this.computeType({ authTicket, otherTicket });
      }

      return {
        _id: e._id as ObjectId,
        senderId: e.senderId as ObjectId,
        type,
        location: e.location,
        ...pinActivity(e),
      };
    });
  }

  static async findAllWithTypeAsGeoJson(userId: string, query: TerminalEchoMapQuery = {}) {
    const echoes = await this.findAllWithType(userId, query);
    return this.toFeatureCollection(echoes);
  }

  /**
   * Zoomed-out map: one point per airport with its echo count, so the app
   * draws a bubble per airport without downloading every pin.
   */
  static async airportCountsAsGeoJson() {
    const rows = await TerminalEchoRepo.countByAirport();
    return {
      type: "FeatureCollection" as const,
      features: rows
        .filter((r) => this.isPointGeometry(r.location))
        .map((r) => ({
          type: "Feature" as const,
          id: r.airportIata,
          geometry: r.location as { type: "Point"; coordinates: [number, number] },
          properties: {
            airportIata: r.airportIata,
            airportName: r.airportName,
            count: r.count,
            latestAt: r.latestAt ? new Date(r.latestAt).toISOString() : null,
          },
        })),
    };
  }

  /** Full echo + file/user/replyCount + computed `type` (GET by id). */
  static async findOneWithType(userId: string, terminalEchoId: string) {
    const echo = await TerminalEchoRepo.findByIdWithFile(terminalEchoId);
    if (!echo) return null;

    const authUserObjectId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
    const authTicket = await FlightTicketRepo.findActiveOrLatestByUserId(authUserObjectId);

    let type: TerminalEchoType = TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
    if (authTicket) {
      const senderIdStr = (echo.senderId as ObjectId | undefined)?.toString?.() ?? "";
      if (senderIdStr && senderIdStr !== authUserObjectId.toString()) {
        const ticketsByUserId = await FlightTicketRepo.findActiveOrLatestByUserIds([
          new ObjectId(senderIdStr),
        ]);
        const otherTicket = ticketsByUserId.get(senderIdStr) ?? null;
        type = this.computeType({ authTicket, otherTicket });
      }
    }

    // Without this, a freshly-fetched single echo (e.g. opening a thread
    // after a reload, when it isn't already sitting in the local feed
    // cache — see getThread's knownPost fallback in echoService.ts) always
    // comes back with no currentUserReactions, so the user's own prior
    // reactions show as un-reacted even though they're still recorded.
    // Matches the same pattern findByAirportName uses for the feed.
    const reactions = await TerminalEchoReactionRepo.findByUserIdAndTerminalEchoIds(userId, [
      echo._id as ObjectId,
    ]);
    const currentUserReactions = reactions.map((r) => r.reaction);

    return { ...echo, type, currentUserReactions };
  }

  static async incrementListen(terminalEchoId: string) {
    return TerminalEchoRepo.incrementListen(terminalEchoId);
  }

  /** Used to scope reply-related broadcasts to the parent echo's airport room. */
  static async findAirportIataById(terminalEchoId: string): Promise<string | null> {
    return TerminalEchoRepo.findAirportIataById(terminalEchoId);
  }

  static async updateReaction(params: {
    terminalEchoId: string;
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    userId: string;
  }) {
    const { terminalEchoId, reaction, userId } = params;

    // Atomic toggle — see TerminalEchoReactionRepo.toggleReaction for
    // why this replaced the old findOne-then-create/delete pattern
    // (which had a race condition causing intermittent wrong-direction
    // reaction broadcasts under concurrent taps).
    const action = await TerminalEchoReactionRepo.toggleReaction({
      terminalEchoId,
      userId,
      reaction,
    });

    const result = await TerminalEchoRepo.updateReaction(terminalEchoId, reaction, action);
    return { ...result, action };
  }
}
