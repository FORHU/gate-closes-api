import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET,
  CLOUD_FRONT_DOMAIN,
} from "../config";

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export async function getPutObjectPresignedUrl(params: {
  key: string;
  contentType?: string;
}) {
  const { key, contentType } = params;

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command);

  return url;
}

export async function getGetObjectPresignedUrl(params: {
  key: string;
}) {
  const { key } = params;

  if (CLOUD_FRONT_DOMAIN) {
    const normalizedDomain = CLOUD_FRONT_DOMAIN.replace(/\/+$/, "");
    const normalizedKey = key.replace(/^\/+/, "");
    return `${normalizedDomain}/${normalizedKey}`;
  }

  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command);

  return url;
}

export async function uploadBufferToS3(params: {
  key: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const { key, buffer, contentType } = params;

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  
  // Return the CloudFront URL directly if available, otherwise return S3 URL
  if (CLOUD_FRONT_DOMAIN) {
    const normalizedDomain = CLOUD_FRONT_DOMAIN.replace(/\/+$/, "");
    const normalizedKey = key.replace(/^\/+/, "");
    return `${normalizedDomain}/${normalizedKey}`;
  }
  
  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}