/**
 * 8-1 监控总览页（V1.6 紧凑一屏版）
 * 需求文档：统一运行监控中心-需求说明文档 V1.6
 *
 * 布局规范（V1.6）：
 * - 顶部信息条 48px：左段「告警状态（无则留空）+ 最新告警摘要」；右段「时间范围 + 科室 + 智能体 + 刷新 + 告警管理」
 * - KPI 卡片区：一行 4 卡等宽，高度 88px
 *   1) 今日调用量  2) 运行状态分布  3) 本月成本  4) 待处理告警数
 * - 图表区：3 列 × 2 行 = 6 图，单图固定 240px 高
 *   1) 调用量趋势  2) 任务完成率趋势  3) 运行状态分布趋势
 *   4) 成本趋势  5) 告警趋势  6) 智能体健康排行（Top 7）
 */
import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Space, Button, Select, Tag, Empty, Badge, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import {
  ReloadOutlined, SettingOutlined, LineChartOutlined, BarChartOutlined,
  AreaChartOutlined, TrophyOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Line, Column, Area } from '@ant-design/charts';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartConfig = any;
import MetricLabel from '../../components/MetricLabel';
import { LoadingSkeleton, ErrorRetry } from '../../components/PageStates';
import {
  mockHealthRanking,
  mockAlertIncidents,
  type AlertIncident,
} from '../../mock/monitoring';

const { Text } = Typography;

const chartBaseConfig: ChartConfig = {
  autoFit: true,
  pixelRatio: window.devicePixelRatio,
  appendPadding: [8, 8, 28, 8],
  xAxis: { label: { autoHide: false, autoRotate: false } },
  legend: { position: 'top', itemName: { style: { fontSize: 11 } } },
};

const levelColor = (lv: AlertIncident['level']) =>
  lv === 'severe' ? '#FF4D4F' : lv === 'warning' ? '#FA8C16' : '#1677FF';
const levelLabel = (lv: AlertIncident['level']) =>
  lv === 'severe' ? '严重' : lv === 'warning' ? '警告' : '提示';

