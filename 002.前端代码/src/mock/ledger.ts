// 统一台账中心 - 全局 Mock 数据
import dayjs from 'dayjs';
// 对齐需求文档 V1.4：
//   ① 8 个业务核心字段（身份编码、名称、科室、来源、供应商、类型、功能关键词、版本）
//   ② 总览页 / 列表页 / 详情页统一数据源
//   ③ 三维度状态：lifecycleStatus / runtimeStatus / accessStatus
//   ④ 状态变更时间线核心 4 事件：开始试运行（进入台账）/ 正式上线 / 禁用 / 启用
//   ⑤ 台账侧不重复录入描述/功能描述（来自接入中心注册信息）

// ================== 1. 枚举与常量 ==================
export const ENUMS = {
  // 智能体类型
  agentType: [
    '辅助诊断',
    '影像分析',
    '病历生成',
    '用药审核',
    '导诊分诊',
    '智能问诊',
    '健康评估',
  ] as const,
  // V1.5 诊疗环节（接入中心 V2.1 唯一基准）
  diagnosisPhase: [
    '导诊分诊',
    '预问诊',
    '预约挂号',
    '辅助检查',
    '辅助诊断',
    '辅助治疗',
    '住院',
    '手术',
    '其他',
  ] as const,
  // V1.5 接入方式（接入中心 V2.1 三选一）
  accessType: ['API', 'SDK', 'OTel'] as const,
  // V1.5 已对接资源对接方式
  resourceLinkType: ['API', 'SDK', '数据库直连', '文件交换', '其他'] as const,
  // 科室（仅作枚举，实际台账从注册信息同步）
  department: [
    '信息中心',
    '内分泌科',
    '老年医学科',
    '影像科',
    '药剂科',
    '急诊科',
    '风湿免疫科',
    '重症医学科',
    '检验科',
    '心内科',
    '医务科',
  ] as const,
  // 智能体来源：业务核心筛选维度（区别于底层 modelSource）
  sourceType: ['自研', '外采', '合作开发'] as const,
  // 模型来源
  modelSource: ['自研', '商用', '开源'] as const,
  // 部署形态
  deploymentType: ['本地部署', '私有云', '公有云', '混合部署'] as const,
  // 技术架构
  techArch: ['大语言模型', '机器学习', '规则引擎', '多模态'] as const,
  // 接口协议
  interfaceProtocol: ['RESTful', 'gRPC', 'WebSocket', 'HL7/FHIR'] as const,
  // 认证方式
  authMethod: ['API Key', 'OAuth 2.0', 'mTLS 证书'] as const,
  // 生命周期状态（V1.4：3 状态保持 —— 试运行中 / 已上线 / 已禁用）
  //   - 智能体经评测通过 + 管理审核通过后进入台账，初始为「试运行中」
  //   - 评测相关状态（评测中/已接入）在评测中心查看
  //   - 「已禁用」由平台管理员在本中心操作
  lifecycleStatus: ['试运行中', '已上线', '已禁用'] as const,
  // 运行状态（仅已上线有效，V1.7 §2.2.1 #8：在线/离线/更新/禁用/异常）
  runtimeStatus: ['在线', '离线', '更新', '禁用', '异常'] as const,
  // ===== V1.5 风险分级（高度关注 / 中度关注 / 一般关注 + 待分级 / 待复核）=====
  riskLevel: ['高度关注', '中度关注', '一般关注', '待分级', '待复核'] as const,
  // ===== 权限治理枚举（V1.5 台账侧已下线；保留为其他模块兼容引用）=====
  businessSystem: ['HIS', 'LIS', 'PACS', 'EMR'] as const,
  // ===== 权限治理枚举（V1.5 台账侧已下线；保留为其他模块兼容引用）=====
  dataDomain: ['医生数据', '患者数据', '科室数据'] as const,
  // ===== 权限维度 =====
  permissionDimension: ['数据访问权限', '系统接口权限'] as const,
  // ===== 权限变更类型 =====
  permissionChangeType: ['新增', '撤销', '续期', '到期'] as const,
  // ===== 策略模板 =====
  policyTemplate: [
    '科室管理员默认权限',
    '外采智能体默认权限',
    '自研智能体默认权限',
    '试运行期最小权限',
  ] as const,
};

// ================== 2. 状态颜色映射（AntD 5 Tag color） ==================
// V1.4：3 状态 —— 试运行中（黄）/ 已上线（绿）/ 已禁用（橙）
export const STATUS_COLOR = {
  lifecycle: {
    试运行中: 'warning', // 黄
    已上线: 'success', // 绿
    已禁用: 'orange', // 橙（V1.4 表格 209 行 + 287 行）
  },
  runtime: {
    在线: 'success', // 绿
    离线: 'default', // 灰
    异常: 'error', // 红
    更新: 'gold', // 黄
    禁用: 'orange', // 橙
  },
  // V1.5 风险分级 Tag 配色
  risk: {
    高度关注: 'red',
    中度关注: 'orange',
    一般关注: 'default',
    待分级: 'default',
    待复核: 'gold',
  } as const,
} as const;

// 智能体来源 Tag 配色
export const SOURCE_COLOR: Record<string, string> = {
  自研: 'blue',
  外采: 'green',
  合作开发: 'purple',
};

// ================== 3. 当前用户上下文 ==================
export type LedgerUserRole = 'platform_admin' | 'dept_admin' | 'normal_user';

export interface LedgerUser {
  id: string;
  name: string;
  role: LedgerUserRole;
  department: string;
  avatar?: string;
}

export const currentUser: LedgerUser = {
  id: 'U001',
  name: '黄绍友',
  role: 'platform_admin',
  department: '信息中心',
};

// ================== 4. 智能体台账记录 ==================
export interface LifecycleTimelineItem {
  time: string;
  event: string;
  source: string;
}

// ====== V1.5 新增类型 ======

// 版本历史（点击版本号展开抽屉）
export interface VersionHistoryItem {
  version: string; // 版本号，如 v1.0 / v1.1
  onlineTime: string; // 版本上线时间 YYYY-MM-DD
  offlineTime?: string; // 版本下线时间 YYYY-MM-DD
  reportId?: string; // 关联评测报告 ID
}

// 备案材料（PDF）
export interface FilingAttachment {
  id: string;
  name: string; // 文件名
  size: string; // 大小（自动 B/KB/MB）
  uploadTime: string; // 上传时间 YYYY-MM-DD HH:mm
}

// 已对接资源（来源：医院资源管理中心）
export interface LinkedResource {
  id: string;
  name: string; // 资源名称（>15 字省略 + Tooltip）
  owner: string; // 资源负责人
  contact: string; // 联系方式
  linkType: (typeof ENUMS.resourceLinkType)[number]; // 对接方式
  linkNote?: string; // 其他对接方式说明
  // 360 画像视图（PRD §3.2.2 / §3.2.3）需要：在拓扑图中标注对接状态，异常连接醒目提示
  linkStatus?: 'normal' | 'abnormal'; // 资源对接状态（正常 / 异常），用于 360 画像拓扑图异常高亮
  // V2.8:多级辐射拓扑使用 — 决定节点落在哪一圈(1=核心圈 / 2=次圈 / 3=外圈 / 4=边缘)
  ring?: 1 | 2 | 3 | 4;
  // V2.8:节点卡片左上角系统类型徽标(PACS/HIS/EMR/LIS/NIS/MUSE/ESB/MQ/KM 等)
  subType?: string;
  // V2.9:资源关系图使用,parentId 为空表示直接连接中心智能体
  parentId?: string;
  // V2.9:节点层级,用于拓扑卡片文案与视觉分组
  nodeKind?: 'domain' | 'system' | 'platform' | 'interface' | 'data';
  // V2.9:Demo 精排角度,0=右侧,90=下方,-90=上方
  angleDeg?: number;
}

// 准入评测结果（四维得分）
export interface EvaluationDimensionScore {
  dimension: '能力' | '安全' | '伦理' | '鲁棒性';
  score: number; // 0~100
  weight: number; // 权重 0~1
}

export interface EvaluationSecurityDetail {
  name: string; // 如「输入安全」「输出安全」「行为安全」「数据安全」「工具安全」
  score: number; // 0~100
}

export interface EvaluationHistoryEntry {
  version: string;
  reportId: string;
  totalScore: number;
  evaluatedAt: string; // YYYY-MM-DD
  isRuntime?: boolean; // 是否运行期评测
}

export interface EvaluationReportSummary {
  reportId: string;
  totalScore: number; // 0~100
  dimensions: EvaluationDimensionScore[]; // 四维
  securityDetails: EvaluationSecurityDetail[]; // 安全性各维度明细
  history: EvaluationHistoryEntry[]; // 多次准入评测历史（按版本号升序累加）
  runtimeScore?: number; // 运行期评测分数
}

// 风险分级初判量表答案
export interface RiskInitialAnswers {
  Q1: 'A' | 'B' | 'C' | null; // 是否参与临床诊疗决策或治疗过程
  Q2: 'A' | 'B' | 'C' | null; // 核心功能类型
  Q3: 'A' | 'B' | 'C' | null; // 提供医疗信息支持的深度
  Q4: 'A' | 'B' | 'C' | null; // 错误时的影响
  Q5: 'A' | 'B' | 'C' | null; // 应用的医疗场景风险等级
  Q6: 'A' | 'B' | 'C' | null; // 处理的数据类型
  Q7: 'A' | 'B' | 'C' | null; // 对医疗系统/流程的控制能力
}

// ====== V1.2 新增：权限相关类型（4-4 智能体权限管理）======

// 授权状态
export type AuthorizationStatus = 'authorized' | 'expiring' | 'unauthorized' | 'revoked';

// 数据访问授权项（院内数据）
export interface DataAuthorization {
  id: string;
  domain: (typeof ENUMS.dataDomain)[number]; // 医生数据 / 患者数据 / 科室数据
  scope: string; // 授权范围说明
  grantor: string; // 授权人
  grantTime: string; // 授权时间 YYYY-MM-DD
  expireTime: string; // 有效期至 YYYY-MM-DD
  status: AuthorizationStatus;
}

// 系统接口授权项
export interface SystemInterfaceAuthorization {
  id: string;
  system: (typeof ENUMS.businessSystem)[number]; // HIS / LIS / PACS / EMR
  interfaceName: string; // 接口名称
  description?: string; // 接口权限说明 / 授权范围
  grantor: string;
  grantTime: string;
  expireTime: string;
  status: AuthorizationStatus;
}

// 权限变更记录
export interface PermissionChangeLog {
  id: string;
  time: string; // YYYY-MM-DD HH:mm
  dimension: (typeof ENUMS.permissionDimension)[number];
  changeType: (typeof ENUMS.permissionChangeType)[number];
  before: string;
  after: string;
  operator: string;
}

// 智能体权限完整描述
export interface AgentPermission {
  // 数据访问
  selfSessionAuthorized: true; // 自身会话始终授权（不可关闭）
  dataAuthorizations: DataAuthorization[]; // 院内数据授权列表
  // 系统接口
  systemAuthorizations: SystemInterfaceAuthorization[];
  // 变更记录（仅最近 10 条预览，完整由审计中心承载）
  recentChanges: PermissionChangeLog[];
}

