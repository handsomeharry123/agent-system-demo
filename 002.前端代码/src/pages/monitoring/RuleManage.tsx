/**
 * 5.1 告警规则管理页（V2.0）
 * 需求文档：统一运行监控中心-需求说明文档 V2.0 §5.1
 *
 * 字段：规则名称 / 规则类型 / 触发条件 / 规则内容
 * 按钮：新建规则 / 查看详情 / 编辑 / 删除
 *
 * V2.0 调整（相对 V1.8）：
 * - 按规则类型分 5 个 Tab：全部规则 / 业务监控告警规则 / 状态监控告警规则 /
 *   成本监控告警规则 / 安全监控告警规则（「全部规则」展示所有告警规则，
 *   其余 4 个 Tab 分别只展示对应维度的规则）
 * - 各 Tab 列表字段与操作完全一致，均支持按「规则名称 / 触发指标」模糊搜索
 * - 页面右上角提供【新建规则】入口
 * - 列表仅展示规则自身内容，不展示「告警规则模板库」（V1.8 下方那张大表卡下线）
 *
 * 规则类型统一为：业务监控告警规则 / 状态监控告警规则 / 成本监控告警规则 / 安全监控告警规则
 * 「告警规则模板库」统一收敛至「新建规则 → 选择模板」抽屉内
 * 仅 IT 管理员可见与操作
 */
import { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Space, Tag, Button, Typography, Modal, message, Input, Tooltip,
  Empty, Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import PageHeader from '../../components/PageHeader';
import { PermissionDenied } from '../../components/PageStates';
import {
  mockAlertRulesV18, mockAlertRuleLibrary, AlertRuleTypeLabels, type AlertRuleV18, type AlertRuleType,
} from '../../mock/monitoringV18';
import { useMonitoringGuard } from './useMonitoringGuard';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text } = Typography;

// 5 个 Tab 配置（PRD §5.1）
const TAB_KEYS = ['all', 'business', 'status', 'cost', 'security'] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, string> = {
  all: '全部规则',
  business: '业务监控告警规则',
  status: '状态监控告警规则',
  cost: '成本监控告警规则',
  security: '安全监控告警规则',
};

const typeColors: Record<AlertRuleType, string> = {
  business: 'blue',
  status: 'green',
  cost: 'orange',
  security: 'red',
};

