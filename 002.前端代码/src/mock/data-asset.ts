/**
 * 医疗数据资产中心 Mock 数据
 * 对应需求文档 v1.3
 * 范围：仅 P0 —— 多轮对话全量采集 + JSON 导出
 *
 * 一级入口：
 *   - 数据集资产列表：数据集列表 / 详情 / 预览 / 导出抽屉
 *   - 采集任务列表：  采集任务列表 / 新建&编辑 / 监控看板 / 日志&异常重试
 */

export type CollectionStatus = '已启用' | '已停用' | '采集异常';
export type CollectionLogStatus = '成功' | '异常';
export type ExportTaskStatus = '排队中' | '打包中' | '已完成' | '已过期' | '失败';
export type ExportRecordScope = '全部' | '按采集时间范围' | '按当前筛选结果' | '按记录数上限';
export type ExportFormat = 'JSON' | 'HuggingFace' | 'CSV';
export type CollectionGranularity = '小时' | '天' | '周';

// ====== 智能体 ======
export interface AgentLite {
  id: string;
  name: string;
  department: string;
}

export const mockDatasetAgents: AgentLite[] = [
  { id: 'agent-001', name: '心电图智能辅助诊断系统', department: '心内科' },
  { id: 'agent-002', name: '胸部 CT 影像智能分析平台', department: '影像科' },
  { id: 'agent-003', name: '病历智能生成与质控系统', department: '病案室' },
  { id: 'agent-004', name: '处方智能审核与用药安全系统', department: '药剂科' },
  { id: 'agent-005', name: '智能导诊与分诊系统', department: '门诊部' },
  { id: 'agent-006', name: '检验报告智能解读系统', department: '检验科' },
];

// ====== 数据集 Schema ======
export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface DatasetSchema {
  version: string;
  fields: SchemaField[];
}

export const defaultSchema: DatasetSchema = {
  version: 'v1.0',
  fields: [
    { name: 'record_id', type: 'string', required: true, description: '记录唯一 ID（UUID）' },
    { name: 'agent_id', type: 'string', required: true, description: '智能体 ID' },
    { name: 'agent_name', type: 'string', required: true, description: '智能体名称' },
    { name: 'department', type: 'string', required: true, description: '所属科室' },
    { name: 'conversation_id', type: 'string', required: true, description: '多轮对话会话 ID' },
    { name: 'turns', type: 'array', required: true, description: '多轮对话内容（prompt + response）' },
    { name: 'turns[].role', type: 'string', required: true, description: '角色：user / assistant' },
    { name: 'turns[].content', type: 'string', required: true, description: '对话文本' },
    { name: 'turns[].timestamp', type: 'string', required: true, description: 'ISO 时间' },
    { name: 'token_count', type: 'number', required: false, description: '总 token 数' },
    { name: 'latency_ms', type: 'number', required: false, description: '响应耗时（毫秒）' },
    { name: 'task_id', type: 'string', required: true, description: '关联采集任务 ID' },
    { name: 'collected_at', type: 'string', required: true, description: '入库时间' },
  ],
};

// ====== 数据集 ======
export interface Dataset {
  id: string;
  name: string;
  description: string;
  agentId: string;
  agentName: string;
  department: string;
  schema: DatasetSchema;
  recordTotal: number;
  todayNew: number;
  last7dNew: number;
  createdAt: string;
  updatedAt: string;
  /** 兼容旧版评测中心：tags/version/sampleCount */
  tags?: string[];
  version?: string;
  sampleCount?: number;
}

const isoMinusHours = (h: number) => {
  const d = new Date('2026-06-03T10:00:00');
  d.setHours(d.getHours() - h);
  return d.toISOString();
};

const isoOffset = (h: number) => isoMinusHours(h);

