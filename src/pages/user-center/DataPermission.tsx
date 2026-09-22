import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  TreeSelect,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { mockOrganizationRules } from '../../mock/organization-rules';
import { mockUserOverrides } from '../../mock/user-overrides';
import { mockUsers } from '../../mock/users';
import type {
  OrganizationRule,
  UserOverride,
  AgentScope,
  DataClassification,
  UserRole,
} from '../../types/user';
import { dataClassificationColorMap } from './constants';

const { Text, Paragraph } = Typography;

/* ---------- V1.1 文档：智能体选项 ---------- */
const AGENT_OPTIONS = [
  { label: '心电图智能辅助诊断系统', value: 'agent-001' },
  { label: '胸部 CT 影像智能分析平台', value: 'agent-002' },
  { label: '病历智能生成与质控系统', value: 'agent-003' },
  { label: '处方智能审核与用药安全系统', value: 'agent-004' },
  { label: '智能导诊与分诊系统', value: 'agent-005' },
  { label: '智能问诊系统', value: 'agent-006' },
  { label: '医学影像报告生成系统', value: 'agent-007' },
  { label: '慢病管理系统', value: 'agent-008' },
];

const ALL_CLASSIFICATIONS: DataClassification[] = ['一般', '重要', '核心', '敏感'];

const agentScopeLabel = (s: AgentScope) => ({
  dept: '本科室智能体',
  all: '全部智能体',
  custom: '指定智能体',
} as const)[s];

const expiryLabel = (s: UserOverride['expiryStrategy']) => ({
  onOrgChange: '随组织变动失效',
  byDate: '截止日期到期失效',
  permanent: '长期有效',
} as const)[s];

const expiryColor = (s: UserOverride['expiryStrategy']) =>
  s === 'onOrgChange' ? 'blue' : s === 'byDate' ? 'orange' : 'default';

/* ============================================================
 * 主组件
 * ============================================================ */
