import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Form, Input, Modal, Radio, Select, Space, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { roleColorMap } from './constants';
import { roleCenterApi, type DataRange, type RoleDetail, type RoleItem, type RolePayload, type RoleStatus } from '../../services/roleCenter';
import RolePermissionScope from './RolePermissionScope';
import { countVisiblePermissions } from './FunctionPermission';

const { TextArea } = Input;

const RoleManage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm<RolePayload>();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [editing, setEditing] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ departments: Array<{ label: string; value: number }>; agents: Array<{ label: string; value: number }> }>({ departments: [], agents: [] });
  const isCreate = id === 'new';

  const loadList = async () => {
    try { setLoading(true); setRoles(await roleCenterApi.list()); }
    catch (error) { message.error(error instanceof Error ? error.message : '角色列表加载失败'); }
    finally { setLoading(false); }
  };
  const loadDetail = async (roleId: string) => {
    try { setLoading(true); setDetail(await roleCenterApi.detail(roleId)); }
    catch (error) { message.error(error instanceof Error ? error.message : '角色详情加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void roleCenterApi.meta().then(setMeta).catch((error) => message.error(error instanceof Error ? error.message : '选项加载失败'));
    if (id && !isCreate) void loadDetail(id); else if (!id) void loadList(); else setLoading(false);
  }, [id]);

  const openEdit = async (role: RoleItem | RoleDetail) => {
    try {
      const value = 'departmentIds' in role ? role : await roleCenterApi.detail(role.id);
      setEditing(value);
      form.setFieldsValue({ name: value.name, description: value.description, dataRange: value.dataRange, departmentIds: value.departmentIds, agentIds: value.agentIds, status: value.status });
    } catch (error) { message.error(error instanceof Error ? error.message : '角色详情加载失败'); }
  };

  const saveRole = async () => {
    const values = await form.validateFields();
    try {
      setSaving(true);
      if (isCreate) {
        const created = await roleCenterApi.create(values);
        message.success('角色创建成功，请继续分配功能权限');
        navigate(`/app/user-center/function-permission?roleId=${created.id}&role=${encodeURIComponent(created.name)}`);
      } else if (editing) {
        await roleCenterApi.update(editing.id, values);
        message.success('角色信息已更新');
        setEditing(null);
        if (id) await loadDetail(id); else await loadList();
      }
    } catch (error) { message.error(error instanceof Error ? error.message : '角色保存失败'); }
    finally { setSaving(false); }
  };

  const removeRole = (role: RoleItem) => {
    Modal.confirm({
      title: `确认删除角色“${role.name}”？`,
      content: '删除后将解除该角色与用户、组织机构及权限的关联，不会删除这些关联对象；关联对象将无法再通过该角色接收消息通知。',
      okText: '删除', cancelText: '取消', okType: 'danger',
      onOk: async () => {
        try {
          const result = await roleCenterApi.remove(role.id);
          message.success(`角色已删除，已解除 ${result.detachedUsers} 个用户关联`);
          await loadList();
        } catch (error) { message.error(error instanceof Error ? error.message : '角色删除失败'); }
      },
    });
  };

  if (isCreate) return <div className="user-center-page">
    <PageHeader title="新增角色" showBack onBack={() => navigate(-1)} subTitle="创建角色并设置其数据权限范围" />
    <Card bordered={false}><RoleForm form={form} meta={meta} /><Space><Button onClick={() => navigate(-1)}>取消</Button><Button type="primary" loading={saving} onClick={() => void saveRole()}>创建并分配功能权限</Button></Space></Card>
  </div>;

  if (id) return <div className="user-center-page">
    <PageHeader title="角色详情" showBack onBack={() => navigate('/app/user-center/roles')} extra={detail && <Button type="primary" onClick={() => void openEdit(detail)}>编辑</Button>} />
    <Card bordered={false}><Spin spinning={loading}>{detail && <>
      <Descriptions bordered column={2} className="role-detail-descriptions">
        <Descriptions.Item label="角色名称">{detail.name}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color={detail.status === '启用' ? 'success' : 'default'}>{detail.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="角色描述" span={2}>{detail.description}</Descriptions.Item>
        <Descriptions.Item label="关联用户数">{detail.userCount} 人</Descriptions.Item>
        <Descriptions.Item label="关联功能权限范围">{countVisiblePermissions(detail.permissionCodes)} 项</Descriptions.Item>
        <Descriptions.Item label="关联数据权限范围" span={2}><Space wrap><Tag color="blue">{detail.dataRange}</Tag>{detail.dataRangeItems.length ? detail.dataRangeItems.map((item) => <Tag key={item}>{item}</Tag>) : <span>按角色动态生效</span>}</Space></Descriptions.Item>
        <Descriptions.Item label="拥有的功能权限" span={2}><RolePermissionScope permissionCodes={detail.permissionCodes || []} /></Descriptions.Item>
        <Descriptions.Item label="创建时间">{detail.createdAt}</Descriptions.Item><Descriptions.Item label="更新时间">{detail.updatedAt}</Descriptions.Item>
      </Descriptions><Button style={{ marginTop: 24 }} onClick={() => navigate('/app/user-center/roles')}>返回</Button>
    </>}</Spin></Card>
    <Modal title="编辑角色" open={!!editing} onCancel={() => setEditing(null)} onOk={() => void saveRole()} confirmLoading={saving} okText="保存" cancelText="取消"><RoleForm form={form} meta={meta} /></Modal>
  </div>;

  const columns: ColumnsType<RoleItem> = [
    { title: '角色名称', dataIndex: 'name', width: 150, render: (name, record) => <a onClick={() => navigate(`/app/user-center/roles/${record.id}`)}><Tag color={roleColorMap[name as keyof typeof roleColorMap] || 'blue'}>{name}</Tag></a> },
    { title: '角色描述', dataIndex: 'description', ellipsis: true, width: 300 },
    { title: '关联用户数', dataIndex: 'userCount', width: 110, render: (value) => `${value} 人` },
    { title: '关联数据权限范围', dataIndex: 'dataRange', width: 160 },
    { title: '关联功能权限范围', dataIndex: 'functionCount', width: 160, render: (_, record) => `${countVisiblePermissions(record.permissionCodes)} 项权限` },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: RoleStatus) => <Tag color={value === '启用' ? 'success' : 'default'}>{value}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 }, { title: '更新时间', dataIndex: 'updatedAt', width: 170 },
    { title: '操作', fixed: 'right', width: 220, render: (_, record) => <Space size={2}>
      <Button type="link" size="small" onClick={() => navigate(`/app/user-center/roles/${record.id}`)}>查看详情</Button>
      <Button type="link" size="small" onClick={() => void openEdit(record)}>编辑</Button>
      <Button type="link" size="small" danger onClick={() => removeRole(record)}>删除</Button>
    </Space> },
  ];
  return <div className="user-center-page">
    <PageHeader title="角色管理" subTitle="配置平台角色的数据范围与功能权限" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/user-center/roles/new')}>新增角色</Button>} />
    <Card bordered={false}><Table rowKey="id" loading={loading} columns={columns} dataSource={roles} scroll={{ x: 1550 }} pagination={false} /></Card>
    <Modal title="编辑角色" open={!!editing} onCancel={() => setEditing(null)} onOk={() => void saveRole()} confirmLoading={saving} okText="保存" cancelText="取消"><RoleForm form={form} meta={meta} /></Modal>
  </div>;
};

