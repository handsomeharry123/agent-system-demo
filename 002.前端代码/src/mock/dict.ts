/**
 * 数据字典 Mock（V1.0 需求说明书）
 * 包含 10 个字典分类（系统内置）的全部默认字典项。
 * 字典项对象约定：见 DictItem 接口。
 */
import { masterMenu } from '../config/masterMenu';

export interface DictItem {
  id: string;
  /** 字典项名称 */
  name: string;
  /** 字典项编码（同一分类内唯一） */
  code: string;
  /** 排序（升序） */
  sort: number;
  /** 是否默认项（同一分类至多一个） */
  isDefault: boolean;
  /** 是否系统保留项：不可删除、不可禁用 */
  isSystemReserved: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 备注 */
  remark?: string;
  /** 最近更新人 */
  updatedBy: string;
  /** 最近更新时间 */
  updatedAt: string;
}

export interface DictCategory {
  id: string;
  /** 字典分类名称 */
  name: string;
  /** 字典编码（全局唯一） */
  code: string;
  /** 分类来源：系统内置 / 自定义 */
  source: '系统内置' | '自定义';
  /** 是否支持新增字典项（false = 字典项不可新增/删除，只能编辑名称/排序/启停） */
  allowAddItem: boolean;
  /** 是否启用分类（禁用后下游下拉置灰） */
  enabled: boolean;
  /** 字典项数量（启用 + 禁用之和） */
  itemCount: number;
  /** 启用的字典项数量 */
  enabledItemCount: number;
  /** 分类说明（可选） */
  description?: string;
  /** 最近更新人 */
  updatedBy: string;
  /** 最近更新时间 */
  updatedAt: string;
  /** 字典项列表 */
  items: DictItem[];
}

