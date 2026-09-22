// =============================================================================
// 评测任务管理页（V1.8 §三 · 3.1）
//   · 9 状态 Tabs：全部任务 / 草稿 / 评测中 / 撤销 / 评测完成 /
//                   待审核 / 审核中 / 审核通过 / 退回修改
//                   （待评测为排队中间态，统一在「全部任务」中展示，不单设 Tab）
//   · 通用列：序号、智能体编号、智能体名称（超 10 字省略）、智能体版本、
//             评测标准、评测维度、测试样本量（全维度统一一档）、评测状态
//   · 各状态 Tab 特有字段（按 PRD §三 · 3.1）：
//       草稿：最后编辑时间
//       评测中：评测进度（百分比 + 预计剩余时间）、提交评测时间
//       撤销：撤销时间
//       评测完成：评测结果（准入/退回/待人工复核）、评测结果说明、评测完成时间
//       待审核：评测结果、评测结果说明、评测完成时间
//       审核中：评测结果、评测结果说明、审核时间
//       审核通过：评测结果、评测结果说明、审核结论（通过）、审核结论说明、审核完成时间
//       退回修改：评测结果、评测结果说明、审核结论（退回重测）、审核结论说明、退回时间
//   · 操作按钮按 PRD V1.8 §三 · 3.1（区分角色）：
//       全部任务：
//         · 信息科管理员：查看详情 + (草稿)编辑/(草稿)删除/(撤销)编辑/(撤销)删除/
//                          (待评测/评测中/撤销/评测完成)撤销/(待审核/审核中)审核/
//                          重新评测（除草稿/审核通过外）
//         · 科室管理员：仅查看详情
//       草稿：
//         · 信息科管理员：查看详情 + 编辑 + 删除
//         · 科室管理员：仅查看详情
//       评测中：
//         · 信息科管理员：查看详情 + 撤销
//         · 科室管理员：仅查看详情
//       撤销：
//         · 信息科管理员：查看详情 + 编辑 + 删除
//         · 科室管理员：仅查看详情
//       评测完成：
//         · 信息科管理员：查看详情 + 审核 + 撤销
//         · 科室管理员：仅查看详情
//       待审核：
//         · 信息科管理员：查看详情 + 审核
//         · 科室管理员：仅查看详情
//       审核中：
//         · 信息科管理员：查看详情 + 审核
//         · 科室管理员：仅查看详情
//       审核通过：
//         · 信息科管理员 / 科室管理员：仅查看详情
//       退回修改：
//         · 信息科管理员 / 科室管理员：仅查看详情（重新评测按钮在详情页底部）
//   · 筛选：「全部任务」按智能体名称 + 评测状态 + 智能体名称/编号模糊搜索；
//           其余 Tab 按智能体名称 + 风险分级；评测完成 / 待审核 / 审核通过 额外支持
//           按「评测结果」筛选
//   · 顶部操作：新建评测任务（仅信息科管理员可见）
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Tabs,
  Input,
  Select,
  Space,
  Tag,
  Table,
  Tooltip,
  Modal,
  message,
  Typography,
  Dropdown,
  Progress,
  Segmented,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  ReloadOutlined,
  AuditOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  MoreOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import PageHeader from '../../components/PageHeader';
import {
  mockEvaluationTasks,
  statusColorMap,
  riskLevelColorMap,
  conclusionColorMap,
  sampleLevelPercent,
  type EvaluationTask,
  type EvaluationStatus,
  type RiskLevel,
} from '../../mock/evaluation';
import { useAuth } from '../../hooks/useAuth';
import { useSmartDraft } from '../agent-center/smart/store';
import PujiangTaskList from './pujiang/PujiangTaskList';
import ThirdPartyTaskList from './third-party/ThirdPartyTaskList';
import { enabledEvaluationPlatforms, evaluationName, specFor, type ThirdPartyPlatformKey } from './third-party/platforms';

const { Text } = Typography;

// 评测标准固定值（V1.7 §一）
const EVAL_STANDARD = '团体标准《智能体安全评测规范》';

type EvaluationModule = 'safety' | 'pujiang' | ThirdPartyPlatformKey;

