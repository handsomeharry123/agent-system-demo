/**
 * 6.1 事件管理列表页（V1.8 — 8 Tab）
 * 需求文档：统一运行监控中心-需求说明文档 V1.8 §6.1
 *
 * Tab 顺序：
 *   全部事件 / 待分派事件（仅管理员）/ 待处理事件 / 处理中事件 /
 *   待审核事件 / 审核中事件 / 已关闭事件 / 已忽略事件
 *
 * 每个 Tab 的字段口径不同（按 §6.1.1 ~ §6.1.8）；
 * 各 Tab 列表默认按触发时间排序。
 *
 * 角色 × Tab 数据范围（V1.8.2 修订）：
 *   - 「待分派」仅信息科管理员可见；其余 Tab 科室管理员只看到分派给自己的事件（handler === 当前用户）。
 *   - 信息科管理员在「待处理 / 处理中」Tab 对非自己处理的事件仅展示「查看详情」；
 *     开始处理 / 处理 / 转派 仅在 handler === 当前用户 时展示。
 *   - 信息科管理员在「待审核」Tab 拥有「审核」按钮；科室管理员进入审核 Tab 仅查看详情。
 *   - 信息科管理员在「审核中」Tab 同样拥有「审核」按钮（支持继续审核）；
 *     科室管理员仅展示分派给自己的事件，且仅展示「查看详情」。
 *   - 其余 Tab（已关闭 / 已忽略）两个角色均仅展示「查看详情」。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Tabs, Space, Typography, Input, Select, Button, Row, Col, Tag, Empty,
  Modal, Form, Radio, message, DatePicker, Tooltip, Dropdown,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, ExclamationCircleOutlined, EyeOutlined,
  SwapOutlined, PlayCircleOutlined, CheckCircleOutlined, MinusCircleOutlined,
  UserOutlined, ClockCircleOutlined, AuditOutlined,
} from '@ant-design/icons';
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import PageHeader from '../../components/PageHeader';
import {
  mockAlertEventsV18, AlertEventStatusLabels, AlertEventStatusColors,
  NotifyChannelLabels, type AlertEventV18, type AlertEventStatus,
} from '../../mock/monitoringV18';
import { useMonitoringGuard } from './useMonitoringGuard';
import { mockUsers } from '../../mock/users';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

type TabKey = 'all' | 'pending_assign' | 'pending_handle' | 'handling' | 'pending_review' | 'reviewing' | 'closed' | 'ignored';

// 各 Tab 标题与基础状态过滤
const tabMeta: Record<TabKey, { label: string; filter: (e: AlertEventV18) => boolean; adminOnly?: boolean }> = {
  all: { label: '全部事件', filter: () => true },
  pending_assign: { label: '待分派事件', filter: (e) => e.status === 'pending_assign', adminOnly: true },
  pending_handle: { label: '待处理事件', filter: (e) => e.status === 'pending_handle' },
  handling: { label: '处理中事件', filter: (e) => e.status === 'handling' },
  pending_review: { label: '待审核事件', filter: (e) => e.status === 'pending_review' },
  reviewing: { label: '审核中事件', filter: (e) => e.status === 'reviewing' },
  closed: { label: '已关闭事件', filter: (e) => e.status === 'closed' },
  ignored: { label: '已忽略事件', filter: (e) => e.status === 'ignored' },
};

const formatTime = (s?: string) => s ? s : '—';

// 系统用户中心可选处理人：仅在职用户，按部门 + 姓名排序；选项展示「姓名（角色）」
const assigneeOptions = mockUsers
  .filter((u) => u.status === '在职')
  .slice()
  .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name))
  .map((u) => ({
    value: u.name,
    label: `${u.name}（${u.roles.join('/')}）`,
  }));

const AlertEventListV18 = () => {
  const navigate = useNavigate();
  const { isAdmin, currentUserName } = useMonitoringGuard();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<AlertEventV18[]>(mockAlertEventsV18);
  const [activeTab, setActiveTab] = useState<TabKey>((searchParams.get('tab') as TabKey) || 'pending_handle');
  const [keyword, setKeyword] = useState(searchParams.get('search') || searchParams.get('agentName') || '');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(
    searchParams.get('type') || undefined,
  );

  // 操作弹窗
  const [actionModal, setActionModal] = useState<{
    open: boolean; mode: 'assign' | 'reassign' | 'handle' | 'start_handle' | 'review'; event: AlertEventV18 | null;
  }>({ open: false, mode: 'assign', event: null });
  const [actionForm] = Form.useForm();

  // 联动：URL 参数消费 — 只清掉 search/agentName/type（避免重复预筛）；tab 保留以便刷新后仍停留在对应 Tab
  useEffect(() => {
    const sp = searchParams;
    if (!sp.get('search') && !sp.get('agentName') && !sp.get('type')) return;
    const next = new URLSearchParams(sp);
    next.delete('search');
    next.delete('agentName');
    next.delete('type');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 联动：台账列表「查看监控告警」会带 ?tab=closed 等跳转，自动切到对应 tab
  useEffect(() => {
    const t = searchParams.get('tab') as TabKey;
    if (t && Object.keys(tabMeta).includes(t)) {
      setActiveTab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 角色切换后的 activeTab 校正：若当前 Tab 对当前角色不可见，回退到「待处理事件」
  // （如信息科管理员 → 科室管理员，停留在「待分派」时回退）
  useEffect(() => {
    if (!isAdmin && activeTab === 'pending_assign') {
      setActiveTab('pending_handle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // 角色 × Tab 可见性过滤：
  //   - 待分派：仅管理员
  //   - 全部：管理员看全部 / 科室管理员仅看到分派给自己的事件
  //   - 其余 Tab：管理员看全部；科室管理员仅 handler === currentUserName 且状态匹配
  const roleScopedFilter = useMemo(() => {
    return (tab: TabKey, e: AlertEventV18): boolean => {
      if (tab === 'pending_assign') return isAdmin && e.status === 'pending_assign';
      if (!isAdmin) {
        // 科室管理员：所有 Tab 统一收窄到 handler === 自己
        return tab === 'all'
          ? e.handler === currentUserName
          : e.handler === currentUserName && tabMeta[tab].filter(e);
      }
      return tabMeta[tab].filter(e);
    };
  }, [isAdmin, currentUserName]);

  // 列表过滤（角色可见 + Tab 状态 + 关键词 + 类型）
  const filtered = useMemo(() => {
    let list = events.filter((e) => roleScopedFilter(activeTab, e));
    if (keyword) {
      const k = keyword.toLowerCase();
      list = list.filter((e) =>
        e.agentName.toLowerCase().includes(k) ||
        e.triggerContent.rule_name.toLowerCase().includes(k) ||
        e.id.toLowerCase().includes(k),
      );
    }
    if (typeFilter) list = list.filter((e) => e.eventType === typeFilter);
    // 按触发时间排序
    return list.slice().sort((a, b) => +new Date(b.triggerTime) - +new Date(a.triggerTime));
  }, [events, activeTab, keyword, typeFilter, roleScopedFilter]);

  // V2.3：删除早期 `if (!isAdmin && activeTab === 'pending_assign') return <PermissionDenied/>`
  //   早期 early return 出现在 useMemo（filtered、tabCounts）等 hooks 之前，
  //   导致 React 在科室管理员 + URL ?tab=pending_assign 场景下触发
  //   "Rendered fewer hooks than expected" 错误（页面被 ErrorBoundary 替换为 "Something went wrong."，
  //   用户感知为「拒绝访问」/「页面打不开」）。
  //   改用派生过滤 + useEffect 自动收敛：
  //     1. roleScopedFilter 对科室管理员的 pending_assign 永远返回 false（已实现），
  //        → 列表为空，配合 Tabs 处对 adminOnly Tab 的隐藏，自然不会展示「待分派」内容。
  //     2. 上方 useEffect 会在科室管理员进入页面后立即把 activeTab 收敛到 pending_handle。

  // 序号列渲染
  const renderIndex = (_: any, __: any, index: number) => index + 1;

  // 通用列：触发告警内容（结构化折叠）
  const renderTriggerContent = (e: AlertEventV18) => (
    <Tooltip title={
      <div style={{ fontSize: 12 }}>
        <div>指标：{e.triggerContent.trigger_condition.metric}</div>
        <div>运算符/阈值：{e.triggerContent.trigger_condition.operator} {e.triggerContent.trigger_condition.threshold}{e.triggerContent.trigger_condition.thresholdUnit}</div>
        <div>持续时间：{e.triggerContent.trigger_condition.sustainDuration}</div>
      </div>
    }>
      <Space direction="vertical" size={0}>
        <Text strong style={{ fontSize: 13 }}>{e.triggerContent.rule_name}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {e.triggerContent.trigger_condition.metric} {e.triggerContent.trigger_condition.operator} {e.triggerContent.trigger_condition.threshold}{e.triggerContent.trigger_condition.thresholdUnit}
        </Text>
      </Space>
    </Tooltip>
  );

  // 是否本人处理人（用于「开始处理 / 处理 / 转派」按钮的条件渲染）
  const isSelfHandler = (e: AlertEventV18) =>
    !!currentUserName && e.handler === currentUserName;

  // 信息科管理员点击「审核」即接手事件：先转入审核中，再进入审核页。
  const beginReview = useCallback((event: AlertEventV18) => {
    const reviewStartedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const reviewingEvent: AlertEventV18 = event.status === 'pending_review'
      ? {
        ...event,
        status: 'reviewing',
        reviewer: currentUserName || '信息科管理员',
        reviewStartTime: reviewStartedAt,
        handleTimeline: [
          ...(event.handleTimeline || []),
          { time: reviewStartedAt, action: '审核中', operator: currentUserName || '信息科管理员', remark: '开始审核处理结果与处置方案' },
        ],
      }
      : event;
    if (event.status === 'pending_review') {
      setEvents((current) => current.map((item) => item.id === event.id ? reviewingEvent : item));
      const mockIndex = mockAlertEventsV18.findIndex((item) => item.id === event.id);
      if (mockIndex >= 0) mockAlertEventsV18[mockIndex] = reviewingEvent;
      message.success('事件已转入「审核中事件」');
    }
    navigate(`/app/monitoring/alert-events/${event.id}/review?tab=reviewing`);
  }, [currentUserName, navigate]);

  // 列定义
  const baseColumns: ProColumns<AlertEventV18>[] = [
    { title: '序号', key: 'index', width: 56, render: renderIndex },
    {
      title: '事件类型', dataIndex: 'eventType', key: 'eventType', width: 100,
      render: (_, r) => {
        const colorMap: Record<string, string> = { business: 'blue', status: 'green', cost: 'orange', security: 'red' };
        const labelMap: Record<string, string> = { business: '业务监控', status: '状态监控', cost: '成本监控', security: '安全监控' };
        return <Tag color={colorMap[r.eventType]}>{labelMap[r.eventType]}</Tag>;
      },
    },
    { title: '关联智能体', dataIndex: 'agentName', key: 'agentName', width: 170, ellipsis: true, render: (n: any, r) => <Link to={`/app/ledger/list?agentId=${r.agentId}`}><Text>{n}</Text></Link> },
    {
      title: '告警指标', key: 'metric', width: 110,
      render: (_, r) => (
        <Tooltip title={`${r.triggerContent.trigger_condition.operator} ${r.triggerContent.trigger_condition.threshold}${r.triggerContent.trigger_condition.thresholdUnit} · ${r.triggerContent.trigger_condition.sustainDuration}`}>
          <Text style={{ fontSize: 12 }}>{r.triggerContent.trigger_condition.metric}</Text>
        </Tooltip>
      ),
    },
    {
      title: '触发告警内容', key: 'triggerContent', width: 220,
      render: (_, r) => renderTriggerContent(r),
    },
    {
      title: '通知对象', key: 'notifyTarget', width: 150,
      render: (_, r) => (
        <Tooltip title={`${r.notifyTarget.account} · ${r.notifyTarget.owner}${r.notifyTarget.phone ? ' · ' + r.notifyTarget.phone : ''}`}>
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{r.notifyTarget.account}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>负责人：{r.notifyTarget.owner}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '通知方式', key: 'notifyChannels', width: 140,
      render: (_, r) => (
        <Space size={2} wrap>
          {r.notifyChannels.map((c) => <Tag key={c} color="blue">{NotifyChannelLabels[c]}</Tag>)}
        </Space>
      ),
    },
    {
      title: '当前状态', key: 'status', width: 88,
      render: (_, r) => <Tag color={AlertEventStatusColors[r.status]}>{AlertEventStatusLabels[r.status]}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right',
      render: (_, r) => {
        const self = isSelfHandler(r);
        const viewBtn = (
          <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/app/monitoring/alert-events/${r.id}`)}>查看详情</Button>
        );

        // === 全部事件 Tab：「查看详情 + 更多操作」下拉 ===
        if (activeTab === 'all') {
          const moreItems: { key: string; label: React.ReactNode; onClick?: () => void }[] = [];
          if (isAdmin && r.status === 'pending_assign') {
            moreItems.push({
              key: 'assign',
              label: <><SwapOutlined /> 分派</>,
              onClick: () => openAction(r, 'assign'),
            });
          }
          if (r.status === 'pending_handle' && (isAdmin ? self : true)) {
            moreItems.push({
              key: 'start_handle',
              label: <><PlayCircleOutlined /> 开始处理</>,
              onClick: () => openAction(r, 'start_handle'),
            });
          }
          if (r.status === 'handling' && (isAdmin ? self : true)) {
            moreItems.push({
              key: 'handle',
              label: <><PlayCircleOutlined /> 处理</>,
              onClick: () => openAction(r, 'handle'),
            });
          }
          if ((r.status === 'pending_handle' || r.status === 'handling') && (isAdmin ? self : true)) {
            moreItems.push({
              key: 'reassign',
              label: <><SwapOutlined /> 转派</>,
              onClick: () => openAction(r, 'reassign'),
            });
          }
          if (isAdmin && r.status === 'pending_review') {
            moreItems.push({
              key: 'review',
              label: <><AuditOutlined /> 审核</>,
              onClick: () => beginReview(r),
            });
          }
          return (
            <Space size={4} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
              {viewBtn}
              {moreItems.length > 0 && (
                <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                  <Button type="link" size="small">更多操作</Button>
                </Dropdown>
              )}
            </Space>
          );
        }

        // === 其它状态 Tab：平铺按钮 ===
        // 待分派（仅管理员）：查看详情 + 分派
        if (isAdmin && r.status === 'pending_assign') {
          return (
            <Space size={2} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
              {viewBtn}
              <Button key="assign" type="link" size="small" icon={<SwapOutlined />}
                onClick={() => openAction(r, 'assign')}>分派</Button>
            </Space>
          );
        }
        // 待处理：管理员看全部但「开始处理/转派」仅本人；科室管理员在 Tab 内已过滤到本人
        if (r.status === 'pending_handle' && (isAdmin ? self : true)) {
          return (
            <Space size={2} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
              {viewBtn}
              <Button key="start_handle" type="link" size="small" icon={<PlayCircleOutlined />}
                onClick={() => openAction(r, 'start_handle')}>开始处理</Button>
              <Button key="reassign" type="link" size="small" icon={<SwapOutlined />}
                onClick={() => openAction(r, 'reassign')}>转派</Button>
            </Space>
          );
        }
        // 处理中：同上，「处理/转派」仅本人
        if (r.status === 'handling' && (isAdmin ? self : true)) {
          return (
            <Space size={2} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
              {viewBtn}
              <Button key="handle" type="link" size="small" icon={<PlayCircleOutlined />}
                onClick={() => openAction(r, 'handle')}>处理</Button>
              <Button key="reassign" type="link" size="small" icon={<SwapOutlined />}
                onClick={() => openAction(r, 'reassign')}>转派</Button>
            </Space>
          );
        }
        // 待审核：管理员有「审核」；科室管理员仅查看
        if (r.status === 'pending_review') {
          return (
            <Space size={2} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
              {viewBtn}
              {isAdmin && (
                <Button key="review" type="link" size="small" icon={<AuditOutlined />}
                  onClick={() => beginReview(r)}>审核</Button>
              )}
            </Space>
          );
        }
        // 审核中：管理员有「审核」（继续审核）；科室管理员仅查看详情
        if (r.status === 'reviewing') {
          return (
            <Space size={2} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
              {viewBtn}
              {isAdmin && (
                <Button key="review" type="link" size="small" icon={<AuditOutlined />}
                  onClick={() => beginReview(r)}>审核</Button>
              )}
            </Space>
          );
        }
        // 已关闭 / 已忽略：两个角色都仅查看详情
        return viewBtn;
      },
    },
  ];

  // 不同 Tab 追加的列
  // 操作列宽度按 Tab 平铺按钮数量分发：
  //   pending_handle / handling 三按钮(查看详情 + 开始处理/处理 + 转派)= 240
  //   pending_assign 二按钮(查看详情 + 分派) = 160
  //   pending_review / reviewing 二按钮(查看详情 + 审核) = 160
  //   closed / ignored 单按钮 = 160
  const extendedColumns: ProColumns<AlertEventV18>[] = [
    ...baseColumns.slice(0, 7),
    { title: '触发时间', dataIndex: 'triggerTime', key: 'triggerTime', width: 140, render: formatTime },
    ...baseColumns.slice(7, 8),
    { ...baseColumns[8] }, // 操作列：160
  ];

  const pendingHandleColumns: ProColumns<AlertEventV18>[] = [
    ...extendedColumns.slice(0, 8),
    {
      title: '处理时间线', key: 'timeline', width: 200, ellipsis: true,
      render: (_, r) => {
        const tl = r.handleTimeline || [];
        if (tl.length === 0) return <Text type="secondary">—</Text>;
        const last = tl[tl.length - 1];
        return (
          <Tooltip title={tl.map((it) => `${it.time} ${it.action} ${it.operator}${it.remark ? ' · ' + it.remark : ''}`).join('\n')}>
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: 12 }}>{last.action} - {last.operator}</Text>
              {r.returnReason && <Text type="warning" style={{ fontSize: 11 }}>退回：{r.returnReason}</Text>}
            </Space>
          </Tooltip>
        );
      },
    },
    { title: '分派时间', dataIndex: 'assignTime', key: 'assignTime', width: 140, render: formatTime },
    ...extendedColumns.slice(8, 9),
    { ...baseColumns[8], width: 240 }, // 操作列：三按钮（查看详情 + 开始处理 + 转派）
  ];

  const handlingColumns: ProColumns<AlertEventV18>[] = [
    ...baseColumns.slice(0, 5),
    { title: '处理人', dataIndex: 'handler', key: 'handler', width: 90, render: formatTime },
    ...baseColumns.slice(5, 7),
    { title: '开始处理时间', dataIndex: 'handleStartTime', key: 'handleStartTime', width: 140, render: formatTime },
    ...baseColumns.slice(7, 8),
    { ...baseColumns[8], width: 240 }, // 操作列：三按钮(查看详情 + 处理 + 转派)
  ];

  const reviewColumns: ProColumns<AlertEventV18>[] = [
    ...baseColumns.slice(0, 5),
    { title: '处理人', dataIndex: 'handler', key: 'handler', width: 90, render: formatTime },
    ...baseColumns.slice(5, 7),
    {
      title: '处理结果', dataIndex: 'handleResult', key: 'handleResult', width: 90,
      render: (v?: string) => v ? <Tag color={v === '已处理' ? 'success' : 'default'}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: '处理方案', dataIndex: 'handlePlan', key: 'handlePlan', width: 180, ellipsis: true,
      render: (v?: string) => v ? <Tooltip title={v}><Text type="secondary" style={{ fontSize: 12 }}>{v}</Text></Tooltip> : <Text type="secondary">—</Text>,
    },
    { title: '处理完成时间', dataIndex: 'handleCompleteTime', key: 'handleCompleteTime', width: 140, render: formatTime },
    ...baseColumns.slice(7, 8),
    { ...baseColumns[8] }, // 操作列：1~2 按钮（管理员 待审核/审核中 =2，已忽略=1）
  ];

  const closedColumns: ProColumns<AlertEventV18>[] = [
    ...baseColumns.slice(0, 5),
    { title: '处理人', dataIndex: 'handler', key: 'handler', width: 90, render: formatTime },
    ...baseColumns.slice(5, 6),
    {
      title: '通知方式', key: 'notifyChannels', width: 200,
      render: (_, r) => (
        <Space size={2}>
          {r.notifyChannels.map((c) => <Tag key={c} color="blue">{NotifyChannelLabels[c]}</Tag>)}
        </Space>
      ),
    },
    {
      title: '处理人联系方式', key: 'handlerContact', width: 160,
      render: (_, r) => {
        const c = r.handlerContact || r.notifyTarget;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{c.account}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{c.phone || c.email}</Text>
          </Space>
        );
      },
    },
    {
      title: '处理结果', dataIndex: 'handleResult', key: 'handleResult', width: 90,
      render: (v?: string) => v ? <Tag color={v === '已处理' ? 'success' : 'default'}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: '处理方案', dataIndex: 'handlePlan', key: 'handlePlan', width: 180, ellipsis: true,
      render: (v?: string) => v ? <Tooltip title={v}><Text type="secondary" style={{ fontSize: 12 }}>{v}</Text></Tooltip> : <Text type="secondary">—</Text>,
    },
    { title: '触发时间', dataIndex: 'triggerTime', key: 'triggerTime', width: 140, render: formatTime },
    { title: '处理完成时间', dataIndex: 'handleCompleteTime', key: 'handleCompleteTime', width: 140, render: formatTime },
    ...baseColumns.slice(7, 8),
    { ...baseColumns[8] }, // 操作列：1 按钮（查看详情）
  ];

  // 各 Tab 使用的列
  const tabColumns: Record<TabKey, ProColumns<AlertEventV18>[]> = {
    all: baseColumns,
    pending_assign: extendedColumns,
    pending_handle: pendingHandleColumns,
    handling: handlingColumns,
    pending_review: reviewColumns,
    reviewing: reviewColumns,
    closed: closedColumns,
    ignored: reviewColumns,
  };

  // 打开操作弹窗
  const openAction = (e: AlertEventV18, mode: 'assign' | 'reassign' | 'handle' | 'start_handle' | 'review') => {
    actionForm.resetFields();
    // 「开始处理」直接走 submitAction 写库 + 提示，不再弹窗
    if (mode === 'start_handle') {
      submitStartHandle(e);
      return;
    }
    setActionModal({ open: true, mode, event: e });
  };

  // 「开始处理」直接提交：状态 → handling，由当前登录用户接手
  const submitStartHandle = (e: AlertEventV18) => {
    const idx = events.findIndex((x) => x.id === e.id);
    if (idx < 0) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const operator = currentUserName || '当前用户';
    const next = [...events];
    next[idx] = {
      ...e,
      status: 'handling',
      handler: operator,
      handleStartTime: now,
      handleTimeline: [
        ...(e.handleTimeline || []),
        { time: now, action: '开始处理', operator, remark: `由 ${operator} 开始处理` },
      ],
    };
    setEvents(next);
    message.success(`事件已开始处理，事件转入到「处理中事件」`);
    actionRef.current?.reload();
  };

  // 提交操作
  const submitAction = async () => {
    if (!actionModal.event) return;
    try {
      const values = await actionForm.validateFields();
      const e = actionModal.event;
      const idx = events.findIndex((x) => x.id === e.id);
      if (idx < 0) return;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const operator = currentUserName || '当前用户';
      const next = [...events];

      if (actionModal.mode === 'assign') {
        next[idx] = {
          ...e,
          status: 'pending_handle',
          assignTime: now,
          assigner: operator,
          handler: values.assignee,
          handleTimeline: [
            ...(e.handleTimeline || []),
            { time: now, action: '分派', operator, remark: `分派给 ${values.assignee}` },
          ],
        };
        message.success('已分派给处理人，事件进入「待处理事件」');
      } else if (actionModal.mode === 'reassign') {
        // 转派：状态保持 pending_handle / handling 不变，仅替换处理人 + 写时间线
        const prevHandler = e.handler || '—';
        next[idx] = {
          ...e,
          handler: values.assignee,
          reassignTime: now,
          reassigner: operator,
          handleTimeline: [
            ...(e.handleTimeline || []),
            { time: now, action: '转派', operator, remark: `由 ${prevHandler} 转派给 ${values.assignee}` },
          ],
        };
        message.success(`已转派给 ${values.assignee}`);
      } else if (actionModal.mode === 'handle') {
        // 「处理」模式：填写处理结果与处理方案，提交后进入 待审核 / 已忽略
        if (values.handleResult === '已忽略') {
          next[idx] = {
            ...e,
            status: 'ignored',
            handleCompleteTime: now,
            handleResult: '已忽略',
            handlePlan: values.handlePlan,
            reviewOpinion: '同意忽略该告警事项',
            reviewRemark: `处理人确认该事件无需继续处置：${values.handlePlan}`,
            handleTimeline: [
              ...(e.handleTimeline || []),
              { time: now, action: '已忽略', operator, remark: values.handlePlan },
            ],
          };
          message.success('已忽略事件');
        } else {
          // 已处理：进入 待审核 状态
          next[idx] = {
            ...e,
            status: 'pending_review',
            handleCompleteTime: now,
            handleResult: '已处理',
            handlePlan: values.handlePlan,
            handleTimeline: [
              ...(e.handleTimeline || []),
              { time: now, action: '处理完成', operator, remark: values.handlePlan },
            ],
          };
          message.success('处理完成，事件已转入「待审核事件」');
        }
      }

      setEvents(next);
      setActionModal({ open: false, mode: 'assign', event: null });
      actionRef.current?.reload();
    } catch (e) { /* ignore */ }
  };

  const currentTabMeta = tabMeta[activeTab];

  // Tab 计数：按角色可见性过滤后再统计
  const tabCounts = useMemo(() => {
    const out: Record<TabKey, number> = {
      all: 0, pending_assign: 0, pending_handle: 0, handling: 0,
      pending_review: 0, reviewing: 0, closed: 0, ignored: 0,
    };
    (Object.keys(tabMeta) as TabKey[]).forEach((k) => {
      out[k] = events.filter((e) => roleScopedFilter(k, e)).length;
    });
    return out;
  }, [events, roleScopedFilter]);

  const switchToTab = useCallback((tab: TabKey) => {
    if (!tabMeta[tab] || (tabMeta[tab].adminOnly && !isAdmin)) return;
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  }, [isAdmin, setSearchParams]);

  useEffect(() => {
    if (activeTab !== 'all' && activeTab !== 'pending_assign' && activeTab !== 'pending_handle' && activeTab !== 'handling' && activeTab !== 'pending_review' && activeTab !== 'reviewing' && activeTab !== 'closed' && activeTab !== 'ignored') {
      consumeWelcome();
      return undefined;
    }
    if (activeTab === 'pending_assign') {
      pushWelcomeGreeting('monitoring-alert-pending-assign', 'admin', () => [tabCounts.pending_assign], {
        windowReplacements: [tabCounts.pending_assign],
      });
    } else if (activeTab === 'all') {
      const replacements = [tabCounts.all, tabCounts.pending_handle, tabCounts.pending_review];
      pushWelcomeGreeting('monitoring-alert-events', isAdmin ? 'admin' : 'dept', () => replacements, {
        windowReplacements: replacements,
        chips: [
          { key: 'all-alert-events', label: `告警事件 ${tabCounts.all} 项`, targetTab: 'all' },
          { key: 'pending-alert-events', label: `待处理 ${tabCounts.pending_handle} 项`, targetTab: 'pending_handle', tone: 'error' },
          { key: 'review-alert-events', label: `待审核 ${tabCounts.pending_review} 项`, targetTab: 'pending_review', tone: 'warning' },
        ],
      });
    } else if (activeTab === 'closed') {
      pushWelcomeGreeting('monitoring-alert-closed', isAdmin ? 'admin' : 'dept', () => [tabCounts.closed], {
        windowReplacements: [tabCounts.closed],
        actions: [{ key: 'view-closed-detail', label: '查看详情', event: 'monitoring-view-closed-detail', enabled: tabCounts.closed > 0, reason: tabCounts.closed > 0 ? undefined : '当前暂无已关闭事件' }],
      });
    } else if (activeTab === 'ignored') {
      pushWelcomeGreeting('monitoring-alert-ignored', isAdmin ? 'admin' : 'dept', () => [tabCounts.ignored], {
        windowReplacements: [tabCounts.ignored],
        actions: [{ key: 'view-ignored-detail', label: '查看详情', event: 'monitoring-view-ignored-detail', enabled: tabCounts.ignored > 0, reason: tabCounts.ignored > 0 ? undefined : '当前暂无已忽略事件' }],
      });
    } else if (activeTab === 'pending_review') {
      pushWelcomeGreeting('monitoring-alert-pending-review', isAdmin ? 'admin' : 'dept', () => [tabCounts.pending_review], {
        windowReplacements: [tabCounts.pending_review],
      });
    } else if (activeTab === 'reviewing') {
      pushWelcomeGreeting('monitoring-alert-reviewing', isAdmin ? 'admin' : 'dept', () => [tabCounts.reviewing], {
        windowReplacements: [tabCounts.reviewing],
      });
    } else if (activeTab === 'handling') {
      pushWelcomeGreeting('monitoring-alert-handling', isAdmin ? 'admin' : 'dept', () => [tabCounts.pending_handle], {
        windowReplacements: [tabCounts.handling],
      });
    } else {
      pushWelcomeGreeting('monitoring-alert-pending', isAdmin ? 'admin' : 'dept', () => [tabCounts.pending_handle], {
        windowReplacements: [tabCounts.pending_handle],
        chips: [
          { key: 'pending-alert-events', label: `待处理 ${tabCounts.pending_handle} 项`, targetTab: 'pending_handle', tone: 'error' },
          { key: 'handling-alert-events', label: `处理中 ${tabCounts.handling} 项`, targetTab: 'handling' },
        ],
      });
    }
    return () => consumeWelcome();
  }, [activeTab, consumeWelcome, isAdmin, pushWelcomeGreeting, tabCounts.all, tabCounts.closed, tabCounts.handling, tabCounts.ignored, tabCounts.pending_assign, tabCounts.pending_handle, tabCounts.pending_review, tabCounts.reviewing]);

  // 医小管对话联动：筛选待处理事件、直达详情、将事件转入处理中。
  useEffect(() => {
    const onAssistantQuery = (rawEvent: Event) => {
      const detail = (rawEvent as CustomEvent<{ text: string; respond?: (answer: string) => void }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;

      if (activeTab === 'pending_assign') {
        if (!isAdmin) {
          detail.respond?.('待分派事件仅支持信息科管理员操作。');
          return;
        }
        const pendingAssignEvents = events.filter((e) => roleScopedFilter('pending_assign', e));
        if (pendingAssignEvents.length === 0) {
          detail.respond?.('当前没有待分派告警事件。');
          return;
        }
        const assignee = mockUsers.find((user) => user.status === '在职' && text.includes(user.name));
        if (!assignee) {
          detail.respond?.('请告诉我分派对象的姓名，例如“全部分派给王建国”。');
          return;
        }
        const explicitlyMatched = pendingAssignEvents.filter((event) =>
          text.includes(event.agentName) || text.includes(event.id) ||
          text.includes(event.triggerContent.rule_name) || text.includes(event.triggerContent.trigger_condition.metric),
        );
        const targets = explicitlyMatched.length > 0 ? explicitlyMatched : pendingAssignEvents;
        const targetIds = new Set(targets.map((event) => event.id));
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const operator = currentUserName || '当前用户';
        const assignEvent = (event: AlertEventV18): AlertEventV18 => ({
          ...event,
          status: 'pending_handle',
          assignTime: now,
          assigner: operator,
          handler: assignee.name,
          handlerContact: {
            account: assignee.employeeId,
            owner: assignee.name,
            phone: assignee.phone,
            email: assignee.email,
          },
          handleTimeline: [
            ...(event.handleTimeline || []),
            { time: now, action: '分派', operator, remark: `由医小管自动分派给 ${assignee.name}` },
          ],
        });
        setEvents((current) => current.map((event) => targetIds.has(event.id) ? assignEvent(event) : event));
        mockAlertEventsV18.forEach((event, index) => {
          if (targetIds.has(event.id)) mockAlertEventsV18[index] = assignEvent(event);
        });
        detail.respond?.(`已将 ${targets.length} 项告警事件分派给${assignee.name}，事件已进入「待处理事件」。`);
        message.success(`已自动分派 ${targets.length} 项事件给${assignee.name}`);
        return;
      }

      if (activeTab === 'closed') {
        const closedEvents = events.filter((e) => roleScopedFilter('closed', e));
        const target = closedEvents.find((e) =>
          text.includes(e.agentName) || text.includes(e.id) ||
          text.includes(e.triggerContent.rule_name) || text.includes(e.triggerContent.trigger_condition.metric)
        ) || closedEvents[0];
        if (/查看详情|打开详情|进入详情|详情/.test(text)) {
          if (!target) detail.respond?.('当前暂无已关闭告警事件。');
          else {
            detail.respond?.(`已为您打开「${target.agentName}」的已关闭告警事件详情。`);
            navigate(`/app/monitoring/alert-events/${target.id}`);
          }
          return;
        }
        detail.respond?.('请先点击【查看详情】进入具体告警事件，再向我询问该事件的页面信息。');
        return;
      }

      if (activeTab === 'ignored') {
        const ignoredEvents = events.filter((e) => roleScopedFilter('ignored', e));
        const target = ignoredEvents.find((e) =>
          text.includes(e.agentName) || text.includes(e.id) ||
          text.includes(e.triggerContent.rule_name) || text.includes(e.triggerContent.trigger_condition.metric)
        ) || ignoredEvents[0];
        if (/查看详情|打开详情|进入详情|详情/.test(text)) {
          if (!target) {
            detail.respond?.('当前没有可查看的已忽略告警事件。');
            return;
          }
          detail.respond?.(`已为您打开「${target.agentName}」的已忽略告警事件详情。`);
          navigate(`/app/monitoring/alert-events/${target.id}`);
          return;
        }
        detail.respond?.(ignoredEvents.length > 0
          ? `当前共有 ${ignoredEvents.length} 项已忽略告警事件，您可以说“查看详情”。`
          : '当前没有已忽略告警事件。');
        return;
      }

      if (activeTab === 'pending_review') {
        const pendingReviewEvents = events.filter((e) => roleScopedFilter('pending_review', e));
        const target = pendingReviewEvents.find((e) =>
          text.includes(e.agentName) || text.includes(e.id) ||
          text.includes(e.triggerContent.rule_name) || text.includes(e.triggerContent.trigger_condition.metric)
        ) || pendingReviewEvents[0];
        if (!target) {
          detail.respond?.('当前没有可查看的待审核告警事件。');
          return;
        }
        if (isAdmin && /审核/.test(text)) {
          detail.respond?.(`已为您找到「${target.agentName}」的待审核告警事件，正在进入审核。`);
          beginReview(target);
        } else {
          detail.respond?.(`已为您打开「${target.agentName}」的告警事件详情。`);
          navigate(`/app/monitoring/alert-events/${target.id}`);
        }
        return;
      }

      if (activeTab === 'reviewing') {
        const reviewingEvents = events.filter((e) => roleScopedFilter('reviewing', e));
        const target = reviewingEvents.find((e) =>
          text.includes(e.agentName) || text.includes(e.id) ||
          text.includes(e.triggerContent.rule_name) || text.includes(e.triggerContent.trigger_condition.metric)
        ) || reviewingEvents[0];
        if (!target) {
          detail.respond?.('当前没有可操作的审核中告警事件。');
          return;
        }
        if (!isAdmin) {
          detail.respond?.(`已为您打开「${target.agentName}」的告警事件详情。`);
          navigate(`/app/monitoring/alert-events/${target.id}`);
          return;
        }
        const isReturn = /退回|不通过|未解决|仍然|异常/.test(text);
        const cleanedRemark = text
          .replace(/^(审核)?(通过|不通过|退回(重新处理)?)\s*[，,：:]?\s*/, '')
          .trim();
        navigate(`/app/monitoring/alert-events/${target.id}/review?tab=reviewing`, {
          state: {
            assistantReviewDraft: {
              reviewOpinion: isReturn ? '退回重新处理' : '处理完成，关闭该告警事项',
              reviewRemark: cleanedRemark || (isReturn ? '告警问题尚未完全解决，请重新处理。' : '处理方案有效，告警已恢复正常，同意关闭该告警事项。'),
            },
          },
        });
        detail.respond?.(`已进入「${target.agentName}」审核页，并根据您的描述填入审核结论与说明。`);
        return;
      }

      const typeAliases: Array<[RegExp, AlertEventV18['eventType']]> = [
        [/业务/, 'business'], [/状态|运行/, 'status'], [/成本|资源|Token|CPU|GPU/i, 'cost'], [/安全|越权|注入|敏感/, 'security'],
      ];
      const requestedType = typeAliases.find(([pattern]) => pattern.test(text))?.[1];
      const pendingEvents = events.filter((e) => roleScopedFilter('pending_handle', e));
      const matchedNames = pendingEvents.filter((e) =>
        text.includes(e.agentName) || text.includes(e.id) ||
        text.includes(e.triggerContent.rule_name) || text.includes(e.triggerContent.trigger_condition.metric),
      );
      const freeKeyword = matchedNames.length > 0
        ? (matchedNames[0].agentName || matchedNames[0].id)
        : undefined;

      setActiveTab('pending_handle');
      setSearchParams({ tab: 'pending_handle' }, { replace: true });
      setTypeFilter(requestedType);
      setKeyword(freeKeyword || '');

      const results = pendingEvents.filter((e) => {
        if (requestedType && e.eventType !== requestedType) return false;
        if (matchedNames.length > 0 && !matchedNames.some((m) => m.id === e.id)) return false;
        return true;
      });
      if (/查看详情|打开详情|进入详情/.test(text)) {
        if (results[0]) {
          detail.respond?.(`已为您打开「${results[0].agentName}」的告警事件详情。`);
          navigate(`/app/monitoring/alert-events/${results[0].id}`);
        } else {
          detail.respond?.('没有找到符合条件的待处理告警事件。');
        }
        return;
      }
      if (/开始处理|帮我处理|处理(?:第|这|该|当前|一下)/.test(text)) {
        const target = results[0];
        if (!target) {
          detail.respond?.('没有找到符合条件的待处理告警事件。');
          return;
        }
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        setEvents((current) => current.map((item) => item.id === target.id ? {
          ...item, status: 'handling', handleStartTime: now,
          handleTimeline: [...(item.handleTimeline || []), {
            time: now, action: '开始处理', operator: currentUserName || '当前用户', remark: '由医小管根据对话指令发起',
          }],
        } : item));
        setActiveTab('handling');
        setSearchParams({ tab: 'handling' }, { replace: true });
        setKeyword('');
        detail.respond?.(`已将「${target.agentName}」告警转入处理中事件。`);
        return;
      }
      detail.respond?.(results.length > 0
        ? `已为您筛选出 ${results.length} 项待处理告警事件。您可以继续说“查看详情”或“处理”。`
        : '没有找到符合条件的待处理告警事件，请换个关键词试试。');
    };
    window.addEventListener('monitoring-alert-assistant-query', onAssistantQuery);
    return () => window.removeEventListener('monitoring-alert-assistant-query', onAssistantQuery);
  }, [activeTab, beginReview, currentUserName, events, isAdmin, navigate, roleScopedFilter, setSearchParams]);

  useEffect(() => {
    const onViewClosedDetail = () => {
      const target = events.find((e) => roleScopedFilter('closed', e));
      if (target) navigate(`/app/monitoring/alert-events/${target.id}`);
    };
    const onViewIgnoredDetail = () => {
      const target = events.find((e) => roleScopedFilter('ignored', e));
      if (target) navigate(`/app/monitoring/alert-events/${target.id}`);
    };
    window.addEventListener('monitoring-view-closed-detail', onViewClosedDetail);
    window.addEventListener('monitoring-view-ignored-detail', onViewIgnoredDetail);
    return () => {
      window.removeEventListener('monitoring-view-closed-detail', onViewClosedDetail);
      window.removeEventListener('monitoring-view-ignored-detail', onViewIgnoredDetail);
    };
  }, [events, navigate, roleScopedFilter]);

  useEffect(() => {
    const onJump = (event: Event) => {
      const nextTab = (event as CustomEvent<string>).detail as TabKey;
      if (!nextTab || !tabMeta[nextTab]) return;
      switchToTab(nextTab);
    };
    window.addEventListener('agent-jump-tab', onJump);
    return () => window.removeEventListener('agent-jump-tab', onJump);
  }, [switchToTab]);

  return (
    <div style={{ padding: '16px 24px', background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title="告警事件处置"
        subTitle="按状态分 8 个 Tab 管理告警事件全生命周期（待分派 → 待处理 → 处理中 → 待审核 → 审核中 → 已关闭 / 已忽略）"
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '', breadcrumbName: '告警事件处置' },
        ]}
      />

      <Card bordered={false} styles={{ body: { paddingTop: 0 } }} style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => switchToTab(k as TabKey)}
          type="line"
          items={Object.entries(tabMeta).map(([key, m]) => {
            // 「待分派」仅管理员可见
            if (m.adminOnly && !isAdmin) return null;
            return {
              key,
              label: <Space>
                {m.label}
                <Tag color="blue">{tabCounts[key as TabKey]}</Tag>
              </Space>,
            };
          }).filter(Boolean) as any}
        />

        {/* 筛选区 */}
        <Row gutter={[8, 8]} align="middle" wrap style={{ marginTop: 8 }}>
          <Col flex="280px" style={{ minWidth: 240 }}>
            <Input
              prefix={<SearchOutlined />} placeholder="按事件标题、规则名称、智能体模糊搜索"
              value={keyword} onChange={(e) => setKeyword(e.target.value)} allowClear
            />
          </Col>
          <Col flex="200px" style={{ minWidth: 180 }}>
            <Select
              allowClear placeholder="事件类型"
              value={typeFilter} onChange={setTypeFilter}
              options={[
                { label: '业务监控', value: 'business' },
                { label: '状态监控', value: 'status' },
                { label: '成本监控', value: 'cost' },
                { label: '安全监控', value: 'security' },
              ]}
              style={{ width: '100%' }}
            />
          </Col>
          <Col flex="280px" style={{ minWidth: 240 }}>
            <RangePicker style={{ width: '100%' }} placeholder={['触发开始', '触发结束']} />
          </Col>
          <Col flex="auto" />
          <Col flex="none">
            <Space size={8}>
              <Button onClick={() => { setKeyword(''); setTypeFilter(undefined); }}>重置</Button>
              <Button type="primary" icon={<SearchOutlined />}>查询</Button>
              <Button icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tab 标题说明 */}
      <Card bordered={false} styles={{ body: { paddingTop: 12 } }} style={{ marginTop: 16 }} title={`${currentTabMeta.label} · 共 ${filtered.length} 条`}>
        {filtered.length === 0 ? (
          <Empty description={isAdmin ? '暂无符合条件的事件' : '暂无分派给您的该状态事件'} />
        ) : (
          <ProTable<AlertEventV18>
            rowKey="id" actionRef={actionRef} search={false}
            options={false}
            size="small"
            columns={tabColumns[activeTab]}
            dataSource={filtered}
            pagination={{
              defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true,
              pageSizeOptions: ['20', '50', '100'],
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 2080 }}
          />
        )}
      </Card>

      {/* 操作弹窗 */}
      <Modal
        open={actionModal.open}
        title={
          actionModal.mode === 'assign' ? '事件分派' :
          actionModal.mode === 'reassign' ? '事件转派' :
          actionModal.mode === 'handle' ? '事件处理' :
          '处理审核'
        }
        onCancel={() => setActionModal({ open: false, mode: 'assign', event: null })}
        onOk={submitAction}
        okText={actionModal.mode === 'reassign' ? '确认转派' : '提交'}
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical">
          {(actionModal.mode === 'assign' || actionModal.mode === 'reassign') && (
            <Form.Item
              name="assignee"
              label="处理人"
              rules={[{ required: true, message: '请选择处理人' }]}
              extra={actionModal.mode === 'reassign' && actionModal.event ? `当前处理人：${actionModal.event.handler || '—'}` : undefined}
            >
              <Select
                showSearch
                placeholder="请选择处理人"
                options={assigneeOptions}
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label as string).toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}
          {actionModal.mode === 'handle' && (
            <>
              <Form.Item name="handleResult" label="处理结果" rules={[{ required: true, message: '请选择' }]}>
                <Radio.Group>
                  <Radio value="已处理">已处理</Radio>
                  <Radio value="已忽略">已忽略</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="handlePlan" label="处理方案" rules={[{ required: true, message: '请填写处理方案' }]}>
                <TextArea rows={6} maxLength={500} showCount placeholder="详细说明告警事件的处理过程" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default AlertEventListV18;
