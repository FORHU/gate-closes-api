import express from "express";
import HealthController from "../controllers/health.controller";

const router = express.Router();

router.get("/health", HealthController.getLiveness);
router.get("/readiness", HealthController.getReadiness);

export default router;
