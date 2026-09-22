import { useMemo } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { departmentOptions } from '../../mock/departments';
import { systemRoles } from './constants';
import { initialCenterUsers, type CenterUser } from './UserList';

type UserFormValues = Pick<CenterUser, 'name' | 'employeeId' | 'password' | 'department' | 'phone' | 'roles' | 'dataScope' | 'status'>;

const loadUsers = (): CenterUser[] => {
  const saved = sessionStorage.getItem('user-center-users');
  if (!saved) return initialCenterUsers;
  return JSON.parse(saved).map((user: CenterUser & { role?: CenterUser['roles'][number] }) => {
    const { role, ...rest } = user;
    return {
      ...rest,
      password: rest.password || initialCenterUsers.find((initialUser) => initialUser.id === user.id)?.password || '123456',
      roles: rest.roles?.length ? rest.roles : role ? [role] : [],
    };
  });
};

const scopeForRoles = (roles?: CenterUser['roles']): CenterUser['dataScope'] | undefined =>
  roles?.length ? (roles.some((role) => role !== '科室管理员') ? '全院数据' : '本科室数据') : undefined;

const UserFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm<UserFormValues>();
  const users = useMemo(loadUsers, []);
  const editingUser = id ? users.find((user) => user.id === id) : undefined;
  const isEditing = Boolean(id);
  const organizationOptions = useMemo(() => {
    const values = new Set(['院领导', '信息中心', ...departmentOptions.map((option) => option.value)]);
    return Array.from(values).map((value) => ({ label: value, value }));
  }, []);

  const persist = (values: UserFormValues) => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
    const next = isEditing
      ? users.map((user) => user.id === id ? { ...user, ...values } : user)
      : [{ ...values, id: `user-${Date.now()}`, createdAt: now, lastLoginAt: '-' }, ...users];
    sessionStorage.setItem('user-center-users', JSON.stringify(next));
    message.success(isEditing ? '用户信息已更新' : '用户新增成功');
    navigate('/app/user-center');
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (!isEditing) {
      persist(values);
      return;
    }
    Modal.confirm({
      title: '确认是否保存？',
      content: '确认后将覆盖保存前的用户信息。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => persist(values),
    });
  };

  if (isEditing && !editingUser) {
    return (
      <div className="user-center-page">
        <PageHeader title="编辑用户" showBack onBack={() => navigate('/app/user-center')} />
        <Card bordered={false}>未找到该用户，请返回用户列表后重试。</Card>
      </div>
    );
  }

  return (
    <div className="user-center-page">
      <PageHeader
        title={isEditing ? '用户信息编辑' : '新增用户'}
        subTitle={isEditing ? '修改用户基础信息、角色及帐号状态' : '录入平台用户信息并配置角色与数据权限'}
        showBack
        onBack={() => navigate('/app/user-center')}
      />
      <Card bordered={false} title="用户信息">
        <Form<UserFormValues>
          form={form}
          layout="vertical"
          className="user-center-form"
          initialValues={editingUser || { status: '正常' }}
          onValuesChange={(changed) => {
            if ('roles' in changed) form.setFieldValue('dataScope', scopeForRoles(changed.roles));
          }}
        >
          <div className="user-center-form-grid">
            <Form.Item
              name="name"
              label="用户姓名"
              rules={[
                { required: true, message: '请输入用户姓名' },
                { pattern: /^[\u4e00-\u9fa5]{2,10}$/, message: '用户姓名须为 2-10 个汉字' },
              ]}
            >
              <Input placeholder="请输入用户姓名" maxLength={10} />
            </Form.Item>
            <Form.Item
              name="employeeId"
              label="用户工号"
              rules={[
                { required: true, message: '请输入用户工号' },
                {
                  validator: (_, value) => !value || !users.some((user) => user.employeeId === value && user.id !== id)
                    ? Promise.resolve()
                    : Promise.reject(new Error('用户工号已存在')),
                },
              ]}
            >
              <Input placeholder="请输入用户工号" maxLength={30} />
            </Form.Item>
            {isEditing && (
              <Form.Item
                name="password"
                label="登录密码"
                rules={[{ required: true, message: '请输入登录密码' }]}
              >
                <Input.Password placeholder="请输入登录密码" maxLength={50} />
              </Form.Item>
            )}
            {!isEditing && (
              <Form.Item label="初始密码" extra="统一设定为“用户姓名小写首字母 + 用户工号”">
                <Input disabled value="系统自动生成" />
              </Form.Item>
            )}
            <Form.Item name="department" label="所属组织" rules={[{ required: true, message: '请选择所属组织' }]}>
              <Select showSearch optionFilterProp="label" placeholder="请选择所属组织" options={organizationOptions} />
            </Form.Item>
            <Form.Item name="roles" label="用户角色" rules={[{ required: true, message: '请至少选择一个用户角色' }]}>
              <Select
                mode="multiple"
                maxTagCount="responsive"
                placeholder="请选择用户角色（可多选）"
                options={systemRoles.map((value) => ({ label: value, value }))}
              />
            </Form.Item>
            <Form.Item
              name="phone"
              label="联系方式"
              validateTrigger="onBlur"
              rules={[
                { required: true, message: '请输入联系方式' },
                { pattern: /^1\d{10}$/, message: '请输入正确的 11 位手机号' },
              ]}
            >
              <Input
                placeholder="请输入 11 位手机号"
                maxLength={11}
                inputMode="numeric"
                onChange={(event) => form.setFieldValue('phone', event.target.value.replace(/\D/g, '').slice(0, 11))}
              />
            </Form.Item>
            <Form.Item
              name="dataScope"
              label="数据权限"
              rules={[{ required: true, message: '请先选择用户角色' }]}
              extra="数据权限由用户角色自动确定"
            >
              <Select disabled placeholder="选择角色后自动生成" options={['全院数据', '本科室数据'].map((value) => ({ label: value, value }))} />
            </Form.Item>
            <Form.Item name="status" label="帐号状态" rules={[{ required: true, message: '请选择帐号状态' }]}>
              <Select options={['正常', '停用'].map((value) => ({ label: value, value }))} />
            </Form.Item>
          </div>
          <div className="user-center-form-actions">
            <Space>
              <Button type="primary" onClick={submit}>{isEditing ? '保存' : '确认'}</Button>
              <Button onClick={() => navigate('/app/user-center')}>取消</Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default UserFormPage;
