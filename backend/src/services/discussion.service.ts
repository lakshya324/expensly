import { Types } from "mongoose";
import { DiscussionMessage } from "../models/DiscussionMessage.model.js";
import { Ticket } from "../models/Ticket.model.js";
import { ROLES } from "../config/constants.js";
import { createError } from "../utils/error.js";
import { IDiscussionMessageData } from "../types/discussion.types.js";

export interface PostMessageAuthor {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  departmentSnapshot: { _id: Types.ObjectId; name: string } | null;
}

export interface PostMessageInput {
  ticketId: string;
  orgId: string;
  author: PostMessageAuthor;
  text: string;
}

export interface EditMessageInput {
  text: string;
}

export interface DiscussionThreadPage {
  data: IDiscussionMessageData[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Build IDiscussionMessageData from an embedded-author lean message doc
// ---------------------------------------------------------------------------
function mapMessage(msg: {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  orgId: Types.ObjectId;
  author: { _id: Types.ObjectId; name: string; email: string; role: string };
  authorDeptSnapshot: { _id: Types.ObjectId; name: string } | null;
  text: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): IDiscussionMessageData {
  const deleted = msg.deletedAt != null;
  return {
    _id: msg._id.toString(),
    ticketId: msg.ticketId.toString(),
    orgId: msg.orgId.toString(),
    author: {
      _id: msg.author._id.toString(),
      name: msg.author.name,
      email: msg.author.email,
      role: msg.author.role,
      department: msg.authorDeptSnapshot
        ? { _id: msg.authorDeptSnapshot._id.toString(), name: msg.authorDeptSnapshot.name }
        : null,
    },
    text: deleted ? "[deleted]" : msg.text,
    editedAt: msg.editedAt,
    deleted,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Get paginated thread for a ticket
// ---------------------------------------------------------------------------
export const getThread = async (
  orgId: string,
  ticketId: string,
  page = -1,
): Promise<DiscussionThreadPage> => {
  const ticketExists = await Ticket.exists({ _id: ticketId, orgId });
  if (!ticketExists) throw createError("Ticket not found", 404, "NOT_FOUND");

  const total = await DiscussionMessage.countDocuments({ ticketId, orgId });
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actualPage = page < 1 ? lastPage : Math.min(page, lastPage);
  const skip = (actualPage - 1) * PAGE_SIZE;

  const messages = await DiscussionMessage.find({ ticketId, orgId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(PAGE_SIZE)
    .lean();

  if (messages.length === 0) return { data: [], total, page: actualPage, pageSize: PAGE_SIZE };

  return {
    data: messages.map((m) => mapMessage(m as Parameters<typeof mapMessage>[0])),
    total,
    page: actualPage,
    pageSize: PAGE_SIZE,
  };
};

// ---------------------------------------------------------------------------
// Post a new message (author info embedded at creation)
// ---------------------------------------------------------------------------
export const postMessage = async (input: PostMessageInput): Promise<IDiscussionMessageData> => {
  const ticketExists = await Ticket.exists({ _id: input.ticketId, orgId: input.orgId });
  if (!ticketExists) throw createError("Ticket not found", 404, "NOT_FOUND");

  const msg = await DiscussionMessage.create({
    ticketId: new Types.ObjectId(input.ticketId),
    orgId: new Types.ObjectId(input.orgId),
    author: {
      _id: input.author._id,
      name: input.author.name,
      email: input.author.email,
      role: input.author.role,
    },
    authorDeptSnapshot: input.author.departmentSnapshot ?? null,
    text: input.text,
  });

  return mapMessage(msg.toObject() as Parameters<typeof mapMessage>[0]);
};

// ---------------------------------------------------------------------------
// Edit a message (author only)
// ---------------------------------------------------------------------------
export const editMessage = async (
  orgId: string,
  messageId: string,
  authorId: string,
  input: EditMessageInput,
): Promise<IDiscussionMessageData> => {
  const msg = await DiscussionMessage.findOne({ _id: messageId, orgId });
  if (!msg) throw createError("Message not found", 404, "NOT_FOUND");
  if (msg.deletedAt != null)
    throw createError("Cannot edit a deleted message", 400, "INVALID_STATE");
  if (msg.author._id.toString() !== authorId)
    throw createError("You can only edit your own messages", 403, "FORBIDDEN");

  msg.text = input.text;
  msg.editedAt = new Date();
  await msg.save();

  return mapMessage(msg.toObject() as Parameters<typeof mapMessage>[0]);
};

// ---------------------------------------------------------------------------
// Delete a message (author or admin — soft delete)
// ---------------------------------------------------------------------------
export const deleteMessage = async (
  orgId: string,
  messageId: string,
  authorId: string,
  callerRole?: string,
): Promise<void> => {
  const msg = await DiscussionMessage.findOne({ _id: messageId, orgId });
  if (!msg) throw createError("Message not found", 404, "NOT_FOUND");

  if (msg.deletedAt != null) return; // idempotent

  if (msg.author._id.toString() !== authorId && callerRole !== ROLES.ADMIN)
    throw createError("You can only delete your own messages", 403, "FORBIDDEN");

  msg.deletedAt = new Date();
  await msg.save();
};
