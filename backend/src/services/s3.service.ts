import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/env.config.js';
import { S3_URL_EXPIRY } from '../config/constants.js';

const s3 = new S3Client({
  region: config.awsConfig.awsRegion,
  credentials:
    config.awsConfig.awsAccessKeyId && config.awsConfig.awsSecretAccessKey
      ? {
          accessKeyId: config.awsConfig.awsAccessKeyId,
          secretAccessKey: config.awsConfig.awsSecretAccessKey,
        }
      : undefined,
});

/**
 * Upload a file buffer to S3.
 */
export const uploadFile = async (
  key: string,
  buffer: Buffer,
  mimetype: string
): Promise<string> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.awsConfig.awsBucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );
  return key;
};

/**
 * Generate a pre-signed GET URL for a receipt.
 */
export const getReceiptSignedUrl = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: config.awsConfig.awsBucket,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: S3_URL_EXPIRY });
};

/**
 * Delete a file from S3.
 */
export const deleteFile = async (key: string): Promise<void> => {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.awsConfig.awsBucket,
      Key: key,
    })
  );
};

/**
 * Build a receipt S3 key using the pattern expensly/<orgSlug>/<ticketId>.<ext>.
 */
export const buildReceiptKey = (
  ticketId: string,
  orgSlug: string,
  mimetype: string,
): string => {
  const ext = mimetype.split('/')[1] ?? 'bin';
  return `expensly/${orgSlug}/${ticketId}.${ext}`;
};
