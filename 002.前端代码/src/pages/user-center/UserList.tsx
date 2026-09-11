import { useMemo, useState } from 'react';
import { Button, Card, Form, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, EditOutlined, ExportOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { mockUsers } from '../../mock/users';
import type { UserRole } from '../../types/user';
import { roleColorMap, systemRoles } from './constants';

type AccountStatus = '正常' | '停用';

export interface CenterUser {
  id: string;
  name: string;
  employeeId: string;
  password: string;
  department: string;
  phone: string;
  roles: UserRole[];
  dataScope: '全院数据' | '本科室数据';
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string;
}

export const initialCenterUsers: CenterUser[] = mockUsers.slice(0, 12).map((user, index) => {
  const roles: UserRole[] = index === 0 ? ['医院领导'] : user.roles.length ? user.roles : ['科室管理员'];
  return {
    id: user.id,
    name: index === 0 ? '周建国' : user.name,
    employeeId: index === 0 ? 'LD0001' : user.employeeId,
    password: user.password || '123456',
    department: index === 0 ? '院领导' : user.department,
    phone: index === 0 ? '13900001001' : user.phone.replace(/\*/g, String((index + 3) % 10)),
    roles,
    dataScope: roles.some((role) => role !== '科室管理员') ? '全院数据' : '本科室数据',
    status: user.status === '已停用' ? '停用' : '正常',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || '-',
  };
});

const normalizeCenterUsers = (users: Array<CenterUser & { role?: UserRole }>): CenterUser[] =>
  users.map(({ role, ...user }) => ({
    ...user,
    password: user.password || initialCenterUsers.find((initialUser) => initialUser.id === user.id)?.password || '123456',
    roles: user.roles?.length ? user.roles : role ? [role] : ['科室管理员'],
  }));

const UserList = () => {
  const navigate = useNavigate();
  const [filterForm] = Form.useForm();
  const [users, setUsers] = useState<CenterUser[]>(() => {
    const saved = sessionStorage.getItem('user-center-users');
    return saved ? normalizeCenterUsers(JSON.parse(saved)) : initialCenterUsers;
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState<{ department?: string; role?: UserRole; status?: AccountStatus }>({});

  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department))).map((value) => ({ label: value, value })),
    [users],
  );
  const filteredUsers = useMemo(
    () => users.filter((user) =>
      (!filters.department || user.department === filters.department)
      && (!filters.role || user.roles.includes(filters.role))
      && (!filters.status || user.status === filters.status)),
    [filters, users],
  );

  const updateStatus = (ids: React.Key[], status: AccountStatus) => {
    setUsers((current) => {
      const next = current.map((user) => (ids.includes(user.id) ? { ...user, status } : user));
      sessionStorage.setItem('user-center-users', JSON.stringify(next));
      return next;
    });
    setSelectedRowKeys([]);
    message.success(`已${status === '正常' ? '启用' : '停用'} ${ids.length} 个帐号`);
  };

  const confirmBatch = (status: AccountStatus) => {
    const ids = selectedRowKeys.length ? selectedRowKeys : filteredUsers.map((user) => user.id);
    Modal.confirm({
      title: `确认${status === '正常' ? '批量启用' : '批量停用'}？`,
      content: selectedRowKeys.length
        ? `将更新已选中的 ${ids.length} 个帐号。`
        : `当前未勾选用户，将更新列表中全部 ${ids.length} 个帐号。`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => updateStatus(ids, status),
    });
  };

  const exportList = () => {
    const headers = ['用户姓名', '用户工号', '所属组织', '联系方式', '用户角色', '数据权限', '帐号状态', '帐号创建时间', '最后登录时间'];
    const rows = filteredUsers.map((user) => [
      user.name, user.employeeId, user.department, user.phone, user.roles.join('、'), user.dataScope,
      user.status, user.createdAt, user.lastLoginAt,
    ]);
    const html = `<table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows
      .map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join('')}</tr>`).join('')}</table>`;
    const url = URL.createObjectURL(new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `用户列表-${new Date().toISOString().slice(0, 10)}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
    message.success(`已导出当前列表 ${rows.length} 条记录`);
  };

  const columns: ColumnsType<CenterUser> = [
    { title: '用户姓名', dataIndex: 'name', width: 100, fixed: 'left' },
    { title: '用户工号', dataIndex: 'employeeId', width: 110 },
    { title: '所属组织', dataIndex: 'department', width: 120 },
    { title: '联系方式', dataIndex: 'phone', width: 130 },
    {
      title: '用户角色', dataIndex: 'roles', width: 130,
      render: (roles: UserRole[]) => (
        <Space size={[0, 4]} wrap>
          {roles.map((role) => <Tag key={role} color={roleColorMap[role]}>{role}</Tag>)}
        </Space>
      ),
    },
    { title: '数据权限', dataIndex: 'dataScope', width: 110 },
    {
      title: '帐号状态', dataIndex: 'status', width: 90,
      render: (status: AccountStatus) => <Tag color={status === '正常' ? 'success' : 'default'}>{status}</Tag>,
    },
    { title: '帐号创建时间', dataIndex: 'createdAt', width: 170 },
    { title: '最后登录时间', dataIndex: 'lastLoginAt', width: 170 },
    {
      title: '操作', key: 'action', width: 190, fixed: 'right',
      render: (_, record) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/app/user-center/${record.id}/edit`)}>编辑</Button>
          <Button
            type="link"
            size="small"
            danger={record.status === '正常'}
            onClick={() => updateStatus([record.id], record.status === '正常' ? '停用' : '正常')}
          >
            {record.status === '正常' ? '停用' : '恢复使用'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-center-page">
      <PageHeader
        title="用户列表"
        subTitle="管理平台用户帐号、角色及使用状态"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/user-center/create')}>新建用户</Button>}
      />
      <Card className="user-center-filter" bordered={false}>
        <Form form={filterForm} layout="inline" onFinish={setFilters}>
          <Form.Item name="department" label="所属组织"><Select allowClear placeholder="全部组织" options={departments} style={{ width: 180 }} /></Form.Item>
          <Form.Item name="role" label="用户角色"><Select allowClear placeholder="全部角色" options={systemRoles.map((value) => ({ label: value, value }))} style={{ width: 170 }} /></Form.Item>
          <Form.Item name="status" label="帐号状态"><Select allowClear placeholder="全部状态" options={['正常', '停用'].map((value) => ({ label: value, value }))} style={{ width: 140 }} /></Form.Item>
          <Form.Item><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { filterForm.resetFields(); setFilters({}); }}>重置</Button></Space></Form.Item>
        </Form>
      </Card>
      <Card bordered={false}>
        <div className="user-center-toolbar">
          <Space>
            <Button icon={<CheckCircleOutlined />} onClick={() => confirmBatch('正常')}>批量启用</Button>
            <Button icon={<StopOutlined />} onClick={() => confirmBatch('停用')}>批量停用</Button>
            <Button icon={<ExportOutlined />} onClick={exportList}>导出列表</Button>
          </Space>
          <span>共 {filteredUsers.length} 位用户{selectedRowKeys.length > 0 && `，已选 ${selectedRowKeys.length} 位`}</span>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          scroll={{ x: 1310 }}
          pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>
    </div>
  );
};

export default UserList;
