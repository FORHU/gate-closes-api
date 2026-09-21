import { expect } from "chai";
import { describe, it } from "mocha";
import type { Request, Response } from "express";
import sessionMiddleware from "../src/middleware/valid-session.middleware";
import { createAccessToken } from "../src/utils/jwt";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../src/config";

describe("ValidSessionMiddleware (Security Hardening)", () => {
  it("should return 401 when authorization header is missing", () => {
    let status = 0;
    let jsonBody: any = null;

    const req = {
      headers: {},
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        status = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as unknown as Response;

    sessionMiddleware(req, res, () => {});

    expect(status).to.equal(401);
    expect(jsonBody).to.deep.equal({ message: "Unauthorized" });
  });

  it("should return 401 when scoped-auth header is provided without bearer token (bypass eliminated)", () => {
    let status = 0;
    let jsonBody: any = null;

    const req = {
      headers: {
        "scoped-auth": "830bbbba63ba3f7d23bc429b1d9e74af6876311f384148c85c81ca2b4f74df8b",
      },
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        status = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as unknown as Response;

    sessionMiddleware(req, res, () => {});

    expect(status).to.equal(401);
    expect(jsonBody).to.deep.equal({ message: "Unauthorized" });
  });

  it("should populate req.user and call next() when valid bearer token is provided", (done) => {
    const token = createAccessToken({ userId: "650000000000000000000001", email: "test@example.com" });

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as unknown as Request;

    const res = {} as unknown as Response;

    sessionMiddleware(req, res, () => {
      expect((req as any).user).to.exist;
      expect((req as any).user.userId).to.equal("650000000000000000000001");
      expect((req as any).user.email).to.equal("test@example.com");
      done();
    });
  });

  it("should return 401 when token is invalid or tampered", () => {
    let status = 0;
    let jsonBody: any = null;

    const req = {
      headers: {
        authorization: "Bearer invalid.token.value",
      },
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        status = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as unknown as Response;

    sessionMiddleware(req, res, () => {});

    expect(status).to.equal(401);
    expect(jsonBody).to.deep.equal({ message: "Invalid authorization token" });
  });

  it("should return 401 with 'Authorization token expired' when token is expired", () => {
    let status = 0;
    let jsonBody: any = null;

    const expiredToken = jwt.sign(
      { userId: "650000000000000000000001" },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "-1s" }
    );

    const req = {
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    } as unknown as Request;

    const res = {
      status: (code: number) => {
        status = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as unknown as Response;

    sessionMiddleware(req, res, () => {});

    expect(status).to.equal(401);
    expect(jsonBody).to.deep.equal({ message: "Authorization token expired" });
  });
});
