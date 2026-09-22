// 统一安全治理中心 - Mock 数据
// 对应需求 V1.3：6 维风险大盘 + 检查项 + 告警事件 + 采集/规则（系统/网络） + 内置只读规则（身份/数据） + 同步监控中心规则（模型/应用）

import type {
  AlertEvent,
  AlertRule,
  BuiltinRule,
  CheckItem,
  CollectionConfig,
  DimensionScore,
  ScoreHistoryPoint,
  SecurityDimension,
  SecurityScore,
  SyncedAlertRule,
  CollectionTarget,
} from '../types/security';
import { dimensionLabel } from '../types/security';

// ============== 安全评分 / 趋势 ==============

const generateScoreTrend = (baseValue: number, points = 30): ScoreHistoryPoint[] => {
  const trend: ScoreHistoryPoint[] = [];
  const now = new Date('2026-06-03');
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    const value = baseValue + (Math.random() - 0.5) * 6;
    trend.push({
      timestamp: `${date.getMonth() + 1}/${date.getDate()}`,
      value: Math.max(0, Math.min(100, Math.round(value * 10) / 10)),
    });
  }
  return trend;
};

/** 近 30 天每日安全事件发生数量（与 mockAlertEvents 关联：近 30 天事件平均分布） */
const generateAlertEventTrend = (): ScoreHistoryPoint[] => {
  const trend: ScoreHistoryPoint[] = [];
  const now = new Date('2026-06-03');
  // 30 天总计事件数 = 跨 6 维混合的近 30 天事件
  const totalCount = 7 + 12; // mockAlertEvents 7 条 + 历史补充
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    // 周末略高、工作日波动
    const dow = date.getDay();
    const base = dow === 0 || dow === 6 ? 1.5 : 1;
    const noise = (Math.sin(i * 0.7) + 1) * 0.6;
    const value = Math.max(0, Math.round(base + noise));
    trend.push({
      timestamp: `${date.getMonth() + 1}/${date.getDate()}`,
      value,
    });
  }
  return trend;
};

export const securityScore: SecurityScore = {
  current: 86.4,
  previous: 84.1,
  change: 2.3,
  trend: generateScoreTrend(85),
};

export const alertEventTrend: ScoreHistoryPoint[] = generateAlertEventTrend();

export const dimensionScores: DimensionScore[] = [
  { dimension: '系统', score: 92, primary: '合规率 92%', secondary: '异常 3', riskCount: 3 },
  { dimension: '网络', score: 78, primary: '暴露端口 12', secondary: '高危 2', riskCount: 8 },
  { dimension: '身份', score: 84, primary: '异常登录 4 次', secondary: '越权检测 4', riskCount: 6 },
  { dimension: '数据', score: 88, primary: '合规率 88%', secondary: '待处理 5', riskCount: 5 },
  { dimension: '模型', score: 90, primary: '拦截 23', secondary: '异常 4', riskCount: 4 },
  { dimension: '应用', score: 86, primary: '失败 12', secondary: '越界 3', riskCount: 7 },
];

// ============== 检查项（8-1 下半部 6 Tab 数据） ==============