export const mockDatasets: Dataset[] = [
  {
    id: 'ds-001',
    name: '心电图问诊对话数据集',
    description: '心电图智能体多轮问诊对话全量入库，用于问诊推理微调。',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    schema: defaultSchema,
    recordTotal: 12580,
    todayNew: 132,
    last7dNew: 942,
    createdAt: isoOffset(24 * 60),
    updatedAt: isoOffset(1),
    tags: ['辅助诊断', '通用'],
    version: 'v1.0',
    sampleCount: 12580,
  },
  {
    id: 'ds-002',
    name: '胸部 CT 报告对话数据集',
    description: '胸部 CT 影像智能体多轮报告解读对话，用于报告生成 SFT。',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    schema: defaultSchema,
    recordTotal: 8560,
    todayNew: 78,
    last7dNew: 521,
    createdAt: isoOffset(24 * 45),
    updatedAt: isoOffset(3),
    tags: ['影像分析', '通用'],
    version: 'v1.0',
    sampleCount: 8560,
  },
  {
    id: 'ds-003',
    name: '病历生成对话数据集',
    description: '病历智能体入院/出院小结多轮生成对话，用于文书生成 SFT。',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    department: '病案室',
    schema: defaultSchema,
    recordTotal: 45200,
    todayNew: 286,
    last7dNew: 1985,
    createdAt: isoOffset(24 * 50),
    updatedAt: isoOffset(0.5),
    tags: ['病历生成', '通用'],
    version: 'v1.0',
    sampleCount: 45200,
  },
  {
    id: 'ds-004',
    name: '处方审核对话数据集',
    description: '处方审核智能体多轮对话，含用户提问与审核结果。',
    agentId: 'agent-004',
    agentName: '处方智能审核与用药安全系统',
    department: '药剂科',
    schema: defaultSchema,
    recordTotal: 89600,
    todayNew: 540,
    last7dNew: 3820,
    createdAt: isoOffset(24 * 55),
    updatedAt: isoOffset(0.2),
    tags: ['用药审核', '通用'],
    version: 'v1.0',
    sampleCount: 89600,
  },
  {
    id: 'ds-005',
    name: '导诊分诊对话数据集',
    description: '智能导诊系统多轮对话，用于分诊推理 SFT。',
    agentId: 'agent-005',
    agentName: '智能导诊与分诊系统',
    department: '门诊部',
    schema: defaultSchema,
    recordTotal: 156000,
    todayNew: 1020,
    last7dNew: 7120,
    createdAt: isoOffset(24 * 70),
    updatedAt: isoOffset(0.1),
    tags: ['导诊分诊', '通用'],
    version: 'v1.0',
    sampleCount: 156000,
  },
];

export const getDatasetById = (id: string): Dataset | undefined =>
  mockDatasets.find((d) => d.id === id);

// ====== 采集任务 ======
export interface CollectionTask {
  id: string;
  name: string;
  description?: string;
  agentId: string;
  agentName: string;
  department: string;
  datasetId: string;
  datasetName: string;
  status: CollectionStatus;
  todayCount: number;
  totalCount: number;
  lastCollectedAt: string;
  exceptionCount: number;
  createdAt: string;
  createdBy: string;
}

export const mockCollectionTasks: CollectionTask[] = [
  {
    id: 'task-001',
    name: '心电图问诊-全量采集',
    description: '采集心电图智能体的所有多轮对话',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    department: '心内科',
    datasetId: 'ds-001',
    datasetName: '心电图问诊对话数据集',
    status: '已启用',
    todayCount: 132,
    totalCount: 12580,
    lastCollectedAt: isoOffset(0.1),
    exceptionCount: 0,
    createdAt: isoOffset(24 * 60),
    createdBy: '王建国',
  },
  {
    id: 'task-002',
    name: '胸部CT报告-全量采集',
    description: '采集胸部CT报告生成全量对话',
    agentId: 'agent-002',
    agentName: '胸部 CT 影像智能分析平台',
    department: '影像科',
    datasetId: 'ds-002',
    datasetName: '胸部 CT 报告对话数据集',
    status: '已启用',
    todayCount: 78,
    totalCount: 8560,
    lastCollectedAt: isoOffset(0.5),
    exceptionCount: 2,
    createdAt: isoOffset(24 * 45),
    createdBy: '李文博',
  },
  {
    id: 'task-003',
    name: '病历生成-全量采集',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    department: '病案室',
    datasetId: 'ds-003',
    datasetName: '病历生成对话数据集',
    status: '已停用',
    todayCount: 0,
    totalCount: 45200,
    lastCollectedAt: isoOffset(72),
    exceptionCount: 0,
    createdAt: isoOffset(24 * 50),
    createdBy: '王建国',
  },
  {
    id: 'task-004',
    name: '处方审核-全量采集',
    description: '采集处方审核多轮对话',
    agentId: 'agent-004',
    agentName: '处方智能审核与用药安全系统',
    department: '药剂科',
    datasetId: 'ds-004',
    datasetName: '处方审核对话数据集',
    status: '已启用',
    todayCount: 540,
    totalCount: 89600,
    lastCollectedAt: isoOffset(0.05),
    exceptionCount: 0,
    createdAt: isoOffset(24 * 55),
    createdBy: '陈思雨',
  },
  {
    id: 'task-005',
    name: '导诊分诊-全量采集',
    agentId: 'agent-005',
    agentName: '智能导诊与分诊系统',
    department: '门诊部',
    datasetId: 'ds-005',
    datasetName: '导诊分诊对话数据集',
    status: '采集异常',
    todayCount: 0,
    totalCount: 156000,
    lastCollectedAt: isoOffset(5),
    exceptionCount: 8,
    createdAt: isoOffset(24 * 70),
    createdBy: '王建国',
  },
];

