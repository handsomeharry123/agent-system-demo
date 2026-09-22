import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Form, Input, Modal, Radio, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { UserRole } from '../../types/user';
import { departmentOptions } from '../../mock/departments';
import { useAccessRecords } from '../agent-center/store';
import { roleColorMap } from './constants';

const { TextArea } = Input;
type RoleStatus = '启用' | '停用';
type DataRange = '全院智能体' | '本科室智能体' | '指定科室智能体' | '指定智能体';

interface RoleItem {
  id: string;
  name: UserRole | string;
  description: string;
  userCount: number;
  dataRange: DataRange;
  functionCount: number;
  status: RoleStatus;
  createdAt: string;
  updatedAt: string;
}

const roleSeed: RoleItem[] = [
  {
    id: 'leader', name: '医院领导', userCount: 6, dataRange: '全院智能体', functionCount: 8, status: '启用',
    description: '拥有全局数据查看权限，通常只读，不参与具体配置与用户管理',
    createdAt: '2026-01-02 09:00:00', updatedAt: '2026-07-18 14:20:00',
  },
  {
    id: 'it-admin', name: '信息科管理员', userCount: 12, dataRange: '全院智能体', functionCount: 76, status: '启用',
    description: '拥有平台全部功能与数据权限，可管理所有模块、用户与权限配置',
    createdAt: '2026-01-02 09:00:00', updatedAt: '2026-07-22 10:08:00',
  },
  {
    id: 'dept-admin', name: '科室管理员', userCount: 28, dataRange: '本科室智能体', functionCount: 43, status: '启用',
    description: '负责本科室智能体的接入申请与日常管理',
    createdAt: '2026-01-02 09:00:00', updatedAt: '2026-07-20 16:36:00',
  },
];

const dataRangeDetail: Record<DataRange, string[]> = {
  全院智能体: ['心电图智能辅助诊断系统', '胸部 CT 影像智能分析平台', '处方智能审核系统', '全院其余已纳管智能体'],
  本科室智能体: ['用户所属科室内全部已纳管智能体'],
  指定科室智能体: ['心内科智能体', '影像科智能体'],
  指定智能体: ['心电图智能辅助诊断系统'],
};

