import type { Role, Currency } from './api.types';

export interface UserPermissions {
  canViewAllTickets: boolean | null;
  canApprove: boolean | null;
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
  department: { _id: string; name: string } | null;
  managerId: { _id: string; name: string; email: string; role: Role } | null;
  permissions: UserPermissions;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}
