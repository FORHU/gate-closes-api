import express from "express";
import S3Controller from "../controllers/s3.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

const router = express.Router();

router.post("/get-presigned-url", sessionMiddleware, S3Controller.getPutUrl);
router.get("/get-cloudfront-url", sessionMiddleware, S3Controller.getGetUrl);

export default router;