// Tab 列表（V1.7：全部 + 7 状态 = 8 个 Tab；「待评测」为排队中间态，统一在全部任务中展示；「待审核」已下线）
//   · Tab key 与 EvaluationStatus 一一对应（除 'all'），便于 t.status === activeTab 直筛
//   · 末位 Tab 真实状态为「退回重测」，展示文案沿用「退回修改」
type TabKey = 'all' | '草稿' | '评测中' | '撤销' | '评测完成' | '审核中' | '审核通过' | '退回重测';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部任务' },
  { key: '草稿', label: '草稿' },
  { key: '评测中', label: '评测中' },
  { key: '撤销', label: '撤销' },
  { key: '评测完成', label: '评测完成' },
  { key: '审核中', label: '审核中' },
  { key: '审核通过', label: '审核通过' },
  { key: '退回重测', label: '退回修改' },
];

// 风险分级下拉选项
const RISK_LEVEL_OPTIONS: { label: string; value: RiskLevel }[] = [
  { label: '低风险', value: '低风险' },
  { label: '中等风险', value: '中等风险' },
  { label: '高风险', value: '高风险' },
];

// 评测中 Tab「评测进度」列：按测试样本量档位预估总耗时（分钟），剩余时间 = 总耗时 × (1 - 进度%)
//   · 与 Progress 详情页保持口径一致：档位决定题量基数，进度由 mock.progress 提供
//   · 快速/标准/深度 = 5 / 15 / 30 分钟
const SAMPLE_LEVEL_TOTAL_MIN: Record<string, number> = {
  快速评测: 5,
  标准评测: 15,
  深度评测: 30,
};
/**
 * 计算评测中任务预计剩余时间（分钟，向下取整，最小 1 分钟）
 *   · 已完成部分进度 >= 100 → 0 分钟
 *   · 未提供进度 → 按剩余 1 分钟兜底（前端可见，不让列空白）
 */
const calcRemainingMinutes = (progress: number | undefined, sampleLevel: EvaluationTask['sampleLevel']): number => {
  if (progress === undefined || progress >= 100) return 0;
  const total = SAMPLE_LEVEL_TOTAL_MIN[sampleLevel] ?? 15;
  return Math.max(1, Math.floor(total * (1 - progress / 100)));
};

// 评测状态下拉选项（用于「全部任务」Tab）
const STATUS_OPTIONS: { label: string; value: EvaluationStatus }[] = (
  ['草稿', '待评测', '评测中', '撤销', '评测完成', '待审核', '审核中', '审核通过', '退回重测'] as EvaluationStatus[]
).map((s) => ({ label: s, value: s }));

// 评测结果下拉选项
const RESULT_OPTIONS = [
  { label: '准入', value: '准入' },
  { label: '退回', value: '退回' },
  { label: '待人工复核', value: '待人工复核' },
];