// ====== 数据集记录（用于预览页 P1.3） ======
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DatasetRecord {
  id: string;
  datasetId: string;
  taskId: string;
  taskName: string;
  conversationId: string;
  summary: string;
  agentName: string;
  department: string;
  tokenCount: number;
  latencyMs: number;
  collectedAt: string;
  turns: ConversationTurn[];
}

const sampleConversations: Record<string, ConversationTurn[][]> = Object.freeze({
  'ds-001': [
    [
      { role: 'user', content: '患者男性，58 岁，主诉近一周心悸、胸闷。', timestamp: isoOffset(0.1) },
      { role: 'assistant', content: '建议先做静息心电图并结合动态心电监测；请确认有无高血压或糖尿病病史。', timestamp: isoOffset(0.1) },
      { role: 'user', content: '有 2 型糖尿病史，服用二甲双胍 0.5g bid。', timestamp: isoOffset(0.1) },
      { role: 'assistant', content: '心电图提示 ST 段轻微压低，建议完善冠脉 CTA 与心肌酶谱，并加用阿司匹林 100mg qd。', timestamp: isoOffset(0.1) },
    ],
    [
      { role: 'user', content: '心电图报告：窦性心律，V4-V6 ST 段下移 0.05-0.1mV。', timestamp: isoOffset(2) },
      { role: 'assistant', content: '提示心肌缺血可能，建议加做心脏彩超与运动平板试验，必要时冠脉造影明确诊断。', timestamp: isoOffset(2) },
    ],
  ],
  'ds-002': [
    [
      { role: 'user', content: '请解读胸部 CT 平扫影像：右肺下叶见 8mm 结节。', timestamp: isoOffset(3) },
      { role: 'assistant', content: '结节边缘可见毛刺征，建议 3 个月后低剂量 CT 复查，并结合肿瘤标志物综合判断。', timestamp: isoOffset(3) },
    ],
  ],
  'ds-003': [
    [
      { role: 'user', content: '请基于以下主诉生成入院记录：咳嗽 2 周，加重伴发热 3 天。', timestamp: isoOffset(5) },
      { role: 'assistant', content: '入院记录：患者中年女性，2 周前受凉后出现咳嗽，3 天前加重伴发热 T 38.7℃，伴咳痰。', timestamp: isoOffset(5) },
    ],
  ],
  'ds-004': [
    [
      { role: 'user', content: '请审核处方：阿莫西林 0.5g tid + 甲硝唑 0.4g tid。', timestamp: isoOffset(7) },
      { role: 'assistant', content: '审核结果：合理处方，无配伍禁忌；建议疗程 7 天并提示患者注意胃肠道反应。', timestamp: isoOffset(7) },
    ],
  ],
  'ds-005': [
    [
      { role: 'user', content: '我最近心口疼，挂了什么科？', timestamp: isoOffset(10) },
      { role: 'assistant', content: '建议您挂心血管内科门诊，必要时完善心电图与心肌酶检查。', timestamp: isoOffset(10) },
    ],
  ],
});

