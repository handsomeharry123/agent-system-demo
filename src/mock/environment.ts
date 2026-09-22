/**
 * 环境配置 Mock 数据 V1.3
 * 对应需求文档：/Users/harry/Desktop/CC_TEST/agent-system/环境配置-需求说明文档V1.3.md
 *
 * V1.1 → V1.2 变更点：
 *   1) 删除「运行环境管理」分组
 *      - 移除 RuntimeConfig 类型与 RUNTIME_ENV_OPTIONS 枚举
 *      - SandboxEnvConfig / ProdEnvConfig 不再含 runtime 字段
 *      - defaultSandboxConfig / defaultProdConfig 不再有 runtime
 *      - 保留 EnvId 类型（'SANDBOX' | 'PROD'）作为环境标识
 *   2) 权限配置改为多业务系统数组（Form.List 数据模型）
 *      - 新增 PermissionItem 接口（含 id + 5 业务字段）
 *      - PermissionConfig 改为 PermissionItem[] 数组类型
 *   3) 4 个分组结构（与 V1.2 §1 §2 严格一致）：
 *      - 沙盒：{ install, resource, network, permission }
 *      - 正式：{ install, resource, network, permission }
 *   4) 默认值（附录 A）
 *      - 沙盒 permission 默认 2 条（EMR + LIS，演示多业务系统）
 *      - 正式 permission 默认 2 条（HIS + EMR）
 *      - 正式资源默认 { cpu:16, ram:64, disk:200 }
 *      - 正式 network 默认 { ipAddress:'http://10.30.1.50', ports:['80','443'] }
 *      - 认证方式默认 API Key（V1.1 正式环境曾用 OAuth2，V1.2 改回 API Key）
 *   5) 新增工具函数：
 *      - makeEmptyPermissionItem()：生成新条目（id 用时间戳 + 随机串）
 *      - hasDuplicateHospitalSystem(items)：多业务系统间系统是否重复
 *   6) 保留 V1.1 导出：EnvId / EvalDimension / SandboxEvalStatus / ProdRunStatus /
 *      SandboxAgentItem / ProdAgentItem / mockSandboxAgents / mockProdAgents /
 *      evalStatusColor / runStatusColor / PromotionRule / DEFAULT_PROMOTION_RULE /
 *      PromotionCheckResult / checkPromotion / HOSPITAL_SYSTEM_OPTIONS /
 *      DATA_SCOPE_OPTIONS / OP_PERMISSION_OPTIONS / PERMISSION_AUTH_OPTIONS /
 *      LOGIN_AUTH_OPTIONS / InstallConfig / ResourceConfig / NetworkConfig
 *
 * V1.2 → V1.3 变更点：
 *   1) 沙盒智能体列表（V1.3 §1）末列从「是否满足晋级门槛」「晋级时间」改为「部署时间」
 *      - SandboxAgentItem 删除 passPromotion 字段（晋级判定仅依赖 evalStatus + totalScore + dimensionScores）
 *      - 保留 loadedAt（部署时间）字段不变
 *   2) 正式智能体列表（V1.3 §2）末列改为「部署时间」
 *      - ProdAgentItem 字段 promotedAt 重命名为 deployedAt（文案统一为「智能体进入正式环境的时间」）
 *   3) 晋级弹窗仍使用 evalStatus + totalScore + dimensionScores 校验门槛，checkPromotion 函数不变
 *   4) mock 智能体数据补全：
 *      - 沙盒默认 6 条已含 loadedAt（如 "2026-06-08 10:00:00"）
 *      - 正式默认 5 条 promotedAt → deployedAt 字段重命名，文案更新为「智能体进入正式环境的时间」
 *   5) 保留 V1.2 全部导出
 */

// ====== 环境标识 ======
export type EnvId = 'SANDBOX' | 'PROD';

// ====== 沙盒环境内智能体的评测状态 ======
export type SandboxEvalStatus =
  | '待评测'
  | '评测中'
  | '待审核'
  | '已审核·准入'
  | '已审核·不准入';

