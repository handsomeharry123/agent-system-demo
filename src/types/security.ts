// 统一安全治理中心 - 类型定义
// 对应需求文档 V1.3：8-1 总览（含下半部 6 维 Tab 检查项）/ 8-2 事件处置 / 8-3 规则管理（6 一级 Tab × 3 治理模式）

// ============== 通用枚举 ==============

/** 治理维度（6 维） */
export type SecurityDimension =
  | '系统'
  | '网络'
  | '身份'
  | '数据'
  | '模型'
  | '应用';

/** 维度中文名（用于展示） */
export const dimensionLabel: Record<SecurityDimension, string> = {
  系统: '系统风险',
  网络: '网络风险',
  身份: '身份风险',
  数据: '数据风险',
  模型: '模型风险',
  应用: '应用风险',
};

/** 维度图标 key（由页面层映射为具体组件） */
export const dimensionIconKey: Record<SecurityDimension, string> = {
  系统: 'safety',
  网络: 'global',
  身份: 'lock',
  数据: 'database',
  模型: 'robot',
  应用: 'appstore',
};

/** 维度颜色 */
export const dimensionColor: Record<SecurityDimension, string> = {
  系统: '#1677FF',
  网络: '#722ED1',
  身份: '#FA8C16',
  数据: '#13C2C2',
  模型: '#EB2F96',
  应用: '#52C41A',
};

/** 检查项风险等级（8-1 检查项 + 检查结果） */
export type CheckItemLevel = '无风险' | '低风险' | '中风险' | '高风险';
export const checkItemLevelList: CheckItemLevel[] = ['无风险', '低风险', '中风险', '高风险'];
export const checkItemLevelColor: Record<CheckItemLevel, string> = {
  无风险: 'green',
  低风险: 'blue',
  中风险: 'gold',
  高风险: 'red',
};

/** 检查项检查结果 */
export type CheckItemResult = '通过' | '未通过' | '待检查';
export const checkItemResultList: CheckItemResult[] = ['通过', '未通过', '待检查'];
export const checkItemResultColor: Record<CheckItemResult, string> = {
  通过: 'success',
  未通过: 'error',
  待检查: 'default',
};

/** 告警事件级别 */
export type EventLevel = '紧急' | '重要' | '一般';
export const eventLevelList: EventLevel[] = ['紧急', '重要', '一般'];
export const eventLevelColor: Record<EventLevel, string> = {
  紧急: 'red',
  重要: 'orange',
  一般: 'gold',
};

/** 告警事件处置状态 */
export type EventStatus = '待处理' | '处理中' | '已关闭' | '已忽略';
export const eventStatusList: EventStatus[] = ['待处理', '处理中', '已关闭', '已忽略'];
export const eventStatusColor: Record<EventStatus, string> = {
  待处理: 'red',
  处理中: 'processing',
  已关闭: 'success',
  已忽略: 'default',
};

/** 告警规则风险等级（8-3 子 Tab B） */
export type RuleLevel = '低' | '中' | '高';
export const ruleLevelList: RuleLevel[] = ['低', '中', '高'];
export const ruleLevelColor: Record<RuleLevel, string> = {
  低: 'blue',
  中: 'gold',
  高: 'red',
};

/** 检查频率 */
export type CheckFrequency = '实时' | '每小时' | '每 6 小时' | '每日' | '每周';
export const checkFrequencyList: CheckFrequency[] = ['实时', '每小时', '每 6 小时', '每日', '每周'];

/** 自动响应动作 */
export type ResponseAction = '告警通知' | '自动阻断' | '服务隔离' | '仅记录';
export const responseActionList: ResponseAction[] = ['告警通知', '自动阻断', '服务隔离', '仅记录'];

/** 通知渠道 */
export type NotifyChannel = '站内信' | '短信' | '邮件';
export const notifyChannelList: NotifyChannel[] = ['站内信', '短信', '邮件'];

