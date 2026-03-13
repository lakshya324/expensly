import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/env.config.js';
import { S3_URL_EXPIRY } from '../config/constants.js';
import { s3Client } from '../config/s3.config.js';

/**
 * Upload a file buffer to S3.
 */
export const uploadFile = async (
  key: string,
  buffer: Buffer,
  mimetype: string
): Promise<string> => {
  await s3Client.send(
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
  return getSignedUrl(s3Client, command, { expiresIn: S3_URL_EXPIRY });
};

/**
 * Delete a file from S3.
 */
export const deleteFile = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: config.awsConfig.awsBucket,
      Key: key,
    })
  );
};

/**
 * Build a receipt S3 key.
 *
 * When a ticket has multiple receipts, pass `index` (0-based) to differentiate
 * them: `expensly/<orgSlug>/<ticketId>-0.jpg`, `…-1.jpg`, etc.
 * Omit `index` (or pass `undefined`) for single-receipt tickets — produces the
 * legacy `expensly/<orgSlug>/<ticketId>.<ext>` format.
 */
export const buildReceiptKey = (
  ticketId: string,
  orgSlug: string,
  mimetype: string,
  index?: number,
): string => {
  const ext = mimetype.split('/')[1] ?? 'bin';
  const suffix = index !== undefined ? `-${index}` : '';
  return `expensly/${orgSlug}/${ticketId}${suffix}.${ext}`;
};

/**
 * Generate pre-signed GET URLs for multiple receipt keys in parallel.
 * Returns an array aligned 1-to-1 with the input `keys` array.
 */
export const getReceiptSignedUrls = async (
  keys: string[],
): Promise<string[]> => {
  return Promise.all(keys.map((key) => getReceiptSignedUrl(key)));
};

/**
 * Delete multiple files from S3 in parallel.
 */
export const deleteFiles = async (keys: string[]): Promise<void> => {
  await Promise.all(keys.map((key) => deleteFile(key)));
};

/**
 * Build a report S3 key using the pattern expensly/<orgSlug>/reports/<reportId>.csv.
 */
export const buildReportKey = (orgSlug: string, reportId: string): string =>
  `expensly/${orgSlug}/reports/${reportId}.csv`;

/** 7 days in seconds */
const REPORT_URL_EXPIRY = 60 * 60 * 24 * 7;

/**
 * Generate a pre-signed GET URL for a stored report (7-day expiry).
 */
export const getReportSignedUrl = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: config.awsConfig.awsBucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: REPORT_URL_EXPIRY });
};

/**
 * Fetch a report from S3 and return it as a Buffer.
 */
export const getReportBuffer = async (key: string): Promise<Buffer> => {
  const { Body } = await s3Client.send(
    new GetObjectCommand({ Bucket: config.awsConfig.awsBucket, Key: key }),
  );
  if (!Body) throw new Error('Empty S3 body for report key: ' + key);
  // Body is a ReadableStream in the AWS SDK v3 Node runtime
  const chunks: Uint8Array[] = [];
  for await (const chunk of Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Download any S3 object and return it as a Buffer.
 * Used by the OCR worker to fetch receipt images for processing.
 */
export const downloadFile = async (key: string): Promise<Buffer> => {
  const { Body } = await s3Client.send(
    new GetObjectCommand({ Bucket: config.awsConfig.awsBucket, Key: key }),
  );
  if (!Body) throw new Error('Empty S3 body for key: ' + key);
  const chunks: Uint8Array[] = [];
  for await (const chunk of Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};
