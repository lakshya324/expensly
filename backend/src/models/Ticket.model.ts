import mongoose, { Schema, Document, Types } from 'mongoose';
import { TICKET_STATUS, CURRENCIES, type TicketStatus, type Currency } from '../config/constants.js';

export interface IApproval {
  required?: boolean;
  approved: boolean | null;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  comments: string | null;
}

export interface ITicket extends Document {
  _id: Types.ObjectId;
  title: string;
  submittedBy: Types.ObjectId;
  orgId: Types.ObjectId;
  amount: number;
  currency: Currency;
  department: string;
  description: string;
  tags: string[];
  receiptKey: string | null;
  status: TicketStatus;
  flagged: boolean;
  managerApproval: IApproval | null;
  financeApproval: IApproval | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalSchema = new Schema<IApproval>(
  {
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    comments: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const TicketSchema = new Schema<ITicket>(
  {
    title: { type: String, required: true, trim: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    department: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },
    receiptKey: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(TICKET_STATUS),
      default: TICKET_STATUS.PENDING,
    },
    flagged: { type: Boolean, default: false },
    managerApproval: { type: ApprovalSchema, default: null },
    financeApproval: { type: ApprovalSchema, default: null },
  },
  { timestamps: true }
);

TicketSchema.index({ orgId: 1 });
TicketSchema.index({ submittedBy: 1 });
TicketSchema.index({ orgId: 1, status: 1 });
TicketSchema.index({ orgId: 1, department: 1 });
TicketSchema.index({ createdAt: -1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
