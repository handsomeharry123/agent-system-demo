/**
 * 接入中心智能化升级 - 共享类型
 *
 * §3.1.1 Agent 对话入口 / §3.1.2 新建注册页(智能填写) 共用
 */
import type { AccessMode, ModelConfig, ModelDeploymentMode } from '../types';

// ──────────────────────────────────────────────────────────────────────
// §3.1.1 Agent 对话
// ──────────────────────────────────────────────────────────────────────

export type AgentMessageType =
  | 'text' // 普通文本
  | 'file-detect' // 文件识别完成
  | 'image-detect' // 图片识别完成
  | 'link-detect' // 链接抓取完成
  | 'text-detect' // 文字 / 语音识别完成
  | 'detecting' // 识别中
  | 'prefill' // 预填确认
  | 'autofix-req' // 自动纠错请求
  | 'autofix-done' // 自动纠错完成
  | 'error' // 错误
  // §4.2.1 智能预审 - 在 Agent 气泡/对话窗口集中呈现
  | 'pre-audit-summary' // 5 维计数 + 严重度筛选
  | 'pre-audit-issue' // 单条预审问题
  | 'pre-audit-test' // 联通测试 5 阶段
  | 'pre-audit-verdict' // 预审结论
  | 'historical-plan' // §3.3.2 历史方案复用（按匹配度推荐 + 复用此方案）
  // §4.2.3 PRD：连通测试失败时, Agent 联网搜索解决方案, 在气泡中给出修改建议
  | 'web-search-solution'
  // §4.2.3 PRD：连通测试成功 / 失败 各自的整体结果呈现
  | 'conn-test-result'
  // 信息完整且连通测试通过后，询问用户是否授权系统代提交
  | 'register-submit-confirm'
  // 项目审计信息与必需材料齐全后，询问用户是否提交
  | 'audit-submit-confirm'
  // §4.3 自动生成产品与技术说明书：必填信息已完成但备案材料缺失时主动提示
  | 'material-generation-offer'
  // §3.4.1.2 注册信息详情页：进度+核心指标 由 Agent 对话窗口呈现, 详情页本身不再嵌入卡片
  | 'insight-detail';

