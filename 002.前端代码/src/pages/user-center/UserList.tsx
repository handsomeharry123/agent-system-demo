import { useEffect, useRef, useState } from 'react';
import { Button, Card, Form, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { roleColorMap, systemRoles } from './constants';
import { userCenterApi, type AccountStatus, type CenterUser, type UserFilters } from '../../services/userCenter';

export type { CenterUser } from '../../services/userCenter';

const UserList = () => {
  const navigate = useNavigate();
  const [filterForm] = Form.useForm<UserFilters>();
  const [users, setUsers] = useState<CenterUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState<UserFilters>({});
  const [departments, setDepartments] = useState<Array<{ label: string; value: number }>>([]);
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [userOptionsLoading, setUserOptionsLoading] = useState(false);
  const userSearchTimer = useRef<ReturnType<typeof setTimeout>>();
  const userSearchSequence = useRef(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8, total: 0 });

  const loadUsers = async (current = pagination.current, nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await userCenterApi.list({ ...nextFilters, current, pageSize: pagination.pageSize });
      setUsers(result.list);
      setPagination(result.pagination);
      setSelectedRowKeys([]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户列表加载失败');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void userCenterApi.meta().then((result) => setDepartments(result.departments)).catch((error) => {
      message.error(error instanceof Error ? error.message : '筛选项加载失败');
    });
    void loadUsers(1, {});
    return () => clearTimeout(userSearchTimer.current);
  }, []);

  const searchUserOptions = (keyword = '') => {
    clearTimeout(userSearchTimer.current);
    const sequence = ++userSearchSequence.current;
    userSearchTimer.current = setTimeout(async () => {
      setUserOptionsLoading(true);
      try {
        const result = await userCenterApi.options(keyword.trim());
        if (sequence === userSearchSequence.current) setUserOptions(result);
      } catch (error) {
        if (sequence === userSearchSequence.current) {
          message.error(error instanceof Error ? error.message : '用户筛选项加载失败');
        }
      } finally {
        if (sequence === userSearchSequence.current) setUserOptionsLoading(false);
      }
    }, keyword ? 300 : 0);
  };

  const updateStatus = async (id: string, status: AccountStatus) => {
    try {
      setLoading(true);
      await userCenterApi.updateStatus(id, status);
      message.success(status === '正常' ? '帐号已恢复使用' : '帐号已停用');
      await loadUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '帐号状态更新失败');
    } finally { setLoading(false); }
  };

  const removeUser = (user: CenterUser) => {
    if (user.status !== '停用') {
      message.warning('执行删除操作前，请先停用该用户');
      return;
    }
    Modal.confirm({
      title: '提示',
      content: `确定删除用户“${user.name}”吗？`,
      okText: '确定', cancelText: '取消', okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true);
          await userCenterApi.remove(user.id);
          message.success('用户已删除');
          await loadUsers();
        } catch (error) { message.error(error instanceof Error ? error.message : '用户删除失败'); }
        finally { setLoading(false); }
      },
    });
  };

  const confirmBatch = (status: AccountStatus) => {
    const ids = selectedRowKeys;
    Modal.confirm({
      title: `确认${status === '正常' ? '批量启用' : '批量停用'}？`,
      content: ids.length ? `将更新已选中的 ${ids.length} 个帐号。` : '当前未勾选用户，将更新筛选结果中的全部帐号。',
      okText: '确认', cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const result = await userCenterApi.batchStatus(status, ids.map(String), filters);
          message.success(`已${status === '正常' ? '启用' : '停用'} ${result.affected} 个帐号`);
          await loadUsers();
        } catch (error) { message.error(error instanceof Error ? error.message : '批量操作失败'); }
        finally { setLoading(false); }
      },
    });
  };

  const exportList = async () => {
    try {
      const blob = await userCenterApi.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `用户列表-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success('已导出当前筛选结果');
    } catch (error) { message.error(error instanceof Error ? error.message : '导出失败'); }
  };

  const columns: ColumnsType<CenterUser> = [
    { title: '用户姓名', dataIndex: 'name', width: 110, fixed: 'left' },
    { title: '用户工号', dataIndex: 'employeeId', width: 110 },
    { title: '所属组织', dataIndex: 'department', width: 120 },
    { title: '联系方式', dataIndex: 'phone', width: 130 },
    { title: '用户角色', dataIndex: 'roles', width: 150, render: (roles: CenterUser['roles']) => <Space size={[0, 4]} wrap>{roles.map((role) => <Tag key={role} color={roleColorMap[role]}>{role}</Tag>)}</Space> },
    { title: '数据权限', dataIndex: 'dataScope', width: 110 },
    { title: '帐号状态', dataIndex: 'status', width: 90, render: (status: AccountStatus) => <Tag color={status === '正常' ? 'success' : 'default'}>{status}</Tag> },
    { title: '帐号创建时间', dataIndex: 'createdAt', width: 170 },
    { title: '最后登录时间', dataIndex: 'lastLoginAt', width: 170 },
    { title: '操作', key: 'action', width: 250, fixed: 'right', render: (_, record) => <Space size={2}>
      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/app/user-center/${record.id}/edit`)}>编辑</Button>
      <Button type="link" size="small" danger={record.status === '正常'} onClick={() => void updateStatus(record.id, record.status === '正常' ? '停用' : '正常')}>{record.status === '正常' ? '停用' : '恢复'}</Button>
      <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removeUser(record)}>删除</Button>
    </Space> },
  ];

  return <div className="user-center-page">
    <PageHeader title="用户列表" subTitle="管理平台用户帐号、角色及使用状态" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/user-center/create')}>新建用户</Button>} />
    <Card className="user-center-filter" bordered={false}>
      <Form form={filterForm} layout="inline" onFinish={(values) => { setFilters(values); void loadUsers(1, values); }}>
        <Form.Item name="userId" label="用户">
          <Select
            allowClear
            showSearch
            filterOption={false}
            placeholder="姓名 / 工号 / 联系方式"
            options={userOptions}
            loading={userOptionsLoading}
            notFoundContent={userOptionsLoading ? '搜索中…' : '暂无匹配用户'}
            onFocus={() => { if (!userOptions.length) searchUserOptions(); }}
            onSearch={searchUserOptions}
            style={{ width: 240 }}
          />
        </Form.Item>
        <Form.Item name="departmentId" label="所属组织"><Select allowClear placeholder="全部组织" options={departments} style={{ width: 180 }} /></Form.Item>
        <Form.Item name="role" label="用户角色"><Select allowClear placeholder="全部角色" options={systemRoles.map((value) => ({ label: value, value }))} style={{ width: 170 }} /></Form.Item>
        <Form.Item name="status" label="帐号状态"><Select allowClear placeholder="全部状态" options={['正常', '停用'].map((value) => ({ label: value, value }))} style={{ width: 140 }} /></Form.Item>
        <Form.Item><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { filterForm.resetFields(); setFilters({}); void loadUsers(1, {}); }}>重置</Button></Space></Form.Item>
      </Form>
    </Card>
    <Card bordered={false}>
      <div className="user-center-toolbar"><Space>
        <Button icon={<CheckCircleOutlined />} onClick={() => confirmBatch('正常')}>批量启用</Button>
        <Button icon={<StopOutlined />} onClick={() => confirmBatch('停用')}>批量停用</Button>
        <Button icon={<ExportOutlined />} onClick={() => void exportList()}>导出列表</Button>
      </Space><span>共 {pagination.total} 位用户{selectedRowKeys.length > 0 && `，已选 ${selectedRowKeys.length} 位`}</span></div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={users} rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} scroll={{ x: 1320 }} pagination={{ ...pagination, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} onChange={(page: TablePaginationConfig) => void loadUsers(page.current ?? 1)} />
    </Card>
  </div>;
};

export default UserList;
