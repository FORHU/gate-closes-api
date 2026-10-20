// src/app.ts
import express from "express";
import helmet from "helmet";
import { connectToMongo } from "./utils/mongo";
import router from "./routes";
import { allowAnyOrigin, ALLOWED_ORIGINS } from "./config";
import setup from "./setup";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";

const app = express();

app.set("trust proxy", 1);

const corsOriginHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // Allow mobile apps, curl, server-to-server requests with no origin
  if (!origin) return callback(null, true);
  if (allowAnyOrigin) return callback(null, true);
  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

import healthRoutes from "./routes/health.route";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { generalRateLimiter } from "./middleware/rate-limiter.middleware";

app.use(requestIdMiddleware);

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Set up security headers
app.use(helmet());
app.disable("x-powered-by");

// Cloud health probes (un-throttled liveness/readiness for load balancers)
app.use(healthRoutes);

// General rate limiting on API endpoints
app.use("/api", generalRateLimiter, router);

const server = createServer(app);

export const io = new Server(server, {
  cors: {
    origin: allowAnyOrigin ? "*" : ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

import { RedisAdapterManager } from "./utils/redis.adapter";
import events from "./events";

// Attach Redis adapter for horizontal clustering (falls back to in-memory if unreachable)
void RedisAdapterManager.initAdapter(io);

events(io);

// Connect to MongoDB
connectToMongo()
  .then(() => {
    // Run setup
    setup();
  })
  .catch((err) => {
    console.log(err);
  });

export default server;
