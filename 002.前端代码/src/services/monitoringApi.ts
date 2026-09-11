import { mockRequest, mockPageRequest } from './api';
import {
  mockMonitoringMetrics,
  mockAgentMonitoringData,
  mockAlertEvents,
  mockAlertProcessingRecords,
  mockBusinessMetrics,
  mockAgentCostDetails,
  mockDailyCosts,
  mockDepartmentCosts,
  type MonitoringMetric,
  type AgentMonitoringData,
  type AlertEvent,
  type AlertStatus,
  type MonitorDimension,
  type BusinessMetric,
  type AgentCostDetail,
  type DailyCost,
} from '../mock/monitoring';

export const getMonitoringMetrics = async (type?: MonitoringMetric['type']) => {
  if (type) {
    return mockRequest(mockMonitoringMetrics.filter((m) => m.type === type));
  }
  return mockRequest(mockMonitoringMetrics);
};

export const getMetricById = async (id: string) => {
  const metric = mockMonitoringMetrics.find((m) => m.id === id);
  if (!metric) {
    throw new Error('指标不存在');
  }
  return mockRequest(metric);
};

export const getAgentMonitoringData = async (params?: {
  department?: string;
  agentId?: string;
  current?: number;
  pageSize?: number;
}) => {
  let filtered = [...mockAgentMonitoringData];

  if (params?.department) {
    filtered = filtered.filter((a) => a.department === params.department);
  }

  if (params?.agentId) {
    filtered = filtered.filter((a) => a.agentId === params.agentId);
  }

  return mockPageRequest(filtered, { current: params?.current, pageSize: params?.pageSize });
};

export const getAlertEvents = async (params?: {
  level?: AlertEvent['level'];
  status?: AlertStatus;
  dimension?: MonitorDimension;
  acknowledged?: boolean;
  current?: number;
  pageSize?: number;
}) => {
  let filtered = [...mockAlertEvents];

  if (params?.level) {
    filtered = filtered.filter((a) => a.level === params.level);
  }

  if (params?.status) {
    filtered = filtered.filter((a) => a.status === params.status);
  }

  if (params?.dimension) {
    filtered = filtered.filter((a) => a.dimension === params.dimension);
  }

  if (params?.acknowledged !== undefined) {
    filtered = filtered.filter((a) => a.acknowledged === params.acknowledged);
  }

  return mockPageRequest(filtered, params);
};

export const getAlertById = async (id: string) => {
  const alert = mockAlertEvents.find((a) => a.id === id);
  if (!alert) {
    throw new Error('告警不存在');
  }
  return mockRequest(alert);
};

export const acknowledgeAlert = async (id: string, operator: string) => {
  const alert = mockAlertEvents.find((a) => a.id === id);
  if (!alert) {
    throw new Error('告警不存在');
  }
  alert.acknowledged = true;
  alert.acknowledgedBy = operator;
  alert.acknowledgedAt = new Date().toLocaleString('zh-CN');
  return mockRequest({ success: true });
};

export const updateAlertStatus = async (id: string, status: AlertStatus, handler?: string, remark?: string) => {
  const alert = mockAlertEvents.find((a) => a.id === id);
  if (!alert) {
    throw new Error('告警不存在');
  }
  alert.status = status;
  if (handler) alert.handler = handler;
  if (remark) alert.handleRemark = remark;
  return mockRequest({ success: true });
};

export const getAlertProcessingRecords = async (alertId: string) => {
  const records = mockAlertProcessingRecords.filter((r) => r.alertId === alertId);
  return mockRequest(records);
};

export const getBusinessMetrics = async () => {
  return mockRequest(mockBusinessMetrics);
};

export const getPerformanceTrend = async (agentId: string, hours: number = 24) => {
  const baseResponseTime = 150 + Math.random() * 100;
  const trend = Array.from({ length: hours }, (_, i) => {
    const now = new Date();
    const time = new Date(now.getTime() - (hours - i) * 3600000);
    return {
      timestamp: time.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      avgResponseTime: Math.round(baseResponseTime + (Math.random() - 0.5) * 50),
      p99ResponseTime: Math.round((baseResponseTime + 200) + (Math.random() - 0.5) * 100),
      successRate: Math.round((98 + Math.random() * 2) * 100) / 100,
      throughput: Math.round(100 + Math.random() * 50),
    };
  });
  return mockRequest(trend);
};

export const getResponseTimeDistribution = async (agentId: string) => {
  const distribution = [
    { range: '<100ms', count: Math.round(300 + Math.random() * 100) },
    { range: '100-300ms', count: Math.round(500 + Math.random() * 150) },
    { range: '300-500ms', count: Math.round(300 + Math.random() * 100) },
    { range: '500-1000ms', count: Math.round(150 + Math.random() * 80) },
    { range: '1-3s', count: Math.round(50 + Math.random() * 30) },
    { range: '>3s', count: Math.round(10 + Math.random() * 10) },
  ];
  return mockRequest(distribution);
};

export const getDepartmentSummary = async () => {
  const departments = ['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '体检科'];
  return mockRequest(
    departments.map((dept) => {
      const agents = mockAgentMonitoringData.filter((a) => a.department === dept);
      const avgSuccessRate = agents.length
        ? agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length
        : 0;
      return {
        department: dept,
        agentCount: agents.length || Math.round(2 + Math.random() * 3),
        avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
        totalThroughput: agents.reduce((sum, a) => sum + a.throughput, 0) || Math.round(200 + Math.random() * 500),
      };
    })
  );
};

export const getAgentCostDetails = async (params?: {
  department?: string;
  current?: number;
  pageSize?: number;
}) => {
  let filtered = [...mockAgentCostDetails];

  if (params?.department) {
    filtered = filtered.filter((a) => a.department === params.department);
  }

  return mockPageRequest(filtered, { current: params?.current, pageSize: params?.pageSize });
};

export const getDailyCosts = async (days: number = 30) => {
  return mockRequest(mockDailyCosts.slice(-days));
};

export const getDepartmentCosts = async () => {
  return mockRequest(mockDepartmentCosts);
};

export const getCostSummary = async () => {
  const totalCost = mockAgentCostDetails.reduce((sum, a) => sum + a.totalCost, 0);
  const totalCallCount = mockAgentCostDetails.reduce((sum, a) => sum + a.callCount, 0);
  const totalTokenConsumption = mockAgentCostDetails.reduce((sum, a) => sum + a.tokenConsumption, 0);
  return mockRequest({
    totalCost,
    totalCallCount,
    totalTokenConsumption,
    avgDailyCost: totalCost / 30,
  });
};