const RoleManage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [roles, setRoles] = useState(roleSeed);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const detail = id ? roles.find((role) => role.id === id) : undefined;
  const isCreate = id === 'new';

  const saveRole = async () => {
    const values = await form.validateFields();
    if (isCreate) {
      message.success('角色创建成功，请继续分配功能权限');
      navigate(`/app/user-center/function-permission?role=${encodeURIComponent(values.name)}`);
      return;
    }
    if (editing) {
      setRoles((current) => current.map((role) => role.id === editing.id
        ? { ...role, ...values, updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-') }
        : role));
      message.success('角色信息已更新');
      setEditing(null);
    }
  };

  if (isCreate) {
    return (
      <div className="user-center-page">
        <PageHeader title="新增角色" showBack onBack={() => navigate(-1)} subTitle="创建角色并设置其数据权限范围" />
        <Card bordered={false}>
          <RoleForm form={form} />
          <Space><Button onClick={() => navigate(-1)}>取消</Button><Button type="primary" onClick={saveRole}>创建并分配功能权限</Button></Space>
        </Card>
      </div>
    );
  }

  if (detail) {
    return (
      <div className="user-center-page">
        <PageHeader title="角色详情" showBack onBack={() => navigate(-1)} extra={<Button type="primary" onClick={() => setEditing(detail)}>编辑</Button>} />
        <Card bordered={false}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="角色名称">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={detail.status === '启用' ? 'success' : 'default'}>{detail.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="角色描述" span={2}>{detail.description}</Descriptions.Item>
            <Descriptions.Item label="关联用户数">{detail.userCount} 人</Descriptions.Item>
            <Descriptions.Item label="关联功能权限范围">{detail.functionCount} 项</Descriptions.Item>
            <Descriptions.Item label="关联数据权限范围" span={2}>
              <Space wrap><Tag color="blue">{detail.dataRange}</Tag>{dataRangeDetail[detail.dataRange].map((item) => <Tag key={item}>{item}</Tag>)}</Space>
            </Descriptions.Item>
            <Descriptions.Item label="拥有的功能权限" span={2}>
              首页、医小管、统一台账中心、统一运行监控中心等，共 {detail.functionCount} 项
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{detail.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{detail.updatedAt}</Descriptions.Item>
          </Descriptions>
          <Button style={{ marginTop: 24 }} onClick={() => navigate(-1)}>返回</Button>
        </Card>
        <Modal title="编辑角色" open={!!editing} onCancel={() => setEditing(null)} onOk={saveRole} okText="保存" cancelText="取消">
          <RoleForm form={form} initial={editing || undefined} />
        </Modal>
      </div>
    );
  }

  const columns: ColumnsType<RoleItem> = [
    {
      title: '角色名称', dataIndex: 'name', width: 150,
      render: (name: UserRole, record) => <a onClick={() => navigate(`/app/user-center/roles/${record.id}`)}><Tag color={roleColorMap[name] || 'blue'}>{name}</Tag></a>,
    },
    { title: '角色描述', dataIndex: 'description', ellipsis: true, width: 300 },
    { title: '关联用户数', dataIndex: 'userCount', width: 110, render: (value) => `${value} 人` },
    { title: '关联数据权限范围', dataIndex: 'dataRange', width: 160 },
    { title: '关联功能权限范围', dataIndex: 'functionCount', width: 160, render: (value) => `${value} 项权限` },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: RoleStatus) => <Tag color={value === '启用' ? 'success' : 'default'}>{value}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 170 },
    {
      title: '操作', fixed: 'right', width: 220,
      render: (_, record) => (
        <Space size={2}>
          <Button type="link" size="small" onClick={() => navigate(`/app/user-center/roles/${record.id}`)}>查看详情</Button>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); }}>编辑</Button>
          <Button type="link" size="small" danger={record.status === '启用'} onClick={() => {
            setRoles((current) => current.map((role) => role.id === record.id ? { ...role, status: role.status === '启用' ? '停用' : '启用' } : role));
            message.success(record.status === '启用' ? '角色已停用' : '角色已恢复使用');
          }}>{record.status === '启用' ? '停用' : '恢复使用'}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-center-page">
      <PageHeader title="角色管理" subTitle="配置平台角色的数据范围与功能权限" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/user-center/roles/new')}>新增角色</Button>} />
      <Card bordered={false}><Table rowKey="id" columns={columns} dataSource={roles} scroll={{ x: 1550 }} pagination={false} /></Card>
      <Modal title="编辑角色" open={!!editing} onCancel={() => setEditing(null)} onOk={saveRole} okText="保存" cancelText="取消">
        <RoleForm form={form} initial={editing || undefined} />
      </Modal>
    </div>
  );
};

const RoleForm = ({ form, initial }: { form: ReturnType<typeof Form.useForm>[0]; initial?: RoleItem }) => {
  const dataRange = Form.useWatch('dataRange', form);
  const accessRecords = useAccessRecords();
  const agentOptions = accessRecords
    .filter((record) => record.ledgerSynced)
    .map((record) => ({
      label: `${record.name}（${record.department}）`,
      value: record.id,
    }));

  return (
    <Form form={form} layout="vertical" initialValues={initial || { status: '启用', dataRange: '本科室智能体' }} preserve={false}>
      <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}><Input placeholder="请输入角色名称" /></Form.Item>
      <Form.Item name="description" label="角色描述" rules={[{ required: true, message: '请输入角色描述' }, { max: 500, message: '角色描述不能超过 500 字' }]}>
        <TextArea rows={4} maxLength={500} showCount placeholder="请输入角色职责及适用范围" />
      </Form.Item>
      <Form.Item name="dataRange" label="数据权限范围" rules={[{ required: true }]}>
        <Radio.Group>
          <Space direction="vertical">
            {(['全院智能体', '本科室智能体', '指定科室智能体', '指定智能体'] as DataRange[]).map((value) => <Radio key={value} value={value}>{value}</Radio>)}
          </Space>
        </Radio.Group>
      </Form.Item>
      {dataRange === '指定科室智能体' && (
        <Form.Item
          name="departments"
          label="选择科室"
          rules={[{ required: true, message: '请至少选择一个科室' }]}
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            placeholder="请选择科室（支持多选）"
            options={departmentOptions}
          />
        </Form.Item>
      )}
      {dataRange === '指定智能体' && (
        <Form.Item
          name="agents"
          label="选择智能体"
          rules={[{ required: true, message: '请至少选择一个智能体' }]}
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            placeholder="请选择智能体（支持多选）"
            options={agentOptions}
          />
        </Form.Item>
      )}
      <Form.Item name="status" label="状态" rules={[{ required: true }]}><Radio.Group options={['启用', '停用']} /></Form.Item>
    </Form>
  );
};

export default RoleManage;
