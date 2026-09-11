import type { UserRole } from '../types/user';
import { ApiError } from './auth';

export type AccountStatus = '正常' | '停用';
export interface CenterUser {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  phone: string;
  roles: UserRole[];
  dataScope: '全院数据' | '本科室数据';
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserFilters {
  userId?: string;
  departmentId?: number;
  role?: UserRole;
  status?: AccountStatus;
}

export interface UserFormPayload {
  name: string;
  employeeId: string;
  departmentId: number;
  phone: string;
  roles: UserRole[];
  /** 编辑时留空表示保持原密码；网络和数据库均不回传原密码或哈希。 */
  password?: string;
  status?: AccountStatus;
}

interface Envelope<T> { code: number; message: string; data: T }
const tokenHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` });
const queryString = (params: object) => {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return query.toString();
};
const jsonRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...tokenHeaders(), ...init?.headers },
  });
  const body = await response.json() as Envelope<T>;
  if (!response.ok) throw new ApiError(body.message, response.status, body.data);
  return body.data;
};

export const userCenterApi = {
  list: (params: UserFilters & { current: number; pageSize: number }) =>
    jsonRequest<{ list: CenterUser[]; pagination: { current: number; pageSize: number; total: number } }>(`/api/users?${queryString(params)}`),
  meta: () => jsonRequest<{ departments: Array<{ label: string; value: number }>; roles: Array<{ label: string; value: UserRole }> }>('/api/users/meta'),
  options: (keyword = '') => jsonRequest<Array<{ label: string; value: string }>>(`/api/users/options?${queryString({ keyword })}`),
  detail: (id: string) => jsonRequest<UserFormPayload & { id: string }>(`/api/users/${id}`),
  create: (payload: UserFormPayload) => jsonRequest<{ id: number; initialPassword: string }>('/api/users', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  update: (id: string, payload: UserFormPayload) => jsonRequest<null>(`/api/users/${id}`, {
    method: 'PUT', body: JSON.stringify(payload),
  }),
  updateStatus: (id: string, status: AccountStatus) => jsonRequest<null>(`/api/users/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  }),
  remove: (id: string) => jsonRequest<{ detachedRoles: number; detachedDataPolicies: number }>(`/api/users/${id}`, {
    method: 'DELETE',
  }),
  batchStatus: (status: AccountStatus, ids: string[], filters: UserFilters) => jsonRequest<{ affected: number }>('/api/users/batch-status', {
    method: 'PATCH', body: JSON.stringify({ status, ids, ...filters }),
  }),
  exportCsv: async (filters: UserFilters) => {
    const response = await fetch(`/api/users/export/csv?${queryString(filters)}`, { headers: tokenHeaders() });
    if (!response.ok) {
      const body = await response.json() as Envelope<unknown>;
      throw new ApiError(body.message, response.status, body.data);
    }
    return response.blob();
  },
};
