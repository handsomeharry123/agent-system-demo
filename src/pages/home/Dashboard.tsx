import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Line, Pie } from "@ant-design/charts";
import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ApartmentOutlined,
  ApiOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudServerOutlined,
  ExclamationCircleFilled,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  EnvironmentFilled,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useDemoSettings } from "../../hooks/useDemoSettings";
import "./Dashboard.css";

const { Text, Title } = Typography;
const panelStyle = {
  border: "1px solid #dce8f7",
  boxShadow: "0 5px 18px rgba(22,119,255,.055)",
};
const colors = ["#1677ff", "#13c2c2", "#722ed1", "#fa8c16", "#eb2f96"];

const month = ["02月", "03月", "04月", "05月", "06月", "07月"];
const spark = (values: number[]) =>
  month.map((label, index) => ({ label, value: values[index] }));

function buildSmoothPath(points: Array<[number, number]>) {
  if (points.length < 2) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const previousPrevious = points[index - 1] || previous;
    const next = points[index + 2] || point;
    const controlX1 = previous[0] + (point[0] - previousPrevious[0]) / 6;
    const controlY1 = previous[1] + (point[1] - previousPrevious[1]) / 6;
    const controlX2 = point[0] - (next[0] - previous[0]) / 6;
    const controlY2 = point[1] - (next[1] - previous[1]) / 6;
    return `${path} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${point[0]} ${point[1]}`;
  }, `M ${points[0][0]} ${points[0][1]}`);
}

function KpiSparkline({ values, color }: { values: readonly number[]; color: string }) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const width = 190;
  const height = 72;
  const paddingX = 8;
  const paddingY = 10;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = values.map((value, index) => [
    paddingX + (index * (width - paddingX * 2)) / (values.length - 1),
    height - paddingY - ((value - minimum) / range) * (height - paddingY * 2),
  ] as [number, number]);
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points.at(-1)![0]} ${height} L ${points[0][0]} ${height} Z`;
  const lastPoint = points.at(-1)!;

  return (
    <div className="dashboard-kpi-sparkline" aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <stop offset="72%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`spark-line-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="45%" stopColor={color} />
            <stop offset="100%" stopColor="#dffcff" />
          </linearGradient>
          <filter id={`spark-glow-${id}`} x="-30%" y="-50%" width="160%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id={`spark-clip-${id}`}>
            <rect className="dashboard-kpi-spark-reveal" width={width} height={height} />
          </clipPath>
        </defs>
        <g className="dashboard-kpi-spark-grid">
          <path d={`M 0 24 H ${width} M 0 48 H ${width}`} />
          <path d={`M 48 0 V ${height} M 96 0 V ${height} M 144 0 V ${height}`} />
        </g>
        <g clipPath={`url(#spark-clip-${id})`}>
          <path className="dashboard-kpi-spark-area" d={areaPath} fill={`url(#spark-area-${id})`} />
          <path className="dashboard-kpi-spark-glow" d={linePath} stroke={color} />
          <path className="dashboard-kpi-spark-line" d={linePath} stroke={`url(#spark-line-${id})`} />
          {points.map(([x, y], index) => (
            <circle key={index} className="dashboard-kpi-spark-point" cx={x} cy={y} r="2.2" style={{ animationDelay: `${0.45 + index * 0.09}s` }} />
          ))}
        </g>
        <circle className="dashboard-kpi-spark-pulse" cx={lastPoint[0]} cy={lastPoint[1]} r="5" stroke={color} />
        <circle className="dashboard-kpi-spark-terminal" cx={lastPoint[0]} cy={lastPoint[1]} r="3.2" fill="#eaffff" filter={`url(#spark-glow-${id})`} />
      </svg>
    </div>
  );
}
const adminMetrics = [
  [
    "智能体数量",
    "128",
    "个",
    "较昨日 +3",
    [88, 96, 104, 110, 119, 128],
    "/app/ledger/list",
    "#1677ff",
  ],
  [
    "异常智能体数量",
    "6",
    "个",
    "较昨日 -2",
    [9, 7, 8, 11, 8, 6],
    "/app/ledger/list?status=abnormal",
    "#fa541c",
  ],
  [
    "智能体总调用量",
    "286.4万",
    "次",
    "较昨日 +12.6%",
    [152, 177, 196, 228, 252, 286],
    "/app/monitoring/business",
    "#13c2c2",
  ],
  [
    "智能体成功调用率",
    "98.72",
    "%",
    "本月提升 0.31%",
    [97.8, 98.1, 98.2, 98.3, 98.4, 98.72],
    "/app/monitoring/business",
    "#52c41a",
  ],
  [
    "智能体告警次数",
    "37",
    "次",
    "较昨日 -5",
    [52, 45, 61, 48, 42, 37],
    "/app/monitoring/alert-events",
    "#722ed1",
  ],
  [
    "Token累计使用成本",
    "¥46.8万",
    "",
    "较昨日 +¥1.2万",
    [22, 27, 32, 36, 41, 46.8],
    "/app/monitoring/cost",
    "#fa8c16",
  ],
] as const;
const deptMetrics = [
  [
    "智能体总调用量",
    "32.6万",
    "次",
    "较昨日 +8.2%",
    [18, 21, 23, 26, 29, 32.6],
    "/app/monitoring/business",
    "#1677ff",
  ],
  [
    "智能体成功调用率",
    "99.12",
    "%",
    "本月提升 0.24%",
    [98.2, 98.5, 98.6, 98.8, 98.9, 99.12],
    "/app/monitoring/business",
    "#52c41a",
  ],
  [
    "响应时间 P95",
    "1.28",
    "s",
    "较上月 -0.16s",
    [1.72, 1.61, 1.55, 1.48, 1.44, 1.28],
    "/app/monitoring/business",
    "#13c2c2",
  ],
  [
    "智能体告警次数",
    "8",
    "次",
    "较昨日 -2",
    [16, 13, 11, 14, 10, 8],
    "/app/monitoring/alert-events",
    "#722ed1",
  ],
  [
    "Token累计使用成本",
    "¥5.82万",
    "",
    "较昨日 +¥0.18万",
    [2.6, 3.2, 3.8, 4.5, 5.1, 5.82],
    "/app/monitoring/cost",
    "#fa8c16",
  ],
] as const;