export const getMockDatasetRecords = (datasetId: string): DatasetRecord[] => {
  const ds = getDatasetById(datasetId);
  if (!ds) return [];
  const fallback: ConversationTurn[][] = sampleConversations['ds-001'];
  const samples: ConversationTurn[][] = sampleConversations[datasetId] ?? fallback;
  const records: DatasetRecord[] = [];
  const baseCount = Math.min(20, ds.recordTotal);
  for (let i = 0; i < baseCount; i++) {
    const turns = samples[i % samples.length];
    records.push({
      id: `${datasetId}-r-${(i + 1).toString().padStart(4, '0')}`,
      datasetId,
      taskId: ds.id.replace('ds-', 'task-'),
      taskName: ds.name.replace('数据集', '采集任务'),
      conversationId: `conv-${datasetId}-${i + 1}`,
      summary: turns.map((t) => t.content).join(' ').slice(0, 80),
      agentName: ds.agentName,
      department: ds.department,
      tokenCount: 200 + ((i * 73) % 1500),
      latencyMs: 800 + ((i * 47) % 2000),
      collectedAt: isoOffset(i * 0.6),
      turns,
    });
  }
  return records;
};

// ====== 采集日志 / 异常 ======
export type FailureReason =
  | '格式校验失败'
  | '连接超时'
  | 'Schema 不匹配'
  | '未知错误';

export interface CollectionLog {
  id: string;
  taskId: string;
  taskName: string;
  agentName: string;
  summary: string;
  status: CollectionLogStatus;
  failureReason?: FailureReason;
  retriedCount: number;
  lastFailedAt: string;
  payload?: string;
  stack?: string;
}

export const mockCollectionLogs: CollectionLog[] = [
  {
    id: 'log-001',
    taskId: 'task-002',
    taskName: '胸部CT报告-全量采集',
    agentName: '胸部 CT 影像智能分析平台',
    summary: '胸部 CT 平扫影像对话：右肺下叶 8mm 结节…',
    status: '成功',
    retriedCount: 0,
    lastFailedAt: isoOffset(0.5),
  },
  {
    id: 'log-002',
    taskId: 'task-002',
    taskName: '胸部CT报告-全量采集',
    agentName: '胸部 CT 影像智能分析平台',
    summary: '多轮对话包含非预期字段「image_url」',
    status: '异常',
    failureReason: 'Schema 不匹配',
    retriedCount: 2,
    lastFailedAt: isoOffset(1.2),
    payload: '{"turns":[{"role":"user","content":"…","image_url":"…"}]}',
    stack: 'Error: Schema mismatch at field "image_url"\n  at validateTurns (schema.ts:42)',
  },
  {
    id: 'log-003',
    taskId: 'task-005',
    taskName: '导诊分诊-全量采集',
    agentName: '智能导诊与分诊系统',
    summary: '对话采集触发 Callback 超时',
    status: '异常',
    failureReason: '连接超时',
    retriedCount: 4,
    lastFailedAt: isoOffset(5),
    payload: '{"turns":[{"role":"user","content":"我最近心口疼…"}]}',
    stack: 'Error: Callback handler timeout after 30000ms',
  },
  {
    id: 'log-004',
    taskId: 'task-005',
    taskName: '导诊分诊-全量采集',
    agentName: '智能导诊与分诊系统',
    summary: 'turns[].content 为空，校验失败',
    status: '异常',
    failureReason: '格式校验失败',
    retriedCount: 3,
    lastFailedAt: isoOffset(6),
  },
  {
    id: 'log-005',
    taskId: 'task-001',
    taskName: '心电图问诊-全量采集',
    agentName: '心电图智能辅助诊断系统',
    summary: '心电图问诊对话：58 岁男性心悸胸闷…',
    status: '成功',
    retriedCount: 0,
    lastFailedAt: isoOffset(0.1),
  },
  {
    id: 'log-006',
    taskId: 'task-004',
    taskName: '处方审核-全量采集',
    agentName: '处方智能审核与用药安全系统',
    summary: '处方审核对话：阿莫西林+甲硝唑…',
    status: '成功',
    retriedCount: 0,
    lastFailedAt: isoOffset(0.05),
  },
  {
    id: 'log-007',
    taskId: 'task-005',
    taskName: '导诊分诊-全量采集',
    agentName: '智能导诊与分诊系统',
    summary: '未知错误（agent 返回非 JSON）',
    status: '异常',
    failureReason: '未知错误',
    retriedCount: 1,
    lastFailedAt: isoOffset(8),
  },
];

// ====== 导出任务 ======
export interface ExportTask {
  id: string;
  datasetId: string;
  datasetName: string;
  submitter: string;
  submittedAt: string;
  status: ExportTaskStatus;
  format: ExportFormat;
  recordCount?: number;
  fileSize?: string;
  expireAt?: string;
  failureReason?: string;
  scope: ExportRecordScope;
  fields: string[];
}