const RoleForm = ({ form, meta }: { form: ReturnType<typeof Form.useForm<RolePayload>>[0]; meta: { departments: Array<{ label: string; value: number }>; agents: Array<{ label: string; value: number }> } }) => {
  const dataRange = Form.useWatch('dataRange', form);
  return <Form form={form} layout="vertical" initialValues={{ status: '启用', dataRange: '本科室智能体' }} preserve={false}>
    <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }, { max: 100, message: '角色名称不能超过100字' }]}><Input placeholder="请输入角色名称" /></Form.Item>
    <Form.Item name="description" label="角色描述" rules={[{ required: true, message: '请输入角色描述' }, { max: 500, message: '角色描述不能超过500字' }]}><TextArea rows={4} maxLength={500} showCount placeholder="请输入角色职责及适用范围" /></Form.Item>
    <Form.Item name="dataRange" label="数据权限范围" rules={[{ required: true }]}><Radio.Group><Space direction="vertical">{(['全院智能体', '本科室智能体', '指定科室智能体', '指定智能体'] as DataRange[]).map((value) => <Radio key={value} value={value}>{value}</Radio>)}</Space></Radio.Group></Form.Item>
    {dataRange === '指定科室智能体' && <Form.Item name="departmentIds" label="选择科室" rules={[{ required: true, message: '请至少选择一个科室' }]}><Select mode="multiple" allowClear showSearch optionFilterProp="label" maxTagCount="responsive" placeholder="请选择科室（支持多选）" options={meta.departments} /></Form.Item>}
    {dataRange === '指定智能体' && <Form.Item name="agentIds" label="选择智能体" rules={[{ required: true, message: '请至少选择一个智能体' }]}><Select mode="multiple" allowClear showSearch optionFilterProp="label" maxTagCount="responsive" placeholder={meta.agents.length ? '请选择智能体（支持多选）' : '当前暂无已纳管智能体'} options={meta.agents} /></Form.Item>}
    <Form.Item name="status" label="状态" rules={[{ required: true }]}><Radio.Group options={['启用', '停用']} /></Form.Item>
  </Form>;
};

export default RoleManage;