// ============== 8-1 风险大盘 ==============

/** 维度评分（大盘卡片用） */
export interface DimensionScore {
  dimension: SecurityDimension;
  /** 综合风险指数 0-100，分越低风险越大 */
  score: number;
  /** 主指标描述（如「配置合规检查通过率 96%」） */
  primary: string;
  /** 次指标描述（如「异常项 3」） */
  secondary: string;
  /** 风险项数 */
  riskCount: number;
}

/** 折线趋势点 */
export interface ScoreHistoryPoint {
  timestamp: string;
  value: number;
}

/** 全局安全评分 */
export interface SecurityScore {
  current: number;
  previous: number;
  change: number;
  trend: ScoreHistoryPoint[];
}

// ============== 8-1 检查项 ==============

/** 检查项 */
export interface CheckItem {
  id: string;
  name: string;
  dimension: SecurityDimension;
  level: CheckItemLevel;
  result: CheckItemResult;
  lastCheckTime: string;
  affectedAgentCount: number;
  /** 关联智能体名称（用于关键字搜索） */
  agentName?: string;
  /** 规则名称与说明 */
  description: string;
  /** 检查频率 */
  frequency: CheckFrequency;
  /** 最近检查结果明细 */
  lastCheckDetail: string;
  /** 历史检查记录（按时间倒序） */
  history: { time: string; result: CheckItemResult; summary: string }[];
  /** 处置建议 */
  suggestion: string;
}

// ============== 8-2 告警事件 ==============

/** 处置时间线节点 */
export interface EventTimelineNode {
  time: string;
  operator: string;
  action: string;
  detail?: string;
}

/** 告警事件 */
export interface AlertEvent {
  id: string;
  title: string;
  dimension: SecurityDimension;
  level: EventLevel;
  /** 事件类型（如「高危端口暴露」「配置错误」等） */
  type: string;
  status: EventStatus;
  /** 受影响智能体名称 */
  agentName: string;
  discoveredAt: string;
  /** 风险描述 */
  description: string;
  /** 影响范围 - 列表 */
  impactScope: string[];
  /** 处置建议 */
  suggestion: string;
  /** 责任人（开始处置后填） */
  handler?: string;
  /** 创建人/发起人(由本人手动建单/分派时记录) — V1.2 */
  createdBy?: string;
  /** 关注人列表 — V1.2 预留扩展 */
  followers?: string[];
  /** 处置总结（关闭时填） */
  summary?: string;
  /** 忽略原因（已忽略时填） */
  ignoreReason?: string;
  /** 处置时间线 */
  timeline: EventTimelineNode[];
}

// ============== 8-3 采集配置 / 告警规则 ==============

/** 采集对象（系统：服务器；网络：IP/端口） */
export interface CollectionTarget {
  id: string;
  name: string;
  /** 类型：服务器 / IP / 端口 */
  type: '服务器' | 'IP' | '端口';
}

/** 采集配置 */
export interface CollectionConfig {
  id: string;
  dimension: SecurityDimension; // 仅 系统 / 网络
  /** 采集对象清单 */
  targets: CollectionTarget[];
  /** 采集频率 */
  frequency: CheckFrequency;
  /** 采集项 */
  items: string[];
  /** 扫描白名单（仅网络） */
  whitelist?: string;
  /** 扫描超时（秒） */
  timeout?: number;
  enabled: boolean;
  /** 表单内部使用:采集对象 ID 数组(保存后会被映射回 targets) */
  targetIds?: string[];
}

/** 告警规则 — V1.4 升级
 *  同步监控中心 8-6「告警管理」字段：四大配置块 (基本信息 / 告警指标 / 规则配置 / 告警通知)
 *  告警级别三档：紧急 / 重要 / 一般（与 8-2 事件级别一致；本规则触发的所有事件级别均沿用此值）
 */