// ====== 正式环境内智能体运行状态 ======
export type ProdRunStatus = '运行中' | '告警中' | '异常';

// ====== 评测维度 ======
export type EvalDimension = '能力' | '安全' | '伦理' | '鲁棒性';

// ============================================================
// 1. 下拉枚举常量（label/value 形式，Select options 直接消费）
// ============================================================

export interface SelectOption<T extends string = string> {
  label: T;
  value: T;
}

export const HOSPITAL_SYSTEM_OPTIONS: ReadonlyArray<SelectOption> = [
  { label: 'HIS 医院信息系统', value: 'HIS 医院信息系统' },
  { label: 'EMR 电子病历系统', value: 'EMR 电子病历系统' },
  { label: 'LIS 检验信息系统', value: 'LIS 检验信息系统' },
  { label: 'PACS 影像归档系统', value: 'PACS 影像归档系统' },
  { label: 'CIS 临床信息系统', value: 'CIS 临床信息系统' },
  { label: 'HRP 资源规划系统', value: 'HRP 资源规划系统' },
] as const;

export const DATA_SCOPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { label: '全院数据', value: '全院数据' },
  { label: '本科室数据', value: '本科室数据' },
  { label: '本人创建数据', value: '本人创建数据' },
  { label: '指定患者群', value: '指定患者群' },
  { label: '脱敏数据集', value: '脱敏数据集' },
] as const;

export const OP_PERMISSION_OPTIONS: ReadonlyArray<SelectOption> = [
  { label: '只读', value: '只读' },
  { label: '读写', value: '读写' },
  { label: '读写删除', value: '读写删除' },
  { label: '审批', value: '审批' },
  { label: '配置管理', value: '配置管理' },
] as const;

export const PERMISSION_AUTH_OPTIONS: ReadonlyArray<SelectOption> = [
  { label: 'API Key', value: 'API Key' },
  { label: 'OAuth2', value: 'OAuth2' },
  { label: 'Token', value: 'Token' },
  { label: 'mTLS', value: 'mTLS' },
] as const;

export const LOGIN_AUTH_OPTIONS: ReadonlyArray<SelectOption> = [
  { label: 'SSH 密钥登录（禁用 root 直接登录）', value: 'SSH 密钥登录（禁用 root 直接登录）' },
  { label: 'SSH 密钥登录 + 用户名密码', value: 'SSH 密钥登录 + 用户名密码' },
  { label: 'Bastion 跳板机登录', value: 'Bastion 跳板机登录' },
] as const;

// ============================================================
// 2. V1.2 环境配置类型（4 个分组：install / resource / network / permission）
// ============================================================

/** 虚拟 / 真实环境安装 */
export interface InstallConfig {
  /** Docker 版本要求 */
  dockerVersion: string;
  /** Docker Compose 版本要求 */
  dockerComposeVersion: string;
}

/** 运行资源配置 */
export interface ResourceConfig {
  /** CPU 核数，≥4 */
  cpu: number;
  /** 内存 GB，≥16 */
  ram: number;
  /** 磁盘 GB，≥50 */
  disk: number;
}

/** 网络资源配置 */
export interface NetworkConfig {
  /** 沙盒为虚拟内网 IP / 正式环境为医院内网 IP */
  ipAddress: string;
  /** 开放端口列表（tags 形式，字符串数组） */
  ports: string[];
  /** 登录鉴权方式 */
  loginAuth:
    | 'SSH 密钥登录（禁用 root 直接登录）'
    | 'SSH 密钥登录 + 用户名密码'
    | 'Bastion 跳板机登录';
}

/** 单条业务系统权限（Form.List 数组项） */
export interface PermissionItem {
  /** 条目唯一 id（用于 React key / Form.List 操作） */
  id: string;
  /** 医院业务系统（Select 枚举，多条记录间系统不可重复） */
  hospitalSystem: string;
  /** 数据授权范围 */
  dataScope: string;
  /** 操作权限类型 */
  opPermission: string;
  /** 权限接口地址（沙盒为虚拟权限地址 / 正式环境为各业务系统权限地址） */
  permissionUrl: string;
  /** 权限认证方式 */
  permissionAuth: 'API Key' | 'OAuth2' | 'Token' | 'mTLS';
}

