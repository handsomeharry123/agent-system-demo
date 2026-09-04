import { ApiError } from './auth';

export type RoleStatus = '启用' | '停用';
export type DataRange = '全院智能体' | '本科室智能体' | '指定科室智能体' | '指定智能体';
export interface RoleItem {
  id: string; name: string; description: string; userCount: number; dataRange: DataRange;
  functionCount: number; status: RoleStatus; isSystem: boolean; createdAt: string; updatedAt: string;
}
export interface RoleDetail extends RoleItem {
  departmentIds: number[]; agentIds: number[]; dataRangeItems: string[]; permissions: string[]; permissionCodes: string[];
}
export interface RolePayload {
  name: string; description: string; dataRange: DataRange; departmentIds?: number[]; agentIds?: number[]; status: RoleStatus;
}
interface Envelope<T> { code: number; message: string; data: T }
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`, ...init?.headers } });
  const body = await response.json() as Envelope<T>;
  if (!response.ok) throw new ApiError(body.message, response.status, body.data);
  return body.data;
};
export const roleCenterApi = {
  list: () => request<RoleItem[]>('/api/roles'),
  detail: (id: string) => request<RoleDetail>(`/api/roles/${id}`),
  meta: () => request<{ departments: Array<{ label: string; value: number }>; agents: Array<{ label: string; value: number }> }>('/api/roles/meta'),
  create: (payload: RolePayload) => request<{ id: string; name: string }>('/api/roles', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: RolePayload) => request<null>(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string) => request<{ detachedUsers: number; detachedPolicies: number; detachedPermissions: number }>(`/api/roles/${id}`, { method: 'DELETE' }),
};
