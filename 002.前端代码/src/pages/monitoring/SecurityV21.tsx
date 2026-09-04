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
  note: string;
  trendTitle: string;
  trend: Array<{ date: string; value: number }>;
};

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

// 基于每项指标的演示基线生成一整年连续数据，周期切换时展示同一趋势的数据窗口。
const makeTrend = (values: number[]) => Array.from({ length: 365 }, (_, index) => {
  const date = new Date(2025, 7, 5);
  date.setDate(date.getDate() - (364 - index));
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
    note: '提示词注入、越狱指令及恶意代码注入', trendTitle: '异常输入攻击拦截次数趋势',
    trend: makeTrend([302, 328, 315, 349, 376, 341, 398, 365, 390, 421, 388, 405, 436, 489]),
  },
  {
    key: 'harmful', title: '有害内容输出防护', countTitle: '有害内容输出拦截次数', count: 359, countUnit: '次',
    rateTitle: '输出内容合规率', rate: '99.72%', status: '正常', color: '#52C41A',
    note: '涉政敏感、违规医疗建议、隐私信息及辱骂歧视', trendTitle: '有害内容输出拦截次数趋势',
    trend: makeTrend([18, 22, 21, 26, 20, 28, 25, 31, 24, 29, 27, 32, 26, 30]),
  },
  {
    key: 'highRisk', title: '高风险请求防护', countTitle: '高风险请求拒绝次数', count: 1086, countUnit: '次',
    rateTitle: '高风险请求拒绝响应率', rate: '99.36%', status: '正常', color: '#52C41A',
    note: '用药剂量指导、自伤或自杀倾向等高风险请求', trendTitle: '高风险请求拒绝次数趋势',
    trend: makeTrend([62, 71, 69, 75, 82, 78, 73, 88, 91, 84, 79, 86, 74, 84]),
  },
  {
    key: 'privacy', title: '数据信息隐私防护', countTitle: '数据信息隐私泄露拦截次数', count: 47, countUnit: '次',
    rateTitle: '数据信息隐私泄露率', rate: '0.00%', status: '安全', color: '#52C41A',
    note: '姓名、身份证号、联系方式及就诊记录等隐私信息', trendTitle: '数据信息隐私泄露拦截次数趋势',
    trend: makeTrend([2, 3, 4, 2, 5, 3, 4, 5, 2, 4, 3, 4, 3, 3]),
  },
  {
    key: 'permission', title: '越权工具调用防护', countTitle: '越权工具调用拦截次数', count: 436, countUnit: '次',
    rateTitle: '越权工具调用拦截率', rate: '100%', status: '安全', color: '#52C41A',
    note: '跨用户、跨科室及超出当前权限范围的工具调用', trendTitle: '越权工具调用拦截次数趋势',
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
  const [trendRanges, setTrendRanges] = useState<Record<string, TrendRange>>(() =>
    Object.fromEntries(securityMetrics.map((metric) => [metric.key, '1m'])),
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

  const totalIssues = useMemo(() => issueDistribution.reduce((sum, item) => sum + item.value, 0), []);

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
        {securityMetrics.map((metric) => (
          <section key={metric.key} style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]} align="stretch" className="monitoring-security-metric-row">
              <Col xs={24} md={12} xl={5}>
                <Card className="monitoring-kpi-card" bordered={false} hoverable styles={{ body: { padding: 18, minHeight: 172 } }}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <MetricLabel name={metric.countTitle} variant="kpi" />
                    <Space align="baseline">
                      <SafetyCertificateOutlined style={{ color: '#1677FF', fontSize: 22 }} />
                      <Text strong style={{ fontSize: 34, color: '#1677FF', lineHeight: 1.1 }}>{metric.count.toLocaleString()}</Text>
                      <Text type="secondary">{metric.countUnit}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{metric.note}</Text>
                    <Tag color="processing">防护已生效</Tag>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} md={12} xl={5}>
                <Card className="monitoring-kpi-card" bordered={false} hoverable styles={{ body: { padding: 18, minHeight: 172 } }}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <MetricLabel name={metric.rateTitle} variant="kpi" />
                      <Tag color={metric.status === '关注' ? 'warning' : 'success'}>{metric.status}</Tag>
                    </Space>
                    <Text strong style={{ fontSize: 36, color: metric.color, lineHeight: 1.2 }}>{metric.rate}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{metric.note}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>超出安全阈值时实时告警</Text>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} xl={14}>
                <Card className="monitoring-chart-card" bordered={false} title={metric.trendTitle}
                  extra={
                    <Segmented<TrendRange>
                      aria-label={`${metric.trendTitle}时间范围`}
                      options={trendRangeOptions}
                      value={trendRanges[metric.key]}
                      onChange={(range) => setTrendRanges((current) => ({ ...current, [metric.key]: range }))}
                      size="small"
                    />
                  }
                  styles={{ body: { padding: '8px 14px 10px', height: 120 } }}>
                  <Line
                    autoFit
                    height={112}
                    data={metric.trend.slice(-trendRangeDays[trendRanges[metric.key]])}
                    xField="date"
                    yField="value"
                    smooth
                    color="#1677FF"
                    area={{ style: { fillOpacity: 0.12 } }}
                    point={trendRanges[metric.key] === '7d' || trendRanges[metric.key] === '1m'
                      ? { size: 3, shape: 'circle' }
                      : false}
                    axis={{
                      x: {
                        title: false,
                        labelAutoHide: true,
                        labelAutoRotate: false,
                        labelFormatter: (value: string) => (trendRanges[metric.key] === '1y'
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
        ))}

        <Card bordered={false} className="monitoring-chart-card" style={{ marginTop: 16 }} title="安全问题类型分布">
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} xl={14}>
              <Pie
                autoFit
                height={280}
                data={issueDistribution}
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
                  <Text strong style={{ display: 'block', fontSize: 32, color: '#1677FF' }}>{totalIssues.toLocaleString()} 次</Text>
                </div>
                {issueDistribution.map((item) => (
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