// 策略模板（V1.2 权限治理 - 策略模板下发）
export interface PolicyTemplate {
  id: string;
  name: (typeof ENUMS.policyTemplate)[number] | string;
  description: string;
  matchCondition: string; // 匹配条件描述
  dataAuthorizations: { domain: (typeof ENUMS.dataDomain)[number]; scope: string }[];
  systemAuthorizations: { system: (typeof ENUMS.businessSystem)[number]; interfaceName: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface LedgerAgent {
  id: string;
  // ① 业务核心字段（来自接入中心注册信息，台账侧不重复录入）
  idCode: string; // 智能体编号：科室编号-准入顺序号（V1.5 口径）
  nameEn: string; // 英文名
  name: string; // 中文名
  department: string; // 所属科室名称
  departmentCode: string; // 科室编号
  sourceType: (typeof ENUMS.sourceType)[number]; // 智能体来源：自研/外采/合作开发
  vendor: string; // 供应商名称（自研时可空，限 30 字）
  type: (typeof ENUMS.agentType)[number];
  functionKeywords: string[]; // 功能关键词（多标签）
  version: string; // 当前版本号
  // ② 扩展技术信息
  modelSource: (typeof ENUMS.modelSource)[number];
  modelName: string;
  deploymentType: (typeof ENUMS.deploymentType)[number];
  techArch: (typeof ENUMS.techArch)[number];
  interfaceProtocol: (typeof ENUMS.interfaceProtocol)[number];
  interfaceUrl: string;
  authMethod: (typeof ENUMS.authMethod)[number];
  // ③ V1.5 功能描述（限 500 字）
  description?: string;
  // ④ V1.5 诊疗环节（接入中心 V2.1 唯一基准，多选以「/」分隔）
  diagnosisPhase: (typeof ENUMS.diagnosisPhase)[number][];
  // ⑤ V1.5 风险分级（初判 + 复核 + 标签）
  riskLevel: (typeof ENUMS.riskLevel)[number];
  riskInitial?: (typeof ENUMS.riskLevel)[number];
  riskReview?: (typeof ENUMS.riskLevel)[number];
  riskBasis?: string; // 初判依据
  riskReviewBasis?: string; // 复核依据（10-500 字）
  riskInitialAnswers?: RiskInitialAnswers;
  // ⑥ V1.5 技术联系人 + 联系方式
  techContact?: string;
  techContactPhone?: string;
  // ⑦ V1.5 接入方式（API / SDK / OTel 三选一）
  accessType: (typeof ENUMS.accessType)[number];
  apiKey?: string;
  sdkLanguage?: 'Java' | 'Python' | 'Node.js';
  // ⑧ 状态与生命周期
  lifecycleStatus: (typeof ENUMS.lifecycleStatus)[number];
  runtimeStatus?: (typeof ENUMS.runtimeStatus)[number];
  accessTime: string;
  onlineTime?: string;
  trialExpiresAt?: string;
  // ⑨ V1.5 运行指标
  callVolume?: { total: number; daily: number; weekly: number; monthly: number };
  alarmCount?: { total: number; daily: number; weekly: number; monthly: number };
  instanceOnlineRate?: number;
  // ⑩ V1.5 版本历史
  versionHistory: VersionHistoryItem[];
  // ⑪ V1.5 备案材料（PDF）
  filingAttachments: FilingAttachment[];
  // ⑫ V1.5 已对接资源
  linkedResources: LinkedResource[];
  // ⑬ V1.5 评测结果信息
  evaluationReport?: EvaluationReportSummary;
  // ⑭ 关联 + 时间线
  relatedFlows: Array<{ id: string; name: string }>;
  lifecycleTimeline: LifecycleTimelineItem[];
  // ⑮ V1.2 权限信息
  permissions: AgentPermission;
}

// V1.5 智能体编号生成（系统按「科室编号-准入顺序号」自动生成，不可修改）
// 注意：与 V1.4 不同 —— V1.5 不再与版本号绑定，编号一旦生成保持不变
export const buildAgentCode = (departmentCode: string, sequence: number) =>
  `${departmentCode}-${String(sequence).padStart(4, '0')}`;

// 兼容旧版字段（保留以防其他地方引用，但已废弃）
export const buildIdCode = (a: Pick<LedgerAgent, 'nameEn' | 'departmentCode' | 'version'>) =>
  `${a.nameEn}-${a.departmentCode}-${a.version}`;

// ================== 5. Mock 数据样例（30 条覆盖全状态/全类型） ==================
// 字段别名映射：旧枚举 (外采) → V1.5 口径（第三方）
const sourceAlias: Record<string, '自研' | '外采' | '合作开发'> = {
  自研: '自研',
  外采: '外采',
  合作开发: '合作开发',
};

// 随机诊疗环节（按类型分配合理组合）
const phaseByType: Record<string, (typeof ENUMS.diagnosisPhase)[number][]> = {
  辅助诊断: ['辅助诊断', '辅助检查'],
  影像分析: ['辅助检查', '辅助诊断'],
  病历生成: ['预问诊', '住院'],
  用药审核: ['辅助治疗', '住院', '手术'],
  导诊分诊: ['导诊分诊', '预约挂号'],
  智能问诊: ['预问诊', '导诊分诊'],
  健康评估: ['其他'],
};

// 默认诊疗环节 + 风险分级（确定性：依访问频度字段计算）
const genPhases = (type: string) => phaseByType[type] ?? ['其他'];

// 风险分级分布（按智能体来源/类型启发式）：自研→中度/一般，外采→高度/中度，合作研发→中度
const riskFor = (source: string, type: string): {
  riskLevel: (typeof ENUMS.riskLevel)[number];
  riskInitial?: (typeof ENUMS.riskLevel)[number];
  riskReview?: (typeof ENUMS.riskLevel)[number];
} => {
  // 影像分析、辅助诊断默认高风险
  if (type === '影像分析' || type === '辅助诊断') {
    return { riskLevel: '高度关注', riskInitial: '高度关注', riskReview: '高度关注' };
  }
  // 用药审核默认中度
  if (type === '用药审核') {
    return source === '外采'
      ? { riskLevel: '高度关注', riskInitial: '中度关注', riskReview: '高度关注' }
      : { riskLevel: '中度关注', riskInitial: '中度关注' };
  }
  // 病历生成 / 智能问诊
  if (type === '病历生成' || type === '智能问诊') {
    return source === '自研'
      ? { riskLevel: '一般关注', riskInitial: '一般关注' }
      : { riskLevel: '中度关注', riskInitial: '中度关注', riskReview: '中度关注' };
  }
  // 导诊分诊 / 健康评估
  return source === '外采'
    ? { riskLevel: '中度关注', riskInitial: '一般关注', riskReview: '中度关注' }
    : { riskLevel: '一般关注', riskInitial: '一般关注' };
};

// 默认运行指标
const metricsFor = (lifecycle: string, runtime: string | undefined) => {
  if (lifecycle === '已上线' && runtime === '在线') {
    return {
      callVolume: { total: 128500, daily: 4200, weekly: 28600, monthly: 115000 },
      alarmCount: { total: 6, daily: 0, weekly: 1, monthly: 4 },
      instanceOnlineRate: 1,
    };
  }
  if (lifecycle === '已上线' && runtime === '异常') {
    return {
      callVolume: { total: 98300, daily: 1800, weekly: 21000, monthly: 89000 },
      alarmCount: { total: 24, daily: 2, weekly: 6, monthly: 18 },
      instanceOnlineRate: 0,
    };
  }
  if (lifecycle === '已上线' && runtime === '离线') {
    return {
      callVolume: { total: 76500, daily: 0, weekly: 0, monthly: 0 },
      alarmCount: { total: 0, daily: 0, weekly: 0, monthly: 0 },
      instanceOnlineRate: 0,
    };
  }
  // 试运行中 / 已禁用
  return {
    callVolume: { total: 5200, daily: 280, weekly: 1800, monthly: 4900 },
    alarmCount: { total: 0, daily: 0, weekly: 0, monthly: 0 },
    instanceOnlineRate: 0,
  };
};

// 试运行到期日：accessTime + 6~16 天
const trialExpireFor = (accessTime: string) => {
  const start = new Date(accessTime);
  const offsetDays = 6 + (start.getDate() % 11); // 6~16 天
  const exp = new Date(start);
  exp.setDate(exp.getDate() + offsetDays);
  return exp.toISOString().slice(0, 10);
};

// ===== V1.5 接入方式 / 版本历史 / 备案材料 / 已对接资源 / 评测结果 =====

// 接入方式：按智能体类型分配
const accessTypeFor = (type: string, idx: number): 'API' | 'SDK' | 'OTel' => {
  if (type === '影像分析' || type === '用药审核') return idx % 2 === 0 ? 'API' : 'SDK';
  if (type === '智能问诊') return idx % 3 === 0 ? 'OTel' : 'API';
  if (type === '辅助诊断') return idx % 4 === 0 ? 'SDK' : 'API';
  return 'API';
};

// 版本历史：根据当前版本号生成 1~3 个历史版本（按版本号升序）
const versionHistoryFor = (currentVersion: string, agentId: string): VersionHistoryItem[] => {
  // 解析版本号（如 2.1 → [2,1]，兼容 2.1.0 与 v2.1.0 历史格式）
  const match = currentVersion.match(/^v?(\d+)\.(\d+)/);
  if (!match) return [];
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const items: VersionHistoryItem[] = [];
  // 生成 1.0, 1.1, ..., 当前版本（按时间顺序）
  if (major >= 2) {
    items.push({
      version: `${major - 1}.0`,
      onlineTime: '2023-06-15',
      offlineTime: '2024-08-20',
      reportId: `${agentId}-R0`,
    });
  }
  if (minor >= 1) {
    items.push({
      version: `${major}.${minor - 1}`,
      onlineTime: '2024-09-01',
      offlineTime: minor > 1 ? '2025-06-15' : undefined,
      reportId: `${agentId}-R${items.length + 1}`,
    });
  }
  items.push({
    version: currentVersion,
    onlineTime: '2025-06-20',
    reportId: `${agentId}-R${items.length + 1}`,
  });
  return items;
};

// 备案材料（PDF）
const filingAttachmentsFor = (raw: RawAgent): FilingAttachment[] => {
  if (raw.attachments && raw.attachments.length > 0) {
    return raw.attachments.map((a, i) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      uploadTime: `2025-${String(((parseInt(a.id.slice(1), 10) || 1) % 12) + 1).padStart(2, '0')}-15 10:30`,
    }));
  }
  // 默认至少 1 份
  return [
    { id: `${raw.id}-A1`, name: '产品说明书.pdf', size: '2.4MB', uploadTime: '2025-08-15 10:30' },
    { id: `${raw.id}-A2`, name: '技术规格书.pdf', size: '1.8MB', uploadTime: '2025-08-15 10:32' },
  ];
};

