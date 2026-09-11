/**
 * 1.1 监控告警总览页（V1.9）
 * 需求文档：统一运行监控中心-需求说明文档 V1.9 §1
 *
 * V1.9 关键变化（相对 V1.8）：
 * - 4 张大数字卡片：累计告警总数 / 当日告警总数 / 未处理告警数 / 已处理告警数
 *   - 累计告警总数 → 点击进入事件管理（默认「全部事件」Tab）
 *   - 当日告警总数 → 点击进入事件管理（默认「全部事件」Tab）
 *   - 未处理告警数 → 点击进入「待处理事件」Tab
 *   - 已处理告警数 → 点击进入「已关闭事件」Tab
 * - 1 个告警次数趋势图：支持最近 7 天 / 1 个月 / 半年 / 1 年切换
 * - 新增 告警类型分布饼图（业务 / 状态 / 成本 / 安全）— 图例项可点击进入按告警类型筛选的事件管理页
 * - 新增 智能体告警次数排行 TOP5 条形图 — 下方明细列表可点击进入按关联智能体筛选的事件管理页
 * - 科室管理员 / IT 管理员均可访问；不再使用 PermissionDenied 拦截
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Space, Button, Spin, Divider, Segmented,
} from 'antd';
import {
  ReloadOutlined, AlertOutlined, WarningOutlined, CheckCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Line, Pie, Bar } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import { ErrorRetry } from '../../components/PageStates';
import {
  alertOverviewKpiV18,
  alertTypeDistributionV18,
  alertAgentRankingV18,
  mockAlertEventsV18,
} from '../../mock/monitoringV18';
import { useAuth } from '../../hooks/useAuth';
import { useSmartDraft } from '../agent-center/smart/store';

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

// 生成一整年的连续演示数据，切换时间范围时只改变同一条趋势线的数据窗口。
const alertTrendYear = Array.from({ length: 365 }, (_, index) => {
  const date = new Date(2025, 5, 26);
  date.setDate(date.getDate() - (364 - index));
  const seasonal = Math.sin(index * 0.18) * 7 + Math.cos(index * 0.047) * 5;
  const weekly = [2, 4, 5, 3, 6, -2, -4][date.getDay()];
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    count: Math.max(8, Math.round(25 + seasonal + weekly + index * 0.015)),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicitany
const chartBaseConfig: any = {
  autoFit: true,
  pixelRatio: window.devicePixelRatio,
  appendPadding: [8, 8, 24, 8],
  xAxis: { label: { autoHide: true, autoRotate: false } },
  legend: false,
};

// 4 类告警配色（统一在 KPI/饼图/图例 chip 复用）
const typeColorMap: Record<string, string> = {
  business: '#1677FF',
  status: '#52C41A',
  cost: '#FA8C16',
  security: '#FF4D4F',
};

const Overview = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trendRange, setTrendRange] = useState<TrendRange>('1m');

  const trendData = useMemo(
    () => alertTrendYear.slice(-trendRangeDays[trendRange]),
    [trendRange],
  );

  const welcomeMetrics = useMemo(() => {
    if (isAdmin) {
      return {
        total: alertOverviewKpiV18.totalAll,
        today: alertOverviewKpiV18.totalToday,
        pending: alertOverviewKpiV18.unhandled,
      };
    }
    const scoped = mockAlertEventsV18.filter((event) => event.department === currentUser?.department);
    // 演示数据使用固定业务日期；取数据集中最新日期作为“今日”口径。
    const latestDate = scoped.reduce((latest, event) => {
      const date = event.triggerTime.slice(0, 10);
      return date > latest ? date : latest;
    }, '');
    return {
      total: scoped.length,
      today: scoped.filter((event) => event.triggerTime.startsWith(latestDate)).length,
      pending: scoped.filter((event) => event.status === 'pending_handle').length,
    };
  }, [currentUser?.department, isAdmin]);

  useEffect(() => {
    pushWelcomeGreeting('monitoring-overview', isAdmin ? 'admin' : 'dept', undefined, {
      windowReplacements: [welcomeMetrics.total, welcomeMetrics.today, welcomeMetrics.pending],
      actions: [
        { key: 'generate-monitoring-report', label: '生成报告', path: '/app/monitoring/report', enabled: true },
        { key: 'view-pending-alerts', label: '查看待处理告警情况', path: '/app/monitoring/alert-events?tab=pending_handle', enabled: true },
        { key: 'view-pending-reviews', label: '查看待审核告警事件处置情况', path: '/app/monitoring/alert-events?tab=pending_review', enabled: true },
      ],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, welcomeMetrics]);

  // 自动刷新 60s
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      // 演示用：直接 reload 不打接口
      // eslint-disable-next-line no-console
      console.log('[监控总览] 自动刷新 60s', new Date().toLocaleTimeString());
    }, 60_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const manualRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 600);
  };

  if (error) return <ErrorRetry onRetry={() => setError(false)} />;

  // 4 张 KPI 卡片（V1.9 新增「累计告警总数」）
  const kpi = [
    {
      key: 'totalAll',
      title: '累计告警总数',
      value: alertOverviewKpiV18.totalAll,
      color: '#722ED1',
      icon: <HistoryOutlined />,
      iconBg: '#F4E6FF',
      to: '/app/monitoring/alert-events?tab=all',
      extra: '自上线以来含未处理 + 已处理',
    },
    {
      key: 'total',
      title: '当日告警总数',
      value: alertOverviewKpiV18.totalToday,
      color: '#1677FF',
      icon: <AlertOutlined />,
      iconBg: '#E6F4FF',
      to: '/app/monitoring/alert-events?tab=all',
      extra: '含未处理 + 已处理',
    },
    {
      key: 'unhandled',
      title: '未处理告警数',
      value: alertOverviewKpiV18.unhandled,
      color: '#FF4D4F',
      icon: <WarningOutlined />,
      iconBg: '#FFE6E6',
      to: '/app/monitoring/alert-events?tab=pending_handle',
      extra: '当前未完成闭环',
    },
    {
      key: 'handled',
      title: '已处理告警数',
      value: alertOverviewKpiV18.handled,
      color: '#52C41A',
      icon: <CheckCircleOutlined />,
      iconBg: '#E6F7DF',
      to: '/app/monitoring/alert-events?tab=closed',
      extra: '当日已完成闭环',
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title="监控告警总览"
        subTitle="累计 / 当日 / 未处理 / 已处理告警数量 + 告警次数趋势；告警类型分布与智能体告警次数排行；自动刷新 60s"
        extra={
          <Space size={8}>
            <Button
              icon={<ReloadOutlined />}
              onClick={manualRefresh}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      />

      <Spin spinning={loading}>
        {/* 4 张大数字卡片（V1.9 新增「累计告警总数」） */}
        <Row gutter={[24, 24]} style={{ marginTop: 16, marginBottom: 16 }}>
          {kpi.map((k) => (
            <Col span={6} key={k.key}>
              <Link to={k.to}>
                <Card
                  hoverable
                  style={{ background: '#FFFFFF', border: '1px solid #F0F0F0' }}
                  styles={{ body: { padding: 28, height: 156, overflow: 'hidden' } }}
                >
                  <Space size={12} align="center" style={{ marginBottom: 14 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36, height: 36,
                      borderRadius: 18,
                      background: k.iconBg,
                      fontSize: 18, color: k.color,
                    }}>{k.icon}</span>
                    <Text style={{ fontSize: 16, color: 'rgba(0,0,0,0.85)' }}>{k.title}</Text>
                  </Space>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <Text strong style={{ fontSize: 48, fontWeight: 600, color: k.color, lineHeight: 1 }}>
                      {k.value.toLocaleString()}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14 }}>次</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 10, display: 'block' }}>
                    {k.extra} · 点击查看 →
                  </Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>

        {/* 合并后的告警次数趋势图 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              bordered={false}
              title="告警次数趋势"
              extra={
                <Segmented<TrendRange>
                  aria-label="告警趋势时间范围"
                  options={trendRangeOptions}
                  value={trendRange}
                  onChange={setTrendRange}
                />
              }
              styles={{ body: { padding: '16px 20px 12px', height: 320 } }}
              style={{ height: 380 }}
            >
              <Line
                {...chartBaseConfig}
                height={300}
                data={trendData}
                xField="date"
                yField="count"
                smooth
                color="#1677FF"
                point={trendRange === '7d' || trendRange === '1m'
                  ? { size: 4, shape: 'circle' }
                  : false}
                axis={{
                  x: {
                    title: false,
                    labelAutoHide: true,
                    labelAutoRotate: false,
                    labelFormatter: (value: string) => (trendRange === '1y'
                      ? value.slice(0, 7)
                      : value.slice(5)),
                  },
                  y: { title: false },
                }}
                tooltip={{ title: (datum: { date: string }) => datum.date }}
              />
            </Card>
          </Col>
        </Row>

        {/* 告警类型分布饼图 + 智能体告警次数排行 TOP5（V1.9 新增） */}
        <Row gutter={[16, 16]} align="stretch">
          <Col span={10} style={{ display: 'flex' }}>
            <Card
              bordered={false}
              title="告警类型分布"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>扇区配比 + 外部注解说明，点击条目进入对应事件管理</Text>}
              styles={{ body: { padding: 16, height: 420 } }}
              style={{ width: '100%', height: 480 }}
            >
              <Row gutter={16} align="middle" style={{ height: '100%' }}>
                {/* 左侧饼图：扇区内显示百分比（通过 transform 直接生成 label 字段） */}
                <Col span={11}>
                  <div style={{ height: 300 }}>
                    <Pie
                      {...chartBaseConfig}
                      height={300}
                      appendPadding={[4, 0, 4, 0]}
                      data={alertTypeDistributionV18.map((d) => ({ ...d, percentText: `${d.percent}%` }))}
                      angleField="count"
                      colorField="type"
                      radius={0.98}
                      innerRadius={0.55}
                      color={alertTypeDistributionV18.map((d) => typeColorMap[d.type])}
                      legend={false}
                      label={{
                        text: 'percentText',
                        style: { fontSize: 12, fill: '#fff', textAlign: 'center', fontWeight: 600 },
                      }}
                      interactions={[{ type: 'element-active' }]}
                    />
                  </div>
                </Col>
                {/* 右侧外部注解说明 + 引导线视觉卡（带左色条 + 圆点模拟与饼图扇区连线） */}
                <Col span={13}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      扇区配比对应下表，点击条目进入对应事件管理
                    </Text>
                    {alertTypeDistributionV18.map((d, idx) => (
                      <Link
                        key={d.type}
                        to={`/app/monitoring/alert-events?tab=all&type=${d.type}`}
                        style={{ display: 'block' }}
                      >
                        <Card
                          hoverable
                          size="small"
                          styles={{ body: { padding: '8px 12px' } }}
                          style={{ borderLeft: `3px solid ${typeColorMap[d.type]}` }}
                        >
                          <Space direction="vertical" size={2} style={{ width: '100%' }}>
                            <Space size={6} align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Space size={6} align="center">
                                {/* 圆点 + 横线模拟引线，与饼图扇区形成视觉连线 */}
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}>
                                  <span style={{
                                    display: 'inline-block',
                                    width: 10, height: 10, borderRadius: 5,
                                    background: typeColorMap[d.type],
                                    boxShadow: `0 0 0 2px ${typeColorMap[d.type]}20`,
                                  }} />
                                  <span style={{
                                    display: 'inline-block', width: 18, height: 1,
                                    background: typeColorMap[d.type],
                                  }} />
                                </span>
                                <Text style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</Text>
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>{d.percent}%</Text>
                            </Space>
                            <Text strong style={{ fontSize: 18, color: typeColorMap[d.type], lineHeight: 1 }}>
                              {d.count.toLocaleString()}
                              <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>次</Text>
                            </Text>
                          </Space>
                        </Card>
                      </Link>
                    ))}
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col span={14} style={{ display: 'flex' }}>
            <Card
              bordered={false}
              title="智能体告警次数排行 TOP5"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>点击下方条目进入按关联智能体筛选的事件管理页</Text>}
              styles={{ body: { padding: 12, height: 420 } }}
              style={{ width: '100%', height: 480 }}
            >
              {/* 顶部柱状图（可视化）：Y 轴名称自动换行缩短，避免超出图表区域 */}
              <div style={{ height: 172, minWidth: 480 }}>
                <Bar
                  {...chartBaseConfig}
                  height={172}
                  appendPadding={[4, 24, 4, 4]}
                  data={alertAgentRankingV18}
                  xField="count"
                  yField="name"
                  color={({ name }: { name: string }) => {
                    const item = alertAgentRankingV18.find((d) => d.name === name);
                    if (!item) return '#1677FF';
                    const palette = ['#FF4D4F', '#FA8C16', '#FAAD14', '#1677FF', '#52C41A'];
                    return palette[item.rank - 1] || '#1677FF';
                  }}
                  legend={false}
                  barWidthRatio={0.6}
                  label={false}
                  axis={{
                    x: {
                      title: false,
                      labelFormatter: (value: string) => (Number(value) === 0 ? '' : value),
                    },
                    // 智能体名称已在下方 TOP5 明细完整展示，隐藏重复轴标签以释放图表空间。
                    y: { title: false, label: false },
                  }}
                  xAxis={{
                    label: {
                      style: { fontSize: 10 },
                      // 隐藏 0 刻度，避免 autoFit 压缩场景下在最右端孤立显示
                      formatter: (val: string) => (Number(val) === 0 ? '' : `${val}`),
                    },
                  }}
                  yAxis={{
                    label: {
                      style: { fontSize: 10 },
                      formatter: (val: string) => {
                        // 名称过长用省略号收缩，避免超出图表区域
                        if (val.length > 10) return `${val.slice(0, 10)}…`;
                        return val;
                      },
                    },
                  }}
                />
              </div>
              <Divider style={{ margin: '2px 0 6px' }} />
              {/* 下方可点击明细列表（PRD §1.1：点击某个智能体进入按关联智能体筛选的事件管理页） */}
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {alertAgentRankingV18.map((d) => (
                  <Link
                    key={d.agentId}
                    to={`/app/monitoring/alert-events?tab=all&agentName=${encodeURIComponent(d.name)}`}
                    style={{ display: 'block' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '7px 12px',
                        borderRadius: 6,
                        background: '#FAFAFA',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0F5FF'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                    >
                      <span style={{
                        display: 'inline-block',
                        width: 22, height: 22, lineHeight: '22px', textAlign: 'center',
                        borderRadius: 11, background: d.rank <= 3 ? '#FF4D4F' : '#8C8C8C',
                        color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0,
                      }}>
                        {d.rank}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13 }} ellipsis>{d.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{d.department}</Text>
                      </div>
                      <Text strong style={{ fontSize: 14, color: '#FF4D4F', flexShrink: 0 }}>
                        {d.count}
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}> 次</Text>
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>查看 →</Text>
                    </div>
                  </Link>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Overview;
