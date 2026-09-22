/**
 * 2.1 业务监控页（V1.8）
 * 需求文档：统一运行监控中心-需求说明文档 V1.8 §2
 *
 * 字段：
 *  - 智能体累计调用次数（点击进入审计日志）
 *  - 智能体成功调用率（≥95% 绿 / <95% 黄 / <90% 红）
 *  - 当日调用次数（带 ↑↓ 趋势）
 *  - 当日成功调用率（颜色状态）
 *  - 调用次数日/周/月趋势（3 折线）
 *  - 高频调用智能体 TOP5 + 科室排行
 *  - 并发数（实时数值 + 峰值 + 动态波动图）
 *  - 吞吐量（实时数值 + 峰值 + 动态波动图）
 *  - 响应超时率（≤1% 绿 / 1-5% 黄 / >5% 红）
 *  - 医生采纳率（% + 趋势图）
 *
 * 仅 IT 管理员可见；自动刷新 60s + 手动【刷新】
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Space, Button, Spin, Tag, Segmented,
} from 'antd';
import {
  ReloadOutlined, RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import MetricLabel from '../../components/MetricLabel';
import './monitoring-dashboard.css';
import { useAuth } from '../../hooks/useAuth';
import { useSmartDraft } from '../agent-center/smart/store';
import {
  businessKpiV18,
  responseTimeDistV18,
  topCallAgentsV18,
} from '../../mock/monitoringV18';

const { Text } = Typography;

type TrendRange = '7d' | '1m' | '6m' | '1y';

const trendRangeOptions: Array<{ label: string; value: TrendRange }> = [
  { label: '最近 7 天', value: '7d' },
  { label: '1 个月', value: '1m' },
  { label: '半年', value: '6m' },
  { label: '1 年', value: '1y' },
];

const trendRangeDays: Record<TrendRange, number> = {
  '7d': 7,
  '1m': 30,
  '6m': 183,
  '1y': 365,
};

type TrendPoint = { date: string; value: number };

const createYearTrend = (
  baseline: number,
  seasonalAmplitude: number,
  growth: number,
  decimals = 0,
  phase = 0,
): TrendPoint[] => Array.from({ length: 365 }, (_, index) => {
  const date = new Date(2025, 5, 26);
  date.setDate(date.getDate() - (364 - index));
  const weekly = Math.sin((index + phase) * 0.9) * seasonalAmplitude * 0.22;
  const seasonal = Math.sin((index + phase) * 0.12) * seasonalAmplitude;
  const value = baseline + seasonal + weekly + index * growth;
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    value: Number(Math.max(0, value).toFixed(decimals)),
  };
});

const trendDataByMetric = {
  calls: createYearTrend(9_800, 1_150, 5.5, 0, 0),
  patients: createYearTrend(1_650, 170, 1.2, 0, 3),
  concurrency: createYearTrend(31, 10, 0.018, 0, 6),
  throughput: createYearTrend(9.5, 4.2, 0.012, 1, 9),
  timeout: createYearTrend(2.8, 1.1, -0.002, 2, 12),
  adoption: createYearTrend(87.8, 1.4, 0.006, 2, 15),
};

const getTrendWindow = (data: TrendPoint[], range: TrendRange) => data.slice(-trendRangeDays[range]);

// 与监控总览保持一致：日期使用紧凑格式，并由图表自动隐藏重叠标签。
const getTrendAxis = (range: TrendRange) => ({
  x: {
    title: false,
    labelAutoHide: true,
    labelAutoRotate: false,
    labelFormatter: (value: string) => (range === '1y' ? value.slice(0, 7) : value.slice(5)),
  },
  y: { title: false },
});

const topAgentColors = ['#1677FF', '#13C2C2', '#FA8C16', '#B37FEB', '#7265E6'];

const TrendRangeSwitch = ({
  value,
  onChange,
  label,
}: {
  value: TrendRange;
  onChange: (value: TrendRange) => void;
  label: string;
}) => (
  <Segmented<TrendRange>
    aria-label={label}
    options={trendRangeOptions}
    value={value}
    onChange={onChange}
  />
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartBase: any = {
  autoFit: true,
  pixelRatio: window.devicePixelRatio,
  appendPadding: [8, 8, 24, 8],
  legend: { position: 'top', itemName: { style: { fontSize: 11 } } },
};

// 颜色工具
const rateColor = (rate: number, green: number, yellow: number): string => {
  if (rate >= green) return '#52C41A';
  if (rate >= yellow) return '#FAAD14';
  return '#FF4D4F';
};

// KPI 卡片内嵌趋势图统一样式：与 Overview / CostV18 折线图保持一致
const kpiLineConfig: any = {
  smooth: true,
  point: { size: 4, shape: 'circle' },
  area: { style: { fillOpacity: 0.12 } },
  lineStyle: { lineWidth: 2 },
  tooltip: { showMarkers: true, shared: true },
  legend: false,
};

const BusinessV18 = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [loading, setLoading] = useState(false);
  const [autoRefresh] = useState(true);
  const [callRange, setCallRange] = useState<TrendRange>('1m');
  const [patientRange, setPatientRange] = useState<TrendRange>('1m');
  const [concurrencyRange, setConcurrencyRange] = useState<TrendRange>('1m');
  const [throughputRange, setThroughputRange] = useState<TrendRange>('1m');
  const [timeoutRange, setTimeoutRange] = useState<TrendRange>('1m');
  const [adoptionRange, setAdoptionRange] = useState<TrendRange>('1m');

  const refresh = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 500);
  };

  // 自动刷新 60s
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      // eslint-disable-next-line no-console
      console.log('[业务监控] 自动刷新 60s');
    }, 60_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const kpi = businessKpiV18;
  const scopedKpi = useMemo(() => {
    if (isAdmin) return kpi;
    const departmentCalls = topCallAgentsV18
      .filter((item) => item.department === currentUser?.department)
      .reduce((sum, item) => sum + item.calls, 0);
    const allRankedCalls = topCallAgentsV18.reduce((sum, item) => sum + item.calls, 0);
    return { ...kpi, totalCalls: departmentCalls, todayCalls: Math.round(kpi.todayCalls * (departmentCalls / allRankedCalls || 0)) };
  }, [currentUser?.department, isAdmin, kpi]);

  useEffect(() => {
    pushWelcomeGreeting('monitoring-business', isAdmin ? 'admin' : 'dept', undefined, {
      windowReplacements: [scopedKpi.totalCalls, scopedKpi.todayCalls, scopedKpi.successRate],
    });
    (window as any).__businessMonitoringContext = {
      scope: isAdmin ? '全院' : '本科室',
      ...scopedKpi,
      topAgents: isAdmin ? topCallAgentsV18 : topCallAgentsV18.filter((item) => item.department === currentUser?.department),
      responseTimeDistribution: responseTimeDistV18.map((item) => `${item.range} ${item.count} 次`).join('、'),
    };
    return () => {
      consumeWelcome();
      delete (window as any).__businessMonitoringContext;
    };
  }, [consumeWelcome, currentUser?.department, isAdmin, pushWelcomeGreeting, scopedKpi]);

  return (
    <div className="monitoring-dashboard monitoring-business-page">
      <PageHeader
        title="业务监控"
        subTitle="智能体的调用量、成功率、并发/吞吐、响应时间、超时率、采纳率与用户反馈"
        extra={
          <Space size={8}>
            <Tag color="processing">每 60 秒自动刷新</Tag>
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      />

      <Spin spinning={loading}>
        <Row className="business-quality-kpi-row" gutter={[16, 16]} style={{ marginTop: 16 }}>
          {[
            ['任务执行成功率', `${kpi.taskSuccessRate}%`, '#52C41A', '已完成且无异常终止'],
            ['任务中断率', `${kpi.taskInterruptRate}%`, '#FAAD14', '超时 / 报错 / 循环卡死'],
            ['单任务平均推理步数', kpi.avgReasoningSteps, '#1677FF', '推理、决策及工具调用'],
            ['工具选择准确率', `${kpi.toolSelectionAccuracy}%`, '#52C41A', '正确调用目标工具'],
            ['工具执行成功率', `${kpi.toolExecutionSuccessRate}%`, '#52C41A', '工具返回成功状态'],
          ].map(([title, value, color, note]) => (
            <Col flex="1 1 190px" key={String(title)}>
              <Link to="/app/audit">
                <Card className="monitoring-kpi-card" hoverable bordered={false} styles={{ body: { padding: 16, minHeight: 126 } }}>
                  <MetricLabel name={String(title)} variant="kpi" />
                  <Text strong style={{ display: 'block', fontSize: 30, color: String(color), margin: '6px 0 2px' }}>{value}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{note} · 查看审计日志 →</Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={6}>
            <Card bordered={false} styles={{ body: { padding: 18, height: 170 } }}>
              <MetricLabel name="智能体累计服务患者人数" variant="kpi" />
              <Text strong style={{ display: 'block', fontSize: 34, color: '#1677FF', marginTop: 14 }}>{kpi.totalPatients.toLocaleString()}</Text>
              <Text type="secondary">人 · 患者主索引跨渠道去重</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} styles={{ body: { padding: 18, height: 170 } }}>
              <MetricLabel name="智能体当日服务患者人数" variant="kpi" />
              <Space align="baseline" style={{ marginTop: 14 }}>
                <Text strong style={{ fontSize: 34, color: '#1677FF' }}>{kpi.todayPatients.toLocaleString()}</Text>
                <Text type="success"><RiseOutlined /> 8.6%</Text>
              </Space>
              <Text type="secondary" style={{ display: 'block' }}>人 · 较昨日同期</Text>
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered={false} title="服务患者人数趋势" extra={
              <TrendRangeSwitch value={patientRange} onChange={setPatientRange} label="服务患者人数趋势时间范围" />
            } styles={{ body: { padding: 10, height: 122 } }} style={{ height: 170 }}>
              <Line {...chartBase} height={115} data={getTrendWindow(trendDataByMetric.patients, patientRange)} xField="date" yField="value" smooth color="#13C2C2" axis={getTrendAxis(patientRange)} />
            </Card>
          </Col>
        </Row>
        {/* 4 KPI 卡片：累计调用 / 累计成功率 / 当日调用 / 当日成功率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={6}>
            <Link to="/app/audit">
              <Card hoverable bordered={false} styles={{ body: { padding: 16, height: 110 } }}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <MetricLabel name="智能体累计调用次数" variant="kpi" />
                  <Text strong style={{ fontSize: 32, color: '#1677FF', lineHeight: 1.1 }}>
                    {kpi.totalCalls.toLocaleString()}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>次 · 点击进入审计日志 →</Text>
                </Space>
              </Card>
            </Link>
          </Col>
          <Col span={6}>
            <Card hoverable bordered={false} styles={{ body: { padding: 16, height: 110 } }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <MetricLabel name="智能体成功调用率" variant="kpi" />
                <Space size={6} align="baseline">
                  <Text strong style={{ fontSize: 32, color: rateColor(kpi.successRate, 95, 90), lineHeight: 1.1 }}>
                    {kpi.successRate.toFixed(1)}%
                  </Text>
                  <Tag color={rateColor(kpi.successRate, 95, 90) === '#52C41A' ? 'success' : rateColor(kpi.successRate, 95, 90) === '#FAAD14' ? 'warning' : 'error'}>
                    {kpi.successRate >= 95 ? '优秀' : kpi.successRate >= 90 ? '关注' : '异常'}
                  </Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>累计成功率 · ≥95% 绿 / &lt;95% 黄 / &lt;90% 红</Text>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable bordered={false} styles={{ body: { padding: 16, height: 110 } }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <MetricLabel name="当日调用次数" variant="kpi" />
                <Space size={6} align="baseline">
                  <Text strong style={{ fontSize: 32, color: '#1677FF', lineHeight: 1.1 }}>
                    {kpi.todayCalls.toLocaleString()}
                  </Text>
                  <Space size={2}>
                    <RiseOutlined style={{ color: '#52C41A', fontSize: 12 }} />
                    <Text type="success" style={{ fontSize: 12 }}>+8.2%</Text>
                  </Space>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>当日 00:00 至今</Text>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable bordered={false} styles={{ body: { padding: 16, height: 110 } }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <MetricLabel name="当日成功调用率" variant="kpi" />
                <Space size={6} align="baseline">
                  <Text strong style={{ fontSize: 32, color: rateColor(kpi.todaySuccessRate, 95, 90), lineHeight: 1.1 }}>
                    {kpi.todaySuccessRate.toFixed(1)}%
                  </Text>
                  <Space size={2}>
                    <FallOutlined style={{ color: '#52C41A', fontSize: 12 }} />
                    <Text type="success" style={{ fontSize: 12 }}>-0.3%</Text>
                  </Space>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>≥95% 优秀 / &lt;95% 关注 / &lt;90% 异常</Text>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 合并后的调用次数趋势 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card bordered={false} title="调用次数趋势" extra={
              <TrendRangeSwitch value={callRange} onChange={setCallRange} label="调用次数趋势时间范围" />
            } styles={{ body: { padding: '16px 20px 12px', height: 320 } }} style={{ height: 380 }}>
              <Line {...chartBase} height={300} data={getTrendWindow(trendDataByMetric.calls, callRange)} xField="date" yField="value" smooth color="#1677FF" axis={getTrendAxis(callRange)} />
            </Card>
          </Col>
        </Row>

        {/* TOP5 + 并发 / 吞吐 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Card bordered={false} title="高频调用智能体 TOP5"
              styles={{ body: { padding: 12, height: 280 } }} style={{ height: 340 }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {topCallAgentsV18.map((agent, index) => (
                  <div key={agent.agentId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <Text
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                        }}
                        title={agent.name}
                      >
                        {agent.name}
                      </Text>
                      <Text type="secondary" style={{ flex: '0 0 auto', fontSize: 11 }}>{agent.department}</Text>
                      <Text strong style={{ flex: '0 0 48px', textAlign: 'right', fontSize: 12 }}>
                        {agent.calls.toLocaleString()}
                      </Text>
                    </div>
                    <div style={{ height: 7, overflow: 'hidden', borderRadius: 4, background: '#F0F2F5' }}>
                      <div
                        style={{
                          width: `${(agent.calls / topCallAgentsV18[0].calls) * 100}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: topAgentColors[index],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} title="并发数" extra={
              <TrendRangeSwitch value={concurrencyRange} onChange={setConcurrencyRange} label="并发数趋势时间范围" />
            }
              styles={{ body: { padding: 12, height: 280 } }} style={{ height: 340 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space size={16} align="baseline">
                  <Space size={4} align="baseline">
                    <Text type="secondary" style={{ fontSize: 12 }}>当前</Text>
                    <Text strong style={{ fontSize: 28, color: '#1677FF', lineHeight: 1.1 }}>{kpi.concurrency.current}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>路</Text>
                  </Space>
                  <Space size={4} align="baseline">
                    <Text type="secondary" style={{ fontSize: 12 }}>峰值</Text>
                    <Text strong style={{ fontSize: 16, color: '#FA8C16', lineHeight: 1.1 }}>{kpi.concurrency.peak}</Text>
                  </Space>
                </Space>
                <div style={{ height: 200 }}>
                  <Line {...chartBase} height={200} data={getTrendWindow(trendDataByMetric.concurrency, concurrencyRange)} xField="date" yField="value" smooth color="#1677FF" axis={getTrendAxis(concurrencyRange)} />
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} title="吞吐量" extra={
              <TrendRangeSwitch value={throughputRange} onChange={setThroughputRange} label="吞吐量趋势时间范围" />
            }
              styles={{ body: { padding: 12, height: 280 } }} style={{ height: 340 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space size={16} align="baseline">
                  <Space size={4} align="baseline">
                    <Text type="secondary" style={{ fontSize: 12 }}>当前</Text>
                    <Text strong style={{ fontSize: 28, color: '#722ED1', lineHeight: 1.1 }}>{kpi.throughput.current}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{kpi.throughput.unit}</Text>
                  </Space>
                  <Space size={4} align="baseline">
                    <Text type="secondary" style={{ fontSize: 12 }}>峰值</Text>
                    <Text strong style={{ fontSize: 16, color: '#FA8C16', lineHeight: 1.1 }}>{kpi.throughput.peak}</Text>
                  </Space>
                </Space>
                <div style={{ height: 200 }}>
                  <Line {...chartBase} height={200} data={getTrendWindow(trendDataByMetric.throughput, throughputRange)} xField="date" yField="value" smooth color="#722ED1" axis={getTrendAxis(throughputRange)} />
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {[
            ['响应时间 P95', kpi.responseTimeP95, '95% 的请求在该时间内完成'],
            ['响应时间 P99', kpi.responseTimeP99, '用于捕捉最慢 1% 的长尾请求'],
          ].map(([title, value, note]) => {
            const seconds = Number(value);
            return <Col span={12} key={String(title)}><Card bordered={false}>
              <Space direction="vertical" size={5}>
                <MetricLabel name={String(title)} variant="kpi" />
                <Space align="baseline"><Text strong style={{ fontSize: 34, color: seconds <= 1 ? '#52C41A' : seconds <= 10 ? '#FAAD14' : '#FF4D4F' }}>{seconds.toFixed(2)} s</Text><Tag color={seconds <= 1 ? 'success' : seconds <= 10 ? 'warning' : 'error'}>{seconds <= 1 ? '优秀' : seconds <= 10 ? '正常' : '异常'}</Tag></Space>
                <Text type="secondary">{note} · 实时刷新</Text>
              </Space>
            </Card></Col>;
          })}
        </Row>

        {/* 超时率 / 采纳率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card bordered={false} title={<MetricLabel name="响应超时率" />}
              extra={<TrendRangeSwitch value={timeoutRange} onChange={setTimeoutRange} label="响应超时率趋势时间范围" />}
              styles={{ body: { padding: 16, height: 264 } }} style={{ height: 324 }}>
              <Row align="middle" style={{ marginBottom: 4 }}>
                <Col>
                  <Space size={8} align="baseline">
                    <Text strong style={{ fontSize: 32, color: kpi.timeoutRate <= 1 ? '#52C41A' : kpi.timeoutRate <= 5 ? '#FAAD14' : '#FF4D4F', lineHeight: 1.1 }}>
                      {kpi.timeoutRate.toFixed(1)}%
                    </Text>
                    <Tag color={kpi.timeoutRate <= 1 ? 'success' : kpi.timeoutRate <= 5 ? 'warning' : 'error'} style={{ marginRight: 0 }}>
                      {kpi.timeoutRate <= 1 ? '正常' : kpi.timeoutRate <= 5 ? '关注' : '异常'}
                    </Tag>
                  </Space>
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                阈值 10s · ≤1% 绿 / 1-5% 黄 / &gt;5% 红
              </Text>
              <div style={{ width: '100%', height: 180 }}>
                <Line
                  {...chartBase}
                  {...kpiLineConfig}
                  height={180}
                  data={getTrendWindow(trendDataByMetric.timeout, timeoutRange)}
                  xField="date" yField="value" color="#FA8C16"
                  axis={getTrendAxis(timeoutRange)}
                  appendPadding={[4, 4, 4, 4]}
                />
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered={false} title={<MetricLabel name="医生采纳率" />}
              extra={<TrendRangeSwitch value={adoptionRange} onChange={setAdoptionRange} label="医生采纳率趋势时间范围" />}
              styles={{ body: { padding: 16, height: 264 } }} style={{ height: 324 }}>
              <Row align="middle" style={{ marginBottom: 4 }}>
                <Col>
                  <Space size={8} align="baseline">
                    <Text strong style={{ fontSize: 32, color: '#52C41A', lineHeight: 1.1 }}>
                      {kpi.adoptionRate.toFixed(1)}%
                    </Text>
                  </Space>
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                被医生采纳输出 / 总输出次数
              </Text>
              <div style={{ width: '100%', height: 180 }}>
                <Line
                  {...chartBase}
                  {...kpiLineConfig}
                  height={180}
                  data={getTrendWindow(trendDataByMetric.adoption, adoptionRange)}
                  xField="date" yField="value" color="#52C41A"
                  axis={getTrendAxis(adoptionRange)}
                  appendPadding={[4, 4, 4, 4]}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default BusinessV18;
