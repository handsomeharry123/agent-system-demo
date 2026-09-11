/**
 * 统一运行监控中心 V1.8 Mock 数据
 *
 * 相对 V1.6/V1.7 的核心变化：
 * 1) 告警事件状态机扩展为 7 态：待分派 / 待处理 / 处理中 / 待审核 / 审核中 / 已关闭 / 已忽略
 * 2) 「触发告警内容 / 规则配置」按统一结构展示：
 *    rule_name / trigger_time / trigger_condition(metric/operator/threshold/sustain_duration) /
 *    trigger_action(notify/warn/throttle/degrade/disable) / output_prompt
 * 3) 状态监控：状态值改为「在线 / 离线 / 禁用 / 异常」（V1.6 是「运行中 / 暂停 / 异常 / 离线」，这里把「暂停」改名为「禁用」）
 * 4) 告警规则类型：业务 / 状态 / 成本 / 安全（V1.6 是 业务 / 状态 / 成本 / 性能 → 安全监控告警规则；性能维度已并入业务，V1.8 新增「安全监控告警规则」）
 * 5) 告警规则内容库：四大类（业务执行 / 运行状态 / 成本资源 / 安全）— PRD §5.1 共用清单
 */
// ---------------------------------------------------------------------------
// 告警规则类型：业务 / 状态 / 成本 / 安全
// ---------------------------------------------------------------------------
export type AlertRuleType = 'business' | 'status' | 'cost' | 'security';
export const AlertRuleTypeLabels: Record<AlertRuleType, string> = {
  business: '业务监控告警规则',
  status: '状态监控告警规则',
  cost: '成本监控告警规则',
  security: '安全监控',
};

// 告警规则类型 → 指标库分类 key 的映射（与下方 mockMetricCatalog 的 keys 对齐）
export const AlertRuleTypeToMetricGroup: Record<AlertRuleType, string> = {
  business: '业务监控',
  status: '状态监控',
  cost: '成本监控',
  security: '安全监控',
};

// ---------------------------------------------------------------------------
// 指标库（用于 RuleForm 「指标」下拉，按 4 大类分组）
// 选自下方告警规则内容库 mockAlertRuleLibrary 中核心指标，
// 也包含部分该类目下额外常见的可观测指标，便于未带模板时直接选用
// ---------------------------------------------------------------------------
export interface MetricOption {
  /** 指标显示名（中文，与 TriggerCondition.metric 同口径） */
  label: string;
  /** 推荐单位（带入到「单位」字段，可被用户覆盖） */
  unit?: string;
  /** 推荐阈值默认值 */
  defaultThreshold?: number | string;
  /** 备注：典型场景 */
  remark?: string;
}

export const mockMetricCatalog: Record<string, MetricOption[]> = {
  业务监控: [
    { label: '任务执行成功率', unit: '%', defaultThreshold: 95, remark: '任务成功数 / 任务总数' },
    { label: '任务完成时间', unit: 'ms', defaultThreshold: 5000, remark: '任务从派发到结束的平均耗时' },
    { label: '任务中断率', unit: '%', defaultThreshold: 5, remark: '异常中断任务占比' },
    { label: '业务接口调用失败率', unit: '%', defaultThreshold: 1 },
    { label: '任务重复执行率', unit: '%', defaultThreshold: 3 },
    { label: '多轮任务闭环率', unit: '%', defaultThreshold: 90 },
    { label: '业务输出为空率', unit: '%', defaultThreshold: 0.5 },
    { label: 'API 结果一致性', unit: '%', defaultThreshold: 99.5 },
    { label: '任务分发失败率', unit: '%', defaultThreshold: 0.1 },
    { label: '内存使用率', unit: '%', defaultThreshold: 85 },
    { label: 'GPU 使用率', unit: '%', defaultThreshold: 95 },
    { label: 'CPU 使用率', unit: '%', defaultThreshold: 90 },
    { label: '请求队列积压', unit: '条', defaultThreshold: 1000 },
    { label: 'GC 频率', unit: '次/分钟', defaultThreshold: 10 },
    { label: '磁盘 IO 等待', unit: '%', defaultThreshold: 30 },
    { label: '网络延迟', unit: 'ms', defaultThreshold: 200 },
    { label: 'P95 响应时间', unit: 'ms', defaultThreshold: 5000 },
    { label: '平均响应时间', unit: 'ms', defaultThreshold: 2000 },
    { label: '请求超时率', unit: '%', defaultThreshold: 5 },
    { label: '并发数', unit: '路', defaultThreshold: 1000 },
    { label: '缓存命中率', unit: '%', defaultThreshold: 80 },
  ],
  状态监控: [
    { label: '心跳成功率', unit: '%', defaultThreshold: 0 },
    { label: '实例心跳失败次数', unit: '次', defaultThreshold: 3, remark: '连续失败次数' },
    { label: '容器重启次数', unit: '次', defaultThreshold: 3, remark: '10 分钟窗口内' },
    { label: '健康检查失败次数', unit: '次', defaultThreshold: 2, remark: '连续失败次数' },
    { label: '实例存活率', unit: '%', defaultThreshold: 80, remark: '实际 / 期望' },
    { label: '服务发现失败率', unit: '%', defaultThreshold: 5 },
    { label: '部署失败率', unit: '%', defaultThreshold: 10 },
    { label: '配置生效延迟', unit: '分钟', defaultThreshold: 5 },
    { label: '服务降级频率', unit: '次/小时', defaultThreshold: 5 },
    { label: '节点不可达时长', unit: '分钟', defaultThreshold: 5 },
    { label: '版本回滚次数', unit: '次/小时', defaultThreshold: 2 },
    { label: '实例负载不均度', unit: '%', defaultThreshold: 50 },
  ],
  成本监控: [
    { label: 'Token 消耗', unit: 'tokens', defaultThreshold: 30000 },
    { label: '单任务成本', unit: '元', defaultThreshold: 10 },
    { label: 'API 费用占比', unit: '%', defaultThreshold: 90, remark: '占月度预算比例' },
    { label: '空转调用次数', unit: '次', defaultThreshold: 0 },
    { label: '长文本生成占比', unit: '%', defaultThreshold: 30, remark: '>4k tokens' },
    { label: '重复计算比例', unit: '%', defaultThreshold: 10 },
    { label: '高成本模型调用占比', unit: '%', defaultThreshold: 20 },
    { label: '单智能体成本占比', unit: '%', defaultThreshold: 30 },
    { label: '日成本增长率', unit: '%', defaultThreshold: 50 },
    { label: '失败重试成本占比', unit: '%', defaultThreshold: 10 },
    { label: '会话平均成本', unit: '元', defaultThreshold: 5 },
    { label: '低价值任务占比', unit: '%', defaultThreshold: 40 },
  ],
  安全监控: [
    { label: '提示词注入特征命中数', unit: '次', defaultThreshold: 0 },
    { label: '越权访问意图命中数', unit: '次', defaultThreshold: 0 },
    { label: '敏感字段命中数', unit: '次', defaultThreshold: 0 },
    { label: '恶意脚本特征命中数', unit: '次', defaultThreshold: 0 },
    { label: '同 IP 输入频率', unit: '次/分钟', defaultThreshold: 100 },
    { label: '输入结构异常率', unit: '%', defaultThreshold: 5 },
    { label: '非法指令命中数', unit: '次', defaultThreshold: 0 },
    { label: '无关输入占比', unit: '%', defaultThreshold: 40 },
    { label: '未授权建议命中数', unit: '次', defaultThreshold: 0 },
    { label: '高风险决策建议命中数', unit: '次', defaultThreshold: 0 },
    { label: '医疗建议无不确定性声明率', unit: '%', defaultThreshold: 5 },
    { label: '合规冲突命中数', unit: '次', defaultThreshold: 0 },
    { label: '幻觉率', unit: '%', defaultThreshold: 3 },
    { label: '输出结构错误率', unit: '%', defaultThreshold: 2 },
    { label: '敏感信息泄露命中数', unit: '次', defaultThreshold: 0 },
    { label: '输出重复率', unit: '%', defaultThreshold: 30 },
    { label: '输出为空/无意义率', unit: '%', defaultThreshold: 0.5 },
    { label: '工具调用失败率', unit: '%', defaultThreshold: 1 },
    { label: '未授权接口调用命中数', unit: '次', defaultThreshold: 0 },
  ],
};

// 兼容旧维度：性能维度在 V1.8 已并入业务
export type MonitorDimensionV18 = AlertRuleType;
export const MonitorDimensionLabelsV18: Record<AlertRuleType, string> = AlertRuleTypeLabels;

// ---------------------------------------------------------------------------
// 告警事件状态机：7 态
// ---------------------------------------------------------------------------
export type AlertEventStatus =
  | 'pending_assign'   // 待分派（仅管理员）
  | 'pending_handle'   // 待处理
  | 'handling'         // 处理中
  | 'pending_review'   // 待审核
  | 'reviewing'        // 审核中
  | 'closed'           // 已关闭
  | 'ignored';         // 已忽略
export const AlertEventStatusLabels: Record<AlertEventStatus, string> = {
  pending_assign: '待分派',
  pending_handle: '待处理',
  handling: '处理中',
  pending_review: '待审核',
  reviewing: '审核中',
  closed: '已关闭',
  ignored: '已忽略',
};
export const AlertEventStatusColors: Record<AlertEventStatus, string> = {
  pending_assign: 'orange',
  pending_handle: 'error',
  handling: 'processing',
  pending_review: 'gold',
  reviewing: 'blue',
  closed: 'success',
  ignored: 'default',
};

