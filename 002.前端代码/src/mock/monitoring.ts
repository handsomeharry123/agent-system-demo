import type { AgentType } from '../types/agent';

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface MonitoringMetric {
  id: string;
  name: string;
  type: 'performance' | 'runStatus' | 'business' | 'cost';
  unit: string;
  current: number;
  previous: number;
  change: number;
  trend: TimeSeriesPoint[];
}

export interface AgentMonitoringData {
  agentId: string;
  agentName: string;
  department: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  throughput: number;
  errorCount: number;
  lastRequestTime: string;
  /** v1.4: 错误率 0-1 */
  errorRate: number;
  /** v1.4: 回答准确率 0-1 */
  accuracy: number;
  /** v1.4: 工具调用失败率 0-1 */
  toolFailRate: number;
  /** v1.4: 循环超限率 0-1 */
  loopExceedRate: number;
}

// 告警级别
export type AlertLevel = 'severe' | 'warning' | 'info';
// 告警级别标签
export const AlertLevelLabels: Record<AlertLevel, string> = {
  severe: '严重',
  warning: '警告',
  info: '提示',
};
// 告警级别颜色
export const AlertLevelColors: Record<AlertLevel, string> = {
  severe: 'error',
  warning: 'warning',
  info: 'processing',
};

// 监控维度
export type MonitorDimension = 'business' | 'performance' | 'status' | 'cost';
// 监控维度标签
export const MonitorDimensionLabels: Record<MonitorDimension, string> = {
  business: '业务',
  performance: '性能',
  status: '状态',
  cost: '成本',
};

// 告警状态: 待处理/处理中/已恢复/已忽略 (由治理中心承载)
export type AlertStatus = 'pending' | 'processing' | 'resolved' | 'ignored';
export const AlertStatusLabels: Record<AlertStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已恢复',
  ignored: '已忽略',
};
export const AlertStatusColors: Record<AlertStatus, string> = {
  pending: 'error',
  processing: 'processing',
  resolved: 'success',
  ignored: 'default',
};

// 告警规则接口
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  level: AlertLevel;
  dimension: MonitorDimension;
  metricKey: string;
  metricName: string;
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'p95' | 'p99' | 'count' | 'ratio';
  windowMinutes: number;
  scope: { type: 'all' | 'department' | 'agent'; departments?: string[]; agents?: string[] };
  filters: Array<{ field: string; operator: string; value: string }>;
  trigger: { operator: '>' | '>=' | '<' | '<=' | '=' | '!='; threshold: number; unit: string };
  continuousHits: number;
  silentMinutes: number;
  autoRecovery: { enabled: boolean; windowCount: number };
  remediation?: {
    possibleCauses: string[];
    actions: string[];
  };
  notification: {
    channels: ('station' | 'sms' | 'email')[];
    targets: string[];
    templateId: string;
    rateLimitPerHour?: number;
    quietHours?: { start: string; end: string };
    escalation?: { condition: string; targets: string[] };
  };
  owner: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  trigger7d: number;
}

// 告警事件接口 (上报治理中心负载)
export interface AlertEvent {
  id: string;
  eventId: string;
  ruleId: string;
  ruleName: string;
  agentId: string;
  agentName: string;
  department: string;
  dimension: MonitorDimension;
  level: AlertLevel;
  status: AlertStatus;
  metric: {
    key: string;
    value: number;
    unit: string;
    threshold: number;
    operator: string;
  };
  window: { startAt: string; endAt: string };
  continuousHits: number;
  remediation?: {
    possibleCauses: string[];
    actions: string[];
  };
  timestamp: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  handler?: string;
  handleTime?: string;
  handleRemark?: string;
}

// -----------------------------------------------------------------------------
// V1.6 告警事件处置（8-5）专用模型：详情抽屉 13 字段、可能原因↔处置动作一一对应
// -----------------------------------------------------------------------------
export type IncidentStatus = 'pending' | 'processing' | 'closed' | 'ignored';
export const IncidentStatusLabels: Record<IncidentStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  closed: '已关闭',
  ignored: '已忽略',
};
export const IncidentStatusColors: Record<IncidentStatus, string> = {
  pending: 'error',
  processing: 'warning',
  closed: 'success',
  ignored: 'default',
};

export interface IncidentCauseAction {
  /** 序号（1-based），触发时按序号成对带入详情抽屉 */
  order: number;
  /** 可能原因 */
  cause: string;
  /** 处置动作（与 cause 一一对应） */
  action: string;
}

export interface IncidentOwner {
  userId: string;
  name: string;
  department: string;
}

export interface IncidentTimelineEntry {
  id: string;
  /** 动作类型 */
  action: '开始处置' | '标记已关闭' | '忽略事件' | '转交' | '系统触发' | '自动恢复' | '编辑';
  operator: string;
  operatorId?: string;
  timestamp: string;
  /** 处置说明全文 */
  remark?: string;
  /** 是否采纳处置建议（关闭时） */
  adoption?: '是' | '否' | '部分';
  /** 转交对象（仅转交动作） */
  transferredTo?: string;
  /** 状态变更：变更前 → 变更后 */
  statusFrom?: IncidentStatus;
  statusTo?: IncidentStatus;
}

export interface AlertIncident {
  id: string;
  eventId: string;
  /** V1.6 自动命名：「规则名 - 监测对象 - yyyymmddhhmmss」 */
  title: string;
  sourceDimension: '应用';
  level: AlertLevel;
  ruleId: string;
  ruleName: string;
  /** 监测对象：智能体（可下钻台账） */
  target: {
    agentId: string;
    name: string;
    department: string;
  };
  /** 触发条件：运算符 + 阈值 + 实际值 */
  trigger: string;
  /** 关联对象：会话 / 工单 / 日志 */
  relatedObject?: { type: 'session' | 'ticket' | 'log'; id: string; label?: string };
  discoveredAt: string;
  status: IncidentStatus;
  owner: IncidentOwner;
  /** 可能原因 ↔ 处置动作（一组一对应） */
  remediationPairs: IncidentCauseAction[];
  /** 处置记录（时间线） */
  timeline: IncidentTimelineEntry[];
  /** 审计中心索引（处置后写入） */
  audited: boolean;
}

// 兼容旧代码的别名
export type AlertType = MonitorDimension;

export interface AlertProcessingRecord {
  id: string;
  alertId: string;
  action: '创建' | '确认' | '处理中' | '已处理' | '已忽略' | '转派';
  operator: string;
  timestamp: string;
  remark?: string;
}

export interface AgentCostDetail {
  agentId: string;
  agentName: string;
  department: string;
  callCount: number;
  tokenConsumption: number;
  computeCost: number;
  storageCost: number;
  networkCost: number;
  apiCost: number;
  totalCost: number;
  /** v1.4: 算力明细 (核·h / 卡·h) */
  cpuCoreHours: number;
  gpuCardHours: number;
  /** v1.4: 存储用量 (GB·月) */
  storageGbMonth: number;
  /** v1.4: 出向流量 (GB) */
  egressGb: number;
  /** v1.4: 单次调用 Token */
  tokenPerCall: number;
  /** v1.4: 实例闲置率 */
  idleRate: number;
  /** v1.4: 环比变化（待单价启用前展示为 null） */
  amount: number | null;
}

export interface DailyCost {
  date: string;
  computeCost: number;
  storageCost: number;
  networkCost: number;
  apiCost: number;
  totalCost: number;
}

export interface BusinessMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: TimeSeriesPoint[];
}

