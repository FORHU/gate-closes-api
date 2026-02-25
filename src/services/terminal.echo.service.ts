import { ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";

export default class TerminalEchoSvc {
  static async createAudio(
    userId: string | ObjectId,
    audioUrl: string,
    location?: { type: "Point"; coordinates: [number, number] },
    airportName?: string
  ) {
    const result = await TerminalEchoRepo.createForAudio(userId, audioUrl, location, airportName);
    return result;
  }

  static async createTextMessage(
    userId: string | ObjectId,
    textMessage: string,
    location?: { type: "Point"; coordinates: [number, number] },
    airportName?: string
  ) {
    const result = await TerminalEchoRepo.createForTextMessage(
      userId,
      textMessage,
      location,
      airportName
    );
    return result;
  }
}

