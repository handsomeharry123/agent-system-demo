/**
 * 8-6 告警管理页（V1.6）
 * 需求文档：统一运行监控中心-需求说明文档 V1.6
 *
 * V1.6 重要变更：
 * - 8-6 告警管理「仅承载告警规则配置」（新建/编辑/删除/启停/复制规则）
 * - 告警事件全生命周期（查看/详情/处置/关闭/忽略/转交/审计）由 8-5 告警事件处置页承担
 * - 在本页面顶部提供「告警事件处置」快捷入口（按钮跳转 8-5）
 * - 规则列表列：规则名称 / 监控维度 / 监控指标 / 告警级别 / 触发条件 / 通知方式 / 状态 / 最近触发 / 7 日触发 / 操作
 * - 监控维度精简为三维：业务 / 状态 / 成本（性能维度已并入三维）
 */
import { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Space, Tag, Button, Typography, Switch, Modal, message, Input, Select, Row, Col, Tooltip,
  Tabs, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, CopyOutlined, DeleteOutlined, BellOutlined, MailOutlined, MessageOutlined,
  ReloadOutlined, SearchOutlined, ExclamationCircleOutlined, AlertOutlined,
} from '@ant-design/icons';
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import {
  mockAlertRules, AlertLevelLabels, AlertLevelColors, MonitorDimensionLabels,
  type AlertRule, type AlertLevel, type MonitorDimension,
} from '../../mock/monitoring';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

// V1.6：监控维度精简为三维（性能维度已下线，并入三维）
const dimensionOptions: { label: string; value: MonitorDimension }[] = [
  { label: '业务', value: 'business' },
  { label: '状态', value: 'status' },
  { label: '成本', value: 'cost' },
];

const levelOptions: { label: string; value: AlertLevel }[] = [
  { label: '严重', value: 'severe' },
  { label: '警告', value: 'warning' },
  { label: '提示', value: 'info' },
];

const enabledOptions = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
];

const channelIconMap: Record<string, React.ReactNode> = {
  station: <Tooltip title="站内通知"><BellOutlined /></Tooltip>,
  sms: <Tooltip title="短信"><MessageOutlined /></Tooltip>,
  email: <Tooltip title="邮件"><MailOutlined /></Tooltip>,
};