export interface CostMetric {
  id: string;
  category: '计算' | '存储' | '网络' | 'API调用';
  amount: number;
  unit: string;
  currency: string;
  trend: TimeSeriesPoint[];
}

const generateTrend = (base: number, volatility: number, points: number = 24): TimeSeriesPoint[] => {
  const now = new Date();
  const trend: TimeSeriesPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000);
    const value = base + (Math.random() - 0.5) * volatility * 2;
    trend.push({
      timestamp: time.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      value: Math.max(0, Math.round(value * 100) / 100),
    });
  }
  return trend;
};

const generateDailyTrend = (base: number, volatility: number, points: number = 7): TimeSeriesPoint[] => {
  const trend: TimeSeriesPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const value = base + (Math.random() - 0.5) * volatility * 2;
    trend.push({
      timestamp: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      value: Math.max(0, Math.round(value * 100) / 100),
    });
  }
  return trend;
};

export const mockMonitoringMetrics: MonitoringMetric[] = [
  {
    id: 'avg-response-time',
    name: '平均响应时长',
    type: 'performance',
    unit: 'ms',
    current: 186,
    previous: 203,
    change: -8.4,
    trend: generateTrend(190, 30),
  },
  {
    id: 'p99-response-time',
    name: 'P99 响应时长',
    type: 'performance',
    unit: 'ms',
    current: 450,
    previous: 520,
    change: -13.5,
    trend: generateTrend(460, 80),
  },
  {
    id: 'success-rate',
    name: '成功率',
    type: 'performance',
    unit: '%',
    current: 99.2,
    previous: 98.7,
    change: 0.5,
    trend: generateTrend(99, 1),
  },
  {
    id: 'throughput',
    name: '吞吐量',
    type: 'performance',
    unit: 'req/s',
    current: 1250,
    previous: 1180,
    change: 5.9,
    trend: generateTrend(1200, 200),
  },
  {
    id: 'online-agents',
    name: '在线智能体',
    type: 'runStatus',
    unit: '个',
    current: 24,
    previous: 22,
    change: 9.1,
    trend: generateTrend(23, 3),
  },
  {
    id: 'offline-agents',
    name: '离线智能体',
    type: 'runStatus',
    unit: '个',
    current: 2,
    previous: 4,
    change: -50,
    trend: generateTrend(3, 2),
  },
  {
    id: 'anomaly-agents',
    name: '异常智能体',
    type: 'runStatus',
    unit: '个',
    current: 1,
    previous: 0,
    change: 100,
    trend: generateTrend(0.5, 1),
  },
  {
    id: 'triage-count',
    name: '分诊次数',
    type: 'business',
    unit: '次',
    current: 8560,
    previous: 7920,
    change: 8.1,
    trend: generateTrend(8000, 1000),
  },
  {
    id: 'diagnosis-count',
    name: '诊断次数',
    type: 'business',
    unit: '次',
    current: 4280,
    previous: 3950,
    change: 8.4,
    trend: generateTrend(4000, 500),
  },
  {
    id: 'prescription-count',
    name: '处方审核次数',
    type: 'business',
    unit: '次',
    current: 12560,
    previous: 11800,
    change: 6.4,
    trend: generateTrend(12000, 800),
  },
  {
    id: 'report-count',
    name: '报告生成次数',
    type: 'business',
    unit: '次',
    current: 3200,
    previous: 2900,
    change: 10.3,
    trend: generateTrend(3000, 400),
  },
  {
    id: 'compute-cost',
    name: '计算成本',
    type: 'cost',
    unit: '元',
    current: 125680,
    previous: 118500,
    change: 6.1,
    trend: generateDailyTrend(120000, 10000),
  },
  {
    id: 'storage-cost',
    name: '存储成本',
    type: 'cost',
    unit: '元',
    current: 45680,
    previous: 43200,
    change: 5.7,
    trend: generateDailyTrend(44000, 3000),
  },
  {
    id: 'network-cost',
    name: '网络成本',
    type: 'cost',
    unit: '元',
    current: 23450,
    previous: 22100,
    change: 6.1,
    trend: generateDailyTrend(23000, 2000),
  },
  {
    id: 'api-cost',
    name: 'API调用成本',
    type: 'cost',
    unit: '元',
    current: 89200,
    previous: 84500,
    change: 5.6,
    trend: generateDailyTrend(86000, 5000),
  },
];

export const mockAgentMonitoringData: AgentMonitoringData[] = [
  {
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    avgResponseTime: 156,
    p95ResponseTime: 280,
    p99ResponseTime: 380,
    successRate: 99.5,
    throughput: 320,
    errorCount: 3,
    lastRequestTime: '2026-05-20 10:45:30',
    errorRate: 0.5,
    accuracy: 97.2,
    toolFailRate: 0.6,
    loopExceedRate: 0.2,
  },
  {
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    avgResponseTime: 2450,
    p95ResponseTime: 4800,
    p99ResponseTime: 5800,
    successRate: 98.2,
    throughput: 45,
    errorCount: 12,
    lastRequestTime: '2026-05-20 10:44:15',
    errorRate: 0.62,
    accuracy: 96.5,
    toolFailRate: 1.8,
    loopExceedRate: 1.2,
  },
  {
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    department: '医务科',
    avgResponseTime: 890,
    p95ResponseTime: 1620,
    p99ResponseTime: 2100,
    successRate: 99.8,
    throughput: 180,
    errorCount: 1,
    lastRequestTime: '2026-05-20 10:43:00',
    errorRate: 0.2,
    accuracy: 96.8,
    toolFailRate: 0.4,
    loopExceedRate: 0.6,
  },
  {
    agentId: 'agent-004',
    agentName: '处方智能审核与用药安全系统',
    department: '药剂科',
    avgResponseTime: 125,
    p95ResponseTime: 220,
    p99ResponseTime: 280,
    successRate: 99.9,
    throughput: 520,
    errorCount: 2,
    lastRequestTime: '2026-05-20 10:45:50',
    errorRate: 0.1,
    accuracy: 99.2,
    toolFailRate: 0.2,
    loopExceedRate: 0.1,
  },
  {
    agentId: 'agent-005',
    agentName: '智能导诊与分诊系统',
    department: '急诊科',
    avgResponseTime: 95,
    p95ResponseTime: 180,
    p99ResponseTime: 220,
    successRate: 99.6,
    throughput: 680,
    errorCount: 5,
    lastRequestTime: '2026-05-20 10:45:55',
    errorRate: 0.4,
    accuracy: 95.8,
    toolFailRate: 0.5,
    loopExceedRate: 0.3,
  },
  {
    agentId: 'agent-006',
    agentName: '智能问诊系统',
    department: '内科',
    avgResponseTime: 320,
    p95ResponseTime: 580,
    p99ResponseTime: 750,
    successRate: 98.9,
    throughput: 240,
    errorCount: 8,
    lastRequestTime: '2026-05-20 10:42:30',
    errorRate: 0.48,
    accuracy: 94.2,
    toolFailRate: 1.5,
    loopExceedRate: 0.8,
  },
];

