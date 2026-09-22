import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar } from 'antd';
import {
  HomeOutlined,
  RobotOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header, Footer, Content } = Layout;

const navItems = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/agents', label: '智能体', icon: <RobotOutlined /> },
  { key: '/help', label: '帮助中心', icon: <FileTextOutlined /> },
];

const PortalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState(location.pathname);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    setCurrentPath(key);
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 48px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          height: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            <Avatar shape="square" size={40} style={{ background: '#1677FF' }}>
              AI
            </Avatar>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>
              医疗智能体平台
            </span>
          </div>
          <Menu
            mode="horizontal"
            selectedKeys={[currentPath]}
            onClick={handleMenuClick}
            items={navItems}
            style={{ border: 'none', minWidth: 400 }}
          />
        </div>
        <Avatar
          style={{ background: '#f0f0f0', color: '#666', cursor: 'pointer' }}
          icon={<UserOutlined />}
          onClick={() => navigate('/login')}
        />
      </Header>

      <Content style={{ background: '#F5F5F5' }}>
        <Outlet />
      </Content>

      <Footer
        style={{
          background: '#001529',
          color: '#fff',
          padding: '48px 48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 48,
          }}
        >
          <div>
            <h4 style={{ color: '#fff', marginBottom: 16 }}>平台介绍</h4>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
              医疗智能体管理平台致力于提供安全、可靠的AI智能体接入与管理服务。
            </p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: 16 }}>快速链接</h4>
            <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 2, listStyle: 'none', padding: 0 }}>
              <li><a href="/agents" style={{ color: 'rgba(255,255,255,0.65)' }}>智能体市场</a></li>
              <li><a href="/help" style={{ color: 'rgba(255,255,255,0.65)' }}>帮助文档</a></li>
              <li><a href="/register" style={{ color: 'rgba(255,255,255,0.65)' }}>开发者入驻</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: 16 }}>支持</h4>
            <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 2, listStyle: 'none', padding: 0 }}>
              <li><a href="/help" style={{ color: 'rgba(255,255,255,0.65)' }}>常见问题</a></li>
              <li><a href="/help" style={{ color: 'rgba(255,255,255,0.65)' }}>API 文档</a></li>
              <li><a href="/help" style={{ color: 'rgba(255,255,255,0.65)' }}>技术支持</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: 16 }}>联系方式</h4>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
              邮箱：support@example.com<br />
              电话：400-123-4567
            </p>
          </div>
        </div>
        <div
          style={{
            maxWidth: 1200,
            margin: '48px auto 0',
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          © 2024 医疗智能体管理平台 版权所有
        </div>
      </Footer>
    </Layout>
  );
};

export default PortalLayout;
