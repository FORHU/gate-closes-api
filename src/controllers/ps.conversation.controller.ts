import { Request, Response } from "express";
import Joi from "joi";
import UserRepo from "../repositories/user.repository";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationSvc from "../services/ps.conversation.service";

export default class PsConversationCtrl {
  static async listEligibleUsers(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const requesterId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");

      const ids = await PsConversationSvc.listEligibleUsers({
        requesterId,
      });

      const users = await Promise.all(ids.map((id) => UserRepo.findById(id)));

      return res.json({
        data: users
          .filter(Boolean)
          .map((u: any) => ({
            _id: u._id,
            email: u.email,
            username: u.username,
            gender: u.gender,
          })),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }

  static async createOrGetDm(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { otherUserId } = req.body;

    const schema = Joi.object({
      otherUserId: Joi.string().required(),
    });

    const { error, value } = schema.validate({ otherUserId });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const requesterId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
      const otherId = PsConversationRepo.parseObjectId(
        value.otherUserId,
        "Invalid other user id."
      );

      const convo = await PsConversationSvc.createOrGetDm({
        requesterId,
        otherUserId: otherId,
      });

      return res.json({ data: convo });
    } catch (err: any) {
      return res.status(400).json({ message: err?.message ?? err });
    }
  }

  static async listMyConversations(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const requesterId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
      const convos = await PsConversationSvc.listMyConversations(requesterId);
      return res.json({ data: convos });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}