// Mock 告警规则
export const mockAlertRules: AlertRule[] = [
  {
    id: 'rule-001',
    name: 'P95 响应时延异常',
    description: '全院智能体 P95 响应时延超过 5s 触发严重告警',
    level: 'severe',
    dimension: 'performance',
    metricKey: 'p95_response_time',
    metricName: 'P95 响应时长',
    aggregation: 'p95',
    windowMinutes: 5,
    scope: { type: 'all' },
    filters: [],
    trigger: { operator: '>', threshold: 5000, unit: 'ms' },
    continuousHits: 2,
    silentMinutes: 30,
    autoRecovery: { enabled: true, windowCount: 2 },
    remediation: {
      possibleCauses: ['底座模型限流', '工具调用超时', '实例资源不足'],
      actions: ['检查接入中心日志', '扩容实例', '切换备用模型'],
    },
    notification: {
      channels: ['station', 'sms'],
      targets: ['it_admin', 'rule_owner'],
      templateId: 'tpl_severe',
      rateLimitPerHour: 6,
    },
    owner: '张明',
    enabled: true,
    createdAt: '2026-05-01T10:00:00+08:00',
    updatedAt: '2026-05-01T10:00:00+08:00',
    lastTriggeredAt: '2026-05-30T15:23:11+08:00',
    trigger7d: 8,
  },
  {
    id: 'rule-002',
    name: '服务可用率低于 99.9%',
    description: '智能体服务可用率低于 99.9% 触发警告',
    level: 'warning',
    dimension: 'performance',
    metricKey: 'availability',
    metricName: '服务可用率',
    aggregation: 'avg',
    windowMinutes: 60,
    scope: { type: 'all' },
    filters: [],
    trigger: { operator: '<', threshold: 99.9, unit: '%' },
    continuousHits: 1,
    silentMinutes: 30,
    autoRecovery: { enabled: true, windowCount: 3 },
    notification: {
      channels: ['station'],
      targets: ['it_admin'],
      templateId: 'tpl_warning',
    },
    owner: '李华',
    enabled: true,
    createdAt: '2026-05-05T14:30:00+08:00',
    updatedAt: '2026-05-05T14:30:00+08:00',
    lastTriggeredAt: '2026-05-28T08:15:00+08:00',
    trigger7d: 3,
  },
  {
    id: 'rule-003',
    name: '智能体离线告警',
    description: '智能体连续 3 分钟未响应心跳视为离线',
    level: 'severe',
    dimension: 'status',
    metricKey: 'heartbeat_success_rate',
    metricName: '心跳成功率',
    aggregation: 'min',
    windowMinutes: 3,
    scope: { type: 'all' },
    filters: [],
    trigger: { operator: '<', threshold: 0, unit: '%' },
    continuousHits: 1,
    silentMinutes: 0,
    autoRecovery: { enabled: false, windowCount: 0 },
    notification: {
      channels: ['station', 'sms'],
      targets: ['it_admin'],
      templateId: 'tpl_severe',
    },
    owner: '王芳',
    enabled: true,
    createdAt: '2026-04-20T09:00:00+08:00',
    updatedAt: '2026-04-20T09:00:00+08:00',
    lastTriggeredAt: '2026-05-25T16:45:00+08:00',
    trigger7d: 2,
  },
  {
    id: 'rule-004',
    name: '月成本超阈值告警',
    description: '单智能体月成本超过 5 万元触发成本告警',
    level: 'warning',
    dimension: 'cost',
    metricKey: 'monthly_cost',
    metricName: '月成本',
    aggregation: 'sum',
    windowMinutes: 43200,
    scope: { type: 'all' },
    filters: [],
    trigger: { operator: '>', threshold: 50000, unit: '元' },
    continuousHits: 1,
    silentMinutes: 1440,
    autoRecovery: { enabled: false, windowCount: 0 },
    notification: {
      channels: ['station', 'email'],
      targets: ['it_admin'],
      templateId: 'tpl_warning',
    },
    owner: '赵强',
    enabled: true,
    createdAt: '2026-05-10T11:00:00+08:00',
    updatedAt: '2026-05-10T11:00:00+08:00',
    trigger7d: 1,
  },
  {
    id: 'rule-005',
    name: '调用失败率超过 0.5%',
    description: '智能体调用失败率超过 0.5% 触发警告',
    level: 'warning',
    dimension: 'performance',
    metricKey: 'error_rate',
    metricName: '错误率',
    aggregation: 'avg',
    windowMinutes: 5,
    scope: { type: 'all' },
    filters: [],
    trigger: { operator: '>', threshold: 0.5, unit: '%' },
    continuousHits: 3,
    silentMinutes: 15,
    autoRecovery: { enabled: true, windowCount: 5 },
    notification: {
      channels: ['station'],
      targets: ['it_admin'],
      templateId: 'tpl_warning',
    },
    owner: '刘洋',
    enabled: false,
    createdAt: '2026-05-15T08:30:00+08:00',
    updatedAt: '2026-05-20T10:00:00+08:00',
    trigger7d: 0,
  },
];

// Mock 告警事件 (实际告警记录由治理中心承载，此处仅用于告警横幅展示)
export const mockAlertEvents: AlertEvent[] = [
  {
    id: 'evt-001',
    eventId: 'evt-20260531-00123',
    ruleId: 'rule-001',
    ruleName: 'P95 响应时延异常',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    dimension: 'performance',
    level: 'severe',
    status: 'pending',
    metric: { key: 'p95_response_time', value: 6234, unit: 'ms', threshold: 5000, operator: '>' },
    window: { startAt: '2026-05-31T11:40:00+08:00', endAt: '2026-05-31T11:45:00+08:00' },
    continuousHits: 2,
    remediation: {
      possibleCauses: ['底座模型限流', '工具调用超时', '实例资源不足'],
      actions: ['检查接入中心日志', '扩容实例', '切换备用模型'],
    },
    timestamp: '2026-05-31T11:45:30+08:00',
  },
  {
    id: 'evt-002',
    eventId: 'evt-20260531-00122',
    ruleId: 'rule-003',
    ruleName: '智能体离线告警',
    agentId: 'agent-005',
    agentName: '智能导诊与分诊系统',
    department: '急诊科',
    dimension: 'status',
    level: 'severe',
    status: 'processing',
    metric: { key: 'heartbeat_success_rate', value: 0, unit: '%', threshold: 1, operator: '<' },
    window: { startAt: '2026-05-31T11:40:00+08:00', endAt: '2026-05-31T11:45:00+08:00' },
    continuousHits: 1,
    remediation: {
      possibleCauses: ['服务宕机', '网络故障', '实例被终止'],
      actions: ['检查服务状态', '查看接入中心日志', '联系运维支持'],
    },
    timestamp: '2026-05-31T11:43:00+08:00',
    handler: '赵强',
  },
  {
    id: 'evt-003',
    eventId: 'evt-20260531-00121',
    ruleId: 'rule-002',
    ruleName: '服务可用率低于 99.9%',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    dimension: 'performance',
    level: 'warning',
    status: 'pending',
    metric: { key: 'availability', value: 99.5, unit: '%', threshold: 99.9, operator: '<' },
    window: { startAt: '2026-05-31T10:00:00+08:00', endAt: '2026-05-31T11:00:00+08:00' },
    continuousHits: 1,
    timestamp: '2026-05-31T11:00:00+08:00',
  },
  {
    id: 'evt-004',
    eventId: 'evt-20260530-00120',
    ruleId: 'rule-001',
    ruleName: 'P95 响应时延异常',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    department: '医务科',
    dimension: 'performance',
    level: 'severe',
    status: 'resolved',
    metric: { key: 'p95_response_time', value: 5600, unit: 'ms', threshold: 5000, operator: '>' },
    window: { startAt: '2026-05-30T15:20:00+08:00', endAt: '2026-05-30T15:25:00+08:00' },
    continuousHits: 2,
    remediation: {
      possibleCauses: ['底座模型限流', '实例资源不足'],
      actions: ['扩容实例', '检查日志'],
    },
    timestamp: '2026-05-30T15:23:11+08:00',
    acknowledged: true,
    acknowledgedBy: '张明',
    acknowledgedAt: '2026-05-30T15:25:00+08:00',
    handler: '张明',
    handleTime: '2026-05-30T16:00:00+08:00',
    handleRemark: '已扩容实例，响应时间恢复正常',
  },
  {
    id: 'evt-005',
    eventId: 'evt-20260530-00119',
    ruleId: 'rule-004',
    ruleName: '月成本超阈值告警',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    dimension: 'cost',
    level: 'warning',
    status: 'ignored',
    metric: { key: 'monthly_cost', value: 82000, unit: '元', threshold: 50000, operator: '>' },
    window: { startAt: '2026-05-01T00:00:00+08:00', endAt: '2026-05-30T23:59:59+08:00' },
    continuousHits: 1,
    timestamp: '2026-05-30T10:00:00+08:00',
    acknowledged: true,
    acknowledgedBy: '王芳',
    acknowledgedAt: '2026-05-30T10:05:00+08:00',
    handleRemark: '业务量增长正常，已确认无需处理',
  },
];