/** 虚拟 / 真实权限配置 = 多业务系统数组 */
export type PermissionConfig = PermissionItem[];

/** 完整的沙盒环境配置（V1.2：4 个分组） */
export interface SandboxEnvConfig {
  /** 分组 1：虚拟环境安装 */
  install: InstallConfig;
  /** 分组 2：运行资源配置 */
  resource: ResourceConfig;
  /** 分组 3：网络资源配置 */
  network: NetworkConfig;
  /** 分组 4：虚拟权限配置（多业务系统数组） */
  permission: PermissionConfig;
}

/** 完整的正式环境配置（V1.2：4 个分组，与沙盒同结构） */
export interface ProdEnvConfig {
  install: InstallConfig;
  resource: ResourceConfig;
  network: NetworkConfig;
  permission: PermissionConfig;
}

// ============================================================
// 3. 工具函数（V1.2 新增）
// ============================================================

/**
 * 生成一个空的业务系统权限条目
 * id 用 Date.now() + 随机串，保证在同一毫秒内新增多个条目也不会重复
 */
export const makeEmptyPermissionItem = (): PermissionItem => {
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    id: `ps-${Date.now()}-${rand}`,
    hospitalSystem: '',
    dataScope: '',
    opPermission: '',
    permissionUrl: '',
    permissionAuth: 'API Key',
  };
};

/**
 * 校验多业务系统权限列表中「医院业务系统」是否重复
 * - 忽略空值
 * - 全部条目医院业务系统相同时返回 true
 */
export const hasDuplicateHospitalSystem = (items: PermissionItem[]): boolean => {
  const set = new Set<string>();
  for (const it of items) {
    const sys = it.hospitalSystem?.trim();
    if (!sys) continue;
    if (set.has(sys)) return true;
    set.add(sys);
  }
  return false;
};

// ============================================================
// 4. 晋级规则（内置预设，弹窗校验使用，不再 UI 配置）
// ============================================================

export interface PromotionRule {
  /** 评测综合总分门槛 0-100 */
  totalScore: number;
  /** 各维度最低分 */
  dimensionScores: Partial<Record<EvalDimension, number>>;
  /** 评测结论要求 */
  conclusion: '准入';
  /** 管理员二次审核 */
  needAdminReview: boolean;
}

export const DEFAULT_PROMOTION_RULE: PromotionRule = {
  totalScore: 80,
  dimensionScores: { 能力: 70, 安全: 75, 伦理: 70, 鲁棒性: 65 },
  conclusion: '准入',
  needAdminReview: true,
};

// ============================================================
// 5. 默认配置（附录 A）
// ============================================================

export const defaultSandboxConfig: SandboxEnvConfig = {
  install: {
    dockerVersion: 'Docker 26.1.4 及以上',
    dockerComposeVersion: 'Docker Compose 2.27.1 及以上',
  },
  resource: {
    cpu: 4,
    ram: 16,
    disk: 50,
  },
  network: {
    ipAddress: 'http://10.20.1.100',
    ports: ['80', '443', '8080'],
    loginAuth: 'SSH 密钥登录（禁用 root 直接登录）',
  },
  permission: [
    {
      id: 'ps-1',
      hospitalSystem: 'EMR 电子病历系统',
      dataScope: '脱敏数据集',
      opPermission: '只读',
      permissionUrl: 'https://sandbox.med-agent.internal/api/v1/emr/permission',
      permissionAuth: 'API Key',
    },
    {
      id: 'ps-2',
      hospitalSystem: 'LIS 检验信息系统',
      dataScope: '脱敏数据集',
      opPermission: '只读',
      permissionUrl: 'https://sandbox.med-agent.internal/api/v1/lis/permission',
      permissionAuth: 'API Key',
    },
  ],
};

