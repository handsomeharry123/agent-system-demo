import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Tag,
  Space,
  Button,
  Table,
  Typography,
  Empty,
  Row,
  Col,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  LinkOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  StopOutlined,
} from '@ant-design/icons';
import {
  currentUser,
  ENUMS,
  type LedgerAgent,
  type DataAuthorization,
  type SystemInterfaceAuthorization,
  type AuthorizationStatus,
} from '../../../mock/ledger';

const { Text } = Typography;

// ============== 单元格 / 标签辅助 ==============

// 数据域 / 业务系统 Tag 配色
const dataDomainColor: Record<string, string> = {
  医生数据: 'blue',
  患者数据: 'purple',
  科室数据: 'cyan',
};
const systemColor: Record<string, string> = {
  HIS: 'blue',
  LIS: 'cyan',
  PACS: 'purple',
  EMR: 'green',
};

const authStatusMeta: Record<
  AuthorizationStatus,
  { text: string; color: string; icon: React.ReactNode }
> = {
  authorized: { text: '已授权', color: 'success', icon: <CheckCircleFilled /> },
  expiring: { text: '即将到期', color: 'warning', icon: <ClockCircleFilled /> },
  unauthorized: { text: '未授权', color: 'default', icon: <CloseCircleFilled /> },
  revoked: { text: '已拒绝或已撤销', color: 'error', icon: <StopOutlined /> },
};

const computeAuthStatus = (expireTime: string): AuthorizationStatus => {
  const today = new Date('2026-06-09');
  const exp = new Date(expireTime);
  if (exp < today) return 'revoked';
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  if (exp <= horizon) return 'expiring';
  return 'authorized';
};

const formatDate = (d: any) => (d ? d.format('YYYY-MM-DD') : '');

interface Props {
  agent: LedgerAgent;
  onJumpAudit?: () => void;
}

/**
 * 权限 Tab —— 详情页「就近配置」入口
 * - 自身会话数据：默认放开（只读）
 * - 院内数据授权：医生/患者/科室 三个数据域
 * - 系统接口权限：HIS/LIS/PACS/EMR 四个业务系统
 * - 最近 10 条权限变更：跳转审计中心
 */