export const mockAlertProcessingRecords: AlertProcessingRecord[] = [
  { id: 'proc-001', alertId: 'alert-001', action: '创建', operator: '系统', timestamp: '2026-05-20 10:30:15' },
  { id: 'proc-002', alertId: 'alert-001', action: '确认', operator: '张明', timestamp: '2026-05-20 10:35:00', remark: '已收到告警，正在排查' },
  { id: 'proc-003', alertId: 'alert-001', action: '处理中', operator: '张明', timestamp: '2026-05-20 10:40:00' },
  { id: 'proc-004', alertId: 'alert-002', action: '创建', operator: '系统', timestamp: '2026-05-20 09:45:00' },
  { id: 'proc-005', alertId: 'alert-002', action: '确认', operator: '张明', timestamp: '2026-05-20 09:50:00' },
  { id: 'proc-006', alertId: 'alert-002', action: '已处理', operator: '李华', timestamp: '2026-05-20 10:15:00', remark: '已联系供应商排查' },
];

export const mockAgentCostDetails: AgentCostDetail[] = [
  { agentId: 'agent-001', agentName: '心电图智能辅助诊断系统', department: '心内科', callCount: 15680, tokenConsumption: 4560000, computeCost: 12560, storageCost: 3200, networkCost: 1800, apiCost: 8900, totalCost: 26460, cpuCoreHours: 1280.5, gpuCardHours: 0, storageGbMonth: 320, egressGb: 18.4, tokenPerCall: 291, idleRate: 0.08, amount: null },
  { agentId: 'agent-002', agentName: '胸部 CT 影像智能分析平台', department: '影像科', callCount: 4280, tokenConsumption: 12800000, computeCost: 45800, storageCost: 12500, networkCost: 5600, apiCost: 18200, totalCost: 82100, cpuCoreHours: 3260, gpuCardHours: 256, storageGbMonth: 1840, egressGb: 92.6, tokenPerCall: 2990, idleRate: 0.12, amount: null },
  { agentId: 'agent-003', agentName: '病历智能生成与质控系统', department: '医务科', callCount: 8960, tokenConsumption: 8900000, computeCost: 22800, storageCost: 6800, networkCost: 3200, apiCost: 12800, totalCost: 45600, cpuCoreHours: 1980, gpuCardHours: 32, storageGbMonth: 560, egressGb: 24.1, tokenPerCall: 993, idleRate: 0.18, amount: null },
  { agentId: 'agent-004', agentName: '处方智能审核与用药安全系统', department: '药剂科', callCount: 45600, tokenConsumption: 3200000, computeCost: 8200, storageCost: 2100, networkCost: 1200, apiCost: 5600, totalCost: 17100, cpuCoreHours: 720, gpuCardHours: 0, storageGbMonth: 180, egressGb: 8.2, tokenPerCall: 70, idleRate: 0.05, amount: null },
  { agentId: 'agent-005', agentName: '智能导诊与分诊系统', department: '急诊科', callCount: 89500, tokenConsumption: 2100000, computeCost: 6800, storageCost: 1800, networkCost: 980, apiCost: 4200, totalCost: 13780, cpuCoreHours: 480, gpuCardHours: 0, storageGbMonth: 120, egressGb: 4.5, tokenPerCall: 23, idleRate: 0.06, amount: null },
  { agentId: 'agent-006', agentName: '智能问诊系统', department: '内科', callCount: 12560, tokenConsumption: 6800000, computeCost: 18500, storageCost: 4200, networkCost: 2100, apiCost: 9800, totalCost: 34600, cpuCoreHours: 1260, gpuCardHours: 12, storageGbMonth: 280, egressGb: 12.6, tokenPerCall: 541, idleRate: 0.09, amount: null },
  { agentId: 'agent-007', agentName: '随访管理系统', department: '内科', callCount: 5680, tokenConsumption: 1200000, computeCost: 3200, storageCost: 980, networkCost: 560, apiCost: 1800, totalCost: 6540, cpuCoreHours: 240, gpuCardHours: 0, storageGbMonth: 80, egressGb: 2.8, tokenPerCall: 211, idleRate: 0.22, amount: null },
  { agentId: 'agent-008', agentName: '健康评估系统', department: '体检科', callCount: 3200, tokenConsumption: 2100000, computeCost: 5600, storageCost: 1200, networkCost: 680, apiCost: 3200, totalCost: 10680, cpuCoreHours: 360, gpuCardHours: 0, storageGbMonth: 100, egressGb: 4.1, tokenPerCall: 656, idleRate: 0.07, amount: null },
];

export const mockDailyCosts: DailyCost[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const baseCost = 8000 + Math.random() * 3000;
  return {
    date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    computeCost: Math.round(baseCost * 1.2),
    storageCost: Math.round(baseCost * 0.35),
    networkCost: Math.round(baseCost * 0.18),
    apiCost: Math.round(baseCost * 0.65),
    totalCost: Math.round(baseCost * 2.38),
  };
});

export const mockDepartmentCosts = [
  { department: '影像科', cost: 82100 },
  { department: '医务科', cost: 45600 },
  { department: '内科', cost: 41340 },
  { department: '心内科', cost: 26460 },
  { department: '急诊科', cost: 13780 },
  { department: '体检科', cost: 10680 },
  { department: '药剂科', cost: 17100 },
];

export const mockBusinessMetrics: BusinessMetric[] = [
  {
    id: 'triage',
    name: '智能分诊',
    value: 8560,
    unit: '次',
    change: 8.1,
    trend: generateTrend(8000, 1000),
  },
  {
    id: 'diagnosis',
    name: '辅助诊断',
    value: 4280,
    unit: '次',
    change: 8.4,
    trend: generateTrend(4000, 500),
  },
  {
    id: 'prescription',
    name: '处方审核',
    value: 12560,
    unit: '次',
    change: 6.4,
    trend: generateTrend(12000, 800),
  },
  {
    id: 'imaging',
    name: '影像分析',
    value: 2890,
    unit: '次',
    change: 12.5,
    trend: generateTrend(2600, 400),
  },
  {
    id: 'report',
    name: '报告生成',
    value: 3200,
    unit: '次',
    change: 10.3,
    trend: generateTrend(3000, 400),
  },
  {
    id: 'followup',
    name: '随访管理',
    value: 1580,
    unit: '次',
    change: -2.3,
    trend: generateTrend(1600, 200),
  },
];

