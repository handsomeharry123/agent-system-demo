/**
 * 8-3 治理规则管理 (V1.4)
 * - ❌ 取消顶部 4 个跨模块跳转卡片(已合并到对应 Tab 顶部)
 * - 6 个一级 Tab(统一入口,差异化呈现):
 *     模式 A · 系统/网络 → 本模块可配置(子 Tab 采集配置 | 告警规则)
 *     模式 B · 身份/数据 → 内置只读规则列表(顶部跳源模块按钮)
 *     模式 C · 模型/应用 → 同步监控中心快照(顶部跳监控中心按钮)
 * - 模式 A 告警规则:新建/编辑/复制 走独立下转页 /security/rules/new 与 /security/rules/:id/edit、/security/rules/copy/:id
 *   (与监控中心 8-6 告警管理对齐:四大配置块 / 右侧锚点 / 底部吸底操作栏)
 * - 模式 A 风险等级:紧急/重要/一般(三档 — 与 8-2 事件级别颜色保持一致)
 * - 操作列:编辑 / 复制 / 删除
 * - 默认选中「系统」;URL ?dimension={dim} 时直接定位对应 Tab
 * - 所有维度告警事件统一回 8-2 处置(本页顶部均有「查看本维度告警事件」按钮)
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Drawer,
  Tag,
  Table,
  message,
  Modal,
  Tooltip,
  Alert,
} from 'antd';
import {
  UserOutlined,
  DatabaseOutlined,
  RobotOutlined,
  AppstoreOutlined,
  LinkOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ReloadOutlined,
  SafetyOutlined,
  GlobalOutlined,
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  AlertOutlined,
  ExportOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  mockAlertRules,
  mockCollectionConfigs,
  mockBuiltinRules,
  mockSyncedRules,
  syncedRulesMeta,
} from '../../mock/security';
import {
  checkFrequencyList,
  securityAlertLevelColor,
  securityAlertLevelList,
  ruleLevelColor,
  ruleLevelList,
  dimensionColor,
  type AlertRule,
  type BuiltinRule,
  type CollectionConfig,
  type CollectionTarget,
  type ResponseAction,
  type SecurityDimension,
  type SyncedAlertRule,
} from '../../types/security';

const { Text, Paragraph } = Typography;

const allDimensions: SecurityDimension[] = ['系统', '网络', '身份', '数据', '模型', '应用'];

/** 维度治理模式 */
type GovernMode = 'A' | 'B' | 'C';
const dimensionGovernMode: Record<SecurityDimension, GovernMode> = {
  系统: 'A',
  网络: 'A',
  身份: 'B',
  数据: 'B',
  模型: 'C',
  应用: 'C',
};

/** 模式 B 跳转目标(身份 → 用户中心 / 数据 → 数据资产中心) */
const modeBJumpMap: Record<'身份' | '数据', { label: string; path: string }> = {
  身份: { label: '用户中心（模块 11）', path: '/app/user-center' },
  数据: { label: '数据资产中心（模块 10）', path: '/app/data-asset/datasets' },
};

/** 维度 → 图标 */
const dimensionIcon: Record<SecurityDimension, React.ReactNode> = {
  系统: <SafetyOutlined style={{ color: dimensionColor.系统 }} />,
  网络: <GlobalOutlined style={{ color: dimensionColor.网络 }} />,
  身份: <LockOutlined style={{ color: dimensionColor.身份 }} />,
  数据: <DatabaseOutlined style={{ color: dimensionColor.数据 }} />,
  模型: <RobotOutlined style={{ color: dimensionColor.模型 }} />,
  应用: <AppstoreOutlined style={{ color: dimensionColor.应用 }} />,
};

/** 响应动作颜色映射 */
const responseActionColor: Record<string, string> = {
  告警通知: 'blue',
  自动阻断: 'red',
  服务隔离: 'orange',
  仅记录: 'default',
};

