import { S3Client, S3ClientConfig, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AWS_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_SECRET_ACCESS_KEY,
  CLOUD_FRONT_DOMAIN,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
} from "../config";

/**
 * Static keys only when both are set (local development). Otherwise no
 * `credentials` at all, so the SDK's provider chain resolves the instance
 * role on the deployed host. A partial or empty credentials object would
 * make the SDK skip that chain and fail with "Resolved credential object is
 * not valid", so it is never passed.
 */
export function s3ClientConfig(env: {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}): S3ClientConfig {
  return {
    region: env.region,
    ...(env.accessKeyId &&
      env.secretAccessKey && {
        credentials: {
          accessKeyId: env.accessKeyId,
          secretAccessKey: env.secretAccessKey,
        },
      }),
    ...(env.endpoint && { endpoint: env.endpoint }),
    ...(env.forcePathStyle && { forcePathStyle: true }),
  };
}

const s3Client = new S3Client(
  s3ClientConfig({
    region: AWS_REGION,
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    endpoint: S3_ENDPOINT,
    forcePathStyle: S3_FORCE_PATH_STYLE,
  })
);

export async function getPutObjectPresignedUrl(params: { key: string; contentType?: string }) {
  const { key, contentType } = params;

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command);

  return url;
}

export async function getGetObjectPresignedUrl(params: { key: string }) {
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
