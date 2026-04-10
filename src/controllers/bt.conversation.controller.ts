import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import BtConversationRepo from "../repositories/bt.conversation.repository";
import BtConversationSvc from "../services/bt.conversation.service";
import { ERROR_MESSAGE } from "../const";

export default class BtConversationCtrl {

    // POST /conversations/dm - Create an baton touch conversation or get conversation when exist
    static async createOrGetDm( req: Request, res: Response) {
        const userId = req.user?.userId as string;
        const { otherUserId } = req.body;

        const schema = Joi.object({
            otherUserId: Joi.string().required(),
        })

        const { error, value } = schema.validate({ otherUserId });
        if (error) return res.status(400).json({ message: error.message });

        try{
            const requesterId = FlightTicketRepo.parseObjectId( userId, ERROR_MESSAGE.INVALID_USER_ID);
            const otherId = BtConversationRepo.parseObjectId(value.otherUserId, ERROR_MESSAGE.INVALID_OTHER_USER_ID);

            const convo = await BtConversationSvc.createOrGetDm({ requesterId, otherUserId});

            return res.json({ data: convo });
        } catch (err: any) {
            return res.status(400).json({ message: err?.message ?? err});
        }
    }

    // GET /conversations - List all the baton touch convo of auth user
    static async listMyConversations(req: Request, res: Response) {
        const userId = req.user?.userId as string;

        try {
            const requesterId = FlightTicketRepo.parseObjectId( userId, ERROR_MESSAGE.INVALID_USER_ID)

            const convos = await BtConversationSvc.listMyConversations(requesterId);

            return res.json({ data: convos });
        } catch (err: any){
            return res.status(500).json({message: err?.message ?? err });
        }
    }
}