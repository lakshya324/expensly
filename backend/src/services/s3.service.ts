import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { S3_URL_EXPIRY } from '../config/constants.js';

const s3 = new S3Client({
  region: config.awsRegion,
  credentials:
    config.awsAccessKeyId && config.awsSecretAccessKey
      ? {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
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
      Bucket: config.awsBucket,
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
    Bucket: config.awsBucket,
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
      Bucket: config.awsBucket,
      Key: key,
    })
  );
};

/**
 * Build a receipt S3 key for a given ticket id and file extension.
 */
export const buildReceiptKey = (ticketId: string, mimetype: string): string => {
  const ext = mimetype.split('/')[1] ?? 'bin';
  return `receipts/${ticketId}.${ext}`;
};
