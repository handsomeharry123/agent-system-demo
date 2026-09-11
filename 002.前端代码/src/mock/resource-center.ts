/**
 * 医院资源管理中心 - mock 数据（V1.1）
 * 数据来源:医院资源管理中心-需求说明文档V1.1.md
 *   2.1.1 资源管理页（全部资源） / 2.1.2 注册资源草稿页
 *   2.2   注册资源页
 *   3.1   申请管理页 / 3.2 申请权限页 / 3.3 权限审批页 / 3.4 权限申请详情页
 *
 * V1.1 关键差异：
 *   - 角色更名：「平台管理员 / 申请人」→ 「信息科管理员 / 科室管理员」
 *   - §2.1.1 全部资源：信息科所有管理员注册的资源（管理员之间数据不隔离）
 *   - §2.1.2 注册资源草稿：当前信息科管理员注册的资源（管理员之间数据隔离）
 *   - §3.1 各 Tab 数据范围：信息科管理员看全部 / 科室管理员看自己（用户隔离）
 *
 * 对接方式枚举(HL7 / FHIR / DICOM / 数据库直连 / MQ 消息队列)与 V1.1 §2.1.1 一致
 */

import dayjs from 'dayjs';

// ============== 枚举与基础类型 ==============

export type ProtocolType = 'HL7' | 'FHIR' | 'DICOM' | 'DB' | 'MQ';

export const PROTOCOL_LABEL: Record<ProtocolType, string> = {
  HL7: 'HL7 协议',
  FHIR: 'FHIR 协议',
  DICOM: 'DICOM',
  DB: '数据库直连',
  MQ: 'MQ 消息队列',
};

export const PROTOCOL_COLOR: Record<ProtocolType, string> = {
  HL7: 'blue',
  FHIR: 'geekblue',
  DICOM: 'purple',
  DB: 'magenta',
  MQ: 'orange',
};