const departments = [
  { name: "影像科", value: 24 },
  { name: "心内科", value: 21 },
  { name: "检验科", value: 18 },
  { name: "急诊科", value: 16 },
  { name: "超声科", value: 14 },
  { name: "药学部", value: 11 },
];
const topAgents = [
  { name: "影像报告助手", value: 46820 },
  { name: "病历质控助手", value: 41650 },
  { name: "检验解读助手", value: 35860 },
  { name: "急诊分诊助手", value: 28310 },
  { name: "用药审核助手", value: 24680 },
];
const risks = [
  { name: "高风险", value: 12 },
  { name: "中风险", value: 35 },
  { name: "低风险", value: 81 },
];
const alertLevels = [
  { name: "高级", value: 5 },
  { name: "中级", value: 12 },
  { name: "低级", value: 20 },
];

type PieDatum = { name: string; value: number };
const alertRank = [
  { name: "影像报告助手", value: 9 },
  { name: "病历质控助手", value: 7 },
  { name: "急诊分诊助手", value: 6 },
  { name: "检验解读助手", value: 4 },
  { name: "随访助手", value: 3 },
];
const alerts = [
  ["影像报告助手响应超时", "P95 > 2s", "高级"],
  ["病历质控助手成功率下降", "< 97%", "中级"],
  ["急诊分诊助手实例离线", "离线 > 3min", "高级"],
  ["检验解读助手成本超限", "> ¥800/日", "中级"],
  ["随访助手调用量突增", "环比 > 80%", "低级"],
];
const resources = [
  ["HIS", "医院信息系统", 38, true],
  ["EMR", "电子病历系统", 31, true],
  ["LIS", "实验室信息系统", 16, true],
  ["PACS", "医学影像系统", 22, true],
  ["RIS", "放射信息系统", 12, true],
  ["UIS", "超声信息系统", 9, true],
  ["EIS", "内镜信息系统", 6, false],
  ["PIS", "病理信息系统", 8, true],
] as const;

