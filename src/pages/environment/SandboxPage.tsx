/**
 * 沙盒环境页 V1.3
 * 对应需求文档：环境配置-需求说明文档V1.3.md §1
 *
 * 路由：/app/environment/sandbox
 * 结构：PageHeader + 内部 Tabs
 *   Tab 1「沙盒环境配置」（默认）：4 个 Collapse 折叠分组（无运行环境管理分组）
 *     1. 虚拟环境安装（Docker / Docker Compose）
 *     2. 运行资源配置（CPU / RAM / Disk，标题后置 Tooltip）
 *     3. 网络资源配置（网络地址前置「虚拟内网」Tag / 端口 tags / 登录认证方式）
 *     4. 虚拟权限配置（标题后置 Tooltip + Form.List 风格的动态多业务系统 Card 列表）
 *   Tab 2「沙盒环境内智能体」：7 列 antd Table，纯展示，无 rowSelection / 无顶部工具栏
 *     晋级入口：智能体名称列对「已审核·准入 且 满足晋级门槛」的智能体旁加「可晋级」徽标，点击打开晋级弹窗
 *
 * 关键交互：
 *   - 保存：validateEnvRequired 校验 → Modal.confirm 提示影响范围 N 个智能体 → message.success
 *   - 重置：Modal.confirm 二次确认 → 恢复 config
 *   - 晋升级：点击「可晋级」徽标 → setPromoTarget + setPromoOpen → PromotionModal
 */
