import { expect } from "chai";
import { describe, it } from "mocha";
import type { Request, Response } from "express";
import AuthController from "../src/controllers/user.auth.controller";
import { createRefreshToken, verifyAccessToken, verifyRefreshToken } from "../src/utils/jwt";
import FlightTicketRepo from "../src/repositories/flight.ticket.repository";
import { ObjectId } from "mongodb";

describe("Refresh Token Rotation & Flight Lifecycle Priority (§12, §14)", () => {
  describe("AuthController.refresh (Token Rotation)", () => {
    it("should accept a valid refresh token and return both a new access token and rotated refresh token", async () => {
      const initialRefreshToken = createRefreshToken({
        userId: "650000000000000000000099",
        email: "traveler@gatecloses.com",
      });

      let responseStatus = 0;
      let responseBody: any = null;

      const req = {
        body: {
          refreshToken: initialRefreshToken,
        },
      } as unknown as Request;

      const res = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      } as unknown as Response;

      await AuthController.refresh(req, res);

      expect(responseStatus).to.equal(200);
      expect(responseBody).to.have.property("accessToken");
      expect(responseBody).to.have.property("refreshToken");
      expect(responseBody.refreshToken).to.be.a("string");
      expect(responseBody.refreshToken).to.not.equal(initialRefreshToken);

      // Verify payloads inside both rotated tokens
      const accessPayload = verifyAccessToken(responseBody.accessToken);
      expect(accessPayload.userId).to.equal("650000000000000000000099");
      expect(accessPayload.email).to.equal("traveler@gatecloses.com");

      const refreshPayload = verifyRefreshToken(responseBody.refreshToken);
      expect(refreshPayload.userId).to.equal("650000000000000000000099");
      expect(refreshPayload.email).to.equal("traveler@gatecloses.com");
    });

    it("should reject an invalid or tampered refresh token with 401", async () => {
      let responseStatus = 0;
      let responseBody: any = null;

      const req = {
        body: {
          refreshToken: "invalid.refresh.token.string",
        },
      } as unknown as Request;

      const res = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      } as unknown as Response;

      await AuthController.refresh(req, res);

      expect(responseStatus).to.equal(401);
      expect(responseBody).to.deep.equal({ message: "Invalid or expired refresh token." });
    });
  });

  describe("FlightTicketRepo Lifecycle Prioritization", () => {
    it("should prioritize in-transit flight over upcoming flight", async () => {
      const originalCollection = FlightTicketRepo.collection;
      const testUserId = new ObjectId("650000000000000000000077");

      const inTransitFlight = {
        _id: new ObjectId(),
        userId: testUserId,
        flightNumber: "ACTIVE-101",
        departureDateTime: new Date(Date.now() - 30 * 60 * 1000), // departed 30m ago
        arrivalDateTime: new Date(Date.now() + 90 * 60 * 1000), // lands in 90m
      };

      (FlightTicketRepo as any).collection = () => ({
        findOne: async (filter: any) => {
          // If query checks in-transit ($lte now):
          if (filter.departureDateTime && filter.departureDateTime.$lte) {
            return inTransitFlight;
          }
          return null;
        },
      });

      try {
        const result = await FlightTicketRepo.findActiveOrLatestByUserId(testUserId);
        expect(result).to.exist;
        expect(result!.flightNumber).to.equal("ACTIVE-101");
      } finally {
        (FlightTicketRepo as any).collection = originalCollection;
      }
    });

    it("should fall back to upcoming flight when not in transit", async () => {
      const originalCollection = FlightTicketRepo.collection;
      const testUserId = new ObjectId("650000000000000000000077");

      const upcomingFlight = {
        _id: new ObjectId(),
        userId: testUserId,
        flightNumber: "UPCOMING-202",
        departureDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // departs in 2h
        arrivalDateTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
      };

      (FlightTicketRepo as any).collection = () => ({
        findOne: async (filter: any) => {
          // In-transit query finds nothing
          if (filter.departureDateTime && filter.departureDateTime.$lte) {
            return null;
          }
          // Upcoming query finds UPCOMING-202
          if (filter.departureDateTime && filter.departureDateTime.$gte) {
            return upcomingFlight;
          }
          return null;
        },
      });

      try {
        const result = await FlightTicketRepo.findActiveOrLatestByUserId(testUserId);
        expect(result).to.exist;
        expect(result!.flightNumber).to.equal("UPCOMING-202");
      } finally {
        (FlightTicketRepo as any).collection = originalCollection;
      }
    });
  });
});