// ---------------------------------------------------------------------------
// 智能体运行状态：在线 / 离线 / 禁用 / 异常（V1.8 取消「暂停」概念，统一为「禁用」）
// ---------------------------------------------------------------------------
export type AgentRunStatus = '在线' | '离线' | '禁用' | '异常';
export const AgentRunStatusLabels: Record<AgentRunStatus, string> = {
  在线: '在线',
  离线: '离线',
  禁用: '禁用',
  异常: '异常',
};
export const AgentRunStatusColors: Record<AgentRunStatus, string> = {
  在线: 'success',
  离线: 'default',
  禁用: 'warning',
  异常: 'error',
};

// ---------------------------------------------------------------------------
// 触发告警内容 / 规则配置 统一结构
// ---------------------------------------------------------------------------
export interface TriggerCondition {
  metric: string;           // 指标（CPU / Token / 成功率 等）
  operator: '>' | '<' | '>=' | '<=' | '=';
  threshold: number | string;
  thresholdUnit?: string;
  /** 持续时间（如连续 3 分钟） */
  sustainDuration?: string;
  description: string;      // 拼装好的中文描述
}

export type TriggerActionKind = 'notify' | 'warn' | 'throttle' | 'degrade' | 'disable';
export const TriggerActionLabels: Record<TriggerActionKind, string> = {
  notify: '通知',
  warn: '预警',
  throttle: '限流智能体',
  degrade: '降级模型',
  disable: '停用智能体',
};

export interface TriggerContent {
  /** 1. 规则名称 */
  rule_name: string;
  /** 2. 触发时间 */
  trigger_time: string;
  /** 3. 触发条件 */
  trigger_condition: TriggerCondition;
  /** 4. 触发动作 */
  trigger_action: TriggerActionKind;
  /** 5. 输出提示词（可配模板，事件页按变量替换） */
  output_prompt: string;
}

// ---------------------------------------------------------------------------
// 通知对象 / 通知方式
// ---------------------------------------------------------------------------
export interface NotifyTarget {
  /** 关联账户 */
  account: string;
  /** 技术负责人 */
  owner: string;
  /** 联系方式 */
  phone?: string;
  email?: string;
}
export type NotifyChannel = '系统通知' | '短信通知' | '邮箱通知';
export const NotifyChannelLabels: Record<NotifyChannel, string> = {
  系统通知: '系统通知',
  短信通知: '短信通知',
  邮箱通知: '邮箱通知',
};

// ---------------------------------------------------------------------------
// 告警事件（V1.8 全生命周期）
// ---------------------------------------------------------------------------
export interface AlertEventV18 {
  id: string;
  /** 序号（在所属列表中按触发时间排序的下标） */
  index?: number;
  /** 事件类型：业务监控 / 状态监控 / 成本监控 / 安全监控告警规则 */
  eventType: AlertRuleType;
  /** 关联智能体 */
  agentId: string;
  agentName: string;
  department: string;
  /** 触发告警内容（按统一结构） */
  triggerContent: TriggerContent;
  /** 通知对象：关联账户 + 技术负责人 */
  notifyTarget: NotifyTarget;
  /** 通知方式 */
  notifyChannels: NotifyChannel[];
  /** 当前状态 */
  status: AlertEventStatus;
  /** 触发时间 */
  triggerTime: string;
  /** 分派时间（待分派 → 待处理 时填充） */
  assignTime?: string;
  /** 分派人（仅管理员） */
  assigner?: string;
  /** 转派时间 */
  reassignTime?: string;
  /** 转派人 */
  reassigner?: string;
  /** 处理人（待处理 / 处理中 / 待审核 / 审核中 / 已关闭 状态下展示） */
  handler?: string;
  /** 处理人联系方式（已关闭时展示） */
  handlerContact?: NotifyTarget;
  /** 开始处理时间 */
  handleStartTime?: string;
  /** 处理完成时间（待审核 / 审核中 / 已关闭） */
  handleCompleteTime?: string;
  /** 处理结果：已处理 / 已忽略 */
  handleResult?: '已处理' | '已忽略';
  /** 处理方案 */
  handlePlan?: string;
  /** 处理时间线（处理 - 退回 - 再次处理） */
  handleTimeline?: { time: string; action: string; operator: string; remark?: string }[];
  /** 审核人 */
  reviewer?: string;
  /** 开始审核时间 */
  reviewStartTime?: string;
  /** 审核完成时间（兼容旧数据时可回退 reviewTime） */
  reviewCompleteTime?: string;
  /** 审核时间（历史字段） */
  reviewTime?: string;
  /** 审核意见 */
  reviewOpinion?: '处理完成，关闭该告警事项' | '退回重新处理' | '同意忽略该告警事项';
  /** 审核说明 */
  reviewRemark?: string;
  /** 退回处理说明（处理 - 退回 - 再次处理 时展示） */
  returnReason?: string;
  /** 关联智能体的依赖节点（详情页拓扑图） */
  relatedAgents?: { id: string; name: string; department: string; dependency: string }[];
}

// ---------------------------------------------------------------------------
// 告警规则（V1.8 字段口径：规则名称 / 规则类型 / 触发条件 / 规则内容）
// ---------------------------------------------------------------------------
export interface AlertRuleV18 {
  id: string;
  /** 规则名称（唯一标识） */
  name: string;
  /** 规则类型 */
  type: AlertRuleType;
  /** 触发条件（结构化 + 可折叠） */
  triggerCondition: TriggerCondition;
  /** 触发动作 */
  triggerAction: TriggerActionKind;
  /** 规则内容（来源：内置「告警规则内容库」四大类） */
  ruleContentId: string;
  /** 规则文件：{name, size}，可选 */
  ruleFile?: { name: string; size: number; format: 'xlsx' | 'csv' };
  /** 规则配置（详情页按统一结构展示） */
  ruleConfig: TriggerContent;
  /** 是否启用 */
  enabled: boolean;
  /** 创建人 / 创建时间 */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** 7 日触发次数 */
  trigger7d: number;
  lastTriggeredAt?: string;
}

// ---------------------------------------------------------------------------
// 告警规则内容库（PRD §5.1 共用清单，四大类）
// ---------------------------------------------------------------------------
export interface AlertRuleContent {
  id: string;
  /** 类别：业务执行 / 运行状态 / 成本资源 / 安全 */
  category: '业务执行' | '运行状态' | '成本资源' | '安全';
  /** 规则名称 */
  name: string;
  /** 触发条件（自然语言，可拼装成结构化 TriggerCondition） */
  condition: string;
  /** 触发动作 */
  action: TriggerActionKind;
  /** 输出提示词模板 */
  outputPromptTemplate: string;
}

