/**
 * 智能体建设需求管理 - 类型 / 字典 / 角色常量 / 智能化匹配算法
 *
 * 参考 PRD《智能体建设需求管理-需求说明V1》：
 *   业务方手动录入标准化建设需求，对已提交需求执行「智能化匹配」，
 *   输出平台已纳管智能体中匹配度 TOP3 供参考，避免重复建设。
 */
import { mockAgents } from '../../mock/agents';
import type { AgentType } from '../../types/agent';

// ──────────────────────────────────────────────────────────────────────
// 角色常量（与 agent-center 保持一致）
// ──────────────────────────────────────────────────────────────────────
export const ROLE_ADMIN = '信息科管理员';
export const ROLE_DEPT = '科室管理员';

// ──────────────────────────────────────────────────────────────────────
// 枚举
// ──────────────────────────────────────────────────────────────────────
/** 需求状态：仅「已提交」进入需求管理列表 Tab，「草稿」仅本人可见 */
export type NeedStatus = '已提交' | '草稿';

/** 需求紧急程度（提出人建议，最终由 IT 管理员核定） */
export type UrgencyLevel = '高' | '中' | '低';

/** 所需资源（多选） */
export type ResourceType = '业务系统' | '模型';

/** 诊疗环节（单选，「其他」支持填空） */
export type ClinicalStage =
  | '导诊分诊'
  | '预问诊'
  | '预约挂号'
  | '辅助检查'
  | '辅助诊断'
  | '辅助治疗'
  | '住院'
  | '手术'
  | '其他';

// ──────────────────────────────────────────────────────────────────────
// 匹配结果
// ──────────────────────────────────────────────────────────────────────
export interface MatchItem {
  /** 智能体编号 */
  agentCode: string;
  /** 智能体名称 */
  agentName: string;
  /** 智能体版本 */
  version?: string;
  /** 台账内的智能体 id（用于跳转 360 画像） */
  agentId: string;
  /** 匹配度百分比（0-100 整数） */
  score: number;
}

export interface MatchResult {
  /** TOP3 匹配智能体 */
  top: MatchItem[];
  /** 最高匹配度（回填列表「匹配情况」列） */
  topScore: number;
  /** 最近一次匹配时间 */
  matchedAt: string;
}

// ──────────────────────────────────────────────────────────────────────
// 需求数据模型
// ──────────────────────────────────────────────────────────────────────
export interface BuildNeed {
  id: string;
  /** 序号（按创建先后展示时用列表 index，此处保留业务编号占位） */
  serialNo: number;
  /** 需求标题，≤30 字 */
  title: string;
  /** 提出科室（院内科室字典） */
  department: string;
  /** 提出原因，50-300 字 */
  reason: string;
  /** 提出人，2-10 字 */
  proposer: string;
  /** 联系方式，11 位手机号 */
  contactPhone: string;
  /** 诊疗环节 */
  clinicalStage: ClinicalStage;
  /** 诊疗环节=其他 时的填空内容，≤20 字 */
  clinicalStageOther?: string;
  /** 功能描述，≤500 字 */
  functionDesc: string;
  /** 所需资源（多选） */
  resources: ResourceType[];
  /** 需求紧急程度 */
  urgency: UrgencyLevel;
  /** 最新一次智能化匹配结果（未匹配为 undefined） */
  matchResult?: MatchResult;
  /** 状态 */
  status: NeedStatus;
  /** 创建者（草稿仅本人可见） */
  applicant: string;
  /** 提交时间（已提交才有） */
  submitTime?: string;
  /** 最后更新时间（草稿页展示最近一次暂存时间） */
  lastUpdateTime: string;
}

// ──────────────────────────────────────────────────────────────────────
// 字典 / 选项
// ──────────────────────────────────────────────────────────────────────
export const clinicalStageValues: ClinicalStage[] = [
  '导诊分诊',
  '预问诊',
  '预约挂号',
  '辅助检查',
  '辅助诊断',
  '辅助治疗',
  '住院',
  '手术',
  '其他',
];

export const clinicalStageOptions = clinicalStageValues.map((s) => ({ label: s, value: s }));

export const resourceValues: ResourceType[] = ['业务系统', '模型'];
export const resourceOptions = resourceValues.map((r) => ({ label: r, value: r }));

