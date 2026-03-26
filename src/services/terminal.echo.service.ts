import { ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";
import TerminalEchoReactionRepo from "../repositories/terminal.echo.reaction.repository";
import FileSvc from "./file.service";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import {TERMINAL_ECHO_TYPE, type TerminalEchoType} from "../const";

export default class TerminalEchoSvc {
  private static dateKey(d?: Date) {
    if (!d) return "";
    const dd = d instanceof Date ? d : new Date(d as any);
    if (Number.isNaN(dd.getTime())) return "";
    return dd.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
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
    const authReturn = this.dateKey(authTicket.returnDateTime);
    const otherDeparture = this.dateKey(otherTicket.departureDateTime);
    const otherReturn = this.dateKey(otherTicket.returnDateTime);

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

    // destination_thread: same toCity
    if (authToCity && authToCity === otherToCity) {
      return TERMINAL_ECHO_TYPE.DESTINATION_THREAD;
    }

    // baton_touch:
    // auth.toCity == other.fromCity
    // auth.fromCity == other.toCity
    if (
      authFromCity &&
      authToCity &&
      authToCity === otherFromCity &&
      authFromCity === otherToCity
    ) {
      return TERMINAL_ECHO_TYPE.BATON_TOUCH;
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
  }) {
    const { userId, fileUrl, fileName, textMessage, location, airportName } =
      params;

    const fileCreateResult = await FileSvc.create({
      fileUrl,
      fileName,
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

  static async findAllWithType(userId: string): Promise<any[]> {
    const echoes = await TerminalEchoRepo.findAllWithFile();
    if (!echoes.length) return [];

    // Reactions enrichment (same pattern as airport search)
    const echoIds = echoes.map((e) => e._id);
    const reactions = await TerminalEchoReactionRepo.findByUserIdAndTerminalEchoIds(
      userId,
      echoIds
    );
    const byEchoId = new Map<string, string[]>();
    for (const r of reactions as any[]) {
      const id = (r.terminalEchoId as ObjectId).toString();
      if (!byEchoId.has(id)) byEchoId.set(id, []);
      byEchoId.get(id)!.push(r.reaction);
    }

    // Ticket logic
    const authUserObjectId = FlightTicketRepo.parseObjectId(
      userId,
      "Invalid user id."
    );
    const authTicket = await FlightTicketRepo.findActiveOrLatestByUserId(
      authUserObjectId
    );

    // If auth user has no flight ticket -> all terminal_echo
    if (!authTicket) {
      return echoes.map((e: any) => ({
        ...e,
        type: TERMINAL_ECHO_TYPE.TERMINAL_ECHO,
        currentUserReactions: byEchoId.get(e._id.toString()) ?? [],
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
      const senderIdStr = (e.senderId as ObjectId | undefined)?.toString?.() ?? "";

      // Only compare against "other users"
      if (!senderIdStr || senderIdStr === authUserObjectId.toString()) {
        return {
          ...e,
          type: TERMINAL_ECHO_TYPE.TERMINAL_ECHO,
          currentUserReactions: byEchoId.get(e._id.toString()) ?? [],
        };
      }

      const otherTicket = ticketsByUserId.get(senderIdStr) ?? null;

      return {
        ...e,
        type: this.computeType({ authTicket, otherTicket }),
        currentUserReactions: byEchoId.get(e._id.toString()) ?? [],
      };
    });
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

    const existing = await TerminalEchoReactionRepo.findOne({
      terminalEchoId,
      userId,
      reaction,
    });

    if (existing) {
      await TerminalEchoReactionRepo.deleteOne({
        terminalEchoId,
        userId,
        reaction,
      });
      return TerminalEchoRepo.updateReaction(
        terminalEchoId,
        reaction,
        "decrement"
      );
    }

    await TerminalEchoReactionRepo.create({
      terminalEchoId: new ObjectId(terminalEchoId),
      userId: new ObjectId(userId),
      reaction,
    });

    return TerminalEchoRepo.updateReaction(terminalEchoId, reaction, "increment");
  }
}

