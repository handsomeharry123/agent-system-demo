import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tabs, Form, Input, Button, Card, Typography, Checkbox, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MobileOutlined, SafetyOutlined } from '@ant-design/icons';
import type { FormProps } from 'antd';
import { mockUsers } from '../../mock/users';

const { Title, Text, Paragraph } = Typography;

interface AccountLoginValues {
  account: string;
  password: string;
  captcha?: string;
  remember?: boolean;
}

interface PhoneLoginValues {
  phone: string;
  verificationCode: string;
}

const Login = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [phoneForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [activeTab, setActiveTab] = useState('account');
  const [errorCount, setErrorCount] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockRemaining, setLockRemaining] = useState(0);

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(result);
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (lockUntil) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
        setLockRemaining(remaining);
        if (remaining === 0) {
          setLockUntil(null);
          setErrorCount(0);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockUntil]);

  useEffect(() => {
    if (errorCount >= 3) {
      setShowCaptcha(true);
      generateCaptcha();
    }
  }, [errorCount]);

  const handleSendCode = async () => {
    const phone = phoneForm.getFieldValue('phone');
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      message.error('请输入正确的手机号');
      return;
    }
    setCountdown(60);
    message.success('验证码已发送');
  };

  const handleAccountLogin: FormProps<AccountLoginValues>['onFinish'] = async (values) => {
    if (lockUntil && Date.now() < lockUntil) {
      message.error(`账号已锁定，请 ${lockRemaining} 秒后再试`);
      return;
    }

    if (showCaptcha && values.captcha?.toUpperCase() !== captcha) {
      message.error('图形验证码错误');
      generateCaptcha();
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);

    const user = mockUsers.find(
      (u) =>
        (u.employeeId === values.account || u.phone === values.account || u.name === values.account) &&
        u.password === values.password
    );

    if (user) {
      message.success('登录成功');
      navigate('/app/home/dashboard', { replace: true });
    } else {
      const newErrorCount = errorCount + 1;
      setErrorCount(newErrorCount);

      if (newErrorCount >= 5) {
        setLockUntil(Date.now() + 30 * 60 * 1000);
        message.error('连续错误 5 次，账号锁定 30 分钟');
      } else {
        message.error(`账号或密码错误，剩余 ${5 - newErrorCount} 次机会`);
      }
      generateCaptcha();
    }
  };

  const handlePhoneLogin: FormProps<PhoneLoginValues>['onFinish'] = async (values) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    message.success('登录成功');
    navigate('/app/home/dashboard', { replace: true });
  };

  const isLocked = lockUntil !== null && Date.now() < lockUntil;

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
      <Card style={{ width: 440, borderRadius: 12 }} styles={{ body: { padding: 40 } }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>用户登录</Title>
          <Text type="secondary">医疗智能体管理平台</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'account',
              label: '账号密码登录',
              children: (
                <Form form={form} layout="vertical" onFinish={handleAccountLogin} size="large">
                  <Form.Item
                    name="account"
                    rules={[{ required: true, message: '请输入账号' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="工号 / 手机号 / 姓名" />
                  </Form.Item>

                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
                  </Form.Item>

                  {showCaptcha && (
                    <Form.Item
                      name="captcha"
                      rules={[{ required: true, message: '请输入图形验证码' }]}
                    >
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="请输入图形验证码"
                          maxLength={4}
                          style={{ flex: 1 }}
                        />
                        <Button
                          onClick={generateCaptcha}
                          style={{ width: 100, height: 40, letterSpacing: 2 }}
                        >
                          {captcha}
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Checkbox>记住账号</Checkbox>
                    <a style={{ fontSize: 14 }}>忘记密码？</a>
                  </div>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={loading}
                    disabled={isLocked}
                  >
                    {isLocked ? `锁定中 ${lockRemaining}s` : '登录'}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'phone',
              label: '手机验证码登录',
              children: (
                <Form form={phoneForm} layout="vertical" onFinish={handlePhoneLogin} size="large">
                  <Form.Item
                    name="phone"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误' },
                    ]}
                  >
                    <Input prefix={<MobileOutlined />} placeholder="请输入手机号" />
                  </Form.Item>

                  <Form.Item
                    name="verificationCode"
                    rules={[
                      { required: true, message: '请输入验证码' },
                      { pattern: /^\d{6}$/, message: '验证码为 6 位数字' },
                    ]}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="请输入 6 位验证码"
                        maxLength={6}
                        style={{ flex: 1 }}
                      />
                      <Button
                        onClick={handleSendCode}
                        disabled={countdown > 0}
                        style={{ width: 110 }}
                      >
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </Button>
                    </Space.Compact>
                  </Form.Item>

                  <div style={{ marginBottom: 24 }}>
                    <Checkbox>自动登录</Checkbox>
                  </div>

                  <Button type="primary" htmlType="submit" block loading={loading}>
                    登录
                  </Button>
                </Form>
              ),
            },
          ]}
        />

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary">没有账号？</Text>
          <Link to="/register" style={{ marginLeft: 4 }}>立即注册</Link>
        </div>

        {errorCount >= 3 && errorCount < 5 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              连续错误 {errorCount} 次，请输入图形验证码
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Login;
