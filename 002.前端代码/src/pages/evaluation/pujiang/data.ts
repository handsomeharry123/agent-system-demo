export const PUJIANG_PLATFORM = 'medbench评测';
export const PUJIANG_PLATFORM_URL = 'https://medbench.opencompass.org.cn/medbench-submission';

export const PUJIANG_DIMENSIONS = [
  '临床任务规划与推理',
  '医疗工具调用与执行',
  '医疗场景感知与交互',
  '记忆与上下文保持',
  '医疗多智能体协作',
] as const;

export type PujiangStatus = '草稿' | '评测中' | '评测通过' | '退回修改';

export interface PujiangTask {
  id: string;
  agentId: string;
  agentCode: string;
  agentName: string;
  version: string;
  department: string;
  status: PujiangStatus;
  dimensions: string[];
  lastEditTime?: string;
  submitTime?: string;
  completeTime?: string;
  resultDesc?: string;
  scores: number[];
}

const names = [
  ['US-0001', '超声检查预约助手', '超声科'],
  ['YX-0003', 'CT 影像智能分析平台', '影像科'],
  ['XN-0002', '心电图智能辅助诊断系统', '心内科'],
  ['YW-0006', '处方智能审核与用药安全系统', '药剂科'],
  ['HL-0004', '住院患者护理风险预警助手', '护理部'],
  ['BL-0008', '病历智能生成与质控系统', '医务科'],
  ['JK-0005', '糖尿病随访管理助手', '内分泌科'],
  ['JJ-0007', '急诊分诊与病情评估助手', '急诊科'],
] as const;

// 浦江评测任务必须持有统一台账中的真实主键，360 画像详情页按该主键查询。
// 不要再根据列表序号生成 `agent-001` 一类只存在于评测模块的临时 ID。
const ledgerAgentIds = [
  'AGT-2026-009',
  'AGT-2025-005',
  'AGT-2025-002',
  'AGT-2024-004',
  'AGT-2026-008',
  'AGT-2024-009',
  'AGT-2025-014',
  'AGT-2026-002',
] as const;

const statuses: PujiangStatus[] = ['评测通过', '评测中', '草稿', '退回修改', '评测通过', '评测中', '评测通过', '退回修改'];

export const initialPujiangTasks: PujiangTask[] = names.map(([agentCode, agentName, department], index) => {
  const status = statuses[index];
  return {
    id: `pj-task-${index + 1}`,
    agentId: ledgerAgentIds[index],
    agentCode,
    agentName,
    department,
    version: index % 3 === 0 ? 'v1.0' : index % 3 === 1 ? 'v2.1' : 'v1.2',
    status,
    dimensions: [...PUJIANG_DIMENSIONS],
    lastEditTime: `2026-07-${String(20 + index).padStart(2, '0')} 10:${String(index * 7).padStart(2, '0')}:00`,
    submitTime: `2026-07-${String(20 + index).padStart(2, '0')} 14:${String(index * 6).padStart(2, '0')}:00`,
    completeTime: status === '评测通过' || status === '退回修改'
      ? `2026-07-${String(21 + index).padStart(2, '0')} 16:${String(index * 5).padStart(2, '0')}:00`
      : undefined,
    resultDesc: status === '评测通过'
      ? '五项医疗智能体能力评测均达到浦江实验室准入要求。'
      : status === '退回修改'
        ? '医疗工具调用可靠性与多智能体协作能力未达标，请修改后重新提交。'
        : undefined,
    scores: [86 + index, 82 + index, 88 - index, 84 + index, 80 + index],
  };
});

initialPujiangTasks.unshift({
  id: 'pj-task-askmed-001',
  agentId: 'AGT-2024-001',
  agentCode: 'AskMed-INFO-3.0',
  agentName: '互联网医院智能问诊助手',
  version: '3.0',
  department: '信息中心',
  status: '评测通过',
  dimensions: [...PUJIANG_DIMENSIONS],
  lastEditTime: '2024-08-20 10:00:00',
  submitTime: '2024-08-20 14:00:00',
  completeTime: '2024-08-28 16:00:00',
  resultDesc: '五项医疗智能体能力评测均达到第三方评测准入要求。',
  scores: [88, 86, 90, 87, 85],
});

export const addPujiangTask = (task: PujiangTask) => {
  initialPujiangTasks.unshift(task);
};

export const getPujiangTask = (id: string) => initialPujiangTasks.find((task) => task.id === id) || initialPujiangTasks[0];