export const mockCheckItems: CheckItem[] = [
  // 系统
  {
    id: 'CHK-S-001',
    name: '服务间通信加密检查',
    dimension: '系统',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 02:00',
    affectedAgentCount: 4,
    description: '检查平台内部服务之间的通信是否启用 TLS 加密。',
    frequency: '每日',
    lastCheckDetail: '发现 2 个内部服务以明文 HTTP 通信：user-service、order-service。',
    history: [
      { time: '2026-06-03 02:00', result: '未通过', summary: '2 个服务明文通信' },
      { time: '2026-06-02 02:00', result: '未通过', summary: '2 个服务明文通信' },
      { time: '2026-06-01 02:00', result: '通过', summary: '所有服务已加密' },
    ],
    suggestion: '对 user-service、order-service 启用 TLS 1.3 并配置强制 HTTPS。',
  },
  {
    id: 'CHK-S-002',
    name: '密码明文存放检测',
    dimension: '系统',
    level: '高风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 02:00',
    affectedAgentCount: 1,
    description: '扫描平台配置中心、数据库连接串等敏感字段是否以明文存放。',
    frequency: '每日',
    lastCheckDetail: '发现 1 处配置项 redis.password 以明文存放。',
    history: [
      { time: '2026-06-03 02:00', result: '未通过', summary: '1 处明文密码' },
      { time: '2026-05-31 02:00', result: '未通过', summary: '1 处明文密码' },
    ],
    suggestion: '将敏感配置迁移至密钥管理服务（KMS），配置项引用 KMS URI。',
  },
  {
    id: 'CHK-S-003',
    name: '内部访问鉴权策略',
    dimension: '系统',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 02:00',
    affectedAgentCount: 0,
    description: '检查内部 API 是否要求身份认证。',
    frequency: '每日',
    lastCheckDetail: '所有内部 API 均要求 Token 鉴权。',
    history: [
      { time: '2026-06-03 02:00', result: '通过', summary: '鉴权策略已覆盖 100%' },
    ],
    suggestion: '保持现有策略。',
  },
  {
    id: 'CHK-S-004',
    name: '配置项基线合规',
    dimension: '系统',
    level: '无风险',
    result: '通过',
    lastCheckTime: '2026-06-03 02:00',
    affectedAgentCount: 0,
    description: '对照 CIS 基线检查操作系统与中间件配置。',
    frequency: '每周',
    lastCheckDetail: '基线合规率 98%。',
    history: [{ time: '2026-06-01 03:00', result: '通过', summary: '合规率 98%' }],
    suggestion: '保持每周一次基线扫描。',
  },
  // 网络
  {
    id: 'CHK-N-001',
    name: '公网端口扫描',
    dimension: '网络',
    level: '高风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 06:00',
    affectedAgentCount: 1,
    description: '每 6 小时扫描平台公网 IP 的开放端口。',
    frequency: '每 6 小时',
    lastCheckDetail: '平台 IP 123.60.18.22 暴露管理后台端口 8080 至公网。',
    history: [
      { time: '2026-06-03 06:00', result: '未通过', summary: '8080 公网暴露' },
      { time: '2026-06-03 00:00', result: '未通过', summary: '8080 公网暴露' },
    ],
    suggestion: '立即关闭公网访问，启用 VPN 或零信任接入。',
  },
  {
    id: 'CHK-N-002',
    name: '高危端口黑名单检测',
    dimension: '网络',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 06:00',
    affectedAgentCount: 2,
    description: '检测 SSH/远程桌面/数据库等高危端口是否在公网开放。',
    frequency: '每 6 小时',
    lastCheckDetail: '检测到 MySQL 3306 端口在 1 个 IP 公网开放。',
    history: [
      { time: '2026-06-03 06:00', result: '未通过', summary: '3306 公网开放' },
    ],
    suggestion: '将数据库端口限制为仅内网访问。',
  },
  {
    id: 'CHK-N-003',
    name: '内网微隔离状态',
    dimension: '网络',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 06:00',
    affectedAgentCount: 0,
    description: '检测内网东西向流量是否按策略隔离。',
    frequency: '每 6 小时',
    lastCheckDetail: '策略命中 100%，未发现异常横向流量。',
    history: [{ time: '2026-06-03 06:00', result: '通过', summary: '微隔离正常' }],
    suggestion: '保持现有策略。',
  },
  // 身份
  {
    id: 'CHK-I-001',
    name: '异常登录检测',
    dimension: '身份',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 03:00',
    affectedAgentCount: 0,
    description: '检测非工作时段、异地、多次失败等异常登录行为（数据源：用户中心）。',
    frequency: '每小时',
    lastCheckDetail: '检测到 4 次非工作时段管理员登录。',
    history: [{ time: '2026-06-03 03:00', result: '未通过', summary: '4 次异常登录' }],
    suggestion: '开启非工作时段登录二次验证。',
  },
  {
    id: 'CHK-I-002',
    name: '越权操作审计',
    dimension: '身份',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 03:00',
    affectedAgentCount: 0,
    description: '审计越权操作行为（数据源：用户中心）。',
    frequency: '每日',
    lastCheckDetail: '近 7 天无越权事件。',
    history: [{ time: '2026-06-03 03:00', result: '通过', summary: '无越权' }],
    suggestion: '保持现有策略。',
  },
  {
    id: 'CHK-I-003',
    name: '密钥过期检查',
    dimension: '身份',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 03:00',
    affectedAgentCount: 3,
    description: '检测 API Key、签名密钥是否临近过期（数据源：用户中心）。',
    frequency: '每日',
    lastCheckDetail: '3 个智能体的 API Key 将在 7 天内过期。',
    history: [{ time: '2026-06-03 03:00', result: '未通过', summary: '3 个密钥即将过期' }],
    suggestion: '通知责任人轮换密钥。',
  },
  // 数据
  {
    id: 'CHK-D-001',
    name: '数据分级合规',
    dimension: '数据',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 04:00',
    affectedAgentCount: 0,
    agentName: '—',
    description: '检查数据集是否完成分级分类（数据源：数据资产中心）。',
    frequency: '每日',
    lastCheckDetail: '数据集分级覆盖率 100%。',
    history: [{ time: '2026-06-03 04:00', result: '通过', summary: '分级覆盖 100%' }],
    suggestion: '保持现有策略。',
  },
  {
    id: 'CHK-D-002',
    name: '脱敏执行检查',
    dimension: '数据',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 04:00',
    affectedAgentCount: 2,
    agentName: '病历智能生成与质控系统',
    description: '检查患者身份证号、手机号等敏感字段脱敏（数据源：数据资产中心）。',
    frequency: '每日',
    lastCheckDetail: '病历智能生成系统在 1 个场景未完整脱敏身份证号。',
    history: [{ time: '2026-06-03 04:00', result: '未通过', summary: '1 个脱敏漏点' }],
    suggestion: '在数据出口增加统一脱敏层。',
  },
  {
    id: 'CHK-D-003',
    name: '加密状态检查',
    dimension: '数据',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 04:00',
    affectedAgentCount: 0,
    agentName: '—',
    description: '检测敏感数据是否使用强加密算法存储与传输（数据源：数据资产中心）。',
    frequency: '每日',
    lastCheckDetail: '所有敏感库均使用 AES-256 静态加密，传输强制 TLS 1.3。',
    history: [{ time: '2026-06-03 04:00', result: '通过', summary: '加密策略 100% 覆盖' }],
    suggestion: '保持现有策略。',
  },
  {
    id: 'CHK-D-004',
    name: '备份完整性',
    dimension: '数据',
    level: '无风险',
    result: '通过',
    lastCheckTime: '2026-06-03 04:00',
    affectedAgentCount: 0,
    agentName: '—',
    description: '检测关键库每日备份是否成功。',
    frequency: '每日',
    lastCheckDetail: '近 7 天所有备份均成功。',
    history: [{ time: '2026-06-03 04:00', result: '通过', summary: '备份正常' }],
    suggestion: '保持每日备份与季度恢复演练。',
  },
  // 模型
  {
    id: 'CHK-M-001',
    name: '提示词攻击防御',
    dimension: '模型',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 05:00',
    affectedAgentCount: 1,
    agentName: '智能问诊系统',
    description: '检测模型对提示词注入的拦截效果（数据源：运行监控中心）。',
    frequency: '每小时',
    lastCheckDetail: '提示词攻击拦截 23 次，1 次漏放。',
    history: [{ time: '2026-06-03 05:00', result: '未通过', summary: '1 次漏放' }],
    suggestion: '加强输入侧 system prompt 防护。',
  },
  {
    id: 'CHK-M-002',
    name: '越狱检测',
    dimension: '模型',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 05:00',
    affectedAgentCount: 0,
    agentName: '—',
    description: '检测模型是否被诱导越过安全策略。',
    frequency: '每小时',
    lastCheckDetail: '近 24 小时 0 次越狱成功。',
    history: [{ time: '2026-06-03 05:00', result: '通过', summary: '无越狱' }],
    suggestion: '保持现有防护。',
  },
  {
    id: 'CHK-M-003',
    name: '内容合规审核',
    dimension: '模型',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 05:00',
    affectedAgentCount: 1,
    agentName: '胸部 CT 影像智能分析平台',
    description: '检测模型输出是否包含医疗违规、虚假信息、不当表述等内容（数据源：运行监控中心）。',
    frequency: '每小时',
    lastCheckDetail: '近 24 小时发现 1 条疑似不合规表述（剂量建议超说明书）。',
    history: [{ time: '2026-06-03 05:00', result: '未通过', summary: '1 条不合规' }],
    suggestion: '补充药品说明书知识并加入规则过滤。',
  },
  {
    id: 'CHK-M-004',
    name: '输出水印',
    dimension: '模型',
    level: '无风险',
    result: '通过',
    lastCheckTime: '2026-06-03 05:00',
    affectedAgentCount: 0,
    agentName: '—',
    description: '检测模型输出是否携带数字水印。',
    frequency: '每小时',
    lastCheckDetail: '100% 输出含水印。',
    history: [{ time: '2026-06-03 05:00', result: '通过', summary: '水印覆盖 100%' }],
    suggestion: '保持现有策略。',
  },
  // 应用
  {
    id: 'CHK-A-001',
    name: '输入验证规则',
    dimension: '应用',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 03:30',
    affectedAgentCount: 2,
    description: '检测智能体入参是否严格校验（数据源：运行监控中心）。',
    frequency: '每小时',
    lastCheckDetail: '12 次输入验证失败。',
    history: [{ time: '2026-06-03 03:30', result: '未通过', summary: '12 次失败' }],
    suggestion: '完善接口入参 schema 校验。',
  },
  {
    id: 'CHK-A-002',
    name: '输出编码检查',
    dimension: '应用',
    level: '低风险',
    result: '通过',
    lastCheckTime: '2026-06-03 03:30',
    affectedAgentCount: 0,
    description: '检测响应内容是否做 HTML/JSON 上下文编码。',
    frequency: '每小时',
    lastCheckDetail: '无 XSS 风险。',
    history: [{ time: '2026-06-03 03:30', result: '通过', summary: '无异常' }],
    suggestion: '保持现有策略。',
  },
  {
    id: 'CHK-A-003',
    name: '工具调用最小权限',
    dimension: '应用',
    level: '中风险',
    result: '未通过',
    lastCheckTime: '2026-06-03 03:30',
    affectedAgentCount: 1,
    description: '检测智能体工具调用是否遵循最小权限（数据源：运行监控中心）。',
    frequency: '每日',
    lastCheckDetail: '3 次工具越权。',
    history: [{ time: '2026-06-03 03:30', result: '未通过', summary: '3 次越权' }],
    suggestion: '收紧 1 个智能体的工具权限范围。',
  },
];