const RuleManage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // 当前一级 Tab(默认「系统」,URL 优先)
  const dimFromUrl = searchParams.get('dimension') as SecurityDimension | null;
  const [activeDim, setActiveDim] = useState<SecurityDimension>(
    dimFromUrl && allDimensions.includes(dimFromUrl) ? dimFromUrl : '系统',
  );
  // 模式 A 二级子 Tab(采集配置 / 告警规则)
  const [activeSubTab, setActiveSubTab] = useState<'collection' | 'rules'>('rules');

  // 模式 A 状态:采集配置 + 告警规则
  const [collectionConfigs, setCollectionConfigs] = useState<CollectionConfig[]>(mockCollectionConfigs);
  const [collectionEditing, setCollectionEditing] = useState(false);
  const [collectionForm] = Form.useForm<CollectionConfig>();
  const [rules, setRules] = useState<AlertRule[]>(mockAlertRules);
  const [ruleSearch, setRuleSearch] = useState('');
  // V1.4：风险等级筛选项 = 紧急/重要/一般（与 8-2 事件级别一致）
  const [ruleLevelFilter, setRuleLevelFilter] = useState<string | undefined>();
  const [ruleEnabledFilter, setRuleEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  // V1.4：新建/编辑/复制 走独立下转页（本页不再有 Drawer）

  // 模式 B 状态:内置规则详情抽屉
  const [builtinDrawerOpen, setBuiltinDrawerOpen] = useState(false);
  const [selectedBuiltin, setSelectedBuiltin] = useState<BuiltinRule | null>(null);

  // 模式 C 状态:同步规则详情抽屉
  const [syncedDrawerOpen, setSyncedDrawerOpen] = useState(false);
  const [selectedSynced, setSelectedSynced] = useState<SyncedAlertRule | null>(null);

  // 同步 URL Tab(只读)
  useEffect(() => {
    if (dimFromUrl && allDimensions.includes(dimFromUrl) && dimFromUrl !== activeDim) {
      setActiveDim(dimFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimFromUrl]);

  // 切换 Tab 时同步 URL,便于深链
  const handleDimChange = (dim: SecurityDimension) => {
    setActiveDim(dim);
    const next = new URLSearchParams(searchParams);
    next.set('dimension', dim);
    setSearchParams(next, { replace: true });
  };

  // 当前维度的采集配置(仅模式 A 有)
  const currentCollection = useMemo(
    () => collectionConfigs.find((c) => c.dimension === activeDim),
    [collectionConfigs, activeDim],
  );

  // 时间工具(停用时长校验)
  const now = new Date('2026-06-03T15:30:00');
  const nowString = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  // 模式 A · 当前维度告警规则
  const filteredRules = useMemo(() => {
    return rules
      .filter((r) => r.dimension === activeDim)
      .filter((r) => {
        if (ruleSearch && !r.name.toLowerCase().includes(ruleSearch.toLowerCase())) return false;
        if (ruleLevelFilter && r.level !== ruleLevelFilter) return false;
        if (ruleEnabledFilter === 'enabled' && !r.enabled) return false;
        if (ruleEnabledFilter === 'disabled' && r.enabled) return false;
        return true;
      });
  }, [rules, activeDim, ruleSearch, ruleLevelFilter, ruleEnabledFilter]);

  // 采集对象全集(候选池,跨维度复用)
  // 系统: 服务器清单;网络: IP/端口清单
  const collectionTargetOptions: Record<SecurityDimension, CollectionTarget[]> = {
    系统: [
      { id: 'srv-01', name: 'app-server-01', type: '服务器' },
      { id: 'srv-02', name: 'app-server-02', type: '服务器' },
      { id: 'srv-03', name: 'control-plane', type: '服务器' },
      { id: 'srv-04', name: 'db-server-01', type: '服务器' },
    ],
    网络: [
      { id: 'ip-01', name: '123.60.18.22（公网入口）', type: 'IP' },
      { id: 'ip-02', name: '10.20.0.5（API 网关）', type: 'IP' },
      { id: 'ip-03', name: '10.20.0.6（内网核心）', type: 'IP' },
      { id: 'port-80', name: '80（HTTP）', type: '端口' },
      { id: 'port-443', name: '443（HTTPS）', type: '端口' },
      { id: 'port-3306', name: '3306（MySQL）', type: '端口' },
    ],
    身份: [],
    数据: [],
    模型: [],
    应用: [],
  };

  // 采集配置 - 编辑
  const openCollectionEdit = () => {
    if (!currentCollection) return;
    // 表单用 ID 数组,避免 AntD Select 无法识别对象值
    collectionForm.setFieldsValue({
      ...currentCollection,
      targetIds: currentCollection.targets.map((t) => t.id),
    });
    setCollectionEditing(true);
  };
  const saveCollection = async () => {
    const v = await collectionForm.validateFields();
    const targetIds: string[] = v.targetIds || [];
    const targets: CollectionTarget[] = targetIds
      .map((id) => collectionTargetOptions[activeDim].find((t) => t.id === id))
      .filter((t): t is CollectionTarget => Boolean(t));
    setCollectionConfigs((prev) =>
      prev.map((c) =>
        c.dimension === activeDim
          ? { ...c, ...v, targets, targetIds: undefined }
          : c,
      ),
    );
    message.success('采集配置已保存');
    setCollectionEditing(false);
  };

  // 规则 - 新建：跳独立下转页（V1.4）
  const openCreateRule = () => {
    // 带 dimension 查询参数，下转页用于预填所属 Tab
    navigate(`/app/security/rules/new?dimension=${encodeURIComponent(activeDim)}`);
  };

  // 规则 - 编辑：跳独立下转页（V1.4）
  const openEditRule = (r: AlertRule) => {
    navigate(`/app/security/rules/${encodeURIComponent(r.id)}/edit`);
  };

  // 规则 - 复制：跳独立下转页 + ?copy=1（V1.4 模式 A 行为）
  const openCopyRule = (r: AlertRule) => {
    navigate(`/app/security/rules/copy/${encodeURIComponent(r.id)}?dimension=${encodeURIComponent(r.dimension)}`);
  };

  // 规则 - 删除(含前置校验:停用 ≥ 30 天 且 无关联未关闭告警)
  const handleDeleteRule = (r: AlertRule) => {
    if (r.enabled) {
      Modal.warning({
        title: '无法删除',
        content: `规则「${r.name}」当前为「启用」状态，请先停用 ≥ 30 天后再删除。`,
        okText: '我知道了',
      });
      return;
    }
    if (!r.disabledAt) {
      Modal.warning({
        title: '缺少停用时间',
        content: `规则「${r.name}」缺少停用时间记录，无法判断是否满足 30 天限制。`,
        okText: '我知道了',
      });
      return;
    }
    const disabledAt = new Date(r.disabledAt);
    const days = Math.floor((now.getTime() - disabledAt.getTime()) / 86400000);
    const openCount = r.relatedOpenEventCount ?? 0;
    if (days < 30) {
      Modal.warning({
        title: '停用未满 30 天',
        content: `规则「${r.name}」已停用 ${days} 天，未满 30 天不允许删除。`,
        okText: '我知道了',
      });
      return;
    }
    if (openCount > 0) {
      Modal.warning({
        title: '存在关联未关闭告警',
        content: `规则「${r.name}」仍有 ${openCount} 个关联的待处理/处理中告警，不允许删除。`,
        okText: '我知道了',
      });
      return;
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除规则「${r.name}」吗？该操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: () => {
        setRules((prev) => prev.filter((x) => x.id !== r.id));
        message.success('规则已删除');
      },
    });
  };

  // 规则 - 启停(停用时记录 disabledAt)
  const handleToggleEnabled = (r: AlertRule, enabled: boolean) => {
    setRules((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? {
              ...x,
              enabled,
              disabledAt: enabled ? undefined : nowString(),
            }
          : x,
      ),
    );
    message.success(enabled ? '规则已启用' : '规则已停用');
  };

  // 联动:未启用采集时禁用规则操作
  const isCollectionEnabled = currentCollection?.enabled !== false;
  const disabledReason = isCollectionEnabled ? '' : '请先在「采集配置」中启用';

  // 采集项候选
  const collectionItemOptions: Record<SecurityDimension, string[]> = {
    系统: ['配置项', '权限', '加密状态', '服务间通信'],
    网络: ['端口扫描', '公网开放面', '内网隔离状态'],
    身份: [],
    数据: [],
    模型: [],
    应用: [],
  };

  // 跳「查看本维度告警事件」 → 8-2
  const jumpToEvents = (dim: SecurityDimension) =>
    navigate(`/app/security/events?tab=all&dimension=${encodeURIComponent(dim)}`);

  // 跳源模块(身份/数据)
  const jumpToSourceModule = (dim: '身份' | '数据') => {
    const target = modeBJumpMap[dim];
    window.open(`${window.location.origin}${target.path}`, '_blank', 'noopener,noreferrer');
    message.info(`已在新标签页打开「${target.label}」`);
  };

  // 跳监控中心 → 告警管理(模型/应用)
  const jumpToMonitoring = (ruleId?: string) => {
    // 监控中心告警列表 URL,带 dim 参数(占位)
    const url = ruleId
      ? `/app/monitoring/alerts/${encodeURIComponent(ruleId)}/edit`
      : `/app/monitoring/alerts`;
    window.open(`${window.location.origin}${url}`, '_blank', 'noopener,noreferrer');
    message.info('已在新标签页打开监控中心 → 告警管理');
  };

  // ============= 模式 A · 告警规则列定义 =============
  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, r: AlertRule) => (
        <a onClick={() => openEditRule(r)}>
          <Text strong>{r.name}</Text>
        </a>
      ),
    },
    { title: '检查频率', dataIndex: 'frequency', key: 'frequency', width: 100 },
    // V1.4：风险阈值摘要（来自 rule.thresholdSummary，与监控中心 8-6 列对齐）
    { title: '风险阈值', dataIndex: 'thresholdSummary', key: 'thresholdSummary', width: 220, ellipsis: true },
    {
      // V1.4：风险等级三档 紧急/重要/一般 — 与 8-2 事件级别颜色一致
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (l: AlertRule['level']) => <Tag color={securityAlertLevelColor[l]}>{l}</Tag>,
    },
    {
      title: '响应动作',
      dataIndex: 'responseActions',
      key: 'responseActions',
      width: 220,
      render: (acts: ResponseAction[]) => (
        <Space size={4} wrap>
          {acts.map((a) => (
            <Tag key={a} color={responseActionColor[a]}>{a}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (en: boolean, r: AlertRule) => (
        <Tooltip title={disabledReason}>
          <Switch
            checked={en}
            disabled={!isCollectionEnabled}
            onChange={(v) => handleToggleEnabled(r, v)}
          />
        </Tooltip>
      ),
    },
    {
      title: '最近触发',
      dataIndex: 'lastTriggerTime',
      key: 'lastTriggerTime',
      width: 160,
      render: (t?: string) => t || <Text type="secondary">—</Text>,
    },
    {
      // V1.4：操作列 = 编辑 / 复制 / 删除
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, r: AlertRule) => (
        <Space size={4}>
          <Tooltip title={disabledReason || '编辑'}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!isCollectionEnabled}
              onClick={() => openEditRule(r)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              disabled={!isCollectionEnabled}
              onClick={() => openCopyRule(r)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRule(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ============= 模式 B · 内置规则列定义 =============
  const builtinColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, r: BuiltinRule) => (
        <a onClick={() => { setSelectedBuiltin(r); setBuiltinDrawerOpen(true); }}>
          <Space size={4} wrap>
            <Text strong>{r.name}</Text>
            <Text type="secondary" code style={{ fontSize: 11 }}>{r.id}</Text>
          </Space>
        </a>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (l: BuiltinRule['level']) => <Tag color={ruleLevelColor[l]}>{l}</Tag>,
    },
    {
      title: '默认响应',
      dataIndex: 'defaultResponse',
      key: 'defaultResponse',
      width: 200,
      render: (acts: ResponseAction[]) => (
        <Space size={4} wrap>
          {acts.map((a) => (
            <Tag key={a} color={responseActionColor[a]}>{a}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '规则说明（触发条件摘要）',
      dataIndex: 'triggerCondition',
      key: 'triggerCondition',
      ellipsis: true,
      render: (t: string) => <Text type="secondary">{t}</Text>,
    },
    {
      title: '最近触发',
      dataIndex: 'lastTriggerTime',
      key: 'lastTriggerTime',
      width: 150,
      render: (t?: string) => t || <Text type="secondary">—</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, r: BuiltinRule) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => { setSelectedBuiltin(r); setBuiltinDrawerOpen(true); }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  // ============= 模式 C · 同步规则列定义 =============
  const syncedColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, r: SyncedAlertRule) => (
        <a onClick={() => { setSelectedSynced(r); setSyncedDrawerOpen(true); }}>
          <Space size={4} wrap>
            <Text strong>{r.name}</Text>
            <Text type="secondary" code style={{ fontSize: 11 }}>{r.monitoringRuleId}</Text>
          </Space>
        </a>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (l: SyncedAlertRule['level']) => <Tag color={ruleLevelColor[l]}>{l}</Tag>,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (en: boolean) =>
        en ? (
          <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">停用</Tag>
        ),
    },
    {
      title: '阈值摘要',
      dataIndex: 'thresholdSummary',
      key: 'thresholdSummary',
      ellipsis: true,
    },
    {
      title: '响应动作',
      dataIndex: 'responseActions',
      key: 'responseActions',
      width: 200,
      render: (acts: ResponseAction[]) => (
        <Space size={4} wrap>
          {acts.map((a) => (
            <Tag key={a} color={responseActionColor[a]}>{a}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '最近触发',
      dataIndex: 'lastTriggerTime',
      key: 'lastTriggerTime',
      width: 150,
      render: (t?: string) => t || <Text type="secondary">—</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, r: SyncedAlertRule) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedSynced(r); setSyncedDrawerOpen(true); }}
          >
            详情
          </Button>
          <Tooltip title="跳监控中心编辑此规则">
            <Button
              type="link"
              size="small"
              icon={<ExportOutlined />}
              onClick={() => jumpToMonitoring(r.monitoringRuleId)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ============= Tab 顶部区(各模式不同) =============
  const currentMode = dimensionGovernMode[activeDim];

  /** 模式 A · Tab 顶部:左侧名称 + 右侧「查看本维度告警事件」 */
  const renderModeATopBar = () => (
    <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
      <Col>
        <Space>
          {dimensionIcon[activeDim]}
          <Text strong style={{ fontSize: 15 }}>{activeDim}风险</Text>
          <Tag color="blue">本模块自采 · 可配置</Tag>
        </Space>
      </Col>
      <Col>
        <Button icon={<AlertOutlined />} onClick={() => jumpToEvents(activeDim)}>
          查看本维度告警事件
        </Button>
      </Col>
    </Row>
  );

  /** 模式 B · Tab 顶部:维度图标 + 内置规则数量 + 跳源模块按钮 + 查看告警事件按钮 */
  const renderModeBTopBar = () => {
    const builtinCount = mockBuiltinRules.filter((r) => r.dimension === activeDim).length;
    const jumpInfo = modeBJumpMap[activeDim as '身份' | '数据'];
    return (
      <>
        <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
          <Col>
            <Space>
              {dimensionIcon[activeDim]}
              <Text strong style={{ fontSize: 15 }}>{activeDim}风险</Text>
              <Tag color="purple">内置规则 {builtinCount} 条 · 只读</Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<AlertOutlined />} onClick={() => jumpToEvents(activeDim)}>
                查看本维度告警事件
              </Button>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={() => jumpToSourceModule(activeDim as '身份' | '数据')}
              >
                去 {jumpInfo.label} 查看采集字段
              </Button>
            </Space>
          </Col>
        </Row>
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message="内置只读规则"
          description={
            <Text type="secondary">
              {activeDim} 维告警规则由平台基于法规与最佳实践内置，<Text strong>不支持新建/编辑/删除</Text>。
              规则运行依赖的字段（{activeDim === '身份' ? '账号台账、角色权限、登录日志' : '资产元数据、分级分类、加密脱敏、备份、访问审计'}）由
              <Text strong>{jumpInfo.label}</Text>维护；告警事件统一回 8-2 处置。
            </Text>
          }
        />
      </>
    );
  };

  /** 模式 C · Tab 顶部:维度图标 + 同步数量 + 最后同步时间 + 跳监控中心按钮 + 查看告警事件按钮 */
  const renderModeCTopBar = () => {
    const syncedCount = mockSyncedRules.filter((r) => r.dimension === activeDim).length;
    return (
      <>
        {!syncedRulesMeta.healthy && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="同步异常"
            description={`数据为 ${syncedRulesMeta.staleMinutes} 分钟前快照，仍可查阅但状态可能滞后；请尽快排查与监控中心的连接。`}
          />
        )}
        <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
          <Col>
            <Space>
              {dimensionIcon[activeDim]}
              <Text strong style={{ fontSize: 15 }}>{activeDim}风险</Text>
              <Tag color="magenta">同步监控中心 {syncedCount} 条 · 只读</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <SyncOutlined /> 最后同步：{syncedRulesMeta.lastSyncTime}
              </Text>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<AlertOutlined />} onClick={() => jumpToEvents(activeDim)}>
                查看本维度告警事件
              </Button>
              <Button
                type="primary"
                icon={<ExportOutlined />}
                onClick={() => jumpToMonitoring()}
              >
                去监控中心 → 告警管理
              </Button>
            </Space>
          </Col>
        </Row>
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 12 }}
          message="同步规则"
          description={
            <Text type="secondary">
              {activeDim} 维告警规则<Text strong>实时同步</Text>自「运行监控中心 8-6 → 告警管理」中标签为「{activeDim}」的规则集，
              本页仅展示快照；所有<Text strong>新建/编辑/启停操作必须在监控中心完成</Text>。同步频率：实时增量 + 每 5 分钟全量校准。
            </Text>
          }
        />
      </>
    );
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title="治理规则管理"
        subTitle="6 个一级 Tab 统一入口 · 3 种治理模式差异化呈现 · 告警事件统一回 8-2"
        breadcrumb={[
          { path: '/app/security', breadcrumbName: '统一安全治理中心' },
          { path: '/app/security/rules', breadcrumbName: '治理规则管理' },
        ]}
      />

      {/* V1.3:取消顶部 4 卡片跳转区(已合并到对应 Tab 顶部) */}

      <Card style={{ marginTop: 16 }}>
        {/* 一级 Tab:6 个维度统一入口 */}
        <Tabs
          activeKey={activeDim}
          onChange={(k) => handleDimChange(k as SecurityDimension)}
          items={allDimensions.map((dim) => {
            const mode = dimensionGovernMode[dim];
            const modeTag =
              mode === 'A' ? { text: '可配置', color: 'blue' } :
              mode === 'B' ? { text: '内置只读', color: 'purple' } :
              { text: '同步监控', color: 'magenta' };
            return {
              key: dim,
              label: (
                <Space size={6}>
                  {dimensionIcon[dim]}
                  <span>{dim}</span>
                  <Tag color={modeTag.color} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                    {modeTag.text}
                  </Tag>
                </Space>
              ),
            };
          })}
        />

        {/* ============= 模式 A · 系统/网络 (可配置) ============= */}
        {currentMode === 'A' && (
          <>
            {renderModeATopBar()}

            {/* 二级子 Tab:采集配置 | 告警规则 */}
            <Tabs
              activeKey={activeSubTab}
              onChange={(k) => setActiveSubTab(k as 'collection' | 'rules')}
              items={[
                { key: 'collection', label: '采集配置' },
                { key: 'rules', label: '告警规则' },
              ]}
            />

            {/* 子 Tab A1:采集配置 */}
            {activeSubTab === 'collection' && currentCollection && (
              <div>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={16}>
                    <Text type="secondary">
                      💡 配置「采什么、多频繁采、采集白名单」等参数；采集对象仅限<Text strong>智能体管理平台自身</Text>，
                      智能体侧的部署架构与接口地址直接引用<Text strong>接入中心</Text>登记信息，不重复扫描。
                    </Text>
                  </Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Button type="primary" icon={<EditOutlined />} onClick={openCollectionEdit}>
                      编辑配置
                    </Button>
                  </Col>
                </Row>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Row gutter={[16, 12]}>
                    <Col xs={24} md={12}>
                      <Text type="secondary">采集对象清单：</Text>
                      <div style={{ marginTop: 4 }}>
                        {currentCollection.targets.map((t) => (
                          <Tag key={t.id} color={dimensionColor[currentCollection.dimension]} style={{ marginBottom: 4 }}>
                            {t.name}
                          </Tag>
                        ))}
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">采集频率：</Text>
                      <div><Tag color="blue">{currentCollection.frequency}</Tag></div>
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">采集项：</Text>
                      <div style={{ marginTop: 4 }}>
                        {currentCollection.items.map((i) => (
                          <Tag key={i} color="cyan" style={{ marginBottom: 4 }}>{i}</Tag>
                        ))}
                      </div>
                    </Col>
                    {currentCollection.dimension === '网络' && (
                      <Col xs={24} md={12}>
                        <Text type="secondary">扫描白名单：</Text>
                        <pre style={{ background: '#fff', padding: 8, borderRadius: 4, margin: '4px 0 0', fontSize: 12 }}>
                          {currentCollection.whitelist || '—'}
                        </pre>
                      </Col>
                    )}
                    <Col xs={24} md={12}>
                      <Text type="secondary">扫描超时：</Text>
                      <div><Text>{currentCollection.timeout || 600} 秒</Text></div>
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">启用状态：</Text>
                      <div>
                        {currentCollection.enabled ? (
                          <Tag icon={<CheckCircleOutlined />} color="success">已启用</Tag>
                        ) : (
                          <Tag icon={<CloseCircleOutlined />} color="default">已停用</Tag>
                        )}
                      </div>
                    </Col>
                  </Row>
                </Card>
              </div>
            )}

            {/* 子 Tab A2:告警规则 */}
            {activeSubTab === 'rules' && (
              <div>
                {!isCollectionEnabled && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="当前维度的「采集配置」未启用"
                    description="告警规则已置灰；如需启停/编辑，请先在「采集配置」中启用。"
                  />
                )}
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col xs={24} md={16}>
                    <Space wrap>
                      <Input.Search
                        allowClear
                        placeholder="按规则名称搜索"
                        value={ruleSearch}
                        onChange={(e) => setRuleSearch(e.target.value)}
                        style={{ width: 200 }}
                      />
                      <Select
                        allowClear
                        placeholder="风险等级"
                        style={{ width: 120 }}
                        value={ruleLevelFilter}
                        onChange={setRuleLevelFilter}
                        // V1.4：风险等级 = 紧急/重要/一般（与 8-2 一致）
                        options={securityAlertLevelList.map((v) => ({ label: v, value: v }))}
                      />
                      <Select
                        placeholder="启用状态"
                        style={{ width: 120 }}
                        value={ruleEnabledFilter}
                        onChange={(v) => setRuleEnabledFilter(v as any)}
                        options={[
                          { label: '全部', value: 'all' },
                          { label: '启用', value: 'enabled' },
                          { label: '停用', value: 'disabled' },
                        ]}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => { setRuleSearch(''); setRuleLevelFilter(undefined); setRuleEnabledFilter('all'); }}
                      >
                        重置
                      </Button>
                    </Space>
                  </Col>
                  <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRule}>
                      新建规则
                    </Button>
                  </Col>
                </Row>

                <Table
                  rowKey="id"
                  size="middle"
                  dataSource={filteredRules}
                  columns={ruleColumns as any}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1100 }}
                />
              </div>
            )}
          </>
        )}

        {/* ============= 模式 B · 身份/数据 (内置只读) ============= */}
        {currentMode === 'B' && (
          <>
            {renderModeBTopBar()}
            <Table
              rowKey="id"
              size="middle"
              dataSource={mockBuiltinRules.filter((r) => r.dimension === activeDim)}
              columns={builtinColumns as any}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 1100 }}
            />
          </>
        )}

        {/* ============= 模式 C · 模型/应用 (同步监控中心) ============= */}
        {currentMode === 'C' && (
          <>
            {renderModeCTopBar()}
            <Table
              rowKey="monitoringRuleId"
              size="middle"
              dataSource={mockSyncedRules.filter((r) => r.dimension === activeDim)}
              columns={syncedColumns as any}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 1100 }}
            />
          </>
        )}
      </Card>

      {/* ========== 模式 A · 采集配置编辑抽屉 ========== */}
      <Drawer
        title="编辑采集配置"
        open={collectionEditing}
        onClose={() => setCollectionEditing(false)}
        width={520}
        extra={
          <Space>
            <Button onClick={() => setCollectionEditing(false)}>取消</Button>
            <Button type="primary" onClick={saveCollection}>保存</Button>
          </Space>
        }
      >
        <Form form={collectionForm} layout="vertical">
          <Form.Item
            name="targetIds"
            label="采集对象清单"
            tooltip="从接入中心登记的部署清单中勾选要采集的服务器/IP"
            rules={[{ required: true, message: '请选择至少一个采集对象' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择采集对象"
              options={collectionTargetOptions[activeDim].map((t) => ({ label: t.name, value: t.id }))}
            />
          </Form.Item>
          <Form.Item name="frequency" label="采集频率" rules={[{ required: true }]}>
            <Select options={checkFrequencyList.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="items" label="采集项" rules={[{ required: true, message: '请选择至少一个采集项' }]}>
            <Select
              mode="multiple"
              options={collectionItemOptions[activeDim].map((i) => ({ label: i, value: i }))}
            />
          </Form.Item>
          {activeDim === '网络' && (
            <Form.Item name="whitelist" label="扫描白名单（仅网络）" tooltip="跳过扫描的 IP/端口，如运维堡垒机">
              <Input.TextArea rows={3} placeholder="每行一个 IP/端口" />
            </Form.Item>
          )}
          <Form.Item name="timeout" label="扫描超时（秒）">
            <InputNumber min={60} max={3600} step={60} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ========== V1.4：模式 A · 告警规则新建/编辑/复制 走独立下转页 ========== */}
      {/* 详见：/app/security/rules/new 与 /app/security/rules/:id/edit、/app/security/rules/copy/:id */}

      {/* ========== 模式 B · 内置规则只读详情抽屉 ========== */}
      <Drawer
        title={selectedBuiltin ? `内置规则 · ${selectedBuiltin.name}` : '内置规则详情'}
        open={builtinDrawerOpen}
        onClose={() => { setBuiltinDrawerOpen(false); setSelectedBuiltin(null); }}
        width={620}
        // V1.3:抽屉底部「无操作按钮」(内置只读)
      >
        {selectedBuiltin && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small" title="基本信息">
              <Space wrap size={8}>
                <Tag color={dimensionColor[selectedBuiltin.dimension]}>{selectedBuiltin.dimension}风险</Tag>
                <Tag color={ruleLevelColor[selectedBuiltin.level]}>{selectedBuiltin.level}</Tag>
                <Text type="secondary" code style={{ fontSize: 12 }}>{selectedBuiltin.id}</Text>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">数据来源：</Text><Text>{selectedBuiltin.sourceModule}</Text>
              </div>
              {selectedBuiltin.lastTriggerTime && (
                <div>
                  <Text type="secondary">最近触发：</Text><Text>{selectedBuiltin.lastTriggerTime}</Text>
                </div>
              )}
            </Card>

            <Card size="small" title="触发条件 / 判定逻辑">
              <Paragraph style={{ marginBottom: 0 }}>{selectedBuiltin.triggerCondition}</Paragraph>
            </Card>

            <Card size="small" title="判定字段">
              <Space wrap size={4}>
                {selectedBuiltin.judgmentFields.map((f) => (
                  <Tag key={f} color="cyan">{f}</Tag>
                ))}
              </Space>
            </Card>

            <Card size="small" title="默认响应动作">
              <Space wrap size={4}>
                {selectedBuiltin.defaultResponse.map((a) => (
                  <Tag key={a} color={responseActionColor[a]}>{a}</Tag>
                ))}
              </Space>
            </Card>

            <Card size="small" title="修复建议">
              <Paragraph style={{ marginBottom: 0 }}>{selectedBuiltin.fixSuggestion}</Paragraph>
            </Card>
          </Space>
        )}
      </Drawer>

      {/* ========== 模式 C · 同步规则只读详情抽屉 ========== */}
      <Drawer
        title={selectedSynced ? `同步规则 · ${selectedSynced.name}` : '同步规则详情'}
        open={syncedDrawerOpen}
        onClose={() => { setSyncedDrawerOpen(false); setSelectedSynced(null); }}
        width={620}
        extra={
          selectedSynced && (
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={() => jumpToMonitoring(selectedSynced.monitoringRuleId)}
            >
              去监控中心编辑此规则
            </Button>
          )
        }
      >
        {selectedSynced && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small" title="基本信息">
              <Space wrap size={8}>
                <Tag color={dimensionColor[selectedSynced.dimension]}>{selectedSynced.dimension}风险</Tag>
                <Tag color={ruleLevelColor[selectedSynced.level]}>{selectedSynced.level}</Tag>
                {selectedSynced.enabled ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="default">停用</Tag>
                )}
                <Text type="secondary" code style={{ fontSize: 12 }}>{selectedSynced.monitoringRuleId}</Text>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">数据来源：</Text>
                <Text>运行监控中心 8-6 → 告警管理</Text>
              </div>
              <div>
                <Text type="secondary">最后同步：</Text><Text>{syncedRulesMeta.lastSyncTime}</Text>
              </div>
            </Card>

            <Card size="small" title="阈值摘要">
              <Paragraph style={{ marginBottom: 0 }}>{selectedSynced.thresholdSummary}</Paragraph>
            </Card>

            <Card size="small" title="响应动作">
              <Space wrap size={4}>
                {selectedSynced.responseActions.map((a) => (
                  <Tag key={a} color={responseActionColor[a]}>{a}</Tag>
                ))}
              </Space>
            </Card>

            {selectedSynced.lastTriggerTime && (
              <Card size="small" title="最近触发">
                <Text>{selectedSynced.lastTriggerTime}</Text>
              </Card>
            )}

            <Alert
              type="info"
              showIcon
              message="本规则为监控中心同步快照"
              description="启停/阈值/响应动作的修改必须在监控中心完成，本页所有字段为只读。"
            />
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default RuleManage;