export const getMetricsByType = (type: MonitoringMetric['type']): MonitoringMetric[] => {
  return mockMonitoringMetrics.filter((m) => m.type === type);
};

export const getAgentMonitoringById = (agentId: string): AgentMonitoringData | undefined => {
  return mockAgentMonitoringData.find((a) => a.agentId === agentId);
};

export const getUnacknowledgedAlerts = (): AlertEvent[] => {
  return mockAlertEvents.filter((a) => !a.acknowledged);
};

export const getAlertsByLevel = (level: AlertEvent['level']): AlertEvent[] => {
  return mockAlertEvents.filter((a) => a.level === level);
};

export const getAlertsByStatus = (status: AlertStatus): AlertEvent[] => {
  return mockAlertEvents.filter((a) => a.status === status);
};

export const getAlertsByDimension = (dimension: MonitorDimension): AlertEvent[] => {
  return mockAlertEvents.filter((a) => a.dimension === dimension);
};

export const getAgentCostById = (agentId: string): AgentCostDetail | undefined => {
  return mockAgentCostDetails.find((a) => a.agentId === agentId);
};

export const getTotalCost = (): number => {
  return mockAgentCostDetails.reduce((sum, a) => sum + a.totalCost, 0);
};

// -----------------------------------------------------------------------------
// v1.4 业务监控明细行（明细分抽屉使用）
// -----------------------------------------------------------------------------
export interface BusinessDetailRow {
  agentId: string;
  agentName: string;
  department: string;
  callCount: number;
  activeUsers: number;
  taskCompletionRate: number;
  noncomplianceRate: number;
  overpromiseRate: number;
  blockedCount: number;
  complaintTickets: number;
}

export const mockBusinessDetailRows: BusinessDetailRow[] = [
  { agentId: 'agent-001', agentName: '心电图智能辅助诊断系统', department: '心内科', callCount: 15680, activeUsers: 856, taskCompletionRate: 0.985, noncomplianceRate: 0.0012, overpromiseRate: 0.0005, blockedCount: 12, complaintTickets: 1 },
  { agentId: 'agent-002', agentName: '胸部 CT 影像智能分析平台', department: '影像科', callCount: 4280, activeUsers: 456, taskCompletionRate: 0.992, noncomplianceRate: 0.0008, overpromiseRate: 0.0002, blockedCount: 8, complaintTickets: 0 },
  { agentId: 'agent-003', agentName: '病历智能生成与质控系统', department: '医务科', callCount: 8960, activeUsers: 1280, taskCompletionRate: 0.978, noncomplianceRate: 0.0015, overpromiseRate: 0.0008, blockedCount: 5, complaintTickets: 2 },
  { agentId: 'agent-004', agentName: '处方智能审核与用药安全系统', department: '药剂科', callCount: 45600, activeUsers: 2340, taskCompletionRate: 0.996, noncomplianceRate: 0.0005, overpromiseRate: 0.0001, blockedCount: 8, complaintTickets: 0 },
  { agentId: 'agent-005', agentName: '智能导诊与分诊系统', department: '急诊科', callCount: 89500, activeUsers: 12500, taskCompletionRate: 0.989, noncomplianceRate: 0.0018, overpromiseRate: 0.0012, blockedCount: 12, complaintTickets: 3 },
  { agentId: 'agent-006', agentName: '智能问诊系统', department: '内科', callCount: 12560, activeUsers: 3280, taskCompletionRate: 0.965, noncomplianceRate: 0.0032, overpromiseRate: 0.0025, blockedCount: 18, complaintTickets: 5 },
  { agentId: 'agent-007', agentName: '医学影像报告生成系统', department: '影像科', callCount: 5680, activeUsers: 460, taskCompletionRate: 0.972, noncomplianceRate: 0.0011, overpromiseRate: 0.0006, blockedCount: 6, complaintTickets: 0 },
  { agentId: 'agent-008', agentName: '随访管理系统', department: '医务科', callCount: 1200, activeUsers: 320, taskCompletionRate: 0.942, noncomplianceRate: 0.0021, overpromiseRate: 0.0009, blockedCount: 3, complaintTickets: 1 },
];

// -----------------------------------------------------------------------------
// v1.4 状态监控 - 异常事件与依赖服务（右侧抽屉使用）
// -----------------------------------------------------------------------------
export interface DependencyServiceCell {
  /** 时间戳（5min 粒度） */
  ts: string;
  /** 依赖项（底座模型/知识库/工具 API 等） */
  dependency: string;
  /** 可用率 0-1 */
  availability: number;
}

export const mockDependencyServices = [
  { key: '底座模型·GPT-4o', availability: 0.9995 },
  { key: '底座模型·Qwen-Max', availability: 0.9992 },
  { key: '底座模型·文心一言', availability: 0.9989 },
  { key: '医疗知识库·诊断', availability: 0.9998 },
  { key: '医疗知识库·药品', availability: 0.9996 },
  { key: '医学文献库·PubMed', availability: 0.9985 },
  { key: '工具 API·DICOM', availability: 0.9994 },
  { key: '工具 API·HL7 网关', availability: 0.9978 },
  { key: '工具 API·短信网关', availability: 0.9988 },
  { key: '向量索引·Milvus', availability: 0.9990 },
];

export const mockDependencyHeatmap = (() => {
  const cells: DependencyServiceCell[] = [];
  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    const ts = new Date(now - (24 - i) * 5 * 60 * 1000).toISOString();
    mockDependencyServices.forEach((d) => {
      const fluctuation = (Math.random() - 0.5) * 0.005;
      cells.push({ ts, dependency: d.key, availability: Math.max(0.99, d.availability + fluctuation) });
    });
  }
  return cells;
})();

// -----------------------------------------------------------------------------
// v1.4 监控总览页 Top7 健康排行
// -----------------------------------------------------------------------------
export interface HealthRankRow {
  agentId: string;
  rank: number;
  agentName: string;
  department: string;
  /** 健康度 0-100 */
  score: number;
  status: '运行中' | '暂停' | '异常' | '离线';
}

export const mockHealthRankTop7: HealthRankRow[] = [
  { agentId: 'agent-001', rank: 1, agentName: '心电图智能辅助诊断系统', department: '心内科', score: 98.5, status: '运行中' },
  { agentId: 'agent-005', rank: 2, agentName: '智能导诊与分诊系统', department: '急诊科', score: 97.2, status: '运行中' },
  { agentId: 'agent-004', rank: 3, agentName: '处方智能审核与用药安全系统', department: '药剂科', score: 96.8, status: '运行中' },
  { agentId: 'agent-009', rank: 4, agentName: '健康评估系统', department: '体检科', score: 95.5, status: '运行中' },
  { agentId: 'agent-003', rank: 5, agentName: '智能用药审核系统', department: '药剂科', score: 94.2, status: '运行中' },
  { agentId: 'agent-002', rank: 6, agentName: '胸部 CT 影像智能分析平台', department: '影像科', score: 88.5, status: '异常' },
  { agentId: 'agent-008', rank: 7, agentName: '随访管理系统', department: '医务科', score: 85.0, status: '离线' },
];

