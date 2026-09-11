import type { AccessRecord } from '../pages/agent-center/types';

interface Envelope<T> { code: number; message: string; data: T }
export interface ConnectionTestResult {
  ok: boolean; message: string; latencyMs: number; httpStatus?: number; errorCode?: string; failureStage?: string;
  resolvedEndpoint?: string; endpointAdjusted?: boolean;
  resolvedModel?: string; modelDiscovered?: boolean; modelCorrected?: boolean; modelsEndpoint?: string; authScheme?: 'bearer' | 'x-api-key' | 'api-key';
  stages: Array<{ stage: string; label: string; status: string; latencyMs?: number; errorCode?: string; errorReason?: string }>;
}
export class AgentAccessApiError extends Error { constructor(message: string, public status: number) { super(message); } }

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`,
      ...init?.headers,
    },
  });
  const raw = await response.text();
  let body: Envelope<T> | undefined;
  if (raw) {
    try { body = JSON.parse(raw) as Envelope<T>; } catch { /* 上游可能返回非 JSON 错误页 */ }
  }
  if (!response.ok) {
    throw new AgentAccessApiError(body?.message || `服务请求失败（HTTP ${response.status}）`, response.status);
  }
  if (!body) throw new AgentAccessApiError('服务返回数据异常，请稍后重试', response.status);
  return body.data;
};

export const agentAccessApi = {
  meta: () => request<{
    departments: Array<{ value: number; label: string; code: string }>;
    clinicalStages: Array<{ label: string; code: string }>;
  }>('/api/agent-access/meta'),
  list: () => request<AccessRecord[]>('/api/agent-access/applications'),
  detail: (id: string) => request<AccessRecord>(`/api/agent-access/applications/${id}`),
  save: (record: AccessRecord) => request<AccessRecord>('/api/agent-access/applications/save', { method: 'POST', body: JSON.stringify(record) }),
  submit: (record: AccessRecord) => request<AccessRecord>('/api/agent-access/applications/submit', { method: 'POST', body: JSON.stringify(record) }),
  remove: (id: string) => request<null>(`/api/agent-access/applications/${id}`, { method: 'DELETE' }),
  withdraw: (id: string, reason = '申请人主动撤销') => request<null>(`/api/agent-access/applications/${id}/withdraw`, { method: 'POST', body: JSON.stringify({ reason }) }),
  startReview: (id: string) => request<null>(`/api/agent-access/applications/${id}/start-review`, { method: 'POST', body: '{}' }),
  review: (id: string, result: 'APPROVED' | 'RETURNED', comment?: string) => request<null>(`/api/agent-access/applications/${id}/review`, { method: 'POST', body: JSON.stringify({ result, comment }) }),
  testConnection: (values: Record<string, unknown>, signal?: AbortSignal) => request<ConnectionTestResult>('/api/agent-access/connection-test', { method: 'POST', body: JSON.stringify(values), signal }),
  reviewConnectionTest: (id: string) => request<ConnectionTestResult & { testId: number }>(`/api/agent-access/applications/${id}/connection-test`, { method: 'POST', body: '{}' }),
  issueInstrumentation: (accessMode: 'SDK' | 'OTEL', agentCode?: string) => request<{ platformUrl: string; platformKey: string; instrumentationCode: string; issuedAt: string }>('/api/agent-access/instrumentation/issue', { method: 'POST', body: JSON.stringify({ accessMode, agentCode }) }),
  uploadFile: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    const response = await fetch('/api/agent-access/files', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` }, body: form });
    const body = await response.json() as Envelope<{ fileUuid: string; name: string; sizeBytes: number; url: string }>;
    if (!response.ok) throw new AgentAccessApiError(body.message || '文件上传失败', response.status);
    return body.data;
  },
  fetchFile: async (url: string) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: '文件读取失败' })) as { message?: string };
      throw new AgentAccessApiError(body.message || '文件读取失败', response.status);
    }
    return response.blob();
  },
};
