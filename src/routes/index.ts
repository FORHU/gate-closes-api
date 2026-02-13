import express from "express";
import authRoutes from "./user.auth.route";

const router = express.Router();

router.get("/v1", (_, res) => {
  res.json({
    message: "Welcome to my API",
  });
});

router.use("/auth", authRoutes);

export default router;