export type SecurityAlertLevel = '紧急' | '重要' | '一般';
export const securityAlertLevelList: SecurityAlertLevel[] = ['紧急', '重要', '一般'];
export const securityAlertLevelColor: Record<SecurityAlertLevel, string> = {
  紧急: 'red',
  重要: 'orange',
  一般: 'blue',
};

/** 监控指标（系统 / 网络 维度下子 Tab A1 已启用采集项 → A2 指标下拉候选） */
export type SecurityMetricKey =
  | '服务间通信加密状态'
  | '密码明文存放'
  | '内部访问认证'
  | '配置项基线偏离'
  | '高危端口暴露数'
  | '公网开放面'
  | '内网隔离状态';

/** 聚合方式 — V1.4 监控中心 8-6 子集 */
export type SecurityAggregation = '计数' | '求和' | '最大' | '最小' | '占比' | '状态命中';
export const securityAggregationList: SecurityAggregation[] = ['计数', '求和', '最大', '最小', '占比', '状态命中'];

/** 统计窗口 — 8-3 V1.4 复用 CheckFrequency 语义 */
export type SecurityWindow = CheckFrequency;

/** 运算符 — V1.4 */
export type SecurityOperator = '>' | '≥' | '<' | '≤' | '=' | '≠' | '状态命中' | '环比变化';
export const securityOperatorList: SecurityOperator[] = ['>', '≥', '<', '≤', '=', '≠', '状态命中', '环比变化'];

/** 通知方式（与监控中心对齐） */
export type SecurityNotifyChannel = '站内通知' | '短信' | '邮件';
export const securityNotifyChannelList: SecurityNotifyChannel[] = ['站内通知', '短信', '邮件'];

/** 通知模板 */
export type SecurityNotifyTemplate = '紧急告警模板' | '重要告警模板' | '一般告警模板';
export const securityNotifyTemplateList: SecurityNotifyTemplate[] = ['紧急告警模板', '重要告警模板', '一般告警模板'];

/** 升级策略触发条件 */
export type EscalationCondition = '未处置超时' | '重复触发达 N 次';
export const escalationConditionList: EscalationCondition[] = ['未处置超时', '重复触发达 N 次'];

/** 升级对象 */
export type EscalationTarget = '上级管理员' | '信息科主管' | '自定义用户或用户组';
export const escalationTargetList: EscalationTarget[] = ['上级管理员', '信息科主管', '自定义用户或用户组'];

/** 修复建议行（可能原因 ↔ 处置动作） */
export interface RemediationRow {
  cause: string;   // ≤ 50 字
  action: string;  // ≤ 100 字
}

/** 过滤条件（占位） */
export interface SecurityFilter {
  field: '采集对象' | 'IP 段' | '服务名' | '端口范围';
  op: '等于' | '不等于' | '包含' | '不包含';
  value: string;
}

/** 告警规则（V1.4 完整结构） */
export interface AlertRule {
  id: string;
  /** 规则名称（同一维度内唯一） */
  name: string;
  /** 维度：系统 / 网络（其它维度走内置/同步） */
  dimension: SecurityDimension;
  /** 规则描述 */
  description?: string;

  // ===== ① 基本信息 =====
  /** 告警级别（紧急 / 重要 / 一般 — 与 8-2 一致） */
  alertLevel: SecurityAlertLevel;
  /** 生效范围：all 全平台 / scope 指定采集对象 */
  scopeType: 'all' | 'scope';
  /** scopeType=scope 时，勾选的采集对象 ID 列表 */
  scopeTargetIds?: string[];
  /** 规则负责人 */
  owner: string;
  /** 启用状态 */
  enabled: boolean;

  // ===== ② 告警指标 =====
  /** 监控指标 key（与子 Tab A1 已启用采集项联动） */
  metric: SecurityMetricKey;
  /** 聚合方式 */
  aggregation: SecurityAggregation;
  /** 统计窗口（不可低于采集频率粒度） */
  window: SecurityWindow;
  /** 过滤条件（可选） */
  filters?: SecurityFilter[];