const RuleManage = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { isAdmin } = useMonitoringGuard();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [rules] = useState<AlertRuleV18[]>(mockAlertRulesV18);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // 按 Tab 过滤
  const tabFilteredRules = useMemo(() => {
    if (activeTab === 'all') return rules;
    return rules.filter((r) => r.type === activeTab);
  }, [rules, activeTab]);

  // 再叠加关键词过滤（按 规则名称 / 触发指标）
  const filteredRules = useMemo(() => {
    const k = keyword.trim();
    if (!k) return tabFilteredRules;
    return tabFilteredRules.filter((r) =>
      r.name.includes(k) || r.triggerCondition.metric.includes(k),
    );
  }, [tabFilteredRules, keyword]);

  // 各类型规则条数（用于 Tab 角标）
  const countByType = useMemo(() => {
    const m: Record<AlertRuleType, number> = { business: 0, status: 0, cost: 0, security: 0 };
    rules.forEach((r) => { m[r.type] += 1; });
    return m;
  }, [rules]);

  useEffect(() => {
    pushWelcomeGreeting('monitoring-alert-rules', 'admin', () => [rules.length]);
    (window as any).__alertRulesMonitoringContext = {
      rules: rules.map((rule) => ({
        name: rule.name,
        type: rule.type,
        typeLabel: AlertRuleTypeLabels[rule.type],
        triggerCondition: rule.triggerCondition.description,
        metric: rule.triggerCondition.metric,
        content: mockAlertRuleLibrary.find((item) => item.id === rule.ruleContentId)?.name || '—',
      })),
    };
    return () => {
      consumeWelcome();
      delete (window as any).__alertRulesMonitoringContext;
    };
  }, [consumeWelcome, pushWelcomeGreeting, rules]);

  // 删除规则（弹「确认是否删除」，【是】删除 / 【否】返回）
  const deleteRule = (rule: AlertRuleV18) => {
    Modal.confirm({
      title: '确认是否删除？',
      content: (
        <Space direction="vertical" size={4}>
          <Text>确认删除规则「<Text strong>{rule.name}</Text>」？该操作不可恢复。</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>点击【是】删除此条规则；点击【否】回到规则管理页。</Text>
        </Space>
      ),
      okText: '是',
      cancelText: '否',
      okButtonProps: { danger: true },
      onOk: () => {
        const idx = mockAlertRulesV18.findIndex((r) => r.id === rule.id);
        if (idx >= 0) mockAlertRulesV18.splice(idx, 1);
        message.success('规则已删除');
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<AlertRuleV18>[] = [
    {
      title: '规则名称', dataIndex: 'name', key: 'name', width: 260, fixed: 'left', ellipsis: true,
      render: (_, r) => (
        <Tooltip title={r.name}>
          <Button type="link" style={{ padding: 0, height: 'auto', textAlign: 'left' }}
            onClick={() => navigate(`/app/monitoring/alert-rules/${r.id}`)}>
            {r.name}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '规则类型', dataIndex: 'type', key: 'type', width: 200,
      render: (_, r) => <Tag color={typeColors[r.type]}>{AlertRuleTypeLabels[r.type]}</Tag>,
    },
    {
      title: '触发条件', dataIndex: 'triggerCondition', key: 'triggerCondition', width: 380,
      render: (_, r) => (
        <Tooltip title={r.triggerCondition.description}>
          <Space size={6} wrap>
            <Tag color="default" style={{ marginRight: 0 }}>{r.triggerCondition.metric}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.triggerCondition.description}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '规则内容', dataIndex: 'ruleContentId', key: 'ruleContentId', width: 320, ellipsis: true,
      render: (_, r) => {
        const c = mockAlertRuleLibrary.find((it) => it.id === r.ruleContentId);
        return (
          <Tooltip title={c?.name}>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {c?.name || '—'}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: '操作', key: 'action', width: 240, fixed: 'right', valueType: 'option',
      render: (_, r) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />}
          onClick={() => navigate(`/app/monitoring/alert-rules/${r.id}`)}>
          查看详情
        </Button>,
        <Button key="edit" type="link" size="small" icon={<EditOutlined />}
          onClick={() => navigate(`/app/monitoring/alert-rules/${r.id}/edit`)}>
          编辑
        </Button>,
        <Button key="delete" type="link" size="small" danger icon={<DeleteOutlined />}
          onClick={() => deleteRule(r)}>
          删除
        </Button>,
      ],
    },
  ];

  if (!isAdmin) return <PermissionDenied message="告警规则管理仅面向 IT 管理员" />;

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title="告警规则管理"
        subTitle="按规则类型分 Tab 管理告警规则；提供查看详情 / 编辑 / 删除与新建入口。仅 IT 管理员可访问与操作。"
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '/app/monitoring/alert-rules', breadcrumbName: '告警规则管理' },
        ]}
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => navigate('/app/monitoring/alert-rules/create')}>
              新建规则
            </Button>
          </Space>
        }
      />

      {/* 5 Tab 列表 */}
      <Card bordered={false} bodyStyle={{ paddingTop: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
          items={TAB_KEYS.map((k) => ({
            key: k,
            label: (
              <Space size={6}>
                <span>{TAB_LABELS[k]}</span>
                <Tag style={{ marginRight: 0 }}>
                  {k === 'all' ? rules.length : countByType[k as AlertRuleType]}
                </Tag>
              </Space>
            ),
          }))}
          tabBarExtraContent={
            <Space size={8}>
              <Input
                allowClear prefix={<SearchOutlined />}
                placeholder="按规则名称、触发指标模糊搜索"
                style={{ width: 280 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button icon={<ReloadOutlined />}
                onClick={() => { setKeyword(''); actionRef.current?.reload(); }}>
                刷新
              </Button>
            </Space>
          }
        />

        <ProTable<AlertRuleV18>
          rowKey="id" actionRef={actionRef} search={false}
          options={false}
          columns={columns} dataSource={filteredRules}
          pagination={{
            defaultPageSize: 10, showSizeChanger: true, showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  activeTab === 'all'
                    ? '暂无告警规则，点击右上角「新建规则」开始配置'
                    : `${TAB_LABELS[activeTab]}下暂无规则`
                }
              />
            ),
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
};

export default RuleManage;
