import type { ApiResponse, PageResponse } from '../types/common';

const DEFAULT_DELAY = 300;
const MIN_DELAY = 100;
const MAX_DELAY = 800;

const randomDelay = (base?: number) => {
  const delay = base ?? DEFAULT_DELAY;
  return new Promise((resolve) =>
    setTimeout(resolve, delay + Math.random() * (MAX_DELAY - MIN_DELAY))
  );
};

export const mockRequest = async <T>(
  data: T,
  delay?: number
): Promise<ApiResponse<T>> => {
  await randomDelay(delay);

  return {
    code: 200,
    message: 'success',
    data,
    timestamp: new Date().toISOString(),
  };
};

export const mockPageRequest = async <T>(
  list: T[],
  params: { current?: number; pageSize?: number } = {}
): Promise<ApiResponse<PageResponse<T>>> => {
  await randomDelay();

  const { current = 1, pageSize = 10 } = params;
  const start = (current - 1) * pageSize;
  const end = start + pageSize;

  return {
    code: 200,
    message: 'success',
    data: {
      list: list.slice(start, end),
      pagination: {
        current,
        pageSize,
        total: list.length,
      },
    },
    timestamp: new Date().toISOString(),
  };
};

export const mockErrorRequest = async <T>(
  message: string,
  code: number = 500
): Promise<ApiResponse<T>> => {
  await randomDelay(200);

  return {
    code,
    message,
    data: null as any,
    timestamp: new Date().toISOString(),
  };
};

export const mockBatchRequest = async <T>(
  items: { key: string; data: T; delay?: number }[]
): Promise<ApiResponse<Record<string, T>>> => {
  await Promise.all(items.map((item) => randomDelay(item.delay)));

  const result: Record<string, T> = {};
  items.forEach((item) => {
    result[item.key] = item.data;
  });

  return {
    code: 200,
    message: 'success',
    data: result,
    timestamp: new Date().toISOString(),
  };
};

export const requestWithAuth = async <T>(
  data: T,
  token?: string
): Promise<ApiResponse<T>> => {
  if (!token) {
    return mockErrorRequest('未授权，请重新登录', 401);
  }
  return mockRequest(data);
};

export const requestWithRole = async <T>(
  data: T,
  requiredRoles: string[]
): Promise<ApiResponse<T>> => {
  await randomDelay();
  return {
    code: 200,
    message: 'success',
    data,
    timestamp: new Date().toISOString(),
  };
};