export const defaultProdConfig: ProdEnvConfig = {
  install: {
    dockerVersion: 'Docker 26.1.4 及以上',
    dockerComposeVersion: 'Docker Compose 2.27.1 及以上',
  },
  resource: {
    cpu: 16,
    ram: 64,
    disk: 200,
  },
  network: {
    ipAddress: 'http://10.30.1.50',
    ports: ['80', '443'],
    loginAuth: 'SSH 密钥登录（禁用 root 直接登录）',
  },
  permission: [
    {
      id: 'pp-1',
      hospitalSystem: 'HIS 医院信息系统',
      dataScope: '全院数据',
      opPermission: '读写',
      permissionUrl: 'https://prod.med-agent.hospital/api/v1/his/permission',
      permissionAuth: 'API Key',
    },
    {
      id: 'pp-2',
      hospitalSystem: 'EMR 电子病历系统',
      dataScope: '本科室数据',
      opPermission: '读写',
      permissionUrl: 'https://prod.med-agent.hospital/api/v1/emr/permission',
      permissionAuth: 'API Key',
    },
  ],
};

// ============================================================
// 6. 环境内智能体列表（保留 V1.0 / V1.1 现有数据）
// ============================================================

/** 沙盒环境内智能体 */
export interface SandboxAgentItem {
  id: string;
  name: string;
  version: string;
  supplier: string;
  department: string;
  evalStatus: SandboxEvalStatus;
  /** 综合总分；评测完成后才有值 */
  totalScore?: number;
  /** 各维度得分 */
  dimensionScores?: Partial<Record<EvalDimension, number>>;
  /** 智能体部署载入沙盒环境的时间（V1.3 末列） */
  loadedAt: string;
}

/** 正式环境内智能体 */
export interface ProdAgentItem {
  id: string;
  name: string;
  version: string;
  supplier: string;
  department: string;
  runStatus: ProdRunStatus;
  /** 智能体部署进入正式环境的时间（V1.3 末列；V1.2 原名 promotedAt） */
  deployedAt: string;
}

export const mockSandboxAgents: SandboxAgentItem[] = [
  {
    id: 'agent-101',
    name: '糖尿病管理智能体 v2',
    version: 'v2.0.1',
    supplier: '杭州认知智能研究院',
    department: '内分泌科',
    evalStatus: '已审核·准入',
    totalScore: 88.5,
    dimensionScores: { 能力: 89, 安全: 90, 伦理: 86, 鲁棒性: 88 },
    loadedAt: '2026-06-04 09:12:00',
  },
  {
    id: 'agent-102',
    name: '皮肤镜辅助诊断助手',
    version: 'v1.3.0',
    supplier: '深眸医疗',
    department: '皮肤科',
    evalStatus: '已审核·准入',
    totalScore: 84.0,
    dimensionScores: { 能力: 86, 安全: 82, 伦理: 80, 鲁棒性: 88 },
    loadedAt: '2026-06-05 14:30:00',
  },
  {
    id: 'agent-103',
    name: '电子病历摘要生成器',
    version: 'v0.9.4',
    supplier: '诺道智能',
    department: '病案室',
    evalStatus: '待审核',
    totalScore: 76.5,
    dimensionScores: { 能力: 78, 安全: 74, 伦理: 72, 鲁棒性: 82 },
    loadedAt: '2026-06-06 08:00:00',
  },
  {
    id: 'agent-104',
    name: '胸片影像智能分析新版',
    version: 'v3.2.0',
    supplier: '云医科技',
    department: '影像科',
    evalStatus: '评测中',
    loadedAt: '2026-06-08 10:18:00',
  },
  {
    id: 'agent-105',
    name: '门诊智能预问诊 v3',
    version: 'v3.0.0',
    supplier: '导医科技',
    department: '门诊部',
    evalStatus: '待评测',
    loadedAt: '2026-06-10 16:00:00',
  },
  {
    id: 'agent-106',
    name: '处方智能审核 v4',
    version: 'v4.0.0-beta',
    supplier: '壹药信息',
    department: '药剂科',
    evalStatus: '已审核·不准入',
    totalScore: 62.0,
    dimensionScores: { 能力: 60, 安全: 55, 伦理: 70, 鲁棒性: 65 },
    loadedAt: '2026-06-02 11:00:00',
  },
];

