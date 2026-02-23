import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import type { ApiResponse } from '@/core/types/api.types';

export interface ReportFilters {
  status?: string;
  department?: string;
  from?: string;
  to?: string;
}

export interface ReportListItem {
  _id: string;
  filename: string;
  ticketCount: number;
  filters: ReportFilters;
  downloadUrl: string;
  createdAt: string;
}

export async function listReports(): Promise<ReportListItem[]> {
  const res = await apiClient.get<ApiResponse<ReportListItem[]>>(EP.REPORT_LIST);
  return res.data.data;
}

export async function emailReport(id: string): Promise<void> {
  await apiClient.post(EP.REPORT_EMAIL(id));
}