export interface DetectedField {
  fieldKey: string; // 对应 RegistrationForm 的字段 key
  value: string;
  confidence: number; // 0~1
  source: string; // '产品说明书.pdf 第 2 页'
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  type: AgentMessageType;
  content: string;
  timestamp: string; // ISO 字符串
  payload?: {
    fileName?: string;
    fileSize?: number;
    recognitionMode?: 'text' | 'voice';
    detectedFields?: DetectedField[];
    suggestions?: Array<{
      fieldKey: string;
      currentValue: string;
      suggestedValue: string;
      reason: string;
    }>;
    errorCode?: string;
    // §4.2.1 智能预审 payload
    preAuditSummary?: {
      errors: number;
      warnings: number;
      infos: number;
      total: number;
    };
    preAuditIssue?: {
      id: string;
      severity: 'error' | 'warning' | 'info';
      fieldKey: string;
      title: string;
      reason: string;
      /** 'open' | 'adopted' | 'ignored' */
      status?: 'open' | 'adopted' | 'ignored';
    };
    preAuditTest?: {
      steps: Array<{
        stage: string;
        label: string;
        status: 'pending' | 'running' | 'ok' | 'fail';
        latencyMs?: number;
        errorCode?: string;
        errorReason?: string;
      }>;
      /** null 表示测试中 / 失败 / 成功 */
      result: null | { ok: boolean; message: string };
      /** 总耗时（成功时） */
      totalMs?: number;
    };
    preAuditVerdict?: {
      verdict: 'pass' | 'reject' | 'pending';
      reason: string;
      fatalCount: number;
      warningCount: number;
    };
    // §3.3.2 历史方案：列表 (由 ConnectivityTester / SmartRegistrationForm 推送)
    historicalPlans?: HistoricalPlan[];
    /** 由哪条来源触发（'test-fail' | 'page-init'），用于气泡 header 提示 */
    historicalPlanSource?: string;
    /**
     * §4.2.3 PRD：连通测试失败后, Agent 联网搜索解决方案（在气泡内呈现）。
     * - 失败诊断（错误码 + 失败原因 + 解决步骤）由 ConnectivityTester 写入 connDiagnostics
     *   并在 §3.3.1「失败诊断」Alert 中已就地呈现
     * - 此处为附加的「联网搜索方案」—— 通常 1-2 条最匹配的外部/平台内沉淀方案,
     *   每条带 title / summary / source / url / score, 气泡中以链接方式呈现,
     *   点击新窗口打开, 不修改表单
     */
    webSearchSolutions?: Array<{
      id: string;
      title: string;
      summary: string;
      source: string;
      url?: string;
      score?: number;
    }>;
    /**
     * §4.2.3 PRD：连通测试成功 / 失败 整体结果气泡。
     * - ok=true  时, content = "✓ 测试验证正常", 仅展示这一结果,
     *   不再推送 historical-plan / 知识库新增（PRD 已下线 §3.3.2 知识库沉淀提示）
     * - ok=false 时, content = "✗ 测试验证异常（错误码 XXX）",
     *   description 给出失败原因与失败阶段, 引导 Agent 进一步联网搜索解决方案
     */
    connTestResult?: {
      ok: boolean;
      /** 错误代码（失败时） */
      errorCode?: string;
      /** 失败原因（失败时） */
      errorReason?: string;
      /** 失败阶段（失败时） */
      failureStage?: ConnStage;
      /** 测试总耗时 ms */
      totalMs?: number;
    };
    // §4.3 自动生成产品与技术说明书
    materialGenerationOffer?: {
      missingCategories: Array<'product' | 'tech'>;
    };
    // §3.4.1.2 注册信息详情页: 进度 + 核心指标 + 一键直达(对话窗口呈现, 详情页不嵌卡片)
    insightProgress?: InsightProgress;
    // §3.1.1 页面欢迎语：窗口内同步呈现 PRD「引导动作 / 气泡操作按钮」
    welcomeChips?: Array<{
      key: string;
      label: string;
      targetTab?: string;
      tone?: 'default' | 'warning' | 'success' | 'error';
    }>;
    welcomeActions?: Array<{
      key: string;
      label: string;
      path?: string;
      event?: string;
      enabled: boolean;
      reason?: string;
    }>;
    needMatchRows?: Array<{
      rank: number;
      agentCode: string;
      agentName: string;
      version: string;
      score: number;
    }>;
    welcomeMiniList?: {
      toggleLabel: string;
      targetTab: string;
      totalCount: number;
      rows: Array<{
        recordId: string;
        title: string;
        subTitle?: string;
        meta?: string;
        actions: Array<{
          key: string;
          label: string;
          kind: string;
          path?: string;
          danger?: boolean;
        }>;
      }>;
    };
  };
}

// 机器人状态：用于驱动动画 / 角标
export type AgentMood =
  | 'idle' // 待机
  | 'hover' // hover
  | 'thinking' // 思考 / 识别中
  | 'happy' // 成功情绪
  | 'sad'; // 失败安抚

// ──────────────────────────────────────────────────────────────────────
// §3.1.2 新建注册页(智能填写)
// ──────────────────────────────────────────────────────────────────────

/** AI 预填字段的元数据, 驱动 §3.1.2 AI 预填标识规范 */
export interface AIPrefillMeta {
  fieldKey: string;
  confidence: number; // 0~1
  source: string;
  // 用户是否已采纳/修改:采纳后清除 AI 预填标识
  acknowledged: boolean;
  // 采纳时刻 (ms 时间戳):用于 Badge 显示 5s「✓ 已采纳」绿色对勾, 之后才完全消失
  acknowledgedAt?: number;
  // 自动纠错专用:纠错前后的对比值
  beforeValue?: string;
  afterValue?: string;
  fixReason?: string;
}

export interface MaterialFile {
  uid: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  category: 'product' | 'tech' | 'other'; // 产品说明书 / 技术规格书 / 其他材料
}

export interface RegistrationDraft {
  // ① 备案材料
  materials: MaterialFile[];