const deploymentPoints = [
  {
    id: "AGT-2025-002",
    name: "智能导诊助手",
    version: "v2.1.3",
    department: "导诊台",
    status: "运行中",
    x: 16,
    y: 57,
    popover: "right",
  },
  {
    id: "AGT-2025-005",
    name: "预问诊智能体",
    version: "v3.2.0",
    department: "耳鼻喉科",
    status: "运行中",
    x: 34,
    y: 20,
    popover: "right",
  },
  {
    id: "AGT-2025-006",
    name: "病历生成智能体",
    version: "v1.8.5",
    department: "心血管内科",
    status: "运行中",
    x: 70,
    y: 18,
    popover: "right",
  },
  {
    id: "AGT-2025-008",
    name: "分诊智能体",
    version: "v2.4.1",
    department: "急诊科",
    status: "降级",
    x: 44,
    y: 51,
    popover: "left",
  },
  {
    id: "AGT-2025-012",
    name: "随访智能体",
    version: "v1.6.2",
    department: "普外科",
    status: "运行中",
    x: 74,
    y: 68,
    popover: "right",
  },
  {
    id: "AGT-2025-014",
    name: "肺功能智能体",
    version: "v2.0.4",
    department: "呼吸内科",
    status: "运行中",
    x: 63,
    y: 39,
    popover: "right",
  },
  {
    id: "AGT-2025-015",
    name: "影像解读智能体",
    version: "v4.1.0",
    department: "医学影像科",
    status: "故障",
    x: 27,
    y: 78,
    popover: "left",
  },
] as const;

function KpiCard({
  metric,
}: {
  metric: (typeof adminMetrics)[number] | (typeof deptMetrics)[number];
}) {
  const navigate = useNavigate();
  const [title, value, suffix, , values, path, color] = metric;
  return (
    <Card
      hoverable
      onClick={() => navigate(path)}
      style={{
        ...panelStyle,
        height: 128,
        cursor: "pointer",
        overflow: "hidden",
        position: "relative",
      }}
      styles={{
        body: {
          padding: "15px 16px 10px",
          position: "relative",
          height: "100%",
        },
      }}
    >
      <div style={{ position: "relative", zIndex: 2, maxWidth: "76%" }}>
        <Text
          type="secondary"
          ellipsis
          className="dashboard-kpi-title"
          style={{ display: "block", whiteSpace: "nowrap" }}
        >
          {title}
        </Text>
        <div className="dashboard-kpi-value-wrap" style={{ color }}>
          <Text strong className="dashboard-kpi-value" style={{ color }}>
            {value}
          </Text>
          <Text className="dashboard-kpi-suffix" style={{ color }}>{suffix}</Text>
        </div>
      </div>
      <KpiSparkline values={values} color={color} />
    </Card>
  );
}

function ChartCard({
  title,
  children,
  extra,
  className,
}: {
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      size="small"
      title={<Text strong>{title}</Text>}
      extra={extra}
      className={`dashboard-chart-card ${className || ""}`}
      style={panelStyle}
      styles={{ header: { minHeight: 38 }, body: { padding: "8px 12px" } }}
    >
      {children}
    </Card>
  );
}

