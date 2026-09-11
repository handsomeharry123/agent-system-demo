/**
 * 8-2 告警事件处置（V1.4）
 * 列表 + 详情抽屉 + 完整处置流程（开始处置→分派→关闭/忽略）
 * - 列表 8 列（事件标题/来源维度/事件级别/规则名称/监测对象/发现时间/处置状态/操作）
 * - 关闭后自动同步审计中心
 * - 取消「升级事件级别」按钮（V1.4 明确：事件级别由告警规则预设决定，不允许现场人为调整）
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Drawer,
  Input,
  Select,
  Timeline,
  Modal,
  Form,
  message,
  Tabs,
  Table,
  Badge,
  Tooltip,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  SendOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { mockAlertEvents, getMyEventsFilter, getTabCounts } from '../../mock/security';
import { useAuth } from '../../hooks/useAuth';
import {
  dimensionColor,
  eventLevelColor,
  eventLevelList,
  eventStatusColor,
  eventStatusList,
  type AlertEvent,
  type EventLevel,
  type EventStatus,
  type SecurityDimension,
} from '../../types/security';

const { Text, Paragraph } = Typography;

const allDimensions: SecurityDimension[] = ['系统', '网络', '身份', '数据', '模型', '应用'];

/** status URL 取值:
 *  - 'active'             未关闭(≠ 已关闭/已忽略)
 *  - 'closed_or_ignored'  本月已关闭/已忽略 + 同月 discoveredAt
 *  - 4 种 EventStatus      精确单值
 */
const ACTIVE_STATUS = 'active';
const CLOSED_OR_IGNORED_STATUS = 'closed_or_ignored';
const CURRENT_MONTH = 'current';

/** 「我的事件」Tab 默认: 事件级别 紧急→重要→一般,同级别内按发现时间升序 */
const LEVEL_RANK: Record<EventLevel, number> = { 紧急: 0, 重要: 1, 一般: 2 };
const MY_NOW = new Date('2026-06-03');

