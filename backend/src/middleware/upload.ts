import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

// Store in memory — we stream directly to S3 without touching disk
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP and PDF files are allowed for receipts'));
  }
};

export const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
}).single('receipt');