// ============== 告警事件（8-2） ==============

export const mockAlertEvents: AlertEvent[] = [
  {
    id: 'SE-2026-0001',
    title: '管理后台端口公网暴露',
    dimension: '网络',
    level: '紧急',
    type: '高危端口暴露',
    status: '待处理',
    agentName: '智能体管理平台',
    createdBy: 'admin',
    discoveredAt: '2026-06-03 06:00',
    description: '扫描发现平台公网 IP 123.60.18.22 暴露管理后台 8080 端口，存在被恶意扫描和入侵风险。',
    impactScope: ['智能体管理平台', '智能体接入中心', '全量智能体注册信息'],
    suggestion: '立即关闭公网访问，启用 VPN 或零信任接入，关闭前先排查是否已遭入侵。',
    timeline: [
      { time: '2026-06-03 06:00', operator: '系统自动', action: '事件发现', detail: '高危端口扫描命中' },
    ],
  },
  {
    id: 'SE-2026-0002',
    title: '服务间通信明文风险',
    dimension: '系统',
    level: '重要',
    type: '配置合规',
    status: '处理中',
    agentName: '智能体管理平台 / user-service',
    discoveredAt: '2026-06-02 02:00',
    description: '内部服务 user-service 与 order-service 之间通信仍使用 HTTP 明文协议。',
    impactScope: ['user-service', 'order-service'],
    suggestion: '在网关侧强制 HTTPS，并升级服务证书。',
    handler: 'admin',
    timeline: [
      { time: '2026-06-02 02:00', operator: '系统自动', action: '事件发现' },
      { time: '2026-06-02 10:30', operator: '张明华', action: '分派处置', detail: '接手排查' },
      { time: '2026-06-02 15:00', operator: '张明华', action: '修复中', detail: '网关 HTTPS 策略已配置' },
    ],
  },
  {
    id: 'SE-2026-0003',
    title: '病历生成系统身份证号脱敏漏点',
    dimension: '数据',
    level: '重要',
    type: '数据合规',
    status: '待处理',
    agentName: '病历智能生成与质控系统',
    createdBy: 'admin',
    discoveredAt: '2026-06-01 04:00',
    description: '在「门诊复诊提醒」场景下，输出内容未对身份证号完整脱敏。',
    impactScope: ['病历智能生成与质控系统', '门诊业务'],
    suggestion: '在数据出口增加统一脱敏层，并补回归用例。',
    timeline: [
      { time: '2026-06-01 04:00', operator: '系统自动', action: '事件发现' },
    ],
  },
  {
    id: 'SE-2026-0004',
    title: '提示词攻击漏放一次',
    dimension: '模型',
    level: '一般',
    type: '提示词注入',
    status: '已关闭',
    agentName: '智能问诊系统',
    discoveredAt: '2026-05-30 14:20',
    description: '近 24 小时共拦截 23 次提示词注入，其中 1 次绕过输入过滤。',
    impactScope: ['智能问诊系统'],
    suggestion: '加强 system prompt 中的指令遵循。',
    handler: '刘晓燕',
    summary: '已在 system prompt 增加 3 条反注入指令，回归测试通过。',
    timeline: [
      { time: '2026-05-30 14:20', operator: '系统自动', action: '事件发现' },
      { time: '2026-05-30 16:00', operator: '刘晓燕', action: '分派处置' },
      { time: '2026-05-31 10:00', operator: '刘晓燕', action: '修复完成' },
      { time: '2026-05-31 18:00', operator: '刘晓燕', action: '标记关闭', detail: '回归测试通过' },
    ],
  },
  {
    id: 'SE-2026-0005',
    title: '管理员非工作时段登录',
    dimension: '身份',
    level: '一般',
    type: '异常登录',
    status: '已忽略',
    agentName: '—',
    discoveredAt: '2026-05-29 22:30',
    description: 'admin 账号在 22:30 异地登录，IP 段属运维堡垒机。',
    impactScope: ['admin 账号'],
    suggestion: '评估是否运维值班需要，必要时启用二次验证。',
    ignoreReason: '经核实为运维值班，操作合规，纳入堡垒机审计。',
    timeline: [
      { time: '2026-05-29 22:30', operator: '系统自动', action: '事件发现' },
      { time: '2026-05-30 09:00', operator: '李秀英', action: '核实后忽略', detail: '运维值班正常' },
    ],
  },
  {
    id: 'SE-2026-0006',
    title: '工具调用越权',
    dimension: '应用',
    level: '重要',
    type: '权限越界',
    status: '处理中',
    agentName: '随访管理系统',
    discoveredAt: '2026-05-28 11:00',
    description: '随访管理系统调用了未授权的「导出患者列表」工具。',
    impactScope: ['随访管理系统', '患者列表数据'],
    suggestion: '从工具白名单中移除该工具并记录访问日志。',
    handler: '陈志强',
    timeline: [
      { time: '2026-05-28 11:00', operator: '系统自动', action: '事件发现' },
      { time: '2026-05-28 14:00', operator: '陈志强', action: '分派处置' },
    ],
  },
  {
    id: 'SE-2026-0007',
    title: 'MySQL 端口公网暴露',
    dimension: '网络',
    level: '紧急',
    type: '高危端口暴露',
    status: '已关闭',
    agentName: '智能体管理平台',
    discoveredAt: '2026-05-26 06:00',
    description: '检测到 MySQL 3306 端口在公网开放 30 分钟。',
    impactScope: ['智能体管理平台数据库'],
    suggestion: '限制为内网访问，并核查是否有异常登录。',
    handler: '王建国',
    summary: '防火墙策略已修复，公网 3306 已关闭；日志确认无异常登录。',
    timeline: [
      { time: '2026-05-26 06:00', operator: '系统自动', action: '事件发现' },
      { time: '2026-05-26 06:10', operator: '王建国', action: '分派处置' },
      { time: '2026-05-26 06:30', operator: '王建国', action: '完成修复' },
      { time: '2026-05-26 09:00', operator: '王建国', action: '标记关闭' },
    ],
  },
];