// 已对接资源（取自医院资源管理中心）
const linkedResourcesFor = (raw: RawAgent, idx: number): LinkedResource[] => {
  if (raw.id === 'AGT-2024-001') {
    // 360 画像视图:以 AskMed 智能体为中心,模拟其与院内业务域、系统平台、接口/数据资源的关系地图
    return [
      { id: `${raw.id}-D1`, name: '临床业务域', owner: '张文博', contact: '13910000000', linkType: 'API', linkStatus: 'normal', ring: 1, subType: 'CLINIC', nodeKind: 'domain', angleDeg: -90 },
      { id: `${raw.id}-D2`, name: '知识智库域', owner: '陈晓东', contact: '13900001003', linkType: 'SDK', linkStatus: 'normal', ring: 1, subType: 'KM', nodeKind: 'domain', angleDeg: 8 },
      { id: `${raw.id}-D3`, name: '患者服务域', owner: '赵欣', contact: '13900001009', linkType: 'API', linkStatus: 'normal', ring: 1, subType: 'PATIENT', nodeKind: 'domain', angleDeg: 98 },
      { id: `${raw.id}-D4`, name: '医保结算域', owner: '沈嘉', contact: '13900001010', linkType: 'API', linkStatus: 'abnormal', ring: 1, subType: 'PAY', nodeKind: 'domain', angleDeg: 178 },

      { id: `${raw.id}-S1`, name: '电子病历系统 EMR', owner: '李建华', contact: '13900001001', linkType: 'API', linkStatus: 'normal', ring: 2, subType: 'EMR', parentId: `${raw.id}-D1`, nodeKind: 'system', angleDeg: -130 },
      { id: `${raw.id}-S2`, name: 'HIS 主索引服务', owner: '王志远', contact: '13900001004', linkType: '数据库直连', linkStatus: 'normal', ring: 2, subType: 'HIS', parentId: `${raw.id}-D1`, nodeKind: 'system', angleDeg: -18 },
      { id: `${raw.id}-S3`, name: '院内医学知识库', owner: '陈晓东', contact: '13900001003', linkType: 'SDK', linkStatus: 'normal', ring: 2, subType: 'KM', parentId: `${raw.id}-D2`, nodeKind: 'platform', angleDeg: 26 },
      { id: `${raw.id}-S4`, name: '互联网医院平台', owner: '赵欣', contact: '13900001009', linkType: 'API', linkStatus: 'normal', ring: 2, subType: 'PORTAL', parentId: `${raw.id}-D3`, nodeKind: 'platform', angleDeg: 116 },
      { id: `${raw.id}-S5`, name: '医保结算系统', owner: '沈嘉', contact: '13900001010', linkType: '文件交换', linkStatus: 'abnormal', ring: 2, subType: 'PAY', parentId: `${raw.id}-D4`, nodeKind: 'system', angleDeg: 198 },

      { id: `${raw.id}-I1`, name: '患者基本信息接口', owner: '李建华', contact: '13900001001', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'API', parentId: `${raw.id}-S1`, nodeKind: 'interface', angleDeg: -156 },
      { id: `${raw.id}-I2`, name: '既往史摘要接口', owner: '李建华', contact: '13900001001', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'API', parentId: `${raw.id}-S1`, nodeKind: 'interface', angleDeg: -108 },
      { id: `${raw.id}-I3`, name: '预约挂号接口', owner: '王志远', contact: '13900001004', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'API', parentId: `${raw.id}-S2`, nodeKind: 'interface', angleDeg: -18 },
      { id: `${raw.id}-I4`, name: '诊疗指南知识库', owner: '陈晓东', contact: '13900001003', linkType: 'SDK', linkStatus: 'normal', ring: 3, subType: 'KM', parentId: `${raw.id}-S3`, nodeKind: 'data', angleDeg: 48 },
      { id: `${raw.id}-I5`, name: '在线问诊会话', owner: '赵欣', contact: '13900001009', linkType: 'SDK', linkStatus: 'normal', ring: 3, subType: 'CHAT', parentId: `${raw.id}-S4`, nodeKind: 'data', angleDeg: 138 },
      { id: `${raw.id}-I6`, name: '医保身份核验接口', owner: '沈嘉', contact: '13900001010', linkType: 'API', linkStatus: 'abnormal', ring: 3, subType: 'API', parentId: `${raw.id}-S5`, nodeKind: 'interface', angleDeg: 220 },

      { id: `${raw.id}-A1`, name: 'ESB 网关审计日志', owner: '刘洋', contact: '13900001008', linkType: '其他', linkNote: 'OTel Trace', linkStatus: 'normal', ring: 4, subType: 'ESB', parentId: `${raw.id}-I1`, nodeKind: 'data', angleDeg: -168 },
      { id: `${raw.id}-A2`, name: '预问诊结构化摘要', owner: '张文博', contact: '13910000000', linkType: 'API', linkStatus: 'normal', ring: 4, subType: 'DOC', parentId: `${raw.id}-I2`, nodeKind: 'data', angleDeg: -112 },
      { id: `${raw.id}-A3`, name: '异常对接工单', owner: '沈嘉', contact: '13900001010', linkType: '其他', linkNote: '监控告警联动', linkStatus: 'abnormal', ring: 4, subType: 'ALERT', parentId: `${raw.id}-I6`, nodeKind: 'data', angleDeg: 238 },
    ];
  }
  if (raw.id === 'AGT-2023-007') {
    // 员工心理健康评估系统:补齐 360 画像完整关联资源拓扑,
    // 覆盖业务域 / 院内系统 / 接口服务 / 数据与工单四层。
    return [
      { id: `${raw.id}-D1`, name: '员工健康业务域', owner: '林妍', contact: '13910000121', linkType: 'API', linkStatus: 'normal', ring: 1, subType: 'CLINIC', nodeKind: 'domain', angleDeg: -96 },
      { id: `${raw.id}-D2`, name: '人事组织域', owner: '周启明', contact: '13910000122', linkType: '数据库直连', linkStatus: 'normal', ring: 1, subType: 'HIS', nodeKind: 'domain', angleDeg: 4 },
      { id: `${raw.id}-D3`, name: '心理干预资源域', owner: '袁可', contact: '13910000123', linkType: 'SDK', linkStatus: 'normal', ring: 1, subType: 'KM', nodeKind: 'domain', angleDeg: 118 },
      { id: `${raw.id}-D4`, name: '隐私合规域', owner: '秦立', contact: '13910000124', linkType: 'API', linkStatus: 'normal', ring: 1, subType: 'ALERT', nodeKind: 'domain', angleDeg: 190 },

      { id: `${raw.id}-S1`, name: '员工主数据平台', owner: '周启明', contact: '13910000122', linkType: '数据库直连', linkStatus: 'normal', ring: 2, subType: 'HIS', parentId: `${raw.id}-D2`, nodeKind: 'platform', angleDeg: -146 },
      { id: `${raw.id}-S2`, name: '问卷量表系统', owner: '林妍', contact: '13910000121', linkType: 'API', linkStatus: 'normal', ring: 2, subType: 'API', parentId: `${raw.id}-D1`, nodeKind: 'system', angleDeg: -52 },
      { id: `${raw.id}-S3`, name: '心理援助知识库', owner: '袁可', contact: '13910000123', linkType: 'SDK', linkStatus: 'normal', ring: 2, subType: 'KM', parentId: `${raw.id}-D3`, nodeKind: 'platform', angleDeg: 62 },
      { id: `${raw.id}-S4`, name: '隐私脱敏网关', owner: '秦立', contact: '13910000124', linkType: 'API', linkStatus: 'normal', ring: 2, subType: 'ESB', parentId: `${raw.id}-D4`, nodeKind: 'platform', angleDeg: 168 },

      { id: `${raw.id}-I1`, name: '员工组织关系接口', owner: '周启明', contact: '13910000122', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'API', parentId: `${raw.id}-S1`, nodeKind: 'interface', angleDeg: -168 },
      { id: `${raw.id}-I2`, name: '匿名问卷提交接口', owner: '林妍', contact: '13910000121', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'CHAT', parentId: `${raw.id}-S2`, nodeKind: 'interface', angleDeg: -68 },
      { id: `${raw.id}-I3`, name: '心理干预建议接口', owner: '袁可', contact: '13910000123', linkType: 'SDK', linkStatus: 'normal', ring: 3, subType: 'API', parentId: `${raw.id}-S3`, nodeKind: 'interface', angleDeg: 52 },
      { id: `${raw.id}-I4`, name: '高风险预警接口', owner: '秦立', contact: '13910000124', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'ALERT', parentId: `${raw.id}-S4`, nodeKind: 'interface', angleDeg: 172 },

      { id: `${raw.id}-A1`, name: '心理量表题库', owner: '袁可', contact: '13910000123', linkType: 'SDK', linkStatus: 'normal', ring: 4, subType: 'DOC', parentId: `${raw.id}-I3`, nodeKind: 'data', angleDeg: -122 },
      { id: `${raw.id}-A2`, name: '脱敏评估结果集', owner: '秦立', contact: '13910000124', linkType: '文件交换', linkStatus: 'normal', ring: 4, subType: 'DOC', parentId: `${raw.id}-I2`, nodeKind: 'data', angleDeg: 18 },
      { id: `${raw.id}-A3`, name: '危机干预工单队列', owner: '林妍', contact: '13910000121', linkType: '其他', linkNote: 'MQ 消息订阅', linkStatus: 'normal', ring: 4, subType: 'MQ', parentId: `${raw.id}-I4`, nodeKind: 'data', angleDeg: 132 },
    ];
  }
  if (raw.idCode.startsWith('DiagAssist') || raw.idCode.startsWith('CTVision')) {
    // 360 画像视图（PRD §3.2.2/§3.2.3）:影像类智能体 EMR 正常 + PACS 异常,演示异常连接醒目提示
    // V2.8:多级辐射拓扑 — 节点分散到 4 层,演示 3-5 层视觉
    return [
      { id: `${raw.id}-R1`, name: '医学影像归档系统 PACS', owner: '王志远', contact: '13900001002', linkType: 'API', linkStatus: 'abnormal', ring: 1, subType: 'PACS' },
      { id: `${raw.id}-R2`, name: '电子病历系统 EMR', owner: '李建华', contact: '13900001001', linkType: 'API', linkStatus: 'normal', ring: 2, subType: 'EMR' },
      { id: `${raw.id}-R3`, name: '检验信息系统 LIS', owner: '周敏', contact: '13900001005', linkType: '数据库直连', linkStatus: 'normal', ring: 3, subType: 'LIS' },
      { id: `${raw.id}-R4`, name: '护理信息系统 NIS', owner: '高雪', contact: '13900001006', linkType: 'SDK', linkStatus: 'normal', ring: 4, subType: 'NIS' },
    ];
  }
  if (idx % 4 === 0) {
    return [
      { id: `${raw.id}-R1`, name: '院内知识库', owner: '陈晓东', contact: '13900001003', linkType: 'SDK', linkStatus: idx % 8 === 0 ? 'abnormal' : 'normal', ring: idx % 8 === 0 ? 1 : 2, subType: 'KM' },
    ];
  }
  if (idx % 3 === 0) {
    // V2.8:HIS 主索引放核心圈 ring=1,叠加 MUSE 演示心电数据接入
    return [
      { id: `${raw.id}-R1`, name: 'HIS 主索引服务', owner: '王志远', contact: '13900001004', linkType: '数据库直连', linkStatus: 'normal', ring: 1, subType: 'HIS' },
      { id: `${raw.id}-R2`, name: '心电网络 MUSE', owner: '黄海', contact: '13900001007', linkType: 'API', linkStatus: 'normal', ring: 3, subType: 'MUSE' },
    ];
  }
  if (idx % 5 === 0) {
    // V2.8:其余演示用 ESB/MQ 边缘圈节点
    return [
      { id: `${raw.id}-R1`, name: '企业服务总线 ESB', owner: '王志远', contact: '13900001004', linkType: 'API', linkStatus: 'normal', ring: 4, subType: 'ESB' },
      { id: `${raw.id}-R2`, name: '消息队列 MQ', owner: '刘洋', contact: '13900001008', linkType: '其他', linkStatus: 'normal', ring: 4, subType: 'MQ' },
    ];
  }
  return [];
};

// 风险分级初判依据
const riskBasisFor = (level: '高度关注' | '中度关注' | '一般关注' | '待分级' | '待复核', type: string): string => {
  if (level === '待分级' || level === '待复核') return '';
  if (level === '高度关注') return `根据风险分级量表判定：${type}类智能体参与诊疗决策或直接影响诊疗路径，依据 V1.5 §2.3 判定规则「Q1-Q7 任一选 C 即为高度关注」，综合判定为「高度关注」。建议在临床应用中加强监督与人工复核。`;
  if (level === '中度关注') return `根据风险分级量表判定：${type}类智能体提供医疗诊疗过程中的重要参考信息或关键技术支持，依据 V1.5 §2.3 判定规则「任一 B 即为中度关注」，综合判定为「中度关注」。建议定期评估其输出质量。`;
  return `根据风险分级量表判定：${type}类智能体未直接参与临床诊疗决策，依据 V1.5 §2.3 判定规则「全部 A 即为一般关注」，综合判定为「一般关注」。建议按常规流程管理。`;
};

// 评测结果（V1.5 §2.2.5）
const evaluationReportFor = (
  reportId: string | undefined,
  currentVersion: string,
  idx: number,
): EvaluationReportSummary | undefined => {
  if (!reportId) return undefined;
  const baseScore = 78 + (idx % 5) * 3;
  const total = Math.min(100, baseScore);
  const dimensions: EvaluationDimensionScore[] = [
    { dimension: '能力', score: Math.min(100, baseScore + 5), weight: 0.4 },
    { dimension: '安全', score: Math.max(50, baseScore - 3), weight: 0.25 },
    { dimension: '伦理', score: Math.min(100, baseScore + 1), weight: 0.2 },
    { dimension: '鲁棒性', score: Math.max(50, baseScore - 6), weight: 0.15 },
  ];
  const securityDetails: EvaluationSecurityDetail[] = [
    { name: '输入安全', score: Math.min(100, baseScore + 3) },
    { name: '输出安全', score: Math.max(60, baseScore - 1) },
    { name: '行为安全', score: Math.max(60, baseScore - 4) },
    { name: '数据安全', score: Math.max(60, baseScore + 2) },
    { name: '工具安全', score: Math.max(60, baseScore - 2) },
  ];
  // 多次准入评测历史（按版本号升序累加，不覆盖）
  const history: EvaluationHistoryEntry[] = [
    { version: '1.0', reportId: `${reportId}-R1`, totalScore: Math.max(60, total - 12), evaluatedAt: '2023-08-15' },
    { version: '1.1', reportId: `${reportId}-R2`, totalScore: Math.max(60, total - 6), evaluatedAt: '2024-06-20' },
    { version: currentVersion, reportId, totalScore: total, evaluatedAt: '2025-09-10' },
  ];
  return {
    reportId,
    totalScore: total,
    dimensions,
    securityDetails,
    history,
    runtimeScore: idx % 2 === 0 ? Math.max(60, total - 4) : undefined,
  };
};

