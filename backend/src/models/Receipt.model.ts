import mongoose, { Schema } from "mongoose";
import { RECEIPT_USE_CASE } from "../config/constants.js";
import { IReceipt, IReceiptData } from "../types/receipt.types.js";

const ReceiptSchema = new Schema<IReceipt>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    s3Key: { type: String, required: true },
    mimetype: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number, required: true },
    useCase: {
      type: String,
      enum: Object.values(RECEIPT_USE_CASE),
      required: true,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

ReceiptSchema.index({ orgId: 1 });
ReceiptSchema.index({ orgId: 1, useCase: 1 });

ReceiptSchema.methods.toData = function (this: IReceipt): IReceiptData {
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    s3Key: this.s3Key,
    mimetype: this.mimetype,
    originalName: this.originalName,
    size: this.size,
    useCase: this.useCase,
    uploadedBy: this.uploadedBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Receipt = mongoose.model<IReceipt>("Receipt", ReceiptSchema);
