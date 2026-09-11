/**
 * 智能体接入中心 - 审核注册（独立下转页）
 *
 * V3.0 调整：
 *  - §4.1.1 进入审核页时由医小管主动汇报关键态势
 *  - §4.2  智能预审：在基本信息 / 技术信息 字段上直接标注疑似问题
 *    + 在技术信息区执行连通测试 + 给出预审结论（建议通过 / 建议退回）
 *  - §4.3  二次审核：管理在「人工意见」基础上作出最终结论，退回时使用汇总草稿
 *
 * V2.2：从原 Drawer 转为下转页面 + 底部固定审核操作栏。
 * 顶部为只读记录详情，底部为审核结论（Radio）+ 说明 + 二次确认。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  BugOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  EyeOutlined as EyeIcon,
  FilePdfOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_ADMIN, type TimelineNode } from './types';
import { useSmartDraft, type WelcomeReplacer } from './smart/store.tsx';
import {
  appendAuditNode,
  nowISO,
  patchAccessRecord,
  startAccessReview,
  reviewAccessRecord,
  useAccessRecords,
} from './store';
import { agentAccessApi } from '../../services/agentAccess';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * §4.2.1 字段就地打标 — 在 Descriptions.Item 的 label 旁渲染
 *  - 红(错误) / 黄(警告) / 蓝(提示) 角标 + 波浪下划线
 *  - Tooltip 展示"问题 + 原因 + 建议"摘要
 *  - 点击问题项可滚动并高亮（demo 范围内仅闪烁 1s 即可）
 */
