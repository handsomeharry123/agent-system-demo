/**
 * 统一台账中心 - 智能体 360 画像视图
 *
 * 对齐《智能体360画像视图-需求说明V1》：
 * - 详情页默认视图，深色科技风数据大屏
 * - 核心状态信息收纳在基本信息区
 * - 四角环绕：基本信息 / 技术信息 / 准入评测 / 运行监控
 * - 中心：智能体为锚点的院内资源环形拓扑，异常连接高亮
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Col,
  Divider,
  Empty,
  Flex,
  Progress,
  Row,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  GlobalOutlined,
  KeyOutlined,
  LineChartOutlined,
  MonitorOutlined,
  NodeIndexOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { LedgerAgent, LinkedResource } from '../../mock/ledger';
import MultiRingTopology from './components/MultiRingTopology';

const { Text, Paragraph } = Typography;

const SOURCE_DISPLAY: Record<string, string> = {
  自研: '自研',
  外采: '第三方',
  合作开发: '合作研发',
};

const riskColor: Record<string, string> = {
  高度关注: '#ff4d4f',
  中度关注: '#faad14',
  一般关注: '#40a9ff',
  待分级: '#8c8c8c',
  待复核: '#faad14',
};

const runtimeTone: Record<string, { color: string; text: string }> = {
  在线: { color: '#35f2c9', text: '在线' },
  离线: { color: '#8c8c8c', text: '离线' },
  更新: { color: '#fadb14', text: '更新' },
  禁用: { color: '#fa8c16', text: '禁用' },
  异常: { color: '#ff4d4f', text: '异常' },
};

const copyText = async (value: string, success = '复制成功') => {
  try {
    await navigator.clipboard?.writeText(value);
    message.success(success);
  } catch {
    message.warning('当前浏览器不支持自动复制');
  }
};

const formatNumber = (value?: number) => (value ?? 0).toLocaleString();

const panelStyle: React.CSSProperties = {
  height: '100%',
  border: '1px solid rgba(77, 210, 255, 0.28)',
  borderRadius: 8,
  padding: 12,
  background:
    'linear-gradient(180deg, rgba(10, 35, 75, 0.92) 0%, rgba(5, 20, 48, 0.88) 100%)',
  boxShadow: 'inset 0 0 24px rgba(46, 179, 255, 0.10), 0 10px 28px rgba(0, 0, 0, 0.20)',
};

const labelStyle: React.CSSProperties = {
  color: 'rgba(205, 231, 255, 0.68)',
  fontSize: 11,
};

const valueStyle: React.CSSProperties = {
  color: '#e8f7ff',
  fontSize: 11,
  wordBreak: 'break-word',
};

const Panel: React.FC<{
  title: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
  bodyFlex?: boolean;
}> = ({ title, icon, extra, children, bodyFlex }) => (
  <section
    style={
      bodyFlex
        ? {
            ...panelStyle,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }
        : panelStyle
    }
  >
    <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
      <Space size={8}>
        <span style={{ color: '#35f2ff', fontSize: 16 }}>{icon}</span>
        <span style={{ color: '#effbff', fontSize: 15, fontWeight: 600 }}>{title}</span>
      </Space>
      {extra}
    </Flex>
    <div
      style={
        bodyFlex
          ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }
          : undefined
      }
    >
      {children}
    </div>
  </section>
);

const DataLine: React.FC<{
  label: string;
  children: React.ReactNode;
  span?: boolean;
}> = ({ label, children, span }) => (
  <div style={{ minWidth: 0, gridColumn: span ? '1 / -1' : undefined }}>
    <div style={labelStyle}>{label}</div>
    <div style={{ ...valueStyle, marginTop: 2 }}>{children}</div>
  </div>
);

const BasicStatusCard: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: string;
}> = ({ label, value, tone = '#35f2ff' }) => (
  <div
    style={{
      border: `1px solid ${tone}55`,
      borderRadius: 8,
      padding: '6px 8px',
      background: `linear-gradient(180deg, ${tone}1f 0%, rgba(4, 18, 43, 0.72) 100%)`,
      boxShadow: `inset 0 0 16px ${tone}1a`,
      minWidth: 0,
    }}
  >
    <div style={{ color: 'rgba(205,231,255,0.68)', fontSize: 11 }}>{label}</div>
    <div
      style={{
        marginTop: 3,
        color: '#f4fbff',
        fontSize: 13,
        fontWeight: 650,
        lineHeight: 1.2,
        wordBreak: 'break-word',
      }}
    >
      {value}
    </div>
  </div>
);

const MiniMetric: React.FC<{
  label: string;
  value: React.ReactNode;
  color?: string;
  onClick?: () => void;
}> = ({ label, value, color = '#35f2ff', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%',
      border: `1px solid ${color}55`,
      borderRadius: 8,
      padding: '8px 6px',
      background: `${color}14`,
      cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left',
    }}
  >
    <div style={{ color: 'rgba(205,231,255,0.68)', fontSize: 11 }}>{label}</div>
    <div style={{ color, fontSize: 20, fontWeight: 700, marginTop: 0 }}>{value}</div>
  </button>
);

/** 纵轴刻度紧凑数字：≥1万→x.x万，≥1000→x.xk，其余取整原样 */
const compactNum = (value: number) => {
  const n = Math.round(value);
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
};