const Alerts = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [rules, setRules] = useState<AlertRule[]>(mockAlertRules);
  const [keyword, setKeyword] = useState('');
  const [dimFilter, setDimFilter] = useState<MonitorDimension | undefined>();
  const [levelFilter, setLevelFilter] = useState<AlertLevel | undefined>();
  const [enabledFilter, setEnabledFilter] = useState<string | undefined>();

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (keyword && !r.name.includes(keyword) && !r.metricName.includes(keyword)) return false;
      if (dimFilter && r.dimension !== dimFilter) return false;
      if (levelFilter && r.level !== levelFilter) return false;
      if (enabledFilter === 'true' && !r.enabled) return false;
      if (enabledFilter === 'false' && r.enabled) return false;
      return true;
    });
  }, [rules, keyword, dimFilter, levelFilter, enabledFilter]);

  // 复制规则
  const copyRule = (rule: AlertRule) => {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastTriggeredAt: undefined,
      trigger7d: 0,
    };
    setRules([...rules, newRule]);
    message.success('规则复制成功');
    actionRef.current?.reload();
  };

  // 删除规则
  const deleteRule = (rule: AlertRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除规则「${rule.name}」？该操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: () => {
        setRules(rules.filter((r) => r.id !== rule.id));
        message.success('规则已删除');
        actionRef.current?.reload();
      },
    });
  };

  // 切换启停
  const toggleRuleEnabled = (rule: AlertRule) => {
    setRules(rules.map((r) =>
      r.id === rule.id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r,
    ));
    message.success(rule.enabled ? '规则已停用' : '规则已启用');
  };

  const columns: ProColumns<AlertRule>[] = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      fixed: 'left',
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.description || record.name}>
          <Button type="link" onClick={() => navigate(`/app/monitoring/alerts/${record.id}/edit`)}>
            {record.name}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '监控维度', dataIndex: 'dimension', key: 'dimension', width: 100,
      // V1.7：性能维度已并入三维，遗留 performance 维度规则统一显示为「状态」
      render: (_, r) => {
        const dim = r.dimension === 'performance' ? 'status' : r.dimension;
        return <Tag>{MonitorDimensionLabels[dim]}</Tag>;
      },
    },
    { title: '监控指标', dataIndex: 'metricName', key: 'metricName', width: 160, ellipsis: true, render: (n: any) => <Text type="secondary">{n}</Text> },
    {
      title: '告警级别', dataIndex: 'level', key: 'level', width: 100,
      render: (_, r) => <Tag color={AlertLevelColors[r.level]}>{AlertLevelLabels[r.level]}</Tag>,
    },
    {
      title: '触发条件', dataIndex: 'trigger', key: 'trigger', width: 240,
      render: (_, r) => (
        <Text type="secondary" ellipsis>
          {r.trigger.operator} {r.trigger.threshold}{r.trigger.unit}，{r.windowMinutes} 分钟窗口，连续 {r.continuousHits} 次
        </Text>
      ),
    },
    {
      title: '通知方式', dataIndex: 'notification', key: 'notification', width: 120,
      render: (_, r) => (
        <Space size={4}>
          {r.notification.channels.map((c) => <span key={c} style={{ fontSize: 16, color: '#1677FF' }}>{channelIconMap[c]}</span>)}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 100,
      render: (_, r) => (
        <Switch
          checked={r.enabled}
          onChange={() => toggleRuleEnabled(r)}
          checkedChildren="启用" unCheckedChildren="停用"
        />
      ),
    },
    {
      title: '最近触发时间', dataIndex: 'lastTriggeredAt', key: 'lastTriggeredAt', width: 170,
      render: (t?: string) => t
        ? <Text type="secondary">{t.split('T').join(' ').split('+')[0]}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '7 日触发次数', dataIndex: 'trigger7d', key: 'trigger7d', width: 120,
      sorter: (a, b) => a.trigger7d - b.trigger7d,
      render: (c: number) => (
        <Text type={c > 50 ? 'danger' : c > 20 ? 'warning' : 'secondary'}>
          {c} 次
        </Text>
      ),
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right', valueType: 'option',
      render: (_, record) => [
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/app/monitoring/alerts/${record.id}/edit`)}>编辑</Button>,
        <Button key="copy" type="link" size="small" icon={<CopyOutlined />} onClick={() => copyRule(record)}>复制</Button>,
        <Button key="delete" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => deleteRule(record)}>删除</Button>,
      ],
    },
  ];

  // 「规则配置」Tab 内容
  const RuleListTab = (
    <>
      <Alert
        type="info"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="告警事件处置由 8-5 告警事件处置页承担"
        description="本页仅管理告警规则（新建/编辑/删除/启停/复制）。规则触发后产生的告警事件在「8-5 告警事件处置」查看、详情、处置、关闭、忽略、转交与审计归档。"
        action={
          <Button type="primary" icon={<AlertOutlined />} onClick={() => navigate('/app/monitoring/alert-events')}>
            前往 8-5 告警事件处置
          </Button>
        }
        style={{ marginBottom: 16 }}
      />

      <Card bordered={false} style={{ overflow: 'hidden' }}>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
          <Col xs={24} md={16}>
            <Space wrap size={[8, 8]}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="按规则名称、监控指标模糊搜索"
                style={{ width: 240 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Space size={8}>
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>监控维度</span>
                <Select
                  allowClear placeholder="全部" style={{ width: 120 }}
                  value={dimFilter} onChange={setDimFilter}
                  options={dimensionOptions}
                />
              </Space>
              <Space size={8}>
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>告警级别</span>
                <Select
                  allowClear placeholder="全部" style={{ width: 120 }}
                  value={levelFilter} onChange={setLevelFilter}
                  options={levelOptions}
                />
              </Space>
              <Space size={8}>
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>启用状态</span>
                <Select
                  allowClear placeholder="全部" style={{ width: 120 }}
                  value={enabledFilter} onChange={setEnabledFilter}
                  options={enabledOptions}
                />
              </Space>
              <Button icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/app/monitoring/alerts/create')}
            >
              新建告警规则
            </Button>
          </Col>
        </Row>

        <ProTable<AlertRule>
          headerTitle={false}
          rowKey="id"
          actionRef={actionRef}
          search={false}
          columns={columns}
          dataSource={filteredRules}
          pagination={{
            defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true,
            pageSizeOptions: ['20', '50', '100'], showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1600 }}
        />
      </Card>
    </>
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title="告警管理"
        subTitle="配置告警规则、阈值、通知方式；告警事件处置由 8-5 告警事件处置页承担"
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '/app/monitoring/alerts', breadcrumbName: '告警管理' },
        ]}
      />

      <Tabs
        defaultActiveKey="rules"
        items={[
          { key: 'rules', label: <Space><EditOutlined />告警规则配置</Space>, children: RuleListTab },
        ]}
      />
    </div>
  );
};

export default Alerts;
