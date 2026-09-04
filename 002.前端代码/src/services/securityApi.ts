// 统一安全治理中心 - API 服务（Mock 占位）
// 对齐需求 v1.0：6 维风险大盘 + 检查项 + 告警事件 + 采集/规则
// 当前为 mock 占位实现；未来对接后端时，将本页 export 切换为真实 fetch/XHR，
// 三个页面（Overview/EventManage/RuleManage）即可由直接 import mock 改为调用本页 API。
import { mockRequest, mockPageRequest } from './api';
import type { ApiResponse } from '../types/common';
import {
  mockAlertEvents,
  mockAlertRules,
  mockCheckItems,
  securityScore,
  dimensionScores,
  getCheckItemsByDimension,
  getRulesByDimension,
  getCollectionConfigByDimension,
} from '../mock/security';
import type {
  AlertRule,
  CheckItem,
  CollectionConfig,
  DimensionScore,
  EventLevel,
  EventStatus,
  RuleLevel,
  SecurityAlertLevel,
  SecurityDimension,
  SecurityScore,
  CheckItemLevel,
  CheckItemResult,
} from '../types/security';

// ========== 8-1 风险大盘 ==========

export const getSecurityScore = async (): Promise<ApiResponse<SecurityScore>> => {
  return mockRequest(securityScore);
};

export const getDimensionScores = async (): Promise<ApiResponse<DimensionScore[]>> => {
  return mockRequest(dimensionScores);
};

// ========== 8-1 检查项 ==========

export const getCheckItems = async (params?: {
  dimension?: SecurityDimension;
  keyword?: string;
  level?: CheckItemLevel;
  result?: CheckItemResult;
  current?: number;
  pageSize?: number;
}): Promise<ApiResponse<{
  list: CheckItem[];
  pagination: { current: number; pageSize: number; total: number };
}>> => {
  let list = params?.dimension ? getCheckItemsByDimension(params.dimension) : [...mockCheckItems];
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(kw));
  }
  if (params?.level) list = list.filter((c) => c.level === params.level);
  if (params?.result) list = list.filter((c) => c.result === params.result);
  return mockPageRequest(list, params);
};

// ========== 8-2 告警事件 ==========

export const getAlertEvents = async (params?: {
  dimension?: SecurityDimension;
  level?: EventLevel;
  status?: EventStatus;
  keyword?: string;
  current?: number;
  pageSize?: number;
}): Promise<ApiResponse<{
  list: typeof mockAlertEvents;
  pagination: { current: number; pageSize: number; total: number };
}>> => {
  let list = [...mockAlertEvents];
  if (params?.dimension) list = list.filter((e) => e.dimension === params.dimension);
  if (params?.level) list = list.filter((e) => e.level === params.level);
  if (params?.status) list = list.filter((e) => e.status === params.status);
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    list = list.filter(
      (e) => e.title.toLowerCase().includes(kw) || e.id.toLowerCase().includes(kw),
    );
  }
  return mockPageRequest(list, params);
};

// ========== 8-3 采集配置 / 告警规则 ==========

export const getCollectionConfig = async (
  dim: SecurityDimension,
): Promise<ApiResponse<CollectionConfig | undefined>> => {
  return mockRequest(getCollectionConfigByDimension(dim));
};

export const getAlertRules = async (params?: {
  dimension?: SecurityDimension;
  keyword?: string;
  level?: SecurityAlertLevel;
  enabled?: boolean;
  current?: number;
  pageSize?: number;
}): Promise<ApiResponse<{
  list: AlertRule[];
  pagination: { current: number; pageSize: number; total: number };
}>> => {
  let list = params?.dimension ? getRulesByDimension(params.dimension) : [...mockAlertRules];
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    list = list.filter((r) => r.name.toLowerCase().includes(kw));
  }
  if (params?.level) list = list.filter((r) => r.level === params.level);
  if (params?.enabled !== undefined) list = list.filter((r) => r.enabled === params.enabled);
  return mockPageRequest(list, params);
};