export interface AgentStatus {
  id: string;
  name: string;
  department: string;
  /** 运行状态：运行中 / 暂停 / 异常 / 离线 */
  status: '运行中' | '暂停' | '异常' | '离线';
  lastActive: string;
  /** 实例数（在线/应在线） */
  instances: { online: number; expected: number };
  /** 心跳成功率 (0-1) */
  heartbeatSuccessRate: number;
  /** 最近心跳时间 */
  lastHeartbeatAt: string;
  /** 运行版本 / 台账版本 */
  runVersion: string;
  registryVersion: string;
  /** 当前状态持续时长（分钟） */
  statusDurationMinutes: number;
  /** 关联告警（无则 null） */
  relatedAlert: { eventId: string; summary: string } | null;
}

export const mockAgentStatus: AgentStatus[] = [
  {
    id: 'agent-001',
    name: '心电图智能辅助诊断系统',
    department: '心内科',
    status: '运行中',
    lastActive: '2026-05-31 12:30:00',
    instances: { online: 3, expected: 3 },
    heartbeatSuccessRate: 0.9992,
    lastHeartbeatAt: '2026-05-31T12:32:10+08:00',
    runVersion: 'v1.2.3',
    registryVersion: 'v1.2.3',
    statusDurationMinutes: 4320,
    relatedAlert: null,
  },
  {
    id: 'agent-002',
    name: '胸部 CT 影像智能分析平台',
    department: '影像科',
    status: '运行中',
    lastActive: '2026-05-31 12:28:00',
    instances: { online: 2, expected: 3 },
    heartbeatSuccessRate: 0.9982,
    lastHeartbeatAt: '2026-05-31T12:30:00+08:00',
    runVersion: 'v2.1.0',
    registryVersion: 'v2.1.0',
    statusDurationMinutes: 8640,
    relatedAlert: { eventId: 'evt-20260531-00123', summary: 'P95 响应时延 6.2s' },
  },
  {
    id: 'agent-003',
    name: '智能用药审核系统',
    department: '药剂科',
    status: '运行中',
    lastActive: '2026-05-31 12:25:00',
    instances: { online: 3, expected: 3 },
    heartbeatSuccessRate: 0.9998,
    lastHeartbeatAt: '2026-05-31T12:30:00+08:00',
    runVersion: 'v1.5.0',
    registryVersion: 'v1.5.0',
    statusDurationMinutes: 14400,
    relatedAlert: null,
  },
  {
    id: 'agent-004',
    name: '病历智能生成与质控系统',
    department: '医务科',
    status: '异常',
    lastActive: '2026-05-31 12:20:00',
    instances: { online: 2, expected: 3 },
    heartbeatSuccessRate: 0.9521,
    lastHeartbeatAt: '2026-05-31T12:20:00+08:00',
    runVersion: 'v1.2.3',
    registryVersion: 'v1.2.4',
    statusDurationMinutes: 135,
    relatedAlert: { eventId: 'evt-20260531-00120', summary: '版本不一致 / 心跳下降' },
  },
  {
    id: 'agent-005',
    name: '智能导诊与分诊系统',
    department: '门诊部',
    status: '运行中',
    lastActive: '2026-05-31 12:30:00',
    instances: { online: 3, expected: 3 },
    heartbeatSuccessRate: 0.9995,
    lastHeartbeatAt: '2026-05-31T12:31:00+08:00',
    runVersion: 'v4.0.1',
    registryVersion: 'v4.0.1',
    statusDurationMinutes: 7200,
    relatedAlert: null,
  },
  {
    id: 'agent-006',
    name: '智能问诊系统',
    department: '门诊部',
    status: '暂停',
    lastActive: '2026-05-30 18:00:00',
    instances: { online: 0, expected: 2 },
    heartbeatSuccessRate: 0,
    lastHeartbeatAt: '2026-05-30T18:00:00+08:00',
    runVersion: 'v3.5.0',
    registryVersion: 'v3.5.0',
    statusDurationMinutes: 1320,
    relatedAlert: null,
  },
  {
    id: 'agent-007',
    name: '医学影像报告生成系统',
    department: '影像科',
    status: '运行中',
    lastActive: '2026-05-31 12:30:00',
    instances: { online: 2, expected: 2 },
    heartbeatSuccessRate: 0.999,
    lastHeartbeatAt: '2026-05-31T12:30:00+08:00',
    runVersion: 'v1.8.0',
    registryVersion: 'v1.8.0',
    statusDurationMinutes: 5760,
    relatedAlert: null,
  },
  {
    id: 'agent-008',
    name: '随访管理系统',
    department: '医务科',
    status: '离线',
    lastActive: '2026-05-30 17:00:00',
    instances: { online: 0, expected: 2 },
    heartbeatSuccessRate: 0,
    lastHeartbeatAt: '2026-05-30T17:00:00+08:00',
    runVersion: 'v2.0.0',
    registryVersion: 'v2.0.0',
    statusDurationMinutes: 1320,
    relatedAlert: { eventId: 'evt-20260530-00118', summary: '智能体离线' },
  },
  {
    id: 'agent-009',
    name: '健康评估系统',
    department: '体检科',
    status: '运行中',
    lastActive: '2026-05-31 12:30:00',
    instances: { online: 1, expected: 1 },
    heartbeatSuccessRate: 0.9988,
    lastHeartbeatAt: '2026-05-31T12:30:00+08:00',
    runVersion: 'v2.2.0',
    registryVersion: 'v2.2.0',
    statusDurationMinutes: 8640,
    relatedAlert: null,
  },
  {
    id: 'agent-010',
    name: '导诊智能体（备）',
    department: '门诊部',
    status: '运行中',
    lastActive: '2026-05-31 12:30:00',
    instances: { online: 1, expected: 1 },
    heartbeatSuccessRate: 0.9975,
    lastHeartbeatAt: '2026-05-31T12:30:00+08:00',
    runVersion: 'v1.0.0',
    registryVersion: 'v1.0.0',
    statusDurationMinutes: 4320,
    relatedAlert: null,
  },
];

// -----------------------------------------------------------------------------
// V1.6 8-5 告警事件处置 — 全量事件数据（10 列列表 + 13 字段详情抽屉）
// -----------------------------------------------------------------------------
const fmtTitle = (ruleName: string, targetName: string, ts: string): string =>
  `${ruleName} - ${targetName} - ${ts.replace(/[-:\sT]/g, '').slice(0, 14)}`;

