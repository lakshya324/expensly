//! Response Payload
export interface ResponsePayload<T = void> {
  success: boolean;
  message: string;
  timestamp: string;
  data?: T;
}

export interface IErrorResponseData {
  code: string | number;
  details?: any;
}

//! Pagination Payload
export interface ResponsePaginationPayload<T, TMeta = undefined> {
  success: boolean;
  message: string;
  timestamp: string;
  data?: IPaginatedData<T, TMeta>;
}

export interface IPaginatedData<T, TMeta = undefined> {
  data: T[];
  pagination: Pagination;
  meta?: TMeta;
  // [key: string]: any;  // Allow additional fields
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
