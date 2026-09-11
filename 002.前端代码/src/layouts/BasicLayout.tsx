import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Layout, Space, Typography, message } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { SmartDraftProvider } from '../pages/agent-center/smart/store.tsx';

const { Header, Content } = Layout;
const { Text } = Typography;

/** 医小知独立应用布局：不再展示平台功能菜单和演示配置入口。 */
const BasicLayout = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { themeKey } = useTheme();
  const isTech = themeKey === 'tech';

  useEffect(() => {
    document.body.setAttribute('data-app-theme', themeKey);
    return () => document.body.removeAttribute('data-app-theme');
  }, [themeKey]);

  const userMenuItems: MenuProps['items'] = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key !== 'logout') return;
    logout();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ height: '100dvh', minHeight: 0, overflow: 'hidden' }}>
      <Header
        style={{
          height: 56,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isTech ? 'rgba(15, 48, 36, 0.92)' : '#F3FBF6',
          borderBottom: isTech ? '1px solid rgba(56, 189, 248, 0.24)' : '1px solid #f0f0f0',
          lineHeight: 'normal',
          flex: '0 0 56px',
        }}
      >
        <Space size={10}>
          <Avatar shape="square" size={34} src="/logo.svg" style={{ background: '#52B788' }} />
          <Text strong style={{ fontSize: 17, color: isTech ? '#e8f1ff' : '#1f1f1f' }}>
            医小知
          </Text>
        </Space>
        <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} trigger={['click']}>
          <Space style={{ cursor: 'pointer' }}>
            <Text style={{ color: isTech ? '#cbd5e1' : '#595959' }}>{currentUser?.name ?? '用户'}</Text>
            <Avatar size={32} icon={<UserOutlined />} style={{ background: '#52B788' }} />
          </Space>
        </Dropdown>
      </Header>
      <Content style={{ minHeight: 0, overflow: 'hidden' }}>
        <SmartDraftProvider moduleKey="home">
          <Outlet />
        </SmartDraftProvider>
      </Content>
    </Layout>
  );
};

export default BasicLayout;