// ============== 采集配置（8-3 子 Tab A） ==============

const systemTargets: CollectionTarget[] = [
  { id: 'srv-01', name: 'app-server-01', type: '服务器' },
  { id: 'srv-02', name: 'app-server-02', type: '服务器' },
  { id: 'srv-03', name: 'control-plane', type: '服务器' },
  { id: 'srv-04', name: 'db-server-01', type: '服务器' },
];

const networkTargets: CollectionTarget[] = [
  { id: 'ip-01', name: '123.60.18.22（公网入口）', type: 'IP' },
  { id: 'ip-02', name: '10.20.0.5（API 网关）', type: 'IP' },
  { id: 'ip-03', name: '10.20.0.6（内网核心）', type: 'IP' },
  { id: 'port-80', name: '80（HTTP）', type: '端口' },
  { id: 'port-443', name: '443（HTTPS）', type: '端口' },
  { id: 'port-3306', name: '3306（MySQL）', type: '端口' },
];

export const mockCollectionConfigs: CollectionConfig[] = [
  {
    id: 'CFG-S-001',
    dimension: '系统',
    targets: systemTargets,
    frequency: '每日',
    items: ['配置项', '权限', '加密状态', '服务间通信'],
    timeout: 600,
    enabled: true,
  },
  {
    id: 'CFG-N-001',
    dimension: '网络',
    targets: networkTargets,
    frequency: '每 6 小时',
    items: ['端口扫描', '公网开放面', '内网隔离状态'],
    whitelist: '10.20.0.100（堡垒机）\n10.20.0.101（堡垒机备）',
    timeout: 600,
    enabled: true,
  },
];

// ============== 告警规则（8-3 子 Tab B）V1.4 完整结构 ==============
// 字段对齐监控中心 8-6「告警管理」：四大配置块(基本信息/告警指标/规则配置/告警通知)

