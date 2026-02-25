import { ObjectId } from "mongodb";
import TerminalEchoRepo from "../repositories/terminal.echo.repository";

export default class TerminalEchoSvc {
  static async create(
    userId: string | ObjectId,
    audioUrl: string,
    location?: { type: "Point"; coordinates: [number, number] },
    airportName?: string,
    textMessage?: string
  ) {
    let senderId: ObjectId;
    try {
      senderId = new ObjectId(userId);
    } catch (error) {
      return Promise.reject("Invalid sender id.");
    }

    const echo = {
      senderId,
      audioUrl,
      textMessage,
      location,
      airportName,
    };

    const result = await TerminalEchoRepo.create(echo);
    return result;
  }
}