const DataPermission = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isItAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

  // Tab 1: 组织规则
  const [rules, setRules] = useState<OrganizationRule[]>(mockOrganizationRules);
  const [editRuleModalOpen, setEditRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OrganizationRule | null>(null);
  const [ruleForm] = Form.useForm();

  // Tab 2: 用户级覆盖
  const [overrides, setOverrides] = useState<UserOverride[]>(mockUserOverrides);
  const [editOverrideModalOpen, setEditOverrideModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<UserOverride | null>(null);
  const [overrideForm] = Form.useForm();
  const [overrideOrgFilter, setOverrideOrgFilter] = useState<string | undefined>();

  // 跨 Tab 跳转：组织规则列表点击"用户级覆盖数" → 切到 Tab 2 并预筛组织
  const [activeTab, setActiveTab] = useState<'org' | 'override'>('org');

  /* ---------- 工具 ---------- */
  // 组织树下拉数据
  const orgTreeData = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => !r.isDefault && set.add(r.orgName));
    mockUsers.forEach((u) => set.add(u.department));
    return Array.from(set).map((o) => ({ value: o, label: o }));
  }, [rules]);

  /* ---------- Tab 1：组织规则 ---------- */
  const handleNewRule = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    ruleForm.setFieldsValue({
      agentScope: 'dept',
      dataClassifications: ['一般'],
    });
    setEditRuleModalOpen(true);
  };

  const handleEditRule = (r: OrganizationRule) => {
    setEditingRule(r);
    ruleForm.setFieldsValue({
      orgNames: r.isDefault ? undefined : [r.orgName],
      agentScope: r.agentScope,
      customAgents: r.customAgents,
      dataClassifications: r.dataClassifications,
      note: r.note,
    });
    setEditRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
    const values = await ruleForm.validateFields();
    if (editingRule && editingRule.isDefault) {
      // 全院默认规则
      const updated: OrganizationRule = {
        ...editingRule,
        agentScope: values.agentScope,
        customAgents: values.customAgents,
        dataClassifications: values.dataClassifications,
        note: values.note,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      message.success('全院默认规则已更新');
    } else {
      const orgNames: string[] = values.orgNames || [];
      if (orgNames.length === 0) {
        message.error('请选择适用组织');
        return;
      }
      // 新建 / 覆盖多条规则
      const updated = rules.map((r) => {
        if (orgNames.includes(r.orgName)) {
          return {
            ...r,
            agentScope: values.agentScope,
            customAgents: values.customAgents,
            dataClassifications: values.dataClassifications,
            note: values.note,
            configured: true,
            updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          };
        }
        return r;
      });
      // 新组织可能没在 mock 里
      const existing = new Set(updated.map((r) => r.orgName));
      orgNames.forEach((n) => {
        if (!existing.has(n)) {
          updated.push({
            id: `rule-${n}`,
            orgName: n,
            isDefault: false,
            isFixed: false,
            agentScope: values.agentScope,
            customAgents: values.customAgents,
            dataClassifications: values.dataClassifications,
            note: values.note,
            updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            inheritedUserCount: mockUsers.filter((u) => u.department === n).length,
            overrideUserCount: 0,
            configured: true,
          });
        }
      });
      setRules(updated);
      message.success(`已为 ${orgNames.length} 个组织保存规则`);
    }
    setEditRuleModalOpen(false);
    ruleForm.resetFields();
  };

  const handleResetRule = (r: OrganizationRule) => {
    if (r.isDefault) return;
    Modal.confirm({
      title: '重置为全院默认',
      content: `确认将「${r.orgName}」的规则重置为全院默认？组织下所有用户将沿用全院默认规则。`,
      okText: '确认重置',
      cancelText: '取消',
      onOk: () => {
        setRules((prev) =>
          prev.map((p) =>
            p.id === r.id
              ? { ...p, configured: false, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) }
              : p,
          ),
        );
        message.success(`「${r.orgName}」已重置为全院默认规则`);
      },
    });
  };

  /* ---------- Tab 2：用户级覆盖 ---------- */
  const handleNewOverride = () => {
    setEditingOverride(null);
    overrideForm.resetFields();
    overrideForm.setFieldsValue({
      agentScope: 'dept',
      dataClassifications: ['一般'],
      expiryStrategy: 'onOrgChange',
    });
    setEditOverrideModalOpen(true);
  };

  const handleEditOverride = (o: UserOverride) => {
    setEditingOverride(o);
    overrideForm.setFieldsValue({
      userIds: [o.userId],
      agentScope: o.userScope.agentScope,
      customAgents: o.userScope.customAgents,
      dataClassifications: o.userScope.dataClassifications,
      reason: o.reason,
      expiryStrategy: o.expiryStrategy,
      expiryDate: o.expiryDate,
    });
    setEditOverrideModalOpen(true);
  };

  const handleCancelOverride = (o: UserOverride) => {
    Modal.confirm({
      title: '取消用户级覆盖',
      content: `确认取消「${o.userName}」的用户级覆盖？取消后该用户的数据范围将回归组织「${o.department}」的默认规则。`,
      okText: '确认取消',
      cancelText: '不取消',
      onOk: () => {
        setOverrides((prev) => prev.filter((p) => p.id !== o.id));
        message.success(`已取消「${o.userName}」的用户级覆盖`);
      },
    });
  };

  const handleSaveOverride = async () => {
    const values = await overrideForm.validateFields();
    if (editingOverride) {
      setOverrides((prev) =>
        prev.map((o) =>
          o.id === editingOverride.id
            ? {
                ...o,
                userScope: {
                  agentScope: values.agentScope,
                  customAgents: values.customAgents,
                  dataClassifications: values.dataClassifications,
                },
                reason: values.reason,
                expiryStrategy: values.expiryStrategy,
                expiryDate: values.expiryDate,
                updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
              }
            : o,
        ),
      );
      message.success('用户级覆盖已更新');
    } else {
      // 新建：从 userIds 列表展开成多条 override
      const userIds: string[] = values.userIds || [];
      if (userIds.length === 0) {
        message.error('请选择覆盖用户');
        return;
      }
      const newOverrides: UserOverride[] = userIds
        .map((uid) => mockUsers.find((u) => u.id === uid))
        .filter(Boolean)
        .map((u) => {
          const orgRule = rules.find((r) => r.orgName === u!.department);
          return {
            id: `override-${u!.id}-${Date.now()}`,
            userId: u!.id,
            userName: u!.name,
            employeeId: u!.employeeId,
            department: u!.department,
            roles: u!.roles,
            orgDefault: {
              agentScope: orgRule?.agentScope || 'dept',
              customAgents: orgRule?.customAgents,
              dataClassifications: orgRule?.dataClassifications || ['一般'],
            },
            userScope: {
              agentScope: values.agentScope,
              customAgents: values.customAgents,
              dataClassifications: values.dataClassifications,
            },
            reason: values.reason,
            expiryStrategy: values.expiryStrategy,
            expiryDate: values.expiryDate,
            createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          };
        });
      setOverrides((prev) => [...prev, ...newOverrides]);
      message.success(`已为 ${newOverrides.length} 名用户配置用户级覆盖`);
    }
    setEditOverrideModalOpen(false);
    overrideForm.resetFields();
  };

  /* ---------- 列表列定义 ---------- */
  // Tab 1：组织规则列
  const ruleColumns: ColumnsType<OrganizationRule> = [
    {
      title: '组织/科室',
      dataIndex: 'orgName',
      key: 'orgName',
      width: 200,
      render: (name, record) => (
        <Space direction="vertical" size={2}>
          {record.isDefault ? (
            <Tag color="blue" icon={<InfoCircleOutlined />}>全院默认规则</Tag>
          ) : (
            <a onClick={() => handleEditRule(record)}>{name}</a>
          )}
          {record.isDefault && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              兜底规则：未单独配置的科室沿用本规则
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '智能体范围',
      dataIndex: 'agentScope',
      key: 'agentScope',
      width: 150,
      render: (scope: AgentScope, record) => {
        if (scope === 'custom' && record.customAgents) {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="cyan">指定智能体</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.customAgents.length} 个
              </Text>
            </Space>
          );
        }
        return <Tag color={scope === 'all' ? 'red' : 'blue'}>{agentScopeLabel(scope)}</Tag>;
      },
    },
    {
      title: '数据分级',
      dataIndex: 'dataClassifications',
      key: 'dataClassifications',
      width: 200,
      render: (list: DataClassification[]) => (
        <Space size={4} wrap>
          {list.map((c) => (
            <Tag key={c} color={dataClassificationColorMap[c]}>{c}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '继承用户数',
      dataIndex: 'inheritedUserCount',
      key: 'inheritedUserCount',
      width: 110,
      align: 'center',
      render: (val, record) => (
        <a
          onClick={() => {
            if (record.isDefault) {
              navigate('/app/user-center');
            } else {
              navigate(`/app/user-center?dept=${encodeURIComponent(record.orgName)}`);
            }
          }}
        >
          {val} 人 <ArrowRightOutlined style={{ fontSize: 10 }} />
        </a>
      ),
    },
    {
      title: '用户级覆盖数',
      dataIndex: 'overrideUserCount',
      key: 'overrideUserCount',
      width: 120,
      align: 'center',
      render: (val, record) =>
        record.isDefault ? (
          <Text type="secondary">-</Text>
        ) : (
          <a
            onClick={() => {
              setOverrideOrgFilter(record.orgName);
              setActiveTab('override');
            }}
          >
            {val} 人 <ArrowRightOutlined style={{ fontSize: 10 }} />
          </a>
        ),
    },
    {
      title: '规则来源',
      key: 'source',
      width: 130,
      render: (_, record) => (
        <Tag color={record.configured ? 'blue' : 'default'}>
          {record.configured ? '已单独配置' : '沿用全院默认'}
        </Tag>
      ),
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRule(record)}
            disabled={!isItAdmin}
          >
            编辑
          </Button>
          {!record.isDefault && !record.isFixed && (
            <Popconfirm
              title="重置为全院默认"
              description="确认将本组织规则重置为全院默认？"
              onConfirm={() => handleResetRule(record)}
            >
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                disabled={!isItAdmin}
              >
                重置为全院默认
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Tab 2：用户级覆盖列
  const overrideColumns: ColumnsType<UserOverride> = [
    {
      title: '姓名',
      dataIndex: 'userName',
      key: 'userName',
      width: 110,
      fixed: 'left',
      render: (name, record) => (
        <a onClick={() => handleEditOverride(record)}>{name}</a>
      ),
    },
    {
      title: '工号 / 所属组织',
      key: 'id-org',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{record.employeeId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 180,
      render: (roles: UserRole[]) => (
        <Space size={4} wrap>
          {roles.map((r) => (
            <Tag key={r} color="blue">{r}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '组织默认范围',
      key: 'orgDefault',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color="default">{agentScopeLabel(record.orgDefault.agentScope)}</Tag>
          <Space size={2} wrap>
            {record.orgDefault.dataClassifications.map((c) => (
              <Tag key={c}>{c}</Tag>
            ))}
          </Space>
        </Space>
      ),
    },
    {
      title: '用户级范围',
      key: 'userScope',
      width: 220,
      render: (_, record) => {
        const isDiff =
          record.orgDefault.agentScope !== record.userScope.agentScope ||
          JSON.stringify(record.orgDefault.dataClassifications) !==
            JSON.stringify(record.userScope.dataClassifications);
        return (
          <Space direction="vertical" size={2}>
            <Tag color="orange" icon={<SettingOutlined />}>
              {agentScopeLabel(record.userScope.agentScope)}
            </Tag>
            {isDiff && <Tag color="warning">与默认不一致</Tag>}
            <Space size={2} wrap>
              {record.userScope.dataClassifications.map((c) => (
                <Tag key={c} color="orange">{c}</Tag>
              ))}
            </Space>
          </Space>
        );
      },
    },
    {
      title: '覆盖原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 240,
      ellipsis: true,
    },
    {
      title: '失效策略',
      key: 'expiry',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={expiryColor(record.expiryStrategy)}>{expiryLabel(record.expiryStrategy)}</Tag>
          {record.expiryStrategy === 'byDate' && record.expiryDate && (
            <Text type="secondary" style={{ fontSize: 12 }}>截止 {record.expiryDate}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '创建/更新时间',
      key: 'time',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: 12 }}>创建：{record.createdAt}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>更新：{record.updatedAt}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditOverride(record)}
            disabled={!isItAdmin}
          >
            编辑
          </Button>
          <Popconfirm
            title="取消覆盖"
            description="取消后该用户将回归组织默认规则"
            onConfirm={() => handleCancelOverride(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!isItAdmin}
            >
              取消覆盖
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Tab 2 筛选：按组织
  const filteredOverrides = useMemo(() => {
    if (!overrideOrgFilter) return overrides;
    return overrides.filter((o) => o.department === overrideOrgFilter);
  }, [overrides, overrideOrgFilter]);

  // 用户多选下拉：未配置 override 的用户
  const userOptions = useMemo(
    () =>
      mockUsers.map((u) => ({
        label: `${u.name}（${u.employeeId} · ${u.department}）`,
        value: u.id,
      })),
    [],
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title="数据权限配置"
        subTitle="按组织（科室）配置可见智能体范围与数据分级，用户自动继承本科室规则"
        extra={
          isItAdmin
            ? [
                activeTab === 'org' ? (
                  <Button
                    key="new-rule"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleNewRule}
                  >
                    新增组织规则
                  </Button>
                ) : (
                  <Button
                    key="new-override"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleNewOverride}
                  >
                    新增用户级覆盖
                  </Button>
                ),
              ]
            : undefined
        }
      />

      <Alert
        type="info"
        showIcon
        message={
          <Text>
            生效优先级：<Tag color="orange">用户级覆盖</Tag> &gt; <Tag color="blue">用户所属组织规则</Tag> &gt; <Tag>全院默认规则</Tag>
          </Text>
        }
        style={{ marginBottom: 16 }}
      />

      <Card bordered={false} styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'org' | 'override')}
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'org',
              label: (
                <span>
                  <TeamOutlined /> 组织数据权限规则
                </span>
              ),
              children: (
                <Table
                  columns={ruleColumns}
                  dataSource={rules}
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 1400 }}
                  size="middle"
                />
              ),
            },
            {
              key: 'override',
              label: (
                <span>
                  <SettingOutlined /> 用户级覆盖
                  {overrides.length > 0 && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>{overrides.length}</Tag>
                  )}
                </span>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Alert
                    type="warning"
                    showIcon
                    message="仅作为例外通道：突破所属组织默认规则的用户列表"
                    style={{ margin: '0 16px' }}
                  />
                  <Space style={{ padding: '0 16px' }} wrap>
                    <Input.Search
                      placeholder="按姓名/工号搜索"
                      allowClear
                      style={{ width: 220 }}
                      onSearch={(kw) => {
                        // mock：仅展示，无实际过滤
                        message.info(`搜索关键字：${kw || '（空）'}`);
                      }}
                    />
                    <TreeSelect
                      placeholder="按所属组织筛选"
                      allowClear
                      style={{ width: 200 }}
                      treeData={orgTreeData}
                      value={overrideOrgFilter}
                      onChange={(v) => setOverrideOrgFilter(v as string | undefined)}
                    />
                    {overrideOrgFilter && (
                      <Button type="link" onClick={() => setOverrideOrgFilter(undefined)}>
                        清除筛选
                      </Button>
                    )}
                  </Space>
                  <Table
                    columns={overrideColumns}
                    dataSource={filteredOverrides}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1500 }}
                    size="middle"
                    locale={{ emptyText: '暂无用户级覆盖记录' }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑组织规则弹窗 */}
      <Modal
        title={editingRule ? (editingRule.isDefault ? '编辑全院默认规则' : '编辑组织规则') : '新增组织规则'}
        open={editRuleModalOpen}
        onCancel={() => {
          setEditRuleModalOpen(false);
          ruleForm.resetFields();
        }}
        onOk={handleSaveRule}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <Form form={ruleForm} layout="vertical">
          {!editingRule && (
            <Form.Item
              name="orgNames"
              label="适用组织（可多选）"
              rules={[{ required: true, message: '请选择适用组织' }]}
            >
              <TreeSelect
                multiple
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                treeData={orgTreeData}
                placeholder="选择一个或多个科室"
              />
            </Form.Item>
          )}
          {editingRule && !editingRule.isDefault && (
            <Form.Item label="适用组织">
              <Tag color="blue">{editingRule.orgName}</Tag>
            </Form.Item>
          )}
          {editingRule?.isDefault && (
            <Form.Item label="适用组织">
              <Tag color="blue" icon={<InfoCircleOutlined />}>全院默认规则</Tag>
            </Form.Item>
          )}
          <Form.Item
            name="agentScope"
            label="智能体范围"
            rules={[{ required: true, message: '请选择智能体范围' }]}
          >
            <Radio.Group>
              <Radio value="dept">本科室智能体</Radio>
              <Radio value="all">全部智能体</Radio>
              <Radio value="custom">指定智能体（多选）</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const scope = ruleForm.getFieldValue('agentScope');
              return scope === 'custom' ? (
                <Form.Item
                  name="customAgents"
                  label="指定智能体"
                  rules={[{ required: true, message: '请选择至少一个智能体' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="选择智能体"
                    options={AGENT_OPTIONS}
                  />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          <Form.Item
            name="dataClassifications"
            label="数据分级"
            rules={[{ required: true, message: '请选择数据分级' }]}
          >
            <Checkbox.Group>
              <Space size={8} wrap>
                {ALL_CLASSIFICATIONS.map((c) => (
                  <Checkbox key={c} value={c}>
                    <Tag color={dataClassificationColorMap[c]}>{c}</Tag>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item name="note" label="规则说明">
            <Input.TextArea rows={2} placeholder="规则用途备注，便于审计" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户级覆盖弹窗 */}
      <Modal
        title={editingOverride ? '编辑用户级覆盖' : '新增用户级覆盖'}
        open={editOverrideModalOpen}
        onCancel={() => {
          setEditOverrideModalOpen(false);
          overrideForm.resetFields();
        }}
        onOk={handleSaveOverride}
        okText="保存覆盖"
        cancelText="取消"
        width={600}
      >
        <Form form={overrideForm} layout="vertical">
          <Form.Item
            name="userIds"
            label="覆盖用户"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select
              mode="multiple"
              disabled={!!editingOverride}
              placeholder="选择一个或多个用户"
              options={userOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
          <Form.Item
            name="agentScope"
            label="智能体范围"
            rules={[{ required: true, message: '请选择智能体范围' }]}
          >
            <Radio.Group>
              <Radio value="dept">本科室智能体</Radio>
              <Radio value="all">全部智能体</Radio>
              <Radio value="custom">指定智能体（+ 添加 / - 移除）</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const scope = overrideForm.getFieldValue('agentScope');
              return scope === 'custom' ? (
                <Form.Item
                  name="customAgents"
                  label="指定智能体"
                  rules={[{ required: true, message: '请选择智能体' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="在组织默认基础上增量调整"
                    options={AGENT_OPTIONS}
                  />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          <Form.Item
            name="dataClassifications"
            label="数据分级"
            rules={[{ required: true, message: '请选择数据分级' }]}
          >
            <Checkbox.Group>
              <Space size={8} wrap>
                {ALL_CLASSIFICATIONS.map((c) => (
                  <Checkbox key={c} value={c}>
                    <Tag color={dataClassificationColorMap[c]}>{c}</Tag>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item
            name="reason"
            label="覆盖原因"
            rules={[{ required: true, message: '请填写覆盖原因' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：MDT 多学科会诊 / 跨科调研 / 信息科测试" />
          </Form.Item>
          <Form.Item
            name="expiryStrategy"
            label="失效策略"
            rules={[{ required: true, message: '请选择失效策略' }]}
          >
            <Radio.Group>
              <Radio value="onOrgChange">随组织变动失效（推荐）</Radio>
              <Radio value="byDate">截止日期到期失效</Radio>
              <Radio value="permanent">长期有效</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const s = overrideForm.getFieldValue('expiryStrategy');
              return s === 'byDate' ? (
                <Form.Item
                  name="expiryDate"
                  label="截止日期"
                  rules={[{ required: true, message: '请选择截止日期' }]}
                >
                  <Input type="date" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataPermission;
