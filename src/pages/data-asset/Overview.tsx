/**
 * 医疗数据资产中心 - 模块总览
 * 规范：§四 导航结构 / §6 V1.4
 *
 * 作为 P0 的入口卡：两个一级入口
 *  1. 数据集资产列表 → 跳到 D1.1
 *  2. 采集任务列表   → 跳到 D2.1
 */
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Space, Tag, theme } from 'antd';
import {
  DatabaseOutlined,
  ApartmentOutlined,
  RightOutlined,
  ProfileOutlined,
  WarningOutlined,
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import {
  mockDatasets,
  mockCollectionTasks,
  mockExportTasks,
} from '../../mock/data-asset';

const { Text, Title } = Typography;

const Overview = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const totalRecords = mockDatasets.reduce((s, d) => s + d.recordTotal, 0);
  const todayNew = mockDatasets.reduce((s, d) => s + d.todayNew, 0);
  const enabledTasks = mockCollectionTasks.filter((t) => t.status === '已启用').length;
  const exceptionSum = mockCollectionTasks.reduce((s, t) => s + t.exceptionCount, 0);
  const pendingExport = mockExportTasks.filter(
    (t) => t.status === '排队中' || t.status === '打包中',
  ).length;

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title="医疗数据资产中心"
        subTitle="自动采集智能体多轮对话全量数据，导出 JSON 数据集供线下微调；新模型回流平台开启下一轮迭代"
        breadcrumb={[{ path: '/app/data-asset', breadcrumbName: '医疗数据资产中心' }]}
      />

      {/* 总览指标卡（§3.3 4 等分：Col span={6}，合计 24） */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <StatCard
            title="数据集"
            value={mockDatasets.length}
            suffix="个"
            icon={<DatabaseOutlined />}
            color="blue"
            onClick={() => navigate('/app/data-asset/datasets')}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="记录总数"
            value={totalRecords}
            suffix="条"
            icon={<ProfileOutlined />}
            color="purple"
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="今日新增"
            value={todayNew}
            suffix="条"
            icon={<ReloadOutlined />}
            color="green"
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="待处理异常"
            value={exceptionSum}
            suffix="条"
            icon={<WarningOutlined />}
            color="red"
            onClick={() => navigate('/app/data-asset/collection-tasks')}
          />
        </Col>
      </Row>

      {/* 两个一级入口卡（§3.3 左右等分 span 12） */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            hoverable
            onClick={() => navigate('/app/data-asset/datasets')}
            style={{ cursor: 'pointer', height: '100%' }}
            styles={{ body: { padding: 24 } }}
          >
            <Space size={20} align="start">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: '#E6F4FF',
                  color: token.colorPrimary,
                  fontSize: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DatabaseOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ margin: 0 }}>
                  数据集资产列表
                </Title>
                <Text type="secondary">
                  统一浏览全部已采集的数据集，查看核心统计指标，预览对话内容，发起 JSON 导出
                </Text>
                <div style={{ marginTop: 12 }}>
                  <Space wrap>
                    <Tag color="blue">数据集列表 D1.1</Tag>
                    <Tag color="blue">数据集详情 D1.2</Tag>
                    <Tag color="blue">数据预览 D1.3</Tag>
                    <Tag color="blue">导出任务与下载记录 D1.4</Tag>
                  </Space>
                </div>
                <div style={{ marginTop: 12, color: token.colorPrimary }}>
                  <Text>
                    进入列表 <RightOutlined />
                  </Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            hoverable
            onClick={() => navigate('/app/data-asset/collection-tasks')}
            style={{ cursor: 'pointer', height: '100%' }}
            styles={{ body: { padding: 24 } }}
          >
            <Space size={20} align="start">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: '#F9F0FF',
                  color: '#722ED1',
                  fontSize: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ApartmentOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ margin: 0 }}>
                  采集任务列表
                </Title>
                <Text type="secondary">
                  管理智能体采集任务与单智能体级开关，全量入库；查看采集日志，处理异常重试
                </Text>
                <div style={{ marginTop: 12 }}>
                  <Space wrap>
                    <Tag color="purple">采集任务列表 D2.1</Tag>
                    <Tag color="purple">新建 / 编辑任务 D2.2</Tag>
                    <Tag color="purple">采集日志与异常重试 D2.3</Tag>
                  </Space>
                </div>
                <div style={{ marginTop: 12, color: '#722ED1' }}>
                  <Text>
                    进入列表 <RightOutlined />
                  </Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 数据飞轮闭环示意（§3.3 单区块 span 24，内部用 flex 串联节点） */}
      <Card
        bordered={false}
        title={<Text strong>数据飞轮闭环</Text>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {[
                { icon: <DatabaseOutlined />, color: token.colorPrimary, title: '① 多轮对话', desc: 'Callback Handler 全量回流' },
                { icon: <ApartmentOutlined />, color: '#52C41A', title: '② 数据采集', desc: '单智能体级开关' },
                { icon: <DownloadOutlined />, color: '#FA8C16', title: '③ JSON 导出', desc: '对齐 SFT / DPO 框架' },
                { icon: <ProfileOutlined />, color: '#722ED1', title: '④ 线下微调 → 回流', desc: '开启下一轮迭代' },
              ].map((node, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ textAlign: 'center', padding: 8, flex: 1 }}>
                    <div style={{ fontSize: 28, color: node.color, marginBottom: 8 }}>
                      {node.icon}
                    </div>
                    <Text strong>{node.title}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{node.desc}</Text>
                    </div>
                  </div>
                  {i < 3 && (
                    <RightOutlined
                      style={{ color: token.colorTextSecondary, fontSize: 18, flexShrink: 0 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 状态概览（§3.3 三等分：Col span={8}，合计 24） */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="采集任务概览" bordered={false} style={{ height: '100%' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>
                已启用 <Text strong>{enabledTasks}</Text> /{' '}
                <Text type="secondary">{mockCollectionTasks.length}</Text> 个任务
              </Text>
              <Text>
                今日新增 <Text strong>{todayNew.toLocaleString()}</Text> 条
              </Text>
              <Text>
                异常队列 <Text type={exceptionSum > 0 ? 'danger' : 'secondary'} strong>{exceptionSum}</Text> 条
              </Text>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="数据集概览" bordered={false} style={{ height: '100%' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>
                数据集 <Text strong>{mockDatasets.length}</Text> 个，累计{' '}
                <Text strong>{totalRecords.toLocaleString()}</Text> 条
              </Text>
              <Text>
                Schema 版本 <Tag color="blue">v1.0</Tag> 统一预定义
              </Text>
              <Text>
                本期仅支持 <Tag color="orange">JSON</Tag> 导出
              </Text>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="导出任务概览" bordered={false} style={{ height: '100%' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>
                待处理 <Text strong>{pendingExport}</Text> 个
              </Text>
              <Text>
                累计 <Text strong>{mockExportTasks.length}</Text> 次导出
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                导出访问日志已推送至审计中心
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Overview;