export const mockExportTasks: ExportTask[] = [
  {
    id: 'exp-001',
    datasetId: 'ds-001',
    datasetName: '心电图问诊对话数据集',
    submitter: '王建国',
    submittedAt: isoOffset(6),
    status: '已完成',
    format: 'JSON',
    recordCount: 12580,
    fileSize: '342MB',
    expireAt: isoOffset(-24 * 1), // 6 天后过期
    scope: '全部',
    fields: defaultSchema.fields.map((f) => f.name),
  },
  {
    id: 'exp-002',
    datasetId: 'ds-003',
    datasetName: '病历生成对话数据集',
    submitter: '李文博',
    submittedAt: isoOffset(2),
    status: '打包中',
    format: 'JSON',
    scope: '按采集时间范围',
    fields: defaultSchema.fields.slice(0, 9).map((f) => f.name),
  },
  {
    id: 'exp-003',
    datasetId: 'ds-002',
    datasetName: '胸部 CT 报告对话数据集',
    submitter: '陈思雨',
    submittedAt: isoOffset(0.5),
    status: '排队中',
    format: 'JSON',
    scope: '全部',
    fields: defaultSchema.fields.map((f) => f.name),
  },
  {
    id: 'exp-004',
    datasetId: 'ds-004',
    datasetName: '处方审核对话数据集',
    submitter: '王建国',
    submittedAt: isoOffset(72),
    status: '已过期',
    format: 'JSON',
    recordCount: 89600,
    fileSize: '2.1GB',
    expireAt: isoOffset(72 - 24 * 7),
    scope: '全部',
    fields: defaultSchema.fields.map((f) => f.name),
  },
  {
    id: 'exp-005',
    datasetId: 'ds-005',
    datasetName: '导诊分诊对话数据集',
    submitter: '王建国',
    submittedAt: isoOffset(10),
    status: '失败',
    format: 'JSON',
    scope: '按记录数上限',
    fields: defaultSchema.fields.map((f) => f.name),
    failureReason: '记录数上限超出 10w 上限，请缩小导出范围',
  },
];

// ====== 监控看板（V1.4 已废弃，保留导出仅为兼容历史引用） ======
// 注：V1.4 取消「采集监控看板」独立入口与功能；以下数据不再被任何页面消费，
//    保留导出仅是出于「外部 import 失败会编译报错」的稳健性考虑。
export const mockCollectionTrend = (granularity: CollectionGranularity) => {
  if (granularity === '小时') {
    return [
      { time: '00:00', value: 412 },
      { time: '02:00', value: 386 },
      { time: '04:00', value: 358 },
      { time: '06:00', value: 460 },
      { time: '08:00', value: 712 },
      { time: '10:00', value: 968 },
      { time: '12:00', value: 1102 },
      { time: '14:00', value: 1256 },
      { time: '16:00', value: 1408 },
      { time: '18:00', value: 1322 },
      { time: '20:00', value: 1086 },
      { time: '22:00', value: 782 },
    ];
  }
  if (granularity === '天') {
    return [
      { time: '05-28', value: 18420 },
      { time: '05-29', value: 19280 },
      { time: '05-30', value: 20100 },
      { time: '05-31', value: 21860 },
      { time: '06-01', value: 22680 },
      { time: '06-02', value: 23480 },
      { time: '06-03', value: 12560 },
    ];
  }
  // 周
  return [
    { time: 'W18', value: 96800 },
    { time: 'W19', value: 102400 },
    { time: 'W20', value: 112800 },
    { time: 'W21', value: 121600 },
    { time: 'W22', value: 132500 },
  ];
};

export const mockAgentDistribution = [
  { type: '心电图智能辅助诊断系统', value: 12580 },
  { type: '胸部 CT 影像智能分析平台', value: 8560 },
  { type: '病历智能生成与质控系统', value: 45200 },
  { type: '处方智能审核与用药安全系统', value: 89600 },
  { type: '智能导诊与分诊系统', value: 156000 },
];

export const mockDepartmentDistribution = [
  { type: '心内科', value: 12580 },
  { type: '影像科', value: 8560 },
  { type: '病案室', value: 45200 },
  { type: '药剂科', value: 89600 },
  { type: '门诊部', value: 156000 },
];

export const mockTaskRanking = mockCollectionTasks
  .map((t) => ({ name: t.name, value: t.totalCount }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 10);