export const mockProdAgents: ProdAgentItem[] = [
  {
    id: 'agent-001',
    name: '心电图智能辅助诊断系统',
    version: 'v2.4.0',
    supplier: '北京医智科技有限公司',
    department: '心内科',
    runStatus: '运行中',
    deployedAt: '2025-09-12 10:00:00',
  },
  {
    id: 'agent-002',
    name: '胸部 CT 影像智能分析平台',
    version: 'v3.1.0',
    supplier: '云医科技',
    department: '影像科',
    runStatus: '告警中',
    deployedAt: '2025-11-20 14:00:00',
  },
  {
    id: 'agent-003',
    name: '病历智能生成与质控系统',
    version: 'v2.0.3',
    supplier: '诺道智能',
    department: '病案室',
    runStatus: '运行中',
    deployedAt: '2026-01-08 09:30:00',
  },
  {
    id: 'agent-004',
    name: '处方智能审核与用药安全系统',
    version: 'v3.5.0',
    supplier: '壹药信息',
    department: '药剂科',
    runStatus: '异常',
    deployedAt: '2026-02-22 15:20:00',
  },
  {
    id: 'agent-005',
    name: '智能导诊与分诊系统',
    version: 'v2.2.1',
    supplier: '导医科技',
    department: '门诊部',
    runStatus: '运行中',
    deployedAt: '2026-03-15 08:00:00',
  },
];

// ============================================================
// 7. UI 辅助：状态颜色（保留 V1.0 / V1.1）
// ============================================================

export const evalStatusColor: Record<SandboxEvalStatus, string> = {
  待评测: 'default',
  评测中: 'processing',
  待审核: 'warning',
  '已审核·准入': 'success',
  '已审核·不准入': 'error',
};

export const runStatusColor: Record<ProdRunStatus, string> = {
  运行中: 'success',
  告警中: 'warning',
  异常: 'error',
};

// ============================================================
// 8. 业务校验：智能体是否满足晋级门槛（弹窗仍需校验）
//   - 评测结论 = 已审核·准入
//   - 综合总分 ≥ 总分门槛
//   - 各维度分数 ≥ 维度最低分（如配置）
// ============================================================
export interface PromotionCheckResult {
  /** 总体是否通过 */
  pass: boolean;
  /** 各条规则的逐项校验结果 */
  items: { label: string; pass: boolean; detail: string }[];
}

export const checkPromotion = (
  agent: SandboxAgentItem,
  rule: PromotionRule,
): PromotionCheckResult => {
  const items: PromotionCheckResult['items'] = [];

  // 1. 结论
  const conclusionPass = agent.evalStatus === '已审核·准入';
  items.push({
    label: '评测结论 = 准入',
    pass: conclusionPass,
    detail: `当前评测状态：${agent.evalStatus}`,
  });

  // 2. 综合总分
  const score = agent.totalScore;
  const totalPass = score != null && score >= rule.totalScore;
  items.push({
    label: `综合总分 ≥ ${rule.totalScore}`,
    pass: totalPass,
    detail: score != null ? `当前综合总分：${score.toFixed(1)}` : '尚未生成综合总分',
  });

  // 3. 维度最低分（如未配置则跳过）
  Object.entries(rule.dimensionScores).forEach(([dim, minScore]) => {
    if (minScore == null) return;
    const cur = agent.dimensionScores?.[dim as EvalDimension];
    const pass = cur != null && cur >= minScore;
    items.push({
      label: `${dim}维度 ≥ ${minScore}`,
      pass,
      detail: cur != null ? `当前 ${dim} 维度：${cur.toFixed(1)}` : `${dim} 维度暂无评分`,
    });
  });

  return { pass: items.every((i) => i.pass), items };
};