const Home = () => {
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [department, setDepartment] = useState<string[]>([]);
  const [agent, setAgent] = useState<string[]>([]);
  // V1.7 页面通用状态规范：演示用加载/错误切换；默认走数据态
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  // 演示用：URL 中带 ?demoState=loading|error 切换状态
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const state = params.get('demoState');
    if (state === 'loading') setLoading(true);
    if (state === 'error') setErrored(true);
  }, []);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (errored) return <ErrorRetry onRetry={() => setErrored(false)} />;

  // 4 张 KPI（V1.6 新增第 4 张：待处理告警数）
  const stats = {
    todayCalls: { value: 12834, wow: 0.082 },
    runStatus: { online: 12, offline: 1, abnormal: 1 },
    monthCost: { value: 45620, unit: '元', wow: 0.06 },
    pendingAlerts: {
      count: mockAlertIncidents.filter((e) => e.status === 'pending' || e.status === 'processing').length,
      highestLevel: 'severe' as AlertIncident['level'],
      wow: 1,
    },
  };

  // 未处理告警（按级别倒序）
  const pendingIncidents = mockAlertIncidents
    .filter((e) => e.status === 'pending' || e.status === 'processing')
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'severe' ? -1 : 1));
  const topAlert = pendingIncidents[0];

  // 6 图数据
  const callTrend = [
    { date: '06-25', v: 10200 }, { date: '06-26', v: 11500 },
    { date: '06-27', v: 10800 }, { date: '06-28', v: 12200 },
    { date: '06-29', v: 11900 }, { date: '06-30', v: 12500 },
    { date: '07-01', v: 12834 },
  ];
  const completionRateTrend = [
    { date: '06-25', v: 97.8 }, { date: '06-26', v: 98.0 },
    { date: '06-27', v: 98.1 }, { date: '06-28', v: 98.0 },
    { date: '06-29', v: 98.3 }, { date: '06-30', v: 98.4 },
    { date: '07-01', v: 98.2 },
  ];
  const runStatusTrendRaw = [
    { date: '06-25', online: 13, offline: 1, abnormal: 1 },
    { date: '06-26', online: 13, offline: 1, abnormal: 1 },
    { date: '06-27', online: 12, offline: 1, abnormal: 2 },
    { date: '06-28', online: 12, offline: 1, abnormal: 2 },
    { date: '06-29', online: 12, offline: 1, abnormal: 2 },
    { date: '06-30', online: 12, offline: 1, abnormal: 1 },
    { date: '07-01', online: 12, offline: 1, abnormal: 1 },
  ];
  const runStatusTrend = runStatusTrendRaw.flatMap((d) => [
    { date: d.date, type: '运行中', value: d.online },
    { date: d.date, type: '离线', value: d.offline },
    { date: d.date, type: '异常', value: d.abnormal },
  ]);
  const costTrend = [
    { date: '06-25', v: 6200 }, { date: '06-26', v: 6800 },
    { date: '06-27', v: 6500 }, { date: '06-28', v: 7100 },
    { date: '06-29', v: 6900 }, { date: '06-30', v: 7300 },
    { date: '07-01', v: 7050 },
  ];
  const alertTrendRaw = [
    { date: '06-25', severe: 1, warning: 2, info: 3 },
    { date: '06-26', severe: 0, warning: 3, info: 2 },
    { date: '06-27', severe: 2, warning: 1, info: 4 },
    { date: '06-28', severe: 1, warning: 4, info: 2 },
    { date: '06-29', severe: 0, warning: 2, info: 3 },
    { date: '06-30', severe: 1, warning: 3, info: 5 },
    { date: '07-01', severe: 2, warning: 1, info: 2 },
  ];
  const alertTrend = alertTrendRaw.flatMap((d) => [
    { date: d.date, level: '严重', value: d.severe },
    { date: d.date, level: '警告', value: d.warning },
    { date: d.date, level: '提示', value: d.info },
  ]);

  const topBar = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 48,
      padding: '6px 16px',
      background: '#fff',
      borderRadius: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    }}>
      {/* 左段：告警状态 + 最新告警摘要（V1.6：仅在有未处理告警时展示，跳转 8-5） */}
      <div style={{ flex: '1 1 60%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
        {topAlert ? (
          <>
            <Link to="/app/monitoring/alert-events">
              <Space size={6} style={{ cursor: 'pointer' }}>
                <Badge color={levelColor(topAlert.level)} />
                <Text strong style={{ color: levelColor(topAlert.level) }}>
                  {stats.pendingAlerts.count} 个未处理告警
                </Text>
                <Tag color={levelColor(topAlert.level)} style={{ margin: 0 }}>
                  最高 {levelLabel(topAlert.level)}
                </Tag>
              </Space>
            </Link>
            <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
            <Tooltip title={topAlert.title}>
              <Link to="/app/monitoring/alert-events" style={{ minWidth: 0, flex: 1 }}>
                <Text style={{ fontSize: 12 }} ellipsis>
                  最新：{topAlert.target.name} — {topAlert.ruleName}
                </Text>
              </Link>
            </Tooltip>
            <Link to="/app/monitoring/alert-events">
              <Button type="link" size="small" style={{ padding: 0 }}>查看详情</Button>
            </Link>
          </>
        ) : null}
      </div>

      {/* 右段：筛选与全局操作 */}
      <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
        <Space size={6} wrap style={{ maxWidth: 720, justifyContent: 'flex-end' }}>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 110 }}
            size="middle"
            options={[
              { label: '今日', value: 'today' },
              { label: '近 7 天', value: '7d' },
              { label: '近 30 天', value: '30d' },
              { label: '自定义', value: 'custom' },
            ]}
          />
          <Select
            mode="multiple"
            placeholder="科室筛选"
            style={{ width: 130 }}
            value={department}
            onChange={setDepartment}
            allowClear
            maxTagCount="responsive"
            size="middle"
            options={[
              { label: '心内科', value: '心内科' },
              { label: '影像科', value: '影像科' },
              { label: '医务科', value: '医务科' },
              { label: '药剂科', value: '药剂科' },
              { label: '急诊科', value: '急诊科' },
              { label: '内科', value: '内科' },
              { label: '门诊部', value: '门诊部' },
              { label: '体检科', value: '体检科' },
            ]}
          />
          <Select
            mode="multiple"
            placeholder="智能体筛选"
            style={{ width: 150 }}
            value={agent}
            onChange={setAgent}
            allowClear
            maxTagCount="responsive"
            size="middle"
            showSearch
            options={[
              { label: '心电图智能辅助诊断系统', value: 'agent-001' },
              { label: '胸部 CT 影像智能分析平台', value: 'agent-002' },
              { label: '病历智能生成与质控系统', value: 'agent-003' },
              { label: '处方智能审核与用药安全系统', value: 'agent-004' },
              { label: '智能导诊与分诊系统', value: 'agent-005' },
              { label: '智能问诊系统', value: 'agent-006' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            size="middle"
            style={{ width: 32, height: 32, padding: 0 }}
            aria-label="刷新"
          />
        </Space>
        <Link to="/app/monitoring/alerts" style={{ marginLeft: 8, flexShrink: 0 }}>
          <Button icon={<SettingOutlined />} size="middle">告警管理</Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* ① 顶部信息条 */}
      {topBar}

      {/* ② KPI 卡片区：一行 4 卡，高度 88px */}
      <Row gutter={[12, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Link to="/app/monitoring/business">
            <Card bordered={false} hoverable styles={{ body: { padding: 12, height: 88, overflow: 'hidden' } }}>
              <Space direction="vertical" size={2}>
                <MetricLabel name="今日调用量" variant="kpi" />
                <Text strong style={{ fontSize: 28, fontWeight: 600, color: '#1677FF', lineHeight: 1.2 }}>
                  12,834
                </Text>
                <Space size={4}>
                  <Text type="secondary" style={{ fontSize: 12 }}>次</Text>
                  <Text style={{ fontSize: 12, color: stats.todayCalls.wow >= 0 ? '#52C41A' : '#FF4D4F' }}>
                    {stats.todayCalls.wow >= 0 ? '↑' : '↓'} {(stats.todayCalls.wow * 100).toFixed(1)}%
                  </Text>
                </Space>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col span={6}>
          <Link to="/app/monitoring/status">
            <Card bordered={false} hoverable styles={{ body: { padding: 12, height: 88, overflow: 'hidden' } }}>
              <Space direction="vertical" size={2}>
                <MetricLabel name="运行状态分布" variant="kpi" />
                <Space size={6} align="center">
                  <Space size={2}><Badge status="success" /><Text strong style={{ fontSize: 20, color: '#52C41A' }}>{stats.runStatus.online}</Text></Space>
                  <Text type="secondary">/</Text>
                  <Space size={2}><Badge status="default" /><Text strong style={{ fontSize: 20, color: '#8C8C8C' }}>{stats.runStatus.offline}</Text></Space>
                  <Text type="secondary">/</Text>
                  <Space size={2}><Badge status="error" /><Text strong style={{ fontSize: 20, color: '#FF4D4F' }}>{stats.runStatus.abnormal}</Text></Space>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>在线 / 离线 / 异常</Text>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col span={6}>
          <Link to="/app/monitoring/cost">
            <Card bordered={false} hoverable styles={{ body: { padding: 12, height: 88, overflow: 'hidden' } }}>
              <Space direction="vertical" size={2}>
                <MetricLabel name="本月成本" variant="kpi" />
                <Text strong style={{ fontSize: 28, fontWeight: 600, color: '#FA8C16', lineHeight: 1.2 }}>
                  45,620
                </Text>
                <Space size={4}>
                  <Text type="secondary" style={{ fontSize: 12 }}>元</Text>
                  <Text style={{ fontSize: 12, color: stats.monthCost.wow >= 0 ? '#52C41A' : '#FF4D4F' }}>
                    {stats.monthCost.wow >= 0 ? '↑' : '↓'} {(stats.monthCost.wow * 100).toFixed(1)}%
                  </Text>
                </Space>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col span={6}>
          <Link to="/app/monitoring/alert-events">
            <Card bordered={false} hoverable styles={{ body: { padding: 12, height: 88, overflow: 'hidden' } }}>
              <Space direction="vertical" size={2}>
                <MetricLabel name="待处理告警数" variant="kpi" />
                <Space size={4} align="baseline">
                  <ExclamationCircleOutlined style={{ color: levelColor(stats.pendingAlerts.highestLevel) }} />
                  <Text strong style={{ fontSize: 28, fontWeight: 600, color: levelColor(stats.pendingAlerts.highestLevel), lineHeight: 1.2 }}>
                    {stats.pendingAlerts.count}
                  </Text>
                  <Tag color={levelColor(stats.pendingAlerts.highestLevel)} style={{ margin: 0 }}>
                    最高 {levelLabel(stats.pendingAlerts.highestLevel)}
                  </Tag>
                </Space>
                <Space size={4}>
                  <Text type="secondary" style={{ fontSize: 12 }}>环比</Text>
                  <Text style={{ fontSize: 12, color: stats.pendingAlerts.wow >= 0 ? '#FF4D4F' : '#52C41A' }}>
                    {stats.pendingAlerts.wow >= 0 ? '↑' : '↓'} {Math.abs(stats.pendingAlerts.wow)}
                  </Text>
                </Space>
              </Space>
            </Card>
          </Link>
        </Col>
      </Row>

      {/* ③ 图表区：3 列 × 2 行 = 6 图，单图固定 240px 高 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card
            bordered={false}
            title={<MetricLabel name="调用量趋势" prefix={<LineChartOutlined />} />}
            extra={<Link to="/app/monitoring/business"><Button type="link" size="small">查看详情</Button></Link>}
            styles={{ body: { padding: 8, height: 188, overflow: 'hidden' } }}
            style={{ height: 240 }}
            headStyle={{ padding: '0 12px', minHeight: 40 }}
          >
            <Line
              {...chartBaseConfig}
              height={188}
              data={callTrend}
              xField="date"
              yField="v"
              smooth
              color="#1677FF"
              legend={false}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            bordered={false}
            title={<MetricLabel name="任务完成率趋势" prefix={<LineChartOutlined />} />}
            extra={<Link to="/app/monitoring/business"><Button type="link" size="small">查看详情</Button></Link>}
            styles={{ body: { padding: 8, height: 188, overflow: 'hidden' } }}
            style={{ height: 240 }}
            headStyle={{ padding: '0 12px', minHeight: 40 }}
          >
            <Line
              {...chartBaseConfig}
              height={188}
              data={completionRateTrend}
              xField="date"
              yField="v"
              smooth
              color="#52C41A"
              legend={false}
              annotations={[
                {
                  type: 'lineY',
                  yField: 95,
                  style: { stroke: '#FF4D4F', lineDash: [4, 4], lineWidth: 1 },
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            bordered={false}
            title={<MetricLabel name="运行状态分布趋势" prefix={<AreaChartOutlined />} />}
            extra={<Link to="/app/monitoring/status"><Button type="link" size="small">查看详情</Button></Link>}
            styles={{ body: { padding: 8, height: 188, overflow: 'hidden' } }}
            style={{ height: 240 }}
            headStyle={{ padding: '0 12px', minHeight: 40 }}
          >
            <Area
              {...chartBaseConfig}
              height={188}
              data={runStatusTrend}
              xField="date"
              yField="value"
              colorField="type"
              stack
              color={['#52C41A', '#8C8C8C', '#FF4D4F']}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card
            bordered={false}
            title={<MetricLabel name="成本趋势" prefix={<BarChartOutlined />} />}
            extra={<Link to="/app/monitoring/cost"><Button type="link" size="small">查看详情</Button></Link>}
            styles={{ body: { padding: 8, height: 188, overflow: 'hidden' } }}
            style={{ height: 240 }}
            headStyle={{ padding: '0 12px', minHeight: 40 }}
          >
            <Column
              {...chartBaseConfig}
              height={188}
              data={costTrend}
              xField="date"
              yField="v"
              color="#FA8C16"
              legend={false}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            bordered={false}
            title={<MetricLabel name="告警趋势（按级别）" prefix={<BarChartOutlined />} />}
            extra={<Link to="/app/monitoring/alert-events"><Button type="link" size="small">查看详情</Button></Link>}
            styles={{ body: { padding: 8, height: 188, overflow: 'hidden' } }}
            style={{ height: 240 }}
            headStyle={{ padding: '0 12px', minHeight: 40 }}
          >
            <Column
              {...chartBaseConfig}
              height={188}
              data={alertTrend}
              xField="date"
              yField="value"
              stack
              colorField="level"
              color={['#FF4D4F', '#FA8C16', '#1677FF']}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            bordered={false}
            title={<MetricLabel name="智能体健康排行 (Top 7)" prefix={<TrophyOutlined />} />}
            extra={<Link to="/app/monitoring/status"><Button type="link" size="small">查看详情</Button></Link>}
            styles={{ body: { padding: 4, height: 188, overflow: 'hidden' } }}
            style={{ height: 240 }}
            headStyle={{ padding: '0 12px', minHeight: 40 }}
          >
            {mockHealthRanking.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {mockHealthRanking.slice(0, 7).map((row) => {
                  const statusColor =
                    row.status === '运行中' ? '#52C41A' :
                    row.status === '异常' ? '#FF4D4F' :
                    row.status === '暂停' ? '#FAAD14' : '#8C8C8C';
                  return (
                    <Tooltip
                      key={row.agentId}
                      title={`${row.agentName} · 健康度 ${row.score} · ${row.status}`}
                    >
                      <Link to="/app/monitoring/status">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: 24,
                            padding: '0 8px',
                            borderRadius: 4,
                            gap: 8,
                          }}
                        >
                          <span style={{ flex: '0 0 20px', color: '#8C8C8C', fontSize: 12 }}>{row.rank}</span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 13,
                            }}
                          >
                            {row.agentName}
                          </span>
                          <span
                            style={{
                              flex: '0 0 44px',
                              textAlign: 'right',
                              fontSize: 13,
                              color: row.score >= 95 ? '#52C41A' : row.score >= 90 ? '#FA8C16' : '#FF4D4F',
                              fontWeight: 500,
                            }}
                          >
                            {row.score.toFixed(1)}
                          </span>
                          <span style={{ flex: '0 0 40px', textAlign: 'right' }}>
                            <Tag color={statusColor} style={{ margin: 0, padding: '0 4px', fontSize: 12 }}>
                              {row.status}
                            </Tag>
                          </span>
                        </div>
                      </Link>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