export const mockAlertIncidents: AlertIncident[] = [
  {
    id: 'inc-001',
    eventId: 'evt-20260608-00123',
    title: fmtTitle('P95 响应时延超阈', '心电图智能辅助诊断系统', '2026-06-08T14:32:15+08:00'),
    sourceDimension: '应用',
    level: 'severe',
    ruleId: 'rule-001',
    ruleName: 'P95 响应时延超阈',
    target: { agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科' },
    trigger: 'P95 > 5000ms，实际 6200ms',
    relatedObject: { type: 'session', id: 'sess-20260608-143210', label: '会话 sess-…143210' },
    discoveredAt: '2026-06-08T14:32:15+08:00',
    status: 'pending',
    owner: { userId: 'u-it-01', name: '黄帅帅', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '底座模型调用限流（QPS 超过模型侧 80% 容量）', action: '联系模型供应商确认限流策略，临时切换至备用模型' },
      { order: 2, cause: '工具调用链路超时（平均 3.2s）', action: '检查 DICOM / HL7 网关的 P95 延迟，必要时扩容连接池' },
      { order: 3, cause: '实例 CPU 抢占导致推理排队', action: '扩容至设计容量 120%，观察 30 分钟' },
    ],
    timeline: [
      { id: 'tl-001-1', action: '系统触发', operator: '系统', timestamp: '2026-06-08T14:32:15+08:00', statusTo: 'pending' },
    ],
    audited: false,
  },
  {
    id: 'inc-002',
    eventId: 'evt-20260608-00122',
    title: fmtTitle('智能体离线', '智能导诊与分诊系统', '2026-06-08T13:45:02+08:00'),
    sourceDimension: '应用',
    level: 'severe',
    ruleId: 'rule-003',
    ruleName: '智能体离线',
    target: { agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科' },
    trigger: '心跳成功率 < 99.95%，实际 0.00%（连续 3 次）',
    discoveredAt: '2026-06-08T13:45:02+08:00',
    status: 'processing',
    owner: { userId: 'u-it-01', name: '黄帅帅', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '服务进程被 OOM Killer 终止', action: '检查 dmesg 与 cgroup 内存上限，必要时调整 -Xmx' },
      { order: 2, cause: '网络分区（k8s 节点 NotReady）', action: '在集群控制台查看节点状态，必要时 cordon + drain' },
      { order: 3, cause: '接入中心回调链路异常', action: '查看接入中心 API 网关 5xx 率，确认是否同步触发' },
    ],
    timeline: [
      { id: 'tl-002-1', action: '系统触发', operator: '系统', timestamp: '2026-06-08T13:45:02+08:00', statusTo: 'pending' },
      { id: 'tl-002-2', action: '开始处置', operator: '黄帅帅', operatorId: 'u-it-01', timestamp: '2026-06-08T13:48:30+08:00', remark: '已确认节点 NotReady，正在 cordon 异常节点并触发 pod 漂移', statusFrom: 'pending', statusTo: 'processing' },
    ],
    audited: false,
  },
  {
    id: 'inc-003',
    eventId: 'evt-20260608-00121',
    title: fmtTitle('月成本超阈', '胸部 CT 影像智能分析平台', '2026-06-08T11:00:00+08:00'),
    sourceDimension: '应用',
    level: 'warning',
    ruleId: 'rule-004',
    ruleName: '月成本超阈',
    target: { agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科' },
    trigger: '月成本 > 50000 元，实际 82100 元',
    discoveredAt: '2026-06-08T11:00:00+08:00',
    status: 'closed',
    owner: { userId: 'u-it-02', name: '王芳', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '业务量自然增长（影像科 CT 调用量较 5 月上涨 18%）', action: '与影像科确认是否合理上量，更新基线' },
      { order: 2, cause: 'GPU 卡时单价上调', action: '与云厂商核对计费明细，必要时申请价格保护' },
    ],
    timeline: [
      { id: 'tl-003-1', action: '系统触发', operator: '系统', timestamp: '2026-06-08T11:00:00+08:00', statusTo: 'pending' },
      { id: 'tl-003-2', action: '开始处置', operator: '王芳', operatorId: 'u-it-02', timestamp: '2026-06-08T11:25:10+08:00', remark: '联系影像科确认业务增量', statusFrom: 'pending', statusTo: 'processing' },
      { id: 'tl-003-3', action: '标记已关闭', operator: '王芳', operatorId: 'u-it-02', timestamp: '2026-06-08T14:00:00+08:00', remark: '经影像科确认，6 月体检高峰带来的自然增量，已与财务对齐预算，规则基线更新至 10 万元/月', adoption: '是', statusFrom: 'processing', statusTo: 'closed' },
    ],
    audited: true,
  },
  {
    id: 'inc-004',
    eventId: 'evt-20260607-00120',
    title: fmtTitle('不合规回答率超阈', '智能问诊系统', '2026-06-07T16:48:00+08:00'),
    sourceDimension: '应用',
    level: 'warning',
    ruleId: 'rule-006',
    ruleName: '不合规回答率超阈',
    target: { agentId: 'agent-006', name: '智能问诊系统', department: '内科' },
    trigger: '不合规回答率 > 0.5%，实际 0.68%',
    relatedObject: { type: 'log', id: 'log-20260607-164800', label: '审计日志 log-…164800' },
    discoveredAt: '2026-06-07T16:48:00+08:00',
    status: 'pending',
    owner: { userId: 'u-it-01', name: '黄帅帅', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '提示词更新未联动安全策略', action: '回滚提示词至 06-05 版本，下发安全规则补丁' },
      { order: 2, cause: '安全治理中心拦截规则松动', action: '调高「绝对化表述」拦截严格级别至 L3' },
    ],
    timeline: [
      { id: 'tl-004-1', action: '系统触发', operator: '系统', timestamp: '2026-06-07T16:48:00+08:00', statusTo: 'pending' },
    ],
    audited: false,
  },
  {
    id: 'inc-005',
    eventId: 'evt-20260607-00119',
    title: fmtTitle('调用失败率超阈', '病历智能生成与质控系统', '2026-06-07T10:32:00+08:00'),
    sourceDimension: '应用',
    level: 'warning',
    ruleId: 'rule-005',
    ruleName: '调用失败率超阈',
    target: { agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科' },
    trigger: '调用失败率 > 0.5%，实际 0.72%',
    discoveredAt: '2026-06-07T10:32:00+08:00',
    status: 'closed',
    owner: { userId: 'u-it-03', name: '李华', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: 'HIS 接口在 09:50-10:30 出现 504', action: '联系 HIS 厂商排障，10:35 已恢复' },
      { order: 2, cause: '智能体解析返回超时', action: '调整超时阈值至 6s 并启用重试' },
    ],
    timeline: [
      { id: 'tl-005-1', action: '系统触发', operator: '系统', timestamp: '2026-06-07T10:32:00+08:00', statusTo: 'pending' },
      { id: 'tl-005-2', action: '开始处置', operator: '李华', operatorId: 'u-it-03', timestamp: '2026-06-07T10:35:00+08:00', remark: 'HIS 接口已恢复，超时阈值调整中', statusFrom: 'pending', statusTo: 'processing' },
      { id: 'tl-005-3', action: '标记已关闭', operator: '李华', operatorId: 'u-it-03', timestamp: '2026-06-07T11:20:00+08:00', remark: '超时阈值已调至 6s 并启用 2 次重试，故障窗口 09:50-10:30 内影响 312 次调用，已回访 3 个高频科室确认无后续问题', adoption: '是', statusFrom: 'processing', statusTo: 'closed' },
    ],
    audited: true,
  },
  {
    id: 'inc-006',
    eventId: 'evt-20260607-00118',
    title: fmtTitle('运行版本与台账版本不一致', '病历智能生成与质控系统', '2026-06-07T08:15:00+08:00'),
    sourceDimension: '应用',
    level: 'info',
    ruleId: 'rule-007',
    ruleName: '运行版本与台账版本不一致',
    target: { agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科' },
    trigger: '运行 v1.2.3 ≠ 台账 v1.2.4',
    discoveredAt: '2026-06-07T08:15:00+08:00',
    status: 'ignored',
    owner: { userId: 'u-it-01', name: '黄帅帅', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '灰度发布只更新了部分实例', action: '确认灰度策略后批量更新剩余实例' },
      { order: 2, cause: '台账版本登记错误', action: '回滚台账版本至 v1.2.3' },
    ],
    timeline: [
      { id: 'tl-006-1', action: '系统触发', operator: '系统', timestamp: '2026-06-07T08:15:00+08:00', statusTo: 'pending' },
      { id: 'tl-006-2', action: '忽略事件', operator: '黄帅帅', operatorId: 'u-it-01', timestamp: '2026-06-07T09:00:00+08:00', remark: '已确认为灰度发布过程态，灰度完成后会自动消除，无需处置', statusFrom: 'pending', statusTo: 'ignored' },
    ],
    audited: true,
  },
  {
    id: 'inc-007',
    eventId: 'evt-20260606-00117',
    title: fmtTitle('GPU 显存超阈', '胸部 CT 影像智能分析平台', '2026-06-06T19:42:00+08:00'),
    sourceDimension: '应用',
    level: 'warning',
    ruleId: 'rule-008',
    ruleName: 'GPU 显存超阈',
    target: { agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科' },
    trigger: 'GPU 显存使用率 > 85%，实际 92%',
    discoveredAt: '2026-06-06T19:42:00+08:00',
    status: 'closed',
    owner: { userId: 'u-it-02', name: '王芳', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '并发推理任务数突增（晚高峰）', action: '将 GPU 推理副本数从 2 扩容至 3' },
      { order: 2, cause: 'batch_size 配置过大', action: '下调至 4 并验证' },
    ],
    timeline: [
      { id: 'tl-007-1', action: '系统触发', operator: '系统', timestamp: '2026-06-06T19:42:00+08:00', statusTo: 'pending' },
      { id: 'tl-007-2', action: '开始处置', operator: '王芳', operatorId: 'u-it-02', timestamp: '2026-06-06T19:50:00+08:00', remark: 'GPU 副本扩容中', statusFrom: 'pending', statusTo: 'processing' },
      { id: 'tl-007-3', action: '标记已关闭', operator: '王芳', operatorId: 'u-it-02', timestamp: '2026-06-06T20:05:00+08:00', remark: 'GPU 副本已扩至 3，显存回落至 78%', adoption: '是', statusFrom: 'processing', statusTo: 'closed' },
    ],
    audited: true,
  },
  {
    id: 'inc-008',
    eventId: 'evt-20260606-00116',
    title: fmtTitle('任务完成率破红线', '智能问诊系统', '2026-06-06T15:20:00+08:00'),
    sourceDimension: '应用',
    level: 'warning',
    ruleId: 'rule-009',
    ruleName: '任务完成率破红线',
    target: { agentId: 'agent-006', name: '智能问诊系统', department: '内科' },
    trigger: '任务完成率 < 95%，实际 92.3%',
    discoveredAt: '2026-06-06T15:20:00+08:00',
    status: 'processing',
    owner: { userId: 'u-it-01', name: '黄帅帅', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '提示词场景拆解不充分', action: '提示词增加 3 个典型场景分支' },
      { order: 2, cause: '工具调用失败率上升', action: '查看工具 API 健康度，必要时回退到本地工具' },
    ],
    timeline: [
      { id: 'tl-008-1', action: '系统触发', operator: '系统', timestamp: '2026-06-06T15:20:00+08:00', statusTo: 'pending' },
      { id: 'tl-008-2', action: '开始处置', operator: '黄帅帅', operatorId: 'u-it-01', timestamp: '2026-06-06T15:45:00+08:00', remark: '已联系智能体负责人复盘场景', statusFrom: 'pending', statusTo: 'processing' },
      { id: 'tl-008-3', action: '转交', operator: '黄帅帅', operatorId: 'u-it-01', timestamp: '2026-06-06T16:00:00+08:00', remark: '场景梳理需智能体负责人参与，转交', transferredTo: '李华', statusFrom: 'processing', statusTo: 'processing' },
    ],
    audited: false,
  },
  {
    id: 'inc-009',
    eventId: 'evt-20260605-00115',
    title: fmtTitle('依赖服务可用率下降', '智能导诊与分诊系统', '2026-06-05T22:10:00+08:00'),
    sourceDimension: '应用',
    level: 'warning',
    ruleId: 'rule-010',
    ruleName: '依赖服务可用率下降',
    target: { agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科' },
    trigger: '底座模型·Qwen-Max 可用率 < 99.9%，实际 99.62%',
    discoveredAt: '2026-06-05T22:10:00+08:00',
    status: 'closed',
    owner: { userId: 'u-it-03', name: '李华', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '模型供应商侧机房抖动', action: '联系供应商确认 SLA 赔付' },
      { order: 2, cause: '本地缓存命中率不足', action: '调整缓存策略，热点问题缓存 5 分钟' },
    ],
    timeline: [
      { id: 'tl-009-1', action: '系统触发', operator: '系统', timestamp: '2026-06-05T22:10:00+08:00', statusTo: 'pending' },
      { id: 'tl-009-2', action: '自动恢复', operator: '系统', timestamp: '2026-06-05T22:18:00+08:00', remark: '可用率连续 2 个 5min 窗口回升至 99.95% 以上，自动关闭', statusFrom: 'pending', statusTo: 'closed' },
    ],
    audited: true,
  },
  {
    id: 'inc-010',
    eventId: 'evt-20260605-00114',
    title: fmtTitle('实例闲置率超阈', '随访管理系统', '2026-06-05T08:00:00+08:00'),
    sourceDimension: '应用',
    level: 'info',
    ruleId: 'rule-011',
    ruleName: '实例闲置率超阈',
    target: { agentId: 'agent-007', name: '随访管理系统', department: '医务科' },
    trigger: '实例闲置率 > 15%，实际 22%',
    discoveredAt: '2026-06-05T08:00:00+08:00',
    status: 'pending',
    owner: { userId: 'u-it-01', name: '黄帅帅', department: '信息科' },
    remediationPairs: [
      { order: 1, cause: '业务存在潮汐特性（仅工作时段活跃）', action: '调整为弹性伸缩策略' },
      { order: 2, cause: '部分实例配置过大', action: '调低实例规格' },
    ],
    timeline: [
      { id: 'tl-010-1', action: '系统触发', operator: '系统', timestamp: '2026-06-05T08:00:00+08:00', statusTo: 'pending' },
    ],
    audited: false,
  },
];

