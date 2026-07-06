import express from "express";
import S3Controller from "../controllers/s3.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", sessionMiddleware, upload.single("file"), S3Controller.uploadProxy);
router.post("/get-presigned-url", sessionMiddleware, S3Controller.getPutUrl);
router.get("/get-cloudfront-url", sessionMiddleware, S3Controller.getGetUrl);

export default router;