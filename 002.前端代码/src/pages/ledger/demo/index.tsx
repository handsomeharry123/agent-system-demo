/**
 * 统一台账中心 - 智能化升级 Demo 总入口
 *
 * 依据《台账中心智能化升级-需求说明V1》§3(信息科管理员) + §4(科室用户):
 *   - §3.1 / §4.1 态势概览与分流
 *   - §3.2 / §4.2 智能体 360 画像
 *   - §3.3 / §4.3 智能总结分析(全院报告 / 科室应用成效小结)
 *
 * 访问方式:http://localhost:5173/app/ledger-demo
 *
 * 子页路由:
 *   /app/ledger-demo           → 正式台账总览 /app/ledger
 *   /app/ledger-demo/overview  → 已下线，兼容重定向至 /app/ledger
 *   /app/ledger-demo/profile   → §3.2 / §4.2 智能体 360 画像
 *   /app/ledger-demo/report    → §3.3 / §4.3 报告生成 / 编辑 / 导出
 */
import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Tabs, Card, Space, Button } from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  ExperimentOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';

const LedgerDemo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // PRD §3.3 报告详情页：完全独立呈现，无外层 Demo Header / Tabs
  //   报告页自身已经有 PageHeader(报告标题 + 编辑/导出按钮)
  const isReportRoute = location.pathname.endsWith('/report');
  if (isReportRoute) {
    return <Outlet />;
  }

  // 当前 tab key
  const tabKey = (() => {
    if (location.pathname.endsWith('/list')) return 'list';
    if (location.pathname.endsWith('/profile')) return 'profile';
    if (location.pathname.endsWith('/report')) return 'report';
    return 'list';
  })();

  const tabItems = [
    {
      key: 'list',
      label: (
        <Space size={6}>
          <UnorderedListOutlined />
          <span>§3.2.1 台账列表</span>
        </Space>
      ),
    },
    {
      key: 'profile',
      label: (
        <Space size={6}>
          <RobotOutlined />
          <span>§3.2.2 360 画像</span>
        </Space>
      ),
    },
    {
      key: 'report',
      label: (
        <Space size={6}>
          <FileTextOutlined />
          <span>§3.3 智能总结分析</span>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              size="small"
              onClick={() => navigate('/app/ledger')}
            />
            <ExperimentOutlined style={{ color: '#1677FF' }} />
            <span>统一台账中心智能化升级 Demo</span>
          </Space>
        }
        subTitle="依据《台账中心智能化升级-需求说明 V1》§3 信息科管理员 + §4 科室用户两端 Demo"
      />

      {/* Tabs 切换 */}
      <Card
        bordered={false}
        style={{ marginTop: 12, border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: 12 }}
      >
        <Tabs
          activeKey={tabKey}
          onChange={(k) => navigate(`/app/ledger-demo/${k}`)}
          items={tabItems}
        />
        <Outlet />
      </Card>
    </div>
  );
};

export default LedgerDemo;
