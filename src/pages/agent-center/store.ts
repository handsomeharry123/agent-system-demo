/**
 * 智能体接入中心 - 共享数据 store
 *
 * 注册管理列表页 / 新建注册页 / 编辑注册页 / 审核注册页 多页面共享同一份
 * AccessRecord 数据，因此使用 useSyncExternalStore 暴露读取 + 写操作。
 */
import { useSyncExternalStore } from 'react';
import type { AccessRecord, TimelineNode } from './types';

// ──────────────────────────────────────────────────────────────────────
// 初始 mock 数据（与原 V2.1 单文件实现保持一致）
// ──────────────────────────────────────────────────────────────────────
const nowISO = (offsetDays = 0) => {
  const d = new Date(2026, 5, 24, 10, 30, 0); // 2026-06-24
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

const ROLE_ADMIN = '信息科管理员';
const ROLE_DEPT = '科室管理员';

const initialRecords: AccessRecord[] = [
  {
    id: 'acc-askmed-001',
    name: '互联网医院智能问诊助手',
    agentCode: 'AskMed-INFO-3.0',
    version: '3.0',
    modelName: 'AskMed-7B',
    modelVersion: '3.0',
    modelDeploymentMode: '云端部署',
    department: '信息中心',
    clinicalStage: '预问诊',
    source: '第三方',
    supplier: '杭州认知智能研究院',
    contactName: '陈明',
    contactPhone: '13800138000',
    type: '导诊分诊',
    description: '面向互联网医院患者提供多轮预问诊、病情摘要和就诊科室建议。',
    applicant: 'admin',
    applicantRole: ROLE_ADMIN,
    attachments: [{ name: 'AskMed 智能体接入备案材料.pdf', size: '2.6 MB', url: '#' }],
    accessMode: 'API',
    apiEndpoint: 'https://api.askmed.example.com/v1/chat',
    apiKey: 'sk-********',
    connectionTested: true,
    connectionStatus: 'success',
    connectionMessage: '通过（186ms，接口响应正常）',
    status: '审核通过',
    lastEditTime: '2024-06-10 10:00:00',
    submitTime: '2024-06-12 09:30:00',
    passTime: '2024-06-15 10:00:00',
    passNote: '备案材料齐全，接口联通正常，同意接入。',
    auditHistory: [
      { label: '提交注册申请', time: '2024-06-12 09:30:00', status: 'finish', operator: 'admin' },
      { label: '审核中', time: '2024-06-13 09:00:00', status: 'finish', operator: '信息科管理员' },
      { label: '审核通过', time: '2024-06-15 10:00:00', status: 'finish', operator: '信息科管理员', desc: '备案材料齐全，接口联通正常' },
    ],
    ledgerSynced: true,
  },
  {
    id: 'acc-xg-001',
    name: '超声检查预约助手',
    agentCode: '0601-0001',
    version: '1.0',
    modelName: 'Qwen',
    modelVersion: '2.1',
    modelDeploymentMode: '本地化部署',
    modelConfigs: [
      { modelName: 'Qwen', modelVersion: '2.1', deploymentMode: '本地化部署' },
      { modelName: 'BGE', modelVersion: '1.0', deploymentMode: '混合部署' },
    ],
    department: '超声医学科',
    clinicalStage: '辅助检查',
    source: '合作研发',
    supplier: '智医健康科技有限公司',
    contactName: '陈明',
    contactPhone: '13800138000',
    type: '导诊分诊',
    description:
      '面向门诊及住院患者，读取检查预约系统、HIS 与 EMR 中的患者基础信息、检查项目、医生医嘱、可预约时段和检查注意事项，自动完成超声检查预约，并向患者输出预约时间、检查地点、注意事项和改约提醒。',
    applicant: 'admin',
    applicantRole: ROLE_ADMIN,
    attachments: [
      { name: '产品说明书（自动生成）.pdf', size: '1.2 MB', url: '#' },
      { name: '技术规格书.pdf', size: '1.8 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'https://api.hospital.local/agent/access/v1',
    apiKey: '********',
    connectionTested: true,
    connectionStatus: 'success',
    connectionMessage: '通过（320ms，接口响应正常）',
    status: '待审核',
    lastEditTime: '2026-07-13 13:32:00',
    submitTime: '2026-07-13 13:32:00',
    auditHistory: [
      { label: '智能识别接入材料', time: '2026-07-13 13:31:00', status: 'finish', operator: '医小管' },
      { label: '联通测试通过', time: '2026-07-13 13:31:20', status: 'finish', desc: '接口 320ms 返回 200' },
      { label: '提交注册申请', time: '2026-07-13 13:32:00', status: 'finish', operator: 'admin' },
    ],
  },
  {
    id: 'acc-001',
    name: '心电图智能辅助诊断',
    agentCode: 'XN-0001',
    version: '2.1',
    department: '心内科',
    clinicalStage: '辅助诊断',
    source: '第三方',
    supplier: '北京医云科技有限公司',
    contactName: '陈志远',
    contactPhone: '13800138001',
    type: '辅助诊断',
    description: '面向门诊心电图检查的智能辅助诊断，自动识别 ST 段抬高、室性早搏等异常，输出结构化报告',
    applicant: '张明华',
    applicantRole: ROLE_ADMIN,
    attachments: [
      { name: '产品说明书.pdf', size: '1.8 MB', url: '#' },
      { name: '技术规格书.pdf', size: '3.2 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.20:8080/chat',
    apiKey: 'ak-8f9a****-3f9a',
    connectionTested: true,
    connectionStatus: 'success',
    status: '审核通过',
    lastEditTime: nowISO(-8),
    submitTime: nowISO(-7),
    passTime: nowISO(-5),
    passNote: '技术参数完整，备案材料齐全，审核通过。',
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-7), status: 'finish', operator: '张明华' },
      { label: '审核中', time: nowISO(-6), status: 'process', operator: '李秀英' },
      { label: '审核通过', time: nowISO(-5), status: 'finish', operator: '李秀英', desc: '技术参数完整，备案材料齐全' },
      { label: '台账同步', time: nowISO(-5), status: 'finish', desc: '已同步至统一台账中心' },
    ],
    ledgerSynced: true,
  },
  {
    id: 'acc-002',
    name: '肺部 CT 影像分析',
    agentCode: 'YX-0001',
    version: '1.5',
    department: '影像科',
    clinicalStage: '辅助检查',
    source: '第三方',
    supplier: '上海智慧医疗科技公司',
    contactName: '林佳',
    contactPhone: '13900139002',
    type: '影像分析',
    description: '面向胸部 CT 的影像分析，自动测量结节、分类良恶性、提供三维重建',
    applicant: '王建国',
    applicantRole: ROLE_ADMIN,
    attachments: [
      { name: '产品说明书.pdf', size: '2.1 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.8 MB', url: '#' },
      { name: '安全测试报告.pdf', size: '0.9 MB', url: '#' },
    ],
    accessMode: 'SDK',
    platformUrl: 'https://otel.platform-hospital.cn/agent/yx-0001',
    platformKey: 'sk-sdk****-77c2',
    connectionTested: true,
    connectionStatus: 'success',
    status: '审核通过',
    lastEditTime: nowISO(-4),
    submitTime: nowISO(-3),
    passTime: nowISO(-1),
    passNote: '备案材料齐全，同意接入。',
    auditHistory: [
      { label: '提交审核', time: nowISO(-3), status: 'finish', operator: '王建国' },
      { label: '审核中', time: nowISO(-2), status: 'process', operator: '李秀英' },
      { label: '审核通过', time: nowISO(-1), status: 'finish', operator: '李秀英', desc: '备案材料齐全' },
    ],
    ledgerSynced: true,
  },
  {
    id: 'acc-003',
    name: '智能用药审核',
    agentCode: 'YJ-0001',
    version: '3.0',
    department: '药剂科',
    clinicalStage: '辅助治疗',
    source: '第三方',
    supplier: '杭州互联网医疗公司',
    contactName: '周一帆',
    contactPhone: '13700137003',
    type: '用药审核',
    description: '面向门诊/住院处方的用药审核引擎，识别配伍禁忌、剂量异常、过敏药物',
    applicant: '刘晓燕',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.5 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.2 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.22:8080/chat',
    apiKey: 'ak-1d2b****-1d2b',
    connectionTested: true,
    connectionStatus: 'success',
    status: '审核中',
    lastEditTime: nowISO(-2),
    submitTime: nowISO(-2),
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-2), status: 'finish', operator: '刘晓燕' },
      { label: '审核中', time: nowISO(-1), status: 'process', operator: '李秀英' },
    ],
  },
  {
    id: 'acc-004',
    name: '病历智能生成',
    agentCode: 'YW-0001',
    version: '1.2',
    department: '医务科',
    clinicalStage: '住院',
    source: '自研',
    supplier: '本院信息科',
    contactName: '郑雅婷',
    contactPhone: '13600136004',
    type: '病历生成',
    description: '面向住院医师的病历生成助手，整合主诉、查体、辅助检查形成病程记录草稿',
    applicant: '郑雅婷',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.2 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.0 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.30:8080/chat',
    apiKey: 'ak-yw****-7c4d',
    connectionTested: true,
    connectionStatus: 'success',
    status: '待审核',
    lastEditTime: nowISO(-1),
    submitTime: nowISO(-1),
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-1), status: 'finish', operator: '郑雅婷' },
    ],
  },
  {
    id: 'acc-005',
    name: '智能导诊分诊',
    agentCode: 'MZ-0001',
    version: '2.0',
    department: '门诊部',
    clinicalStage: '导诊分诊',
    source: '第三方',
    supplier: '深圳智能医疗公司',
    contactName: '黄海涛',
    contactPhone: '13500135005',
    type: '导诊分诊',
    description: '面向门诊患者的智能导诊，采集症状主诉推荐就诊科室',
    applicant: '孙伟',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.4 MB', url: '#' },
      { name: '技术规格书.pdf', size: '1.9 MB', url: '#' },
    ],
    accessMode: 'OTel',
    platformUrl: 'https://otel.platform-hospital.cn/agent/mz-0001',
    platformKey: 'sk-otel****-5a2c',
    connectionTested: true,
    connectionStatus: 'success',
    status: '退回修改',
    lastEditTime: nowISO(-4),
    submitTime: nowISO(-5),
    returnTime: nowISO(-4),
    returnReason: '备案材料中缺少技术规格书的「错误码说明」一节，请补充后重新提交。',
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-5), status: 'finish', operator: '孙伟' },
      { label: '审核中', time: nowISO(-5), status: 'process', operator: '李秀英' },
      { label: '退回修改', time: nowISO(-4), status: 'error', operator: '李秀英', desc: '备案材料中缺少技术规格书的「错误码说明」一节' },
    ],
  },
  {
    id: 'acc-006',
    name: '智能预问诊',
    agentCode: 'XX-0001',
    version: '1.0',
    department: '信息中心',
    clinicalStage: '预问诊',
    source: '自研',
    supplier: '本院信息科',
    contactName: '李秀英',
    contactPhone: '13400134006',
    type: '智能问诊',
    description: '面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等信息',
    applicant: '李秀英',
    applicantRole: ROLE_ADMIN,
    attachments: [
      { name: '产品说明书.pdf', size: '1.6 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.4 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.50:8080/chat',
    apiKey: 'ak-yy****-yy06',
    connectionTested: true,
    connectionStatus: 'success',
    status: '撤销修改',
    lastEditTime: nowISO(-10),
    submitTime: nowISO(-15),
    cancelTime: nowISO(-10),
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-15), status: 'finish', operator: '李秀英' },
      { label: '撤销', time: nowISO(-10), status: 'wait', operator: '李秀英', desc: '申请人主动撤销' },
    ],
  },
  {
    id: 'acc-007',
    name: '智能随访管理（草稿）',
    agentCode: 'XX-0002',
    version: '0.9',
    department: '信息中心',
    clinicalStage: '其他',
    source: '自研',
    supplier: '本院信息科',
    contactName: '王浩',
    contactPhone: '13300133007',
    type: '随访管理',
    description: '面向出院患者的智能随访，自动生成随访计划与宣教内容',
    applicant: '王浩',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.0 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.60:8080/chat',
    connectionTested: false,
    status: '草稿',
    lastEditTime: nowISO(0),
    auditHistory: [],
  },
  {
    id: 'acc-008',
    name: '智能导诊分诊（草稿）',
    agentCode: 'XX-0003',
    version: '1.0',
    department: '信息中心',
    clinicalStage: '导诊分诊',
    source: '自研',
    supplier: '本院信息科',
    contactName: '李秀英',
    contactPhone: '13400134006',
    type: '导诊分诊',
    description: '面向门诊大厅的导诊分诊助手，根据主诉推荐就诊科室',
    applicant: '李秀英',
    applicantRole: ROLE_DEPT,
    attachments: [{ name: '产品说明书.pdf', size: '1.1 MB', url: '#' }],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.61:8080/chat',
    connectionTested: false,
    status: '草稿',
    lastEditTime: nowISO(0),
    auditHistory: [],
  },
  {
    id: 'acc-009',
    name: '门诊预问诊助手',
    agentCode: 'XX-0004',
    version: '1.2',
    department: '信息中心',
    clinicalStage: '预问诊',
    source: '自研',
    supplier: '本院信息科',
    contactName: '李秀英',
    contactPhone: '13400134006',
    type: '智能问诊',
    description: '面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等',
    applicant: '李秀英',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.5 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.0 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.62:8080/chat',
    apiKey: 'ak-xx****-0042',
    connectionTested: true,
    connectionStatus: 'success',
    status: '待审核',
    lastEditTime: nowISO(-2),
    submitTime: nowISO(-2),
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-2), status: 'finish', operator: '李秀英' },
    ],
  },
  {
    id: 'acc-010',
    name: '住院病程生成',
    agentCode: 'XX-0005',
    version: '1.0',
    department: '信息中心',
    clinicalStage: '住院',
    source: '合作研发',
    supplier: '北京医云科技有限公司',
    contactName: '李秀英',
    contactPhone: '13400134006',
    type: '病历生成',
    description: '面向住院医师的病程记录草稿生成助手，整合主诉、查体、辅助检查',
    applicant: '李秀英',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.3 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.1 MB', url: '#' },
    ],
    accessMode: 'SDK',
    platformUrl: 'https://otel.platform-hospital.cn/agent/xx-0005',
    platformKey: 'sk-sdk****-xx05',
    connectionTested: true,
    connectionStatus: 'success',
    status: '审核中',
    lastEditTime: nowISO(-3),
    submitTime: nowISO(-3),
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-3), status: 'finish', operator: '李秀英' },
      { label: '审核中', time: nowISO(-1), status: 'process', operator: '管理员' },
    ],
  },
  {
    id: 'acc-011',
    name: '检验报告解读',
    agentCode: 'XX-0006',
    version: '0.8',
    department: '信息中心',
    clinicalStage: '辅助诊断',
    source: '第三方',
    supplier: '上海智慧医疗科技公司',
    contactName: '李秀英',
    contactPhone: '13400134006',
    type: '辅助诊断',
    description: '面向检验科结果的智能解读，对异常指标给出提示与建议',
    applicant: '李秀英',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.0 MB', url: '#' },
      { name: '技术规格书.pdf', size: '1.8 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.63:8080/chat',
    apiKey: 'ak-xx****-0063',
    connectionTested: true,
    connectionStatus: 'success',
    status: '退回修改',
    lastEditTime: nowISO(-5),
    submitTime: nowISO(-6),
    returnTime: nowISO(-4),
    returnReason: '备案材料中缺少技术规格书的「错误码说明」一节，请补充后重新提交',
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-6), status: 'finish', operator: '李秀英' },
      { label: '审核中', time: nowISO(-5), status: 'process', operator: '管理员' },
      { label: '退回修改', time: nowISO(-4), status: 'error', operator: '管理员', desc: '备案材料中缺少技术规格书的「错误码说明」一节' },
    ],
  },
  {
    id: 'acc-012',
    name: '智能随访管理',
    agentCode: 'XX-0007',
    version: '2.0',
    department: '信息中心',
    clinicalStage: '其他',
    source: '自研',
    supplier: '本院信息科',
    contactName: '李秀英',
    contactPhone: '13400134006',
    type: '随访管理',
    description: '面向出院患者的智能随访，自动生成随访计划与宣教内容',
    applicant: '李秀英',
    applicantRole: ROLE_DEPT,
    attachments: [
      { name: '产品说明书.pdf', size: '1.4 MB', url: '#' },
      { name: '技术规格书.pdf', size: '2.3 MB', url: '#' },
    ],
    accessMode: 'API',
    apiEndpoint: 'http://10.10.10.64:8080/chat',
    apiKey: 'ak-xx****-0064',
    connectionTested: true,
    connectionStatus: 'success',
    status: '审核通过',
    lastEditTime: nowISO(-10),
    submitTime: nowISO(-9),
    passTime: nowISO(-7),
    passNote: '技术参数完整，备案材料齐全，同意接入。',
    auditHistory: [
      { label: '提交注册申请', time: nowISO(-9), status: 'finish', operator: '李秀英' },
      { label: '审核中', time: nowISO(-8), status: 'process', operator: '管理员' },
      { label: '审核通过', time: nowISO(-7), status: 'finish', operator: '管理员', desc: '技术参数完整，备案材料齐全' },
      { label: '台账同步', time: nowISO(-7), status: 'finish', desc: '已同步至统一台账中心' },
    ],
    ledgerSynced: true,
  },
];

