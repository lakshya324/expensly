import type { Role, Currency } from './api.types';
import type { IDepartmentData } from './ticket.types';

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
  department: IDepartmentData | null;
  manager: { _id: string; name: string; email: string; role: Role; isDisabled: boolean; createdAt: string; updatedAt: string } | null;
  permissions: UserPermissions;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}