/** V1.0 §2.1 对接方式枚举值 */
export const HL7_VERSION_OPTIONS = [
  { value: 'v2.x', label: 'v2.x' },
  { value: 'v3', label: 'v3' },
];
export const HL7_TRANSPORT_OPTIONS = [
  { value: 'MLLP', label: 'MLLP' },
  { value: 'HTTP Gateway', label: 'HTTP Gateway' },
];
export const FHIR_TRANSPORT_OPTIONS = [
  { value: 'HTTP', label: 'HTTP' },
  { value: 'HTTPS', label: 'HTTPS' },
  { value: 'gRPC', label: 'gRPC' },
  { value: 'WebService', label: 'WebService' },
];
export const DB_TYPE_OPTIONS = [
  { value: 'MySQL', label: 'MySQL' },
  { value: 'Oracle', label: 'Oracle' },
  { value: 'SQLServer', label: 'SQLServer' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
];
export const MQ_TYPE_OPTIONS = [
  { value: 'Kafka', label: 'Kafka' },
  { value: 'RabbitMQ', label: 'RabbitMQ' },
  { value: 'RocketMQ', label: 'RocketMQ' },
  { value: 'ActiveMQ', label: 'ActiveMQ' },
];
export const MQ_AUTH_OPTIONS = [
  { value: 'AK/SK', label: 'AK / SK(Access Key)' },
  { value: 'SASL', label: 'SASL 认证' },
];

/** 资源列表(医院业务系统分类) - V1.0 §2.2 资源目录,9 大类全部覆盖 */
export const RESOURCE_CATALOG = [
  // 医院核心业务系统
  { code: 'HIS', name: 'HIS(医院信息系统)', group: '医院核心业务系统' },
  { code: 'EMR', name: 'EMR(电子病历系统)', group: '医院核心业务系统' },
  { code: 'LIS', name: 'LIS(实验室信息系统)', group: '医院核心业务系统' },
  { code: 'PACS', name: 'PACS(医学影像存档与通信系统)', group: '医院核心业务系统' },
  { code: 'RIS', name: 'RIS(放射信息管理系统)', group: '医院核心业务系统' },
  { code: 'UIS', name: 'UIS(超声信息管理系统)', group: '医院核心业务系统' },
  { code: 'EIS', name: 'EIS(内镜信息管理系统)', group: '医院核心业务系统' },
  { code: 'PIS', name: 'PIS(病理信息管理系统)', group: '医院核心业务系统' },
  { code: 'BIS', name: 'BIS/BTMIS(输血管理信息系统)', group: '医院核心业务系统' },
  { code: 'ORIS', name: 'ORIS/AIMS(手术麻醉信息系统)', group: '医院核心业务系统' },
  { code: 'CCIS', name: 'CCIS/ICIS(重症监护信息系统)', group: '医院核心业务系统' },
  { code: 'CSSD', name: 'CSSD(消毒供应中心管理系统)', group: '医院核心业务系统' },
  { code: 'HISM', name: 'HISM(院感监测管理系统)', group: '医院核心业务系统' },
  { code: 'IDR', name: '传染病上报管理系统', group: '医院核心业务系统' },
  // 信息平台/集成
  { code: 'CDR', name: 'CDR(临床数据中心)', group: '信息平台/集成' },
  { code: 'ODR', name: 'ODR(运营数据中心)', group: '信息平台/集成' },
  { code: 'EMPI', name: 'EMPI(患者主索引系统)', group: '信息平台/集成' },
  { code: 'EDW', name: 'EDW(医院数据仓库)', group: '信息平台/集成' },
  { code: 'BI', name: 'BI(医院 BI 决策分析系统)', group: '信息平台/集成' },
  // 门诊业务系统
  { code: 'ODS', name: 'ODS(门诊医生工作站)', group: '门诊业务系统' },
  { code: 'ONW', name: '门诊护士工作站', group: '门诊业务系统' },
  { code: 'OBR', name: '门诊预约挂号系统', group: '门诊业务系统' },
  { code: 'QMS', name: 'QMS(门诊分诊叫号系统)', group: '门诊业务系统' },
  { code: 'OCS', name: '门诊收费系统', group: '门诊业务系统' },
  { code: 'OPH', name: '门诊药房管理系统', group: '门诊业务系统' },
  { code: 'ODS-INJ', name: '门诊输液管理系统', group: '门诊业务系统' },
  { code: 'SKD', name: '皮肤性病科管理系统', group: '门诊业务系统' },
  { code: 'KQK', name: '口腔科管理系统', group: '门诊业务系统' },
  { code: 'YKK', name: '眼科管理系统', group: '门诊业务系统' },
  { code: 'EBHK', name: '耳鼻喉科管理系统', group: '门诊业务系统' },
  // 急诊业务系统
  { code: 'EIS-ED', name: 'EIS(急诊信息系统)', group: '急诊业务系统' },
  { code: 'ED-TRIAGE', name: '急诊预检分诊系统', group: '急诊业务系统' },
  { code: 'ED-OBS', name: '急诊留观管理系统', group: '急诊业务系统' },
  { code: 'ED-RESCUE', name: '急诊抢救管理系统', group: '急诊业务系统' },
  // 住院业务系统
  { code: 'IDS', name: 'IDS(住院医生工作站)', group: '住院业务系统' },
  { code: 'INW', name: '住院护士工作站', group: '住院业务系统' },
  { code: 'IHM', name: '住院收费管理系统', group: '住院业务系统' },
  { code: 'IAM', name: '入出院管理系统', group: '住院业务系统' },
  { code: 'BDM', name: '床位管理系统', group: '住院业务系统' },
  { code: 'DMS', name: '膳食管理系统', group: '住院业务系统' },
  // 护理业务系统
  { code: 'NEMR', name: 'NEMR(护理电子病历系统)', group: '护理业务系统' },
  { code: 'M-NURSE', name: '移动护理系统', group: '护理业务系统' },
  { code: 'M-ROUND', name: '移动查房系统', group: '护理业务系统' },
  { code: 'N-QC', name: '护理质控管理系统', group: '护理业务系统' },
  { code: 'N-SCHED', name: '护理排班管理系统', group: '护理业务系统' },
  { code: 'PU', name: '压疮管理系统', group: '护理业务系统' },
  { code: 'FALL', name: '跌倒管理系统', group: '护理业务系统' },
  { code: 'CATHETER', name: '导管管理系统', group: '护理业务系统' },
  { code: 'PAIN', name: '疼痛管理系统', group: '护理业务系统' },
  // 医技系统
  { code: 'NUC', name: '核医学管理系统', group: '医技系统' },
  { code: 'ECGEIS', name: '心电信息管理系统(ECGEIS)', group: '医技系统' },
  { code: 'EEG', name: '脑电信息管理系统', group: '医技系统' },
  { code: 'PFT', name: '肺功能管理系统', group: '医技系统' },
  { code: 'GIM', name: '胃肠动力检查系统', group: '医技系统' },
  { code: 'EMG', name: '肌电图管理系统', group: '医技系统' },
  // 药事管理系统
  { code: 'PDS', name: '医院药品管理系统', group: '药事管理系统' },
  { code: 'IPHARM', name: '智能药房系统', group: '药事管理系统' },
  { code: 'ICAB', name: '智能药柜系统', group: '药事管理系统' },
  { code: 'PIVAS', name: 'PIVAS(静脉用药调配中心系统)', group: '药事管理系统' },
  { code: 'PRX', name: '处方审核系统', group: '药事管理系统' },
  { code: 'PASS', name: 'PASS(合理用药监测系统)', group: '药事管理系统' },
  { code: 'ANT', name: '抗菌药物管理系统', group: '药事管理系统' },
  { code: 'NARC', name: '麻精药品管理系统', group: '药事管理系统' },
  { code: 'ADR', name: 'ADR(药品不良反应监测系统)', group: '药事管理系统' },
  { code: 'OPHARM', name: '药学门诊管理系统', group: '药事管理系统' },
  // 科研教学系统
  { code: 'RES', name: '医院科研管理系统', group: '科研教学系统' },
  { code: 'PAPER', name: '医学论文管理系统', group: '科研教学系统' },
  { code: 'CTMS', name: 'CTMS(临床试验管理系统)', group: '科研教学系统' },
  { code: 'BIOBANK', name: '生物样本库管理系统', group: '科研教学系统' },
  { code: 'TEACH', name: '医学教学管理系统', group: '科研教学系统' },
  { code: 'RES-TRAIN', name: '住院医师规范化培训系统', group: '科研教学系统' },
  { code: 'CE', name: '继续教育管理系统', group: '科研教学系统' },
];

/** 对接方式动态子字段(只用于详情快照展示,V1.0 §2.1) */
export interface ProtocolConfig {
  /** 通用键值对(键->值) */
  fields: { label: string; value: string }[];
}

export interface ResourceItem {
  /** 资源 ID(R-0001 起) */
  id: string;
  /** 资源名称(系统分类) - 多选 */
  resources: string[];
  /** 资源负责人 */
  owner: string;
  /** 联系方式(手机号) */
  contact: string;
  /** 对接方式 */
  protocol: ProtocolType;
  /** 子字段 */
  protocolConfig: ProtocolConfig;
  /** 状态:registered | draft | deleted */
  status: 'registered' | 'draft' | 'deleted';
  /** 注册时间 / 最后编辑时间 */
  updatedAt: string;
  /**
   * 创建人账号(V1.1 §2.1.2 数据隔离)：
   *   - 全部资源(§2.1.1)管理员之间不隔离,该字段用于「创建人」展示
   *   - 草稿(§2.1.2)管理员之间隔离,仅展示当前管理员本人创建的草稿
   */
  creator?: string;
}

const HL7_SAMPLE: ProtocolConfig = {
  fields: [
    { label: 'HL7 版本', value: 'v2.x' },
    { label: '协议类型', value: 'MLLP' },
    { label: 'IP 地址', value: '10.20.30.41' },
    { label: '端口号', value: '6661' },
  ],
};
const FHIR_SAMPLE: ProtocolConfig = {
  fields: [
    { label: '接口协议类型', value: 'HTTPS' },
    { label: 'URL 地址', value: 'https://fhir.hospital.local/baseR4' },
    { label: '密钥 Key', value: 'sk-****7f3a' },
  ],
};
const DICOM_SAMPLE: ProtocolConfig = {
  fields: [
    { label: 'DICOM 名称', value: 'HOSP-PACS' },
    { label: 'DICOM IP 地址', value: '10.20.30.42' },
    { label: 'DICOM 端口', value: '11112' },
  ],
};
const DB_SAMPLE: ProtocolConfig = {
  fields: [
    { label: '数据库类型', value: 'MySQL' },
    { label: 'IP 地址', value: '10.20.30.43' },
    { label: '端口', value: '3306' },
  ],
};
const MQ_SAMPLE: ProtocolConfig = {
  fields: [
    { label: 'MQ 类型', value: 'Kafka' },
    { label: 'Broker 地址', value: 'kafka.hospital.local' },
    { label: '端口', value: '9092' },
    { label: '认证方式', value: 'SASL' },
  ],
};

/** 已注册资源(8 条) - V1.1 §2.1.1 全部资源(管理员之间不隔离) */
export const mockResources: ResourceItem[] = [
  {
    id: 'R-0001',
    resources: ['HIS', 'EMR'],
    owner: '张志远',
    contact: '13800001001',
    protocol: 'HL7',
    protocolConfig: HL7_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-12 09:24:11',
    creator: 'admin01',
  },
  {
    id: 'R-0002',
    resources: ['PACS', 'RIS', 'UIS'],
    owner: '李慧敏',
    contact: '13800001002',
    protocol: 'DICOM',
    protocolConfig: DICOM_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-12 10:11:32',
    creator: 'admin01',
  },
  {
    id: 'R-0003',
    resources: ['LIS'],
    owner: '王建国',
    contact: '13800001003',
    protocol: 'FHIR',
    protocolConfig: FHIR_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-15 14:33:08',
    creator: 'admin02',
  },
  {
    id: 'R-0004',
    resources: ['ODR', 'CDR', 'BI', 'EDW'],
    owner: '陈雪',
    contact: '13800001004',
    protocol: 'DB',
    protocolConfig: DB_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-18 16:02:55',
    creator: 'admin02',
  },
  {
    id: 'R-0005',
    resources: ['PIVAS', 'PASS', 'PDS', 'ADR'],
    owner: '赵磊',
    contact: '13800001005',
    protocol: 'MQ',
    protocolConfig: MQ_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-20 11:45:00',
    creator: 'admin01',
  },
  {
    id: 'R-0006',
    resources: ['ODS', 'ONW', 'OCS', 'OPH'],
    owner: '孙婷',
    contact: '13800001006',
    protocol: 'HL7',
    protocolConfig: HL7_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-22 13:18:42',
    creator: 'admin02',
  },
  {
    id: 'R-0007',
    resources: ['IDS', 'INW', 'IHM', 'IAM'],
    owner: '吴海生',
    contact: '13800001007',
    protocol: 'FHIR',
    protocolConfig: FHIR_SAMPLE,
    status: 'registered',
    updatedAt: '2026-05-25 09:09:27',
    creator: 'admin01',
  },
  {
    id: 'R-0008',
    resources: ['EMPI'],
    owner: '周晓东',
    contact: '13800001008',
    protocol: 'DB',
    protocolConfig: DB_SAMPLE,
    status: 'registered',
    updatedAt: '2026-06-01 17:20:11',
    creator: 'admin02',
  },
];

/** 草稿资源(2 条) - V1.1 §2.1.2 注册资源草稿页(管理员之间隔离) */
export const mockDrafts: ResourceItem[] = [
  {
    id: 'D-0001',
    resources: ['HISM', 'IDR'],
    owner: '马芸',
    contact: '13800002001',
    protocol: 'HL7',
    protocolConfig: HL7_SAMPLE,
    status: 'draft',
    updatedAt: '2026-06-20 14:32:10',
    creator: 'admin01',
  },
  {
    id: 'D-0002',
    resources: ['CSSD'],
    owner: '林江',
    contact: '13800002002',
    protocol: 'MQ',
    protocolConfig: MQ_SAMPLE,
    status: 'draft',
    updatedAt: '2026-06-22 10:08:50',
    creator: 'admin02',
  },
];

// ============== 申请管理 mock ==============

/** 申请状态机 - V1.0 §3.1 */
export type ApplyStatus =
  | 'draft' // 草稿
  | 'pending' // 待审核
  | 'reviewing' // 审核中
  | 'approved' // 审核通过
  | 'rejected' // 退回修改
  | 'revoked' // 撤销修改
  | 'archived'; // 已归档(超过 30 天)

export const APPLY_STATUS_LABEL: Record<ApplyStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  reviewing: '审核中',
  approved: '审核通过',
  rejected: '退回修改',
  revoked: '撤销修改',
  archived: '已归档',
};

