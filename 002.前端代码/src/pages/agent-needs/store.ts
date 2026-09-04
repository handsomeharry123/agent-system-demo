/**
 * 智能体建设需求管理 - 共享数据 store
 *
 * 需求管理列表 / 草稿 / 生成需求 / 详情 / 文档预览 多页面共享同一份
 * BuildNeed 数据，因此使用 useSyncExternalStore 暴露读取 + 写操作。
 * （与 src/pages/agent-center/store.ts 同构）
 */
import { useSyncExternalStore } from 'react';
import type { BuildNeed } from './types';
import { matchAgents, buildMatchResult } from './types';

// ──────────────────────────────────────────────────────────────────────
// 固定基准时间（避免 Math.random / Date.now 导致刷新数据漂移）
// ──────────────────────────────────────────────────────────────────────
const baseNow = () => new Date(2026, 6, 5, 10, 30, 0); // 2026-07-05 10:30

/** 生成 YYYY-MM-DD HH:MM 字符串（相对基准偏移天数） */
export const nowStr = (offsetDays = 0): string => {
  const d = baseNow();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ──────────────────────────────────────────────────────────────────────
// 初始 mock 数据：6 条已提交（覆盖多科室/环节/紧急度，部分带匹配结果） + 2 条草稿
//   草稿分别归属 admin（信息科管理员演示身份）与 李秀英（科室管理员演示身份），
//   保证两种演示角色进入草稿 Tab 都能看到本人草稿。
// ──────────────────────────────────────────────────────────────────────
const withMatch = (n: BuildNeed): BuildNeed => {
  const top = matchAgents(n);
  return { ...n, matchResult: top.length ? buildMatchResult(top, nowStr(0)) : undefined };
};

const initialNeeds: BuildNeed[] = [
  {
    id: '143',
    serialNo: 143,
    title: '超声检查智能预约与检前指导助手',
    department: '超声医学科',
    reason:
      '目前超声检查预约主要依赖人工沟通，患者经常不清楚检查前准备要求，容易漏检或反复咨询，导致预约效率低、患者等待时间长。建设该智能体后，可提升预约效率、减少人工电话沟通和患者等待时间，并降低检前准备遗漏率。',
    proposer: '敏敏',
    contactPhone: '13800138000',
    clinicalStage: '辅助检查',
    functionDesc:
      '面向门诊和住院患者提供超声检查预约与检前指导服务。系统根据检查项目、医生医嘱、可预约时段和检查注意事项，自动完成超声检查预约，并向患者输出预约时间、检查地点、检前注意事项和改约提醒。',
    resources: ['业务系统', '模型'],
    urgency: '中',
    status: '已提交',
    applicant: 'admin',
    submitTime: '2026-07-10 11:16',
    lastUpdateTime: '2026-07-10 11:16',
    matchResult: {
      topScore: 82,
      matchedAt: '2026-07-10 11:16',
      top: [
        { agentCode: 'AGT-0087', agentName: '检查预约调度助手', agentId: 'agent-appointment', score: 82 },
        { agentCode: 'AGT-0102', agentName: '患者服务通知助手', agentId: 'agent-notice', score: 64 },
        { agentCode: 'AGT-0056', agentName: '门诊智能预问诊助手', agentId: 'agent-preinquiry', score: 41 },
      ],
    },
  },
  withMatch({
    id: 'need-001',
    serialNo: 1,
    title: '门诊智能预问诊助手',
    department: '门诊部',
    reason:
      '门诊高峰期医生问诊时间被大量重复的病史采集占用，患者等待久、体验差。希望在候诊环节前置采集主诉、现病史、既往史等结构化信息，减轻医生负担、提升单位问诊效率。',
    proposer: '孙伟',
    contactPhone: '13500135005',
    clinicalStage: '预问诊',
    functionDesc:
      '面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等信息，形成标准化问诊摘要，推送给接诊医生。',
    resources: ['业务系统', '模型'],
    urgency: '高',
    status: '已提交',
    applicant: '孙伟',
    submitTime: nowStr(-6),
    lastUpdateTime: nowStr(-6),
  }),
  withMatch({
    id: 'need-002',
    serialNo: 2,
    title: '住院病历智能生成',
    department: '医务科',
    reason:
      '住院医师书写病程记录耗时长、格式不统一，质控返工多。希望整合主诉、查体、辅助检查自动生成病程记录草稿，医师在此基础上审核修改，提升病历书写效率与规范性。',
    proposer: '郑雅婷',
    contactPhone: '13600136004',
    clinicalStage: '住院',
    functionDesc:
      '面向住院医师，整合主诉、查体、辅助检查结果自动生成病程记录草稿，支持结构化模板与一键成文，医师复核后归档。',
    resources: ['模型'],
    urgency: '中',
    status: '已提交',
    applicant: '郑雅婷',
    submitTime: nowStr(-5),
    lastUpdateTime: nowStr(-5),
  }),
  withMatch({
    id: 'need-003',
    serialNo: 3,
    title: '影像检查智能辅助阅片',
    department: '影像科',
    reason:
      '影像科阅片量逐年攀升，医师工作负荷大，微小病灶容易漏诊。希望引入 AI 辅助阅片，对结节、钙化等异常做初筛提示与测量，提升阅片效率与检出率。',
    proposer: '林佳',
    contactPhone: '13900139002',
    clinicalStage: '辅助检查',
    functionDesc:
      '面向影像科的 CT/MRI 影像分析，自动识别与测量结节、钙化等异常并给出良恶性分类提示，输出结构化影像报告草稿供医师复核。',
    resources: ['业务系统', '模型'],
    urgency: '高',
    status: '已提交',
    applicant: '李秀英',
    submitTime: nowStr(-4),
    lastUpdateTime: nowStr(-4),
  }),
  withMatch({
    id: 'need-004',
    serialNo: 4,
    title: '智能用药审核助手',
    department: '药剂科',
    reason:
      '门诊与住院处方审核人力不足，配伍禁忌、剂量异常、重复用药主要依赖人工经验，存在用药安全隐患。希望建设用药审核智能体自动拦截高风险处方。',
    proposer: '刘晓燕',
    contactPhone: '13700137003',
    clinicalStage: '辅助治疗',
    functionDesc:
      '面向门诊/住院处方的用药审核引擎，识别配伍禁忌、剂量异常、过敏药物与重复用药，实时提示药师与医师，输出审核意见。',
    resources: ['模型'],
    urgency: '中',
    status: '已提交',
    applicant: 'admin',
    submitTime: nowStr(-3),
    lastUpdateTime: nowStr(-3),
  }),
  withMatch({
    id: 'need-005',
    serialNo: 5,
    title: '智能导诊分诊系统',
    department: '门诊部',
    reason:
      '门诊大厅导诊台高峰期排队严重，患者对科室不了解、挂错号率高，导致重复挂号与就诊延误。希望通过智能导诊根据症状主诉自动推荐科室。',
    proposer: '黄海涛',
    contactPhone: '13500135099',
    clinicalStage: '导诊分诊',
    functionDesc:
      '面向门诊患者的智能导诊，采集症状主诉后推荐就诊科室与就诊建议，支持自助机与手机端接入，缓解导诊台压力。',
    resources: ['业务系统'],
    urgency: '低',
    status: '已提交',
    applicant: '李秀英',
    submitTime: nowStr(-2),
    lastUpdateTime: nowStr(-2),
  }),
  // 无匹配兜底演示：环节=手术 + 冷门功能，平台内无对应智能体
  {
    id: 'need-006',
    serialNo: 6,
    title: '手术麻醉风险智能评估',
    department: '麻醉科',
    reason:
      '术前麻醉风险评估依赖麻醉医师经验，缺乏统一量化工具，评估质量参差不齐。希望建设术前麻醉风险智能评估工具，辅助术前访视决策，降低围术期风险。',
    proposer: '周一帆',
    contactPhone: '13700137066',
    clinicalStage: '手术',
    functionDesc:
      '面向麻醉科术前访视，综合患者基础疾病、检验检查、用药史等信息评估麻醉风险等级，给出个体化术前准备建议。',
    resources: ['模型'],
    urgency: '中',
    status: '已提交',
    applicant: 'admin',
    submitTime: nowStr(-1),
    lastUpdateTime: nowStr(-1),
    matchResult: undefined, // 兜底：未匹配
  },
  // ── 草稿（仅创建者本人可见） ──
  {
    id: 'need-draft-001',
    serialNo: 7,
    title: '出院患者智能随访',
    department: '康复科',
    reason:
      '慢病与术后患者出院后随访依赖人工电话，覆盖率低、记录零散。希望建设智能随访助手自动生成随访计划并推送宣教内容。',
    proposer: '李秀英',
    contactPhone: '13400134006',
    clinicalStage: '其他',
    clinicalStageOther: '出院随访',
    functionDesc: '面向出院患者的智能随访，自动生成随访计划、推送宣教内容并回收随访问卷，异常指标自动提醒随访护士。',
    resources: ['业务系统', '模型'],
    urgency: '低',
    status: '草稿',
    applicant: '李秀英',
    lastUpdateTime: nowStr(0),
  },
  {
    id: 'need-draft-002',
    serialNo: 8,
    title: '检验危急值智能提醒',
    department: '检验科',
    reason: '',
    proposer: 'admin',
    contactPhone: '',
    clinicalStage: '辅助诊断',
    functionDesc: '面向检验科的危急值智能识别与闭环提醒，自动向责任医师推送并跟踪确认。',
    resources: ['业务系统'],
    urgency: '高',
    status: '草稿',
    applicant: 'admin',
    lastUpdateTime: nowStr(0),
  },
];

// ──────────────────────────────────────────────────────────────────────
// 共享 store
// ──────────────────────────────────────────────────────────────────────
let needsState: BuildNeed[] = [...initialNeeds];

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getNeeds = () => needsState;

export const useNeeds = () => useSyncExternalStore(subscribe, getNeeds, getNeeds);

/** 取出一条记录（不订阅变更） */
export const getNeed = (id: string): BuildNeed | undefined => needsState.find((n) => n.id === id);

/** 新增 / 替换一条记录 */
export const upsertNeed = (need: BuildNeed) => {
  const exists = needsState.find((p) => p.id === need.id);
  needsState = exists ? needsState.map((p) => (p.id === need.id ? need : p)) : [need, ...needsState];
  notify();
};

/** 局部更新（回填匹配结果 / 紧急度核定等） */
export const patchNeed = (id: string, patch: Partial<BuildNeed>) => {
  needsState = needsState.map((n) => (n.id === id ? { ...n, ...patch } : n));
  notify();
};

/** 删除记录 */
export const removeNeed = (id: string) => {
  needsState = needsState.filter((n) => n.id !== id);
  notify();
};

/** 生成一个新的记录 id */
export const genNeedId = () => `need-${Math.max(0, ...needsState.map((n) => n.serialNo)) + 1}-${needsState.length + 1}`;

/** 下一个序号 */
export const nextSerialNo = () => Math.max(0, ...needsState.map((n) => n.serialNo)) + 1;
