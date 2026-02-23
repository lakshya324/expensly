import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  orgId: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  s3Key: string;
  filename: string;
  ticketCount: number;
  filters: {
    status?: string;
    department?: string;
    from?: string;
    to?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    s3Key: { type: String, required: true },
    filename: { type: String, required: true },
    ticketCount: { type: Number, required: true, default: 0 },
    filters: {
      status: { type: String },
      department: { type: String },
      from: { type: String },
      to: { type: String },
    },
  },
  { timestamps: true }
);

ReportSchema.index({ orgId: 1, createdAt: -1 }); // org-scoped report queries
ReportSchema.index({ generatedBy: 1, createdAt: -1 }); // per-user report list sorted by newest first

export const Report = mongoose.model<IReport>('Report', ReportSchema);
