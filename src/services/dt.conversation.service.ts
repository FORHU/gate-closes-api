import { ObjectId } from "mongodb";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import DtConversationRepo from "../repositories/dt.conversation.repository";

export default class DtConversationSvc {
    static dmKeyForUsers(a: ObjectId, b: ObjectId) {
        const sa = a.toHexString();
        const sb = b.toHexString();
        return sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    }

    static async createOrGetDm(params: { requesterId: ObjectId, otherUserId: ObjectId }) {
        const { requesterId, otherUserId } = params;

        if (requesterId.equals(otherUserId)) {
            throw new Error("Cannot create conversation with yourself.");
        }

        const myTicket = await FlightTicketRepo.findActiveOrLatestByUserId(requesterId);
        if (!myTicket?.flightNumber || !myTicket?.departureDateTime) {
            throw new Error("No active flight ticket found for user.");
        }
        
        const flightNumber = myTicket.flightNumber;
        const departureDateTime = myTicket.departureDateTime;

        const [meEligible, otherEligible] = await Promise.all([
            FlightTicketRepo.userHasFlight({
                userId: requesterId,
                flightNumber,
                departureDateTime,
            }),
            FlightTicketRepo.userHasFlight({
                userId: otherUserId,
                flightNumber,
                departureDateTime,
            }),
        ]);

        if (!meEligible || !otherEligible) {
            throw new Error("Users are not eligible to chat for this flight.");
        }
        
        const dmKey = this.dmKeyForUsers(requesterId, otherUserId);

        const existing = await DtConversationRepo.findByDmKey(dmKey);
        if (existing) return existing;

        try{
            await DtConversationRepo.create({
                participants: [requesterId, otherUserId],
                dmKey,
            } as any);
        } catch (err: any) {
            if (err?.code != 11000) throw err;
        }

        const createdOrFound = await DtConversationRepo.findByDmKey(dmKey);
        return createdOrFound
    }

    static async listMyConversations(dtUserId: ObjectId) {
        return DtConversationRepo.listByUserId(dtUserId);
    }
}