import { ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";
import TerminalEchoReactionRepo from "../repositories/terminal.echo.reaction.repository";
import FileSvc from "./file.service";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import { TERMINAL_ECHO_TYPE, type TerminalEchoMapBounds, type TerminalEchoType } from "../const";

export default class TerminalEchoSvc {
  private static isPointGeometry(location: any): location is {
    type: "Point";
    coordinates: [number, number];
  } {
    return (
      location?.type === "Point" &&
      Array.isArray(location?.coordinates) &&
      location.coordinates.length === 2 &&
      typeof location.coordinates[0] === "number" &&
      typeof location.coordinates[1] === "number"
    );
  }

  static toFeatureCollection(echoes: any[]) {
    const features = (echoes ?? [])
      .filter((echo) => this.isPointGeometry(echo?.location))
      .map((echo) => {
        const { location, _id, type } = echo;
        return {
          type: "Feature" as const,
          id: _id?.toString?.() ?? String(_id),
          geometry: location,
          properties: {
            type: type ?? null,
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
    const dd = d instanceof Date ? d : new Date(d as any);
    if (Number.isNaN(dd.getTime())) return "";
    return dd.toISOString().slice(0, 10);
  }

  private static computeType(params: {
    authTicket: any;
    otherTicket: any;
  }):
    TerminalEchoType {
    const { authTicket, otherTicket } = params;

    if (!authTicket) return TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
    if (!otherTicket) return TERMINAL_ECHO_TYPE.TERMINAL_ECHO;

    const authDeparture = this.dateKey(authTicket.departureDateTime);
    const otherDeparture = this.dateKey(otherTicket.departureDateTime);

    const authFlightNumber = (authTicket.flightNumber ?? "").trim();
    const authFromCity = (authTicket.fromCity ?? "").trim();
    const authToCity = (authTicket.toCity ?? "").trim();

    const otherFlightNumber = (otherTicket.flightNumber ?? "").trim();
    const otherFromCity = (otherTicket.fromCity ?? "").trim();
    const otherToCity = (otherTicket.toCity ?? "").trim();

    // parallel_soul: same flight number, toCity, and departureDate
    if (
      authFlightNumber &&
      authToCity &&
      authDeparture &&
      authFlightNumber === otherFlightNumber &&
      authToCity === otherToCity &&
      authDeparture === otherDeparture
    ) {
      return TERMINAL_ECHO_TYPE.PARALLEL_SOUL;
    }

    return TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
  }

  static async createTerminalEcho(params: {
    userId: string | ObjectId;
    fileUrl: string;
    fileName: string;
    textMessage?: string;
    location?: { type: "Point"; coordinates: [number, number] };
    airportName?: string;
    audioDuration?: number;
    waveformData?: number[];
  }) {
    const { userId, fileUrl, fileName, textMessage, location, airportName, audioDuration, waveformData } =
      params;

    const fileCreateResult = await FileSvc.create({
      fileUrl,
      fileName,
      metaData: {
        audioDuration: audioDuration ?? 0,
        waveformData: waveformData ?? [],
      },
    });

    return TerminalEchoRepo.create({
      senderId: new ObjectId(userId),
      fileId: fileCreateResult.insertedId,
      textMessage,
      location: location ?? { type: "Point", coordinates: [0, 0] },
      airportName,
    });
  }

  static async findByAirportName(
    airportName: string,
    userId?: string
  ): Promise<any[]> {
    const echoes = await TerminalEchoRepo.findByAirportNameWithFile(airportName);
    if (!userId || !echoes.length) {
      return echoes.map((e) => ({
        ...e,
        currentUserReactions: e.currentUserReactions ?? [],
      }));
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
    return echoes.map((e) => ({
      ...e,
      currentUserReactions: byEchoId.get(e._id.toString()) ?? [],
    }));
  }

  /**
   * Lean list for map: `_id`, `senderId`, computed `type`, and `location` (GeoJSON for features).
   * No file join, no reactions.
   */
  static async findAllWithType(
    userId: string,
    mapBounds?: TerminalEchoMapBounds
  ): Promise<
    Array<{
      _id: ObjectId;
      senderId: ObjectId;
      type: TerminalEchoType;
      location: { type: "Point"; coordinates: [number, number] };
    }>
  > {
    const echoes = await TerminalEchoRepo.findAllForMap(mapBounds);
    if (!echoes.length) return [];

    const authUserObjectId = FlightTicketRepo.parseObjectId(
      userId,
      "Invalid user id."
    );
    const authTicket = await FlightTicketRepo.findActiveOrLatestByUserId(
      authUserObjectId
    );

    if (!authTicket) {
      return echoes.map((e: any) => ({
        _id: e._id as ObjectId,
        senderId: e.senderId as ObjectId,
        type: TERMINAL_ECHO_TYPE.TERMINAL_ECHO,
        location: e.location,
      }));
    }

    const senderIds = Array.from(
      new Set(
        echoes
          .map((e: any) => (e.senderId as ObjectId | undefined)?.toString?.())
          .filter(Boolean) as string[]
      )
    )
      .filter((id) => id !== authUserObjectId.toString())
      .map((id) => new ObjectId(id));

    const ticketsByUserId = await FlightTicketRepo.findActiveOrLatestByUserIds(
      senderIds
    );

    return echoes.map((e: any) => {
      const senderIdStr =
        (e.senderId as ObjectId | undefined)?.toString?.() ?? "";

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
      };
    });
  }

  static async findAllWithTypeAsGeoJson(
    userId: string,
    mapBounds?: TerminalEchoMapBounds
  ) {
    const echoes = await this.findAllWithType(userId, mapBounds);
    return this.toFeatureCollection(echoes);
  }

  /** Full echo + file/user/replyCount + computed `type` (GET by id). */
  static async findOneWithType(userId: string, terminalEchoId: string) {
    const echo = await TerminalEchoRepo.findByIdWithFile(terminalEchoId);
    if (!echo) return null;

    const authUserObjectId = FlightTicketRepo.parseObjectId(
      userId,
      "Invalid user id."
    );
    const authTicket = await FlightTicketRepo.findActiveOrLatestByUserId(
      authUserObjectId
    );

    let type: TerminalEchoType = TERMINAL_ECHO_TYPE.TERMINAL_ECHO;
    if (authTicket) {
      const senderIdStr =
        (echo.senderId as ObjectId | undefined)?.toString?.() ?? "";
      if (senderIdStr && senderIdStr !== authUserObjectId.toString()) {
        const ticketsByUserId =
          await FlightTicketRepo.findActiveOrLatestByUserIds([
            new ObjectId(senderIdStr),
          ]);
        const otherTicket = ticketsByUserId.get(senderIdStr) ?? null;
        type = this.computeType({ authTicket, otherTicket });
      }
    }

    return { ...echo, type };
  }

  static async incrementListen(terminalEchoId: string) {
    return TerminalEchoRepo.incrementListen(terminalEchoId);
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

