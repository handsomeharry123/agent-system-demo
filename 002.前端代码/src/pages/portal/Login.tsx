import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tabs, Form, Input, Button, Card, Typography, Checkbox, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MobileOutlined, SafetyOutlined } from '@ant-design/icons';
import type { FormProps } from 'antd';
import { useAuth } from '../../hooks/useAuth';
import { authApi, ApiError } from '../../services/auth';
import { mvpFeatures } from '../../config/mvpFeatures';

const { Title, Text, Paragraph } = Typography;
const REMEMBERED_ACCOUNT_KEY = 'remembered_login_account';

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
  const { login, loginBySms } = useAuth();
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

  useEffect(() => {
    const rememberedAccount = localStorage.getItem(REMEMBERED_ACCOUNT_KEY);
    if (rememberedAccount) {
      form.setFieldsValue({ account: rememberedAccount, remember: true });
    }
  }, [form]);

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
    try {
      const result = await authApi.sendSmsCode(phone);
      setCountdown(60);
      message.success(result.developmentCode ? `验证码已发送，开发验证码：${result.developmentCode}` : '验证码已发送');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '验证码发送失败');
    }
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

    try {
      setLoading(true);
      await login(values.account, values.password);
      if (values.remember) {
        localStorage.setItem(REMEMBERED_ACCOUNT_KEY, values.account.trim());
      } else {
        localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
      }
      message.success('登录成功');
      navigate('/app/home/dashboard', { replace: true });
    } catch (error) {
      const serverData = error instanceof ApiError ? error.data as { failedAttempts?: number; captchaRequired?: boolean } | undefined : undefined;
      const newErrorCount = serverData?.failedAttempts ?? errorCount + 1;
      setErrorCount(newErrorCount);
      if (newErrorCount >= 5) {
        setLockUntil(Date.now() + 30 * 60 * 1000);
      } else {
        if (serverData?.captchaRequired) setShowCaptcha(true);
      }
      message.error(error instanceof Error ? error.message : '登录失败');
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin: FormProps<PhoneLoginValues>['onFinish'] = async (values) => {
    try {
      setLoading(true);
      await loginBySms(values.phone, values.verificationCode);
      message.success('登录成功');
      navigate('/app/home/dashboard', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockUntil !== null && Date.now() < lockUntil;

  const accountLoginForm = (
    <Form form={form} layout="vertical" onFinish={handleAccountLogin} size="large">
      <Form.Item name="account" rules={[{ required: true, message: '请输入账号' }]}>
        <Input prefix={<UserOutlined />} placeholder="工号 / 手机号 / 姓名" />
      </Form.Item>

      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
      </Form.Item>

      {showCaptcha && (
        <Form.Item name="captcha" rules={[{ required: true, message: '请输入图形验证码' }]}>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="请输入图形验证码" maxLength={4} style={{ flex: 1 }} />
            <Button onClick={generateCaptcha} style={{ width: 100, height: 40, letterSpacing: 2 }}>
              {captcha}
            </Button>
          </Space.Compact>
        </Form.Item>
      )}

      <div style={{ marginBottom: 24 }}>
        <Form.Item name="remember" valuePropName="checked" noStyle>
          <Checkbox>记住账号</Checkbox>
        </Form.Item>
      </div>

      <Button type="primary" htmlType="submit" block loading={loading} disabled={isLocked}>
        {isLocked ? `锁定中 ${lockRemaining}s` : '登录'}
      </Button>
    </Form>
  );

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

        {mvpFeatures.smsLogin ? <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'account',
              label: '账号密码登录',
              children: accountLoginForm,
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
        /> : accountLoginForm}

        {mvpFeatures.selfRegistration && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Text type="secondary">没有账号？</Text>
            <Link to="/register" style={{ marginLeft: 4 }}>立即注册</Link>
          </div>
        )}

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
