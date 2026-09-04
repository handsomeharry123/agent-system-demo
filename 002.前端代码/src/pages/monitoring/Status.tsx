/**
 * 8-3 状态监控（Status）
 * 需求文档：统一运行监控中心-需求说明文档 V1.6
 *
 * V1.6 布局规范：
 * - 顶部信息条 48px：左段标题+副标题，右段筛选
 * - 4 KPI 卡片：一行4卡，高度 88px（全部实例数 / 运行中实例数 / 异常实例数 / 离线实例数）
 * - 2 Tab：状态总览 / 资源健康检查
 * - Tab 1：智能体运行状态列表（10 列：智能体名称/归属科室/运行状态/实例数/心跳成功率/最近心跳时间/运行版本/台账版本/持续时长/关联告警/操作）
 * - Tab 2：4 项资源图表 2×2 网格（CPU/内存/GPU/磁盘，单图 220px）
 * - 右下角悬浮按钮「📡 异常与依赖」唤起 800px 宽右侧抽屉
 * - 列表列头中心跳成功率/运行版本/持续时长等指标列需加 ⓘ Tooltip
 */
import { Fragment, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Row, Col, Space, Typography, Tabs, Progress, Button, Tag, Select, FloatButton, Drawer, Statistic,
} from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined, PauseOutlined, CloseCircleOutlined,
  HeartOutlined, ReloadOutlined, SyncOutlined, DashboardOutlined, FilterOutlined, CaretDownOutlined, CaretUpOutlined,
  ApiOutlined, DatabaseOutlined, HddOutlined, AreaChartOutlined,
} from '@ant-design/icons';
import { Line, Column } from '@ant-design/charts';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartConfig = any;
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import PageHeader from '../../components/PageHeader';
import MetricLabel from '../../components/MetricLabel';
import {
  mockAgentStatus,
  mockAlertEvents,
  mockDependencyHeatmap,
  mockDependencyServices,
  type AgentStatus,
  type DependencyServiceCell,
} from '../../mock/monitoring';

const { Text } = Typography;
const chartBaseConfig: ChartConfig = {
  autoFit: true, pixelRatio: window.devicePixelRatio,
  appendPadding: [8, 8, 28, 8],
  xAxis: { label: { autoHide: false, autoRotate: false } },
};

// 4 类资源时序（V1.7：Tab2 CPU/内存/GPU 改为多线折线图，每实例一线）
const cpuUsageTrend = [
  { date: '06-25', 'agent-001': 62, 'agent-002': 85, 'agent-003': 42, 'agent-005': 70 },
  { date: '06-26', 'agent-001': 65, 'agent-002': 88, 'agent-003': 45, 'agent-005': 72 },
  { date: '06-27', 'agent-001': 58, 'agent-002': 82, 'agent-003': 40, 'agent-005': 68 },
  { date: '06-28', 'agent-001': 67, 'agent-002': 91, 'agent-003': 48, 'agent-005': 74 },
  { date: '06-29', 'agent-001': 63, 'agent-002': 86, 'agent-003': 43, 'agent-005': 71 },
  { date: '06-30', 'agent-001': 60, 'agent-002': 84, 'agent-003': 41, 'agent-005': 69 },
  { date: '07-01', 'agent-001': 65, 'agent-002': 88, 'agent-003': 45, 'agent-005': 72 },
];
const memoryUsageTrend = [
  { date: '06-25', 'agent-001': 55, 'agent-002': 75, 'agent-003': 60, 'agent-005': 54 },
  { date: '06-26', 'agent-001': 58, 'agent-002': 78, 'agent-003': 62, 'agent-005': 56 },
  { date: '06-27', 'agent-001': 53, 'agent-002': 72, 'agent-003': 58, 'agent-005': 52 },
  { date: '06-28', 'agent-001': 60, 'agent-002': 80, 'agent-003': 64, 'agent-005': 58 },
  { date: '06-29', 'agent-001': 56, 'agent-002': 76, 'agent-003': 61, 'agent-005': 55 },
  { date: '06-30', 'agent-001': 54, 'agent-002': 74, 'agent-003': 59, 'agent-005': 53 },
  { date: '07-01', 'agent-001': 58, 'agent-002': 78, 'agent-003': 62, 'agent-005': 56 },
];
const gpuUsageTrend = [
  { date: '06-25', 'agent-002-GPU1': 88, 'agent-002-GPU2': 85, 'agent-003-GPU1': 62 },
  { date: '06-26', 'agent-002-GPU1': 90, 'agent-002-GPU2': 86, 'agent-003-GPU1': 64 },
  { date: '06-27', 'agent-002-GPU1': 87, 'agent-002-GPU2': 84, 'agent-003-GPU1': 60 },
  { date: '06-28', 'agent-002-GPU1': 92, 'agent-002-GPU2': 88, 'agent-003-GPU1': 66 },
  { date: '06-29', 'agent-002-GPU1': 89, 'agent-002-GPU2': 85, 'agent-003-GPU1': 63 },
  { date: '06-30', 'agent-002-GPU1': 91, 'agent-002-GPU2': 87, 'agent-003-GPU1': 65 },
  { date: '07-01', 'agent-002-GPU1': 92, 'agent-002-GPU2': 88, 'agent-003-GPU1': 64 },
];
const diskUsageData = [
  { instance: 'agent-001', value: 45 }, { instance: 'agent-002', value: 68 },
  { instance: 'agent-003', value: 38 }, { instance: 'agent-005', value: 52 }, { instance: 'agent-007', value: 28 },
];

