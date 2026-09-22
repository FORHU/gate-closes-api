import * as dotenv from "dotenv";
dotenv.config();

export const MONGO_URI = process.env.MONGO_URI as string;
export const MONGO_DB = process.env.MONGO_DB as string;
export const MONGO_DB_DEV = process.env.MONGO_DB_DEV as string;
export const PORT = Number(process.env.PORT);
export const SECRET_KEY = process.env.SECRET_KEY as string;
export const isDev = process.env.NODE_ENV !== "production";
export const MAILER_TRANSPORT_HOST = process.env.MAILER_TRANSPORT_HOST as string;
export const MAILER_TRANSPORT_PORT = Number(process.env.MAILER_TRANSPORT_PORT);
export const MAILER_TRANSPORT_SECURE = process.env.MAILER_TRANSPORT_SECURE === "true";
export const MAILER_EMAIL = process.env.MAILER_EMAIL as string;
export const MAILER_PASSWORD = process.env.MAILER_PASSWORD as string;
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET as string;
export const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY || "15m") as string;
export const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY || "7d") as string;
export const REDIS_HOST = process.env.REDIS_HOST as string;
export const REDIS_PORT = Number(process.env.REDIS_PORT);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD as string;
export const SERVICE_ACCOUNT = process.env.SERVICE_ACCOUNT as string;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  ? process.env.GOOGLE_CLIENT_ID.split(",").map((id) => id.trim())
  : [];

export const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET as string;
export const AWS_REGION = process.env.AWS_REGION as string;
export const CLOUD_FRONT_DOMAIN = process.env.CLOUD_FRONT_DOMAIN as string | undefined;

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [
      "http://localhost:3000",
      "http://localhost:8081",
      "http://localhost:19006",
      "http://localhost:3001",
    ];

export const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE || "lax").toLowerCase() as
  | "lax"
  | "strict"
  | "none";
export const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: "/",
  maxAge: 15 * 60 * 1000, // 15 minutes
});

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches REFRESH_TOKEN_EXPIRY)
});

export const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: "/",
});

if (!isDev) {
  const insecureSecrets: string[] = [];
  if (!ACCESS_TOKEN_SECRET || ACCESS_TOKEN_SECRET === "dev-access-secret")
    insecureSecrets.push("ACCESS_TOKEN_SECRET");
  if (!REFRESH_TOKEN_SECRET || REFRESH_TOKEN_SECRET === "dev-refresh-secret")
    insecureSecrets.push("REFRESH_TOKEN_SECRET");
  if (!SECRET_KEY || SECRET_KEY === "dev-secret") insecureSecrets.push("SECRET_KEY");
  if (insecureSecrets.length > 0) {
    throw new Error(
      `[Config Error] Insecure or missing production secrets: ${insecureSecrets.join(", ")}`
    );
  }
}
