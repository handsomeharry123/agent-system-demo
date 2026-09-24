import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Row, Segmented, Space, Spin, Tag, Typography } from 'antd';
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import MetricLabel from '../../components/MetricLabel';
import './monitoring-dashboard.css';

const { Text } = Typography;

type SecurityMetric = {
  key: string;
  title: string;
  countTitle: string;
  count: number;
  countUnit: string;
  rateTitle: string;
  rate: string;
  status: string;
  color: string;
  trendTitle: string;
  trend: Array<{ date: string; value: number }>;
};

type TrendRange = '7d' | '1m' | '6m' | '1y' | 'all';

const trendRangeOptions: Array<{ label: string; value: TrendRange }> = [
  { label: '最近 7 天', value: '7d' },
  { label: '1 个月', value: '1m' },
  { label: '半年', value: '6m' },
  { label: '1 年', value: '1y' },
  { label: '至今', value: 'all' },
];

const trendRangeDays: Record<TrendRange, number | null> = {
  '7d': 7,
  '1m': 30,
  '6m': 183,
  '1y': 365,
  all: null,
};

const rangeCountFactors: Record<TrendRange, number> = {
  '7d': 1,
  '1m': 4.2,
  '6m': 25.7,
  '1y': 52.1,
  all: 104.3,
};

const getRangeCount = (metric: SecurityMetric, range: TrendRange) =>
  Math.round(metric.count * rangeCountFactors[range]);

const getRangeRate = (metric: SecurityMetric, range: TrendRange) => {
  const base = Number.parseFloat(metric.rate);
  const offsets: Record<TrendRange, number> = { '7d': 0, '1m': 0.02, '6m': 0.04, '1y': 0.06, all: 0.08 };
  if (base === 100) return '100%';
  const value = base > 50 ? base - offsets[range] : base + offsets[range];
  return `${Math.max(0, Math.min(100, value)).toFixed(2)}%`;
};

// 基于每项指标的演示基线生成两年连续数据，支持从最近 7 天逐步扩展到“至今”。
const makeTrend = (values: number[]) => Array.from({ length: 730 }, (_, index) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (729 - index));
  const baseline = values[index % values.length] ?? 0;
  const seasonal = Math.sin(index * 0.13) * Math.max(1, baseline * 0.08);
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    value: Math.max(0, Math.round(baseline + seasonal)),
  };
});

const securityMetrics: SecurityMetric[] = [
  {
    key: 'attack', title: '异常输入攻击防护', countTitle: '异常输入攻击拦截次数', count: 5003, countUnit: '次',
    rateTitle: '异常输入攻击成功率', rate: '0.18%', status: '关注', color: '#FAAD14',
    trendTitle: '异常输入攻击拦截次数趋势',
    trend: makeTrend([302, 328, 315, 349, 376, 341, 398, 365, 390, 421, 388, 405, 436, 489]),
  },
  {
    key: 'harmful', title: '有害内容输出防护', countTitle: '有害内容输出拦截次数', count: 359, countUnit: '次',
    rateTitle: '输出内容合规率', rate: '99.72%', status: '正常', color: '#52C41A',
    trendTitle: '有害内容输出拦截次数趋势',
    trend: makeTrend([18, 22, 21, 26, 20, 28, 25, 31, 24, 29, 27, 32, 26, 30]),
  },
  {
    key: 'highRisk', title: '高风险请求防护', countTitle: '高风险请求拒绝次数', count: 1086, countUnit: '次',
    rateTitle: '高风险请求拒绝响应率', rate: '99.36%', status: '正常', color: '#52C41A',
    trendTitle: '高风险请求拒绝次数趋势',
    trend: makeTrend([62, 71, 69, 75, 82, 78, 73, 88, 91, 84, 79, 86, 74, 84]),
  },
  {
    key: 'privacy', title: '数据信息隐私防护', countTitle: '数据信息隐私泄露拦截次数', count: 47, countUnit: '次',
    rateTitle: '数据信息隐私泄露率', rate: '0.00%', status: '安全', color: '#52C41A',
    trendTitle: '数据信息隐私泄露拦截次数趋势',
    trend: makeTrend([2, 3, 4, 2, 5, 3, 4, 5, 2, 4, 3, 4, 3, 3]),
  },
  {
    key: 'permission', title: '越权工具调用防护', countTitle: '越权工具调用拦截次数', count: 436, countUnit: '次',
    rateTitle: '越权工具调用拦截率', rate: '100%', status: '安全', color: '#52C41A',
    trendTitle: '越权工具调用拦截次数趋势',
    trend: makeTrend([25, 27, 31, 28, 34, 29, 32, 36, 30, 35, 31, 34, 29, 35]),
  },
];

const issueDistribution = [
  { type: '异常输入攻击', value: 5003 },
  { type: '有害内容输出', value: 359 },
  { type: '高风险请求', value: 1086 },
  { type: '隐私泄露', value: 47 },
  { type: '越权工具调用', value: 436 },
];

