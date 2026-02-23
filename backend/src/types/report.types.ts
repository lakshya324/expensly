export interface ReportFilters {
  status?: string;
  department?: string;
  from?: string;
  to?: string;
}

/** Shape returned to the frontend for each saved report */
export interface ReportListItem {
  _id: string;
  filename: string;
  ticketCount: number;
  filters: ReportFilters;
  downloadUrl: string;
  createdAt: string;
}
