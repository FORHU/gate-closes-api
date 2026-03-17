import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsMatchSvc from "../services/ps.match.service";

export default class PsMatchCtrl {
  static async swipe(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { otherUserId, action } = req.body;

    const schema = Joi.object({
      otherUserId: Joi.string().required(),
      action: Joi.string().valid("like", "pass").required(),
    });

    const { error, value } = schema.validate({ otherUserId, action });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const requesterId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
      const otherId = PsConversationRepo.parseObjectId(
        value.otherUserId,
        "Invalid other user id."
      );

      const result = await PsMatchSvc.swipe({
        requesterId,
        otherUserId: otherId,
        action: value.action,
      });

      return res.json({ data: result });
    } catch (err: any) {
      return res.status(400).json({ message: err?.message ?? err });
    }
  }
}