const SecurityV21 = () => {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [distributionRange, setDistributionRange] = useState<TrendRange>('7d');
  const [trendRanges, setTrendRanges] = useState<Record<string, TrendRange>>(() =>
    Object.fromEntries(securityMetrics.map((metric) => [metric.key, '7d'])),
  );
  const refresh = () => {
    setLoading(true);
    window.setTimeout(() => {
      setLastUpdated(new Date());
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const rangedIssueDistribution = useMemo(
    () => issueDistribution.map((item) => ({
      ...item,
      value: Math.round(item.value * rangeCountFactors[distributionRange]),
    })),
    [distributionRange],
  );
  const totalIssues = useMemo(
    () => rangedIssueDistribution.reduce((sum, item) => sum + item.value, 0),
    [rangedIssueDistribution],
  );

  return (
    <div className="monitoring-dashboard monitoring-security-page">
      <PageHeader
        title="安全监控"
        subTitle="智能体输入、输出、行为、工具与数据安全指标监控"
        extra={<Space wrap>
          <Tag color="processing">每 60 秒自动刷新</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour12: false })}</Text>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={refresh}>刷新</Button>
        </Space>}
      />

      <Spin spinning={loading}>
        {securityMetrics.map((metric) => {
          const selectedRange = trendRanges[metric.key];
          const rangeDays = trendRangeDays[selectedRange];
          const trendData = rangeDays ? metric.trend.slice(-rangeDays) : metric.trend;
          return (
          <section key={metric.key} className="monitoring-security-metric-group">
            <div className="monitoring-security-metric-group-header">
              <div>
                <Text strong className="monitoring-security-metric-group-title">{metric.title}</Text>
              </div>
              <Space size={8} wrap>
                <Text type="secondary" style={{ fontSize: 12 }}>统计周期</Text>
                <Segmented<TrendRange>
                  aria-label={`${metric.title}时间范围`}
                  options={trendRangeOptions}
                  value={selectedRange}
                  onChange={(range) => setTrendRanges((current) => ({ ...current, [metric.key]: range }))}
                  size="small"
                />
              </Space>
            </div>
            <Row gutter={[16, 16]} align="stretch" className="monitoring-security-metric-row">
              <Col xs={24} md={12} xl={5}>
                <Card className="monitoring-kpi-card monitoring-security-kpi-card" bordered={false} hoverable>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <MetricLabel name={metric.countTitle} variant="kpi" />
                    <Space align="baseline">
                      <SafetyCertificateOutlined style={{ color: '#1677FF', fontSize: 22 }} />
                      <Text strong className="monitoring-security-kpi-value" style={{ color: '#1677FF' }}>{getRangeCount(metric, selectedRange).toLocaleString()}</Text>
                      <Text type="secondary">{metric.countUnit}</Text>
                    </Space>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} md={12} xl={5}>
                <Card className="monitoring-kpi-card monitoring-security-kpi-card" bordered={false} hoverable>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <MetricLabel name={metric.rateTitle} variant="kpi" />
                      <Tag color={metric.status === '关注' ? 'warning' : 'success'}>{metric.status}</Tag>
                    </Space>
                    <Text strong className="monitoring-security-kpi-value" style={{ color: metric.color }}>{getRangeRate(metric, selectedRange)}</Text>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} xl={14}>
                <Card className="monitoring-chart-card" bordered={false} title={<MetricLabel name={metric.trendTitle} />}
                  styles={{ body: { padding: '8px 14px 10px', height: 120 } }}>
                  <Line
                    autoFit
                    height={112}
                    data={trendData}
                    xField="date"
                    yField="value"
                    smooth
                    color="#1677FF"
                    area={{ style: { fillOpacity: 0.12 } }}
                    point={selectedRange === '7d' || selectedRange === '1m'
                      ? { size: 3, shape: 'circle' }
                      : false}
                    axis={{
                      x: {
                        title: false,
                        labelAutoHide: true,
                        labelAutoRotate: false,
                        labelFormatter: (value: string) => (selectedRange === '1y' || selectedRange === 'all'
                          ? value.slice(0, 7)
                          : value.slice(5)),
                        style: { labelFontSize: 10 },
                      },
                      y: { title: false, style: { labelFontSize: 10 } },
                    }}
                    tooltip={{ showMarkers: true, shared: true, title: (datum: { date: string }) => datum.date }}
                  />
                </Card>
              </Col>
            </Row>
          </section>
          );
        })}

        <Card
          bordered={false}
          className="monitoring-chart-card monitoring-security-distribution-card"
          style={{ marginTop: 16 }}
          title={<MetricLabel name="安全问题类型分布" />}
          extra={
            <Space size={8} wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>统计周期</Text>
              <Segmented<TrendRange>
                aria-label="安全问题类型分布时间范围"
                options={trendRangeOptions}
                value={distributionRange}
                onChange={setDistributionRange}
                size="small"
              />
            </Space>
          }
        >
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} xl={14}>
              <Pie
                autoFit
                height={280}
                data={rangedIssueDistribution}
                angleField="value"
                colorField="type"
                innerRadius={0.58}
                radius={0.84}
                color={['#1677FF', '#13C2C2', '#FAAD14', '#FF4D4F', '#722ED1']}
                legend={{ position: 'right' }}
                label={{ text: 'value', position: 'outside', style: { fontSize: 11 } }}
                tooltip={{
                  formatter: (datum: any) => ({
                    name: datum?.type ?? '',
                    value: `${Number(datum?.value ?? 0).toLocaleString()} 次`,
                  }),
                }}
              />
            </Col>
            <Col xs={24} xl={10}>
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">安全问题总量</Text>
                  <Text strong className="monitoring-security-total-value" style={{ color: '#1677FF' }}>{totalIssues.toLocaleString()} 次</Text>
                </div>
                {rangedIssueDistribution.map((item) => (
                  <div key={item.type} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f0f0f0', paddingBottom: 8 }}>
                    <Text>{item.type}</Text>
                    <Text strong>{item.value.toLocaleString()} 次 · {((item.value / totalIssues) * 100).toFixed(1)}%</Text>
                  </div>
                ))}
              </Space>
            </Col>
          </Row>
        </Card>
      </Spin>
    </div>
  );
};

export default SecurityV21;
