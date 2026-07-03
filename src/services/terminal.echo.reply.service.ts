import { ObjectId } from "mongodb";
import TerminalEchoReplyRepo from "../repositories/terminal.echo.reply.repository";
import FileSvc from "./file.service";
import TerminalEchoReplyReactionRepo from "../repositories/terminal.echo.reply.reaction.repository";

export default class TerminalEchoReplySvc {
  static async createReply(params: {
    userId: string | ObjectId;
    terminalEchoId: string | ObjectId;
    fileUrl: string;
    fileName: string;
    textMessage?: string;
    audioDuration?: number;
    waveformData?: number[];
  }) {
    const { userId, terminalEchoId, fileUrl, fileName, textMessage, audioDuration, waveformData } = params;

    let fileCreateResult: any = null;
    if (fileUrl && fileName) {
      fileCreateResult = await FileSvc.create({
        fileUrl,
        fileName,
        metaData: {
          audioDuration: audioDuration ?? 0,
          waveformData: waveformData ?? [],
        },
      });
    }

    return TerminalEchoReplyRepo.create({
      terminalEchoId: new ObjectId(terminalEchoId),
      senderId: new ObjectId(userId),
      fileId: fileCreateResult?.insertedId,
      textMessage: textMessage || "",
    });
  }

  static async findByTerminalEchoId(
    terminalEchoId: string,
    userId?: string
  ): Promise<any[]> {
    const replies =
      await TerminalEchoReplyRepo.findByTerminalEchoIdWithFile(terminalEchoId);
    if (!userId || !replies.length) {
      return replies.map((r) => ({
        ...r,
        currentUserReactions: r.currentUserReactions ?? [],
      }));
    }
    const replyIds = replies.map((r) => r._id);
    const reactions =
      await TerminalEchoReplyReactionRepo.findByUserIdAndReplyIds(
        userId,
        replyIds
      );
    const byReplyId = new Map<string, string[]>();
    for (const r of reactions) {
      const id = (r.terminalEchoReplyId as ObjectId).toString();
      if (!byReplyId.has(id)) byReplyId.set(id, []);
      byReplyId.get(id)!.push(r.reaction);
    }
    return replies.map((r) => ({
      ...r,
      currentUserReactions: byReplyId.get(r._id.toString()) ?? [],
    }));
  }

  static async incrementListen(replyId: string) {
    return TerminalEchoReplyRepo.incrementListen(replyId);
  }

  static async updateReaction(params: {
    replyId: string;
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    userId: string;
  }) {
    const { replyId, reaction, userId } = params;

    const existing = await TerminalEchoReplyReactionRepo.findOne({
      terminalEchoReplyId: replyId,
      userId,
      reaction,
    });

    if (existing) {
      await TerminalEchoReplyReactionRepo.deleteOne({
        terminalEchoReplyId: replyId,
        userId,
        reaction,
      });
      return TerminalEchoReplyRepo.updateReaction(
        replyId,
        reaction,
        "decrement"
      );
    }

    await TerminalEchoReplyReactionRepo.create({
      terminalEchoReplyId: new ObjectId(replyId),
      userId: new ObjectId(userId),
      reaction,
    });

    return TerminalEchoReplyRepo.updateReaction(replyId, reaction, "increment");
  }
}