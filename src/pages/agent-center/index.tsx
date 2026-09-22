/**
 * 智能体接入中心 - 注册管理列表页（V2.6）
 *
 * V2.6 调整：
 *   - 「审核通过」Tab 操作列从 1 个「查看详情」按钮扩展为 3 个平铺按钮：
 *       查看详情（所有角色）/ 立即评测（仅信息科管理员）/ 查看台账（所有角色）
 *   - 列宽 110 → 260（3 个 link 按钮一行内展示完、不被截字）
 *   - 跳转行为：
 *       立即评测 → /app/evaluation/tasks/create?agentName={r.name}  带智能体名称预填
 *       查看台账 → /app/ledger/list?search={r.name}&openDetail=1
 *                  台账列表页读取 search 做预筛,并自动打开名称命中的智能体详情
 *
 * V2.5 调整：
 *   - 「草稿」Tab 也改为「查看详情 + 更多」下拉,与「全部」Tab 一致
 *     操作列列宽 230 → 160
 *   - 5 个非「全部/草稿」Tab 继续走平铺(编辑/删除/审核/撤销),列宽按 Tab 贴合最宽按钮组合
 *     并取充足余量,保证按钮一行内展示完、按钮文字不被截切、右侧不留过多空白:
 *       撤销修改 → 230(最多 3 按钮:查看+编辑+删除)
 *       待审核 / 审核中 / 退回修改 → 180(最多 2 按钮:查看+审核/撤销/编辑)
 *       审核通过 → 110(仅查看详情)
 *   - Table scroll.x 保持 1900,覆盖各 Tab 平铺列宽
 *
 * V2.4 调整：
 *   - 「全部」Tab 走「查看详情 + 更多」下拉,操作列固定 160,避免 6 状态混合导致列宽不可控
 *
 * V2.3 调整：
 *   - 6 个非「全部」Tab（草稿/待审核/审核中/撤销修改/退回修改/审核通过）下，
 *     操作列平铺展示该状态下所有可执行操作（编辑/删除/审核/撤销），不再收进「更多」下拉
 *   - 操作列宽度 160 → 320；Table scroll.x 1800 → 1900
 *
 * V2.2 调整：
 *   - 新建 / 编辑 / 详情 / 审核 全部从 Drawer 转为独立下转路由页：
 *     /app/agent-center/register      新建注册
 *     /app/agent-center/edit/:id     编辑注册（草稿 / 退回修改 / 撤销修改）
 *     /app/agent-center/detail/:id   注册信息详情
 *     /app/agent-center/audit/:id    审核注册
 *   - 本页只保留 7 状态列表 + 顶部筛选 + 删除/撤销 二次确认
 *   - 数据改由 ./store.ts 跨页共享，本页通过 useAccessRecords() 订阅变更
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Button,
  Card,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  AuditOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  ThunderboltFilled,
  UndoOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useDemoSettings } from '../../hooks/useDemoSettings';
import { departmentOptions } from '../../mock/departments';
import PageHeader from '../../components/PageHeader';
import NewUserConsole from '../../components/NewUserConsole';
import {
  ROLE_ADMIN,
  ROLE_DEPT,
  type RegisterStatus,
  statusColorMap,
  statusListKeys,
  sourceOptions,
  clinicalStageOptions,
  type AccessRecord,
} from './types';
import {
  appendAuditNode,
  nowISO,
  patchAccessRecord,
  removeAccessRecord,
  useAccessRecords,
} from './store';
import { useSmartDraft } from './smart/store.tsx';
import type { WelcomePageKey, WelcomeRole, WelcomeReplacer, WelcomeMiniList, WelcomeMiniRowAction } from './smart/store.tsx';
// §4.1.1 PRD："态势不单独做看板页面 / 不额外渲染看板卡片 / 指标面板"
//   - 顶部 GlobalInsightBar 6 维大卡 已下线
//   - 列表页的态势汇报改由 AgentAssistant 的「机器人旁 page-level 文字气泡」承担
//   - 实现：pushWelcomeGreeting(key, role, replacer, { chips, actions })，
//     气泡内同时展示文字汇报 + 可点状态 chip + 一键直达按钮（按 isPlatformAdmin 置灰）

const { Text } = Typography;

const AgentCenterContent = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const role = currentUser?.roles[0] || '科室管理员';
  const isPlatformAdmin = role === ROLE_ADMIN;
  const loginName = currentUser?.name || '当前用户';

  const records = useAccessRecords();
  const { pushWelcomeGreeting } = useSmartDraft();

  // 列表筛选
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  // §4.1.1 提交时间区间筛（PRD 明示）
  const [submitRange, setSubmitRange] = useState<[string, string] | null>(null);
  // §4.1.2 列表列点击排序（PRD 明示）
  const [sortKey, setSortKey] = useState<'submitTime' | 'lastEditTime' | 'passTime' | null>(null);
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | null>(null);

  // Tab 状态由 URL ?tab= 决定，便于新建/编辑/审核等下转页带目标状态跳回（如 ?tab=草稿 / ?tab=待审核）
  const validTabKeys = statusListKeys.map((s) => s.key) as Array<RegisterStatus | '全部'>;
  const urlTab = searchParams.get('tab') as RegisterStatus | '全部' | null;
  const activeStatus: RegisterStatus | '全部' =
    urlTab && validTabKeys.includes(urlTab) ? urlTab : '全部';
  const setActiveStatus = (next: RegisterStatus | '全部') => {
    const params = new URLSearchParams(searchParams);
    if (next === '全部') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  // 删除 / 撤销 二次确认
  const [pendingDelete, setPendingDelete] = useState<AccessRecord | null>(null);
  const [pendingCancel, setPendingCancel] = useState<AccessRecord | null>(null);

  // ──────────────────────────────────────────────────────────────────
  // 派生数据
  // ──────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const map: Record<string, number> = { 全部: 0 };
    statusListKeys.forEach((s) => {
      if (s.key !== '全部') map[s.key] = 0;
    });
    // V2.1 § 1.1 各 tab 数据范围：草稿仅本人；其他 6 tab 管理员全量 / 用户本人
    const ownOnlyStatuses: RegisterStatus[] = ['草稿'];
    const visible = (r: AccessRecord) =>
      ownOnlyStatuses.includes(r.status) ? r.applicant === loginName : isPlatformAdmin || r.applicant === loginName;
    records.forEach((r) => {
      if (visible(r)) {
        map['全部'] += 1;
        map[r.status] = (map[r.status] || 0) + 1;
      }
    });
    return map;
  }, [records, loginName, isPlatformAdmin]);

  // §3.1.1 指向性规则：为 6 个状态 Tab 构建「迷你清单」extras
  //   - 数据范围与表格 filteredData 完全同构（草稿仅本人；其余 admin 全量 / 用户本人）
  //   - 每条记录级按钮按 Tab × 角色 × 本人分发，与 actionCol(第 585-716 行) 严格一致
  //   - 按时间倒序取前 5 条；totalCount 用于「查看全部 (N)」
  const buildMiniListExtras = (
    tab: RegisterStatus | '全部',
  ): { miniList: WelcomeMiniList } | undefined => {
    if (tab === '全部') return undefined;
    const ownOnly: RegisterStatus[] = ['草稿'];
    const visible = (r: AccessRecord) =>
      ownOnly.includes(r.status) ? r.applicant === loginName : isPlatformAdmin || r.applicant === loginName;
    const timeOf = (r: AccessRecord) =>
      r.lastEditTime || r.submitTime || r.cancelTime || r.returnTime || r.passTime || '';
    const matched = records
      .filter((r) => r.status === tab && visible(r))
      .sort((a, b) => timeOf(b).localeCompare(timeOf(a)));
    if (matched.length === 0) return undefined;
    const rows = matched.slice(0, 5).map((r) => {
      const isMine = r.applicant === loginName;
      const actions: WelcomeMiniRowAction[] = [];
      if (tab === '草稿') {
        if (isMine) actions.push({ key: 'edit', label: '编辑', kind: 'navigate-edit' });
      } else if (tab === '待审核') {
        actions.push({ key: 'detail', label: '查看详情', kind: 'navigate-detail' });
        actions.push({ key: 'cancel', label: '撤销', kind: 'confirm-cancel' });
      } else if (tab === '审核中') {
        actions.push({ key: 'detail', label: '查看详情', kind: 'navigate-detail' });
        actions.push({ key: 'cancel', label: '撤销', kind: 'confirm-cancel' });
      } else if (tab === '退回修改') {
        actions.push({ key: 'edit', label: '编辑', kind: 'navigate-edit' });
      } else if (tab === '撤销修改') {
        actions.push({ key: 'edit', label: '编辑', kind: 'navigate-edit' });
        actions.push({ key: 'del', label: '删除', kind: 'confirm-delete', danger: true });
      } else if (tab === '审核通过') {
        actions.push({ key: 'detail', label: '查看详情', kind: 'navigate-detail' });
        actions.push({
          key: 'eval',
          label: '查看准入评测结果',
          kind: 'navigate-eval',
          path: `/app/evaluation/tasks/create?agentName=${encodeURIComponent(r.name)}${r.agentCode ? `&agentCode=${encodeURIComponent(r.agentCode)}` : ''}`,
        });
        actions.push({ key: 'ledger', label: '完善台账', kind: 'navigate-ledger' });
      }
      return {
        recordId: r.id,
        title: r.name || '(未命名)',
        subTitle: r.agentCode || undefined,
        meta: timeOf(r) || undefined,
        actions,
      };
    });
    // 折叠态按钮文案对齐 PRD 表：草稿=去补全 N 条草稿 / 退回=去处理 N 条退回 / …
    const toggleLabelByTab: Record<string, string> = {
      草稿: `去补全 ${matched.length} 条草稿`,
      待审核: `查看这 ${matched.length} 条待审核`,
      审核中: `查看这 ${matched.length} 条审核中`,
      退回修改: `去处理 ${matched.length} 条退回`,
      撤销修改: `查看 ${matched.length} 条撤销`,
      审核通过: `查看 ${matched.length} 条已通过`,
    };
    return {
      miniList: {
        toggleLabel: toggleLabelByTab[tab] || `查看这 ${matched.length} 条`,
        targetTab: tab,
        rows,
        totalCount: matched.length,
      },
    };
  };

  // PRD §3.1.1 欢迎语触发：进入注册管理页 / 切换 Tab 时,推一条 page-level 欢迎语
  //   - 「全部」Tab 提供方 (provider) / 管理方 (admin) 文案不同
  //   - 其他 6 Tab 两角色文案一致,统一走 provider
  //   - 用 counts 实际条数填充草稿 N / 退回 N;管理方的『待审核 X』也按 counts 填, 0 时显示「暂无」
  useEffect(() => {
    const pageKeyByTab: Partial<Record<RegisterStatus | '全部', WelcomePageKey>> = {
      全部: 'agent-center-all',
      草稿: 'agent-center-draft',
      待审核: 'agent-center-pending',
      审核中: 'agent-center-reviewing',
      退回修改: 'agent-center-return',
      撤销修改: 'agent-center-cancel',
      审核通过: 'agent-center-passed',
    };
    const key = pageKeyByTab[activeStatus];
    if (!key) return;
    const role: WelcomeRole = isPlatformAdmin ? 'admin' : 'dept';
    const fmt = (n: number) => String(n);
    const perKeyReplacer: WelcomeReplacer = (k, _r, surface) => {
      if (!k.startsWith('agent-center-')) return undefined;
      if (surface === 'window') {
        if (k === 'agent-center-draft') return [fmt(counts['草稿'] ?? 0)];
        if (k === 'agent-center-return') return [fmt(counts['退回修改'] ?? 0)];
        return undefined;
      }
      if (role === 'admin') {
        return [
          fmt(counts['待审核'] ?? 0),
          fmt(counts['审核通过'] ?? 0),
          fmt(counts['退回修改'] ?? 0),
        ];
      }
      if (role === 'dept') {
        return [
          fmt(counts['审核中'] ?? 0),
          fmt(counts['审核通过'] ?? 0),
          fmt(counts['退回修改'] ?? 0),
        ];
      }
      return undefined;
    };
    // §4.1.1 态势汇报 - 仅在「全部」Tab + 进入/切换时，挂态势 chips + 一键直达
    //   - chips: 可点状态 chip，点击跳对应 tab（与文字里的"X 条待审核"对应）
    //   - actions: 一键直达台账中心 / 准入评测沙盒（按 isPlatformAdmin 置灰）
    const extras =
      key === 'agent-center-all'
        ? {
            chips: [
              isPlatformAdmin
                ? { key: 'pending', label: `待审核 ${fmt(counts['待审核'] ?? 0)}`, targetTab: '待审核', tone: 'warning' as const }
                : { key: 'reviewing', label: `审核中 ${fmt(counts['审核中'] ?? 0)}`, targetTab: '审核中', tone: 'warning' as const },
              { key: 'returned', label: `退回 ${fmt(counts['退回修改'] ?? 0)}`, targetTab: '退回修改', tone: 'error' as const },
              { key: 'passed', label: `已通过 ${fmt(counts['审核通过'] ?? 0)}`, targetTab: '审核通过', tone: 'success' as const },
            ],
            actions: [
              {
                key: 'new-register',
                label: '新建注册',
                path: '/app/agent-center/smart-register',
                enabled: true,
              },
            ],
          }
        : // §3.1.1 指向性规则：其余 6 状态 Tab 挂「迷你清单」— 前 5 条 + 每条记录级按钮
          {
            ...buildMiniListExtras(activeStatus),
          };
    pushWelcomeGreeting(key, role, perKeyReplacer, extras);
  }, [activeStatus, isPlatformAdmin, pushWelcomeGreeting, counts, records, loginName]);

  // §4.1.1 监听机器人旁 chip 跳 Tab（AgentAssistant 派发 CustomEvent）
  useEffect(() => {
    const onJump = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (tab) setActiveStatus(tab as RegisterStatus);
    };
    window.addEventListener('agent-jump-tab', onJump);
    return () => window.removeEventListener('agent-jump-tab', onJump);
  }, []);

  const filteredData = useMemo(() => {
    const ownOnlyStatuses: RegisterStatus[] = ['草稿'];
    return records.filter((r) => {
      const matchScope = ownOnlyStatuses.includes(r.status)
        ? r.applicant === loginName
        : isPlatformAdmin || r.applicant === loginName;
      const matchSearch = !searchText || r.name.toLowerCase().includes(searchText.toLowerCase());
      const matchStatus = activeStatus === '全部' || r.status === activeStatus;
      const matchDept = !deptFilter || r.department === deptFilter;
      const matchSource = !sourceFilter || r.source === sourceFilter;
      const matchStage = !stageFilter || r.clinicalStage === stageFilter;
      // §4.1.1 提交时间区间（仅对有 submitTime 的记录生效）
      const matchSubmitRange =
        !submitRange ||
        !r.submitTime ||
        (r.submitTime >= submitRange[0] && r.submitTime <= submitRange[1] + ' 23:59:59');
      return matchScope && matchSearch && matchStatus && matchDept && matchSource && matchStage && matchSubmitRange;
    });
  }, [records, searchText, activeStatus, deptFilter, sourceFilter, stageFilter, submitRange, isPlatformAdmin, loginName]);

  // ──────────────────────────────────────────────────────────────────
  // §4.1.2 预审建议派生：与 Audit.tsx 中 preAuditProblems 同源, 在列表项旁
  //   展示「预审：建议通过 / 建议退回」轻量标识（仅 admin 在「全部」Tab
  //   或「待审核/审核中」Tab 可见）。仅基于已填字段做轻量推断, 不读全材料。
  // ──────────────────────────────────────────────────────────────────
  const preAuditTipOf = (r: AccessRecord): { tip: '建议通过' | '建议退回' | '信息待补'; reason: string } | null => {
    if (!isPlatformAdmin) return null;
    if (r.status !== '待审核' && r.status !== '审核中') return null;
    // 与 Audit.tsx §preAuditProblems 严格同构
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!r.name) errors.push('智能体名称为空');
    if (r.version && !/^\d+\.\d+$/.test(r.version)) errors.push('版本号格式不符');
    if (!r.contactPhone || !/^1[3-9]\d{9}$/.test(r.contactPhone)) errors.push('手机号格式不符');
    if (!r.department) errors.push('未指定所属科室');
    if (r.source === '自研' && r.supplier) warnings.push('来源=自研, 不应填供应商');
    if (r.accessMode === 'API' && r.apiEndpoint && !/^https?:\/\//.test(r.apiEndpoint)) errors.push('接口地址缺少协议头');
    if (!r.attachments || r.attachments.length < 2) errors.push('备案材料缺失');
    if (errors.length > 0) return { tip: '建议退回', reason: errors[0] };
    if (warnings.length > 0) return { tip: '建议退回', reason: warnings[0] };
    if (r.connectionTested && r.connectionStatus === 'success') return { tip: '建议通过', reason: '基本信息完整 + 连通测试正常' };
    return { tip: '信息待补', reason: '尚未完成连通测试' };
  };

  // ──────────────────────────────────────────────────────────────────
  // 翻页 / 截断阈值
  // ──────────────────────────────────────────────────────────────────
  const truncateLimits = useMemo(() => {
    if (activeStatus === '草稿') return { supplier: 15 };
    if (activeStatus === '全部') return { supplier: 15 };
    return { supplier: 10 };
  }, [activeStatus]);

  /** 列表单元格渲染:超过 limit 字省略 + Tooltip 悬浮展示完整 */
  const ellipsisCell = (text: string, limit = 15) => {
    if (!text) return <Text type="secondary">--</Text>;
    const truncated = text.length > limit ? `${text.slice(0, limit)}…` : text;
    return (
      <Tooltip title={text}>
        <div
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.5',
          }}
        >
          {truncated}
        </div>
      </Tooltip>
    );
  };

  const sortedData = useMemo(() => {
    const arr = [...filteredData];
    // §4.1.2 用户点击列表头排序时, 按 sortKey/sortOrder 排序; 否则按 Tab 默认时间倒序
    if (sortKey && sortOrder) {
      const dir = sortOrder === 'ascend' ? 1 : -1;
      return arr.sort((a, b) => {
        const av = (a as any)[sortKey] || '';
        const bv = (b as any)[sortKey] || '';
        return av.localeCompare(bv) * dir;
      });
    }
    const timeOf = (r: AccessRecord) =>
      r.lastEditTime || r.submitTime || r.cancelTime || r.returnTime || r.passTime || '';
    if (activeStatus === '草稿') return arr.sort((a, b) => timeOf(b).localeCompare(timeOf(a)));
    if (activeStatus === '待审核' || activeStatus === '审核中')
      return arr.sort((a, b) => (b.submitTime || '').localeCompare(a.submitTime || ''));
    if (activeStatus === '撤销修改')
      return arr.sort((a, b) => (b.cancelTime || '').localeCompare(a.cancelTime || ''));
    if (activeStatus === '退回修改')
      return arr.sort((a, b) => (b.returnTime || '').localeCompare(a.returnTime || ''));
    if (activeStatus === '审核通过')
      return arr.sort((a, b) => (b.passTime || '').localeCompare(a.passTime || ''));
    return arr;
  }, [filteredData, activeStatus, sortKey, sortOrder]);

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useMemo(() => { setPageIndex(1); }, [activeStatus]);

  // ──────────────────────────────────────────────────────────────────
  // 跳转
  // ──────────────────────────────────────────────────────────────────
  const goDetail = (r: AccessRecord) => navigate(`/app/agent-center/detail/${r.id}`);
  const goEdit = (r: AccessRecord) => navigate(`/app/agent-center/edit/${r.id}`);
  const goAudit = (r: AccessRecord) => navigate(`/app/agent-center/audit/${r.id}`);
  // 审核通过 Tab 专用的「立即评测」：跳到新建评测任务页,并把当前智能体名称带入预填
  const goEvaluationCreate = (r: AccessRecord) => {
    const params = new URLSearchParams();
    params.set('agentName', r.name);
    if (r.agentCode) params.set('agentCode', r.agentCode);
    navigate(`/app/evaluation/tasks/create?${params.toString()}`);
  };
  // 审核通过 Tab 专用的「查看台账」：跳到台账列表页,以名称预筛并自动打开此智能体详情
  const goLedgerList = (r: AccessRecord) => {
    const params = new URLSearchParams();
    params.set('search', r.name);
    params.set('openDetail', '1');
    navigate(`/app/ledger/list?${params.toString()}`);
  };
  const goLedgerOverview = () => navigate('/app/ledger');

  // §3.1.1 指向性规则：监听「迷你清单」内记录级按钮（AgentAssistant 派发 CustomEvent）
  //   复用与操作列完全相同的 handler：详情/编辑/审核走导航；删除/撤销走二次确认 Modal
  useEffect(() => {
    const onRowAction = (e: Event) => {
      const { kind, recordId, path } = (e as CustomEvent<{ kind: string; recordId: string; path?: string }>).detail || {};
      const r = records.find((x) => x.id === recordId);
      if (!r) return;
      switch (kind) {
        case 'navigate-detail': goDetail(r); break;
        case 'navigate-edit': goEdit(r); break;
        case 'navigate-audit': goAudit(r); break;
        case 'confirm-delete': setPendingDelete(r); break;
        case 'confirm-cancel': setPendingCancel(r); break;
        case 'navigate-eval': if (path) navigate(path); else goEvaluationCreate(r); break;
        case 'navigate-ledger': goLedgerList(r); break;
        default: break;
      }
    };
    window.addEventListener('agent-bubble-row-action', onRowAction);
    return () => window.removeEventListener('agent-bubble-row-action', onRowAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // ──────────────────────────────────────────────────────────────────
  // 删除 / 撤销
  // ──────────────────────────────────────────────────────────────────
  const doDelete = () => {
    if (!pendingDelete) return;
    removeAccessRecord(pendingDelete.id);
    message.success('删除成功');
    setPendingDelete(null);
  };
  const doCancel = () => {
    if (!pendingCancel) return;
    patchAccessRecord(pendingCancel.id, {
      status: '撤销修改',
      cancelTime: nowISO(0),
    });
    appendAuditNode(pendingCancel.id, {
      label: '撤销',
      time: nowISO(0),
      status: 'wait',
      operator: loginName,
      desc: '申请人主动撤销',
    });
    message.success('撤销成功');
    setPendingCancel(null);
  };

  // ──────────────────────────────────────────────────────────────────
  // 列表列
  // ──────────────────────────────────────────────────────────────────
  const columns: ColumnsType<AccessRecord> = useMemo(() => {
    const base: ColumnsType<AccessRecord> = [
      {
        title: '序号',
        key: 'idx',
        width: 60,
        render: (_v, _r, idx) => (pageIndex - 1) * pageSize + idx + 1,
      },
      {
        title: '智能体编号',
        dataIndex: 'agentCode',
        key: 'agentCode',
        width: 130,
        render: (code: string, r) =>
          code ? (
            <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => goDetail(r)}>
              {code}
            </Button>
          ) : (
            <Text type="secondary">--</Text>
          ),
      },
      {
        title: '智能体名称',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (name: string, r) => (
          <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => goDetail(r)}>
            {name || '未命名草稿'}
          </Button>
        ),
      },
      { title: '所属科室', dataIndex: 'department', key: 'department', width: 110 },
      { title: '诊疗环节', dataIndex: 'clinicalStage', key: 'clinicalStage', width: 110 },
      { title: '智能体来源', dataIndex: 'source', key: 'source', width: 110 },
      {
        title: '供应商名称',
        dataIndex: 'supplier',
        key: 'supplier',
        width: 200,
        render: (s: string) =>
          s ? <Tooltip title={s}>{s.length > truncateLimits.supplier ? `${s.slice(0, truncateLimits.supplier)}...` : s}</Tooltip> : <Text type="secondary">--</Text>,
      },
      {
        title: '核心功能',
        dataIndex: 'description',
        key: 'description',
        width: 200,
        render: (d: string) => ellipsisCell(d, 15),
      },
      {
        title: '智能体版本',
        dataIndex: 'version',
        key: 'version',
        width: 100,
        render: (v: string) => v || <Text type="secondary">--</Text>,
      },
    ];

    const statusCol: ColumnsType<AccessRecord> = [];
    if (activeStatus === '草稿') {
      statusCol.push({
        title: '最后编辑时间',
        dataIndex: 'lastEditTime',
        key: 'lastEditTime',
        width: 220,
        sorter: true,
        render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
      });
    }
    if (activeStatus === '待审核' || activeStatus === '审核中') {
      statusCol.push({
        title: '提交审核时间',
        dataIndex: 'submitTime',
        key: 'submitTime',
        width: 220,
        sorter: true,
        render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
      });
    }
    if (activeStatus === '撤销修改') {
      statusCol.push({
        title: '撤销时间',
        dataIndex: 'cancelTime',
        key: 'cancelTime',
        width: 220,
        sorter: true,
        render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
      });
    }
    if (activeStatus === '退回修改') {
      statusCol.push({
        title: '退回原因说明',
        dataIndex: 'returnReason',
        key: 'returnReason',
        width: 200,
        render: (t: string) => ellipsisCell(t, 15),
      });
      statusCol.push({
        title: '退回时间',
        dataIndex: 'returnTime',
        key: 'returnTime',
        width: 220,
        sorter: true,
        render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
      });
    }
    if (activeStatus === '审核通过') {
      statusCol.push({
        title: '具体说明',
        dataIndex: 'passNote',
        key: 'passNote',
        width: 200,
        render: (t: string) => ellipsisCell(t, 15),
      });
      statusCol.push({
        title: '审核通过时间',
        dataIndex: 'passTime',
        key: 'passTime',
        width: 220,
        sorter: true,
        render: (t: string) => <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
      });
    }
    if (activeStatus === '全部') {
      statusCol.push({
        title: '注册状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        sorter: true,
        render: (s: RegisterStatus) => <Tag color={statusColorMap[s].color}>{s}</Tag>,
      });
      // §4.1.2 预审建议标识：admin 在「全部」Tab 每条记录旁以辅助 Tag 展示
      if (isPlatformAdmin) {
        statusCol.push({
          title: '预审建议',
          key: 'preAudit',
          width: 150,
          render: (_v, r) => {
            const tip = preAuditTipOf(r);
            if (!tip) return <Text type="secondary">--</Text>;
            const color =
              tip.tip === '建议通过' ? 'success' : tip.tip === '建议退回' ? 'error' : 'default';
            return (
              <Tooltip title={`依据已填信息 + 连通结果推断: ${tip.reason}`}>
                <Tag color={color} data-testid="pre-audit-tip">{tip.tip}</Tag>
              </Tooltip>
            );
          },
        });
      }
    }
    if ((activeStatus === '待审核' || activeStatus === '审核中') && isPlatformAdmin) {
      // §4.1.2 待审/审核中 Tab 同样挂「预审建议」辅助标识（窄列）
      statusCol.push({
        title: '预审建议',
        key: 'preAudit',
        width: 130,
        render: (_v, r) => {
          const tip = preAuditTipOf(r);
          if (!tip) return <Text type="secondary">--</Text>;
          const color =
            tip.tip === '建议通过' ? 'success' : tip.tip === '建议退回' ? 'error' : 'default';
          return (
            <Tooltip title={`依据已填信息 + 连通结果推断: ${tip.reason}`}>
              <Tag color={color} data-testid="pre-audit-tip">{tip.tip}</Tag>
            </Tooltip>
          );
        },
      });
    }

    const actionCol: ColumnsType<AccessRecord>[0] = {
      title: '操作',
      key: 'action',
      // 列宽按 Tab 贴合「最宽按钮组合 + 充足余量」,保证按钮一行内展示完、不被截字、右侧不过空:
      // - 「全部」/「草稿」Tab 走「查看详情 + 更多」下拉,固定 160
      // - 撤销修改:最多 3 按钮(查看+编辑+删除) → 230
      // - 待审核 / 审核中:最多 2 按钮(查看+审核/撤销) → 180
      // - 退回修改:2 按钮(查看+编辑) → 200(给两个带图标 link 按钮留足一行展开空间)
      // - 审核通过:3 按钮(查看详情+立即评测+查看台账)→ 260
      // 数值含 8px 单元格左右 padding + 8px 视觉余量;fixed:right 列的实际列宽由列定义宽度决定
      width:
        activeStatus === '全部' ? 160 :
        activeStatus === '草稿' ? 160 :
        activeStatus === '撤销修改' ? 230 :
        activeStatus === '审核通过' ? 260 :
        activeStatus === '退回修改' ? 200 :
        180, // 待审核 / 审核中
      fixed: 'right',
      render: (_v, r) => {
        const isMine = r.applicant === loginName;
        const canOwnerEdit = isMine;
        const canAdminAudit = isPlatformAdmin && !isMine;
        const canOwnerCancel = isMine;

        // 收集该记录在当前身份下可执行的操作菜单项(用于「全部」Tab 的「更多」下拉)
        const moreItems: MenuProps['items'] = [];
        if (r.status === '草稿' && canOwnerEdit) {
          moreItems.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => goEdit(r) });
          moreItems.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => setPendingDelete(r) });
        } else if (r.status === '待审核') {
          if (canAdminAudit) {
            moreItems.push({ key: 'audit', label: '审核', icon: <AuditOutlined />, onClick: () => goAudit(r) });
          }
          if (canOwnerCancel) {
            moreItems.push({ key: 'cancel', label: '撤销', icon: <UndoOutlined />, onClick: () => setPendingCancel(r) });
          }
        } else if (r.status === '审核中' && canOwnerCancel) {
          moreItems.push({ key: 'cancel', label: '撤销', icon: <UndoOutlined />, onClick: () => setPendingCancel(r) });
        } else if (r.status === '退回修改' && canOwnerEdit) {
          moreItems.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => goEdit(r) });
        } else if (r.status === '撤销修改' && canOwnerEdit) {
          moreItems.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => goEdit(r) });
          moreItems.push({ key: 'del', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => setPendingDelete(r) });
        }

        // 「全部」Tab：固定「查看详情 + 更多」下拉,避免一列里出现 2~4 个按钮导致列宽不可控
        if (activeStatus === '全部') {
          return (
            <Space size={4} wrap>
              <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => goDetail(r)}>
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

        // 6 个非「全部」Tab：状态单一,把可执行操作直接平铺展示
        const buttons: React.ReactNode[] = [
          <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => goDetail(r)}>
            查看详情
          </Button>,
        ];
        if (r.status === '草稿' && canOwnerEdit) {
          // 草稿 Tab 与「全部」Tab 一致：走「查看详情 + 更多」下拉(列宽 160)
          // 「更多」下拉复用 moreItems(已按 r.status 分发)
          return (
            <Space size={4} wrap>
              <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => goDetail(r)}>
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
        } else if (r.status === '待审核') {
          if (canAdminAudit) {
            buttons.push(
              <Button key="audit" type="link" size="small" icon={<AuditOutlined />} onClick={() => goAudit(r)}>
                审核
              </Button>,
            );
          }
          if (canOwnerCancel) {
            buttons.push(
              <Button key="cancel" type="link" size="small" icon={<UndoOutlined />} onClick={() => setPendingCancel(r)}>
                撤销
              </Button>,
            );
          }
        } else if (r.status === '审核中' && canOwnerCancel) {
          buttons.push(
            <Button key="cancel" type="link" size="small" icon={<UndoOutlined />} onClick={() => setPendingCancel(r)}>
              撤销
            </Button>,
          );
        } else if (r.status === '退回修改' && canOwnerEdit) {
          buttons.push(
            <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => goEdit(r)}>
              编辑
            </Button>,
          );
        } else if (r.status === '审核通过') {
          // 审核通过 Tab：固定 3 按钮 —— 查看详情(全部) / 立即评测(仅信息科管理员) / 查看台账(全部)
          // · 立即评测：仅 信息科管理员(ROLE_ADMIN)可见,带智能体名称预填跳到新建评测任务
          // · 查看台账：所有角色可见,跳到台账列表页并自动打开此智能体详情
          if (isPlatformAdmin) {
            buttons.push(
              <Button
                key="eval"
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => goEvaluationCreate(r)}
              >
                立即评测
              </Button>,
            );
          }
          buttons.push(
            <Button
              key="ledger"
              type="link"
              size="small"
              icon={<DatabaseOutlined />}
              onClick={() => goLedgerList(r)}
            >
              查看台账
            </Button>,
          );
        } else if (r.status === '撤销修改' && canOwnerEdit) {
          buttons.push(
            <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => goEdit(r)}>
              编辑
            </Button>,
            <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => setPendingDelete(r)}>
              删除
            </Button>,
          );
        }
        return <Space size={4}>{buttons}</Space>;
      },
    };
    return [...base, ...statusCol, actionCol];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus, truncateLimits, pageIndex, pageSize, records, loginName, isPlatformAdmin]);

  // ──────────────────────────────────────────────────────────────────
  // Tab 项
  // ──────────────────────────────────────────────────────────────────
  const tabItems = statusListKeys.map((s) => ({
    key: s.key,
    label: (
      <Space>
        {s.label}
        <Tag>{counts[s.key] ?? 0}</Tag>
      </Space>
    ),
  }));

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        title="注册管理"
        subTitle="按注册状态分页管理全部注册记录"
        extra={
          <Space>
            {activeStatus === '审核通过' && (
              <Button icon={<DatabaseOutlined />} onClick={goLedgerOverview}>
                台账总览
              </Button>
            )}
            <Button
              type="primary"
              icon={<ThunderboltFilled />}
              onClick={() => navigate('/app/agent-center/smart-register')}
              style={{
                background: 'linear-gradient(90deg,#1677FF 0%,#4096FF 100%)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(22,119,255,0.25)',
              }}
            >
              新建注册
            </Button>
          </Space>
        }
      />

      {/* §3.4.1.1 / §4.1.1 全局接入态势已下沉到 AgentAssistant 旁气泡，
          通过 store.activeWelcome.chips 与 actions 投递（见 index.tsx pushWelcomeGreeting 调用） */}

      <Card style={{ marginTop: 0, marginBottom: 12 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索智能体名称"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            placeholder="所属科室"
            value={deptFilter || undefined}
            onChange={(v) => setDeptFilter(v || '')}
            options={departmentOptions}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="诊疗环节"
            value={stageFilter || undefined}
            onChange={(v) => setStageFilter(v || '')}
            options={clinicalStageOptions}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="智能体来源"
            value={sourceFilter || undefined}
            onChange={(v) => setSourceFilter(v || '')}
            options={sourceOptions}
            style={{ width: 140 }}
          />
          {/* §4.1.1 提交时间区间（PRD 明示） */}
          <span data-testid="submit-range" style={{ display: 'inline-block' }}>
            <DatePicker.RangePicker
              value={
                submitRange
                  ? [
                      submitRange[0] ? (dayjs as any)(submitRange[0]) : null,
                      submitRange[1] ? (dayjs as any)(submitRange[1]) : null,
                    ]
                  : null
              }
              onChange={(d) => {
                if (!d || !d[0] || !d[1]) {
                  setSubmitRange(null);
                  return;
                }
                setSubmitRange([
                  (d[0] as any).format('YYYY-MM-DD'),
                  (d[1] as any).format('YYYY-MM-DD'),
                ]);
              }}
              placeholder={['提交时间起', '提交时间止']}
            />
          </span>
          {/* §4.1.1 重置同行（PRD 提到筛选行为紧凑） */}
          <Button
            size="small"
            onClick={() => {
              setSearchText('');
              setDeptFilter('');
              setSourceFilter('');
              setStageFilter('');
              setSubmitRange(null);
            }}
          >
            重置筛选
          </Button>
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={activeStatus}
          onChange={(k) => setActiveStatus(k as RegisterStatus | '全部')}
          items={tabItems}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={sortedData}
          scroll={{ x: 1900 }}
          onChange={(_p, _ps, sorter: any) => {
            // §4.1.2 列表列点击排序（PRD 明示）
            if (Array.isArray(sorter)) sorter = sorter[0];
            if (!sorter || !sorter.columnKey) {
              setSortKey(null);
              setSortOrder(null);
              return;
            }
            setSortKey(sorter.columnKey);
            setSortOrder(sorter.order);
          }}
          pagination={{
            current: pageIndex,
            pageSize,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPageIndex(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: <Empty description={`暂无 ${activeStatus} 状态的注册记录`} /> }}
        />
      </Card>

      {/* 删除草稿 二次确认 */}
      <Modal
        open={!!pendingDelete}
        title="确认是否删除"
        onCancel={() => setPendingDelete(null)}
        onOk={doDelete}
        okText="是"
        cancelText="否"
        okButtonProps={{ danger: true }}
      >
        <Text>将删除「{pendingDelete?.name}」草稿记录，删除后不可恢复。</Text>
      </Modal>

      {/* 撤销 二次确认 */}
      <Modal
        open={!!pendingCancel}
        title="确认是否撤销"
        onCancel={() => setPendingCancel(null)}
        onOk={doCancel}
        okText="是"
        cancelText="否"
      >
        <Text>撤销后「{pendingCancel?.name}」将移至撤销修改列表页，可在撤销列表中编辑重提或删除。</Text>
      </Modal>

      {/* 角色占位（保留导出，供未来按 role 区分展示） */}
      <span style={{ display: 'none' }} aria-hidden>{ROLE_DEPT}</span>
    </div>
  );
};

const AgentCenter = () => {
  const { demoRole, newUserRoles } = useDemoSettings();
  if (newUserRoles[demoRole]) return <NewUserConsole kind="register" />;
  return <AgentCenterContent />;
};

export default AgentCenter;
