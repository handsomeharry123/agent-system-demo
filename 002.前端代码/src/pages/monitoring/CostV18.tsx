/**
 * 4.1 成本监控页（V1.8）
 * 需求文档：统一运行监控中心-需求说明文档 V1.8 §4
 *
 * 字段（4 资源 × 累计 + 当日 = 8 项 + 8 个 TOP5 排行）：
 *  - CPU 累计 / 当日（含 ↑↓ 日趋势对比）
 *  - GPU 累计 / 当日
 *  - 内存累计 / 当日
 *  - Token 累计 / 当日
 *  - CPU/GPU/内存/Token 累计使用量消耗排行 TOP5（横向柱状图 + 科室）
 *  - CPU/GPU/内存/Token 当日使用量消耗排行 TOP5
 *
 * 仅 IT 管理员可见；手动【刷新】；累计类按「自上线以来」累计，当日类按「当天 00:00 至当前」
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Typography, Space, Button, Spin,
} from 'antd';
import {
  ReloadOutlined, RiseOutlined,
} from '@ant-design/icons';
import { Bar } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useSmartDraft } from '../agent-center/smart/store';
import './monitoring-dashboard.css';
import {
  costKpiV18, costTop5V18,
} from '../../mock/monitoringV18';

const { Text } = Typography;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartBase: any = {
  autoFit: true,
  pixelRatio: window.devicePixelRatio,
  appendPadding: [16, 96, 28, 16],
  legend: false,
};

// KPI 卡片内嵌趋势图已移除；保留 formatNumber 供下方 Bar 图 label 使用
const formatNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString();
};

// 通用 TOP5 Bar 图配置（按用户优化标准：横向 / Y 轴横排 / 排序 / 配色 / 标签 / tooltip / 留白）
const buildTop5BarConfig = (
  data: Array<{ name: string; value: number; department: string }>,
  unit: string,
) => {
  // 过滤掉非法数值并按数值降序排（TOP1 在最上）
  const cleaned = data
    .filter((d) => Number.isFinite(d.value))
    .map((d) => ({ ...d, value: Number(d.value) }))
    .sort((a, b) => b.value - a.value);

  return {
    ...chartBase,
    height: 230,
    data: cleaned,
    xField: 'value',
    yField: 'name',
    colorField: 'department',
    // Tableau 10 高区分度配色，固定顺序保证各图视觉一致
    scale: {
      color: {
        range: ['#1677FF', '#52C41A', '#FA8C16', '#722ED1', '#EB2F96'],
      },
    },
    // 类目轴：横向显示，不旋转、不截断、tooltip 提供完整名称
    yAxis: {
      line: { style: { stroke: '#E8E8E8', lineWidth: 1 } },
      tickLine: { style: { stroke: 'transparent' } },
      labelFormatter: (val: string) => {
        if (!val) return '—';
        // 留 12 字符内一行显示完整，超过则前置省略号（末尾由 tooltip 补齐）
        const max = 12;
        if (val.length <= max) return val;
        return `…${val.slice(-(max - 1))}`;
      },
      labelAutoRotate: false,
      labelAutoWrap: false,
      labelAutoHide: false,
      labelStyle: {
        fontSize: 12,
        fill: '#1F1F1F',
      },
    },
    // 数值轴：浅灰细线、单位缩写
    xAxis: {
      line: { style: { stroke: '#E8E8E8', lineWidth: 1 } },
      tickLine: { style: { stroke: 'transparent' } },
      grid: { line: { style: { stroke: '#F0F0F0', lineWidth: 1, lineDash: [2, 2] } } },
      label: {
        autoHide: false,
        autoRotate: false,
        formatter: (v: any) => formatNumber(Number(v)),
        style: { fontSize: 11, fill: '#595959' },
      },
    },
    // 柱形：圆角、占类目间距 60-70%
    barWidthRatio: 0.62,
    barStyle: {
      radius: [2, 4, 4, 2],
    },
    // 末端正向 label：显示数值 + 单位，NaN 显示为「—」
    label: {
      position: 'right',
      offset: 6,
      formatter: (v: any) => {
        const n = Number(v?.value);
        if (!Number.isFinite(n)) return '—';
        return `${formatNumber(n)} ${unit}`;
      },
      style: { fontSize: 11, fill: '#262626', fontWeight: 500 },
    },
    // 完整 tooltip
    tooltip: {
      shared: false,
      showCrosshairs: false,
      showMarkers: true,
      marker: { symbol: 'square', style: { size: 8 } },
      formatter: (datum: any) => ({
        name: datum?.name ?? '—',
        value: Number.isFinite(Number(datum?.value))
          ? `${formatNumber(Number(datum.value))} ${unit}`
          : '—',
        // 让气泡显示完整类目全称 + 数值 + 单位
        title: datum?.name ?? '—',
      }),
      domStyles: {
        'g2-tooltip': {
          maxWidth: '320px',
          fontSize: '12px',
        },
        'g2-tooltip-list-item': { color: '#1F1F1F' },
      },
    },
    // 关闭动画抖动
    animate: { appear: { duration: 300 } },
  };
};

const CostV18 = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      // eslint-disable-next-line no-console
      console.log('[成本监控] 自动刷新 60s');
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // 4 类资源 KPI 卡片配置（白底 + 左侧色条强调）
  const resources = useMemo(() => [
    {
      key: 'cpu',
      title: 'CPU',
      total: isAdmin ? costKpiV18.cpu.total : costTop5V18.cpu.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0),
      totalUnit: costKpiV18.cpu.unit,
      today: isAdmin ? costKpiV18.cpu.today : Math.round(costTop5V18.cpu.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0) * 0.08),
      color: '#1677FF',
      icon: '⚙️',
      top5: isAdmin ? costTop5V18.cpu : costTop5V18.cpu.filter((row) => row.department === currentUser?.department),
      topUnit: '核·时',
    },
    {
      key: 'gpu',
      title: 'GPU',
      total: isAdmin ? costKpiV18.gpu.total : costTop5V18.gpu.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0),
      totalUnit: costKpiV18.gpu.unit,
      today: isAdmin ? costKpiV18.gpu.today : Math.round(costTop5V18.gpu.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0) * 0.08),
      color: '#722ED1',
      icon: '🎮',
      top5: isAdmin ? costTop5V18.gpu : costTop5V18.gpu.filter((row) => row.department === currentUser?.department),
      topUnit: '卡·时',
    },
    {
      key: 'memory',
      title: '内存',
      total: isAdmin ? costKpiV18.memory.total : costTop5V18.memory.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0),
      totalUnit: costKpiV18.memory.unit,
      today: isAdmin ? costKpiV18.memory.today : Math.round(costTop5V18.memory.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0) * 0.08),
      color: '#52C41A',
      icon: '🧠',
      top5: isAdmin ? costTop5V18.memory : costTop5V18.memory.filter((row) => row.department === currentUser?.department),
      topUnit: 'GB·时',
    },
    {
      key: 'token',
      title: 'Token',
      total: isAdmin ? costKpiV18.token.total : costTop5V18.token.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0),
      totalUnit: costKpiV18.token.unit,
      today: isAdmin ? costKpiV18.token.today : Math.round(costTop5V18.token.filter((row) => row.department === currentUser?.department).reduce((sum, row) => sum + row.value, 0) * 0.08),
      color: '#FA8C16',
      icon: '📝',
      top5: isAdmin ? costTop5V18.token : costTop5V18.token.filter((row) => row.department === currentUser?.department),
      topUnit: 'tokens',
    },
  ], [currentUser?.department, isAdmin]);

  useEffect(() => {
    pushWelcomeGreeting('monitoring-cost', isAdmin ? 'admin' : 'dept', undefined, {
      windowReplacements: resources.map((item) => item.total),
    });
    (window as any).__costMonitoringContext = {
      scope: isAdmin ? '全院' : '本科室',
      resources: resources.map((item) => ({
        key: item.key, title: item.title, total: item.total, today: item.today,
        unit: item.totalUnit, top5: item.top5,
      })),
    };
    return () => {
      consumeWelcome();
      delete (window as any).__costMonitoringContext;
    };
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, resources]);

  return (
    <div className="monitoring-dashboard monitoring-cost-page">
      <PageHeader
        title="成本监控"
        subTitle="CPU / GPU / 内存 / Token 累计与当日用量及 TOP5 消耗排行"
        extra={
          <Space size={8}>
            <Button icon={<ReloadOutlined />} onClick={() => setLoading(true)} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      />

      <Spin spinning={loading}>
        {/* 4 类资源 KPI 卡片：一排 4 个，去掉内嵌趋势图 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {resources.map((r) => (
            <Col xs={24} md={12} xl={6} key={r.key}>
              <Card
                bordered={false}
                style={{ background: '#FFFFFF' }}
                className="monitoring-kpi-card"
                styles={{ body: { padding: 16, minHeight: 146 } }}
                title={
                  <Text strong style={{ fontSize: 15 }}>{r.title} 使用量</Text>
                }
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Space direction="vertical" size={2}>
                      <Text type="secondary" style={{ fontSize: 12 }}>累计（自上线以来）</Text>
                      <Space size={4} align="baseline">
                        <Text strong style={{ fontSize: 32, color: r.color, lineHeight: 1.1 }}>
                          {formatNumber(r.total)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.totalUnit}</Text>
                      </Space>
                    </Space>
                  </Col>
                  <Col span={12}>
                    <Space direction="vertical" size={2}>
                      <Text type="secondary" style={{ fontSize: 12 }}>当日（00:00 至今）</Text>
                      <Space size={4} align="baseline">
                        <Text strong style={{ fontSize: 24, color: r.color, lineHeight: 1.1 }}>
                          {formatNumber(r.today)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.totalUnit}</Text>
                        <Space size={2}>
                          <RiseOutlined style={{ color: '#FF4D4F', fontSize: 10 }} />
                          <Text type="danger" style={{ fontSize: 11 }}>+12.5%</Text>
                        </Space>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 11 }}>vs 昨日</Text>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 排行图保持双列，给长智能体名称、刻度和数值标签足够空间。 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {resources.map((r) => (
            <Col xs={24} xl={12} key={`top-${r.key}`}>
              <Card
                bordered={false}
                title={`${r.title} 累计使用量消耗排行 TOP5`}
                className="monitoring-chart-card"
                styles={{ body: { padding: 12, height: 252 } }}
                style={{ height: 304 }}
              >
                <Bar {...buildTop5BarConfig(r.top5, r.topUnit)} />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {resources.map((r) => (
            <Col xs={24} xl={12} key={`top-today-${r.key}`}>
              <Card
                bordered={false}
                title={`${r.title} 当日使用量消耗排行 TOP5`}
                className="monitoring-chart-card"
                styles={{ body: { padding: 12, height: 252 } }}
                style={{ height: 304 }}
              >
                <Bar
                  {...buildTop5BarConfig(
                    r.top5.map((row) => ({ ...row, value: Math.round(row.value * 0.08) })),
                    r.topUnit,
                  )}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
    </div>
  );
};

export default CostV18;
