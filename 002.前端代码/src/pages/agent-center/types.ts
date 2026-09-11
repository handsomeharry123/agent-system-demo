/**
 * 智能体接入中心 - 共享类型
 */
import type { AgentType } from '../../types/agent';

export type RegisterStatus =
  | '草稿'
  | '待审核'
  | '审核中'
  | '撤销修改'
  | '审核通过'
  | '退回修改';

export type AccessMode = 'API' | 'SDK' | 'OTel';
export type ModelDeploymentMode = '本地化部署' | '云端部署' | '混合部署';
export interface ModelConfig {
  modelName: string;
  modelVersion: string;
  deploymentMode: ModelDeploymentMode;
}

export interface TimelineNode {
  label: string;
  time: string;
  status: 'finish' | 'process' | 'error' | 'wait';
  desc?: string;
  operator?: string;
}

export interface AccessRecord {
  id: string;
  name: string;
  agentCode: string;
  version: string;
  parameterCount?: number;
  openSource?: '是' | '否';
  contextLength?: number;
  temperature?: number;
  topP?: number;
  concurrency?: number;
  releaseDate?: string;
  modelName?: string;
  modelVersion?: string;
  modelDeploymentMode?: ModelDeploymentMode;
  modelConfigs?: ModelConfig[];
  department: string;
  clinicalStage: string;
  source: '自研' | '第三方' | '合作研发';
  supplier: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  type: AgentType;
  description: string;
  applicant: string;
  applicantRole: string;
  attachments: { name: string; size: string; url: string }[];
  accessMode: AccessMode;
  apiEndpoint?: string;
  apiKey?: string;
  platformUrl?: string;
  platformKey?: string;
  connectionTested: boolean;
  connectionStatus?: 'success' | 'failed';
  connectionMessage?: string;
  status: RegisterStatus;
  lastEditTime: string;
  submitTime?: string;
  cancelTime?: string;
  returnTime?: string;
  passTime?: string;
  returnReason?: string;
  passNote?: string;
  auditHistory: TimelineNode[];
  ledgerSynced?: boolean;
}

// ──────────────────────────────────────────────────────────────────────
// 角色常量
// ──────────────────────────────────────────────────────────────────────
export const ROLE_ADMIN = '信息科管理员';
export const ROLE_DEPT = '科室管理员';

// ──────────────────────────────────────────────────────────────────────
// 字典
// ──────────────────────────────────────────────────────────────────────
export const agentTypes: { label: string; value: AgentType }[] = [
  { label: '辅助诊断', value: '辅助诊断' },
  { label: '影像分析', value: '影像分析' },
  { label: '病历生成', value: '病历生成' },
  { label: '用药审核', value: '用药审核' },
  { label: '导诊分诊', value: '导诊分诊' },
  { label: '智能问诊', value: '智能问诊' },
  { label: '随访管理', value: '随访管理' },
  { label: '健康评估', value: '健康评估' },
];

export const sourceOptions = [
  { label: '自研', value: '自研' },
  { label: '第三方', value: '第三方' },
  { label: '合作研发', value: '合作研发' },
];

export const clinicalStageOptions = [
  { label: '导诊分诊', value: '导诊分诊' },
  { label: '预问诊', value: '预问诊' },
  { label: '预约挂号', value: '预约挂号' },
  { label: '辅助检查', value: '辅助检查' },
  { label: '辅助诊断', value: '辅助诊断' },
  { label: '辅助治疗', value: '辅助治疗' },
  { label: '住院', value: '住院' },
  { label: '手术', value: '手术' },
  { label: '其他', value: '其他' },
];

export const accessModeOptions = [
  { label: 'API 接入', value: 'API' },
  { label: 'SDK 接入', value: 'SDK' },
  { label: 'OTel 接入', value: 'OTel' },
];

// ──────────────────────────────────────────────────────────────────────
// 工具
// ──────────────────────────────────────────────────────────────────────
export const DEPT_CODE_MAP: Record<string, string> = {
  心内科: 'XN',
  影像科: 'YX',
  药剂科: 'YJ',
  医务科: 'YW',
  门诊部: 'MZ',
  信息中心: 'XX',
  神经内科: 'SJ',
  急诊科: 'JZ',
  呼吸内科: 'HX',
  消化内科: 'XH',
  内分泌科: 'NF',
  外科: 'WK',
  儿科: 'EK',
  检验科: 'JY',
  病理科: 'BL',
  超声科: 'CS',
  放射科: 'FS',
  康复科: 'KF',
  口腔科: 'KQ',
  眼科: 'YK',
  皮肤科: 'PF',
  妇产科: 'FC',
};

export const genAgentCode = (department: string, existingCodes: string[]): string => {
  const prefix = DEPT_CODE_MAP[department] || 'OT';
  const sameDept = existingCodes.filter((c) => c.startsWith(`${prefix}-`));
  const nextNo = sameDept.length + 1;
  return `${prefix}-${`${nextNo}`.padStart(4, '0')}`;
};

// ──────────────────────────────────────────────────────────────────────
// 状态颜色规范
// ──────────────────────────────────────────────────────────────────────
export const statusColorMap: Record<RegisterStatus, { color: string; label: string }> = {
  草稿: { color: 'default', label: '草稿' },
  待审核: { color: 'blue', label: '待审核' },
  审核中: { color: 'cyan', label: '审核中' },
  撤销修改: { color: 'orange', label: '撤销修改' },
  退回修改: { color: 'orange', label: '退回修改' },
  审核通过: { color: 'green', label: '审核通过' },
};

export const statusListKeys: { key: RegisterStatus | '全部'; label: string; hint?: string }[] = [
  { key: '全部', label: '全部' },
  { key: '草稿', label: '草稿' },
  { key: '待审核', label: '待审核' },
  { key: '审核中', label: '审核中' },
  { key: '撤销修改', label: '撤销修改' },
  { key: '退回修改', label: '退回修改' },
  { key: '审核通过', label: '审核通过', hint: '接入中心终态，已同步台账' },
];