// V1.6 健康排行：智能体健康度（运行中维度降序）
export const mockHealthRanking: Array<{ rank: number; agentId: string; agentName: string; department: string; score: number; status: '运行中' | '暂停' | '异常' | '离线' }> = [
  { rank: 1, agentId: 'agent-001', agentName: '心电图智能辅助诊断系统', department: '心内科', score: 98.5, status: '运行中' },
  { rank: 2, agentId: 'agent-004', agentName: '处方智能审核与用药安全系统', department: '药剂科', score: 97.2, status: '运行中' },
  { rank: 3, agentId: 'agent-005', agentName: '智能导诊与分诊系统', department: '急诊科', score: 95.8, status: '运行中' },
  { rank: 4, agentId: 'agent-009', agentName: '健康评估系统', department: '体检科', score: 95.0, status: '运行中' },
  { rank: 5, agentId: 'agent-007', agentName: '医学影像报告生成系统', department: '影像科', score: 93.4, status: '运行中' },
  { rank: 6, agentId: 'agent-002', agentName: '胸部 CT 影像智能分析平台', department: '影像科', score: 86.1, status: '异常' },
  { rank: 7, agentId: 'agent-008', agentName: '随访管理系统', department: '医务科', score: 82.0, status: '离线' },
];

// V1.6 状态总览 — 关联告警摘要（点击跳转 8-5 详情）
export const mockAgentStatusWithAlert = mockAgentStatus.map((a) => ({
  ...a,
  relatedAlert: a.relatedAlert
    ? { ...a.relatedAlert, link: a.relatedAlert.eventId }
    : null,
}));