const Tasks = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  // 本地任务（支持操作后修改）
  const [tasks, setTasks] = useState<EvaluationTask[]>(mockEvaluationTasks);
  const enabledPlatforms = enabledEvaluationPlatforms();
  const requestedModule = searchParams.get('module');
  const availableModuleKeys = new Set(enabledPlatforms.map((platform) => platform.id));
  const initialModule: EvaluationModule = requestedModule === 'medbench' && availableModuleKeys.has('medbench')
    ? 'pujiang'
    : (requestedModule === 'pujiang' && availableModuleKeys.has('medbench'))
      ? 'pujiang'
      : (requestedModule === 'cp-env' || requestedModule === 'medagentbench') && availableModuleKeys.has(requestedModule)
        ? requestedModule
        : 'safety';
  const [evaluationModule, setEvaluationModule] = useState<EvaluationModule>(initialModule);
  const updateCurrentTasks = (updater: (previous: EvaluationTask[]) => EvaluationTask[]) => {
    setTasks(updater);
  };

  // 台账列表「查看评测结果」联动：?tab=all&agentName=XXX → 自动切到「全部任务」并按名称预筛
  const presetAgentName = searchParams.get('agentName') || '';
  const requestedTab = searchParams.get('tab');
  const presetTab = TABS.some((tab) => tab.key === requestedTab) ? requestedTab as TabKey : null;

  // 筛选
  const [activeTab, setActiveTab] = useState<TabKey>(presetTab || 'all');
  const [keyword, setKeyword] = useState(presetAgentName);
  const [statusFilter, setStatusFilter] = useState<EvaluationStatus | undefined>();
  const [riskFilter, setRiskFilter] = useState<RiskLevel | undefined>();
  const [resultFilter, setResultFilter] = useState<string | undefined>();

  // 信息科管理员看全院；科室管理员仅看所属科室。
  const scopedTasks = useMemo(
    () => isAdmin ? tasks : tasks.filter((task) => task.department === currentUser?.department),
    [currentUser?.department, isAdmin, tasks],
  );

  // 联动参数消费:首次挂载后清掉 URL 中的 agentName/tab,避免刷新重复触发
  // 已下线或非法 Tab（如「待评测」）统一回落到「全部任务」。
  useEffect(() => {
    if (!presetAgentName && !requestedTab) return;
    const next = new URLSearchParams(searchParams);
    if (presetAgentName) next.delete('agentName');
    if (requestedTab) next.delete('tab');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Tab 计数
  // ---------------------------------------------------------------------------
  const tabCount = useMemo(() => {
    const m: Record<TabKey | '待评测', number> = {
      all: scopedTasks.length,
      草稿: 0, 待评测: 0, 评测中: 0, 撤销: 0, 评测完成: 0,
      审核中: 0, 审核通过: 0, 退回重测: 0,
    };
    scopedTasks.forEach((t) => {
      m[t.status] = (m[t.status] || 0) + 1;
    });
    return m;
  }, [scopedTasks]);

  useEffect(() => {
    if (evaluationModule !== 'safety') return;
    const connectedAgents = new Set(scopedTasks.map((task) => task.agentId)).size;
    const values = [connectedAgents, tabCount.评测中, tabCount.评测完成,
      tabCount.审核中, tabCount.审核通过, tabCount.退回重测];
    pushWelcomeGreeting('evaluation-tasks', isAdmin ? 'admin' : 'dept', () => values, {
      windowReplacements: values,
      chips: [
        { key: 'evaluating', label: `安全性评测中 ${tabCount.评测中}`, targetTab: '评测中', tone: 'warning' },
        { key: 'evaluated', label: `评测完成 ${tabCount.评测完成}`, targetTab: '评测完成', tone: 'success' },
        { key: 'reviewing', label: `审核中 ${tabCount.审核中}`, targetTab: '审核中', tone: 'warning' },
        { key: 'approved', label: `审核通过 ${tabCount.审核通过}`, targetTab: '审核通过', tone: 'success' },
        { key: 'returned', label: `退回修改 ${tabCount.退回重测}`, targetTab: '退回重测', tone: 'error' },
      ],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, evaluationModule, isAdmin, pushWelcomeGreeting, scopedTasks, tabCount]);

  // 第三方平台沿用浦江实验室的医小管交互：进入平台列表即展示统计欢迎语，
  // 并通过状态气泡派发 agent-jump-tab 事件切换列表 Tab。
  useEffect(() => {
    if (evaluationModule !== 'cp-env' && evaluationModule !== 'medagentbench') return;
    const pageKey = evaluationModule === 'cp-env'
      ? 'cp-env-evaluation-tasks'
      : 'medagentbench-evaluation-tasks';
    const values = [1, 2, 1];
    pushWelcomeGreeting(pageKey, isAdmin ? 'admin' : 'dept', () => values, {
      windowReplacements: values,
      chips: [
        { key: `${evaluationModule}-evaluating`, label: '评测中 1', targetTab: '评测中', tone: 'warning' },
        { key: `${evaluationModule}-passed`, label: '评测通过 2', targetTab: '评测通过', tone: 'success' },
        { key: `${evaluationModule}-returned`, label: '退回修改 1', targetTab: '退回修改', tone: 'error' },
      ],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, evaluationModule, isAdmin, pushWelcomeGreeting]);

  useEffect(() => {
    const onJump = (event: Event) => {
      const nextTab = (event as CustomEvent<string>).detail as TabKey;
      if (!TABS.some((tab) => tab.key === nextTab)) return;
      setActiveTab(nextTab);
      setStatusFilter(undefined);
      setRiskFilter(undefined);
      setResultFilter(undefined);
    };
    window.addEventListener('agent-jump-tab', onJump);
    return () => window.removeEventListener('agent-jump-tab', onJump);
  }, []);

  // ---------------------------------------------------------------------------
  // 过滤
  // ---------------------------------------------------------------------------
  const visibleTasks = useMemo(() => {
    return scopedTasks.filter((t) => {
      if (activeTab !== 'all' && t.status !== activeTab) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        if (
          !t.agentName.toLowerCase().includes(k) &&
          !t.agentCode.toLowerCase().includes(k)
        ) return false;
      }
      if (activeTab === 'all') {
        if (statusFilter && t.status !== statusFilter) return false;
      } else {
        if (riskFilter && t.riskLevel !== riskFilter) return false;
        if (activeTab === '评测完成' && resultFilter && t.evalResult !== resultFilter) return false;
        if (activeTab === '审核通过' && resultFilter && t.evalResult !== resultFilter) return false;
      }
      return true;
    });
  }, [scopedTasks, activeTab, keyword, statusFilter, riskFilter, resultFilter]);

  // ---------------------------------------------------------------------------
  // 操作：撤销
  // ---------------------------------------------------------------------------
  const handleCancel = (task: EvaluationTask) => {
    const desc =
      task.status === '评测中'
        ? '任务正在评测中，撤销将终止当前评测，是否确认？'
        : task.status === '评测完成'
        ? '撤销后评测结果将失效，是否确认？'
        : '确认撤销该任务？';
    Modal.confirm({
      title: '确认撤销',
      icon: <ExclamationCircleOutlined style={{ color: '#FAAD14' }} />,
      content: (
        <Space direction="vertical" size={2}>
          <Text>{desc}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            「{task.agentName}」当前状态：{task.status}
          </Text>
        </Space>
      ),
      okText: '确认撤销',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        updateCurrentTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: '撤销', cancelTime: new Date().toISOString().slice(0, 19).replace('T', ' ') }
              : t
          )
        );
        message.success('已撤销');
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 操作：审核发起（仅管理员 + 仅待审核 Tab）
  // ---------------------------------------------------------------------------
  const handleStartReview = (task: EvaluationTask) => {
    Modal.confirm({
      title: '发起审核',
      content: `确认对「${task.agentName}」的评测结果发起人工审核？审核中状态对其他用户仅可见，不可编辑。`,
      okText: '确认发起',
      cancelText: '取消',
      onOk: () => {
        updateCurrentTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: '审核中', reviewStartTime: new Date().toISOString().slice(0, 19).replace('T', ' ') }
              : t
          )
        );
        message.success('已发起审核');
        navigate(`/app/evaluation/tasks/${task.id}/review?fromTab=${encodeURIComponent(activeTab)}`);
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 操作：删除（仅草稿 / 撤销可删）
  // ---------------------------------------------------------------------------
  const handleDelete = (task: EvaluationTask) => {
    const desc =
      task.status === '草稿'
        ? '删除后该草稿不可恢复，是否确认删除？'
        : '删除后该撤销任务不可恢复，是否确认删除？';
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />,
      content: desc,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        updateCurrentTasks((prev) => prev.filter((t) => t.id !== task.id));
        message.success('已删除');
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 操作：编辑（草稿 / 撤销）
  // ---------------------------------------------------------------------------
  const handleEdit = (task: EvaluationTask) => {
    navigate(`/app/evaluation/tasks/create?taskId=${task.id}`);
  };

  // ---------------------------------------------------------------------------
  // 操作：重新评测（撤销 / 退回重测）
  // ---------------------------------------------------------------------------
  const handleReEval = (task: EvaluationTask) => {
    Modal.confirm({
      title: '重新评测',
      content: `将以「${task.agentName}」的原配置发起一轮新的评测任务，确认？`,
      okText: '确认重新评测',
      cancelText: '取消',
      onOk: () => {
        message.success('已发起新一轮评测任务');
        navigate('/app/evaluation/tasks');
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 导出列表（已下线）
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // 列定义：基础列（根据 Tab 动态显示特有列）
  // ---------------------------------------------------------------------------
  const buildColumns = (): ColumnsType<EvaluationTask> => {
    // 9 个 Tab 仅固定右侧「操作」列；其余列不固定
    // 「全部任务」Tab 列宽三次收紧（按实际内容宽度贴合，移除冗余空白）：
    //   序号 60→50、智能体编号 100→90、智能体名称 130→110、
    //   评测标准 170→150、测试样本量 140→120（智能体版本 70 / 评测状态 90 / 操作 120 已贴近）
    // 8 个状态 Tab 列宽沿用 V1.7 不动
    const isAll = activeTab === 'all';
    const cols: ColumnsType<EvaluationTask> = [
      {
        title: '序号',
        key: 'index',
        width: isAll ? 50 : 60,
        render: (_, __, idx) => idx + 1,
      },
      {
        title: '智能体编号',
        dataIndex: 'agentCode',
        key: 'agentCode',
        width: isAll ? 90 : 120,
      },
      {
        title: '智能体名称',
        dataIndex: 'agentName',
        key: 'agentName',
        width: isAll ? 110 : 160,
        ellipsis: { showTitle: true },
        render: (text) => (
          <Tooltip title={text}>
            <span>{text.length > 10 ? `${text.slice(0, 10)}…` : text}</span>
          </Tooltip>
        ),
      },
      {
        title: '智能体版本',
        dataIndex: 'version',
        key: 'version',
        width: isAll ? 70 : 80,
        render: (v) => <Tag>{v}</Tag>,
      },
      {
        title: '评测标准',
        key: 'evalStandard',
        width: isAll ? 150 : 180,
        render: () => <Text style={{ fontSize: 12 }}>{EVAL_STANDARD}</Text>,
      },
      {
        title: '测试样本量',
        key: 'sampleLevel',
        width: isAll ? 120 : 160,
        render: (_, record) => (
          <Tag color="blue">
            {record.sampleLevel}（抽取 {sampleLevelPercent[record.sampleLevel]}%）
          </Tag>
        ),
      },
    ];

    // Tab 特有列
    if (activeTab === '草稿') {
      cols.push({
        title: '最后编辑时间',
        dataIndex: 'lastEditTime',
        key: 'lastEditTime',
        width: 160,
        render: (v) => v || '-',
      });
    }
    if (activeTab === '评测中') {
      // V2.0 新增「评测进度」列：位于 智能体版本 与 评测标准 之间
      //   · 展示 Progress 条 + 百分比 + 预计剩余时间（基于 sampleLevel 与 progress 反推）
      cols.push({
        title: '评测进度',
        key: 'progress',
        width: 200,
        render: (_, record) => {
          const percent = record.progress ?? 0;
          const remain = calcRemainingMinutes(record.progress, record.sampleLevel);
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Progress
                percent={percent}
                size="small"
                showInfo
                strokeColor="#1677FF"
                format={(p) => `${p}%`}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {remain === 0 ? '即将完成' : `还剩约 ${remain} 分钟`}
              </Text>
            </Space>
          );
        },
      });
      cols.push({
        title: '提交评测时间',
        dataIndex: 'submitTime',
        key: 'submitTime',
        width: 160,
        render: (v) => v || '-',
      });
    }
    if (activeTab === '撤销') {
      cols.push({
        title: '撤销时间',
        dataIndex: 'cancelTime',
        key: 'cancelTime',
        width: 160,
        render: (v) => v || '-',
      });
    }
    if (activeTab === '评测完成') {
      cols.push(
        {
          title: '评测结果',
          dataIndex: 'evalResult',
          key: 'evalResult',
          width: 110,
          render: (v) =>
            v ? <Tag color={conclusionColorMap[v as keyof typeof conclusionColorMap]}>{v}</Tag> : <Text type="secondary">—</Text>,
        },
        {
          title: '评测结果说明',
          dataIndex: 'evalResultDesc',
          key: 'evalResultDesc',
          width: 200,
          render: (v) =>
            v ? (
              <Tooltip title={v}>
                <span style={{ fontSize: 12 }}>{v.length > 30 ? `${v.slice(0, 30)}…` : v}</span>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: '评测完成时间',
          dataIndex: 'evalCompleteTime',
          key: 'evalCompleteTime',
          width: 160,
          render: (v) => v || '-',
        }
      );
    }
    if (activeTab === '审核中') {
      cols.push(
        {
          title: '评测结果',
          dataIndex: 'evalResult',
          key: 'evalResult',
          width: 110,
          render: (v) =>
            v ? <Tag color={conclusionColorMap[v as keyof typeof conclusionColorMap]}>{v}</Tag> : <Text type="secondary">—</Text>,
        },
        {
          title: '评测结果说明',
          dataIndex: 'evalResultDesc',
          key: 'evalResultDesc',
          width: 200,
          render: (v) =>
            v ? (
              <Tooltip title={v}>
                <span style={{ fontSize: 12 }}>{v.length > 30 ? `${v.slice(0, 30)}…` : v}</span>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: '审核时间',
          dataIndex: 'reviewStartTime',
          key: 'reviewStartTime',
          width: 160,
          render: (v) => v || '-',
        }
      );
    }
    if (activeTab === '审核通过') {
      cols.push(
        {
          title: '评测结果',
          dataIndex: 'evalResult',
          key: 'evalResult',
          width: 110,
          render: (v) =>
            v ? <Tag color={conclusionColorMap[v as keyof typeof conclusionColorMap]}>{v}</Tag> : <Text type="secondary">—</Text>,
        },
        {
          title: '评测结果说明',
          dataIndex: 'evalResultDesc',
          key: 'evalResultDesc',
          width: 200,
          render: (v) =>
            v ? (
              <Tooltip title={v}>
                <span style={{ fontSize: 12 }}>{v.length > 30 ? `${v.slice(0, 30)}…` : v}</span>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: '审核结论',
          key: 'reviewConclusion',
          width: 100,
          render: () => <Tag color="success">通过</Tag>,
        },
        {
          title: '审核结论说明',
          dataIndex: 'reviewComment',
          key: 'reviewComment',
          width: 200,
          render: (v) =>
            v ? (
              <Tooltip title={v}>
                <span style={{ fontSize: 12 }}>{v.length > 30 ? `${v.slice(0, 30)}…` : v}</span>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: '审核完成时间',
          dataIndex: 'reviewCompleteTime',
          key: 'reviewCompleteTime',
          width: 160,
          render: (v) => v || '-',
        }
      );
    }
    if (activeTab === '退回重测') {
      cols.push(
        {
          title: '评测结果',
          dataIndex: 'evalResult',
          key: 'evalResult',
          width: 110,
          render: (v) =>
            v ? <Tag color={conclusionColorMap[v as keyof typeof conclusionColorMap]}>{v}</Tag> : <Text type="secondary">—</Text>,
        },
        {
          title: '评测结果说明',
          dataIndex: 'evalResultDesc',
          key: 'evalResultDesc',
          width: 200,
          render: (v) =>
            v ? (
              <Tooltip title={v}>
                <span style={{ fontSize: 12 }}>{v.length > 30 ? `${v.slice(0, 30)}…` : v}</span>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: '审核结论',
          key: 'reviewConclusion',
          width: 100,
          render: () => <Tag color="error">退回重测</Tag>,
        },
        {
          title: '审核结论说明',
          dataIndex: 'reviewComment',
          key: 'reviewComment',
          width: 200,
          render: (v) =>
            v ? (
              <Tooltip title={v}>
                <span style={{ fontSize: 12 }}>{v.length > 30 ? `${v.slice(0, 30)}…` : v}</span>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: '退回时间',
          dataIndex: 'rejectTime',
          key: 'rejectTime',
          width: 160,
          render: (v) => v || '-',
        }
      );
    }

    // 评测状态列（仅「全部任务」Tab 显示；不固定）
    if (activeTab === 'all') {
      cols.push({
        title: '评测状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (s: EvaluationStatus) => <Tag color={statusColorMap[s]}>{s}</Tag>,
      });
    }

    // 操作列（所有 Tab 都显示）
    // 列宽按 PRD V1.8 各 Tab 最大按钮组合给到充足余量，保证一行展示、文字不截切：
    //   all（更多下拉）      → 120（V1.7+ 由 160 收紧,「查看详情 + 更多」实测 ~110px）
    //   草稿 / 撤销          → 160（V1.9 由 280 收紧,改走「查看详情 + 更多」下拉,与 all Tab 一致）
    //   评测中               → 200（管理员 2 按钮：查看详情+撤销）
    //   评测完成             → 260（管理员 3 按钮：查看详情+审核+撤销,新增「审核」入口）
    //   审核中               → 200（管理员 2 按钮：查看详情+审核）
    //   审核通过 / 退回修改  → 140（仅 查看详情）
    const actionWidth =
      activeTab === 'all' ? 120 :
      activeTab === '草稿' || activeTab === '撤销' ? 160 :
      activeTab === '评测中' ? 200 :
      activeTab === '评测完成' ? 260 :
      activeTab === '审核中' ? 200 :
      140; // 审核通过 / 退回修改
    cols.push({
      title: '操作',
      key: 'action',
      width: actionWidth,
      fixed: 'right',
      render: (_, record) => {
        const goReport = () => navigate(`/app/evaluation/tasks/${record.id}/report?fromTab=${encodeURIComponent(activeTab)}`);

        // 「全部任务」Tab：统一「查看详情 + 更多」下拉,按 record.status 分发操作项
        // PRD §3.1.1 信息科管理员：查看详情 + 重新评测 + (草稿)编辑；
        //                       撤销 / 删除 仅对草稿 / 撤销状态可见（沿用草稿/撤销 Tab 的可写权限）
        //                       撤销 / 审核 仅对管理员可见
        if (activeTab === 'all') {
          const moreItems: MenuProps['items'] = [];
          if (record.status === '草稿') {
            moreItems.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => handleEdit(record) });
            moreItems.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record) });
          } else if (record.status === '撤销') {
            moreItems.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => handleEdit(record) });
            moreItems.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record) });
          } else if (record.status === '待评测' && isAdmin) {
            moreItems.push({ key: 'cancel', label: '撤销', icon: <StopOutlined />, danger: true, onClick: () => handleCancel(record) });
          } else if (record.status === '评测中' && isAdmin) {
            moreItems.push({ key: 'cancel', label: '撤销', icon: <StopOutlined />, danger: true, onClick: () => handleCancel(record) });
          } else if (record.status === '评测完成' && isAdmin) {
            moreItems.push({ key: 'cancel', label: '撤销', icon: <StopOutlined />, danger: true, onClick: () => handleCancel(record) });
          } else if ((record.status === '待审核' || record.status === '审核中') && isAdmin) {
            moreItems.push({ key: 'audit', label: '审核', icon: <AuditOutlined />, onClick: () => handleStartReview(record) });
          }
          // 重新评测：管理员对非「草稿」「审核通过」状态的任务都可见(PRD §3.1.1)
          if (isAdmin && record.status !== '草稿' && record.status !== '审核通过') {
            moreItems.push({ key: 'reeval', label: '重新评测', icon: <ReloadOutlined />, onClick: () => handleReEval(record) });
          }
          // 审核通过：无可执行操作,只保留「查看详情」

          return (
            <Space size={4} wrap>
              <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>
                查看详情
              </Button>
              {moreItems.length > 0 && (
                <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                  <Button type="link" size="small" icon={<MoreOutlined />} style={{ padding: 0 }}>
                    更多
                  </Button>
                </Dropdown>
              )}
            </Space>
          );
        }

        // 8 个非「全部」Tab：状态单一,把可执行操作平铺/收为下拉
        return (
          <Space size={4} wrap>
            {/* 草稿：管理员「查看详情 + 更多」下拉（编辑/删除）；科室仅查看详情 */}
            {record.status === '草稿' && (
              <>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
                {isAdmin && (
                  <Dropdown menu={{ items: [
                    { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => handleEdit(record) },
                    { key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record) },
                  ] }} trigger={['click']}>
                    <Button type="link" size="small" icon={<MoreOutlined />} style={{ padding: 0 }}>更多</Button>
                  </Dropdown>
                )}
              </>
            )}

            {/* 评测中：管理员 查看详情 + 撤销；科室仅查看详情 */}
            {record.status === '评测中' && (
              <>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
                {isAdmin && (
                  <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleCancel(record)}>撤销</Button>
                )}
              </>
            )}

            {/* 撤销：管理员「查看详情 + 更多」下拉（编辑/删除）；科室仅查看详情 */}
            {record.status === '撤销' && (
              <>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
                {isAdmin && (
                  <Dropdown menu={{ items: [
                    { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => handleEdit(record) },
                    { key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record) },
                  ] }} trigger={['click']}>
                    <Button type="link" size="small" icon={<MoreOutlined />} style={{ padding: 0 }}>更多</Button>
                  </Dropdown>
                )}
              </>
            )}

            {/* 评测完成：管理员 查看详情 + 审核 + 撤销；科室仅查看详情 */}
            {record.status === '评测完成' && (
              <>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
                {isAdmin && (
                  <>
                    <Button type="link" size="small" icon={<AuditOutlined />} onClick={() => handleStartReview(record)}>
                      审核
                    </Button>
                    <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleCancel(record)}>撤销</Button>
                  </>
                )}
              </>
            )}

            {/* 待审核：管理员 查看详情 + 审核；科室仅查看详情 */}
            {record.status === '待审核' && (
              <>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
                {isAdmin && (
                  <Button type="link" size="small" icon={<AuditOutlined />} onClick={() => handleStartReview(record)}>
                    审核
                  </Button>
                )}
              </>
            )}

            {/* 审核中：管理员 查看详情 + 审核；科室仅查看详情 */}
            {record.status === '审核中' && (
              <>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
                {isAdmin && (
                  <Button type="link" size="small" icon={<AuditOutlined />} onClick={() => handleStartReview(record)}>
                    审核
                  </Button>
                )}
              </>
            )}

            {/* 审核通过：仅查看详情（信息科管理员 / 科室管理员都只读） */}
            {record.status === '审核通过' && (
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
            )}

            {/* 退回修改：仅查看详情（重新评测按钮在详情页底部,本 Tab 列表不展示） */}
            {record.status === '退回重测' && (
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={goReport}>查看详情</Button>
            )}
          </Space>
        );
      },
    });

    return cols;
  };

  const moduleSwitcher = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingBottom: 16,
        marginBottom: 4,
        borderBottom: '1px solid #F0F0F0',
      }}
    >
      <Segmented<EvaluationModule>
        value={evaluationModule}
        size="large"
        options={[
          { value: 'safety', label: <Space size={6}><SafetyCertificateOutlined /><span>安全性评测</span></Space> },
          ...enabledPlatforms.map((platform) => ({
            value: (platform.id === 'medbench' ? 'pujiang' : platform.id) as EvaluationModule,
            label: <Space size={6}><ExperimentOutlined /><span>{evaluationName(platform.name)}</span></Space>,
          })),
        ]}
        onChange={(value) => {
          setEvaluationModule(value);
          setSearchParams(value === 'safety' ? {} : { module: value }, { replace: true });
          setActiveTab('all');
          setKeyword('');
          setStatusFilter(undefined);
          setRiskFilter(undefined);
          setResultFilter(undefined);
        }}
      />
    </div>
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <PageHeader
        title="评测任务管理"
        subTitle="管理全部智能体准入评测任务，按状态分 Tab 展示"
        extra={[
          isAdmin ? (
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(evaluationModule === 'pujiang' ? '/app/evaluation/tasks/pujiang/create' : evaluationModule === 'safety' ? '/app/evaluation/tasks/create' : `/app/evaluation/tasks/platform/${evaluationModule}/create`)}
            >
              新建评测任务
            </Button>
          ) : null,
        ]}
      />

      {evaluationModule === 'pujiang' ? (
        <PujiangTaskList moduleSwitcher={moduleSwitcher} />
      ) : evaluationModule === 'cp-env' || evaluationModule === 'medagentbench' ? (
        <ThirdPartyTaskList platform={specFor(evaluationModule)} moduleSwitcher={moduleSwitcher} />
      ) : (
      <>
      <Card style={{ marginTop: 16 }}>
        {moduleSwitcher}
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k as TabKey);
            setStatusFilter(undefined);
            setRiskFilter(undefined);
            setResultFilter(undefined);
          }}
          items={TABS.map((t) => ({
            key: t.key,
            label: (
              <Space size={4}>
                <span>{t.label}</span>
                <span style={{ color: 'rgba(0,0,0,0.45)' }}>({tabCount[t.key]})</span>
              </Space>
            ),
          }))}
        />

        {/* 台账列表「查看评测结果」联动提示:展示预筛来源 + 提供清除按钮 */}
        {presetAgentName && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#E6F4FF',
              border: '1px solid #91CAFF',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            已按智能体「<Text strong>{presetAgentName}</Text>」预筛「{TABS.find((t) => t.key === activeTab)?.label || '全部任务'}」,共
            <Text strong style={{ margin: '0 4px' }}>{visibleTasks.length}</Text>条结果;
            <Button type="link" size="small" style={{ padding: 0, marginLeft: 8 }} onClick={() => setKeyword('')}>清除筛选</Button>
          </div>
        )}

        <Space wrap size={8} style={{ marginTop: 4 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={
              activeTab === 'all'
                ? '搜索智能体名称 / 编号'
                : '搜索智能体名称'
            }
            style={{ width: 260 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {activeTab === 'all' ? (
            <Select
              allowClear
              placeholder="评测状态"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as EvaluationStatus | undefined)}
              options={STATUS_OPTIONS}
            />
          ) : (
            <Select
              allowClear
              placeholder="风险分级"
              style={{ width: 140 }}
              value={riskFilter}
              onChange={(v) => setRiskFilter(v as RiskLevel | undefined)}
              options={RISK_LEVEL_OPTIONS}
            />
          )}
          {['评测完成', '审核通过'].includes(activeTab) && (
            <Select
              allowClear
              placeholder="评测结果"
              style={{ width: 160 }}
              value={resultFilter}
              onChange={(v) => setResultFilter(v as string | undefined)}
              options={RESULT_OPTIONS}
            />
          )}
          <Button
            onClick={() => {
              setKeyword('');
              setStatusFilter(undefined);
              setRiskFilter(undefined);
              setResultFilter(undefined);
            }}
          >
            重置
          </Button>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
            共 {visibleTasks.length} 条
          </Text>
        </Space>
      </Card>

      <div style={{ background: '#fff', borderRadius: 8, marginTop: 16, border: '1px solid #F0F0F0' }}>
        <Table
          rowKey="id"
          columns={buildColumns()}
          dataSource={visibleTasks}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1820 }}
        />
      </div>
      </>
      )}
    </div>
  );
};

export default Tasks;