export const mockAlertRules: AlertRule[] = [
  {
    // ===== 元信息 =====
    id: 'RULE-S-001',
    name: '服务间通信未加密',
    dimension: '系统',
    description: '扫描平台内部服务之间的通信协议，若发现明文 HTTP/GRPC 则触发告警。',
    frequency: '每日',
    thresholdSummary: '明文通信服务数 > 0',
    level: '紧急',
    lastTriggerTime: '2026-06-03 02:00',
    relatedOpenEventCount: 1,
    createdBy: 'admin',
    disabledAt: undefined,

    // ===== ① 基本信息 =====
    alertLevel: '紧急',
    scopeType: 'all',
    owner: '张明华',
    enabled: true,

    // ===== ② 告警指标 =====
    metric: '服务间通信加密状态',
    aggregation: '状态命中',
    window: '每日',
    filters: [],

    // ===== ③ 规则配置 =====
    operator: '状态命中',
    threshold: '命中',
    continuousHits: 1,
    silentMinutes: 30,
    autoRecovery: true,
    recoveryWindow: 2,
    responseActions: ['告警通知', '仅记录'],
    remediation: [
      { cause: '内部服务未配置 TLS', action: '为该服务签发证书并升级为 HTTPS / mTLS' },
      { cause: '网关侧 HTTP 仍放行', action: '在网关强制 HTTPS 并拒绝明文入站' },
    ],

    // ===== ④ 告警通知 =====
    notifyChannels: ['站内通知', '短信'],
    notifyTargets: ['规则负责人', '平台管理员'],
    notifyTemplate: '紧急告警模板',
    rateLimitPerHour: 6,
    quietHours: '',
    escalationEnabled: false,
    escalationCondition: '未处置超时',
    escalationTargets: ['上级管理员'],
  },
  {
    id: 'RULE-S-002',
    name: '密码明文存放',
    dimension: '系统',
    description: '扫描平台配置中心、数据库连接串等敏感字段是否以明文存放。',
    frequency: '每日',
    thresholdSummary: '明文密码项数 > 0',
    level: '紧急',
    lastTriggerTime: '2026-06-03 02:00',
    relatedOpenEventCount: 1,
    createdBy: 'admin',

    alertLevel: '紧急',
    scopeType: 'all',
    owner: '王建国',
    enabled: true,

    metric: '密码明文存放',
    aggregation: '状态命中',
    window: '每日',
    filters: [],

    operator: '状态命中',
    threshold: '命中',
    continuousHits: 1,
    silentMinutes: 60,
    autoRecovery: false,
    recoveryWindow: 2,
    responseActions: ['告警通知', '自动阻断'],
    remediation: [
      { cause: '配置项中明文存放密码', action: '将敏感配置迁移至 KMS，配置项改为 KMS URI 引用' },
    ],

    notifyChannels: ['站内通知', '邮件'],
    notifyTargets: ['规则负责人', '平台管理员'],
    notifyTemplate: '紧急告警模板',
    rateLimitPerHour: 6,
    quietHours: '',
    escalationEnabled: true,
    escalationCondition: '未处置超时',
    escalationTargets: ['上级管理员', '信息科主管'],
  },
  {
    id: 'RULE-S-003',
    name: '内部访问未鉴权',
    dimension: '系统',
    description: '检测内部 API 是否要求身份认证。',
    frequency: '每小时',
    thresholdSummary: '未鉴权接口数 > 0',
    level: '重要',
    createdBy: 'admin',

    alertLevel: '重要',
    scopeType: 'all',
    owner: '张明华',
    enabled: true,

    metric: '内部访问认证',
    aggregation: '计数',
    window: '每小时',
    filters: [],

    operator: '>',
    threshold: '0',
    continuousHits: 2,
    silentMinutes: 30,
    autoRecovery: true,
    recoveryWindow: 2,
    responseActions: ['告警通知'],
    remediation: [
      { cause: '内部接口未配置鉴权', action: '在网关侧补全 Token 鉴权策略并回归测试' },
    ],

    notifyChannels: ['站内通知'],
    notifyTargets: ['规则负责人'],
    notifyTemplate: '重要告警模板',
    rateLimitPerHour: 12,
    quietHours: '22:00-08:00',
    escalationEnabled: false,
  },
  {
    id: 'RULE-S-004',
    name: '配置基线偏离',
    dimension: '系统',
    description: '对照 CIS 基线检查操作系统与中间件配置。',
    frequency: '每周',
    thresholdSummary: '基线偏离项数 > 5',
    level: '一般',
    createdBy: 'admin',
    // 2026-04-20 停用，距今 44 天，超过 30 天，且无关联未关闭告警 → 满足删除条件
    disabledAt: '2026-04-20 10:00',
    relatedOpenEventCount: 0,

    alertLevel: '一般',
    scopeType: 'all',
    owner: '李秀英',
    enabled: false,

    metric: '配置项基线偏离',
    aggregation: '计数',
    window: '每周',
    filters: [],

    operator: '>',
    threshold: '5',
    continuousHits: 1,
    silentMinutes: 120,
    autoRecovery: false,
    recoveryWindow: 2,
    responseActions: ['告警通知'],
    remediation: [
      { cause: '基线偏离项超过阈值', action: '按基线修复手册回滚配置项' },
    ],

    notifyChannels: ['站内通知'],
    notifyTargets: ['规则负责人'],
    notifyTemplate: '一般告警模板',
    rateLimitPerHour: 24,
    quietHours: '',
    escalationEnabled: false,
  },
  {
    id: 'RULE-N-001',
    name: '高危端口公网暴露',
    dimension: '网络',
    description: '每 6 小时扫描平台公网 IP 的开放端口，命中黑名单时触发。',
    frequency: '每 6 小时',
    thresholdSummary: '高危端口暴露数 > 0',
    level: '紧急',
    lastTriggerTime: '2026-06-03 06:00',
    relatedOpenEventCount: 1,
    createdBy: 'admin',

    alertLevel: '紧急',
    scopeType: 'scope',
    scopeTargetIds: ['ip-01'],
    owner: '王建国',
    enabled: true,

    metric: '高危端口暴露数',
    aggregation: '计数',
    window: '每 6 小时',
    filters: [{ field: '端口范围', op: '包含', value: '22/3306/3389/8080/6379' }],

    operator: '>',
    threshold: '0',
    continuousHits: 1,
    silentMinutes: 30,
    autoRecovery: true,
    recoveryWindow: 2,
    responseActions: ['告警通知', '服务隔离'],
    remediation: [
      { cause: '高危端口误开至公网', action: '立即关闭公网访问，启用 VPN 或零信任接入' },
      { cause: '关闭前可能已被入侵', action: '先排查登录与流量日志，再通过 nmap 复扫验证' },
    ],

    notifyChannels: ['站内通知', '短信', '邮件'],
    notifyTargets: ['规则负责人', '平台管理员'],
    notifyTemplate: '紧急告警模板',
    rateLimitPerHour: 6,
    quietHours: '',
    escalationEnabled: true,
    escalationCondition: '未处置超时',
    escalationTargets: ['上级管理员', '信息科主管'],
  },
  {
    id: 'RULE-N-002',
    name: '公网开放面异常扩张',
    dimension: '网络',
    description: '较昨日新增公网端口数超过阈值时触发。',
    frequency: '每 6 小时',
    thresholdSummary: '较昨日新增公网端口数 > 3',
    level: '重要',
    createdBy: 'admin',

    alertLevel: '重要',
    scopeType: 'all',
    owner: '陈志强',
    enabled: true,

    metric: '公网开放面',
    aggregation: '计数',
    window: '每 6 小时',
    filters: [],

    operator: '>',
    threshold: '3',
    continuousHits: 2,
    silentMinutes: 60,
    autoRecovery: false,
    recoveryWindow: 2,
    responseActions: ['告警通知'],
    remediation: [
      { cause: '变更引入新公网端口', action: '复核变更单并补充白名单/防火墙策略' },
    ],

    notifyChannels: ['站内通知'],
    notifyTargets: ['规则负责人'],
    notifyTemplate: '重要告警模板',
    rateLimitPerHour: 12,
    quietHours: '22:00-08:00',
    escalationEnabled: false,
  },
  {
    id: 'RULE-N-003',
    name: '内网微隔离违规',
    dimension: '网络',
    description: '检测内网东西向流量是否按策略隔离。',
    frequency: '每 6 小时',
    thresholdSummary: '违规横向连接数 > 0',
    level: '重要',
    createdBy: 'admin',

    alertLevel: '重要',
    scopeType: 'all',
    owner: '陈志强',
    enabled: true,

    metric: '内网隔离状态',
    aggregation: '状态命中',
    window: '每 6 小时',
    filters: [],

    operator: '状态命中',
    threshold: '命中',
    continuousHits: 1,
    silentMinutes: 30,
    autoRecovery: true,
    recoveryWindow: 2,
    responseActions: ['告警通知', '自动阻断'],
    remediation: [
      { cause: '微隔离策略未覆盖', action: '按业务拓扑补充微隔离策略并演练' },
    ],

    notifyChannels: ['站内通知', '短信'],
    notifyTargets: ['规则负责人', '平台管理员'],
    notifyTemplate: '重要告警模板',
    rateLimitPerHour: 12,
    quietHours: '',
    escalationEnabled: false,
  },
];

