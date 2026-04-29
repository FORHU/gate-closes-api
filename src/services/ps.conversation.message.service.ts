import { ObjectId } from "mongodb";
import PsConversationMessageRepo from "../repositories/ps.conversation.message.repository";
import PsConversationMessageReactionRepo from "../repositories/ps.conversation.message.reaction.repository";
import FileSvc from "./file.service";

export default class PsConversationMessageSvc {

  // Create an audio message in parallel soul conversation
  static async sendMessage(params: {
    psConversationId: ObjectId;
    psSenderId: ObjectId;
    fileUrl: string;
    fileName: string;
  }) {
    const { psConversationId, psSenderId, fileUrl, fileName } = params;

    const fileCreateResult = await FileSvc.create({
      fileUrl,
      fileName,
    });

    return PsConversationMessageRepo.create({
      psConversationId,
      psSenderId,
      fileId: fileCreateResult.insertedId,
    } as any);
  }

  // Get all the messages in one conversation
  static async listMessages(params: {
    psConversationId: ObjectId;
    limit: number;
    requesterId?: ObjectId;
  }) {
    const messages = await PsConversationMessageRepo.listByConversationId(
      params.psConversationId,
      params.limit
    );

    if (!params.requesterId || !messages.length) {
      return messages.map((m: any) => ({
        ...m,
        currentUserReactions: m.currentUserReactions ?? [],
      }));
    }

    const messageIds = messages.map((m: any) => m._id);
    const reactions =
      await PsConversationMessageReactionRepo.findByUserIdAndMessageIds(
        params.requesterId,
        messageIds
      );

    const byMessageId = new Map<string, string[]>();
    for (const r of reactions as any[]) {
      const id = (r.psConversationMessageId as ObjectId).toString();
      if (!byMessageId.has(id)) byMessageId.set(id, []);
      byMessageId.get(id)!.push(r.reaction);
    }

    return messages.map((m: any) => ({
      ...m,
      currentUserReactions: byMessageId.get(m._id.toString()) ?? [],
    }));
  }

  static async getMessageById(params: {
    psConversationMessageId: string;
    requesterId?: ObjectId;
  }) {
    const message = await PsConversationMessageRepo.findByIdWithDetails(
      params.psConversationMessageId
    );
    if (!message) return null;

    if (!params.requesterId) {
      return {
        ...message,
        currentUserReactions: message.currentUserReactions ?? [],
      };
    }

    const reactions =
      await PsConversationMessageReactionRepo.findByUserIdAndMessageIds(
        params.requesterId,
        [message._id]
      );
    const currentUserReactions = (reactions as any[]).map((r: any) => r.reaction);

    return {
      ...message,
      currentUserReactions,
    };
  }
}
