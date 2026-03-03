import { ObjectId } from "mongodb";
import TerminalEchoReplyRepo from "../repositories/terminal.echo.reply.repository";
import FileSvc from "./file.service";

export default class TerminalEchoReplySvc {
  static async createReply(params: {
    userId: string | ObjectId;
    terminalEchoId: string | ObjectId;
    fileUrl: string;
    fileName: string;
  }) {
    const { userId, terminalEchoId, fileUrl, fileName } = params;

    const fileCreateResult = await FileSvc.create({
      fileUrl,
      fileName,
    });

    return TerminalEchoReplyRepo.create({
      terminalEchoId: new ObjectId(terminalEchoId),
      senderId: new ObjectId(userId),
      fileId: fileCreateResult.insertedId,
    });
  }

  static async findByTerminalEchoId(terminalEchoId: string) {
    return TerminalEchoReplyRepo.findByTerminalEchoIdWithFile(terminalEchoId);
  }

  static async incrementListen(replyId: string) {
    return TerminalEchoReplyRepo.incrementListen(replyId);
  }

  static async updateReaction(params: {
    replyId: string;
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    action: "increment" | "decrement";
  }) {
    const { replyId, reaction, action } = params;
    return TerminalEchoReplyRepo.updateReaction(replyId, reaction, action);
  }
}

