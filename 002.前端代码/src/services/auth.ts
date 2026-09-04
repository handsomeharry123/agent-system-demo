import type { User } from '../types/user';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  timestamp?: string;
}

export interface AuthResult {
  token: string;
  expiresAt: string;
  user: User;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  const responseText = await response.text();
  let body: ApiEnvelope<T> | undefined;

  if (responseText && contentType.includes('application/json')) {
    try {
      body = JSON.parse(responseText) as ApiEnvelope<T>;
    } catch {
      // Fall through to the protocol error below. Do not expose a JSON parser
      // exception to the login page when a proxy returns a malformed response.
    }
  }

  if (!response.ok) {
    const unavailable = response.status >= 500 && !body;
    throw new ApiError(
      body?.message || (unavailable ? '登录服务暂时不可用，请确认后端服务已启动' : `请求失败（${response.status}）`),
      response.status,
      body?.data,
    );
  }

  if (!body) throw new ApiError('服务端返回格式异常', response.status);
  return body.data;
};

export const authApi = {
  passwordLogin: (account: string, password: string) => request<AuthResult>('/api/auth/login/password', {
    method: 'POST', body: JSON.stringify({ account, password }),
  }),
  sendSmsCode: (phone: string) => request<{ expiresIn: number; developmentCode?: string }>('/api/auth/sms/send', {
    method: 'POST', body: JSON.stringify({ phone }),
  }),
  smsLogin: (phone: string, verificationCode: string) => request<AuthResult>('/api/auth/login/sms', {
    method: 'POST', body: JSON.stringify({ phone, verificationCode }),
  }),
  me: () => request<User>('/api/auth/me'),
  logout: () => request<null>('/api/auth/logout', { method: 'POST' }),
};