// ============== 工具函数 ==============

export const getCheckItemsByDimension = (dim: SecurityDimension): CheckItem[] =>
  mockCheckItems.filter((c) => c.dimension === dim);

export const getRulesByDimension = (dim: SecurityDimension): AlertRule[] =>
  mockAlertRules.filter((r) => r.dimension === dim);

export const getCollectionConfigByDimension = (dim: SecurityDimension): CollectionConfig | undefined =>
  mockCollectionConfigs.find((c) => c.dimension === dim);

/** 各维度「待处理 + 处理中」事件按级别分组数量(V1.1 6 维卡片用)
 *  - total = 该维度 status ∈ {待处理, 处理中} 的事件数
 *  - urgent / important / normal = 在 total 范围内按 level 划分
 *  - 严格满足 urgent + important + normal === total
 */
export const getDimensionEventStats = (
  events: AlertEvent[] = mockAlertEvents,
): Record<SecurityDimension, { total: number; urgent: number; important: number; normal: number }> => {
  const allDims: SecurityDimension[] = ['系统', '网络', '身份', '数据', '模型', '应用'];
  const result = Object.fromEntries(
    allDims.map((d) => [d, { total: 0, urgent: 0, important: 0, normal: 0 }]),
  ) as Record<SecurityDimension, { total: number; urgent: number; important: number; normal: number }>;

  for (const e of events) {
    if (e.status !== '待处理' && e.status !== '处理中') continue;
    const slot = result[e.dimension];
    slot.total += 1;
    if (e.level === '紧急') slot.urgent += 1;
    else if (e.level === '重要') slot.important += 1;
    else if (e.level === '一般') slot.normal += 1;
  }
  return result;
};

/** 8-1 上半部安全事件统计 3 卡片用(V1.1)
 *  - pending: 处置状态 = 待处理
 *  - urgentActive: 级别 = 紧急 且 状态 ≠ 已关闭/已忽略(与 6 维卡片 "active" 口径一致)
 *  - closedThisMonth: 状态 = 已关闭 且 discoveredAt 落在 now 所在年月
 */
