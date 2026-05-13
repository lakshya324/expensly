import mongoose, { Schema } from "mongoose";
import { IDiscussionMessage } from "../types/discussion.types.js";

const DiscussionMessageSchema = new Schema<IDiscussionMessage>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Author info embedded at creation — no lookup needed on read. */
    author: {
      type: new Schema(
        {
          _id: { type: Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
          email: { type: String, required: true },
          role: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    /** Author's department at creation time, for display in thread. */
    authorDeptSnapshot: {
      type: new Schema(
        {
          _id: { type: Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    /** Set when the author edits the message — null on first creation */
    editedAt: { type: Date, default: null },
    /** Soft-delete: set to a date instead of removing the document */
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

// Load a ticket's thread in chronological order
DiscussionMessageSchema.index({ ticketId: 1, createdAt: 1 });
DiscussionMessageSchema.index({ ticketId: 1, orgId: 1, createdAt: 1 });
// Org-scoped housekeeping / admin search
DiscussionMessageSchema.index({ orgId: 1, createdAt: -1 });

export const DiscussionMessage = mongoose.model<IDiscussionMessage>(
  "DiscussionMessage",
  DiscussionMessageSchema,
);