const FieldFlag: React.FC<{
  fieldKey: string;
  problems: Array<{ id: string; severity: 'error' | 'warning' | 'info'; title: string; reason: string }>;
  label: React.ReactNode;
}> = ({ fieldKey, problems, label }) => {
  if (problems.length === 0) return <>{label}</>;
  const worst = problems.some((p) => p.severity === 'error')
    ? 'error'
    : problems.some((p) => p.severity === 'warning')
      ? 'warning'
      : 'info';
  const color = worst === 'error' ? '#FF4D4F' : worst === 'warning' ? '#FAAD14' : '#1677FF';
  const bg = worst === 'error' ? '#FFF1F0' : worst === 'warning' ? '#FFFBE6' : '#E6F4FF';
  const icon =
    worst === 'error' ? (
      <BugOutlined style={{ color: '#FF4D4F' }} />
    ) : worst === 'warning' ? (
      <WarningOutlined style={{ color: '#FAAD14' }} />
    ) : (
      <InfoCircleOutlined style={{ color: '#1677FF' }} />
    );
  const tip = (
    <div style={{ maxWidth: 320 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{icon} {fieldKey} · {problems.length} 项</div>
      {problems.map((p) => (
        <div key={p.id} style={{ fontSize: 12, marginBottom: 2 }}>
          <span style={{ color: p.severity === 'error' ? '#FF4D4F' : p.severity === 'warning' ? '#FAAD14' : '#1677FF' }}>●</span>
          {' '}{p.title}（{p.reason}）
        </div>
      ))}
    </div>
  );
  return (
    <Tooltip title={tip} color="#1F1F1F">
      <span
        data-testid={`field-flag-${fieldKey}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: bg,
          padding: '0 6px',
          borderRadius: 4,
          border: `1px solid ${color}`,
          textDecoration: 'underline wavy ' + color,
          textUnderlineOffset: 2,
          cursor: 'help',
        }}
      >
        {icon}
        {label}
      </span>
    </Tooltip>
  );
};

const Audit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const role = currentUser?.roles[0] || '';
  const loginName = currentUser?.name || '当前管理员';
  const isPlatformAdmin = role === ROLE_ADMIN;

  const records = useAccessRecords();
  const record = records.find((r) => r.id === id);

  const [confirmForm] = Form.useForm();

  // PRD §3.1.1 欢迎语：审核注册页 — 管理方 (admin) 专属文案
  //   只在管理员（信息科管理员）进入时显示,其他角色不会进入此页（侧栏/路由限制）
  //   文案里的 X（疑似问题数/预审结论）由服务在后续提供,目前先按 PRD 原文展示
  const { pushWelcomeGreeting, addMessage, appendToLastAgent } = useSmartDraft();
  useEffect(() => {
    if (!isPlatformAdmin) return;
    // PRD §3.1.1：审核页气泡直接操作【审核通过】【退回修改】(单记录页保留直接操作)
    //   点击预选审核结论并滚动到结论区,最终仍由底部「确认」按钮提交(避免误触直接落库)
    pushWelcomeGreeting('agent-center-audit', 'admin', (k, _role, surface) => {
      if (k !== 'agent-center-audit' || surface !== 'bubble') return undefined;
      const errors =
        typeof window !== 'undefined' && (window as any).__preAuditErrorCount !== undefined
          ? (window as any).__preAuditErrorCount
          : 0;
      const verdictLabel =
        typeof window !== 'undefined' && (window as any).__preAuditVerdictLabel
          ? (window as any).__preAuditVerdictLabel
          : '待定';
      return [String(errors), verdictLabel];
    }, {
      actions: [
        { key: 'test', label: '测试验证', event: 'agent-audit-run-test', enabled: true },
      ],
    });
  }, [isPlatformAdmin, pushWelcomeGreeting]);
  const [verdict, setVerdict] = useState<'通过' | '退回' | null>(null);
  const [confirming, setConfirming] = useState<'通过' | '退回' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testStage, setTestStage] = useState<number>(-1);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [showSecret, setShowSecret] = useState(false);

  // 对话区仅保留手动触发测试验证，不再代替用户选择或填写审核结论。
  useEffect(() => {
    const onRunTest = () => {
      const btn = document.querySelector('[data-testid="audit-test-button"]') as HTMLButtonElement | null;
      btn?.click();
    };
    window.addEventListener('agent-audit-run-test', onRunTest);
    return () => {
      window.removeEventListener('agent-audit-run-test', onRunTest);
    };
  }, []);

  // §4.2 智能预审状态：管理员进入页面时,运行预审并展示
  const [connRunning, setConnRunning] = useState(false);
  // §4.2.1 问题严重度筛选（all / error / warning / info）
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  // §4.2.1 联通测试 / 单条问题采纳/忽略 通过 window 全局变量 + tick 触发 React 重渲染
  const [bubbleRefreshTick, setBubbleRefreshTick] = useState(0);
  // §4.3.1 单条忽略状态：忽略后从清单移除（仅用于当前会话，不持久化）
  const [ignoredProblemIds, setIgnoredProblemIds] = useState<Set<string>>(new Set());

  // PRD §3.3.1 / §4.2.3 联通测试 5 阶段：DNS 解析 → 建连 → 认证 → 请求 → 返回
  const TEST_STAGES = ['DNS 解析', '建立连接', '鉴权验证', '发送请求', '接收响应'];

  // §4.2 预审：派生逐项可疑问题（仅基于已填信息）
  //  - 严重度 error: 必填缺失 / 格式不符 / 接口不可达
  //  - 严重度 warning: 前后不一致 / 早期版本 / 长期未审
  //  - 严重度 info: 提示性建议（如证件照过旧）
  // PRD §4.2 涵盖：必填缺失 / 不规范 / 前后不一致 / 材料与字段不匹配 / 时效问题
  const preAuditProblems = useMemo(() => {
    if (!record) return [] as Array<{ id: string; fieldKey: string; severity: 'error' | 'warning' | 'info'; title: string; reason: string }>;
    const probs: Array<{ id: string; fieldKey: string; severity: 'error' | 'warning' | 'info'; title: string; reason: string }> = [];
    // 必填缺失
    if (!record.name) probs.push({ id: 'name-missing', fieldKey: 'name', severity: 'error', title: '智能体名称为空', reason: '必填字段缺失' });
    if (!record.department)
      probs.push({ id: 'department-missing', fieldKey: 'department', severity: 'error', title: '未指定所属科室', reason: '必填字段缺失' });
    // 不规范（格式）
    if (record.version && !/^\d+\.\d+$/.test(record.version))
      probs.push({ id: 'version-format', fieldKey: 'version', severity: 'error', title: '版本号格式不符', reason: '应符合「数字.数字」' });
    if (!record.modelName)
      probs.push({ id: 'model-name-missing', fieldKey: 'modelName', severity: 'error', title: '使用模型名称为空', reason: '必填字段缺失' });
    if (!record.modelVersion)
      probs.push({ id: 'model-version-missing', fieldKey: 'modelVersion', severity: 'error', title: '使用模型版本为空', reason: '必填字段缺失' });
    else if (!/^\d+\.\d+$/.test(record.modelVersion))
      probs.push({ id: 'model-version-format', fieldKey: 'modelVersion', severity: 'error', title: '使用模型版本格式不符', reason: '应符合「数字.数字」，如 1.1 / 2.1' });
    if (!record.modelDeploymentMode)
      probs.push({ id: 'model-deployment-missing', fieldKey: 'modelDeploymentMode', severity: 'error', title: '模型部署方式为空', reason: '必填字段缺失' });
    if (record.parameterCount == null || record.parameterCount <= 0)
      probs.push({ id: 'parameter-count-invalid', fieldKey: 'parameterCount', severity: 'error', title: '参数量未正确填写', reason: '参数量须大于 0' });
    if (record.contextLength == null || !Number.isInteger(record.contextLength) || record.contextLength <= 0)
      probs.push({ id: 'context-length-invalid', fieldKey: 'contextLength', severity: 'error', title: '上下文长度未正确填写', reason: '须为正整数' });
    if (record.temperature == null || record.temperature < 0 || record.temperature > 2)
      probs.push({ id: 'temperature-invalid', fieldKey: 'temperature', severity: 'error', title: 'Temperature 未正确填写', reason: '须在 0–2 之间' });
    if (record.topP != null && (record.topP < 0 || record.topP > 1))
      probs.push({ id: 'top-p-invalid', fieldKey: 'topP', severity: 'error', title: 'Top P 填写不正确', reason: '须在 0–1 之间' });
    if (record.concurrency != null && (!Number.isInteger(record.concurrency) || record.concurrency <= 0))
      probs.push({ id: 'concurrency-invalid', fieldKey: 'concurrency', severity: 'error', title: '预计 API 并发量填写不正确', reason: '须为正整数' });
    if (!record.contactPhone || !/^1[3-9]\d{9}$/.test(record.contactPhone))
      probs.push({ id: 'phone-format', fieldKey: 'contactPhone', severity: 'error', title: '手机号格式不符', reason: '限制 11 位 1[3-9] 开头的手机号' });
    if (record.accessMode === 'API' && record.apiEndpoint && !/^https?:\/\//.test(record.apiEndpoint))
      probs.push({ id: 'endpoint-format', fieldKey: 'apiEndpoint', severity: 'error', title: '接口地址缺少协议头', reason: '应为 http(s):// 开头' });
    // 前后不一致
    if (record.source === '自研' && record.supplier)
      probs.push({ id: 'source-mismatch', fieldKey: 'supplier', severity: 'warning', title: '来源 = 自研, 不应填供应商', reason: '前后不一致' });
    // 材料与字段不匹配
    if (!record.attachments || record.attachments.length < 2)
      probs.push({ id: 'attachments-missing', fieldKey: 'attachments', severity: 'error', title: '备案材料缺失', reason: '产品说明书 + 技术规格书为必填' });
    // 时效问题
    if (record.version && /^0\./.test(record.version))
      probs.push({ id: 'version-pre-1', fieldKey: 'version', severity: 'warning', title: '版本号 < 1.0（早期版本）', reason: '建议先在沙盒内完成准入评测再发布' });
    if (record.submitTime) {
      const days = (Date.now() - new Date(record.submitTime).getTime()) / 86400000;
      if (days > 90)
        probs.push({ id: 'submit-stale', fieldKey: 'submitTime', severity: 'info', title: '提交时间超过 90 天', reason: '建议确认备案材料 / 接口地址是否仍有效' });
    }
    return probs;
  }, [record]);

  // §4.3.1 单条忽略 → 不参与预审结论 / 退回草稿汇总 / 字段标注
  const activeProblems = useMemo(
    () => preAuditProblems.filter((p) => !ignoredProblemIds.has(p.id)),
    [preAuditProblems, ignoredProblemIds],
  );

  // §4.2.1 按严重度筛选（filteredProblems）
  const filteredProblems = useMemo(
    () => (severityFilter === 'all' ? activeProblems : activeProblems.filter((p) => p.severity === severityFilter)),
    [activeProblems, severityFilter],
  );

  // 字段 → 该字段的最高严重度问题列表（用于 Descriptions.Item label 旁红/黄角标）
  const problemsByField = useMemo(() => {
    const m: Record<string, typeof activeProblems> = {};
    activeProblems.forEach((p) => {
      if (!m[p.fieldKey]) m[p.fieldKey] = [];
      m[p.fieldKey].push(p);
    });
    return m;
  }, [activeProblems]);

  // 单字段最严重等级
  const worstSeverityOf = (fieldKey: string): 'error' | 'warning' | 'info' | null => {
    const list = problemsByField[fieldKey];
    if (!list || list.length === 0) return null;
    if (list.some((p) => p.severity === 'error')) return 'error';
    if (list.some((p) => p.severity === 'warning')) return 'warning';
    return 'info';
  };

  // §4.2 联通测试结果会同时影响预审结论（接通 + 无错误 → 建议通过）
  const preAuditVerdict: '建议通过' | '建议退回' | '信息待补' = useMemo(() => {
    const fatal = activeProblems.filter((p) => p.severity === 'error').length;
    if (!record) return '信息待补';
    if (!testResult) return fatal > 0 ? '建议退回' : '信息待补';
    if (fatal > 0 || !testResult.ok) return '建议退回';
    return '建议通过';
  }, [activeProblems, testResult, record]);

  // §4.3 退回意见汇总草稿
  const returnDraft = useMemo(() => {
    if (activeProblems.length === 0 && testResult?.ok !== false) return '';
    const parts: string[] = [];
    if (activeProblems.length > 0) {
      parts.push('【预审标注问题】');
      activeProblems.forEach((p, i) =>
        parts.push(`${i + 1}. ${p.title}（${p.reason}），请检查「${p.fieldKey}」字段`),
      );
    }
    if (testResult && !testResult.ok) parts.push(`【连通测试异常】${testResult.message}`);
    parts.push('请参考以上问题逐项修改后重新提交。');
    return parts.join('\n');
  }, [activeProblems, testResult]);

  // 进入审核：状态变为「审核中」（若仍为「待审核」）
  useEffect(() => {
    if (record && record.status === '待审核') {
      // “进入审核”是辅助状态流转；失败时仍允许管理员阅读并提交最终结论，
      // 避免页面初始化阶段用非关键请求错误打断审核。
      void startAccessReview(record.id).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  if (!record) {
    return (
      <>
        <PageHeader title="审核注册" subTitle="未找到对应的注册记录" showBack onBack={() => navigate(-1)} />
        <Card>未找到该注册记录</Card>
      </>
    );
  }

  // 进入时已是审核通过的终态时继续展示记录详情，不提前返回。

  const runTest = async () => {
    if (!record) return;
    setConnRunning(true);
    setTestResult(null);
    setTestStage(0);

    // §4.2.1 智能预审 · 联通测试 — 在 Agent 对话窗口呈现
    // 不用 addMessage 推 (会被后续 addMessage 推的 summary/issue/verdict 顶到不是"最后一条")
    // 改用 window 全局状态 + Bubble 实时读取
    const total0 = Date.now();
    const initialTest = {
      steps: TEST_STAGES.map((label, i) => ({
        stage: ['dns', 'connect', 'auth', 'request', 'response'][i],
        label,
        status: i === 0 ? 'running' : 'pending',
      })),
      result: null as null | { ok: boolean; message: string },
    };
    (window as any).__preAuditTest = initialTest;
    // 占位消息：让 Bubble 知道有这条 test 消息存在
    addMessage({
      role: 'agent',
      type: 'pre-audit-test',
      content: '正在对技术信息登记的接口执行连通测试…',
      payload: { preAuditTest: initialTest, __placeholder: true } as any,
    });

    let finalResult: { ok: boolean; message: string };
    let realTest;
    try {
      realTest = await agentAccessApi.reviewConnectionTest(record.id);
      finalResult = { ok: realTest.ok, message: realTest.message };
    } catch (error) {
      finalResult = { ok: false, message: error instanceof Error ? error.message : '审核复测失败' };
      realTest = { ok: false, latencyMs: Date.now() - total0, errorCode: 'TEST_FAILED', stages: TEST_STAGES.map((label, i) => ({ stage: ['dns', 'connect', 'auth', 'request', 'response'][i], label, status: i === 0 ? 'fail' : 'pending' })) };
    }
    const ok = finalResult.ok;
    const totalMs = realTest.latencyMs;
    setTestResult(finalResult);
    (window as any).__preAuditTest = {
      steps: realTest.stages,
      result: finalResult,
      totalMs,
    };
    setBubbleRefreshTick((t) => t + 1);

    // §4.2.1 智能预审 · 汇总 — 在 Agent 对话窗口呈现
    addMessage({
      role: 'agent',
      type: 'pre-audit-summary',
      content: `已对基本信息 / 技术信息做 ${activeProblems.length === 0 ? '基础' : '逐项'}预审，标注 ${activeProblems.length} 个疑似问题（仅针对已填信息，不新增内容）。`,
      payload: {
        preAuditSummary: {
          errors: activeProblems.filter((p) => p.severity === 'error').length,
          warnings: activeProblems.filter((p) => p.severity === 'warning').length,
          infos: activeProblems.filter((p) => p.severity === 'info').length,
          total: activeProblems.length,
        },
      },
    });

    // §4.2.1 智能预审 · 逐项问题 — 在 Agent 对话窗口逐条呈现
    for (let i = 0; i < activeProblems.length; i++) {
      const p = activeProblems[i];
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 80));
      addMessage({
        role: 'agent',
        type: 'pre-audit-issue',
        content: p.title,
        payload: {
          preAuditIssue: {
            id: p.id,
            severity: p.severity,
            fieldKey: p.fieldKey,
            title: p.title,
            reason: p.reason,
            status: 'open',
          },
        },
      });
    }

    // §4.2.1 智能预审 · 结论 — 综合问题标注 + 连通结果给出建议
    const fatal = activeProblems.filter((p) => p.severity === 'error').length;
    const warn = activeProblems.filter((p) => p.severity === 'warning').length;
    let verdict: 'pass' | 'reject' | 'pending' = 'pending';
    let reason = '等待补充连通结果后再给出建议';
    if (finalResult) {
      if (fatal > 0 || !finalResult.ok) {
        verdict = 'reject';
        reason = `存在 ${fatal} 项错误 / ${warn} 项警告${!finalResult.ok ? ' + 连通失败' : ''}`;
      } else {
        verdict = 'pass';
        reason = `基本信息完整、字段格式合规、连通测试正常`;
      }
    }
    // V1.1:把 X(问题数)/XX(结论 label) 写到 window,让气泡文案替换
    const verdictLabel =
      verdict === 'pass' ? '建议通过' : verdict === 'reject' ? '建议退回' : '待定';
    (window as any).__preAuditErrorCount = activeProblems.length;
    (window as any).__preAuditVerdictLabel = verdictLabel;
    addMessage({
      role: 'agent',
      type: 'pre-audit-verdict',
      content:
        verdict === 'pass'
          ? '建议通过：人工最终确认后即可放行；任何冲突请以管理员决策为准。'
          : verdict === 'reject'
            ? '建议退回：请优先处理红色错误项，黄色警告与蓝色提示可同步修改后重提。'
            : '信息待补：等待连通结果或补充材料。',
      payload: {
        preAuditVerdict: {
          verdict,
          reason,
          fatalCount: fatal,
          warningCount: warn,
        },
      },
    });

    setTestStage(-1);
    setConnRunning(false);
    if (ok) message.success('测试验证正常');
    else message.error('测试验证异常，请再次检查技术信息填写内容');
  };

  // §4.3.1 单条问题「采纳 / 忽略」事件处理（AgentMessageBubble 通过 CustomEvent 派发）
  // - 采纳: 改 message status='adopted'，把单条文案追加到 returnReason，自动选"退回"
  // - 忽略: 改 message status='ignored'，从 activeProblems 移除（用 store filter 让消息隐藏）
  useEffect(() => {
    const onAdopt = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const p = activeProblems.find((x) => x.id === id);
      if (!p) return;
      // 1) 写 window.__preAuditIssueStatus[id] = 'adopted' 让 Bubble 灰态显示
      (window as any).__preAuditIssueStatus = (window as any).__preAuditIssueStatus || {};
      (window as any).__preAuditIssueStatus[id] = 'adopted';
      // 2) 追加到 returnReason
      const cur = confirmForm.getFieldValue('returnReason') || '';
      const line = `${p.title}（${p.reason}），请检查「${p.fieldKey}」字段`;
      confirmForm.setFieldsValue({ returnReason: cur ? `${cur}\n${line}` : line });
      // 3) 自动选"退回"
      setVerdict('退回');
      setBubbleRefreshTick((t) => t + 1);
    };
    const onIgnore = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setIgnoredProblemIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      (window as any).__preAuditIssueStatus = (window as any).__preAuditIssueStatus || {};
      (window as any).__preAuditIssueStatus[id] = 'ignored';
      setBubbleRefreshTick((t) => t + 1);
    };
    const onFilter = (e: Event) => {
      const s = (e as CustomEvent<'all' | 'error' | 'warning' | 'info'>).detail;
      setSeverityFilter(s);
      (window as any).__agentSeverityFilter = s;
      setBubbleRefreshTick((t) => t + 1);
    };
    window.addEventListener('agent-issue-adopt', onAdopt);
    window.addEventListener('agent-issue-ignore', onIgnore);
    window.addEventListener('agent-severity-filter', onFilter);
    return () => {
      window.removeEventListener('agent-issue-adopt', onAdopt);
      window.removeEventListener('agent-issue-ignore', onIgnore);
      window.removeEventListener('agent-severity-filter', onFilter);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const submitAudit = async () => {
    if (!verdict) return;
    let v: { returnReason?: string; passNote?: string } = {};
    try {
      v = await confirmForm.validateFields();
    } catch {
      return;
    }
    if (verdict === '退回' && !v.returnReason) {
      message.error('退回修改需填写退回说明');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    try {
      await reviewAccessRecord(record.id, verdict === '通过' ? 'APPROVED' : 'RETURNED', v.passNote || v.returnReason);
    } catch (error) {
      setSubmitting(false);
      message.error(error instanceof Error ? error.message : '审核失败');
      return;
    }
    setSubmitting(false);
    setConfirming(null);
    setVerdict(null);
    message.success(verdict === '通过' ? '审核通过' : '已退回，等待申请人修改');
    if (verdict === '通过') {
      // 审核通过 → 注册信息详情页，并由详情页机器人询问是否立即创建评测任务。
      navigate(`/app/agent-center/detail/${record.id}`, {
        state: { offerEvaluationAfterAudit: true },
        replace: true,
      });
    } else {
      // 退回 → 直接跳到「退回修改」Tab
      navigate('/app/agent-center?tab=退回修改');
    }
  };

  return (
    <>
      <PageHeader
        title={`审核注册：${record.name}`}
        subTitle={`申请人：${record.applicant} · 提交时间：${record.submitTime || '--'}`}
        showBack
        onBack={() => navigate('/app/agent-center')}
        breadcrumb={[
          { path: '/app/agent-center', breadcrumbName: '智能体接入中心' },
          { path: '/app/agent-center', breadcrumbName: '注册管理' },
          { path: id ? `/app/agent-center/audit/${id}` : '', breadcrumbName: '审核' },
        ]}
      />

      <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 12 }}>
        {/* §4.2.1 PRD 严格措辞：
            问题标注就地定位到具体字段 / 材料（角标 / 下划线 / Tooltip） — 由 FieldFlag 承担
            问题清单汇总、联通结果与预审结论 由 Agent 气泡 / 对话窗口集中呈现
            **不新增「智能预审 · 问题清单」独立页面 / 卡片 / 面板 / 状态条** — 已在 AgentAssistant 对话窗口推 4 条消息（summary/issue/test/verdict） */}

        <Card
          title={
            <Space>
              <span>备案材料</span>
              {(problemsByField.attachments || []).length > 0 && (
                <FieldFlag
                  fieldKey="attachments"
                  problems={problemsByField.attachments || []}
                  label="材料缺失"
                />
              )}
            </Space>
          }
          size="small"
        >
          {record.attachments.length === 0 && <span style={{ color: '#999' }}>无备案材料</span>}
          {record.attachments.map((a, i) => (
            <Row key={i} gutter={8} align="middle" style={{ padding: '6px 0' }}>
              <Col flex="auto">
                <Space>
                  <FilePdfOutlined style={{ color: '#d4380d' }} />
                  <Text>附件 {i + 1}：{a.name}</Text>
                  <Text type="secondary">（{a.size}）</Text>
                </Space>
              </Col>
              <Col>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeIcon />}
                  onClick={() => {
                    Modal.info({
                      title: `预览：${a.name}`,
                      width: 720,
                      content: (
                        <div style={{ marginTop: 8 }}>
                          <div
                            style={{
                              background: '#fafafa',
                              border: '1px solid #f0f0f0',
                              borderRadius: 4,
                              padding: '40px 24px',
                              textAlign: 'center',
                              color: '#999',
                            }}
                          >
                            <FilePdfOutlined style={{ fontSize: 36, color: '#d4380d' }} />
                            <div style={{ marginTop: 8 }}>{a.name}</div>
                            <div style={{ marginTop: 4, fontSize: 12 }}>
                              （{a.size}）演示文件仅展示元信息
                            </div>
                          </div>
                        </div>
                      ),
                    });
                  }}
                >
                  预览
                </Button>
              </Col>
            </Row>
          ))}
        </Card>
        <Card title="基本信息" size="small">
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={<FieldFlag fieldKey="name" problems={problemsByField.name || []} label="智能体名称" />}>
              {record.name || <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="智能体编号">{record.agentCode}</Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="department" problems={problemsByField.department || []} label="所属科室" />}>
              {record.department || <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="诊疗环节">{record.clinicalStage}</Descriptions.Item>
            <Descriptions.Item label="智能体来源">{record.source}</Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="supplier" problems={problemsByField.supplier || []} label="供应商名称" />}>
              {record.source === '自研' ? '--' : record.supplier}
            </Descriptions.Item>
            <Descriptions.Item label="技术联系人">{record.contactName}</Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="contactPhone" problems={problemsByField.contactPhone || []} label="联系方式" />}>
              {record.contactPhone || <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="智能体类型">{record.type}</Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="version" problems={problemsByField.version || []} label="智能体版本" />}>
              {record.version || <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            {(record.modelConfigs?.length
              ? record.modelConfigs
              : [{
                  modelName: record.modelName || '',
                  modelVersion: record.modelVersion || '',
                  deploymentMode: record.modelDeploymentMode || '',
                }]
            ).map((model, index) => (
              <Descriptions.Item key={`${model.modelName}-${index}`} label={`模型信息 ${index + 1}`} span={2}>
                {model.modelName && model.modelVersion && model.deploymentMode
                  ? `${model.modelName} / ${model.modelVersion} / ${model.deploymentMode}`
                  : <Text type="secondary">（未完整填写）</Text>}
              </Descriptions.Item>
            ))}
            <Descriptions.Item label="功能描述" span={2}>
              <Paragraph style={{ marginBottom: 0 }}>{record.description}</Paragraph>
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card
          title="技术信息"
          size="small"
          extra={<Button data-testid="audit-test-button" onClick={runTest} size="small" icon={<ReloadOutlined />} loading={testStage >= 0}>测试验证</Button>}
        >
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={<FieldFlag fieldKey="parameterCount" problems={problemsByField.parameterCount || []} label="参数量（单位：十亿）" />}>
              {record.parameterCount != null ? `${record.parameterCount} B` : <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="contextLength" problems={problemsByField.contextLength || []} label="上下文长度（单位：token）" />}>
              {record.contextLength != null ? `${record.contextLength} K` : <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="temperature" problems={problemsByField.temperature || []} label="Temperature" />}>
              {record.temperature != null ? record.temperature : <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="topP" problems={problemsByField.topP || []} label="Top P" />}>
              {record.topP != null ? record.topP : <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={<FieldFlag fieldKey="concurrency" problems={problemsByField.concurrency || []} label="预计 API 并发量" />}>
              {record.concurrency != null ? record.concurrency : <Text type="secondary">（未填）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="接入方式">
              <Tag color="blue">{record.accessMode} 接入</Tag>
            </Descriptions.Item>
            {record.accessMode === 'API' ? (
              <>
                <Descriptions.Item span={2} label={<FieldFlag fieldKey="apiEndpoint" problems={problemsByField.apiEndpoint || []} label="接口地址" />}>
                  <Text copyable>{record.apiEndpoint || <Text type="secondary">（未填）</Text>}</Text>
                </Descriptions.Item>
                <Descriptions.Item span={2} label="API key">
                  <Space>
                    <Text code>
                      {showSecret
                        ? (record.apiKey || 'sk-****')
                        : ((record.apiKey || 'sk-****').replace(/(?<=.{4}).(?=.{4})/g, '*'))}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={showSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowSecret((s) => !s)}
                    >
                      {showSecret ? '隐藏' : '显示'}
                    </Button>
                  </Space>
                </Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item span={2} label="平台 URL 地址"><Text copyable>{record.platformUrl}</Text></Descriptions.Item>
                <Descriptions.Item span={2} label="平台密钥 key">
                  <Space>
                    <Text code>
                      {showSecret
                        ? (record.platformKey || 'sk-****')
                        : ((record.platformKey || 'sk-****').replace(/(?<=.{4}).(?=.{4})/g, '*'))}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={showSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowSecret((s) => !s)}
                    >
                      {showSecret ? '隐藏' : '显示'}
                    </Button>
                  </Space>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
          {/* §4.2.1 PRD：连通测试结果 / 异常诊断在 Agent 气泡 / 对话窗口呈现
              技术信息区不再就地展示步骤条 / 状态条（仅保留工具栏"测试验证"按钮触发） */}
        </Card>
      </Space>

      {/* 审核结论 — §4.2.1 预审结论统一在 Agent 对话窗口呈现, 此处不再放预审 Tag */}
      {isPlatformAdmin && (
        <Card
          title={<span>审核结论</span>}
          data-testid="audit-verdict-section"
          style={{ marginTop: 16, marginBottom: 16 }}
        >
          <Form form={confirmForm} layout="vertical">
            <div data-testid="audit-verdict-field">
              <Form.Item
                name="verdict"
                label="审核结论"
                rules={[{ required: true, message: '请选择审核结论' }]}
              >
                <Radio.Group
                  onChange={(e) => setVerdict(e.target.value)}
                  options={[
                    { label: '审核通过', value: '通过' },
                    { label: '退回修改', value: '退回' },
                  ]}
                />
              </Form.Item>
            </div>
            {verdict === '退回' && (
              <div data-testid="audit-explanation-field">
                <Form.Item
                  name="returnReason"
                  label="退回说明"
                  rules={[{ required: true, message: '请填写退回说明' }, { max: 500, message: '≤ 500 字' }]}
                  tooltip="明确指出需修改的字段或材料问题"
                >
                  <TextArea rows={4} maxLength={500} showCount placeholder="请手动填写需修改的字段或材料问题" />
                </Form.Item>
              </div>
            )}
            {verdict === '通过' && (
              <div data-testid="audit-explanation-field">
                <Form.Item
                  name="passNote"
                  label="具体说明"
                  rules={[{ max: 500, message: '≤ 500 字' }]}
                  tooltip="如有条件通过的备注或通过意见"
                >
                  <TextArea rows={4} maxLength={500} showCount placeholder="请手动填写通过意见，≤ 500 字" />
                </Form.Item>
              </div>
            )}
            <Space>
              <Button onClick={() => { setVerdict(null); confirmForm.resetFields(); }}>重置</Button>
              <Button
                type="primary"
                danger={verdict === '退回'}
                loading={submitting}
                disabled={!verdict}
                onClick={() => setConfirming(verdict)}
              >
                {verdict === '通过' ? '确认审核通过' : verdict === '退回' ? '确认退回修改' : '请先选择结论'}
              </Button>
            </Space>
          </Form>
        </Card>
      )}

      {/* 二次确认 Modal */}
      <Modal
        open={!!confirming}
        title={confirming === '通过' ? '确认审核通过' : '确认退回修改'}
        onCancel={() => setConfirming(null)}
        onOk={submitAudit}
        confirmLoading={submitting}
        okText={confirming === '通过' ? '确认通过' : '确认退回'}
        cancelText="取消"
        okButtonProps={{ danger: confirming === '退回' }}
      >
        {confirming === '通过' ? (
          <Space direction="vertical">
            <Text>确认将该注册申请审核通过？</Text>
            <Text type="secondary">通过后系统将自动同步至统一台账中心。</Text>
          </Space>
        ) : (
          <Space direction="vertical">
            <Text>确认将该注册申请退回修改？</Text>
            <Text type="secondary">退回后申请人可在「退回修改」列表中编辑重提。</Text>
          </Space>
        )}
      </Modal>
    </>
  );
};

export default Audit;