export const getEventOverviewStats = (
  events: AlertEvent[] = mockAlertEvents,
  now: Date = new Date('2026-06-03'),
) => {
  const pending = events.filter((e) => e.status === '待处理').length;
  const urgentActive = events.filter(
    (e) => e.level === '紧急' && e.status !== '已关闭' && e.status !== '已忽略',
  ).length;
  const closedThisMonth = events.filter((e) => {
    if (e.status !== '已关闭') return false;
    const d = new Date(e.discoveredAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  return { pending, urgentActive, closedThisMonth };
};

// ============== V1.2 工具函数 ==============

/** V1.2 区域 1 4 卡片统计用
 *  - total:        events.length(全部事件,含已关闭/已忽略)
 *  - pending:      status = '待处理'
 *  - processing:   status = '处理中'
 *  - closedThisMonth: status ∈ {已关闭, 已忽略} 且 discoveredAt 在 now 同月(V1.2 新口径)
 */
export const getEventOverviewStatsV12 = (
  events: AlertEvent[] = mockAlertEvents,
  now: Date = new Date('2026-06-03'),
) => {
  const total = events.length;
  const pending = events.filter((e) => e.status === '待处理').length;
  const processing = events.filter((e) => e.status === '处理中').length;
  const closedThisMonth = events.filter((e) => {
    if (e.status !== '已关闭' && e.status !== '已忽略') return false;
    const d = new Date(e.discoveredAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  return { total, pending, processing, closedThisMonth };
};

/** V1.2 「我的事件」过滤(去重)
 *  命中任一:handler / createdBy / followers 包含 currentUserName
 */
export const getMyEventsFilter = (
  events: AlertEvent[],
  currentUserName: string,
): AlertEvent[] => {
  const map = new Map<string, AlertEvent>();
  for (const e of events) {
    const hit =
      e.handler === currentUserName ||
      e.createdBy === currentUserName ||
      (e.followers || []).includes(currentUserName);
    if (hit) map.set(e.id, e);
  }
  return Array.from(map.values());
};

/** V1.2 Tab 计数(仅受 Tab 本身口径控制,不受下方筛选器影响)
 *  - allActive: 全量 events 中 status ∉ {已关闭, 已忽略}
 *  - myActive:  我的事件 集中 status ∉ {已关闭, 已忽略}
 */
export const getTabCounts = (
  events: AlertEvent[],
  currentUserName: string,
) => {
  const isOpen = (e: AlertEvent) => e.status !== '已关闭' && e.status !== '已忽略';
  const allActive = events.filter(isOpen).length;
  const myActive = getMyEventsFilter(events, currentUserName).filter(isOpen).length;
  return { allActive, myActive };
};

export { dimensionLabel };

// ============== 8-3 模式 B · 内置只读规则（身份 / 数据） ==============
// V1.3：身份借用户中心、数据借数据资产中心；规则由平台基于法规与最佳实践内置，本页只读。

export const mockBuiltinRules: BuiltinRule[] = [
  // ---- 身份（6 条典型） ----
  {
    id: 'BLT-I-001',
    name: '账号长期未登录',
    dimension: '身份',
    level: '中',
    defaultResponse: ['告警通知'],
    triggerCondition: '账号连续 ≥ 90 天未登录则触发；超管账号连续 ≥ 30 天未登录则触发。',
    judgmentFields: ['账号台账.账号状态', '登录日志.最近登录时间', '账号台账.角色'],
    sourceModule: '用户中心（模块 11）',
    fixSuggestion: '冻结僵尸账号或责任人确认后注销，避免账号被滥用。',
    lastTriggerTime: '2026-06-02 03:00',
  },
  {
    id: 'BLT-I-002',
    name: '超级权限账号超阈值',
    dimension: '身份',
    level: '高',
    defaultResponse: ['告警通知'],
    triggerCondition: '具备「平台超级管理员」角色的账号数量 > 3 个则触发。',
    judgmentFields: ['账号台账.账号', '角色权限.角色名称'],
    sourceModule: '用户中心（模块 11）',
    fixSuggestion: '收敛超管权限至 3 人以内，并启用申请审批 + 二次验证。',
  },
  {
    id: 'BLT-I-003',
    name: '密钥即将过期 / 已过期',
    dimension: '身份',
    level: '中',
    defaultResponse: ['告警通知'],
    triggerCondition: 'API Key / 签名密钥到期时间距今 ≤ 7 天 或已过期则触发。',
    judgmentFields: ['密钥台账.过期时间', '密钥台账.关联智能体'],
    sourceModule: '用户中心（模块 11）',
    fixSuggestion: '通知责任人在过期前完成轮换；已过期密钥立即吊销并重新签发。',
    lastTriggerTime: '2026-06-03 03:00',
  },
  {
    id: 'BLT-I-004',
    name: '异地异常登录',
    dimension: '身份',
    level: '高',
    defaultResponse: ['告警通知'],
    triggerCondition: '同一账号在 1 小时内出现 ≥ 2 个不同省份的登录 IP，且无登录预案备案。',
    judgmentFields: ['登录日志.登录 IP', '登录日志.登录时间', '账号台账.常用登录地'],
    sourceModule: '用户中心（模块 11）',
    fixSuggestion: '强制断开会话、要求二次身份验证，必要时临时冻结账号。',
  },
  {
    id: 'BLT-I-005',
    name: '暴力破解尝试',
    dimension: '身份',
    level: '高',
    defaultResponse: ['告警通知', '自动阻断'],
    triggerCondition: '5 分钟内同一账号 或 同一 IP 登录失败 ≥ 10 次则触发。',
    judgmentFields: ['登录日志.登录结果', '登录日志.登录 IP', '登录日志.登录时间'],
    sourceModule: '用户中心（模块 11）',
    fixSuggestion: '临时锁定账号 30 分钟、加入 IP 黑名单并通知账号责任人。',
    lastTriggerTime: '2026-05-29 22:30',
  },
  {
    id: 'BLT-I-006',
    name: '角色权限越权',
    dimension: '身份',
    level: '中',
    defaultResponse: ['告警通知'],
    triggerCondition: '账号执行的操作不在其角色被授权的功能权限列表中。',
    judgmentFields: ['操作日志.操作码', '账号台账.角色', '角色权限.功能权限码'],
    sourceModule: '用户中心（模块 11）',
    fixSuggestion: '回滚越权操作、约束角色权限粒度并补充审计。',
  },
  // ---- 数据（6 条典型） ----
  {
    id: 'BLT-D-001',
    name: '未分级数据被访问',
    dimension: '数据',
    level: '中',
    defaultResponse: ['告警通知'],
    triggerCondition: '访问的数据集未完成分级分类登记则触发。',
    judgmentFields: ['资产元数据.分级', '访问日志.数据集'],
    sourceModule: '数据资产中心（模块 10）',
    fixSuggestion: '推动数据 owner 在数据资产中心完成分级分类，方可允许访问。',
  },
  {
    id: 'BLT-D-002',
    name: '敏感字段未脱敏',
    dimension: '数据',
    level: '高',
    defaultResponse: ['告警通知'],
    triggerCondition: '出口数据流中敏感字段（身份证号、手机号、银行卡号等）未按规则脱敏。',
    judgmentFields: ['资产元数据.敏感字段', '脱敏配置.字段映射'],
    sourceModule: '数据资产中心（模块 10）',
    fixSuggestion: '在数据出口增加统一脱敏层并补充回归用例。',
    lastTriggerTime: '2026-06-03 04:00',
  },
  {
    id: 'BLT-D-003',
    name: '跨库未加密传输',
    dimension: '数据',
    level: '高',
    defaultResponse: ['告警通知', '自动阻断'],
    triggerCondition: '跨数据库 / 跨网域的数据传输未启用 TLS 1.2+ 加密。',
    judgmentFields: ['传输日志.协议', '传输日志.源/目标'],
    sourceModule: '数据资产中心（模块 10）',
    fixSuggestion: '强制 TLS 1.3、关闭明文协议，必要时启用 VPN 通道。',
  },
  {
    id: 'BLT-D-004',
    name: '审计日志缺失',
    dimension: '数据',
    level: '中',
    defaultResponse: ['告警通知'],
    triggerCondition: '关键数据集近 24 小时无任何访问日志或日志不完整。',
    judgmentFields: ['审计日志.采集状态', '资产元数据.关键级别'],
    sourceModule: '数据资产中心（模块 10）',
    fixSuggestion: '排查日志采集 Agent 健康状态，恢复后补采。',
  },
  {
    id: 'BLT-D-005',
    name: '备份失败',
    dimension: '数据',
    level: '中',
    defaultResponse: ['告警通知'],
    triggerCondition: '关键库 24 小时内未产生成功备份，或备份校验失败。',
    judgmentFields: ['备份任务.执行状态', '备份任务.最近成功时间'],
    sourceModule: '数据资产中心（模块 10）',
    fixSuggestion: '立即重试备份、排查存储容量与备份脚本异常。',
  },
  {
    id: 'BLT-D-006',
    name: '数据违规出域',
    dimension: '数据',
    level: '高',
    defaultResponse: ['告警通知', '自动阻断'],
    triggerCondition: '受控数据被复制 / 导出至非授权区域或非授权人员。',
    judgmentFields: ['访问日志.操作类型', '访问日志.操作人', '隔离配置.授权域'],
    sourceModule: '数据资产中心（模块 10）',
    fixSuggestion: '阻断流出、回收数据、追溯责任并归档审计中心。',
    lastTriggerTime: '2026-06-01 04:00',
  },
];

// ============== 8-3 模式 C · 同步监控中心规则（模型 / 应用） ==============
// 镜像监控中心 8-6「告警管理」中标签 = 模型 / 应用 的规则，本页仅展示快照。

export const mockSyncedRules: SyncedAlertRule[] = [
  // ---- 模型 ----
  {
    monitoringRuleId: 'rule-model-001',
    name: '提示词攻击拦截率下降',
    dimension: '模型',
    level: '中',
    enabled: true,
    thresholdSummary: '近 1 小时拦截率 < 95%',
    responseActions: ['告警通知'],
    lastTriggerTime: '2026-05-30 14:20',
  },
  {
    monitoringRuleId: 'rule-model-002',
    name: '敏感信息输出',
    dimension: '模型',
    level: '高',
    enabled: true,
    thresholdSummary: '检出敏感词数 > 0',
    responseActions: ['告警通知', '自动阻断'],
  },
  {
    monitoringRuleId: 'rule-model-003',
    name: '模型越狱尝试',
    dimension: '模型',
    level: '高',
    enabled: true,
    thresholdSummary: '越狱命中数 > 0',
    responseActions: ['告警通知'],
  },
  {
    monitoringRuleId: 'rule-model-004',
    name: '内容合规违规',
    dimension: '模型',
    level: '中',
    enabled: true,
    thresholdSummary: '违规输出条数 > 0',
    responseActions: ['告警通知'],
    lastTriggerTime: '2026-06-03 05:00',
  },
  {
    monitoringRuleId: 'rule-model-005',
    name: '输出水印缺失',
    dimension: '模型',
    level: '低',
    enabled: false,
    thresholdSummary: '水印覆盖率 < 100%',
    responseActions: ['仅记录'],
  },
  // ---- 应用 ----
  {
    monitoringRuleId: 'rule-app-001',
    name: '工具调用越权',
    dimension: '应用',
    level: '高',
    enabled: true,
    thresholdSummary: '越权调用次数 > 0',
    responseActions: ['告警通知', '自动阻断'],
    lastTriggerTime: '2026-05-28 11:00',
  },
  {
    monitoringRuleId: 'rule-app-002',
    name: '输入验证失败异常',
    dimension: '应用',
    level: '中',
    enabled: true,
    thresholdSummary: '近 1 小时失败次数 > 10',
    responseActions: ['告警通知'],
    lastTriggerTime: '2026-06-03 03:30',
  },
  {
    monitoringRuleId: 'rule-app-003',
    name: '智能体循环深度异常',
    dimension: '应用',
    level: '中',
    enabled: true,
    thresholdSummary: '循环深度 > 10',
    responseActions: ['告警通知'],
  },
  {
    monitoringRuleId: 'rule-app-004',
    name: '输出编码失败',
    dimension: '应用',
    level: '低',
    enabled: true,
    thresholdSummary: '编码失败次数 > 0',
    responseActions: ['仅记录'],
  },
];

/** 与监控中心的同步元信息（V1.3） */
export const syncedRulesMeta = {
  /** 最后同步时间 */
  lastSyncTime: '2026-06-03 15:25',
  /** 同步是否健康（false → 顶部红色 banner 失联兜底） */
  healthy: true,
  /** 失联时距今分钟（healthy=false 时使用） */
  staleMinutes: 0,
};

/** 按维度返回内置规则 */
export const getBuiltinRulesByDimension = (dim: SecurityDimension): BuiltinRule[] =>
  mockBuiltinRules.filter((r) => r.dimension === dim);

/** 按维度返回同步规则 */
export const getSyncedRulesByDimension = (dim: SecurityDimension): SyncedAlertRule[] =>
  mockSyncedRules.filter((r) => r.dimension === dim);