/** 系统内置字典分类（10 类）+ 2 个自定义分类示例 */
export const mockDictCategories: DictCategory[] = [
  {
    id: 'cat-dept',
    name: '科室',
    code: 'DEPT',
    source: '系统内置',
    allowAddItem: false,
    enabled: true,
    itemCount: 7,
    enabledItemCount: 7,
    updatedBy: '王明',
    updatedAt: '2026-05-28 10:32',
    items: [
      { id: 'dept-1', name: '影像科', code: 'IMG', sort: 1, isDefault: false, isSystemReserved: true, enabled: true, remark: '承担放射、超声、CT/MRI 等检查', updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
      { id: 'dept-2', name: '检验科', code: 'LAB', sort: 2, isDefault: false, isSystemReserved: true, enabled: true, remark: '生化、临检、免疫、微生物', updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
      { id: 'dept-3', name: '内科', code: 'MED', sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
      { id: 'dept-4', name: '外科', code: 'SUR', sort: 4, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
      { id: 'dept-5', name: '急诊科', code: 'ER',  sort: 5, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
      { id: 'dept-6', name: '门诊办', code: 'OPD', sort: 6, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
      { id: 'dept-7', name: '信息科', code: 'IT',  sort: 7, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-05-28 10:32' },
    ],
  },
  {
    id: 'cat-care-stage',
    name: '诊疗环节',
    code: 'CARE_STAGE',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 9,
    enabledItemCount: 8,
    updatedBy: '王明',
    updatedAt: '2026-06-02 14:18',
    items: [
      { id: 'cs-1', name: '导诊分诊', code: 'TRIAGE',       sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-2', name: '预问诊',   code: 'PRE_CONSULT',  sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-3', name: '预约挂号', code: 'BOOK',         sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-4', name: '辅助检查', code: 'EXAM',         sort: 4, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-5', name: '辅助诊断', code: 'DIAG',         sort: 5, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-6', name: '辅助治疗', code: 'TREAT',        sort: 6, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-7', name: '住院管理', code: 'INPAT',        sort: 7, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-8', name: '其他',     code: 'OTHER',        sort: 8, isDefault: false, isSystemReserved: true, enabled: true, remark: '系统保留：选「其他」需在表单自定义填空', updatedBy: '王明', updatedAt: '2026-06-02 14:18' },
      { id: 'cs-9', name: '随访管理', code: 'FOLLOWUP',     sort: 9, isDefault: false, isSystemReserved: false, enabled: false, remark: '历史自定义项，已停用', updatedBy: '李雪', updatedAt: '2026-05-15 09:10' },
    ],
  },
  {
    id: 'cat-agent-source',
    name: '智能体来源',
    code: 'AGENT_SOURCE',
    source: '系统内置',
    allowAddItem: false,
    enabled: true,
    itemCount: 3,
    enabledItemCount: 3,
    updatedBy: '王明',
    updatedAt: '2026-04-20 16:05',
    items: [
      { id: 'src-1', name: '自研',     code: 'SELF',     sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-04-20 16:05' },
      { id: 'src-2', name: '第三方',   code: 'THIRD',    sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-04-20 16:05' },
      { id: 'src-3', name: '合作研发', code: 'COBUILD',  sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-04-20 16:05' },
    ],
  },
  {
    id: 'cat-agent-type',
    name: '智能体类型',
    code: 'AGENT_TYPE',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 6,
    enabledItemCount: 6,
    updatedBy: '王明',
    updatedAt: '2026-06-05 11:42',
    items: [
      { id: 'at-1', name: '辅助诊断', code: 'DIAG',     sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-05 11:42' },
      { id: 'at-2', name: '影像分析', code: 'IMG',      sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-05 11:42' },
      { id: 'at-3', name: '病历生成', code: 'EMR',      sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-05 11:42' },
      { id: 'at-4', name: '用药审核', code: 'MED_CHECK', sort: 4, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-05 11:42' },
      { id: 'at-5', name: '导诊分诊', code: 'TRIAGE',   sort: 5, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-05 11:42' },
      { id: 'at-6', name: '其他',     code: 'OTHER',    sort: 6, isDefault: false, isSystemReserved: true, enabled: true, remark: '系统保留：选「其他」需在表单自定义填空', updatedBy: '王明', updatedAt: '2026-06-05 11:42' },
    ],
  },
  {
    id: 'cat-api-path',
    name: '接口地址',
    code: 'API_PATH',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 3,
    enabledItemCount: 3,
    updatedBy: '王明',
    updatedAt: '2026-06-01 09:28',
    items: [
      { id: 'ap-1', name: '/chat',    code: '/chat',    sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:28' },
      { id: 'ap-2', name: '/predict', code: '/predict', sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:28' },
      { id: 'ap-3', name: '其他（需要自定义填空）', code: 'OTHER', sort: 99, isDefault: false, isSystemReserved: true, enabled: true, remark: '选「其他」时表单弹出自定义输入框，本次有效', updatedBy: '王明', updatedAt: '2026-06-01 09:28' },
    ],
  },
  {
    id: 'cat-http-method',
    name: '调用方式',
    code: 'HTTP_METHOD',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 5,
    enabledItemCount: 5,
    updatedBy: '王明',
    updatedAt: '2026-06-01 09:30',
    items: [
      { id: 'hm-1', name: 'GET',    code: 'GET',    sort: 1, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:30' },
      { id: 'hm-2', name: 'POST',   code: 'POST',   sort: 2, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:30' },
      { id: 'hm-3', name: 'PUT',    code: 'PUT',    sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:30' },
      { id: 'hm-4', name: 'DELETE', code: 'DELETE', sort: 4, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:30' },
      { id: 'hm-5', name: '其他（需要自定义填空）', code: 'OTHER', sort: 99, isDefault: false, isSystemReserved: true, enabled: true, remark: '选「其他」时表单弹出自定义输入框，本次有效', updatedBy: '王明', updatedAt: '2026-06-01 09:30' },
    ],
  },
  {
    id: 'cat-data-format',
    name: '数据格式',
    code: 'DATA_FORMAT',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 4,
    enabledItemCount: 4,
    updatedBy: '王明',
    updatedAt: '2026-06-01 09:32',
    items: [
      { id: 'df-1', name: 'JSON',      code: 'JSON',      sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:32' },
      { id: 'df-2', name: 'XML',       code: 'XML',       sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:32' },
      { id: 'df-3', name: 'Form-data', code: 'FORM_DATA', sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:32' },
      { id: 'df-4', name: '其他（需要自定义填空）', code: 'OTHER', sort: 99, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:32' },
    ],
  },
  {
    id: 'cat-auth-type',
    name: '认证方式',
    code: 'AUTH_TYPE',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 4,
    enabledItemCount: 4,
    updatedBy: '王明',
    updatedAt: '2026-06-01 09:34',
    items: [
      { id: 'au-1', name: '不需要认证', code: 'NONE',     sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:34' },
      { id: 'au-2', name: 'API Key 认证', code: 'API_KEY', sort: 2, isDefault: false, isSystemReserved: true, enabled: true, remark: '选此项时表单需额外填凭据', updatedBy: '王明', updatedAt: '2026-06-01 09:34' },
      { id: 'au-3', name: 'Token 认证',   code: 'TOKEN',   sort: 3, isDefault: false, isSystemReserved: true, enabled: true, remark: '选此项时表单需额外填凭据', updatedBy: '王明', updatedAt: '2026-06-01 09:34' },
      { id: 'au-4', name: '其他（需要自定义填空）', code: 'OTHER', sort: 99, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:34' },
    ],
  },
  {
    id: 'cat-health-check',
    name: '健康检查地址',
    code: 'HEALTH_CHECK',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 3,
    enabledItemCount: 3,
    updatedBy: '王明',
    updatedAt: '2026-06-01 09:36',
    items: [
      { id: 'hc-1', name: '/health', code: '/health', sort: 1, isDefault: true,  isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:36' },
      { id: 'hc-2', name: '/status', code: '/status', sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:36' },
      { id: 'hc-3', name: '其他（需要自定义填空）', code: 'OTHER', sort: 99, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-01 09:36' },
    ],
  },
  {
    id: 'cat-reject-reason',
    name: '退回原因（快选）',
    code: 'REJECT_REASON',
    source: '系统内置',
    allowAddItem: true,
    enabled: true,
    itemCount: 5,
    enabledItemCount: 5,
    updatedBy: '王明',
    updatedAt: '2026-06-08 15:20',
    items: [
      { id: 'rr-1', name: '技术信息不完整',       code: 'TECH_INCOMP', sort: 1, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-08 15:20' },
      { id: 'rr-2', name: '备案材料缺失',         code: 'FILE_MISS',   sort: 2, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-08 15:20' },
      { id: 'rr-3', name: '风险评级与功能不匹配', code: 'RISK_MISM',   sort: 3, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-08 15:20' },
      { id: 'rr-4', name: '命名不规范',           code: 'NAME_NONSTD', sort: 4, isDefault: false, isSystemReserved: true, enabled: true, updatedBy: '王明', updatedAt: '2026-06-08 15:20' },
      { id: 'rr-5', name: '其他',                 code: 'OTHER',       sort: 5, isDefault: false, isSystemReserved: true, enabled: true, remark: '选「其他」时表单支持自由输入', updatedBy: '王明', updatedAt: '2026-06-08 15:20' },
    ],
  },
];

/** 通过 code 查找分类（字典项管理页用） */
export const findCategoryByCode = (code: string): DictCategory | undefined =>
  mockDictCategories.find((c) => c.code === code);

/** 仅在调试时使用：确认数据字典模块是否已被 masterMenu 识别（侧边栏会渲染） */
export const dictModuleRegistered = masterMenu.some((m) => m.key === 'system-config');