export const APPLY_STATUS_COLOR: Record<ApplyStatus, string> = {
  draft: 'default',
  pending: 'gold',
  reviewing: 'processing',
  approved: 'success',
  rejected: 'warning',
  revoked: 'default',
  archived: 'default',
};

export const APPLY_TABS: { key: 'all' | ApplyStatus; label: string }[] = [
  { key: 'all', label: '全部申请' },
  { key: 'draft', label: '草稿' },
  { key: 'pending', label: '待审核' },
  { key: 'reviewing', label: '审核中' },
  { key: 'approved', label: '审核通过' },
  { key: 'rejected', label: '退回修改' },
  { key: 'revoked', label: '撤销修改' },
];

export interface ApprovalTrail {
  /** 审批节点 */
  action: '提交' | '撤销' | '开始审核' | '审核通过' | '退回修改' | '重新提交' | '自动归档' | '编辑';
  operator: string;
  at: string;
  comment?: string;
  /** 节点视觉状态(避免字符串模糊匹配) */
  status?: 'finish' | 'error' | 'process' | 'wait';
  /** 节点影响的目标状态(用于精确匹配审核人/审核时间) */
  targetStatus?: ApplyStatus;
}

export interface ApplyItem {
  id: string;
  agentId: string; // 智能体编号
  agentName: string;
  department: string; // 科室代码+名称
  stage: string; // 诊疗环节(以 / 分隔)
  description: string; // 功能描述
  resourceId: string; // 申请资源 ID
  resourceName: string; // 申请资源名称(15 字)
  /** 权限申请理由（草稿清单与审核详情展示） */
  reason?: string;
  status: ApplyStatus;
  /** 申请人姓名(显示) */
  applicant: string;
  /**
   * 申请人账号(V1.1 §3.1 数据隔离):
   *   - 信息科管理员:看全部
   *   - 科室管理员(申请人):仅看自己的申请
   */
  applicantAccount: string;
  /** 各状态时间戳(按状态出现) */
  draftAt?: string;
  submittedAt?: string;
  reviewingAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  revokedAt?: string;
  archivedAt?: string;
  /** 退回原因 / 审核意见 */
  rejectReason?: string;
  approveComment?: string;
  /** 审批轨迹 */
  trail: ApprovalTrail[];
}

