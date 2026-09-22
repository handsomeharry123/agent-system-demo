/**
 * 正式环境页 V1.4
 * 对应需求文档：环境配置-需求说明文档V1.4 §2
 *
 * 路由：/app/environment/production
 * 结构：PageHeader + 内部 Tabs（V1.4 删除顶部全局生产慎重 Alert + 3 个分组内 Alert，仅保留标题 Tooltip）
 *   Tab 1「正式环境配置」（默认）：4 个 Collapse 折叠分组 + 底部 sticky 保存/重置栏
 *     1) 真实环境安装
 *     2) 运行资源配置（标题 Tooltip：根据智能体注册信息中填写的资源需求进行配置；分组内不再展示蓝色 info Alert）
 *     3) 网络资源配置（标题 Tooltip：正式环境接入医院内网；网络地址变更将影响线上调用，端口变更需同步通知信息科与供应商；分组内不再展示黄色 warning Alert）
 *     4) 权限配置（Form.List 动态多业务系统；分组内不再展示黄色 warning Alert）
 *   Tab 2「正式环境内智能体」（沿用 V1.3 纯展示）：6 列 Table，无 rowSelection、无顶部工具栏、无「查看监控」「退回沙盒复测」入口
 *     末列沿用 V1.3「部署时间 deployedAt」
 *
 * V1.3 → V1.4 变更：
 *   - 删除顶部全局"生产慎重"Alert；关键变更时的"变更原因"仍由保存弹窗内的 Alert 承载
 *   - 删除分组 2/3/4 内 3 个 Alert（info 1 个 + warning 2 个），分组标题 Tooltip 仍保留
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tabs,
  Collapse,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Tag,
  Table,
  Tooltip,
  Typography,
  Row,
  Col,
  message,
  Modal,
  Alert,
} from 'antd';
import {
  InfoCircleOutlined,
  WarningOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import {
  defaultProdConfig,
  mockProdAgents,
  HOSPITAL_SYSTEM_OPTIONS,
  DATA_SCOPE_OPTIONS,
  OP_PERMISSION_OPTIONS,
  PERMISSION_AUTH_OPTIONS,
  LOGIN_AUTH_OPTIONS,
  runStatusColor,
  makeEmptyPermissionItem,
  hasDuplicateHospitalSystem,
  type ProdEnvConfig,
  type ProdAgentItem,
  type PermissionItem,
} from '../../mock/environment';
import {
  validateEnvRequired,
  diffCriticalGroups,
  criticalGroupLabel,
} from './envConfigValidator';

const { Text } = Typography;

type EnvGroupKey = 'install' | 'resource' | 'network' | 'permission';

const ALL_GROUP_KEYS: EnvGroupKey[] = ['install', 'resource', 'network', 'permission'];

const ProductionPage = () => {
  // 已保存值（用于「重置」恢复）
  const [config, setConfig] = useState<ProdEnvConfig>(defaultProdConfig);
  // 表单临时编辑值
  const [draft, setDraft] = useState<ProdEnvConfig>(defaultProdConfig);

  const [activeKeys, setActiveKeys] = useState<string[]>(ALL_GROUP_KEYS);
  const [tabKey, setTabKey] = useState<'config' | 'agents'>('config');

  const [agents] = useState<ProdAgentItem[]>(mockProdAgents);

  const [reasonForm] = Form.useForm<{ reason: string }>();

  const navigate = useNavigate();

  const agentCount = agents.length;

  // 关键分组是否发生变更（用于保存按钮文案与提示动态切换）
  const hasCriticalChange = useMemo(
    () => diffCriticalGroups(config, draft).length > 0,
    [config, draft],
  );

  // ===== 通用更新工具 =====
  const update = <K extends keyof ProdEnvConfig>(
    key: K,
    patch: Partial<ProdEnvConfig[K]>,
  ) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  // ===== 权限列表（Form.List 风格） =====
  const addPermission = () => {
    setDraft((prev) => ({
      ...prev,
      permission: [...prev.permission, makeEmptyPermissionItem()],
    }));
  };

  const removePermission = (id: string) => {
    setDraft((prev) => {
      if (prev.permission.length <= 1) {
        message.warning('至少保留 1 条业务系统权限');
        return prev;
      }
      return {
        ...prev,
        permission: prev.permission.filter((it) => it.id !== id),
      };
    });
  };

  const updatePermissionField = <K extends keyof PermissionItem>(
    id: string,
    field: K,
    value: PermissionItem[K],
  ) => {
    setDraft((prev) => ({
      ...prev,
      permission: prev.permission.map((it) =>
        it.id === id ? { ...it, [field]: value } : it,
      ),
    }));
  };

  // ============== 保存：关键变更 → 变更原因（必填）；非关键 → 普通二次确认 ==============
  const handleSave = () => {
    // 1. 必填校验
    const err = validateEnvRequired(draft);
    if (err) {
      message.error(err);
      return;
    }
    // 2. 业务系统重复校验
    if (hasDuplicateHospitalSystem(draft.permission)) {
      message.error('医院业务系统不可重复，请修改');
      return;
    }

    // 3. 检测关键分组变更
    const changedGroups = diffCriticalGroups(config, draft);
    const hasCriticalChange = changedGroups.length > 0;

    if (!hasCriticalChange) {
      // 非关键分组：普通二次确认
      Modal.confirm({
        title: '确认保存正式环境配置？',
        icon: <InfoCircleOutlined style={{ color: '#1677FF' }} />,
        content: (
          <div>
            <Text>
              本次保存将对当前正式环境内{' '}
              <Text strong style={{ color: '#1677FF' }}>{agentCount}</Text>{' '}
              个智能体生效；未涉及资源/网络/权限关键分组变更。
            </Text>
          </div>
        ),
        okText: '确认保存',
        cancelText: '取消',
        onOk: () => {
          setConfig(draft);
          message.success('正式环境配置已保存');
        },
      });
      return;
    }

    // 4. 关键分组变更：内嵌变更原因（必填）
    const changedListText = changedGroups
      .map((k) => criticalGroupLabel[k])
      .join('、');

    Modal.confirm({
      icon: <WarningOutlined style={{ color: '#FA8C16' }} />,
      title: '确认保存正式环境配置？',
      width: 560,
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={
              <span>
                生产慎重：本次保存将影响{' '}
                <Text strong style={{ color: '#1677FF' }}>{agentCount}</Text>{' '}
                个智能体；涉及 {changedListText} 变更；变更原因将归档审计中心。
              </span>
            }
          />
          <Form form={reasonForm} layout="vertical">
            <Form.Item
              label="变更原因"
              name="reason"
              required
              rules={[
                {
                  required: true,
                  message: '请填写变更原因',
                },
                {
                  validator: (_, value) => {
                    if (!value || !String(value).trim()) {
                      return Promise.reject(new Error('请填写变更原因'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="如：升级模型版本 / 扩容 / 调整熔断阈值 / 修改网络白名单等"
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Form>
        </div>
      ),
      okText: '保存配置（需变更原因）',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        return reasonForm
          .validateFields()
          .then((vals) => {
            const reason = (vals.reason ?? '').trim();
            if (!reason) {
              message.error('请填写变更原因');
              return Promise.reject();
            }
            setConfig(draft);
            reasonForm.resetFields();
            message.success(
              `正式环境配置已保存（变更原因：${reason}），已归档审计中心`,
            );
          })
          .catch(() => Promise.reject());
      },
      onCancel: () => {
        reasonForm.resetFields();
      },
    });
  };

  // ============== 重置 ==============
  const handleReset = () => {
    Modal.confirm({
      title: '确认重置参数？',
      content: '将恢复为上次保存的值，未保存的修改将丢失。',
      okText: '确认重置',
      cancelText: '取消',
      onOk: () => {
        setDraft(config);
        message.info('已恢复至上次保存的值');
      },
    });
  };

  // ============== 智能体表格列（V1.3 §2：6 列纯展示，无操作列） ==============
  const columns: ColumnsType<ProdAgentItem> = [
    {
      title: '智能体名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      fixed: 'left',
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Link
            onClick={() => navigate(`/app/ledger/detail/${record.id}`)}
          >
            {name}
          </Typography.Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 220,
      ellipsis: true,
    },
    {
      title: '归属科室',
      dataIndex: 'department',
      key: 'department',
      width: 130,
      render: (d: string) => <Tag color="blue">{d}</Tag>,
    },
    {
      title: '运行状态',
      dataIndex: 'runStatus',
      key: 'runStatus',
      width: 110,
      filters: [
        { text: '运行中', value: '运行中' },
        { text: '告警中', value: '告警中' },
        { text: '异常', value: '异常' },
      ],
      onFilter: (val, row) => row.runStatus === val,
      render: (s: ProdAgentItem['runStatus']) => (
        <Tag color={runStatusColor[s]}>{s}</Tag>
      ),
    },
    {
      // V1.3 §2 末列：「部署时间」智能体进入正式环境的时间
      title: '部署时间',
      dataIndex: 'deployedAt',
      key: 'deployedAt',
      width: 180,
      sorter: (a, b) =>
        new Date(a.deployedAt).getTime() - new Date(b.deployedAt).getTime(),
      defaultSortOrder: 'descend',
    },
  ];

  // ============== 4 个 Collapse 分组 ==============
  const items = [
    // ===== 1. 真实环境安装 =====
    {
      key: 'install',
      label: <Text strong>1. 真实环境安装</Text>,
      children: (
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Form.Item label="Docker 版本" required>
              <Input
                value={draft.install.dockerVersion}
                onChange={(e) => update('install', { dockerVersion: e.target.value })}
                placeholder="如：Docker 26.1.4 及以上"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Docker Compose 版本" required>
              <Input
                value={draft.install.dockerComposeVersion}
                onChange={(e) =>
                  update('install', { dockerComposeVersion: e.target.value })
                }
                placeholder="如：Docker Compose 2.27.1 及以上"
              />
            </Form.Item>
          </Col>
        </Row>
      ),
    },

    // ===== 2. 运行资源配置 =====
    {
      key: 'resource',
      label: (
        <Space>
          <Text strong>2. 运行资源配置</Text>
          <Tooltip title="根据智能体注册信息中填写的资源需求进行配置。">
            <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
          </Tooltip>
        </Space>
      ),
      children: (
        <>
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <Form.Item label="CPU" required>
                <InputNumber
                  min={4}
                  style={{ width: '100%' }}
                  value={draft.resource.cpu}
                  addonAfter="Core"
                  onChange={(v) => update('resource', { cpu: v ?? 0 })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="RAM 内存" required>
                <InputNumber
                  min={16}
                  style={{ width: '100%' }}
                  value={draft.resource.ram}
                  addonAfter="GB"
                  onChange={(v) => update('resource', { ram: v ?? 0 })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Disk 磁盘" required>
                <InputNumber
                  min={50}
                  style={{ width: '100%' }}
                  value={draft.resource.disk}
                  addonAfter="GB"
                  onChange={(v) => update('resource', { disk: v ?? 0 })}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },

    // ===== 3. 网络资源配置 =====
    {
      key: 'network',
      label: (
        <Space>
          <Text strong>3. 网络资源配置</Text>
          <Tooltip title="正式环境接入医院内网；网络地址变更将影响线上调用，端口变更需同步通知信息科与供应商。">
            <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
          </Tooltip>
        </Space>
      ),
      children: (
        <>
          <Row gutter={[16, 12]}>
            <Col span={12}>
              <Form.Item label="网络地址" required>
                <Input
                  addonBefore={<Tag color="blue" style={{ margin: 0 }}>医院内网</Tag>}
                  value={draft.network.ipAddress}
                  placeholder="http://10.30.1.50"
                  onChange={(e) => update('network', { ipAddress: e.target.value })}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="端口分配"
                required
                tooltip="如 80、443、8080 端口；回车添加多项"
              >
                <Select
                  mode="tags"
                  value={draft.network.ports}
                  placeholder="如：80、443、8080"
                  onChange={(v) => update('network', { ports: v as string[] })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="登录认证方式"
                required
                tooltip="配置 SSH 密钥登录，禁用 root 直接登录"
              >
                <Select
                  value={draft.network.loginAuth}
                  options={LOGIN_AUTH_OPTIONS as { label: string; value: string }[]}
                  onChange={(v) => update('network', { loginAuth: v })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },

    // ===== 4. 权限配置（多业务系统 Form.List） =====
    // V1.3 §2 第 248 行：仅要求 Form.List 管理多业务系统权限，未要求分组 4 标题 Tooltip（与沙盒分组 4 不同）
    {
      key: 'permission',
      label: <Text strong>4. 权限配置</Text>,
      children: (
        <>
          {draft.permission.map((it, idx) => {
            const usedSystems = new Set(
              draft.permission
                .map((p, i) => (i === idx ? '' : p.hospitalSystem))
                .filter(Boolean),
            );
            const sysOptions = (HOSPITAL_SYSTEM_OPTIONS as { label: string; value: string }[])
              .filter((o) => !usedSystems.has(o.value));
            return (
              <Card
                key={it.id}
                size="small"
                style={{ marginBottom: 12, background: '#fafafa' }}
                title={
                  <Space>
                    <Text strong style={{ fontSize: 13 }}>
                      业务系统 {idx + 1}
                    </Text>
                    {it.hospitalSystem && (
                      <Tag color="blue">{it.hospitalSystem}</Tag>
                    )}
                  </Space>
                }
                extra={
                  <Tooltip title={draft.permission.length <= 1 ? '至少保留 1 条' : '删除该业务系统'}>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={draft.permission.length <= 1}
                      onClick={() => removePermission(it.id)}
                    >
                      删除
                    </Button>
                  </Tooltip>
                }
              >
                <Row gutter={[16, 12]}>
                  <Col span={8}>
                    <Form.Item label="医院业务系统" required>
                      <Select
                        value={it.hospitalSystem || undefined}
                        placeholder="选择已审批的业务系统"
                        options={sysOptions}
                        onChange={(v) => updatePermissionField(it.id, 'hospitalSystem', v)}
                        showSearch
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="数据授权范围" required>
                      <Select
                        value={it.dataScope || undefined}
                        placeholder="该系统按权限审批结果配置的数据范围"
                        options={DATA_SCOPE_OPTIONS as { label: string; value: string }[]}
                        onChange={(v) => updatePermissionField(it.id, 'dataScope', v)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="操作权限类型" required>
                      <Select
                        value={it.opPermission || undefined}
                        placeholder="该系统按权限审批结果配置的操作权限"
                        options={OP_PERMISSION_OPTIONS as { label: string; value: string }[]}
                        onChange={(v) => updatePermissionField(it.id, 'opPermission', v)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item label="接口地址" required>
                      <Input
                        value={it.permissionUrl}
                        placeholder="各业务系统权限地址，如：https://prod.med-agent.hospital/api/v1/his/permission"
                        onChange={(e) =>
                          updatePermissionField(it.id, 'permissionUrl', e.target.value)
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="认证方式" required>
                      <Select
                        value={it.permissionAuth}
                        options={PERMISSION_AUTH_OPTIONS as { label: string; value: string }[]}
                        onChange={(v) =>
                          updatePermissionField(
                            it.id,
                            'permissionAuth',
                            v as PermissionItem['permissionAuth'],
                          )
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            );
          })}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={addPermission}
          >
            + 添加业务系统
          </Button>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 24px 0' }}>
      <PageHeader
        title="正式环境"
        subTitle="配置正式环境运行基线（真实环境安装 / 资源 / 网络 / 权限），并查看当前处于正式环境的智能体"
        breadcrumb={[
          { path: '/app/environment', breadcrumbName: '环境配置' },
          { path: '', breadcrumbName: '正式环境' },
        ]}
      />

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          marginTop: 16,
          padding: '0 16px',
        }}
      >
        {/* V1.4 顶部不再展示全局生产慎重提示；关键变更的「变更原因」仍由保存弹窗承载 */}

        <Tabs
          activeKey={tabKey}
          onChange={(k) => setTabKey(k as 'config' | 'agents')}
          size="large"
          tabBarStyle={{ marginBottom: 0 }}
          items={[
            {
              key: 'config',
              label: <Text strong>正式环境配置</Text>,
              children: (
                <div style={{ padding: '8px 0 16px' }}>
                  <Card
                    bordered={false}
                    styles={{ body: { padding: '4px 0 0' } }}
                    style={{ marginBottom: 16 }}
                  >
                    <Form layout="vertical" size="middle">
                      <Collapse
                        activeKey={activeKeys}
                        onChange={(k) => setActiveKeys(Array.isArray(k) ? k : [k])}
                        items={items}
                        ghost
                        expandIconPosition="end"
                      />
                    </Form>
                  </Card>

                  {/* 底部 sticky 保存/重置栏 */}
                  <div
                    style={{
                      position: 'sticky',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: '#fff',
                      padding: '12px 24px',
                      borderTop: '1px solid #f0f0f0',
                      textAlign: 'right',
                      marginTop: 8,
                      zIndex: 10,
                      boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
                      borderRadius: 8,
                    }}
                  >
                    <Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <InfoCircleOutlined /> 涉及生产变更将影响 {agentCount} 个智能体
                      </Text>
                      <Button type="default" onClick={handleReset}>
                        重置
                      </Button>
                      <Button type="primary" danger onClick={handleSave}>
                        {hasCriticalChange ? '保存配置（需变更原因）' : '保存配置'}
                      </Button>
                    </Space>
                  </div>
                </div>
              ),
            },
            {
              key: 'agents',
              label: <Text strong>正式环境内智能体</Text>,
              children: (
                <div style={{ padding: '8px 0 16px' }}>
                  <Card
                    bordered={false}
                    style={{ marginBottom: 16 }}
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 15 }}>
                          正式环境内智能体
                        </Text>
                        <Tag color="blue">共 {agentCount} 个</Tag>
                      </Space>
                    }
                  >
                    {/* V1.3 §2：纯展示列表，无 rowSelection、无顶部工具栏、无操作入口 */}
                    <Table<ProdAgentItem>
                      rowKey="id"
                      columns={columns}
                      dataSource={agents}
                      scroll={{ x: 1100 }}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (t) => `共 ${t} 条`,
                      }}
                      size="middle"
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default ProductionPage;