const Status = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [department, setDepartment] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [agent, setAgent] = useState<string[]>([]);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const actionRef = useRef<ActionType | undefined>(undefined);

  const statusSummary = useMemo(
    () => ({
      running: mockAgentStatus.filter((a) => a.status === '运行中').length,
      paused: mockAgentStatus.filter((a) => a.status === '暂停').length,
      abnormal: mockAgentStatus.filter((a) => a.status === '异常').length,
      offline: mockAgentStatus.filter((a) => a.status === '离线').length,
      total: mockAgentStatus.length,
    }),
    [],
  );

  const columns: ProColumns<AgentStatus>[] = [
    { title: '智能体名称', dataIndex: 'name', key: 'name', width: 220, fixed: 'left', ellipsis: true, render: (n: any) => <a>{n}</a> },
    { title: '归属科室', dataIndex: 'department', key: 'department', width: 100, valueType: 'select', valueEnum: { 心内科: { text: '心内科' }, 影像科: { text: '影像科' }, 医务科: { text: '医务科' }, 药剂科: { text: '药剂科' }, 急诊科: { text: '急诊科' }, 内科: { text: '内科' }, 门诊部: { text: '门诊部' }, 体检科: { text: '体检科' } } },
    {
      title: '运行状态', dataIndex: 'status', key: 'status', width: 110, valueType: 'select',
      valueEnum: { 运行中: { text: '运行中', status: 'Success' }, 暂停: { text: '暂停', status: 'Warning' }, 异常: { text: '异常', status: 'Error' }, 离线: { text: '离线', status: 'Default' } },
      render: (status: string) => {
        const map: Record<string, { color: string; icon: React.ReactNode }> = {
          运行中: { color: 'success', icon: <CheckCircleOutlined /> },
          暂停: { color: 'warning', icon: <PauseOutlined /> },
          异常: { color: 'error', icon: <ExclamationCircleOutlined /> },
          离线: { color: 'default', icon: <CloseCircleOutlined /> },
        };
        const cfg = map[status] || map['离线'];
        return <Tag color={cfg.color} icon={cfg.icon}>{status}</Tag>;
      },
    },
    {
      title: '实例数（在线/应在线）', key: 'instances', width: 150,
      render: (_, r) => (
        <Text type={r.instances.online < r.instances.expected ? 'danger' : 'secondary'}>
          {r.instances.online} / {r.instances.expected}
        </Text>
      ),
    },
    {
      title: <MetricLabel name="心跳成功率" />, key: 'heartbeatSuccessRate', width: 130, sorter: (a, b) => a.heartbeatSuccessRate - b.heartbeatSuccessRate,
      render: (_, r) => {
        const rate = r.heartbeatSuccessRate * 100;
        return <Text type={rate < 99.95 ? 'danger' : 'secondary'}>{rate.toFixed(2)}%</Text>;
      },
    },
    { title: '最近心跳时间', dataIndex: 'lastHeartbeatAt', key: 'lastHeartbeatAt', width: 170, render: (t: string) => <Text type="secondary">{t ? t.split('T').join(' ').split('+')[0] : '—'}</Text> },
    {
      title: <MetricLabel name="运行版本 / 台账版本" />, key: 'version', width: 200,
      render: (_, r) => {
        const mismatch = r.runVersion !== r.registryVersion;
        return (
          <Space size={4}>
            <Text type={mismatch ? 'danger' : 'secondary'}>{r.runVersion} / {r.registryVersion}</Text>
            {mismatch && <span style={{ color: '#FF4D4F' }}>❌</span>}
          </Space>
        );
      },
    },
    {
      title: <MetricLabel name="持续时长" />, key: 'duration', width: 130,
      render: (_, r) => {
        const m = r.statusDurationMinutes;
        const d = Math.floor(m / 1440);
        const h = Math.floor((m % 1440) / 60);
        const mm = m % 60;
        const fmt = d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${mm}m` : `${mm}m`;
        const color = r.status === '异常' ? 'danger' : r.status === '离线' ? 'secondary' : 'success';
        return <Text type={color as any}>{r.status} {fmt}</Text>;
      },
    },
    {
      title: '关联告警', key: 'relatedAlert', width: 200,
      render: (_, r) => r.relatedAlert
        ? <Link to={`/app/monitoring/alert-events`}><Button type="link" size="small" danger>{r.relatedAlert.summary}</Button></Link>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right', valueType: 'option',
      render: (_, r) => [
        <Button key="retry" type="link" size="small" icon={<SyncOutlined />}>重试健康检查</Button>,
        <Button key="sync" type="link" size="small">同步台账版本</Button>,
      ],
    },
  ];

  // 资源健康检查图表区（V1.7：CPU / 内存 / GPU 改为多线折线图，每实例一线 + 阈值线）
  const renderResourceTab = () => (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="CPU 使用率" prefix={<ApiOutlined />} />} extra={<Button type="link" size="small">查看详情</Button>} bodyStyle={{ padding: 12 }} style={{ overflow: 'hidden', height: 220 }}>
          <Line
            {...chartBaseConfig}
            height={172}
            data={cpuUsageTrend.flatMap((d) =>
              Object.keys(d).filter((k) => k !== 'date').map((k) => ({ date: d.date, instance: k, value: d[k as keyof typeof d] as number })),
            )}
            xField="date" yField="value" colorField="instance"
            color={['#1677FF', '#722ED1', '#52C41A', '#FA8C16']}
            yAxis={{ label: { formatter: (v: number) => `${v}%` }, max: 100 }}
            annotations={[
              { type: 'lineY', yField: 80, style: { stroke: '#FF4D4F', lineDash: [4, 4], lineWidth: 1 } },
            ]}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="内存使用率" prefix={<DatabaseOutlined />} />} extra={<Button type="link" size="small">查看详情</Button>} bodyStyle={{ padding: 12 }} style={{ overflow: 'hidden', height: 220 }}>
          <Line
            {...chartBaseConfig}
            height={172}
            data={memoryUsageTrend.flatMap((d) =>
              Object.keys(d).filter((k) => k !== 'date').map((k) => ({ date: d.date, instance: k, value: d[k as keyof typeof d] as number })),
            )}
            xField="date" yField="value" colorField="instance"
            color={['#52C41A', '#1677FF', '#722ED1', '#FA8C16']}
            yAxis={{ label: { formatter: (v: number) => `${v}%` }, max: 100 }}
            annotations={[
              { type: 'lineY', yField: 80, style: { stroke: '#FF4D4F', lineDash: [4, 4], lineWidth: 1 } },
            ]}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="GPU 显存使用率" prefix={<AreaChartOutlined />} />} extra={<Button type="link" size="small">查看详情</Button>} bodyStyle={{ padding: 12 }} style={{ overflow: 'hidden', height: 220 }}>
          <Line
            {...chartBaseConfig}
            height={172}
            data={gpuUsageTrend.flatMap((d) =>
              Object.keys(d).filter((k) => k !== 'date').map((k) => ({ date: d.date, instance: k, value: d[k as keyof typeof d] as number })),
            )}
            xField="date" yField="value" colorField="instance"
            color={['#1677FF', '#722ED1', '#52C41A']}
            yAxis={{ label: { formatter: (v: number) => `${v}%` }, max: 100 }}
            annotations={[
              { type: 'lineY', yField: 85, style: { stroke: '#FF4D4F', lineDash: [4, 4], lineWidth: 1 } },
            ]}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card bordered={false} title={<MetricLabel name="磁盘使用率" prefix={<HddOutlined />} />} extra={<Button type="link" size="small">查看详情</Button>} bodyStyle={{ padding: 12 }} style={{ overflow: 'hidden', height: 220 }}>
          <Column
            {...chartBaseConfig}
            height={172}
            data={diskUsageData.map((it) => ({
              ...it,
              color: it.value > 80 ? 'high' : it.value >= 60 ? 'mid' : 'low',
            }))}
            xField="instance"
            yField="value"
            colorField="color"
            scale={{ color: { range: ['#52C41A', '#FAAD14', '#FF4D4F'] } }}
            legend={false}
          />
        </Card>
      </Col>
    </Row>
  );

  // 异常事件与依赖服务 - 抽屉
  const renderExceptionDrawer = () => (
    <Drawer
      title="异常事件与依赖服务"
      placement="right"
      width={800}
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
    >
      {/* 异常事件 */}
      <Card bordered={false} title={<MetricLabel name="异常事件次数（按级别堆叠）" />} size="small" style={{ marginBottom: 16 }}>
        <Column
          {...chartBaseConfig}
          height={220}
          data={[
            { date: '06-25', P0: 1, P1: 2, P2: 3 },
            { date: '06-26', P0: 0, P1: 3, P2: 2 },
            { date: '06-27', P0: 2, P1: 1, P2: 4 },
            { date: '06-28', P0: 1, P1: 4, P2: 2 },
            { date: '06-29', P0: 0, P1: 2, P2: 3 },
            { date: '06-30', P0: 1, P1: 3, P2: 5 },
            { date: '07-01', P0: 2, P1: 1, P2: 2 },
          ]}
          xField="date"
          yField={['P0', 'P1', 'P2']}
          stack
          color={['#FF4D4F', '#FA8C16', '#1677FF']}
          legend={{ position: 'top' }}
        />
        <div style={{ marginTop: 12, maxHeight: 160, overflow: 'auto' }}>
          {mockAlertEvents.slice(0, 6).map((e) => (
            <div key={e.id} style={{ padding: '6px 0', borderBottom: '1px dashed #f0f0f0', fontSize: 12 }}>
              <Space>
                <Tag color={e.level === 'severe' ? 'error' : e.level === 'warning' ? 'warning' : 'processing'}>{e.level === 'severe' ? 'P0' : e.level === 'warning' ? 'P1' : 'P2'}</Tag>
                <Text>{e.agentName} · {e.ruleName}</Text>
                <Text type="secondary" style={{ marginLeft: 'auto' }}>{e.timestamp.split('T').join(' ').split('+')[0]}</Text>
              </Space>
            </div>
          ))}
        </div>
      </Card>
      {/* 依赖服务可用率 - 热力图（用 24 列压缩展示） */}
      <Card bordered={false} title={<MetricLabel name="依赖服务可用率（近 24 个 5min 窗口）" />} size="small">
        <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(24, 1fr)`, gap: 2, alignItems: 'center' }}>
          <div />
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} style={{ fontSize: 10, color: '#8c8c8c', textAlign: 'center' }}>{(i * 5).toString().padStart(2, '0')}</div>
          ))}
          {mockDependencyServices.map((dep) => (
            <Fragment key={dep.key}>
              <div style={{ fontSize: 12, color: '#595959' }}>{dep.key}</div>
              {mockDependencyHeatmap.filter((c) => c.dependency === dep.key).map((cell, idx) => {
                const color = cell.availability >= 0.9995 ? '#52C41A' : cell.availability >= 0.999 ? '#FAAD14' : '#FF4D4F';
                return (
                  <div
                    key={`${dep.key}-${idx}`}
                    title={`${dep.key} · 可用率 ${(cell.availability * 100).toFixed(3)}%`}
                    style={{ height: 18, background: color, opacity: 0.4 + cell.availability * 0.6, borderRadius: 2 }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
          颜色说明：<Tag color="success">≥ 99.95%</Tag><Tag color="warning">≥ 99.9%</Tag><Tag color="error">&lt; 99.9%</Tag>
        </div>
      </Card>
    </Drawer>
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* 标题 + 筛选条（同一行） */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        minHeight: 48, padding: '8px 16px', background: '#fff', borderRadius: 8, marginBottom: 16,
      }}>
        <Space size={8} align="baseline">
          <Text strong style={{ fontSize: 16 }}>状态监控</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>哪些智能体在线、哪些异常需排查</Text>
        </Space>
        <Space size={8} wrap>
          <Select placeholder="时间范围" style={{ width: 120 }} defaultValue="today"
            options={[{ label: '今日', value: 'today' }, { label: '近 7 天', value: '7d' }, { label: '近 30 天', value: '30d' }, { label: '自定义', value: 'custom' }]} />
          <Select mode="multiple" placeholder="科室筛选" style={{ width: 140 }} value={department} onChange={setDepartment} allowClear maxTagCount="responsive"
            options={['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '门诊部', '体检科'].map((v) => ({ label: v, value: v }))} />
          <Select mode="multiple" placeholder="智能体筛选" style={{ width: 160 }} value={agent} onChange={setAgent} allowClear maxTagCount="responsive" showSearch
            options={['心电图智能辅助诊断系统', '胸部 CT 影像智能分析平台', '病历智能生成与质控系统', '智能导诊与分诊系统', '智能问诊系统'].map((v) => ({ label: v, value: v }))} />
          <Select mode="multiple" placeholder="状态筛选" style={{ width: 120 }} value={statusFilter} onChange={setStatusFilter} allowClear maxTagCount="responsive"
            options={[{ label: '运行中', value: '运行中' }, { label: '暂停', value: '暂停' }, { label: '异常', value: '异常' }, { label: '离线', value: '离线' }]} />
          <Button icon={<ReloadOutlined />} style={{ width: 32, height: 32, padding: 0 }} />
        </Space>
      </div>

      {/* 4 KPI 卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false} hoverable style={{ background: '#E6F4FF', height: 88, overflow: 'hidden' }} bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={2}>
              <MetricLabel name="全部实例数" variant="kpi" prefix={<DatabaseOutlined style={{ color: '#1677FF' }} />} />
              <Text style={{ fontSize: 30, fontWeight: 600, color: '#1677FF' }}>{statusSummary.total}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>个智能体</Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable style={{ background: '#F6FFED', height: 88, overflow: 'hidden' }} bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={2}>
              <MetricLabel name="运行中实例数" variant="kpi" prefix={<CheckCircleOutlined style={{ color: '#52C41A' }} />} />
              <Text style={{ fontSize: 30, fontWeight: 600, color: '#52C41A' }}>{statusSummary.running}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>个智能体</Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable style={{ background: '#FFF1F0', height: 88, overflow: 'hidden' }} bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={2}>
              <MetricLabel name="异常实例数" variant="kpi" prefix={<ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />} />
              <Text style={{ fontSize: 30, fontWeight: 600, color: '#FF4D4F' }}>{statusSummary.abnormal}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>个智能体</Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable style={{ background: '#F5F5F5', height: 88, overflow: 'hidden' }} bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={2}>
              <MetricLabel name="离线实例数" variant="kpi" prefix={<CloseCircleOutlined style={{ color: '#8C8C8C' }} />} />
              <Text style={{ fontSize: 30, fontWeight: 600, color: '#8C8C8C' }}>{statusSummary.offline}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>个智能体</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Tab 内容区 */}
      <Card bordered={false} style={{ overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '状态总览',
              children: (
                <>
                  <Card bordered={false} size="small" style={{ marginBottom: 12, background: '#FAFAFA' }}>
                    <Space style={{ marginBottom: filterExpanded ? 12 : 0 }} onClick={() => setFilterExpanded((v) => !v)}>
                      <FilterOutlined /><Text strong style={{ fontSize: 13 }}>高级筛选</Text>
                      {filterExpanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
                    </Space>
                    {filterExpanded && (
                      <Row gutter={[16, 8]}>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>智能体名称</Text><input placeholder="模糊匹配" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>归属科室</Text><Select mode="multiple" placeholder="全部" style={{ width: '100%' }} options={['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '门诊部', '体检科'].map((v) => ({ label: v, value: v }))} /></Col>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>运行状态</Text><Select mode="multiple" placeholder="全部" style={{ width: '100%' }} options={[{ label: '运行中', value: '运行中' }, { label: '暂停', value: '暂停' }, { label: '异常', value: '异常' }, { label: '离线', value: '离线' }]} /></Col>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>心跳成功率</Text><input placeholder=">= / <=" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>最后心跳时间</Text><input placeholder="时间范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>持续时长 (分钟)</Text><input placeholder="数字范围" style={{ width: '100%', padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} /></Col>
                        <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>关联告警</Text><Select placeholder="全部" style={{ width: '100%' }} options={[{ label: '有', value: 'yes' }, { label: '无', value: 'no' }]} /></Col>
                        <Col span={18} />
                        <Col span={6} style={{ textAlign: 'right' }}>
                          <Space><Button>重置</Button><Button type="primary">查询</Button></Space>
                        </Col>
                      </Row>
                    )}
                  </Card>
                  <ProTable<AgentStatus>
                    headerTitle="智能体运行状态列表"
                    rowKey="id"
                    actionRef={actionRef}
                    search={false}
                    columns={columns}
                    dataSource={mockAgentStatus}
                    pagination={{
                      defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true,
                      pageSizeOptions: ['20', '50', '100'], showTotal: (total) => `共 ${total} 条`,
                    }}
                    scroll={{ x: 1500 }}
                    toolBarRender={() => [
                      <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>,
                    ]}
                  />
                </>
              ),
            },
            {
              key: 'resource',
              label: '资源健康检查',
              children: renderResourceTab(),
            },
          ]}
        />
      </Card>

      {/* 右下角悬浮按钮：异常与依赖 */}
      <FloatButton
        icon={<DashboardOutlined />}
        tooltip="异常与依赖"
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setDrawerOpen(true)}
      />

      {renderExceptionDrawer()}
    </div>
  );
};

// 进度条规范布局
const ProgressRow = ({ instance, value, dangerThreshold }: { instance: string; value: number; dangerThreshold: number }) => {
  const isDanger = value > dangerThreshold;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: '0 0 140px', color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>{instance}</span>
      <Progress
        percent={value} size="small"
        strokeColor={isDanger ? '#FF4D4F' : '#52C41A'}
        style={{ flex: 1 }} showInfo={false}
      />
      <span style={{ flex: '0 0 60px', textAlign: 'right', color: isDanger ? '#FF4D4F' : 'rgba(0,0,0,0.65)', fontSize: 12 }}>{value}%</span>
    </div>
  );
};

export default Status;