/** 智能体编号解析:科室代码-顺序号 */
const AGENTS = [
  { id: 'XNK-0001', name: '智能导诊助手 v2.3', dept: 'XNK-心内科', stage: '导诊分诊/预问诊', applicant: '张志远', description: '为患者提供基于症状的智能导诊与预问诊服务,通过多轮对话采集主诉、现病史、既往史等信息,降低导诊台工作量,提升分诊准确率。' },
  { id: 'FNK-0001', name: '肺结节 AI 辅助阅片 v1.5', dept: 'FNK-呼吸科', stage: '辅助检查/辅助诊断', applicant: '李慧敏', description: '对胸部 CT 影像进行 AI 辅助阅片,自动标记疑似肺结节位置、大小、形态与密度,辅助影像科医生快速定位可疑病灶,降低漏诊率。' },
  { id: 'PFK-0001', name: '合理用药审方系统 v3.1', dept: 'PFK-药剂科', stage: '辅助治疗', applicant: '王建国', description: '对接 HIS 处方数据与 PASS 知识库,实时审查用药合理性,提示配伍禁忌、剂量超标、重复用药等风险,辅助药师审方决策。' },
  { id: 'JZK-0001', name: '急诊预检分诊 v1.0', dept: 'JZK-急诊科', stage: '导诊分诊/预问诊', applicant: '陈雪', description: '为急诊患者提供预检分诊,根据主诉、生命体征快速判定病情等级(Ⅰ-Ⅳ级),为候诊排序与抢救资源调度提供决策支持。' },
  { id: 'SJK-0001', name: '围手术期麻醉智能体 v2.0', dept: 'SJK-麻醉科', stage: '辅助治疗/手术', applicant: '赵磊', description: '围手术期麻醉方案推荐、麻醉风险评估与术中生命体征监测告警,辅助麻醉医师制定个体化麻醉方案。' },
  { id: 'XNK-0002', name: '心血管随访助手 v1.2', dept: 'XNK-心内科', stage: '其他:慢病随访', applicant: '孙婷', description: '对心内科出院患者提供智能随访与复诊提醒,采集症状、用药、血压等数据,生成结构化随访报告供医生参考。' },
];

export const mockAgents = AGENTS;