function CyberPie({
  data,
  color,
  tone,
  onReady,
  className = "",
  labelFontSize = 13,
  radius = 0.76,
  innerRadius = 0.5,
}: {
  data: PieDatum[];
  color: string[];
  tone: string;
  onReady?: (plot: any) => void;
  className?: string;
  labelFontSize?: number;
  radius?: number;
  innerRadius?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(130);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncHeight = () => {
      const nextHeight = Math.max(130, Math.floor(container.clientHeight));
      setChartHeight((current) => current === nextHeight ? current : nextHeight);
    };
    syncHeight();

    const observer = new ResizeObserver(syncHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`dashboard-cyber-pie ${className}`}
      style={{ "--pie-tone": tone } as React.CSSProperties}
    >
      <Pie
        angleField="value"
        colorField="name"
        data={data}
        color={color}
        innerRadius={innerRadius}
        radius={radius}
        padding={[18, 54, 18, 54]}
        height={chartHeight}
        theme="classicDark"
        legend={false}
        label={false}
        tooltip={{ title: "name" }}
        style={{
          stroke: "#071b3b",
          lineWidth: 2,
          shadowColor: tone,
          shadowBlur: 10,
          cursor: "pointer",
        }}
        state={{
          active: {
            lineWidth: 3,
            stroke: "#dff8ff",
            shadowColor: tone,
            shadowBlur: 22,
          },
          inactive: { opacity: 0.55 },
        }}
        interaction={{ elementHighlight: true }}
        animate={{ enter: { type: "waveIn", duration: 900 } }}
        onReady={onReady}
      />
      <svg className="dashboard-pie-leaders" viewBox="0 0 330 190" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="139,37 116,21 42,21" />
        <polyline points="99,97 62,97 10,97" />
        <polyline points="224,126 246,141 320,141" />
      </svg>
      <div className="dashboard-pie-labels" style={{ fontSize: labelFontSize }} aria-hidden="true">
        {data.map((item, index) => (
          <span key={item.name} className={`dashboard-pie-label dashboard-pie-label--${index + 1}`}>
            {item.name} {item.value}
          </span>
        ))}
      </div>
      <div className="dashboard-pie-core" aria-hidden="true">
        <strong>{total}</strong>
        <span>总计</span>
      </div>
    </div>
  );
}

function SimpleBars({
  data,
  color = "#1677ff",
  onClick,
}: {
  data: { name: string; value: number }[];
  color?: string;
  onClick?: (name: string) => void;
}) {
  const max = Math.max(...data.map((item) => item.value));
  return (
    <div
      className="dashboard-simple-bars"
      style={{ "--bar-tone": color } as React.CSSProperties}
    >
      {data.map((item, index) => (
        <div
          key={item.name}
          className="dashboard-simple-bar-row"
          onClick={() => onClick?.(item.name)}
          style={{ cursor: onClick ? "pointer" : "default" }}
        >
          <div className="dashboard-simple-bar-label">
            <span className="dashboard-simple-bar-rank">{index + 1}</span>
            <Text className="dashboard-simple-bar-name" title={item.name}>
              {item.name}
            </Text>
          </div>
          <div className="dashboard-simple-bar-track">
            <div
              className="dashboard-simple-bar-fill"
              style={{
                width: `${Math.max(8, (item.value / max) * 100)}%`,
                animationDelay: `${index * 90}ms`,
              }}
            >
              <i className="dashboard-simple-bar-glow" />
            </div>
          </div>
          <Text strong className="dashboard-simple-bar-value">
            {item.value.toLocaleString()}
          </Text>
        </div>
      ))}
    </div>
  );
}

