import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import request from "supertest";
import app from "../src/app";
import UserAuthSvc from "../src/services/user.auth.service";
import UserRepo from "../src/repositories/user.repository";
import { createAccessToken, createRefreshToken } from "../src/utils/jwt";

describe("AUTH-WEB-01: Web Session & CSRF Origin Defense", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: unknown) => {
    const original = obj[key];
    (obj as Record<K, unknown>)[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  const mockUser = {
    _id: "650000000000000000000001",
    email: "webuser@gatecloses.com",
    username: "Traveler1.00",
    signupCompleted: true,
    isCompleteProfile: true,
  };

  describe("Web vs Native Login Response Format", () => {
    it("should set HttpOnly cookies and omit tokens from JSON body when client=web", async () => {
      stub(UserAuthSvc, "loginWithEmailPassword", async () => ({
        user: mockUser,
        accessToken: createAccessToken({ userId: mockUser._id, email: mockUser.email }),
        refreshToken: createRefreshToken({ userId: mockUser._id, email: mockUser.email }),
        requiresProfileCompletion: false,
      }));

      const res = await request(app)
        .post("/api/auth/login?client=web")
        .send({ email: "webuser@gatecloses.com", password: "Password123!" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("user");
      expect(res.body).to.not.have.property("accessToken");
      expect(res.body).to.not.have.property("refreshToken");

      const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
      expect(cookies).to.be.an("array");
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : "";
      expect(cookieStr).to.include("session_token=");
      expect(cookieStr).to.include("refresh_token=");
      expect(cookieStr).to.include("HttpOnly");
      expect(cookieStr.toLowerCase()).to.include("samesite=lax");
    });

    it("should set HttpOnly cookies when x-client-type: web header is present", async () => {
      stub(UserAuthSvc, "loginWithEmailPassword", async () => ({
        user: mockUser,
        accessToken: createAccessToken({ userId: mockUser._id, email: mockUser.email }),
        refreshToken: createRefreshToken({ userId: mockUser._id, email: mockUser.email }),
        requiresProfileCompletion: false,
      }));

      const res = await request(app)
        .post("/api/auth/login")
        .set("x-client-type", "web")
        .send({ email: "webuser@gatecloses.com", password: "Password123!" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("user");
      expect(res.body).to.not.have.property("accessToken");
      expect(res.headers["set-cookie"]).to.exist;
    });

    it("should return tokens in JSON body and set no cookies for native client", async () => {
      stub(UserAuthSvc, "loginWithEmailPassword", async () => ({
        user: mockUser,
        accessToken: createAccessToken({ userId: mockUser._id, email: mockUser.email }),
        refreshToken: createRefreshToken({ userId: mockUser._id, email: mockUser.email }),
        requiresProfileCompletion: false,
      }));

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "webuser@gatecloses.com", password: "Password123!" });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("user");
      expect(res.body).to.have.property("accessToken");
      expect(res.body).to.have.property("refreshToken");
      expect(res.headers["set-cookie"]).to.not.exist;
    });
  });

  describe("Protected Endpoint Authentication (/api/auth/me)", () => {
    it("should authenticate via session_token cookie", async () => {
      stub(UserRepo, "findById", async () => mockUser);
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`session_token=${token}`]);

      expect(res.status).to.equal(200);
      expect(res.body.user._id).to.equal(mockUser._id);
    });

    it("should authenticate via Authorization: Bearer header", async () => {
      stub(UserRepo, "findById", async () => mockUser);
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.user._id).to.equal(mockUser._id);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.equal({ message: "Unauthorized" });
    });
  });

  describe("CSRF Origin Defense on Mutating Requests", () => {
    it("should allow cookie-authenticated mutating request when Origin is in ALLOWED_ORIGINS", async () => {
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app)
        .post("/api/auth/change-username")
        .set("Cookie", [`session_token=${token}`])
        .set("Origin", "http://localhost:3000")
        .send({});

      // Middleware passed CSRF check; reached controller validation error
      expect(res.status).to.not.equal(401);
      expect(res.status).to.not.equal(403);
    });

    it("should reject cookie-authenticated mutating request with 403 when Origin is invalid", async () => {
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app)
        .post("/api/auth/change-username")
        .set("Cookie", [`session_token=${token}`])
        .set("Origin", "http://malicious-site.com")
        .send({});

      expect(res.status).to.equal(403);
      expect(res.body).to.deep.equal({ message: "Forbidden: Invalid or missing Origin header" });
    });

    it("should reject cookie-authenticated mutating request with 403 when Origin is missing", async () => {
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app)
        .post("/api/auth/change-username")
        .set("Cookie", [`session_token=${token}`])
        .send({});

      expect(res.status).to.equal(403);
      expect(res.body).to.deep.equal({ message: "Forbidden: Invalid or missing Origin header" });
    });

    it("should allow Bearer-authenticated mutating request without Origin header (mobile native)", async () => {
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app)
        .post("/api/auth/change-username")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      // Not blocked by 403 CSRF check
      expect(res.status).to.not.equal(403);
    });

    it("should enforce cookie precedence and apply CSRF check when both cookie and bearer are present", async () => {
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      // Both cookie and bearer present, but no Origin header -> cookie precedence triggers CSRF -> 403
      const res = await request(app)
        .post("/api/auth/change-username")
        .set("Cookie", [`session_token=${token}`])
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).to.equal(403);
      expect(res.body).to.deep.equal({ message: "Forbidden: Invalid or missing Origin header" });
    });

    it("should allow cookie-authenticated non-mutating request without Origin header", async () => {
      stub(UserRepo, "findById", async () => mockUser);
      const token = createAccessToken({ userId: mockUser._id, email: mockUser.email });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`session_token=${token}`]);

      expect(res.status).to.equal(200);
      expect(res.body.user._id).to.equal(mockUser._id);
    });
  });

  describe("Web Refresh Flow", () => {
    it("should read refresh_token from cookie and rotate cookies on refresh?client=web", async () => {
      const initialRefreshToken = createRefreshToken({
        userId: mockUser._id,
        email: mockUser.email,
      });

      const res = await request(app)
        .post("/api/auth/refresh?client=web")
        .set("Cookie", [`refresh_token=${initialRefreshToken}`]);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ message: "Session refreshed." });

      const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
      expect(cookies).to.be.an("array");
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : "";
      expect(cookieStr).to.include("session_token=");
      expect(cookieStr).to.include("refresh_token=");
    });
  });

  describe("Logout Flow", () => {
    it("should clear both session_token and refresh_token cookies", async () => {
      const res = await request(app).post("/api/auth/logout");

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ message: "Logged out successfully." });

      const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
      expect(cookies).to.be.an("array");
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : "";
      expect(cookieStr).to.include("session_token=;");
      expect(cookieStr).to.include("refresh_token=;");
    });
  });
});
