import { expect } from "chai";
import express from "express";
import request from "supertest";
import s3Routes from "../src/routes/s3.route";
import S3Svc from "../src/services/s3.service";
import { createAccessToken } from "../src/utils/jwt";
import { s3ClientConfig } from "../src/utils/s3";

describe("Media Authorization & S3 URL Security (§29)", () => {
  let app: express.Express;
  let validToken: string;

  before(async () => {
    validToken = await createAccessToken({ userId: "mock-user-123" });

    // Stub S3Svc.generateDownloadUrl
    S3Svc.generateDownloadUrl = async (key: string) => ({
      url: `https://mock-cloudfront.net/${key}`,
      key,
    });

    app = express();
    app.use(express.json());
    app.use("/api/s3", s3Routes);
  });

  it("should allow download URL generation for valid media keys", async () => {
    const validKey = "gate-closes/mock-user-123/uploads/audio.m4a";
    const res = await request(app)
      .get("/api/s3/get-cloudfront-url")
      .set("Authorization", `Bearer ${validToken}`)
      .query({ key: validKey });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("key", validKey);
    expect(res.body).to.have.property("url");
  });

  it("should reject path traversal attempts with 400", async () => {
    const maliciousKey = "gate-closes/mock-user-123/../../etc/passwd";
    const res = await request(app)
      .get("/api/s3/get-cloudfront-url")
      .set("Authorization", `Bearer ${validToken}`)
      .query({ key: maliciousKey });

    expect(res.status).to.equal(400);
  });

  it("should reject keys outside authorized namespaces with 400", async () => {
    const unauthorizedKey = "secret-bucket-data/credentials.json";
    const res = await request(app)
      .get("/api/s3/get-cloudfront-url")
      .set("Authorization", `Bearer ${validToken}`)
      .query({ key: unauthorizedKey });

    expect(res.status).to.equal(400);
  });
});

describe("S3 client credentials", () => {
  it("uses static keys only when both are set (local development)", () => {
    const config = s3ClientConfig({
      region: "ap-southeast-1",
      accessKeyId: "key-id",
      secretAccessKey: "secret",
    });
    expect(config.credentials).to.deep.equal({
      accessKeyId: "key-id",
      secretAccessKey: "secret",
    });
  });

  it("passes no credentials without keys, so the instance role applies", () => {
    const config = s3ClientConfig({ region: "ap-southeast-1" });
    expect(config).to.not.have.property("credentials");
  });

  it("never passes a partial credentials object", () => {
    expect(s3ClientConfig({ accessKeyId: "key-id" })).to.not.have.property("credentials");
    expect(s3ClientConfig({ secretAccessKey: "secret" })).to.not.have.property("credentials");
    expect(s3ClientConfig({ accessKeyId: "", secretAccessKey: "" })).to.not.have.property(
      "credentials"
    );
  });

  it("targets an S3-compatible endpoint when configured (MinIO)", () => {
    const config = s3ClientConfig({ endpoint: "http://localhost:9000", forcePathStyle: true });
    expect(config.endpoint).to.equal("http://localhost:9000");
    expect(config.forcePathStyle).to.equal(true);
    expect(s3ClientConfig({})).to.not.have.property("endpoint");
    expect(s3ClientConfig({})).to.not.have.property("forcePathStyle");
  });
});
