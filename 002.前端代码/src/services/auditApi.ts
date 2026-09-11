import { mockRequest, mockPageRequest } from './api';
import { mockAuditLogs, type AuditLog, type OperationType, type OperationModule } from '../mock/audit';

export interface AuditLogParams {
  current?: number;
  pageSize?: number;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  operator?: string;
  operationType?: OperationType;
  module?: OperationModule;
  result?: '成功' | '失败';
}

export const getAuditLogs = async (params: AuditLogParams = {}) => {
  let filtered = [...mockAuditLogs];

  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.operator.toLowerCase().includes(keyword) ||
        log.operationObject.toLowerCase().includes(keyword) ||
        log.detail?.toLowerCase().includes(keyword)
    );
  }

  if (params.operator) {
    filtered = filtered.filter((log) => log.operator === params.operator);
  }

  if (params.operationType) {
    filtered = filtered.filter((log) => log.operationType === params.operationType);
  }

  if (params.module) {
    filtered = filtered.filter((log) => log.module === params.module);
  }

  if (params.result) {
    filtered = filtered.filter((log) => log.result === params.result);
  }

  if (params.startTime && params.endTime) {
    const start = new Date(params.startTime).getTime();
    const end = new Date(params.endTime).getTime();
    filtered = filtered.filter((log) => {
      const logTime = new Date(log.operationTime).getTime();
      return logTime >= start && logTime <= end;
    });
  }

  return mockPageRequest(filtered, params);
};

export const getAuditLogById = async (id: string) => {
  const log = mockAuditLogs.find((l) => l.id === id);
  if (!log) {
    throw new Error('审计日志不存在');
  }
  return mockRequest(log);
};

export const exportAuditLogs = async (params: AuditLogParams = {}) => {
  let filtered = [...mockAuditLogs];

  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.operator.toLowerCase().includes(keyword) ||
        log.operationObject.toLowerCase().includes(keyword)
    );
  }

  if (params.operator) {
    filtered = filtered.filter((log) => log.operator === params.operator);
  }

  if (params.operationType) {
    filtered = filtered.filter((log) => log.operationType === params.operationType);
  }

  if (params.module) {
    filtered = filtered.filter((log) => log.module === params.module);
  }

  if (params.result) {
    filtered = filtered.filter((log) => log.result === params.result);
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  return mockRequest({
    fileName: `审计日志_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`,
    recordCount: filtered.length,
    downloadUrl: '/api/audit/export/download',
  });
};