/** 依据数据计算带留白的纵轴范围，避免折线贴顶/贴底 */
const buildScale = (values: number[]) => {
  const dMin = Math.min(...values);
  const dMax = Math.max(...values);
  let lo = dMin;
  let hi = dMax;
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.25 || 1;
    hi = lo + pad;
    lo = Math.max(0, lo - pad);
  } else {
    const pad = (hi - lo) * 0.18;
    hi += pad;
    lo = dMin >= 0 ? Math.max(0, lo - pad) : lo - pad;
  }
  return { lo, hi };
};

/**
 * 科技风趋势折线图
 * - 横纵坐标轴刻度 + 虚线网格
 * - 渐变面积填充 + 辉光折线
 * - 折线/面积/数据点默认完整连续渲染，无逐段描绘或延迟弹入
 * - 末点脉冲呼吸(科技感细节装饰，不影响线条连续性)
 * 折线/面积用 preserveAspectRatio="none" 拉满绘图区，坐标文本与数据点走 HTML 层
 * 叠加(按百分比定位到同一绘图矩形)，因此文字不随 SVG 拉伸变形。
 */
const TrendChart: React.FC<{
  values: number[];
  labels?: string[];
  color?: string;
  gridLines?: number;
  formatValue?: (v: number) => string;
}> = ({ values, labels = [], color = '#35f2ff', gridLines = 3, formatValue = compactNum }) => {
  const uid = React.useId().replace(/:/g, '');
  const vals = values.length ? values : [0];
  const n = vals.length;
  const { lo, hi } = buildScale(vals);
  const span = hi - lo || 1;
  const xAt = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (v: number) => (1 - Math.min(1, Math.max(0, (v - lo) / span))) * 100;
  const pts = vals.map((v, i) => ({ x: xAt(i), y: yAt(v), v, label: labels[i] }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${pts[n - 1].x.toFixed(2)} 100 L${pts[0].x.toFixed(2)} 100 Z`;
  const rows = Math.max(2, gridLines);
  const ticks = Array.from({ length: rows }, (_, k) => {
    const f = k / (rows - 1);
    return { yPct: (1 - f) * 100, val: lo + span * f };
  });
  const showX = (i: number) => (n <= 4 ? true : i % 3 === 0 || i === n - 1);

  return (
    <div
      style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, display: 'flex' }}
    >
      {/* 绘图矩形：左侧留给纵轴刻度，底部留给横轴刻度 */}
      <div style={{ position: 'absolute', left: 36, right: 8, top: 8, bottom: 18 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.34} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <line
              key={i}
              x1="0"
              y1={t.yPct}
              x2="100"
              y2={t.yPct}
              stroke="rgba(120,190,255,0.16)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path className="trend-area" d={area} fill={`url(#${uid}-area)`} />
          <path
            className="trend-line"
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 3px ${color}bb)` }}
          />
        </svg>

        {/* 数据点(HTML 层，始终为正圆) */}
        {pts.map((p, i) => (
          <div
            key={i}
            className="trend-dot"
            title={`${p.label ?? ''} ${formatValue(p.v)}`.trim()}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 6,
              height: 6,
              marginLeft: -3,
              marginTop: -3,
              borderRadius: '50%',
              background: '#071733',
              border: `2px solid ${color}`,
            }}
          />
        ))}
        {/* 末点脉冲呼吸 */}
        <div
          className="trend-head"
          style={{
            position: 'absolute',
            left: `${pts[n - 1].x}%`,
            top: `${pts[n - 1].y}%`,
            width: 7,
            height: 7,
            marginLeft: -3.5,
            marginTop: -3.5,
            borderRadius: '50%',
            background: color,
            color,
          }}
        />

        {/* 横轴刻度 */}
        {pts.map((p, i) =>
          showX(i) ? (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '100%',
                left: `${p.x}%`,
                transform: 'translateX(-50%)',
                marginTop: 4,
                fontSize: 9,
                lineHeight: 1,
                color: 'rgba(205,231,255,0.55)',
                whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </div>
          ) : null,
        )}

        {/* 纵轴刻度 */}
        {ticks.map((t, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: '100%',
              top: `${t.yPct}%`,
              transform: 'translateY(-50%)',
              marginRight: 5,
              fontSize: 9,
              lineHeight: 1,
              color: 'rgba(205,231,255,0.5)',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {formatValue(t.val)}
          </div>
        ))}
      </div>
    </div>
  );
};

const TinyBars: React.FC<{
  items: Array<{ name: string; score: number }>;
}> = ({ items }) => (
  <div
    style={{
      width: '100%',
      display: 'grid',
      gridTemplateRows: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
      gap: 5,
      minHeight: 0,
    }}
  >
    {items.map((item) => (
      <div key={item.name} style={{ minHeight: 0 }}>
        <Flex justify="space-between" align="center" style={{ lineHeight: 1.05 }}>
          <Tooltip title={`${item.name}：${item.score} 分`}>
            <span style={{ color: 'rgba(232,247,255,0.92)', fontSize: 12 }}>{item.name}</span>
          </Tooltip>
          <span style={{ color: '#35f2ff', fontSize: 12, fontWeight: 600 }}>{item.score}</span>
        </Flex>
        <div
          style={{
            height: 8,
            marginTop: 3,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.10)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${item.score}%`,
              height: '100%',
              borderRadius: 999,
              background:
                item.score >= 85
                  ? 'linear-gradient(90deg, #35f2c9, #35f2ff)'
                  : 'linear-gradient(90deg, #faad14, #35f2ff)',
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

const EvaluationTrendCard: React.FC<{
  reportId?: string;
  values: number[];
  labels?: string[];
}> = ({ reportId, values, labels }) => (
  <div
    style={{
      ...panelStyle,
      height: '100%',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}
  >
    <Flex justify="space-between" align="center" style={{ flex: '0 0 auto', marginBottom: 6 }}>
      <Space>
        <LineChartOutlined style={{ color: '#35f2ff' }} />
        <span style={{ color: '#e8f7ff', fontSize: 13, fontWeight: 600 }}>多次评测得分趋势</span>
      </Space>
      {reportId ? <Text style={{ color: 'rgba(205,231,255,0.68)', fontSize: 11 }}>{reportId}</Text> : null}
    </Flex>
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <TrendChart
        values={values}
        labels={labels}
        color="#35f2ff"
        formatValue={(v) => `${Math.round(v)}`}
      />
    </div>
  </div>
);

export interface ProfileView360Props {
  agent: LedgerAgent;
  isDept?: boolean;
  onSwitchToDetail: () => void;
}

const ProfileView360: React.FC<ProfileView360Props> = ({ agent }) => {
  const navigate = useNavigate();
  const [secretVisible, setSecretVisible] = useState(false);
  const [monitorRange, setMonitorRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const runtime = agent.runtimeStatus ? runtimeTone[agent.runtimeStatus] : undefined;
  const evalData = agent.evaluationReport;
  const totalScore = evalData?.totalScore ?? 0;
  const evalRating = totalScore >= 90 ? '优秀' : totalScore >= 80 ? '良好' : totalScore >= 75 ? '通过' : '待优化';
  const starText = '★★★★★'.slice(0, Math.max(1, Math.round(totalScore / 20)));
  const securityScores = evalData?.securityDetails ?? [];
  const evalTrend = evalData?.history.map((item) => item.totalScore) ?? [];
  const evalTrendLabels = evalData?.history.map((item) => `v${item.version}`) ?? [];
  const callTrend = useMemo(() => {
    const base = agent.callVolume?.[monitorRange] ?? 0;
    return Array.from({ length: 12 }, (_, index) =>
      Math.max(0, Math.round(base * (0.62 + index * 0.035 + ((index % 3) - 1) * 0.05))),
    );
  }, [agent.callVolume, monitorRange]);
  const alarmTrend = useMemo(() => {
    const base = agent.alarmCount?.[monitorRange] ?? 0;
    return Array.from({ length: 12 }, (_, index) =>
      Math.max(0, Math.round(base * (0.30 + (index % 4) * 0.18))),
    );
  }, [agent.alarmCount, monitorRange]);
  // 横轴刻度：按 日/周/月 合成最近 12 个刻度（末位为当前，最新在右）
  const rangeLabels = useMemo(() => {
    const n = 12;
    if (monitorRange === 'daily') {
      return Array.from({ length: n }, (_, i) => `T-${n - 1 - i}`);
    }
    if (monitorRange === 'weekly') {
      return Array.from({ length: n }, (_, i) => `W${i + 1}`);
    }
    return Array.from({ length: n }, (_, i) => `${((6 + i) % 12) + 1}月`);
  }, [monitorRange]);
  const abnormalConnections = agent.linkedResources.filter((item) => item.linkStatus === 'abnormal').length;
  const maskedSecret = agent.apiKey
    ? `${agent.apiKey.slice(0, 4)}****${agent.apiKey.slice(-2)}`
    : agent.accessType === 'OTel'
      ? 'ot-****-key'
      : agent.accessType === 'SDK'
        ? 'sk-****-sdk'
        : '********';
  const visibleSecret = agent.apiKey || 'sk-demo-360-profile-key';
  const platformUrl = agent.interfaceUrl || 'https://agent-platform.example.com/collect';
  const embedCode =
    agent.accessType === 'OTel'
      ? `OTEL_EXPORTER_OTLP_ENDPOINT=${platformUrl}`
      : `AgentSDK.init({ endpoint: '${platformUrl}', key: '${maskedSecret}' })`;

  const handlePreviewAttachment = () => {
    const file = agent.filingAttachments[0];
    if (!file) {
      message.info('暂无备案材料');
      return;
    }
    message.info(`预览 ${file.name}`);
  };

  return (
    <div
      style={{
        padding: '6px 12px 4px',
        borderRadius: 8,
        background:
          'radial-gradient(circle at 50% 34%, rgba(31, 111, 205, 0.30) 0%, rgba(3, 15, 38, 0.92) 42%, #020916 100%)',
        color: '#effbff',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 0.86fr) minmax(440px, 1.25fr) minmax(300px, 0.86fr)',
          gap: 12,
          height: 'clamp(560px, calc(100vh - 206px), 900px)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* 左列：基本信息(左上) + 准入评测(左下) */}
        <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1.22fr) minmax(210px, 0.78fr)', gap: 10, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <Panel
              title="基本信息"
              icon={<FileSearchOutlined />}
              bodyFlex
              extra={
                <Button size="small" ghost icon={<SafetyCertificateOutlined />} onClick={() => navigate(`/app/ledger/risk/${agent.id}`)}>
                  风险分级
                </Button>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <BasicStatusCard
                  label="智能体编号"
                  value={
                    <Tooltip title="点击复制编号">
                      <span style={{ cursor: 'pointer' }} onClick={() => copyText(agent.idCode)}>
                        {agent.idCode} <CopyOutlined />
                      </span>
                    </Tooltip>
                  }
                />
                <BasicStatusCard label="智能体名称" value={agent.name} tone="#69c0ff" />
                <BasicStatusCard label="版本" value={agent.version} tone="#b37feb" />
                <BasicStatusCard label="风险分级" value={agent.riskLevel} tone={riskColor[agent.riskLevel] ?? '#35f2ff'} />
                <div style={{ gridColumn: '1 / -1' }}>
                  <BasicStatusCard
                    label="运行状态"
                    value={
                      runtime ? (
                        <Tooltip title={agent.runtimeStatus === '异常' ? '异常原因：资源连接或实例心跳异常' : '实时同步运行监控中心'}>
                          <Badge color={runtime.color} text={<span style={{ color: '#f4fbff' }}>{runtime.text}</span>} />
                        </Tooltip>
                      ) : (
                        '未上线'
                      )
                    }
                    tone={runtime?.color ?? '#8c8c8c'}
                  />
                </div>
              </div>
              <Divider style={{ borderColor: 'rgba(255,255,255,0.12)', margin: '0 0 8px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <DataLine label="所属科室">{agent.departmentCode} · {agent.department}</DataLine>
                <DataLine label="诊疗环节">
                  <Space size={4} wrap>
                    {agent.diagnosisPhase.map((item) => (
                      <Tag key={item} color="geekblue" style={{ marginRight: 0 }}>{item}</Tag>
                    ))}
                  </Space>
                </DataLine>
                <DataLine label="智能体来源">{SOURCE_DISPLAY[agent.sourceType] ?? agent.sourceType}</DataLine>
                <DataLine label="供应商名称">
                  <Tooltip title={agent.vendor || '自研'}>
                    <span>{agent.vendor || '自研'}</span>
                  </Tooltip>
                </DataLine>
                <DataLine label="技术联系人">{agent.techContact || '暂无'}</DataLine>
                <DataLine label="联系方式">
                  {agent.techContactPhone ? (
                    <Tooltip title="点击复制联系方式">
                      <span style={{ cursor: 'pointer' }} onClick={() => copyText(agent.techContactPhone || '')}>
                        {agent.techContactPhone} <CopyOutlined />
                      </span>
                    </Tooltip>
                  ) : (
                    '暂无'
                  )}
                </DataLine>
                <DataLine label="创建 / 更新时间" span>
                  {agent.accessTime} / {agent.onlineTime || agent.accessTime}
                </DataLine>
                <DataLine label="功能描述" span>
                  <Tooltip title={agent.description}>
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ color: '#e8f7ff', marginBottom: 0, fontSize: 11 }}
                    >
                      {agent.description || '暂无描述'}
                    </Paragraph>
                  </Tooltip>
                </DataLine>
              </div>
              <Divider style={{ borderColor: 'rgba(255,255,255,0.12)', margin: '8px 0' }} />
              <Flex gap={8} wrap>
                <Button size="small" ghost icon={<EyeOutlined />} onClick={handlePreviewAttachment}>
                  查看备案材料
                </Button>
                <Button size="small" ghost icon={<DownloadOutlined />} onClick={() => message.info('下载备案材料')}>
                  下载
                </Button>
              </Flex>
            </Panel>
          </div>

          <div style={{ minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <Panel
              title="准入评测"
              icon={<SafetyCertificateOutlined />}
              bodyFlex
              extra={
                evalData ? (
                  <Button size="small" ghost icon={<FileSearchOutlined />} onClick={() => navigate('/app/evaluation/report')}>
                    报告
                  </Button>
                ) : null
              }
            >
              {evalData ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(92px, 0.78fr) minmax(0, 1.55fr)',
                    gap: 12,
                    alignItems: 'stretch',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                    <Progress
                      type="circle"
                      percent={totalScore}
                      size={104}
                      strokeColor={totalScore >= 85 ? '#35f2c9' : '#faad14'}
                      trailColor="rgba(255,255,255,0.12)"
                      format={() => (
                        <span style={{ color: '#effbff', fontSize: 22, fontWeight: 700 }}>{totalScore}</span>
                      )}
                    />
                    <div style={{ color: '#faad14', fontSize: 12, marginTop: 5, lineHeight: 1 }}>{starText}</div>
                    <div style={{ color: '#e8f7ff', fontSize: 12, fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>{evalRating}</div>
                    <div style={{ color: 'rgba(205,231,255,0.68)', fontSize: 10, marginTop: 3, lineHeight: 1.2 }}>
                      最近评测 {evalData.history.at(-1)?.evaluatedAt || '暂无'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, minHeight: 0 }}>
                    <TinyBars items={securityScores} />
                  </div>
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: 'rgba(232,247,255,0.72)' }}>尚未生成评测报告</span>}
                />
              )}
            </Panel>
          </div>
        </div>

        {/* 中间：关联资源拓扑地图 (V2.8 多级辐射 + 电流流动) */}
        <div style={{ display: 'grid', gridTemplateRows: evalData ? 'minmax(0, 1fr) 176px' : 'minmax(0, 1fr)', gap: 10, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <MultiRingTopology
              agent={agent}
              onResourceDrill={(resource) => {
                if (resource.linkStatus === 'abnormal') {
                  message.error(`${resource.name} 当前对接异常，请查看异常详情`);
                }
                navigate('/app/resource-center/resources');
              }}
            />
          </div>
          {evalData ? (
            <div style={{ minHeight: 0 }}>
              <EvaluationTrendCard reportId={evalData.reportId} values={evalTrend} labels={evalTrendLabels} />
            </div>
          ) : null}
        </div>

        {/* 右列：技术信息(右上) + 运行监控(右下) */}
        <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 0.68fr) minmax(0, 1.32fr)', gap: 10, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <Panel title="技术信息" icon={<ApiOutlined />} bodyFlex extra={<Tag color="cyan">{agent.accessType} 接入</Tag>}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <DataLine label={agent.accessType === 'API' ? '接口地址' : '平台 URL 地址'}>
                  <Tooltip title="点击复制地址">
                    <span style={{ cursor: 'pointer' }} onClick={() => copyText(platformUrl, '地址已复制')}>
                      <GlobalOutlined /> {platformUrl}
                    </span>
                  </Tooltip>
                </DataLine>
                <DataLine label={agent.accessType === 'API' ? 'API key' : '平台密钥 key'}>
                  <Space size={8}>
                    <code style={{ color: '#35f2ff' }}>{secretVisible ? visibleSecret : maskedSecret}</code>
                    <Button
                      size="small"
                      type="text"
                      icon={secretVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setSecretVisible((value) => !value)}
                      style={{ color: '#b7f8ff' }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => copyText(visibleSecret, '密钥已复制')}
                      style={{ color: '#b7f8ff' }}
                    />
                  </Space>
                </DataLine>
                {agent.accessType !== 'API' && (
                  <div
                    style={{
                      border: '1px solid rgba(53,242,255,0.20)',
                      borderRadius: 6,
                      padding: 8,
                      background: 'rgba(0,0,0,0.18)',
                      color: '#b7f8ff',
                      fontSize: 11,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      wordBreak: 'break-all',
                    }}
                  >
                    <CodeOutlined /> {embedCode}
                  </div>
                )}
                <DataLine label="接入时间">{agent.accessTime}</DataLine>
                <Flex gap={8} wrap>
                  <Button size="small" ghost icon={<ThunderboltOutlined />} onClick={() => message.success('连接测试通过')}>
                    测试连接
                  </Button>
                  <Button size="small" ghost icon={<FileTextOutlined />} onClick={handlePreviewAttachment}>
                    技术规格书
                  </Button>
                </Flex>
              </Space>
            </Panel>
          </div>

          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Panel
              title="运行监控"
              icon={<MonitorOutlined />}
              bodyFlex
              extra={
                <Segmented
                  size="small"
                  value={monitorRange}
                  onChange={(value) => setMonitorRange(value as 'daily' | 'weekly' | 'monthly')}
                  options={[
                    { label: '日', value: 'daily' },
                    { label: '周', value: 'weekly' },
                    { label: '月', value: 'monthly' },
                  ]}
                />
              }
            >
              {/* 4 个 KPI —— 自然高度，但不让其压制趋势区 */}
              <Row gutter={[8, 8]} style={{ flex: '0 0 auto' }}>
                <Col span={12}>
                  <MiniMetric
                    label="总调用量"
                    value={formatNumber(agent.callVolume?.[monitorRange])}
                    onClick={() => navigate('/app/monitoring/business')}
                  />
                </Col>
                <Col span={12}>
                  <MiniMetric
                    label="告警次数"
                    value={`${agent.alarmCount?.[monitorRange] ?? 0} 次`}
                    color="#faad14"
                    onClick={() => navigate('/app/monitoring/alerts')}
                  />
                </Col>
                <Col span={12}>
                  <MiniMetric
                    label="平均在线持续时长"
                    value={`${Math.round((agent.instanceOnlineRate ?? 0) * 24 * 10) / 10} h`}
                    color="#35f2c9"
                    onClick={() => navigate('/app/monitoring/status')}
                  />
                </Col>
                <Col span={12}>
                  <MiniMetric
                    label="平均异常持续时长"
                    value={`${abnormalConnections > 0 || agent.runtimeStatus === '异常' ? 42 : 0} min`}
                    color={abnormalConnections > 0 || agent.runtimeStatus === '异常' ? '#ff4d4f' : '#8c8c8c'}
                    onClick={() => navigate('/app/monitoring/status')}
                  />
                </Col>
              </Row>

              {/* 趋势区 —— 撑满剩余空间，两条 sparkline 各占一半 */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 6 }}>
                <Flex justify="space-between" align="center" style={{ flex: '0 0 auto' }}>
                  <Space>
                    <BarChartOutlined style={{ color: '#faad14' }} />
                    <span style={{ color: '#e8f7ff', fontSize: 11 }}>告警次数趋势</span>
                  </Space>
                  <WarningOutlined style={{ color: abnormalConnections > 0 ? '#ff4d4f' : '#35f2c9' }} />
                </Flex>
                <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                  <TrendChart
                    values={alarmTrend}
                    labels={rangeLabels}
                    color="#faad14"
                    formatValue={(v) => `${Math.round(v)}`}
                  />
                </div>
                <Divider style={{ borderColor: 'rgba(255,255,255,0.12)', margin: '6px 0', flex: '0 0 auto' }} />
                <Flex justify="space-between" align="center" style={{ flex: '0 0 auto' }}>
                  <Space>
                    <RadarChartOutlined style={{ color: '#35f2ff' }} />
                    <span style={{ color: '#e8f7ff', fontSize: 11 }}>调用量趋势</span>
                  </Space>
                  <CloudServerOutlined style={{ color: '#35f2ff' }} />
                </Flex>
                <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                  <TrendChart
                    values={callTrend}
                    labels={rangeLabels}
                    color="#35f2ff"
                  />
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginTop: 4, color: 'rgba(205,231,255,0.58)', fontSize: 11, lineHeight: 1.3 }}>
        <Space wrap>
          <DatabaseOutlined />
          <span>数据来源：接入中心 / 医院资源管理中心 / 准入评测沙盒 / 运行监控中心</span>
        </Space>
        <Space split={<Divider type="vertical" style={{ borderColor: 'rgba(255,255,255,0.18)' }} />}>
          <span>资源 {agent.linkedResources.length}</span>
          <span>异常连接 {abnormalConnections}</span>
          <span>备案材料 {agent.filingAttachments.length}</span>
        </Space>
      </Flex>
    </div>
  );
};

export default ProfileView360;
