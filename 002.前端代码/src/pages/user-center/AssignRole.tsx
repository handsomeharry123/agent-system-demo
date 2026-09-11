import { Button, Card, Descriptions, Form, Select, Space, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { initialCenterUsers } from './UserList';
import { systemRoles } from './constants';

const AssignRole = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = initialCenterUsers.find((item) => item.id === id) || initialCenterUsers[0];

  return (
    <div className="user-center-page">
      <PageHeader title="分配角色" showBack onBack={() => navigate(-1)} subTitle="为用户分配平台角色，数据权限将随角色自动更新" />
      <Card bordered={false}>
        <Descriptions column={3} className="user-center-descriptions">
          <Descriptions.Item label="用户姓名">{user.name}</Descriptions.Item>
          <Descriptions.Item label="用户工号">{user.employeeId}</Descriptions.Item>
          <Descriptions.Item label="所属科室">{user.department}</Descriptions.Item>
        </Descriptions>
        <Form
          layout="vertical"
          initialValues={{ roles: user.roles }}
          onFinish={() => {
            message.success('角色分配成功');
            setTimeout(() => navigate('/app/user-center'), 500);
          }}
          style={{ maxWidth: 560 }}
        >
          <Form.Item name="roles" label="用户角色" rules={[{ required: true, message: '请至少选择一个用户角色' }]}>
            <Select mode="multiple" placeholder="请选择用户角色（可多选）" options={systemRoles.map((value) => ({ label: value, value }))} />
          </Form.Item>
          <Form.Item><Space><Button onClick={() => navigate(-1)}>取消</Button><Button type="primary" htmlType="submit">提交</Button></Space></Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AssignRole;
