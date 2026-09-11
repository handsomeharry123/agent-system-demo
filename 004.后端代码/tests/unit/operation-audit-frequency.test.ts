import type { Request } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRecentReadAudits,
  isDuplicateReadAudit,
  READ_DEDUPLICATION_WINDOW_MS,
  type OperationAuditInput,
} from '../../src/operation-audit.js';

const requestOf = (userId: number, method = 'GET') => ({
  method,
  originalUrl: '/api/example',
  auth: { userId },
} as unknown as Request);

const readOf = (moduleCode = 'AUDIT_CENTER', operationType = '查看'): OperationAuditInput => ({
  moduleCode,
  moduleName: '审计中心',
  operationType,
  description: '用户查看列表',
  result: 'SUCCESS',
});

afterEach(clearRecentReadAudits);

describe('操作日志查看频率控制', () => {
  it('同一用户、模块和类型在时间窗口内只保留第一条', () => {
    const req = requestOf(1);
    expect(isDuplicateReadAudit(req, readOf(), 1_000)).toBe(false);
    expect(isDuplicateReadAudit(req, { ...readOf(), description: '用户查看详情' }, 2_000)).toBe(true);
  });

  it('持续访问时按固定窗口采样，而不是无限期抑制', () => {
    const req = requestOf(1);
    expect(isDuplicateReadAudit(req, readOf(), 1_000)).toBe(false);
    expect(isDuplicateReadAudit(req, readOf(), 50_000)).toBe(true);
    expect(isDuplicateReadAudit(req, readOf(), 1_000 + READ_DEDUPLICATION_WINDOW_MS)).toBe(false);
  });

  it('用户、模块或操作类型不同时分别记录', () => {
    expect(isDuplicateReadAudit(requestOf(1), readOf(), 1_000)).toBe(false);
    expect(isDuplicateReadAudit(requestOf(2), readOf(), 2_000)).toBe(false);
    expect(isDuplicateReadAudit(requestOf(1), readOf('USER_CENTER'), 2_000)).toBe(false);
    expect(isDuplicateReadAudit(requestOf(1), readOf('AUDIT_CENTER', '刷新'), 2_000)).toBe(false);
  });

  it('写请求和失败请求不做频率限制', () => {
    expect(isDuplicateReadAudit(requestOf(1, 'POST'), readOf(), 1_000)).toBe(false);
    expect(isDuplicateReadAudit(requestOf(1), { ...readOf(), result: 'FAILED' }, 2_000)).toBe(false);
  });
});
