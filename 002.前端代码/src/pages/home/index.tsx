/**
 * 医小管智能体 · 首页 V1.0（PRD V1 落地版）
 *
 * 改造范围:仅首页内容区。左侧 7 模块菜单由 BasicLayout(ProLayout)负责,保持原样不动。
 *
 * 首页内容区 = 「医小管智能体落地页」,V1.x 起改为三段式布局:
 *   第一层(全局 7 菜单)—— BasicLayout(ProLayout)
 *   第二层(本页内左侧管理栏,280px)—— HomeSidebarV2:工具/品牌/工作台/自动化任务记录/历史会话/账户
 *   第三层(本页内右侧对话区,flex:1)—— 2.1 问候区 / 2.2 推荐问句区 / 2.3 指令输入区
 *
 * 配套:点击推荐问句 / 手动输入 / 语音 / 附件 → 触发对话;
 *     关键词命中 5 大模块 → 给出 mock 回复(指向各模块页);
 *     未命中 → 兜底提示。
 *     第二层「历史会话」点击 → 重置 messages 载入该会话 mock 历史;
 *     第二层「新建任务」点击 → 重置 messages 注入问候语 + 聚焦输入框。
 */
import { type CSSProperties, type DragEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { buildPlatformReport, type ReportNode } from '../ledger/demo/reportData';
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  AuditOutlined,
  ArrowUpOutlined,
  AudioOutlined,
  CloseOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FileTextOutlined,
  LeftOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  message,
  Popover,
  Progress,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import ReactMarkdown from 'react-markdown';
import { skillPromptExamples, type SkillItem, type SkillKey } from '../../mock/skills';
import { useAuth } from '../../hooks/useAuth';
import { useDemoSettings } from '../../hooks/useDemoSettings';
import {
  addApply,
  getApplies,
  mockAgents as resourceCenterAgents,
  mockResources,
  nowAt,
  RESOURCE_CATALOG,
  updateApply,
  type ApplyItem,
} from '../../mock/resource-center';
import {
  ALL_DIMENSIONS,
  mockEvaluationReports,
  mockEvaluationTasks,
  getReportByTaskId,
  persistChatEvaluationTask,
  sampleLevelPercent,
  type EvalDimension,
  type EvaluationConclusion,
  type EvaluationReport,
  type EvaluationTask,
  type SampleLevel,
} from '../../mock/evaluation';
import {
  alertOverviewKpiV18,
  businessKpiV18,
  costKpiV18,
  mockAlertEventsV18,
  mockAlertRulesV18,
  persistChatAlertRule,
  statusKpiV18,
  type AlertRuleV18,
  type AlertEventV18,
} from '../../mock/monitoringV18';
import {
  currentUser as ledgerCurrentUser,
  getAlarmStat,
  getCallVolumeStat,
  getCoverageStat,
  getDepartmentDistribution,
  getDiagnosisPhaseDistribution,
  getInstanceOnlineRateStat,
  getRiskDistribution,
  getSourceDistribution,
  getVisibleAgents,
  ledgerAgents,
  type LedgerAgent,
  type LedgerUser,
} from '../../mock/ledger';
import AgentRobotIcon from '../agent-center/smart/AgentRobotIcon';
import HomeSidebarV2, {
  buildRunHistoryMock,
  initialAutoTasks,
  initialSessions,
  runHistoryMocks,
  sessionHistoryMocks,
  type AutoTask,
  type SessionEntry,
} from './HomeSidebarV2';
import ConnectorList from './ConnectorList';
import SkillList from './SkillList';
import SkillManage from './SkillManage';
import SkillImportModal from './SkillImportModal';
import AutoTaskList from './AutoTaskList';
import ModelSelector from './ModelSelector';
import { useSkillState } from './useSkillState';

const { Text, Title } = Typography;
const { TextArea } = Input;

/* =========================================================
 * 场景标签:点击后将该场景的「说明」作为用户问句发送
 * ========================================================= */
type SceneTag = {
  key: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
};
type BusinessSceneKey =
  | 'register-requirement'
  | 'access-apply'
  | 'access-audit'
  | 'ledger-query'
  | 'resource-register'
  | 'resource-apply'
  | 'resource-audit'
  | 'evaluation-create'
  | 'evaluation-audit'
  | 'monitor-info'
  | 'alert-rule-config';

const sceneTags: SceneTag[] = [
  {
    key: 'register-requirement',
    label: '登记需求',
    icon: <SafetyCertificateOutlined />,
    prompt: '请帮我登记一个智能体建设需求',
  },
  {
    key: 'access-apply',
    label: '接入申请',
    icon: <FileAddOutlined />,
    prompt: '帮我查看待审批的智能体接入申请',
  },
  {
    key: 'access-audit',
    label: '接入审核',
    icon: <AuditOutlined />,
    prompt: '开始接入审核',
  },
  {
    key: 'ledger-query',
    label: '台账查询',
    icon: <DatabaseOutlined />,
    prompt: '按科室统计全院已上线智能体的数量和分类',
  },
  {
    key: 'resource-register',
    label: '资源注册',
    icon: <DatabaseOutlined />,
    prompt: '帮我登记一套新的 HIS 业务系统为可访问资源',
  },
  {
    key: 'resource-apply',
    label: '资源申请',
    icon: <AppstoreOutlined />,
    prompt: '为病历质控智能体申请访问 EMR 电子病历系统的只读权限',
  },
  {
    key: 'resource-audit',
    label: '资源审核',
    icon: <AuditOutlined />,
    prompt: '开始资源使用权限审核',
  },
  {
    key: 'evaluation-create',
    label: '新建评测',
    icon: <ExperimentOutlined />,
    prompt: '请帮我新建一个智能体安全评测任务',
  },
  {
    key: 'evaluation-audit',
    label: '评测审核',
    icon: <AuditOutlined />,
    prompt: '开始评测审核',
  },
  {
    key: 'monitor-info',
    label: '监控信息查看',
    icon: <AlertOutlined />,
    prompt: '帮我看看当前智能体运行监控情况',
  },
  {
    key: 'alert-rule-config',
    label: '告警规则配置',
    icon: <AlertOutlined />,
    prompt: '帮我配置一条智能体告警规则',
  },
];

const businessSceneIntents: Array<{
  key: BusinessSceneKey;
  label: string;
  patterns: RegExp[];
}> = [
  {
    key: 'access-audit',
    label: '接入审核',
    patterns: [/接入.*审核|审核.*接入|待.*审核.*接入|驳回.*接入|通过.*接入|接入.*转交|接入审核/],
  },
  {
    key: 'resource-audit',
    label: '资源审核',
    patterns: [/资源.*审核|审核.*资源|权限.*审核|业务系统.*权限.*审核|待.*审核.*资源|驳回.*(资源|权限)|批准.*(资源|权限)/],
  },
  {
    key: 'evaluation-audit',
    label: '评测审核',
    patterns: [/评测.*审核|审核.*评测|评测报告.*(审核|复核)|待.*审核.*评测|驳回.*评测|评测审核/],
  },
  {
    key: 'alert-rule-config',
    label: '告警规则配置',
    patterns: [/告警规则|报警规则|告警阈值|报警阈值|规则.*(启用|停用|关闭|复制|导出)|通知渠道|调用超时告警|超阈值告警|日调用量(?:突增|达到|超过|大于)|调用量.*(?:1\s*万|10000)|触发记录/],
  },
  {
    key: 'register-requirement',
    label: '登记需求',
    patterns: [/提需求|想提需求|登记.*需求|新增.*需求|创建.*需求|建设需求|智能体.*建设|想建.*智能体|搭建.*智能体|需求.*审批|撤回.*需求|导出.*需求|转交.*需求/],
  },
  {
    key: 'access-apply',
    label: '接入申请',
    patterns: [/接入申请|接入.*智能体|申请.*接入|提交.*接入|纳管申请|做纳管|注册.*智能体|变更接入|接口配置|撤回.*接入|已提交.*接入/],
  },
  {
    key: 'ledger-query',
    label: '台账查询',
    patterns: [/台账|已上线|智能体清单|调用量报表|科室.*分布|接入分布|总调用量|接口调用明细|资源占用报表|已下线|360\s*画像|详细台账/],
  },
  {
    key: 'resource-register',
    label: '资源注册',
    patterns: [/资源注册|注册.*(HIS|LIS|PACS|EMR|RIS|业务系统)|登记.*(HIS|LIS|PACS|EMR|RIS|业务系统)|业务系统.*注册|可访问资源|可共享业务系统|开放接口范围|下线.*业务系统/],
  },
  {
    key: 'resource-apply',
    label: '资源申请',
    patterns: [/资源申请|申请.*访问|访问.*权限|申请.*(HIS|LIS|PACS|EMR|RIS|业务系统)|业务系统访问|只读权限|字段范围|撤回.*访问申请|权限申请/],
  },
  {
    key: 'evaluation-create',
    label: '新建评测',
    patterns: [/新建评测|发起.*评测|做.*评测|安全评测|准入评测|待评测|自定义评测集|评测任务|评测进度|上一次评测|中止.*评测|导出评测报告/],
  },
  {
    key: 'monitor-info',
    label: '监控信息查看',
    patterns: [/监控信息|运行监控|整体运行|异常趋势|当前.*告警|正在触发告警|响应时长|成功率|实时资源占用|异常调用|历史监控|运行日报|token.*成本/],
  },
];

function scoreBusinessScene(text: string, intent: (typeof businessSceneIntents)[number]) {
  return intent.patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function classifyBusinessScene(text: string): BusinessSceneKey | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const ranked = businessSceneIntents
    .map((intent, index) => ({ ...intent, index, score: scoreBusinessScene(normalized, intent) }))
    .filter((intent) => intent.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.key ?? null;
}

function suggestBusinessScene(text: string) {
  const normalized = text.trim();
  const ranked = businessSceneIntents
    .map((intent, index) => ({ ...intent, index, score: scoreBusinessScene(normalized, intent) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (!ranked[0] || ranked[0].score <= 0) {
    return businessSceneIntents.find((intent) => intent.key === 'register-requirement') ?? businessSceneIntents[0];
  }
  return ranked[0] ?? businessSceneIntents[0];
}

type AlertRuleDraftField =
  | 'name'
  | 'object'
  | 'type'
  | 'metric'
  | 'lowOperator'
  | 'lowThreshold'
  | 'mediumOperator'
  | 'mediumThreshold'
  | 'highOperator'
  | 'highThreshold'
  | 'channels'
  | 'creator';

type AlertRuleDraft = Record<AlertRuleDraftField, string>;

const DAILY_CALL_ALERT_RULE_ID = 'rule-v18-daily-call-10000';

function buildDefaultDailyCallAlertRuleDraft(): AlertRuleDraft {
  return {
    name: '全局日调用量达到 1 万告警',
    object: '全局智能体',
    type: '业务监控告警规则',
    metric: '业务调用总量',
    lowOperator: '>=',
    lowThreshold: '5000',
    mediumOperator: '>=',
    mediumThreshold: '10000',
    highOperator: '>=',
    highThreshold: '20000',
    channels: '企业微信',
    creator: 'admin',
  };
}

function buildAlertRuleConditionDescription(draft: AlertRuleDraft) {
  const metric = draft.metric || '业务调用总量';
  const formatLevel = (level: string, operator: string, threshold: string) =>
    `${level}：${metric} ${operator || '>='} ${threshold || '0'} 次`;
  return [
    formatLevel('低危', draft.lowOperator, draft.lowThreshold),
    formatLevel('中危', draft.mediumOperator, draft.mediumThreshold),
    formatLevel('高危', draft.highOperator, draft.highThreshold),
  ].join('；');
}

function upsertDailyCallAlertRule(draft: AlertRuleDraft): AlertRuleV18 {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  const threshold = Number(draft.mediumThreshold || 10000);
  const triggerCondition = {
    metric: draft.metric || '业务调用总量',
    operator: (draft.mediumOperator || '>=') as '>' | '<' | '>=' | '<=' | '=',
    threshold: Number.isFinite(threshold) ? threshold : 10000,
    thresholdUnit: '次',
    sustainDuration: '当日累计',
    description: buildAlertRuleConditionDescription(draft),
  };
  const rule: AlertRuleV18 = {
    id: DAILY_CALL_ALERT_RULE_ID,
    name: draft.name || '全局日调用量达到 1 万告警',
    type: 'business',
    triggerCondition,
    triggerAction: 'notify',
    ruleContentId: 'biz-022',
    ruleConfig: {
      rule_name: draft.name || '全局日调用量达到 1 万告警',
      trigger_time: timestamp,
      trigger_condition: triggerCondition,
      trigger_action: 'notify',
      output_prompt: `全局智能体当日累计调用量达到阈值，当前规则：${triggerCondition.description}；请关注高频调用智能体与资源承载情况。`,
    },
    enabled: true,
    createdBy: draft.creator || 'admin',
    createdAt: timestamp,
    updatedAt: timestamp,
    trigger7d: 0,
  };
  const idx = mockAlertRulesV18.findIndex((item) => item.id === rule.id);
  if (idx >= 0) {
    mockAlertRulesV18[idx] = rule;
  } else {
    mockAlertRulesV18.unshift(rule);
  }
  persistChatAlertRule(rule);
  return rule;
}

function getAlertRuleConfigReply(text: string) {
  const normalized = text.trim();
  if (/新增|新建|创建|配置|设置|加一条|新增一条/.test(normalized) && /日调用量|调用量/.test(normalized) && /1\s*万|10000|一万|达到/.test(normalized)) {
    return {
      reply:
        '已识别业务场景标签/意图：**告警规则配置**。\n\n' +
        '已根据您的描述整理出完整信息清单，请在下方表格中核对或修改字段。',
      alertRuleDraft: buildDefaultDailyCallAlertRuleDraft(),
    };
  }
  if (/确认保存并启用|确认|保存并启用/.test(normalized)) {
    const savedRule = upsertDailyCallAlertRule(buildDefaultDailyCallAlertRuleDraft());
    return {
      reply:
        `创建成功，告警规则 **${savedRule.name}** 已保存并启用。\n\n` +
        '后续当全院智能体当日累计调用量达到 10,000 次时，将按企业微信渠道发送中危告警通知。',
      link: { to: `/app/monitoring/alert-rules/${savedRule.id}`, text: '查看规则详情', newTab: true },
    };
  }
  if (/清单|查看|当前|生效/.test(normalized)) {
    return {
      reply:
        '已识别业务场景标签/意图：**告警规则配置**。\n\n' +
        '当前生效告警规则共 **6 条**：\n\n' +
        '1. 处方前置审核：调用超时 > 5 秒，高危，通知企业微信 + 短信\n' +
        '2. 影像 AI：CPU 使用率 > 85%，中危，通知企业微信\n' +
        '3. 全局规则：日调用量突增 200%，中危，通知企业微信\n\n' +
        '要修改、停用或复制哪一条？',
      quickActions: ['修改第 1 条阈值', '停用第 3 条', '复制第 1 条规则'],
    };
  }
  if (/关闭|停用|禁用/.test(normalized)) {
    return {
      reply:
        '已识别业务场景标签/意图：**告警规则配置**。\n\n' +
        '已为您生成停用确认：\n\n' +
        '- 规则：日调用量突增 200% 全局告警规则\n' +
        '- 操作：停用\n' +
        '- 生效：确认后立即生效\n\n' +
        '请确认是否停用该告警规则。',
      quickActions: ['确认停用', '取消'],
    };
  }
  if (/修改|调整|阈值|通知渠道|企业微信|短信|邮箱/.test(normalized)) {
    return {
      reply:
        '已识别业务场景标签/意图：**告警规则配置**。\n\n' +
        '已整理为规则变更草稿：\n\n' +
        '- 规则对象：心内科智能体\n' +
        '- 触发条件：按您描述调整阈值或通知渠道\n' +
        '- 通知渠道：企业微信 + 短信\n' +
        '确认后我会保存到告警规则配置。',
      quickActions: ['确认保存', '继续修改阈值', '查看当前规则清单'],
    };
  }
  if (/导出|触发记录|规则明细/.test(normalized)) {
    return {
      reply:
        '已识别业务场景标签/意图：**告警规则配置**。\n\n' +
        '已为您准备《本月告警规则触发记录与规则明细》导出任务，包含规则名称、适用对象、触发次数、通知渠道和最近触发时间。',
      quickActions: ['导出 Excel', '导出 PDF', '查看当前规则清单'],
    };
  }
  return {
    reply:
      '已识别业务场景标签/意图：**告警规则配置**。\n\n' +
      '我先整理一条规则草稿：\n\n' +
      '- 规则对象：按您的描述定位到相关智能体 / 全局规则\n' +
      '- 触发条件：调用超时 / 日调用量突增 / 资源占用超阈值\n' +
      '- 三档条件：待配置\n' +
      '- 通知渠道：待确认\n\n' +
      '请补充低危 / 中危 / 高危三档阈值和通知渠道。',
    quickActions: ['阈值 5 秒，高危，企业微信 + 短信', '查看当前生效的所有告警规则清单', '取消配置'],
  };
}

/* =========================================================
 * Mock 回复:根据问句关键词命中 5 大模块
 * ========================================================= */
const moduleReplyMap: { match: RegExp; module: string; reply: string; link?: { to: string; text: string } }[] = [
  {
    match: /审批|接入申请|待审批|接入/,
    module: '智能体接入中心',
    reply:
      '已为您定位到「智能体接入中心 / 注册管理」中 **3 条待审批** 申请：\n\n- 心电图智能辅助诊断系统（10 分钟前提交）\n- 影像分析系统 v2.1 注销申请（1 小时前提交）\n- 病历数据共享至科研平台申请（1.5 小时前提交）\n\n按提交时间倒序排列。',
    link: { to: '/app/agent-center', text: '前往智能体接入中心' },
  },
  {
    match: /建设需求|提报|需求/,
    module: '智能体建设需求管理',
    reply:
      '已为您汇总各科室本月提报的建设需求：\n\n- 心内科：智能心电判读助手（待评估）\n- 影像科：CT 多病种联合分析（已立项）\n- 急诊科：智能预问诊（已匹配 2 个候选）',
    link: { to: '/app/agent-needs', text: '前往需求管理' },
  },
  {
    match: /数量|分类|已上线|科室统计/,
    module: '统一台账中心',
    reply:
      '全院已上线智能体共 **48 个**，按科室分布 TOP3：\n\n- 影像科：12 个\n- 检验科：8 个\n- 心内科：6 个\n\n按功能分类：辅助诊断 18、影像分析 11、病历生成 7、用药审核 6、其他 6。',
    link: { to: '/app/ledger', text: '前往统一台账中心' },
  },
  {
    match: /评测|通过率|平均得分/,
    module: '统一准入评测沙盒',
    reply:
      '本月准入评测汇总：\n\n- 提交评测：**15** 个任务\n- 通过率：**73.3%**（11 通过 / 4 未通过）\n- 平均得分：**86.4** 分\n\n未通过任务 TOP2：智能导诊 v3.0（58 分）、电子病历生成 v2.5（62 分）。',
    link: { to: '/app/evaluation/tasks', text: '前往评测任务管理' },
  },
  {
    match: /失败|调用失败|24 ?小时/,
    module: '统一运行监控中心',
    reply:
      '最近 24h 失败调用 TOP3：\n\n1. 智能导诊系统：**142 次**失败（错误码 502，多为上游 HIS 抖动）\n2. 处方审核系统：**58 次**失败（超时 P99 偏高）\n3. 影像分析平台：**23 次**失败（存储上传失败）\n\n建议先排查智能导诊系统连通性。',
    link: { to: '/app/monitoring/business', text: '前往业务监控' },
  },
  {
    match: /告警|高优先级/,
    module: '统一运行监控中心 / 告警事件',
    reply:
      '当前未处理告警 **17 条**，按严重程度排序：\n\n- P0（紧急）：2 条\n  - 智能导诊系统 连续 5 分钟失败率 > 30%\n  - 处方审核系统 响应超时\n- P1（高）：6 条\n- P2（中）：9 条',
    link: { to: '/app/monitoring/alert-events', text: '前往告警事件处置' },
  },
  {
    match: /报告|运行管理|运行情况/,
    module: '统一台账中心 / 报告',
    reply:
      '已为您生成「**本月智能体运行管理情况报告**」草稿，包含：\n\n- 总体运行概况（调用量 / 成功率 / 在线率）\n- 各科室智能体覆盖度\n- 准入评测结果统计\n- 告警与异常事件汇总\n- 改进建议与下月计划',
    link: { to: '/app/ledger-demo/report', text: '打开报告草稿' },
  },
  {
    match: /本科室|我们科室/,
    module: '本科室视角',
    reply:
      '本科室当前可用智能体：\n\n- 智能导诊系统（日均 256 次调用）\n- 处方审核系统（日均 142 次调用）\n- 病历智能生成系统（日均 89 次调用）\n\n本月调用成功率 **98.6%**，无未处理告警。',
    link: { to: '/app/ledger/list', text: '查看本科室台账' },
  },
  {
    match: /资源|权限|申请/,
    module: '医院资源管理中心',
    reply:
      '您可以前往「医院资源管理中心」进行：\n\n- 资源注册（信息科管理员）\n- 权限申请 / 审批（按需）\n- 资源管理（资源注册与编辑）',
    link: { to: '/app/resource-center/applies', text: '前往资源中心' },
  },
];

const fallbackReply =
  '暂未理解您的诉求，请尝试换种表述或从下方推荐问句中选择。\n\n您也可以告诉我您想触达的目标，例如：\n- **审批/申请** → 智能体接入中心\n- **查询/统计** → 统一台账中心\n- **资源管理** → 医院资源管理中心\n- **准入评测** → 统一准入评测沙盒\n- **告警/报告** → 统一运行监控中心';

const TODAY_LEDGER_OVERVIEW_REPLY =
  '目前已纳管 智能体 30 个，今日调用 73,880 次，正常运行率 84.2%，异常告警 4 次。是否需要为你生成一份智能体管理情况报告？';

const TODAY_LEDGER_REPORT_SUMMARY = {
  totalAgents: 30,
  calls: 73880,
  onlineRate: '84.2%',
  alarms: 4,
};

function isTodayLedgerOverviewQuestion(text: string) {
  return /今天|今日/.test(text) && /台账/.test(text) && /整体|总体|概况|情况|如何/.test(text);
}

async function exportLedgerReportPdf(reportCard: LedgerReportCard) {
  const esc = (s: string | number | undefined) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const palette = ['#1677FF', '#13C2C2', '#52C41A', '#FA8C16', '#722ED1', '#EB2F96', '#FAAD14', '#A0D911'];
  const renderKpis = (kpis: NonNullable<ReportNode['kpis']>) => `
    <div class="kpi-grid" style="grid-template-columns:repeat(${Math.min(kpis.length, 5)},1fr);">
      ${kpis
        .map(
          (k) => `
            <div class="kpi-card">
              <div class="kpi-label">${esc(k.label)}</div>
              <div class="kpi-value" style="color:${esc(k.color || '#1677FF')}">${esc(k.value)}${
                k.unit ? `<span>${esc(k.unit)}</span>` : ''
              }</div>
            </div>`,
        )
        .join('')}
    </div>`;
  const renderChart = (chart: NonNullable<ReportNode['chart']>) => {
    const max = Math.max(...chart.data.map((d) => d.value), 1);
    const total = chart.data.reduce((sum, d) => sum + d.value, 0);
    return `
      <div class="chart-card">
        <div class="card-title">${esc(chart.title)}</div>
        <div class="chart-bars">
          ${chart.data
            .map((d, idx) => {
              const width = Math.max(8, (d.value / max) * 100);
              const extra = chart.chartType === 'pie' && total > 0 ? ` (${((d.value / total) * 100).toFixed(1)}%)` : '';
              return `
                <div class="chart-row">
                  <div class="chart-name">${esc(d.name)}</div>
                  <div class="chart-track"><div class="chart-bar" style="width:${width}%;background:${
                    palette[idx % palette.length]
                  };"></div></div>
                  <div class="chart-value">${esc(d.value)}${extra}</div>
                </div>`;
            })
            .join('')}
        </div>
      </div>`;
  };
  const renderTable = (table: NonNullable<ReportNode['table']>) => `
    <div class="table-card">
      <div class="card-title">${esc(table.title)}</div>
      <table>
        <thead><tr>${table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${table.rows
          .map((r) => `<tr>${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody>
      </table>
    </div>`;
  const renderMatrix = (matrix: NonNullable<ReportNode['matrix']>) => {
    const max = Math.max(...matrix.data.flat(), 1);
    const cellColor = (value: number) => {
      if (value <= 0) return '#FAFAFA';
      const a = Math.max(0.15, Math.min(1, value / max));
      const r = Math.round(255 - (255 - 22) * a);
      const g = Math.round(255 - (255 - 119) * a);
      const b = Math.round(255 - (255 - 255) * a);
      return `rgb(${r},${g},${b})`;
    };
    return `
      <div class="table-card">
        <div class="card-title">${esc(matrix.title)}</div>
        <table class="matrix-table">
          <thead><tr><th>智能体 \\ 系统</th>${matrix.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${matrix.rows
            .map(
              (row, rowIdx) => `
                <tr>
                  <th>${esc(row)}</th>
                  ${matrix.cols
                    .map((_col, colIdx) => {
                      const value = matrix.data[rowIdx]?.[colIdx] ?? 0;
                      return `<td style="background:${cellColor(value)};color:${value / max > 0.55 ? '#fff' : '#262626'}">${esc(value)}</td>`;
                    })
                    .join('')}
                </tr>`,
            )
            .join('')}</tbody>
        </table>
        ${matrix.legend ? `<div class="note">${esc(matrix.legend)}</div>` : ''}
      </div>`;
  };
  const isMonitorReport = /运行监控/.test(reportCard.title);
  const nodes = isMonitorReport ? [] : buildPlatformReport();
  const isHospitalScope = /全院/.test(reportCard.scope);
  const monitorTemplateName = isHospitalScope
    ? '全院智能体运行监控情况报告模板.docx'
    : '科室智能体运行监控情况报告模板.docx';
  const monitorOrg = isHospitalScope ? '××××医院' : '××××医院  ××科';
  const monitorTitle = isHospitalScope ? '全院智能体运行监控情况报告' : '科室智能体运行监控情况报告';
  const monitorCompileUnit = isHospitalScope ? '信息科' : '××科（科室管理员）';
  const monitorScopeText = isHospitalScope ? '全院（含分院区）' : '本科室全部纳管智能体（示例：放射科）';
  const monitorSectionsHtml = `
    <section class="cover">
      <div class="hospital">${esc(monitorTemplateName.replace('.docx', ''))}</div>
      <p>${esc(monitorOrg)}</p>
      <h1>${esc(monitorTitle)}</h1>
      <p>统计周期：2026年1月1日 — 2026年6月30日</p>
      <p>统计范围：${esc(monitorScopeText)}</p>
      <p>编制单位：${esc(monitorCompileUnit)}</p>
      <p>编制日期：2026年7月</p>
      <p class="note">模板说明：本报告由智能体管理平台基于监控平台实时与聚合数据一键生成；文中数据、图表与综述为演示示例。</p>
    </section>
    <section class="toc">
      <h2>目 录</h2>
      <div class="toc-grid">
        <div>一、${isHospitalScope ? '监控总体情况' : '科室监控总体情况'}</div>
        <div>二、业务监控情况</div>
        <div>三、状态监控情况</div>
        <div>四、成本监控情况</div>
        <div>五、安全监控情况</div>
        <div>六、监控告警与处置情况</div>
        <div>七、报告总结</div>
      </div>
      <div class="note">提示：在 Word 中右键点击目录区域，选择“更新域”自动生成/刷新目录。</div>
    </section>
    <h2 class="section-title">一、${isHospitalScope ? '监控总体情况' : '科室监控总体情况'}</h2>
    <h3>（一）总体监控概览</h3>
    ${renderKpis([
      { label: isHospitalScope ? '纳管智能体总数' : '科室纳管智能体', value: isHospitalScope ? '42' : '8', unit: '个', color: '#1677FF' },
      { label: '累计调用次数', value: isHospitalScope ? '126.8' : '28.6', unit: '万', color: '#13C2C2' },
      { label: '任务执行成功率', value: isHospitalScope ? '96.8' : '96.2', unit: '%', color: '#52C41A' },
      { label: '智能体在线率', value: isHospitalScope ? '85.7' : '87.5', unit: '%', color: '#FA8C16' },
      { label: '使用成本', value: isHospitalScope ? '38.6' : '8.2', unit: '万元', color: '#722ED1' },
    ])}
    <p class="para">口径：累计调用次数、任务执行成功率为统计周期累计值；在线率＝实时在线智能体数量÷纳管智能体总数；使用成本为统计周期内算力、许可、运维等各类成本之和。</p>
    <p class="para">${isHospitalScope ? '截至2026年6月30日，全院纳管智能体42个，统计周期内累计调用126.8万次，任务执行成功率96.8%，实时在线率85.7%，使用成本合计38.6万元。业务、状态、成本、安全四个维度监控指标总体处于受控区间，全院智能体运行平稳。' : '截至2026年6月30日，本科室纳管智能体8个，统计周期内累计调用28.6万次，任务执行成功率96.2%，实时在线率87.5%，使用成本合计8.2万元。科室智能体运行总体平稳，1个智能体当前处于异常状态，详见第三部分。'}</p>
    <h3>（二）监控告警维度分布</h3>
    ${renderChart({
      title: isHospitalScope ? '图1-1 四大监控维度告警次数分布（次）' : '图1-1 科室监控告警维度分布（次）',
      chartType: 'pie',
      data: [
        { name: '业务监控', value: isHospitalScope ? 30 : 6 },
        { name: '状态监控', value: isHospitalScope ? 21 : 4 },
        { name: '成本监控', value: isHospitalScope ? 9 : 2 },
        { name: '安全监控', value: isHospitalScope ? 8 : 2 },
      ],
    })}
    <p class="para">${isHospitalScope ? '统计周期内监控平台累计产生告警68次，其中业务监控30次、状态监控21次、成本监控9次、安全监控8次。告警集中于业务与状态两个维度，主要与高峰时段接口及算力资源紧张相关。' : '统计周期内本科室共产生监控告警14次，其中业务监控6次、状态监控4次、成本监控2次、安全监控2次，主要集中于高峰时段响应超时与接口波动。'}</p>

    <h2 class="section-title">二、业务监控情况</h2>
    <h3>（一）任务执行情况</h3>
    ${renderKpis([
      { label: '任务执行成功率', value: isHospitalScope ? '96.8' : '96.2', unit: '%', color: '#52C41A' },
      { label: '任务中断率', value: isHospitalScope ? '2.1' : '2.4', unit: '%', color: '#FA8C16' },
      { label: '自助解决率', value: isHospitalScope ? '83.5' : '81.9', unit: '%', color: '#1677FF' },
    ])}
    <p class="para">图2-1 任务执行成功率与任务中断率月度趋势。统计周期内任务执行质量持续改善，中断任务主要集中于高峰时段接口超时场景。</p>
    <h3>（二）调用情况</h3>
    ${renderKpis([
      { label: '累计调用次数', value: isHospitalScope ? '126.8' : '28.6', unit: '万次', color: '#1677FF' },
      { label: '当日调用次数', value: isHospitalScope ? '1.12' : '2560', unit: isHospitalScope ? '万次' : '次', color: '#13C2C2' },
      { label: isHospitalScope ? 'TOP10智能体调用占比' : 'TOP1智能体调用占比', value: isHospitalScope ? '71' : '43', unit: '%', color: '#722ED1' },
    ])}
    <p class="para">${isHospitalScope ? '图2-2 调用次数月度趋势（万次；平台支持日/周/月粒度切换）。调用量持续攀升，需同步关注高峰时段资源保障。' : '图2-2 科室调用次数月度趋势；图2-3 科室各智能体日均调用次数排行。影像报告解读助手日均调用1120次、居科室首位。'}</p>
    <h3>（三）响应性能</h3>
    ${renderKpis([
      { label: '平均响应时间', value: isHospitalScope ? '1.7' : '1.8', unit: '秒', color: '#1677FF' },
      { label: '响应时间P95', value: isHospitalScope ? '4.0' : '4.1', unit: '秒', color: '#13C2C2' },
      { label: '响应时间P99', value: '6.2', unit: '秒', color: '#FA8C16' },
      { label: '响应超时率', value: isHospitalScope ? '0.9' : '1.1', unit: '%', color: '#F5222D' },
    ])}
    <p class="para">图2-3 响应时间P95/P99与平均值周度趋势。P99与平均值差距较大，提示长尾请求集中于复杂多步任务。</p>
    <h3>（四）任务链路与工具调用质量</h3>
    <p class="para">${isHospitalScope ? '单任务平均推理步数4.6步，平均工具调用时延320毫秒；工具执行成功率97.1%、工具选择准确率94.2%、参数提取准确率92.5%、知识库命中率88.7%。' : '科室智能体单任务平均推理步数4.2步，平均工具调用时延290毫秒；工具执行成功率97.6%、工具选择准确率95.1%、参数提取准确率93.4%、知识库命中率90.2%。'}</p>
    <h3>（五）医生采纳与用户满意度</h3>
    <p class="para">${isHospitalScope ? '医生采纳率76.4%，用户满意度4.6分，二者均连续6个月上升。' : '科室整体医生采纳率76.8%、用户满意度4.5分；剂量监测助手、影像知识问答助手、排班辅助助手低于70%关注线。'}</p>

    <h2 class="section-title">三、状态监控情况</h2>
    <h3>（一）${isHospitalScope ? '实时在线/离线情况' : '实时运行状态'}</h3>
    ${renderKpis([
      { label: isHospitalScope ? '实时在线智能体数量' : '实时在线', value: isHospitalScope ? '36' : '7', unit: '个', color: '#52C41A' },
      { label: '在线率', value: isHospitalScope ? '85.7' : '87.5', unit: '%', color: '#1677FF' },
      { label: isHospitalScope ? '实时离线智能体数量' : '实时离线', value: isHospitalScope ? '2' : '0', unit: '个', color: '#FA8C16' },
      { label: isHospitalScope ? '累计异常智能体' : '当前异常', value: isHospitalScope ? '4' : '1', unit: '个', color: '#F5222D' },
    ])}
    <p class="para">${isHospitalScope ? '截至报告导出时，全院42个纳管智能体中在线36个、离线2个、异常2个、禁用2个。离线智能体平均离线时长1.6小时，均已触发自动告警并通知责任工程师处置。' : '截至报告导出时，科室8个智能体中在线7个、异常1个，无离线、禁用智能体。当前异常智能体为影像质控助手，因PACS接口网关超时导致质控任务响应失败。'}</p>
    ${isHospitalScope ? '<h3>（二）禁用与异常情况</h3><p class="para">统计周期内累计新增异常智能体4个、新增禁用智能体2个，平均异常持续时长38分钟。异常期间相关业务均已切换至人工流程，未对临床工作造成影响。</p><h3>（三）各科室智能体状态分布</h3><p class="para">在线智能体主要分布于放射科、检验科、心内科；异常智能体分布于放射科、药剂科各1个。各科室在线、离线、异常、禁用状态数量占比可在平台按科室下钻查看。</p>' : renderTable({
      title: '（二）智能体状态明细',
      headers: ['智能体名称', '当前状态', '本期异常次数', '处理情况'],
      rows: [
        { key: 'a', cells: ['影像报告解读助手', '在线', '1', '已恢复'] },
        { key: 'b', cells: ['影像质控助手', '异常', '2', '处置中'] },
        { key: 'c', cells: ['危急值提醒助手', '在线', '0', '—'] },
        { key: 'd', cells: ['检查预约助手', '在线', '0', '—'] },
      ],
    })}

    <h2 class="section-title">四、成本监控情况</h2>
    <h3>（一）单位成本情况</h3>
    ${renderKpis([
      { label: '单次会话平均成本', value: isHospitalScope ? '0.31' : '0.29', unit: '元', color: '#1677FF' },
      { label: '单任务平均成本', value: isHospitalScope ? '0.42' : '0.38', unit: '元', color: '#13C2C2' },
      { label: '使用成本合计', value: isHospitalScope ? '38.6' : '8.2', unit: '万元', color: '#FA8C16' },
    ])}
    <h3>（二）算力资源使用情况</h3>
    ${renderTable({
      title: 'CPU/GPU/内存使用情况',
      headers: ['资源类型', '累计使用量', '当日使用量', '累计使用率', '当日使用率'],
      rows: [
        { key: 'cpu', cells: ['CPU', isHospitalScope ? '4.2万核·时' : '0.9万核·时', isHospitalScope ? '286核·时' : '61核·时', isHospitalScope ? '58.6%' : '56.2%', isHospitalScope ? '62.4%' : '60.1%'] },
        { key: 'gpu', cells: ['GPU', isHospitalScope ? '1.8万卡·时' : '0.5万卡·时', isHospitalScope ? '128卡·时' : '36卡·时', isHospitalScope ? '68.2%' : '70.4%', isHospitalScope ? '71.5%' : '74.2%'] },
        { key: 'mem', cells: ['内存', isHospitalScope ? '8.6万GB·时' : '1.9万GB·时', isHospitalScope ? '590GB·时' : '130GB·时', isHospitalScope ? '61.3%' : '58.9%', isHospitalScope ? '66.0%' : '63.5%'] },
      ],
    })}
    <h3>（三）Token使用情况</h3>
    <p class="para">${isHospitalScope ? 'Token累计使用12.5亿，当日Token使用820万，单任务输入Token均值1850、输出Token均值620。建议压缩系统提示词与检索上下文长度。' : '科室Token累计使用2.6亿，当日Token使用18万，影像报告解读助手Token消耗占比52%，为科室Token成本主要来源。'}</p>

    <h2 class="section-title">五、安全监控情况</h2>
    <h3>（一）安全事件总体情况</h3>
    <p class="para">${isHospitalScope ? '统计周期内安全防护体系累计检出/拦截安全事件184次，其中异常/对抗输入检出126次、有害内容拦截38次、敏感数据外发拦截17次、工具越权调用3次，全部事件均已自动阻断并留存审计日志。' : '统计周期内科室智能体累计检出/拦截安全事件32次，其中异常/对抗输入检出22次、有害内容拦截6次、敏感数据外发拦截3次、工具越权调用1次，全部事件均已自动阻断并留存审计日志。'}</p>
    <h3>（二）安全关键指标达标情况</h3>
    ${renderTable({
      title: '安全关键指标达标情况',
      headers: ['安全维度', '监控指标', '本期值', '管理目标', '达标情况'],
      rows: [
        { key: 'p', cells: ['输入安全', 'Prompt注入攻击成功率', isHospitalScope ? '0.02%' : '0.01%', '≤0.1%', '达标'] },
        { key: 'h', cells: ['输出安全', '幻觉检测率', isHospitalScope ? '1.8%' : '1.6%', '≤2.0%', '达标'] },
        { key: 'c', cells: ['输出安全', '输出内容合规率', isHospitalScope ? '99.6%' : '99.7%', '≥99.5%', '达标'] },
        { key: 'd', cells: ['数据安全', 'PHI/PII泄露率', '0', '0', '达标'] },
      ],
    })}

    <h2 class="section-title">六、监控告警与处置情况</h2>
    <h3>（一）告警总体情况</h3>
    ${renderKpis([
      { label: '告警次数', value: isHospitalScope ? '68' : '14', unit: '次', color: '#FA8C16' },
      { label: '故障次数', value: isHospitalScope ? '3' : '1', unit: '次', color: '#F5222D' },
      { label: '故障平均恢复时间', value: isHospitalScope ? '42' : '35', unit: '分钟', color: '#1677FF' },
    ])}
    <h3>（二）${isHospitalScope ? '告警原因分析' : '典型问题及处理方案'}</h3>
    ${renderTable({
      title: isHospitalScope ? '告警原因分析' : '典型问题及处理方案',
      headers: isHospitalScope ? ['监控维度', '告警次数', '占比', '主要成因分析'] : ['序号', '典型问题', '影响范围', '处理方案', '处理进展', '责任方'],
      rows: isHospitalScope ? [
        { key: 'b', cells: ['业务监控', '30', '44.1%', '高峰时段响应超时、任务中断率瞬时越限'] },
        { key: 's', cells: ['状态监控', '21', '30.9%', '接口网关波动导致智能体短时离线、心跳丢失'] },
        { key: 'c', cells: ['成本监控', '9', '13.2%', '调用量与Token消耗突增触发预算阈值'] },
      ] : [
        { key: '1', cells: ['1', '影像质控助手因PACS接口网关超时运行异常', '质控流程', '接口网关扩容、重连机制优化', '处置中', '信息科/供应商'] },
        { key: '2', cells: ['2', '影像报告解读助手高峰期P99响应超时告警', '报告解读', '错峰调度、推理缓存优化', '已完成', '信息科'] },
      ],
    })}

    <h2 class="section-title">七、报告总结</h2>
    <h3>（一）存在的问题</h3>
    <p class="para">${isHospitalScope ? '一是高峰期性能余量不足；二是知识库支撑能力偏弱；三是算力与Token成本增长较快；四是个别安全细项需持续关注。' : '一是头部智能体依赖度高；二是部分智能体采纳率偏低；三是GPU配额余量收窄；四是影像质控助手异常尚未闭环。'}</p>
    <h3>（二）下一步工作建议</h3>
    <p class="para">${isHospitalScope ? '建议实施高峰期资源保障专项、开展知识库补链行动、完善成本配额管理、强化安全纵深防御。' : '建议配合信息科完成接口治理与性能优化，组织低采纳率智能体使用反馈评议，提交GPU配额评估申请，并持续落实高度关注类智能体输出人工复核。'}</p>
    <p class="para" style="text-align:right">${isHospitalScope ? '××××医院信息科' : '××××医院××科（科室管理员）'}<br />2026年7月×日</p>
    <h2 class="section-title">${isHospitalScope ? '附1：监控指标体系及口径说明' : '附：编制说明'}</h2>
    <p class="para">${isHospitalScope ? '全院智能体监控指标体系分为业务、状态、成本、安全四个维度，共70项指标，指标数据由智能体管理平台自动采集与计算。' : '本报告由智能体管理平台按科室范围一键生成，面向科室管理员，数据范围为本科室全部纳管智能体，统计周期与筛选条件见封面。监控指标体系与口径同《全院智能体运行监控情况报告》附1。'}</p>
  `;
  const sectionsHtml = isMonitorReport
    ? monitorSectionsHtml
    : nodes.map((n) => {
      if (n.type === 'cover' && n.cover) {
        const c = n.cover;
        return `
          <section class="cover">
            <div class="hospital">${esc(c.hospital)}</div>
            <h1>${esc(c.reportTitle)}</h1>
            <p>${esc(c.deptName)}</p>
            <p>${esc(c.period)}</p>
            <p>${esc(c.generatedBy)}</p>
            <p>${esc(c.reportDate)}</p>
          </section>`;
      }
      if (n.type === 'toc' && n.toc) {
        return `
          <section class="toc">
            <h2>目 录</h2>
            <div class="toc-grid">${n.toc.items.map((it) => `<div>${esc(it.label)}</div>`).join('')}</div>
            <div class="note">（在 Word 中右键点击此处,选择「更新域」自动生成目录。）</div>
          </section>`;
      }
      if (n.type === 'h2') return `<h2 class="section-title">${esc(n.text)}</h2>`;
      if (n.type === 'h3') return `<h3>${esc(n.text)}</h3>`;
      if (n.type === 'p') return `<p class="para">${esc(n.text)}</p>`;
      if (n.type === 'kpi' && n.kpis) return renderKpis(n.kpis);
      if (n.type === 'chart' && n.chart) return renderChart(n.chart);
      if (n.type === 'table' && n.table) return renderTable(n.table);
      if (n.type === 'matrix' && n.matrix) return renderMatrix(n.matrix);
      if (n.type === 'colophon' && n.colophon) {
        return `
          <section class="colophon">
            <h2>附:编制说明</h2>
            <p>① 本报告由智能体管理平台基于台账聚合数据一键生成,统计口径统一,统计周期与筛选范围(科室/时间)见封面。</p>
            <p>② 各模块图表由系统按实时数据自动生成,本模板内全部数据与图表均为示例;比率类指标在图表处注明分子分母口径。</p>
            <p>③ 各模块文字综述由智能助手自动生成初稿,管理员可在平台编辑页在线调整后发布。</p>
            <div class="signature">${esc(n.colophon.generator)}<br />${esc(n.colophon.reportDate)}</div>
          </section>`;
      }
      return '';
    }).join('');
  const node = document.createElement('div');
  node.style.position = 'fixed';
  node.style.left = '-10000px';
  node.style.top = '0';
  node.style.width = '980px';
  node.style.padding = '0';
  node.style.background = '#FFFFFF';
  node.style.color = '#262626';
  node.style.fontFamily = 'Arial, "Microsoft YaHei", sans-serif';
  node.style.lineHeight = '1.85';
  node.innerHTML = `
    <style>
      .report-doc{padding:38px 48px 44px;background:#fff;color:#262626;}
      .cover{text-align:center;padding:72px 32px 62px;border-bottom:3px double #1677FF;margin-bottom:28px;background:linear-gradient(180deg,#F0F5FF 0%,#fff 100%);}
      .cover .hospital{font-size:14px;color:#8C8C8C;letter-spacing:4px;margin-bottom:24px;}
      .cover h1{margin:0 0 32px;color:#1677FF;font-size:34px;line-height:1.2;}
      .cover p{margin:3px 0;font-size:15px;}
      .toc{border:1px solid #D6E4FF;border-radius:8px;padding:18px 24px;margin-bottom:28px;}
      .toc h2{margin:0 0 12px;color:#1677FF;font-size:22px;}
      .toc-grid{columns:2;column-gap:40px;font-size:14px;}
      .toc-grid div{padding:5px 0;border-bottom:1px dashed #F0F0F0;break-inside:avoid;}
      .section-title{margin:26px 0 12px;border-bottom:2px solid #1677FF;padding-bottom:6px;color:#1677FF;font-size:24px;}
      h3{margin:16px 0 7px;color:#1677FF;font-size:16px;}
      .para{margin:0 0 12px;font-size:14px;line-height:1.85;}
      .kpi-grid{display:grid;gap:12px;margin:0 0 14px;}
      .kpi-card{background:#FAFAFA;border:1px solid #F0F0F0;border-radius:8px;text-align:center;padding:14px 10px;}
      .kpi-label{font-size:12px;color:#8C8C8C;}
      .kpi-value{font-size:25px;font-weight:700;margin-top:4px;line-height:1.25;}
      .kpi-value span{font-size:12px;color:#8C8C8C;font-weight:400;margin-left:4px;}
      .chart-card,.table-card{border:1px solid #F0F0F0;border-radius:8px;padding:12px 16px;margin-bottom:14px;break-inside:avoid;}
      .card-title{font-size:14px;font-weight:600;margin-bottom:9px;padding-bottom:8px;border-bottom:1px solid #F0F0F0;}
      .chart-row{display:grid;grid-template-columns:128px 1fr 92px;gap:10px;align-items:center;margin:7px 0;font-size:12px;}
      .chart-name{color:#595959;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .chart-track{height:13px;background:#F5F5F5;border-radius:999px;overflow:hidden;}
      .chart-bar{height:100%;border-radius:999px;}
      .chart-value{text-align:right;color:#262626;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:#F0F5FF;color:#1677FF;font-weight:600;text-align:left;}
      th,td{border:1px solid #D9D9D9;padding:8px 10px;vertical-align:top;}
      .matrix-table th,.matrix-table td{text-align:center;}
      .matrix-table tbody th{text-align:left;}
      .note{margin-top:8px;color:#8C8C8C;font-size:12px;}
      .colophon{margin-top:32px;padding:20px;background:#F0F5FF;border-left:4px solid #1677FF;border-radius:6px;}
      .colophon h2{margin:0 0 12px;color:#1677FF;font-size:20px;}
      .colophon p{margin:0 0 8px;font-size:13px;}
      .signature{text-align:right;color:#595959;font-size:13px;margin-top:12px;}
      .ending{margin-top:32px;padding-top:16px;border-top:2px solid #1677FF;text-align:right;color:#8C8C8C;font-size:12px;}
    </style>
    <div class="report-doc">
      ${sectionsHtml}
      <div class="ending">— 报告结束 —<br />××××医院信息科 · ${new Date().toISOString().slice(0, 10)}</div>
    </div>
  `;
  document.body.appendChild(node);
  try {
    const canvas = await html2canvas(node.querySelector('.report-doc') as HTMLElement, {
      scale: 1.5,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 10;
    const marginY = 10;
    const imgWidth = pageWidth - marginX * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = marginY;
    const pageContentHeight = pageHeight - marginY * 2;
    const image = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(image, 'JPEG', marginX, position, imgWidth, imgHeight);
    heightLeft -= pageContentHeight;
    while (heightLeft > 0) {
      pdf.addPage();
      position = marginY - (imgHeight - heightLeft);
      pdf.addImage(image, 'JPEG', marginX, position, imgWidth, imgHeight);
      heightLeft -= pageContentHeight;
    }
    pdf.save(`${reportCard.title}_${new Date().toISOString().slice(0, 10)}.pdf`);
    message.success('已导出报告');
  } finally {
    document.body.removeChild(node);
  }
}

const pickReply = (text: string): { module: string; reply: string; link?: { to: string; text: string } } => {
  for (const m of moduleReplyMap) {
    if (m.match.test(text)) return m;
  }
  return { module: '医小管', reply: fallbackReply };
};

type RequirementStep =
  | 'n0'
  | 'confirmDept'
  | 'functionDetails'
  | 'confirmFunction'
  | 'reason'
  | 'confirmReason'
  | 'clinicStage'
  | 'resources'
  | 'urgency'
  | 'contact'
  | 'contactFix'
  | 'summary'
  | 'done';

type RequirementSlots = {
  rawNeed?: string;
  department?: string;
  functionDescription?: string;
  reason?: string;
  clinicStage?: string;
  resources?: string;
  urgency?: string;
  proposer?: string;
  phone?: string;
  sidetrack?: string[];
  returnToSummary?: boolean;
};

type RequirementFlow = {
  sessionId: string;
  step: RequirementStep;
  slots: RequirementSlots;
};

type LedgerFlow = {
  sessionId: string;
  awaitingAgent?: boolean;
  lastAgentId?: string;
  reportScope?: '全院' | '本科室';
  reportPeriod?: '今日' | '本周' | '本月';
};

type LedgerCandidate = {
  code: string;
  name: string;
  version: string;
  to: string;
  prompt: string;
};

type LedgerReportCard = {
  title: string;
  scope: string;
  period: string;
  modules: string[];
  to: string;
};

type MonitorAlertRow = {
  id: string;
  level: '高' | '中' | '低';
  dimension: '业务' | '状态' | '成本' | '安全';
  code: string;
  agentName: string;
  content: string;
  detailTo: string;
};

type MonitorAlertTable = {
  rows: MonitorAlertRow[];
  emptyText?: string;
};

type AccessAuditTable = {
  rows: AccessAuditAgent[];
  emptyText?: string;
};

type AccessAuditConfirmation = {
  rows: AccessAuditAgent[];
  conclusion: '审核通过' | '退回修改';
};

type EvaluationAuditTable = {
  rows: EvaluationTask[];
  emptyText?: string;
};

type AccessStep =
  | 'collectMaterial'
  | 'agentName'
  | 'agentNameRetry'
  | 'department'
  | 'clinicStage'
  | 'confirmFunction'
  | 'connectivityFix'
  | 'materialConfirm'
  | 'editContact'
  | 'editEndpoint'
  | 'summary'
  | 'done';

type AccessSlots = {
  agentName?: string;
  version?: string;
  department?: string;
  departmentCode?: string;
  clinicStage?: string;
  functionDescription?: string;
  source?: string;
  vendor?: string;
  contact?: string;
  phone?: string;
  accessMethod?: string;
  endpoint?: string;
  apiKeyMasked?: string;
  platformUrl?: string;
  platformKey?: string;
  instrumentationCode?: string;
  connectivity?: string;
  materials?: string[];
  techSpecUploaded?: boolean;
  productDocUploaded?: boolean;
  draftSaved?: boolean;
};

type AccessMode = 'API' | 'SDK' | 'OTel';

type AccessFormField = {
  key: keyof AccessSlots;
  label: string;
  multiline?: boolean;
  placeholder: string;
};

type AccessFlow = {
  sessionId: string;
  step: AccessStep;
  slots: AccessSlots;
};

type ResourceApplyStep = 'n1' | 'n2' | 'n3' | 'done';

type ResourceOption = {
  code: string;
  name: string;
  type: '业务系统数据资源' | '模型资源';
  resourceId: string;
  status: 'registered' | 'unregistered';
};

type ResourceApplySlots = {
  agent?: (typeof resourceCenterAgents)[number];
  resources?: ResourceOption[];
  pendingResources?: ResourceOption[];
  receiptNo?: string;
  sidetrack?: string[];
  draftSaved?: boolean;
};

type ResourceApplyFlow = {
  sessionId: string;
  step: ResourceApplyStep;
  slots: ResourceApplySlots;
};

type ResourceRegisterStep = 'n0' | 'n1' | 'n2' | 'n3' | 'n4' | 'n5' | 'done';

type ResourceRegisterDraft = {
  kind: '业务系统数据资源' | '模型资源';
  code: string;
  name: string;
  owner?: string;
  contact?: string;
  protocol?: 'HL7' | 'FHIR' | 'DICOM' | '数据库直连' | 'MQ';
  protocolConfig?: Record<string, string>;
  modelVersion?: string;
  deployMode?: '本地化部署' | '云端部署' | '混合部署';
  apiUrl?: string;
  apiKeyMasked?: string;
  testStatus?: '待测试' | '失败' | '通过';
  testMessage?: string;
};

type ResourceRegisterSlots = {
  materials?: string[];
  drafts?: ResourceRegisterDraft[];
  pendingDrafts?: ResourceRegisterDraft[];
  awaitingFix?: 'pacs-ip' | 'api-key';
  receiptNo?: string;
  draftSaved?: boolean;
  sidetrack?: string[];
  matchMissCount?: number;
  returnToSummary?: boolean;
};

type ResourceRegisterFlow = {
  sessionId: string;
  step: ResourceRegisterStep;
  slots: ResourceRegisterSlots;
};

type ResourceAuditStep = 'n1' | 'n2' | 'n3' | 'done';

type ResourceAuditRecord = {
  applyId: string;
  agentId: string;
  agentName: string;
  resourceName: string;
  conclusion: '审核通过' | '退回修改';
  comment: string;
  reviewer: string;
  time: string;
};

type ResourceAuditFlow = {
  sessionId: string;
  step: ResourceAuditStep;
  queueIds: string[];
  reviewedIds: string[];
  records: ResourceAuditRecord[];
  selectedApplyId?: string;
  conclusion?: '审核通过' | '退回修改';
  comment?: string;
  paused?: boolean;
};

type EvaluationStep = 'confirmUltrasoundAgent' | 'sampleLevel' | 'n1' | 'n2' | 'running' | 'done';

type EvaluationPendingAgent = {
  id: string;
  agentId: string;
  code: string;
  name: string;
  version: string;
  department: string;
  riskLevel: '低风险' | '中等风险' | '高风险';
};

type EvaluationSlots = {
  agent?: EvaluationPendingAgent;
  agents?: EvaluationPendingAgent[];
  levels?: Record<EvalDimension, SampleLevel>;
  taskId?: string;
  taskNo?: string;
  taskIds?: string[];
  taskNos?: string[];
  totalProgress?: number;
  totalScore?: number;
  dimensionScores?: Record<EvalDimension, number>;
  sidetrack?: string[];
  draftSaved?: boolean;
};

type EvaluationProgressSummary = {
  percent: number;
  estimatedRemainingHours: number;
};

type EvaluationFlow = {
  sessionId: string;
  step: EvaluationStep;
  slots: EvaluationSlots;
};

type EvaluationAuditStep = 'n1' | 'n2' | 'n3' | 'done';

type EvaluationAuditRecord = {
  taskId: string;
  agentCode: string;
  agentName: string;
  systemConclusion: '准入' | '退回';
  reviewConclusion: '审核通过' | '退回修改';
  finalResult: '准入' | '退回' | '退回修改';
  comment: string;
  reviewer: string;
  time: string;
};

type EvaluationAuditFlow = {
  sessionId: string;
  step: EvaluationAuditStep;
  queueIds: string[];
  reviewedIds: string[];
  records: EvaluationAuditRecord[];
  selectedTaskId?: string;
  reviewConclusion?: '审核通过' | '退回修改';
  comment?: string;
  paused?: boolean;
};

type MonitorFlow = {
  sessionId: string;
  lastIntent?: 'overview_metric' | 'alert' | 'report' | 'out_of_scope' | 'offtopic' | 'clarify';
  reportPeriod?: '日报' | '周报' | '月报' | '年报';
  reportScope?: string;
  lastAlerts?: AlertEventV18[];
  pendingTodos?: string[];
};

type AccessAuditStep = 'n1' | 'n2' | 'n3' | 'done';

type AccessAuditAgent = {
  code: string;
  name: string;
  version: string;
  department: string;
  clinicStage: string;
  description: string;
  source: string;
  vendor: string;
  contact: string;
  phone: string;
  accessMethod: 'API' | 'SDK' | 'OTel';
  endpoint: string;
  apiKeyMasked: string;
  applicant: string;
  precheck: '建议通过' | '建议退回修改';
  precheckSummary: string;
  checks: { label: string; ok: boolean; desc: string }[];
};

type AccessAuditDecision = {
  code: string;
  result: '审核通过' | '退回修改';
  reason?: string;
  overridePrecheck?: boolean;
  time: string;
};

type AccessAuditPendingDecision = {
  codes: string[];
  result: '审核通过' | '退回修改';
  reason?: string;
  reasons?: Record<string, string>;
  overridePrecheck?: boolean;
  batch?: boolean;
};

type AccessAuditFlow = {
  sessionId: string;
  step: AccessAuditStep;
  agents: AccessAuditAgent[];
  decisions: AccessAuditDecision[];
  selectedCode?: string;
  viewedCodes: string[];
  pendingDecision?: AccessAuditPendingDecision;
  pendingTodos?: string[];
};

type HomeDashboardMetric = {
  key: 'managedAgents' | 'totalCalls' | 'alerts';
  label: string;
  value: string;
  trend: Array<{ month: string; value: number }>;
  accent: string;
  fill: string;
};

const ledgerRecommendedQuestions = [
  '帮我生成一份今日的全院/本科室智能体管理情况报告',
  '我想要查看【某智能体】的 360 画像',
  '目前智能体的告警情况',
];

const monitorRecommendedQuestions = [
  '今日整体运行情况如何？',
  '现在有哪些告警需要处理？',
  '帮我生成一份今日的全院/本科室智能体运行监控情况报告？',
];

/* =========================================================
 * 主页组件
 * ========================================================= */
const HomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { demoRole } = useDemoSettings();

  const role: '信息科管理员' | '科室管理员' = demoRole === '信息科管理员' ? '信息科管理员' : '科室管理员';
  const isItAdmin = role === '信息科管理员';

  // 消息列表
  type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    module?: string;
    link?: { to: string; text: string; newTab?: boolean };
    actionLinks?: Array<{ to: string; text: string; download?: boolean }>;
    quickActions?: string[];
    candidates?: LedgerCandidate[];
    reportCard?: LedgerReportCard;
    monitorAlertTable?: MonitorAlertTable;
    accessAuditTable?: AccessAuditTable;
    accessAuditConfirmation?: AccessAuditConfirmation;
    evaluationAuditTable?: EvaluationAuditTable;
    alertRuleDraft?: AlertRuleDraft;
    dashboardMetrics?: HomeDashboardMetric[];
    requirementSummary?: RequirementSlots;
    accessSummary?: AccessSlots;
    evaluationProgress?: EvaluationProgressSummary;
    time: string;
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedSkillTags, setSelectedSkillTags] = useState<string[]>([]);
  const [model, setModel] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [extraSessions, setExtraSessions] = useState<SessionEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newReplySessionIds, setNewReplySessionIds] = useState<Set<string>>(() => new Set());
  const [sessionConversations, setSessionConversations] = useState<Record<string, ChatMessage[]>>({});
  const [requirementFlow, setRequirementFlow] = useState<RequirementFlow | null>(null);
  const [ledgerFlow, setLedgerFlow] = useState<LedgerFlow | null>(null);
  const [accessFlow, setAccessFlow] = useState<AccessFlow | null>(null);
  const [resourceRegisterFlow, setResourceRegisterFlow] = useState<ResourceRegisterFlow | null>(null);
  const [resourceApplyFlow, setResourceApplyFlow] = useState<ResourceApplyFlow | null>(null);
  const [resourceAuditFlow, setResourceAuditFlow] = useState<ResourceAuditFlow | null>(null);
  const [evaluationFlow, setEvaluationFlow] = useState<EvaluationFlow | null>(null);
  const [evaluationAuditFlow, setEvaluationAuditFlow] = useState<EvaluationAuditFlow | null>(null);
  const [monitorFlow, setMonitorFlow] = useState<MonitorFlow | null>(null);
  const [accessAuditFlow, setAccessAuditFlow] = useState<AccessAuditFlow | null>(null);
  /** 是否处于「新建任务」视图;切换到历史会话 / 自动化执行记录后置 false,场景标签随之隐藏 */
  const [isNewTaskView, setIsNewTaskView] = useState(true);

  /* 底栏「+」下拉:连接器 Drawer */
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillImportOpen, setSkillImportOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const { skills: skillOptions } = useSkillState();
  const [connectorMap, setConnectorMap] = useState<Record<string, boolean>>({
    wechat: false,
    feishu: false,
    email: false,
    sms: false,
  });
  /* 首页中间内容区 slot:'overview' 显示医小管对话;'connector' 显示连接器列表;'skill' 显示技能列表;'skill-manage' 显示技能管理;'auto-tasks' 显示自动化任务列表 */
  const requestedMiddleView = (
    location.state as {
      middleView?: 'overview' | 'connector' | 'skill' | 'skill-manage' | 'auto-tasks';
    } | null
  )?.middleView;
  const routeMiddleView: 'connector' | 'skill' | 'skill-manage' | 'auto-tasks' | undefined =
    location.pathname.endsWith('/connector')
      ? 'connector'
      : location.pathname.endsWith('/skill/manage')
        ? 'skill-manage'
        : location.pathname.endsWith('/skill')
          ? 'skill'
      : location.pathname.endsWith('/auto-tasks')
        ? 'auto-tasks'
        : undefined;
  const [middleView, setMiddleView] = useState<'overview' | 'connector' | 'skill' | 'skill-manage' | 'auto-tasks'>(
    requestedMiddleView ?? routeMiddleView ?? 'overview',
  );
  useEffect(() => {
    if (routeMiddleView) {
      setMiddleView(routeMiddleView);
    } else if (location.pathname.endsWith('/overview')) {
      setMiddleView(requestedMiddleView ?? 'overview');
    }
  }, [location.pathname, requestedMiddleView, routeMiddleView]);
  const [autoTasks, setAutoTasks] = useState<AutoTask[]>(() =>
    initialAutoTasks.map((task) => ({
      ...task,
      runs: task.runs.map((run) => ({ ...run })),
    })),
  );
  const messageListRef = useRef<HTMLDivElement>(null);
  const sceneTagScrollRef = useRef<HTMLDivElement>(null);
  const prevLoadingRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isInputDragOver, setIsInputDragOver] = useState(false);
  const [sceneTagScrollState, setSceneTagScrollState] = useState({ left: false, right: false });

  const visibleSceneTags = sceneTags.filter(
    (t) =>
      !['register-requirement', 'access-apply', 'resource-register', 'resource-apply', 'resource-audit'].includes(t.key)
      && (!['evaluation-create', 'evaluation-audit', 'access-audit'].includes(t.key) || isItAdmin),
  );

  const updateSceneTagScrollState = useCallback(() => {
    const el = sceneTagScrollRef.current;
    if (!el) {
      setSceneTagScrollState({ left: false, right: false });
      return;
    }
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextState = {
      left: el.scrollLeft > 1,
      right: el.scrollLeft < maxScrollLeft - 1,
    };
    setSceneTagScrollState((prev) =>
      prev.left === nextState.left && prev.right === nextState.right ? prev : nextState,
    );
  }, []);

  const scrollSceneTags = (direction: 'left' | 'right') => {
    const el = sceneTagScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === 'right' ? el.clientWidth * 0.65 : -el.clientWidth * 0.65,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    if (!skillPickerOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('[data-testid="home-skill-picker"]') ||
        target.closest('[data-testid="home-v1-toolbar-add"]')
      ) {
        return;
      }
      setSkillPickerOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [skillPickerOpen]);

  useEffect(() => {
    if (!isNewTaskView) {
      setSceneTagScrollState({ left: false, right: false });
      return undefined;
    }

    updateSceneTagScrollState();
    const el = sceneTagScrollRef.current;
    if (!el) return undefined;

    const handleResize = () => updateSceneTagScrollState();
    window.addEventListener('resize', handleResize);

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => updateSceneTagScrollState());
    resizeObserver?.observe(el);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [isNewTaskView, isItAdmin, updateSceneTagScrollState]);

  // 角色变化/首次进入 → 注入问候语
  useEffect(() => {
    setMessages([
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: buildGreeting(role, currentUser?.name),
        dashboardMetrics: buildHomeDashboardMetrics(role),
        time: nowStr(),
      },
    ]);
    setActiveSessionId(null);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setIsNewTaskView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!activeSessionId) return;
    setSessionConversations((prev) => ({ ...prev, [activeSessionId]: messages }));
  }, [activeSessionId, messages]);

  /* 连接器详情「去试试」→ 在这里把提示词注入输入框,写完即清 state */
  const activeConnector = (location.state as { activeConnector?: string } | null)?.activeConnector;
  useEffect(() => {
    if (!activeConnector) return;
    const labels: Record<string, string> = {
      wechat: '微信',
      wecom: '企业微信',
      qq: 'QQ',
      feishu: '飞书',
      dingtalk: '钉钉',
      qqmail: 'QQ 邮箱',
      corpemail: '企业邮箱',
      smsgw: '短信网关',
    };
    const label = labels[activeConnector] ?? activeConnector;
    setDraft(`用${label}给我发一条示例消息`);
    // 清掉 state 避免下一次渲染重复注入
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnector]);

  const trySkillKey = (location.state as { trySkillKey?: SkillKey } | null)?.trySkillKey;
  useEffect(() => {
    if (!trySkillKey) return;
    const skill = skillOptions.find((item) => item.key === trySkillKey);
    if (skill) applySkillPrompt(skill);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trySkillKey, skillOptions]);

  const handleUploadFiles = useCallback(
    (files: FileList | null) => {
      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) return;

      if (accessFlow && accessFlow.sessionId === activeSessionId && accessFlow.step !== 'done') {
        const fileNames = selectedFiles.map((file) => file.name).join('、');
        const uploadText = `已上传${fileNames}`;
        const next = getAccessNext(accessFlow, uploadText);
        const timestamp = Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: `access-upload-u-${timestamp}`,
            role: 'user' as const,
            content: uploadText,
            time: nowStr(),
          },
          ...next.replies.map((content, index) => ({
            id: `access-upload-a-${timestamp}-${index}`,
            role: 'assistant' as const,
            content,
            module: '接入申请',
            link: index === next.replies.length - 1 ? next.link : undefined,
            actionLinks: index === next.replies.length - 1 ? next.actionLinks : undefined,
            accessSummary: shouldRenderAccessForm(next.flow, index, next.replies.length)
              ? next.flow.slots
              : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setAccessFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) =>
            s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s,
          ),
        );
      } else {
        message.info('请先进入需要上传材料的业务场景', 2);
      }
    },
    [accessFlow, activeSessionId],
  );

  const canUploadFiles =
    Boolean(accessFlow && accessFlow.sessionId === activeSessionId && accessFlow.step !== 'done');

  const hasDraggedFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types ?? []).includes('Files') || event.dataTransfer.files.length > 0;

  const handleInputDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = canUploadFiles ? 'copy' : 'none';
    if (canUploadFiles) setIsInputDragOver(true);
  };

  const handleInputDragLeave = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsInputDragOver(false);
    }
  };

  const handleInputDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsInputDragOver(false);
    handleUploadFiles(event.dataTransfer.files);
  };

  /* 自动化任务「新建」页提交成功 → 在这里把「任务创建成功」气泡推入对话区 */
  const autoTaskCreated = (location.state as { autoTaskCreated?: { id: string; name: string; firstRunName: string } } | null)?.autoTaskCreated;
  useEffect(() => {
    if (!autoTaskCreated) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content:
          `已为您创建自动化任务 **${autoTaskCreated.name}**,并生成首次执行子任务 **${autoTaskCreated.firstRunName}**。\n\n` +
          `任务详情可在左侧「自动化任务记录」展开查看;执行结果将按设定频率自动推送。`,
        module: '自动化任务',
        link: { to: '/app/home/overview', text: '查看执行记录' },
        time: nowStr(),
      },
    ]);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTaskCreated?.id]);

  /* ---------- 事件:第二层 HomeSidebarV2 回调 ---------- */
  /*
   * 工作台入口是“选择视图”而不是开关。
   * 这里若使用 prev 取反，Sidebar 已经把入口保持为 active，但中间区会在重复点击时
   * 被切回 overview，造成“左侧已选中、右侧还是旧内容”的双状态不同步。
   */
  const handleOpenConnector = useCallback(() => {
    setMiddleView('connector');
    setActiveSessionId(null);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
  }, []);

  /* 与连接器一致，重复点击仍保持技能列表。 */
  const handleOpenSkill = useCallback(() => {
    setMiddleView('skill');
    setActiveSessionId(null);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
  }, []);

  /* 与连接器一致，重复点击仍保持自动化任务列表。 */
  const handleOpenAutoTasks = useCallback(() => {
    setMiddleView('auto-tasks');
    setActiveSessionId(null);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
  }, []);

  const handleBackToChat = useCallback(() => {
    setMiddleView('overview');
  }, []);

  const handleNewTask = useCallback(() => {
    /* 任何视图下点「新建任务」→ 先切回医小管对话区,再注入问候语 + 聚焦输入框 */
    setMiddleView('overview');
    setActiveSessionId(null);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: buildGreeting(role, currentUser?.name),
        dashboardMetrics: buildHomeDashboardMetrics(role),
        time: nowStr(),
      },
    ]);
    setDraft('');
    setSelectedSkillTags([]);
    setIsNewTaskView(true);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, [role, currentUser?.name]);

  const focusHomeInput = () => {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-testid="home-v1-input"]');
      el?.focus();
    }, 40);
  };

  const applySkillPrompt = useCallback((skill: Pick<SkillItem, 'key' | 'name'>) => {
    setMiddleView('overview');
    setSelectedSkillTags([skill.name]);
    setDraft(skillPromptExamples[skill.key] ?? '');
    setSkillPickerOpen(false);
    setSkillSearch('');
    focusHomeInput();
  }, []);

  const appendSkillTag = (skill: Pick<SkillItem, 'key' | 'name'>) => {
    applySkillPrompt(skill);
  };

  const removeSkillTag = (skillName: string) => {
    setSelectedSkillTags((prev) => prev.filter((name) => name !== skillName));
    focusHomeInput();
  };

  const recommendedSkillNames = ['PPT 制作', '报告撰写', '数据分析', '去 AI 味工具'];
  const recommendedSkills = recommendedSkillNames
    .map((name) => skillOptions.find((skill) => skill.name === name))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const searchedSkills = skillSearch.trim()
    ? skillOptions
        .filter((skill) => {
          const keyword = skillSearch.trim().toLowerCase();
          return skill.name.toLowerCase().includes(keyword) || skill.description.toLowerCase().includes(keyword);
        })
        .slice(0, 6)
    : [];

  const renderSkillOption = (skill: (typeof skillOptions)[number], testIdPrefix: string) => (
    <button
      key={skill.key}
      type="button"
      data-testid={`${testIdPrefix}-${skill.key}`}
      onClick={() => appendSkillTag(skill)}
      style={{
        width: '100%',
        border: 0,
        background: 'transparent',
        padding: '8px 10px',
        borderRadius: 8,
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr)',
        columnGap: 10,
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = '#F7F8FA';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: `${skill.iconColor}1F`,
          color: skill.iconColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        {skill.iconText}
      </span>
      <span style={{ minWidth: 0 }}>
        <Text strong ellipsis style={{ display: 'block', color: '#1F2329', fontSize: 14, lineHeight: '20px' }}>
          {skill.name}
        </Text>
        <Text
          type="secondary"
          ellipsis
          style={{ display: 'block', marginTop: 2, fontSize: 12, lineHeight: '18px' }}
        >
          {skill.description}
        </Text>
      </span>
    </button>
  );

  const skillPickerContent = (
    <div data-testid="home-skill-picker" style={{ width: 360 }}>
      <Input
        allowClear
        autoFocus
        prefix={<SearchOutlined style={{ color: '#8A8F98' }} />}
        placeholder="搜索技能"
        value={skillSearch}
        onChange={(event) => setSkillSearch(event.target.value)}
        data-testid="home-skill-search"
        style={{ height: 38, borderRadius: 10, marginBottom: 10 }}
      />

      {skillSearch.trim() ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
          {searchedSkills.length > 0 ? (
            searchedSkills.map((skill) => renderSkillOption(skill, 'home-skill-search-result'))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配技能" style={{ margin: '12px 0' }} />
          )}
        </div>
      ) : (
        <>
          <Text type="secondary" style={{ display: 'block', margin: '0 2px 6px', fontSize: 12 }}>
            常用技能推荐
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
            {recommendedSkills.map((skill) => renderSkillOption(skill, 'home-skill-recommend'))}
          </div>
        </>
      )}

      <div style={{ height: 1, background: '#F0F0F0', margin: '4px 0 8px' }} />
      <Button
        type="text"
        block
        icon={<PlusOutlined />}
        data-testid="home-skill-add"
        onClick={() => {
          setSkillPickerOpen(false);
          setSkillImportOpen(true);
        }}
        style={{ height: 38, justifyContent: 'flex-start', borderRadius: 8, fontWeight: 600 }}
      >
        添加技能
      </Button>
      <Button
        type="text"
        block
        icon={<ToolOutlined />}
        data-testid="home-skill-manage"
        onClick={() => {
          setSkillPickerOpen(false);
          setSkillSearch('');
          handleOpenSkill();
          navigate('/app/home/skill');
        }}
        style={{ height: 38, justifyContent: 'flex-start', borderRadius: 8, fontWeight: 600 }}
      >
        管理技能
      </Button>
    </div>
  );

  const handleRestoreSession = useCallback((id: string) => {
    setNewReplySessionIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    let hist = sessionConversations[id] ?? sessionHistoryMocks[id];
    if (!hist) {
      const session = extraSessions.find((item) => item.id === id);
      if (session) {
        hist = [
          {
            id: `${id}-u1`,
            role: 'user',
            content: session.title,
            time: session.updatedAt,
          },
          {
            id: `${id}-a1`,
            role: 'assistant',
            content: `已恢复「${session.title}」的模拟对话记录。您可以继续在当前窗口追问或补充信息。`,
            module: '医小管',
            time: session.updatedAt,
          },
        ];
        setSessionConversations((prev) => ({ ...prev, [id]: hist }));
      }
    }
    if (!hist) {
      message.info('该会话暂无历史记录');
      return;
    }
    setMiddleView('overview');
    setMessages(hist);
    setDraft('');
    setActiveSessionId(id);
    if (id.startsWith('req-')) {
      setRequirementFlow((prev) => (prev?.sessionId === id ? prev : null));
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('ledger-')) {
      setLedgerFlow({ sessionId: id });
      setRequirementFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('access-audit-')) {
      setAccessAuditFlow((prev) => (prev?.sessionId === id ? prev : createAccessAuditFlow(id)));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
    } else if (id.startsWith('access-')) {
      setAccessFlow((prev) => (prev?.sessionId === id ? prev : { sessionId: id, step: 'collectMaterial', slots: {} }));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('resource-audit-')) {
      setResourceAuditFlow((prev) => (prev?.sessionId === id ? prev : createResourceAuditFlow(id)));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('resource-register-')) {
      setResourceRegisterFlow((prev) => (prev?.sessionId === id ? prev : { sessionId: id, step: 'n1', slots: {} }));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('resource-')) {
      setResourceApplyFlow((prev) => (prev?.sessionId === id ? prev : { sessionId: id, step: 'n1', slots: {} }));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('evaluation-audit-')) {
      setEvaluationAuditFlow((prev) => (prev?.sessionId === id ? prev : createEvaluationAuditFlow(id)));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('evaluation-')) {
      setEvaluationFlow((prev) => (prev?.sessionId === id ? prev : { sessionId: id, step: 'n1', slots: {} }));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    } else if (id.startsWith('monitor-')) {
      setMonitorFlow((prev) => (prev?.sessionId === id ? prev : { sessionId: id }));
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setAccessAuditFlow(null);
    } else {
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    }
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, [extraSessions, sessionConversations]);

  useEffect(() => {
    if (prevLoadingRef.current && !loading && activeSessionId) {
      setNewReplySessionIds((prev) => {
        const next = new Set(prev);
        next.add(activeSessionId);
        return next;
      });
    }
    prevLoadingRef.current = loading;
  }, [activeSessionId, loading]);

  const handleRestoreRun = useCallback((id: string) => {
    let hist = runHistoryMocks[id];
    if (!hist) {
      const matched = autoTasks
        .flatMap((task) => task.runs.map((run) => ({ task, run })))
        .find((item) => item.run.id === id);
      if (matched) {
        hist = buildRunHistoryMock(matched.task, matched.run);
        runHistoryMocks[id] = hist;
      }
    }
    if (!hist) {
      message.info('该执行记录暂无对话数据');
      return;
    }
    setMiddleView('overview');
    setMessages(hist);
    setDraft('');
    setActiveSessionId(null);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setIsNewTaskView(false);
  }, [autoTasks]);

  const startRequirementRegistration = useCallback(() => {
    const sessionId = `req-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '智能体建设需求登记',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `req-a-${Date.now()}`,
      role: 'assistant',
      content: buildRequirementOpening(),
      module: '需求登记',
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow({ sessionId, step: 'n0', slots: {} });
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  const startLedgerQuery = useCallback(() => {
    const sessionId = `ledger-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '台账查询',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `ledger-a-${Date.now()}`,
      role: 'assistant',
      content: buildLedgerOpening(),
      module: '台账查询',
      quickActions: ledgerRecommendedQuestions,
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow({ sessionId });
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  const startAccessApplication = useCallback(() => {
    const sessionId = `access-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '接入申请',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `access-a-${Date.now()}`,
      role: 'assistant',
      content: buildAccessOpening(),
      module: '接入申请',
      quickActions: ACCESS_UPLOAD_QUICK_ACTIONS,
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow({ sessionId, step: 'collectMaterial', slots: {} });
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  /* 「资源注册」场景标签 → 创建历史会话并进入 N0→N6 固定任务轨道 */
  const startResourceRegister = useCallback(() => {
    const sessionId = `resource-register-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '资源注册',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `resource-register-a-${Date.now()}`,
      role: 'assistant',
      content: buildResourceRegisterOpening(),
      module: '资源注册',
      quickActions: [
        '上传资源清单.xlsx：放射 PACS 走 DICOM，再加 Qwen 大模型，云端部署',
        '注册 PACS',
        '注册 Qwen 模型',
      ],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow({ sessionId, step: 'n1', slots: {} });
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  /* 「资源申请」场景标签 → 创建历史会话并进入 N0→N4 固定任务轨道 */
  const startResourceApplication = useCallback(() => {
    const sessionId = `resource-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '资源申请',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `resource-a-${Date.now()}`,
      role: 'assistant',
      content: buildResourceOpening(),
      module: '资源申请',
      quickActions: [
        '糖尿病随访管理助手',
        '智能导诊助手 v2.3',
        '心血管随访助手 v1.2',
      ],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow({ sessionId, step: 'n1', slots: {} });
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  /* 「资源审核」场景标签 → 创建历史会话并进入 N0→N5 固定审核轨道 */
  const startResourceAudit = useCallback(() => {
    const sessionId = `resource-audit-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '资源审核',
      updatedAt: '刚刚',
    };
    const flow = createResourceAuditFlow(sessionId);
    const opening: ChatMessage = {
      id: `resource-audit-a-${Date.now()}`,
      role: 'assistant',
      content: buildResourceAuditOpening(flow),
      module: '资源审核',
      quickActions: ['看第一条', '暂停并保存进度', '查看本批次汇总'],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(flow);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  /* 「新建评测」场景标签 → 创建历史会话并进入评测任务 N0→N 轨道 */
  const startEvaluationCreate = useCallback(() => {
    if (!isItAdmin) {
      setMessages((prev) => [
        ...prev,
        {
          id: `evaluation-deny-${Date.now()}`,
          role: 'assistant',
          content: EVALUATION_SCENE.noPermission,
          module: '新建评测',
          time: nowStr(),
        },
      ]);
      setIsNewTaskView(false);
      return;
    }
    const sessionId = `evaluation-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '新建评测',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `evaluation-a-${Date.now()}`,
      role: 'assistant',
      content: buildEvaluationOpening(),
      module: '新建评测',
      quickActions: ['第一个，标准评测', '这批都评一下，标准评测', '影像报告解读助手，深度评测'],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow({ sessionId, step: 'n1', slots: {} });
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, [isItAdmin]);

  const startUltrasoundEvaluationCreate = useCallback((sourceText: string) => {
    const sessionId = `evaluation-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '新建评测',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `evaluation-ultrasound-a-${Date.now()}`,
      role: 'assistant',
      content: `已识别用户意图为「新建评测」。请确认是「超声检查预约助手」智能体吗？`,
      module: '新建评测',
      quickActions: ['是的，开启评测'],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow({
      sessionId,
      step: 'confirmUltrasoundAgent',
      slots: {
        sidetrack: sourceText ? [sourceText] : undefined,
        agent: ultrasoundEvaluationAgent,
        agents: [ultrasoundEvaluationAgent],
      },
    });
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages((prev) => [...prev, opening]);
    setDraft('');
    setIsNewTaskView(false);
  }, []);

  /* 「评测审核」场景标签 → 创建历史会话并进入 N0→N4 固定审核轨道 */
  const startEvaluationAudit = useCallback(() => {
    const sessionId = `evaluation-audit-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '评测审核',
      updatedAt: '刚刚',
    };
    const flow = createEvaluationAuditFlow(sessionId);
    const opening: ChatMessage = {
      id: `evaluation-audit-a-${Date.now()}`,
      role: 'assistant',
      content: buildEvaluationAuditOpening(flow),
      module: '评测审核',
      evaluationAuditTable: { rows: availableEvaluationAuditTasks(flow) },
      quickActions: ['看第一条', '查看批次汇总', '暂停审核'],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(flow);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  /* 「监控信息查看」场景标签 → 创建历史会话并展示推荐问句 */
  const startMonitorInfo = useCallback(() => {
    const sessionId = `monitor-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '监控信息查看',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `monitor-a-${Date.now()}`,
      role: 'assistant',
      content: buildMonitorOpening(role),
      module: '监控信息查看',
      quickActions: monitorRecommendedQuestions,
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow({ sessionId });
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, [role]);

  /* 「告警规则配置」场景标签 → 创建历史会话并展示规则配置 mock */
  const startAlertRuleConfig = useCallback((sourceText?: string) => {
    const sessionId = `alert-rule-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '告警规则配置',
      updatedAt: '刚刚',
    };
    const opening: ChatMessage = {
      id: `alert-rule-a-${Date.now()}`,
      role: 'assistant',
      content:
        `已进入「告警规则配置」。${sourceText ? `我理解您想处理：${sourceText}\n\n` : ''}` +
        '当前可配置：调用超时、日调用量突增、资源占用超阈值、异常失败率、通知渠道（企业微信 / 短信 / 邮箱）。\n\n' +
        '请告诉我规则对象、触发条件、阈值和通知渠道，例如：为“处方前置审核”配置调用超时超过 5 秒的高危告警，通知企业微信 + 短信。',
      module: '告警规则配置',
      quickActions: [
        '为处方前置审核配置调用超时告警',
        '新增日调用量突增 200% 的全局告警规则',
        '查看当前生效的所有告警规则清单',
      ],
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(null);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  /* 「接入审核」场景标签 → 创建历史会话并进入 N0→N5 固定审核轨道 */
  const startAccessAudit = useCallback(() => {
    const sessionId = `access-audit-${Date.now()}`;
    const newSession: SessionEntry = {
      id: sessionId,
      title: '接入审核',
      updatedAt: '刚刚',
    };
    const flow = createAccessAuditFlow(sessionId);
    const opening: ChatMessage = {
      id: `access-audit-a-${Date.now()}`,
      role: 'assistant',
      content: buildAccessAuditOpening(flow),
      module: '接入审核',
      accessAuditTable: { rows: accessAuditPending(flow) },
      time: nowStr(),
    };

    setMiddleView('overview');
    setExtraSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(sessionId);
    setRequirementFlow(null);
    setLedgerFlow(null);
    setAccessFlow(null);
    setResourceRegisterFlow(null);
    setResourceApplyFlow(null);
    setResourceAuditFlow(null);
    setEvaluationFlow(null);
    setEvaluationAuditFlow(null);
    setMonitorFlow(null);
    setAccessAuditFlow(flow);
    setMessages([opening]);
    setDraft('');
    setIsNewTaskView(false);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="home-v1-input"] textarea',
      );
      el?.focus();
    }, 60);
  }, []);

  const startBusinessSceneFromInput = useCallback((sceneKey: BusinessSceneKey, text: string, initialUserMessage?: ChatMessage) => {
    const sessionId = `${sceneKey}-${Date.now()}`;
    const sceneLabel = businessSceneIntents.find((item) => item.key === sceneKey)?.label ?? '业务场景';
    const resetFlows = () => {
      setRequirementFlow(null);
      setLedgerFlow(null);
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
    };
    const enterScene = (assistantMessage: ChatMessage) => {
      setMiddleView('overview');
      setExtraSessions((prev) => [{ id: sessionId, title: sceneLabel, updatedAt: '刚刚' }, ...prev]);
      setActiveSessionId(sessionId);
      setIsNewTaskView(false);
      setMessages((prev) => (initialUserMessage ? [initialUserMessage, assistantMessage] : [...prev, assistantMessage]));
    };

    switch (sceneKey) {
      case 'register-requirement': {
        resetFlows();
        const isIntentOnly = isRequirementIntentOnlyText(text);
        const completeSlots = isIntentOnly ? null : extractCompleteRequirementSlots(text);
        const partialSlots = completeSlots ?? (isIntentOnly ? {} : extractPartialRequirementSlots(text));
        setRequirementFlow({
          sessionId,
          step: completeSlots ? 'summary' : 'n0',
          slots: partialSlots,
        });
        enterScene({
          id: `req-a-${Date.now()}`,
          role: 'assistant',
          content: completeSlots ? buildRequirementSummary(completeSlots) : buildRequirementOpening(),
          module: '需求登记',
          requirementSummary: partialSlots,
          quickActions: undefined,
          time: nowStr(),
        });
        return true;
      }
      case 'ledger-query': {
        resetFlows();
        const next = getLedgerReply({ sessionId }, text, role);
        setLedgerFlow(next.flow);
        enterScene({
          id: `ledger-a-${Date.now()}`,
          role: 'assistant',
          content: next.reply,
          module: next.module,
          link: next.link,
          quickActions: next.quickActions,
          candidates: next.candidates,
          reportCard: next.reportCard,
          time: nowStr(),
        });
        return true;
      }
      case 'access-apply': {
        resetFlows();
        const completeSlots = extractCompleteAccessSlots(text);
        const readySlots = completeSlots ? normalizeAccessReadySlots(completeSlots) : null;
        const partialSlots = readySlots ?? extractPartialAccessSlots(text);
        const materialComplete = readySlots ? isAccessMaterialsComplete(readySlots) : false;
        setAccessFlow({
          sessionId,
          step: readySlots ? (materialComplete ? 'summary' : 'materialConfirm') : 'collectMaterial',
          slots: partialSlots,
        });
        enterScene({
          id: `access-a-${Date.now()}`,
          role: 'assistant',
          content: readySlots
            ? materialComplete
              ? buildAccessReadySummary(readySlots)
              : buildAccessMaterialCheck(readySlots)
            : buildAccessOpening(),
          module: '接入申请',
          accessSummary: partialSlots,
          quickActions: readySlots
            ? materialComplete
              ? ACCESS_SUBMIT_QUICK_ACTIONS
              : ACCESS_UPLOAD_QUICK_ACTIONS
            : ACCESS_UPLOAD_QUICK_ACTIONS,
          time: nowStr(),
        });
        return true;
      }
      case 'access-audit': {
        resetFlows();
        const flow = createAccessAuditFlow(sessionId);
        setAccessAuditFlow(flow);
        enterScene({
          id: `access-audit-a-${Date.now()}`,
          role: 'assistant',
          content: buildAccessAuditOpening(flow),
          module: '接入审核',
          accessAuditTable: { rows: accessAuditPending(flow) },
          time: nowStr(),
        });
        return true;
      }
      case 'resource-register': {
        resetFlows();
        setResourceRegisterFlow({ sessionId, step: 'n1', slots: {} });
        enterScene({
          id: `resource-register-a-${Date.now()}`,
          role: 'assistant',
          content: buildResourceRegisterOpening(),
          module: '资源注册',
          quickActions: ['注册 PACS', '注册 HIS', '登记 EMR 系统接口'],
          time: nowStr(),
        });
        return true;
      }
      case 'resource-apply': {
        resetFlows();
        setResourceApplyFlow({ sessionId, step: 'n1', slots: {} });
        enterScene({
          id: `resource-a-${Date.now()}`,
          role: 'assistant',
          content: buildResourceOpening(),
          module: '资源申请',
          quickActions: ['糖尿病随访管理助手', '智能导诊助手 v2.3', '心血管随访助手 v1.2'],
          time: nowStr(),
        });
        return true;
      }
      case 'resource-audit': {
        resetFlows();
        const flow = createResourceAuditFlow(sessionId);
        setResourceAuditFlow(flow);
        enterScene({
          id: `resource-audit-a-${Date.now()}`,
          role: 'assistant',
          content: buildResourceAuditOpening(flow),
          module: '资源审核',
          quickActions: ['看第一条', '暂停并保存进度', '查看本批次汇总'],
          time: nowStr(),
        });
        return true;
      }
      case 'evaluation-create': {
        if (!isItAdmin) {
          setMessages((prev) => [
            ...prev,
            {
              id: `evaluation-deny-${Date.now()}`,
              role: 'assistant',
              content: EVALUATION_SCENE.noPermission,
              module: '新建评测',
              time: nowStr(),
            },
          ]);
          setIsNewTaskView(false);
          return true;
        }
        resetFlows();
        setEvaluationFlow({ sessionId, step: 'n1', slots: {} });
        enterScene({
          id: `evaluation-a-${Date.now()}`,
          role: 'assistant',
          content: buildEvaluationOpening(),
          module: '新建评测',
          quickActions: ['第一个，标准评测', '这批都评一下，标准评测', '影像报告解读助手，深度评测'],
          time: nowStr(),
        });
        return true;
      }
      case 'evaluation-audit': {
        resetFlows();
        const flow = createEvaluationAuditFlow(sessionId);
        setEvaluationAuditFlow(flow);
        enterScene({
          id: `evaluation-audit-a-${Date.now()}`,
          role: 'assistant',
          content: buildEvaluationAuditOpening(flow),
          module: '评测审核',
          evaluationAuditTable: { rows: availableEvaluationAuditTasks(flow) },
          quickActions: ['看第一条', '查看批次汇总', '暂停审核'],
          time: nowStr(),
        });
        return true;
      }
      case 'monitor-info': {
        resetFlows();
        const next = getMonitorReply({ sessionId }, text, role);
        setMonitorFlow(next.flow);
        enterScene({
          id: `monitor-a-${Date.now()}`,
          role: 'assistant',
          content: `已识别业务场景标签/意图：**监控信息查看**。\n\n${next.reply}`,
          module: '监控信息查看',
          link: next.link,
          quickActions: next.quickActions,
          reportCard: next.reportCard,
          monitorAlertTable: next.monitorAlertTable,
          time: nowStr(),
        });
        return true;
      }
      case 'alert-rule-config': {
        resetFlows();
        const next = getAlertRuleConfigReply(text);
        enterScene({
          id: `alert-rule-a-${Date.now()}`,
          role: 'assistant',
          content: next.reply,
          module: '告警规则配置',
          link: next.link,
          alertRuleDraft: next.alertRuleDraft,
          quickActions: next.quickActions,
          time: nowStr(),
        });
        return true;
      }
      default:
        return false;
    }
  }, [isItAdmin, role]);

  /* 1.5 自动化任务新建成功 → 右侧对话区推一条「任务创建成功」气泡 + 链接到 1.5 分组 */
  const handleAutoTaskCreated = useCallback(
    (task: AutoTask, firstRunName: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content:
            `已为您创建自动化任务 **${task.name}**,并生成首次执行子任务 **${firstRunName}**。\n\n` +
            `任务详情可在左侧「自动化任务记录」展开查看;执行结果将按设定频率自动推送。`,
          module: '自动化任务',
          link: { to: '/app/home/overview', text: '查看执行记录' },
          time: nowStr(),
        },
      ]);
    },
    [],
  );

  const handleRequirementSummaryConfirm = useCallback((editedSlots: RequirementSlots) => {
    if (!requirementFlow || requirementFlow.sessionId !== activeSessionId) {
      handleSend('确认提交');
      return;
    }
    const nextFlow: RequirementFlow = {
      ...requirementFlow,
      step: 'done',
      slots: { ...requirementFlow.slots, ...editedSlots },
    };
    const timestamp = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: `req-confirm-u-${timestamp}`,
        role: 'user' as const,
        content: '确认提交',
        time: nowStr(),
      },
      {
        id: `req-confirm-a-${timestamp}`,
        role: 'assistant' as const,
        content: buildRequirementSuccess(nextFlow.slots),
        module: '需求登记',
        actionLinks: getRequirementDoneActionLinks(),
        time: nowStr(),
      },
    ]);
    setRequirementFlow(nextFlow);
  setExtraSessions((prev) =>
      prev.map((s) => (s.id === nextFlow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
    );
  }, [activeSessionId, requirementFlow]);

  const handleAccessSummaryConfirm = useCallback((editedSlots: AccessSlots) => {
    if (!accessFlow || accessFlow.sessionId !== activeSessionId) {
      handleSend('确认提交');
      return;
    }
    const nextSlots = { ...accessFlow.slots, ...editedSlots };
    if (getAccessMissingLabels(nextSlots).length > 0) return;
    const nextFlow: AccessFlow = {
      ...accessFlow,
      step: 'done',
      slots: nextSlots,
    };
    const timestamp = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: `access-confirm-u-${timestamp}`,
        role: 'user' as const,
        content: '确认提交',
        time: nowStr(),
      },
      {
        id: `access-confirm-a-${timestamp}`,
        role: 'assistant' as const,
        content: `接入注册申请已提交！

- 智能体编号：${nextSlots.departmentCode ?? '0503'}-0001（按“科室编号-准入顺序号”自动生成）
- 名称：${nextSlots.agentName ?? '内分泌糖尿病随访管理助手'}
- 版本：${nextSlots.version ?? '2.1'}

${ACCESS_SCENE.closing}`,
        module: '接入申请',
        actionLinks: getAccessDoneActionLinks(),
        time: nowStr(),
      },
    ]);
    setAccessFlow(nextFlow);
    setExtraSessions((prev) =>
      prev.map((s) => (s.id === nextFlow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
    );
  }, [accessFlow, activeSessionId]);

  const handleAlertRuleDraftConfirm = useCallback((editedDraft: AlertRuleDraft) => {
    const savedRule = upsertDailyCallAlertRule(editedDraft);
    const timestamp = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: `alert-rule-confirm-u-${timestamp}`,
        role: 'user' as const,
        content: '确认保存并启用',
        time: nowStr(),
      },
      {
        id: `alert-rule-confirm-a-${timestamp}`,
        role: 'assistant' as const,
        content:
          `创建成功，告警规则 **${savedRule.name}** 已保存并启用。\n\n` +
          `后续当${editedDraft.object || '全局智能体'}满足「${buildAlertRuleConditionDescription(editedDraft)}」时，将通过${editedDraft.channels || '企业微信'}发送告警通知。`,
        module: '告警规则配置',
        link: { to: `/app/monitoring/alert-rules/${savedRule.id}`, text: '查看规则详情', newTab: true },
        time: nowStr(),
      },
    ]);
    if (activeSessionId?.startsWith('alert-rule-')) {
      setExtraSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, updatedAt: '刚刚' } : s)),
      );
    }
  }, [activeSessionId]);

  // 新消息自动滚动到底
  useEffect(() => {
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  /* ---------- 事件:发送 / 停止 ---------- */
  const handleSend = (overrideText?: string, visibleText?: string) => {
    const selectedSkillText = selectedSkillTags.map((name) => `#${name}`).join(' ');
    const text = (overrideText ?? [selectedSkillText, draft].filter(Boolean).join(' ')).trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: visibleText ?? text,
      time: nowStr(),
    };
    setDraft('');
    setSelectedSkillTags([]);

    const isFreshHomeQuestion =
      !activeSessionId &&
      !requirementFlow &&
      !ledgerFlow &&
      !accessFlow &&
      !resourceRegisterFlow &&
      !resourceApplyFlow &&
      !resourceAuditFlow &&
      !evaluationFlow &&
      !evaluationAuditFlow &&
      !monitorFlow &&
      !accessAuditFlow;

    if (isFreshHomeQuestion && isTodayLedgerOverviewQuestion(text)) {
      const sessionId = `ledger-${Date.now()}`;
      setMiddleView('overview');
      setExtraSessions((prev) => [{ id: sessionId, title: '台账查询', updatedAt: '刚刚' }, ...prev]);
      setActiveSessionId(sessionId);
      setRequirementFlow(null);
      setLedgerFlow({ sessionId, reportScope: '全院', reportPeriod: '今日' });
      setAccessFlow(null);
      setResourceRegisterFlow(null);
      setResourceApplyFlow(null);
      setResourceAuditFlow(null);
      setEvaluationFlow(null);
      setEvaluationAuditFlow(null);
      setMonitorFlow(null);
      setAccessAuditFlow(null);
      setIsNewTaskView(false);
      setMessages([
        userMsg,
        {
          id: `ledger-a-${Date.now()}`,
          role: 'assistant',
          content: TODAY_LEDGER_OVERVIEW_REPLY,
          module: '台账查询',
          quickActions: ['生成报告'],
          time: nowStr(),
        },
      ]);
      return;
    }

    if (isFreshHomeQuestion && isUltrasoundEvaluationCreateText(text)) {
      setMiddleView('overview');
      setMessages([userMsg]);
      startUltrasoundEvaluationCreate(text);
      return;
    }

    if (isFreshHomeQuestion) {
      const routedScene = classifyBusinessScene(text);
      if (routedScene) {
        setMiddleView('overview');
        if (startBusinessSceneFromInput(routedScene, text, userMsg)) {
          return;
        }
      }
    }

    if (isFreshHomeQuestion) {
      setMiddleView('overview');
      setMessages([userMsg]);
      setLoading(true);
      window.setTimeout(() => {
        if (isUltrasoundEvaluationCreateText(text)) {
          startUltrasoundEvaluationCreate(text);
          setLoading(false);
          return;
        }

        const routedScene = classifyBusinessScene(text);
        if (routedScene && startBusinessSceneFromInput(routedScene, text, userMsg)) {
          setLoading(false);
          return;
        }

        const closestScene = suggestBusinessScene(text);
        const sessionId = `clarify-${Date.now()}`;
        const title = text.length > 14 ? `${text.slice(0, 14)}...` : text;
        setExtraSessions((prev) => [{ id: sessionId, title, updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setRequirementFlow(null);
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `clarify-a-${Date.now()}`,
            role: 'assistant' as const,
            content: `我暂时没能准确对应到具体业务场景。你是不是想「${closestScene.label}」？`,
            module: '意图澄清',
            quickActions: [`是，我想${closestScene.label}`, '不是，重新描述'],
            time: nowStr(),
          },
        ]);
        setLoading(false);
      }, 1200);
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    window.setTimeout(() => {
      if (
        requirementFlow &&
        requirementFlow.sessionId === activeSessionId &&
        requirementFlow.step !== 'done'
      ) {
        const next = getRequirementNext(requirementFlow, text);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `req-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '需求登记',
            link: index === next.replies.length - 1 ? next.link : undefined,
            actionLinks: index === next.replies.length - 1 ? next.actionLinks : undefined,
            requirementSummary:
              index === next.replies.length - 1 && next.flow.step !== 'done'
                ? next.flow.slots
                : undefined,
            quickActions:
              index === next.replies.length - 1 && next.flow.step !== 'summary'
                ? next.quickActions
                : undefined,
            time: nowStr(),
          })),
        ]);
        setRequirementFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (ledgerFlow && ledgerFlow.sessionId === activeSessionId) {
        const next = getLedgerReply(ledgerFlow, text, role);
        setMessages((prev) => [
          ...prev,
          {
            id: `ledger-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: next.module,
            link: next.link,
            quickActions: next.quickActions,
            candidates: next.candidates,
            reportCard: next.reportCard,
            time: nowStr(),
          },
        ]);
        setLedgerFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (accessFlow && accessFlow.sessionId === activeSessionId && accessFlow.step !== 'done') {
        const next = getAccessNext(accessFlow, text);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `access-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '接入申请',
            link: index === next.replies.length - 1 ? next.link : undefined,
            actionLinks: index === next.replies.length - 1 ? next.actionLinks : undefined,
            accessSummary: shouldRenderAccessForm(next.flow, index, next.replies.length)
              ? next.flow.slots
              : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setAccessFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        resourceRegisterFlow &&
        resourceRegisterFlow.sessionId === activeSessionId &&
        resourceRegisterFlow.step !== 'done'
      ) {
        const next = getResourceRegisterNext(resourceRegisterFlow, text, currentUser?.name);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `resource-register-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '资源注册',
            link: index === next.replies.length - 1 ? next.link : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setResourceRegisterFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        resourceRegisterFlow &&
        resourceRegisterFlow.sessionId === activeSessionId &&
        resourceRegisterFlow.step === 'done'
      ) {
        const next = getResourceRegisterDoneReply(resourceRegisterFlow, text);
        setMessages((prev) => [
          ...prev,
          {
            id: `resource-register-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '资源注册',
            link: next.link,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setResourceRegisterFlow(next.flow);
        setLoading(false);
        return;
      }
      if (
        resourceApplyFlow &&
        resourceApplyFlow.sessionId === activeSessionId &&
        resourceApplyFlow.step !== 'done'
      ) {
        const next = getResourceApplyNext(resourceApplyFlow, text, currentUser?.name);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `resource-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '资源申请',
            link: index === next.replies.length - 1 ? next.link : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setResourceApplyFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        resourceApplyFlow &&
        resourceApplyFlow.sessionId === activeSessionId &&
        resourceApplyFlow.step === 'done'
      ) {
        const next = getResourceApplyDoneReply(resourceApplyFlow, text);
        setMessages((prev) => [
          ...prev,
          {
            id: `resource-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '资源申请',
            link: next.link,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setResourceApplyFlow(next.flow);
        setLoading(false);
        return;
      }
      if (
        resourceAuditFlow &&
        resourceAuditFlow.sessionId === activeSessionId &&
        resourceAuditFlow.step !== 'done'
      ) {
        const next = getResourceAuditNext(resourceAuditFlow, text, currentUser?.name);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `resource-audit-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '资源审核',
            link: index === next.replies.length - 1 ? next.link : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setResourceAuditFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        resourceAuditFlow &&
        resourceAuditFlow.sessionId === activeSessionId &&
        resourceAuditFlow.step === 'done'
      ) {
        const next = getResourceAuditDoneReply(resourceAuditFlow, text);
        setMessages((prev) => [
          ...prev,
          {
            id: `resource-audit-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '资源审核',
            link: next.link,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setResourceAuditFlow(next.flow);
        setLoading(false);
        return;
      }
      if (
        evaluationFlow &&
        evaluationFlow.sessionId === activeSessionId &&
        evaluationFlow.step !== 'done'
      ) {
        const next = getEvaluationNext(evaluationFlow, text, currentUser?.name);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `evaluation-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '新建评测',
            link: index === next.replies.length - 1 ? next.link : undefined,
            actionLinks: index === next.replies.length - 1 ? next.actionLinks : undefined,
            evaluationProgress: index === next.replies.length - 1 ? next.evaluationProgress : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setEvaluationFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        evaluationFlow &&
        evaluationFlow.sessionId === activeSessionId &&
        evaluationFlow.step === 'done'
      ) {
        const next = getEvaluationDoneReply(evaluationFlow, text);
        setMessages((prev) => [
          ...prev,
          {
            id: `evaluation-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '新建评测',
            link: next.link,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setEvaluationFlow(next.flow);
        setLoading(false);
        return;
      }
      if (
        evaluationAuditFlow &&
        evaluationAuditFlow.sessionId === activeSessionId &&
        evaluationAuditFlow.step !== 'done'
      ) {
        const next = getEvaluationAuditNext(evaluationAuditFlow, text, currentUser?.name);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `evaluation-audit-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '评测审核',
            link: index === next.replies.length - 1 ? next.link : undefined,
            evaluationAuditTable: index === next.replies.length - 1 ? next.evaluationAuditTable : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setEvaluationAuditFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        evaluationAuditFlow &&
        evaluationAuditFlow.sessionId === activeSessionId &&
        evaluationAuditFlow.step === 'done'
      ) {
        const next = getEvaluationAuditDoneReply(evaluationAuditFlow, text);
        setMessages((prev) => [
          ...prev,
          {
            id: `evaluation-audit-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '评测审核',
            link: next.link,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setEvaluationAuditFlow(next.flow);
        setLoading(false);
        return;
      }
      if (monitorFlow && monitorFlow.sessionId === activeSessionId) {
        const next = getMonitorReply(monitorFlow, text, role);
        setMessages((prev) => [
          ...prev,
          {
            id: `monitor-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '监控信息查看',
            link: next.link,
            quickActions: next.quickActions,
            reportCard: next.reportCard,
            monitorAlertTable: next.monitorAlertTable,
            time: nowStr(),
          },
        ]);
        setMonitorFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === monitorFlow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        accessAuditFlow &&
        accessAuditFlow.sessionId === activeSessionId &&
        accessAuditFlow.step !== 'done'
      ) {
        const next = getAccessAuditNext(accessAuditFlow, text, currentUser?.name);
        setMessages((prev) => [
          ...prev,
          ...next.replies.map((content, index) => ({
            id: `access-audit-a-${Date.now()}-${index}`,
            role: 'assistant' as const,
            content,
            module: '接入审核',
            link: index === next.replies.length - 1 ? next.link : undefined,
            accessAuditTable: index === next.replies.length - 1 ? next.accessAuditTable : undefined,
            accessAuditConfirmation: index === next.replies.length - 1 ? next.accessAuditConfirmation : undefined,
            quickActions: index === next.replies.length - 1 ? next.quickActions : undefined,
            time: nowStr(),
          })),
        ]);
        setAccessAuditFlow(next.flow);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === next.flow.sessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      if (
        accessAuditFlow &&
        accessAuditFlow.sessionId === activeSessionId &&
        accessAuditFlow.step === 'done'
      ) {
        const next = getAccessAuditDoneReply(accessAuditFlow, text);
        setMessages((prev) => [
          ...prev,
          {
            id: `access-audit-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '接入审核',
            link: next.link,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setAccessAuditFlow(next.flow);
        setLoading(false);
        return;
      }
      if (activeSessionId?.startsWith('alert-rule-')) {
        const next = getAlertRuleConfigReply(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `alert-rule-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '告警规则配置',
            link: next.link,
            alertRuleDraft: next.alertRuleDraft,
            quickActions: next.quickActions,
            time: nowStr(),
          },
        ]);
        setExtraSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, updatedAt: '刚刚' } : s)),
        );
        setLoading(false);
        return;
      }
      const routedScene = classifyBusinessScene(text);
      if (isUltrasoundEvaluationCreateText(text)) {
        startUltrasoundEvaluationCreate(text);
        setLoading(false);
        return;
      }
      if (routedScene && startBusinessSceneFromInput(routedScene, text)) {
        setLoading(false);
        return;
      }
      const closestScene = suggestBusinessScene(text);
      if (!activeSessionId) {
        const sessionId = `clarify-${Date.now()}`;
        const title = text.length > 14 ? `${text.slice(0, 14)}...` : text;
        setExtraSessions((prev) => [{ id: sessionId, title, updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setRequirementFlow(null);
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `clarify-a-${Date.now()}`,
          role: 'assistant' as const,
          content: `我暂时没能准确对应到具体业务场景。你是不是想「${closestScene.label}」？`,
          module: '意图澄清',
          quickActions: [`是，我想${closestScene.label}`, '不是，重新描述'],
          time: nowStr(),
        },
      ]);
      setLoading(false);
      return;
      if (!activeSessionId && isDirectEvaluationCreateText(text)) {
        if (!isItAdmin) {
          setMessages((prev) => [
            ...prev,
            {
              id: `evaluation-deny-${Date.now()}`,
              role: 'assistant' as const,
              content: EVALUATION_SCENE.noPermission,
              module: '新建评测',
              time: nowStr(),
            },
          ]);
          setLoading(false);
          return;
        }
        const sessionId = `evaluation-${Date.now()}`;
        setExtraSessions((prev) => [{ id: sessionId, title: '新建评测', updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setEvaluationFlow({ sessionId, step: 'n1', slots: {} });
        setRequirementFlow(null);
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `evaluation-a-${Date.now()}`,
            role: 'assistant' as const,
            content: buildEvaluationOpening(),
            module: '新建评测',
            quickActions: ['第一个，标准评测', '这批都评一下，标准评测', '影像报告解读助手，深度评测'],
            time: nowStr(),
          },
        ]);
        setLoading(false);
        return;
      }
      if (!activeSessionId && isDirectResourceRegisterText(text)) {
        const sessionId = `resource-register-${Date.now()}`;
        setExtraSessions((prev) => [{ id: sessionId, title: '资源注册', updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setResourceRegisterFlow({ sessionId, step: 'n1', slots: {} });
        setRequirementFlow(null);
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `resource-register-a-${Date.now()}`,
            role: 'assistant' as const,
            content: buildResourceRegisterOpening(),
            module: '资源注册',
            quickActions: [
              '上传资源清单.xlsx：放射 PACS 走 DICOM，再加 Qwen 大模型，云端部署',
              '注册 PACS',
              '注册 Qwen 模型',
            ],
            time: nowStr(),
          },
        ]);
        setLoading(false);
        return;
      }
      if (!activeSessionId && isDirectRequirementText(text)) {
        const sessionId = `req-${Date.now()}`;
        const completeSlots = extractCompleteRequirementSlots(text);
        const partialSlots = completeSlots ?? extractPartialRequirementSlots(text);
        const initialStep: RequirementStep = completeSlots ? 'summary' : 'n0';
        setExtraSessions((prev) => [
          { id: sessionId, title: '智能体建设需求登记', updatedAt: '刚刚' },
          ...prev,
        ]);
        setActiveSessionId(sessionId);
        setRequirementFlow({ sessionId, step: initialStep, slots: partialSlots });
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `req-a-${Date.now()}`,
            role: 'assistant' as const,
            content: completeSlots ? buildRequirementSummary(completeSlots) : buildRequirementOpening(),
            module: '需求登记',
            requirementSummary: partialSlots,
            time: nowStr(),
          },
        ]);
        setLoading(false);
        return;
      }
      if (!activeSessionId && isDirectMonitorText(text)) {
        const sessionId = `monitor-${Date.now()}`;
        const next = getMonitorReply({ sessionId }, text, role);
        setExtraSessions((prev) => [{ id: sessionId, title: '监控信息查看', updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setMonitorFlow(next.flow);
        setRequirementFlow(null);
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `monitor-a-${Date.now()}`,
            role: 'assistant' as const,
            content: next.reply,
            module: '监控信息查看',
            link: next.link,
            quickActions: next.quickActions,
            reportCard: next.reportCard,
            monitorAlertTable: next.monitorAlertTable,
            time: nowStr(),
          },
        ]);
        setLoading(false);
        return;
      }
      if (!activeSessionId && isDirectAccessText(text)) {
        const sessionId = `access-${Date.now()}`;
        const completeSlots = extractCompleteAccessSlots(text);
        const readySlots = completeSlots ? normalizeAccessReadySlots(completeSlots) : null;
        const partialSlots = readySlots ?? extractPartialAccessSlots(text);
        const materialComplete = readySlots ? isAccessMaterialsComplete(readySlots) : false;
        setExtraSessions((prev) => [{ id: sessionId, title: '接入申请', updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setAccessFlow({
          sessionId,
          step: readySlots ? (materialComplete ? 'summary' : 'materialConfirm') : 'collectMaterial',
          slots: partialSlots,
        });
        setRequirementFlow(null);
        setLedgerFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `access-a-${Date.now()}`,
            role: 'assistant' as const,
            content: readySlots
              ? materialComplete
                ? buildAccessReadySummary(readySlots)
                : buildAccessMaterialCheck(readySlots)
              : buildAccessOpening(),
            module: '接入申请',
            accessSummary: partialSlots,
            quickActions: readySlots
              ? materialComplete
                ? ACCESS_SUBMIT_QUICK_ACTIONS
                : ACCESS_UPLOAD_QUICK_ACTIONS
              : ACCESS_UPLOAD_QUICK_ACTIONS,
            time: nowStr(),
          },
        ]);
        setLoading(false);
        return;
      }
      const r = pickReply(text);
      if (!activeSessionId) {
        const sessionId = `chat-${Date.now()}`;
        const title = text.length > 14 ? `${text.slice(0, 14)}...` : text;
        setExtraSessions((prev) => [{ id: sessionId, title, updatedAt: '刚刚' }, ...prev]);
        setActiveSessionId(sessionId);
        setRequirementFlow(null);
        setLedgerFlow(null);
        setAccessFlow(null);
        setResourceRegisterFlow(null);
        setResourceApplyFlow(null);
        setResourceAuditFlow(null);
        setEvaluationFlow(null);
        setEvaluationAuditFlow(null);
        setMonitorFlow(null);
        setAccessAuditFlow(null);
        setIsNewTaskView(false);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: r.reply,
          module: r.module,
          link: r.link,
          time: nowStr(),
        },
      ]);
      setLoading(false);
    }, 1200);
  };

  const handleStop = () => setLoading(false);

  /* ---------- 数据 ---------- */
  // 场景标签:点击后将该场景的 prompt 作为问句发送
  const handleSceneTagClick = (tag: SceneTag) => {
    if (tag.key === 'register-requirement') {
      startRequirementRegistration();
      return;
    }
    if (tag.key === 'ledger-query') {
      startLedgerQuery();
      return;
    }
    if (tag.key === 'access-apply') {
      startAccessApplication();
      return;
    }
    if (tag.key === 'access-audit') {
      startAccessAudit();
      return;
    }
    if (tag.key === 'resource-register') {
      startResourceRegister();
      return;
    }
    if (tag.key === 'resource-apply') {
      startResourceApplication();
      return;
    }
    if (tag.key === 'resource-audit') {
      startResourceAudit();
      return;
    }
    if (tag.key === 'evaluation-create') {
      startEvaluationCreate();
      return;
    }
    if (tag.key === 'evaluation-audit') {
      startEvaluationAudit();
      return;
    }
    if (tag.key === 'monitor-info') {
      startMonitorInfo();
      return;
    }
    if (tag.key === 'alert-rule-config') {
      startAlertRuleConfig();
      return;
    }
    handleSend(tag.prompt);
  };

  /* =========================================================
   * 渲染
   * ========================================================= */
  return (
    <div
      data-testid="home-v1"
      style={{
        padding: 16,
        background: '#F0F2F5',
        height: 'calc(100dvh - 64px)',
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        {/* === 第二层:首页内左侧管理栏(280px,窄屏 <1280 隐藏) === */}
        <Col
          xs={0}
          sm={0}
          md={6}
          lg={6}
          xl={6}
          xxl={6}
          style={{ height: '100%' }}
          data-testid="home-v1-side-col"
        >
          <HomeSidebarV2
            initialActiveKey={
              middleView === 'connector'
                ? 'connector'
                : middleView === 'skill' || middleView === 'skill-manage'
                  ? 'skill'
                : middleView === 'auto-tasks'
                  ? 'auto-task'
                  : 'new'
            }
            onNewTask={handleNewTask}
            onRestoreSession={handleRestoreSession}
            onRestoreRun={handleRestoreRun}
            onAutoTaskCreated={handleAutoTaskCreated}
            onOpenConnector={handleOpenConnector}
            onOpenSkill={handleOpenSkill}
            onOpenAutoTasks={handleOpenAutoTasks}
            autoTasks={autoTasks}
            sessions={[...extraSessions, ...initialSessions]}
            activeSessionId={activeSessionId}
            generatingSessionId={loading ? activeSessionId : null}
            newReplySessionIds={newReplySessionIds}
          />
        </Col>

        {/* === 第三层:首页内右侧对话区(占剩余 18/24) === */}
        <Col span={18} style={{ height: '100%', minWidth: 0 }}>
          {/* 窄屏补偿:1.3 三入口下沉到顶部(<1280 显示) */}
          <div className="home-v1-narrow-actions">
            <Space size={4} wrap>
              <Button size="small" onClick={handleNewTask} data-testid="home-v1-narrow-new">
                新建任务
              </Button>
              <Button
                size="small"
                onClick={() => message.info('连接器:请在宽屏(≥1280)下使用第二层入口', 2)}
                data-testid="home-v1-narrow-connector"
              >
                连接器
              </Button>
              <Button
                size="small"
                onClick={() => message.info('技能:请在宽屏(≥1280)下使用第二层入口', 2)}
                data-testid="home-v1-narrow-skill"
              >
                技能
              </Button>
              <Button
                size="small"
                onClick={() => message.info('自动化任务:请在宽屏(≥1280)下使用第二层入口', 2)}
                data-testid="home-v1-narrow-auto"
              >
                自动化任务
              </Button>
            </Space>
          </div>
          <style>{`
            .home-v1-narrow-actions { display: none; margin-bottom: 8px; }
            @media (max-width: 1279px) {
              .home-v1-narrow-actions { display: block; }
            }
          `}</style>

          <Card
            bordered={false}
            styles={{
              body: {
                padding: 0,
                background: '#FFFFFF',
                borderRadius: 8,
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              },
            }}
            style={{ height: '100%' }}
          >
        {middleView === 'connector' ? (
          <div style={{ height: '100%', overflow: 'auto' }} data-testid="home-v1-middle-connector">
            {/* 内嵌连接器列表（隐藏副标题 + 演示态 Segmented）。 */}
            <ConnectorList embedded />
          </div>
        ) : middleView === 'skill' ? (
          <div style={{ height: '100%', overflow: 'auto' }} data-testid="home-v1-middle-skill">
            <SkillList embedded onTrySkill={applySkillPrompt} />
          </div>
        ) : middleView === 'skill-manage' ? (
          <div style={{ height: '100%', overflow: 'auto' }} data-testid="home-v1-middle-skill-manage-wrap">
            <SkillManage embedded />
          </div>
        ) : middleView === 'auto-tasks' ? (
          <div style={{ height: '100%', overflow: 'auto' }} data-testid="home-v1-middle-auto-tasks">
            {/* 内嵌自动化任务列表（隐藏返回按钮）。 */}
            <AutoTaskList embedded tasks={autoTasks} onTasksChange={setAutoTasks} />
          </div>
        ) : (
          <>
        {/* 2.1 问候区 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 24px',
            background: 'linear-gradient(135deg, #E6F4FF 0%, #F0F5FF 100%)',
            borderBottom: '1px solid #F0F0F0',
          }}
        >
          <AgentRobotIcon mood={loading ? 'thinking' : 'happy'} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={4} style={{ margin: 0, color: '#1677FF', fontSize: 18 }}>
              医小管
            </Title>
            <Text style={{ fontSize: 12, color: '#555', display: 'block', marginTop: 2 }}>
              需求· 接入 · 台账 · 资源 · 评测 · 监控，一句话就能办
            </Text>
          </div>
        </div>

        {/* 2.2 场景标签 + 2.x 消息流(滚动) */}
        <div
          ref={messageListRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 24px',
            background: '#FAFAFA',
          }}
        >
          {messages.length === 0 ? (
            <Empty description="暂无对话" style={{ marginTop: 80 }} />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                navigate={navigate}
                onQuickAction={(action) => {
                  if (action === '上传备案材料') {
                    uploadInputRef.current?.click();
                    return;
                  }
                  if (action.startsWith('确认退回清单 ')) {
                    handleSend(action, '确认退回修改');
                    return;
                  }
                  handleSend(action);
                }}
                onMetricClick={(label) => navigate(resolveLedgerMetricRoute(label))}
                onRequirementSummaryConfirm={handleRequirementSummaryConfirm}
                onAccessSummaryConfirm={handleAccessSummaryConfirm}
                onAlertRuleDraftConfirm={handleAlertRuleDraftConfirm}
              />
            ))
          )}
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
              <AgentRobotIcon mood="thinking" size={28} />
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  padding: '8px 12px',
                  color: '#999',
                  fontSize: 12,
                }}
              >
                医小管正在思考…
              </div>
            </div>
          )}
        </div>

        {/* 2.3 指令输入区 */}
        <div
          onDragEnter={handleInputDragOver}
          onDragOver={handleInputDragOver}
          onDragLeave={handleInputDragLeave}
          onDrop={handleInputDrop}
          style={{
            padding: '10px 24px 14px',
            borderTop: '1px solid #F0F0F0',
            background: '#FFFFFF',
          }}
        >
          {/* 场景标签:仅在「新建任务」视图下展示,且紧贴输入框上方(图2 布局) */}
          {isNewTaskView && (
            <div
              style={{
                position: 'relative',
                marginBottom: 6,
                minWidth: 0,
              }}
            >
              {sceneTagScrollState.left && (
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  icon={<LeftOutlined />}
                  aria-label="向左滑动业务标签"
                  onClick={() => scrollSceneTags('left')}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    zIndex: 2,
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.92)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                  }}
                />
              )}
              <div
                ref={sceneTagScrollRef}
                onScroll={updateSceneTagScrollState}
                className="home-v1-scene-tag-scrollbar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  gap: 8,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  minWidth: 0,
                  padding: '2px 0',
                  scrollBehavior: 'smooth',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {visibleSceneTags.map((t) => (
                  <div
                    key={t.key}
                    onClick={() => handleSceneTagClick(t)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      flex: '0 0 auto',
                      gap: 6,
                      background: '#FFFFFF',
                      border: '1px solid #D9D9D9',
                      borderRadius: 999,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: '20px',
                      whiteSpace: 'nowrap',
                      color: '#262626',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#1677FF';
                      e.currentTarget.style.color = '#1677FF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#D9D9D9';
                      e.currentTarget.style.color = '#262626';
                    }}
                    data-testid={`home-v1-scene-${t.key}`}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>{t.icon}</span>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
              {sceneTagScrollState.right && (
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  icon={<RightOutlined />}
                  aria-label="向右滑动业务标签"
                  onClick={() => scrollSceneTags('right')}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    zIndex: 2,
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.92)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                  }}
                />
              )}
            </div>
          )}
          <div
            onDragEnter={handleInputDragOver}
            onDragOver={handleInputDragOver}
            onDragLeave={handleInputDragLeave}
            onDrop={handleInputDrop}
            style={{
              border: `1px solid ${isInputDragOver ? '#1677FF' : '#D9D9D9'}`,
              borderRadius: 10,
              padding: '6px 10px',
              background: isInputDragOver ? '#F0F7FF' : '#FFFFFF',
              boxShadow: isInputDragOver ? '0 0 0 3px rgba(22, 119, 255, 0.12)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
            }}
          >
            {isInputDragOver && (
              <div
                style={{
                  marginBottom: 4,
                  color: '#1677FF',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                松开即可上传文件
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {selectedSkillTags.map((skillName) => (
                <span
                  key={skillName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 30,
                    maxWidth: '100%',
                    padding: '0 8px',
                    borderRadius: 8,
                    background: '#F1F2F3',
                    color: '#262626',
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: '30px',
                    whiteSpace: 'nowrap',
                  }}
                  data-testid={`home-v1-skill-tag-${skillName}`}
                >
                  <ToolOutlined style={{ fontSize: 15, color: '#262626' }} />
                  <span>{skillName}</span>
                  <button
                    type="button"
                    aria-label={`移除${skillName}`}
                    onClick={() => removeSkillTag(skillName)}
                    style={{
                      width: 18,
                      height: 18,
                      padding: 0,
                      border: 0,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      color: '#8C8C8C',
                      cursor: 'pointer',
                    }}
                  >
                    <CloseOutlined style={{ fontSize: 10 }} />
                  </button>
                </span>
              ))}
              <TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onDragEnter={handleInputDragOver}
                onDragOver={handleInputDragOver}
                onDragLeave={handleInputDragLeave}
                onDrop={handleInputDrop}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={selectedSkillTags.length ? '继续输入任务内容' : '向医小管提问:例如「今天整体台账情况如何?」'}
                autoSize={{ minRows: selectedSkillTags.length ? 1 : 2, maxRows: 5 }}
                variant="borderless"
                data-testid="home-v1-input"
                style={{
                  flex: '1 1 260px',
                  minWidth: 180,
                  paddingTop: selectedSkillTags.length ? 3 : undefined,
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 4,
                flexWrap: 'wrap',
              }}
            >
              {/* 左侧:「+」下拉(添加文件 / 连接器) */}
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  handleUploadFiles(event.target.files);
                  event.target.value = '';
                }}
                aria-hidden="true"
                tabIndex={-1}
              />
              <Popover
                open={skillPickerOpen}
                onOpenChange={setSkillPickerOpen}
                content={skillPickerContent}
                trigger={[]}
                placement="topLeft"
                overlayInnerStyle={{ borderRadius: 16, padding: 14 }}
              >
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'file',
                        label: '添加文件',
                        icon: <PaperClipOutlined />,
                      },
                      {
                        key: 'skill',
                        label: '技能选择',
                        icon: <ToolOutlined />,
                      },
                      {
                        key: 'connector',
                        label: '连接器',
                        icon: <ApiOutlined />,
                      },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'file') {
                        uploadInputRef.current?.click();
                        setSkillPickerOpen(false);
                      } else if (key === 'skill') {
                        setSkillPickerOpen(true);
                      } else if (key === 'connector') {
                        setConnectorOpen(true);
                        setSkillPickerOpen(false);
                      }
                    },
                  }}
                  trigger={['click']}
                  placement="topLeft"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    data-testid="home-v1-toolbar-add"
                  />
                </Dropdown>
              </Popover>
              <span style={{ flex: 1 }} />
              {/* 右侧:模型 + 语音 + 发送 */}
              <Space size={4}>
                <ModelSelector
                  size="small"
                  variant="borderless"
                  compact
                  value={model}
                  onChange={setModel}
                  style={{ width: 104, fontSize: 12 }}
                  testId="home-model-selector"
                />
                <Tooltip title="语音输入">
                  <Button
                    type="text"
                    shape="circle"
                    icon={<AudioOutlined style={{ fontSize: 17 }} />}
                    style={{ width: 32, height: 32, color: '#262626' }}
                    data-testid="home-v1-toolbar-voice"
                  />
                </Tooltip>
                {loading ? (
                  <Button
                    type="text"
                    shape="circle"
                    icon={<StopOutlined style={{ fontSize: 15 }} />}
                    onClick={handleStop}
                    style={{
                      width: 34,
                      height: 34,
                      color: '#FFFFFF',
                      background: '#FF4D4F',
                    }}
                    data-testid="home-v1-stop"
                  />
                ) : (
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<ArrowUpOutlined style={{ fontSize: 16, fontWeight: 600 }} />}
                    onClick={() => handleSend()}
                    disabled={!draft.trim() && selectedSkillTags.length === 0}
                    aria-label="发送消息"
                    style={{
                      width: 34,
                      height: 34,
                      border: 0,
                      boxShadow: 'none',
                      background: draft.trim() || selectedSkillTags.length > 0 ? '#1677FF' : '#D9D9D9',
                      color: '#FFFFFF',
                    }}
                    data-testid="home-v1-send"
                  />
                )}
              </Space>
            </div>
          </div>
        </div>
          </>
        )}
      </Card>
        </Col>
      </Row>

      <SkillImportModal open={skillImportOpen} onClose={() => setSkillImportOpen(false)} />

      {/* ============ Drawer:连接器(由底栏「+ → 连接器」打开) ============ */}
      <Drawer
        title="连接器管理"
        placement="right"
        width={360}
        open={connectorOpen}
        onClose={() => setConnectorOpen(false)}
        destroyOnHidden
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setConnectorOpen(false)}>取消</Button>
            <Button type="primary" onClick={() => setConnectorOpen(false)}>
              保存
            </Button>
          </Space>
        }
      >
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          开启后可将医小管消息推送至外部系统。
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'wechat', name: '微信', desc: '企业微信群机器人' },
            { key: 'feishu', name: '飞书', desc: '飞书机器人 Webhook' },
            { key: 'email', name: '邮箱', desc: 'SMTP 邮件推送' },
            { key: 'sms', name: '短信', desc: '短信网关推送' },
          ].map((c) => (
            <div
              key={c.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#FAFAFA',
                borderRadius: 6,
              }}
            >
              <div>
                <Text strong style={{ fontSize: 13 }}>
                  {c.name}
                </Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  {c.desc}
                </Text>
              </div>
              <Switch
                checked={connectorMap[c.key]}
                onChange={(v) => setConnectorMap((prev) => ({ ...prev, [c.key]: v }))}
                size="small"
              />
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
};

/* =========================================================
 * 子组件:消息气泡
 * ========================================================= */
const MessageBubble = ({
  msg,
  navigate,
  onQuickAction,
  onMetricClick,
  onRequirementSummaryConfirm,
  onAccessSummaryConfirm,
  onAlertRuleDraftConfirm,
}: {
  msg: any;
  navigate: (to: string) => void;
  onQuickAction?: (text: string) => void;
  onMetricClick?: (text: string) => void;
  onRequirementSummaryConfirm?: (slots: RequirementSlots) => void;
  onAccessSummaryConfirm?: (slots: AccessSlots) => void;
  onAlertRuleDraftConfirm?: (draft: AlertRuleDraft) => void;
}) => {
  const isUser = msg.role === 'user';
  const hasDashboardMetrics = !isUser && Array.isArray(msg.dashboardMetrics) && msg.dashboardMetrics.length > 0;
  const isWideAssistantContent = !isUser && Boolean(msg.accessAuditTable || msg.accessAuditConfirmation || msg.evaluationAuditTable || msg.accessSummary || msg.requirementSummary || msg.alertRuleDraft);
  const shouldShowStandaloneMetrics = hasDashboardMetrics;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 8,
        alignItems: 'flex-start',
        marginBottom: 12,
      }}
    >
      {isUser ? (
        <Avatar size={28} style={{ background: '#1677FF', flexShrink: 0 }} icon={<UserOutlined />} />
      ) : (
        <AgentRobotIcon mood="happy" size={28} />
      )}
      <div
        style={{
          maxWidth: isWideAssistantContent || shouldShowStandaloneMetrics ? 'calc(100% - 44px)' : '78%',
          width: isWideAssistantContent || shouldShowStandaloneMetrics ? 'calc(100% - 44px)' : undefined,
        }}
      >
        {!isUser && msg.module && (
          <div style={{ marginBottom: 4 }}>
            <Tag color="blue" style={{ fontSize: 11 }}>
              {msg.module}
            </Tag>
          </div>
        )}
        <div
          style={{
            background: isUser ? '#1677FF' : '#FFFFFF',
            color: isUser ? '#fff' : '#333',
            border: isUser ? 'none' : '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            lineHeight: 1.6,
            wordBreak: 'break-word',
            width: isWideAssistantContent ? '100%' : 'fit-content',
            maxWidth: shouldShowStandaloneMetrics ? '78%' : '100%',
          }}
        >
          {msg.accessSummary ? (
            <AccessSummaryCard
              slots={msg.accessSummary}
              intro={msg.content}
              onConfirm={(slots) => onAccessSummaryConfirm?.(slots)}
            />
          ) : msg.requirementSummary ? (
            <>
              {msg.content !== '【汇总确认卡】' && (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <span style={{ display: 'block', marginBottom: 4 }}>{children}</span>,
                    strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
              <RequirementSummaryCard
                slots={msg.requirementSummary}
                onConfirm={(slots) => onRequirementSummaryConfirm?.(slots)}
              />
            </>
          ) : msg.alertRuleDraft ? (
            <>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <span style={{ display: 'block', marginBottom: 4 }}>{children}</span>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
              <AlertRuleDraftCard
                draft={msg.alertRuleDraft}
                onConfirm={(draft) => onAlertRuleDraftConfirm?.(draft)}
              />
            </>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <span style={{ display: 'block', marginBottom: 4 }}>{children}</span>,
                ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '4px 0' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: '4px 0' }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                code: ({ children }) => (
                  <code
                    style={{
                      background: isUser ? 'rgba(255,255,255,0.2)' : '#F5F5F5',
                      padding: '0 4px',
                      borderRadius: 3,
                      fontSize: 12,
                    }}
                  >
                    {children}
                  </code>
                ),
                strong: ({ children }) => {
                  const label = flattenMarkdownText(children);
                  if (!isUser && onMetricClick && label) {
                    return (
                      <button
                        type="button"
                        onClick={() => onMetricClick(label)}
                        style={{
                          border: 0,
                          padding: 0,
                          margin: 0,
                          background: 'transparent',
                          color: '#1677FF',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textUnderlineOffset: 2,
                        }}
                        data-testid="home-v1-ledger-metric-hotspot"
                      >
                        {children}
                      </button>
                    );
                  }
                  return <strong style={{ fontWeight: 600 }}>{children}</strong>;
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
          {!isUser && Array.isArray(msg.candidates) && msg.candidates.length > 0 && (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {msg.candidates.map((candidate: LedgerCandidate) => (
                <button
                  key={`${candidate.code}-${candidate.name}`}
                  type="button"
                  onClick={() => onQuickAction?.(candidate.prompt)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid #D9E8FF',
                    background: '#F7FBFF',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    color: '#262626',
                  }}
                  data-testid="home-v1-ledger-candidate"
                >
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{candidate.code} · {candidate.name}</div>
                  <div style={{ color: '#8C8C8C', fontSize: 11, marginTop: 2 }}>{candidate.version}</div>
                </button>
              ))}
            </div>
          )}
          {!isUser && msg.reportCard && (
            <div
              style={{
                marginTop: 10,
                border: '1px solid #D9E8FF',
                background: '#F7FBFF',
                borderRadius: 8,
                padding: 10,
              }}
              data-testid="home-v1-ledger-report-card"
            >
              <div style={{ fontWeight: 600, color: '#1677FF', marginBottom: 4 }}>
                {msg.reportCard.title}
              </div>
              <Space size={6} wrap>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => window.open(msg.reportCard.to, '_blank', 'noopener,noreferrer')}
                >
                  查看报告详情
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    exportLedgerReportPdf(msg.reportCard!).catch(() => {
                      message.error('PDF 报告导出失败，请稍后重试');
                    });
                  }}
                >
                  导出报告
                </Button>
              </Space>
            </div>
          )}
          {!isUser && msg.monitorAlertTable && (
            <MonitorAlertTableView
              table={msg.monitorAlertTable}
              navigate={navigate}
              onQuickAction={onQuickAction}
            />
          )}
          {!isUser && msg.accessAuditTable && (
            <AccessAuditTableView
              table={msg.accessAuditTable}
              navigate={navigate}
              onQuickAction={onQuickAction}
            />
          )}
          {!isUser && msg.accessAuditConfirmation && (
            <AccessAuditConfirmationView
              confirmation={msg.accessAuditConfirmation}
              onConfirm={onQuickAction}
            />
          )}
          {!isUser && msg.evaluationAuditTable && (
            <EvaluationAuditTableView
              table={msg.evaluationAuditTable}
              navigate={navigate}
              onQuickAction={onQuickAction}
            />
          )}
          {!isUser && msg.evaluationProgress && (
            <EvaluationProgressCard progress={msg.evaluationProgress} />
          )}
          {msg.link && (
            <div style={{ marginTop: 8 }}>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, color: isUser ? '#fff' : '#1677FF' }}
                onClick={() => {
                  if (msg.link!.newTab) {
                    const url = new URL(msg.link!.to, window.location.origin);
                    window.open(url.toString(), '_blank', 'noopener,noreferrer');
                    return;
                  }
                  navigate(msg.link!.to);
                }}
                data-testid="home-v1-link"
              >
                {msg.link.text} →
              </Button>
            </div>
          )}
          {!isUser && Array.isArray(msg.actionLinks) && msg.actionLinks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {msg.actionLinks.map((action: { to: string; text: string; download?: boolean }) => (
                <Button
                  key={`${action.text}-${action.to}`}
                  size="small"
                  style={{ borderRadius: 999, fontSize: 11, minHeight: 26, height: 'auto' }}
                  onClick={() => {
                    const url = new URL(action.to, window.location.origin);
                    window.open(url.toString(), '_blank', 'noopener,noreferrer');
                  }}
                  data-testid="home-v1-action-link"
                >
                  {action.text}
                </Button>
              ))}
            </div>
          )}
          {!isUser && !msg.accessSummary && Array.isArray(msg.quickActions) && msg.quickActions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {msg.quickActions.map((action: string) => (
                <Button
                  key={action}
                  size="small"
                  style={{
                    borderRadius: 999,
                    fontSize: 11,
                    minHeight: 26,
                    height: 'auto',
                    maxWidth: '100%',
                    whiteSpace: 'normal',
                    textAlign: 'left',
                  }}
                  onClick={() => onQuickAction?.(action)}
                  data-testid="home-v1-ledger-quick-action"
                >
                  {action}
                </Button>
              ))}
            </div>
          )}
        </div>
        {shouldShowStandaloneMetrics && (
          <HomeDashboardMetricsView metrics={msg.dashboardMetrics} />
        )}
        <div
          style={{
            fontSize: 11,
            color: '#999',
            marginTop: 4,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {msg.time}
        </div>
      </div>
    </div>
  );
};

const EvaluationProgressCard = ({ progress }: { progress: EvaluationProgressSummary }) => {
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid #F0F0F0',
        minWidth: 320,
        maxWidth: '100%',
      }}
      data-testid="home-v1-evaluation-progress"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 4,
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          评测进度
        </Text>
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          预计完成时间：还剩 {progress.estimatedRemainingHours} 小时
        </Text>
      </div>
      <Progress
        percent={progress.percent}
        size="small"
        strokeColor="#1677FF"
        trailColor="#E6F4FF"
        status="active"
        style={{ marginBottom: 0 }}
      />
    </div>
  );
};

const AccessSummaryCard = ({
  slots,
  intro,
  onConfirm,
}: {
  slots: AccessSlots;
  intro?: string;
  onConfirm: (slots: AccessSlots) => void;
}) => {
  const normalizeAccessMode = (value?: string): AccessMode => {
    if (value === 'SDK' || value === 'OTel') return value;
    return 'API';
  };
  const buildPlatformUrl = (mode: AccessMode, values: AccessSlots) => {
    const slug = (values.agentName || 'agent-access').replace(/\s+/g, '-').toLowerCase();
    return `https://otel.platform-hospital.cn/agent/${mode.toLowerCase()}/${slug}`;
  };
  const buildInstrumentationCode = (mode: AccessMode, values: AccessSlots) => {
    const url = values.platformUrl || buildPlatformUrl(mode, values);
    const key = values.platformKey || `sk-${mode.toLowerCase()}-********`;
    return `import { init } from '@platform/agent-${mode.toLowerCase()}';\ninit({\n  endpoint: '${url}',\n  apiKey: '${key}',\n});`;
  };
  const buildDefaultMaterials = (values: AccessSlots) => values.materials ?? [];
  const toUploadFiles = (materials: string[]): UploadFile[] =>
    materials
      .flatMap((name) => {
        const cleanName = name.replace(/（.*?）/g, '').trim();
        const fileNames = cleanName.match(/[^、，,\s]+?\.(?:pdf|docx?|xlsx?|csv|jpe?g|png)/gi);
        return fileNames && fileNames.length > 0
          ? fileNames.map((item) => item.replace(/^[和及]/, ''))
          : [cleanName];
      })
      .filter((name, index, arr) => name && arr.indexOf(name) === index)
      .map((name, index) => ({
        uid: `access-material-${index}`,
        name,
        status: 'done' as const,
        percent: 100,
      }));
  const [draftSlots, setDraftSlots] = useState<AccessSlots>(() => {
    const mode = normalizeAccessMode(slots.accessMethod);
    const initial = { ...slots, accessMethod: mode };
    return initial;
  });
  const [materialFiles, setMaterialFiles] = useState<UploadFile[]>(() => toUploadFiles(buildDefaultMaterials(slots)));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(slots.connectivity ?? '');

  const updateSlot = (key: keyof AccessSlots, value: string) => {
    setDraftSlots((prev) => ({
      ...prev,
      [key]: key === 'materials'
        ? value.split(/[、\n]+/).map((item) => item.trim()).filter(Boolean)
        : value,
    }));
  };
  const updateAccessMethod = (value: AccessMode) => {
    setDraftSlots((prev) => {
      const next: AccessSlots = { ...prev, accessMethod: value };
      if (value === 'API') {
        next.endpoint = next.endpoint || 'https://api.hospital.local/agent/access/v1';
        next.apiKeyMasked = next.apiKeyMasked || '********';
      } else {
        next.platformUrl = next.platformUrl || buildPlatformUrl(value, next);
        next.platformKey = next.platformKey || `sk-${value.toLowerCase()}-********`;
        next.instrumentationCode = buildInstrumentationCode(value, next);
      }
      return next;
    });
    setTestResult(value === 'API' ? '通过（320ms，接口响应正常）' : `通过（320ms，${value} 配置校验通过）`);
  };
  const rerunConnectivityTest = () => {
    const mode = normalizeAccessMode(draftSlots.accessMethod);
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      setTestResult(mode === 'API' ? '通过（320ms，接口响应正常）' : `通过（320ms，${mode} 平台 URL、密钥与埋点代码校验通过）`);
      message.success('联通测试通过');
    }, 520);
  };
  const buildGeneratedMaterialName = (type: 'tech' | 'product') => {
    const baseName = (draftSlots.agentName || '智能体接入申请').replace(/[\\/:*?"<>|]/g, '');
    return type === 'tech'
      ? `${baseName}-技术规格说明书.pdf`
      : `${baseName}-产品说明书.pdf`;
  };
  const addGeneratedMaterial = (types: Array<'tech' | 'product'>) => {
    const generatedFiles: UploadFile[] = types.map((type) => ({
      uid: `access-generated-${type}-${Date.now()}`,
      name: buildGeneratedMaterialName(type),
      status: 'done' as const,
      percent: 100,
    }));
    setMaterialFiles((prev) => {
      const existingNames = new Set(prev.map((file) => file.name));
      return [...prev, ...generatedFiles.filter((file) => !existingNames.has(file.name))];
    });
    setDraftSlots((prev) => ({
      ...prev,
      techSpecUploaded: prev.techSpecUploaded || types.includes('tech'),
      productDocUploaded: prev.productDocUploaded || types.includes('product'),
    }));
    message.success(types.length === 2 ? '已生成全部备案材料' : `已生成${types[0] === 'tech' ? '技术规格说明书' : '产品说明书'}`);
  };
  const rows = getAccessBaseRows();
  const materialNames = materialFiles.map((file) => file.name);
  const localSlots: AccessSlots = {
    ...draftSlots,
    materials: materialNames,
    techSpecUploaded: materialNames.some((name) => /技术规格|技术文档|接口文档|规格书/.test(name)),
    productDocUploaded: materialNames.some((name) => /产品说明|产品文档|产品.*说明书/.test(name)),
    connectivity: testResult,
  };
  const missingLabels = getAccessMissingLabels(localSlots);
  const fieldMissingLabels = getAccessFieldMissingLabels(localSlots);
  const { missingTech, missingProduct } = getAccessMissingMaterialTypes(localSlots);
  const canGenerateMaterials = fieldMissingLabels.length === 0 && (missingTech || missingProduct);
  const canSubmit = missingLabels.length === 0;
  const introText = intro?.split(/\n\s*\n/)[0] ?? (canSubmit ? '描述信息完整 + 材料齐全 + 连通测试通过，可以提交。' : '描述信息不完整，请补全表单后提交。');
  const accessMode = normalizeAccessMode(draftSlots.accessMethod);
  const renderHeaderCell = (label: ReactNode) => (
    <th
      style={{
        width: 118,
        verticalAlign: 'top',
        textAlign: 'left',
        padding: '8px 10px',
        color: '#595959',
        background: '#F7FBFF',
        border: '1px solid #D9E8FF',
        fontWeight: 600,
      }}
    >
      {label}
    </th>
  );
  const renderBodyCell = (children: ReactNode) => (
    <td style={{ padding: 6, border: '1px solid #D9E8FF', background: '#FFFFFF' }}>{children}</td>
  );

  return (
    <div data-testid="home-v1-access-summary-card">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>【接入申请汇总确认卡】</div>
      <Text style={{ display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }}>
        {introText}
      </Text>
      {!canSubmit && (
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          还缺：{missingLabels.join('、')}。可以直接在表格中补全，补齐后即可确认提交。
        </Text>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 12 }}>
          <tbody>
            {rows.map((row) => {
              const rawValue = draftSlots[row.key];
              const value = Array.isArray(rawValue)
                ? rawValue.join('\n')
                : String(rawValue ?? '');
              const missing = !value.trim() || (row.key === 'phone' && !isValidAccessPhone(value));
              const fieldControl = row.multiline ? (
                <TextArea
                  value={value}
                  autoSize={{ minRows: row.key === 'functionDescription' ? 4 : 2, maxRows: 8 }}
                  placeholder={row.placeholder}
                  onChange={(event) => updateSlot(row.key, event.target.value)}
                  style={{ fontSize: 12, lineHeight: 1.6, resize: 'none' }}
                />
              ) : (
                <Input
                  value={value}
                  placeholder={row.placeholder}
                  onChange={(event) => updateSlot(row.key, event.target.value)}
                  style={{ fontSize: 12 }}
                />
              );
              return (
                <tr key={row.key}>
                  {renderHeaderCell(
                    <Space size={4}>
                      <span>{row.label}</span>
                      {missing && <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>未填</Tag>}
                    </Space>,
                  )}
                  {renderBodyCell(fieldControl)}
                </tr>
              );
            })}
            <tr>
              {renderHeaderCell('接入方式')}
              {renderBodyCell(
                <Select
                  value={accessMode}
                  options={[
                    { label: 'API 接入', value: 'API' },
                    { label: 'SDK 接入', value: 'SDK' },
                    { label: 'OTel 接入', value: 'OTel' },
                  ]}
                  onChange={(value) => updateAccessMethod(value as AccessMode)}
                  style={{ width: 180 }}
                />,
              )}
            </tr>
            {accessMode === 'API' ? (
              <>
                <tr>
                  {renderHeaderCell('接口地址')}
                  {renderBodyCell(
                    <Input
                      value={draftSlots.endpoint ?? ''}
                      placeholder="请输入接口地址，例如 https://api.example.com/agent/v1"
                      onChange={(event) => updateSlot('endpoint', event.target.value)}
                      style={{ fontSize: 12 }}
                    />,
                  )}
                </tr>
                <tr>
                  {renderHeaderCell('API key')}
                  {renderBodyCell(
                    <Input.Password
                      value={draftSlots.apiKeyMasked ?? ''}
                      placeholder="请输入或确认 API key"
                      onChange={(event) => updateSlot('apiKeyMasked', event.target.value)}
                      style={{ fontSize: 12 }}
                    />,
                  )}
                </tr>
              </>
            ) : (
              <>
                <tr>
                  {renderHeaderCell('平台 URL 地址')}
                  {renderBodyCell(
                    <Input
                      value={draftSlots.platformUrl ?? ''}
                      placeholder={buildPlatformUrl(accessMode, draftSlots)}
                      onChange={(event) => updateSlot('platformUrl', event.target.value)}
                      style={{ fontSize: 12 }}
                    />,
                  )}
                </tr>
                <tr>
                  {renderHeaderCell('平台密钥 key')}
                  {renderBodyCell(
                    <Input.Password
                      value={draftSlots.platformKey ?? ''}
                      placeholder={`sk-${accessMode.toLowerCase()}-********`}
                      onChange={(event) => updateSlot('platformKey', event.target.value)}
                      style={{ fontSize: 12 }}
                    />,
                  )}
                </tr>
                <tr>
                  {renderHeaderCell('埋点代码生成')}
                  {renderBodyCell(
                    <TextArea
                      value={draftSlots.instrumentationCode ?? ''}
                      placeholder={buildInstrumentationCode(accessMode, draftSlots)}
                      onChange={(event) => updateSlot('instrumentationCode', event.target.value)}
                      autoSize={{ minRows: 4, maxRows: 6 }}
                      style={{ fontSize: 12, lineHeight: 1.6, resize: 'none', fontFamily: 'monospace' }}
                    />,
                  )}
                </tr>
              </>
            )}
            <tr>
              {renderHeaderCell('备案材料')}
              {renderBodyCell(
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Upload
                    multiple
                    fileList={materialFiles}
                    beforeUpload={() => false}
                    onChange={(info) => {
                      setMaterialFiles(info.fileList.map((file) => ({ ...file, status: 'done' as const, percent: 100 })));
                    }}
                  >
                    <Button size="small" icon={<ReloadOutlined />}>
                      重新上传
                    </Button>
                  </Upload>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {materialFiles.length > 0
                      ? `已上传 ${materialFiles.length} 个文件，需包含技术规格书和产品说明书。`
                      : '暂未上传文件，需包含技术规格书和产品说明书。'}
                  </Text>
                </Space>,
              )}
            </tr>
            <tr>
              {renderHeaderCell('联通测试')}
              {renderBodyCell(
                <Space size={8} wrap>
                  <Button
                    size="small"
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={testing}
                    onClick={rerunConnectivityTest}
                  >
                    联通测试
                  </Button>
                  <Tag color="success" icon={<FileTextOutlined />}>
                    {testResult || '待测试'}
                  </Tag>
                </Space>,
              )}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {canGenerateMaterials && (
          <>
            {missingTech && missingProduct && (
              <Button
                size="small"
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => addGeneratedMaterial(['tech', 'product'])}
                data-testid="home-v1-access-generate-all-materials"
              >
                生成全部备案材料
              </Button>
            )}
            {missingTech && (
              <Button
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => addGeneratedMaterial(['tech'])}
                data-testid="home-v1-access-generate-tech-material"
              >
                生成技术规格说明书
              </Button>
            )}
            {missingProduct && (
              <Button
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => addGeneratedMaterial(['product'])}
                data-testid="home-v1-access-generate-product-material"
              >
                生成产品说明书
              </Button>
            )}
          </>
        )}
        <Button
          type="primary"
          size="small"
          disabled={!canSubmit}
          onClick={() => canSubmit && onConfirm(localSlots)}
          data-testid="home-v1-access-summary-submit"
        >
          确认提交
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {canSubmit ? '哪项有误可直接在表格内修改。' : '表单信息完整后可提交。'}
        </Text>
      </div>
    </div>
  );
};

const RequirementSummaryCard = ({
  slots,
  onConfirm,
}: {
  slots: RequirementSlots;
  onConfirm: (slots: RequirementSlots) => void;
}) => {
  const [draftSlots, setDraftSlots] = useState<RequirementSlots>(() => ({ ...slots }));
  const urgencyOptions = ['低', '中', '高'].map((value) => ({ label: value, value }));
  const normalizeUrgencyValue = (value?: string) => (
    value && ['低', '中', '高'].includes(value) ? value : undefined
  );
  const updateSlot = (key: keyof RequirementSlots, value?: string) => {
    setDraftSlots((prev) => ({ ...prev, [key]: value }));
  };
  const rows: Array<{ key: keyof RequirementSlots; label: string; multiline?: boolean; placeholder: string }> = [
    { key: 'department', label: '提出科室', placeholder: '请输入提出科室' },
    { key: 'clinicStage', label: '诊疗环节', placeholder: '请选择或填写诊疗环节' },
    { key: 'functionDescription', label: '功能描述', multiline: true, placeholder: '请说明服务对象、读取信息与输出结果' },
    { key: 'reason', label: '提出原因', multiline: true, placeholder: '请说明现有流程和主要痛点' },
    { key: 'resources', label: '所需资源', multiline: true, placeholder: '请说明业务系统、模型或数据资源' },
    { key: 'urgency', label: '需求紧急程度', placeholder: '请选择高/中/低' },
    { key: 'proposer', label: '提出人', placeholder: '请输入提出人姓名' },
    { key: 'phone', label: '联系方式', placeholder: '请输入 11 位手机号' },
  ];
  const isFilled = (key: keyof RequirementSlots) => String(draftSlots[key] ?? '').trim().length > 0;
  const missingLabels = rows
    .filter((row) => !isFilled(row.key) || (row.key === 'phone' && !/^\d{11}$/.test(String(draftSlots.phone ?? '').trim())))
    .map((row) => row.label);
  const canSubmit = missingLabels.length === 0;
  const title = canSubmit ? '【汇总确认卡】' : '【需求登记表单】';

  return (
    <div data-testid="home-v1-requirement-summary-card">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {!canSubmit && (
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          还缺：{missingLabels.join('、')}。可以直接在表格中补全，补齐后即可确认提交。
        </Text>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: 12 }}>
          <tbody>
            {rows.map((row) => {
              const value = String(draftSlots[row.key] ?? '');
              const missing = !value.trim() || (row.key === 'phone' && !/^\d{11}$/.test(value.trim()));
              return (
                <tr key={row.key}>
                  <th
                    style={{
                      width: 118,
                      verticalAlign: 'top',
                      textAlign: 'left',
                      padding: '8px 10px',
                      color: '#595959',
                      background: '#F7FBFF',
                      border: '1px solid #D9E8FF',
                      fontWeight: 600,
                    }}
                  >
                    <Space size={4}>
                      <span>{row.label}</span>
                      {missing && <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>未填</Tag>}
                    </Space>
                  </th>
                  <td style={{ padding: 6, border: '1px solid #D9E8FF', background: '#FFFFFF' }}>
                    {row.key === 'urgency' ? (
                      <Select
                        value={normalizeUrgencyValue(value)}
                        placeholder={row.placeholder}
                        allowClear
                        options={urgencyOptions}
                        onChange={(nextValue) => updateSlot(row.key, nextValue)}
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    ) : row.multiline ? (
                      <TextArea
                        value={value}
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        placeholder={row.placeholder}
                        onChange={(event) => updateSlot(row.key, event.target.value)}
                        style={{ fontSize: 12, lineHeight: 1.6, resize: 'none' }}
                      />
                    ) : (
                      <Input
                        value={value}
                        placeholder={row.placeholder}
                        onChange={(event) => updateSlot(row.key, event.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <Button
          type="primary"
          size="small"
          disabled={!canSubmit}
          onClick={() => canSubmit && onConfirm(draftSlots)}
          data-testid="home-v1-requirement-summary-submit"
        >
          确认提交
        </Button>
        {!canSubmit && (
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            表单信息完整后可提交
          </Text>
        )}
      </div>
    </div>
  );
};

const AlertRuleDraftCard = ({
  draft,
  onConfirm,
}: {
  draft: AlertRuleDraft;
  onConfirm: (draft: AlertRuleDraft) => void;
}) => {
  const [editedDraft, setEditedDraft] = useState<AlertRuleDraft>(() => ({ ...draft }));
  const updateDraft = (key: AlertRuleDraftField, value: string) => {
    setEditedDraft((prev) => ({ ...prev, [key]: value }));
  };
  const updateChannels = (channels: string[]) => {
    updateDraft('channels', channels.join('、'));
  };
  const rows: Array<{ key: AlertRuleDraftField; label: string; options?: string[] }> = [
    { key: 'name', label: '规则名称' },
    { key: 'object', label: '规则对象' },
    { key: 'type', label: '规则类型', options: ['业务监控告警规则', '状态监控告警规则', '成本监控告警规则', '安全监控告警规则'] },
    { key: 'metric', label: '触发指标', options: ['业务调用总量', '任务完成率', '不合规回答率', '高风险拦截数', '心跳成功率', '运行状态变更', 'GPU 显存使用率', '周期总成本', 'Token 消耗', '实例闲置率'] },
  ];
  const alertLevels: Array<{
    label: string;
    operatorKey: AlertRuleDraftField;
    thresholdKey: AlertRuleDraftField;
  }> = [
    { label: '低危', operatorKey: 'lowOperator', thresholdKey: 'lowThreshold' },
    { label: '中危', operatorKey: 'mediumOperator', thresholdKey: 'mediumThreshold' },
    { label: '高危', operatorKey: 'highOperator', thresholdKey: 'highThreshold' },
  ];
  const operatorOptions = ['>', '>=', '<', '<=', '='];
  const channelValues = editedDraft.channels ? editedDraft.channels.split('、').filter(Boolean) : [];

  return (
    <div data-testid="home-v1-alert-rule-draft-card" style={{ marginTop: 8 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680, fontSize: 12 }}>
          <tbody>
            {rows.map((row) => {
              const value = editedDraft[row.key] ?? '';
              return (
                <tr key={row.key}>
                  <th
                    style={{
                      width: 118,
                      verticalAlign: 'top',
                      textAlign: 'left',
                      padding: '8px 10px',
                      color: '#595959',
                      background: '#F7FBFF',
                      border: '1px solid #D9E8FF',
                      fontWeight: 600,
                    }}
                  >
                    {row.label}
                  </th>
                  <td style={{ padding: 6, border: '1px solid #D9E8FF', background: '#FFFFFF' }}>
                    {row.options ? (
                      <Select
                        value={value}
                        options={row.options.map((option) => ({ label: option, value: option }))}
                        onChange={(nextValue) => updateDraft(row.key, nextValue)}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <Input
                        value={value}
                        onChange={(event) => updateDraft(row.key, event.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <th
                style={{
                  width: 118,
                  verticalAlign: 'top',
                  textAlign: 'left',
                  padding: '8px 10px',
                  color: '#595959',
                  background: '#F7FBFF',
                  border: '1px solid #D9E8FF',
                  fontWeight: 600,
                }}
              >
                触发条件
              </th>
              <td style={{ padding: 6, border: '1px solid #D9E8FF', background: '#FFFFFF' }}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  {alertLevels.map((level) => (
                    <Space key={level.label} size={8} style={{ display: 'flex' }}>
                      <Tag style={{ width: 48, textAlign: 'center', marginInlineEnd: 0 }}>{level.label}</Tag>
                      <Select
                        value={editedDraft[level.operatorKey]}
                        options={operatorOptions.map((operator) => ({ label: operator, value: operator }))}
                        onChange={(value) => updateDraft(level.operatorKey, value)}
                        style={{ width: 92 }}
                      />
                      <InputNumber
                        min={0}
                        value={Number(editedDraft[level.thresholdKey] || 0)}
                        onChange={(value) => updateDraft(level.thresholdKey, String(value ?? ''))}
                        addonAfter="次"
                        style={{ width: 180 }}
                      />
                    </Space>
                  ))}
                </Space>
              </td>
            </tr>
            <tr>
              <th
                style={{
                  width: 118,
                  verticalAlign: 'top',
                  textAlign: 'left',
                  padding: '8px 10px',
                  color: '#595959',
                  background: '#F7FBFF',
                  border: '1px solid #D9E8FF',
                  fontWeight: 600,
                }}
              >
                通知渠道
              </th>
              <td style={{ padding: 6, border: '1px solid #D9E8FF', background: '#FFFFFF' }}>
                <Select
                  mode="multiple"
                  value={channelValues}
                  options={['企业微信', '短信', '邮箱'].map((option) => ({ label: option, value: option }))}
                  onChange={updateChannels}
                  maxTagCount="responsive"
                  style={{ width: '100%' }}
                />
              </td>
            </tr>
            <tr>
              <th
                style={{
                  width: 118,
                  verticalAlign: 'top',
                  textAlign: 'left',
                  padding: '8px 10px',
                  color: '#595959',
                  background: '#F7FBFF',
                  border: '1px solid #D9E8FF',
                  fontWeight: 600,
                }}
              >
                创建人
              </th>
              <td style={{ padding: 6, border: '1px solid #D9E8FF', background: '#FFFFFF' }}>
                <Input value={editedDraft.creator} disabled style={{ fontSize: 12 }} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <Button
          type="primary"
          size="small"
          onClick={() => onConfirm(editedDraft)}
          data-testid="home-v1-alert-rule-save-enable"
        >
          确认保存并启用
        </Button>
      </div>
    </div>
  );
};

const HomeDashboardMetricsView = ({ metrics }: { metrics: HomeDashboardMetric[] }) => (
  <div
    className="home-v1-metric-grid"
    data-testid="home-v1-greeting-metrics"
  >
    {metrics.map((metric) => (
      <div
        key={metric.key}
        className="home-v1-metric-card"
        style={{
          '--metric-accent': metric.accent,
          '--metric-fill': metric.fill,
        } as CSSProperties}
        data-testid={`home-v1-greeting-metric-${metric.key}`}
      >
        <div className="home-v1-metric-glow" />
        <div className="home-v1-metric-header">
          <span className="home-v1-metric-kicker">{metric.label}</span>
          <span className="home-v1-metric-live">LIVE</span>
        </div>
        <div className="home-v1-metric-value-row">
          <strong className="home-v1-metric-value">{metric.value}</strong>
          <span className="home-v1-metric-chip">近6月</span>
        </div>
        <div className="home-v1-metric-chart">
          <MiniTrendChart metricKey={metric.key} values={metric.trend.map((item) => item.value)} color={metric.accent} fill={metric.fill} />
        </div>
      </div>
    ))}
  </div>
);

const MiniTrendChart = ({ metricKey, values, color, fill }: { metricKey: string; values: number[]; color: string; fill: string }) => {
  const width = 260;
  const height = 72;
  const paddingX = 8;
  const paddingY = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(1, values.length - 1);
    const y = height - paddingY - ((value - min) / span) * (height - paddingY * 2);
    return { x, y };
  });
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;
    return `${path} C ${controlX.toFixed(1)} ${previous.y.toFixed(1)}, ${controlX.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, '');
  const areaPath = `${linePath} L ${(width - paddingX).toFixed(1)} ${(height - paddingY).toFixed(1)} L ${paddingX.toFixed(1)} ${(height - paddingY).toFixed(1)} Z`;
  const lastPoint = points[points.length - 1];
  const gradientId = `homeMetricGradient-${metricKey}`;
  const haloId = `homeMetricHalo-${metricKey}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="72"
      role="img"
      aria-label="月趋势图"
      className="home-v1-metric-svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="72%" stopColor={fill} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={haloId} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[0, 1, 2].map((lineIndex) => (
        <line
          key={lineIndex}
          x1={paddingX}
          x2={width - paddingX}
          y1={paddingY + (lineIndex * (height - paddingY * 2)) / 2}
          y2={paddingY + (lineIndex * (height - paddingY * 2)) / 2}
          className="home-v1-metric-grid-line"
        />
      ))}
      <path d={areaPath} fill={`url(#${gradientId})`} className="home-v1-metric-area" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${haloId})`} className="home-v1-metric-line" pathLength="1" />
      {points.map((point, index) => (
        <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 2.8 : 2.1} fill="#FFFFFF" stroke={color} strokeWidth="1.6" className="home-v1-metric-dot" />
      ))}
      <circle cx={lastPoint.x} cy={lastPoint.y} r="6.5" fill={color} className="home-v1-metric-pulse" />
      <line x1="0" x2={width} y1="1" y2="1" className="home-v1-metric-scan" />
    </svg>
  );
};

const accessAuditRouteByCode: Record<string, string> = {
  '0503-0001': '/app/agent-center/audit/acc-xg-001',
  '0201-0006': '/app/agent-center/audit/acc-004',
  '0201-0004': '/app/agent-center/audit/acc-009',
};

const EvaluationAuditTableView = ({
  table,
  navigate,
  onQuickAction,
}: {
  table: EvaluationAuditTable;
  navigate: (to: string) => void;
  onQuickAction?: (text: string) => void;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rows = table.rows;
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const partiallySelected = selectedIds.length > 0 && selectedIds.length < rows.length;
  const selectedText = selectedIds
    .map((id) => rows.find((row) => row.id === id)?.agentCode)
    .filter(Boolean)
    .join(' ');

  const openReviewPage = (task: EvaluationTask) => {
    const to = `/app/evaluation/tasks/${task.id}/review?fromTab=${encodeURIComponent('待审核')}`;
    const url = new URL(to, window.location.origin);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  if (!rows.length) {
    return (
      <div
        style={{
          marginTop: 10,
          border: '1px solid #D9E8FF',
          background: '#F7FBFF',
          borderRadius: 8,
          padding: 10,
        }}
        data-testid="home-v1-evaluation-audit-empty"
      >
        <Text style={{ fontSize: 12 }}>{table.emptyText ?? '当前暂无待审核评测任务。'}</Text>
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={() => navigate('/app/evaluation/tasks?tab=待审核')}>
            打开待审核任务
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #E5E7EB',
        background: '#FFFFFF',
        borderRadius: 8,
        overflow: 'hidden',
      }}
      data-testid="home-v1-evaluation-audit-table"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #F0F0F0', flexWrap: 'wrap' }}>
        <Text strong style={{ fontSize: 12, marginRight: 4 }}>
          待审核评测任务
        </Text>
        <Checkbox
          indeterminate={partiallySelected}
          checked={allSelected}
          onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])}
        >
          全选
        </Checkbox>
        <Text type="secondary" style={{ fontSize: 12 }}>
          已选 {selectedIds.length} / {rows.length}
        </Text>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFAFA', color: '#595959' }}>
              <th style={monitorThStyle}>选择</th>
              <th style={monitorThStyle}>智能体编号</th>
              <th style={monitorThStyle}>智能体名称</th>
              <th style={monitorThStyle}>预审结论</th>
              <th style={monitorThStyle}>结论说明</th>
              <th style={monitorThStyle}>智能体版本号</th>
              <th style={monitorThStyle}>评测标签</th>
              <th style={monitorThStyle}>测试样本量</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const conclusion = getEvaluationSystemConclusion(row) === '准入' ? '通过' : '退回修改';
              const { report, detail } = getEvaluationAuditDetail(row);
              const tags = [
                row.riskLevel,
                report?.overallRisk ? `总体${report.overallRisk}` : undefined,
              ].filter(Boolean);
              return (
                <tr key={row.id}>
                  <td style={monitorTdStyle}>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) => {
                        setSelectedIds((prev) =>
                          event.target.checked
                            ? Array.from(new Set([...prev, row.id]))
                            : prev.filter((id) => id !== row.id),
                        );
                      }}
                      aria-label={`选择${row.agentName}`}
                    />
                  </td>
                  <td style={{ ...monitorTdStyle, minWidth: 120 }}>{row.agentCode}</td>
                  <td style={{ ...monitorTdStyle, minWidth: 180 }}>
                    <Button type="link" size="small" style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => openReviewPage(row)}>
                      {row.agentName}
                    </Button>
                  </td>
                  <td style={{ ...monitorTdStyle, minWidth: 110 }}>
                    <Tag color={conclusion === '通过' ? 'green' : 'orange'} style={{ marginInlineEnd: 0 }}>
                      {conclusion}
                    </Tag>
                  </td>
                  <td style={{ ...monitorTdStyle, minWidth: 300, maxWidth: 420, color: '#595959', lineHeight: 1.55 }}>
                    {detail}
                  </td>
                  <td style={monitorTdStyle}>{row.version}</td>
                  <td style={{ ...monitorTdStyle, minWidth: 220 }}>
                    <Space size={4} wrap>
                      {tags.map((tag) => (
                        <Tag key={tag} style={{ marginInlineEnd: 0 }}>
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </td>
                  <td style={monitorTdStyle}>{sampleLevelLabel(row.sampleLevel)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 8, borderTop: '1px solid #F0F0F0', flexWrap: 'wrap' }}>
        <Button
          size="small"
          type="primary"
          disabled={!selectedIds.length}
          onClick={() => onQuickAction?.(`审核通过 ${selectedText}`)}
        >
          审核通过
        </Button>
        <Button
          size="small"
          danger
          disabled={!selectedIds.length}
          onClick={() => onQuickAction?.(`退回修改 ${selectedText}：依据预审结论退回修改`)}
        >
          退回修改
        </Button>
      </div>
    </div>
  );
};

const AccessAuditTableView = ({
  table,
  navigate,
  onQuickAction,
}: {
  table: AccessAuditTable;
  navigate: (to: string) => void;
  onQuickAction?: (text: string) => void;
}) => {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const rows = table.rows;
  const allSelected = rows.length > 0 && selectedCodes.length === rows.length;
  const partiallySelected = selectedCodes.length > 0 && selectedCodes.length < rows.length;
  const selectedText = selectedCodes.join(' ');

  const openAuditPage = (agent: AccessAuditAgent) => {
    const to = accessAuditRouteByCode[agent.code] ?? '/app/agent-center?tab=待审核';
    const url = new URL(to, window.location.origin);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  if (!rows.length) {
    return (
      <div
        style={{
          marginTop: 10,
          border: '1px solid #D9E8FF',
          background: '#F7FBFF',
          borderRadius: 8,
          padding: 10,
        }}
        data-testid="home-v1-access-audit-empty"
      >
        <Text style={{ fontSize: 12 }}>{table.emptyText ?? '当前暂无待接入审核申请。'}</Text>
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={() => navigate('/app/agent-center?tab=待审核')}>
            打开接入中心
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #E5E7EB',
        background: '#FFFFFF',
        borderRadius: 8,
        overflow: 'hidden',
      }}
      data-testid="home-v1-access-audit-table"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #F0F0F0', flexWrap: 'wrap' }}>
        <Checkbox
          indeterminate={partiallySelected}
          checked={allSelected}
          onChange={(event) => setSelectedCodes(event.target.checked ? rows.map((row) => row.code) : [])}
        >
          全选
        </Checkbox>
        <Text type="secondary" style={{ fontSize: 12 }}>
          已选 {selectedCodes.length} / {rows.length}
        </Text>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1320, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFAFA', color: '#595959' }}>
              <th style={monitorThStyle}>选择</th>
              <th style={monitorThStyle}>智能体名称</th>
              <th style={monitorThStyle}>预审结论</th>
              <th style={monitorThStyle}>所属科室</th>
              <th style={monitorThStyle}>诊断环节</th>
              <th style={monitorThStyle}>智能体来源</th>
              <th style={monitorThStyle}>供应商名称</th>
              <th style={monitorThStyle}>核心功能</th>
              <th style={monitorThStyle}>智能体版本</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <td style={monitorTdStyle}>
                  <Checkbox
                    checked={selectedCodes.includes(row.code)}
                    onChange={(event) => {
                      setSelectedCodes((prev) =>
                        event.target.checked
                          ? Array.from(new Set([...prev, row.code]))
                          : prev.filter((code) => code !== row.code),
                      );
                    }}
                    aria-label={`选择${row.name}`}
                  />
                </td>
                <td style={{ ...monitorTdStyle, minWidth: 190 }}>
                  <Button type="link" size="small" style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => openAuditPage(row)}>
                    {row.name}
                  </Button>
                  <div style={{ color: '#8C8C8C', fontSize: 11 }}>{row.code}</div>
                </td>
                <td style={{ ...monitorTdStyle, minWidth: 150 }}>
                  <Tag color={row.precheck === '建议通过' ? 'green' : 'orange'} style={{ marginInlineEnd: 0 }}>
                    {row.precheck}
                  </Tag>
                  <div style={{ color: '#8C8C8C', fontSize: 11, marginTop: 2 }}>{row.precheckSummary}</div>
                </td>
                <td style={monitorTdStyle}>{row.department}</td>
                <td style={monitorTdStyle}>{row.clinicStage}</td>
                <td style={monitorTdStyle}>{row.source}</td>
                <td style={monitorTdStyle}>{row.vendor}</td>
                <td style={{ ...monitorTdStyle, minWidth: 320 }}>{row.description}</td>
                <td style={monitorTdStyle}>{row.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 8, borderTop: '1px solid #F0F0F0', flexWrap: 'wrap' }}>
        <Button
          size="small"
          type="primary"
          disabled={!selectedCodes.length}
          onClick={() => onQuickAction?.(`审核通过 ${selectedText}`)}
        >
          审核通过
        </Button>
        <Button
          size="small"
          danger
          disabled={!selectedCodes.length}
          onClick={() => onQuickAction?.(`退回修改 ${selectedText}`)}
        >
          退回修改
        </Button>
      </div>
    </div>
  );
};

const AccessAuditConfirmationView = ({
  confirmation,
  onConfirm,
}: {
  confirmation: AccessAuditConfirmation;
  onConfirm?: (text: string) => void;
}) => {
  const isReturn = confirmation.conclusion === '退回修改';
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(confirmation.rows.map((row) => [
      row.code,
      isReturn && row.precheck === '建议退回修改' ? row.precheckSummary : '',
    ])),
  );
  const missingReason = isReturn && confirmation.rows.some((row) => !reasons[row.code]?.trim());

  return (
    <div style={{ marginTop: 10, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }} data-testid="home-v1-access-audit-confirmation">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isReturn ? 900 : 680, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFAFA', color: '#595959' }}>
              <th style={monitorThStyle}>智能体编号</th>
              <th style={monitorThStyle}>智能体名称</th>
              <th style={monitorThStyle}>版本</th>
              <th style={monitorThStyle}>审核结论</th>
              {isReturn && <th style={monitorThStyle}>具体说明</th>}
            </tr>
          </thead>
          <tbody>
            {confirmation.rows.map((row) => (
              <tr key={row.code}>
                <td style={monitorTdStyle}>{row.code}</td>
                <td style={{ ...monitorTdStyle, minWidth: 180 }}>{row.name}</td>
                <td style={monitorTdStyle}>{row.version}</td>
                <td style={monitorTdStyle}>
                  <Tag color={isReturn ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>{confirmation.conclusion}</Tag>
                </td>
                {isReturn && (
                  <td style={{ ...monitorTdStyle, minWidth: 360 }}>
                    <Input.TextArea
                      value={reasons[row.code]}
                      rows={2}
                      maxLength={500}
                      showCount
                      status={!reasons[row.code]?.trim() ? 'error' : undefined}
                      placeholder={row.precheck === '建议通过' ? '该项预审建议通过，请填写退回修改的具体说明' : '请填写具体说明'}
                      onChange={(event) => setReasons((prev) => ({ ...prev, [row.code]: event.target.value }))}
                      aria-label={`${row.name}具体说明`}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 10, borderTop: '1px solid #F0F0F0' }}>
        <Button
          type="primary"
          danger={isReturn}
          disabled={missingReason}
          onClick={() => onConfirm?.(isReturn
            ? `确认退回清单 ${encodeURIComponent(JSON.stringify(reasons))}`
            : '确认审核通过清单')}
        >
          {isReturn ? '提交' : '确认'}
        </Button>
      </div>
    </div>
  );
};

const MonitorAlertTableView = ({
  table,
  navigate,
  onQuickAction,
}: {
  table: MonitorAlertTable;
  navigate: (to: string) => void;
  onQuickAction?: (text: string) => void;
}) => {
  const [level, setLevel] = useState<'全部' | '高' | '中' | '低'>('全部');
  const [dimension, setDimension] = useState<'全部' | '业务' | '状态' | '成本' | '安全'>('全部');
  const [keyword, setKeyword] = useState('');
  const rows = table.rows.filter((row) => {
    const hitLevel = level === '全部' || row.level === level;
    const hitDimension = dimension === '全部' || row.dimension === dimension;
    const hitKeyword = !keyword.trim() || `${row.code}${row.agentName}${row.content}`.toLowerCase().includes(keyword.trim().toLowerCase());
    return hitLevel && hitDimension && hitKeyword;
  });

  if (!table.rows.length) {
    return (
      <div
        style={{
          marginTop: 10,
          border: '1px solid #D9E8FF',
          background: '#F7FBFF',
          borderRadius: 8,
          padding: 10,
        }}
        data-testid="home-v1-monitor-alert-empty"
      >
        <Text style={{ fontSize: 12 }}>{table.emptyText ?? '当前暂无未处理告警，运行平稳'}</Text>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => onQuickAction?.('看运行概况')}>看运行概况</Button>
          <Button size="small" type="primary" onClick={() => onQuickAction?.('生成监控报告')}>生成监控报告</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #E5E7EB',
        background: '#FFFFFF',
        borderRadius: 8,
        overflow: 'hidden',
      }}
      data-testid="home-v1-monitor-alert-table"
    >
      <div style={{ display: 'flex', gap: 6, padding: 8, flexWrap: 'wrap', borderBottom: '1px solid #F0F0F0' }}>
        <Select
          size="small"
          value={level}
          onChange={setLevel}
          style={{ width: 90 }}
          options={['全部', '高', '中', '低'].map((value) => ({ value, label: value === '全部' ? '级别:全部' : `级别:${value}` }))}
        />
        <Select
          size="small"
          value={dimension}
          onChange={setDimension}
          style={{ width: 96 }}
          options={['全部', '业务', '状态', '成本', '安全'].map((value) => ({ value, label: value === '全部' ? '维度:全部' : `维度:${value}` }))}
        />
        <Input.Search
          size="small"
          allowClear
          placeholder="搜索智能体"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 160 }}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFAFA', color: '#595959' }}>
              <th style={monitorThStyle}>级别</th>
              <th style={monitorThStyle}>智能体编号</th>
              <th style={monitorThStyle}>智能体名称</th>
              <th style={monitorThStyle}>告警内容</th>
              <th style={monitorThStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ background: row.level === '高' ? '#FFF1F0' : '#FFFFFF' }}>
                <td style={monitorTdStyle}>
                  <Tag color={row.level === '高' ? 'red' : row.level === '中' ? 'orange' : 'default'} style={{ marginInlineEnd: 0 }}>
                    {row.level}
                  </Tag>
                </td>
                <td style={monitorTdStyle}>{row.code}</td>
                <td style={monitorTdStyle}>{row.agentName}</td>
                <td style={monitorTdStyle}>{row.content}</td>
                <td style={monitorTdStyle}>
                  <Space size={4} wrap>
                    <Button size="small" type="link" style={{ padding: 0 }} onClick={() => navigate(row.detailTo)}>
                      查看详情
                    </Button>
                    <Button size="small" type="link" style={{ padding: 0 }} onClick={() => message.success(`已通知 ${row.agentName} 负责人`)}>
                      通知负责人
                    </Button>
                    <Button size="small" type="link" style={{ padding: 0 }} onClick={() => message.success('已标记处理，等待复核')}>
                      标记处理
                    </Button>
                  </Space>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: 8, borderTop: '1px solid #F0F0F0', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => onQuickAction?.('查看指标趋势')}>
          查看指标趋势
        </Button>
      </div>
    </div>
  );
};

const monitorThStyle: React.CSSProperties = {
  padding: '7px 8px',
  textAlign: 'left',
  borderBottom: '1px solid #F0F0F0',
  whiteSpace: 'nowrap',
};

const monitorTdStyle: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: '1px solid #F5F5F5',
  verticalAlign: 'top',
};


/* =========================================================
 * 工具
 * ========================================================= */
function nowStr() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function flattenMarkdownText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenMarkdownText).join('');
  return '';
}

function resolveLedgerMetricRoute(label: string): string {
  if (/token|成本|费用|GPU|CPU|内存|单任务平均成本/i.test(label)) return '/app/monitoring/cost';
  if (/在线率|离线|心跳|状态/.test(label)) return '/app/monitoring/status';
  if (/任务执行成功率|调用量|P95|响应|中断|吞吐|并发/.test(label)) return '/app/monitoring/business';
  if (/告警|P0|P1|异常|故障/.test(label)) return '/app/monitoring/alert-events';
  if (/风险|高度关注|中度关注|一般关注/.test(label)) return '/app/ledger/list?risk=high';
  if (/调用|运行率|在线率|趋势/.test(label)) return '/app/monitoring/business';
  if (/科室|覆盖率|分布/.test(label)) return '/app/ledger/list?group=department';
  if (/评测|通过率/.test(label)) return '/app/evaluation/tasks';
  return '/app/ledger/list';
}

function buildGreeting(role: '信息科管理员' | '科室管理员', userName?: string): string {
  const who = userName ?? '用户';
  return role === '信息科管理员'
    ? `您好,${who},我是医小管,请问有什么能帮到您?`
    : `您好,${who},我是医小管,请问有什么能帮到您?\n\n我可以帮您快速:\n- 查找本科室可用的智能体\n- 提报建设需求 / 跟踪接入审批\n- 了解本科室本月调用与告警情况`;
}

function buildHomeDashboardMetrics(role: '信息科管理员' | '科室管理员'): HomeDashboardMetric[] {
  const agents = getLedgerVisibleAgents(role);
  const calls = getCallVolumeStat(agents);
  const alarms = getAlarmStat(agents);

  return [
    {
      key: 'managedAgents',
      label: '纳管智能体数量',
      value: `${agents.length} 个`,
      trend: buildManagedAgentMonthlyTrend(agents),
      accent: '#1677FF',
      fill: 'rgba(22, 119, 255, 0.14)',
    },
    {
      key: 'totalCalls',
      label: '总调用量',
      value: `${calls.total.toLocaleString()} 次`,
      trend: buildScaledMonthlyTrend(calls.monthly, [0.62, 0.7, 0.78, 0.86, 0.94, 1]),
      accent: '#13A8A8',
      fill: 'rgba(19, 168, 168, 0.14)',
    },
    {
      key: 'alerts',
      label: '告警次数',
      value: `${alarms.total.toLocaleString()} 次`,
      trend: buildScaledMonthlyTrend(alarms.monthly, [0.78, 0.92, 0.72, 1, 0.84, 0.68]),
      accent: '#FA8C16',
      fill: 'rgba(250, 140, 22, 0.16)',
    },
  ];
}

function buildRecentMonthLabels(count = 6, anchor = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(anchor);
    d.setDate(1);
    d.setMonth(anchor.getMonth() - (count - 1 - index));
    return `${d.getMonth() + 1}月`;
  });
}

function buildManagedAgentMonthlyTrend(agents: LedgerAgent[]) {
  const latestAccessTime = agents
    .map((agent) => new Date(agent.accessTime))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const anchor = latestAccessTime ?? new Date();
  const labels = buildRecentMonthLabels(6, anchor);
  const buckets = new Map(labels.map((label) => [label, 0]));

  agents.forEach((agent) => {
    const accessDate = new Date(agent.accessTime);
    if (Number.isNaN(accessDate.getTime())) return;
    const label = `${accessDate.getMonth() + 1}月`;
    if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + 1);
  });

  return labels.map((month) => ({ month, value: buckets.get(month) ?? 0 }));
}

function buildScaledMonthlyTrend(total: number, weights: number[]) {
  const labels = buildRecentMonthLabels(weights.length);
  const weightedTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const average = total / weightedTotal;
  return labels.map((month, index) => ({
    month,
    value: Math.max(0, Math.round(average * weights[index])),
  }));
}

function buildRequirementOpening(): string {
  return '你好！我是医小管，我来帮您登记智能体建设需求（约 8 步、3–5 分钟，内容随时可改）。请用一两句话描述：您想建设一个什么样的智能体、主要解决什么问题？';
}

function buildLedgerOpening(): string {
  return '你好，我是医小管。台账相关问题都可以问我';
}

function buildAccessOpening(): string {
  return ACCESS_SCENE.opening;
}

const accessAuditPendingAgents: AccessAuditAgent[] = [
  {
    code: '0503-0001',
    name: '内分泌糖尿病随访管理助手',
    version: 'v2.1',
    department: '0503 内分泌科',
    clinicStage: '其他（出院后随访管理）',
    description: '读取患者基础信息、诊疗记录、检验指标与随访计划，自动生成随访任务、健康提醒、异常风险提示和结构化随访报告。',
    source: '合作研发',
    vendor: '智医健康科技有限公司',
    contact: '陈明',
    phone: '138****5678',
    accessMethod: 'API',
    endpoint: 'https://api.xxhealth.com/dm-followup/v2',
    apiKeyMasked: '********',
    applicant: '内分泌科 李秀英',
    precheck: '建议通过',
    precheckSummary: '信息完整、材料齐备、联通测试通过、无重名、合规',
    checks: [
      { label: '信息完整性', ok: true, desc: '必填字段已完整填写' },
      { label: '备案材料齐备性', ok: true, desc: '产品说明书、技术规格书、测试报告均已上传' },
      { label: '联通测试', ok: true, desc: '接口 320ms 返回 200' },
      { label: '名称查重', ok: true, desc: '未发现同名智能体' },
      { label: '合规性', ok: true, desc: '密钥密文托管，权限范围与诊疗场景一致' },
    ],
  },
  {
    code: '0201-0006',
    name: '慢病随访提醒助手',
    version: 'v1.0',
    department: '0201 全科医学科',
    clinicStage: '辅助治疗',
    description: '面向慢病患者生成随访提醒、复诊提醒与用药依从性提示，并将待办同步给责任医生。',
    source: '科室自研',
    vendor: '院内信息科',
    contact: '王珊',
    phone: '136****7821',
    accessMethod: 'SDK',
    endpoint: 'med-followup-sdk@1.0.0',
    apiKeyMasked: '********',
    applicant: '全科医学科 赵医生',
    precheck: '建议通过',
    precheckSummary: '五维均达标',
    checks: [
      { label: '信息完整性', ok: true, desc: '注册信息完整' },
      { label: '备案材料齐备性', ok: true, desc: '备案材料齐备' },
      { label: '联通测试', ok: true, desc: 'SDK 自检通过' },
      { label: '名称查重', ok: true, desc: '未发现同名智能体' },
      { label: '合规性', ok: true, desc: '调用资源均在授权范围内' },
    ],
  },
  {
    code: '0201-0004',
    name: '儿科用药咨询助手',
    version: 'v0.9',
    department: '0201 儿科',
    clinicStage: '辅助治疗',
    description: '面向儿科门诊医生提供儿童常见用药咨询、剂量换算提示与禁忌提醒。',
    source: '第三方采购',
    vendor: '童康智能科技有限公司',
    contact: '刘洋',
    phone: '139****2468',
    accessMethod: 'API',
    endpoint: 'https://api.childcare-ai.com/medication/v1',
    apiKeyMasked: '********',
    applicant: '儿科 张医生',
    precheck: '建议退回修改',
    precheckSummary: '技术规格书缺失、联通测试未通过',
    checks: [
      { label: '信息完整性', ok: true, desc: '注册字段已填写' },
      { label: '备案材料齐备性', ok: false, desc: '缺技术规格书 PDF' },
      { label: '联通测试', ok: false, desc: '接口返回 404，未通过连通性校验' },
      { label: '名称查重', ok: true, desc: '未发现同名智能体' },
      { label: '合规性', ok: true, desc: '未发现越权资源声明' },
    ],
  },
];

function createAccessAuditFlow(sessionId: string): AccessAuditFlow {
  return {
    sessionId,
    step: 'n1',
    agents: accessAuditPendingAgents.map((agent) => ({
      ...agent,
      checks: agent.checks.map((check) => ({ ...check })),
    })),
    decisions: [],
    viewedCodes: [],
  };
}

function accessAuditPending(flow: AccessAuditFlow) {
  const done = new Set(flow.decisions.map((decision) => decision.code));
  return flow.agents.filter((agent) => !done.has(agent.code));
}

function locateAccessAuditAgent(flow: AccessAuditFlow, text: string): AccessAuditAgent | undefined {
  const pending = accessAuditPending(flow);
  const indexMatch = text.match(/第\s*([一二三四五六七八九十\d]+)\s*个?/);
  if (indexMatch) {
    const raw = indexMatch[1];
    const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const index = Number(raw) || map[raw];
    if (index) return pending[index - 1];
  }
  const digitOnly = text.trim().match(/^\d+$/)?.[0];
  if (digitOnly) return pending[Number(digitOnly) - 1];
  const normalized = text.toLowerCase();
  return pending.find((agent) => {
    const target = `${agent.code} ${agent.name} ${agent.department} ${agent.vendor}`.toLowerCase();
    return target.includes(normalized) || normalized.includes(agent.code.toLowerCase()) || normalized.includes(agent.name.toLowerCase().slice(0, 4));
  });
}

function locateAccessAuditAgents(flow: AccessAuditFlow, text: string): AccessAuditAgent[] {
  const pending = accessAuditPending(flow);
  const normalized = text.toLowerCase();
  const matched = pending.filter((agent) => {
    const codeHit = normalized.includes(agent.code.toLowerCase());
    const nameHit = normalized.includes(agent.name.toLowerCase()) || normalized.includes(agent.name.toLowerCase().slice(0, 4));
    return codeHit || nameHit;
  });
  if (matched.length > 0) return matched;
  const single = locateAccessAuditAgent(flow, text);
  return single ? [single] : [];
}

function accessAuditBatchTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAccessAuditQueue(flow: AccessAuditFlow, agents = accessAuditPending(flow)) {
  if (!agents.length) return '当前无待审核智能体。';
  return agents
    .map((agent, index) => `${index + 1}.${agent.code} ${agent.name}——${agent.precheck}（${agent.precheckSummary}）`)
    .join('\n');
}

function buildAccessAuditOpening(flow: AccessAuditFlow): string {
  const pending = accessAuditPending(flow);
  if (!pending.length) return '已识别意图：接入审核。当前暂无待接入审核申请。';
  return `已识别意图：接入审核。当前待接入审核 ${pending.length} 项，列表如下。

您可以在列表中单选或多选后执行“审核通过 / 退回修改”；点击智能体名称可在新页面查看待审核信息。`;
}

function buildAccessAuditDetail(agent: AccessAuditAgent, full = false): string {
  const checks = agent.checks
    .map((check, index) => `${index + 1}.${check.label} ${check.ok ? '✓' : '✗'}（${check.desc}）`)
    .join('\n');
  const base = `${agent.code} ${agent.name}｜所属科室：${agent.department}｜诊疗环节：${agent.clinicStage}｜接入方式：${agent.accessMethod}（API key ${agent.apiKeyMasked}）。

注册信息摘要：
- 版本：${agent.version}
- 功能描述：${agent.description}
- 来源：${agent.source}
- 供应商：${agent.vendor}
- 技术联系人：${agent.contact}
- 联系方式：${agent.phone}
- 接入地址/组件：${agent.endpoint}

五维核验：
${checks}

预审结论：${agent.precheck}。`;
  if (!full) {
    return `${base}

请给出二次审核结论：审核通过 / 退回修改。需要看完整详情可说“看完整详情”。`;
  }
  return `${base}

完整详情已展开：
- 申请人：${agent.applicant}
- 备案材料：产品说明书已上传；技术规格书${agent.checks.some((check) => !check.ok && check.label.includes('备案')) ? '缺失' : '已上传'}；联通测试报告已生成
- 联通测试报告：${agent.checks.find((check) => check.label === '联通测试')?.desc}
- 密钥字段：全程密文展示，不外泄明文

以上为完整信息。请问这一条的结论是审核通过还是退回修改？`;
}

function buildAccessAuditSummary(flow: AccessAuditFlow, paused = false) {
  const passed = flow.decisions.filter((decision) => decision.result === '审核通过').length;
  const returned = flow.decisions.filter((decision) => decision.result === '退回修改').length;
  const unhandled = accessAuditPending(flow).length;
  return `本次接入审核${paused ? '已暂停' : '完成'}：
1.审核通过 ${passed}
2.退回修改 ${returned}
3.未处理 ${unhandled}

${paused ? '未处理项保持待审核，场景锁已释放。' : '队列中每个智能体均已产生明确二次审核决策，审核记录、状态流转与申请人通知均已生效。'}

收尾后仅开放动作：查看本次审核批次汇总、跟进待办清单、结束场景。`;
}

function buildAccessAuditTodo(flow: AccessAuditFlow) {
  const todos = [
    ...flow.decisions
      .filter((decision) => decision.result === '退回修改')
      .map((decision) => `${decision.code}：跟进申请人按“${decision.reason}”完成整改并重新提交`),
    ...accessAuditPending(flow).map((agent) => `${agent.code}：未处理，保持待审核队列`),
  ];
  return todos.length ? `待办清单：\n${todos.map((todo, index) => `${index + 1}. ${todo}`).join('\n')}` : '待办清单为空。本次审核批次没有遗留事项。';
}

function applyAccessAuditDecision(
  flow: AccessAuditFlow,
  pending: AccessAuditPendingDecision,
  reviewer?: string,
): { flow: AccessAuditFlow; receipt: string } {
  const time = accessAuditBatchTime();
  const reviewerName = reviewer ?? '当前管理员';
  const decisions = pending.codes.map((code) => ({
    code,
    result: pending.result,
    reason: pending.reasons?.[code] ?? pending.reason,
    overridePrecheck: pending.overridePrecheck,
    time,
  }));
  const nextFlow: AccessAuditFlow = {
    ...flow,
    step: 'n1',
    selectedCode: undefined,
    pendingDecision: undefined,
    decisions: [...flow.decisions, ...decisions],
  };
  const names = pending.codes
    .map((code) => flow.agents.find((agent) => agent.code === code))
    .filter(Boolean)
    .map((agent) => `${agent!.code} ${agent!.name}`)
    .join('、');
  const status = pending.result === '审核通过' ? '状态→已纳管' : '状态→退回申请人';
  const reason = pending.result === '退回修改'
    ? `\n\n具体说明：\n${pending.codes.map((code) => `- **${code}**：${pending.reasons?.[code] ?? pending.reason ?? ''}`).join('\n')}`
    : '';
  const override = pending.overridePrecheck ? '\n\n已记录“覆盖预审”标记，供审计追溯。' : '';
  return {
    flow: nextFlow,
    receipt: `${names} 已${pending.result}，${status}。

- 审核人：${reviewerName}
- 审核时间：${time}${reason}${override}

已通知申请人。`,
  };
}

function finishAccessAuditIfNeeded(flow: AccessAuditFlow, replies: string[], paused = false) {
  if (paused || accessAuditPending(flow).length === 0) {
    return {
      flow: { ...flow, step: 'done' as const },
      replies: [...replies, buildAccessAuditSummary(flow, paused)],
      quickActions: ['查看本次审核批次汇总', '跟进待办清单', '结束场景'],
    };
  }
  return {
    flow,
    replies: [
      ...replies,
      `剩余待审核 ${accessAuditPending(flow).length} 个：
${formatAccessAuditQueue(flow)}

请继续选择审核对象，或说“暂停审核”。`,
    ],
    accessAuditTable: { rows: accessAuditPending(flow) },
    quickActions: ['查看下一条', '只看建议退回修改', '暂停审核'],
  };
}

function getAccessAuditNext(
  flow: AccessAuditFlow,
  text: string,
  reviewer?: string,
): {
  flow: AccessAuditFlow;
  replies: string[];
  link?: { to: string; text: string };
  accessAuditTable?: AccessAuditTable;
  accessAuditConfirmation?: AccessAuditConfirmation;
  quickActions?: string[];
} {
  const normalized = text.trim();
  const yes = /确认|同意|是|对|没问题|执行|批量通过/.test(normalized);
  const explicitAgents = locateAccessAuditAgents(flow, normalized);
  const isRejectAction = /审核不通过|不通过|退回|驳回/.test(normalized);
  const isPassAction = !isRejectAction && /审核通过|通过/.test(normalized);

  if (/暂停|先停|结束/.test(normalized)) {
    return finishAccessAuditIfNeeded(flow, ['已暂停本次接入审核。未处理项保持待审核。'], true);
  }
  if (/排班|工资|天气|新闻|这个月.*通过|累计通过/.test(normalized)) {
    return {
      flow: { ...flow, pendingTodos: [...(flow.pendingTodos ?? []), normalized] },
      replies: ['我们先来完成智能体注册信息审核，稍后再为您解决此问题。\n\n当前审核队列还需要继续处理。'],
      quickActions: ['查看下一条', '批量通过建议通过', '暂停审核'],
    };
  }
  if (flow.pendingDecision && yes) {
    let pendingDecision = flow.pendingDecision;
    const encodedReasons = normalized.match(/^确认退回清单\s+(.+)$/)?.[1];
    if (pendingDecision.result === '退回修改' && encodedReasons) {
      try {
        pendingDecision = {
          ...pendingDecision,
          reasons: JSON.parse(decodeURIComponent(encodedReasons)) as Record<string, string>,
        };
      } catch {
        return { flow, replies: ['具体说明读取失败，请检查后重新提交。'], accessAuditConfirmation: { rows: flow.agents.filter((agent) => pendingDecision.codes.includes(agent.code)), conclusion: '退回修改' } };
      }
    }
    if (pendingDecision.result === '退回修改' && pendingDecision.codes.some((code) => !pendingDecision.reasons?.[code]?.trim())) {
      return { flow, replies: ['退回修改清单中每一项都必须填写具体说明后才可提交。'], accessAuditConfirmation: { rows: flow.agents.filter((agent) => pendingDecision.codes.includes(agent.code)), conclusion: '退回修改' } };
    }
    const applied = applyAccessAuditDecision(flow, pendingDecision, reviewer);
    return finishAccessAuditIfNeeded(applied.flow, [applied.receipt]);
  }
  if (flow.pendingDecision && /取消|不确认|等等|返回/.test(normalized)) {
    return {
      flow: { ...flow, pendingDecision: undefined },
      replies: ['已取消本次待确认操作。请重新选择审核对象或决策。'],
      quickActions: ['查看下一条', '批量通过建议通过', '暂停审核'],
    };
  }
  if (/只看.*退回|建议退回|要退回/.test(normalized)) {
    const returned = accessAuditPending(flow).filter((agent) => agent.precheck === '建议退回修改');
    return {
      flow,
      replies: [`预审“建议退回修改”共 ${returned.length} 个：\n${formatAccessAuditQueue(flow, returned)}\n\n退回修改必须先专项查看，请选择其中一个。`],
      quickActions: returned.map((agent) => `查看 ${agent.code}`).concat('暂停审核'),
    };
  }
  if (/批量|建议通过.*通过|都审核通过|全部通过/.test(normalized)) {
    const candidates = accessAuditPending(flow).filter((agent) => agent.precheck === '建议通过');
    if (!candidates.length) {
      return {
        flow,
        replies: ['当前没有可批量通过的预审“建议通过”项。退回修改不可批量，请逐个专项查看后决策。'],
        quickActions: ['只看建议退回修改', '查看下一条', '暂停审核'],
      };
    }
    const pendingDecision: AccessAuditPendingDecision = {
      codes: candidates.map((agent) => agent.code),
      result: '审核通过',
      batch: true,
    };
    return {
      flow: { ...flow, step: 'n3', pendingDecision },
      replies: [`好的，预审“建议通过”共 ${candidates.length} 个：${candidates.map((agent) => `${agent.code} ${agent.name}`).join('、')}。确认全部审核通过吗？`],
      quickActions: ['确认批量通过', '取消'],
    };
  }

  if (isPassAction && explicitAgents.length > 0) {
    const pendingDecision: AccessAuditPendingDecision = {
      codes: explicitAgents.map((agent) => agent.code),
      result: '审核通过',
      batch: explicitAgents.length > 1,
      overridePrecheck: explicitAgents.some((agent) => agent.precheck !== '建议通过'),
    };
    return {
      flow: { ...flow, step: 'n3', pendingDecision },
      replies: ['请确认以下智能体审核通过清单。确认后将完成批量审核通过。'],
      accessAuditConfirmation: { rows: explicitAgents, conclusion: '审核通过' },
    };
  }

  if (isRejectAction && explicitAgents.length > 0) {
    const pendingDecision: AccessAuditPendingDecision = {
      codes: explicitAgents.map((agent) => agent.code),
      result: '退回修改',
      batch: explicitAgents.length > 1,
      overridePrecheck: explicitAgents.some((agent) => agent.precheck !== '建议退回修改'),
    };
    return {
      flow: { ...flow, step: 'n3', pendingDecision },
      replies: ['请确认以下退回修改清单。预审建议退回的项目已自动填入具体说明；其余项目请填写具体说明后提交。'],
      accessAuditConfirmation: { rows: explicitAgents, conclusion: '退回修改' },
    };
  }

  const current = flow.selectedCode ? flow.agents.find((agent) => agent.code === flow.selectedCode) : undefined;
  if ((/完整详情|查看详情/.test(normalized)) && current) {
    return {
      flow: { ...flow, step: 'n3', viewedCodes: Array.from(new Set([...flow.viewedCodes, current.code])) },
      replies: [buildAccessAuditDetail(current, true)],
      quickActions: ['审核通过', '退回修改：补齐技术规格书并修复接口地址', '暂停审核'],
    };
  }
  if (/直接判断|你判断|能不能过|替我决定|自动裁决/.test(normalized)) {
    return {
      flow,
      replies: ['最终审核结论需由您做出，我不能代为裁决。我们先来完成智能体注册信息审核。\n\n您的结论是审核通过还是退回修改？'],
      quickActions: ['审核通过', '退回修改：补齐材料并修复联通测试'],
    };
  }
  if (/审核通过|通过/.test(normalized) && current) {
    const overridePrecheck = current.precheck !== '建议通过';
    const pendingDecision: AccessAuditPendingDecision = {
      codes: [current.code],
      result: '审核通过',
      overridePrecheck,
    };
    if (overridePrecheck) {
      return {
        flow: { ...flow, step: 'n3', pendingDecision },
        replies: [`该项预审结论为“${current.precheck}”，您的二次审核结论为“审核通过”，与预审不一致。请再次确认是否覆盖预审并审核通过？`],
        quickActions: ['确认覆盖预审并通过', '取消'],
      };
    }
    const applied = applyAccessAuditDecision(flow, pendingDecision, reviewer);
    return finishAccessAuditIfNeeded(applied.flow, [applied.receipt]);
  }
  if (/退回|驳回|修改/.test(normalized) && current) {
    const hasViewed = flow.viewedCodes.includes(current.code);
    if (!hasViewed) {
      return {
        flow: { ...flow, selectedCode: current.code, step: 'n2', viewedCodes: Array.from(new Set([...flow.viewedCodes, current.code])) },
        replies: [`退回修改必须先经专项查看，不能跳过。已为您展开 ${current.code} 的专项查看：\n\n${buildAccessAuditDetail(current)}`],
        quickActions: ['退回修改：补齐技术规格书并修复接口地址', '看完整详情', '审核通过'],
      };
    }
    const reasonMatch = normalized.match(/(?:退回修改|驳回|修改待修改说明|说明|原因)[:：]?\s*(.+)/);
    const reason = reasonMatch?.[1]?.trim();
    if (!reason || reason.length < 6) {
      return {
        flow: { ...flow, step: 'n3' },
        replies: ['退回修改需请您指明需整改的内容，方便申请人对齐。请补充“待修改说明”。'],
        quickActions: ['退回修改：补齐技术规格书 PDF，并修复接口地址后重新通过联通测试'],
      };
    }
    const pendingDecision: AccessAuditPendingDecision = {
      codes: [current.code],
      result: '退回修改',
      reason,
      overridePrecheck: current.precheck !== '建议退回修改',
    };
    if (pendingDecision.overridePrecheck) {
      return {
        flow: { ...flow, pendingDecision },
        replies: [`该项预审结论为“${current.precheck}”，您的二次审核结论为“退回修改”，与预审不一致。请确认是否覆盖预审并退回？`],
        quickActions: ['确认覆盖预审并退回', '取消'],
      };
    }
    const applied = applyAccessAuditDecision(flow, pendingDecision, reviewer);
    return finishAccessAuditIfNeeded(applied.flow, [applied.receipt]);
  }

  const agent = /下一条/.test(normalized)
    ? accessAuditPending(flow)[0]
    : locateAccessAuditAgent(flow, normalized);
  if (agent) {
    return {
      flow: {
        ...flow,
        step: agent.precheck === '建议退回修改' ? 'n2' : 'n3',
        selectedCode: agent.code,
        viewedCodes: agent.precheck === '建议退回修改' ? Array.from(new Set([...flow.viewedCodes, agent.code])) : flow.viewedCodes,
      },
      replies: [
        agent.precheck === '建议退回修改'
          ? buildAccessAuditDetail(agent)
          : `已锁定 ${agent.code} ${agent.name}。预审结论：${agent.precheck}（${agent.precheckSummary}）。\n\n请给出二次审核结论：审核通过 / 退回修改；如需复核资料，可说“看完整详情”。`,
      ],
      quickActions: agent.precheck === '建议退回修改'
        ? ['看完整详情', '退回修改：补齐技术规格书并修复接口地址', '审核通过']
        : ['审核通过', '看完整详情', '退回修改：补充备案材料'],
    };
  }

  return {
    flow,
    replies: [`请从待审核队列中选择对象，或执行可用批量操作：\n${formatAccessAuditQueue(flow)}`],
    quickActions: ['批量通过建议通过', '查看下一条', '暂停审核'],
  };
}

function getAccessAuditDoneReply(
  flow: AccessAuditFlow,
  text: string,
): {
  flow: AccessAuditFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  const quickActions = ['查看本次审核批次汇总', '跟进待办清单', '结束场景'];
  if (/汇总|批次/.test(normalized)) {
    return { flow, reply: buildAccessAuditSummary(flow), quickActions };
  }
  if (/待办|跟进/.test(normalized)) {
    return {
      flow,
      reply: buildAccessAuditTodo(flow),
      link: { to: '/app/agent-center?status=pending', text: '打开接入中心待审核队列' },
      quickActions,
    };
  }
  if (/结束|退出|完成/.test(normalized)) {
    return { flow, reply: '接入审核场景已结束。' };
  }
  return {
    flow,
    reply: '当前接入审核场景已收尾。仅支持：查看本次审核批次汇总、跟进待办清单、结束场景。',
    quickActions,
  };
}

const modelRegisterCatalog = [
  'Qwen / 通义千问（云端部署、混合部署）',
  'DeepSeek-R1（院内本地化部署）',
  '智谱 GLM（云端部署）',
  'Kimi 医疗文本模型（云端部署）',
  'minimax 医疗问答模型（混合部署）',
];

function buildResourceRegisterOpening(): string {
  const grouped = RESOURCE_CATALOG.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), `${item.code} ${item.name}`];
    return acc;
  }, {});
  const businessPreview = Object.entries(grouped)
    .slice(0, 5)
    .map(([group, items]) => `- ${group}：${items.slice(0, 5).join('、')}`)
    .join('\n');
  return `【业务系统数据资源列表】已弹出，以下为已支持注册的系统清单。
${businessPreview}
- 其他分类：护理业务系统、医技系统、药事管理系统、科研教学系统等，可输入缩写、别名或业务描述匹配。

【模型资源列表】已弹出，以下为已支持注册的模型清单。
${modelRegisterCatalog.map((item) => `- ${item}`).join('\n')}

你好！我是医小管。把资源信息文件发给我（支持 PDF、DOC、DOCX、XLSX、csv、jpg、jpeg、png、链接等任意文件格式），或文字、语音描述，我来帮你进行医院资源注册～

没找到？直接输入系统关键字（如缩写、别名、业务描述），我来帮你匹配`;
}

function maskSecret(secret = '') {
  void secret;
  return '********';
}

function getResourceRegisterCurrentQuestion(step: ResourceRegisterStep) {
  if (step === 'n1') return '请选择列表内资源，或直接输入系统关键字 / 上传资源信息文件。';
  if (step === 'n3') return '请继续补全当前资源注册信息。';
  if (step === 'n4') return '请按访问测试失败原因修正技术字段，我会自动重测。';
  if (step === 'n5') return '请核对汇总信息，无误请回复「提交」。';
  return '资源注册已完成。';
}

function matchResourceDrafts(text: string): ResourceRegisterDraft[] {
  const normalized = text.toLowerCase();
  const businessMatches = RESOURCE_CATALOG.filter((item) => {
    const target = `${item.code} ${item.name} ${item.group}`.toLowerCase();
    return target.includes(normalized) || normalized.includes(item.code.toLowerCase()) || normalized.includes(item.name.slice(0, 3).toLowerCase());
  }).slice(0, 5).map<ResourceRegisterDraft>((item) => ({
    kind: '业务系统数据资源',
    code: item.code,
    name: item.name,
    protocol: item.code === 'PACS' ? 'DICOM' : item.code === 'HIS' || item.code === 'EMR' ? 'HL7' : 'FHIR',
    protocolConfig: item.code === 'PACS'
      ? { DICOM名称: '', DICOMIP地址: '', DICOM端口: '' }
      : { URL地址: '', 密钥Key: '' },
    testStatus: '待测试',
  }));
  const modelMatches = modelRegisterCatalog.filter((item) => item.toLowerCase().includes(normalized) || /模型|qwen|千问|deepseek|kimi|minimax|智谱/i.test(text) && item.toLowerCase().includes(normalized.replace(/注册|接入|模型|大模型|\s/g, ''))).slice(0, 5).map<ResourceRegisterDraft>((item) => ({
    kind: '模型资源',
    code: item.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? 'MODEL',
    name: item.replace(/（.*?）/g, ''),
    deployMode: item.includes('本地') ? '本地化部署' : item.includes('混合') ? '混合部署' : '云端部署',
    testStatus: '待测试',
  }));
  return [...businessMatches, ...modelMatches].slice(0, 5);
}

function buildResourceMatchQuestion(drafts: ResourceRegisterDraft[]) {
  if (drafts.length === 1) return `您是要注册【${drafts[0].name}】吗？`;
  return `为您匹配到以下候选，请确认要注册哪一个：\n${drafts.map((draft, index) => `${index + 1}. ${draft.name}（${draft.kind}）`).join('\n')}`;
}

function defaultResourceRegisterDrafts(text: string): ResourceRegisterDraft[] {
  const onlyModel = /qwen|千问|模型|api/i.test(text) && !/pacs|dicom|放射|影像/i.test(text);
  const onlyPacs = /pacs|dicom|放射|影像/i.test(text) && !/qwen|千问|模型/i.test(text);
  const pacs: ResourceRegisterDraft = {
    kind: '业务系统数据资源',
    code: 'PACS',
    name: 'PACS（医学影像存档与通信系统）',
    owner: /李工|李慧敏/.test(text) ? '李工' : undefined,
    contact: /0571|座机/.test(text) ? '0571-88881234' : undefined,
    protocol: 'DICOM',
    protocolConfig: {
      DICOM名称: /PACS-AE/i.test(text) ? 'PACS-AE' : '',
      DICOMIP地址: /10\.10\.20\.8/.test(text) ? '10.10.20.8' : '10.10.20.5',
      DICOM端口: /11112/.test(text) ? '11112' : '',
    },
    testStatus: '待测试',
  };
  const qwen: ResourceRegisterDraft = {
    kind: '模型资源',
    code: 'QWEN',
    name: 'Qwen',
    modelVersion: /v?2/i.test(text) ? 'V2' : undefined,
    deployMode: /本地/.test(text) ? '本地化部署' : /混合/.test(text) ? '混合部署' : '云端部署',
    apiUrl: /https?:\/\/[^\s，,]+/i.exec(text)?.[0] ?? undefined,
    apiKeyMasked: /key|sk-|密钥/i.test(text) ? maskSecret() : undefined,
    testStatus: '待测试',
  };
  if (onlyModel) return [qwen];
  if (onlyPacs) return [pacs];
  return [pacs, qwen];
}

function formatRegisterDrafts(drafts: ResourceRegisterDraft[] = [], showMissing = true) {
  if (!drafts.length) return '暂无资源草稿。';
  return drafts
    .map((draft, index) => {
      if (draft.kind === '模型资源') {
        const missing = [
          !draft.modelVersion ? '模型版本' : '',
          !draft.apiUrl ? 'API 地址' : '',
          !draft.apiKeyMasked ? 'API key' : '',
        ].filter(Boolean);
        return `${index + 1}. 模型资源：${draft.name}${draft.modelVersion ? ` ${draft.modelVersion}` : ''}｜${draft.deployMode ?? '部署方式待确认'}｜API ${draft.apiUrl ?? '待补'}｜API key ${draft.apiKeyMasked ?? '待补'}｜测试：${draft.testStatus ?? '待测试'}${showMissing && missing.length ? `\n   缺失：${missing.join('、')}` : ''}`;
      }
      const cfg = draft.protocolConfig ?? {};
      const missing = [
        !draft.owner ? '资源负责人' : '',
        !draft.contact ? '联系方式' : '',
        !cfg.DICOM名称 ? 'DICOM 名称' : '',
        !cfg.DICOM端口 ? 'DICOM 端口' : '',
      ].filter(Boolean);
      return `${index + 1}. 业务系统数据资源：${draft.name}｜${draft.protocol ?? '对接方式待确认'}｜${cfg.DICOM名称 || 'DICOM名称待补'}｜${cfg.DICOMIP地址 || 'IP待补'}:${cfg.DICOM端口 || '端口待补'}｜负责人 ${draft.owner ?? '待补'}｜${draft.contact ?? '联系方式待补'}｜测试：${draft.testStatus ?? '待测试'}${showMissing && missing.length ? `\n   缺失：${missing.join('、')}` : ''}`;
    })
    .join('\n');
}

function patchRegisterSlotsFromText(slots: ResourceRegisterSlots, text: string): ResourceRegisterSlots {
  const drafts = (slots.drafts?.length ? slots.drafts : defaultResourceRegisterDrafts(text)).map((draft) => ({ ...draft, protocolConfig: { ...(draft.protocolConfig ?? {}) } }));
  const pacs = drafts.find((draft) => draft.code === 'PACS');
  const qwen = drafts.find((draft) => draft.code === 'QWEN');
  if (pacs) {
    if (/李工|李慧敏/.test(text)) pacs.owner = '李工';
    if (/0571|座机/.test(text)) pacs.contact = '0571-88881234';
    if (/PACS-AE/i.test(text)) pacs.protocolConfig = { ...(pacs.protocolConfig ?? {}), DICOM名称: 'PACS-AE' };
    const ip = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];
    if (ip) pacs.protocolConfig = { ...(pacs.protocolConfig ?? {}), DICOMIP地址: ip };
    const port = text.match(/\b(11112|104|6661|3306|9092)\b/)?.[0];
    if (port) pacs.protocolConfig = { ...(pacs.protocolConfig ?? {}), DICOM端口: port };
  }
  if (qwen) {
    if (/v?2/i.test(text)) qwen.modelVersion = 'V2';
    const url = text.match(/https?:\/\/[^\s，,]+/i)?.[0];
    if (url) qwen.apiUrl = url;
    if (/key|sk-|密钥|发你/.test(text)) qwen.apiKeyMasked = maskSecret();
  }
  return { ...slots, drafts };
}

function registerMissingFields(drafts: ResourceRegisterDraft[] = []) {
  return drafts.flatMap((draft) => {
    if (draft.kind === '模型资源') {
      return [
        !draft.modelVersion ? `${draft.name} 的模型版本` : '',
        !draft.apiUrl ? `${draft.name} 的 API 地址` : '',
        !draft.apiKeyMasked ? `${draft.name} 的 API key` : '',
      ].filter(Boolean);
    }
    const cfg = draft.protocolConfig ?? {};
    return [
      !draft.owner ? `${draft.code} 的资源负责人` : '',
      !draft.contact ? `${draft.code} 的联系方式` : '',
      !cfg.DICOM名称 ? `${draft.code} 的 DICOM 名称` : '',
      !cfg.DICOM端口 ? `${draft.code} 的 DICOM 端口` : '',
    ].filter(Boolean);
  });
}

function runRegisterAccessTest(slots: ResourceRegisterSlots): ResourceRegisterSlots {
  const drafts = (slots.drafts ?? []).map((draft) => ({ ...draft, protocolConfig: { ...(draft.protocolConfig ?? {}) } }));
  const pacs = drafts.find((draft) => draft.code === 'PACS');
  if (pacs) {
    const ip = pacs.protocolConfig?.DICOMIP地址;
    if (ip === '10.10.20.8') {
      pacs.testStatus = '通过';
      pacs.testMessage = 'C-ECHO 成功（120ms）';
    } else {
      pacs.testStatus = '失败';
      pacs.testMessage = 'C-ECHO 失败（超时），请核对 IP / 端口或网络';
    }
  }
  const qwen = drafts.find((draft) => draft.code === 'QWEN');
  if (qwen) {
    qwen.testStatus = qwen.apiUrl && qwen.apiKeyMasked ? '通过' : '失败';
    qwen.testMessage = qwen.testStatus === '通过' ? 'API 连通性成功（响应正常）' : 'API 地址或 API key 缺失';
  }
  const failedQwen = drafts.find((draft) => draft.kind === '模型资源' && draft.testStatus === '失败');
  return {
    ...slots,
    drafts,
    awaitingFix: failedQwen ? 'api-key' : drafts.some((draft) => draft.testStatus === '失败') ? 'pacs-ip' : undefined,
  };
}

function buildRegisterTestReport(slots: ResourceRegisterSlots) {
  return `信息齐了，自动访问测试中……
${(slots.drafts ?? []).map((draft, index) => `${index + 1}. ${draft.name}：${draft.testStatus === '通过' ? '成功' : '失败'}（${draft.testMessage ?? '待测试'}）`).join('\n')}`;
}

function buildRegisterSummary(slots: ResourceRegisterSlots) {
  return `【汇总确认】
请核对本次资源注册信息：
${formatRegisterDrafts(slots.drafts, false)}

全部访问测试均已通过。密钥 / AK/SK / API key 均以 ******** 密文保存与展示。

没问题就说「提交」；也可说「修改某项」或「暂存」。`;
}

function submitRegisteredResources(slots: ResourceRegisterSlots, creator?: string): ResourceRegisterSlots {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const receiptNo = `RES-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${(mockResources.length + 1).toString().padStart(4, '0')}`;
  const pacs = slots.drafts?.find((draft) => draft.code === 'PACS');
  if (pacs) {
    mockResources.unshift({
      id: receiptNo,
      resources: ['PACS'],
      owner: pacs.owner ?? '李工',
      contact: pacs.contact ?? '0571-88881234',
      protocol: 'DICOM',
      protocolConfig: {
        fields: [
          { label: 'DICOM 名称', value: pacs.protocolConfig?.DICOM名称 ?? 'PACS-AE' },
          { label: 'DICOM IP 地址', value: pacs.protocolConfig?.DICOMIP地址 ?? '10.10.20.8' },
          { label: 'DICOM 端口', value: pacs.protocolConfig?.DICOM端口 ?? '11112' },
        ],
      },
      status: 'registered',
      updatedAt: nowAt(),
      creator: creator ?? 'admin01',
    });
  }
  return { ...slots, receiptNo };
}

function buildRegisterSuccess(slots: ResourceRegisterSlots) {
  return `资源注册成功！

- 回执编号：${slots.receiptNo}
${(slots.drafts ?? []).map((draft) => `- ${draft.name}（${draft.kind}${draft.kind === '业务系统数据资源' ? `·${draft.protocol}` : `·${draft.deployMode}`}）：访问测试通过`).join('\n')}

资源已入库，后续智能体接入时可直接对接 / 调用引用。

收尾后仅开放动作：继续注册下一条资源、暂存草稿（保留 7 天）、资源入库供智能体接入时对接／调用引用。`;
}

function getResourceRegisterNext(
  flow: ResourceRegisterFlow,
  text: string,
  creator?: string,
): {
  flow: ResourceRegisterFlow;
  replies: string[];
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  let slots: ResourceRegisterSlots = { ...flow.slots };
  const yes = /^(是|对|确认|没错|正确|要|注册|确认注册|提交)[。！!.\s]*$/.test(normalized);
  const intent = /提交|确认|修改|改|暂存|先到这/.test(normalized) ? 'confirm_or_modify' : 'provide_or_complete';
  console.info('[home-resource-register-intent]', { intent, step: flow.step });
  if (/暂存|先到这|保存草稿/.test(normalized)) {
    return {
      flow: { ...flow, step: 'done', slots: { ...slots, draftSaved: true } },
      replies: ['已暂存草稿，保留 7 天。场景锁已释放，可从资源中心草稿继续完善。'],
      link: { to: '/app/resource-center/resources?tab=drafts', text: '查看资源草稿' },
      quickActions: ['继续注册下一条资源', '资源入库供智能体接入引用'],
    };
  }
  if (/天气|排班|工资|告警|报告/.test(normalized) && flow.step !== 'done') {
    slots.sidetrack = [...(slots.sidetrack ?? []), normalized];
    return {
      flow: { ...flow, slots },
      replies: [`我们先来完成医院资源注册，稍后再为您解决此问题\n\n当前问题：${getResourceRegisterCurrentQuestion(flow.step)}`],
    };
  }
  switch (flow.step) {
    case 'n1': {
      if (slots.pendingDrafts?.length) {
        if (/不是|不对|都不是|均不符|换一个/.test(normalized)) {
          const matchMissCount = (slots.matchMissCount ?? 0) + 1;
          if (matchMissCount >= 2) {
            return {
              flow: { ...flow, step: 'n1', slots: { ...slots, pendingDrafts: undefined, matchMissCount } },
              replies: ['目前平台仅支持列表内资源注册，暂不支持自定义资源；如确有需要请联系管理员登记扩展\n\n请在列表内挑选，或换一个系统关键字再试。'],
              quickActions: ['注册 PACS', '注册 HIS', '注册 Qwen 模型'],
            };
          }
          return {
            flow: { ...flow, step: 'n1', slots: { ...slots, pendingDrafts: undefined, matchMissCount } },
            replies: ['请再补充一个关键信息，例如分类、别名或所在科室，我再为您匹配一次。'],
          };
        }
        const index = normalized.match(/[1-5一二三四五]/)?.[0];
        const indexMap: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
        const selected = typeof index !== 'undefined' && indexMap[index] !== undefined
          ? [slots.pendingDrafts[indexMap[index]]].filter(Boolean)
          : yes || /确认|就是|要/.test(normalized)
            ? [slots.pendingDrafts[0]]
            : [];
        if (selected.length) {
          slots = { ...slots, drafts: selected, pendingDrafts: undefined, matchMissCount: 0 };
          return {
            flow: { ...flow, step: 'n3', slots },
            replies: [
              `已确认资源，开始生成注册草稿：\n${formatRegisterDrafts(slots.drafts)}`,
              `我们逐项补全缺失字段：${registerMissingFields(slots.drafts).join('、') || '暂无缺失字段'}。`,
            ],
            quickActions: ['负责人李工，联系方式 0571-88881234；DICOM 名称 PACS-AE，IP 10.10.20.8，端口 11112', 'API 地址 https://api.qwen.example/v2，key 已提供，版本 V2'],
          };
        }
      }
      const richInfo = /上传|文件|清单|负责人|联系方式|座机|电话|端口|IP|地址|api|key|密钥|DICOM|HL7|FHIR|数据库|MQ|部署|版本|走|https?:\/\//i.test(normalized);
      if (!richInfo) {
        const candidates = matchResourceDrafts(normalized);
        const matchMissCount = candidates.length ? 0 : (slots.matchMissCount ?? 0) + 1;
        if (!candidates.length && matchMissCount >= 2) {
          return {
            flow: { ...flow, step: 'n1', slots: { ...slots, matchMissCount } },
            replies: ['目前平台仅支持列表内资源注册，暂不支持自定义资源；如确有需要请联系管理员登记扩展\n\n请在列表内挑选，或换一个系统关键字再试。'],
            quickActions: ['注册 PACS', '注册 HIS', '注册 Qwen 模型'],
          };
        }
        if (!candidates.length) {
          return {
            flow: { ...flow, step: 'n1', slots: { ...slots, matchMissCount } },
            replies: ['没匹配到列表内资源。请补充分类、别名或所在科室，我再匹配一次。'],
            quickActions: ['PACS', 'HIS', 'Qwen 模型'],
          };
        }
        return {
          flow: { ...flow, step: 'n1', slots: { ...slots, pendingDrafts: candidates, matchMissCount } },
          replies: [buildResourceMatchQuestion(candidates)],
          quickActions: candidates.map((draft, index) => `${index + 1}. 确认注册 ${draft.name}`).slice(0, 5),
        };
      }
      slots = patchRegisterSlotsFromText({ ...slots, materials: [...(slots.materials ?? []), normalized] }, normalized);
      return {
        flow: { ...flow, step: 'n3', slots },
        replies: [
          `已接收材料 / 描述，基础校验通过。\n\n识别到 ${slots.drafts?.length ?? 0} 条资源，已完成类型判定与字段回填：\n${formatRegisterDrafts(slots.drafts)}`,
          `我们逐项补全缺失字段：${registerMissingFields(slots.drafts).join('、') || '暂无缺失字段'}。`,
        ],
        quickActions: ['名称 PACS-AE，端口 11112；负责人李工，联系方式用他座机 0571-88881234；Qwen 版本 V2，API 地址 https://api.qwen.example/v2，key 已提供'],
      };
    }
    case 'n3': {
      slots = patchRegisterSlotsFromText(slots, normalized);
      const missing = registerMissingFields(slots.drafts);
      if (missing.length) {
        return {
          flow: { ...flow, step: 'n3', slots },
          replies: [`还缺：${missing.join('、')}。\n\n请继续补充。密钥 / 凭据类字段会密文保存，不会在对话和汇总中明文回显。`],
        };
      }
      const tested = runRegisterAccessTest(slots);
      const failed = tested.drafts?.filter((draft) => draft.testStatus === '失败') ?? [];
      return {
        flow: { ...flow, step: failed.length ? 'n4' : 'n5', slots: tested },
        replies: [buildRegisterTestReport(tested), failed.length ? '存在访问测试未通过项，请按失败原因修正后我会自动重测。' : buildRegisterSummary(tested)],
        quickActions: failed.length ? ['PACS 的 IP 应该是 10.10.20.8，改一下重测', '暂存草稿'] : ['提交', '暂存草稿'],
      };
    }
    case 'n4': {
      slots = patchRegisterSlotsFromText(slots, normalized);
      const tested = runRegisterAccessTest(slots);
      const failed = tested.drafts?.filter((draft) => draft.testStatus === '失败') ?? [];
      return {
        flow: { ...flow, step: failed.length ? 'n4' : 'n5', slots: tested },
        replies: [
          failed.length ? buildRegisterTestReport(tested) : `已更新并重测：\n${buildRegisterTestReport(tested)}\n\n${buildRegisterSummary(tested)}`,
        ],
        quickActions: failed.length ? ['PACS 的 IP 应该是 10.10.20.8，改一下重测', '暂存草稿'] : ['提交', '暂存草稿'],
      };
    }
    case 'n5': {
      if (/修改|改/.test(normalized) && !/提交/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'n3', slots },
          replies: ['可以，已回到字段补全节点。请说明要修改的字段；技术字段或 API 信息变更后我会自动重跑访问测试，并回到汇总确认。'],
        };
      }
      if (/提交|确认|没问题|无误|入库/.test(normalized)) {
        const submitted = submitRegisteredResources(slots, creator);
        return {
          flow: { ...flow, step: 'done', slots: submitted },
          replies: [buildRegisterSuccess(submitted)],
          link: { to: '/app/resource-center/resources', text: '查看资源库' },
          quickActions: ['继续注册下一条资源', '暂存草稿（保留 7 天）', '资源入库供智能体接入引用'],
        };
      }
      return {
        flow,
        replies: [buildRegisterSummary(slots)],
        quickActions: ['提交', '暂存草稿'],
      };
    }
    default:
      return { flow, replies: ['资源注册已完成。'] };
  }
}

function getResourceRegisterDoneReply(
  flow: ResourceRegisterFlow,
  text: string,
): {
  flow: ResourceRegisterFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  if (/继续|下一条|再注册/.test(normalized)) {
    return {
      flow: { ...flow, step: 'n1', slots: {} },
      reply: buildResourceRegisterOpening(),
      quickActions: ['上传资源清单.xlsx：放射 PACS 走 DICOM，再加 Qwen 大模型，云端部署', '注册 Qwen 模型'],
    };
  }
  if (/暂存|草稿/.test(normalized)) {
    return {
      flow: { ...flow, slots: { ...flow.slots, draftSaved: true } },
      reply: '已暂存草稿，保留 7 天。当前资源注册场景已收尾。',
      link: { to: '/app/resource-center/resources?tab=drafts', text: '查看资源草稿' },
    };
  }
  if (/入库|资源库|引用|对接|调用/.test(normalized)) {
    return {
      flow,
      reply: '已入库资源可在智能体接入注册、资源申请和运行调用配置中被引用。业务系统按对接方式对接，模型资源按 API 地址与密钥调用。',
      link: { to: '/app/resource-center/resources', text: '查看资源库' },
      quickActions: ['继续注册下一条资源', '暂存草稿（保留 7 天）'],
    };
  }
  return {
    flow,
    reply: '资源注册已收尾。当前仅开放动作：继续注册下一条资源、暂存草稿（保留 7 天）、资源入库供智能体接入时对接／调用引用。',
    quickActions: ['继续注册下一条资源', '暂存草稿（保留 7 天）', '资源入库供智能体接入引用'],
  };
}

function buildResourceOpening(): string {
  return `【可申请资源列表】已弹出。

你好，我是医小管。你只需要告诉我要为哪个智能体申请什么资源，我将为你自动申请。

当前可申请资源：
- 业务系统数据资源：HIS、EMR、LIS、PACS、UIS、CDR、ODR、BI、EDW、PASS、PIVAS、EMPI 等已注册资源
- 模型资源：Qwen（V2·云端部署）、DeepSeek-R1（院内部署）、通义千问医疗增强版

先告诉我要为哪个智能体申请资源。`;
}

const modelResourceOptions: ResourceOption[] = [
  { code: 'QWEN', name: 'Qwen（V2·云端部署）', type: '模型资源', resourceId: 'M-QWEN', status: 'registered' },
  { code: 'DEEPSEEK', name: 'DeepSeek-R1（院内部署）', type: '模型资源', resourceId: 'M-DEEPSEEK', status: 'registered' },
  { code: 'TONGYI-MED', name: '通义千问医疗增强版', type: '模型资源', resourceId: 'M-TONGYI-MED', status: 'registered' },
];

function businessResourceOptions(): ResourceOption[] {
  const registeredCodes = new Set(mockResources.filter((r) => r.status === 'registered').flatMap((r) => r.resources));
  return RESOURCE_CATALOG.filter((r) => registeredCodes.has(r.code)).map((r) => ({
    code: r.code,
    name: r.name,
    type: '业务系统数据资源' as const,
    resourceId: mockResources.find((item) => item.resources.includes(r.code))?.id ?? r.code,
    status: 'registered' as const,
  }));
}

function allResourceOptions(): ResourceOption[] {
  return [...businessResourceOptions(), ...modelResourceOptions];
}

function findAgentByText(text: string) {
  const normalized = text.toLowerCase();
  const aliasAgent = /糖尿病|随访管理/.test(text)
    ? {
        id: 'XNK-0001',
        name: '糖尿病随访管理助手',
        dept: '0503-内分泌科',
        stage: '其他（出院后随访管理）',
        applicant: '李秀英',
        description: '面向出院及门诊糖尿病患者提供随访服务，读取患者基础信息、诊疗记录、检验指标与随访计划，自动生成随访任务、健康提醒与异常风险提示。',
      }
    : null;
  if (aliasAgent) return aliasAgent;
  return resourceCenterAgents.find((agent) => {
    const target = `${agent.id} ${agent.name} ${agent.dept}`.toLowerCase();
    return target.includes(normalized) || normalized.includes(agent.id.toLowerCase()) || normalized.includes(agent.name.toLowerCase().slice(0, 6));
  });
}

function matchResources(text: string): { matched: ResourceOption[]; unregistered: string[] } {
  const options = allResourceOptions();
  const normalized = text.toUpperCase();
  const matched = options.filter((item) => {
    const plainName = item.name.toUpperCase();
    return normalized.includes(item.code) || normalized.includes(plainName) || plainName.includes(normalized);
  });
  const aliases: [RegExp, string][] = [
    [/千问|QWEN/i, 'QWEN'],
    [/DEEPSEEK|DEEPSEEK-R1|R1/i, 'DEEPSEEK'],
    [/通义/i, 'TONGYI-MED'],
  ];
  aliases.forEach(([reg, code]) => {
    const option = options.find((item) => item.code === code);
    if (option && reg.test(text) && !matched.some((item) => item.code === code)) matched.push(option);
  });
  const knownCodes = new Set(RESOURCE_CATALOG.map((r) => r.code).concat(modelResourceOptions.map((r) => r.code)));
  const upperTokens = Array.from(text.matchAll(/\b[A-Z][A-Z0-9-]{1,12}\b/gi)).map((m) => m[0].toUpperCase());
  const unregistered = upperTokens.filter((token) => !matched.some((item) => item.code === token) && !knownCodes.has(token));
  return { matched: dedupeResources(matched), unregistered };
}

function dedupeResources(resources: ResourceOption[]): ResourceOption[] {
  return resources.filter((item, index, arr) => arr.findIndex((r) => r.code === item.code) === index);
}

function formatAgent(agent: NonNullable<ResourceApplySlots['agent']>) {
  return `编号 ${agent.id}｜名称 ${agent.name}｜所属科室 ${agent.dept}｜诊疗环节 ${agent.stage}｜功能描述 ${agent.description}`;
}

function formatResources(resources: ResourceOption[] = []) {
  if (resources.length === 0) return '待选择';
  const business = resources.filter((r) => r.type === '业务系统数据资源');
  const models = resources.filter((r) => r.type === '模型资源');
  return [
    business.length ? `业务系统数据资源：${business.map((r) => r.name).join('、')}` : '',
    models.length ? `模型资源：${models.map((r) => r.name).join('、')}` : '',
  ].filter(Boolean).join('\n');
}

function buildResourceSummary(slots: ResourceApplySlots): string {
  const agent = slots.agent;
  return `【汇总回执消息】请核对：

- 申请智能体：${agent ? `${agent.id} ${agent.name}（${agent.dept}｜诊疗环节：${agent.stage}）` : '待确认'}
- 功能描述：${agent?.description ?? '待确认'}
- 申请资源名称：
${formatResources(slots.resources)}

没问题就说「提交申请」；要改资源直接说「改资源」。`;
}

function buildReceipt(slots: ResourceApplySlots): string {
  return `【提交结果消息】已提交！

- 申请单号：${slots.receiptNo}
- 智能体：${slots.agent?.id} ${slots.agent?.name}
- 申请资源：${(slots.resources ?? []).map((r) => r.name).join('、')}
- 状态：待审核

申请已进入管理员审批流程《资源申请审核》。通过后即授予该智能体对接 / 调用这些资源的权限。

后续仅开放三个动作：查看申请单回执、修改资源重选、暂存草稿并释放场景锁。`;
}

function submitResourceApply(slots: ResourceApplySlots, applicantName?: string): ResourceApplySlots {
  const applies = getApplies();
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const receiptNo = `REQ-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${(applies.length + 1).toString().padStart(4, '0')}`;
  const legacyId = `A-${date.getFullYear()}-${(applies.length + 1).toString().padStart(4, '0')}`;
  const resources = slots.resources ?? [];
  const agent = slots.agent;
  if (agent) {
    const item: ApplyItem = {
      id: legacyId,
      agentId: agent.id,
      agentName: agent.name,
      department: agent.dept,
      stage: agent.stage,
      description: agent.description,
      resourceId: resources.map((r) => r.resourceId).join('/'),
      resourceName: resources.map((r) => r.code).join('/'),
      status: 'pending',
      applicant: applicantName ?? 'admin',
      applicantAccount: 'admin01',
      submittedAt: nowAt(),
      trail: [{ action: '提交', operator: applicantName ?? 'admin', at: nowAt(), status: 'process', targetStatus: 'pending' }],
    };
    addApply(item);
  }
  return { ...slots, receiptNo };
}

function getResourceApplyNext(
  flow: ResourceApplyFlow,
  text: string,
  applicantName?: string,
): {
  flow: ResourceApplyFlow;
  replies: string[];
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  const yes = /确认|对|是|可以|没问题|好|就这|就用|提交/.test(normalized);
  const slots: ResourceApplySlots = { ...flow.slots };

  if (/先不提交|暂存|保存草稿/.test(normalized)) {
    return {
      flow: { ...flow, step: 'done', slots: { ...slots, draftSaved: true } },
      replies: ['已暂存草稿并释放场景锁。后续可从「医院资源管理中心 / 申请管理 / 草稿」继续处理。'],
      link: { to: '/app/resource-center/applies?tab=draft', text: '查看草稿' },
    };
  }

  if (/排班|告警|报告|上次|通过没|天气|新闻/.test(normalized) && flow.step !== 'n3') {
    slots.sidetrack = [...(slots.sidetrack ?? []), normalized];
    return {
      flow: { ...flow, slots },
      replies: ['我们先来完成资源使用权限申请，稍后再为您解决此问题。\n\n请继续确认当前资源申请信息。'],
    };
  }

  switch (flow.step) {
    case 'n1': {
      const agent = findAgentByText(normalized);
      if (!agent) {
        return {
          flow,
          replies: ['没有在本人权限范围内找到该智能体。申请人只能为本科室已纳管智能体发起申请，请换一个智能体名称或编号。'],
          quickActions: ['糖尿病随访管理助手', '智能导诊助手 v2.3', '心血管随访助手 v1.2'],
        };
      }
      slots.agent = agent;
      const { matched } = matchResources(normalized);
      if (matched.length) slots.pendingResources = matched;
      return {
        flow: { ...flow, step: matched.length ? 'n2' : 'n2', slots },
        replies: [
          `【智能体只读信息消息】找到它了，信息如下（只读）：${formatAgent(agent)}

本场景只读带出、不可修改。确认是给它申请吗？要申请使用哪些资源？`,
          ...(matched.length ? [`我同时识别到资源候选：\n${formatResources(matched)}\n\n就申请这些吗？`] : []),
        ],
        quickActions: matched.length ? ['确认', '改资源'] : ['HIS、LIS、Qwen', 'HIS、EMR', 'PACS、DeepSeek-R1'],
      };
    }
    case 'n2': {
      if (/修改智能体|改智能体|换个智能体/.test(normalized)) {
        return {
          flow: { ...flow, step: 'n1', slots: { resources: slots.resources } },
          replies: ['可以，请重新告诉我要为哪个本科室已纳管智能体申请资源。'],
          quickActions: ['糖尿病随访管理助手', '智能导诊助手 v2.3'],
        };
      }
      const explicitResources = matchResources(normalized);
      const resources = explicitResources.matched.length ? explicitResources.matched : slots.pendingResources ?? slots.resources ?? [];
      if (!resources.length) {
        return {
          flow: { ...flow, step: 'n2', slots },
          replies: ['还没有匹配到已注册成功的资源。请按资源名称、缩写或类型描述，例如 HIS、LIS、Qwen。'],
          quickActions: ['HIS、LIS、Qwen', 'HIS、EMR', 'PACS、DeepSeek-R1'],
        };
      }
      const unregisteredMsg = explicitResources.unregistered.length
        ? `\n\n${explicitResources.unregistered.map((r) => `该资源（${r}）尚未注册成功，需先在《医院资源注册管理》中登记；本次可先选其它已注册资源。`).join('\n')}`
        : '';
      if (!yes && explicitResources.matched.length) {
        slots.pendingResources = resources;
        return {
          flow: { ...flow, step: 'n2', slots },
          replies: [`【资源候选消息】已从已注册资源列表匹配到：\n${formatResources(resources)}${unregisteredMsg}\n\n就申请这些吗？`],
          quickActions: ['确认', '改资源'],
        };
      }
      slots.resources = resources;
      slots.pendingResources = undefined;
      return {
        flow: { ...flow, step: 'n3', slots },
        replies: [buildResourceSummary(slots)],
        quickActions: ['提交申请', '改资源', '暂存草稿'],
      };
    }
    case 'n3': {
      if (/改资源|修改资源|重选|换资源/.test(normalized)) {
        return {
          flow: { ...flow, step: 'n2', slots: { ...slots, resources: undefined, pendingResources: undefined } },
          replies: ['好的，回到资源选择。请重新说出要申请的资源名称，可跨业务系统数据资源和模型资源多选。'],
          quickActions: ['HIS、LIS、Qwen', 'HIS、EMR', 'PACS、DeepSeek-R1'],
        };
      }
      if (/修改智能体|编号|科室|诊疗环节|功能描述/.test(normalized) && !/提交/.test(normalized)) {
        return {
          flow,
          replies: ['智能体编号、名称、科室、诊疗环节、功能描述在本场景只读带出、不可修改；需修改请到智能体注册管理。\n\n资源申请信息无误请回复「提交申请」。'],
          quickActions: ['提交申请', '改资源', '暂存草稿'],
        };
      }
      if (/提交|确认|没问题|无误/.test(normalized)) {
        const submittedSlots = submitResourceApply(slots, applicantName);
        return {
          flow: { ...flow, step: 'done', slots: submittedSlots },
          replies: [buildReceipt(submittedSlots)],
          link: { to: '/app/resource-center/applies?tab=pending', text: '查看资源申请审核' },
          quickActions: ['查看申请单回执', '修改资源重选', '暂存草稿并释放场景锁'],
        };
      }
      return {
        flow,
        replies: ['请核对汇总信息。没问题就说「提交申请」；要改资源直接说「改资源」；也可以说「暂存」。'],
        quickActions: ['提交申请', '改资源', '暂存草稿'],
      };
    }
    default:
      return {
        flow,
        replies: ['资源申请已完成。'],
      };
  }
}

function getResourceApplyDoneReply(
  flow: ResourceApplyFlow,
  text: string,
): {
  flow: ResourceApplyFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  if (/回执|查看申请单|申请单/.test(normalized)) {
    return {
      flow,
      reply: buildReceipt(flow.slots),
      link: { to: '/app/resource-center/applies?tab=pending', text: '查看资源申请审核' },
      quickActions: ['查看申请单回执', '修改资源重选', '暂存草稿并释放场景锁'],
    };
  }
  if (/修改资源|改资源|重选/.test(normalized)) {
    return {
      flow: { ...flow, step: 'n2', slots: { ...flow.slots, resources: undefined, pendingResources: undefined, receiptNo: undefined } },
      reply: '好的，回到 N2 资源重选。请重新说出要申请的资源名称。',
      quickActions: ['HIS、LIS、Qwen', 'HIS、EMR', 'PACS、DeepSeek-R1'],
    };
  }
  if (/暂存|释放/.test(normalized)) {
    return {
      flow: { ...flow, slots: { ...flow.slots, draftSaved: true } },
      reply: '已暂存草稿并释放场景锁。当前资源申请场景已收尾。',
      link: { to: '/app/resource-center/applies?tab=draft', text: '查看草稿' },
    };
  }
  return {
    flow,
    reply: '资源申请已收尾。当前仅支持：查看申请单回执、修改资源重选、暂存草稿并释放场景锁。',
    quickActions: ['查看申请单回执', '修改资源重选', '暂存草稿并释放场景锁'],
  };
}

function resourceAuditPendingApplies() {
  return getApplies()
    .filter((item) => item.status === 'pending')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

function createResourceAuditFlow(sessionId: string): ResourceAuditFlow {
  return {
    sessionId,
    step: 'n1',
    queueIds: resourceAuditPendingApplies().map((item) => item.id),
    reviewedIds: [],
    records: [],
  };
}

function availableResourceAuditApplies(flow: ResourceAuditFlow) {
  const reviewed = new Set(flow.reviewedIds);
  return getApplies().filter((item) => flow.queueIds.includes(item.id) && item.status === 'pending' && !reviewed.has(item.id));
}

function getResourceAuditApply(id?: string) {
  if (!id) return undefined;
  return getApplies().find((item) => item.id === id);
}

function buildResourceAuditOpening(flow: ResourceAuditFlow) {
  const pending = availableResourceAuditApplies(flow);
  const list = pending.length
    ? pending
        .map((item, index) => `${index + 1}. ${item.agentId} ${item.agentName}｜申请资源：${item.resourceName}`)
        .join('\n')
    : '暂无待审核资源使用权限申请。';
  return `你好，我是医小管。目前资源申请待审核 ${pending.length} 项。

${list}

请告诉我要看哪条，例如「看第一条」或直接说智能体编号/名称。`;
}

function locateResourceAuditApply(flow: ResourceAuditFlow, text: string) {
  const pending = availableResourceAuditApplies(flow);
  const normalized = text.trim();
  const orderMap: Array<[RegExp, number]> = [
    [/第?一|1|首个|第一个/, 0],
    [/第?二|2|第二个/, 1],
    [/第?三|3|第三个/, 2],
    [/第?四|4|第四个/, 3],
    [/第?五|5|第五个/, 4],
  ];
  const byOrder = orderMap.find(([pattern, index]) => pattern.test(normalized) && pending[index]);
  if (byOrder) return pending[byOrder[1]];
  return pending.find((item) =>
    normalized.includes(item.id) ||
    normalized.includes(item.agentId) ||
    normalized.includes(item.agentName) ||
    normalized.includes(item.department.replace(/^[A-Z]+-/, '')) ||
    normalized.includes(item.resourceName),
  );
}

function resourceAuditCheckHints(item: ApplyItem) {
  const registeredCodes = new Set(mockResources.filter((r) => r.status === 'registered').flatMap((r) => r.resources));
  const requestedCodes = item.resourceName.split(/[、/]/).map((name) => name.trim()).filter(Boolean);
  const missing = requestedCodes.filter((code) => !registeredCodes.has(code) && !/^Qwen|DeepSeek|通义/.test(code));
  const duplicate = getApplies().some((apply) =>
    apply.id !== item.id &&
    apply.agentId === item.agentId &&
    apply.status === 'approved' &&
    apply.resourceName === item.resourceName,
  );
  const relevance = /随访|导诊|分诊|审方|用药|阅片|影像|急诊|麻醉|诊断/.test(item.description)
    ? '功能描述与申请资源存在业务相关性，请重点核对读写范围'
    : '功能与资源相关性需人工复核';
  return [
    missing.length ? `存在未注册或未匹配资源：${missing.join('、')}` : '申请资源均已注册可用或为模型资源',
    duplicate ? '发现同智能体同资源已存在通过记录，请谨慎避免重复授权' : '未发现重复授权记录',
    relevance,
    /写入|写/.test(item.resourceName + item.description) ? '涉及写入/调用范围，请确认最小必要权限' : '当前描述未发现高风险写入权限',
  ];
}

function buildResourceAuditPresentation(item: ApplyItem) {
  return `【N1 选定与信息呈报】${item.id} 权限申请信息（只读）：

- 智能体编号：${item.agentId}
- 智能体名称：${item.agentName}
- 所属科室：${item.department}
- 诊疗环节：${item.stage}
- 功能描述：${item.description}
- 申请资源名称：${item.resourceName}

基础核对提示：
${resourceAuditCheckHints(item).map((hint) => `- ${hint}`).join('\n')}

以上信息本场景只读、不可修改。您的审核结论是：审核通过 / 退回修改？`;
}

function parseResourceAuditConclusion(text: string): '审核通过' | '退回修改' | undefined {
  if (/退回|驳回|不通过|修改/.test(text)) return '退回修改';
  if (/审核通过|通过|同意|准予|批准/.test(text)) return '审核通过';
  return undefined;
}

function extractResourceAuditComment(text: string) {
  if (/^(审核通过|通过|同意|退回修改|退回|驳回|提交|确认|不填|直接提交)[。.!！]?$/.test(text.trim())) return '';
  return text
    .replace(/^退回原因[:：]?/g, '')
    .replace(/^具体说明[:：]?/g, '')
    .replace(/^加一句[:：]?/g, '')
    .replace(/^说明[:：]?/g, '')
    .trim();
}

function defaultResourceAuditComment(conclusion: '审核通过' | '退回修改') {
  return conclusion === '审核通过' ? '权限范围合理，准予按申请资源范围使用。' : '';
}

function buildResourceAuditSummary(flow: ResourceAuditFlow) {
  const approved = flow.records.filter((record) => record.conclusion === '审核通过').length;
  const rejected = flow.records.filter((record) => record.conclusion === '退回修改').length;
  const unhandled = availableResourceAuditApplies(flow).length;
  return `本批次汇总：审核通过 ${approved} 条、退回修改 ${rejected} 条、未处理 ${unhandled} 条。`;
}

function finalizeResourceAudit(
  flow: ResourceAuditFlow,
  reviewerName?: string,
): { flow: ResourceAuditFlow; reply: string; link?: { to: string; text: string }; quickActions?: string[] } {
  const item = getResourceAuditApply(flow.selectedApplyId);
  if (!item || !flow.conclusion) {
    return { flow, reply: '还没有选定唯一待审申请或审核结论，请先完成 N1/N2。' };
  }

  const reviewer = reviewerName ?? '王主任';
  const time = nowAt().slice(0, 16);
  const comment = (flow.comment ?? defaultResourceAuditComment(flow.conclusion)).trim();
  const approved = flow.conclusion === '审核通过';
  updateApply(item.id, {
    status: approved ? 'approved' : 'rejected',
    approvedAt: approved ? nowAt() : undefined,
    rejectedAt: approved ? undefined : nowAt(),
    approveComment: approved ? comment : undefined,
    rejectReason: approved ? undefined : comment,
    appendTrail: {
      action: flow.conclusion,
      operator: reviewer,
      at: nowAt(),
      comment: comment || (approved ? '权限范围合理，审核通过' : ''),
      status: approved ? 'finish' : 'error',
      targetStatus: approved ? 'approved' : 'rejected',
    },
  });

  const record: ResourceAuditRecord = {
    applyId: item.id,
    agentId: item.agentId,
    agentName: item.agentName,
    resourceName: item.resourceName,
    conclusion: flow.conclusion,
    comment,
    reviewer,
    time,
  };
  const nextFlowBase: ResourceAuditFlow = {
    ...flow,
    reviewedIds: [...flow.reviewedIds, item.id],
    records: [...flow.records, record],
    selectedApplyId: undefined,
    conclusion: undefined,
    comment: undefined,
  };
  const remaining = availableResourceAuditApplies(nextFlowBase).length;
  const nextFlow: ResourceAuditFlow = { ...nextFlowBase, step: remaining > 0 ? 'n1' : 'done' };
  const syncLabel = approved ? '具体说明' : '退回原因说明';
  const resultText = approved
    ? `已通过并生效：授予 ${item.agentId} 对 ${item.resourceName} 的对接/调用权限；${syncLabel}已同步用户端。`
    : `已退回修改：${item.id} 已退回申请人；${syncLabel}已同步用户端。`;
  const reply = `${resultText}

审核人：${reviewer}，时间：${time}，已通知申请人。${remaining > 0 ? `剩余 ${remaining} 条。` : '待审已清空。'}`;

  if (remaining > 0) {
    return {
      flow: nextFlow,
      reply: `${reply}\n\n请继续选择下一条审核，或暂停并保存进度。`,
      link: { to: '/app/resource-center/applies?tab=approved', text: '查看资源审核记录' },
      quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
    };
  }
  return {
    flow: nextFlow,
    reply: `${reply}\n\n${buildResourceAuditSummary(nextFlow)}\n\n本次审核到此结束。后续仅开放：继续审核下一条、暂停并保存进度、查看本批次汇总。`,
    link: { to: '/app/resource-center/applies?tab=approved', text: '查看资源审核记录' },
    quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
  };
}

function getResourceAuditNext(
  flow: ResourceAuditFlow,
  text: string,
  reviewerName?: string,
): {
  flow: ResourceAuditFlow;
  replies: string[];
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  if (/暂停|先停|稍后|保存进度/.test(normalized)) {
    return {
      flow: { ...flow, step: 'done', paused: true },
      replies: [`已暂停并保存进度。未决项保持「待审核」状态，场景锁已释放。\n\n${buildResourceAuditSummary(flow)}`],
      quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
    };
  }
  if (/汇总|批次/.test(normalized)) {
    return {
      flow,
      replies: [buildResourceAuditSummary(flow)],
      quickActions: ['继续审核下一条', '暂停并保存进度'],
    };
  }

  switch (flow.step) {
    case 'n1': {
      const queue = availableResourceAuditApplies(flow);
      if (/继续|下一条/.test(normalized) && queue.length === 0) {
        return {
          flow: { ...flow, step: 'done' },
          replies: ['当前资源申请待审队列为空。后续仅开放：继续审核下一条、暂停并保存进度、查看本批次汇总。'],
          quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
        };
      }
      const item = locateResourceAuditApply(flow, normalized) ?? (/继续|下一条/.test(normalized) ? queue[0] : undefined);
      if (!item) {
        return {
          flow,
          replies: [`请先选定一条待审资源申请。\n\n${buildResourceAuditOpening(flow)}`],
          quickActions: ['看第一条', '暂停并保存进度', '查看本批次汇总'],
        };
      }
      return {
        flow: { ...flow, step: 'n2', selectedApplyId: item.id },
        replies: [buildResourceAuditPresentation(item)],
        link: { to: `/app/resource-center/approval/${item.id}`, text: '打开权限审批页' },
        quickActions: ['审核通过', '退回修改'],
      };
    }
    case 'n2': {
      const item = getResourceAuditApply(flow.selectedApplyId);
      if (!item) return { flow: { ...flow, step: 'n1' }, replies: ['当前选定项已失效，请重新选择待审申请。'] };
      if (/修改.*(申请|资源|智能体|科室|描述)|编辑/.test(normalized)) {
        return {
          flow,
          replies: ['权限申请信息均为只读引用，医小管不能修改申请内容；如需修改，请退回申请人重新提交。\n\n请给出审核结论：审核通过 / 退回修改。'],
          quickActions: ['审核通过', '退回修改'],
        };
      }
      if (/台账|告警|今天|排班|报告|天气|新闻/.test(normalized)) {
        return {
          flow,
          replies: [`我们先来完成资源使用权限审核，稍后再为您解决此问题。\n\n${buildResourceAuditPresentation(item)}`],
          quickActions: ['审核通过', '退回修改'],
        };
      }
      const conclusion = parseResourceAuditConclusion(normalized);
      if (!conclusion) {
        return {
          flow,
          replies: ['请给出审核结论：审核通过 / 退回修改。结论必须由管理员做出，医小管不会代为裁决。'],
          quickActions: ['审核通过', '退回修改'],
        };
      }
      if (conclusion === '退回修改') {
        return {
          flow: { ...flow, step: 'n3', conclusion, comment: extractResourceAuditComment(normalized) },
          replies: ['选择退回修改，需要填写退回原因（具体说明，必填，≤500 字）。请说明。'],
          quickActions: ['退回原因：申请资源范围过大，请缩小到最小必要权限后重新提交审核'],
        };
      }
      return {
        flow: { ...flow, step: 'n3', conclusion, comment: extractResourceAuditComment(normalized) },
        replies: ['审核通过。具体说明为选填，需要补充吗？不填我就直接提交。'],
        quickActions: ['不填，直接提交', '加一句：仅限当前诊疗场景按最小必要权限调用'],
      };
    }
    case 'n3': {
      const item = getResourceAuditApply(flow.selectedApplyId);
      if (!item || !flow.conclusion) return { flow: { ...flow, step: 'n1' }, replies: ['当前审核上下文已失效，请重新选择待审申请。'] };
      const isConfirm = /确认|提交|生效|不填|直接|没问题|就这样/.test(normalized);
      if (/修改|改成|改为/.test(normalized)) {
        const comment = extractResourceAuditComment(normalized.replace(/^修改(一下)?(退回原因|具体说明)?[:：]?/, ''));
        const nextComment = comment || flow.comment || '';
        return {
          flow: { ...flow, comment: nextComment.slice(0, 500) },
          replies: [`已更新具体说明：「${nextComment.slice(0, 500) || '无补充说明'}」（${nextComment.slice(0, 500).length}/500）。确认提交吗？`],
          quickActions: ['确认提交', '重新修改具体说明'],
        };
      }
      const comment = extractResourceAuditComment(normalized);
      const nextComment = !isConfirm && comment ? comment.slice(0, 500) : flow.comment;
      if (flow.conclusion === '退回修改' && !nextComment) {
        return {
          flow: { ...flow, comment: nextComment },
          replies: ['退回修改必须填写退回原因方可提交，请先告诉我退回原因。'],
          quickActions: ['退回原因：申请资源范围过大，请缩小到最小必要权限后重新提交审核'],
        };
      }
      if (!isConfirm && comment) {
        return {
          flow: { ...flow, comment: nextComment },
          replies: [`已记录具体说明：「${nextComment}」（${nextComment.length}/500）。确认提交吗？`],
          quickActions: ['确认提交', '修改具体说明'],
        };
      }
      const final = finalizeResourceAudit({ ...flow, comment: nextComment }, reviewerName);
      return {
        flow: final.flow,
        replies: [final.reply],
        link: final.link,
        quickActions: final.quickActions,
      };
    }
    default:
      return {
        flow,
        replies: ['资源审核已收尾。当前仅支持：继续审核下一条、暂停并保存进度、查看本批次汇总。'],
        quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
      };
  }
}

function getResourceAuditDoneReply(
  flow: ResourceAuditFlow,
  text: string,
): {
  flow: ResourceAuditFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  if (/继续|下一条|恢复/.test(normalized)) {
    const queue = availableResourceAuditApplies(flow);
    if (queue.length === 0) {
      return {
        flow,
        reply: '当前资源申请待审队列为空，无法继续下一条审核。',
        quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
      };
    }
    return {
      flow: { ...flow, step: 'n1', paused: false },
      reply: buildResourceAuditOpening(flow),
      quickActions: ['看第一条', '暂停并保存进度', '查看本批次汇总'],
    };
  }
  if (/暂停|保存/.test(normalized)) {
    return {
      flow: { ...flow, paused: true },
      reply: `已保存当前资源审核进度。未决项保持「待审核」状态。\n\n${buildResourceAuditSummary(flow)}`,
      quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
    };
  }
  if (/汇总|批次/.test(normalized)) {
    return {
      flow,
      reply: buildResourceAuditSummary(flow),
      quickActions: ['继续审核下一条', '暂停并保存进度'],
    };
  }
  return {
    flow,
    reply: '资源审核已收尾。当前仅支持：继续审核下一条、暂停并保存进度、查看本批次汇总。',
    quickActions: ['继续审核下一条', '暂停并保存进度', '查看本批次汇总'],
  };
}

const evaluationPendingAgents: EvaluationPendingAgent[] = [
  {
    id: 'eval-pending-001',
    agentId: 'agent-eval-0503-0001',
    code: '0503-0001',
    name: '糖尿病随访管理助手',
    version: 'v2.1',
    department: '内分泌科',
    riskLevel: '中等风险',
  },
  {
    id: 'eval-pending-002',
    agentId: 'agent-eval-0308-0002',
    code: '0308-0002',
    name: '影像报告解读助手',
    version: 'v2.0',
    department: '医学影像科',
    riskLevel: '高风险',
  },
  {
    id: 'eval-pending-003',
    agentId: 'agent-eval-0201-0006',
    code: '0201-0006',
    name: '慢病随访提醒助手',
    version: 'v1.0',
    department: '全科医学科',
    riskLevel: '低风险',
  },
];

const ultrasoundEvaluationAgent: EvaluationPendingAgent = {
  id: 'eval-pending-ultrasound-001',
  agentId: 'agent-eval-ultrasound-0001',
  code: 'US-0001',
  name: '超声检查预约助手',
  version: 'v1.0',
  department: '超声医学科',
  riskLevel: '中等风险',
};

const EVALUATION_SCENE = {
  noPermission: '新建评测仅对信息科管理员开放，暂无法为您办理',
  sidetrack: '我们先来完成智能体评测，稍后再为您解决此问题',
  dimensions: '输入安全 / 输出安全 / 行为安全 / 数据安全 / 工具安全',
  standard: '《智能体安全评测规范》',
};

function buildEvaluationOpening(): string {
  return `你好！我是医小管，我来帮您新建智能体安全评测任务（约 4 步、2–3 分钟）。目前待评测 ${evaluationPendingAgents.length} 个智能体，请问要给哪个、选哪档评测？（快速 30% / 标准 60% / 深度 100%）

【待评测清单】
${evaluationPendingAgents.map((agent, index) => `${index + 1}. 编号：${agent.code}；名称：${agent.name}；版本：${agent.version}；评测档位：待选择${agent.riskLevel === '高风险' ? '（高度关注，建议深度评测）' : ''}`).join('\n')}`;
}

function locateEvaluationAgent(text: string): EvaluationPendingAgent | undefined {
  const normalized = text.toLowerCase();
  if (/第?一|1|第一个/.test(text)) return evaluationPendingAgents[0];
  if (/第?二|2|第二个/.test(text)) return evaluationPendingAgents[1];
  if (/第?三|3|第三个/.test(text)) return evaluationPendingAgents[2];
  return evaluationPendingAgents.find((agent) => {
    const target = `${agent.code} ${agent.name} ${agent.version} ${agent.department}`.toLowerCase();
    return target.includes(normalized) || normalized.includes(agent.code.toLowerCase()) || normalized.includes(agent.name.toLowerCase().slice(0, 4));
  });
}

function locateEvaluationAgents(text: string): EvaluationPendingAgent[] {
  if (/这批|全部|都评|全都|所有/.test(text)) return evaluationPendingAgents;
  const matched = evaluationPendingAgents.filter((agent, index) => {
    const orderText = `${index + 1}`;
    if (new RegExp(`第?${orderText}|${orderText}`).test(text)) return true;
    return text.includes(agent.code) || text.includes(agent.name) || text.includes(agent.name.slice(0, 4));
  });
  const single = locateEvaluationAgent(text);
  if (matched.length) return matched;
  return single ? [single] : [];
}

function parseSampleLevel(text: string): SampleLevel | undefined {
  if (/深度|100%|全量/.test(text)) return '深度评测';
  if (/标准|60%/.test(text)) return '标准评测';
  if (/快速|30%|快评/.test(text)) return '快速评测';
  return undefined;
}

function isUltrasoundEvaluationCreateText(text: string) {
  const normalized = text.trim();
  return /评测/.test(normalized) && /超声波?检查|超声检查|超声/.test(normalized) && /智能体|助手/.test(normalized);
}

function buildUltrasoundSampleLevelPrompt() {
  return `请问本次评测需要使用的样本量？

快速评测（抽取30%题量，评测速度较快）

标准评测（抽取60%题量，评测速度中等）

深度评测（抽取100%题量，评测速度较慢）`;
}

const ULTRASOUND_SAMPLE_LEVEL_ACTIONS = [
  '快速评测',
  '标准评测',
  '深度评测',
];

function buildUltrasoundEvaluationCreatedReply(level: SampleLevel) {
  return `已创建评测任务：

评测智能体名称：超声检查预约助手

评测维度：${EVALUATION_SCENE.dimensions}

评测样本量：${sampleLevelLabel(level)}`;
}

function buildInitialEvaluationProgress(level: SampleLevel): EvaluationProgressSummary {
  const progressByLevel: Record<SampleLevel, EvaluationProgressSummary> = {
    快速评测: { percent: 18, estimatedRemainingHours: 1 },
    标准评测: { percent: 12, estimatedRemainingHours: 2 },
    深度评测: { percent: 8, estimatedRemainingHours: 4 },
  };
  return progressByLevel[level];
}

function sampleLevelLabel(level?: SampleLevel): string {
  if (!level) return '待选择';
  return `${level}（抽题 ${sampleLevelPercent[level]}%）`;
}

function defaultEvaluationLevels(level: SampleLevel): Record<EvalDimension, SampleLevel> {
  return ALL_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = level;
    return acc;
  }, {} as Record<EvalDimension, SampleLevel>);
}

function patchDimensionLevels(
  text: string,
  previous: Record<EvalDimension, SampleLevel> | undefined,
): Record<EvalDimension, SampleLevel> | undefined {
  const baseLevel = parseSampleLevel(text);
  if (baseLevel) return defaultEvaluationLevels(baseLevel);
  return previous;
}

function formatEvaluationLevels(levels?: Record<EvalDimension, SampleLevel>): string {
  if (!levels) return '待选择';
  const level = levels['输入安全'];
  return `五维度统一：${sampleLevelLabel(level)}
维度：${EVALUATION_SCENE.dimensions}`;
}

function buildEvaluationConfirm(slots: EvaluationSlots): string {
  const agents = slots.agents?.length ? slots.agents : slots.agent ? [slots.agent] : [];
  return `【评测配置确认消息】

- 智能体：
${agents.length ? agents.map((agent) => `  - ${agent.code} ${agent.name} ${agent.version}；风险等级：${agent.riskLevel}`).join('\n') : '  - 待选择'}
- 评测标准：${EVALUATION_SCENE.standard}
- 固定五维度：${EVALUATION_SCENE.dimensions}
- 评测档位：
${formatEvaluationLevels(slots.levels)}

确认新建并自动开始评测吗？可回复「确认新建」；要改档位或换智能体也可以直接说。`;
}

function createEvaluationTask(slots: EvaluationSlots, creator?: string): EvaluationSlots {
  const agents = slots.agents?.length ? slots.agents : slots.agent ? [slots.agent] : [evaluationPendingAgents[0]];
  const levels = slots.levels ?? defaultEvaluationLevels('标准评测');
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const dimensionScores: Record<EvalDimension, number> = {
    输入安全: 90,
    输出安全: 86,
    行为安全: 89,
    数据安全: levels['数据安全'] === '深度评测' ? 84 : 82,
    工具安全: 91,
  };
  const totalScore = Math.round((Object.values(dimensionScores).reduce((sum, score) => sum + score, 0) / ALL_DIMENSIONS.length) * 10) / 10;
  const taskIds: string[] = [];
  const taskNos: string[] = [];
  agents.forEach((agent, index) => {
    const taskId = `task-chat-${Date.now()}-${index}`;
    const taskNo = `EVL-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${(mockEvaluationTasks.length + 1).toString().padStart(4, '0')}`;
    taskIds.push(taskId);
    taskNos.push(taskNo);
    const task: EvaluationTask = {
      id: taskId,
      taskNo,
      agentCode: agent.code,
      agentId: agent.agentId,
      agentName: agent.name,
      version: agent.version,
      riskLevel: agent.riskLevel,
      department: agent.department,
      status: '评测完成',
      sampleLevel: levels['输入安全'],
      dimensions: ALL_DIMENSIONS.map((dimension) => ({ dimension, sampleLevel: levels[dimension] })),
      createTime: now,
      submitTime: now,
      evalCompleteTime: now,
      progress: 100,
      progressText: `${sampleLevelPercent[levels['输入安全']] * 5} / ${sampleLevelPercent[levels['输入安全']] * 5}`,
      creator: creator ?? 'admin',
      totalScore,
      systemRiskLevel: agent.riskLevel === '高风险' ? '中等风险' : '低风险',
      evalResult: '准入',
      evalResultDesc: '五维安全评测综合表现达到准入要求，数据安全维度建议持续关注。',
    };
    mockEvaluationTasks.unshift(task);
    const report: EvaluationReport = {
      taskId,
      conclusion: '准入',
      overallRisk: task.systemRiskLevel ?? '中等风险',
      conclusionDesc: '五维安全评测综合表现达到准入要求。',
      detailDesc: '系统已按团体标准《智能体安全评测规范》完成输入、输出、行为、数据、工具安全五维评测，结果已回填台账评测结果信息。',
      redLineTriggered: false,
      dimensionScores: ALL_DIMENSIONS.map((dimension) => ({
        dimension,
        indicator: dimension === '输出安全' ? 'GCR' : dimension === '数据安全' ? 'PLR' : dimension === '输入安全' ? 'ASR' : 'RR',
        rawValue: dimensionScores[dimension],
        score: dimensionScores[dimension],
        riskLevel: dimensionScores[dimension] >= 90 ? '低风险' : '中等风险',
      })),
    };
    mockEvaluationReports[taskId] = report;
    persistChatEvaluationTask(task, report);
  });
  return { ...slots, agent: agents[0], agents, taskId: taskIds[0], taskNo: taskNos[0], taskIds, taskNos, totalProgress: 100, totalScore, dimensionScores };
}

function buildEvaluationProgress(slots: EvaluationSlots): string {
  const levels = slots.levels ?? defaultEvaluationLevels('标准评测');
  const totalByLevel: Record<SampleLevel, number> = { 快速评测: 30, 标准评测: 60, 深度评测: 100 };
  const agents = slots.agents?.length ? slots.agents : slots.agent ? [slots.agent] : [];
  const level = levels['输入安全'];
  const total = totalByLevel[level];
  const taskLines = (slots.taskNos ?? [slots.taskNo]).filter(Boolean).map((taskNo, index) => {
    const agent = agents[index] ?? agents[0];
    return `- ${taskNo}：${agent?.code ?? '0503-0001'} ${agent?.name ?? '糖尿病随访管理助手'}，总进度 100%，当前维度：工具安全`;
  }).join('\n');
  return `评测任务已创建并自动开始执行。

${taskLines}

五维度进度（已跑/总题）：
- 输入安全：${total}/${total}
- 输出安全：${total}/${total}
- 行为安全：${total}/${total}
- 数据安全：${total}/${total}
- 工具安全：${total}/${total}

评测引擎已完成本轮执行，正在回填台账「评测结果信息」。`;
}

function buildEvaluationResult(slots: EvaluationSlots): string {
  const scores = slots.dimensionScores;
  const agents = slots.agents?.length ? slots.agents : slots.agent ? [slots.agent] : [];
  const resultHeader = agents.length > 1
    ? agents.map((agent) => `- ${agent.code} ${agent.name}：总分 ${slots.totalScore ?? 88}，较上次 +2.3`).join('\n')
    : `${agents[0]?.code ?? '0503-0001'} ${agents[0]?.name ?? '糖尿病随访管理助手'}：总分 ${slots.totalScore ?? 88}，较上次 +2.3`;
  return `评测完成：

${resultHeader}

- 输入安全：${scores?.['输入安全'] ?? 90}
- 输出安全：${scores?.['输出安全'] ?? 86}
- 行为安全：${scores?.['行为安全'] ?? 89}
- 数据安全：${scores?.['数据安全'] ?? 84}
- 工具安全：${scores?.['工具安全'] ?? 91}

结果已回填智能体台账「评测结果信息」。数据安全维度相对偏低，建议关注。

收尾动作入口：查看评测进度、查看评测结果详情、新建下一个评测。`;
}

function evaluationTaskDetailPath(taskId?: string): string {
  return taskId ? `/app/evaluation/tasks/${taskId}/report` : '/app/evaluation/tasks';
}

function getEvaluationNext(
  flow: EvaluationFlow,
  text: string,
  creator?: string,
): {
  flow: EvaluationFlow;
  replies: string[];
  link?: { to: string; text: string };
  actionLinks?: Array<{ to: string; text: string; download?: boolean }>;
  evaluationProgress?: EvaluationProgressSummary;
  quickActions?: string[];
} {
  const normalized = text.trim();
  const slots: EvaluationSlots = { ...flow.slots };
  const currentQuestion = flow.step === 'n1'
    ? '请指定待评测智能体与统一评测档位。'
    : '请确认评测配置，或回复「修改智能体 / 修改档位」。';
  const intent = /确认|开始|新建|暂存|先存/.test(normalized)
    ? 'confirm_or_lifecycle'
    : /修改|改档位|换智能体|快速|标准|深度|第一个|第二个|第三个|这批|全部|都评|0503|0308|0201/.test(normalized)
      ? 'collect_config'
      : /直接.*分|打个 ?90|跳过评测|改分|篡改|改标准|改维度|分维度/.test(normalized)
        ? 'boundary'
        : /告警|台账|资源|审批|天气|新闻|闲聊|讲个笑话/.test(normalized)
          ? 'offtopic'
          : 'collect_config';
  console.info('[home-evaluation-intent]', { intent, step: flow.step });

  if (/暂存|先存/.test(normalized)) {
    return {
      flow: { ...flow, step: 'done', slots: { ...slots, draftSaved: true } },
      replies: ['已保存评测任务草稿，草稿保留 7 天，尚未执行评测。'],
      link: { to: '/app/evaluation/tasks?tab=草稿', text: '查看评测草稿' },
      quickActions: ['新建下一个评测'],
    };
  }
  if (intent === 'offtopic' && flow.step !== 'running') {
    slots.sidetrack = [...(slots.sidetrack ?? []), normalized];
    return {
      flow: { ...flow, slots },
      replies: [`${EVALUATION_SCENE.sidetrack}\n\n当前节点：${currentQuestion}`],
      quickActions: ['确认新建', '改档位', '换智能体'],
    };
  }
  if (intent === 'boundary') {
    return {
      flow,
      replies: ['评测结果需由评测引擎依团体标准产生，无法直接给分、跳过评测、篡改结果或改评测标准维度。合规替代方案：可提高到深度评测后重跑，或维持当前配置开始。'],
      quickActions: ['维持当前配置开始', '五维度统一深度评测'],
    };
  }

  switch (flow.step) {
    case 'confirmUltrasoundAgent': {
      if (/是|确认|开启|开始|对|没错/.test(normalized)) {
        return {
          flow: {
            ...flow,
            step: 'sampleLevel',
            slots: {
              ...slots,
              agent: ultrasoundEvaluationAgent,
              agents: [ultrasoundEvaluationAgent],
            },
          },
          replies: [buildUltrasoundSampleLevelPrompt()],
          quickActions: ULTRASOUND_SAMPLE_LEVEL_ACTIONS,
        };
      }
      return {
        flow,
        replies: ['请先确认是否为「超声检查预约助手」智能体。'],
        quickActions: ['是的，开启评测'],
      };
    }
    case 'sampleLevel': {
      const level = parseSampleLevel(normalized);
      if (!level) {
        return {
          flow,
          replies: [buildUltrasoundSampleLevelPrompt()],
          quickActions: ULTRASOUND_SAMPLE_LEVEL_ACTIONS,
        };
      }
      const submittedSlots = createEvaluationTask(
        {
          ...slots,
          agent: ultrasoundEvaluationAgent,
          agents: [ultrasoundEvaluationAgent],
          levels: defaultEvaluationLevels(level),
        },
        creator,
      );
      return {
        flow: { ...flow, step: 'done', slots: submittedSlots },
        replies: [buildUltrasoundEvaluationCreatedReply(level)],
        evaluationProgress: buildInitialEvaluationProgress(level),
        actionLinks: [{ to: evaluationTaskDetailPath(submittedSlots.taskId), text: '查看任务详情' }],
      };
    }
    case 'n1': {
      const agents = locateEvaluationAgents(normalized);
      const selectedAgents = agents.length ? agents : slots.agents ?? (slots.agent ? [slots.agent] : []);
      const agent = selectedAgents[0];
      const levels = patchDimensionLevels(normalized, slots.levels);
      if (!selectedAgents.length || !levels) {
        return {
          flow: { ...flow, step: 'n1', slots: { ...slots, agent, agents: selectedAgents, levels } },
          replies: [
            `${!selectedAgents.length ? '还需要选定评测智能体。' : ''}${!levels ? '还需要选择五维度统一评测档位。' : ''}\n\n定位后将同步使用固定评测标准${EVALUATION_SCENE.standard}与固定五维度：${EVALUATION_SCENE.dimensions}。\n\n可直接说「第一个，标准评测」或「这批都评一下，标准评测」。`,
          ],
          quickActions: ['第一个，标准评测', '这批都评一下，标准评测', '第二个，深度评测'],
        };
      }
      const nextSlots = { ...slots, agent, agents: selectedAgents, levels };
      return {
        flow: { ...flow, step: 'n2', slots: nextSlots },
        replies: [buildEvaluationConfirm(nextSlots)],
        quickActions: ['确认新建', '改档位为深度评测', '换智能体'],
      };
    }
    case 'n2': {
      if (/换智能体|改智能体/.test(normalized)) {
        return {
          flow: { ...flow, step: 'n1', slots: { levels: slots.levels } },
          replies: ['可以，请重新选择待评测智能体。'],
          quickActions: ['第一个', '第二个', '这批都评一下'],
        };
      }
      if (/改档位|档位|快速|标准|深度/.test(normalized) && !/确认|开始|维持|新建/.test(normalized)) {
        const levels = patchDimensionLevels(normalized, slots.levels);
        const nextSlots = { ...slots, levels };
        return {
          flow: { ...flow, step: 'n2', slots: nextSlots },
          replies: [`已更新评测档位：\n${formatEvaluationLevels(levels)}\n\n本版本不支持分维度分别设置，五维度使用同一档位。确认就自动新建并开始评测。`],
          quickActions: ['确认新建', '五维度统一深度评测'],
        };
      }
      if (/确认|开始|维持|提交|新建/.test(normalized)) {
        const submittedSlots = createEvaluationTask(slots, creator);
        return {
          flow: { ...flow, step: 'done', slots: submittedSlots },
          replies: [buildEvaluationProgress(submittedSlots), buildEvaluationResult(submittedSlots)],
          link: { to: evaluationTaskDetailPath(submittedSlots.taskId), text: '查看评测进度' },
          quickActions: ['查看评测进度', '查看评测结果详情', '新建下一个评测'],
        };
      }
      return {
        flow,
        replies: [buildEvaluationConfirm(slots)],
        quickActions: ['确认新建', '改档位', '换智能体'],
      };
    }
    default:
      return {
        flow,
        replies: ['评测任务已完成。'],
      };
  }
}

function getEvaluationDoneReply(
  flow: EvaluationFlow,
  text: string,
): {
  flow: EvaluationFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  if (/进度/.test(normalized)) {
    return {
      flow,
      reply: buildEvaluationProgress(flow.slots),
      link: { to: evaluationTaskDetailPath(flow.slots.taskId), text: '查看评测进度' },
      quickActions: ['查看评测进度', '查看评测结果详情', '新建下一个评测'],
    };
  }
  if (/结果|详情|报告/.test(normalized)) {
    return {
      flow,
      reply: buildEvaluationResult(flow.slots),
      link: { to: evaluationTaskDetailPath(flow.slots.taskId), text: '查看评测结果详情' },
      quickActions: ['查看评测进度', '查看评测结果详情', '新建下一个评测'],
    };
  }
  if (/下一个|新建/.test(normalized)) {
    return {
      flow: { ...flow, step: 'n1', slots: {} },
      reply: buildEvaluationOpening(),
      quickActions: ['第一个，标准评测', '第二个，深度评测', '第三个，快速评测'],
    };
  }
  return {
    flow,
    reply: '当前评测场景已收尾。仅支持：查看评测进度、查看评测结果详情、新建下一个评测。',
    quickActions: ['查看评测进度', '查看评测结果详情', '新建下一个评测'],
  };
}

function evaluationAuditQueue(): EvaluationTask[] {
  return mockEvaluationTasks.filter((task) =>
    ['待审核', '评测完成'].includes(task.status) && task.evalResult !== '准入' && task.evalResult !== '退回',
  );
}

function createEvaluationAuditFlow(sessionId: string): EvaluationAuditFlow {
  return {
    sessionId,
    step: 'n1',
    queueIds: evaluationAuditQueue().map((task) => task.id),
    reviewedIds: [],
    records: [],
  };
}

function getEvaluationAuditTask(id?: string) {
  return id ? mockEvaluationTasks.find((task) => task.id === id) : undefined;
}

function getEvaluationSystemConclusion(task: EvaluationTask): '准入' | '退回' {
  const reportConclusion = getReportByTaskId(task.id)?.conclusion;
  if (reportConclusion === '准入' || reportConclusion === '退回') return reportConclusion;
  return (task.totalScore ?? 0) >= 80 ? '准入' : '退回';
}

function getEvaluationAuditDetail(task: EvaluationTask) {
  const report = getReportByTaskId(task.id);
  const systemConclusion = getEvaluationSystemConclusion(task);
  const detail = systemConclusion === '退回' && report?.conclusion === '待人工复核'
    ? '输出安全 GCR=90 处于阈值边缘，总分未达本批准入线，建议退回修改并补充安全样本后重新评测。'
    : report?.detailDesc ?? task.evalResultDesc ?? '评测已完成，等待管理员审核。';
  const dimensions = report?.dimensionScores
    .map((item) => `${item.dimension}${item.score}分（${item.riskLevel}）`)
    .join('、') ?? '暂无维度明细';
  return { report, systemConclusion, detail, dimensions };
}

function availableEvaluationAuditTasks(flow: EvaluationAuditFlow) {
  const reviewed = new Set(flow.reviewedIds);
  return flow.queueIds
    .map((id) => getEvaluationAuditTask(id))
    .filter((task): task is EvaluationTask => Boolean(task) && !reviewed.has(task.id));
}

function buildEvaluationAuditOpening(flow: EvaluationAuditFlow): string {
  const queue = availableEvaluationAuditTasks(flow);
  if (queue.length === 0) {
    return '你好！我是医小管。目前系统已评测待审队列为空。\n\n本次审核到此结束。后续仅开放：查看审核记录、查看批次汇总。';
  }
  return `你好！我是医小管。目前系统已评测 ${queue.length} 个智能体待审核，已为您拉取「已评测待审队列」：

${queue.map((task, index) => {
  const { systemConclusion, detail } = getEvaluationAuditDetail(task);
  return `${index + 1}. ${task.agentCode} ${task.agentName} ${task.version} · 系统结论：${systemConclusion}；说明摘要：${detail}`;
}).join('\n')}

请按编号、名称或序号选定一条，我会沿 N0→N4 轨道逐条呈报评测结果并完成审核。`;
}

function locateEvaluationAuditTask(flow: EvaluationAuditFlow, text: string) {
  const queue = availableEvaluationAuditTasks(flow);
  const indexMatch = text.match(/第?\s*([一二三四五六七八九十\d]+)\s*(条|个)?|^([1-9]\d*)$/);
  if (indexMatch) {
    const raw = indexMatch[1] ?? indexMatch[3];
    const cnMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const index = /^\d+$/.test(raw) ? Number(raw) : cnMap[raw] ?? 1;
    return queue[index - 1];
  }
  const normalized = text.toLowerCase();
  return queue.find((task) => {
    const target = `${task.taskNo} ${task.agentCode} ${task.agentName} ${task.version} ${task.department}`.toLowerCase();
    return target.includes(normalized) || normalized.includes(task.agentCode.toLowerCase()) || normalized.includes(task.agentName.toLowerCase().slice(0, 4));
  });
}

function locateEvaluationAuditTasks(flow: EvaluationAuditFlow, text: string) {
  const queue = availableEvaluationAuditTasks(flow);
  const normalized = text.toLowerCase();
  if (/全部|全选|所有|这批/.test(normalized)) return queue;
  const matched = queue.filter((task) => {
    const target = `${task.taskNo} ${task.agentCode} ${task.agentName} ${task.version} ${task.department}`.toLowerCase();
    return normalized.includes(task.agentCode.toLowerCase())
      || normalized.includes(task.agentName.toLowerCase())
      || normalized.includes(task.agentName.toLowerCase().slice(0, 4))
      || target.includes(normalized);
  });
  const single = locateEvaluationAuditTask(flow, text);
  if (matched.length) return matched;
  return single ? [single] : [];
}

function buildEvaluationAuditPresentation(task: EvaluationTask): string {
  const { systemConclusion, detail, dimensions } = getEvaluationAuditDetail(task);
  return `已选定 ${task.agentCode} ${task.agentName}，信息如下（只读）：

- 智能体编号：${task.agentCode}
- 智能体名称：${task.agentName}
- 版本：${task.version}
- 所属科室：${task.department}
- 任务编号：${task.taskNo}
- 总分：${task.totalScore ?? '待回填'}
- 系统核心结论：${systemConclusion}
- 具体说明（评测规则生成）：${detail}
- 维度明细：${dimensions}

请给出审核结论：审核通过 / 退回修改。`;
}

function parseEvaluationAuditConclusion(text: string): '审核通过' | '退回修改' | undefined {
  if (/退回|驳回|修改|整改|重评|重测/.test(text)) return '退回修改';
  if (/通过|同意|准予|准入|采纳|没问题/.test(text)) return '审核通过';
  return undefined;
}

function defaultEvaluationAuditComment(conclusion: '审核通过' | '退回修改', task: EvaluationTask) {
  const { systemConclusion } = getEvaluationAuditDetail(task);
  if (conclusion === '审核通过') {
    return systemConclusion === '准入' ? '准予准入，上线后按季度复评。' : '采纳系统退回结论，请申请人按评测说明整改后重新提交。';
  }
  return '';
}

function extractEvaluationAuditComment(text: string) {
  if (/^(审核通过|通过|退回修改|退回|驳回|修改)[。.!！]?$/.test(text.trim())) return '';
  return text
    .replace(/^退回原因[:：]?/g, '')
    .replace(/^具体说明[:：]?/g, '')
    .replace(/^加一句[:：]?/g, '')
    .replace(/^说明[:：]?/g, '')
    .trim();
}

function finalizeEvaluationAudit(
  flow: EvaluationAuditFlow,
  reviewerName?: string,
): { flow: EvaluationAuditFlow; reply: string; link?: { to: string; text: string }; quickActions?: string[] } {
  const task = getEvaluationAuditTask(flow.selectedTaskId);
  if (!task || !flow.reviewConclusion) {
    return { flow, reply: '还没有选定唯一评测结果或审核结论，请先完成 N1/N2。' };
  }
  const { systemConclusion } = getEvaluationAuditDetail(task);
  const finalResult: EvaluationAuditRecord['finalResult'] =
    flow.reviewConclusion === '审核通过' ? systemConclusion : '退回修改';
  const reviewer = reviewerName ?? '王主任';
  const time = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const comment = (flow.comment ?? defaultEvaluationAuditComment(flow.reviewConclusion, task)).trim();

  task.status = flow.reviewConclusion === '审核通过' ? '审核通过' : '退回重测';
  task.reviewComment = comment;
  task.reviewer = reviewer;
  task.reviewCompleteTime = `${time}:00`;
  task.evalResult = finalResult === '退回修改' ? '退回' : finalResult as EvaluationConclusion;
  task.evalResultDesc = finalResult === '准入'
    ? '管理员审核通过，最终准入评测结果为准入。'
    : finalResult === '退回'
      ? '管理员审核通过并采纳系统退回结论，最终准入评测结果为退回。'
      : '管理员退回修改，等待申请人整改后重新评测。';
  if (finalResult !== '准入') task.rejectTime = `${time}:00`;

  const record: EvaluationAuditRecord = {
    taskId: task.id,
    agentCode: task.agentCode,
    agentName: task.agentName,
    systemConclusion,
    reviewConclusion: flow.reviewConclusion,
    finalResult,
    comment,
    reviewer,
    time,
  };
  const nextFlow: EvaluationAuditFlow = {
    ...flow,
    step: availableEvaluationAuditTasks({ ...flow, reviewedIds: [...flow.reviewedIds, task.id] }).length > 0 ? 'n1' : 'done',
    reviewedIds: [...flow.reviewedIds, task.id],
    records: [...flow.records, record],
    selectedTaskId: undefined,
    reviewConclusion: undefined,
    comment: undefined,
  };
  const remaining = availableEvaluationAuditTasks(nextFlow).length;
  const syncLabel = finalResult === '退回修改' ? '退回原因说明' : '具体说明';
  const resultReply = `已生效。下方最终结果：

${task.agentCode} ${task.agentName}｜最终评测结果：${finalResult}｜${syncLabel}：${comment || '无补充说明'}

审核人：${reviewer}，时间：${time}，已完成状态流转、同步用户端并通知申请人${finalResult === '准入' ? '，智能体可正式纳管／上线' : '整改或重评'}。${remaining > 0 ? `剩余 ${remaining} 条。` : '待审已清空。'}`;
  if (remaining > 0) {
    return {
      flow: nextFlow,
      reply: `${resultReply}\n\n请继续选择下一条审核。`,
      link: { to: '/app/evaluation/tasks?tab=审核通过', text: '查看审核记录' },
      quickActions: ['继续下一条审核', '查看审核记录', '查看批次汇总'],
    };
  }
  return {
    flow: nextFlow,
    reply: `${resultReply}\n\n${buildEvaluationAuditBatchSummary(nextFlow)}\n\n本次审核到此结束。后续仅开放：继续下一条审核、查看审核记录、查看批次汇总。`,
    link: { to: '/app/evaluation/tasks?tab=审核通过', text: '查看审核记录' },
    quickActions: ['继续下一条审核', '查看审核记录', '查看批次汇总'],
  };
}

function applyEvaluationAuditBatch(
  flow: EvaluationAuditFlow,
  tasks: EvaluationTask[],
  conclusion: '审核通过' | '退回修改',
  reviewerName?: string,
  reason?: string,
): { flow: EvaluationAuditFlow; reply: string; link?: { to: string; text: string }; quickActions?: string[]; evaluationAuditTable?: EvaluationAuditTable } {
  const reviewer = reviewerName ?? '王主任';
  const time = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const records: EvaluationAuditRecord[] = [];

  tasks.forEach((task) => {
    const { systemConclusion } = getEvaluationAuditDetail(task);
    const comment = (reason || defaultEvaluationAuditComment(conclusion, task)).trim();
    const finalResult: EvaluationAuditRecord['finalResult'] =
      conclusion === '审核通过' ? systemConclusion : '退回修改';

    task.status = conclusion === '审核通过' ? '审核通过' : '退回重测';
    task.reviewComment = comment;
    task.reviewer = reviewer;
    task.reviewCompleteTime = `${time}:00`;
    task.evalResult = finalResult === '退回修改' ? '退回' : finalResult as EvaluationConclusion;
    task.evalResultDesc = finalResult === '准入'
      ? '管理员审核通过，最终准入评测结果为准入。'
      : finalResult === '退回'
        ? '管理员审核通过并采纳系统退回结论，最终准入评测结果为退回。'
        : '管理员退回修改，等待申请人整改后重新评测。';
    if (finalResult !== '准入') task.rejectTime = `${time}:00`;

    records.push({
      taskId: task.id,
      agentCode: task.agentCode,
      agentName: task.agentName,
      systemConclusion,
      reviewConclusion: conclusion,
      finalResult,
      comment,
      reviewer,
      time,
    });
  });

  const reviewedIds = Array.from(new Set([...flow.reviewedIds, ...tasks.map((task) => task.id)]));
  const nextFlow: EvaluationAuditFlow = {
    ...flow,
    step: availableEvaluationAuditTasks({ ...flow, reviewedIds }).length > 0 ? 'n1' : 'done',
    reviewedIds,
    records: [...flow.records, ...records],
    selectedTaskId: undefined,
    reviewConclusion: undefined,
    comment: undefined,
  };
  const remainingRows = availableEvaluationAuditTasks(nextFlow);
  const names = records.map((record) => `${record.agentCode} ${record.agentName}`).join('、');
  const reply = `${names} 已${conclusion}。
审核人：${reviewer}
审核时间：${time}
${conclusion === '退回修改' ? `退回原因：${reason || '依据预审结论退回修改'}` : '已同步状态流转并通知申请人。'}

${remainingRows.length ? `剩余待审核评测任务 ${remainingRows.length} 个：` : '待审核评测任务已清空。'}`;

  return {
    flow: nextFlow,
    reply,
    link: { to: '/app/evaluation/tasks?tab=审核通过', text: '查看审核记录' },
    quickActions: remainingRows.length ? ['看第一条', '查看批次汇总', '暂停审核'] : ['查看审核记录', '查看批次汇总'],
    evaluationAuditTable: remainingRows.length ? { rows: remainingRows } : undefined,
  };
}

function buildEvaluationAuditBatchSummary(flow: EvaluationAuditFlow) {
  const admitted = flow.records.filter((record) => record.finalResult === '准入').length;
  const returned = flow.records.filter((record) => record.finalResult !== '准入').length;
  const unhandled = availableEvaluationAuditTasks(flow).length;
  return `本批完成：准入 ${admitted}、退回修改 ${returned}、未处理 ${unhandled}。`;
}

function buildEvaluationAuditRecords(flow: EvaluationAuditFlow) {
  if (flow.records.length === 0) return '本次会话暂无已提交审核记录。';
  return `本次会话审核记录：

${flow.records.map((record, index) =>
  `${index + 1}. ${record.agentCode} ${record.agentName}｜系统结论：${record.systemConclusion}｜审核结论：${record.reviewConclusion}｜最终结果：${record.finalResult}｜审核人：${record.reviewer}｜时间：${record.time}｜说明：${record.comment || '无'}`
).join('\n')}`;
}

function getEvaluationAuditNext(
  flow: EvaluationAuditFlow,
  text: string,
  reviewerName?: string,
): {
  flow: EvaluationAuditFlow;
  replies: string[];
  link?: { to: string; text: string };
  evaluationAuditTable?: EvaluationAuditTable;
  quickActions?: string[];
} {
  const normalized = text.trim();
  const batchConclusion = parseEvaluationAuditConclusion(normalized);
  const batchTasks = batchConclusion ? locateEvaluationAuditTasks(flow, normalized) : [];
  if (batchConclusion && batchTasks.length > 0 && flow.step === 'n1') {
    const reason = batchConclusion === '退回修改'
      ? (normalized.match(/[：:](.+)$/)?.[1]?.trim()
        || extractEvaluationAuditComment(normalized.replace(/退回修改|退回|驳回|修改/g, '')).replace(/^[\s：:]+/, ''))
      : undefined;
    const next = applyEvaluationAuditBatch(
      flow,
      batchTasks,
      batchConclusion,
      reviewerName,
      reason || (batchConclusion === '退回修改' ? '依据预审结论退回修改' : undefined),
    );
    return {
      flow: next.flow,
      replies: [next.reply],
      link: next.link,
      evaluationAuditTable: next.evaluationAuditTable,
      quickActions: next.quickActions,
    };
  }
  if (/暂停|先停|稍后|保存进度/.test(normalized)) {
    const nextFlow = { ...flow, step: 'done' as const, paused: true };
    return {
      flow: nextFlow,
      replies: ['已暂停评测审核，未决项保持「待审核」状态，当前进度已自动保存。\n\n后续仅开放：继续下一条审核、查看审核记录、查看批次汇总。'],
      quickActions: ['继续下一条审核', '查看审核记录', '查看批次汇总'],
    };
  }
  if (/审核记录|记录/.test(normalized)) {
    return {
      flow,
      replies: [buildEvaluationAuditRecords(flow)],
      link: { to: '/app/evaluation/tasks?tab=审核通过', text: '查看审核记录' },
      quickActions: ['继续下一条审核', '查看批次汇总'],
    };
  }
  if (/批次|汇总/.test(normalized)) {
    return {
      flow,
      replies: [buildEvaluationAuditBatchSummary(flow)],
      quickActions: ['继续下一条审核', '查看审核记录'],
    };
  }

  switch (flow.step) {
    case 'n1': {
      const queue = availableEvaluationAuditTasks(flow);
      if (/继续|下一条/.test(normalized) && queue.length === 0) {
        return {
          flow: { ...flow, step: 'done' },
          replies: ['当前已评测待审队列为空。后续仅开放：查看审核记录、查看批次汇总。'],
          quickActions: ['查看审核记录', '查看批次汇总'],
        };
      }
      const task = locateEvaluationAuditTask(flow, normalized) ?? (/继续|下一条/.test(normalized) ? queue[0] : undefined);
      if (!task) {
        return {
          flow,
          replies: [`请先选定一条待审评测结果。\n\n${buildEvaluationAuditOpening(flow)}`],
          quickActions: ['看第一条', '查看批次汇总', '暂停审核'],
        };
      }
      return {
        flow: { ...flow, step: 'n2', selectedTaskId: task.id },
        replies: [buildEvaluationAuditPresentation(task)],
        link: { to: `/app/evaluation/tasks/${task.id}/report`, text: '查看评测结果详情' },
        quickActions: ['审核通过', '退回修改', '查看维度明细'],
      };
    }
    case 'n2': {
      const task = getEvaluationAuditTask(flow.selectedTaskId);
      if (!task) return { flow: { ...flow, step: 'n1' }, replies: ['当前选定项已失效，请重新选择待审评测结果。'] };
      if (/维度|明细|详情/.test(normalized)) {
        return {
          flow,
          replies: [`${task.agentCode} ${task.agentName} 维度明细：${getEvaluationAuditDetail(task).dimensions}\n\n请继续给出审核结论：审核通过 / 退回修改。`],
          link: { to: `/app/evaluation/tasks/${task.id}/report`, text: '查看评测结果详情' },
          quickActions: ['审核通过', '退回修改'],
        };
      }
      if (/台账|告警|今天|准入了几个|资源|排班/.test(normalized)) {
        return {
          flow,
          replies: [`我们先来完成准入评测结果审核，稍后再为您解决此问题。\n\n${buildEvaluationAuditPresentation(task)}`],
          quickActions: ['审核通过', '退回修改'],
        };
      }
      const conclusion = parseEvaluationAuditConclusion(normalized);
      if (!conclusion) {
        return {
          flow,
          replies: ['请给出审核结论：审核通过 / 退回修改。管理员如对系统评测结论有异议，只能选择「退回修改」打回重评，不能直接修改系统分数或结论。'],
          quickActions: ['审核通过', '退回修改'],
        };
      }
      const { systemConclusion } = getEvaluationAuditDetail(task);
      if (conclusion === '退回修改') {
        return {
          flow: { ...flow, step: 'n3', reviewConclusion: conclusion, comment: extractEvaluationAuditComment(normalized) },
          replies: ['选择退回修改，需要填写退回原因（具体说明，必填，≤500 字）。请说明。'],
          quickActions: ['退回原因：数据安全与行为安全未达标，请整改后重新提交'],
        };
      }
      return {
        flow: { ...flow, step: 'n3', reviewConclusion: conclusion, comment: extractEvaluationAuditComment(normalized) },
        replies: [`审核通过，将采纳系统结论「${systemConclusion}」为最终结果。具体说明为选填，需要补充吗？不填我就提交。`],
        quickActions: ['不填，直接提交', '加一句：准予准入，上线后按季度复评'],
      };
    }
    case 'n3': {
      const task = getEvaluationAuditTask(flow.selectedTaskId);
      if (!task || !flow.reviewConclusion) return { flow: { ...flow, step: 'n1' }, replies: ['当前审核上下文已失效，请重新选择待审评测结果。'] };
      const isConfirm = /确认|提交|生效|不填|直接|没问题|就这样/.test(normalized);
      if (/修改具体说明|修改说明|改成|改为/.test(normalized)) {
        const comment = normalized
          .replace(/^修改具体说明[:：]?/, '')
          .replace(/^修改说明[:：]?/, '')
          .replace(/^把/, '')
          .trim();
        return {
          flow: { ...flow, comment: comment || flow.comment },
          replies: [`已更新具体说明：${comment || flow.comment || '无补充说明'}。请确认。`],
          quickActions: ['确认', '重新修改具体说明'],
        };
      }
      const comment = extractEvaluationAuditComment(normalized);
      const nextComment = !isConfirm && comment ? comment.slice(0, 500) : flow.comment;
      if (flow.reviewConclusion === '退回修改' && !nextComment) {
        return {
          flow: { ...flow, comment: nextComment },
          replies: ['抱歉，选择「退回修改」必须填写退回原因才能提交。请补充具体说明。'],
          quickActions: ['退回原因：数据安全与行为安全未达标，请整改后重新提交'],
        };
      }
      if (!isConfirm && comment) {
        return {
          flow: { ...flow, comment: nextComment },
          replies: [`已记录具体说明：${nextComment}。请确认。`],
          quickActions: ['确认', '修改具体说明'],
        };
      }
      const final = finalizeEvaluationAudit({ ...flow, comment: nextComment }, reviewerName);
      return {
        flow: final.flow,
        replies: [final.reply],
        link: final.link,
        quickActions: final.quickActions,
      };
    }
    default:
      return {
        flow,
        replies: ['评测审核已收尾。当前仅支持：继续下一条审核、查看审核记录、查看批次汇总。'],
        quickActions: ['继续下一条审核', '查看审核记录', '查看批次汇总'],
      };
  }
}

function getEvaluationAuditDoneReply(
  flow: EvaluationAuditFlow,
  text: string,
): {
  flow: EvaluationAuditFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
} {
  const normalized = text.trim();
  if (/继续|下一条|恢复/.test(normalized)) {
    const queue = availableEvaluationAuditTasks(flow);
    if (queue.length === 0) {
      return {
        flow,
        reply: '当前已评测待审队列为空，无法继续下一条审核。',
        quickActions: ['查看审核记录', '查看批次汇总'],
      };
    }
    return {
      flow: { ...flow, step: 'n1', paused: false },
      reply: buildEvaluationAuditOpening(flow),
      quickActions: ['看第一条', '查看批次汇总', '暂停审核'],
    };
  }
  if (/记录/.test(normalized)) {
    return {
      flow,
      reply: buildEvaluationAuditRecords(flow),
      link: { to: '/app/evaluation/tasks?tab=审核通过', text: '查看审核记录' },
      quickActions: ['继续下一条审核', '查看批次汇总'],
    };
  }
  if (/汇总|批次/.test(normalized)) {
    return {
      flow,
      reply: buildEvaluationAuditBatchSummary(flow),
      quickActions: ['继续下一条审核', '查看审核记录'],
    };
  }
  return {
    flow,
    reply: '评测审核已收尾。当前仅支持：继续下一条审核、查看审核记录、查看批次汇总。',
    quickActions: ['继续下一条审核', '查看审核记录', '查看批次汇总'],
  };
}

function buildMonitorOpening(role: '信息科管理员' | '科室管理员'): string {
  return '你好，我是医小管。运行监控相关问题都可以问我';
}

function monitorScope(role: '信息科管理员' | '科室管理员') {
  return role === '信息科管理员' ? '全院' : '本科室';
}

function openMonitorAlerts(role: '信息科管理员' | '科室管理员') {
  const openStatuses = new Set(['pending_assign', 'pending_handle', 'handling', 'pending_review', 'reviewing']);
  const scopeDept = role === '信息科管理员' ? null : '内科';
  return mockAlertEventsV18
    .filter((event) => openStatuses.has(event.status))
    .filter((event) => !scopeDept || event.department === scopeDept)
    .sort((a, b) => monitorAlertLevelWeight(b) - monitorAlertLevelWeight(a));
}

function monitorAlertLevel(event: AlertEventV18): '高' | '中' | '低' {
  if (event.eventType === 'security' || event.triggerContent.trigger_action === 'disable') return '高';
  if (event.eventType === 'cost' || event.triggerContent.trigger_action === 'warn') return '高';
  if (event.status === 'pending_handle' || event.status === 'handling') return '中';
  return '低';
}

function monitorAlertLevelWeight(event: AlertEventV18) {
  return { 高: 3, 中: 2, 低: 1 }[monitorAlertLevel(event)];
}

function monitorAlertCode(event: AlertEventV18, index: number) {
  const codeMap: Record<string, string> = {
    'agent-006': '0503-0001',
    'agent-002': '0308-0002',
    'agent-005': '0611-0004',
    'agent-008': '0702-0003',
  };
  return codeMap[event.agentId] ?? `0${index + 1}00-000${index + 1}`;
}

function buildOpenAlertList(role: '信息科管理员' | '科室管理员') {
  const alerts = openMonitorAlerts(role);
  if (alerts.length === 0) {
    return {
      alerts,
      rows: [] as MonitorAlertRow[],
      reply: '当前暂无未处理告警，运行平稳',
    };
  }
  const rows = alerts.map(monitorAlertToRow);
  return {
    alerts,
    rows,
    reply: `为您弹出当前未处理告警共 ${alerts.length} 条（按级别高→低）：\n\n需要我展开某条的触发详情或处置建议吗？可回复序号`,
  };
}

function monitorDimensionLabel(event: AlertEventV18): MonitorAlertRow['dimension'] {
  if (event.eventType === 'business') return '业务';
  if (event.eventType === 'status') return '状态';
  if (event.eventType === 'cost') return '成本';
  return '安全';
}

function monitorAlertToRow(event: AlertEventV18, index: number): MonitorAlertRow {
  const condition = event.triggerContent.trigger_condition;
  return {
    id: event.id,
    level: monitorAlertLevel(event),
    dimension: monitorDimensionLabel(event),
    code: monitorAlertCode(event, index),
    agentName: event.agentName,
    content: `${condition.metric} ${condition.description}，命中〔${monitorAlertLevel(event)}〕级告警规则（阈值 ${condition.threshold}${condition.thresholdUnit ?? ''}）`,
    detailTo: `/app/monitoring/alert-events/${event.id}`,
  };
}

function buildMonitorMetricReply(text: string, role: '信息科管理员' | '科室管理员') {
  const scope = monitorScope(role);
  const today = /本周|周/.test(text) ? '本周' : /本月|月/.test(text) ? '本月' : '今日';
  const onlineRate = ((statusKpiV18.online / statusKpiV18.total) * 100).toFixed(1);
  if (/token|成本|费用|消耗/.test(text)) {
    return `**直答**：${today}${scope} **token 使用量** ${costKpiV18.token.today.toLocaleString()} tokens，单任务输入 Token 均值 **1.8k**、输出 Token 均值 **0.6k**；单次会话平均成本 **¥0.12**，单任务平均成本 **¥0.35**。

**口径**：统计范围为${scope}，时间范围为${today === '今日' ? '今日 00:00 至当前' : today}；成本类同时保留日/周/月趋势。

**下钻**：点击 **token 使用量** 可看日/周/月趋势，点击 **单任务平均成本** 可看成本明细。

**告警对照 + 引导报告**：「胸部 CT 影像智能分析平台」已触发〔高〕告警，这条已产生告警，要看未处理告警吗？需要我据此生成《智能体运行监控情况报告》吗？`;
  }
  if (/在线|离线|状态|健康|心跳/.test(text)) {
    return `**直答**：${today}${scope}智能体 **在线率** ${onlineRate}%，在线 **${statusKpiV18.online}** 个、离线 **${statusKpiV18.offline}** 个、异常 **${statusKpiV18.abnormal}** 个、禁用 **${statusKpiV18.disabled}** 个。

**口径**：统计范围为${scope}，时间范围为${today === '今日' ? '今日 00:00 至当前' : today}。

**下钻**：点击 **在线率**、**离线时长**、**心跳成功率** 可查看日/周/月趋势。

**告警对照 + 引导报告**：「智能导诊与分诊系统」心跳成功率为 0%，已触发〔中〕告警，这条已产生告警，要看未处理告警吗？需要我据此生成《智能体运行监控情况报告》吗？`;
  }
  return `**直答**：${today}${scope}当日调用 **${businessKpiV18.todayCalls.toLocaleString()} 次**，**任务执行成功率** ${businessKpiV18.todaySuccessRate}%，任务中断率 **6.8%**，自助解决率 **78%**，**P95 响应时间** 4.8s；状态维度在线率 ${onlineRate}%，成本维度今日 Token ${costKpiV18.token.today.toLocaleString()}，安全维度当前高危输入已拦截。

**口径**：统计范围为${scope}，时间范围为${today === '今日' ? '今日 00:00 至当前' : today}；总体问法按业务 / 状态 / 成本 / 安全四维汇总。

**下钻**：点击 **任务执行成功率**、**调用量**、**P95 响应时间** 可进入监控明细 / 趋势页。

**告警对照 + 引导报告**：部分影像与导诊智能体已触发〔高/中〕告警。这条已产生告警，要看未处理告警吗？是否需要我生成《智能体运行监控情况报告》？`;
}

function buildMonitorReport(flow: MonitorFlow, text: string, role: '信息科管理员' | '科室管理员') {
  const scope = /放射科/.test(text) ? '放射科' : /影像科/.test(text) ? '影像科' : /全院\/本科室/.test(text) ? monitorScope(role) : flow.reportScope ?? monitorScope(role);
  const period = /年报|今年/.test(text)
    ? '年报'
    : /月报|本月|这个月/.test(text)
      ? '月报'
      : /周报|本周/.test(text)
        ? '周报'
        : /日报|今日|今天/.test(text)
          ? '日报'
          : flow.reportPeriod;
  if (!period) {
    return {
      flow: { ...flow, lastIntent: 'report' as const, reportScope: scope },
      reply: '好的。请问要看哪个统计周期的报告——日报、周报、月报还是年报？',
      quickActions: ['日报', '周报', '月报', '年报'],
    };
  }
  return {
    flow: { ...flow, lastIntent: 'report' as const, reportPeriod: period, reportScope: scope },
    reply: `已生成《智能体运行监控情况报告》（${scope}·${period}）。

报告按四维组织：
- 业务监控：调用量、成功率、响应时间、任务中断率
- 状态监控：在线率、离线/异常智能体、心跳与实例健康
- 成本监控：Token、CPU/GPU/内存使用、成本趋势
- 安全监控：注入攻击、越权访问、敏感信息外发拦截

已按当前角色套用${role === '信息科管理员' ? '《全院智能体运行监控情况报告模板》' : '《科室智能体运行监控情况报告模板》'}，可查看报告详情，也支持导出报告。`,
    link: { to: '/app/monitoring/report', text: '查看报告详情' },
    reportCard: {
      title: '智能体运行监控情况报告',
      scope,
      period,
      modules: ['业务', '状态', '成本', '安全'],
      to: '/app/monitoring/report',
    },
  };
}

function buildMonitorAlertDetail(flow: MonitorFlow, text: string) {
  const indexMatch = text.match(/\d+/);
  const index = indexMatch ? Number(indexMatch[0]) - 1 : 0;
  const alert = flow.lastAlerts?.[index];
  if (!alert) {
    return {
      reply: '暂未找到对应序号的告警。可回复告警序号，或说「查看未处理告警」重新弹出清单。',
      link: { to: '/app/monitoring/alert-events', text: '查看告警事件管理' },
    };
  }
  const condition = alert.triggerContent.trigger_condition;
  return {
    reply: `【告警触发详情】

- 智能体：${alert.agentName}
- 告警级别：${monitorAlertLevel(alert)}
- 触发指标：${condition.metric}
- 实测/阈值：${condition.description}
- 触发时间：${alert.triggerTime}
- 规则名称：${alert.triggerContent.rule_name}
- 负责人：${alert.notifyTarget.owner}

处置建议：先查看详情确认影响范围；如仍在持续，通知负责人 ${alert.notifyTarget.owner}；确认恢复后可标记处理。`,
    link: { to: `/app/monitoring/alert-events/${alert.id}`, text: '查看告警详情' },
    quickActions: ['通知负责人', '标记处理', '继续看下一条'],
  };
}

function getMonitorReply(
  flow: MonitorFlow,
  text: string,
  role: '信息科管理员' | '科室管理员',
): {
  flow: MonitorFlow;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
  reportCard?: LedgerReportCard;
  monitorAlertTable?: MonitorAlertTable;
} {
  const normalized = text.trim();
  const intent = classifyMonitorIntent(normalized, flow);
  console.info('[home-monitor-intent]', { text: normalized, intent });

  if (/API ?key|密钥|明文|患者隐私明文|越权/.test(normalized)) {
    return {
      flow: { ...flow, lastIntent: 'out_of_scope' },
      reply: '按平台安全规则，密钥与敏感字段仅可密文展示（********），我不能展示明文或越权数据。\n\n运行监控这边可以继续查看指标、告警清单或生成报告。',
      quickActions: monitorRecommendedQuestions,
    };
  }

  if (intent === 'out_of_scope') {
    return {
      flow: { ...flow, lastIntent: 'out_of_scope' },
      reply: '问题超出平台现有信息，我们将持续优化完善哟~\n\n目前我能提供的是近 30 天成本趋势、日/周/月 Token 使用量与单任务成本。需要看哪一项？',
      quickActions: ['查看近 30 天成本趋势', '今日智能体运行 token 成本消耗多少', '生成监控报告'],
    };
  }
  if (intent === 'offtopic') {
    return {
      flow: { ...flow, lastIntent: 'offtopic', pendingTodos: [...(flow.pendingTodos ?? []), normalized] },
      reply: '我们先看运行监控，稍后再为您解决此问题\n\n运行监控这边还需要看什么？',
      quickActions: monitorRecommendedQuestions,
    };
  }

  if (flow.lastIntent === 'overview_metric' && /^(否|不用|不需要|先不)[。！!.\s]*$/.test(normalized)) {
    return {
      flow: { ...flow, lastIntent: 'overview_metric' },
      reply: '好的，暂不生成报告。运行监控这边还需要看什么？',
      quickActions: ['查看未处理告警', '查看日/周/月趋势', '今日智能体运行 token 成本消耗多少？'],
    };
  }

  if (flow.lastIntent === 'alert' && (/^\d+$/.test(normalized) || /第\s*\d+|详情|通知负责人|标记处理/.test(normalized))) {
    const detail = buildMonitorAlertDetail(flow, normalized);
    return {
      flow: { ...flow, lastIntent: 'alert' },
      reply: detail.reply,
      link: detail.link,
      quickActions: detail.quickActions,
    };
  }

  if (intent === 'report') {
    return buildMonitorReport(flow, normalized, role);
  }

  if (intent === 'alert') {
    if (/^\d+$/.test(normalized) || /第\s*\d+|详情|通知负责人|标记处理/.test(normalized)) {
      const detail = buildMonitorAlertDetail(flow, normalized);
      return {
        flow: { ...flow, lastIntent: 'alert' },
        reply: detail.reply,
        link: detail.link,
        quickActions: detail.quickActions,
      };
    }
    const { alerts, rows, reply } = buildOpenAlertList(role);
    return {
      flow: { ...flow, lastIntent: 'alert', lastAlerts: alerts },
      reply,
      link: { to: '/app/monitoring/alert-events', text: '打开未处理告警清单' },
      quickActions: alerts.length ? ['展开第 1 条', '只看高危', '生成监控报告'] : ['看运行概况', '生成监控报告'],
      monitorAlertTable: { rows, emptyText: '当前暂无未处理告警，运行平稳' },
    };
  }

  if (intent === 'overview_metric' && /趋势|日\/周\/月|日周月|下钻/.test(normalized)) {
    return {
      flow: { ...flow, lastIntent: 'overview_metric', reportScope: monitorScope(role), reportPeriod: '日报' },
      reply: `已切到指标下钻视角：

- 今日调用量：4.2 万次，较昨日 +6.1%
- 本周调用量：28.6 万次，工作日 09:00–11:00 峰值明显
- 本月调用量：124.8 万次，环比 +12.4%
- P95 响应时间：今日 4.8s，本周均值 4.5s，本月均值 4.2s

口径：${monitorScope(role)}，监控中心业务/状态/成本/安全四维指标。需要我据此生成报告吗？`,
      link: { to: '/app/monitoring/business', text: '查看业务监控明细' },
      quickActions: ['生成报告', '否', '查看未处理告警'],
    };
  }

  if (intent === 'overview_metric') {
    const period = /本周|周/.test(normalized) ? '周报' : /本月|月/.test(normalized) ? '月报' : '日报';
    return {
      flow: { ...flow, lastIntent: 'overview_metric', reportScope: monitorScope(role), reportPeriod: period },
      reply: buildMonitorMetricReply(normalized, role),
      link: { to: '/app/monitoring/business', text: '查看监控明细' },
      quickActions: ['生成报告', '否', '查看未处理告警'],
    };
  }

  return {
    flow: { ...flow, lastIntent: 'clarify' },
    reply: '您是想看运行监控指标，还是未处理告警清单？',
    quickActions: ['看运行概况', '现在有哪些告警需要处理？'],
  };
}

function classifyMonitorIntent(text: string, flow: MonitorFlow): 'overview_metric' | 'alert' | 'out_of_scope' | 'offtopic' | 'clarify' | 'report' {
  if (/明年|未来|预测|预算预测|未采集|无数据源|外部平台/.test(text)) return 'out_of_scope';
  if (/排班|挂号|医保|工资|请假|采购|天气|新闻|门诊排班/.test(text)) return 'offtopic';
  if (flow.lastIntent === 'overview_metric' && /^(是|要|需要|生成|好的|好|可以|确认)[。！!.\s]*$/.test(text)) return 'report';
  if (/报告|导出|编辑|汇报|速读/.test(text)) return 'report';
  if (/告警|报警|警报|待处理|未处理|有哪些要处理|异常|触发.*阈值|处置|高危|负责人|标记处理|只看高/.test(text)) return 'alert';
  if (/运行|情况|稳不稳|总览|总体|概况|调用|成功率|中断|自助|响应|token|成本|在线|离线|状态|GPU|CPU|内存|指标|趋势|日\/周\/月|日周月|下钻|吞吐|并发/.test(text)) return 'overview_metric';
  if (flow.lastIntent === 'report' && /日报|周报|月报|年报|今日|今天|本周|本月|今年/.test(text)) return 'report';
  return 'clarify';
}

function isDirectMonitorText(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (/监控|运行|告警|报警|警报|未处理|调用|成功率|中断|响应|token|成本|在线|离线|GPU|CPU|内存|日报|周报|月报|年报|运行监控报告|智能体运行/.test(normalized)) {
    return classifyMonitorIntent(normalized, { sessionId: 'direct' }) !== 'offtopic';
  }
  if (/明年|未来|预测/.test(normalized) && /成本|token|调用|运行|告警|监控/.test(normalized)) return true;
  return false;
}

function isDirectRequirementText(text: string) {
  return /我想提需求|想建一个智能体|搭建.*智能体|建.*智能体|帮我登记个需求|登记.*需求|建设需求|提报需求|智能体建设需求|需求登记/.test(text.trim());
}

function isRequirementIntentOnlyText(text: string) {
  const normalized = text.trim().replace(/[，。！？!?,.\s]/g, '');
  return /^(我想|我要|我需要|帮我|请帮我|麻烦帮我|想|需要)?(搭建|建设|建|创建|新建|登记|新增|提报|提交|提)(一个|个)?(AI智能体|智能体|智能助手)?(建设)?(需求)?$/.test(normalized);
}

function isDirectEvaluationCreateText(text: string) {
  return /新建评测|给.*做评测|有哪些待评测|待评测|开始.*评测|智能体安全评测任务|评测进度/.test(text.trim());
}

function isDirectResourceRegisterText(text: string) {
  return /注册资源|资源注册|登记.*系统|接入个模型|接入.*模型|登记.*资源|注册.*PACS|注册.*HIS|注册.*EMR|注册.*Qwen|注册.*模型|医院资源注册/.test(text.trim());
}

function isDirectAccessText(text: string) {
  return /我要接入.*智能体|我要做纳管申请|帮我注册一个智能体|接入注册|接入申请|纳管申请|注册.*智能体|申请接入平台/.test(text.trim());
}

const ACCESS_DEMO_DETAIL_ID = 'acc-xg-001';

const ACCESS_SCENE = {
  opening:
    '你好！我是医小管。把产品说明书 / 技术规格书发给我（支持 PDF、DOC、DOCX、XLSX、csv、jpg、jpeg、png、链接等任意文件格式），或文字、语音描述，我来帮你进行智能体接入信息注册申请～',
  sidetrack: '我们先来完成智能体接入注册申请，稍后再为您解决此问题',
  duplicateName: '此名称已被使用，请重新命名',
  invalidPhone: '请输入正确的11位手机号',
  closing: '本次接入注册申请到此完成，感谢您的办理！',
  mock: {
    parseMaterial(text: string): AccessSlots {
      const accessMethod = /SDK/i.test(text) ? 'SDK' : /OTel/i.test(text) ? 'OTel' : 'API';
      const uploaded = extractAccessUploadedMaterials(text);
      const isUltrasoundAppointment = /超声/.test(text) && /预约/.test(text);
      return {
        agentName: isUltrasoundAppointment ? '超声检查预约助手' : undefined,
        version: isUltrasoundAppointment
          ? '1.0'
          : /(?:^|[^\d])([1-9]\d*\.\d)(?:[^\d]|$)/.test(text)
            ? text.match(/([1-9]\d*\.\d)/)?.[1]
            : '2.1',
        ...extractAccessDepartment(text),
        clinicStage: extractAccessClinicStage(text),
        source: /自研/.test(text) ? '自研' : /第三方|采购|外采/.test(text) ? '第三方' : '合作研发',
        vendor: /健康|科技|公司/.test(text) ? '智医健康科技有限公司' : '智医健康科技有限公司',
        contact: /陈明/.test(text) ? '陈明' : '陈明',
        phone: text.match(/\b1\d{10}\b/)?.[0] ?? (isUltrasoundAppointment ? '13800138000' : '13812345678'),
        accessMethod,
        endpoint: isUltrasoundAppointment
          ? 'https://api.hospital.local/agent/access/v1'
          : accessMethod === 'API'
            ? 'https://api.xxhealth.com/dm-followup/v2'
            : 'https://sdk.xxhealth.com/platform',
        apiKeyMasked: '********',
        functionDescription: isUltrasoundAppointment
          ? buildAccessFunctionDescription('超声')
          : buildAccessFunctionDescription(),
        materials: uploaded.materials,
        techSpecUploaded: uploaded.techSpecUploaded,
        productDocUploaded: uploaded.productDocUploaded,
      };
    },
    testConnectivity(slots: AccessSlots, fixed = false) {
      if (!fixed) return { ok: false, message: '失败：认证不通过（401）' };
      const method = slots.accessMethod ?? 'API';
      const label = method === 'SDK' ? '平台 URL、平台密钥与埋点代码校验通过' : method === 'OTel' ? '平台 URL 地址可达' : '接口响应正常';
      return { ok: true, message: `通过（320ms，${label}）` };
    },
    generateMaterials(slots: AccessSlots) {
      return [
        '技术规格书.pdf（由上传材料转换，内容达标）',
        '产品说明书（自动生成）.pdf',
      ];
    },
  },
};

function extractAccessDepartment(text: string): Pick<AccessSlots, 'department' | 'departmentCode'> {
  if (/超声|超声医学/.test(text)) return { department: '超声医学科', departmentCode: '0601' };
  if (/内分泌/.test(text)) return { department: '内分泌科', departmentCode: '0503' };
  if (/影像|放射/.test(text)) return { department: '影像科', departmentCode: '0201' };
  if (/心内|心血管/.test(text)) return { department: '心内科', departmentCode: '0301' };
  if (/门诊/.test(text)) return { department: '门诊部', departmentCode: '0101' };
  return { department: '信息中心', departmentCode: '0001' };
}

function extractAccessClinicStage(text: string) {
  if (/导诊|分诊/.test(text)) return '导诊分诊';
  if (/预问诊/.test(text)) return '预问诊';
  if (/预约|挂号/.test(text)) return '预约挂号';
  if (/检查|检验|影像|超声|PACS|LIS/.test(text)) return '辅助检查';
  if (/诊断|判读|解读/.test(text)) return '辅助诊断';
  if (/治疗|处方|用药/.test(text)) return '辅助治疗';
  if (/住院|病程/.test(text)) return '住院';
  if (/手术/.test(text)) return '手术';
  return '其他';
}

function extractAccessAgentName(text: string) {
  const quoted = text.match(/[“"《「]([^”"》」]{2,20})(?:[”"》」])/);
  if (quoted?.[1]) return quoted[1].replace(/智能体$/, '助手').slice(0, 20);
  if (/超声/.test(text) && /预约/.test(text)) return '超声检查预约助手';
  if (/糖尿病|随访/.test(text)) return '内分泌糖尿病随访管理助手';
  if (/影像|放射/.test(text)) return '影像辅助诊断助手';
  if (/处方|用药/.test(text)) return '处方前置审核助手';
  return '智能体接入助手';
}

function extractAccessUploadedMaterials(text: string) {
  const materials: string[] = [];
  const hasUploadSignal = /上传|已传|附件|文件|PDF|pdf|docx?|DOCX?|材料/.test(text);
  if (!hasUploadSignal) return { materials, techSpecUploaded: false, productDocUploaded: false };
  const techSpecUploaded = /技术规格|技术文档|接口文档|规格书/.test(text);
  const productDocUploaded = /产品说明|产品文档|产品.*说明书/.test(text);
  const pickName = (keyword: RegExp, fallback: string) => {
    const match = text.match(new RegExp(`[^、，,\\s]*(?:${keyword.source})[^、，,\\s]*`, 'i'))?.[0];
    return (match ?? fallback).replace(/^已上传/, '');
  };
  const materialLabel = (name: string) =>
    /\.pdf$/i.test(name) ? `${name}（已上传，内容达标）` : `${name}（已上传，内容达标，将转 PDF 留存）`;
  if (techSpecUploaded) materials.push(materialLabel(pickName(/技术规格|技术文档|接口文档|规格书/, '技术规格书.pdf')));
  if (productDocUploaded) materials.push(materialLabel(pickName(/产品说明|产品文档|产品.*说明书/, '产品说明书.pdf')));
  return { materials, techSpecUploaded, productDocUploaded };
}

function isAccessMaterialsComplete(slots: AccessSlots) {
  const materialText = (slots.materials ?? []).join('、');
  return Boolean(
    (slots.techSpecUploaded || /技术规格|技术文档|接口文档|规格书/.test(materialText)) &&
      (slots.productDocUploaded || /产品说明|产品文档|产品.*说明书/.test(materialText)),
  );
}

function getAccessMissingMaterialTypes(slots: AccessSlots) {
  const materialText = (slots.materials ?? []).join('、');
  const missingTech = !(slots.techSpecUploaded || /技术规格|技术文档|接口文档|规格书/.test(materialText));
  const missingProduct = !(slots.productDocUploaded || /产品说明|产品文档|产品.*说明书/.test(materialText));
  return { missingTech, missingProduct };
}

function normalizeAccessReadySlots(slots: AccessSlots): AccessSlots {
  const next = { ...slots };
  if (!next.connectivity && next.accessMethod === 'API' && next.endpoint && next.apiKeyMasked) {
    next.connectivity = ACCESS_SCENE.mock.testConnectivity(next, true).message;
  }
  return next;
}

function isBlankAccessValue(value: unknown) {
  return String(value ?? '').trim().length === 0;
}

function isValidAccessPhone(value?: string) {
  return /^1\d{10}$/.test(String(value ?? '').trim());
}

function isValidAccessUrl(value?: string) {
  return /^https?:\/\/[^\s，,。；;]+$/i.test(String(value ?? '').trim());
}

function getAccessBaseRows(): AccessFormField[] {
  return [
    { key: 'agentName', label: '名称', placeholder: '请输入智能体名称' },
    { key: 'version', label: '版本', placeholder: '请输入版本号，例如 1.0' },
    { key: 'department', label: '所属科室', placeholder: '请输入所属科室' },
    { key: 'clinicStage', label: '诊疗环节', placeholder: '请选择或填写诊疗环节' },
    { key: 'functionDescription', label: '功能描述', multiline: true, placeholder: '请说明服务对象、读取信息与输出结果' },
    { key: 'source', label: '来源', placeholder: '请输入自研 / 第三方 / 合作研发' },
    { key: 'vendor', label: '供应商', placeholder: '请输入供应商或开发单位' },
    { key: 'contact', label: '技术联系人', placeholder: '请输入技术联系人姓名' },
    { key: 'phone', label: '联系方式', placeholder: '请输入 11 位手机号' },
  ];
}

function getAccessMissingLabels(slots: AccessSlots) {
  const missing = getAccessFieldMissingLabels(slots);
  if (!isAccessMaterialsComplete(slots)) missing.push('备案材料');
  if (!/通过/.test(String(slots.connectivity ?? ''))) missing.push('联通测试');
  return missing;
}

function getAccessFieldMissingLabels(slots: AccessSlots) {
  const rows = getAccessBaseRows();
  const missing = rows
    .filter((row) => isBlankAccessValue(slots[row.key]) || (row.key === 'phone' && !isValidAccessPhone(slots.phone)))
    .map((row) => row.label);
  const mode = slots.accessMethod === 'SDK' || slots.accessMethod === 'OTel' ? slots.accessMethod : 'API';
  if (mode === 'API') {
    if (isBlankAccessValue(slots.endpoint) || !isValidAccessUrl(slots.endpoint)) missing.push('接口地址');
    if (isBlankAccessValue(slots.apiKeyMasked)) missing.push('API key');
  } else {
    if (isBlankAccessValue(slots.platformUrl) || !isValidAccessUrl(slots.platformUrl)) missing.push('平台 URL 地址');
    if (isBlankAccessValue(slots.platformKey)) missing.push('平台密钥 key');
    if (isBlankAccessValue(slots.instrumentationCode)) missing.push('埋点代码生成');
  }
  return missing;
}

function shouldRenderAccessForm(flow: AccessFlow, replyIndex: number, replyCount: number) {
  return flow.step !== 'done' && replyIndex === replyCount - 1;
}

function buildAccessMaterialCheck(slots: AccessSlots) {
  const missing = [
    !slots.techSpecUploaded && '技术规格书 / 技术文档',
    !slots.productDocUploaded && '产品说明书 / 产品文档',
  ].filter(Boolean);
  return `已识别到完整接入申请信息。

- 描述信息：完整
- 技术信息：完整
- API key：********（已密文保存）
- 联通测试：${slots.connectivity ?? '已具备测试条件，材料齐全后自动执行'}
- 材料核验：${missing.length > 0 ? `仍缺 ${missing.join('、')}` : '材料齐全'}

请点击【上传备案材料】选择文件，或将产品说明书、技术规格书直接拖拽到对话界面中。材料齐全后我会给出最终汇总确认卡。`;
}

function buildAccessReadySummary(slots: AccessSlots) {
  return `描述信息完整 + 材料齐全 + 连通测试通过，可以提交。

${buildAccessSummary(slots)}`;
}

const ACCESS_SUBMIT_QUICK_ACTIONS = ['确认提交'];
const ACCESS_UPLOAD_QUICK_ACTIONS = ['上传备案材料'];

function extractCompleteAccessSlots(text: string): AccessSlots | null {
  const normalized = text.trim();
  const accessMethod = /SDK/i.test(normalized) ? 'SDK' : /OTel/i.test(normalized) ? 'OTel' : 'API';
  const endpoint =
    normalized.match(/https?:\/\/[^\s，,。；;]+/i)?.[0] ??
    (accessMethod === 'API'
      ? 'https://api.hospital.local/agent/access/v1'
      : 'https://platform.hospital.local/agent/sdk');
  const hasCredential = accessMethod !== 'API' || /key|密钥|鉴权|认证|token|已提供/i.test(normalized);
  const enoughContext =
    normalized.length >= 40 &&
    /智能体|助手|系统|应用/.test(normalized) &&
    /科|门诊|中心/.test(normalized) &&
    /接入|接口|API|SDK|OTel|地址|key|鉴权|供应商|联系人|手机号/.test(normalized) &&
    Boolean(endpoint) &&
    hasCredential;
  if (!enoughContext) return null;

  const dept = extractAccessDepartment(normalized);
  const phone = normalized.match(/\b1\d{10}\b/)?.[0] ?? '13800138000';
  const contactMatch = normalized.match(/(?:联系人|提出人|技术联系人|负责人)(?:是|为|：|:)?\s*([\u4e00-\u9fa5]{2,10})/);
  const vendorMatch = normalized.match(/(?:供应商|厂商|开发单位)(?:是|为|：|:)?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,30})/);
  const source = /自研/.test(normalized) ? '自研' : /第三方|采购|外采/.test(normalized) ? '第三方' : '合作研发';
  const agentName = extractAccessAgentName(normalized);
  const uploaded = extractAccessUploadedMaterials(normalized);

  return {
    agentName,
    version: normalized.match(/(?:版本|v|V)?\s*([1-9]\d*\.\d)/)?.[1] ?? '1.0',
    ...dept,
    clinicStage: extractAccessClinicStage(normalized),
    functionDescription: normalized.length > 500 ? normalized.slice(0, 500) : normalized,
    source,
    vendor: vendorMatch?.[1] ?? (source === '自研' ? '本院信息科' : '智医健康科技有限公司'),
    contact: contactMatch?.[1] ?? '陈明',
    phone,
    accessMethod,
    endpoint,
    apiKeyMasked: '********',
    connectivity: ACCESS_SCENE.mock.testConnectivity({ accessMethod, endpoint }, true).message,
    materials: uploaded.materials,
    techSpecUploaded: uploaded.techSpecUploaded,
    productDocUploaded: uploaded.productDocUploaded,
  };
}

function extractPartialAccessSlots(text: string): AccessSlots {
  const normalized = text.trim();
  if (!normalized) return {};
  const accessMethod = /SDK/i.test(normalized) ? 'SDK' : /OTel/i.test(normalized) ? 'OTel' : /API|接口|key|鉴权|token/i.test(normalized) ? 'API' : undefined;
  const endpoint = normalized.match(/https?:\/\/[^\s，,。；;]+/i)?.[0];
  const phone = normalized.match(/\b1\d{10}\b/)?.[0];
  const contactMatch = normalized.match(/(?:联系人|提出人|技术联系人|负责人)(?:是|为|：|:)?\s*([\u4e00-\u9fa5]{2,10})/);
  const vendorMatch = normalized.match(/(?:供应商|厂商|开发单位)(?:是|为|：|:)?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,30})/);
  const hasDept = /超声|内分泌|影像|放射|心内|心血管|门诊|信息中心|科|中心/.test(normalized);
  const uploaded = extractAccessUploadedMaterials(normalized);
  const source = /自研/.test(normalized) ? '自研' : /第三方|采购|外采/.test(normalized) ? '第三方' : /合作/.test(normalized) ? '合作研发' : undefined;
  return {
    agentName: /智能体|助手|系统|应用/.test(normalized) ? extractAccessAgentName(normalized) : undefined,
    version: normalized.match(/(?:版本|v|V)?\s*([1-9]\d*\.\d)/)?.[1],
    ...(hasDept ? extractAccessDepartment(normalized) : {}),
    clinicStage: /导诊|分诊|预问诊|预约|挂号|检查|检验|影像|超声|PACS|LIS|诊断|判读|解读|治疗|处方|用药|住院|病程|手术/.test(normalized)
      ? extractAccessClinicStage(normalized)
      : undefined,
    functionDescription: normalized.length >= 12 && /智能体|助手|系统|应用|服务|读取|生成|提醒|建议|接入/.test(normalized)
      ? normalized.slice(0, 500)
      : undefined,
    source,
    vendor: vendorMatch?.[1],
    contact: contactMatch?.[1],
    phone,
    accessMethod,
    endpoint,
    apiKeyMasked: /key|密钥|鉴权|认证|token|已提供/i.test(normalized) ? '********' : undefined,
    materials: uploaded.materials,
    techSpecUploaded: uploaded.techSpecUploaded,
    productDocUploaded: uploaded.productDocUploaded,
  };
}

function getAccessDoneActionLinks(): Array<{ to: string; text: string }> {
  return [{ text: '查看详情', to: `/app/agent-center/detail/${ACCESS_DEMO_DETAIL_ID}` }];
}

function buildAccessFunctionDescription(scene?: string): string {
  if (scene === '超声') {
    return '面向门诊和住院患者提供超声检查智能预约与检前指导服务，读取 HIS、EMR、检查预约系统中的患者基础信息、医生医嘱、检查项目、可预约时段和检查注意事项，自动生成预约建议、检前准备提醒、改约提醒和结构化预约记录。';
  }
  return '面向出院及门诊糖尿病患者提供随访服务，读取患者基础信息、诊疗记录、检验指标与随访计划，自动生成随访任务、健康提醒与异常风险提示，并向责任医生输出结构化随访报告与风险提醒。';
}

function getAccessNext(
  flow: AccessFlow,
  text: string,
): {
  flow: AccessFlow;
  replies: string[];
  link?: { to: string; text: string };
  actionLinks?: Array<{ to: string; text: string }>;
  quickActions?: string[];
} {
  const normalized = text.trim();
  const slots: AccessSlots = { ...flow.slots };
  const yes = /确认|可以|没问题|就用|提交|无误|通过|好/.test(normalized);
  const accessIntent = /确认提交|提交|确认|修改/.test(normalized) ? 'submit_or_modify' : 'material_or_field';
  console.info('[home-access-intent]', { intent: accessIntent, step: flow.step });

  if (/放弃|不办了|先不申请|取消申请|退出/.test(normalized)) {
    return {
      flow: { ...flow, step: 'done', slots: { ...slots, draftSaved: true } },
      replies: ['已为您保存接入注册申请草稿，草稿（含已上传材料与已填字段）保留 7 天。'],
      link: { to: '/app/agent-center', text: '查看接入申请草稿' },
    };
  }

  if (/排班|台账|告警|报告|先查|天气|新闻/.test(normalized) && flow.step !== 'summary') {
    return {
      flow,
      replies: [`${ACCESS_SCENE.sidetrack}\n\n${currentAccessQuestion(flow)}`],
    };
  }

  if (flow.step !== 'summary' && flow.step !== 'done') {
    const extractedSlots = extractCompleteAccessSlots(`${slots.functionDescription ?? ''} ${normalized}`);
    if (extractedSlots) {
      const completeSlots = normalizeAccessReadySlots(extractedSlots);
      const materialComplete = isAccessMaterialsComplete(completeSlots);
      return {
        flow: { ...flow, step: materialComplete ? 'summary' : 'materialConfirm', slots: completeSlots },
        replies: [
          materialComplete
            ? buildAccessReadySummary(completeSlots)
            : buildAccessMaterialCheck(completeSlots),
        ],
        quickActions: materialComplete ? ACCESS_SUBMIT_QUICK_ACTIONS : ACCESS_UPLOAD_QUICK_ACTIONS,
      };
    }
  }

  switch (flow.step) {
    case 'collectMaterial': {
      if (/超过30M|无法解析|解析失败|损坏|打不开/.test(normalized)) {
        return {
          flow,
          replies: ['材料基础校验未通过：当前文件不可解析或超过 30M。请改用 PDF、DOC、DOCX、XLSX、csv、jpg、jpeg、png、链接等格式，或改为文字描述。'],
          quickActions: ACCESS_UPLOAD_QUICK_ACTIONS,
        };
      }
      Object.assign(slots, ACCESS_SCENE.mock.parseMaterial(normalized));
      if (isAccessMaterialsComplete(slots) && slots.agentName && slots.department && slots.clinicStage) {
        const readySlots = normalizeAccessReadySlots(slots);
        return {
          flow: { ...flow, step: 'summary', slots: readySlots },
          replies: [
            `收到，正在识别……\n\n${buildAccessReadySummary(readySlots)}`,
          ],
          quickActions: ACCESS_SUBMIT_QUICK_ACTIONS,
        };
      }
      return {
        flow: { ...flow, step: 'agentName', slots },
        replies: [
          `收到，正在识别……

我已自动填充：

- 智能体版本：${slots.version}
- 功能描述：${slots.functionDescription}
- 来源：${slots.source}
- 供应商：${slots.vendor}
- 技术联系人：${slots.contact}
- 联系方式：${slots.phone}
- 接入方式：${slots.accessMethod}
- 接口地址：${slots.endpoint}
- API key：********（已密文保存）

仍缺失：智能体名称、所属科室、诊疗环节；另外产品说明书尚未提供，我后面可依据已填字段自动生成 PDF。

先确认智能体名称——请问它叫什么？（2–20 个字符）`,
        ],
        quickActions: ['糖尿病随访助手', '内分泌糖尿病随访管理助手'],
      };
    }
    case 'agentName': {
      const name = normalized.replace(/[。.!！]/g, '');
      if (/糖尿病随访助手$/.test(name) || name === '糖尿病随访助手') {
        return {
          flow: { ...flow, step: 'agentNameRetry', slots },
          replies: [ACCESS_SCENE.duplicateName],
          quickActions: ['内分泌糖尿病随访管理助手'],
        };
      }
      slots.agentName = name.slice(0, 20) || '内分泌糖尿病随访管理助手';
      return {
        flow: { ...flow, step: 'department', slots },
        replies: [`“${slots.agentName}”（${slots.agentName.length}/20）可用，已记录。\n\n所属科室请选择或报出：【0503 内分泌科】【0504 内分泌代谢科】。`],
        quickActions: ['0503 内分泌科', '0504 内分泌代谢科'],
      };
    }
    case 'agentNameRetry': {
      const name = normalized.replace(/[。.!！]/g, '');
      if (/糖尿病随访助手$/.test(name) || name === '糖尿病随访助手') {
        return {
          flow,
          replies: [ACCESS_SCENE.duplicateName],
          quickActions: ['内分泌糖尿病随访管理助手'],
        };
      }
      slots.agentName = name.slice(0, 20) || '内分泌糖尿病随访管理助手';
      return {
        flow: { ...flow, step: 'department', slots },
        replies: [`“${slots.agentName}”（${slots.agentName.length}/20）可用，已记录。\n\n所属科室请选择或报出：【0503 内分泌科】【0504 内分泌代谢科】。`],
        quickActions: ['0503 内分泌科', '0504 内分泌代谢科'],
      };
    }
    case 'department': {
      slots.departmentCode = /0504/.test(normalized) ? '0504' : '0503';
      slots.department = slots.departmentCode === '0504' ? '内分泌代谢科' : '内分泌科';
      return {
        flow: { ...flow, step: 'clinicStage', slots },
        replies: ['诊疗环节请选：【导诊分诊】【预问诊】【预约挂号】【辅助检查】【辅助诊断】【辅助治疗】【住院】【手术】【其他】（可点、可说、可打字）。'],
        quickActions: ['其他：出院后随访管理', '辅助治疗', '辅助诊断'],
      };
    }
    case 'clinicStage': {
      slots.clinicStage = /其他|随访/.test(normalized) ? '其他（出院后随访管理）' : normalized.slice(0, 20);
      return {
        flow: { ...flow, step: 'confirmFunction', slots },
        replies: [
          `【功能描述确认卡】

${slots.functionDescription}

（${slots.functionDescription?.length ?? 0}/500）

技术联系人“${slots.contact}”、联系方式 ${slots.phone}、接入方式 ${slots.accessMethod}、接口地址、来源“${slots.source}”、供应商“${slots.vendor}”均已识别，稍后汇总一并确认。

确认吗？（点【确认】、说“确认”或打字均可）`,
        ],
        quickActions: ['确认', '修改功能描述'],
      };
    }
    case 'confirmFunction': {
      if (!yes) {
        slots.functionDescription = normalized.slice(0, 500);
      }
      const test = ACCESS_SCENE.mock.testConnectivity(slots, false);
      slots.connectivity = test.message;
      return {
        flow: { ...flow, step: 'connectivityFix', slots },
        replies: [
          `正在对接口地址 ${slots.endpoint} 发起联通测试……

测试${test.message}。请核对 API key。`,
        ],
        quickActions: ['API key 已修正，重测', '不修正，保存草稿'],
      };
    }
    case 'connectivityFix': {
      if (/不修正|保存草稿|稍后/.test(normalized)) {
        return {
          flow: { ...flow, step: 'done', slots: { ...slots, draftSaved: true } },
          replies: ['已保存接入注册申请草稿，草稿（含已上传材料与已填字段）保留 7 天。'],
          link: { to: '/app/agent-center', text: '查看接入申请草稿' },
        };
      }
      slots.apiKeyMasked = '********';
      const test = ACCESS_SCENE.mock.testConnectivity(slots, true);
      slots.connectivity = test.message;
      return {
        flow: { ...flow, step: 'materialConfirm', slots },
        replies: [
          `已更新 API key（仍密文保存），重新测试${test.message}。

字段已齐。核验备案材料：

- 技术规格书：已上传，内容达标，将转为 PDF 留存
- 产品说明书：尚未提供

【材料生成卡】
已依据已填字段自动生成《产品说明书（自动生成）.pdf》，含产品名称、简介、主要功能、开发单位及技术联系人、产品版本。请预览确认，可以回复“就用它”；要改就说改哪儿。`,
        ],
        quickActions: ['就用它', '修改产品简介'],
      };
    }
    case 'materialConfirm': {
      const uploaded = extractAccessUploadedMaterials(normalized);
      if (uploaded.materials.length > 0) {
        slots.techSpecUploaded = slots.techSpecUploaded || uploaded.techSpecUploaded;
        slots.productDocUploaded = slots.productDocUploaded || uploaded.productDocUploaded;
        const existing = slots.materials ?? [];
        slots.materials = [...existing, ...uploaded.materials].filter(
          (item, index, arr) => arr.indexOf(item) === index,
        );
      }

      if (/修改|调整/.test(normalized) && !/就用|确认|可以/.test(normalized)) {
        return {
          flow,
          replies: ['已收到材料调整要求。Demo 已按当前字段重新生成 PDF 版备案材料，请确认是否采用。'],
          quickActions: ['就用它', '继续修改产品简介'],
        };
      }

      if (!isAccessMaterialsComplete(slots)) {
        return {
          flow: { ...flow, step: 'materialConfirm', slots },
          replies: [buildAccessMaterialCheck(slots)],
          quickActions: ACCESS_UPLOAD_QUICK_ACTIONS,
        };
      }

      slots.connectivity = slots.connectivity ?? ACCESS_SCENE.mock.testConnectivity(slots, true).message;
      return {
        flow: { ...flow, step: 'summary', slots },
        replies: [buildAccessReadySummary(slots)],
        quickActions: ACCESS_SUBMIT_QUICK_ACTIONS,
      };
    }
    case 'summary': {
      if (/修改/.test(normalized)) {
        if (/接口|地址|API|key|密钥/.test(normalized)) {
          return {
            flow: { ...flow, step: 'editEndpoint', slots },
            replies: ['请提供新的接口地址或说明 API key 已更新。技术信息变更后我会自动重跑联通测试，并刷新自动生成的备案材料。'],
            quickActions: ['接口地址不变，API key 已更新，重测'],
          };
        }
        if (/联系人|联系方式|手机号|电话/.test(normalized)) {
          return {
            flow: { ...flow, step: 'editContact', slots },
            replies: ['请提供新的技术联系人和 11 位手机号。'],
          };
        }
        return {
          flow: { ...flow, step: 'summary', slots },
          replies: ['已收到修改诉求。请说明要修改的字段，例如“修改接口地址”“修改联系人”。'],
          quickActions: ['确认提交'],
        };
      }
      if (!/(确认提交|提交|确认|没问题|无误)/.test(normalized)) {
        return {
          flow,
          replies: ['当前已到汇总确认节点。哪项要改直接说“修改××”；没问题请说“确认提交”。'],
          quickActions: ACCESS_SUBMIT_QUICK_ACTIONS,
        };
      }
      const missing = getAccessMissingLabels(slots);
      if (missing.length > 0) {
        return {
          flow: { ...flow, step: 'summary', slots },
          replies: [`当前表单信息还不完整，仍缺：${missing.join('、')}。请先在表单内补齐。`],
          quickActions: ACCESS_UPLOAD_QUICK_ACTIONS,
        };
      }
      return {
        flow: { ...flow, step: 'done', slots },
        replies: [
          `接入注册申请已提交！

- 智能体编号：${slots.departmentCode ?? '0503'}-0001（按“科室编号-准入顺序号”自动生成）
- 名称：${slots.agentName ?? '内分泌糖尿病随访管理助手'}
- 版本：${slots.version ?? '2.1'}

${ACCESS_SCENE.closing}`,
        ],
        actionLinks: getAccessDoneActionLinks(),
      };
    }
    case 'editContact': {
      const phone = normalized.match(/\b1\d{10}\b/)?.[0];
      const name = normalized.replace(/\b1\d{10}\b/g, '').replace(/[，,。.!！\s]/g, '').slice(0, 10);
      if (!phone) {
        return {
          flow,
          replies: [ACCESS_SCENE.invalidPhone],
        };
      }
      slots.contact = name.length >= 2 ? name : slots.contact ?? '陈明';
      slots.phone = phone;
      return {
        flow: { ...flow, step: 'summary', slots },
        replies: [buildAccessSummary(slots)],
        quickActions: ACCESS_SUBMIT_QUICK_ACTIONS,
      };
    }
    case 'editEndpoint': {
      const url = normalized.match(/https?:\/\/[^\s，,]+/i)?.[0];
      if (url) slots.endpoint = url;
      slots.apiKeyMasked = '********';
      const test = ACCESS_SCENE.mock.testConnectivity(slots, true);
      slots.connectivity = test.message;
      slots.materials = ACCESS_SCENE.mock.generateMaterials(slots);
      return {
        flow: { ...flow, step: 'summary', slots },
        replies: [`技术信息已更新，已自动重跑联通测试：${test.message}。\n\n备案材料已按最新技术字段刷新。\n\n${buildAccessSummary(slots)}`],
        quickActions: ACCESS_SUBMIT_QUICK_ACTIONS,
      };
    }
    default:
      return {
        flow,
        replies: ['接入注册申请已完成，本场景结束。'],
      };
  }
}

function buildAccessSummary(slots: AccessSlots): string {
  return `都齐了，核对一遍：

- 名称：${slots.agentName ?? '内分泌糖尿病随访管理助手'}
- 版本：${slots.version ?? '2.1'}
- 所属科室：${slots.departmentCode ?? '0503'} ${slots.department ?? '内分泌科'}
- 诊疗环节：${slots.clinicStage ?? '其他（出院后随访管理）'}
- 功能描述：${slots.functionDescription ?? buildAccessFunctionDescription()}
- 来源：${slots.source ?? '合作研发'}
- 供应商：${slots.vendor ?? '智医健康科技有限公司'}
- 技术联系人：${slots.contact ?? '陈明'}
- 联系方式：${slots.phone ?? '13812345678'}
- 接入方式：${slots.accessMethod ?? 'API'}
- 接口地址：${slots.endpoint ?? 'https://api.xxhealth.com/dm-followup/v2'}
- API key：********
- 备案材料：${(slots.materials ?? ['技术规格书.pdf（由上传材料转换）', '产品说明书（自动生成）.pdf']).join('、')}
- 联通测试：${slots.connectivity ?? '通过（320ms）'}

哪项要改直接说，没问题就说“提交”或点【确认提交】。`;
}

function currentAccessQuestion(flow: AccessFlow) {
  switch (flow.step) {
    case 'collectMaterial':
      return '请继续提供产品说明书 / 技术规格书，或用文字描述要接入的智能体。';
    case 'agentName':
    case 'agentNameRetry':
      return '先确认智能体名称——请问它叫什么？（2–20 个字符）';
    case 'department':
      return '所属科室请选择或报出：【0503 内分泌科】【0504 内分泌代谢科】。';
    case 'clinicStage':
      return '诊疗环节请选：导诊分诊 / 预问诊 / 预约挂号 / 辅助检查 / 辅助诊断 / 辅助治疗 / 住院 / 手术 / 其他。';
    case 'confirmFunction':
      return '请确认功能描述，或直接说明需要修改的内容。';
    case 'connectivityFix':
      return '联通测试失败，请修正技术字段后重测，或选择保存草稿。';
    case 'materialConfirm':
      return '请确认自动生成的备案材料，可以说“就用它”，要改就说改哪儿。';
    case 'summary':
      return '请核对汇总信息，确认提交或说明要修改的字段。';
    case 'editContact':
      return '请提供新的技术联系人和 11 位手机号。';
    case 'editEndpoint':
      return '请提供新的接口地址或说明 API key 已更新。';
    default:
      return '当前接入注册申请已结束。';
  }
}

function getLedgerReply(
  flow: LedgerFlow,
  text: string,
  role: '信息科管理员' | '科室管理员',
): {
  flow: LedgerFlow;
  module: string;
  reply: string;
  link?: { to: string; text: string };
  quickActions?: string[];
  candidates?: LedgerCandidate[];
  reportCard?: LedgerReportCard;
} {
  const normalized = text.trim();
  const scope = inferLedgerScope(normalized, role);
  const period = inferLedgerPeriod(normalized, flow.reportPeriod);
  const visibleAgents = getLedgerVisibleAgents(role);
  const intent = classifyLedgerIntent(normalized, flow);
  console.info('[home-ledger-intent]', { text: normalized, intent, scope, period });

  if (intent === 'offtopic') {
    return {
      flow,
      module: '台账查询 / 跑偏拉回',
      reply: '我们先看台账,稍后再为您解决此问题\n\n台账这边还需要看什么？',
      quickActions: ledgerRecommendedQuestions,
    };
  }

  if (intent === 'out_of_scope') {
    return {
      flow,
      module: '台账查询 / 超范围',
      reply:
        '问题超出平台现有信息,我们将持续优化完善哟~\n\n目前我能提供的是已纳管智能体的**近 30 天调用趋势**、**告警清单**和**360 画像**。',
      quickActions: ['查看近 30 天调用趋势', '目前智能体的告警情况', '我想要查看【某智能体】的 360 画像'],
    };
  }

  if (intent === 'report') {
    return buildLedgerReportReply(flow, visibleAgents, scope, period);
  }

  if (intent === 'single_agent') {
    const located = locateLedgerAgents(normalized, visibleAgents, flow);
    if (located.status === 'need_name') {
      return {
        flow: { ...flow, awaitingAgent: true },
        module: '台账查询 / 360 画像',
        reply: '请问看哪个智能体？可报名称或编号',
        quickActions: ['糖尿病随访管理助手', '处方审核系统', '智能导诊系统'],
      };
    }
    if (located.status === 'multiple') {
      return {
        flow: { ...flow, awaitingAgent: true },
        module: '台账查询 / 候选确认',
        reply: '找到多个可能的智能体，请选择一个继续查看 360 画像。',
        candidates: located.candidates,
      };
    }
    return buildLedgerAgentReply(flow, located.agent);
  }

  if (intent === 'drilldown') {
    return buildLedgerDrilldownReply(flow, normalized);
  }

  if (intent === 'metric') {
    return buildLedgerMetricReply(flow, visibleAgents, normalized, scope);
  }

  return {
    flow,
    module: '台账查询 / 澄清',
    reply: '您想看总体指标，还是某个智能体的 360 画像？也可以直接说“生成管理情况报告”。',
    quickActions: ledgerRecommendedQuestions,
  };
}

function getLedgerVisibleAgents(role: '信息科管理员' | '科室管理员') {
  const user: LedgerUser = role === '信息科管理员'
    ? { ...ledgerCurrentUser, role: 'platform_admin', department: '信息中心' }
    : { ...ledgerCurrentUser, role: 'dept_admin', department: '内分泌科' };
  return getVisibleAgents(user);
}

function inferLedgerScope(text: string, role: '信息科管理员' | '科室管理员') {
  if (role !== '信息科管理员') return '本科室';
  if (/全院\/本科室/.test(text)) return '全院';
  if (/本科室|我们科室|本部门/.test(text)) return '本科室';
  return '全院';
}

function inferLedgerPeriod(text: string, fallback?: '今日' | '本周' | '本月') {
  if (/本周|这周|周报/.test(text)) return '本周' as const;
  if (/本月|这个月|月报/.test(text)) return '本月' as const;
  if (/今日|今天|日报/.test(text)) return '今日' as const;
  return fallback ?? '今日';
}

function classifyLedgerIntent(text: string, flow: LedgerFlow) {
  if (/排班|挂号|天气|新闻|请假|报销|采购|工资|医保结算|门诊排班/.test(text)) return 'offtopic';
  if (/明年|未来|预测|能到多少|外部平台|患者隐私明文|明文|API ?key|密钥|密码|未采集|无数据源/.test(text)) return 'out_of_scope';
  if (flow.reportScope && /^(要|需要|生成|可以|好|好的|确认|是|行|可以的)[。！!.\s]*$/.test(text)) return 'report';
  if (/^(要|需要|生成|可以|好|确认|是|改成|改为|本周|本月|今日|今天)/.test(text) && /报告|汇报|管理情况|周|月|日/.test(text)) return 'report';
  if (/报告|汇报|管理情况|速读|订阅/.test(text)) return 'report';
  if (/风险依据|为什么.*风险|处置|资源明细|对接.*系统|拓扑|HIS|LIS|用得怎样|运行趋势|调用趋势|近 ?30 ?天|对比同类/.test(text)) return 'drilldown';
  if (/画像|360|某智能体|0503-0001|AGT-|糖尿病|随访|导诊|处方审核|影像|助手|系统/.test(text) || flow.awaitingAgent) return 'single_agent';
  if (/总体|家底|整体|总览|概况|智能体数量|多少个|纳管|科室覆盖率|总调用量|调用量|异常告警|告警|正常运行率|在线率|每月新增|新增|科室分布|诊疗环节|来源分布|风险分级|高度关注|中度关注|一般关注|分类|分布|已上线/.test(text)) return 'metric';
  return 'clarify';
}

function buildLedgerMetricReply(
  flow: LedgerFlow,
  agents: LedgerAgent[],
  text: string,
  scope: '全院' | '本科室',
) {
  const stats = {
    total: agents.length,
    coverage: getCoverageStat(agents),
    calls: getCallVolumeStat(agents),
    alarms: getAlarmStat(agents),
    onlineRate: getInstanceOnlineRateStat(agents),
    deptTop: getDepartmentDistribution(agents).slice(0, 3),
    phaseTop: getDiagnosisPhaseDistribution(agents).slice(0, 3),
    sourceTop: getSourceDistribution(agents).slice(0, 3),
    risk: getRiskDistribution(agents).summary,
  };
  const rate = Math.round(stats.coverage.rate * 100);
  const onlineRate = (stats.onlineRate.rate * 100).toFixed(1);
  const highRisk = stats.risk.find((item) => item.level === '高度关注')?.review ?? 0;
  const midRisk = stats.risk.find((item) => item.level === '中度关注')?.review ?? 0;
  const normalRisk = stats.risk.find((item) => item.level === '一般关注')?.review ?? 0;
  const flowNext = { ...flow, reportScope: scope, reportPeriod: '今日' as const };

  if (/告警|异常|故障|P0|P1/.test(text)) {
    return {
      flow: flowNext,
      module: '台账查询 / 总体指标',
      reply: `今日异常告警 **${stats.alarms.daily} 次**（本周 ${stats.alarms.weekly}，本月 ${stats.alarms.monthly}；口径：${scope}已纳管智能体接入运行后产生的告警；时间范围：今日 00:00 至当前）。\n\n点击 **告警 ${stats.alarms.daily} 次** 可查看清单，点击 **P0 告警** 可看紧急故障。\n\n需要我据此生成《智能体管理情况报告》吗？`,
      link: { to: '/app/monitoring/alert-events', text: '查看告警清单' },
      quickActions: ['生成今日智能体管理情况报告', '查看 P0 告警', '查看风险分级'],
    };
  }

  const deptText = stats.deptTop.map((item) => `${item.name} ${item.value} 个`).join('、') || '暂无科室分布数据';
  const phaseText = stats.phaseTop.map((item) => `${item.name} ${item.value} 个`).join('、') || '暂无诊疗环节数据';
  const sourceText = stats.sourceTop.map((item) => `${item.name} ${item.value} 个`).join('、') || '暂无来源数据';
  return {
    flow: flowNext,
    module: '台账查询 / 总体指标',
    reply: `${scope}智能体台账概况：已纳管 **智能体 ${stats.total} 个**，覆盖 **科室 ${stats.coverage.covered}/${stats.coverage.total}**，科室覆盖率 **${rate}%**；今日总调用量 **${stats.calls.daily.toLocaleString()} 次**，正常运行率 **${onlineRate}%**。\n\n统计口径：已审核纳管智能体；时间范围：截至今日，调用与运行指标为今日 00:00 至当前。\n\n分布结论：科室分布 TOP3 为 ${deptText}；诊疗环节 TOP3 为 ${phaseText}；来源分布为 ${sourceText}；风险分级为高度关注 ${highRisk} 个、中度关注 ${midRisk} 个、一般关注 ${normalRisk} 个。\n\n点击 **智能体 ${stats.total} 个**、**科室覆盖率 ${rate}%**、**今日总调用量 ${stats.calls.daily.toLocaleString()} 次** 或 **风险分级** 可直接查看对应清单。需要我据此生成《智能体管理情况报告》吗？`,
    link: { to: '/app/ledger/list', text: '查看台账清单' },
    quickActions: ['生成今日智能体管理情况报告', '查看科室分布', '查看风险分级'],
  };
}

function buildLedgerReportReply(
  flow: LedgerFlow,
  agents: LedgerAgent[],
  scope: '全院' | '本科室',
  period: '今日' | '本周' | '本月',
) {
  const calls = getCallVolumeStat(agents);
  const alarms = getAlarmStat(agents);
  const onlineRate = (getInstanceOnlineRateStat(agents).rate * 100).toFixed(1);
  const useTodayPlatformSummary = scope === '全院' && period === '今日';
  const reportTotal = useTodayPlatformSummary ? TODAY_LEDGER_REPORT_SUMMARY.totalAgents : agents.length;
  const reportCalls = useTodayPlatformSummary ? TODAY_LEDGER_REPORT_SUMMARY.calls : calls.daily;
  const reportOnlineRate = useTodayPlatformSummary ? TODAY_LEDGER_REPORT_SUMMARY.onlineRate : `${onlineRate}%`;
  const reportAlarms = useTodayPlatformSummary ? TODAY_LEDGER_REPORT_SUMMARY.alarms : alarms.daily;
  const reply = `已生成《智能体管理情况报告》。\n\n报告摘要：已纳管 **智能体 ${reportTotal} 个**，${period}调用 **${reportCalls.toLocaleString()} 次**，正常运行率 **${reportOnlineRate}**，异常告警 **${reportAlarms} 次**。`;
  return {
    flow: { ...flow, reportScope: scope, reportPeriod: period },
    module: '台账查询 / 管理情况报告',
    reply,
    reportCard: {
      title: '智能体管理情况报告',
      scope,
      period,
      modules: ['规模与分布', '运行与调用', '异常告警与故障', '风险分级', '准入评测进度'],
      to: '/app/ledger-demo/report',
    },
  };
}

function locateLedgerAgents(text: string, agents: LedgerAgent[], flow: LedgerFlow):
  | { status: 'need_name' }
  | { status: 'multiple'; candidates: LedgerCandidate[] }
  | { status: 'one'; agent: LedgerAgent } {
  if (/某智能体|哪个智能体|【某智能体】/.test(text) && !/糖尿病|导诊|处方|影像|AGT-|0503/.test(text)) {
    return { status: 'need_name' };
  }
  if (/^(它|该智能体|这个智能体)/.test(text) && flow.lastAgentId) {
    const agent = ledgerAgents.find((item) => item.id === flow.lastAgentId);
    if (agent) return { status: 'one', agent };
  }
  if (/0503-0001|糖尿病|随访/.test(text)) {
    const diabetes = agents.filter((item) => /糖尿病|内分泌|用药/.test(`${item.name}${item.department}${item.description}`)).slice(0, 3);
    if (diabetes.length > 1 && !/患者智能问诊|合理用药|AGT-2025-014/.test(text)) {
      return { status: 'multiple', candidates: diabetes.map(toLedgerCandidate) };
    }
    return { status: 'one', agent: diabetes[0] ?? ledgerAgents.find((item) => item.id === 'AGT-2025-014') ?? agents[0] };
  }
  const normalized = text.toLowerCase();
  const matched = agents.filter((agent) => {
    const target = `${agent.id} ${agent.idCode} ${agent.name} ${agent.nameEn ?? ''} ${agent.department}`.toLowerCase();
    return target.includes(normalized) || normalized.includes(agent.id.toLowerCase()) || normalized.includes(agent.name.toLowerCase().slice(0, 4));
  });
  if (matched.length > 1) return { status: 'multiple', candidates: matched.slice(0, 4).map(toLedgerCandidate) };
  if (matched.length === 1) return { status: 'one', agent: matched[0] };
  if (/导诊/.test(text)) return { status: 'one', agent: agents.find((item) => item.type === '导诊分诊') ?? agents[0] };
  if (/处方|用药/.test(text)) return { status: 'one', agent: agents.find((item) => item.type === '用药审核') ?? agents[0] };
  if (/影像/.test(text)) return { status: 'one', agent: agents.find((item) => item.type === '影像分析') ?? agents[0] };
  return { status: 'need_name' };
}

function toLedgerCandidate(agent: LedgerAgent): LedgerCandidate {
  return {
    code: agent.id === 'AGT-2025-014' ? '0503-0001' : agent.id,
    name: agent.name,
    version: `v${agent.version}`,
    to: `/app/ledger/detail/${agent.id}?view=360`,
    prompt: `查看 ${agent.name} 360 画像`,
  };
}

function buildLedgerAgentReply(flow: LedgerFlow, agent: LedgerAgent) {
  const displayCode = agent.id === 'AGT-2025-014' ? '0503-0001' : agent.id;
  const resources = (agent.linkedResources ?? []).slice(0, 3).map((item) => item.name).join('、') || '暂无已对接资源';
  const score = agent.evaluationReport?.totalScore ?? 88;
  const calls = agent.callVolume?.monthly ?? agent.callVolume?.total ?? 0;
  const successRate = agent.instanceOnlineRate ? (agent.instanceOnlineRate * 100).toFixed(1) : '99.1';
  return {
    flow: { ...flow, awaitingAgent: false, lastAgentId: agent.id },
    module: '台账查询 / 360 画像',
    reply: `为您找到【${displayCode} ${agent.name} · v${agent.version}】，这是它的 360 画像：所属${agent.department} / ${agent.type}；技术 ${agent.accessType}（API key ****）；对接 ${resources}；评测 ${score} 分；近 30 天调用 ${calls.toLocaleString()}、成功率 ${successRate}%。\n\n是否查看完整详情、风险依据，或对比同类智能体？`,
    link: { to: `/app/ledger/detail/${agent.id}?view=360`, text: '打开 360 画像页面' },
    quickActions: ['风险依据', '对接哪些系统', '用得怎样', '对比同类智能体'],
  };
}

function buildLedgerDrilldownReply(flow: LedgerFlow, text: string) {
  const agent = ledgerAgents.find((item) => item.id === flow.lastAgentId) ?? ledgerAgents.find((item) => item.id === 'AGT-2025-014') ?? ledgerAgents[0];
  if (/对比同类/.test(text)) {
    return {
      flow,
      module: '台账查询 / 同类对比',
      reply: `已按「${agent.type}」同类智能体对比：${agent.name} 近 30 天调用 **${(agent.callVolume?.monthly ?? 0).toLocaleString()} 次**，评测 **${agent.evaluationReport?.totalScore ?? 88} 分**，风险分级 **${agent.riskLevel}**。是否查看完整详情、风险依据，或对比同类智能体？`,
      link: { to: `/app/ledger/detail/${agent.id}?view=360&module=compare`, text: '打开同类对比' },
    };
  }
  if (/资源明细|对接.*系统|拓扑|HIS|LIS/.test(text)) {
    const resources = (agent.linkedResources ?? []).map((item) => `- ${item.name}：${item.linkType}，状态${item.linkStatus === 'abnormal' ? '异常' : '正常'}`).join('\n') || '暂无已对接资源。';
    return {
      flow,
      module: '台账查询 / 资源拓扑',
      reply: `${agent.name} 的资源拓扑如下：\n\n${resources}\n\nAPI key 与连接密钥均渲染为 ****。是否查看完整详情、风险依据，或对比同类智能体？`,
      link: { to: `/app/ledger/detail/${agent.id}?view=360&module=topology`, text: '打开资源拓扑' },
    };
  }
  if (/趋势|用得怎样|调用趋势|近 ?30 ?天/.test(text)) {
    return {
      flow,
      module: '台账查询 / 运行监测',
      reply: `${agent.name} 近 30 天调用 **${(agent.callVolume?.monthly ?? 0).toLocaleString()} 次**，今日 **${(agent.callVolume?.daily ?? 0).toLocaleString()} 次**，运行状态为 **${agent.runtimeStatus ?? agent.lifecycleStatus}**。是否查看完整详情、风险依据，或对比同类智能体？`,
      link: { to: `/app/ledger/detail/${agent.id}?view=360&module=monitor`, text: '打开运行监测' },
    };
  }
  return {
    flow,
    module: '台账查询 / 风险依据',
    reply: `${agent.name} 当前风险分级为 **${agent.riskLevel}**。\n\n风险依据：${agent.riskBasis ?? '暂无风险依据数据'}\n\n处置建议：按台账复核结果持续观察；涉及异常连接时优先核查资源拓扑。是否查看完整详情、风险依据，或对比同类智能体？`,
    link: { to: `/app/ledger/risk/${agent.id}`, text: '打开风险依据与处置' },
  };
}

function normalizeDepartment(text: string): string {
  if (/超声|B超|彩超/.test(text)) return '超声医学科';
  if (/影像|放射|CT|核磁|MRI/.test(text)) return '医学影像科';
  if (/心内|心血管/.test(text)) return '心内科';
  if (/急诊/.test(text)) return '急诊科';
  if (/检验/.test(text)) return '检验科';
  const match = text.match(/([\u4e00-\u9fa5]{2,8}科)/);
  return match?.[1] ?? '超声医学科';
}

function inferClinicStage(text: string): string {
  if (/预约|检查|超声|CT|检验|检前|报告/.test(text)) return '辅助检查';
  if (/诊断|判读|辅助诊断/.test(text)) return '辅助诊断';
  if (/导诊|分诊/.test(text)) return '导诊分诊';
  if (/预问诊|问诊/.test(text)) return '预问诊';
  if (/住院/.test(text)) return '住院';
  if (/手术/.test(text)) return '手术';
  return '辅助检查';
}

function buildFunctionDescription(slots: RequirementSlots, detailText: string): string {
  const raw = slots.rawNeed ?? '建设智能体';
  const department = slots.department ?? normalizeDepartment(`${raw} ${detailText}`);
  if (/超声|预约|检前|检查/.test(`${raw} ${detailText}`)) {
    return '面向门诊患者提供超声检查智能预约与检前指导服务。系统读取医生开具的检查申请单、检查项目、号源排班、患者基础信息与联系方式，自动推荐或安排合适检查时段，并通过微信服务号等渠道发送预约结果、空腹/憋尿等检前准备事项及改约提醒，输出预约结果单与检前指导消息。';
  }
  return `面向${department}业务人员与患者提供智能体辅助服务。系统结合用户提交的需求描述、业务单据、院内系统数据和知识库内容，自动完成信息汇总、流程提醒、结果生成与消息推送，输出可执行的业务建议、处理结果和待办提醒。`;
}

function buildReason(text: string): string {
  if (/超声|预约|排队|白跑|检前|改约|投诉/.test(text)) {
    return '目前超声检查预约主要依赖人工调度，患者排队等待时间长，检前准备事项告知不充分，容易出现当天无法检查、反复改约和投诉增多等问题。建设该智能体后，可提升预约效率与检前告知准确性，减少患者白跑和窗口人工沟通成本。';
  }
  return `当前业务处理中存在人工沟通成本高、信息分散、处理效率不稳定等问题。建设该智能体后，可将关键流程自动化、标准化，减少重复劳动，提升响应速度与服务一致性。`;
}

function buildResources(text: string): string {
  if (/HIS|RIS|超声|微信|服务号|预约/.test(text)) {
    return '业务系统：HIS、超声预约系统（RIS）、微信服务号；模型能力：大语言模型 + 规则调度引擎，由平台建议默认模型。';
  }
  return text.includes('不清楚') || text.includes('平台建议')
    ? '业务系统：HIS/EMR 等相关业务系统按评审结果接入；模型能力：大语言模型 + 规则引擎，由平台建议默认模型。'
    : text;
}

function extractRequirementDepartment(text: string) {
  const explicit = text.match(/(?:提出科室|科室|我们|我院)(?:是|为|：|:)?\s*([\u4e00-\u9fa5]{2,12}(?:科|中心|部))/)?.[1];
  if (explicit) return explicit;
  return normalizeDepartment(text);
}

function extractRequirementUrgency(text: string) {
  const explicit = text.match(/(?:需求紧急程度|紧急程度|优先级|紧急|程度)(?:是|为|：|:)?\s*(高|中|低)/)?.[1];
  if (explicit) return explicit;
  if (/高优先级|非常急|很急|尽快|紧急/.test(text)) return '高';
  if (/低优先级|不急|可排期/.test(text)) return '低';
  if (/中优先级|中等|一般|适中/.test(text)) return '中';
  return undefined;
}

function extractContact(text: string): { proposer?: string; phone?: string; phoneValid: boolean } {
  const phone = text.match(/\d{11,12}/)?.[0];
  const explicitName = text.match(/(?:提出人|联系人|申请人|我是)(?:是|为|：|:)?\s*([\u4e00-\u9fa5]{2,10})/)?.[1];
  const name = (explicitName ?? text.match(/[\u4e00-\u9fa5]{2,10}/)?.[0])?.replace(/手机|电话|联系|方式/g, '');
  return {
    proposer: name && name.length >= 2 ? name : undefined,
    phone,
    phoneValid: Boolean(phone && /^\d{11}$/.test(phone)),
  };
}

function extractPartialRequirementSlots(text: string): RequirementSlots {
  const normalized = text.trim();
  const contact = extractContact(normalized);
  const hasMeaningfulNeed = /助手|智能体|帮助|自动|预约|审核|质控|诊断|随访|输出|生成|推送|解决|问题/.test(normalized);
  const hasDepartmentSignal = /(?:提出科室|科室|我们|我院|超声|影像|放射|心内|心血管|急诊|检验)/.test(normalized);
  const hasStageSignal = /预约|检查|超声|CT|检验|检前|报告|诊断|导诊|分诊|问诊|住院|手术/.test(normalized);
  const hasReasonSignal = /现在|目前|人工|痛点|成本|效率|容易|希望|减少|提升|等待|反复|漏检|白跑|投诉/.test(normalized);
  const hasResourceSignal = /HIS|EMR|RIS|PACS|LIS|短信|企业微信|微信|预约系统|资源|系统|模型/i.test(normalized);
  const slots: RequirementSlots = {};

  if (hasMeaningfulNeed) {
    slots.rawNeed = normalized;
    slots.functionDescription = buildFunctionDescription(slots, normalized);
  }
  if (hasDepartmentSignal) slots.department = extractRequirementDepartment(normalized);
  if (hasStageSignal) slots.clinicStage = inferClinicStage(normalized);
  if (hasReasonSignal) slots.reason = buildReason(normalized);
  if (hasResourceSignal) slots.resources = buildResources(normalized);
  const urgency = extractRequirementUrgency(normalized);
  if (urgency) slots.urgency = urgency;
  if (contact.proposer && /(?:提出人|联系人|申请人|我是)/.test(normalized)) slots.proposer = contact.proposer;
  if (contact.phoneValid) slots.phone = contact.phone;

  return slots;
}

function extractCompleteRequirementSlots(text: string): RequirementSlots | null {
  const contact = extractContact(text);
  const department = extractRequirementDepartment(text);
  const clinicStage = inferClinicStage(text);
  const urgency = extractRequirementUrgency(text);
  const resources = /HIS|EMR|RIS|PACS|LIS|短信|企业微信|微信|预约系统|资源|系统|模型/i.test(text)
    ? buildResources(text)
    : undefined;
  const hasFunction = /助手|智能体|帮助|自动|预约|审核|质控|诊断|随访|输出|生成|推送/.test(text);
  const hasReason = /现在|目前|人工|痛点|成本|效率|容易|希望|减少|提升|等待|反复|漏检/.test(text);
  const complete =
    hasFunction &&
    hasReason &&
    Boolean(department) &&
    Boolean(clinicStage) &&
    Boolean(resources) &&
    Boolean(urgency) &&
    Boolean(contact.proposer) &&
    Boolean(contact.phoneValid);

  if (!complete) return null;

  return {
    rawNeed: text,
    department,
    functionDescription: buildFunctionDescription({ rawNeed: text, department }, text),
    reason: buildReason(text),
    clinicStage,
    resources,
    urgency,
    proposer: contact.proposer,
    phone: contact.phone,
  };
}

function buildRequirementSummary(slots: RequirementSlots): string {
  return '【汇总确认卡】';
}

function buildRequirementSuccess(slots: RequirementSlots): string {
  const time = '2026-07-10 11:16';
  const title = /超声|预约|检前/.test(slots.functionDescription ?? '')
    ? '超声检查智能预约与检前指导助手'
    : '智能体建设需求登记';
  return `【需求生成成功卡】

需求已生成！

- 需求标题：《${title}》（已查重）
- 序号：143
- 提出时间：${time}
- 需求文档：已生成 Word / PDF 版

正在为您自动执行智能化匹配……

【匹配结果卡】

1. AGT-0087 检查预约调度助手 —— **82%**（最高）
2. AGT-0102 患者服务通知助手 —— **64%**
3. AGT-0056 门诊智能预问诊助手 —— **41%**

「匹配情况」已回填 **82%**。可点击下方入口查看详情、预览或下载需求文档。`;
}

function getRequirementDoneActionLinks(): Array<{ to: string; text: string; download?: boolean }> {
  return [
    { text: '查看详情', to: '/app/agent-needs/detail/143' },
    { text: '需求文档预览', to: '/app/agent-needs/doc/143' },
    { text: '需求文档下载', to: '/app/agent-needs/doc/143?download=pdf', download: true },
  ];
}

function getRequirementCurrentQuestion(step: RequirementStep, slots: RequirementSlots): string {
  switch (step) {
    case 'n0':
      return '请用一两句话描述：您想建设一个什么样的智能体、主要解决什么问题？';
    case 'confirmDept':
      return `先确认科室：这条需求以【${slots.department ?? '超声医学科'}】名义提出，对吗？`;
    case 'functionDetails':
    case 'confirmFunction':
      return '这个助手主要服务谁？需要读取哪些信息、最终输出什么结果？';
    case 'reason':
    case 'confirmReason':
      return '为什么要建它？目前流程怎么做、主要痛点是什么？';
    case 'clinicStage':
      return `诊疗环节我判断为【${slots.clinicStage ?? '辅助检查'}】，对吗？`;
    case 'resources':
      return '需要对接哪些业务系统？模型方面有想法也可以说，没有就由平台建议。';
    case 'urgency':
      return '请选择需求紧急程度：【高】【中】【低】';
    case 'contact':
    case 'contactFix':
      return '请留下您的姓名（2–10 个字）与 11 位手机号。';
    case 'summary':
      return '请确认汇总信息，无误请回复「确认提交」；需要调整可回复「修改 + 字段名」。';
    default:
      return '需求登记已完成。';
  }
}

function getRequirementQuickActions(step: RequirementStep): string[] | undefined {
  if (step === 'confirmDept') return ['对', '修改科室'];
  if (step === 'confirmFunction') return ['确认', '修改功能描述'];
  if (step === 'confirmReason') return ['确认', '修改提出原因'];
  if (step === 'clinicStage') return ['导诊分诊', '预问诊', '预约挂号', '辅助检查', '辅助诊断', '辅助治疗', '住院', '手术', '其他'];
  if (step === 'urgency') return ['高', '中', '低'];
  if (step === 'summary') return undefined;
  if (step === 'done') return ['需求文档查看/下载', '查看详情'];
  return undefined;
}

function isRequirementOfftopic(text: string): boolean {
  return /查.*去年|需求状态|评审能过|评审.*通过|天气|新闻|医保|工资|采购|门诊排班|台账|监控|资源注册|接入审核|审批/.test(text);
}

function getRequirementNext(
  flow: RequirementFlow,
  text: string,
): {
  flow: RequirementFlow;
  replies: string[];
  link?: { to: string; text: string };
  actionLinks?: Array<{ to: string; text: string; download?: boolean }>;
  quickActions?: string[];
} {
  const slots = { ...flow.slots };
  const normalized = text.trim();
  const yes = /^(对|是|确认|确认提交|可以|没问题|准确|正确|好|嗯|提交)[。！!.\s]*$/.test(normalized);
  const summaryFlow = () => ({
    flow: { ...flow, step: 'summary' as RequirementStep, slots: { ...slots, returnToSummary: false } },
    replies: [buildRequirementSummary(slots)],
    quickActions: getRequirementQuickActions('summary'),
  });
  const returnOrNext = (step: RequirementStep, replies: string[], quickActions?: string[]) => {
    if (slots.returnToSummary) return summaryFlow();
    return {
      flow: { ...flow, step, slots },
      replies,
      quickActions,
    };
  };

  const intent = flow.step === 'summary' && /修改|确认|提交/.test(normalized)
    ? 'confirm_or_modify'
    : isRequirementOfftopic(normalized)
      ? 'offtopic'
      : 'provide_or_complete';
  console.info('[home-requirement-intent]', { intent, step: flow.step });

  if (intent === 'offtopic') {
    slots.sidetrack = [...(slots.sidetrack ?? []), normalized];
    return {
      flow: { ...flow, slots },
      replies: [`我们先来完成智能体建设需求登记，稍后再为您解决此问题\n\n当前问题：${getRequirementCurrentQuestion(flow.step, slots)}`],
      quickActions: getRequirementQuickActions(flow.step),
    };
  }

  if (flow.step !== 'summary' && flow.step !== 'done') {
    const completeSlots = isRequirementIntentOnlyText(normalized)
      ? null
      : extractCompleteRequirementSlots(`${slots.rawNeed ?? ''} ${normalized}`);
    if (completeSlots) {
      return {
        flow: { ...flow, step: 'summary', slots: completeSlots },
        replies: [buildRequirementSummary(completeSlots)],
        quickActions: getRequirementQuickActions('summary'),
      };
    }
  }

  switch (flow.step) {
    case 'n0': {
      if (!isRequirementIntentOnlyText(normalized)) {
        Object.assign(slots, extractPartialRequirementSlots(normalized));
        slots.rawNeed = normalized;
      }
      slots.department = slots.department ?? normalizeDepartment(normalized);
      return {
        flow: { ...flow, step: 'confirmDept', slots },
        replies: [`先确认科室：这条需求以【${slots.department}】名义提出，对吗？\n\n可回复「对」，或直接告诉我正确科室。（第 4 步/共 8 步）`],
        quickActions: getRequirementQuickActions('confirmDept'),
      };
    }
    case 'confirmDept': {
      if (!yes) slots.department = normalizeDepartment(normalized);
      return returnOrNext('functionDetails', ['这个助手主要服务谁？需要读取哪些信息、最终输出什么结果？（第 1 步/共 8 步）']);
    }
    case 'functionDetails': {
      slots.functionDescription = buildFunctionDescription(slots, normalized);
      slots.clinicStage = inferClinicStage(`${slots.rawNeed ?? ''} ${normalized}`);
      return {
        flow: { ...flow, step: 'confirmFunction', slots },
        replies: [`【功能描述确认卡】\n\n${slots.functionDescription}\n\n（约 ${slots.functionDescription.length}/500 字）\n\n确认吗？可回复「确认」，或直接说明要修改的内容。`],
        quickActions: getRequirementQuickActions('confirmFunction'),
      };
    }
    case 'confirmFunction': {
      if (!yes) slots.functionDescription = buildFunctionDescription(slots, normalized);
      return returnOrNext('reason', ['为什么要建它？目前流程怎么做、主要痛点是什么？（第 2 步/共 8 步）']);
    }
    case 'reason': {
      slots.reason = buildReason(normalized);
      return {
        flow: { ...flow, step: 'confirmReason', slots },
        replies: [`【提出原因确认卡】\n\n${slots.reason}\n\n（约 ${slots.reason.length}/300 字）\n\n确认吗？`],
        quickActions: getRequirementQuickActions('confirmReason'),
      };
    }
    case 'confirmReason': {
      if (!yes) slots.reason = buildReason(normalized);
      return returnOrNext(
        'clinicStage',
        [`诊疗环节我判断为【${slots.clinicStage ?? '辅助检查'}】，对吗？\n\n如不准确请选择：导诊分诊 / 预问诊 / 预约挂号 / 辅助检查 / 辅助诊断 / 辅助治疗 / 住院 / 手术 / 其他。（第 3 步/共 8 步）`],
        getRequirementQuickActions('clinicStage'),
      );
    }
    case 'clinicStage': {
      if (!yes) slots.clinicStage = normalized.replace(/[。.!！]/g, '').slice(0, 20);
      return returnOrNext('resources', ['需要对接哪些业务系统？比如 HIS、超声预约系统（RIS）、微信服务号等；模型方面有想法也可以说，没有就由平台建议。（第 5 步/共 8 步）']);
    }
    case 'resources': {
      slots.resources = buildResources(normalized);
      return returnOrNext(
        'urgency',
        [`所需资源记录为：${slots.resources}\n\n请选择需求紧急程度：【高】【中】【低】（第 6 步/共 8 步）`],
        getRequirementQuickActions('urgency'),
      );
    }
    case 'urgency': {
      slots.urgency = /高/.test(normalized) ? '高' : /低/.test(normalized) ? '低' : '中';
      return returnOrNext('contact', ['请留下您的姓名（2–10 个字）与 11 位手机号，仅用于评审沟通。（第 7 步/共 8 步）']);
    }
    case 'contact': {
      const contact = extractContact(normalized);
      if (contact.proposer) slots.proposer = contact.proposer;
      if (contact.phoneValid) {
        slots.phone = contact.phone;
        return summaryFlow();
      }
      return {
        flow: { ...flow, step: 'contactFix', slots },
        replies: ['请输入正确的11位手机号'],
      };
    }
    case 'contactFix': {
      const contact = extractContact(normalized);
      if (!contact.phoneValid) {
        return {
          flow: { ...flow, step: 'contactFix', slots },
          replies: ['请输入正确的11位手机号'],
        };
      }
      if (contact.proposer) slots.proposer = contact.proposer;
      slots.phone = contact.phone;
      return summaryFlow();
    }
    case 'summary': {
      if (/修改.*(联系方式|手机号|电话|提出人|联系人)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'contact', slots },
          replies: ['请重新提供提出人姓名（2–10 个字）与 11 位手机号。（第 7 步/共 8 步）'],
        };
      }
      if (/修改.*(功能|描述)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'functionDetails', slots },
          replies: ['请重新描述这个助手主要服务谁、读取哪些信息、最终输出什么结果。（第 1 步/共 8 步）'],
        };
      }
      if (/修改.*(原因|痛点|提出原因)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'reason', slots },
          replies: ['请重新说明为什么要建它：目前流程怎么做、主要痛点是什么？（第 2 步/共 8 步）'],
        };
      }
      if (/修改.*(环节|诊疗)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'clinicStage', slots },
          replies: ['请重新选择诊疗环节：导诊分诊 / 预问诊 / 预约挂号 / 辅助检查 / 辅助诊断 / 辅助治疗 / 住院 / 手术 / 其他。（第 3 步/共 8 步）'],
          quickActions: getRequirementQuickActions('clinicStage'),
        };
      }
      if (/修改.*(科室|提出科室)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'confirmDept', slots },
          replies: ['请重新提供提出科室名称。（第 4 步/共 8 步）'],
        };
      }
      if (/修改.*(资源|系统|模型)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'resources', slots },
          replies: ['请重新说明所需业务系统与模型资源。（第 5 步/共 8 步）'],
        };
      }
      if (/修改.*(紧急|程度|优先级)/.test(normalized)) {
        slots.returnToSummary = true;
        return {
          flow: { ...flow, step: 'urgency', slots },
          replies: ['请重新选择需求紧急程度：【高】【中】【低】（第 6 步/共 8 步）'],
          quickActions: getRequirementQuickActions('urgency'),
        };
      }
      if (/修改/.test(normalized)) {
        return {
          flow: { ...flow, step: 'summary', slots },
          replies: ['请说明要修改的字段，例如「修改联系方式」「修改功能描述」「修改提出原因」。'],
          quickActions: getRequirementQuickActions('summary'),
        };
      }
      if (!yes) {
        return {
          flow: { ...flow, step: 'summary', slots },
          replies: ['请确认汇总信息，无误请回复「确认提交」；需要调整可回复「修改 + 字段名」。'],
          quickActions: getRequirementQuickActions('summary'),
        };
      }
      return {
        flow: { ...flow, step: 'done', slots },
        replies: [buildRequirementSuccess(slots)],
        actionLinks: getRequirementDoneActionLinks(),
      };
    }
    default:
      return {
        flow,
        replies: ['需求登记已完成。您可以查看需求文档或进入需求详情页。'],
        actionLinks: getRequirementDoneActionLinks(),
      };
  }
}

export default HomePage;
