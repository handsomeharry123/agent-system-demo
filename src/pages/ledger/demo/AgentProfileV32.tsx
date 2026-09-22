/**
 * 统一台账中心 - 智能化升级 Demo
 * §3.2 智能体 360 画像视图
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.2：
 *   - §3.2.1 台账列表页:辅助标识 + 检索定位 + 进入画像
 *   - §3.2.2 智能体 360 画像视图:实体 + 关联资源拓扑 + 准入评测 + 运行监测 + 下钻
 *   - §3.2.3 视图字段:基本/技术信息、关联资源拓扑(异常醒目)、评测各维度得分 + 趋势、运行监测(告警橙 / 故障红)
 *
 * 设计:
 *   - 顶部 PageHeader 含视图切换(本次新增 360 画像视图 ↔ 原信息详情页)
 *   - 中部 4 个区块:
 *       ① 实体信息(基础+技术) Card
 *       ② 关联资源拓扑(中央智能体 → 周围 HIS/PACS/LIS/EMR) Card
 *       ③ 准入评测(进度条 + 维度得分 mini 雷达 + 历史趋势) Card
 *       ④ 运行监测(总调用量/正常运行率/告警橙/故障红/恢复情况) Card
 *   - 异常连接用红色边框 + 抖动图标 + Tooltip 提示
 *   - 详情页可下钻到「基本信息 / 关联资源 / 准入评测 / 运行监测」明细(Mini Modal 演示)
 */