// raw 类型：仅新增字段为可选（V1.5 诊疗环节 / 风险分级 / 运行指标 / 试运行到期日 / 接入方式等）
// 旧字段 attachments / evaluationReportId 在 V1.5 改名为 filingAttachments / evaluationReport，
// 通过扩展类型允许旧字段存在，并在 map 阶段统一转换。
type RawAgent = Omit<
  LedgerAgent,
  | 'permissions'
  | 'diagnosisPhase'
  | 'riskLevel'
  | 'riskInitial'
  | 'riskReview'
  | 'callVolume'
  | 'alarmCount'
  | 'instanceOnlineRate'
  | 'trialExpiresAt'
  | 'accessType'
  | 'versionHistory'
  | 'filingAttachments'
  | 'linkedResources'
  | 'evaluationReport'
> & {
  // 兼容旧字段名（V1.4 mock 数据）
  attachments?: Array<{ id: string; name: string; size: string }>;
  evaluationReportId?: string;
};

const ledgerAgentsRaw: RawAgent[] = [
  // ---------- 1. 已上线·智能问诊 ----------
  {
    id: 'AGT-2024-001',
    idCode: 'AskMed-INFO-3.0',
    nameEn: 'AskMed',
    name: '互联网医院智能问诊助手',
    department: '信息中心',
    departmentCode: 'INFO',
    sourceType: '外采',
    vendor: '杭州认知智能研究院',
    type: '智能问诊',
    functionKeywords: ['多轮问诊', '初步分诊', '症状识别', '用药建议'],
    version: '3.0',
    modelSource: '商用',
    modelName: '云医科技 AskMed-7B',
    deploymentType: '公有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'https://api.askmed.****.com/v1/chat',
    authMethod: 'API Key',
    description: '面向互联网医院患者的智能问诊助手，基于多轮对话采集主诉、现病史、既往史等信息，输出结构化预问诊摘要并给出就诊科室建议',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-06-15',
    onlineTime: '2024-09-01',
    evaluationReportId: 'EVAL-2024-001',
    relatedFlows: [
      { id: 'FLW-001', name: '门诊全流程协同' },
      { id: 'FLW-008', name: '在线轻问诊' },
    ],
    attachments: [
      { id: 'F001', name: '供应商资质证明.pdf', size: '1.2MB' },
      { id: 'F002', name: '安全认证报告.pdf', size: '3.4MB' },
    ],
    lifecycleTimeline: [
      { time: '2024-08-10 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-09-01 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 2. 已禁用·健康评估 ----------
  {
    id: 'AGT-2023-007',
    idCode: 'RiskLens-MED-1.0',
    nameEn: 'RiskLens',
    name: '员工心理健康评估系统',
    department: '医务科',
    departmentCode: 'MED',
    sourceType: '外采',
    vendor: '杭州认知智能研究院',
    type: '健康评估',
    functionKeywords: ['问卷评估', '风险预测', '情绪识别'],
    version: '1.0',
    modelSource: '商用',
    modelName: '认知医疗 RiskLens',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://10.0.****/risk',
    authMethod: 'mTLS 证书',
    description: '面向医院员工的标准化心理健康评估问卷系统，自动评分、识别高风险个体并推送心理援助资源',
    lifecycleStatus: '已禁用',
    runtimeStatus: undefined,
    accessTime: '2023-09-01',
    onlineTime: '2023-11-15',
    evaluationReportId: 'EVAL-2023-007',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2023-11-15 10:00', event: '正式上线', source: '监控中心' },
      { time: '2024-08-10 14:20', event: '禁用', source: '台账中心' },
      { time: '2025-03-18 09:30', event: '启用', source: '台账中心' },
      { time: '2025-12-20 16:30', event: '禁用', source: '台账中心' },
    ],
  },
  // ---------- 3. 试运行中·智能问诊（V1.3：评测通过后入台即试运行中）----------
  {
    id: 'AGT-2026-003',
    idCode: 'HealthVoice-ENDO-0.8',
    nameEn: 'HealthVoice',
    name: '门诊预问诊语音交互系统',
    department: '内分泌科',
    departmentCode: 'ENDO',
    sourceType: '外采',
    vendor: '广州云医科技集团',
    type: '智能问诊',
    functionKeywords: ['语音识别', '主诉结构化', '现病史', '多模态'],
    version: '0.8',
    modelSource: '商用',
    modelName: '诺道智能 HealthVoice',
    deploymentType: '公有云',
    techArch: '多模态',
    interfaceProtocol: 'WebSocket',
    interfaceUrl: 'wss://api.nordbot.****/voice',
    authMethod: 'OAuth 2.0',
    description: '门诊预问诊语音交互系统，支持患者通过自然语音描述症状，自动转写并生成结构化主诉摘要',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-03-01',
    onlineTime: undefined,
    evaluationReportId: 'EVAL-2026-003',
    relatedFlows: [],
    attachments: [{ id: 'F010', name: '语音识别准确率测试报告.pdf', size: '2.1MB' }],
    lifecycleTimeline: [
      { time: '2026-04-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 4. 已上线·辅助诊断 ----------
  {
    id: 'AGT-2025-002',
    idCode: 'DiagAssist-CARD-2.1',
    nameEn: 'DiagAssist',
    name: '心血管辅助诊断系统',
    department: '心内科',
    departmentCode: 'CARD',
    sourceType: '自研',
    vendor: '',
    type: '辅助诊断',
    functionKeywords: ['心电图分析', '风险分层', '诊断建议'],
    version: '2.1',
    modelSource: '自研',
    modelName: '心内专科 DiagNet-2',
    deploymentType: '私有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://diag.****/api/v2/ecg',
    authMethod: 'OAuth 2.0',
    description: '面向心血管内科的辅助诊断系统，自动分析心电图、心脏超声等检查，输出风险分级与可疑诊断提示',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-12-10',
    onlineTime: '2025-02-20',
    evaluationReportId: 'EVAL-2025-002',
    relatedFlows: [{ id: 'FLW-002', name: '胸痛中心协同' }],
    attachments: [
      { id: 'F003', name: '算法备案说明.pdf', size: '0.9MB' },
      { id: 'F004', name: '伦理审查意见.pdf', size: '1.5MB' },
    ],
    lifecycleTimeline: [
      { time: '2025-02-01 09:30', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2025-02-20 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 5. 已上线·异常·影像分析 ----------
  {
    id: 'AGT-2025-005',
    idCode: 'CTVision-RAD-1.5',
    nameEn: 'CTVision',
    name: '胸部 CT 影像分析系统',
    department: '影像科',
    departmentCode: 'RAD',
    sourceType: '外采',
    vendor: '上海智像医疗科技',
    type: '影像分析',
    functionKeywords: ['肺结节检测', '良恶性预测', '影像分割'],
    version: '1.5',
    modelSource: '商用',
    modelName: '智像 CT-Vision',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'HL7/FHIR',
    interfaceUrl: 'http://pacs.****/api/ct',
    authMethod: 'mTLS 证书',
    description: '面向胸部 CT 的影像分析系统，自动检测肺结节、测量径长、评估良恶性倾向，输出结构化影像所见',
    lifecycleStatus: '已上线',
    runtimeStatus: '异常',
    accessTime: '2025-03-22',
    onlineTime: '2025-06-01',
    evaluationReportId: 'EVAL-2025-005',
    relatedFlows: [{ id: 'FLW-003', name: '肺癌早筛协同' }],
    attachments: [
      { id: 'F005', name: '诊断准确率报告.pdf', size: '4.2MB' },
    ],
    lifecycleTimeline: [
      { time: '2025-04-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2025-06-01 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 6. 试运行中·病历生成 ----------
  {
    id: 'AGT-2026-001',
    idCode: 'NoteGen-GER-1.2',
    nameEn: 'NoteGen',
    name: '老年病历智能生成助手',
    department: '老年医学科',
    departmentCode: 'GER',
    sourceType: '合作开发',
    vendor: '北京医智科技',
    type: '病历生成',
    functionKeywords: ['病历生成', '语音转写', '结构化输出', '质控提醒'],
    version: '1.2',
    modelSource: '商用',
    modelName: '医智 NoteLLM',
    deploymentType: '私有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://note.****/api/v1',
    authMethod: 'API Key',
    description: '面向老年医学科的病历智能生成助手，整合主诉、查体、辅助检查等信息形成规范化老年综合评估病程记录',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-02-10',
    onlineTime: undefined,
    evaluationReportId: 'EVAL-2026-001',
    relatedFlows: [],
    attachments: [{ id: 'F006', name: '病历质控规则.pdf', size: '2.0MB' }],
    lifecycleTimeline: [
      { time: '2026-04-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 7. 已上线·离线·用药审核 ----------
  {
    id: 'AGT-2024-004',
    idCode: 'RxCheck-PHA-2.0',
    nameEn: 'RxCheck',
    name: '住院用药审核系统',
    department: '药剂科',
    departmentCode: 'PHA',
    sourceType: '自研',
    vendor: '',
    type: '用药审核',
    functionKeywords: ['配伍禁忌', '剂量校验', '药物相互作用'],
    version: '2.0',
    modelSource: '自研',
    modelName: '药剂 Rx-Rules',
    deploymentType: '本地部署',
    techArch: '规则引擎',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://rx.****/check',
    authMethod: 'API Key',
    description: '面向住院医嘱的合理用药审核引擎，识别配伍禁忌、剂量异常、过敏药物、相互作用等问题并给出拦截建议',
    lifecycleStatus: '已上线',
    runtimeStatus: '离线',
    accessTime: '2024-04-01',
    onlineTime: '2024-07-01',
    evaluationReportId: 'EVAL-2024-004',
    relatedFlows: [{ id: 'FLW-004', name: '合理用药协同' }],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-05-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-07-01 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 8. 试运行中·辅助诊断 ----------
  {
    id: 'AGT-2026-002',
    idCode: 'TriageBot-EMG-0.9',
    nameEn: 'TriageBot',
    name: '急诊智能分诊机器人',
    department: '急诊科',
    departmentCode: 'EMG',
    sourceType: '合作开发',
    vendor: '深圳医工智能研究院',
    type: '导诊分诊',
    functionKeywords: ['智能分诊', '病情评估', '优先级判定'],
    version: '0.9',
    modelSource: '开源',
    modelName: 'OpenTriage-7B',
    deploymentType: '混合部署',
    techArch: '大语言模型',
    interfaceProtocol: 'gRPC',
    interfaceUrl: 'grpc://triage.****/v1',
    authMethod: 'mTLS 证书',
    description: '面向急诊预检台的智能分诊机器人，根据患者主诉与生命体征自动判定就诊级别并推荐就诊科室',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-04-05',
    onlineTime: undefined,
    evaluationReportId: 'EVAL-2026-002',
    relatedFlows: [],
    attachments: [{ id: 'F007', name: '开源模型说明.pdf', size: '0.6MB' }],
    lifecycleTimeline: [
      { time: '2026-05-25 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 9. 已上线·导诊分诊 ----------
  {
    id: 'AGT-2025-006',
    idCode: 'GuideBot-INFO-1.8',
    nameEn: 'GuideBot',
    name: '门诊导诊机器人',
    department: '信息中心',
    departmentCode: 'INFO',
    sourceType: '外采',
    vendor: '杭州认知智能研究院',
    type: '导诊分诊',
    functionKeywords: ['科室推荐', '路径规划', '知识问答'],
    version: '1.8',
    modelSource: '商用',
    modelName: '认知 GuideLLM',
    deploymentType: '公有云',
    techArch: '大语言模型',
    interfaceProtocol: 'WebSocket',
    interfaceUrl: 'wss://guide.****/v1/ws',
    authMethod: 'API Key',
    description: '面向门诊大厅的导诊机器人，识别患者主诉推荐对应科室与就诊路径，支持语音/触屏双交互',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-08-12',
    onlineTime: '2024-11-01',
    evaluationReportId: 'EVAL-2025-006',
    relatedFlows: [{ id: 'FLW-005', name: '门诊导诊' }],
    attachments: [{ id: 'F008', name: '部署拓扑图.pdf', size: '1.0MB' }],
    lifecycleTimeline: [
      { time: '2024-09-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-11-01 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 10. 试运行中·影像分析 ----------
  {
    id: 'AGT-2026-004',
    idCode: 'MRIVis-RAD-0.5',
    nameEn: 'MRIVis',
    name: '颅脑 MRI 分割系统',
    department: '影像科',
    departmentCode: 'RAD',
    sourceType: '外采',
    vendor: '上海智像医疗科技',
    type: '影像分析',
    functionKeywords: ['脑区分割', '病灶标注', '体积测量'],
    version: '0.5',
    modelSource: '商用',
    modelName: '智像 MRI-Seg',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'HL7/FHIR',
    interfaceUrl: 'http://mri.****/seg',
    authMethod: 'mTLS 证书',
    description: '面向颅脑 MRI 的病灶分割系统，自动识别梗死、出血、白质病变等异常区域并量化体积',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-05-08',
    onlineTime: undefined,
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2026-05-28 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 11. 已上线·健康评估 ----------
  {
    id: 'AGT-2025-008',
    idCode: 'Wellness-INFO-1.0',
    nameEn: 'Wellness',
    name: '员工健康档案智能分析',
    department: '信息中心',
    departmentCode: 'INFO',
    sourceType: '自研',
    vendor: '',
    type: '健康评估',
    functionKeywords: ['健康画像', '风险预警', '年度报告'],
    version: '1.0',
    modelSource: '自研',
    modelName: 'Wellness-LLM',
    deploymentType: '私有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://well.****/api',
    authMethod: 'OAuth 2.0',
    description: '面向员工健康档案的智能分析系统，整合体检、门诊、慢病数据生成个体健康画像与年度趋势报告',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-10-18',
    onlineTime: '2025-01-10',
    evaluationReportId: 'EVAL-2025-008',
    relatedFlows: [],
    attachments: [{ id: 'F009', name: '自研模型说明.pdf', size: '1.3MB' }],
    lifecycleTimeline: [
      { time: '2024-11-10 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2025-01-10 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 12. 已上线·病历生成 ----------
  {
    id: 'AGT-2024-009',
    idCode: 'EMRAssist-INFO-1.6',
    nameEn: 'EMRAssist',
    name: '电子病历辅助录入',
    department: '信息中心',
    departmentCode: 'INFO',
    sourceType: '合作开发',
    vendor: '北京医智科技',
    type: '病历生成',
    functionKeywords: ['病历模板', '语音录入', '医学实体识别'],
    version: '1.6',
    modelSource: '商用',
    modelName: '医智 NoteLLM',
    deploymentType: '私有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://emr.****/assist',
    authMethod: 'API Key',
    description: '面向住院医师的电子病历辅助录入助手，支持口述/草稿自动转写为结构化病历内容并填充至对应字段',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-03-08',
    onlineTime: '2024-05-20',
    evaluationReportId: 'EVAL-2024-009',
    relatedFlows: [{ id: 'FLW-006', name: '住院病历协同' }],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-03-20 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-05-20 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 13. 已上线·用药审核·内分泌 ----------
  {
    id: 'AGT-2024-010',
    idCode: 'EndocrineRx-ENDO-1.2',
    nameEn: 'EndocrineRx',
    name: '内分泌科合理用药助手',
    department: '内分泌科',
    departmentCode: 'ENDO',
    sourceType: '自研',
    vendor: '',
    type: '用药审核',
    functionKeywords: ['专科用药', '剂量调整', '禁忌提醒'],
    version: '1.2',
    modelSource: '自研',
    modelName: 'ENDO-RxRules',
    deploymentType: '本地部署',
    techArch: '规则引擎',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://endo-rx.****/check',
    authMethod: 'API Key',
    description: '面向内分泌科的合理用药助手，重点关注糖尿病、甲状腺、骨代谢等长期用药方案的剂量与配伍审核',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-02-01',
    onlineTime: '2024-04-10',
    evaluationReportId: 'EVAL-2024-010',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-02-10 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-04-10 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 14. 已禁用·辅助诊断 ----------
  {
    id: 'AGT-2022-011',
    idCode: 'LegacyDiag-CARD-0.8',
    nameEn: 'LegacyDiag',
    name: '心电辅助诊断 V0（旧）',
    department: '心内科',
    departmentCode: 'CARD',
    sourceType: '外采',
    vendor: '深圳医工智能研究院',
    type: '辅助诊断',
    functionKeywords: ['心电分析', 'ST段识别'],
    version: '0.8',
    modelSource: '商用',
    modelName: 'Cardio-Legacy',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://legacy.****/ecg',
    authMethod: 'API Key',
    description: '心电辅助诊断 V0 旧版本（已下线归档），保留数据用于历史报告回溯与新旧版本对比分析',
    lifecycleStatus: '已禁用',
    runtimeStatus: undefined,
    accessTime: '2022-06-01',
    onlineTime: '2022-09-01',
    evaluationReportId: 'EVAL-2022-011',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2022-09-01 10:00', event: '正式上线', source: '监控中心' },
      { time: '2023-06-15 11:00', event: '禁用', source: '台账中心' },
      { time: '2024-02-20 10:30', event: '启用', source: '台账中心' },
      { time: '2024-11-01 16:00', event: '禁用', source: '台账中心' },
    ],
  },
  // ---------- 15. 试运行中·辅助诊断·重症 ----------
  {
    id: 'AGT-2026-005',
    idCode: 'ICUWatch-ICU-1.0',
    nameEn: 'ICUWatch',
    name: 'ICU 早期预警系统',
    department: '重症医学科',
    departmentCode: 'ICU',
    sourceType: '合作开发',
    vendor: '深圳医工智能研究院',
    type: '辅助诊断',
    functionKeywords: ['早期预警', '评分系统', '多参数融合'],
    version: '1.0',
    modelSource: '商用',
    modelName: 'ICU-EWS',
    deploymentType: '私有云',
    techArch: '机器学习',
    interfaceProtocol: 'HL7/FHIR',
    interfaceUrl: 'http://icu.****/ews',
    authMethod: 'mTLS 证书',
    description: '面向 ICU 的早期预警系统，实时监测生命体征与检验指标，识别恶化趋势并提前推送预警信息',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-01-20',
    onlineTime: undefined,
    evaluationReportId: 'EVAL-2026-005',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2026-04-20 10:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 16. 已上线·在线·辅助诊断·检验 ----------
  {
    id: 'AGT-2025-012',
    idCode: 'LabInsight-LAB-1.3',
    nameEn: 'LabInsight',
    name: '检验报告智能解读',
    department: '检验科',
    departmentCode: 'LAB',
    sourceType: '外采',
    vendor: '上海智像医疗科技',
    type: '辅助诊断',
    functionKeywords: ['报告解读', '异常值提示', '趋势分析'],
    version: '1.3',
    modelSource: '商用',
    modelName: '智像 LabAI',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'HL7/FHIR',
    interfaceUrl: 'http://lab.****/insight',
    authMethod: 'mTLS 证书',
    description: '面向检验报告的智能解读系统，对异常指标给出提示、可能病因与建议复查项目',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-11-15',
    onlineTime: '2025-01-08',
    evaluationReportId: 'EVAL-2025-012',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-11-08 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2025-01-08 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 17. 已上线·用药审核·风湿 ----------
  {
    id: 'AGT-2024-013',
    idCode: 'ImmunoRx-RHE-1.1',
    nameEn: 'ImmunoRx',
    name: '风湿免疫科用药助手',
    department: '风湿免疫科',
    departmentCode: 'RHE',
    sourceType: '自研',
    vendor: '',
    type: '用药审核',
    functionKeywords: ['免疫抑制剂', '剂量计算', '不良反应'],
    version: '1.1',
    modelSource: '自研',
    modelName: 'RHE-RxRules',
    deploymentType: '本地部署',
    techArch: '规则引擎',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://rhe-rx.****/check',
    authMethod: 'API Key',
    description: '面向风湿免疫科的用药助手，重点关注免疫抑制剂、生物制剂的剂量调整与不良反应监测',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-01-15',
    onlineTime: '2024-04-10',
    evaluationReportId: 'EVAL-2024-013',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-02-10 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-04-10 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 18. 试运行中·病历生成·老年 ----------
  {
    id: 'AGT-2026-006',
    idCode: 'ElderNote-GER-0.6',
    nameEn: 'ElderNote',
    name: '老年综合评估病历生成',
    department: '老年医学科',
    departmentCode: 'GER',
    sourceType: '外采',
    vendor: '北京医智科技',
    type: '病历生成',
    functionKeywords: ['综合评估', '结构化病历', '质控'],
    version: '0.6',
    modelSource: '商用',
    modelName: '医智 NoteLLM',
    deploymentType: '私有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://elder.****/note',
    authMethod: 'API Key',
    description: '面向老年综合评估的病历生成助手，自动汇总认知、营养、躯体功能评估结果并生成规范化评估记录',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-04-22',
    onlineTime: undefined,
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2026-06-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 19. 已上线·智能问诊·内分泌 ----------
  {
    id: 'AGT-2025-014',
    idCode: 'DiabetesQ-ENDO-2.0',
    nameEn: 'DiabetesQ',
    name: '糖尿病患者智能问诊',
    department: '内分泌科',
    departmentCode: 'ENDO',
    sourceType: '外采',
    vendor: '杭州认知智能研究院',
    type: '智能问诊',
    functionKeywords: ['慢病管理', '复诊问答', '指标监测'],
    version: '2.0',
    modelSource: '商用',
    modelName: '认知 AskMed-7B',
    deploymentType: '公有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'https://askmed.****/diab',
    authMethod: 'API Key',
    description: '面向糖尿病患者的智能问诊系统，支持随访主诉采集、用药依从性评估、低血糖风险识别与生活方式建议',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-09-12',
    onlineTime: '2024-12-01',
    evaluationReportId: 'EVAL-2025-014',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-10-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-12-01 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 20. 已上线·导诊分诊·影像 ----------
  {
    id: 'AGT-2025-015',
    idCode: 'RadTriage-RAD-1.0',
    nameEn: 'RadTriage',
    name: '影像检查智能分诊',
    department: '影像科',
    departmentCode: 'RAD',
    sourceType: '自研',
    vendor: '',
    type: '导诊分诊',
    functionKeywords: ['检查分流', '优先级', '工作量预测'],
    version: '1.0',
    modelSource: '自研',
    modelName: 'RadSchedule',
    deploymentType: '本地部署',
    techArch: '规则引擎',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://rad.****/triage',
    authMethod: 'API Key',
    description: '面向影像检查的智能分诊系统，根据检查申请单与初步诊断建议检查优先级与增强方案',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-12-01',
    onlineTime: '2025-02-15',
    evaluationReportId: 'EVAL-2025-015',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-12-15 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2025-02-15 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 21. 已上线·用药审核·急诊 ----------
  {
    id: 'AGT-2025-016',
    idCode: 'EDRx-EMG-1.4',
    nameEn: 'EDRx',
    name: '急诊抢救用药审核',
    department: '急诊科',
    departmentCode: 'EMG',
    sourceType: '合作开发',
    vendor: '北京医智科技',
    type: '用药审核',
    functionKeywords: ['抢救用药', '剂量校验', '禁忌'],
    version: '1.4',
    modelSource: '商用',
    modelName: '医智 RxGuard',
    deploymentType: '私有云',
    techArch: '规则引擎',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://ed-rx.****/check',
    authMethod: 'API Key',
    description: '面向急诊抢救用药的实时审核系统，重点关注抢救药品剂量、给药途径与配伍禁忌',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-07-08',
    onlineTime: '2024-10-01',
    evaluationReportId: 'EVAL-2025-016',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-08-01 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-10-01 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 22. 已上线·健康评估·老年 ----------
  {
    id: 'AGT-2025-017',
    idCode: 'CGA-GER-2.2',
    nameEn: 'CGA',
    name: '老年综合评估系统',
    department: '老年医学科',
    departmentCode: 'GER',
    sourceType: '外采',
    vendor: '深圳医工智能研究院',
    type: '健康评估',
    functionKeywords: ['综合评估', '量表', '照护建议'],
    version: '2.2',
    modelSource: '商用',
    modelName: 'CGA-AI',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://cga.****/api',
    authMethod: 'API Key',
    description: '面向老年医学科的综合评估系统，涵盖认知、营养、躯体功能、社会支持等多维度量化评估',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-05-20',
    onlineTime: '2024-08-10',
    evaluationReportId: 'EVAL-2025-017',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-06-10 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-08-10 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 23. 已上线·异常·用药审核·心内 ----------
  {
    id: 'AGT-2025-018',
    idCode: 'CardioRx-CARD-1.5',
    nameEn: 'CardioRx',
    name: '心血管药物审核',
    department: '心内科',
    departmentCode: 'CARD',
    sourceType: '外采',
    vendor: '深圳医工智能研究院',
    type: '用药审核',
    functionKeywords: ['心血管药物', '剂量', '相互作用'],
    version: '1.5',
    modelSource: '商用',
    modelName: 'CardioRx-AI',
    deploymentType: '私有云',
    techArch: '规则引擎',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://cardio-rx.****/check',
    authMethod: 'API Key',
    description: '面向心血管内科的药物审核助手，重点关注抗凝、抗血小板、降压、调脂等长期用药方案',
    lifecycleStatus: '已上线',
    runtimeStatus: '异常',
    accessTime: '2024-06-10',
    onlineTime: '2024-09-15',
    evaluationReportId: 'EVAL-2025-018',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-07-15 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-09-15 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 24. 已上线·辅助诊断·内分泌 ----------
  {
    id: 'AGT-2025-019',
    idCode: 'EndoDiag-ENDO-1.0',
    nameEn: 'EndoDiag',
    name: '内分泌综合征辅助诊断',
    department: '内分泌科',
    departmentCode: 'ENDO',
    sourceType: '自研',
    vendor: '',
    type: '辅助诊断',
    functionKeywords: ['综合征识别', '鉴别诊断', '建议检查'],
    version: '1.0',
    modelSource: '自研',
    modelName: 'EndoDiag-LLM',
    deploymentType: '私有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://endo.****/diag',
    authMethod: 'OAuth 2.0',
    description: '面向内分泌综合征的辅助诊断系统，针对甲状腺、肾上腺、垂体等疾病模式识别与鉴别诊断建议',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-08-01',
    onlineTime: '2024-11-15',
    evaluationReportId: 'EVAL-2025-019',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-09-15 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-11-15 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 25. 已上线·智能问诊·急诊 ----------
  {
    id: 'AGT-2025-020',
    idCode: 'EDTriage-EMG-1.2',
    nameEn: 'EDTriage',
    name: '急诊预问诊助手',
    department: '急诊科',
    departmentCode: 'EMG',
    sourceType: '外采',
    vendor: '杭州认知智能研究院',
    type: '智能问诊',
    functionKeywords: ['预问诊', '主诉采集', '分诊建议'],
    version: '1.2',
    modelSource: '商用',
    modelName: '认知 AskMed-7B',
    deploymentType: '公有云',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'https://ed.****/triage',
    authMethod: 'API Key',
    description: '面向急诊的预问诊助手，快速采集主诉、既往史、过敏史等信息并预生成急诊病历摘要',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-04-25',
    onlineTime: '2024-07-20',
    evaluationReportId: 'EVAL-2025-020',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-05-20 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-07-20 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 26. 已禁用·影像分析 ----------
  {
    id: 'AGT-2022-021',
    idCode: 'OldMRISeg-RAD-0.5',
    nameEn: 'OldMRISeg',
    name: '颅脑 MRI 分割 V0（旧）',
    department: '影像科',
    departmentCode: 'RAD',
    sourceType: '外采',
    vendor: '上海智像医疗科技',
    type: '影像分析',
    functionKeywords: ['脑区分割', '病灶标注'],
    version: '0.5',
    modelSource: '商用',
    modelName: '智像 MRI-V0',
    deploymentType: '本地部署',
    techArch: '机器学习',
    interfaceProtocol: 'HL7/FHIR',
    interfaceUrl: 'http://old-mri.****/seg',
    authMethod: 'mTLS 证书',
    description: '颅脑 MRI 分割 V0 旧版本（已下线归档），保留历史分割结果用于算法迭代对比',
    lifecycleStatus: '已禁用',
    runtimeStatus: undefined,
    accessTime: '2022-04-01',
    onlineTime: '2022-08-01',
    evaluationReportId: 'EVAL-2022-021',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2022-08-01 10:00', event: '正式上线', source: '监控中心' },
      { time: '2024-09-01 16:00', event: '禁用', source: '台账中心' },
    ],
  },
  // ---------- 27. 已上线·在线·健康评估·心内 ----------
  {
    id: 'AGT-2025-022',
    idCode: 'CardioRisk-CARD-1.0',
    nameEn: 'CardioRisk',
    name: '心血管风险评估',
    department: '心内科',
    departmentCode: 'CARD',
    sourceType: '外采',
    vendor: '上海智像医疗科技',
    type: '健康评估',
    functionKeywords: ['风险评估', '评分', '随访建议'],
    version: '1.0',
    modelSource: '商用',
    modelName: '智像 RiskAI',
    deploymentType: '私有云',
    techArch: '机器学习',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'http://risk.****/api',
    authMethod: 'API Key',
    description: '面向心血管高危人群的风险评估系统，整合血压、血脂、血糖、家族史等数据计算 10 年心血管风险',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-11-25',
    onlineTime: '2025-03-10',
    evaluationReportId: 'EVAL-2025-022',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2025-01-10 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2025-03-10 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 28. 试运行中·导诊分诊·老年 ----------
  {
    id: 'AGT-2026-007',
    idCode: 'ElderGuide-GER-0.7',
    nameEn: 'ElderGuide',
    name: '老年友善导诊',
    department: '老年医学科',
    departmentCode: 'GER',
    sourceType: '自研',
    vendor: '',
    type: '导诊分诊',
    functionKeywords: ['老年友善', '大字号', '语音播报'],
    version: '0.7',
    modelSource: '自研',
    modelName: 'Elder-Guide',
    deploymentType: '本地部署',
    techArch: '大语言模型',
    interfaceProtocol: 'WebSocket',
    interfaceUrl: 'ws://elder.****/guide',
    authMethod: 'API Key',
    description: '面向老年友善医疗的导诊助手，根据功能状态与认知水平推荐合适的就诊流程与人工协助服务',
    lifecycleStatus: '试运行中',
    runtimeStatus: undefined,
    accessTime: '2026-03-18',
    onlineTime: undefined,
    evaluationReportId: 'EVAL-2026-007',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2026-05-15 10:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 29. 已上线·在线·辅助诊断·重症 ----------
  {
    id: 'AGT-2025-023',
    idCode: 'SepsisGuard-ICU-1.6',
    nameEn: 'SepsisGuard',
    name: '脓毒症早期识别',
    department: '重症医学科',
    departmentCode: 'ICU',
    sourceType: '外采',
    vendor: '深圳医工智能研究院',
    type: '辅助诊断',
    functionKeywords: ['脓毒症', '早期识别', 'SOFA评分'],
    version: '1.6',
    modelSource: '商用',
    modelName: 'Sepsis-AI',
    deploymentType: '私有云',
    techArch: '机器学习',
    interfaceProtocol: 'HL7/FHIR',
    interfaceUrl: 'http://sepsis.****/guard',
    authMethod: 'mTLS 证书',
    description: '面向 ICU 的脓毒症早期识别系统，实时分析生命体征、炎症指标、感染源数据并提前预警',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2024-09-30',
    onlineTime: '2024-12-20',
    evaluationReportId: 'EVAL-2025-023',
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2024-10-20 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
      { time: '2024-12-20 10:00', event: '正式上线', source: '监控中心' },
    ],
  },
  // ---------- 30. 试运行中·健康评估·医务 ----------
  {
    id: 'AGT-2026-008',
    idCode: 'StaffHealth-MED-0.3',
    nameEn: 'StaffHealth',
    name: '员工健康监测 V0',
    department: '医务科',
    departmentCode: 'MED',
    sourceType: '自研' as const,
    vendor: '',
    type: '健康评估' as const,
    functionKeywords: ['健康监测', '异常告警', '年度报告'],
    version: '0.3',
    modelSource: '自研' as const,
    modelName: 'Staff-Health',
    deploymentType: '私有云' as const,
    techArch: '规则引擎' as const,
    interfaceProtocol: 'RESTful' as const,
    interfaceUrl: 'http://staff.****/health',
    authMethod: 'API Key' as const,
    description: '面向医院员工的健康监测系统，聚合体检、考勤、心理咨询数据生成员工健康看板与干预建议',
    lifecycleStatus: '试运行中' as const,
    runtimeStatus: undefined,
    accessTime: '2026-05-25',
    onlineTime: undefined,
    relatedFlows: [],
    attachments: [],
    lifecycleTimeline: [
      { time: '2026-06-05 09:00', event: '开始试运行（进入台账）', source: '评测沙盒' },
    ],
  },
  // ---------- 31. 浦江评测通过·超声检查预约 ----------
  {
    id: 'AGT-2026-009',
    idCode: 'US-0001',
    nameEn: 'UltrasoundAppointment',
    name: '超声检查预约助手',
    department: '超声科',
    departmentCode: 'US',
    sourceType: '合作开发',
    vendor: '智医健康科技有限公司',
    type: '导诊分诊',
    functionKeywords: ['超声预约', '时段推荐', '检查提醒'],
    version: '1.0',
    modelSource: '开源',
    modelName: 'Qwen 2.1',
    deploymentType: '本地部署',
    techArch: '大语言模型',
    interfaceProtocol: 'RESTful',
    interfaceUrl: 'https://api.hospital.local/ultrasound/appointment',
    authMethod: 'API Key',
    description: '读取检查预约系统、HIS 与 EMR 中的检查医嘱和可预约时段，协助患者完成超声检查预约并发送检查注意事项。',
    lifecycleStatus: '已上线',
    runtimeStatus: '在线',
    accessTime: '2026-07-20',
    onlineTime: '2026-07-21',
    evaluationReportId: 'PJ-EVAL-2026-US-0001',
    relatedFlows: [{ id: 'FLW-US-001', name: '超声检查预约流程' }],
    attachments: [
      { id: 'US-F001', name: '超声检查预约助手产品说明书.pdf', size: '1.2MB' },
      { id: 'US-F002', name: '浦江实验室评测报告.pdf', size: '2.0MB' },
    ],
    lifecycleTimeline: [
      { time: '2026-07-20 14:00', event: '开始试运行（进入台账）', source: '浦江实验室评测' },
      { time: '2026-07-21 16:00', event: '正式上线', source: '浦江实验室评测' },
    ],
  },
];
// ================== 7. 工具函数 ==================

// 为指定智能体构建默认权限（按 lifecycleStatus 决定默认授权范围）
// 修复说明：原文件此函数声明在 ledgerAgents 注入语句之前（用 `export const = () => ...`），
// 同样把函数体挪到文件末尾并不能解决——ES 模块顶层按词法顺序自上而下求值，
// `ledgerAgentsRaw.map(a => buildPermissions(a))` 仍先于本函数执行。
// `export const` 标识符被 hoist 但初始化顺序不变，运行到第 1247 行时它仍在 TDZ，
// 浏览器抛 "Cannot access 'buildPermissions' before initialization"。
// 解法：把 `export const = (...) => {...}` 改成 `export function ...(...){...}`，
// 函数声明会整体提升到模块顶部，从第 1247 行调用时已可正常读取，TDZ 消失。
export function buildPermissions(
  agent: Pick<
    LedgerAgent,
    'id' | 'idCode' | 'sourceType' | 'lifecycleStatus' | 'department' | 'departmentCode'
  >,
): AgentPermission {
  const isSelf = agent.sourceType === '自研';
  const isOnline = agent.lifecycleStatus === '已上线';
  const isDeregistered = agent.lifecycleStatus === '已禁用';
  const isExternal = agent.sourceType !== '自研';

  // 数据授权：自研 + 已上线 才有较完整授权；外采默认仅科室数据
  const dataAuthorizations: DataAuthorization[] = [];
  if (isOnline && !isDeregistered) {
    if (isSelf || !isExternal) {
      dataAuthorizations.push({
        id: `${agent.id}-D-001`,
        domain: '医生数据',
        scope: `本科室医生 ${agent.departmentCode} 的诊疗数据`,
        grantor: '王志远（信息科）',
        grantTime: agent.lifecycleStatus === '已上线' ? '2024-09-01' : '2025-01-15',
        expireTime: '2026-12-31',
        status: 'expiring',
      });
    }
    if (isSelf) {
      dataAuthorizations.push({
        id: `${agent.id}-D-002`,
        domain: '科室数据',
        scope: `${agent.department} 科室运行数据`,
        grantor: '王志远（信息科）',
        grantTime: '2024-09-01',
        expireTime: '2026-12-31',
        status: 'authorized',
      });
    } else {
      dataAuthorizations.push({
        id: `${agent.id}-D-002`,
        domain: '科室数据',
        scope: `${agent.department} 科室聚合统计数据（脱敏）`,
        grantor: '王志远（信息科）',
        grantTime: '2024-09-01',
        expireTime: '2026-09-30',
        status: 'expiring',
      });
    }
  }

  // 系统接口授权
  const systemAuthorizations: SystemInterfaceAuthorization[] = [];
  if (isOnline) {
    if (
      agent.idCode.startsWith('DiagAssist') ||
      agent.idCode.startsWith('EndocrineRx') ||
      agent.idCode.startsWith('ImmunoRx') ||
      agent.idCode.startsWith('EDRx') ||
      agent.idCode.startsWith('CardioRx')
    ) {
      systemAuthorizations.push({
        id: `${agent.id}-S-001`,
        system: 'EMR',
        interfaceName: '病历查询/医嘱读取',
        grantor: '李建华（信息科）',
        grantTime: '2024-09-01',
        expireTime: '2026-12-31',
        status: 'authorized',
      });
      systemAuthorizations.push({
        id: `${agent.id}-S-002`,
        system: 'HIS',
        interfaceName: '处方/患者主索引',
        grantor: '李建华（信息科）',
        grantTime: '2024-09-01',
        expireTime: '2026-09-30',
        status: 'expiring',
      });
    } else if (
      agent.idCode.startsWith('CTVision') ||
      agent.idCode.startsWith('MRIVis') ||
      agent.idCode.startsWith('LabInsight') ||
      agent.idCode.startsWith('RadTriage')
    ) {
      systemAuthorizations.push({
        id: `${agent.id}-S-001`,
        system: 'PACS',
        interfaceName: '影像调阅/DICOM 拉取',
        grantor: '李建华（信息科）',
        grantTime: '2024-09-01',
        expireTime: '2026-12-31',
        status: 'authorized',
      });
      if (agent.idCode.startsWith('LabInsight')) {
        systemAuthorizations.push({
          id: `${agent.id}-S-002`,
          system: 'LIS',
          interfaceName: '检验报告查询',
          grantor: '李建华（信息科）',
          grantTime: '2024-12-01',
          expireTime: '2026-12-31',
          status: 'authorized',
        });
      }
    } else {
      systemAuthorizations.push({
        id: `${agent.id}-S-001`,
        system: 'EMR',
        interfaceName: '病历查询',
        grantor: '李建华（信息科）',
        grantTime: '2024-09-01',
        expireTime: '2026-12-31',
        status: 'authorized',
      });
    }
  }

  // 变更记录
  const recentChanges: PermissionChangeLog[] = [];
  if (isOnline) {
    recentChanges.push({
      id: `${agent.id}-C-001`,
      time: '2024-09-01 10:30',
      dimension: '系统接口权限',
      changeType: '新增',
      before: '未授权',
      after: systemAuthorizations[0]
        ? `${systemAuthorizations[0].system} - ${systemAuthorizations[0].interfaceName}`
        : 'EMR - 病历查询',
      operator: '王志远（信息科）',
    });
    recentChanges.push({
      id: `${agent.id}-C-002`,
      time: '2024-09-15 14:00',
      dimension: '数据访问权限',
      changeType: '新增',
      before: '未授权',
      after: '医生数据（本科室）',
      operator: '王志远（信息科）',
    });
    if (systemAuthorizations.length > 1) {
      recentChanges.push({
        id: `${agent.id}-C-003`,
        time: '2025-08-20 09:15',
        dimension: '系统接口权限',
        changeType: '续期',
        before: '有效期至 2025-08-31',
        after: '有效期至 2026-09-30',
        operator: '李建华（信息科）',
      });
    }
    if (!isSelf) {
      recentChanges.push({
        id: `${agent.id}-C-004`,
        time: '2026-04-10 16:40',
        dimension: '数据访问权限',
        changeType: '续期',
        before: '科室聚合数据 2025-12-31 到期',
        after: '科室聚合数据 2026-09-30 到期',
        operator: '王志远（信息科）',
      });
    }
  } else if (isDeregistered) {
    recentChanges.push({
      id: `${agent.id}-C-001`,
      time: '2025-12-20 16:00',
      dimension: '系统接口权限',
      changeType: '撤销',
      before: 'EMR / HIS 已授权',
      after: '全部撤销（随智能体一并下线）',
      operator: '王志远（信息科）',
    });
  }

  return {
    selfSessionAuthorized: true,
    dataAuthorizations,
    systemAuthorizations,
    recentChanges,
  };
}
// ================== 7. 权限治理（V1.2 新增 4-4）==================
// 注：buildPermissions 用 `export function` 形式声明（见文件末尾），
// 函数声明会被提升到模块顶部，故即便 ledgerAgents 注入语句先执行，
// 也能正常拿到 buildPermissions。原 `export const = () => {...}` 版本
// 会触发 TDZ："Cannot access 'buildPermissions' before initialization"。

// 注入 permissions（V1.2 4-4 智能体权限管理）
// + V1.5 新增：诊疗环节 / 风险分级 / 运行指标 / 试运行倒计时 / 接入方式 / 版本历史 / 备案材料 / 已对接资源 / 评测结果
export const ledgerAgents: LedgerAgent[] = ledgerAgentsRaw.map((a, idx) => {
  const risk = riskFor(a.sourceType, a.type);
  const metrics = metricsFor(a.lifecycleStatus, a.runtimeStatus);
  // 给 4 条智能体加「待复核」场景（仅初判无复核），用于风险分级嵌套环图
  const reviewOverriddenIdx = new Set([4, 9, 15, 22]);
  // 给 2 条智能体加「待分级」场景
  const pendingIdx = new Set([17, 27]);

  const finalRiskLevel = pendingIdx.has(idx)
    ? ('待分级' as const)
    : reviewOverriddenIdx.has(idx)
    ? (risk.riskInitial ?? '一般关注')
    : risk.riskLevel;

  return {
    ...a,
    // V1.5 诊疗环节：按类型分配
    diagnosisPhase: genPhases(a.type),
    // V1.5 风险分级
    riskLevel: finalRiskLevel,
    riskInitial: pendingIdx.has(idx) ? undefined : risk.riskInitial,
    riskReview: pendingIdx.has(idx) ? undefined : reviewOverriddenIdx.has(idx) ? undefined : risk.riskReview,
    riskBasis: riskBasisFor(finalRiskLevel, a.type),
    riskReviewBasis: reviewOverriddenIdx.has(idx) || pendingIdx.has(idx) ? undefined : '依据风险分级量表初判结果与人工审查一致，建议保持当前评级并定期评估。',
    // V1.5 技术联系人 + 联系方式
    techContact: ['张文博', '李建华', '王志远', '陈晓东', '赵敏'][idx % 5],
    techContactPhone: `139${String(10000000 + idx * 137).slice(0, 8)}`,
    // V1.5 接入方式（API / SDK / OTel 三选一）
    accessType: accessTypeFor(a.type, idx),
    apiKey: 'sk-************************',
    sdkLanguage: a.type === '影像分析' ? 'Java' : a.type === '智能问诊' ? 'Python' : 'Node.js',
    // V1.5 运行指标
    ...metrics,
    // V1.5 试运行倒计时：仅试运行中有效
    trialExpiresAt:
      a.lifecycleStatus === '试运行中'
        ? trialExpireFor(a.accessTime)
        : undefined,
    // V1.5 版本历史
    versionHistory: versionHistoryFor(a.version, a.id),
    // V1.5 备案材料
    filingAttachments: filingAttachmentsFor(a),
    // V1.5 已对接资源
    linkedResources: linkedResourcesFor(a, idx),
    // V1.5 评测结果信息
    evaluationReport: evaluationReportFor(a.evaluationReportId, a.version, idx),
    permissions: buildPermissions(a),
  };
});

// ================== 6. 派生统计 ==================

// 按权限过滤可见台账
export const getVisibleAgents = (user: LedgerUser = currentUser): LedgerAgent[] =>
  user.role === 'platform_admin'
    ? ledgerAgents
    : ledgerAgents.filter((a) => a.department === user.department);

// 4 张统计卡片（V1.3 4-1）：总数 / 试运行中 / 已上线 / 已禁用
export const getStatistics = (list: LedgerAgent[] = getVisibleAgents()) => ({
  total: list.length,
  trial: list.filter((a) => a.lifecycleStatus === '试运行中').length,
  online: list.filter((a) => a.lifecycleStatus === '已上线').length,
  disabled: list.filter((a) => a.lifecycleStatus === '已禁用').length,
});

// 生命周期状态分布（环形图）
export const getLifecycleDistribution = (list: LedgerAgent[] = getVisibleAgents()) =>
  ENUMS.lifecycleStatus.map((status) => ({
    name: status,
    value: list.filter((a) => a.lifecycleStatus === status).length,
  }));

// 科室分布 Top10（横向条形图）
export const getDepartmentDistribution = (list: LedgerAgent[] = getVisibleAgents()) => {
  const counts: Record<string, number> = {};
  list.forEach((a) => {
    counts[a.department] = (counts[a.department] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
};

// 类型分布（环形图，Top5 + 其他）
export const getTypeDistribution = (list: LedgerAgent[] = getVisibleAgents()) => {
  const counts: Record<string, number> = {};
  list.forEach((a) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });
  const sorted = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= 5) return sorted;
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
  return [...top, { name: '其他', value: rest }];
};

// 接入趋势（近 6 个月折线图）
export const getAccessTrend = () => [
  { month: '12月', value: 8 },
  { month: '1月', value: 12 },
  { month: '2月', value: 10 },
  { month: '3月', value: 15 },
  { month: '4月', value: 18 },
  { month: '5月', value: 22 },
];

// ================== 6.1 V1.5 总览扩展统计 ==================

// 总调用量 / 异常告警 / 实例在线率（按时间范围聚合）
export interface OverviewRangeStat {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
  onlineRate: number; // 仅 instanceOnlineRate 用到
}

export const getCallVolumeStat = (
  list: LedgerAgent[] = getVisibleAgents(),
  range: 'today' | '7d' | '30d' | '90d' | 'custom' = '30d',
): OverviewRangeStat => {
  const total = list.reduce((s, a) => s + (a.callVolume?.total ?? 0), 0);
  const daily = list.reduce((s, a) => s + (a.callVolume?.daily ?? 0), 0);
  const weekly = list.reduce((s, a) => s + (a.callVolume?.weekly ?? 0), 0);
  const monthly = list.reduce((s, a) => s + (a.callVolume?.monthly ?? 0), 0);
  // 当前 range 仅作为 V1.5 占位（V1.6 联动所有卡片/图表按时间筛选）
  return { total, daily, weekly, monthly, onlineRate: 0 };
};

export const getAlarmStat = (
  list: LedgerAgent[] = getVisibleAgents(),
  range: 'today' | '7d' | '30d' | '90d' | 'custom' = '30d',
): OverviewRangeStat => {
  const total = list.reduce((s, a) => s + (a.alarmCount?.total ?? 0), 0);
  const daily = list.reduce((s, a) => s + (a.alarmCount?.daily ?? 0), 0);
  const weekly = list.reduce((s, a) => s + (a.alarmCount?.weekly ?? 0), 0);
  const monthly = list.reduce((s, a) => s + (a.alarmCount?.monthly ?? 0), 0);
  return { total, daily, weekly, monthly, onlineRate: 0 };
};

// 实例在线率：加权平均（按是否「已上线」过滤，无 runtimeStatus 视为离线）
export const getInstanceOnlineRateStat = (
  list: LedgerAgent[] = getVisibleAgents(),
): { rate: number; daily: number; weekly: number; monthly: number; total: number; online: number } => {
  const online = list.filter((a) => a.lifecycleStatus === '已上线' && a.runtimeStatus === '在线');
  const shouldOnline = list.filter((a) => a.lifecycleStatus === '已上线');
  const total = shouldOnline.length;
  const rate = total === 0 ? 0 : online.length / total;
  // 日/周/月按"最近 30 天接入的运行实例"权重简化模拟
  const dailyRate = Math.min(1, rate + 0.01);
  const weeklyRate = Math.min(1, rate + 0.005);
  const monthlyRate = Math.min(1, rate - 0.005);
  return {
    rate,
    daily: dailyRate,
    weekly: weeklyRate,
    monthly: monthlyRate,
    total,
    online: online.length,
  };
};

// 试运行倒计时统计
export interface TrialCountdownStat {
  total: number; // 试运行中总数
  expiringWithin14d: number; // 14 天内到期
  detail: Array<{ id: string; name: string; expiresAt: string; daysLeft: number }>;
}

export const getTrialCountdownStat = (
  list: LedgerAgent[] = getVisibleAgents(),
): TrialCountdownStat => {
  const today = new Date('2026-06-25'); // 当前日期：2026/06/25
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 14);
  const trials = list.filter((a) => a.lifecycleStatus === '试运行中');
  const detail = trials
    .map((a) => {
      const exp = a.trialExpiresAt ? new Date(a.trialExpiresAt) : undefined;
      const daysLeft = exp ? Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return { id: a.id, name: a.name, expiresAt: a.trialExpiresAt ?? '', daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return {
    total: trials.length,
    expiringWithin14d: detail.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 14).length,
    detail,
  };
};

// 科室覆盖率（管理员全院）/ 本科室智能体接入率（科室用户）
export interface CoverageStat {
  rate: number; // 0~1
  covered: number;
  total: number;
}

export const getCoverageStat = (
  list: LedgerAgent[] = getVisibleAgents(),
  user: LedgerUser = currentUser,
): CoverageStat => {
  const totalDepartments = ENUMS.department.length as number;
  const coveredSet = new Set(list.map((a) => a.department));
  return {
    rate: totalDepartments === 0 ? 0 : coveredSet.size / totalDepartments,
    covered: coveredSet.size,
    total: totalDepartments,
  };
};

// 诊疗环节分布（饼图，按智能体所属环节聚合，多选智能体计入多个环节）
export const getDiagnosisPhaseDistribution = (list: LedgerAgent[] = getVisibleAgents()) => {
  const counts: Record<string, number> = {};
  list.forEach((a) => {
    (a.diagnosisPhase ?? []).forEach((p) => {
      counts[p] = (counts[p] ?? 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
};

// 智能体来源分布（饼图，对齐 V1.5 §1.1 #10：自研/第三方/合作研发）
export const getSourceDistribution = (list: LedgerAgent[] = getVisibleAgents()) => {
  const counts: Record<string, number> = {};
  list.forEach((a) => {
    counts[a.sourceType] = (counts[a.sourceType] ?? 0) + 1;
  });
  // V1.5 规范：自研/第三方/合作研发
  const normalizeMap: Record<string, string> = {
    自研: '自研',
    外采: '第三方',
    合作开发: '合作研发',
  };
  const normalized: Record<string, number> = {};
  Object.entries(counts).forEach(([k, v]) => {
    const key = normalizeMap[k] ?? k;
    normalized[key] = (normalized[key] ?? 0) + v;
  });
  return Object.entries(normalized)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

// 风险分级嵌套环图数据（外环=复核，内环=初判）
export const getRiskDistribution = (list: LedgerAgent[] = getVisibleAgents()) => {
  const order = ['高度关注', '中度关注', '一般关注'];
  const initial = order.map((lvl) => ({
    name: lvl,
    value: list.filter((a) => a.riskInitial === lvl).length,
  }));
  const review = order.map((lvl) => ({
    name: lvl,
    value: list.filter((a) => a.riskReview === lvl).length,
  }));
  const summary = order.map((lvl) => {
    const i = list.filter((a) => a.riskInitial === lvl).length;
    const r = list.filter((a) => a.riskReview === lvl).length;
    return { level: lvl, initial: i, review: r, total: i + r };
  });
  return { initial, review, summary };
};

// ================== 8. 策略模板（V1.2 权限治理下发表）==================
export const policyTemplates: PolicyTemplate[] = [
  {
    id: 'TPL-001',
    name: '科室管理员默认权限',
    description: '面向科室管理员的智能体，仅授予本科室医生数据 + EMR 接口',
    matchCondition: 'role = 科室管理员 AND lifecycle = 已上线',
    dataAuthorizations: [
      { domain: '医生数据', scope: '本科室医生诊疗数据' },
      { domain: '科室数据', scope: '本科室运行数据' },
    ],
    systemAuthorizations: [{ system: 'EMR', interfaceName: '病历查询' }],
    createdAt: '2025-08-10 10:00',
    updatedAt: '2026-04-20 14:00',
  },
  {
    id: 'TPL-002',
    name: '外采智能体默认权限',
    description: '外采智能体默认仅科室聚合数据 + EMR 接口，最小授权原则',
    matchCondition: 'sourceType = 外采 AND lifecycle = 已上线',
    dataAuthorizations: [{ domain: '科室数据', scope: '本科室聚合统计数据（脱敏）' }],
    systemAuthorizations: [{ system: 'EMR', interfaceName: '病历查询' }],
    createdAt: '2025-08-10 10:00',
    updatedAt: '2026-05-12 11:00',
  },
  {
    id: 'TPL-003',
    name: '自研智能体默认权限',
    description: '院内自研智能体，默认授予本部门医生数据 + EMR + HIS',
    matchCondition: 'sourceType = 自研 AND lifecycle = 已上线',
    dataAuthorizations: [
      { domain: '医生数据', scope: '本科室医生诊疗数据' },
      { domain: '科室数据', scope: '本科室运行数据' },
    ],
    systemAuthorizations: [
      { system: 'EMR', interfaceName: '病历查询' },
      { system: 'HIS', interfaceName: '患者主索引' },
    ],
    createdAt: '2025-08-10 10:00',
    updatedAt: '2026-04-20 14:00',
  },
  {
    id: 'TPL-004',
    name: '试运行期最小权限',
    description: '试运行中智能体仅 EMR 接口，0 院内数据授权',
    matchCondition: 'lifecycle = 试运行中',
    dataAuthorizations: [],
    systemAuthorizations: [{ system: 'EMR', interfaceName: '病历查询（只读）' }],
    createdAt: '2025-09-05 09:00',
    updatedAt: '2026-03-15 16:00',
  },
];

// ================== 9. 权限治理矩阵（V1.2 统一处置页）==================

// 获取跨智能体 × 数据域的授权矩阵
export const getDataAuthMatrix = (list: LedgerAgent[] = getVisibleAgents()) => {
  const matrix: Record<string, Record<string, AuthorizationStatus>> = {};
  list.forEach((a) => {
    matrix[a.id] = {};
    ENUMS.dataDomain.forEach((d) => {
      const auth = a.permissions.dataAuthorizations.find((x) => x.domain === d);
      matrix[a.id][d] = auth ? auth.status : 'unauthorized';
    });
  });
  return matrix;
};

// 获取跨智能体 × 业务系统的授权矩阵
export const getSystemAuthMatrix = (list: LedgerAgent[] = getVisibleAgents()) => {
  const matrix: Record<string, Record<string, AuthorizationStatus>> = {};
  list.forEach((a) => {
    matrix[a.id] = {};
    ENUMS.businessSystem.forEach((s) => {
      const auth = a.permissions.systemAuthorizations.find((x) => x.system === s);
      matrix[a.id][s] = auth ? auth.status : 'unauthorized';
    });
  });
  return matrix;
};

// 30 天内即将到期的授权清单
export const getExpiringAuthorizations = (list: LedgerAgent[] = getVisibleAgents()) => {
  const today = new Date('2026-06-09');
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  const result: Array<{
    agentId: string;
    agentName: string;
    dimension: string;
    target: string;
    expireTime: string;
    daysLeft: number;
  }> = [];
  list.forEach((a) => {
    a.permissions.dataAuthorizations
      .filter((d) => d.status === 'expiring')
      .forEach((d) => {
        const exp = new Date(d.expireTime);
        if (exp <= horizon) {
          result.push({
            agentId: a.id,
            agentName: a.name,
            dimension: '数据访问权限',
            target: `${d.domain} - ${d.scope}`,
            expireTime: d.expireTime,
            daysLeft: Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          });
        }
      });
    a.permissions.systemAuthorizations
      .filter((s) => s.status === 'expiring')
      .forEach((s) => {
        const exp = new Date(s.expireTime);
        if (exp <= horizon) {
          result.push({
            agentId: a.id,
            agentName: a.name,
            dimension: '系统接口权限',
            target: `${s.system} - ${s.interfaceName}`,
            expireTime: s.expireTime,
            daysLeft: Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          });
        }
      });
  });
  return result.sort((a, b) => a.daysLeft - b.daysLeft);
};

// ================== 6. 订阅速读历史报告（V2.0 PRD §3.3.3） ==================
// 订阅抽屉 → 历史报告 Tab：按订阅设置每天/每周推送的速读报告记录
export interface SubscriptionReportRecord {
  id: string; // 报告 ID
  title: string; // 报告名称（不带日期前缀；列表展示用「报告名称 + 推送日期」两列）
  freq: 'daily' | 'weekly'; // 订阅频率
  scope: 'all' | 'dept'; // 订阅范围
  channels: Array<'workbench' | 'email' | 'im'>; // 推送通道
  generatedAt: string; // 生成时间 YYYY-MM-DD HH:mm:ss
  deliveredAt: string; // 推送日期 YYYY-MM-DD HH:mm:ss（列表展示「推送日期」字段）
  highlights: string[]; // 报告要点（速读核心结论）
  status: 'delivered' | 'viewed' | 'failed'; // 推送状态
}

// 历史报告 mock（按时间倒序：今天 / 昨天 / 3 天前 / 上周一 / 上上周一 …）
export const getSubscriptionHistoryReports = (): SubscriptionReportRecord[] => {
  const now = dayjs();
  return [
    {
      id: 'BR-2026-0706-D',
      title: '全院台账速读',
      freq: 'daily',
      scope: 'all',
      channels: ['workbench', 'email'],
      generatedAt: now.format('YYYY-MM-DD 08:00:00'),
      deliveredAt: now.format('YYYY-MM-DD 08:01:00'),
      highlights: [
        '本日新增 2 例告警（影像科 PACS 链路抖动 ×1、内分泌科 LLM 调用超时 ×1）',
        '智能体总调用量 238.63 万,环比前日 +3.2%',
        '覆盖 11/11 科室,中度关注智能体 4 个,本周新增 1 个',
      ],
      status: 'delivered',
    },
    {
      id: 'BR-2026-0705-D',
      title: '全院台账速读',
      freq: 'daily',
      scope: 'all',
      channels: ['workbench', 'email'],
      generatedAt: now.subtract(1, 'day').format('YYYY-MM-DD 08:00:00'),
      deliveredAt: now.subtract(1, 'day').format('YYYY-MM-DD 08:02:00'),
      highlights: [
        '本日新增 1 例故障（心内科 GPU 节点内存告警）,已自动重启',
        '调用量较前日 -1.4%,处于正常波动区间',
        '风险分级未变化,无新增高度关注智能体',
      ],
      status: 'viewed',
    },
    {
      id: 'BR-2026-0704-D',
      title: '全院台账速读',
      freq: 'daily',
      scope: 'all',
      channels: ['workbench', 'email'],
      generatedAt: now.subtract(2, 'day').format('YYYY-MM-DD 08:00:00'),
      deliveredAt: now.subtract(2, 'day').format('YYYY-MM-DD 08:01:00'),
      highlights: [
        '本日无新增告警与故障',
        '影像科智能体调用量环比 +8.6%,疑似与本周体检高峰相关',
        '1 个本科室智能体备案材料即将到期（7 日内）',
      ],
      status: 'viewed',
    },
    {
      id: 'BR-2026-0703-D',
      title: '全院台账速读',
      freq: 'daily',
      scope: 'all',
      channels: ['workbench'],
      generatedAt: now.subtract(3, 'day').format('YYYY-MM-DD 08:00:00'),
      deliveredAt: '',
      highlights: [
        '本日邮件通道投递失败（邮件服务临时不可用）,已回退至工作台消息',
        '建议管理员检查 SMTP 配置',
      ],
      status: 'failed',
    },
    {
      id: 'BR-2026-0629-W',
      title: '全院台账周报',
      freq: 'weekly',
      scope: 'all',
      channels: ['workbench', 'email'],
      generatedAt: now.subtract(1, 'week').endOf('week').format('YYYY-MM-DD 09:00:00'),
      deliveredAt: now.subtract(1, 'week').endOf('week').format('YYYY-MM-DD 09:02:00'),
      highlights: [
        '本周新增告警 7 例（环比 -25%）,其中已恢复 6 例',
        '智能体数量净增 4 个（准入通过 3 / 下线归档 1）',
        '周调用量 14.2 万,环比上周 +5.8%,重点增量来自放射科与内分泌科',
      ],
      status: 'viewed',
    },
    {
      id: 'BR-2026-0622-W',
      title: '全院台账周报',
      freq: 'weekly',
      scope: 'all',
      channels: ['workbench', 'email'],
      generatedAt: now.subtract(2, 'week').endOf('week').format('YYYY-MM-DD 09:00:00'),
      deliveredAt: now.subtract(2, 'week').endOf('week').format('YYYY-MM-DD 09:01:00'),
      highlights: [
        '本周新增告警 12 例（环比 +20%）,影像科 PACS 链路抖动为主要原因',
        '智能体覆盖率维持 100%,本科室新增 1 个「眼科 AI 辅助阅片」',
        '已部署智能体平均可用率 99.62%,SLA 达标率 100%',
      ],
      status: 'viewed',
    },
  ];
};
