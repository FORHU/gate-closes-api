import { Request, Response } from "express";
import Joi from "joi";
import S3Svc from "../services/s3.service";


export default class S3Controller {
  static async getPutUrl(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { originalFilename, contentType, sizeOfFile } = req.body;

    const schema = Joi.object({
      originalFilename: Joi.string().min(1).required(),
      contentType: Joi.string().valid("audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/aac", "audio/x-m4a").required(),
      sizeOfFile: Joi.number().integer().min(1).max(10 * 1024 * 1024).required()
    });

    const { error, value } = schema.validate({
      originalFilename,
      contentType,
      sizeOfFile,
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await S3Svc.generateUploadUrl(
        userId,
        value.originalFilename,
        value.contentType,
        value.sizeOfFile,
      );

      return res.status(200).json(result);
    } catch (err: any) {
      const message = err?.message || "Failed to generate presigned URL";
      return res.status(500).json({ message });
    }
  }

  static async getGetUrl(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { key } = req.query;

    const schema = Joi.object({
      key: Joi.string().min(1).required()
    });

    const { error, value } = schema.validate({
      key
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await S3Svc.generateDownloadUrl(
        value.key
      );

      return res.status(200).json(result);
    } catch (err: any) {
      const message = err?.message || "Failed to generate presigned URL";
      return res.status(500).json({ message });
    }
  }
}