function ResourceTopology({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const shown = isAdmin
    ? resources
    : resources.map(
        (r) =>
          [r[0], r[1], Math.max(2, Math.round(r[2] * 0.22)), r[3]] as const,
      );
  return (
    <div
      className="dashboard-topology"
      style={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        padding: "18px 10px",
        borderRadius: 12,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 49%,#dceeff 0,#f7fbff 35%,#fff 68%)",
      }}
    >
      <div className="topology-ambient topology-ambient--one" />
      <div className="topology-ambient topology-ambient--two" />
      <div className="topology-orbit topology-orbit--inner">
        <i />
      </div>
      <div className="topology-orbit topology-orbit--outer">
        <i />
        <i />
      </div>
      <svg
        className="topology-links"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="topology-link-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1677ff" stopOpacity=".15" />
            <stop offset=".5" stopColor="#58efff" stopOpacity=".9" />
            <stop offset="1" stopColor="#13c2c2" stopOpacity=".15" />
          </linearGradient>
        </defs>
        {shown.map((_, i) => {
          const angle = (Math.PI * 2 * i) / shown.length - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 38;
          const y = 49 + Math.sin(angle) * 39;
          return (
            <g key={i}>
              <line x1="50" y1="49" x2={x} y2={y} />
              <circle className={`topology-flow-dot topology-flow-dot--${i % 4}`} r=".65">
                <animateMotion dur={`${2.8 + (i % 3) * .45}s`} repeatCount="indefinite" path={`M 50 49 L ${x} ${y}`} />
              </circle>
            </g>
          );
        })}
      </svg>
      <div
        className="topology-core"
        style={{
          position: "absolute",
          left: "50%",
          top: "49%",
          transform: "translate(-50%,-50%)",
          textAlign: "center",
          width: 168,
          padding: "25px 8px",
          color: "#fff",
          borderRadius: 18,
          background: "linear-gradient(135deg,#1677ff,#13c2c2)",
          boxShadow: "0 10px 28px #1677ff55",
        }}
      >
        <CloudServerOutlined style={{ fontSize: 30 }} />
        <div style={{ fontWeight: 700, marginTop: 6 }}>
          {isAdmin ? "全院智能体中心" : "影像科智能体中心"}
        </div>
        <small>{isAdmin ? "128 个智能体" : "18 个智能体"}</small>
      </div>
      {shown.map(([code, name, count, online], i) => {
        const angle = (Math.PI * 2 * i) / shown.length - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 38;
        const y = 49 + Math.sin(angle) * 39;
        return (
          <Tooltip
            key={code}
            title={`${name} · ${count} 个智能体 · ${online ? "连接正常" : "连接异常"}`}
          >
            <button
              onClick={() =>
                navigate(`/app/resource-center/resources?keyword=${code}`)
              }
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%,-50%)",
                width: 120,
                padding: "10px 5px",
                borderRadius: 10,
                cursor: "pointer",
                border: `1px solid ${online ? "#91caff" : "#ffbb96"}`,
                color: "#1f2d3d",
                background: "#fff",
                boxShadow: "0 4px 12px #94a9c733",
              }}
            >
              <ApiOutlined style={{ color: online ? "#1677ff" : "#fa541c" }} />{" "}
              <b>{code}</b>
              <div
                style={{
                  fontSize: 10,
                  color: "#8c8c8c",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {count} 个智能体 · {online ? "正常" : "异常"}
              </div>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function AgentDistributionMap() {
  const navigate = useNavigate();
  return (
    <div className="hospital-agent-map" aria-label="医院智能体分布地图">
      <div className="hospital-campus" aria-hidden="true">
        <i className="campus-building campus-building--a" />
        <i className="campus-building campus-building--b" />
        <i className="campus-building campus-building--c" />
        <i className="campus-building campus-building--d" />
        <i className="campus-building campus-building--e" />
        <i className="campus-building campus-building--f" />
        <i className="campus-road campus-road--a" />
        <i className="campus-road campus-road--b" />
      </div>
      <div className="hospital-map-caption">
        <EnvironmentFilled /> 院区数字孪生地图 <span>· 7 个部署点位</span>
      </div>
      {deploymentPoints.map((point) => (
        <button
          key={point.id}
          type="button"
          className={`agent-map-point agent-map-point--popover-${point.popover}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          onClick={() => navigate(`/app/ledger/detail/${point.id}`)}
          aria-label={`查看${point.name}360画像`}
        >
          <span className="agent-map-pin">
            <RobotOutlined />
          </span>
          <span className="agent-map-pulse" />
          <span className="agent-map-popover">
            <b>
              {point.name}
              <em>{point.version}</em>
              <span>{point.status}</span>
            </b>
            <span>科室：{point.department}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { demoRole } = useDemoSettings();
  const isAdmin = demoRole === "信息科管理员";
  const metrics = isAdmin ? adminMetrics : deptMetrics;
  const [range, setRange] = useState("30d");
  const [fullscreen, setFullscreen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [screenFit, setScreenFit] = useState({ scale: 1, height: 968 });
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const fitDashboard = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const availableWidth = viewport.clientWidth || window.innerWidth;
      const availableHeight = fullscreen
        ? window.innerHeight
        : Math.max(360, window.innerHeight - rect.top);
      setScreenFit({
        scale: Math.min(availableWidth / 1720, availableHeight / 968),
        height: availableHeight,
      });
    };

    fitDashboard();
    const observer = new ResizeObserver(fitDashboard);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener("resize", fitDashboard);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitDashboard);
    };
  }, [fullscreen]);

  return (
    <div
      ref={viewportRef}
      className={`dashboard-viewport${fullscreen ? " dashboard-viewport--fullscreen" : ""}`}
      style={{ height: screenFit.height }}
    >
      <div
        className="dashboard-stage"
        style={{ width: 1720 * screenFit.scale, height: 968 * screenFit.scale }}
      >
        <div
          className={`dashboard-screen${isAdmin ? " dashboard-screen--admin" : ""}`}
          style={{ transform: `scale(${screenFit.scale})` }}
        >
      <Card
        className="dashboard-header"
        style={{
          ...panelStyle,
          background: "linear-gradient(110deg,#edf6ff,#fff 55%,#eafafa)",
        }}
        styles={{ body: { padding: "10px 16px" } }}
      >
        <div className="dashboard-header-inner">
          <div className="dashboard-title-frame">
            <i className="dashboard-title-wing dashboard-title-wing--left" />
            <Title level={3} className="dashboard-title">
              {isAdmin
                ? "全院智能体运行态势大屏"
                : "影像科智能体运行态势大屏"}
            </Title>
            <i className="dashboard-title-wing dashboard-title-wing--right" />
          </div>
          <Space wrap size={8} className="dashboard-header-actions">
            <Select
              value={range}
              onChange={setRange}
              style={{ width: 100 }}
              options={[
                { value: "today", label: "今日" },
                { value: "7d", label: "近7天" },
                { value: "30d", label: "近30天" },
              ]}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => message.success("大屏数据已刷新")}
            >
              刷新
            </Button>
            <Button
              icon={
                fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
              }
              onClick={() => setFullscreen(!fullscreen)}
            >
              {fullscreen ? "退出全屏" : "全屏投屏"}
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[10, 10]} className="dashboard-kpis">
        {metrics.map((m) => (
          <Col
            key={m[0]}
            xs={24}
            sm={12}
            lg={isAdmin ? 8 : undefined}
            xl={isAdmin ? 4 : undefined}
            flex={isAdmin ? undefined : "1 1 200px"}
          >
            <KpiCard metric={m} />
          </Col>
        ))}
      </Row>

      <Row gutter={[10, 10]} align="stretch" className="dashboard-main">
        <Col
          xs={24}
          xl={6}
          className={`dashboard-side dashboard-side--left${isAdmin ? "" : " dashboard-side--left-dept"}`}
        >
          {isAdmin ? (
            <>
              <ChartCard className="dashboard-bar-card" title="智能体科室分布">
                <SimpleBars
                  data={departments.slice(0, 4)}
                  onClick={(name) =>
                    navigate(`/app/ledger/list?department=${name}`)
                  }
                />
              </ChartCard>
              <ChartCard className="dashboard-bar-card" title="高频调用智能体 TOP5">
                <SimpleBars data={topAgents.slice(0, 4)} color="#13c2c2" />
              </ChartCard>
              <ChartCard className="dashboard-pie-card" title="智能体风险分级">
                <CyberPie
                  data={risks}
                  color={["#ff416c", "#ffb21c", "#32e59b"]}
                  tone="#32e59b"
                  labelFontSize={15}
                  radius={0.78}
                  innerRadius={0.48}
                  onReady={(p: any) =>
                    p.on("element:click", (e: any) =>
                      navigate(`/app/ledger/list?risk=${e.data.data.name}`),
                    )
                  }
                />
              </ChartCard>
            </>
          ) : (
            <>
              <ChartCard
                className="dashboard-dept-status"
                title="智能体实时状态"
              >
                <div className="dashboard-status-grid">
                  {[
                    ["实时在线", 16, "#52c41a", <CheckCircleFilled />],
                    ["实时离线", 2, "#ff4d4f", <ExclamationCircleFilled />],
                    [
                      "平均异常持续时长",
                      "18m",
                      "#fa8c16",
                      <ClockCircleOutlined />,
                    ],
                    ["累计禁用", 3, "#8c8c8c", <SafetyCertificateOutlined />],
                  ].map(([label, value, color, icon]) => (
                    <button
                      type="button"
                      className="dashboard-status-tile"
                      key={String(label)}
                      onClick={() => navigate("/app/ledger/list")}
                    >
                      <span className="dashboard-status-label">
                        {label}
                      </span>
                      <span
                        className="dashboard-status-value"
                        style={{ color: String(color) }}
                      >
                        {icon} {value}
                      </span>
                      <span className="dashboard-status-hint">
                        {label === "累计禁用"
                          ? "较昨日 +1 · 月趋势平稳"
                          : "点击查看明细"}
                      </span>
                    </button>
                  ))}
                </div>
              </ChartCard>
              <ChartCard title="禁用智能体月趋势">
                <Line
                  data={spark([1, 1, 2, 2, 2, 3])}
                  xField="label"
                  yField="value"
                  height={260}
                  theme="classicDark"
                  smooth
                  color="#27d9ff"
                  point={{ size: 4 }}
                />
              </ChartCard>
            </>
          )}
        </Col>
        <Col xs={24} xl={12} className="dashboard-center">
          <ChartCard
            className="dashboard-resource-card"
            title={isAdmin ? "医院智能体分布地图" : "医院科室已关联资源情况"}
            extra={
              !isAdmin ? (
                <Text type="secondary">
                  <ApartmentOutlined /> 点击资源查看详情
                </Text>
              ) : undefined
            }
          >
            {isAdmin ? (
              <AgentDistributionMap />
            ) : (
              <ResourceTopology isAdmin={isAdmin} />
            )}
          </ChartCard>
        </Col>
        <Col xs={24} xl={6} className="dashboard-side dashboard-side--right">
          <ChartCard
            title={isAdmin ? "实时告警情况" : "待处理告警"}
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate("/app/monitoring/alert-events")}
              >
                全部告警
              </Button>
            }
          >
            <div className="dashboard-alert-carousel">
              <div className="dashboard-alert-track">
                {[...alerts, ...alerts].map(([name, threshold, level], index) => (
                  <div
                    key={`${name}-${index}`}
                    className="dashboard-alert-row"
                    onClick={() => navigate("/app/monitoring/alert-events")}
                  >
                    <ThunderboltOutlined
                      className="dashboard-alert-icon"
                      style={{ color: index % alerts.length < 3 ? "#fa541c" : "#faad14" }}
                    />
                    <Text className="dashboard-alert-name" title={name}>
                      {name}
                    </Text>
                    <Text type="secondary" className="dashboard-alert-threshold">
                      阈值：{threshold}
                    </Text>
                    <Tag
                      className="dashboard-alert-level"
                      color={level === "高级" ? "red" : level === "中级" ? "orange" : "blue"}
                    >
                      {level}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
          <ChartCard className="dashboard-pie-card dashboard-alert-pie-card" title="告警级别分布">
            <CyberPie
              className="dashboard-cyber-pie--alert"
              data={alertLevels}
              color={["#ff416c", "#ffb21c", "#36b9ff"]}
              tone="#36b9ff"
              labelFontSize={15}
              radius={0.78}
              innerRadius={0.48}
            />
          </ChartCard>
          <ChartCard className="dashboard-bar-card" title="智能体告警次数排行">
            <SimpleBars data={alertRank} color="#722ed1" />
          </ChartCard>
        </Col>
      </Row>
        </div>
      </div>
    </div>
  );
}
