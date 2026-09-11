export interface PaginationParams {
  current: number;
  pageSize: number;
  total?: number;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface PageResponse<T = any> {
  list: T[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
}

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface TreeSelectOption extends SelectOption {
  children?: TreeSelectOption[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface StatusCount {
  status: string;
  count: number;
  label?: string;
}

export interface TimeSeriesPoint {
  time: string;
  value: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  module: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
  userAgent?: string;
  operateAt: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
