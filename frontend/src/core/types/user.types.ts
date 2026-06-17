import type { Role, Currency } from "./api.types";
import type { DepartmentPermissions, PermissionKey } from "./ticket.types";
import type { IEntitySnapshotData } from "./common.types";

export interface UserPermissions {
  view_all_tickets: boolean | null;
  approve_finance: boolean | null;
  export_reports: boolean | null;
  view_analytics: boolean | null;
}

export interface IOrganizationData {
  _id: string;
  name: string;
  slug: string;
  isDisabled: boolean;
  baseCurrency: Currency;
  activeCurrencies: Currency[];
  currentRateSnapshotId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IUserData {
  _id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
  org: IOrganizationData | null;
  department: (IEntitySnapshotData & { permissions?: DepartmentPermissions }) | null;
  manager: IEntitySnapshotData | null;
  permissions: UserPermissions;
  policyId: string | null;
  effectivePermissions: Record<PermissionKey, boolean>;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}
