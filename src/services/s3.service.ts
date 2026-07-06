import crypto from "crypto";
import { getPutObjectPresignedUrl, getGetObjectPresignedUrl, uploadBufferToS3 } from "../utils/s3";

export default class S3Svc {
  static async uploadFile(
    userId: string,
    originalFilename: string,
    buffer: Buffer,
    contentType?: string,
    sizeOfFile?: number,
  ) {
    const ext = (S3Svc.getFileExtension(originalFilename) || "bin").toLowerCase();

    const allowedAudioExtensions = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];
    if (!allowedAudioExtensions.includes(ext)) {
      throw new Error("Only audio files are allowed");
    }

    if (!sizeOfFile || sizeOfFile > 10 * 1024 * 1024) {
      throw new Error("Audio file size must be 10MB or below");
    }

    const key = `users/${userId}/uploads/${crypto.randomUUID()}.${ext}`;

    const url = await uploadBufferToS3({
      key,
      buffer,
      contentType,
    });

    return { url, key };
  }

  static async generateUploadUrl(
    userId: string,
    originalFilename: string,
    contentType?: string,
    sizeOfFile?: number,
  ) {
    const ext = (S3Svc.getFileExtension(originalFilename) || "bin").toLowerCase();

    const allowedAudioExtensions = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];
    if (!allowedAudioExtensions.includes(ext)) {
      throw new Error("Only audio files are allowed");
    }

    if (!sizeOfFile || sizeOfFile > 10 * 1024 * 1024) {
      throw new Error("Audio file size must be 10MB or below");
    }

    const key = `users/${userId}/uploads/${crypto.randomUUID()}.${ext}`;

    const url = await getPutObjectPresignedUrl({
      key,
      contentType,
    });

    return { url, key };
  }

  static async generateDownloadUrl(
    key: string
  ) {
    const url = await getGetObjectPresignedUrl({
      key
    });

    return { url, key };
  }

  private static getFileExtension(filename: string): string | undefined {
    const parts = filename.split(".");
    if (parts.length < 2) return undefined;
    return parts.pop();
  }
}