  // ===== ③ 规则配置 =====
  /** 触发运算符 */
  operator: SecurityOperator;
  /** 阈值（如「0」「命中」等） */
  threshold: string;
  /** 连续触发次数 N，1-10 */
  continuousHits: number;
  /** 静默时间（分钟），最小 5 */
  silentMinutes: number;
  /** 自动恢复 */
  autoRecovery: boolean;
  /** 恢复窗口数 1-10 */
  recoveryWindow?: number;
  /** 响应动作 */
  responseActions: ResponseAction[];
  /** 修复建议（可能原因 ↔ 处置动作） */
  remediation: RemediationRow[];

  // ===== ④ 告警通知 =====
  /** 通知方式 */
  notifyChannels: SecurityNotifyChannel[];
  /** 通知对象 */
  notifyTargets: string[];
  /** 通知模板 */
  notifyTemplate: SecurityNotifyTemplate;
  /** 通知频率限制（次/小时） */
  rateLimitPerHour?: number;
  /** 免打扰时段（形如「22:00-08:00」，空表示关闭） */
  quietHours?: string;
  /** 升级策略开关 */
  escalationEnabled: boolean;
  /** 升级条件 */
  escalationCondition?: EscalationCondition;
  /** 升级对象 */
  escalationTargets?: EscalationTarget[];

  // ===== 元信息（用于列表展示 / 删除校验） =====
  /** 检查频率（与窗口联动，但与窗口解耦暴露给列表列） */
  frequency: CheckFrequency;
  /** 风险阈值摘要（用于列表"风险阈值"列） */
  thresholdSummary: string;
  /** 风险等级（V1.4 沿用 紧急/重要/一般 — 与 8-2 事件级别保持一致） */
  level: SecurityAlertLevel;
  /** 最近触发时间 */
  lastTriggerTime?: string;
  /** 停用时间（用于删除条件校验：≥ 30 天） */
  disabledAt?: string;
  /** 关联未关闭告警数（待处理+处理中） */
  relatedOpenEventCount?: number;
  /** 责任人接收副本（默认 owner 同步） */
  ownerCopyEnabled?: boolean;
  /** 规则创建人（用于默认 owner） */
  createdBy?: string;
}

// ============== 8-3 模式 B · 内置只读规则（身份 / 数据） ==============

/** 内置只读规则（B 模式）— 不可新建/编辑/删除，由平台基于法规与最佳实践内置 */
export interface BuiltinRule {
  id: string;
  name: string;
  /** 维度仅 身份 / 数据 */
  dimension: SecurityDimension;
  level: RuleLevel;
  /** 默认响应动作（仅展示） */
  defaultResponse: ResponseAction[];
  /** 触发条件 / 判定逻辑（多行说明） */
  triggerCondition: string;
  /** 判定字段（来自源模块） */
  judgmentFields: string[];
  /** 数据来源模块名 */
  sourceModule: string;
  /** 修复建议 */
  fixSuggestion: string;
  /** 最近触发时间（可空） */
  lastTriggerTime?: string;
}

// ============== 8-3 模式 C · 同步监控中心规则（模型 / 应用） ==============

/** 同步自监控中心 8-6「告警管理」中标签 = 模型 / 应用 的规则快照 */
export interface SyncedAlertRule {
  /** 监控中心的规则 ID（用于跳转回源编辑） */
  monitoringRuleId: string;
  name: string;
  /** 维度仅 模型 / 应用 */
  dimension: SecurityDimension;
  level: RuleLevel;
  /** 启用状态（与监控中心同步） */
  enabled: boolean;
  /** 阈值摘要（如「P95 > 5s」） */
  thresholdSummary: string;
  /** 响应动作 */
  responseActions: ResponseAction[];
  /** 最近触发时间 */
  lastTriggerTime?: string;
}
