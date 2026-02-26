import express from "express";
import S3Controller from "../controllers/s3.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

const router = express.Router();

// Generate presigned URL for uploading (PUT)
router.post("/presign-put", sessionMiddleware, S3Controller.getPutUrl);

// Generate presigned URL for downloading (GET)
router.get("/presign-get", sessionMiddleware, S3Controller.getGetUrl);

export default router;