const PermissionTab: React.FC<Props> = ({ agent, onJumpAudit }) => {
  const navigate = useNavigate();
  const isPlatformAdmin = currentUser.role === 'platform_admin';

  // 跳转审计中心（带智能体筛选）
  const jumpAudit = (dimension?: string) => {
    const qs = new URLSearchParams();
    qs.set('agentId', agent.id);
    if (dimension) qs.set('dimension', dimension);
    navigate(`/app/audit?${qs.toString()}`);
  };

  // 本地副本（演示编辑）
  const [dataAuth, setDataAuth] = useState<DataAuthorization[]>(agent.permissions.dataAuthorizations);
  const [systemAuth, setSystemAuth] = useState<SystemInterfaceAuthorization[]>(
    agent.permissions.systemAuthorizations,
  );
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [systemModalOpen, setSystemModalOpen] = useState(false);
  const [editing, setEditing] = useState<DataAuthorization | SystemInterfaceAuthorization | null>(
    null,
  );
  const [dataForm] = Form.useForm();
  const [systemForm] = Form.useForm();

  // 自身会话数据：始终授权（不可关闭）
  // 计算即将到期
  const expiringDataCount = useMemo(
    () => dataAuth.filter((d) => computeAuthStatus(d.expireTime) === 'expiring').length,
    [dataAuth],
  );
  const expiringSystemCount = useMemo(
    () => systemAuth.filter((s) => computeAuthStatus(s.expireTime) === 'expiring').length,
    [systemAuth],
  );

  // === 申请 / 编辑 数据访问授权 ===
  const openAddData = () => {
    setEditing(null);
    dataForm.resetFields();
    setDataModalOpen(true);
  };
  const openEditData = (rec: DataAuthorization) => {
    setEditing(rec);
    dataForm.setFieldsValue({
      ...rec,
      expireTime: rec.expireTime,
    });
    setDataModalOpen(true);
  };
  const handleSaveData = async () => {
    try {
      const v = await dataForm.validateFields();
      const payload: DataAuthorization = {
        id: editing ? (editing as DataAuthorization).id : `${agent.id}-D-${Date.now()}`,
        domain: v.domain,
        scope: v.scope,
        grantor: isPlatformAdmin ? currentUser.name : '王志远（信息科）',
        grantTime: editing ? (editing as DataAuthorization).grantTime : '2026-06-09',
        expireTime: v.expireTime,
        status: computeAuthStatus(v.expireTime),
      };
      if (editing) {
        setDataAuth((arr) => arr.map((d) => (d.id === payload.id ? payload : d)));
        message.success('已更新授权');
      } else {
        setDataAuth((arr) => [...arr, payload]);
        message.success('已申请数据授权（演示）');
      }
      setDataModalOpen(false);
    } catch {
      /* 校验失败 */
    }
  };
  const handleDeleteData = (id: string) => {
    setDataAuth((arr) => arr.filter((d) => d.id !== id));
    message.success('已撤销授权');
  };
  const handleExtendData = (rec: DataAuthorization) => {
    const newExpire = new Date(rec.expireTime);
    newExpire.setFullYear(newExpire.getFullYear() + 1);
    const newExpStr = newExpire.toISOString().slice(0, 10);
    setDataAuth((arr) =>
      arr.map((d) =>
        d.id === rec.id
          ? { ...d, expireTime: newExpStr, status: computeAuthStatus(newExpStr) }
          : d,
      ),
    );
    message.success(`已续期至 ${newExpStr}`);
  };

  // === 申请 / 编辑 系统接口授权 ===
  const openAddSystem = () => {
    setEditing(null);
    systemForm.resetFields();
    setSystemModalOpen(true);
  };
  const openEditSystem = (rec: SystemInterfaceAuthorization) => {
    setEditing(rec);
    systemForm.setFieldsValue({ ...rec, expireTime: rec.expireTime });
    setSystemModalOpen(true);
  };
  const handleSaveSystem = async () => {
    try {
      const v = await systemForm.validateFields();
      const payload: SystemInterfaceAuthorization = {
        id: editing ? (editing as SystemInterfaceAuthorization).id : `${agent.id}-S-${Date.now()}`,
        system: v.system,
        interfaceName: v.interfaceName,
        description: v.description,
        grantor: isPlatformAdmin ? currentUser.name : '李建华（信息科）',
        grantTime: editing ? (editing as SystemInterfaceAuthorization).grantTime : '2026-06-09',
        expireTime: v.expireTime,
        status: computeAuthStatus(v.expireTime),
      };
      if (editing) {
        setSystemAuth((arr) => arr.map((s) => (s.id === payload.id ? payload : s)));
        message.success('已更新授权');
      } else {
        setSystemAuth((arr) => [...arr, payload]);
        message.success('已申请系统接口授权（演示）');
      }
      setSystemModalOpen(false);
    } catch {
      /* 校验失败 */
    }
  };
  const handleDeleteSystem = (id: string) => {
    setSystemAuth((arr) => arr.filter((s) => s.id !== id));
    message.success('已撤销接口授权');
  };
  const handleExtendSystem = (rec: SystemInterfaceAuthorization) => {
    const newExpire = new Date(rec.expireTime);
    newExpire.setFullYear(newExpire.getFullYear() + 1);
    const newExpStr = newExpire.toISOString().slice(0, 10);
    setSystemAuth((arr) =>
      arr.map((s) =>
        s.id === rec.id
          ? { ...s, expireTime: newExpStr, status: computeAuthStatus(newExpStr) }
          : s,
      ),
    );
    message.success(`已续期至 ${newExpStr}`);
  };

  // 已授权 / 未授权 业务系统 Tag 概览
  const grantedSystems = ENUMS.businessSystem.filter((s) => systemAuth.some((x) => x.system === s));
  const ungrantedSystems = ENUMS.businessSystem.filter(
    (s) => !systemAuth.some((x) => x.system === s),
  );

  // 数据访问列
  const dataColumns = [
    {
      title: '数据域',
      dataIndex: 'domain',
      key: 'domain',
      width: 110,
      render: (v: string) => <Tag color={dataDomainColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '授权范围',
      dataIndex: 'scope',
      key: 'scope',
      ellipsis: true,
    },
    {
      title: '授权人',
      dataIndex: 'grantor',
      key: 'grantor',
      width: 140,
    },
    {
      title: '授权时间',
      dataIndex: 'grantTime',
      key: 'grantTime',
      width: 110,
    },
    {
      title: '有效期',
      dataIndex: 'expireTime',
      key: 'expireTime',
      width: 110,
      render: (v: string) => {
        const st = computeAuthStatus(v);
        return (
          <Space size={4}>
            <span>{v}</span>
            {st === 'expiring' && <Tag color="warning">即将到期</Tag>}
            {st === 'revoked' && <Tag color="error">已过期</Tag>}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'expireTime',
      key: 'status',
      width: 90,
      render: (v: string) => {
        const st = computeAuthStatus(v);
        const meta = authStatusMeta[st];
        return (
          <Tag color={meta.color} icon={meta.icon}>
            {meta.text}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'op',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, rec: DataAuthorization) =>
        isPlatformAdmin ? (
          <Space size={8} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
            <Button type="link" size="small" onClick={() => openEditData(rec)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleExtendData(rec)}
            >
              续期
            </Button>
            <Popconfirm
              title="确定撤销该数据授权？"
              okText="确定"
              cancelText="取消"
              onConfirm={() => handleDeleteData(rec.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                撤销
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Text type="secondary">仅平台管理员可编辑</Text>
        ),
    },
  ];

  // 系统接口列
  const systemColumns = [
    {
      title: '业务系统',
      dataIndex: 'system',
      key: 'system',
      width: 110,
      render: (v: string) => <Tag color={systemColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '接口名称',
      dataIndex: 'interfaceName',
      key: 'interfaceName',
      ellipsis: true,
    },
    {
      title: '授权范围',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '授权人',
      dataIndex: 'grantor',
      key: 'grantor',
      width: 140,
    },
    {
      title: '授权时间',
      dataIndex: 'grantTime',
      key: 'grantTime',
      width: 110,
    },
    {
      title: '有效期',
      dataIndex: 'expireTime',
      key: 'expireTime',
      width: 110,
      render: (v: string) => {
        const st = computeAuthStatus(v);
        return (
          <Space size={4}>
            <span>{v}</span>
            {st === 'expiring' && <Tag color="warning">即将到期</Tag>}
            {st === 'revoked' && <Tag color="error">已过期</Tag>}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'expireTime',
      key: 'status',
      width: 90,
      render: (v: string) => {
        const st = computeAuthStatus(v);
        const meta = authStatusMeta[st];
        return (
          <Tag color={meta.color} icon={meta.icon}>
            {meta.text}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'op',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, rec: SystemInterfaceAuthorization) =>
        isPlatformAdmin ? (
          <Space size={8} split={<span style={{ color: '#D9D9D9' }}>|</span>}>
            <Button type="link" size="small" onClick={() => openEditSystem(rec)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleExtendSystem(rec)}
            >
              续期
            </Button>
            <Popconfirm
              title="确定撤销该接口授权？"
              okText="确定"
              cancelText="取消"
              onConfirm={() => handleDeleteSystem(rec.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                撤销
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Text type="secondary">仅平台管理员可编辑</Text>
        ),
    },
  ];

  return (
    <div>
      {/* 自身会话数据 - 默认放开，不可关闭 */}
      <Card
        bordered={false}
        size="small"
        title={<span style={{ fontSize: 14, fontWeight: 600 }}>自身会话数据</span>}
        style={{ marginBottom: 12 }}
      >
        <Space size={12}>
          <Tag color="success" icon={<CheckCircleFilled />}>
            已授权
          </Tag>
          <Text>
            智能体默认享有自身运行全流程产生的人机交互数据访问权限，可正常调取、流转、复盘自身会话交互记录
          </Text>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ⓘ 自身会话数据默认放开（不可关闭）；如需关闭请联系平台管理员并提供书面说明
          </Text>
        </div>
      </Card>

      {/* 数据访问权限 */}
      <Card
        bordered={false}
        size="small"
        title={
          <Space size={8}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>数据访问权限</span>
            {expiringDataCount > 0 && (
              <Tag color="warning" icon={<ClockCircleFilled />}>
                {expiringDataCount} 项即将到期
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              type="link"
              icon={<LinkOutlined />}
              onClick={() => jumpAudit('数据访问权限')}
            >
              数据访问操作审计
            </Button>
            {isPlatformAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddData}>
                申请数据授权
              </Button>
            )}
          </Space>
        }
        style={{ marginBottom: 12 }}
      >
        {dataAuth.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            dataSource={dataAuth}
            columns={dataColumns}
            pagination={false}
            scroll={{ x: 850 }}
          />
        ) : (
          <Empty description="暂无数据访问授权" />
        )}
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ⓘ 数据访问权限默认拒绝院内数据（医生/患者/科室），需逐项申请授权
          </Text>
        </div>
      </Card>

      {/* 系统接口权限 */}
      <Card
        bordered={false}
        size="small"
        title={
          <Space size={8}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>系统接口权限</span>
            {expiringSystemCount > 0 && (
              <Tag color="warning" icon={<ClockCircleFilled />}>
                {expiringSystemCount} 项即将到期
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              type="link"
              icon={<LinkOutlined />}
              onClick={() => jumpAudit('系统接口权限')}
            >
              系统接口操作审计
            </Button>
            {isPlatformAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddSystem}>
                申请接口授权
              </Button>
            )}
          </Space>
        }
        style={{ marginBottom: 12 }}
      >
        {/* 业务系统概览：Tag 组 */}
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
            已授权业务系统：
          </Text>
          <Space size={4} wrap>
            {grantedSystems.map((s) => (
              <Tag key={s} color={systemColor[s]} icon={<CheckCircleFilled />}>
                {s}
              </Tag>
            ))}
            {ungrantedSystems.map((s) => (
              <Tag key={s} color="default" style={{ opacity: 0.55 }}>
                {s}
              </Tag>
            ))}
            {grantedSystems.length === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                尚未授权任何业务系统
              </Text>
            )}
          </Space>
        </div>
        {systemAuth.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            dataSource={systemAuth}
            columns={systemColumns}
            pagination={false}
            scroll={{ x: 1000 }}
          />
        ) : (
          <Empty description="暂无系统接口授权" />
        )}
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ⓘ 系统接口权限默认拒绝 HIS / LIS / PACS / EMR，逐项申请授权；如发现越权访问事件，监控中心事件详情可回跳此处修正
          </Text>
        </div>
      </Card>

      {/* 最近 10 条权限变更（V1.3 4-4 快捷视图）*/}
      <Card
        bordered={false}
        size="small"
        title={
          <Space size={8}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>最近权限变更</span>
            <Tag color="default">仅展示最近 10 条</Tag>
          </Space>
        }
        extra={
          <Button type="link" icon={<LinkOutlined />} onClick={() => jumpAudit('权限变更')}>
            查看全部变更
          </Button>
        }
      >
        {agent.permissions.recentChanges.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            dataSource={agent.permissions.recentChanges}
            pagination={false}
            columns={[
              { title: '变更时间', dataIndex: 'time', key: 'time', width: 150 },
              {
                title: '权限维度',
                dataIndex: 'dimension',
                key: 'dimension',
                width: 130,
                render: (v: string) => <Tag>{v}</Tag>,
              },
              {
                title: '变更类型',
                dataIndex: 'changeType',
                key: 'changeType',
                width: 90,
                render: (v: string) => {
                  const colorMap: Record<string, string> = {
                    新增: 'green',
                    撤销: 'red',
                    续期: 'blue',
                    到期: 'default',
                  };
                  return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
                },
              },
              {
                title: '变更前 → 变更后',
                key: 'diff',
                render: (_: any, rec: any) => (
                  <span style={{ fontSize: 12, color: '#595959' }}>
                    <span style={{ color: '#8C8C8C' }}>{rec.before}</span>
                    <span style={{ margin: '0 6px', color: '#BFBFBF' }}>→</span>
                    <span>{rec.after}</span>
                  </span>
                ),
              },
              { title: '操作人', dataIndex: 'operator', key: 'operator', width: 140 },
            ]}
          />
        ) : (
          <Empty description="暂无权限变更记录" />
        )}
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ⓘ 完整权限变更日志由「审计中心」统一承接，本视图仅做最近 10 条快捷预览
          </Text>
        </div>
      </Card>

      {/* 申请 / 编辑数据授权弹窗 */}
      <Modal
        title={editing ? '编辑数据访问授权' : '申请数据访问授权'}
        open={dataModalOpen}
        onCancel={() => setDataModalOpen(false)}
        onOk={handleSaveData}
        okText="提交申请"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={dataForm} layout="vertical">
          <Form.Item
            label="数据域"
            name="domain"
            rules={[{ required: true, message: '请选择数据域' }]}
          >
            <Select
              placeholder="请选择数据域"
              options={ENUMS.dataDomain.map((v) => ({ label: v, value: v }))}
            />
          </Form.Item>
          <Form.Item
            label="授权范围"
            name="scope"
            rules={[{ required: true, message: '请输入授权范围' }]}
          >
            <Input placeholder="例：本科室医生诊疗数据 / 科室聚合统计（脱敏）" />
          </Form.Item>
          <Form.Item
            label="有效期至"
            name="expireTime"
            rules={[{ required: true, message: '请选择有效期' }]}
            getValueProps={(v) => ({ value: v })}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="选择有效期"
              onChange={(_d, ds: string) =>
                dataForm.setFieldValue('expireTime', ds)
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 申请 / 编辑系统接口授权弹窗 */}
      <Modal
        title={editing ? '编辑系统接口授权' : '申请系统接口授权'}
        open={systemModalOpen}
        onCancel={() => setSystemModalOpen(false)}
        onOk={handleSaveSystem}
        okText="提交申请"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={systemForm} layout="vertical">
          <Form.Item
            label="业务系统"
            name="system"
            rules={[{ required: true, message: '请选择业务系统' }]}
          >
            <Select
              placeholder="请选择业务系统"
              options={ENUMS.businessSystem.map((v) => ({ label: v, value: v }))}
            />
          </Form.Item>
          <Form.Item
            label="接口名称"
            name="interfaceName"
            rules={[{ required: true, message: '请输入接口名称' }]}
          >
            <Input placeholder="例：病历查询 / 处方读取 / 影像调阅" />
          </Form.Item>
          <Form.Item
            label="授权范围 / 接口说明"
            name="description"
            rules={[{ required: true, message: '请输入授权范围 / 接口说明' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="例：本科室病历查询（只读）/ 全院处方读取（脱敏）"
            />
          </Form.Item>
          <Form.Item
            label="有效期至"
            name="expireTime"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="选择有效期"
              onChange={(_d, ds: string) =>
                systemForm.setFieldValue('expireTime', ds)
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionTab;