  // ② 基本信息
  name: string;
  agentCode: string;
  version: string;
  parameterCount: number;
  openSource: '是' | '否';
  contextLength: number;
  temperature: number;
  topP?: number;
  concurrency?: number;
  releaseDate: string;
  modelName: string;
  modelVersion: string;
  modelDeploymentMode: ModelDeploymentMode;
  modelConfigs: ModelConfig[];
  department: string;
  clinicalStage: string;
  clinicalStageCustom?: string;
  description: string;

  // 来源与责任信息
  source?: '自研' | '第三方' | '合作研发';
  supplier?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;

  // ③ 技术信息
  accessMode: AccessMode;
  apiEndpoint?: string;
  apiKey?: string;
  platformUrl?: string;
  platformKey?: string;
  trackingCode?: string;

  // 状态
  testStatus: 'pending' | 'passing' | 'failed' | 'none';
  testResultMessage?: string;
}

export type AccessType = AccessMode;

// ──────────────────────────────────────────────────────────────────────
// 工具
// ──────────────────────────────────────────────────────────────────────

/** 置信度 → 用户感知层级 */
export const confidenceLevel = (c: number): 'high' | 'medium' | 'low' => {
  if (c >= 0.9) return 'high';
  if (c >= 0.7) return 'medium';
  return 'low';
};

// ──────────────────────────────────────────────────────────────────────
// §3.2 填写内容智能审查
// ──────────────────────────────────────────────────────────────────────

export type ReviewSeverity = 'error' | 'warning' | 'info';

export interface ReviewProblem {
  id: string;
  severity: ReviewSeverity;
  fieldKey?: string;
  category?: 'materials' | 'basic' | 'tech';
  title: string;
  reason: string;
  impact: string;
  suggestion?: string; // 可执行建议值
  /** 是否可自动修复（true 时显示「授权自动修正」入口） */
  autoFixable?: boolean;
  /** 自动修复需写入的建议值 */
  autoFixValue?: string;
  status: 'open' | 'ignored' | 'fixed' | 'confirmed';
}

export interface ReviewSummary {
  /** 总问题数（含 ignored/fixed，但展示时分组） */
  totalOpen: number;
  errors: number;
  warnings: number;
  infos: number;
}

// ──────────────────────────────────────────────────────────────────────
// §3.3 智能化连通测试
// ──────────────────────────────────────────────────────────────────────

export type ConnStage = 'dns' | 'connect' | 'auth' | 'request' | 'response';

export interface ConnStep {
  stage: ConnStage;
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail';
  latencyMs?: number;
  errorCode?: string;
  errorReason?: string;
}

export type ConnFailureStage = ConnStage | 'none';

export interface ConnDiagnostics {
  failureStage: ConnFailureStage;
  /** 错误代码（模拟：504 / 401 / 403 / 502） */
  errorCode?: string;
  /** 错误原因描述 */
  errorReason?: string;
  /** 字段层面 hint，例 apiKey / apiEndpoint */
  hintFieldKey?: string;
  /** 解决步骤（按编号顺序） */
  steps: Array<{ idx: number; title: string; detail: string; fieldKey?: string }>;
}

export interface HistoricalPlan {
  id: string;
  agentName: string;
  /** 'API' | 'SDK' | 'OTel' */
  mode: string;
  /** 脱敏后的关键模板信息（接口路径 / 错误码 / 修复要点） */
  endpointPattern: string;
  symptom: string;
  fix: string;
  /** 0~1 匹配度 */
  matchScore: number;
}

// ──────────────────────────────────────────────────────────────────────
// §3.4 接入结果洞察与汇报
// ──────────────────────────────────────────────────────────────────────

export type ProgressPhase = 'pending' | 'reviewing' | 'success';

export interface InsightProgress {
  agentName: string;
  agentCode?: string;
  /** 当前阶段 */
  phase: ProgressPhase;
  /** 服务指标（按接入阶段浮动，演示用） */
  metrics: Array<{ label: string; value: string; tone?: 'success' | 'warning' | 'info' }>;
  /** 接入完成时下一步：台账完善、发起评测等 */
  nextActions: Array<{
    key: string;
    label: string;
    description: string;
    path?: string;
    enabled: boolean;
  }>;
}
