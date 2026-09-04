import { ApiError } from './auth';

export interface PermissionRole { id: string; name: string; status: '启用' | '停用' }
interface Envelope<T> { code: number; message: string; data: T }
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`, ...init?.headers } });
  const body = await response.json() as Envelope<T>;
  if (!response.ok) throw new ApiError(body.message, response.status, body.data);
  return body.data;
};
export const permissionApi = {
  roles: () => request<PermissionRole[]>('/api/permissions/roles'),
  get: (roleId: string) => request<{ permissionCodes: string[]; count: number }>(`/api/permissions/roles/${roleId}`),
  save: (roleId: string, permissionCodes: string[]) => request<{ count: number }>(`/api/permissions/roles/${roleId}`, { method: 'PUT', body: JSON.stringify({ permissionCodes }) }),
};
