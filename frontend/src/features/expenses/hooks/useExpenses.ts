import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ITicketData, ITicketSummaryData, IDiscussionMessageData } from '@/core/types/ticket.types';
import type { ApiResponse, PaginatedData, TicketStatus } from '@/core/types/api.types';

interface TicketFilters {
  page?: number;
  limit?: number;
  status?: TicketStatus | '';
  department?: string;
  userId?: string;
  search?: string;
  from?: string;
  to?: string;
  flagged?: 'true' | 'false';
}

export function useExpenses(filters: TicketFilters = {}) {
  const [data, setData] = useState<ITicketSummaryData[]>([]);
  const [pagination, setPagination] = useState<import('@/core/types/api.types').PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined),
      );
      const res = await apiClient.get<ApiResponse<PaginatedData<ITicketSummaryData>>>(EP.EXPENSES, { params });
      setData(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load expenses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, pagination, loading, error, refetch: fetch };
}

export function useExpense(id: string) {
  const [data, setData] = useState<ITicketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get<ApiResponse<ITicketData>>(EP.EXPENSE(id))
      .then((res) => setData(res.data.data))
      .catch(() => toast.error('Failed to load expense'))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, setData };
}

export function useCreateExpense() {
  const [loading, setLoading] = useState(false);

  const createExpense = async (formData: FormData): Promise<ITicketData | null> => {
    setLoading(true);
    try {
      const res = await apiClient.post<ApiResponse<ITicketData>>(EP.EXPENSES, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Expense submitted successfully');
      return res.data.data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create expense';
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createExpense, loading };
}

export function useUpdateExpenseStatus(id: string, onSuccess?: (ticket: ITicketData) => void) {
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: TicketStatus, comments?: string) => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<ITicketData>>(EP.EXPENSE_STATUS(id), {
        status,
        comments,
      });
      toast.success(`Expense ${status} successfully`);
      onSuccess?.(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update status';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return { updateStatus, loading };
}

export function useFlagExpense(id: string, onSuccess?: (ticket: ITicketData) => void) {
  const [loading, setLoading] = useState(false);

  const toggleFlag = async () => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<ITicketData>>(EP.EXPENSE_FLAG(id));
      onSuccess?.(res.data.data);
    } catch {
      toast.error('Failed to update flag');
    } finally {
      setLoading(false);
    }
  };

  return { toggleFlag, loading };
}

export function useDeleteExpense(id: string, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const deleteExpense = async () => {
    setLoading(true);
    try {
      await apiClient.delete(EP.EXPENSE(id));
      toast.success('Expense deleted');
      onSuccess?.();
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setLoading(false);
    }
  };

  return { deleteExpense, loading };
}

export interface ExpenseStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export function useExpenseStats() {
  const [data, setData] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<ExpenseStats>>(EP.EXPENSE_STATS);
      setData(res.data.data);
    } catch {
      // silently fail — stats will remain null
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useScanReceipt() {
  const [loading, setLoading] = useState(false);

  const scanReceipt = async (file: File): Promise<ITicketData | null> => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const res = await apiClient.post<ApiResponse<ITicketData>>(EP.EXPENSE_SCAN, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Scan failed';
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { scanReceipt, loading };
}

export function useSubmitDraft() {
  const [loading, setLoading] = useState(false);

  const submitDraft = async (id: string, formData: FormData): Promise<ITicketData | null> => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<ITicketData>>(EP.EXPENSE_SUBMIT_DRAFT(id), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Expense submitted successfully');
      return res.data.data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit draft';
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { submitDraft, loading };
}

export function useDiscussion(ticketId: string) {
  const [messages, setMessages] = useState<IDiscussionMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<{ data: IDiscussionMessageData[]; total: number }>>(
        EP.EXPENSE_DISCUSSION(ticketId),
      );
      setMessages(res.data.data.data);
    } catch {
      // silently fail — discussion is non-critical
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const postMessage = async (text: string): Promise<boolean> => {
    if (!text.trim()) return false;
    setPosting(true);
    try {
      const res = await apiClient.post<ApiResponse<IDiscussionMessageData>>(
        EP.EXPENSE_DISCUSSION(ticketId),
        { text },
      );
      setMessages((prev) => [...prev, res.data.data]);
      return true;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to send message';
      toast.error(msg);
      return false;
    } finally {
      setPosting(false);
    }
  };

  return { messages, loading, posting, postMessage, refetch: fetchMessages };
}

export function useReceiptUrl(id: string) {
  const openReceipt = async () => {
    try {
      const res = await apiClient.get<ApiResponse<string>>(EP.EXPENSE_RECEIPT(id));
      window.open(res.data.data, '_blank');
    } catch {
      toast.error('Failed to get receipt URL');
    }
  };
  return { openReceipt };
}