export const mockApplies: ApplyItem[] = [
  {
    id: 'A-2026-0001',
    agentId: 'XNK-0001',
    agentName: '智能导诊助手 v2.3',
    department: 'XNK-心内科',
    stage: '导诊分诊/预问诊',
    description: '为患者提供基于症状的智能导诊与预问诊服务,降低导诊台工作量。',
    resourceId: 'R-0001',
    resourceName: 'HIS/EMR',
    status: 'approved',
    applicant: '张志远',
    applicantAccount: 'user_zzy',
    submittedAt: '2026-06-10 09:14:21',
    reviewingAt: '2026-06-10 10:02:55',
    approvedAt: '2026-06-10 14:33:08',
    approveComment: '权限范围合理,符合临床导诊场景;允许访问门诊预约与患者基本信息,允许调用 EMR 病历摘要。',
    trail: [
      { action: '提交', operator: '张志远', at: '2026-06-10 09:14:21', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-06-10 10:02:55', status: 'process', targetStatus: 'reviewing' },
      { action: '审核通过', operator: '信息科管理员 admin01', at: '2026-06-10 14:33:08', comment: '权限范围合理,符合临床导诊场景。', status: 'finish', targetStatus: 'approved' },
    ],
  },
  {
    id: 'A-2026-0002',
    agentId: 'FNK-0001',
    agentName: '肺结节 AI 辅助阅片 v1.5',
    department: 'FNK-呼吸科',
    stage: '辅助检查/辅助诊断',
    description: '对胸部 CT 影像进行 AI 辅助阅片,标记疑似肺结节位置与大小,辅助医生诊断。',
    resourceId: 'R-0002',
    resourceName: 'PACS/RIS/UIS',
    status: 'reviewing',
    applicant: '李慧敏',
    applicantAccount: 'user_lhm',
    submittedAt: '2026-06-22 11:08:30',
    reviewingAt: '2026-06-22 14:20:18',
    trail: [
      { action: '提交', operator: '李慧敏', at: '2026-06-22 11:08:30', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin02', at: '2026-06-22 14:20:18', status: 'process', targetStatus: 'reviewing' },
    ],
  },
  {
    id: 'A-2026-0003',
    agentId: 'PFK-0001',
    agentName: '合理用药审方系统 v3.1',
    department: 'PFK-药剂科',
    stage: '辅助治疗',
    description: '对接 HIS 处方数据与 PASS 知识库,实时审查用药合理性并提示。',
    resourceId: 'R-0005',
    resourceName: 'PIVAS/PASS/PDS/ADR',
    status: 'pending',
    applicant: '王建国',
    applicantAccount: 'user_wjg',
    submittedAt: '2026-06-23 16:42:55',
    trail: [{ action: '提交', operator: '王建国', at: '2026-06-23 16:42:55', status: 'process', targetStatus: 'pending' }],
  },
  {
    id: 'A-2026-0004',
    agentId: 'JZK-0001',
    agentName: '急诊预检分诊 v1.0',
    department: 'JZK-急诊科',
    stage: '导诊分诊/预问诊',
    description: '为急诊患者提供预检分诊与候诊优先级建议。',
    resourceId: 'R-0006',
    resourceName: 'ODS/ONW/OCS/OPH',
    status: 'rejected',
    applicant: '陈雪',
    applicantAccount: 'user_cx',
    submittedAt: '2026-06-15 10:30:12',
    reviewingAt: '2026-06-15 11:00:00',
    rejectedAt: '2026-06-15 17:25:30',
    rejectReason: '申请范围超出急诊预检场景:未说明对门诊收费(OCS)与门诊药房(OPH)调用的必要性,请精简为「急诊预检」所需数据,重新提交。',
    trail: [
      { action: '提交', operator: '陈雪', at: '2026-06-15 10:30:12', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-06-15 11:00:00', status: 'process', targetStatus: 'reviewing' },
      {
        action: '退回修改',
        operator: '信息科管理员 admin01',
        at: '2026-06-15 17:25:30',
        comment: '申请范围超出急诊预检场景。',
        status: 'error',
        targetStatus: 'rejected',
      },
    ],
  },
  {
    id: 'A-2026-0005',
    agentId: 'SJK-0001',
    agentName: '围手术期麻醉智能体 v2.0',
    department: 'SJK-麻醉科',
    stage: '辅助治疗/手术',
    description: '围手术期麻醉方案推荐与术中生命体征监测。',
    resourceId: 'R-0007',
    resourceName: 'IDS/INW/IHM/IAM',
    status: 'revoked',
    applicant: '赵磊',
    applicantAccount: 'user_zl',
    submittedAt: '2026-06-05 09:00:00',
    reviewingAt: '2026-06-05 10:00:00',
    revokedAt: '2026-06-05 11:30:00',
    trail: [
      { action: '提交', operator: '赵磊', at: '2026-06-05 09:00:00', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-06-05 10:00:00', status: 'process', targetStatus: 'reviewing' },
      { action: '撤销', operator: '赵磊', at: '2026-06-05 11:30:00', comment: '需要补充业务说明。', status: 'error', targetStatus: 'revoked' },
    ],
  },
  {
    id: 'A-2026-0006',
    agentId: 'XNK-0002',
    agentName: '心血管随访助手 v1.2',
    department: 'XNK-心内科',
    stage: '其他:慢病随访',
    description: '对心内科出院患者提供智能随访与复诊提醒。',
    resourceId: 'R-0001',
    resourceName: 'HIS/EMR',
    status: 'draft',
    applicant: '孙婷',
    applicantAccount: 'user_st',
    draftAt: '2026-06-23 20:15:00',
    trail: [],
  },
  {
    id: 'A-2026-0007',
    agentId: 'FNK-0001',
    agentName: '肺结节 AI 辅助阅片 v1.5',
    department: 'FNK-呼吸科',
    stage: '辅助检查/辅助诊断',
    description: '对胸部 CT 影像进行 AI 辅助阅片。',
    resourceId: 'R-0003',
    resourceName: 'LIS',
    status: 'archived',
    applicant: '李慧敏',
    applicantAccount: 'user_lhm',
    submittedAt: '2026-04-01 09:00:00',
    reviewingAt: '2026-04-01 10:00:00',
    rejectedAt: '2026-04-01 17:00:00',
    archivedAt: '2026-05-01 00:00:00',
    rejectReason: 'LIS 数据范围与肺结节阅片场景不匹配,无需访问;请撤回该子项。',
    trail: [
      { action: '提交', operator: '李慧敏', at: '2026-04-01 09:00:00', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-04-01 10:00:00', status: 'process', targetStatus: 'reviewing' },
      { action: '退回修改', operator: '信息科管理员 admin01', at: '2026-04-01 17:00:00', status: 'error', targetStatus: 'rejected' },
      { action: '自动归档', operator: '系统', at: '2026-05-01 00:00:00', comment: '退回修改超过 30 天未重新提交,系统自动归档。', status: 'wait', targetStatus: 'archived' },
    ],
  },
  // ===== 演示账号 user_lxy(李秀英)补充数据 =====
  // 覆盖草稿/待审核/审核中/审核通过 4 个 Tab,
  // 让"以李秀英身份查看"在各 Tab 都有可见行(否则全 Tab 数据被 applicantAccount 过滤为空)
  {
    id: 'A-2026-0008',
    agentId: 'XNK-0002',
    agentName: '心血管随访助手 v1.2',
    department: 'XNK-心内科',
    stage: '其他:慢病随访',
    description: '对心内科出院患者提供智能随访与复诊提醒,采集血压/症状/用药数据。',
    resourceId: 'R-0001',
    resourceName: 'HIS/EMR',
    status: 'pending',
    applicant: '李秀英',
    applicantAccount: 'user_lxy',
    submittedAt: '2026-06-26 14:20:30',
    trail: [
      { action: '提交', operator: '李秀英', at: '2026-06-26 14:20:30', status: 'process', targetStatus: 'pending' },
    ],
  },
  {
    id: 'A-2026-0009',
    agentId: 'XNK-0001',
    agentName: '智能导诊助手 v2.3',
    department: 'XNK-心内科',
    stage: '导诊分诊/预问诊',
    description: '为心内科导诊台提供基于症状的智能导诊与预问诊支持。',
    resourceId: 'R-0002',
    resourceName: 'PACS/RIS/UIS',
    status: 'reviewing',
    applicant: '李秀英',
    applicantAccount: 'user_lxy',
    submittedAt: '2026-06-24 09:35:12',
    reviewingAt: '2026-06-24 10:18:00',
    trail: [
      { action: '提交', operator: '李秀英', at: '2026-06-24 09:35:12', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin02', at: '2026-06-24 10:18:00', status: 'process', targetStatus: 'reviewing' },
    ],
  },
  {
    id: 'A-2026-0010',
    agentId: 'XNK-0002',
    agentName: '心血管随访助手 v1.2',
    department: 'XNK-心内科',
    stage: '其他:慢病随访',
    description: '对心内科出院患者提供智能随访。',
    resourceId: 'R-0001',
    resourceName: 'HIS/EMR',
    status: 'draft',
    applicant: '李秀英',
    applicantAccount: 'user_lxy',
    draftAt: '2026-06-27 11:02:18',
    trail: [],
  },
  {
    id: 'A-2026-0011',
    agentId: 'XNK-0002',
    agentName: '心血管随访助手 v1.2',
    department: 'XNK-心内科',
    stage: '其他:慢病随访',
    description: '对心内科出院患者提供智能随访,允许访问随访记录与血压数据。',
    resourceId: 'R-0004',
    resourceName: 'EMR/随访表/血压监测',
    status: 'approved',
    applicant: '李秀英',
    applicantAccount: 'user_lxy',
    submittedAt: '2026-05-20 15:08:42',
    reviewingAt: '2026-05-20 16:00:12',
    approvedAt: '2026-05-21 10:25:30',
    approveComment: '随访场景权限范围合理,准予接入。',
    trail: [
      { action: '提交', operator: '李秀英', at: '2026-05-20 15:08:42', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-05-20 16:00:12', status: 'process', targetStatus: 'reviewing' },
      { action: '审核通过', operator: '信息科管理员 admin01', at: '2026-05-21 10:25:30', comment: '随访场景权限范围合理,准予接入。', status: 'finish', targetStatus: 'approved' },
    ],
  },
  // ===== 申请管理列表 mock 扩到 20 条(V1.2) =====
  // 覆盖 7 个 Tab,复用现有 6 个 agent + 8 个资源,补足 9 条新数据
  {
    id: 'A-2026-0012',
    agentId: 'FNK-0001',
    agentName: '肺结节 AI 辅助阅片 v1.5',
    department: 'FNK-呼吸科',
    stage: '辅助检查/辅助诊断',
    description: '为呼吸科门诊医生提供肺结节随访阅片与历史对比。',
    resourceId: 'R-0002',
    resourceName: 'PACS/RIS/UIS',
    status: 'pending',
    applicant: '李慧敏',
    applicantAccount: 'user_lhm',
    submittedAt: '2026-06-27 09:14:22',
    trail: [
      { action: '提交', operator: '李慧敏', at: '2026-06-27 09:14:22', status: 'process', targetStatus: 'pending' },
    ],
  },
  {
    id: 'A-2026-0013',
    agentId: 'PFK-0001',
    agentName: '合理用药审方系统 v3.1',
    department: 'PFK-药剂科',
    stage: '辅助治疗',
    description: '为临床药师提供门诊处方实时审方与配伍禁忌提醒。',
    resourceId: 'R-0001',
    resourceName: 'HIS/EMR',
    status: 'pending',
    applicant: '王建国',
    applicantAccount: 'user_wjg',
    submittedAt: '2026-06-27 10:48:11',
    trail: [
      { action: '提交', operator: '王建国', at: '2026-06-27 10:48:11', status: 'process', targetStatus: 'pending' },
    ],
  },
  {
    id: 'A-2026-0014',
    agentId: 'JZK-0001',
    agentName: '急诊预检分诊 v1.0',
    department: 'JZK-急诊科',
    stage: '导诊分诊/预问诊',
    description: '为急诊预检台提供候诊优先级与病情等级判定。',
    resourceId: 'R-0001',
    resourceName: 'HIS/EMR',
    status: 'reviewing',
    applicant: '陈雪',
    applicantAccount: 'user_cx',
    submittedAt: '2026-06-26 15:30:08',
    reviewingAt: '2026-06-27 08:55:42',
    trail: [
      { action: '提交', operator: '陈雪', at: '2026-06-26 15:30:08', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-06-27 08:55:42', status: 'process', targetStatus: 'reviewing' },
    ],
  },
  {
    id: 'A-2026-0015',
    agentId: 'SJK-0001',
    agentName: '围手术期麻醉智能体 v2.0',
    department: 'SJK-麻醉科',
    stage: '辅助治疗/手术',
    description: '为麻醉医师提供围手术期生命体征监测与麻醉方案推荐。',
    resourceId: 'R-0007',
    resourceName: 'IDS/INW/IHM/IAM',
    status: 'reviewing',
    applicant: '赵磊',
    applicantAccount: 'user_zl',
    submittedAt: '2026-06-25 14:18:30',
    reviewingAt: '2026-06-26 09:42:11',
    trail: [
      { action: '提交', operator: '赵磊', at: '2026-06-25 14:18:30', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin02', at: '2026-06-26 09:42:11', status: 'process', targetStatus: 'reviewing' },
    ],
  },
  {
    id: 'A-2026-0016',
    agentId: 'XNK-0002',
    agentName: '心血管随访助手 v1.2',
    department: 'XNK-心内科',
    stage: '其他:慢病随访',
    description: '为心内科慢病随访提供血压采集与复诊提醒。',
    resourceId: 'R-0008',
    resourceName: 'EMPI',
    status: 'approved',
    applicant: '孙婷',
    applicantAccount: 'user_st',
    submittedAt: '2026-06-18 10:08:00',
    reviewingAt: '2026-06-18 11:25:30',
    approvedAt: '2026-06-19 14:50:12',
    approveComment: 'EMPI 主索引范围合理,准予接入随访场景。',
    trail: [
      { action: '提交', operator: '孙婷', at: '2026-06-18 10:08:00', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-06-18 11:25:30', status: 'process', targetStatus: 'reviewing' },
      { action: '审核通过', operator: '信息科管理员 admin01', at: '2026-06-19 14:50:12', comment: 'EMPI 主索引范围合理,准予接入。', status: 'finish', targetStatus: 'approved' },
    ],
  },
  {
    id: 'A-2026-0017',
    agentId: 'XNK-0001',
    agentName: '智能导诊助手 v2.3',
    department: 'XNK-心内科',
    stage: '导诊分诊/预问诊',
    description: '为门诊导诊台提供基于症状的智能分诊与预问诊。',
    resourceId: 'R-0006',
    resourceName: 'ODS/ONW/OCS/OPH',
    status: 'rejected',
    applicant: '张志远',
    applicantAccount: 'user_zzy',
    submittedAt: '2026-06-12 13:22:18',
    reviewingAt: '2026-06-12 14:00:00',
    rejectedAt: '2026-06-12 17:45:30',
    rejectReason: '门诊收费(OCS)与门诊药房(OPH)调用范围超出导诊场景;请精简为「分诊与预约」所需数据,重新提交。',
    trail: [
      { action: '提交', operator: '张志远', at: '2026-06-12 13:22:18', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin02', at: '2026-06-12 14:00:00', status: 'process', targetStatus: 'reviewing' },
      {
        action: '退回修改',
        operator: '信息科管理员 admin02',
        at: '2026-06-12 17:45:30',
        comment: 'OCS/OPH 调用范围超出导诊场景。',
        status: 'error',
        targetStatus: 'rejected',
      },
    ],
  },
  {
    id: 'A-2026-0018',
    agentId: 'FNK-0001',
    agentName: '肺结节 AI 辅助阅片 v1.5',
    department: 'FNK-呼吸科',
    stage: '辅助检查/辅助诊断',
    description: '为呼吸科医生提供 CT 影像 AI 辅助阅片与随访对比。',
    resourceId: 'R-0004',
    resourceName: 'ODR/CDR/BI/EDW',
    status: 'revoked',
    applicant: '李慧敏',
    applicantAccount: 'user_lhm',
    submittedAt: '2026-06-08 09:30:00',
    reviewingAt: '2026-06-08 10:15:00',
    revokedAt: '2026-06-08 16:20:00',
    trail: [
      { action: '提交', operator: '李慧敏', at: '2026-06-08 09:30:00', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-06-08 10:15:00', status: 'process', targetStatus: 'reviewing' },
      { action: '撤销', operator: '李慧敏', at: '2026-06-08 16:20:00', comment: '业务方案调整,稍后重新提交。', status: 'error', targetStatus: 'revoked' },
    ],
  },
  {
    id: 'A-2026-0019',
    agentId: 'PFK-0001',
    agentName: '合理用药审方系统 v3.1',
    department: 'PFK-药剂科',
    stage: '辅助治疗',
    description: '为审方药师提供处方用药合理性实时审查。',
    resourceId: 'R-0003',
    resourceName: 'LIS',
    status: 'draft',
    applicant: '王建国',
    applicantAccount: 'user_wjg',
    draftAt: '2026-06-27 16:30:00',
    trail: [],
  },
  {
    id: 'A-2026-0020',
    agentId: 'JZK-0001',
    agentName: '急诊预检分诊 v1.0',
    department: 'JZK-急诊科',
    stage: '导诊分诊/预问诊',
    description: '为急诊预检台提供候诊优先级与病情等级判定。',
    resourceId: 'R-0005',
    resourceName: 'PIVAS/PASS/PDS/ADR',
    status: 'archived',
    applicant: '陈雪',
    applicantAccount: 'user_cx',
    submittedAt: '2026-04-15 09:30:00',
    reviewingAt: '2026-04-15 10:00:00',
    rejectedAt: '2026-04-15 17:00:00',
    archivedAt: '2026-05-16 00:00:00',
    rejectReason: '审方/摆药相关数据范围与急诊预检场景不匹配,无需访问;请撤回该子项。',
    trail: [
      { action: '提交', operator: '陈雪', at: '2026-04-15 09:30:00', status: 'process', targetStatus: 'pending' },
      { action: '开始审核', operator: '信息科管理员 admin01', at: '2026-04-15 10:00:00', status: 'process', targetStatus: 'reviewing' },
      { action: '退回修改', operator: '信息科管理员 admin01', at: '2026-04-15 17:00:00', status: 'error', targetStatus: 'rejected' },
      { action: '自动归档', operator: '系统', at: '2026-05-16 00:00:00', comment: '退回修改超过 30 天未重新提交,系统自动归档。', status: 'wait', targetStatus: 'archived' },
    ],
  },
];

// ============== 工具函数 ==============

/** 智能体名称 / 资源名称截断(支持悬浮展示完整) */
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 状态时间字段(根据状态返回对应时间) */
export const statusTime = (it: ApplyItem): string => {
  switch (it.status) {
    case 'draft':
      return it.draftAt || '-';
    case 'pending':
      return it.submittedAt || '-';
    case 'reviewing':
      return it.reviewingAt || it.submittedAt || '-';
    case 'approved':
      return it.approvedAt || '-';
    case 'rejected':
      return it.rejectedAt || '-';
    case 'revoked':
      return it.revokedAt || '-';
    case 'archived':
      // archived 状态下显示归档时间(同时审核时间回退到 rejectedAt)
      return it.archivedAt || it.rejectedAt || '-';
  }
};

/** 获取审核人(按目标状态精确匹配) */
export const getReviewer = (it: ApplyItem, target: 'reviewing' | 'approved' | 'rejected' | 'archived') => {
  return it.trail.find((t) => t.targetStatus === target)?.operator || '-';
};

/** 获取审核时间(按目标状态精确匹配) */
export const getReviewTime = (it: ApplyItem, target: 'reviewing' | 'approved' | 'rejected' | 'archived') => {
  switch (target) {
    case 'reviewing':
      return it.reviewingAt || '-';
    case 'approved':
      return it.approvedAt || '-';
    case 'rejected':
      return it.rejectedAt || '-';
    case 'archived':
      return it.archivedAt || it.rejectedAt || '-';
  }
};

// ============== 共享 store(简易 reactive) ==============
// 跨页面(Applies / ApplyForm / Approval / ApplyDetail)共享数据 + 状态变更

import { useSyncExternalStore } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDemoSettings } from '../hooks/useDemoSettings';

type Listener = () => void;
const listeners = new Set<Listener>();

/** 当前应用数据状态 - 多个页面共享同一份 */
let appliesState: ApplyItem[] = [...mockApplies];
let resourcesState: ResourceItem[] = [...mockResources];
let draftsState: ResourceItem[] = [...mockDrafts];

const notify = () => listeners.forEach((l) => l());

export const getApplies = () => appliesState;
export const getResources = () => resourcesState;
export const getDrafts = () => draftsState;

const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useApplies = () => useSyncExternalStore(subscribe, getApplies, getApplies);
export const useResources = () => useSyncExternalStore(subscribe, getResources, getResources);
export const useDrafts = () => useSyncExternalStore(subscribe, getDrafts, getDrafts);

/** 写操作:更新申请(append trail / status 流转) */
export const updateApply = (id: string, patch: Partial<ApplyItem> & { appendTrail?: ApprovalTrail }) => {
  appliesState = appliesState.map((a) => {
    if (a.id !== id) return a;
    const merged: ApplyItem = { ...a, ...patch };
    if (patch.appendTrail) {
      merged.trail = [...a.trail, patch.appendTrail];
    }
    return merged;
  });
  notify();
};

/** 写操作:删除申请 */
export const removeApply = (id: string) => {
  appliesState = appliesState.filter((a) => a.id !== id);
  notify();
};

/** 写操作:新增申请 */
export const addApply = (it: ApplyItem) => {
  appliesState = [it, ...appliesState];
  notify();
};

/** 写操作:更新资源台账 */
export const updateResource = (id: string, patch: Partial<ResourceItem>) => {
  resourcesState = resourcesState.map((r) => r.id === id ? { ...r, ...patch } : r);
  notify();
};

export const addResource = (r: ResourceItem) => {
  resourcesState = [r, ...resourcesState];
  notify();
};

export const removeResource = (id: string) => {
  resourcesState = resourcesState.filter((r) => r.id !== id);
  notify();
};

/** 写操作:草稿资源 */
export const addDraft = (d: ResourceItem) => {
  draftsState = [d, ...draftsState];
  notify();
};

export const removeDraft = (id: string) => {
  draftsState = draftsState.filter((d) => d.id !== id);
  notify();
};

/** 时间戳工具(避免硬编码) */
export const nowAt = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** 角色(用于演示两种视角差异)
 *   admin = 信息科管理员(V1.1 §1.4 角色更名)
 *   user  = 科室管理员(V1.1 §1.4 角色更名)
 */
export type DemoRole = 'admin' | 'user';
export const DEFAULT_DEMO_ROLE: DemoRole = 'admin';

/** 角色中文名(V1.1 §1.4) */
export const ROLE_LABEL: Record<DemoRole, string> = {
  admin: '信息科管理员',
  user: '科室管理员',
};

/**
 * 当前演示用户(V1.1 §2.1.2 / §3.1 数据隔离依据)
 *   - 信息科管理员视角下可切换为 admin01 / admin02,模拟"管理员之间隔离"差异
 *   - 科室管理员视角下可切换为不同申请人,模拟"用户隔离"差异
 */
export type DemoAccount = string;
export interface CurrentDemoUser {
  account: DemoAccount;
  name: string;
  role: DemoRole;
}

const DEFAULT_ADMIN_USER: CurrentDemoUser = { account: 'admin01', name: '管理员 admin01', role: 'admin' };
const DEFAULT_USER_USER: CurrentDemoUser = { account: 'user_zzy', name: '张志远', role: 'user' };

// V1.2: 取消 resource-center 内部维护的 demoRole / currentUser 闭包 store。
//   旧实现: setMockDemoRole 写本地状态 + roleListeners notify —— 但 Applies 组件在不同 chunk / HMR
//   下拿到的 store 实例与 DemoFloatButton 写入的实例不一致, 角色切换后页面没响应。
//   新实现: useDemoRole / useCurrentUser 直接订阅 useDemoSettings / useAuth 真相源,
//   角色切换走 DemoFloatButton → useDemoSettings.setDemoRole + useAuth.switchRole 一条链路,
//   4 个 resource-center 页面 (Applies / Approval / ApplyForm / Resources) 自动响应。
//   setDemoRole / setCurrentUser 保留为 noop 兼容旧调用方 (DemoFloatButton 仍 import 但无效),
//   由于 useDemoRole 已订阅 useDemoSettings,无需显式 set。

/** 真实演示角色 → resource-center 内部 DemoRole 枚举的映射 */
const useResolvedDemoRole = (): DemoRole => {
  const { demoRole } = useDemoSettings();
  return demoRole === '信息科管理员' ? 'admin' : 'user';
};

/**
 * V1.2: useDemoRole 不再维护本地闭包, 直接转发 useDemoSettings 的中文枚举
 *   (内部映射为英文 admin/user 给 resource-center 4 个页面消费)。
 */
export const useDemoRole = (): DemoRole => useResolvedDemoRole();

/**
 * V1.2: useCurrentUser 转发 useAuth + useDemoSettings 派生。
 *   - account 走 useAuth.currentUser.id (mockUsers 全局 ID 体系);
 *   - role 走 useDemoSettings;
 *   - name 走 useAuth.currentUser.name。
 *   注: mockApplies 现有 20 条 applicantAccount 仍用老 demo 账号 (admin01 / user_zzy / user_lhm /
 *       user_wjg / user_cx / user_zl / user_st / user_lxy), 与 mockUsers.id (user-000/user-001/...)
 *       命名空间不一致 —— 这是历史数据债, 不在本轮修复范围。当前 owner 派发由调用方按 Tab 显示语义自行处理:
 *       "待审核 / 审核中" Tab 管理员看所有 / 科室仅看自己, 通过 isAdmin + scoped filter 实现。
 */
const idToDemoAccount: Record<string, string> = {
  'user-000': 'admin01',
  'user-001': 'user_zzy',
  'user-002': 'user_lxy',
  'user-003': 'user_wjg',
  'user-004': 'user_cx',
  'user-005': 'user_zl',
  'user-006': 'user_st',
  'user-007': 'user_lhm',
};

export const useCurrentUser = (): CurrentDemoUser => {
  const { currentUser } = useAuth();
  const role = useResolvedDemoRole();
  if (!currentUser) {
    return { account: 'admin01', name: '管理员 admin01', role };
  }
  const account = idToDemoAccount[currentUser.id] || currentUser.id;
  return { account, name: currentUser.name, role };
};

/**
 * V1.2: 以下 setter 保留为 noop 兼容 DemoFloatButton 的 import。
 *   角色切换的真实写入走 useDemoSettings.setDemoRole + useAuth.switchRole。
 *   DemoFloatButton 之前为修复 mock 内部 store 同步而引入的 setMockDemoRole / setMockCurrentUser 调用
 *   现在是冗余的 (因为读侧已订阅真相源), 但保留导出以避免 import 报错。
 */
export const setCurrentUser = (_u: CurrentDemoUser) => {
  // noop — 切角色请走 useAuth.switchRole
};
/** 切换角色时同步重置为该角色的默认账号 (保留兼容, 改为 noop) */
export const resetCurrentUserByRole = (_r: DemoRole) => {
  // noop — 切角色请走 useDemoSettings.setDemoRole + useAuth.switchRole
};

export const setDemoRole = (_r: DemoRole) => {
  // noop — 切角色请走 useDemoSettings.setDemoRole
};

/**
 * 信息科管理员可选账号(用于演示 §2.1.2 / §3.1 草稿"管理员之间隔离"差异)
 * 至少包含 admin01 / admin02 两个不同管理员
 */
export const ADMIN_ACCOUNTS: CurrentDemoUser[] = [
  { account: 'admin01', name: '管理员 admin01', role: 'admin' },
  { account: 'admin02', name: '管理员 admin02', role: 'admin' },
];

/**
 * 科室管理员可选账号(用于演示 §3.1 "用户隔离"差异)
 * 与 mockApplies 中 applicantAccount 字段保持一致
 */
export const USER_ACCOUNTS: CurrentDemoUser[] = [
  { account: 'user_zzy', name: '张志远(心内科)', role: 'user' },
  { account: 'user_lhm', name: '李慧敏(呼吸科)', role: 'user' },
  { account: 'user_wjg', name: '王建国(药剂科)', role: 'user' },
  { account: 'user_cx', name: '陈雪(急诊科)', role: 'user' },
  { account: 'user_zl', name: '赵磊(麻醉科)', role: 'user' },
  { account: 'user_st', name: '孙婷(心内科)', role: 'user' },
  // 双角色演示账号：李秀英同时具备科室管理员 + 信息科管理员身份,
  // 切换演示身份时按 userName='李秀英' 精准命中,避免落到默认 user-016 钱文博
  { account: 'user_lxy', name: '李秀英(心内科)', role: 'user' },
];