import React, { useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Button,
  Descriptions,
  Empty,
  Segmented,
  Tooltip,
  Modal,
  Progress,
  Timeline,
  Alert,
  Statistic,
  Tabs,
  Divider,
  Badge,
} from 'antd';
import {
  ArrowLeftOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
  ApiOutlined,
  ClusterOutlined,
  LinkOutlined,
  EyeOutlined,
  DownloadOutlined,
  LineChartOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  ApiOutlined as ApiIcon,
  CloudServerOutlined,
  ReloadOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  KeyOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';

const { Text, Title, Paragraph } = Typography;

// ============ Mock 智能体数据(对齐 PRD §3.2.3 字段口径) ============
const MOCK_AGENT = {
  id: 'lung-ai-001',
  idCode: 'IMG-0023',
  name: '肺结节智能筛查系统',
  nameEn: 'LungNodule-AI',
  version: '2.1',
  department: '影像科',
  departmentCode: 'IMG',
  diagnosisPhase: ['辅助诊断', '辅助检查'] as const,
  description:
    '基于深度学习的肺结节自动检出与良恶性辅助判断,支持 CT 影像上传、AI 检出、影像标注、结构化报告生成。',
  sourceType: '第三方' as const,
  vendor: '联影智能医疗科技有限公司',
  techContact: '张明',
  techContactPhone: '13901234567',
  riskLevel: '高度关注' as const,
  runtimeStatus: '在线' as const,
  accessType: 'API' as const,
  apiKey: 'sk-xxxxxxxxxxxxxxxxx(已脱敏)',
  interfaceUrl: 'https://api.lung-nodule-ai.com/v2',
  sdkLanguage: undefined,
  // PRD §3.2.3 技术信息字段:SDK / OTel 接入时展示 平台密钥(掩码)+ 平台 URL + 埋点代码
  // 演示用:同一智能体在三种接入方式下的字段全量备齐,可切换查看
  platformKey: 'pk_live_xxxx****1234',
  platformUrl: 'https://platform.lung-nodule-ai.com/sdk/v2',
  otelKey: 'ot_xxxx****5678',
  otelEndpoint: 'https://otel.lung-nodule-ai.com:4317',
  // 埋点代码:SDK / OTel 接入下根据平台 URL 与密钥自动生成
  trackingCode: {
    Java: `// SDK 接入(Java)\nLungNoduleSDK.init("${'pk_live_xxxx****1234'}");\nLungNoduleSDK.setEndpoint("${'https://platform.lung-nodule-ai.com/sdk/v2'}");`,
    Python: `# SDK 接入(Python)\nfrom lung_nodule_sdk import Client\nclient = Client(api_key="${'pk_live_xxxx****1234'}", endpoint="${'https://platform.lung-nodule-ai.com/sdk/v2'}")`,
    'Node.js': `// SDK 接入(Node.js)\nconst { LungNoduleClient } = require('lung-nodule-sdk');\nconst client = new LungNoduleClient({ apiKey: "${'pk_live_xxxx****1234'}" });`,
    OTel: `// OTel 接入\nconst { NodeSDK } = require('@opentelemetry/sdk-node');\nconst sdk = new NodeSDK({ endpoint: "${'https://otel.lung-nodule-ai.com:4317'}", headers: { 'x-otel-key': "${'ot_xxxx****5678'}" } });\nsdk.start();`,
  } as const,
  // 关联资源
  linkedResources: [
    { id: 'r-pacs', name: 'PACS 影像归档系统', type: 'PACS', linkType: 'API', contact: '李工', phone: '13900000001', status: 'normal' as const },
    { id: 'r-his', name: 'HIS 信息系统', type: 'HIS', linkType: 'API', contact: '王主任', phone: '13900000002', status: 'normal' as const },
    { id: 'r-emr', name: 'EMR 电子病历', type: 'EMR', linkType: 'HL7/FHIR', contact: '陈医生', phone: '13900000003', status: 'error' as const },
    { id: 'r-lis', name: 'LIS 检验系统', type: 'LIS', linkType: '数据库直连', contact: '赵工', phone: '13900000004', status: 'normal' as const },
  ],
  // 准入评测
  evaluation: {
    stage: '评测完成',
    progress: 100,
    totalScore: 87.5,
    passThreshold: 75,
    conclusion: '通过',
    dimensionScores: [
      { name: '安全性', score: 92 },
      { name: '准确性', score: 88 },
      { name: '性能', score: 85 },
      { name: '合规性', score: 86 },
      { name: '可用性', score: 84 },
      { name: '可解释性', score: 79 },
    ],
    history: [
      { date: '2025-04-15', score: 72, stage: '首次评测' },
      { date: '2025-08-22', score: 78, stage: '复测 1' },
      { date: '2025-12-10', score: 81, stage: '复测 2' },
      { date: '2026-03-18', score: 84, stage: '复测 3' },
      { date: '2026-05-25', score: 87.5, stage: '复测 4(当前)' },
    ],
  },
  // 运行监测
  runtime: {
    callVolume: { total: 128000, daily: 4200, weekly: 28500, monthly: 124000 },
    instanceOnlineRate: 99.2,
    alarm: { total: 12, daily: 1, weekly: 4, monthly: 12, recent: [
      { id: 'a1', time: '06-29 14:22', content: 'API 调用响应时间 > 2s', level: 'warning' },
      { id: 'a2', time: '06-28 09:08', content: 'GPU 利用率持续 > 90%', level: 'warning' },
      { id: 'a3', time: '06-27 16:45', content: 'PACS 接口鉴权失败次数 > 50', level: 'warning' },
    ]},
    fault: { total: 3, recent: [
      { id: 'f1', time: '06-26 22:15', content: '服务完全中断 18 分钟', recovered: true, recoveryTime: '06-26 22:33' },
      { id: 'f2', time: '06-15 11:30', content: 'EMR 字段映射错误导致报告生成失败', recovered: true, recoveryTime: '06-15 12:14' },
    ]},
    recovered: { count: 9, averageMinutes: 38 },
    // PRD §4.2.3 科室用户专有「使用效果」字段(管理员视角默认 0,不展示)
    //   - 本科室调用量：本科室对该智能体的调用次数,支持日/周/月
    //   - 活跃度：本科室使用活跃度(活跃用户数 / 使用频次)
    //   - 可用状态：当前是否可正常使用(受告警/故障影响情况)
    deptUsage: {
      callVolume: { daily: 1320, weekly: 8400, monthly: 38200 },
      activeUsers: 38,
      dailyFrequency: 8.2,
      // 三态:available 可用 / warning 受告警影响 / unavailable 不可用
      availableStatus: 'warning' as 'available' | 'warning' | 'unavailable',
      availableStatusReason: '受 1 条 PACS 接口超时告警影响,部分病例加载较慢',
    },
  },
};

// ============ 简易雷达图(SVG) ============
const RadarChart: React.FC<{
  data: Array<{ name: string; score: number }>;
  size?: number;
}> = ({ data, size = 280 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 28;
  const n = data.length;
  // 顶点角度(从 12 点钟起,顺时针)
  const angles = data.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const pt = (angle: number, ratio: number) => ({
    x: cx + R * ratio * Math.cos(angle),
    y: cy + R * ratio * Math.sin(angle),
  });

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* 网格圆/多边形 */}
      {gridLevels.map((lv) => {
        const points = angles
          .map((a) => {
            const p = pt(a, lv);
            return `${p.x},${p.y}`;
          })
          .join(' ');
        return (
          <polygon
            key={lv}
            points={points}
            fill="none"
            stroke="#F0F0F0"
            strokeWidth={1}
          />
        );
      })}
      {/* 轴线 */}
      {angles.map((a, i) => {
        const p = pt(a, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#F0F0F0"
            strokeWidth={1}
          />
        );
      })}
      {/* 数据多边形 */}
      <polygon
        points={data
          .map((d, i) => {
            const p = pt(angles[i], d.score / 100);
            return `${p.x},${p.y}`;
          })
          .join(' ')}
        fill="rgba(22,119,255,0.20)"
        stroke="#1677FF"
        strokeWidth={2}
      />
      {/* 数据点 */}
      {data.map((d, i) => {
        const p = pt(angles[i], d.score / 100);
        return <circle key={d.name} cx={p.x} cy={p.y} r={4} fill="#1677FF" stroke="#fff" strokeWidth={2} />;
      })}
      {/* 标签 */}
      {data.map((d, i) => {
        const lp = pt(angles[i], 1.18);
        return (
          <g key={d.name}>
            <text
              x={lp.x}
              y={lp.y}
              fontSize={11}
              fill="#262626"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {d.name}
            </text>
            <text
              x={lp.x}
              y={lp.y + 14}
              fontSize={10}
              fill="#1677FF"
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight={600}
            >
              {d.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ============ 关联资源拓扑图(SVG 中心放射式) ============
const ResourceTopology: React.FC<{ resources: typeof MOCK_AGENT.linkedResources }> = ({
  resources,
}) => {
  const W = 640;
  const H = 380;
  const cx = W / 2;
  const cy = H / 2;
  const R = 130;
  const n = resources.length;

  // 节点角度
  const positions = resources.map((r, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      ...r,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
    };
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'linear-gradient(180deg,#F0F5FF 0%,#FAFAFA 100%)', borderRadius: 8 }}>
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1677FF" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#1677FF" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={80} fill="url(#centerGlow)" />

      {/* 连线 */}
      {positions.map((p) => {
        const color = p.status === 'error' ? '#FF4D4F' : '#91CAFF';
        const width = p.status === 'error' ? 2.5 : 1.5;
        return (
          <g key={p.id}>
            <line
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke={color}
              strokeWidth={width}
              strokeDasharray={p.status === 'error' ? '6 3' : '0'}
            />
            {/* 对接方式标签 */}
            <rect
              x={(cx + p.x) / 2 - 28}
              y={(cy + p.y) / 2 - 9}
              width={56}
              height={18}
              rx={4}
              fill="#fff"
              stroke={color}
            />
            <text
              x={(cx + p.x) / 2}
              y={(cy + p.y) / 2 + 4}
              fontSize={10}
              fill={p.status === 'error' ? '#FF4D4F' : '#1677FF'}
              textAnchor="middle"
            >
              {p.linkType}
            </text>
          </g>
        );
      })}

      {/* 中心节点:智能体 */}
      <g>
        <circle cx={cx} cy={cy} r={44} fill="#1677FF" />
        <circle cx={cx} cy={cy} r={48} fill="none" stroke="#1677FF" strokeOpacity={0.3} strokeWidth={1}>
          <animate attributeName="r" values="48;60;48" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
        </circle>
        {/* 中心 icon:白色 SVG 绘制的简化机器人头部(双圆眼 + 天线) */}
        <g transform={`translate(${cx}, ${cy})`} fill="#fff">
          {/* 天线 */}
          <line x1={0} y1={-20} x2={0} y2={-30} stroke="#fff" strokeWidth={2} />
          <circle cx={0} cy={-32} r={3} fill="#fff" />
          {/* 头部方框 */}
          <rect x={-12} y={-20} width={24} height={20} rx={4} fill="#fff" opacity={0.95} />
          {/* 双圆眼 */}
          <circle cx={-5} cy={-12} r={2.5} fill="#1677FF" />
          <circle cx={5} cy={-12} r={2.5} fill="#1677FF" />
          {/* 嘴巴 */}
          <rect x={-4} y={-6} width={8} height={2} rx={1} fill="#1677FF" />
          {/* 身体 */}
          <rect x={-10} y={2} width={20} height={14} rx={3} fill="#fff" opacity={0.95} />
          <circle cx={-5} cy={9} r={1.5} fill="#1677FF" />
          <circle cx={5} cy={9} r={1.5} fill="#1677FF" />
        </g>
        <text
          x={cx}
          y={cy + 30}
          fontSize={11}
          fill="#262626"
          textAnchor="middle"
          fontWeight={600}
        >
          {MOCK_AGENT.name.length > 8 ? MOCK_AGENT.name.slice(0, 8) + '…' : MOCK_AGENT.name}
        </text>
        <text
          x={cx}
          y={cy + 42}
          fontSize={10}
          fill="#8C8C8C"
          textAnchor="middle"
        >
          {MOCK_AGENT.idCode}
        </text>
      </g>

      {/* 资源节点 */}
      {positions.map((p) => {
        const isErr = p.status === 'error';
        const stroke = isErr ? '#FF4D4F' : '#1677FF';
        const bg = isErr ? '#FFF1F0' : '#E6F4FF';
        const color = isErr ? '#FF4D4F' : '#1677FF';
        return (
          <g key={p.id}>
            <rect
              x={p.x - 50}
              y={p.y - 20}
              width={100}
              height={40}
              rx={6}
              fill={bg}
              stroke={stroke}
              strokeWidth={isErr ? 2 : 1}
              style={isErr ? { filter: 'drop-shadow(0 0 4px rgba(255,77,79,0.5))' } : {}}
            >
              {isErr && (
                <animate
                  attributeName="stroke-opacity"
                  values="1;0.4;1"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              )}
            </rect>
            {/* 异常图标 */}
            {isErr && (
              <g>
                <circle cx={p.x + 38} cy={p.y - 14} r={8} fill="#FF4D4F" />
                <text
                  x={p.x + 38}
                  y={p.y - 10}
                  fontSize={11}
                  fill="#fff"
                  textAnchor="middle"
                  fontWeight={700}
                >
                  !
                </text>
              </g>
            )}
            <text
              x={p.x}
              y={p.y - 4}
              fontSize={11}
              fill="#262626"
              textAnchor="middle"
              fontWeight={500}
            >
              {p.name.length > 8 ? p.name.slice(0, 8) + '…' : p.name}
            </text>
            <text
              x={p.x}
              y={p.y + 10}
              fontSize={9}
              fill={color}
              textAnchor="middle"
            >
              {p.type} · {isErr ? '对接异常' : '对接正常'}
            </text>
          </g>
        );
      })}

      {/* 图例 */}
      <g transform={`translate(${W - 160}, ${H - 40})`}>
        <rect x={0} y={0} width={150} height={28} rx={4} fill="#fff" stroke="#F0F0F0" />
        <circle cx={14} cy={14} r={4} fill="#1677FF" />
        <text x={24} y={17} fontSize={10} fill="#595959">正常对接</text>
        <circle cx={84} cy={14} r={4} fill="#FF4D4F" />
        <text x={94} y={17} fontSize={10} fill="#FF4D4F">异常连接(已醒目)</text>
      </g>
    </svg>
  );
};

// ============ 评测历史趋势 ============
const EvalTrendChart: React.FC<{ history: typeof MOCK_AGENT.evaluation.history }> = ({
  history,
}) => {
  const W = 420;
  const H = 180;
  const pad = { top: 20, right: 16, bottom: 30, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const minY = 60;
  const maxY = 100;
  const stepX = innerW / (history.length - 1);

  const points = history.map((h, i) => ({
    x: pad.left + i * stepX,
    y: pad.top + innerH - ((h.score - minY) / (maxY - minY)) * innerH,
    ...h,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const passY = pad.top + innerH - ((75 - minY) / (maxY - minY)) * innerH;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {/* 通过基线 */}
      <line
        x1={pad.left}
        y1={passY}
        x2={pad.left + innerW}
        y2={passY}
        stroke="#52C41A"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <text x={pad.left + innerW - 4} y={passY - 4} fontSize={10} fill="#52C41A" textAnchor="end">
        通过线 75
      </text>
      {/* 折线 */}
      <path d={pathD} fill="none" stroke="#1677FF" strokeWidth={2} />
      {/* 节点 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#1677FF" strokeWidth={2} />
          <text x={p.x} y={p.y - 8} fontSize={10} fill="#262626" textAnchor="middle">
            {p.score}
          </text>
          <text x={p.x} y={H - pad.bottom + 16} fontSize={9} fill="#8C8C8C" textAnchor="middle">
            {p.date.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ============ 主体 ============
type ViewMode = 'profile' | 'detail';
// 视角:管理员(PRD §3.2 全院) / 科室用户(PRD §4.2 本科室)
type ScopeMode = 'platform_admin' | 'dept_admin';

const AgentProfileV32: React.FC = () => {
  const [view, setView] = useState<ViewMode>('profile');
  const [drillModal, setDrillModal] = useState<null | 'basic' | 'resource' | 'evaluation' | 'runtime' | 'usage'>(null);
  // §4.2 视角切换（管理员/科室用户）— PRD §4.2 字段差异
  const [scope, setScope] = useState<ScopeMode>('platform_admin');

  const a = MOCK_AGENT;
  const isDept = scope === 'dept_admin';

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              size="small"
              onClick={() => window.history.back()}
            />
            <span>{a.name}</span>
            <Tag color="processing">PRD §3.2</Tag>
            <Tag color="blue">{a.idCode}</Tag>
            <Tag color="cyan">v{a.version}</Tag>
            <Tag color={a.runtimeStatus === '在线' ? 'green' : 'red'}>
              {a.runtimeStatus}
            </Tag>
            <Tag color="red">{a.riskLevel}</Tag>
          </Space>
        }
        subTitle={a.description.slice(0, 60) + '...'}
        extra={
          <Space size={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              视角:
            </Text>
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as ScopeMode)}
              options={[
                { label: '信息科管理员 (§3.2)', value: 'platform_admin' },
                { label: '科室用户 (§4.2)', value: 'dept_admin' },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
              视图:
            </Text>
            <Segmented
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { label: '🆕 360 画像视图', value: 'profile' },
                { label: '智能体信息详情页', value: 'detail' },
              ]}
            />
          </Space>
        }
      />

      {/* Demo 提示 */}
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 12 }}
        message={
          <span>
            💡 本页为 PRD
            <b style={{ margin: '0 4px' }}>{isDept ? '§4.2' : '§3.2'}</b>
            Demo —
            详情页默认展示本次新增的「360 画像视图」,可切换回原「智能体信息详情页」。
            <b style={{ margin: '0 4px' }}>{isDept && '科室用户视角下,运行监测区补齐「本科室调用量 / 活跃度 / 可用状态」3 项使用效果字段。'}</b>
            点击区块右下角"下钻查看明细"可弹窗查看该区块详细信息。
          </span>
        }
      />

      {view === 'profile' ? (
        <ProfileView a={a} onDrill={(k) => setDrillModal(k)} isDept={isDept} />
      ) : (
        <DetailViewFallback a={a} />
      )}

      {/* ===== 下钻明细弹窗 ===== */}
      <Modal
        title={
          drillModal === 'basic'
            ? '基本信息明细'
            : drillModal === 'resource'
              ? '关联资源明细'
              : drillModal === 'evaluation'
                ? '准入评测明细'
                : drillModal === 'runtime'
                  ? '运行监测明细'
                  : drillModal === 'usage'
                    ? '运行监测 · 使用效果明细(§4.2.3)'
                    : ''
        }
        open={!!drillModal}
        onCancel={() => setDrillModal(null)}
        footer={null}
        width={680}
      >
        {drillModal === 'basic' && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="智能体编号">{a.idCode}</Descriptions.Item>
            <Descriptions.Item label="智能体名称">{a.name}</Descriptions.Item>
            <Descriptions.Item label="智能体版本">{a.version}</Descriptions.Item>
            <Descriptions.Item label="所属科室">{a.department}</Descriptions.Item>
            <Descriptions.Item label="诊疗环节">{a.diagnosisPhase.join(' / ')}</Descriptions.Item>
            <Descriptions.Item label="智能体来源">{a.sourceType}</Descriptions.Item>
            <Descriptions.Item label="供应商名称" span={2}>{a.vendor}</Descriptions.Item>
            <Descriptions.Item label="技术联系人">{a.techContact}</Descriptions.Item>
            <Descriptions.Item label="联系方式">{a.techContactPhone}</Descriptions.Item>
            <Descriptions.Item label="风险分级">
              <Tag color="red">{a.riskLevel}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="运行状态">
              <Tag color="green">{a.runtimeStatus}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="接入方式" span={2}>
              <Tag color="processing">{a.accessType}</Tag>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                (PRD §3.2.3:SDK / OTel 接入时展示「平台密钥 + 平台 URL + 埋点代码」)
              </Text>
            </Descriptions.Item>
            {a.accessType === 'API' && (
              <>
                <Descriptions.Item label="API Key(脱敏)" span={2}>
                  <Space>
                    <code>{a.apiKey}</code>
                    <KeyOutlined />
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="接口地址" span={2}>
                  <a href={a.interfaceUrl} target="_blank" rel="noreferrer">
                    {a.interfaceUrl}
                  </a>
                </Descriptions.Item>
              </>
            )}
            {a.accessType !== 'API' && (
              <>
                <Descriptions.Item label={a.accessType === 'SDK' ? '平台密钥(掩码)' : 'OTel Key(掩码)'} span={2}>
                  <Space>
                    <code>{a.accessType === 'SDK' ? a.platformKey : a.otelKey}</code>
                    <KeyOutlined />
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item
                  label={a.accessType === 'SDK' ? '平台 URL 地址' : 'OTel Endpoint'}
                  span={2}
                >
                  <a
                    href={a.accessType === 'SDK' ? a.platformUrl : a.otelEndpoint}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.accessType === 'SDK' ? a.platformUrl : a.otelEndpoint}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="埋点代码(自动生成)" span={2}>
                  <pre
                    style={{
                      margin: 0,
                      padding: 8,
                      background: '#1F1F1F',
                      color: '#A6E22E',
                      borderRadius: 4,
                      fontSize: 11,
                      lineHeight: 1.5,
                      overflow: 'auto',
                      maxHeight: 200,
                      fontFamily: 'Menlo, Monaco, Consolas, monospace',
                    }}
                  >
                    {a.accessType === 'SDK' ? a.trackingCode.Java : a.trackingCode.OTel}
                  </pre>
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="功能描述" span={2}>{a.description}</Descriptions.Item>
          </Descriptions>
        )}
        {drillModal === 'resource' && (
          <Descriptions column={1} bordered size="small">
            {a.linkedResources.map((r) => (
              <Descriptions.Item
                key={r.id}
                label={
                  <Space>
                    <span>{r.name}</span>
                    <Tag color={r.status === 'error' ? 'red' : 'blue'}>{r.type}</Tag>
                  </Space>
                }
              >
                <Space split={<Divider type="vertical" />}>
                  <span>对接方式:<Tag>{r.linkType}</Tag></span>
                  <span>负责人:<b>{r.contact}</b></span>
                  <span>联系方式:{r.phone}</span>
                  <Tag color={r.status === 'error' ? 'red' : 'green'}>
                    {r.status === 'error' ? '对接异常' : '对接正常'}
                  </Tag>
                </Space>
                {r.status === 'error' && (
                  <Alert
                    type="error"
                    style={{ marginTop: 8 }}
                    message="对接异常"
                    description={
                      <span>
                        最近一次心跳失败时间: 06-29 14:22:18 · 已自动重试 5 次 · 已通知负责人 王主任。
                      </span>
                    }
                  />
                )}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
        {drillModal === 'evaluation' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="所处阶段">
                <Tag color="green">{a.evaluation.stage}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="评测进度">
                <Progress percent={a.evaluation.progress} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label="评测结论">
                <Tag color="green">{a.evaluation.conclusion}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="综合总分" span={3}>
                <span style={{ fontSize: 22, fontWeight: 600, color: '#1677FF' }}>
                  {a.evaluation.totalScore}
                </span>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  / 100(通过线 {a.evaluation.passThreshold})
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <div>
              <Title level={5}>安全性等各维度得分</Title>
              <Row gutter={8}>
                {a.evaluation.dimensionScores.map((d) => (
                  <Col span={8} key={d.name} style={{ marginBottom: 8 }}>
                    <Card size="small" bodyStyle={{ padding: 8 }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text>{d.name}</Text>
                        <Text strong style={{ color: d.score >= 80 ? '#52C41A' : '#FA8C16' }}>
                          {d.score}
                        </Text>
                      </Space>
                      <Progress
                        percent={d.score}
                        showInfo={false}
                        size="small"
                        strokeColor={d.score >= 80 ? '#52C41A' : '#FA8C16'}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </Space>
        )}
        {drillModal === 'runtime' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="总调用量(月)"
                  value={a.runtime.callVolume.monthly}
                  valueStyle={{ color: '#1677FF' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="正常运行率"
                  value={a.runtime.instanceOnlineRate}
                  suffix="%"
                  valueStyle={{ color: '#52C41A' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="已恢复 / 总告警"
                  value={`${a.runtime.recovered.count} / ${a.runtime.alarm.total + a.runtime.fault.total}`}
                  valueStyle={{ color: '#FA8C16' }}
                />
              </Col>
            </Row>
            <div>
              <Title level={5} style={{ color: '#FA8C16' }}>⚠ 告警记录</Title>
              <Timeline
                items={a.runtime.alarm.recent.map((r) => ({
                  color: 'orange',
                  children: (
                    <Space direction="vertical" size={0}>
                      <span>{r.content}</span>
                      <Text type="secondary" style={{ fontSize: 11 }}>{r.time}</Text>
                    </Space>
                  ),
                }))}
              />
            </div>
            <div>
              <Title level={5} style={{ color: '#FF4D4F' }}>⚠ 故障记录</Title>
              <Timeline
                items={a.runtime.fault.recent.map((r) => ({
                  color: r.recovered ? 'red' : 'red',
                  children: (
                    <Space direction="vertical" size={0}>
                      <span>{r.content}</span>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {r.time} · {r.recovered ? `已恢复 @ ${r.recoveryTime}` : '未恢复'}
                      </Text>
                    </Space>
                  ),
                }))}
              />
            </div>
          </Space>
        )}
        {/* PRD §4.2.3 运行监测·使用效果明细(仅科室用户) */}
        {drillModal === 'usage' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              type="info"
              showIcon
              message={
                <span>
                  本区块为 <b>PRD §4.2.3</b> 科室用户视角下新增字段,仅展示本科室使用效果,不在信息科管理员视角下展示。
                </span>
              }
            />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title={
                    <Space size={4}>
                      <ThunderboltOutlined style={{ color: '#1677FF' }} />
                      <span>本科室调用量(月)</span>
                    </Space>
                  }
                  value={a.runtime.deptUsage.callVolume.monthly}
                  suffix="次"
                  valueStyle={{ color: '#1677FF' }}
                />
                <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
                  日 {a.runtime.deptUsage.callVolume.daily} · 周 {a.runtime.deptUsage.callVolume.weekly}
                </div>
              </Col>
              <Col span={8}>
                <Statistic
                  title={
                    <Space size={4}>
                      <ClusterOutlined style={{ color: '#13C2C2' }} />
                      <span>活跃用户数</span>
                    </Space>
                  }
                  value={a.runtime.deptUsage.activeUsers}
                  suffix="人"
                  valueStyle={{ color: '#13C2C2' }}
                />
                <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
                  人均 {a.runtime.deptUsage.dailyFrequency} 次/日
                </div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 13, color: '#595959' }}>可用状态</div>
                <Tag
                  color={
                    a.runtime.deptUsage.availableStatus === 'available'
                      ? 'green'
                      : a.runtime.deptUsage.availableStatus === 'warning'
                        ? 'orange'
                        : 'red'
                  }
                  style={{ fontSize: 14, padding: '4px 10px', marginTop: 4 }}
                >
                  {a.runtime.deptUsage.availableStatus === 'available'
                    ? '可正常使用'
                    : a.runtime.deptUsage.availableStatus === 'warning'
                      ? '受告警影响(部分可用)'
                      : '不可用'}
                </Tag>
                <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 6 }}>
                  {a.runtime.deptUsage.availableStatusReason}
                </div>
              </Col>
            </Row>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="数据权限">仅本科室(科室用户授权范围)</Descriptions.Item>
              <Descriptions.Item label="取数来源">运行监控中心(本科室过滤)</Descriptions.Item>
              <Descriptions.Item label="刷新频率">每 5 分钟,与监控中心一致</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  );
};

// ============ 360 画像视图本体 ============
type AccessType = 'API' | 'SDK' | 'OTel';
const ProfileView: React.FC<{
  a: typeof MOCK_AGENT;
  onDrill: (k: 'basic' | 'resource' | 'evaluation' | 'runtime' | 'usage') => void;
  // §4.2 科室用户视角:运行监测区补「使用效果」字段
  isDept: boolean;
}> = ({ a, onDrill, isDept }) => {
  // PRD §3.2.3:接入方式动态展示对应技术字段(API / SDK / OTel)
  const [accessType, setAccessType] = useState<AccessType>(a.accessType as AccessType);
  const currentType: AccessType = accessType;
  // PRD §3.2.3 运行监测:告警 日 / 周 / 月 维度切换
  const [alarmRange, setAlarmRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  return (
    <div style={{ marginTop: 12 }}>
      {/* 区块标题 + 区块 1:实体信息(基本+技术) */}
      <SectionHeader title="① 实体信息(基本+技术)" />
      <Card
        bordered={false}
        style={{ border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: 16 }}
        extra={
          <Button type="link" icon={<EyeOutlined />} onClick={() => onDrill('basic')}>
            下钻查看明细
          </Button>
        }
      >
        <Row gutter={24}>
          <Col span={14}>
            <Title level={5} style={{ marginTop: 0 }}>基本信息</Title>
            <Descriptions column={2} size="small" colon={false}>
              <Descriptions.Item label={<Text type="secondary">智能体编号</Text>}>
                <Tag color="blue">{a.idCode}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">智能体名称</Text>}>
                <b>{a.name}</b>
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">智能体版本</Text>}>
                v{a.version}
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">所属科室</Text>}>
                <Tag color="cyan">{a.department}</Tag>({a.departmentCode})
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">诊疗环节</Text>} span={2}>
                {a.diagnosisPhase.map((p) => (
                  <Tag key={p} color="geekblue">{p}</Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">功能描述</Text>} span={2}>
                <Text style={{ fontSize: 12 }}>{a.description}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">智能体来源</Text>}>
                <Tag color="purple">{a.sourceType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">供应商</Text>}>
                {a.vendor}
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">技术联系人</Text>}>
                {a.techContact} · {a.techContactPhone}
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">风险分级</Text>}>
                <Badge status="error" text={<Tag color="red">{a.riskLevel}</Tag>} />
              </Descriptions.Item>
              <Descriptions.Item label={<Text type="secondary">运行状态</Text>}>
                <Badge status="success" text={<Tag color="green">{a.runtimeStatus}</Tag>} />
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={10} style={{ borderLeft: '1px solid #F0F0F0', paddingLeft: 16 }}>
            <Title level={5} style={{ marginTop: 0 }}>
              技术信息
              <Tooltip title="PRD §3.2.3:接入方式动态展示对应技术字段。点击切换可查看 API / SDK / OTel 三种接入方式下的字段差异。">
                <EyeOutlined style={{ fontSize: 11, color: '#BFBFBF', marginLeft: 6 }} />
              </Tooltip>
            </Title>
            {/* PRD §3.2.3:接入方式切换(API / SDK / OTel) — 按所选方式动态展示对应技术字段 */}
            <Segmented
              value={currentType}
              onChange={(v) => setAccessType(v as AccessType)}
              options={[
                { label: 'API 接入', value: 'API' },
                { label: 'SDK 接入', value: 'SDK' },
                { label: 'OTel 接入', value: 'OTel' },
              ]}
              size="small"
              block
              style={{ marginBottom: 12 }}
            />
            <Descriptions column={1} size="small" colon={false}>
              {currentType === 'API' && (
                <>
                  <Descriptions.Item label={<Text type="secondary">API Key(密文)</Text>}>
                    <Space>
                      <code style={{ background: '#F5F5F5', padding: '2px 6px', borderRadius: 4 }}>
                        {a.apiKey}
                      </code>
                      <Tooltip title="已脱敏">
                        <KeyOutlined style={{ color: '#8C8C8C' }} />
                      </Tooltip>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text type="secondary">接口地址</Text>}>
                    <a href={a.interfaceUrl} target="_blank" rel="noreferrer">
                      <Space size={4}>
                        <GlobalOutlined />
                        <span style={{ fontSize: 12 }}>{a.interfaceUrl}</span>
                      </Space>
                    </a>
                  </Descriptions.Item>
                </>
              )}
              {currentType === 'SDK' && (
                <>
                  <Descriptions.Item label={<Text type="secondary">平台密钥(掩码)</Text>}>
                    <Space>
                      <code style={{ background: '#F5F5F5', padding: '2px 6px', borderRadius: 4 }}>
                        {a.platformKey}
                      </code>
                      <Tooltip title="已脱敏">
                        <KeyOutlined style={{ color: '#8C8C8C' }} />
                      </Tooltip>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text type="secondary">平台 URL 地址</Text>}>
                    <a href={a.platformUrl} target="_blank" rel="noreferrer">
                      <Space size={4}>
                        <GlobalOutlined />
                        <span style={{ fontSize: 12 }}>{a.platformUrl}</span>
                      </Space>
                    </a>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text type="secondary">埋点代码(自动生成)</Text>}>
                    <Space>
                      <Segmented
                        size="small"
                        defaultValue="Java"
                        options={[
                          { label: 'Java', value: 'Java' },
                          { label: 'Python', value: 'Python' },
                          { label: 'Node.js', value: 'Node.js' },
                        ]}
                        onChange={(v) => setAccessType('SDK')}
                      />
                    </Space>
                  </Descriptions.Item>
                </>
              )}
              {currentType === 'OTel' && (
                <>
                  <Descriptions.Item label={<Text type="secondary">OTel Key(掩码)</Text>}>
                    <Space>
                      <code style={{ background: '#F5F5F5', padding: '2px 6px', borderRadius: 4 }}>
                        {a.otelKey}
                      </code>
                      <Tooltip title="已脱敏">
                        <KeyOutlined style={{ color: '#8C8C8C' }} />
                      </Tooltip>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text type="secondary">OTel Endpoint</Text>}>
                    <a href={a.otelEndpoint} target="_blank" rel="noreferrer">
                      <Space size={4}>
                        <GlobalOutlined />
                        <span style={{ fontSize: 12 }}>{a.otelEndpoint}</span>
                      </Space>
                    </a>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
            {/* 埋点代码预览框(SKD/OTel 接入下显示) */}
            {(currentType === 'SDK' || currentType === 'OTel') && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#8C8C8C',
                    marginBottom: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <CodeOutlined /> 根据 {currentType === 'SDK' ? '平台 URL + 密钥' : 'OTel Endpoint + Key'} 自动生成
                  </span>
                  <Tooltip title="复制">
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined style={{ fontSize: 11 }} />}
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          currentType === 'SDK'
                            ? a.trackingCode.Java
                            : a.trackingCode.OTel,
                        );
                      }}
                    />
                  </Tooltip>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 8,
                    background: '#1F1F1F',
                    color: '#A6E22E',
                    borderRadius: 4,
                    fontSize: 11,
                    lineHeight: 1.5,
                    overflow: 'auto',
                    maxHeight: 180,
                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  }}
                >
                  {currentType === 'SDK' ? a.trackingCode.Java : a.trackingCode.OTel}
                </pre>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* 区块 2:关联资源拓扑 */}
      <SectionHeader title="② 关联资源拓扑" hint="异常连接以红色醒目提示" />
      <Card
        bordered={false}
        style={{ border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: 8 }}
        extra={
          <Button type="link" icon={<EyeOutlined />} onClick={() => onDrill('resource')}>
            下钻查看明细
          </Button>
        }
      >
        <ResourceTopology resources={a.linkedResources} />
      </Card>

      {/* 区块 3:准入评测 */}
      <SectionHeader title="③ 准入评测" hint="评测进度 + 各维度得分 + 多次评测趋势" />
      <Card
        bordered={false}
        style={{ border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: 16 }}
        extra={
          <Button type="link" icon={<EyeOutlined />} onClick={() => onDrill('evaluation')}>
            下钻查看明细
          </Button>
        }
      >
        <Row gutter={24}>
          <Col span={8}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" style={{ background: '#F0F5FF' }} bodyStyle={{ padding: 12 }}>
                <Space size={4}>
                  <SafetyCertificateOutlined style={{ color: '#52C41A' }} />
                  <Text>评测阶段</Text>
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Tag color="green" style={{ fontSize: 13 }}>{a.evaluation.stage}</Tag>
                </div>
              </Card>
              <Card size="small" bodyStyle={{ padding: 12 }}>
                <Space size={4}>
                  <CheckCircleOutlined style={{ color: '#1677FF' }} />
                  <Text>评测结论</Text>
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Tag color="green" style={{ fontSize: 13 }}>{a.evaluation.conclusion}</Tag>
                </div>
              </Card>
              <Card size="small" bodyStyle={{ padding: 12 }}>
                <Space size={4}>
                  <LineChartOutlined style={{ color: '#1677FF' }} />
                  <Text>综合总分</Text>
                </Space>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 26, fontWeight: 600, color: '#1677FF' }}>
                    {a.evaluation.totalScore}
                  </span>
                  <Text type="secondary"> / 100</Text>
                </div>
                <div style={{ fontSize: 11, color: '#8C8C8C' }}>
                  通过线 {a.evaluation.passThreshold} · 当前高出 12.5 分
                </div>
              </Card>
            </Space>
          </Col>
          <Col span={8}>
            <Title level={5} style={{ marginTop: 0, textAlign: 'center' }}>安全性等各维度得分</Title>
            <RadarChart data={a.evaluation.dimensionScores} />
          </Col>
          <Col span={8}>
            <Title level={5} style={{ marginTop: 0 }}>多次评测结果趋势</Title>
            <EvalTrendChart history={a.evaluation.history} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              共 {a.evaluation.history.length} 次评测,得分由 {a.evaluation.history[0].score} 提升至 {a.evaluation.history.at(-1)!.score} 分
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 区块 4:运行监测 */}
      <SectionHeader title="④ 运行监测" hint="告警(橙)与故障(红)区分" />
      <Card
        bordered={false}
        style={{ border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: 16 }}
        extra={
          <Button type="link" icon={<EyeOutlined />} onClick={() => onDrill('runtime')}>
            下钻查看明细
          </Button>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" style={{ background: '#E6F4FF' }} bodyStyle={{ padding: 12 }}>
              <Statistic
                title={
                  <Space size={4}>
                    <ThunderboltOutlined style={{ color: '#1677FF' }} />
                    <span>总调用量</span>
                  </Space>
                }
                value={a.runtime.callVolume.total}
                valueStyle={{ color: '#1677FF', fontSize: 22 }}
              />
              <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
                日 {a.runtime.callVolume.daily} · 周 {a.runtime.callVolume.weekly} · 月 {a.runtime.callVolume.monthly}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ background: '#F6FFED' }} bodyStyle={{ padding: 12 }}>
              <Statistic
                title={
                  <Space size={4}>
                    <CheckCircleOutlined style={{ color: '#52C41A' }} />
                    <span>正常运行率</span>
                  </Space>
                }
                value={a.runtime.instanceOnlineRate}
                suffix="%"
                valueStyle={{ color: '#52C41A', fontSize: 22 }}
              />
              <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>高于全院均值</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ background: '#FFF7E6', borderColor: '#FFD591' }} bodyStyle={{ padding: 12 }}>
              <Statistic
                title={
                  <Space size={4}>
                    <WarningOutlined style={{ color: '#FA8C16' }} />
                    <span style={{ color: '#FA8C16' }}>告警(预警,较浅)</span>
                  </Space>
                }
                value={a.runtime.alarm[alarmRange]}
                suffix="次"
                valueStyle={{ color: '#FA8C16', fontSize: 22 }}
              />
              {/* PRD §3.2.3 字段口径:支持查看日 / 周 / 月 — 提供 Segmented 切换器 */}
              <Segmented
                size="small"
                value={alarmRange}
                onChange={(v) => setAlarmRange(v as 'daily' | 'weekly' | 'monthly')}
                options={[
                  { label: '日', value: 'daily' },
                  { label: '周', value: 'weekly' },
                  { label: '月', value: 'monthly' },
                ]}
                style={{ marginTop: 4 }}
                block
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ background: '#FFF1F0', borderColor: '#FFA39E' }} bodyStyle={{ padding: 12 }}>
              <Statistic
                title={
                  <Space size={4}>
                    <ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />
                    <span style={{ color: '#FF4D4F' }}>故障(中断,较重)</span>
                  </Space>
                }
                value={a.runtime.fault.total}
                suffix="次"
                valueStyle={{ color: '#FF4D4F', fontSize: 22 }}
              />
              <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>本月 · 已全部恢复</div>
            </Card>
          </Col>
        </Row>

        {/* ===== PRD §4.2.3 科室用户专有:运行监测 · 使用效果 =====
            字段:本科室调用量 / 活跃度 / 可用状态(取数来源:运行监控中心)
            仅科室用户视角下展示;管理员视角不展示此区(管理视角关心全院而非本科室使用) */}
        {isDept && (
          <div
            style={{
              marginTop: 8,
              marginBottom: 12,
              padding: 12,
              background: 'linear-gradient(90deg,#F0F5FF 0%,#E6F4FF 100%)',
              border: '1px solid #91CAFF',
              borderRadius: 8,
            }}
          >
            <Space style={{ marginBottom: 8 }} align="center">
              <Tag color="cyan" style={{ margin: 0 }}>§4.2.3</Tag>
              <Text strong style={{ fontSize: 13, color: '#1677FF' }}>
                运行监测 · 使用效果(本科室)
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                · 取数来源:运行监控中心
              </Text>
              <Button
                size="small"
                type="link"
                icon={<EyeOutlined />}
                onClick={() => onDrill('usage')}
                style={{ marginLeft: 'auto' }}
              >
                下钻查看明细
              </Button>
            </Space>
            <Row gutter={12}>
              <Col span={8}>
                <Card size="small" bodyStyle={{ padding: 12 }} style={{ background: '#fff' }}>
                  <Space size={4}>
                    <ThunderboltOutlined style={{ color: '#1677FF' }} />
                    <Text>本科室调用量</Text>
                    <Tooltip title="本科室对该智能体的调用次数,支持日/周/月">
                      <EyeOutlined style={{ fontSize: 11, color: '#BFBFBF' }} />
                    </Tooltip>
                  </Space>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#1677FF', marginTop: 4 }}>
                    {a.runtime.deptUsage.callVolume.monthly.toLocaleString()}
                    <span style={{ fontSize: 12, marginLeft: 4, color: '#8C8C8C' }}>次/月</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
                    日 {a.runtime.deptUsage.callVolume.daily} · 周{' '}
                    {a.runtime.deptUsage.callVolume.weekly} · 月{' '}
                    {a.runtime.deptUsage.callVolume.monthly}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" bodyStyle={{ padding: 12 }} style={{ background: '#fff' }}>
                  <Space size={4}>
                    <ClusterOutlined style={{ color: '#13C2C2' }} />
                    <Text>活跃度</Text>
                    <Tooltip title="本科室对该智能体的使用活跃度(活跃用户数 / 使用频次)">
                      <EyeOutlined style={{ fontSize: 11, color: '#BFBFBF' }} />
                    </Tooltip>
                  </Space>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#13C2C2', marginTop: 4 }}>
                    {a.runtime.deptUsage.activeUsers}
                    <span style={{ fontSize: 12, marginLeft: 4, color: '#8C8C8C' }}>人</span>
                    <span style={{ fontSize: 12, marginLeft: 8, color: '#8C8C8C' }}>
                      · 人均 {a.runtime.deptUsage.dailyFrequency} 次/日
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
                    覆盖本科室 79% 医生
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  bodyStyle={{ padding: 12 }}
                  style={{
                    background:
                      a.runtime.deptUsage.availableStatus === 'available'
                        ? '#F6FFED'
                        : a.runtime.deptUsage.availableStatus === 'warning'
                          ? '#FFF7E6'
                          : '#FFF1F0',
                    borderColor:
                      a.runtime.deptUsage.availableStatus === 'available'
                        ? '#B7EB8F'
                        : a.runtime.deptUsage.availableStatus === 'warning'
                          ? '#FFD591'
                          : '#FFA39E',
                  }}
                >
                  <Space size={4}>
                    {a.runtime.deptUsage.availableStatus === 'available' ? (
                      <CheckCircleOutlined style={{ color: '#52C41A' }} />
                    ) : a.runtime.deptUsage.availableStatus === 'warning' ? (
                      <WarningOutlined style={{ color: '#FA8C16' }} />
                    ) : (
                      <ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />
                    )}
                    <Text>可用状态</Text>
                    <Tooltip title="受告警/故障影响情况,影响本科室能否正常使用该智能体">
                      <EyeOutlined style={{ fontSize: 11, color: '#BFBFBF' }} />
                    </Tooltip>
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Tag
                      color={
                        a.runtime.deptUsage.availableStatus === 'available'
                          ? 'green'
                          : a.runtime.deptUsage.availableStatus === 'warning'
                            ? 'orange'
                            : 'red'
                      }
                      style={{ fontSize: 13 }}
                    >
                      {a.runtime.deptUsage.availableStatus === 'available'
                        ? '可正常使用'
                        : a.runtime.deptUsage.availableStatus === 'warning'
                          ? '受告警影响(部分可用)'
                          : '不可用'}
                    </Tag>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        a.runtime.deptUsage.availableStatus === 'available'
                          ? '#389E0D'
                          : a.runtime.deptUsage.availableStatus === 'warning'
                            ? '#D46B08'
                            : '#CF1322',
                      marginTop: 2,
                    }}
                  >
                    {a.runtime.deptUsage.availableStatusReason}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}

        {/* 告警 + 故障明细 */}
        <Row gutter={16}>
          <Col span={12}>
            <Title level={5} style={{ color: '#FA8C16' }}>⚠ 最近告警(橙色标识)</Title>
            <Timeline
              items={a.runtime.alarm.recent.map((r) => ({
                color: 'orange',
                children: (
                  <Space direction="vertical" size={0}>
                    <span>{r.content}</span>
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.time}</Text>
                  </Space>
                ),
              }))}
            />
          </Col>
          <Col span={12}>
            <Title level={5} style={{ color: '#FF4D4F' }}>⚠ 最近故障(红色标识)</Title>
            <Timeline
              items={a.runtime.fault.recent.map((r) => ({
                color: 'red',
                children: (
                  <Space direction="vertical" size={0}>
                    <span>{r.content}</span>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {r.time} · 已恢复 @ {r.recoveryTime}
                    </Text>
                  </Space>
                ),
              }))}
            />
            <Divider />
            <Space>
              <CheckCircleOutlined style={{ color: '#52C41A' }} />
              <span>近 24 小时恢复次数:{a.runtime.recovered.count}</span>
              <span>· 平均恢复时长:{a.runtime.recovered.averageMinutes} 分钟</span>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

// ============ 区块标题组件 ============
const SectionHeader: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div
    style={{
      marginTop: 16,
      marginBottom: 6,
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
    }}
  >
    <span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>{title}</span>
    {hint && <Text type="secondary" style={{ fontSize: 11 }}>· {hint}</Text>}
  </div>
);

// ============ 详情页兜底(原信息详情页简化版,用于切换对比) ============
const DetailViewFallback: React.FC<{ a: typeof MOCK_AGENT }> = ({ a }) => (
  <Card style={{ marginTop: 16, border: '1px solid #F0F0F0' }}>
    <Empty
      description={
        <span>
          原「智能体信息详情页」(PRD V1.8 §2.2),本次不改动。
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            包含 5 个 Tab:基本信息 / 技术信息 / 备案材料 / 已对接资源信息 / 评测结果信息。
          </Text>
        </span>
      }
    />
  </Card>
);

export default AgentProfileV32;