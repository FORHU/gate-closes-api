/**
 * Business logic layer for terminal echo replies — sits between the
 * controller (HTTP concerns) and the repository (raw DB access).
 * Handles things like resolving file uploads before creating a reply,
 * and enriching raw DB results with the requesting user's own
 * reaction state.
 */

import { ObjectId } from "mongodb";
import TerminalEchoReplyRepo from "../repositories/terminal.echo.reply.repository";
import FileSvc from "./file.service";
import TerminalEchoReplyReactionRepo from "../repositories/terminal.echo.reply.reaction.repository";

export default class TerminalEchoReplySvc {
  /**
   * Creates a new reply. If audio was uploaded (fileUrl + fileName both
   * present), first creates a File record with audio metadata, then
   * links it to the reply via fileId. Text-only replies simply omit
   * fileId.
   */
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

  /**
   * Fetches all replies for a thread, enriched with the requesting
   * user's own reaction state (currentUserReactions) if a userId is
   * provided (anonymous/public GET requests pass no userId, and every
   * reply comes back with an empty currentUserReactions array).
   */
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

  /**
   * Fetches a SINGLE reply by id, with the same reaction-enrichment
   * treatment as findByTerminalEchoId above, just scoped to one reply
   * instead of a whole thread.
   *
   * This powers the frontend's "append, don't refetch" real-time
   * strategy — after receiving a `terminal_echo_reply:created` socket
   * event (which only carries a replyId, not the full reply), the
   * client calls GET /terminal-echo-reply/:id to fetch exactly this
   * one reply and splice it into its already-loaded list.
   *
   * Returns null if the reply doesn't exist (e.g. deleted in the
   * window between the socket event firing and this fetch running) —
   * the controller turns that into a 404.
   */
  static async findReplyById(replyId: string, userId?: string): Promise<any | null> {
    const reply = await TerminalEchoReplyRepo.findByIdWithFile(replyId);
    if (!reply) return null;

    if (!userId) {
      return { ...reply, currentUserReactions: [] };
    }

    const reactions = await TerminalEchoReplyReactionRepo.findByUserIdAndReplyIds(userId, [
      reply._id,
    ]);
    const currentUserReactions = reactions
      .filter((r) => (r.terminalEchoReplyId as ObjectId).toString() === reply._id.toString())
      .map((r) => r.reaction);

    return { ...reply, currentUserReactions };
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

    const action = await TerminalEchoReplyReactionRepo.toggleReaction({
      terminalEchoReplyId: replyId,
      userId,
      reaction,
    });

    const result = await TerminalEchoReplyRepo.updateReaction(replyId, reaction, action);
    return { ...result, action };
  }
}