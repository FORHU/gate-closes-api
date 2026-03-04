import { ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";
import TerminalEchoReactionRepo from "../repositories/terminal.echo.reaction.repository";
import FileSvc from "./file.service";

export default class TerminalEchoSvc {
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

