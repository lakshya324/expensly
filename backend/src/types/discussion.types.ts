import { Document, Types } from "mongoose";
import {
  IEntitySnapshot,
  IEntitySnapshotData,
  IUserSnapshot,
} from "./common.types.js";

export interface IDiscussionAuthor extends IUserSnapshot {
  role: string;
  department: IEntitySnapshot | null;
}

export interface IDiscussionMessage extends Document {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Author info embedded at creation - no lookup needed on read. */
  author: IDiscussionAuthor;
  text: string;
  /** Set when the message body is edited */
  editedAt: Date | null;
  /** Soft-delete timestamp; null means the message is live */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscussionAuthorData {
  _id: string;
  name: string;
  email: string;
  role: string;
  department: IEntitySnapshotData | null;
}

export interface IDiscussionMessageData {
  _id: string;
  ticketId: string;
  orgId: string;
  author: IDiscussionAuthorData;
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