// 时间格式化（统一）
const nowString = () => {
  const d = new Date('2026-06-03T15:30:00');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EventManage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<AlertEvent[]>(mockAlertEvents);

  // 当前登录用户(V1.2 「我的事件」判定)
  const { currentUser } = useAuth();
  const currentUserName = currentUser?.name || 'admin';

  // Tab(8-2 V1.2):'all' = 全部事件;'my' = 我的事件
  // 默认: 裸 URL → 'my'(侧边栏进入);URL 带 ?tab=all → 'all'(8-1 跳来)
  const initialTab = searchParams.get('tab') === 'all' ? 'all' : 'my';
  const [tab, setTab] = useState<'all' | 'my'>(initialTab);

  // 筛选
  const [keyword, setKeyword] = useState('');
  const [dimensionFilter, setDimensionFilter] = useState<SecurityDimension | undefined>();
  const [levelFilter, setLevelFilter] = useState<EventLevel | undefined>();
  const [statusFilter, setStatusFilter] = useState<EventStatus | undefined>();
  // status=active(未关闭) / status=closed_or_ignored&month=current(本月已关闭/已忽略)
  const [activeOnly, setActiveOnly] = useState(false);
  const [closedOrIgnoredMonth, setClosedOrIgnoredMonth] = useState(false);

  // Tab 计数(仅受 Tab 本身口径控制,与下方筛选器解耦)
  const tabCounts = useMemo(
    () => getTabCounts(events, currentUserName),
    [events, currentUserName],
  );

  // 详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<AlertEvent | null>(null);

  // 处置流程 modals
  const [assignOpen, setAssignOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [assignForm] = Form.useForm<{ handler: string }>();
  const [closeForm] = Form.useForm<{ summary: string }>();
  const [ignoreForm] = Form.useForm<{ reason: string }>();

  // 来自 URL 的初始筛选(8-1 快捷入口跳转)
  // URL 协议: ?tab=all&dimension=系统&status=active&level=紧急&status=closed_or_ignored&month=current
  useEffect(() => {
    const status = searchParams.get('status');
    const level = searchParams.get('level') as EventLevel | null;
    const dimension = searchParams.get('dimension') as SecurityDimension | null;
    const month = searchParams.get('month');
    const tabParam = searchParams.get('tab');

    // Tab
    if (tabParam === 'all' || tabParam === 'my') setTab(tabParam);

    // 维度
    if (dimension && allDimensions.includes(dimension)) {
      setDimensionFilter(dimension);
    } else if (searchParams.get('dimension') === null) {
      setDimensionFilter(undefined);
    }
    // 级别
    if (level && eventLevelList.includes(level)) {
      setLevelFilter(level);
    } else if (searchParams.get('level') === null) {
      setLevelFilter(undefined);
    }
    // 状态(三套语义:active / closed_or_ignored / 精确单值 / 无)
    if (status === ACTIVE_STATUS) {
      setActiveOnly(true);
      setClosedOrIgnoredMonth(false);
      setStatusFilter(undefined);
    } else if (status === CLOSED_OR_IGNORED_STATUS && month === CURRENT_MONTH) {
      setActiveOnly(false);
      setClosedOrIgnoredMonth(true);
      setStatusFilter(undefined);
    } else if (status && eventStatusList.includes(status as EventStatus)) {
      setActiveOnly(false);
      setClosedOrIgnoredMonth(false);
      setStatusFilter(status as EventStatus);
    } else if (status === null) {
      setActiveOnly(false);
      setClosedOrIgnoredMonth(false);
      setStatusFilter(undefined);
    }
  }, [searchParams]);

  // 过滤(三级:Tab 一级范围 → 状态语义过滤 → 其他筛选;Tab=my 时按级别降序 + 时间升序)
  const filtered = useMemo(() => {
    // Step 1: Tab 一级范围
    let pool: AlertEvent[] =
      tab === 'my' ? getMyEventsFilter(events, currentUserName) : events;

    // Step 2: 状态(三种语义互斥) + 其他筛选
    const kw = keyword.trim().toLowerCase();
    pool = pool.filter((e) => {
      if (activeOnly) {
        if (e.status === '已关闭' || e.status === '已忽略') return false;
      } else if (closedOrIgnoredMonth) {
        if (e.status !== '已关闭' && e.status !== '已忽略') return false;
        const d = new Date(e.discoveredAt);
        if (d.getFullYear() !== MY_NOW.getFullYear() || d.getMonth() !== MY_NOW.getMonth()) {
          return false;
        }
      } else if (statusFilter) {
        if (e.status !== statusFilter) return false;
      }
      if (dimensionFilter && e.dimension !== dimensionFilter) return false;
      if (levelFilter && e.level !== levelFilter) return false;
      if (kw) {
        const hit =
          e.title.toLowerCase().includes(kw) ||
          (e.agentName || '').toLowerCase().includes(kw) ||
          e.id.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      return true;
    });

    // Step 3: Tab=my 才排序(级别降序 + 时间升序)
    if (tab === 'my') {
      pool = [...pool].sort((a, b) => {
        const r = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
        return r !== 0 ? r : a.discoveredAt.localeCompare(b.discoveredAt);
      });
    }
    return pool;
  }, [events, currentUserName, tab, dimensionFilter, levelFilter, statusFilter, activeOnly, closedOrIgnoredMonth, keyword]);

  // 在 events 中按 id 重新取最新一条（避免 setSelected 闭包旧值）
  const refreshSelected = (id: string) => {
    const fresh = events.find((e) => e.id === id) || null;
    setSelected(fresh);
  };

  // 统一更新事件（events + selected 双写）
  const updateEvent = (id: string, patch: Partial<AlertEvent>, timelineNode?: AlertEvent['timeline'][0]) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              timeline: timelineNode ? [...e.timeline, timelineNode] : e.timeline,
            }
          : e,
      ),
    );
    setSelected((cur) =>
      cur && cur.id === id
        ? { ...cur, ...patch, timeline: timelineNode ? [...cur.timeline, timelineNode] : cur.timeline }
        : cur,
    );
  };

  const openDetail = (e: AlertEvent) => {
    setSelected(e);
    setDrawerOpen(true);
  };
  const closeDetail = () => {
    setDrawerOpen(false);
    setSelected(null);
  };

  // ============= 处置流程 =============

  // 开始处置 → 弹出分派 Modal（"待处理"/"处理中" 都能再次分派）
  const handleStartHandle = () => {
    if (!selected) return;
    assignForm.setFieldsValue({ handler: selected.handler || '' });
    setAssignOpen(true);
  };
  const submitAssign = async () => {
    const v = await assignForm.validateFields();
    if (!selected) return;
    const action = selected.status === '待处理' ? '分派处置' : '重新分派';
    const node: AlertEvent['timeline'][0] = {
      time: nowString(),
      operator: '当前管理员',
      action,
      detail: `责任人为 ${v.handler}`,
    };
    updateEvent(selected.id, { status: '处理中', handler: v.handler }, node);
    message.success(`已${action === '分派处置' ? '分派' : '重新分派'}给 ${v.handler}`);
    setAssignOpen(false);
  };

  // 关闭事件 → 提交后真同步审计中心
  const submitClose = async () => {
    const v = await closeForm.validateFields();
    if (!selected) return;
    const node: AlertEvent['timeline'][0] = {
      time: nowString(),
      operator: selected.handler || '当前管理员',
      action: '标记关闭',
      detail: v.summary,
    };
    updateEvent(selected.id, { status: '已关闭', summary: v.summary }, node);
    // 模拟调用审计中心归档接口
    message.success('事件已关闭，已同步审计中心');
    setCloseOpen(false);
  };
  const openCloseModal = () => {
    if (!selected) return;
    closeForm.resetFields();
    setCloseOpen(true);
  };

  // 忽略事件
  const submitIgnore = async () => {
    const v = await ignoreForm.validateFields();
    if (!selected) return;
    const node: AlertEvent['timeline'][0] = {
      time: nowString(),
      operator: '当前管理员',
      action: '忽略事件',
      detail: v.reason,
    };
    updateEvent(selected.id, { status: '已忽略', ignoreReason: v.reason }, node);
    message.success('事件已忽略');
    setIgnoreOpen(false);
  };
  const openIgnoreModal = () => {
    if (!selected) return;
    ignoreForm.resetFields();
    setIgnoreOpen(true);
  };

  const reset = () => {
    setKeyword('');
    setDimensionFilter(undefined);
    setLevelFilter(undefined);
    setStatusFilter(undefined);
    setActiveOnly(false);
    setClosedOrIgnoredMonth(false);
    // ⛔ 不重置 Tab(V1.2: 重置按钮不影响 Tab 选中项)
    setSearchParams({});
  };

  // ============= 列表列定义 =============
  const columns = [
    {
      title: '事件标题',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      fixed: 'left' as const,
      render: (_: string, r: AlertEvent) => (
        <a onClick={() => openDetail(r)}>
          <Space size={6} wrap>
            <Text strong>{r.title}</Text>
            <Text type="secondary" code style={{ fontSize: 11 }}>{r.id}</Text>
          </Space>
        </a>
      ),
    },
    {
      title: '来源维度',
      dataIndex: 'dimension',
      key: 'dimension',
      width: 100,
      render: (d: SecurityDimension) => <Tag color={dimensionColor[d]}>{d}风险</Tag>,
    },
    {
      title: '事件级别',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (l: EventLevel) => <Tag color={eventLevelColor[l]}>{l}</Tag>,
    },
    {
      title: '规则名称',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      ellipsis: true,
      render: (t: string, r: AlertEvent) => (
        <a onClick={() => {
          // V1.4：点击跳 8-3 对应维度 Tab（页面顶部「编辑策略」入口语义）
          const dim = r.dimension;
          window.open(`${window.location.origin}/app/security/rules?dimension=${encodeURIComponent(dim)}`, '_self');
        }}>
          {t}
        </a>
      ),
    },
    {
      title: '监测对象',
      dataIndex: 'agentName',
      key: 'agentName',
      width: 200,
      ellipsis: true,
      render: (n: string) => <Text>{n}</Text>,
    },
    {
      title: '触发条件',
      key: 'trigger',
      width: 220,
      ellipsis: true,
      render: (_: any, r: AlertEvent) => {
        // V1.4：实际触发阈值描述（按 description 简化）
        const t = r.description || '—';
        return (
          <Tooltip title={t}>
            <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{t}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: '关联对象',
      key: 'related',
      width: 160,
      render: (_: any, r: AlertEvent) => (
        <Space size={4} wrap>
          {r.impactScope.slice(0, 1).map((s) => (
            <Tag key={s} color="cyan">{s}</Tag>
          ))}
          {r.impactScope.length > 1 && (
            <Text type="secondary" style={{ fontSize: 12 }}>+{r.impactScope.length - 1}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '发现时间',
      dataIndex: 'discoveredAt',
      key: 'discoveredAt',
      width: 150,
      render: (t: string) => <Text type="secondary">{t}</Text>,
    },
    {
      title: '处置状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: EventStatus) => <Tag color={eventStatusColor[s]}>{s}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, r: AlertEvent) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
            查看详情
          </Button>
          {r.status === '待处理' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                setSelected(r);
                setDrawerOpen(true);
                setTimeout(() => {
                  assignForm.setFieldsValue({ handler: r.handler || '' });
                  setAssignOpen(true);
                }, 0);
              }}
            >
              开始处置
            </Button>
          )}
          {r.status === '处理中' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setSelected(r);
                setDrawerOpen(true);
                setTimeout(() => {
                  closeForm.resetFields();
                  setCloseOpen(true);
                }, 0);
              }}
            >
              标记关闭
            </Button>
          )}
          {(r.status === '待处理' || r.status === '处理中') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setSelected(r);
                setDrawerOpen(true);
                setTimeout(() => {
                  ignoreForm.resetFields();
                  setIgnoreOpen(true);
                }, 0);
              }}
            >
              忽略
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title="告警事件处置"
        subTitle="六维告警统一回此处置 · 闭环跟踪 · 关闭后自动同步审计中心"
        breadcrumb={[
          { path: '/app/security', breadcrumbName: '统一安全治理中心' },
          { path: '/app/security/events', breadcrumbName: '告警事件处置' },
        ]}
      />

      <Card>
        {/* 上层 · Tab 切换区(V1.2 8-2) - 一级范围限定 */}
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'all' | 'my')}
          style={{ marginBottom: 8 }}
          items={[
            {
              key: 'all',
              label: (
                <Space size={6}>
                  <span>全部事件</span>
                  <Badge
                    count={tabCounts.allActive}
                    showZero
                    color={tab === 'all' ? '#1677FF' : undefined}
                    overflowCount={99}
                  />
                </Space>
              ),
            },
            {
              key: 'my',
              label: (
                <Space size={6}>
                  <span>我的事件</span>
                  <Badge
                    count={tabCounts.myActive}
                    showZero
                    color={tab === 'my' ? '#1677FF' : undefined}
                    overflowCount={99}
                  />
                </Space>
              ),
            },
          ]}
        />

        {/* 中层 · 筛选 - 4 项(V1.2 二级过滤) */}
        <Space wrap style={{ marginBottom: 16 }} size={[8, 16]}>
          <Input.Search
            allowClear
            placeholder="按事件标题/智能体/ID 搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 240 }}
          />
          <Select
            allowClear
            placeholder="来源维度"
            style={{ width: 140 }}
            value={dimensionFilter}
            onChange={setDimensionFilter}
            options={allDimensions.map((d) => ({ label: `${d}风险`, value: d }))}
          />
          <Select
            allowClear
            placeholder="事件级别"
            style={{ width: 120 }}
            value={levelFilter}
            onChange={setLevelFilter}
            options={eventLevelList.map((v) => ({ label: v, value: v }))}
          />
          <Select
            allowClear
            placeholder={
              activeOnly
                ? '未关闭（待处理+处理中）'
                : closedOrIgnoredMonth
                  ? '本月已关闭/已忽略'
                  : '处置状态'
            }
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(v) => {
              // 选择具体状态时关闭 activeOnly 与 closedOrIgnoredMonth 模式
              setActiveOnly(false);
              setClosedOrIgnoredMonth(false);
              setStatusFilter(v);
              // 同步 URL
              const next = new URLSearchParams(searchParams);
              if (v) next.set('status', v);
              else next.delete('status');
              setSearchParams(next);
            }}
            options={eventStatusList.map((v) => ({ label: v, value: v }))}
          />
          <Button icon={<ReloadOutlined />} onClick={reset}>重置</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {filtered.length} 条</Text>
        </Space>

        {/* 列表 - 7 列 */}
        <Table
          rowKey="id"
          columns={columns as any}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={selected ? `事件详情 - ${selected.title}` : '事件详情'}
        open={drawerOpen}
        onClose={closeDetail}
        width={680}
        extra={
          selected && (
            <Space wrap>
              {(selected.status === '待处理' || selected.status === '处理中') && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartHandle}>
                  {selected.status === '待处理' ? '开始处置' : '重新分派'}
                </Button>
              )}
              {(selected.status === '待处理' || selected.status === '处理中') && (
                <Button icon={<CheckCircleOutlined />} onClick={openCloseModal}>
                  标记已关闭
                </Button>
              )}
              {(selected.status === '待处理' || selected.status === '处理中') && (
                <Button danger icon={<StopOutlined />} onClick={openIgnoreModal}>
                  忽略事件
                </Button>
              )}
            </Space>
          )
        }
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small" title="基本信息">
              <Space wrap size={8}>
                <Tag color={dimensionColor[selected.dimension]}>{selected.dimension}风险</Tag>
                <Tag color={eventLevelColor[selected.level]}>{selected.level}</Tag>
                <Tag color={eventStatusColor[selected.status]}>{selected.status}</Tag>
                <Text type="secondary" code style={{ fontSize: 12 }}>{selected.id}</Text>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">发现时间：</Text>
                <Text>{selected.discoveredAt}</Text>
              </div>
              <div>
                <Text type="secondary">关联智能体：</Text>
                <Text>{selected.agentName}</Text>
              </div>
              <div>
                <Text type="secondary">事件类型：</Text>
                <Text>{selected.type}</Text>
              </div>
              <div>
                <Text type="secondary">责任人：</Text>
                <Text>{selected.handler || '—'}</Text>
              </div>
            </Card>

            <Card size="small" title="风险描述">
              <Paragraph style={{ marginBottom: 0 }}>{selected.description}</Paragraph>
            </Card>

            <Card size="small" title="影响范围">
              {selected.impactScope.length === 0 ? (
                <Text type="secondary">—</Text>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {selected.impactScope.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </Card>

            <Card size="small" title="处置建议">
              <Paragraph style={{ marginBottom: 0 }}>{selected.suggestion}</Paragraph>
            </Card>

            {/* 处置结果 - 仅已关闭展示 + 同步审计中心 Tag */}
            {selected.status === '已关闭' && selected.summary && (
              <Card size="small" title="处置结果">
                <Paragraph style={{ marginBottom: 8 }}>
                  <Text type="secondary">处置总结：</Text>
                  {selected.summary}
                </Paragraph>
                <Tag icon={<AuditOutlined />} color="cyan">已同步审计中心</Tag>
              </Card>
            )}
            {selected.status === '已忽略' && selected.ignoreReason && (
              <Card size="small" title="忽略原因">
                <Paragraph style={{ marginBottom: 0 }}>{selected.ignoreReason}</Paragraph>
              </Card>
            )}

            <Card size="small" title="处置记录时间线">
              <Timeline
                items={selected.timeline.map((n) => ({
                  children: (
                    <Space direction="vertical" size={2}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{n.time} · {n.operator}</Text>
                      <Space>
                        <Tag color="blue">{n.action}</Tag>
                        {n.detail && <Text style={{ fontSize: 13 }}>{n.detail}</Text>}
                      </Space>
                    </Space>
                  ),
                }))}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      {/* 分派责任人 */}
      <Modal
        title={<Space><SendOutlined />{selected?.status === '处理中' ? '重新分派责任人' : '分派责任人'}</Space>}
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={submitAssign}
        okText="确认分派"
        destroyOnClose
      >
        <Form form={assignForm} layout="vertical" preserve={false}>
          <Form.Item
            name="handler"
            label="责任人"
            rules={[{ required: true, message: '请输入责任人' }]}
          >
            <Input placeholder="如：张明华" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关闭事件 */}
      <Modal
        title="标记已关闭"
        open={closeOpen}
        onCancel={() => setCloseOpen(false)}
        onOk={submitClose}
        okText="确认关闭"
        destroyOnClose
      >
        <Form form={closeForm} layout="vertical" preserve={false}>
          <Form.Item
            name="summary"
            label="处置总结"
            rules={[{ required: true, message: '请填写处置总结' }]}
          >
            <Input.TextArea rows={4} placeholder="如：已升级 TLS 1.3 / 已关闭端口 / 已添加白名单..." />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          关闭后事件将自动归档并同步至审计中心（模块 12）。
        </Text>
      </Modal>

      {/* 忽略事件 */}
      <Modal
        title="忽略事件"
        open={ignoreOpen}
        onCancel={() => setIgnoreOpen(false)}
        onOk={submitIgnore}
        okText="确认忽略"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={ignoreForm} layout="vertical" preserve={false}>
          <Form.Item
            name="reason"
            label="忽略原因"
            rules={[{ required: true, message: '请填写忽略原因' }]}
          >
            <Input.TextArea rows={3} placeholder="如：经核实为运维值班正常操作..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EventManage;
