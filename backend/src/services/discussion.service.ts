import { Types } from "mongoose";
import { DiscussionMessage } from "../models/DiscussionMessage.model.js";
import { Ticket } from "../models/Ticket.model.js";
import { User } from "../models/User.model.js";
import { ROLES } from "../config/constants.js";
import { createError } from "../utils/error.js";
import { IDiscussionMessageData } from "../types/discussion.types.js";

export interface PostMessageInput {
  ticketId: string;
  orgId: string;
  authorId: string;
  text: string;
}

export interface EditMessageInput {
  text: string;
}

export interface DiscussionThreadPage {
  data: IDiscussionMessageData[];
  total: number;
}

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Build IDiscussionMessageData from a lean message doc + author lookup map
// ---------------------------------------------------------------------------
function mapMessage(
  msg: {
    _id: Types.ObjectId;
    ticketId: Types.ObjectId;
    orgId: Types.ObjectId;
    authorId: Types.ObjectId;
    text: string;
    editedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  authorsById: Map<string, { _id: Types.ObjectId; name: string; email: string; role: string }>,
): IDiscussionMessageData {
  const deleted = msg.deletedAt != null;
  const author = authorsById.get(msg.authorId.toString());
  return {
    _id: msg._id.toString(),
    ticketId: msg.ticketId.toString(),
    orgId: msg.orgId.toString(),
    author: author
      ? { _id: author._id.toString(), name: author.name, email: author.email, role: author.role }
      : { _id: msg.authorId.toString(), name: "[unknown]", email: "", role: "" },
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
  page = 1,
): Promise<DiscussionThreadPage> => {
  // Access gate — confirms the ticket belongs to this org
  const ticketExists = await Ticket.exists({ _id: ticketId, orgId });
  if (!ticketExists) throw createError("Ticket not found", 404, "NOT_FOUND");

  const skip = (page - 1) * PAGE_SIZE;

  const [messages, total] = await Promise.all([
    DiscussionMessage.find({ ticketId, orgId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean(),
    DiscussionMessage.countDocuments({ ticketId, orgId }),
  ]);

  if (messages.length === 0) return { data: [], total };

  const authorIds = [...new Set(messages.map((m) => m.authorId.toString()))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select("_id name email role")
    .lean();
  const authorsById = new Map(authors.map((a) => [a._id.toString(), a]));

  return {
    data: messages.map((m) => mapMessage(m as Parameters<typeof mapMessage>[0], authorsById)),
    total,
  };
};

// ---------------------------------------------------------------------------
// Post a new message
// ---------------------------------------------------------------------------
export const postMessage = async (input: PostMessageInput): Promise<IDiscussionMessageData> => {
  const ticketExists = await Ticket.exists({ _id: input.ticketId, orgId: input.orgId });
  if (!ticketExists) throw createError("Ticket not found", 404, "NOT_FOUND");

  const msg = await DiscussionMessage.create({
    ticketId: new Types.ObjectId(input.ticketId),
    orgId: new Types.ObjectId(input.orgId),
    authorId: new Types.ObjectId(input.authorId),
    text: input.text,
  });

  const author = await User.findById(input.authorId).select("_id name email role").lean();
  const authorsById = new Map(author ? [[author._id.toString(), author]] : []);

  return mapMessage(msg.toObject() as Parameters<typeof mapMessage>[0], authorsById);
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
  if (msg.authorId.toString() !== authorId)
    throw createError("You can only edit your own messages", 403, "FORBIDDEN");

  msg.text = input.text;
  msg.editedAt = new Date();
  await msg.save();

  const author = await User.findById(authorId).select("_id name email role").lean();
  const authorsById = new Map(author ? [[author._id.toString(), author]] : []);

  return mapMessage(msg.toObject() as Parameters<typeof mapMessage>[0], authorsById);
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

  // Idempotent
  if (msg.deletedAt != null) return;

  if (msg.authorId.toString() !== authorId && callerRole !== ROLES.ADMIN)
    throw createError("You can only delete your own messages", 403, "FORBIDDEN");

  msg.deletedAt = new Date();
  await msg.save();
};
