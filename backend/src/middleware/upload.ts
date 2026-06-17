import multer, { FileFilterCallback } from 'multer';
import multerS3 from 'multer-s3';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import config from '../config/env.config.js';
import { s3Client } from '../config/s3.config.js';

const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SAFE_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);

function extensionFor(file: Express.Multer.File): string {
  return SAFE_EXTENSIONS.get(file.mimetype) ?? 'bin';
}

function malwareScanPlaceholder(_file: Express.Multer.File): true {
  // Hook point for ClamAV/vendor scanning before accepting uploads in regulated deployments.
  return true;
}

// ─── Key builders ─────────────────────────────────────────────────────────────

const receiptKeyBuilder = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, key?: string) => void,
): void => {
  const ext = extensionFor(file);
  const key = `expensly/receipts/${randomUUID()}.${ext}`;
  cb(null, key);
};

const logoKeyBuilder = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, key?: string) => void,
): void => {
  const ext = extensionFor(file);
  const key = `expensly/logos/${randomUUID()}.${ext}`;
  cb(null, key);
};

const iconKeyBuilder = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, key?: string) => void,
): void => {
  const ext = extensionFor(file);
  const key = `expensly/icons/${randomUUID()}.${ext}`;
  cb(null, key);
};

// ─── File filters ─────────────────────────────────────────────────────────────

const receiptFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (RECEIPT_MIME_TYPES.includes(file.mimetype) && malwareScanPlaceholder(file)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP and PDF files are allowed for receipts'));
  }
};

const imageOnlyFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (IMAGE_MIME_TYPES.includes(file.mimetype) && malwareScanPlaceholder(file)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

// ─── Multer instances (multer-s3 direct upload) ──────────────────────────────

export const uploadReceipt = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: config.awsConfig.awsBucket!,
    key: receiptKeyBuilder,
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  fileFilter: receiptFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('receipt');

export const uploadMerchantLogo = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: config.awsConfig.awsBucket!,
    key: logoKeyBuilder,
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single('logo');

export const uploadCategoryIcon = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: config.awsConfig.awsBucket!,
    key: iconKeyBuilder,
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single('icon');
