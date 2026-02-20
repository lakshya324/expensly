import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { IOrgAnalyticsData } from '@/core/types/analytics.types';
import type { ApiResponse } from '@/core/types/api.types';

export function useAnalytics() {
  const [data, setData] = useState<IOrgAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<IOrgAnalyticsData>>(EP.ADMIN_ANALYTICS);
      setData(res.data.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiClient.post<ApiResponse<IOrgAnalyticsData>>(EP.ADMIN_ANALYTICS_REFRESH);
      setData(res.data.data);
      toast.success('Analytics refreshed');
    } catch {
      toast.error('Failed to refresh analytics');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return { data, loading, refreshing, refresh };
}