import { useState } from 'react';
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
import { QuestionCircleOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import {
  defaultSandboxConfig,
  mockSandboxAgents,
  DEFAULT_PROMOTION_RULE,
  HOSPITAL_SYSTEM_OPTIONS,
  DATA_SCOPE_OPTIONS,
  OP_PERMISSION_OPTIONS,
  PERMISSION_AUTH_OPTIONS,
  LOGIN_AUTH_OPTIONS,
  evalStatusColor,
  makeEmptyPermissionItem,
  hasDuplicateHospitalSystem,
  checkPromotion,
  type SandboxEnvConfig,
  type SandboxAgentItem,
  type PermissionItem,
} from '../../mock/environment';
import { validateEnvRequired } from './envConfigValidator';
import { PromotionModal } from './EnvironmentModals';

const { Text } = Typography;

const ALL_GROUP_KEYS: string[] = ['install', 'resource', 'network', 'permission'];

const SandboxPage = () => {
  // 已保存值（用于「重置」恢复）
  const [config, setConfig] = useState<SandboxEnvConfig>(defaultSandboxConfig);
  // 表单临时编辑值（仅在「保存」时回写 config）
  const [draft, setDraft] = useState<SandboxEnvConfig>(defaultSandboxConfig);

  const [activeKeys, setActiveKeys] = useState<string[]>(ALL_GROUP_KEYS);
  const [tabKey, setTabKey] = useState<'config' | 'agents'>('config');

  const [agents] = useState<SandboxAgentItem[]>(mockSandboxAgents);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoTarget, setPromoTarget] = useState<SandboxAgentItem | null>(null);

  const navigate = useNavigate();

  // 当前环境内智能体数量（保存确认弹窗的影响范围提示）
  const agentCount = agents.length;

  // ============== 通用更新工具 ==============
  const updateInstall = (patch: Partial<SandboxEnvConfig['install']>) => {
    setDraft((prev) => ({ ...prev, install: { ...prev.install, ...patch } }));
  };
  const updateResource = (patch: Partial<SandboxEnvConfig['resource']>) => {
    setDraft((prev) => ({ ...prev, resource: { ...prev.resource, ...patch } }));
  };
  const updateNetwork = (patch: Partial<SandboxEnvConfig['network']>) => {
    setDraft((prev) => ({ ...prev, network: { ...prev.network, ...patch } }));
  };

  // ============== 权限列表（Form.List 风格动态管理） ==============
  const updatePermissionItem = <K extends keyof PermissionItem>(
    index: number,
    key: K,
    value: PermissionItem[K],
  ) => {
    setDraft((prev) => {
      const next = [...prev.permission];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, permission: next };
    });
  };

  const handleAddPermission = () => {
    // 校验：已有系统全部填了 hospitalSystem 才允许新增
    const allFilled = draft.permission.every((it) => !!it.hospitalSystem);
    if (!allFilled) {
      message.warning('请先将已有业务系统的「医院业务系统」填写完成');
      return;
    }
    // 已用完所有系统：禁用
    const used = new Set(draft.permission.map((it) => it.hospitalSystem).filter(Boolean));
    if (used.size >= HOSPITAL_SYSTEM_OPTIONS.length) {
      message.warning('已配置全部可选业务系统，无需再添加');
      return;
    }
    setDraft((prev) => ({ ...prev, permission: [...prev.permission, makeEmptyPermissionItem()] }));
  };

  const handleRemovePermission = (index: number) => {
    if (draft.permission.length <= 1) {
      message.warning('至少保留 1 条业务系统权限');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      permission: prev.permission.filter((_, i) => i !== index),
    }));
  };

  // ============== 保存 / 重置 ==============
  const handleSave = () => {
    const err = validateEnvRequired(draft);
    if (err) {
      message.error(err);
      return;
    }
    if (hasDuplicateHospitalSystem(draft.permission)) {
      message.error('医院业务系统存在重复，请修改');
      return;
    }

    Modal.confirm({
      title: '确认保存沙盒环境配置？',
      content: (
        <div>
          <Text>
            本次保存将对当前沙盒环境内{' '}
            <Text strong style={{ color: '#1677FF' }}>{agentCount}</Text>{' '}
            个智能体生效；对当前及后续载入沙盒环境的智能体均生效；操作归档审计中心。
          </Text>
        </div>
      ),
      okText: '确认保存',
      cancelText: '取消',
      onOk: () => {
        setConfig(draft);
        message.success('沙盒环境配置已保存，操作归档审计中心');
      },
    });
  };

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

  // ============== 智能体晋升级交互 ==============
  // V1.3：列表无 rowSelection / 无工具栏；晋级入口改在「可晋级」徽标
  const handleOpenPromotion = (record: SandboxAgentItem) => {
    setPromoTarget(record);
    setPromoOpen(true);
  };

  // 是否满足晋级门槛（用于「可晋级」徽标）
  const isPromotable = (record: SandboxAgentItem) => {
    return checkPromotion(record, DEFAULT_PROMOTION_RULE).pass;
  };

  // ============== 智能体表格列（V1.3 §1：7 列，无操作列） ==============
  const columns: ColumnsType<SandboxAgentItem> = [
    {
      title: '智能体名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      fixed: 'left',
      render: (name: string, record) => {
        const promotable = isPromotable(record);
        return (
          <Space direction="vertical" size={0}>
            <Space size={8} align="center" wrap>
              <Typography.Link
                onClick={() => navigate(`/app/ledger/detail/${record.id}`)}
              >
                {name}
              </Typography.Link>
              {promotable && (
                <Tooltip title="点击晋级正式环境">
                  <Tag
                    color="success"
                    icon={<ArrowUpOutlined />}
                    style={{ marginLeft: 0, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPromotion(record);
                    }}
                  >
                    可晋级
                  </Tag>
                </Tooltip>
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {record.id}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 110,
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 180,
      ellipsis: true,
    },
    {
      title: '归属科室',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (d: string) => <Tag color="blue">{d}</Tag>,
    },
    {
      title: '评测状态',
      dataIndex: 'evalStatus',
      key: 'evalStatus',
      width: 130,
      render: (s: SandboxAgentItem['evalStatus']) => (
        <Tag color={evalStatusColor[s]}>{s}</Tag>
      ),
    },
    {
      title: '评测得分',
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 110,
      render: (v?: number) =>
        v != null ? (
          <Text
            strong
            style={{
              color: v >= 80 ? '#52C41A' : v >= 60 ? '#FA8C16' : '#FF4D4F',
            }}
          >
            {v.toFixed(1)}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '部署时间',
      dataIndex: 'loadedAt',
      key: 'loadedAt',
      width: 170,
      sorter: (a, b) => (a.loadedAt > b.loadedAt ? 1 : a.loadedAt < b.loadedAt ? -1 : 0),
      defaultSortOrder: 'descend',
      render: (t: string) => <Text style={{ fontFamily: 'monospace' }}>{t}</Text>,
    },
  ];

  // ============== 4 个 Collapse 分组 ==============
  const items = [
    // ===== 1. 虚拟环境安装 =====
    {
      key: 'install',
      label: <Text strong>1. 虚拟环境安装</Text>,
      children: (
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Form.Item label="Docker 版本" required>
              <Input
                value={draft.install.dockerVersion}
                placeholder="如：Docker 26.1.4 及以上"
                onChange={(e) => updateInstall({ dockerVersion: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Docker Compose 版本" required>
              <Input
                value={draft.install.dockerComposeVersion}
                placeholder="如：Docker Compose 2.27.1 及以上"
                onChange={(e) =>
                  updateInstall({ dockerComposeVersion: e.target.value })
                }
              />
            </Form.Item>
          </Col>
        </Row>
      ),
    },

    // ===== 2. 运行资源配置（标题后置 Tooltip） =====
    {
      key: 'resource',
      label: (
        <Space>
          <Text strong>2. 运行资源配置</Text>
          <Tooltip title="根据智能体注册信息中填写的资源需求进行配置。">
            <QuestionCircleOutlined style={{ color: '#8C8C8C', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      children: (
        <Row gutter={[16, 12]}>
          <Col span={8}>
            <Form.Item label="CPU" required>
              <InputNumber
                min={1}
                addonAfter="Core"
                style={{ width: '100%' }}
                value={draft.resource.cpu}
                onChange={(v) => updateResource({ cpu: v ?? 0 })}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="RAM 内存" required>
              <InputNumber
                min={1}
                addonAfter="GB"
                style={{ width: '100%' }}
                value={draft.resource.ram}
                onChange={(v) => updateResource({ ram: v ?? 0 })}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Disk 磁盘" required>
              <InputNumber
                min={1}
                addonAfter="GB"
                style={{ width: '100%' }}
                value={draft.resource.disk}
                onChange={(v) => updateResource({ disk: v ?? 0 })}
              />
            </Form.Item>
          </Col>
        </Row>
      ),
    },

    // ===== 3. 网络资源配置 =====
    {
      key: 'network',
      label: <Text strong>3. 网络资源配置</Text>,
      children: (
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Form.Item label="网络地址" required>
              <Input
                addonBefore={
                  <Tag color="blue" style={{ margin: 0 }}>
                    虚拟内网
                  </Tag>
                }
                value={draft.network.ipAddress}
                placeholder="http://127.0.0.1"
                onChange={(e) => updateNetwork({ ipAddress: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="端口分配" required>
              <Select
                mode="tags"
                value={draft.network.ports}
                placeholder="回车添加端口，如 80 / 443 / 8080"
                onChange={(v) => updateNetwork({ ports: v as string[] })}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="登录认证方式" required>
              <Select
                value={draft.network.loginAuth}
                options={
                  LOGIN_AUTH_OPTIONS as unknown as { label: string; value: string }[]
                }
                onChange={(v) => updateNetwork({ loginAuth: v })}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>
      ),
    },

    // ===== 4. 虚拟权限配置（V1.3：标题后置 Tooltip + 内部 Alert 保留） =====
    {
      key: 'permission',
      label: (
        <Space>
          <Text strong>4. 虚拟权限配置</Text>
          <Tooltip
            title="根据权限审批结果配置虚拟权限；支持配置多个业务系统，每个系统独立配置数据授权范围、操作权限类型、权限接口地址与认证方式（不同业务系统的接口地址、操作权限与数据范围权限各不相同）。"
          >
            <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      children: (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="根据权限审批结果配置虚拟权限；支持配置多个业务系统，每个系统独立配置数据授权范围、操作权限类型、权限接口地址与认证方式（不同业务系统的接口地址、操作权限与数据范围权限各不相同）。"
          />
          {/* 多业务系统 Card 列表 */}
          {draft.permission.map((item, index) => {
            // 已被其它条目占用的系统，disabled
            const hospitalSystemOptions = HOSPITAL_SYSTEM_OPTIONS.map((opt) => ({
              ...opt,
              disabled:
                opt.value !== item.hospitalSystem &&
                draft.permission.some(
                  (p, i) => i !== index && p.hospitalSystem === opt.value,
                ),
            }));
            const isLast = draft.permission.length <= 1;
            return (
              <Card
                key={item.id}
                size="small"
                style={{ marginBottom: 12 }}
                title={
                  <Text strong style={{ fontSize: 13 }}>
                    业务系统 #{index + 1}
                  </Text>
                }
                extra={
                  <Button
                    type="link"
                    danger
                    size="small"
                    disabled={isLast}
                    onClick={() => handleRemovePermission(index)}
                  >
                    删除
                  </Button>
                }
              >
                <Row gutter={[16, 12]}>
                  <Col span={8}>
                    <Form.Item
                      label="医院业务系统"
                      required
                      style={{ marginBottom: 12 }}
                    >
                      <Select
                        value={item.hospitalSystem || undefined}
                        options={
                          hospitalSystemOptions as unknown as {
                            label: string;
                            value: string;
                          }[]
                        }
                        onChange={(v) =>
                          updatePermissionItem(index, 'hospitalSystem', v)
                        }
                        style={{ width: '100%' }}
                        placeholder="请选择医院业务系统"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="数据授权范围"
                      required
                      style={{ marginBottom: 12 }}
                    >
                      <Select
                        value={item.dataScope || undefined}
                        options={
                          DATA_SCOPE_OPTIONS as unknown as {
                            label: string;
                            value: string;
                          }[]
                        }
                        onChange={(v) =>
                          updatePermissionItem(index, 'dataScope', v)
                        }
                        style={{ width: '100%' }}
                        placeholder="请选择数据授权范围"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="操作权限类型"
                      required
                      style={{ marginBottom: 12 }}
                    >
                      <Select
                        value={item.opPermission || undefined}
                        options={
                          OP_PERMISSION_OPTIONS as unknown as {
                            label: string;
                            value: string;
                          }[]
                        }
                        onChange={(v) =>
                          updatePermissionItem(index, 'opPermission', v)
                        }
                        style={{ width: '100%' }}
                        placeholder="请选择操作权限类型"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item
                      label="权限接口地址"
                      required
                      style={{ marginBottom: 12 }}
                    >
                      <Input
                        value={item.permissionUrl}
                        placeholder="如：https://sandbox.med-agent.internal/api/v1/emr/permission"
                        onChange={(e) =>
                          updatePermissionItem(
                            index,
                            'permissionUrl',
                            e.target.value,
                          )
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="权限认证方式"
                      required
                      style={{ marginBottom: 12 }}
                    >
                      <Select
                        value={item.permissionAuth}
                        options={
                          PERMISSION_AUTH_OPTIONS as unknown as {
                            label: string;
                            value: string;
                          }[]
                        }
                        onChange={(v) =>
                          updatePermissionItem(index, 'permissionAuth', v)
                        }
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            );
          })}

          {/* 底部添加按钮：全部用完时 disabled，并显示已用/总数计数 */}
          <Space style={{ width: '100%' }} direction="vertical" size={4}>
            <Button
              type="dashed"
              block
              disabled={
                draft.permission.length >= HOSPITAL_SYSTEM_OPTIONS.length
              }
              onClick={handleAddPermission}
            >
              + 添加业务系统
            </Button>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right', display: 'block' }}>
              已配置 {draft.permission.length} / {HOSPITAL_SYSTEM_OPTIONS.length} 个业务系统
            </Text>
          </Space>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 24px 0' }}>
      <PageHeader
        title="沙盒环境"
        breadcrumb={[
          { path: '/app/environment/sandbox', breadcrumbName: '环境配置' },
          { path: '', breadcrumbName: '沙盒环境' },
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
        <Tabs
          activeKey={tabKey}
          onChange={(k) => setTabKey(k as 'config' | 'agents')}
          size="large"
          tabBarStyle={{ marginBottom: 0 }}
          items={[
            {
              key: 'config',
              label: <Text strong>沙盒环境配置</Text>,
              children: (
                <div style={{ padding: '16px 0' }}>
                  <Form layout="vertical" size="middle">
                    <Collapse
                      activeKey={activeKeys}
                      onChange={(k) =>
                        setActiveKeys(Array.isArray(k) ? k : [k])
                      }
                      items={items}
                      ghost
                      expandIconPosition="end"
                    />
                  </Form>

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
                      <Button type="default" onClick={handleReset}>
                        重置
                      </Button>
                      <Button type="primary" onClick={handleSave}>
                        保存
                      </Button>
                    </Space>
                  </div>
                </div>
              ),
            },
            {
              key: 'agents',
              label: <Text strong>沙盒环境内智能体</Text>,
              children: (
                <div style={{ padding: '16px 0' }}>
                  <Card bordered={false}>
                    <div
                      style={{
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Space>
                        <Text strong style={{ fontSize: 15 }}>
                          沙盒环境内智能体
                        </Text>
                        <Tag color="blue">共 {agentCount} 个</Tag>
                      </Space>
                    </div>

                    <Table<SandboxAgentItem>
                      rowKey="id"
                      columns={columns}
                      dataSource={agents}
                      scroll={{ x: 1200 }}
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

      {/* 晋级弹窗 */}
      <PromotionModal
        open={promoOpen}
        agent={promoTarget}
        rule={DEFAULT_PROMOTION_RULE}
        onClose={() => {
          setPromoOpen(false);
          setPromoTarget(null);
        }}
        onConfirm={(agent, note) => {
          message.success(
            `${agent.name} 已晋级到正式环境${
              note
                ? `（备注：${note.slice(0, 20)}${note.length > 20 ? '...' : ''}）`
                : ''
            }`,
          );
          setPromoOpen(false);
          setPromoTarget(null);
        }}
      />
    </div>
  );
};

export default SandboxPage;
