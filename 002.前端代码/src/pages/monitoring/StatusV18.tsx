/**
 * 3.1 状态监控页（V1.8）
 * 需求文档：统一运行监控中心-需求说明文档 V1.8 §3
 *
 * 字段：
 *  - 在线智能体数量 / 在线率（点击 → 台账列表，按「在线」筛选）
 *  - 离线智能体数量 / 离线率（点击 → 台账列表，按「离线」筛选）
 *  - 禁用智能体数量（点击 → 台账列表，按「禁用」筛选）
 *  - 异常智能体数量（点击 → 台账列表，按「异常」筛选）
 *  - 各运行状态科室智能体数量比例（饼图）
 *
 * 仅 IT 管理员可见；自动刷新 60s + 手动【刷新】
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Space, Button, Spin, Tag, Progress,
} from 'antd';
import {
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PauseCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useSmartDraft } from '../agent-center/smart/store';
import './monitoring-dashboard.css';
import {
  statusKpiV18, deptDistributionV18, mockAgentsV18,
} from '../../mock/monitoringV18';

const { Text } = Typography;

// 状态饼图配色（与各运行状态总占比扇区对应）
const STATUS_COLOR_MAP: Record<string, string> = {
  在线: '#52C41A',
  离线: '#8C8C8C',
  禁用: '#FA8C16',
  异常: '#FF4D4F',
};

// 计算各扇区中线在 SVG viewBox 中的位置（与饼图半径 0.6 / innerRadius 0.42 匹配）
//   cx/cy=50，扇区外缘半径=30（半径 0.6 ≈ 30），标签落点半径=36（外侧留 6 单位余量）
//   viewBox 0 0 100 100 内，圆环居中绘制在 60×60 区域，
//   标签和引导线紧凑落在 viewBox 内部，文字不再越出 Card 边界
const buildStatusLabelPositions = (
  data: { type: string; value: number }[],
  total: number,
) => {
  const cx = 50;
  const cy = 50;
  const sliceRadius = 30;
  const labelRadius = 36;
  let cursor = -Math.PI / 2;
  return data.map((d) => {
    const v = d.value;
    const angle = (v / (total || 1)) * Math.PI * 2;
    const mid = cursor + angle / 2;
    const sliceX = cx + sliceRadius * Math.cos(mid);
    const sliceY = cy + sliceRadius * Math.sin(mid);
    const x = cx + labelRadius * Math.cos(mid);
    const y = cy + labelRadius * Math.sin(mid);
    let anchor: 'start' | 'end' | 'middle' = 'middle';
    if (Math.cos(mid) > 0.1) anchor = 'start';
    else if (Math.cos(mid) < -0.1) anchor = 'end';
    const pos = {
      type: d.type,
      value: v,
      pct: ((v / (total || 1)) * 100).toFixed(1),
      x,
      y,
      sliceX,
      sliceY,
      anchor,
    };
    cursor += angle;
    return pos;
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartBase: any = {
  autoFit: true,
  pixelRatio: window.devicePixelRatio,
  appendPadding: [8, 8, 24, 8],
  legend: { position: 'right' },
};

const StatusV18 = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const [loading, setLoading] = useState(false);
  const refresh = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 500);
  };

  useEffect(() => {
    const t = setInterval(() => {
      // eslint-disable-next-line no-console
      console.log('[状态监控] 自动刷新 60s');
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const kpi = statusKpiV18;
  const scopedAgents = useMemo(
    () => isAdmin ? mockAgentsV18 : mockAgentsV18.filter((agent) => agent.department === currentUser?.department),
    [currentUser?.department, isAdmin],
  );
  const welcomeKpi = useMemo(() => ({
    total: scopedAgents.length,
    online: scopedAgents.filter((agent) => agent.status === '在线').length,
    offline: scopedAgents.filter((agent) => agent.status === '离线').length,
    disabled: scopedAgents.filter((agent) => agent.status === '禁用').length,
    abnormal: scopedAgents.filter((agent) => agent.status === '异常').length,
  }), [scopedAgents]);

  useEffect(() => {
    pushWelcomeGreeting('monitoring-status', isAdmin ? 'admin' : 'dept', undefined, {
      windowReplacements: [welcomeKpi.online, welcomeKpi.offline, welcomeKpi.abnormal],
    });
    (window as any).__statusMonitoringContext = {
      scope: isAdmin ? '全院' : '本科室',
      ...welcomeKpi,
      onlineRate: ((welcomeKpi.online / (welcomeKpi.total || 1)) * 100).toFixed(1),
      offlineRate: ((welcomeKpi.offline / (welcomeKpi.total || 1)) * 100).toFixed(1),
      agents: scopedAgents,
    };
    return () => {
      consumeWelcome();
      delete (window as any).__statusMonitoringContext;
    };
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting, scopedAgents, welcomeKpi]);
  const onlineRate = ((kpi.online / kpi.total) * 100).toFixed(1);
  const offlineRate = ((kpi.offline / kpi.total) * 100).toFixed(1);

  // 饼图数据：各运行状态总占比
  const pieData = [
    { type: '在线', value: kpi.online },
    { type: '离线', value: kpi.offline },
    { type: '禁用', value: kpi.disabled },
    { type: '异常', value: kpi.abnormal },
  ];
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const statusLabelPositions = useMemo(
    () => buildStatusLabelPositions(pieData, pieTotal),
    [pieTotal],
  );

  const kpis = [
    {
      key: 'online',
      title: '在线智能体数量',
      subTitle: '智能体在线率',
      subValue: `${onlineRate}%`,
      value: kpi.online,
      color: '#52C41A',
      icon: <CheckCircleOutlined />,
      to: '/app/ledger/list?runStatus=在线',
    },
    {
      key: 'offline',
      title: '离线智能体数量',
      subTitle: '智能体离线率',
      subValue: `${offlineRate}%`,
      value: kpi.offline,
      color: '#8C8C8C',
      icon: <CloseCircleOutlined />,
      to: '/app/ledger/list?runStatus=离线',
    },
    {
      key: 'disabled',
      title: '禁用智能体数量',
      subTitle: '已禁用（暂停 / 冻结）',
      subValue: `${kpi.disabled} 个`,
      value: kpi.disabled,
      color: '#FA8C16',
      icon: <PauseCircleOutlined />,
      to: '/app/ledger/list?runStatus=禁用',
    },
    {
      key: 'abnormal',
      title: '异常智能体数量',
      subTitle: '需要立即排查',
      subValue: `${kpi.abnormal} 个`,
      value: kpi.abnormal,
      color: '#FF4D4F',
      icon: <ExclamationCircleOutlined />,
      to: '/app/ledger/list?runStatus=异常',
    },
  ];

  // 实时刷新标识
  const liveBadge = (
    <Tag color="processing" style={{ marginLeft: 8 }}>实时刷新</Tag>
  );

  return (
    <div className="monitoring-dashboard monitoring-status-page">
      <PageHeader
        title="状态监控"
        subTitle="智能体运行状态、故障恢复能力与科室分布"
        extra={
          <Space size={8}>
            <Tag color="processing">实时刷新</Tag>
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      />

      <Spin spinning={loading}>
        {/* 4 KPI 卡片 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {kpis.map((k) => (
            <Col span={6} key={k.key}>
              <Link to={k.to}>
                <Card
                  hoverable
                  bordered={false}
                  style={{ background: '#FFFFFF' }}
                  className="monitoring-kpi-card"
                  styles={{ body: { padding: 16, minHeight: 132 } }}
                >
                  <Space size={8} align="center" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 22, color: k.color }}>{k.icon}</span>
                    <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.85)' }}>{k.title}</Text>
                    {liveBadge}
                  </Space>
                  <Space size={12} align="baseline">
                    <Text strong style={{ fontSize: 36, color: k.color, lineHeight: 1 }}>
                      {k.value}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>个</Text>
                    <Text style={{ fontSize: 14, color: k.color }}>{k.subValue}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    {k.subTitle} · 点击进入台账列表 →
                  </Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={12}>
            <Card bordered={false} styles={{ body: { padding: 20 } }}>
              <Space direction="vertical" size={6}>
                <Space><Text>平均故障恢复时间</Text>{liveBadge}</Space>
                <Text strong style={{ fontSize: 34, color: '#1677FF' }}>{kpi.mttr}</Text>
                <Text type="secondary">MTTR · 从故障发生到恢复的平均耗时</Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card bordered={false} styles={{ body: { padding: 20 } }}>
              <Space direction="vertical" size={6}>
                <Space><Text>平均故障间隔</Text>{liveBadge}</Space>
                <Text strong style={{ fontSize: 34, color: '#52C41A' }}>{kpi.mtbf}</Text>
                <Text type="secondary">MTBF · 两次故障之间的平均运行时间</Text>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 饼图：各运行状态科室智能体数量比例 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={12}>
            <Card bordered={false} className="monitoring-chart-card" title="各运行状态总占比"
              styles={{ body: { padding: 12, height: 300 } }} style={{ height: 352 }}>
              <Row gutter={8} style={{ height: 276 }}>
                <Col span={14}>
                  {/* 外层 overflow:hidden 兜底限制标签越界；内层 SVG overflow:visible 让标签溢出 SVG 仍可见 */}
                  <div style={{ height: 276, position: 'relative', overflow: 'hidden' }}>
                    <Pie
                      autoFit
                      pixelRatio={window.devicePixelRatio}
                      height={276}
                      data={pieData}
                      angleField="value"
                      colorField="type"
                      radius={0.6}
                      innerRadius={0.42}
                      appendPadding={[0, 0, 0, 0]}
                      color={['#52C41A', '#8C8C8C', '#FA8C16', '#FF4D4F']}
                      legend={false}
                      label={false}
                      tooltip={{
                        formatter: (datum: any) => {
                          const v = datum?.value ?? 0;
                          const pct = ((v / (pieTotal || 1)) * 100).toFixed(1);
                          return { name: datum?.type ?? '', value: `${v} 个（${pct}%）` };
                        },
                      }}
                    />
                    {/* 自绘扇区外侧标签：扇区中点 → 标签落点的引导线（参考图2 spider 样式） */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="xMidYMid meet"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        overflow: 'visible',
                      }}
                    >
                      {statusLabelPositions.map((p) => (
                        <line
                          key={`line-${p.type}`}
                          x1={p.sliceX}
                          y1={p.sliceY}
                          x2={p.x}
                          y2={p.y}
                          stroke="#BFBFBF"
                          strokeWidth={0.3}
                          pointerEvents="none"
                        />
                      ))}
                      {statusLabelPositions.map((p) => (
                        <g key={p.type} style={{ pointerEvents: 'none' }}>
                          <text
                            x={p.x}
                            y={p.y}
                            fontSize={3.2}
                            fill="#262626"
                            textAnchor={p.anchor}
                            dominantBaseline="middle"
                            style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 0.6 }}
                          >
                            <tspan x={p.x} dy="0">{p.type}</tspan>
                            <tspan x={p.x} dy="3.6" fontSize={2.8} fill="#595959">
                              {p.value} 个（{p.pct}%）
                            </tspan>
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </Col>
                <Col span={10}>
                  {/* 右侧图例：色块 + 名称 + 数量 / 占比 + 进度条（与图2 智能体来源分布情况 一致） */}
                  <div
                    style={{
                      height: 276,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '4px 0',
                      gap: 14,
                    }}
                  >
                    {pieData.map((d) => {
                      const pct = ((d.value / (pieTotal || 1)) * 100).toFixed(1);
                      return (
                        <div key={d.type} style={{ padding: '4px 4px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 6,
                            }}
                          >
                            <Space size={6} align="center">
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 2,
                                  background: STATUS_COLOR_MAP[d.type] || '#1677FF',
                                }}
                              />
                              <span style={{ fontSize: 13, color: '#595959' }}>{d.type}</span>
                            </Space>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                              {d.value} <Text type="secondary" style={{ fontSize: 11 }}>（{pct}%）</Text>
                            </span>
                          </div>
                          <Progress
                            percent={Number(pct)}
                            showInfo={false}
                            strokeColor={STATUS_COLOR_MAP[d.type] || '#1677FF'}
                            size="small"
                          />
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card bordered={false} className="monitoring-chart-card" title="各运行状态 - 科室分布"
              styles={{ body: { padding: 12, height: 300, overflowY: 'auto' } }} style={{ height: 352 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)', gap: 8, fontSize: 12 }}>
                  <div />
                  <div style={{ textAlign: 'center' }}><Tag color="success">在线</Tag></div>
                  <div style={{ textAlign: 'center' }}><Tag>离线</Tag></div>
                  <div style={{ textAlign: 'center' }}><Tag color="warning">禁用</Tag></div>
                  <div style={{ textAlign: 'center' }}><Tag color="error">异常</Tag></div>
                  <div style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 11 }}>占比</Text></div>
                </div>
                {deptDistributionV18.map((d) => {
                  const total = d.online + d.offline + d.disabled + d.abnormal || 1;
                  return (
                    <div
                      key={d.department}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px repeat(5, 1fr)',
                        gap: 8,
                        alignItems: 'center',
                        padding: '6px 4px',
                        borderBottom: '1px dashed #f0f0f0',
                      }}
                    >
                      <Text style={{ fontSize: 13 }}>{d.department}</Text>
                      <div style={{ textAlign: 'center', fontWeight: 500 }}>{d.online}</div>
                      <div style={{ textAlign: 'center', fontWeight: 500 }}>{d.offline}</div>
                      <div style={{ textAlign: 'center', fontWeight: 500 }}>{d.disabled}</div>
                      <div style={{ textAlign: 'center', fontWeight: 500, color: d.abnormal > 0 ? '#FF4D4F' : undefined }}>{d.abnormal}</div>
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#8c8c8c' }}>
                        在线 {Math.round((d.online / total) * 100)}%
                      </div>
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 智能体实时状态表（精简版） */}
        <Card bordered={false} style={{ marginTop: 16 }} title="智能体运行状态实时列表">
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 100px 100px 140px 140px 1fr',
                gap: 12,
                padding: '8px 12px',
                background: '#FAFAFA',
                borderRadius: 4,
                fontSize: 12,
                color: '#8c8c8c',
              }}
            >
              <div>状态</div>
              <div>智能体</div>
              <div>科室</div>
              <div>实例</div>
              <div>心跳成功率</div>
              <div>最近心跳</div>
              <div>关联告警</div>
            </div>
            {mockAgentsV18.map((a) => {
              const colorMap: Record<string, string> = {
                在线: 'success', 离线: 'default', 禁用: 'warning', 异常: 'error',
              };
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 100px 100px 140px 140px 1fr',
                    gap: 12,
                    padding: '8px 12px',
                    borderBottom: '1px dashed #f0f0f0',
                    alignItems: 'center',
                  }}
                >
                  <Tag color={colorMap[a.status]}>{a.status}</Tag>
                  <Link to={`/app/ledger/list?agentId=${a.id}`}><Text>{a.name}</Text></Link>
                  <Text type="secondary" style={{ fontSize: 12 }}>{a.department}</Text>
                  <Text type={a.instances.online < a.instances.expected ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                    {a.instances.online} / {a.instances.expected}
                  </Text>
                  <Text type={a.heartbeatRate < 0.9995 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                    {(a.heartbeatRate * 100).toFixed(2)}%
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{a.lastHeartbeatAt}</Text>
                  <Text type={a.relatedAlert ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
                    {a.relatedAlert || '—'}
                  </Text>
                </div>
              );
            })}
          </Space>
        </Card>
      </Spin>
    </div>
  );
};

export default StatusV18;
