/** Serialized entity snapshot - the minimal named-entity shape used in API responses. */
export interface IEntitySnapshotData {
  _id: string;
  name: string;
}

/** Serialized user snapshot - the minimal user shape used in API responses. */
export interface IUserSnapshotData extends IEntitySnapshotData {
  email: string;
}
