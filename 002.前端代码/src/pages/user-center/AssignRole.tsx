import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Select, Space, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { systemRoles } from './constants';
import { userCenterApi, type UserFormPayload } from '../../services/userCenter';

const AssignRole = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm<{ roles: UserFormPayload['roles'] }>();
  const [user, setUser] = useState<(UserFormPayload & { id: string }) | null>(null);

  useEffect(() => {
    if (!id) return;
    void userCenterApi.detail(id).then((result) => {
      setUser(result);
      form.setFieldsValue({ roles: result.roles });
    }).catch((error) => message.error(error instanceof Error ? error.message : '用户信息加载失败'));
  }, [id]);

  const submit = async ({ roles }: { roles: UserFormPayload['roles'] }) => {
    if (!user || !id) return;
    try {
      await userCenterApi.update(id, { ...user, roles });
      message.success('角色分配成功');
      navigate('/app/user-center');
    } catch (error) { message.error(error instanceof Error ? error.message : '角色分配失败'); }
  };

  return <div className="user-center-page">
    <PageHeader title="分配角色" showBack onBack={() => navigate(-1)} subTitle="为用户分配平台角色，数据权限将随角色自动更新" />
    <Card bordered={false}><Spin spinning={!user}>
      {user && <>
        <Descriptions column={3} className="user-center-descriptions">
          <Descriptions.Item label="用户姓名">{user.name}</Descriptions.Item>
          <Descriptions.Item label="用户工号">{user.employeeId}</Descriptions.Item>
          <Descriptions.Item label="所属组织">{user.departmentId}</Descriptions.Item>
        </Descriptions>
        <Form form={form} layout="vertical" onFinish={submit} style={{ maxWidth: 560 }}>
          <Form.Item name="roles" label="用户角色" rules={[{ required: true, message: '请至少选择一个用户角色' }]}>
            <Select mode="multiple" placeholder="请选择用户角色（可多选）" options={systemRoles.map((value) => ({ label: value, value }))} />
          </Form.Item>
          <Form.Item><Space><Button onClick={() => navigate(-1)}>取消</Button><Button type="primary" htmlType="submit">提交</Button></Space></Form.Item>
        </Form>
      </>}
    </Spin></Card>
  </div>;
};

export default AssignRole;
