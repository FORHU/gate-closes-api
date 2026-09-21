// src/app.ts
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { connectToMongo } from "./utils/mongo";
import router from "./routes";
import { isDev, ALLOWED_ORIGINS } from "./config";
import setup from "./setup";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();

app.set("trust proxy", 1);

const corsOriginHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // Allow mobile apps, curl, server-to-server requests with no origin
  if (!origin) return callback(null, true);
  if (isDev) return callback(null, true);
  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

app.use(express.json());

// Set up rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

if (!isDev) app.use(limiter);

// Set up security headers
app.use(helmet());
app.disable("x-powered-by");

// Use router for routing
app.use("/api", router);

const server = createServer(app);

export const io = new Server(server, {
  cors: {
    origin: isDev ? "*" : ALLOWED_ORIGINS,
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