import { Document, Types } from "mongoose";

export interface IDiscussionMessage extends Document {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  orgId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  /** Set when the message body is edited */
  editedAt: Date | null;
  /** Soft-delete timestamp; null means the message is live */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscussionMessageDataAuthor {
  _id: string;
  name: string;
  email: string;
  role: string;
  department: { _id: string; name: string } | null;
}

export interface IDiscussionMessageData {
  _id: string;
  ticketId: string;
  orgId: string;
  author: IDiscussionMessageDataAuthor;
  text: string;
  editedAt: Date | null;
  /** Deleted messages are included as tombstones so thread indices remain stable */
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscussionThreadData {
  ticketId: string;
  messages: IDiscussionMessageData[];
  total: number;
  page: number;
  pageSize: number;
}
