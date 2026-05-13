import { Document, Types } from "mongoose";

export interface IDiscussionMessage extends Document {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Author info embedded at creation — no lookup needed on read. */
  author: { _id: Types.ObjectId; name: string; email: string; role: string };
  /** Author's department at creation time, for display in thread. */
  authorDeptSnapshot: { _id: Types.ObjectId; name: string } | null;
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
