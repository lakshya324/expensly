import { Document, Types } from "mongoose";
import { ReceiptUseCase } from "../config/constants.js";

export interface IReceipt extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** S3 object key for the stored file */
  s3Key: string;
  /** MIME type of the uploaded file */
  mimetype: string;
  /** Original filename as submitted by the client */
  originalName: string;
  /** File size in bytes */
  size: number;
  /** Classifies how this receipt/file is used */
  useCase: ReceiptUseCase;
  /** User who uploaded the file */
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  toData(): IReceiptData;
}

export interface IReceiptData {
  _id: string;
  orgId: string;
  s3Key: string;
  mimetype: string;
  originalName: string;
  size: number;
  useCase: ReceiptUseCase;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReceiptRef {
  _id: string;
  url: string;
}