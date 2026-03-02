import { ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";
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

  static async findByAirportName(airportName: string) {
    return TerminalEchoRepo.findByAirportNameWithFile(airportName);
  }

  static async incrementListen(terminalEchoId: string) {
    return TerminalEchoRepo.incrementListen(terminalEchoId);
  }

  static async updateReaction(params: {
    terminalEchoId: string;
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    action: "increment" | "decrement";
  }) {
    const { terminalEchoId, reaction, action } = params;
    return TerminalEchoRepo.updateReaction(terminalEchoId, reaction, action);
  }
}

