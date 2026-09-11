import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Select, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import type { FormProps } from 'antd';
import { departmentOptions } from '../../mock/departments';
import { mockUsers } from '../../mock/users';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface RegisterFormValues {
  name: string;
  employeeId: string;
  department: string;
  position?: string;
  phone: string;
  verificationCode: string;
  password: string;
  confirmPassword: string;
}

const validatePassword = (_: any, value: string) => {
  if (!value) {
    return Promise.reject(new Error('请输入密码'));
  }
  if (value.length < 8 || value.length > 20) {
    return Promise.reject(new Error('密码长度为 8-20 位'));
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return Promise.reject(new Error('密码需包含字母和数字'));
  }
  return Promise.resolve();
};

const Register = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<RegisterFormValues>();
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [checkingEmployeeId, setCheckingEmployeeId] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [employeeIdAvailable, setEmployeeIdAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = () => {
    const phone = form.getFieldValue('phone');
    if (!phone || phone.length !== 11) {
      message.error('请输入正确的手机号');
      return;
    }
    if (phoneAvailable === false) {
      message.error('该手机号已被注册');
      return;
    }
    setCountdown(60);
    message.success('验证码已发送');
  };

  const handleCheckEmployeeId = async (employeeId: string) => {
    if (!employeeId || employeeId.length < 4) {
      setEmployeeIdAvailable(null);
      return;
    }
    setCheckingEmployeeId(true);
    await new Promise((r) => setTimeout(r, 300));
    const exists = mockUsers.some((u) => u.employeeId === employeeId);
    setEmployeeIdAvailable(!exists);
    setCheckingEmployeeId(false);
    if (exists) {
      message.warning('该工号已被注册');
    }
  };

  const handleCheckPhone = async (phone: string) => {
    if (!phone || phone.length !== 11) {
      setPhoneAvailable(null);
      return;
    }
    setCheckingPhone(true);
    await new Promise((r) => setTimeout(r, 300));
    const exists = mockUsers.some((u) => u.phone === phone || u.phone.replace('*', '') === phone.replace('*', ''));
    setPhoneAvailable(false);
    setCheckingPhone(false);
  };

  const handleSubmit: FormProps<RegisterFormValues>['onFinish'] = async (values) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    message.success('注册成功，即将跳转到工作台');
    setTimeout(() => navigate('/app/home'), 1500);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #001529 0%, #1677FF 100%)',
        padding: '60px 24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <Card
        style={{ width: 480, borderRadius: 12 }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>用户注册</Title>
          <Text type="secondary">加入医疗智能体管理平台</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[
              { required: true, message: '请输入姓名' },
              { min: 2, max: 20, message: '姓名长度为 2-20 个字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入真实姓名" />
          </Form.Item>

          <Form.Item
            name="employeeId"
            label="工号"
            validateStatus={checkingEmployeeId ? 'validating' : employeeIdAvailable === true ? 'success' : employeeIdAvailable === false ? 'error' : undefined}
            help={employeeIdAvailable === false ? '该工号已被注册' : undefined}
            rules={[
              { required: true, message: '请输入工号' },
              { pattern: /^[A-Za-z0-9]+$/, message: '工号只能包含字母和数字' },
            ]}
          >
            <Input
              placeholder="请输入工号"
              onBlur={(e) => handleCheckEmployeeId(e.target.value)}
            />
          </Form.Item>

          <Form.Item
            name="department"
            label="所属科室"
            rules={[{ required: true, message: '请选择所属科室' }]}
          >
            <Select placeholder="请选择所属科室" showSearch>
              {departmentOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="position" label="职务职称">
            <Input placeholder="如：主治医师、护士长等（选填）" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            validateStatus={checkingPhone ? 'validating' : phoneAvailable === false ? 'error' : undefined}
            help={phoneAvailable === false ? '该手机号已被注册' : undefined}
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
            ]}
          >
            <Input
              placeholder="请输入手机号"
              prefix={<PhoneOutlined />}
              onBlur={(e) => handleCheckPhone(e.target.value)}
            />
          </Form.Item>

          <Form.Item
            name="verificationCode"
            label="短信验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { pattern: /^\d{6}$/, message: '验证码为 6 位数字' },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="请输入 6 位验证码" maxLength={6} style={{ flex: 1 }} />
              <Button
                onClick={handleSendCode}
                disabled={countdown > 0}
                style={{ width: 120 }}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="password"
            label="设置密码"
            rules={[{ validator: validatePassword }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="8-20 位，需包含字母和数字"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              立即注册
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">已有账号？</Text>
          <Link to="/login" style={{ marginLeft: 4 }}>立即登录</Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
