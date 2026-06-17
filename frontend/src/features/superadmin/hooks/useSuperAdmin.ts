import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { IOrganizationData, IUserData } from '@/core/types/user.types';
import type { ApiResponse, PaginatedData, PaginationMeta, Role, Currency } from '@/core/types/api.types';

type ApiErr = { response?: { data?: { message?: string } } };
const errMsg = (e: unknown, fallback: string) =>
  (e as ApiErr)?.response?.data?.message ?? fallback;

interface OrgFilters {
  page?: number;
  search?: string;
  isDisabled?: boolean;
}

export function useSuperAdminOrgs(filters: OrgFilters = {}) {
  const filterKey = JSON.stringify(filters);
  const [data, setData] = useState<IOrganizationData[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const queryFilters = JSON.parse(filterKey) as OrgFilters;
      const params = Object.fromEntries(
        Object.entries(queryFilters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const res = await apiClient.get<ApiResponse<PaginatedData<IOrganizationData>>>(
        EP.SA_ORGANIZATIONS,
        { params },
      );
      setData(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load organizations'));
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, pagination, loading, refetch: fetch };
}

export function useToggleOrgDisabled(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const toggleOrg = async (isDisabled: boolean) => {
    setLoading(true);
    try {
      await apiClient.patch<ApiResponse<IOrganizationData>>(EP.SA_ORG_DISABLE(id), {
        isDisabled,
      });
      toast.success(isDisabled ? 'Organization disabled' : 'Organization enabled');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update organization status'));
    } finally {
      setLoading(false);
    }
  };

  return { toggleOrg, loading };
}

interface UserFilters {
  page?: number;
  search?: string;
  orgId?: string;
  role?: Role;
}

export function useSuperAdminUsers(filters: UserFilters = {}) {
  const filterKey = JSON.stringify(filters);
  const [data, setData] = useState<IUserData[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const queryFilters = JSON.parse(filterKey) as UserFilters;
      const params = Object.fromEntries(
        Object.entries(queryFilters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const res = await apiClient.get<ApiResponse<PaginatedData<IUserData>>>(EP.SA_USERS, {
        params,
      });
      setData(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, pagination, loading, refetch: fetch };
}

// ─── Org CRUD ────────────────────────────────────────────────────────────────

export interface CreateOrgPayload {
  name: string;
  slug: string;
  baseCurrency: Currency;
  isDisabled?: boolean;
}

export interface UpdateOrgPayload {
  name?: string;
  baseCurrency?: Currency;
  activeCurrencies?: Currency[];
  isDisabled?: boolean;
}

export function useCreateOrg(onSuccess?: (org: IOrganizationData) => void) {
  const [loading, setLoading] = useState(false);

  const createOrg = async (payload: CreateOrgPayload) => {
    setLoading(true);
    try {
      const res = await apiClient.post<ApiResponse<IOrganizationData>>(
        EP.SA_ORGANIZATIONS,
        payload,
      );
      toast.success('Organization created');
      onSuccess?.(res.data.data);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to create organization'));
    } finally {
      setLoading(false);
    }
  };

  return { createOrg, loading };
}

export function useUpdateOrg(id: string, onSuccess?: (org: IOrganizationData) => void) {
  const [loading, setLoading] = useState(false);

  const updateOrg = async (payload: UpdateOrgPayload) => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<IOrganizationData>>(EP.SA_ORG(id), payload);
      toast.success('Organization updated');
      onSuccess?.(res.data.data);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update organization'));
    } finally {
      setLoading(false);
    }
  };

  return { updateOrg, loading };
}

// ─── User CRUD ────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  orgId?: string;
  isDisabled?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  role?: Role;
  orgId?: string | null;
}

export function useCreateUser(onSuccess?: (user: IUserData) => void) {
  const [loading, setLoading] = useState(false);

  const createUser = async (payload: CreateUserPayload) => {
    setLoading(true);
    try {
      const res = await apiClient.post<ApiResponse<IUserData>>(EP.SA_USERS, payload);
      toast.success('User created');
      onSuccess?.(res.data.data);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to create user'));
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading };
}

export function useUpdateUser(id: string, onSuccess?: (user: IUserData) => void) {
  const [loading, setLoading] = useState(false);

  const updateUser = async (payload: UpdateUserPayload) => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<IUserData>>(EP.SA_USER(id), payload);
      toast.success('User updated');
      onSuccess?.(res.data.data);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update user'));
    } finally {
      setLoading(false);
    }
  };

  return { updateUser, loading };
}

export function useToggleUserDisabled(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const toggleUser = async (isDisabled: boolean) => {
    setLoading(true);
    try {
      await apiClient.patch<ApiResponse<IUserData>>(EP.SA_USER_DISABLE(id), { isDisabled });
      toast.success(isDisabled ? 'User disabled' : 'User enabled');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update user status'));
    } finally {
      setLoading(false);
    }
  };

  return { toggleUser, loading };
}
