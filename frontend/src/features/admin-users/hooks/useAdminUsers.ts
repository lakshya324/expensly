import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { IUserData } from '@/core/types/user.types';
import type { ApiResponse, PaginatedData, PaginationMeta } from '@/core/types/api.types';

interface UserFilters {
  page?: number;
  limit?: number;
  department?: string;
}

type ApiErr = { response?: { data?: { message?: string } } };
const errMsg = (e: unknown, fallback: string) =>
  (e as ApiErr)?.response?.data?.message ?? fallback;

export function useAdminUsers(filters: UserFilters = {}) {
  const [data, setData] = useState<IUserData[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const res = await apiClient.get<ApiResponse<PaginatedData<IUserData>>>(EP.ADMIN_USERS, {
        params,
      });
      setData(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, pagination, loading, refetch: fetch };
}

interface CreateUserBody {
  name: string;
  email: string;
  department?: string;
  managerId?: string;
  role?: 'user' | 'admin';
}

export function useCreateUser() {
  const [loading, setLoading] = useState(false);

  const createUser = async (body: CreateUserBody): Promise<IUserData | null> => {
    setLoading(true);
    try {
      const res = await apiClient.post<ApiResponse<IUserData>>(EP.ADMIN_USERS, body);
      toast.success('User created successfully');
      return res.data.data;
    } catch (e) {
      toast.error(errMsg(e, 'Failed to create user'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading };
}

interface UpdateUserBody {
  name?: string;
  department?: string;
  managerId?: string;
}

export function useUpdateUser(id: string) {
  const [loading, setLoading] = useState(false);

  const updateUser = async (body: UpdateUserBody): Promise<IUserData | null> => {
    setLoading(true);
    try {
      const res = await apiClient.put<ApiResponse<IUserData>>(EP.ADMIN_USER(id), body);
      toast.success('User updated successfully');
      return res.data.data;
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update user'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updateUser, loading };
}

export function useToggleDisableUser(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const toggle = async (isDisabled: boolean) => {
    setLoading(true);
    try {
      await apiClient.patch<ApiResponse<IUserData>>(EP.ADMIN_USER_DISABLE(id), { isDisabled });
      toast.success(isDisabled ? 'User disabled' : 'User enabled');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update user status'));
    } finally {
      setLoading(false);
    }
  };

  return { toggle, loading };
}

interface PermissionsBody {
  canViewAllTickets: boolean | null;
  canApprove: boolean | null;
}

export function useUpdateUserPermissions(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const update = async (permissions: PermissionsBody) => {
    setLoading(true);
    try {
      await apiClient.patch<ApiResponse<IUserData>>(EP.ADMIN_USER_PERMISSIONS(id), permissions);
      toast.success('Permissions updated');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update permissions'));
    } finally {
      setLoading(false);
    }
  };

  return { update, loading };
}
