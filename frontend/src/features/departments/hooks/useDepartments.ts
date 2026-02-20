import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { IDepartmentData } from '@/core/types/ticket.types';
import type { ApiResponse, PaginatedData, PaginationMeta } from '@/core/types/api.types';

type ApiErr = { response?: { data?: { message?: string } } };
const errMsg = (e: unknown, fallback: string) =>
  (e as ApiErr)?.response?.data?.message ?? fallback;

interface DeptFilters {
  page?: number;
  limit?: number;
  active?: boolean;
}

export function useDepartments(filters: DeptFilters = {}) {
  const [data, setData] = useState<IDepartmentData[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined),
      );
      const res = await apiClient.get<ApiResponse<PaginatedData<IDepartmentData>>>(
        EP.ADMIN_DEPARTMENTS,
        { params },
      );
      setData(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load departments'));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, pagination, loading, refetch: fetch };
}

interface DeptBody {
  name: string;
  budget: number;
  budgetResetPeriod: 'none' | 'monthly' | 'quarterly' | 'yearly';
}

export function useCreateDepartment(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const createDepartment = async (body: DeptBody): Promise<IDepartmentData | null> => {
    setLoading(true);
    try {
      const res = await apiClient.post<ApiResponse<IDepartmentData>>(EP.ADMIN_DEPARTMENTS, body);
      toast.success('Department created');
      onSuccess?.();
      return res.data.data;
    } catch (e) {
      toast.error(errMsg(e, 'Failed to create department'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createDepartment, loading };
}

export function useUpdateDepartment(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const updateDepartment = async (body: Partial<DeptBody>): Promise<IDepartmentData | null> => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<IDepartmentData>>(EP.ADMIN_DEPT(id), body);
      toast.success('Department updated');
      onSuccess?.();
      return res.data.data;
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update department'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updateDepartment, loading };
}

export function useDeleteDepartment(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const deleteDepartment = async () => {
    setLoading(true);
    try {
      await apiClient.delete(EP.ADMIN_DEPT(id));
      toast.success('Department deleted');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to delete department'));
    } finally {
      setLoading(false);
    }
  };

  return { deleteDepartment, loading };
}

export function useResetBudget(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const resetBudget = async () => {
    setLoading(true);
    try {
      await apiClient.post(EP.ADMIN_DEPT_RESET_BUDGET(id));
      toast.success('Budget reset successfully');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to reset budget'));
    } finally {
      setLoading(false);
    }
  };

  return { resetBudget, loading };
}

export function useDepartmentTags(id: string) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .get<ApiResponse<string[]>>(EP.ADMIN_DEPT_TAGS(id))
      .then((r) => setTags(r.data.data))
      .catch(() => toast.error('Failed to load tags'))
      .finally(() => setLoading(false));
  }, [id]);

  return { tags, loading };
}

export function useRemoveTag(deptId: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const removeTag = async (tag: string) => {
    setLoading(true);
    try {
      await apiClient.delete(EP.ADMIN_DEPT_TAG(deptId, tag));
      toast.success('Tag removed');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to remove tag'));
    } finally {
      setLoading(false);
    }
  };

  return { removeTag, loading };
}
