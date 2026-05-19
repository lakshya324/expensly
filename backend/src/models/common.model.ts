import { Schema } from "mongoose";
import {
  IEntitySnapshot,
  IPolicySnapshot,
  IUserSnapshot,
} from "../types/common.types.js";
import { IDiscussionAuthor } from "../types/discussion.types.js";

export const EntitySnapshotSchema = new Schema<IEntitySnapshot>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

export const UserSnapshotSchema = new Schema<IUserSnapshot>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false },
);

export const PolicySnapshotSchema = new Schema<IPolicySnapshot>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    grants: [{ type: String }],
  },
  { _id: false },
);

/** Author snapshot used in DiscussionMessage - UserSnapshot extended with role. */
export const DiscussionAuthorSchema = new Schema<IDiscussionAuthor>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true },
    department: { type: EntitySnapshotSchema, default: null },
  },
  { _id: false },
);
