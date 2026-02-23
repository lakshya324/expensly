import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { IExchangeRateSnapshot } from '@/core/types/analytics.types';
import type { ApiResponse, PaginatedData, PaginationMeta } from '@/core/types/api.types';

type ApiErr = { response?: { data?: { message?: string } } };
const errMsg = (e: unknown, fallback: string) =>
  (e as ApiErr)?.response?.data?.message ?? fallback;

export function useExchangeRates() {
  const [data, setData] = useState<IExchangeRateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<IExchangeRateSnapshot>>(EP.EXCHANGE_RATES);
      setData(res.data.data);
    } catch {
      // current rates may not exist yet — silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

interface HistoryFilters {
  page?: number;
  limit?: number;
}

export function useExchangeRateHistory(filters: HistoryFilters = {}) {
  const [data, setData] = useState<IExchangeRateSnapshot[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined),
      );
      const res = await apiClient.get<ApiResponse<PaginatedData<IExchangeRateSnapshot>>>(
        EP.EXCHANGE_RATES_HISTORY,
        { params },
      );
      setData(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load rate history'));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, pagination, loading, refetch: fetch };
}

export function useFetchLatestRates(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const fetchLatest = async () => {
    setLoading(true);
    try {
      await apiClient.post(EP.EXCHANGE_RATES_FETCH_LATEST);
      toast.success('Exchange rates updated');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to fetch latest rates'));
    } finally {
      setLoading(false);
    }
  };

  return { fetchLatest, loading };
}

export function useFetchRatesPreview() {
  const [loading, setLoading] = useState(false);

  const fetchPreview = async (): Promise<Record<string, number> | null> => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Record<string, number> }>(EP.EXCHANGE_RATES_FETCH_PREVIEW);
      return res.data.data;
    } catch (e) {
      toast.error(errMsg(e, 'Failed to fetch latest rates'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchPreview, loading };
}

interface SetManualRatesBody {
  rates: Record<string, number>;
}

export function useSetManualRates(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);

  const setManualRates = async (body: SetManualRatesBody) => {
    setLoading(true);
    try {
      await apiClient.patch(EP.EXCHANGE_RATES, body);
      toast.success('Manual rates saved');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to save rates'));
    } finally {
      setLoading(false);
    }
  };

  return { setManualRates, loading };
}

export function useUpdateActiveCurrencies(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const patchOrg = useAuthStore((s) => s.patchOrg);

  const updateActiveCurrencies = async (activeCurrencies: string[]) => {
    setLoading(true);
    try {
      const res = await apiClient.patch<ApiResponse<string[]>>(EP.EXCHANGE_RATES_CURRENCIES, { activeCurrencies });
      patchOrg({ activeCurrencies: res.data.data as never });
      toast.success('Active currencies updated');
      onSuccess?.();
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update currencies'));
    } finally {
      setLoading(false);
    }
  };

  return { updateActiveCurrencies, loading };
}
