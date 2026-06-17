import { Types } from "mongoose";

/** Snapshot of a named entity's display fields, embedded at write time. */
export interface IEntitySnapshot {
  _id: Types.ObjectId;
  name: string;
}

/** Snapshot of a user's display fields, embedded at write time. */
export interface IUserSnapshot extends IEntitySnapshot {
  email: string;
}

/** Policy snapshot with permission grants, embedded at assignment time. */
export interface IPolicySnapshot extends IEntitySnapshot {
  grants: string[];
}

/** Serialized (string-ID) form of IEntitySnapshot, used in API response types. */
export interface IEntitySnapshotData {
  _id: string;
  name: string;
}

/** Serialized (string-ID) form of IUserSnapshot, used in API response types. */
export interface IUserSnapshotData extends IEntitySnapshotData {
  email: string;
}