export const urgencyValues: UrgencyLevel[] = ['高', '中', '低'];
export const urgencyOptions = urgencyValues.map((u) => ({ label: u, value: u }));

export const urgencyColorMap: Record<UrgencyLevel, string> = {
  高: 'red',
  中: 'orange',
  低: 'default',
};

// ──────────────────────────────────────────────────────────────────────
// 智能化匹配（纯函数）
//   与平台已纳管智能体（mockAgents）做相似度评估，输出 TOP3。
//   维度（PRD 附录）：
//     1. 诊疗环节一致性（agent.type ↔ need.clinicalStage 语义映射）  +40
//     2. 功能描述语义相似（关键词/子串重叠）                          最多 +30
//     3. 所需资源交集（业务系统 / 模型）                              最多 +10
//     4. 提出科室 / 服务对象匹配                                      +20
//   分数封顶 100。全 0 时返回空数组 → 触发「暂无匹配智能体」兜底。
// ──────────────────────────────────────────────────────────────────────

/** 诊疗环节 → 智能体类型（AgentType）的语义映射，用于「诊疗环节一致性」打分 */
const stageToAgentTypes: Record<ClinicalStage, AgentType[]> = {
  导诊分诊: ['导诊分诊'],
  预问诊: ['智能问诊'],
  预约挂号: ['导诊分诊'],
  辅助检查: ['影像分析'],
  辅助诊断: ['辅助诊断', '影像分析'],
  辅助治疗: ['用药审核'],
  住院: ['病历生成'],
  手术: ['病历生成'],
  其他: ['随访管理', '健康评估'],
};

/** 极简中文关键词分词：按 2-4 字滑窗切片，用于功能描述子串重叠打分 */
const sliceTokens = (text: string): string[] => {
  const clean = (text || '').replace(/[\s，。、；：,.;:!！?？（）()【】\[\]"'’“”]/g, '');
  const tokens = new Set<string>();
  for (let len = 2; len <= 4; len += 1) {
    for (let i = 0; i + len <= clean.length; i += 1) {
      tokens.add(clean.slice(i, i + len));
    }
  }
  return Array.from(tokens);
};

/** 计算功能描述语义相似度得分（0-30） */
const descSimilarityScore = (needDesc: string, agentDesc: string): number => {
  const a = sliceTokens(needDesc);
  if (a.length === 0) return 0;
  let hit = 0;
  a.forEach((t) => {
    if (t.length >= 2 && agentDesc.includes(t)) hit += 1;
  });
  const ratio = hit / a.length;
  return Math.min(30, Math.round(ratio * 60));
};

/**
 * 执行匹配，返回按匹配度降序的 TOP3（分数 > 0 者）。
 * 平台内无任何匹配（全 0%）时返回空数组。
 */
export const matchAgents = (need: Pick<BuildNeed, 'clinicalStage' | 'functionDesc' | 'resources' | 'department'>): MatchItem[] => {
  const targetTypes = stageToAgentTypes[need.clinicalStage] || [];
  const scored = mockAgents.map((agent, idx) => {
    let score = 0;
    // 1. 诊疗环节一致性
    if (targetTypes.includes(agent.type)) score += 40;
    // 2. 功能描述语义相似
    score += descSimilarityScore(need.functionDesc, agent.description || '');
    // 3. 所需资源交集：模型 → 命中 modelSource；业务系统 → 命中部署/接入
    if (need.resources.includes('模型') && agent.modelSource) score += 6;
    if (need.resources.includes('业务系统') && (agent.apiEndpoint || agent.techArch)) score += 4;
    // 4. 提出科室匹配
    if (need.department && agent.department === need.department) score += 20;

    score = Math.min(100, score);
    return {
      agentCode: `AG-${String(idx + 1).padStart(4, '0')}`,
      agentName: agent.name,
      version: agent.version,
      agentId: agent.id,
      score,
    } as MatchItem;
  });

  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};

/** 由 MatchItem[] 构造 MatchResult（含最高匹配度） */
export const buildMatchResult = (top: MatchItem[], matchedAt: string): MatchResult => ({
  top,
  topScore: top.length > 0 ? top[0].score : 0,
  matchedAt,
});