// PRD §5.1 四大类规则内容库（节选核心条目）
export const mockAlertRuleLibrary: AlertRuleContent[] = [
  // 一、业务执行类
  { id: 'biz-001', category: '业务执行', name: '任务执行成功率低于 95% 触发业务异常告警', condition: '任务执行成功率 < 95%（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】在{time_window}内任务成功率持续低于 95%，当前值：{current_value}%；建议：检查提示词与工具调用链路' },
  { id: 'biz-002', category: '业务执行', name: '任务完成时间超过 SLA 阈值触发延迟告警', condition: '任务完成时间 > SLA 阈值（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】在{time_window}内任务完成时间超过 SLA 阈值，当前值：{current_value}ms' },
  { id: 'biz-003', category: '业务执行', name: '任务中断率超过 5% 触发流程异常告警', condition: '任务中断率 > 5%（15 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】任务中断率过高，当前值：{current_value}%' },
  { id: 'biz-004', category: '业务执行', name: '业务接口调用失败率超过阈值触发服务异常告警', condition: '业务接口调用失败率 > 1%（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】调用依赖接口失败率异常，当前值：{current_value}%' },
  { id: 'biz-005', category: '业务执行', name: '任务重复执行率异常升高触发业务异常告警', condition: '任务重复执行率 > 3%（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】任务重复执行率异常升高，建议排查调度逻辑' },
  { id: 'biz-006', category: '业务执行', name: '任务未完成但状态已结束触发状态异常告警', condition: '任务状态不一致率 > 0.1%（实时）', action: 'notify', outputPromptTemplate: '智能体【{agent_name}】存在任务状态不一致情况' },
  { id: 'biz-007', category: '业务执行', name: '任务成功率持续下降触发业务退化告警', condition: '任务成功率 1h 内下降 > 10%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】任务成功率持续下降' },
  { id: 'biz-008', category: '业务执行', name: '用户请求未被正确响应触发服务异常告警', condition: '未响应请求率 > 0.5%（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】存在未正确响应的请求' },
  { id: 'biz-009', category: '业务执行', name: '多轮任务无法闭环触发流程异常告警', condition: '多轮任务闭环率 < 90%（15 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】多轮任务无法闭环' },
  { id: 'biz-010', category: '业务执行', name: '业务输出为空率超过阈值触发输出异常告警', condition: '业务输出为空率 > 0.5%（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出为空率过高' },
  { id: 'biz-011', category: '业务执行', name: 'API 调用结果与预期不一致触发结果异常告警', condition: 'API 结果一致性 < 99.5%（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】API 调用结果不一致' },
  { id: 'biz-012', category: '业务执行', name: '任务分发失败率上升触发调度异常告警', condition: '任务分发失败率 > 0.1%（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】任务分发失败率上升' },
  { id: 'biz-013', category: '业务执行', name: '内存持续增长触发内存异常告警', condition: '内存持续增长 > 30%（30 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】内存使用持续增长，存在泄漏风险' },
  { id: 'biz-014', category: '业务执行', name: 'GPU 使用率长期 100% 触发算力瓶颈告警', condition: 'GPU 使用率 > 95% 持续 10 分钟', action: 'throttle', outputPromptTemplate: '智能体【{agent_name}】GPU 长期满载，建议限流或扩容' },
  { id: 'biz-015', category: '业务执行', name: '请求队列积压超过阈值触发性能告警', condition: '请求队列积压 > 1000（实时）', action: 'throttle', outputPromptTemplate: '智能体【{agent_name}】请求队列积压严重，建议限流' },
  { id: 'biz-016', category: '业务执行', name: '吞吐量下降超过 30% 触发性能退化告警', condition: '吞吐量 1h 内下降 > 30%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】吞吐量明显下降' },
  { id: 'biz-017', category: '业务执行', name: 'GC 频繁触发性能抖动告警', condition: 'GC 频率 > 10 次/分钟 持续 5 分钟', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】GC 频繁触发，性能抖动' },
  { id: 'biz-018', category: '业务执行', name: '磁盘 IO 异常升高触发存储性能告警', condition: '磁盘 IO 等待 > 30%（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】磁盘 IO 异常' },
  { id: 'biz-019', category: '业务执行', name: '网络延迟异常升高触发通信性能告警', condition: '网络延迟 > 200ms（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】网络延迟异常' },
  { id: 'biz-020', category: '业务执行', name: '线程池耗尽触发资源枯竭告警', condition: '线程池活跃线程 / 最大线程 > 95%（实时）', action: 'throttle', outputPromptTemplate: '智能体【{agent_name}】线程池即将耗尽' },
  { id: 'biz-021', category: '业务执行', name: 'API 延迟波动过大触发性能抖动告警', condition: 'API 延迟标准差 > 500ms（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】API 延迟波动过大' },
  { id: 'biz-022', category: '业务执行', name: '并发超过承载能力触发性能过载告警', condition: '并发数 > 设计容量 120%（实时）', action: 'throttle', outputPromptTemplate: '智能体【{agent_name}】并发超过承载能力' },
  { id: 'biz-023', category: '业务执行', name: '缓存命中率下降触发性能异常告警', condition: '缓存命中率 < 80%（15 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】缓存命中率下降' },
  { id: 'biz-024', category: '业务执行', name: '资源利用率持续偏高触发性能风险告警', condition: '资源利用率 > 85% 持续 30 分钟', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】资源利用率持续偏高' },
  { id: 'biz-025', category: '业务执行', name: 'P95 响应时间超过阈值触发性能告警', condition: 'P95 响应时间 > 5s（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】P95 响应时间超阈' },
  { id: 'biz-026', category: '业务执行', name: '平均响应时间超过设定值触发性能异常告警', condition: '平均响应时间 > 2s（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】平均响应时间超阈' },
  { id: 'biz-027', category: '业务执行', name: '请求超时率超过 5% 触发性能告警', condition: '请求超时率 > 5%（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】请求超时率过高' },
  { id: 'biz-028', category: '业务执行', name: 'CPU 使用率持续超过 90% 触发资源过载告警', condition: 'CPU 使用率 > 90% 持续 5 分钟', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】CPU 使用率过高' },

  // 二、运行状态类
  { id: 'run-001', category: '运行状态', name: '实例心跳失败连续 3 次触发节点离线告警', condition: '心跳失败连续 3 次', action: 'notify', outputPromptTemplate: '智能体【{agent_name}】心跳失败连续 3 次，可能已离线' },
  { id: 'run-002', category: '运行状态', name: '容器频繁重启触发运行不稳定告警', condition: '容器 10 分钟内重启 > 3 次', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】容器频繁重启' },
  { id: 'run-003', category: '运行状态', name: '服务健康检查失败触发状态异常告警', condition: '健康检查失败连续 2 次', action: 'notify', outputPromptTemplate: '智能体【{agent_name}】健康检查失败' },
  { id: 'run-004', category: '运行状态', name: '注册实例数量低于预期触发容量不足告警', condition: '实际实例数 / 期望实例数 < 80%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】注册实例数不足' },
  { id: 'run-005', category: '运行状态', name: '服务发现失败触发注册异常告警', condition: '服务发现失败率 > 5%（5 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】服务发现失败' },
  { id: 'run-006', category: '运行状态', name: '部署失败率升高触发发布异常告警', condition: '部署失败率 > 10%（30 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】部署失败率升高' },
  { id: 'run-007', category: '运行状态', name: '配置未生效触发状态异常告警', condition: '配置生效延迟 > 5 分钟', action: 'notify', outputPromptTemplate: '智能体【{agent_name}】配置未及时生效' },
  { id: 'run-008', category: '运行状态', name: '服务降级频繁触发状态告警', condition: '降级触发频率 > 5 次/小时', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】服务降级频繁' },
  { id: 'run-009', category: '运行状态', name: '节点不可达触发运行异常告警', condition: '节点不可达 5 分钟以上', action: 'notify', outputPromptTemplate: '智能体【{agent_name}】所在节点不可达' },
  { id: 'run-010', category: '运行状态', name: '版本回滚频繁触发稳定性告警', condition: '版本回滚 > 2 次/小时', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】版本回滚频繁' },
  { id: 'run-011', category: '运行状态', name: '服务冻结或暂停触发状态异常告警', condition: '服务被禁用 / 冻结', action: 'disable', outputPromptTemplate: '智能体【{agent_name}】已被禁用或冻结' },
  { id: 'run-012', category: '运行状态', name: '实例负载持续不均触发状态异常告警', condition: '实例负载标准差 / 均值 > 50%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】实例负载不均，建议重调度' },

  // 三、成本资源类
  { id: 'cost-001', category: '成本资源', name: 'Token 消耗超过历史基线 3 倍触发成本异常告警', condition: 'Token 消耗 > 7 日基线 × 3（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】Token 消耗超过基线 3 倍，当前值：{current_value} tokens' },
  { id: 'cost-002', category: '成本资源', name: '单任务成本超过阈值触发成本告警', condition: '单任务成本 > 10 元', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】单任务成本过高' },
  { id: 'cost-003', category: '成本资源', name: 'API 费用超过预算触发成本超支告警', condition: 'API 费用 > 月度预算 90%', action: 'notify', outputPromptTemplate: '智能体【{agent_name}】API 费用接近预算上限' },
  { id: 'cost-004', category: '成本资源', name: '无请求仍发生模型调用触发空转成本告警', condition: '无请求情况下模型调用 > 0（10 分钟窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】存在空转调用' },
  { id: 'cost-005', category: '成本资源', name: '长文本生成占比过高触发成本异常告警', condition: '长文本（>4k tokens）占比 > 30%（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】长文本生成占比过高' },
  { id: 'cost-006', category: '成本资源', name: '重复计算比例过高触发成本浪费告警', condition: '重复计算比例 > 10%（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】重复计算比例过高' },
  { id: 'cost-007', category: '成本资源', name: '高成本模型调用频率过高触发成本异常告警', condition: '高成本模型调用占比 > 20%（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】高成本模型调用频率过高' },
  { id: 'cost-008', category: '成本资源', name: '单服务成本持续 TOP1 触发成本集中告警', condition: '单智能体成本占比 > 30%（当日）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】成本占比过高' },
  { id: 'cost-009', category: '成本资源', name: '日成本增长异常触发成本趋势告警', condition: '日成本较昨日增长 > 50%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】日成本增长异常' },
  { id: 'cost-010', category: '成本资源', name: '任务失败重试导致成本增加触发成本异常告警', condition: '任务失败重试成本 > 总成本 10%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】失败重试成本占比过高' },
  { id: 'cost-011', category: '成本资源', name: '会话平均成本上升触发成本异常告警', condition: '会话平均成本较 7 日基线上涨 > 30%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】会话平均成本上升' },
  { id: 'cost-012', category: '成本资源', name: '低价值任务占比过高触发成本低效告警', condition: '低价值任务（未采纳）占比 > 40%（当日）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】低价值任务占比过高' },

  // 四、安全类
  { id: 'sec-001', category: '安全', name: '输入包含提示词注入特征触发输入安全告警', condition: '提示词注入特征命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】检测到提示词注入攻击' },
  { id: 'sec-002', category: '安全', name: '输入包含越权访问意图触发输入安全告警', condition: '越权访问意图命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】检测到越权访问意图' },
  { id: 'sec-003', category: '安全', name: '输入包含敏感信息泄露风险触发输入安全告警', condition: '敏感字段模式命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】检测到敏感信息输入' },
  { id: 'sec-004', category: '安全', name: '输入包含恶意脚本触发输入安全告警', condition: '恶意脚本特征命中（实时）', action: 'throttle', outputPromptTemplate: '智能体【{agent_name}】检测到恶意脚本输入' },
  { id: 'sec-005', category: '安全', name: '输入频率异常增长触发输入安全告警', condition: '同 IP 输入频率 > 100 次/分钟', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输入频率异常' },
  { id: 'sec-006', category: '安全', name: '输入结构异常触发输入安全告警', condition: '输入结构异常率 > 5%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输入结构异常' },
  { id: 'sec-007', category: '安全', name: '输入包含非法操作指令触发输入安全告警', condition: '非法指令命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】检测到非法操作指令' },
  { id: 'sec-008', category: '安全', name: '输入内容与任务无关比例过高触发输入安全告警', condition: '无关输入占比 > 40%（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】无关输入占比过高' },
  { id: 'sec-009', category: '安全', name: '输出包含未经授权建议触发输出安全告警', condition: '未授权建议命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出包含未授权建议' },
  { id: 'sec-010', category: '安全', name: '输出包含医疗/金融等高风险决策建议触发高危输出告警', condition: '高风险决策建议命中（实时）', action: 'degrade', outputPromptTemplate: '智能体【{agent_name}】输出高风险决策建议，建议切换至审核模式' },
  { id: 'sec-011', category: '安全', name: '输出缺乏不确定性声明触发输出安全告警', condition: '医疗建议无不确定性声明率 > 5%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】医疗建议缺少不确定性声明' },
  { id: 'sec-012', category: '安全', name: '输出与规则/政策冲突触发输出安全告警', condition: '合规冲突命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出与策略冲突' },
  { id: 'sec-013', category: '安全', name: '输出包含虚假信息触发幻觉告警', condition: '幻觉率 > 3%（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】检测到幻觉输出' },
  { id: 'sec-014', category: '安全', name: '输出结构错误率高触发输出异常告警', condition: '输出结构错误率 > 2%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出结构错误率高' },
  { id: 'sec-015', category: '安全', name: '输出包含敏感信息触发数据泄露告警', condition: '敏感信息泄露命中（实时）', action: 'degrade', outputPromptTemplate: '智能体【{agent_name}】输出包含敏感信息' },
  { id: 'sec-016', category: '安全', name: '输出存在逻辑矛盾触发输出异常告警', condition: '逻辑矛盾命中（实时）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出存在逻辑矛盾' },
  { id: 'sec-017', category: '安全', name: '输出内容重复率过高触发生成异常告警', condition: '输出重复率 > 30%（1 小时窗口）', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出重复率过高' },
  { id: 'sec-018', category: '安全', name: '输出为空或无意义触发输出失败告警', condition: '输出为空/无意义率 > 0.5%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】输出为空或无意义' },
  { id: 'sec-019', category: '安全', name: '工具调用失败率超过阈值触发工具异常告警', condition: '工具调用失败率 > 1%', action: 'warn', outputPromptTemplate: '智能体【{agent_name}】工具调用失败率过高' },
  { id: 'sec-020', category: '安全', name: '工具调用未授权接口触发工具安全告警', condition: '未授权接口调用命中（实时）', action: 'throttle', outputPromptTemplate: '智能体【{agent_name}】调用了未授权接口' },
];

// ---------------------------------------------------------------------------
// 告警规则样例（5 条，覆盖四种类型）
// ---------------------------------------------------------------------------
const buildRuleConfig = (rule: AlertRuleV18, time: string): TriggerContent => ({
  rule_name: rule.name,
  trigger_time: time,
  trigger_condition: rule.triggerCondition,
  trigger_action: rule.triggerAction,
  output_prompt: mockAlertRuleLibrary.find((c) => c.id === rule.ruleContentId)?.outputPromptTemplate || '',
});

export const mockAlertRulesV18: AlertRuleV18[] = [
  {
    id: 'rule-v18-001',
    name: '智能体 CPU 使用率过高告警',
    type: 'business',
    triggerCondition: { metric: 'CPU 使用率', operator: '>', threshold: 90, thresholdUnit: '%', sustainDuration: '连续 5 分钟', description: 'CPU 使用率 > 90%，连续 5 分钟' },
    triggerAction: 'warn',
    ruleContentId: 'biz-028',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '黄帅帅',
    createdAt: '2026-05-20 09:00:00',
    updatedAt: '2026-06-20 09:00:00',
    trigger7d: 8,
    lastTriggeredAt: '2026-06-25 16:30:00',
  },
  {
    id: 'rule-v18-002',
    name: '智能体离线告警',
    type: 'status',
    triggerCondition: { metric: '心跳成功率', operator: '=', threshold: 0, thresholdUnit: '%', sustainDuration: '连续 3 次心跳', description: '心跳失败连续 3 次' },
    triggerAction: 'notify',
    ruleContentId: 'run-001',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '王芳',
    createdAt: '2026-05-25 10:00:00',
    updatedAt: '2026-06-22 14:00:00',
    trigger7d: 3,
    lastTriggeredAt: '2026-06-26 09:45:00',
  },
  {
    id: 'rule-v18-003',
    name: 'Token 异常增长告警',
    type: 'cost',
    triggerCondition: { metric: 'Token 消耗', operator: '>', threshold: 30000, thresholdUnit: 'tokens/小时', sustainDuration: '10 分钟窗口', description: 'Token 消耗 > 7 日基线 × 3（10 分钟窗口）' },
    triggerAction: 'warn',
    ruleContentId: 'cost-001',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '李华',
    createdAt: '2026-05-30 11:00:00',
    updatedAt: '2026-06-24 17:00:00',
    trigger7d: 5,
    lastTriggeredAt: '2026-06-26 11:20:00',
  },
  {
    id: 'rule-v18-004',
    name: '提示词注入攻击告警',
    type: 'security',
    triggerCondition: { metric: '注入特征匹配数', operator: '>', threshold: 0, thresholdUnit: '次', sustainDuration: '实时', description: '提示词注入特征命中（实时）' },
    triggerAction: 'warn',
    ruleContentId: 'sec-001',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '黄帅帅',
    createdAt: '2026-06-01 09:00:00',
    updatedAt: '2026-06-25 18:00:00',
    trigger7d: 2,
    lastTriggeredAt: '2026-06-26 08:30:00',
  },
  {
    id: 'rule-v18-005',
    name: '任务完成率下降告警',
    type: 'business',
    triggerCondition: { metric: '任务完成率', operator: '<', threshold: 95, thresholdUnit: '%', sustainDuration: '15 分钟窗口', description: '任务完成率 < 95%（15 分钟窗口）' },
    triggerAction: 'warn',
    ruleContentId: 'biz-001',
    ruleConfig: {} as TriggerContent,
    enabled: false,
    createdBy: '王芳',
    createdAt: '2026-06-05 14:00:00',
    updatedAt: '2026-06-25 10:00:00',
    trigger7d: 1,
  },
  {
    id: 'rule-v18-006',
    name: '容器频繁重启告警',
    type: 'status',
    triggerCondition: { metric: '容器重启次数', operator: '>', threshold: 3, thresholdUnit: '次/10分钟', sustainDuration: '10 分钟窗口', description: '容器 10 分钟内重启 > 3 次' },
    triggerAction: 'warn',
    ruleContentId: 'run-002',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '黄帅帅',
    createdAt: '2026-05-12 09:30:00',
    updatedAt: '2026-06-18 11:00:00',
    trigger7d: 4,
    lastTriggeredAt: '2026-06-26 03:12:00',
  },
  {
    id: 'rule-v18-007',
    name: '单任务成本过高告警',
    type: 'cost',
    triggerCondition: { metric: '单任务成本', operator: '>', threshold: 10, thresholdUnit: '元', sustainDuration: '实时', description: '单任务成本 > 10 元' },
    triggerAction: 'warn',
    ruleContentId: 'cost-002',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '李华',
    createdAt: '2026-05-28 15:20:00',
    updatedAt: '2026-06-21 09:00:00',
    trigger7d: 6,
    lastTriggeredAt: '2026-06-26 14:05:00',
  },
  {
    id: 'rule-v18-008',
    name: '越权访问意图告警',
    type: 'security',
    triggerCondition: { metric: '越权访问意图', operator: '>', threshold: 0, thresholdUnit: '次', sustainDuration: '实时', description: '越权访问意图命中（实时）' },
    triggerAction: 'warn',
    ruleContentId: 'sec-002',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '黄帅帅',
    createdAt: '2026-06-02 10:30:00',
    updatedAt: '2026-06-23 16:00:00',
    trigger7d: 1,
    lastTriggeredAt: '2026-06-25 22:40:00',
  },
  {
    id: 'rule-v18-009',
    name: 'P95 响应时间超阈告警',
    type: 'business',
    triggerCondition: { metric: 'P95 响应时间', operator: '>', threshold: 5, thresholdUnit: 's', sustainDuration: '5 分钟窗口', description: 'P95 响应时间 > 5s（5 分钟窗口）' },
    triggerAction: 'warn',
    ruleContentId: 'biz-025',
    ruleConfig: {} as TriggerContent,
    enabled: true,
    createdBy: '王芳',
    createdAt: '2026-05-18 11:00:00',
    updatedAt: '2026-06-22 17:30:00',
    trigger7d: 7,
    lastTriggeredAt: '2026-06-26 10:18:00',
  },
  {
    id: 'rule-v18-010',
    name: '服务降级频繁告警',
    type: 'status',
    triggerCondition: { metric: '降级触发频率', operator: '>', threshold: 5, thresholdUnit: '次/小时', sustainDuration: '1 小时窗口', description: '降级触发频率 > 5 次/小时' },
    triggerAction: 'warn',
    ruleContentId: 'run-008',
    ruleConfig: {} as TriggerContent,
    enabled: false,
    createdBy: '李华',
    createdAt: '2026-06-08 16:40:00',
    updatedAt: '2026-06-24 14:00:00',
    trigger7d: 0,
  },
];

// 注入 ruleConfig
mockAlertRulesV18.forEach((rule) => {
  rule.ruleConfig = buildRuleConfig(rule, rule.lastTriggeredAt || rule.createdAt);
});

const CHAT_ALERT_RULES_STORAGE_KEY = 'home-chat-alert-rules-v18';

export function syncChatAlertRulesFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CHAT_ALERT_RULES_STORAGE_KEY);
    if (!raw) return;
    const rules = JSON.parse(raw) as AlertRuleV18[];
    if (!Array.isArray(rules)) return;
    rules.forEach((rule) => {
      if (!rule?.id) return;
      const idx = mockAlertRulesV18.findIndex((item) => item.id === rule.id);
      if (idx >= 0) {
        mockAlertRulesV18[idx] = rule;
      } else {
        mockAlertRulesV18.unshift(rule);
      }
    });
  } catch {
    // Ignore malformed demo storage and keep bundled mock data available.
  }
}

export function persistChatAlertRule(rule: AlertRuleV18) {
  if (typeof window === 'undefined') return;
  syncChatAlertRulesFromStorage();
  const idx = mockAlertRulesV18.findIndex((item) => item.id === rule.id);
  if (idx >= 0) {
    mockAlertRulesV18[idx] = rule;
  } else {
    mockAlertRulesV18.unshift(rule);
  }
  try {
    const raw = window.localStorage.getItem(CHAT_ALERT_RULES_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as AlertRuleV18[]) : [];
    const next = [rule, ...(Array.isArray(stored) ? stored.filter((item) => item?.id !== rule.id) : [])];
    window.localStorage.setItem(CHAT_ALERT_RULES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Demo persistence is best effort; in-memory rule is already updated above.
  }
}

// ---------------------------------------------------------------------------
// 智能体（V1.8：在线/离线/禁用/异常）
// ---------------------------------------------------------------------------
export interface AgentV18 {
  id: string;
  name: string;
  department: string;
  status: AgentRunStatus;
  instances: { online: number; expected: number };
  heartbeatRate: number;          // 0-1
  lastHeartbeatAt: string;
  runVersion: string;
  registryVersion: string;
  statusDurationMinutes: number;
  relatedAlert?: string;
}

export const mockAgentsV18: AgentV18[] = [
  { id: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', status: '在线', instances: { online: 3, expected: 3 }, heartbeatRate: 0.9996, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v1.2.3', registryVersion: 'v1.2.3', statusDurationMinutes: 4320 },
  { id: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科', status: '异常', instances: { online: 2, expected: 3 }, heartbeatRate: 0.9712, lastHeartbeatAt: '2026-06-26 12:28:00', runVersion: 'v2.1.0', registryVersion: 'v2.1.0', statusDurationMinutes: 145, relatedAlert: 'P95 响应时延 6.2s' },
  { id: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', status: '在线', instances: { online: 3, expected: 3 }, heartbeatRate: 0.9992, lastHeartbeatAt: '2026-06-26 12:31:00', runVersion: 'v1.5.0', registryVersion: 'v1.5.0', statusDurationMinutes: 14400 },
  { id: 'agent-004', name: '处方智能审核与用药安全系统', department: '药剂科', status: '在线', instances: { online: 3, expected: 3 }, heartbeatRate: 0.9999, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v1.5.2', registryVersion: 'v1.5.2', statusDurationMinutes: 7200 },
  { id: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', status: '离线', instances: { online: 0, expected: 3 }, heartbeatRate: 0, lastHeartbeatAt: '2026-06-25 18:00:00', runVersion: 'v4.0.1', registryVersion: 'v4.0.1', statusDurationMinutes: 1110, relatedAlert: '智能体离线' },
  { id: 'agent-006', name: '智能问诊系统', department: '内科', status: '禁用', instances: { online: 0, expected: 2 }, heartbeatRate: 0, lastHeartbeatAt: '2026-06-20 16:00:00', runVersion: 'v3.5.0', registryVersion: 'v3.5.0', statusDurationMinutes: 8420 },
  { id: 'agent-007', name: '医学影像报告生成系统', department: '影像科', status: '在线', instances: { online: 2, expected: 2 }, heartbeatRate: 0.9988, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v1.8.0', registryVersion: 'v1.8.0', statusDurationMinutes: 5760 },
  { id: 'agent-008', name: '随访管理系统', department: '医务科', status: '在线', instances: { online: 2, expected: 2 }, heartbeatRate: 0.998, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v2.0.0', registryVersion: 'v2.0.0', statusDurationMinutes: 8640 },
  { id: 'agent-009', name: '健康评估系统', department: '体检科', status: '在线', instances: { online: 1, expected: 1 }, heartbeatRate: 0.9985, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v2.2.0', registryVersion: 'v2.2.0', statusDurationMinutes: 8640 },
  { id: 'agent-010', name: '检验报告智能解读', department: '检验科', status: '在线', instances: { online: 2, expected: 2 }, heartbeatRate: 0.999, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v1.6.0', registryVersion: 'v1.6.0', statusDurationMinutes: 8640 },
  { id: 'agent-011', name: '急诊预检分诊', department: '急诊科', status: '在线', instances: { online: 2, expected: 2 }, heartbeatRate: 0.9988, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v2.0.3', registryVersion: 'v2.0.3', statusDurationMinutes: 4320 },
  { id: 'agent-012', name: '用药咨询助手', department: '药剂科', status: '在线', instances: { online: 1, expected: 1 }, heartbeatRate: 0.9995, lastHeartbeatAt: '2026-06-26 12:30:00', runVersion: 'v1.1.0', registryVersion: 'v1.1.0', statusDurationMinutes: 2160 },
];

// ---------------------------------------------------------------------------
// 告警事件 V1.8 完整生命周期（覆盖 7 个状态）
// ---------------------------------------------------------------------------
const makeEvent = (e: Omit<AlertEventV18, 'index'>): AlertEventV18 => e as AlertEventV18;

export const mockAlertEventsV18: AlertEventV18[] = [
  // 1. 待审核（已处理完毕，等待审核）
  makeEvent({
    id: 'evt-v18-001',
    eventType: 'business',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    triggerContent: {
      rule_name: '智能体 CPU 使用率过高告警',
      trigger_time: '2026-06-26 12:35:00',
      trigger_condition: { metric: 'CPU 使用率', operator: '>', threshold: 90, thresholdUnit: '%', sustainDuration: '连续 5 分钟', description: 'CPU 使用率 > 90%，连续 5 分钟' },
      trigger_action: 'warn',
      output_prompt: '智能体【胸部 CT 影像智能分析平台】在 12:30 - 12:35 内 CPU 使用率持续高于 90%，当前值：93.2%；建议：检查大文件推理请求或扩容实例。',
    },
    notifyTarget: { account: '影像科 · 智能体运维群组', owner: '黄帅帅', phone: '138****1234', email: 'huangss@hospital.com' },
    notifyChannels: ['系统通知', '短信通知'],
    status: 'pending_review',
    handler: '王伟',
    assignTime: '2026-06-26 12:38:00',
    assigner: '黄帅帅',
    handleStartTime: '2026-06-26 12:42:00',
    handleCompleteTime: '2026-06-26 13:05:00',
    handleResult: '已处理',
    handlePlan: '1) 排查 12:30-12:35 期间大文件推理请求，发现 3 例胸部 CT 三维重建并发触发；2) 已将推理队列并发上限由 8 调整为 4，并对超大请求自动排队；3) CPU 使用率已回落至 72%，后续观察 24h。',
    handleTimeline: [
      { time: '2026-06-26 12:38:00', action: '分派', operator: '黄帅帅', remark: '分派给 王伟' },
      { time: '2026-06-26 12:42:00', action: '开始处理', operator: '王伟', remark: '由 王伟 开始处理' },
      { time: '2026-06-26 13:05:00', action: '处理完成', operator: '王伟', remark: '1) 排查 12:30-12:35 期间大文件推理请求，发现 3 例胸部 CT 三维重建并发触发；2) 已将推理队列并发上限由 8 调整为 4，并对超大请求自动排队；3) CPU 使用率已回落至 72%，后续观察 24h。' },
    ],
    triggerTime: '2026-06-26 12:35:00',
  }),
  makeEvent({
    id: 'evt-v18-002',
    eventType: 'security',
    agentId: 'agent-006',
    agentName: '智能问诊系统',
    department: '内科',
    triggerContent: {
      rule_name: '提示词注入攻击告警',
      trigger_time: '2026-06-26 12:32:15',
      trigger_condition: { metric: '注入特征匹配数', operator: '>', threshold: 0, thresholdUnit: '次', sustainDuration: '实时', description: '提示词注入特征命中（实时）' },
      trigger_action: 'warn',
      output_prompt: '智能体【智能问诊系统】检测到提示词注入攻击，输入语句触发 12 项注入特征。',
    },
    notifyTarget: { account: '内科 · 智能体运维群组', owner: '王芳', phone: '139****5678', email: 'wangfang@hospital.com' },
    notifyChannels: ['系统通知', '邮箱通知'],
    status: 'pending_assign',
    triggerTime: '2026-06-26 12:32:15',
  }),
  makeEvent({
    id: 'evt-v18-003',
    eventType: 'cost',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    triggerContent: {
      rule_name: 'Token 异常增长告警',
      trigger_time: '2026-06-26 11:20:00',
      trigger_condition: { metric: 'Token 消耗', operator: '>', threshold: 30000, thresholdUnit: 'tokens/小时', sustainDuration: '10 分钟窗口', description: 'Token 消耗 > 7 日基线 × 3（10 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【胸部 CT 影像智能分析平台】Token 消耗超过基线 3 倍，当前值：38,520 tokens。',
    },
    notifyTarget: { account: '影像科 · 智能体运维群组', owner: '李华', phone: '137****9012', email: 'lihua@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'pending_assign',
    triggerTime: '2026-06-26 11:20:00',
  }),

  // 2. 待处理
  makeEvent({
    id: 'evt-v18-004',
    eventType: 'status',
    agentId: 'agent-005',
    agentName: '智能导诊与分诊系统',
    department: '急诊科',
    triggerContent: {
      rule_name: '智能体离线告警',
      trigger_time: '2026-06-25 18:00:00',
      trigger_condition: { metric: '心跳成功率', operator: '=', threshold: 0, thresholdUnit: '%', sustainDuration: '连续 3 次心跳', description: '心跳失败连续 3 次' },
      trigger_action: 'notify',
      output_prompt: '智能体【智能导诊与分诊系统】心跳失败连续 3 次，可能已离线。',
    },
    notifyTarget: { account: '急诊科 · 智能体运维群组', owner: '黄帅帅', phone: '138****1234', email: 'huangss@hospital.com' },
    notifyChannels: ['系统通知', '短信通知'],
    status: 'pending_handle',
    triggerTime: '2026-06-25 18:00:00',
    assignTime: '2026-06-25 18:05:00',
    assigner: '黄帅帅',
    handler: '李华',
    handleTimeline: [
      { time: '2026-06-25 18:00:00', action: '触发', operator: '系统', remark: '心跳失败连续 3 次' },
      { time: '2026-06-25 18:05:00', action: '分派', operator: '黄帅帅', remark: '分派给李华' },
    ],
  }),
  makeEvent({
    id: 'evt-v18-005',
    eventType: 'business',
    agentId: 'agent-008',
    agentName: '随访管理系统',
    department: '医务科',
    triggerContent: {
      rule_name: '任务完成率下降告警',
      trigger_time: '2026-06-26 09:00:00',
      trigger_condition: { metric: '任务完成率', operator: '<', threshold: 95, thresholdUnit: '%', sustainDuration: '15 分钟窗口', description: '任务完成率 < 95%（15 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【随访管理系统】任务完成率下降，当前值：93.2%。',
    },
    notifyTarget: { account: '医务科 · 智能体运维群组', owner: '王芳', phone: '139****5678', email: 'wangfang@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'pending_handle',
    triggerTime: '2026-06-26 09:00:00',
    assignTime: '2026-06-26 09:15:00',
    assigner: '黄帅帅',
    handler: '王芳',
    handleTimeline: [
      { time: '2026-06-26 09:00:00', action: '触发', operator: '系统', remark: '任务完成率 < 95%' },
      { time: '2026-06-26 09:15:00', action: '分派', operator: '黄帅帅', remark: '分派给王芳' },
      { time: '2026-06-26 09:30:00', action: '退回', operator: '王芳', remark: '工单信息不全，需补充' },
    ],
    returnReason: '需补充告警的完整截图与影响范围后再处理',
  }),

  // 3. 处理中
  makeEvent({
    id: 'evt-v18-006',
    eventType: 'business',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    triggerContent: {
      rule_name: '智能体 CPU 使用率过高告警',
      trigger_time: '2026-06-26 10:00:00',
      trigger_condition: { metric: 'CPU 使用率', operator: '>', threshold: 90, thresholdUnit: '%', sustainDuration: '连续 5 分钟', description: 'CPU 使用率 > 90%，连续 5 分钟' },
      trigger_action: 'warn',
      output_prompt: '智能体【胸部 CT 影像智能分析平台】CPU 持续高负载。',
    },
    notifyTarget: { account: '影像科 · 智能体运维群组', owner: '李华', phone: '137****9012', email: 'lihua@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'handling',
    triggerTime: '2026-06-26 10:00:00',
    assignTime: '2026-06-26 10:05:00',
    assigner: '黄帅帅',
    handler: '李华',
    handleStartTime: '2026-06-26 10:08:00',
    handleTimeline: [
      { time: '2026-06-26 10:00:00', action: '触发', operator: '系统' },
      { time: '2026-06-26 10:05:00', action: '分派', operator: '黄帅帅', remark: '分派给李华' },
      { time: '2026-06-26 10:08:00', action: '开始处理', operator: '李华', remark: '联系影像科确认业务增量' },
    ],
  }),

  // 4. 待审核
  makeEvent({
    id: 'evt-v18-007',
    eventType: 'business',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    department: '医务科',
    triggerContent: {
      rule_name: '任务完成率下降告警',
      trigger_time: '2026-06-26 08:00:00',
      trigger_condition: { metric: '任务完成率', operator: '<', threshold: 95, thresholdUnit: '%', sustainDuration: '15 分钟窗口', description: '任务完成率 < 95%（15 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【病历智能生成与质控系统】任务完成率下降至 93%。',
    },
    notifyTarget: { account: '医务科 · 智能体运维群组', owner: '王芳', phone: '139****5678', email: 'wangfang@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'pending_review',
    triggerTime: '2026-06-26 08:00:00',
    assignTime: '2026-06-26 08:10:00',
    assigner: '黄帅帅',
    handler: '王芳',
    handleStartTime: '2026-06-26 08:15:00',
    handleCompleteTime: '2026-06-26 09:30:00',
    handleResult: '已处理',
    handlePlan: '1) 检查 HIS 接口是否异常；2) 重启病历生成服务；3) 监控任务完成率回升至 96%。',
    handleTimeline: [
      { time: '2026-06-26 08:00:00', action: '触发', operator: '系统' },
      { time: '2026-06-26 08:10:00', action: '分派', operator: '黄帅帅', remark: '分派给王芳' },
      { time: '2026-06-26 08:15:00', action: '开始处理', operator: '王芳', remark: '联系 HIS 排查' },
      { time: '2026-06-26 09:30:00', action: '提交处理结果', operator: '王芳', remark: '问题已恢复，等待审核' },
    ],
  }),

  // 5. 审核中
  makeEvent({
    id: 'evt-v18-008',
    eventType: 'status',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    triggerContent: {
      rule_name: '实例心跳成功率下降',
      trigger_time: '2026-06-25 14:00:00',
      trigger_condition: { metric: '心跳成功率', operator: '<', threshold: 99.95, thresholdUnit: '%', sustainDuration: '10 分钟窗口', description: '心跳成功率 < 99.95%（10 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【心电图智能辅助诊断系统】心跳成功率下降。',
    },
    notifyTarget: { account: '心内科 · 智能体运维群组', owner: '李华', phone: '137****9012', email: 'lihua@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'reviewing',
    triggerTime: '2026-06-25 14:00:00',
    assignTime: '2026-06-25 14:05:00',
    assigner: '黄帅帅',
    handler: '李华',
    handleStartTime: '2026-06-25 14:10:00',
    handleCompleteTime: '2026-06-25 15:00:00',
    handleResult: '已处理',
    handlePlan: '重启了 1 个异常实例，配置告警回调 IP 列表。',
    handleTimeline: [
      { time: '2026-06-25 14:00:00', action: '触发', operator: '系统' },
      { time: '2026-06-25 14:05:00', action: '分派', operator: '黄帅帅' },
      { time: '2026-06-25 14:10:00', action: '开始处理', operator: '李华' },
      { time: '2026-06-25 15:00:00', action: '提交处理结果', operator: '李华' },
      { time: '2026-06-25 15:10:00', action: '审核中', operator: '黄帅帅', remark: '复核处置方案' },
    ],
    reviewer: '黄帅帅',
    reviewStartTime: '2026-06-25 15:10:00',
    reviewTime: '2026-06-25 15:10:00',
  }),

  // 6. 已关闭（业务 — 智能体 CPU 使用率过高告警）
  makeEvent({
    id: 'evt-v18-008b',
    eventType: 'business',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    triggerContent: {
      rule_name: '智能体 CPU 使用率过高告警',
      trigger_time: '2026-06-18 09:30:00',
      trigger_condition: { metric: 'CPU 使用率', operator: '>', threshold: 90, thresholdUnit: '%', sustainDuration: '连续 5 分钟', description: 'CPU 使用率 > 90%，连续 5 分钟' },
      trigger_action: 'warn',
      output_prompt: '智能体【胸部 CT 影像智能分析平台】CPU 使用率持续高于 90%。',
    },
    notifyTarget: { account: '影像科 · 智能体运维群组', owner: '黄帅帅', phone: '138****1234', email: 'huangss@hospital.com' },
    notifyChannels: ['系统通知', '短信通知'],
    status: 'closed',
    triggerTime: '2026-06-18 09:30:00',
    assignTime: '2026-06-18 09:35:00',
    assigner: '黄帅帅',
    handler: '黄帅帅',
    handleStartTime: '2026-06-18 09:40:00',
    handleCompleteTime: '2026-06-18 10:30:00',
    handleResult: '已处理',
    handlePlan: '扩容推理实例 1 台，将并发上限恢复至 8，CPU 使用率回落至 65%。',
    handleTimeline: [
      { time: '2026-06-18 09:30:00', action: '触发', operator: '系统' },
      { time: '2026-06-18 09:35:00', action: '分派', operator: '黄帅帅' },
      { time: '2026-06-18 09:40:00', action: '开始处理', operator: '黄帅帅' },
      { time: '2026-06-18 10:30:00', action: '提交处理结果', operator: '黄帅帅' },
      { time: '2026-06-18 11:00:00', action: '审核通过', operator: '黄帅帅', remark: '已扩容实例，问题闭环' },
    ],
    reviewer: '黄帅帅',
    reviewStartTime: '2026-06-18 10:35:00',
    reviewCompleteTime: '2026-06-18 11:00:00',
    reviewTime: '2026-06-18 11:00:00',
    reviewOpinion: '处理完成，关闭该告警事项',
    reviewRemark: '已扩容 1 台推理实例，CPU 使用率回落至 65%，问题闭环。',
  }),

  // 7. 已关闭（成本 — Token 异常增长告警）
  makeEvent({
    id: 'evt-v18-009',
    eventType: 'cost',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    triggerContent: {
      rule_name: 'Token 异常增长告警',
      trigger_time: '2026-06-20 11:00:00',
      trigger_condition: { metric: 'Token 消耗', operator: '>', threshold: 30000, thresholdUnit: 'tokens/小时', sustainDuration: '10 分钟窗口', description: 'Token 消耗 > 7 日基线 × 3（10 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【胸部 CT 影像智能分析平台】Token 消耗异常。',
    },
    notifyTarget: { account: '影像科 · 智能体运维群组', owner: '王芳', phone: '139****5678', email: 'wangfang@hospital.com' },
    handlerContact: { account: '影像科 · 智能体运维群组', owner: '王芳', phone: '139****5678', email: 'wangfang@hospital.com' },
    notifyChannels: ['系统通知', '短信通知', '邮箱通知'],
    status: 'closed',
    triggerTime: '2026-06-20 11:00:00',
    assignTime: '2026-06-20 11:05:00',
    assigner: '黄帅帅',
    handler: '王芳',
    handleStartTime: '2026-06-20 11:25:00',
    handleCompleteTime: '2026-06-20 14:00:00',
    handleResult: '已处理',
    handlePlan: '经影像科确认，6 月体检高峰带来的自然增量，已与财务对齐预算，规则基线更新至 10 万元/月。',
    handleTimeline: [
      { time: '2026-06-20 11:00:00', action: '触发', operator: '系统' },
      { time: '2026-06-20 11:05:00', action: '分派', operator: '黄帅帅' },
      { time: '2026-06-20 11:25:00', action: '开始处理', operator: '王芳' },
      { time: '2026-06-20 14:00:00', action: '提交处理结果', operator: '王芳' },
      { time: '2026-06-20 14:30:00', action: '审核通过', operator: '黄帅帅', remark: '问题已闭环，基线更新' },
    ],
    reviewer: '黄帅帅',
    reviewStartTime: '2026-06-20 14:05:00',
    reviewCompleteTime: '2026-06-20 14:30:00',
    reviewTime: '2026-06-20 14:30:00',
    reviewOpinion: '处理完成，关闭该告警事项',
    reviewRemark: '已确认是 6 月体检高峰带来的自然增量，基线更新已完成，问题闭环。',
  }),

  // === 科室管理员本人事件样本（用于演示 科室管理员 只能看到分派给自己的事件）===
  // DemoFloatButton 默认 科室管理员 = 李秀英（心内科），以下 5 条事件 handler='李秀英'，
  // 覆盖待处理 / 处理中 / 待审核 / 审核中 / 已关闭 5 个 Tab，让她能在「只看到自己」的前提下完整走通流程。
  makeEvent({
    id: 'evt-v18-011',
    eventType: 'status',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    triggerContent: {
      rule_name: '实例心跳成功率下降',
      trigger_time: '2026-06-27 09:12:00',
      trigger_condition: { metric: '心跳成功率', operator: '<', threshold: 99.95, thresholdUnit: '%', sustainDuration: '10 分钟窗口', description: '心跳成功率 < 99.95%（10 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【心电图智能辅助诊断系统】心跳成功率下降。',
    },
    notifyTarget: { account: '心内科 · 智能体运维群组', owner: '李秀英', phone: '139****1002', email: 'lixiuying@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'pending_handle',
    triggerTime: '2026-06-27 09:12:00',
    assignTime: '2026-06-27 09:18:00',
    assigner: '黄帅帅',
    handler: '李秀英',
    handleStartTime: '2026-06-27 09:25:00',
    handleResult: '已处理',
    handlePlan: '1) 检查心电图分析服务心跳包发送频率，发现有 2 个实例连续丢包；2) 重启丢包实例并刷新告警回调地址；3) 心跳成功率 10 分钟内回升至 99.98%，持续观察 30 分钟稳定。',
    handleTimeline: [
      { time: '2026-06-27 09:12:00', action: '触发', operator: '系统' },
      { time: '2026-06-27 09:18:00', action: '分派', operator: '黄帅帅', remark: '分派给 李秀英' },
      { time: '2026-06-27 09:25:00', action: '开始处理', operator: '李秀英', remark: '排查丢包实例' },
    ],
  }),
  makeEvent({
    id: 'evt-v18-012',
    eventType: 'business',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    triggerContent: {
      rule_name: 'P95 响应时延过高告警',
      trigger_time: '2026-06-27 08:30:00',
      trigger_condition: { metric: 'P95 响应时延', operator: '>', threshold: 5, thresholdUnit: 's', sustainDuration: '连续 5 分钟', description: 'P95 响应时延 > 5s，连续 5 分钟' },
      trigger_action: 'warn',
      output_prompt: '智能体【心电图智能辅助诊断系统】P95 响应时延过高，当前值：6.4s。',
    },
    notifyTarget: { account: '心内科 · 智能体运维群组', owner: '李秀英', phone: '139****1002', email: 'lixiuying@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'handling',
    triggerTime: '2026-06-27 08:30:00',
    assignTime: '2026-06-27 08:35:00',
    assigner: '黄帅帅',
    handler: '李秀英',
    handleStartTime: '2026-06-27 08:42:00',
    handleResult: '已处理',
    handlePlan: '1) 联系心内科确认 8:30 早高峰存在并发突增；2) 已将分析队列最大并发从 12 临时调整至 8；3) P95 响应时延已回落至 4.6s，待持续观察 15 分钟后申请提交审核。',
    handleTimeline: [
      { time: '2026-06-27 08:30:00', action: '触发', operator: '系统' },
      { time: '2026-06-27 08:35:00', action: '分派', operator: '黄帅帅', remark: '分派给 李秀英' },
      { time: '2026-06-27 08:42:00', action: '开始处理', operator: '李秀英', remark: '联系心内科确认并发增量' },
    ],
  }),
  makeEvent({
    id: 'evt-v18-013',
    eventType: 'business',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    triggerContent: {
      rule_name: '任务完成率下降告警',
      trigger_time: '2026-06-26 16:20:00',
      trigger_condition: { metric: '任务完成率', operator: '<', threshold: 95, thresholdUnit: '%', sustainDuration: '15 分钟窗口', description: '任务完成率 < 95%（15 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【心电图智能辅助诊断系统】任务完成率下降至 93%。',
    },
    notifyTarget: { account: '心内科 · 智能体运维群组', owner: '李秀英', phone: '139****1002', email: 'lixiuying@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'pending_review',
    triggerTime: '2026-06-26 16:20:00',
    assignTime: '2026-06-26 16:25:00',
    assigner: '黄帅帅',
    handler: '李秀英',
    handleStartTime: '2026-06-26 16:30:00',
    handleCompleteTime: '2026-06-26 17:30:00',
    handleResult: '已处理',
    handlePlan: '1) 检查心电图存储服务是否堆积；2) 重启分析队列；3) 任务完成率回升至 97%。',
    handleTimeline: [
      { time: '2026-06-26 16:20:00', action: '触发', operator: '系统' },
      { time: '2026-06-26 16:25:00', action: '分派', operator: '黄帅帅', remark: '分派给 李秀英' },
      { time: '2026-06-26 16:30:00', action: '开始处理', operator: '李秀英' },
      { time: '2026-06-26 17:30:00', action: '处理完成', operator: '李秀英', remark: '已重启分析队列，等待审核' },
    ],
  }),
  makeEvent({
    id: 'evt-v18-014',
    eventType: 'status',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    triggerContent: {
      rule_name: '实例心跳成功率下降',
      trigger_time: '2026-06-26 11:00:00',
      trigger_condition: { metric: '心跳成功率', operator: '<', threshold: 99.95, thresholdUnit: '%', sustainDuration: '10 分钟窗口', description: '心跳成功率 < 99.95%（10 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【心电图智能辅助诊断系统】心跳成功率下降。',
    },
    notifyTarget: { account: '心内科 · 智能体运维群组', owner: '李秀英', phone: '139****1002', email: 'lixiuying@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'reviewing',
    triggerTime: '2026-06-26 11:00:00',
    assignTime: '2026-06-26 11:05:00',
    assigner: '黄帅帅',
    handler: '李秀英',
    handleStartTime: '2026-06-26 11:10:00',
    handleCompleteTime: '2026-06-26 12:00:00',
    handleResult: '已处理',
    handlePlan: '重启了 1 个异常实例，调整告警回调 IP 列表。',
    handleTimeline: [
      { time: '2026-06-26 11:00:00', action: '触发', operator: '系统' },
      { time: '2026-06-26 11:05:00', action: '分派', operator: '黄帅帅' },
      { time: '2026-06-26 11:10:00', action: '开始处理', operator: '李秀英' },
      { time: '2026-06-26 12:00:00', action: '处理完成', operator: '李秀英' },
      { time: '2026-06-26 12:10:00', action: '审核中', operator: '黄帅帅', remark: '复核处置方案' },
    ],
    reviewer: '黄帅帅',
    reviewStartTime: '2026-06-26 12:10:00',
    reviewTime: '2026-06-26 12:10:00',
  }),
  makeEvent({
    id: 'evt-v18-015',
    eventType: 'cost',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    triggerContent: {
      rule_name: 'Token 异常增长告警',
      trigger_time: '2026-06-24 10:00:00',
      trigger_condition: { metric: 'Token 消耗', operator: '>', threshold: 30000, thresholdUnit: 'tokens/小时', sustainDuration: '10 分钟窗口', description: 'Token 消耗 > 7 日基线 × 3（10 分钟窗口）' },
      trigger_action: 'warn',
      output_prompt: '智能体【心电图智能辅助诊断系统】Token 消耗异常。',
    },
    notifyTarget: { account: '心内科 · 智能体运维群组', owner: '李秀英', phone: '139****1002', email: 'lixiuying@hospital.com' },
    handlerContact: { account: '心内科 · 智能体运维群组', owner: '李秀英', phone: '139****1002', email: 'lixiuying@hospital.com' },
    notifyChannels: ['系统通知', '短信通知'],
    status: 'closed',
    triggerTime: '2026-06-24 10:00:00',
    assignTime: '2026-06-24 10:05:00',
    assigner: '黄帅帅',
    handler: '李秀英',
    handleStartTime: '2026-06-24 10:20:00',
    handleCompleteTime: '2026-06-24 11:30:00',
    handleResult: '已处理',
    handlePlan: '已确认是下午体检高峰带来的自然增量，规则基线调整至 4 万元/月。',
    handleTimeline: [
      { time: '2026-06-24 10:00:00', action: '触发', operator: '系统' },
      { time: '2026-06-24 10:05:00', action: '分派', operator: '黄帅帅' },
      { time: '2026-06-24 10:20:00', action: '开始处理', operator: '李秀英' },
      { time: '2026-06-24 11:30:00', action: '处理完成', operator: '李秀英' },
      { time: '2026-06-24 12:00:00', action: '审核通过', operator: '黄帅帅', remark: '基线调整后问题闭环' },
    ],
    reviewer: '黄帅帅',
    reviewStartTime: '2026-06-24 11:35:00',
    reviewCompleteTime: '2026-06-24 12:00:00',
    reviewTime: '2026-06-24 12:00:00',
    reviewOpinion: '处理完成，关闭该告警事项',
    reviewRemark: '已确认是体检高峰带来的自然增量，基线更新已完成，问题闭环。',
  }),

  // 7. 已忽略
  makeEvent({
    id: 'evt-v18-010',
    eventType: 'status',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    department: '医务科',
    triggerContent: {
      rule_name: '运行版本与台账版本不一致',
      trigger_time: '2026-06-22 08:15:00',
      trigger_condition: { metric: '版本差异', operator: '=', threshold: 1, sustainDuration: '实时', description: '运行版本与台账版本不一致' },
      trigger_action: 'notify',
      output_prompt: '智能体【病历智能生成与质控系统】运行版本与台账版本不一致。',
    },
    notifyTarget: { account: '医务科 · 智能体运维群组', owner: '黄帅帅', phone: '138****1234', email: 'huangss@hospital.com' },
    notifyChannels: ['系统通知'],
    status: 'ignored',
    triggerTime: '2026-06-22 08:15:00',
    assignTime: '2026-06-22 08:20:00',
    assigner: '黄帅帅',
    handler: '黄帅帅',
    handleStartTime: '2026-06-22 08:25:00',
    handleCompleteTime: '2026-06-22 09:00:00',
    handleResult: '已忽略',
    handlePlan: '已确认为灰度发布过程态，灰度完成后会自动消除，无需处置。',
    handleTimeline: [
      { time: '2026-06-22 08:15:00', action: '触发', operator: '系统' },
      { time: '2026-06-22 08:20:00', action: '分派', operator: '黄帅帅' },
      { time: '2026-06-22 08:25:00', action: '开始处理', operator: '黄帅帅' },
      { time: '2026-06-22 09:00:00', action: '已忽略', operator: '黄帅帅', remark: '灰度发布过程态' },
    ],
    reviewOpinion: '同意忽略该告警事项',
    reviewRemark: '已确认属于灰度发布期间的预期版本差异，无需进一步处置。',
  }),
];

// ---------------------------------------------------------------------------
// 业务监控 KPI（V1.8 新口径）
// ---------------------------------------------------------------------------
export const businessKpiV18 = {
  taskSuccessRate: 96.8,
  taskInterruptRate: 2.1,
  avgReasoningSteps: 6.4,
  toolSelectionAccuracy: 97.6,
  toolExecutionSuccessRate: 98.9,
  totalPatients: 286_420,
  todayPatients: 2_368,
  totalCalls: 1_283_402,        // 累计调用次数
  successRate: 98.7,            // 累计成功率
  todayCalls: 12_834,           // 当日调用次数
  todaySuccessRate: 98.2,       // 当日成功率
  // 实时指标（动态波动图）
  concurrency: { current: 38, peak: 86 },
  throughput: { current: 12.4, peak: 28.6, unit: '次/秒' },
  // 平均响应时间
  avgResponseTime: 1.86,
  responseTimeP95: 3.72,
  responseTimeP99: 8.64,
  // 响应超时率
  timeoutRate: 2.4,
  // 医生采纳率
  adoptionRate: 89.5,
  // 用户反馈（满意 / 一般 / 不满意）
  feedback: { 满意: 78, 一般: 16, 不满意: 6 },
};

// 响应时间分布
export const responseTimeDistV18 = [
  { range: '<100ms', count: 1240 },
  { range: '100-300ms', count: 3520 },
  { range: '300ms-1s', count: 4520 },
  { range: '1s-3s', count: 1830 },
  { range: '3s-10s', count: 480 },
  { range: '>10s', count: 244 },
];

// TOP5 调用智能体
export const topCallAgentsV18 = [
  { rank: 1, agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', calls: 38420 },
  { rank: 2, agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', calls: 28560 },
  { rank: 3, agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', calls: 22340 },
  { rank: 4, agentId: 'agent-004', name: '处方智能审核与用药安全系统', department: '药剂科', calls: 19280 },
  { rank: 5, agentId: 'agent-007', name: '医学影像报告生成系统', department: '影像科', calls: 14620 },
];

// ---------------------------------------------------------------------------
// 状态监控 KPI（V1.8：在线 / 离线 / 禁用 / 异常）
// ---------------------------------------------------------------------------
export const statusKpiV18 = {
  online: 10,
  offline: 1,
  disabled: 1,
  abnormal: 1,
  total: 13,
  mttr: '18 分 36 秒',
  mtbf: '16 天 8 小时',
};

export const deptDistributionV18 = [
  { department: '心内科', online: 1, offline: 0, disabled: 0, abnormal: 0 },
  { department: '影像科', online: 1, offline: 0, disabled: 0, abnormal: 1 },
  { department: '医务科', online: 2, offline: 0, disabled: 0, abnormal: 0 },
  { department: '药剂科', online: 2, offline: 0, disabled: 0, abnormal: 0 },
  { department: '急诊科', online: 1, offline: 1, disabled: 0, abnormal: 0 },
  { department: '内科', online: 0, offline: 0, disabled: 1, abnormal: 0 },
  { department: '影像科(备)', online: 1, offline: 0, disabled: 0, abnormal: 0 },
  { department: '体检科', online: 1, offline: 0, disabled: 0, abnormal: 0 },
  { department: '检验科', online: 1, offline: 0, disabled: 0, abnormal: 0 },
];

// ---------------------------------------------------------------------------
// 成本监控 KPI（V1.8：CPU/GPU/内存/Token 累计 + 当日 + TOP5）
// ---------------------------------------------------------------------------
export const costKpiV18 = {
  cpu: { total: 12480, unit: '核·时', today: 386 },
  gpu: { total: 2640, unit: '卡·时', today: 92 },
  memory: { total: 8420, unit: 'GB·时', today: 248 },
  token: { total: 18_650_000, unit: 'tokens', today: 425_000 },
};

// 成本 TOP5 排行
export const costTop5V18 = {
  cpu: [
    { rank: 1, agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科', value: 4280 },
    { rank: 2, agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', value: 2640 },
    { rank: 3, agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', value: 1820 },
    { rank: 4, agentId: 'agent-007', name: '医学影像报告生成系统', department: '影像科', value: 1460 },
    { rank: 5, agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', value: 1280 },
  ],
  gpu: [
    { rank: 1, agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科', value: 1240 },
    { rank: 2, agentId: 'agent-007', name: '医学影像报告生成系统', department: '影像科', value: 640 },
    { rank: 3, agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', value: 380 },
    { rank: 4, agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', value: 220 },
    { rank: 5, agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', value: 160 },
  ],
  memory: [
    { rank: 1, agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科', value: 2640 },
    { rank: 2, agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', value: 1820 },
    { rank: 3, agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', value: 1280 },
    { rank: 4, agentId: 'agent-007', name: '医学影像报告生成系统', department: '影像科', value: 1080 },
    { rank: 5, agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', value: 880 },
  ],
  token: [
    { rank: 1, agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科', value: 6_280_000 },
    { rank: 2, agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', value: 4_120_000 },
    { rank: 3, agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', value: 2_980_000 },
    { rank: 4, agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', value: 2_640_000 },
    { rank: 5, agentId: 'agent-004', name: '处方智能审核与用药安全系统', department: '药剂科', value: 1_820_000 },
  ],
};

// ---------------------------------------------------------------------------
// 告警总览（V1.9 §1.1 — 相对 V1.8 新增累计告警总数、告警类型分布、智能体告警次数排行）
// ---------------------------------------------------------------------------
export const alertOverviewKpiV18 = {
  /** 累计告警总数（自上线以来，含未处理+已处理） */
  totalAll: 18_246,
  /** 当日告警总数（当天 00:00:00 至今，含未处理+已处理） */
  totalToday: 28,
  /** 未处理告警数（未完成闭环） */
  unhandled: 7,
  /** 已处理告警数（当日已完成闭环） */
  handled: 21,
};

// 趋势：近 15 天 / 15 周 / 12 月
export const alertTrendDailyV18 = Array.from({ length: 15 }, (_, i) => ({
  date: `06-${(12 + i).toString().padStart(2, '0')}`,
  count: Math.round(20 + Math.sin(i * 0.6) * 8 + (i > 10 ? 6 : 0)),
}));
export const alertTrendWeeklyV18 = Array.from({ length: 15 }, (_, i) => ({
  week: `W${(20 + i).toString().padStart(2, '0')}`,
  count: Math.round(120 + Math.sin(i * 0.5) * 30),
}));
export const alertTrendMonthlyV18 = Array.from({ length: 12 }, (_, i) => ({
  month: `${(i + 1).toString().padStart(2, '0')} 月`,
  count: Math.round(420 + Math.sin(i * 0.7) * 80),
}));

// 告警类型分布（V1.9 §1.1：业务监控告警 / 状态监控告警 / 成本监控告警 / 安全监控告警）
// 百分比按当前累计告警总数（totalAll = 18246）反推 → type 数值为累计触发次数
export const alertTypeDistributionV18 = [
  { type: 'business', label: '业务监控告警', count: 8_760, percent: 48.0 },
  { type: 'status', label: '状态监控告警', count: 4_562, percent: 25.0 },
  { type: 'cost', label: '成本监控告警', count: 2_737, percent: 15.0 },
  { type: 'security', label: '安全监控告警', count: 2_187, percent: 12.0 },
];

// 智能体告警次数排行 TOP5（V1.9 §1.1：触发异常告警次数 top5）
// 点击进入按关联智能体筛选的告警事件管理页
export const alertAgentRankingV18 = [
  { rank: 1, agentId: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科', count: 138 },
  { rank: 2, agentId: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科', count: 96 },
  { rank: 3, agentId: 'agent-005', name: '智能导诊与分诊系统', department: '急诊科', count: 72 },
  { rank: 4, agentId: 'agent-003', name: '病历智能生成与质控系统', department: '医务科', count: 58 },
  { rank: 5, agentId: 'agent-007', name: '医学影像报告生成系统', department: '影像科', count: 41 },
];