// ──────────────────────────────────────────────────────────────────────
// 共享 store
// ──────────────────────────────────────────────────────────────────────
let recordsState: AccessRecord[] = [...initialRecords];

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getRecords = () => recordsState;

export const useAccessRecords = () =>
  useSyncExternalStore(subscribe, getRecords, getRecords);

/** 取出一条记录（不订阅变更） */
export const getAccessRecord = (id: string): AccessRecord | undefined =>
  recordsState.find((r) => r.id === id);

/** 新增 / 替换一条记录 */
export const upsertAccessRecord = (rec: AccessRecord) => {
  const exists = recordsState.find((p) => p.id === rec.id);
  recordsState = exists
    ? recordsState.map((p) => (p.id === rec.id ? rec : p))
    : [rec, ...recordsState];
  notify();
};

/** 局部更新（状态机流转 / 审核结论等） */
export const patchAccessRecord = (id: string, patch: Partial<AccessRecord>) => {
  recordsState = recordsState.map((r) => (r.id === id ? { ...r, ...patch } : r));
  notify();
};

/** 追加 timeline 节点 */
export const appendAuditNode = (id: string, node: TimelineNode) => {
  recordsState = recordsState.map((r) =>
    r.id === id ? { ...r, auditHistory: [...r.auditHistory, node] } : r,
  );
  notify();
};

/** 删除记录 */
export const removeAccessRecord = (id: string) => {
  recordsState = recordsState.filter((r) => r.id !== id);
  notify();
};

/** 暴露工具给页面 */
export { nowISO };
