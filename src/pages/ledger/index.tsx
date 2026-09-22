/**
 * 统一台账中心 - 台账总览（V1.5 + V2.x 角色可见性）
 *
 * 依据《统一台账中心-需求说明文档 V1.5》§1.1：
 *   - 11 项可视化元素（5 卡片 + 1 趋势图 + 1 KPI + 4 图表）
 *   - 顶部时间筛选：今日 / 近 7 天 / 近 30 天 / 近 90 天 / 自定义（V1.6 联动所有卡片）
 *   - 右上角「数据更新于 YYYY-MM-DD HH:MM:SS」角标（>5 分钟变橙）
 *   - 各卡片 / 图表均支持下钻至台账列表页并预填筛选条件
 *   - 风险分级 = 嵌套环图（外环=复核，内环=初判），含三种下钻选项
 *
 * 角色 × 可视化元素可见性（V2.x）：
 *   - 信息科管理员：全量展示 9 项
 *   - 科室管理员：仅展示本科室可见的 6 项
 *       不展示：#2 智能体科室覆盖率 / #6 智能体科室分布情况 / #8 智能体来源分布情况
 *       （这三项涉及全院科室维度或来源构成，对科室管理员无业务价值）
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Empty,
  Tooltip,
  Radio,
  DatePicker,
  Modal,
  Progress,
  Drawer,
  Switch,
  Tabs,
  Tag,
  List,
  Checkbox,
  message,
} from 'antd';
import {
  RobotOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  BellOutlined,
  RocketOutlined,
  HistoryOutlined,
  EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Bar, Pie, Line, Column } from '@ant-design/charts';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import {
  getVisibleAgents,
  currentUser,
  getDepartmentDistribution,
  getDiagnosisPhaseDistribution,
  getSourceDistribution,
  getRiskDistribution,
  getCallVolumeStat,
  getAlarmStat,
  getInstanceOnlineRateStat,
  getCoverageStat,
  getSubscriptionHistoryReports,
  type LedgerAgent,
  type LedgerUser,
} from '../../mock/ledger';

const { Text } = Typography;

// ============== 视觉规范（V1.5 §1.1）==============
const RISK_COLOR_MAP: Record<string, string> = {
  高度关注: '#FF4D4F',
  中度关注: '#FA8C16',
  一般关注: '#8C8C8C',
  待分级: '#D9D9D9',
  待复核: '#FAAD14',
};

const SOURCE_COLOR_MAP: Record<string, string> = {
  自研: '#1677FF',
  第三方: '#13C2C2',
  合作研发: '#722ED1',
};

const TYPE_COLOR_PALETTE = [
  '#1677FF',
  '#13C2C2',
  '#52C41A',
  '#FA8C16',
  '#722ED1',
  '#EB2F96',
  '#FAAD14',
];

const TREND_COLOR = '#1677FF';

const PHASE_COLOR_PALETTE = [
  '#1677FF',
  '#52C41A',
  '#FA8C16',
  '#722ED1',
  '#13C2C2',
  '#EB2F96',
  '#FAAD14',
  '#2F54EB',
  '#A0D911',
];

const Overview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user: LedgerUser = currentUser;
  const isPlatformAdmin = user.role === 'platform_admin';

  // 顶部时间筛选（V1.6 联动所有卡片/图表，本版本仅 UI 占位）
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // V1：速读订阅抽屉（PRD §3.3.3 / §3.1.1 汇报引导）
  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  const [subActiveTab, setSubActiveTab] = useState<'settings' | 'history'>('settings');
  // 多选订阅频率：可同时勾选「每日」「每周」;推送日共享(每日+每周都按同一组星期几推送)
  const [briefingFreqs, setBriefingFreqs] = useState<Array<'daily' | 'weekly'>>(['daily']);
  const [pushDays, setPushDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [selectedReportIds, setSelectedReportIds] = useState<Array<string | number>>([]);

  // 历史报告 mock：抽屉打开时取数
  const subscriptionHistory = useMemo(() => getSubscriptionHistoryReports(), []);

  const handleGenerateReport = () => {
    navigate('/app/ledger-demo/report');
  };
  const handleSubscribeBriefing = () => {
    setSubDrawerOpen(true);
  };

  // 数据：派生自 mock/ledger
  const visibleList: LedgerAgent[] = useMemo(() => getVisibleAgents(user), [user]);
  const deptDist = useMemo(() => getDepartmentDistribution(visibleList), [visibleList]);
  const phaseDist = useMemo(() => getDiagnosisPhaseDistribution(visibleList), [visibleList]);
  const sourceDist = useMemo(() => getSourceDistribution(visibleList), [visibleList]);
  const riskDist = useMemo(() => getRiskDistribution(visibleList), [visibleList]);
  const callStat = useMemo(() => getCallVolumeStat(visibleList, timeRange), [visibleList, timeRange]);
  const alarmStat = useMemo(() => getAlarmStat(visibleList, timeRange), [visibleList, timeRange]);
  const onlineStat = useMemo(() => getInstanceOnlineRateStat(visibleList), [visibleList]);
  const coverageStat = useMemo(() => getCoverageStat(visibleList, user), [visibleList, user]);

  const hasData = visibleList.length > 0;
  const totalCount = visibleList.length;

  // ===== 列表下钻 =====
  const goList = (params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, v));
    navigate(`/app/ledger/list${qs.toString() ? `?${qs}` : ''}`);
  };

  // V2：从 URL ?openSubscribe=1 触发抽屉(由 AgentFloatHost 气泡「订阅速读」跳转)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openSubscribe') === '1') {
      setSubDrawerOpen(true);
      // 清理 URL 上的标记,避免刷新重复打开
      params.delete('openSubscribe');
      const rest = params.toString();
      navigate(`/app/ledger${rest ? `?${rest}` : ''}`, { replace: true });
    }
  }, [location.search]);

  // ===== 1. 智能体数量 =====
  const renderTotalCard = () => (
    <Card
      hoverable
      bordered={false}
      onClick={() => goList()}
      style={{ height: 124, cursor: 'pointer', border: '1px solid #F0F0F0' }}
      bodyStyle={{ padding: '14px 18px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space size={6} align="center">
          <Text type="secondary" style={{ fontSize: 13 }}>智能体数量</Text>
          <Tooltip
            title="已审核通过并纳管的智能体总数。点击跳转「智能体台账列表页」并自动带入当前筛选条件。"
          >
            <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
          </Tooltip>
        </Space>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#E6F4FF',
            color: '#1677FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          <RobotOutlined />
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 600, color: '#1677FF', lineHeight: 1.1 }}>
        {totalCount}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#8C8C8C' }}>个</div>
    </Card>
  );

  // ===== 2. 智能体科室覆盖率 / 本科室智能体接入率 =====
  const renderCoverageCard = () => {
    const isDeptUser = !isPlatformAdmin;
    const title = isDeptUser ? '本科室智能体接入率' : '智能体科室覆盖率';
    const covered = coverageStat.covered;
    const total = coverageStat.total;
    const rate = coverageStat.rate;
    const avgRate = 0.62; // 全院均值（演示）
    const tooltipText = isDeptUser
      ? `本科室已接入智能体占本科室平均接入率（科室数=${total}）`
      : `当前已部署智能体的科室数占医院总科室数的比例（已覆盖 ${covered}/${total} 个科室）`;
    const compareText = isDeptUser
      ? `本科室 ${(rate * 100).toFixed(1)}% / 全院均值 ${(avgRate * 100).toFixed(1)}%`
      : `已覆盖 ${covered} / 共 ${total} 个科室`;
    return (
      <Card
        hoverable
        bordered={false}
        onClick={() => goList()}
        style={{ height: 124, cursor: 'pointer', border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: '14px 18px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Space size={6} align="center">
            <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
            <Tooltip title={tooltipText}>
              <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
            </Tooltip>
          </Space>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: '#F9F0FF',
              color: '#722ED1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            <AppstoreOutlined />
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 30, fontWeight: 600, color: '#722ED1', lineHeight: 1.1 }}>
          {(rate * 100).toFixed(1)}<span style={{ fontSize: 18, marginLeft: 2 }}>%</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#8C8C8C' }}>{compareText}</div>
      </Card>
    );
  };

  // ===== 3. 智能体总调用量 =====
  const renderCallVolumeCard = () => (
    <Card
      hoverable
      bordered={false}
      onClick={() => navigate(`/app/monitoring/business?preset=callVolume&range=${timeRange}`)}
      style={{ height: 124, cursor: 'pointer', border: '1px solid #F0F0F0' }}
      bodyStyle={{ padding: '14px 18px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space size={6} align="center">
          <Text type="secondary" style={{ fontSize: 13 }}>智能体总调用量</Text>
          <Tooltip
            title={
              <div>
                <div>智能体接入运行后产生的被调用次数</div>
                <div style={{ marginTop: 4 }}>日 {callStat.daily.toLocaleString()} · 周 {callStat.weekly.toLocaleString()} · 月 {callStat.monthly.toLocaleString()}</div>
              </div>
            }
          >
            <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
          </Tooltip>
        </Space>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#E6FFFB',
            color: '#13C2C2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          <ThunderboltOutlined />
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 600, color: '#13C2C2', lineHeight: 1.1 }}>
        {callStat.total >= 10000 ? `${(callStat.total / 10000).toFixed(2)}万` : callStat.total.toLocaleString()}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#8C8C8C' }}>
        日 {callStat.daily.toLocaleString()} · 周 {callStat.weekly.toLocaleString()} · 月 {callStat.monthly.toLocaleString()}
      </div>
    </Card>
  );

  // ===== 4. 智能体异常告警次数 =====
  const renderAlarmCard = () => (
    <Card
      hoverable
      bordered={false}
      onClick={() => navigate(`/app/monitoring/alarm?range=${timeRange}`)}
      style={{ height: 124, cursor: 'pointer', border: '1px solid #F0F0F0' }}
      bodyStyle={{ padding: '14px 18px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space size={6} align="center">
          <Text type="secondary" style={{ fontSize: 13 }}>智能体异常告警次数</Text>
          <Tooltip
            title={
              <div>
                <div>智能体接入运行后产生的告警总次数（监控中心 8-5 事件处置页推送）</div>
                <div style={{ marginTop: 4 }}>日 {alarmStat.daily} · 周 {alarmStat.weekly} · 月 {alarmStat.monthly}</div>
              </div>
            }
          >
            <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
          </Tooltip>
        </Space>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#FFF1F0',
            color: '#FF4D4F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          <WarningOutlined />
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 600, color: '#FF4D4F', lineHeight: 1.1 }}>
        {alarmStat.total}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#8C8C8C' }}>
        日 {alarmStat.daily} · 周 {alarmStat.weekly} · 月 {alarmStat.monthly}
      </div>
    </Card>
  );

  // ===== 5. 智能体实例在线率 =====
  const renderOnlineRateCard = () => (
    <Card
      hoverable
      bordered={false}
      onClick={() => navigate(`/app/monitoring/business?preset=onlineRate&range=${timeRange}`)}
      style={{ height: 124, cursor: 'pointer', border: '1px solid #F0F0F0' }}
      bodyStyle={{ padding: '14px 18px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space size={6} align="center">
          <Text type="secondary" style={{ fontSize: 13 }}>智能体正常运行率</Text>
          <Tooltip
            title={
              <div>
                <div>智能体接入运行后的正常运行实例数与总运行实例数的比例（%）</div>
                <div style={{ marginTop: 4 }}>在线 {onlineStat.online} / 应在线 {onlineStat.total} 个实例</div>
              </div>
            }
          >
            <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
          </Tooltip>
        </Space>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#F6FFED',
            color: '#52C41A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          <CheckCircleOutlined />
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 600, color: '#52C41A', lineHeight: 1.1 }}>
        {(onlineStat.rate * 100).toFixed(1)}<span style={{ fontSize: 18, marginLeft: 2 }}>%</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#8C8C8C' }}>
        在线 {onlineStat.online} / 应在线 {onlineStat.total} 个实例
      </div>
    </Card>
  );

  // ===== 6. 每月新增纳管智能体数量（趋势图，按周/月/季度切换）=====
  const [trendUnit, setTrendUnit] = useState<'week' | 'month' | 'quarter'>('month');
  // 趋势图维度映射（G2 v5 Bar/Line 在 seriesField 缺省时会按 xField 序列化，
  //   tooltip 默认会把 xField/yField 都渲染出来 → 出现「2025-12 / 2025-12」重复。
  //   修复方案：把 xField/yField 同时打到一个 dataKey，并关闭默认 title，避免重复。）
  //
  // V1.6 横坐标规范化：
  //   - 按周：x 存该周周一的 yyyy-mm-dd（如 W19 → 2025-05-05），标签展示 yyyy-mm-dd
  //   - 按月：x 存 YYYY-MM，标签展示 YYYY-MM（横向 + 自动换行，避免旋转成竖排）
  //   - 按季度：x 存 YYYYQn，标签展示 YYYYQn（横向 + 自动换行）
  //   tooltip 仍直接读 x 显示，handleTrendPointClick 同步识别 yyyy-mm-dd 走下钻。
  const trendData = useMemo(() => {
    if (trendUnit === 'week') {
      // 近 12 周：以 W19(2025-05-05) 为起点，每周一向后递推 12 周
      const baseMonday = new Date(2025, 4, 5); // 月份 0 起始 → 4 = 五月
      const vals = [2, 1, 3, 2, 4, 1, 5, 3, 2, 4, 3, 2];
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(baseMonday);
        d.setDate(baseMonday.getDate() + i * 7);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return { x: `${yyyy}-${mm}-${dd}`, y: vals[i] };
      });
    }
    if (trendUnit === 'quarter') {
      // 近 4 季度
      return [
        { x: '2025Q3', y: 8 },
        { x: '2025Q4', y: 10 },
        { x: '2026Q1', y: 6 },
        { x: '2026Q2', y: 6 },
      ];
    }
    // 近 12 个月（默认）
    return [
      { x: '2025-07', y: 3 },
      { x: '2025-08', y: 2 },
      { x: '2025-09', y: 4 },
      { x: '2025-10', y: 1 },
      { x: '2025-11', y: 3 },
      { x: '2025-12', y: 2 },
      { x: '2026-01', y: 4 },
      { x: '2026-02', y: 3 },
      { x: '2026-03', y: 5 },
      { x: '2026-04', y: 4 },
      { x: '2026-05', y: 6 },
      { x: '2026-06', y: 3 },
    ];
  }, [trendUnit]);
  const trendHasData = trendData.some((d) => d.y > 0);
  // G2 v5 默认会把 xField/yField 都渲染到 tooltip 里（标题 + 数值各一），
  //   hover 出来变成「2025-12 / 2025-12」。这里把 label 文本预标注到数据上，
  //   并在 label 上通过 text 直接读，避开 G2 内部字段映射。
  const trendDataLabeled = useMemo(
    () => trendData.map((d) => ({ ...d, labelText: `${d.y ?? 0} 个` })),
    [trendData],
  );
  const trendConfig = {
    data: trendDataLabeled,
    xField: 'x',
    yField: 'y',
    smooth: true,
    color: TREND_COLOR,
    appendPadding: [8, 24, 16, 16],
    point: { size: 5, shape: 'circle', style: { fill: TREND_COLOR, stroke: '#fff', lineWidth: 2 } },
    line: { style: { lineWidth: 2 } },
    area: { style: { fill: 'l(270) 0:#1677FF00 1:#1677FF33' } },
    label: {
      formatter: (datum: any) => datum?.labelText ?? '',
      style: { fill: '#595959', fontSize: 11 },
    },
    xAxis: {
      // V1.6：横坐标按当前粒度格式化 + 横向展示
      //   - 显式 type='cat' 强制 G2 v5 走分类轴，避免 G2 把 yyyy-mm-dd
      //     误识别为时间类型 → 按 ISO 周（W{n}）格式化展示
      //   - 周：x 已是 yyyy-mm-dd，直接展示
      //   - 月/季度：原值就是 YYYY-MM / YYYYQn，直接展示
      //   - autoRotate=false / rotate=0 避免标签被旋转成竖排
      //   - autoWrap=true 让长标签（如 yyyy-mm-dd / YYYY-MM）走横向多行
      //   - autoHide=false 保证所有刻度都可见
      //   - formatter 兜底：若 G2 仍把 yyyy-mm-dd 解析为 Date，
      //     这里再补一次格式化，避免出现 W{n} / undefined
      type: 'cat',
      label: {
        style: { fill: '#8C8C8C', fontSize: 11 },
        autoRotate: false,
        autoHide: false,
        autoWrap: true,
        rotate: 0,
        formatter: (val: any) => {
          if (val == null) return '';
          if (val instanceof Date && !isNaN(val.getTime())) {
            const yyyy = val.getFullYear();
            const mm = String(val.getMonth() + 1).padStart(2, '0');
            const dd = String(val.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
          return String(val);
        },
      },
    },
    yAxis: {
      grid: { line: { style: { stroke: '#F0F0F0' } } },
      label: { style: { fill: '#8C8C8C', fontSize: 11 } },
    },
    tooltip: {
      // G2 v5 tooltip：返回数组（Tooltip.Item[]）是最稳的写法；
      //   单条 item：channel = 'y'，name 显示 x，value 显示 y+单位
      //   → 标题 = 月份 / 数值 = 数量+单位，不会出现重复。
      items: [
        (datum: any) => ({
          channel: 'y',
          name: datum?.x ?? '',
          value: `${datum?.y ?? 0} 个`,
        }),
      ],
    },
  };
  const handleTrendPointClick = (e: any) => {
    const x = e?.data?.x as string | undefined;
    if (!x) return;
    // V1.6：横坐标规范化后
    //   周: yyyy-mm-dd → 取所在月（YYYY-MM）下钻
    //   月: YYYY-MM → 接入时间范围 = 该月
    //   季度: YYYYQn → 取季度首月
    let monthRange: string | undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) {
      // 周一日期 → 截取年月
      monthRange = x.slice(0, 7);
    } else if (/^\d{4}-\d{2}$/.test(x)) {
      monthRange = x;
    } else if (/^\d{4}Q[1-4]$/.test(x)) {
      const q = Number(x.slice(-1));
      monthRange = `${x.slice(0, 4)}-${String((q - 1) * 3 + 1).padStart(2, '0')}`;
    }
    goList({ accessMonth: monthRange });
  };

  // ===== 7. 智能体科室分布（条形图）=====
  const [deptSort, setDeptSort] = useState<'desc' | 'asc'>('desc');
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const sortedDeptDist = useMemo(() => {
    const arr = [...deptDist];
    arr.sort((a, b) => (deptSort === 'desc' ? b.value - a.value : a.value - b.value));
    return arr;
  }, [deptDist, deptSort]);
  const showDeptModal = sortedDeptDist.length > 10;
  const top10Dept = sortedDeptDist.slice(0, 10);
  const deptTotal = sortedDeptDist.reduce((s, d) => s + d.value, 0);
  // G2 v5 Bar 默认 label.formatter 在 v2.6.7 中部分场景会出现「undefined (0%)」重复，
  //   这里改用「数据预标注」+ G2 v5 的 `label.text` 字符串通道：
  //   把「数量（占比%）」预先算到每条数据的 labelText 字段，
  //   再让 label 的 `text` 直接读 `datum.labelText`，绕过内部 datum 字段映射差异。
  //
  // V2.7：避免使用 `transform: [{ type: 'sortX', by: '__sortOrder' }]` 这种 G2 v5
  //   实验性写法——部分版本会抛错导致整图渲染失败，柱状图区域完全空白。
  //   改为：1) 不再注入 `__` 开头的私有字段（避免被 G2 识别成元字段），
  //         2) 改用 `scale.x.domain` 锁定 X 轴顺序（与 data 一致），
  //         3) 用 `label.text` 字符串通道读 `labelText`，避免 formatter 偶发丢 value。
  const top10DeptLabeled = useMemo(
    () =>
      top10Dept.map((d) => {
        const total = deptTotal || 1;
        const v = d.value ?? 0;
        const pct = (v / total) * 100;
        // V2.7：G2Plot v2 强制把长中文科室名（如「老年医学科」5 字）旋转 90°。
        //   在 X 轴用短缩写（去「科」+ 去「室」前缀），与右侧完整列表的 hover/tooltip 配合；
        //   内部保留原名 `nameFull` 给 tooltip 显示完整名。
        const shortName = d.name
          .replace(/科$/, '')
          .replace(/室$/, '');
        return {
          ...d,
          name: shortName,
          nameFull: d.name,
          labelText: `${v}（${pct.toFixed(0)}%）`,
        };
      }),
    [top10Dept, deptTotal],
  );
  const top10DeptDomain = useMemo(
    () => top10DeptLabeled.map((d) => d.name),
    [top10DeptLabeled],
  );
  const deptConfig = {
    // V1.6：原横向 Bar 在 G2 v5 中长科室名被强制旋转 90°，
    //   改用纵向柱状（xField=name/yField=value），让科室名横向落在 X 轴上。
    //
    // V2.7：G2Plot v2.6.7 的 Column 仍然在 X 轴上对中长科室名触发 autoRotate=true 旋转 90°。
    //   改回 `Bar`（横向） + yField=name/xField=value，让科室名落在 Y 轴上天然横向显示。
    //   配合 `Bar` + `xAxis` 显示数值轴、`yAxis` 显示分类轴。
    data: top10DeptLabeled,
    xField: 'value',
    yField: 'name',
    legend: false as const,
    color: TYPE_COLOR_PALETTE[0],
    // V2.7：横向 Bar 用 barWidthRatio（默认 0.6 已足够）
    barWidthRatio: 0.6,
    appendPadding: [8, 32, 8, 16],
    // 关闭 G2 默认 label.formatter（避免 v2.6.7 中 `undefined (0%)` 重复渲染）；
    //   改用 `label.text` 字符串通道直接读 datum.labelText，确保占比非 0。
    // V2.7：横向 Bar 把 label.position 改 'right'（数值轴末端）。
    label: {
      position: 'right',
      offset: 4,
      style: { fontSize: 11, fill: '#595959' },
      text: (datum: any) => datum?.labelText ?? '',
    },
    // V2.7：横向 Bar 改用 scale.y.domain 锁定分类轴顺序（中文按 UTF-16 字典序会打乱 data 顺序）
    scale: {
      y: { domain: top10DeptDomain },
    },
    xAxis: {
      // V2.7：改为横向 Bar 后，X 轴 = 数值轴（智能体数量）
      title: false,
      tickCount: 5,
      grid: { line: { style: { stroke: '#F0F0F0' } } },
      label: { style: { fill: '#8C8C8C', fontSize: 11 } },
    },
    yAxis: {
      // V2.7：横向 Bar 后，Y 轴 = 分类轴（科室名称）—— 长中文名天然横向显示，不会被 autoRotate
      title: false,
      label: {
        style: { fontSize: 11, fill: '#595959' },
        autoRotate: false,
        autoHide: false,
        autoWrap: false,
        rotate: 0,
        formatter: (val: any) => {
          if (val == null) return '';
          const s = String(val);
          // 显示 nameFull（如果数据中有），否则回退原名
          const item = top10DeptLabeled.find((d) => d.name === s);
          return item?.nameFull || s;
        },
      },
    },
    tooltip: {
      // 关闭默认 title，返回 {name:科室全名, value:数量+占比} 让标题/内容不重复
      // V2.7：用 `nameFull` 显示完整科室名，X 轴用短名（去「科/室」后缀）防止 G2 旋转
      formatter: (datum: { name?: string; nameFull?: string; value?: number }) => {
        const total = deptTotal || 1;
        const v = datum?.value ?? 0;
        const pct = (v / total) * 100;
        return {
          name: datum?.nameFull ?? datum?.name ?? '',
          value: `${v} 个（占比 ${pct.toFixed(1)}%）`,
        };
      },
    },
  };

  // ===== 9. 智能体诊疗环节分布（饼图）=====
  // V2.7：G2 v5 label.formatter 在 Pie 上 datum.value 偶发取不到，导致标签显示「0 个（0.0%）」。
  //   改为关闭 chart 内置 label，由组件按数据角度自绘 SVG 标签，确保与右侧图例口径一致。
  //
  // V3.0：在 V2.7 自绘标签基础上加一根「扇区外缘 → 标签落点」的引导线（参考图2 spider 样式）。
  //   - 引导线起点 sliceRadius=36（贴近扇区外缘），终点 labelRadius=44（饼外 9 单位），
  //     线长 8 单位 ≈ 24px @ container 296px，跟 Dashboard.tsx 的 spider 视觉一致。
  //   - SVG 容器保留 overflow:hidden（V3.0 收紧），防止极端长文本溢出 Card body；
  //     labelRadius=44 时标签落点最远 ≈ 130px（< 容器宽 296/2=148px），全部落在图表区域内。
  const buildPieLabelPositions = (data: { name: string; value: number }[], total: number) => {
    const cx = 50;
    const cy = 50;
    const labelRadius = 44;
    const sliceRadius = 36;
    let cursor = -Math.PI / 2; // 12 点钟方向起
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
        name: d.name,
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

  const phaseTotal = phaseDist.reduce((s, d) => s + d.value, 0);
  const phaseConfig = {
    data: phaseDist,
    angleField: 'value',
    colorField: 'name',
    // V2.7：radius 由 0.9 改 0.7（≈35 单位），给外侧 SVG 标签（labelRadius=44）留 9 单位余量
    radius: 0.7,
    innerRadius: 0.5,
    appendPadding: [0, 0, 8, 0],
    color: PHASE_COLOR_PALETTE,
    legend: false as const,
    // V2.7：G2Plot v2 在 Pie 上偶发忽略 `label: false` 仍渲染引导线 + 文字。
    //   改为「空 formatter + 透明样式」：标签/引导线全部 transparent，
    //   实际只渲染空字符串。G2Plot 在 sum=0 时会覆盖 formatter，
    //   但我们 sourceDist/phaseDist/riskPieData 数据 sum 均非 0，不会触发该分支。
    //   所有数字标签改由外置 SVG 自绘（与右侧图例口径一致，无 0% bug）。
    label: {
      style: { fill: 'transparent', stroke: 'transparent', fontSize: 0, lineHeight: 0 },
      formatter: () => '',
    },
    tooltip: {
      formatter: (datum: any) => {
        const total = phaseTotal || 1;
        const v = datum?.value ?? 0;
        const pct = ((v / total) * 100).toFixed(1);
        return { name: datum?.name ?? '', value: `${v} 个（${pct}%）` };
      },
    },
  };

  // 自绘标签：按 phaseDist 顺序计算每个扇区的中线角度，落到外环稍外位置
  //   V2.7：labelRadius 改 55（饼图半径 0.9≈45，外侧留 10px 余量）；
  //   配合 SVG viewBox 0 0 100 100 + 容器 overflow:visible，让文字不被裁切。
  const phaseLabelPositions = useMemo(
    () => buildPieLabelPositions(phaseDist, phaseTotal),
    [phaseDist, phaseTotal],
  );

  // ===== 10. 智能体来源分布（饼图）=====
  const sourceTotal = sourceDist.reduce((s, d) => s + d.value, 0);
  // V2.7：关闭 G2 Pie 内置 label（formatter 取 value 偶发为 0 导致「0%」），
  //   改由自绘 SVG 标签统一管理（与诊疗环节饼图共用一套算法）。
  //   强制 type='spider' + formatter 返回 '' + 透明样式，确保 G2Plot v2 不残留引导线。
  const sourceConfig = {
    data: sourceDist,
    angleField: 'value',
    colorField: 'name',
    // V2.7：radius 由 0.9 改 0.7（≈35 单位），给外侧 SVG 标签（labelRadius=44）留 9 单位余量
    radius: 0.7,
    innerRadius: 0.5,
    appendPadding: [0, 0, 8, 0],
    color: ({ name }: { name: string }) => SOURCE_COLOR_MAP[name] || TYPE_COLOR_PALETTE[0],
    legend: false as const,
    label: false,
    tooltip: {
      formatter: (datum: any) => {
        const total = sourceTotal || 1;
        const v = datum?.value ?? 0;
        const pct = ((v / total) * 100).toFixed(1);
        return { name: datum?.name ?? '', value: `${v} 个（${pct}%）` };
      },
    },
  };

  // 来源分布 / 风险分级的扇区外侧标签位置（统一算法，避开 G2 formatter 偶发丢 value）
  const sourceLabelPositions = useMemo(
    () => buildPieLabelPositions(sourceDist, sourceTotal),
    [sourceDist, sourceTotal],
  );

  // ===== 10. 风险分级（单饼图，V1.5 简化规范：高度/中度/一般 三色）=====
  //   - hover tooltip 显示「高度关注（初步判定）:X 个 / 高度关注（复核判定）:Y 个」分布
  //   - 点击扇形下钻「智能体台账列表」并筛选该等级
  const riskTotal = riskDist.summary.reduce((s, x) => s + x.total, 0);
  const riskPieData = riskDist.summary
    .filter((x) => x.total > 0)
    .map((x) => ({ name: x.level, value: x.total }));
  const riskConfig = {
    data: riskPieData,
    angleField: 'value',
    colorField: 'name',
    // V2.7：radius 由 0.9 改 0.7（≈35 单位），给外侧 SVG 标签（labelRadius=44）留 9 单位余量
    radius: 0.7,
    innerRadius: 0.5,
    appendPadding: [0, 0, 8, 0],
    color: ({ name }: { name: string }) => RISK_COLOR_MAP[name] || '#D9D9D9',
    legend: false as const,
    // V2.7：关闭 G2 内置 label（formatter 偶发丢 value → 「0%」），改用自绘 SVG 标签
    //   强制 type='spider' + formatter 返回 '' + 透明样式，确保 G2Plot v2 不残留引导线
    label: false,
    tooltip: {
      formatter: (datum: any) => {
        // 悬停「高度关注」显示 初步/复核 分布；中度/一般 同理
        const row = riskDist.summary.find((s) => s.level === datum?.name);
        if (!row) return { name: datum?.name ?? '', value: '0 个' };
        return {
          name: datum?.name ?? '',
          value: (
            <div>
              <div>初步判定：{row.initial} 个</div>
              <div>复核判定：{row.review} 个</div>
            </div>
          ),
        };
      },
    },
  };

  // 风险分级的扇区外侧标签位置（统一算法）
  const riskLabelPositions = useMemo(
    () => buildPieLabelPositions(riskPieData, riskTotal),
    [riskPieData, riskTotal],
  );

  const handleRiskSliceClick = (name: string) => {
    // 单击下钻「该等级」列表
    goList({ riskLevel: name });
  };

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <PageHeader
        title="台账总览"
        subTitle={
          isPlatformAdmin
            ? '全院智能体台账总览 · 数量 / 覆盖率 / 调用 / 告警 / 风险分级'
            : `${user.department} 智能体台账总览 · 本科室数据自动收窄`
        }
        extra={
          <Space size={12} align="center">
            {/* V2:医小管 inline 状态提示(让用户进入总览页立即感知右下角 Agent 在工作)
                复用现有 AgentFloatHost,不新建智能体,点击直跳右下角机器人 */}
            {/* PRD §3.1.1/§4.1.1:态势汇报由 Agent 气泡承担,不再在标题区放置 chip */}
            {/* 时间筛选（V1.6 联动所有卡片，本版本仅 UI 占位）*/}
            <Radio.Group
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="today">今日</Radio.Button>
              <Radio.Button value="7d">近 7 天</Radio.Button>
              <Radio.Button value="30d">近 30 天</Radio.Button>
              <Radio.Button value="90d">近 90 天</Radio.Button>
              <Radio.Button value="custom">自定义</Radio.Button>
            </Radio.Group>
            {timeRange === 'custom' && (
              <DatePicker.RangePicker
                size="small"
                value={customRange as any}
                onChange={(v: any) => {
                  if (v && v[0] && v[1]) setCustomRange([v[0], v[1]]);
                  else setCustomRange(null);
                }}
              />
            )}
            <Button
              type="primary"
              size="middle"
              icon={<BarChartOutlined />}
              onClick={() => goList()}
            >
              查看台账列表
            </Button>
            {/* V1：PRD §3.1.1 / §3.3.1 汇报引导（生成报告 + 订阅速读） */}
            <Tooltip title="一键生成《全院智能体管理情况报告》">
              <Button
                size="middle"
                icon={<FileTextOutlined />}
                onClick={handleGenerateReport}
              >
                生成报告
              </Button>
            </Tooltip>
            <Tooltip title="订阅台账速读（日/周）至工作台">
              <Button
                size="middle"
                icon={<BellOutlined />}
                onClick={handleSubscribeBriefing}
              >
                订阅速读
              </Button>
            </Tooltip>
          </Space>
        }
      />

      {/* ===== 第一行 KPI 卡片（§1.1 #1 ~ #5） ===== */}
      {/* 管理员（信息科管理员）：5 张卡片全显；科室用户（本科室）：不显示 #2 智能体科室覆盖率 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} sm={12} md={12} lg={isPlatformAdmin ? 5 : 6} xl={isPlatformAdmin ? 5 : 6}>
          {renderTotalCard()}
        </Col>
        {isPlatformAdmin && (
          <Col xs={24} sm={12} md={12} lg={5} xl={5}>
            {renderCoverageCard()}
          </Col>
        )}
        <Col xs={24} sm={12} md={12} lg={isPlatformAdmin ? 5 : 6} xl={isPlatformAdmin ? 5 : 6}>
          {renderCallVolumeCard()}
        </Col>
        <Col xs={24} sm={12} md={12} lg={isPlatformAdmin ? 4 : 6} xl={isPlatformAdmin ? 4 : 6}>
          {renderAlarmCard()}
        </Col>
        <Col xs={24} sm={12} md={12} lg={isPlatformAdmin ? 5 : 6} xl={isPlatformAdmin ? 5 : 6}>
          {renderOnlineRateCard()}
        </Col>
      </Row>

      {/* ===== 第二行：趋势图（§1.1 #6，全宽） ===== */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} sm={24} md={24} lg={24} xl={24}>
          <Card
            bordered={false}
            style={{ height: 280, border: '1px solid #F0F0F0' }}
            bodyStyle={{ padding: '8px 12px 12px' }}
            title={
              <Space size={8} align="center">
                <span style={{ fontSize: 14, fontWeight: 600 }}>每月新增纳管智能体数量</span>
                <Tooltip title="按月展示近 12 个月；支持按周/季度切换。点击数据点下钻该月份的新增智能体明细列表。">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
                </Tooltip>
              </Space>
            }
            extra={
              <Radio.Group
                size="small"
                value={trendUnit}
                onChange={(e) => setTrendUnit(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="week">按周</Radio.Button>
                <Radio.Button value="month">按月</Radio.Button>
                <Radio.Button value="quarter">按季度</Radio.Button>
              </Radio.Group>
            }
          >
            {trendHasData ? (
              <div style={{ height: 210 }} onClick={handleTrendPointClick}>
                <Line {...trendConfig} />
              </div>
            ) : (
              <Empty description="暂无新增数据" style={{ height: 210 }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* ===== 第三行：科室分布（仅信息科管理员）+ 诊疗环节分布（两角色可见）===== */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        {isPlatformAdmin && (
        <Col xs={24} md={24} lg={12} xl={12}>
          <Card
            bordered={false}
            style={{ height: 360, border: '1px solid #F0F0F0' }}
            bodyStyle={{ padding: '8px 12px 12px' }}
            title={
              <Space size={8} align="center">
                <span style={{ fontSize: 14, fontWeight: 600 }}>智能体科室分布情况</span>
                <Tooltip title="默认从多到少排序；悬停气泡展示「科室名称:X 个（占比 Y%）」；点击条形下钻台账列表。">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
                </Tooltip>
              </Space>
            }
            extra={
              <Space size={4} align="center">
                <Radio.Group
                  size="small"
                  value={deptSort}
                  onChange={(e) => setDeptSort(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="desc">从多到少</Radio.Button>
                  <Radio.Button value="asc">从少到多</Radio.Button>
                </Radio.Group>
              </Space>
            }
          >
            {hasData && top10Dept.length > 0 ? (
              <Row gutter={8} style={{ height: 296 }}>
                <Col span={14}>
                  {/* V2.7：G2Plot v2.6.7 的 Bar/Column 在 X/Y 轴上对中长中文分类标签
                      都会强制 autoRotate=true 旋转 90°，且所有 `autoRotate:false` /
                      `align:'horizontal'` / `rotate:0` 配置均被 G2 v4 内部 ignore。
                      改为「HTML 自绘横向条形图」：
                        - 科室名天然水平显示在每行左侧
                        - 柱条按 value / maxValue 比例计算宽度
                        - 行末显示「数量（占比）」标签
                        - 行点击下钻台账列表（与右侧列表同步） */}
                  <div
                    style={{
                      height: 296,
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}
                  >
                    {(() => {
                      const maxVal = Math.max(...top10DeptLabeled.map((d) => d.value), 1);
                      return top10DeptLabeled.map((d) => {
                        const pct = deptTotal ? ((d.value / deptTotal) * 100).toFixed(1) : '0';
                        const widthPct = (d.value / maxVal) * 100;
                        const displayName = d.nameFull || d.name;
                        return (
                          <div
                            key={displayName}
                            onClick={() => goList({ department: displayName })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '5px 4px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                              color: '#595959',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = '#F5F5F5';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            <span
                              style={{
                                width: 64,
                                flexShrink: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: '#262626',
                              }}
                              title={displayName}
                            >
                              {displayName}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                height: 14,
                                background: '#F5F5F5',
                                borderRadius: 2,
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  background: TYPE_COLOR_PALETTE[0],
                                  borderRadius: 2,
                                  transition: 'width 0.2s',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                width: 64,
                                flexShrink: 0,
                                textAlign: 'right',
                                color: '#262626',
                                fontWeight: 500,
                              }}
                            >
                              {d.value} <Text type="secondary" style={{ fontSize: 11 }}>({pct}%)</Text>
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Col>
                <Col span={10}>
                  {/* V2.7：右侧改为「Top 3 突出展示」—— 突出头部 3 个科室（大数字 + 名称），
                      避免与左侧 HTML 条形图视觉重复；每项点击同样下钻。 */}
                  <div
                    style={{
                      height: 296,
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}
                  >
                    {top10DeptLabeled.slice(0, 3).map((d, i) => {
                      const pct = deptTotal ? ((d.value / deptTotal) * 100).toFixed(1) : '0';
                      const displayName = d.nameFull || d.name;
                      return (
                        <div
                          key={displayName}
                          onClick={() => goList({ department: displayName })}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            marginBottom: 8,
                            background: i === 0 ? '#E6F4FF' : '#FAFAFA',
                            border: i === 0 ? '1px solid #91CAFF' : '1px solid #F0F0F0',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '0.85';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '1';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 18,
                                height: 18,
                                lineHeight: '18px',
                                textAlign: 'center',
                                borderRadius: 9,
                                background: i === 0 ? '#1677FF' : '#D9D9D9',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {i + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                color: '#262626',
                                fontWeight: i === 0 ? 600 : 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                              title={displayName}
                            >
                              {displayName}
                            </span>
                          </div>
                          <div style={{ marginTop: 4, marginLeft: 24, fontSize: 11, color: '#8C8C8C' }}>
                            <span style={{ color: '#262626', fontWeight: 500, fontSize: 14 }}>{d.value}</span>
                            {' '}
                            个 · 占比 {pct}%
                          </div>
                        </div>
                      );
                    })}
                    {top10DeptLabeled.length > 3 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#8C8C8C',
                          textAlign: 'center',
                          padding: '6px 0',
                        }}
                      >
                        其余 {top10DeptLabeled.length - 3} 个科室见左侧条形图
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            ) : (
              <Empty style={{ height: 240 }} />
            )}
          </Card>
        </Col>
        )}

        <Col xs={24} md={24} lg={isPlatformAdmin ? 12 : 24} xl={isPlatformAdmin ? 12 : 24}>
          <Card
            bordered={false}
            style={{ height: 360, border: '1px solid #F0F0F0' }}
            bodyStyle={{ padding: '8px 12px 12px' }}
            title={
              <Space size={8} align="center">
                <span style={{ fontSize: 14, fontWeight: 600 }}>智能体诊疗环节分布情况</span>
                <Tooltip title="各扇形标注诊疗环节名称、智能体数量与占比；点击扇形下钻台账列表并筛选该环节。">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
                </Tooltip>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>按智能体所属环节聚合（多选智能体计入多个环节）</Text>}
          >
            {hasData && phaseDist.length > 0 ? (
              <Row gutter={8} style={{ height: 296 }}>
                <Col span={14}>
                  {/* V3.0：外层 overflow:hidden 兜底，限制标签不越出 Card body；内层 SVG overflow:visible 让标签溢出 SVG 自身边界仍可见 */}
                  <div style={{ height: 296, position: 'relative', overflow: 'hidden' }}>
                    <Pie
                      {...phaseConfig}
                      onEvent={(e: any) => {
                        if (e?.type === 'pie:click' || e?.type === 'element:click') {
                          const name = e?.data?.data?.name as string | undefined;
                          if (name) goList({ diagnosisPhase: name });
                        }
                      }}
                    />
                    {/* 自绘扇形外侧标签：V2.7 修复 G2 v5 formatter 偶发丢 value 导致全 0 的问题 */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        // V3.0：保留 visible，让标签溢出 SVG 边界仍可见，由外层 div overflow:hidden 兜底
                        overflow: 'visible',
                      }}
                    >
                      {/* V3.0：扇区中点 → 标签落点的引导线（参考图2 spider 样式） */}
                      {phaseLabelPositions.map((p) => (
                        <line
                          key={`line-${p.name}`}
                          x1={p.sliceX}
                          y1={p.sliceY}
                          x2={p.x}
                          y2={p.y}
                          stroke="#BFBFBF"
                          strokeWidth={0.25}
                          pointerEvents="none"
                        />
                      ))}
                      {phaseLabelPositions.map((p) => {
                        // 把百分比 viewBox 坐标（0-100）映射回容器像素，做字号自适应
                        return (
                          <g
                            key={p.name}
                            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                            onClick={() => goList({ diagnosisPhase: p.name })}
                          >
                            <text
                              x={p.x}
                              y={p.y}
                              fontSize={3.2}
                              fill="#262626"
                              textAnchor={p.anchor}
                              dominantBaseline="middle"
                              style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 0.6 }}
                            >
                              <tspan x={p.x} dy="0">
                                {p.name}
                              </tspan>
                              <tspan x={p.x} dy="3.6" fontSize={2.8} fill="#595959">
                                {p.value} 个（{p.pct}%）
                              </tspan>
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </Col>
                <Col span={10}>
                  <div
                    style={{
                      height: 296,
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}
                  >
                    {phaseDist.map((d, i) => {
                      const pct = ((d.value / phaseTotal) * 100).toFixed(1);
                      return (
                        <div
                          key={d.name}
                          onClick={() => goList({ diagnosisPhase: d.name })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#595959',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = '#F5F5F5';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <Space size={6} align="center" style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: PHASE_COLOR_PALETTE[i % PHASE_COLOR_PALETTE.length],
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {d.name}
                            </span>
                          </Space>
                          <span style={{ color: '#262626', fontWeight: 500 }}>
                            {d.value} <Text type="secondary" style={{ fontSize: 11 }}>({pct}%)</Text>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
            ) : (
              <Empty style={{ height: 296 }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* ===== 第四行：来源分布（仅信息科管理员）+ 风险分级（两角色可见）===== */}
      <Row gutter={[12, 12]} style={{ marginTop: 12, marginBottom: 16 }}>
        {isPlatformAdmin && (
        <Col xs={24} md={24} lg={12} xl={12}>
          <Card
            bordered={false}
            style={{ height: 360, border: '1px solid #F0F0F0' }}
            bodyStyle={{ padding: '8px 12px 12px' }}
            title={
              <Space size={8} align="center">
                <span style={{ fontSize: 14, fontWeight: 600 }}>智能体来源分布情况</span>
                <Tooltip title="自研/第三方/合作研发三类以不同颜色区分；点击扇形下钻台账列表。">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
                </Tooltip>
              </Space>
            }
          >
            {hasData && sourceDist.length > 0 ? (
              <Row gutter={8} style={{ height: 296 }}>
                <Col span={14}>
                  {/* V3.0：外层 overflow:hidden 兜底，限制标签不越出 Card body；内层 SVG overflow:visible 让标签溢出 SVG 自身边界仍可见 */}
                  <div style={{ height: 296, position: 'relative', overflow: 'hidden' }}>
                    <Pie
                      {...sourceConfig}
                      onEvent={(e: any) => {
                        if (e?.type === 'pie:click' || e?.type === 'element:click') {
                          const name = e?.data?.data?.name as string | undefined;
                          if (name) goList({ sourceType: name });
                        }
                      }}
                    />
                    {/* V2.7：自绘扇区外侧标签（避开 G2 v5 formatter 偶发丢 value） */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        // V3.0：保留 visible，让标签溢出 SVG 边界仍可见，由外层 div overflow:hidden 兜底
                        overflow: 'visible',
                      }}
                    >
                      {/* V3.0：扇区中点 → 标签落点的引导线（参考图2 spider 样式） */}
                      {sourceLabelPositions.map((p) => (
                        <line
                          key={`line-${p.name}`}
                          x1={p.sliceX}
                          y1={p.sliceY}
                          x2={p.x}
                          y2={p.y}
                          stroke="#BFBFBF"
                          strokeWidth={0.25}
                          pointerEvents="none"
                        />
                      ))}
                      {sourceLabelPositions.map((p) => (
                        <g
                          key={p.name}
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                          onClick={() => goList({ sourceType: p.name })}
                        >
                          <text
                            x={p.x}
                            y={p.y}
                            fontSize={3}
                            fill="#262626"
                            textAnchor={p.anchor}
                            dominantBaseline="middle"
                            style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 0.6 }}
                          >
                            <tspan x={p.x} dy="0">
                              {p.name}
                            </tspan>
                            <tspan x={p.x} dy="3.4" fontSize={2.6} fill="#595959">
                              {p.value} 个（{p.pct}%）
                            </tspan>
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </Col>
                <Col span={10}>
                  <div
                    style={{
                      height: 296,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '4px 0',
                      gap: 12,
                    }}
                  >
                    {sourceDist.map((d) => {
                      const pct = ((d.value / sourceTotal) * 100).toFixed(1);
                      return (
                        <div
                          key={d.name}
                          onClick={() => goList({ sourceType: d.name })}
                          style={{
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = '#F5F5F5';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <Space size={6} align="center">
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 2,
                                  background: SOURCE_COLOR_MAP[d.name] || '#1677FF',
                                }}
                              />
                              <span style={{ fontSize: 12, color: '#595959' }}>{d.name}</span>
                            </Space>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>
                              {d.value} <Text type="secondary" style={{ fontSize: 11 }}>({pct}%)</Text>
                            </span>
                          </div>
                          <Progress
                            percent={Number(pct)}
                            showInfo={false}
                            strokeColor={SOURCE_COLOR_MAP[d.name] || '#1677FF'}
                            size="small"
                          />
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
            ) : (
              <Empty style={{ height: 296 }} />
            )}
          </Card>
        </Col>
        )}

        <Col xs={24} md={24} lg={isPlatformAdmin ? 12 : 24} xl={isPlatformAdmin ? 12 : 24}>
          <Card
            bordered={false}
            style={{ height: 360, border: '1px solid #F0F0F0' }}
            bodyStyle={{ padding: '8px 12px 12px' }}
            title={
              <Space size={8} align="center">
                <span style={{ fontSize: 14, fontWeight: 600 }}>智能体风险分级情况</span>
                <Tooltip title="按「高度关注 / 中度关注 / 一般关注」绘制饼图；hover 显示「初步判定 / 复核判定」分布；点击扇形下钻「智能体台账列表」并筛选该等级。">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#BFBFBF' }} />
                </Tooltip>
              </Space>
            }
          >
            {hasData && riskTotal > 0 ? (
              <Row gutter={8} style={{ height: 296 }}>
                <Col span={14}>
                  {/* V3.0：外层 overflow:hidden 兜底，限制标签不越出 Card body；内层 SVG overflow:visible 让标签溢出 SVG 自身边界仍可见 */}
                  <div style={{ height: 296, position: 'relative', overflow: 'hidden' }}>
                    <Pie
                      {...riskConfig}
                      onEvent={(e: any) => {
                        if (e?.type === 'pie:click' || e?.type === 'element:click') {
                          const name = e?.data?.data?.name as string | undefined;
                          if (name) handleRiskSliceClick(name);
                        }
                      }}
                    />
                    {/* V2.7：自绘扇区外侧标签（避开 G2 v5 formatter 偶发丢 value） */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        // V3.0：保留 visible，让标签溢出 SVG 边界仍可见，由外层 div overflow:hidden 兜底
                        overflow: 'visible',
                      }}
                    >
                      {/* V3.0：扇区中点 → 标签落点的引导线（参考图2 spider 样式） */}
                      {riskLabelPositions.map((p) => (
                        <line
                          key={`line-${p.name}`}
                          x1={p.sliceX}
                          y1={p.sliceY}
                          x2={p.x}
                          y2={p.y}
                          stroke="#BFBFBF"
                          strokeWidth={0.25}
                          pointerEvents="none"
                        />
                      ))}
                      {riskLabelPositions.map((p) => (
                        <g
                          key={p.name}
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                          onClick={() => handleRiskSliceClick(p.name)}
                        >
                          <text
                            x={p.x}
                            y={p.y}
                            fontSize={3}
                            fill="#262626"
                            textAnchor={p.anchor}
                            dominantBaseline="middle"
                            style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 0.6 }}
                          >
                            <tspan x={p.x} dy="0">
                              {p.name}
                            </tspan>
                            <tspan x={p.x} dy="3.4" fontSize={2.6} fill="#595959">
                              {p.value} 个（{p.pct}%）
                            </tspan>
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </Col>
                <Col span={10}>
                  <div
                    style={{
                      height: 296,
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}
                  >
                    {riskDist.summary.map((x) => {
                      const pct = ((x.total / riskTotal) * 100).toFixed(1);
                      return (
                        <div
                          key={x.level}
                          onClick={() => handleRiskSliceClick(x.level)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: 4,
                            marginBottom: 4,
                            background: '#FAFAFA',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = '#F0F5FF';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = '#FAFAFA';
                          }}
                        >
                          <Space size={6} align="center" style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: RISK_COLOR_MAP[x.level],
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{x.level}</span>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {x.total} 个（{pct}%）
                            </Text>
                          </Space>
                          <Tooltip
                            title={
                              <div>
                                <div>{x.level}（初步判定）：{x.initial} 个</div>
                                <div>{x.level}（复核判定）：{x.review} 个</div>
                              </div>
                            }
                          >
                            <InfoCircleOutlined style={{ fontSize: 12, color: '#8C8C8C', cursor: 'help' }} />
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
            ) : (
              <Empty style={{ height: 296 }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* ===== 弹层：科室分布查看全部 ===== */}
      <Modal
        open={deptModalOpen}
        onCancel={() => setDeptModalOpen(false)}
        footer={null}
        title="全部科室分布"
        width={960}
      >
        <Row gutter={[12, 12]}>
          {sortedDeptDist.map((d) => {
            const pct = ((d.value / deptTotal) * 100).toFixed(1);
            return (
              <Col key={d.name} span={12}>
                <div
                  onClick={() => {
                    setDeptModalOpen(false);
                    goList({ department: d.name });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: '1px solid #F0F0F0',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Space size={8} align="center">
                    <AppstoreOutlined style={{ color: '#1677FF' }} />
                    <span style={{ fontSize: 13 }}>{d.name}</span>
                  </Space>
                  <Space size={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{pct}%</Text>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{d.value}</span>
                  </Space>
                </div>
              </Col>
            );
          })}
        </Row>
      </Modal>

      {/* V1：台账速读订阅抽屉（PRD §3.3.3 / §3.1.1 汇报引导） */}
      <Drawer
        open={subDrawerOpen}
        onClose={() => setSubDrawerOpen(false)}
        title={
          <Space>
            <BellOutlined style={{ color: '#1677FF' }} />
            <span>{isPlatformAdmin ? '全院台账速读订阅' : '本科室台账速读订阅'}</span>
          </Space>
        }
        width={680}
      >
        <Tabs
          activeKey={subActiveTab}
          onChange={(k) => setSubActiveTab(k as 'settings' | 'history')}
          items={[
            {
              key: 'settings',
              label: (
                <span style={{ fontSize: 14 }}>
                  <RocketOutlined style={{ marginRight: 4 }} />
                  订阅设置
                </span>
              ),
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong>订阅频率</Text>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <Checkbox
                        checked={briefingFreqs.includes('daily')}
                        onChange={(e) =>
                          setBriefingFreqs((prev) =>
                            e.target.checked ? [...prev, 'daily'] : prev.filter((f) => f !== 'daily'),
                          )
                        }
                      >
                        每日速读
                      </Checkbox>
                      <Checkbox
                        checked={briefingFreqs.includes('weekly')}
                        onChange={(e) =>
                          setBriefingFreqs((prev) =>
                            e.target.checked ? [...prev, 'weekly'] : prev.filter((f) => f !== 'weekly'),
                          )
                        }
                      >
                        每周速读
                      </Checkbox>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      速读为轻量版,侧重异常告警/故障及相较前一日/前一周的数据变化;支持同时配置
                    </Text>
                  </div>

                  {(briefingFreqs.includes('daily') || briefingFreqs.includes('weekly')) && (
                    <div data-testid="push-day-picker">
                      <Text strong>推送日（每日 + 每周共享）</Text>
                      <div style={{ marginTop: 6 }}>
                        <Checkbox.Group
                          value={pushDays}
                          onChange={(v) => setPushDays(v as number[])}
                          style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                        >
                          {[
                            { v: 1, l: '一' },
                            { v: 2, l: '二' },
                            { v: 3, l: '三' },
                            { v: 4, l: '四' },
                            { v: 5, l: '五' },
                            { v: 6, l: '六' },
                            { v: 0, l: '日' },
                          ].map((d) => (
                            <Checkbox key={d.v} value={d.v}>
                              周{d.l}
                            </Checkbox>
                          ))}
                        </Checkbox.Group>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        多选表示多天推送,至少选 1 天;勾选的星期对每日/每周速读都生效
                      </Text>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      style={{ width: 200 }}
                      disabled={briefingFreqs.length === 0 || pushDays.length === 0}
                      onClick={() => {
                        setSubDrawerOpen(false);
                        const parts: string[] = [];
                        const dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                        const fmtDays = (arr: number[]) =>
                          arr
                            .slice()
                            .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                            .map((d) => dayMap[d])
                            .join('/');
                        const daysText = fmtDays(pushDays);
                        if (briefingFreqs.includes('daily')) {
                          parts.push(`每日(${daysText})`);
                        }
                        if (briefingFreqs.includes('weekly')) {
                          parts.push(`每周${daysText}`);
                        }
                        message.success(
                          `订阅已开启: ${parts.join(' + ')} · ${isPlatformAdmin ? '全院' : '本科室'}`,
                        );
                      }}
                    >
                      立即开启订阅
                    </Button>
                  </div>
                </Space>
              ),
            },
            {
              key: 'history',
              label: (
                <span style={{ fontSize: 14 }}>
                  <HistoryOutlined style={{ marginRight: 4 }} />
                  历史报告
                </span>
              ),
              children: (
                <div data-testid="subscription-history">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Space size={6}>
                      <Checkbox
                        checked={
                          subscriptionHistory.length > 0 &&
                          selectedReportIds.length === subscriptionHistory.length
                        }
                        indeterminate={
                          selectedReportIds.length > 0 &&
                          selectedReportIds.length < subscriptionHistory.length
                        }
                        onChange={() => {
                          // 行为:已全选 → 全不选;否则(含 indeterminate)→ 全选
                          const allSelected =
                            selectedReportIds.length === subscriptionHistory.length;
                          setSelectedReportIds(allSelected ? [] : subscriptionHistory.map((r) => r.id));
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          全选
                        </Text>
                      </Checkbox>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        共 {subscriptionHistory.length} 条
                        {selectedReportIds.length > 0 && ` · 已选 ${selectedReportIds.length} 条`}
                      </Text>
                    </Space>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<DownloadOutlined />}
                      disabled={selectedReportIds.length === 0}
                      onClick={() => {
                        message.success(
                          `已订阅 ${selectedReportIds.length} 条历史报告导出任务（演示）`,
                        );
                        setSelectedReportIds([]);
                      }}
                    >
                      批量导出
                    </Button>
                  </div>
                  <List
                    size="small"
                    dataSource={subscriptionHistory}
                    renderItem={(item) => {
                      const checked = selectedReportIds.includes(item.id);
                      return (
                        <List.Item
                          key={item.id}
                          style={{
                            padding: '8px 12px',
                            background: '#FAFAFA',
                            borderRadius: 6,
                            marginBottom: 6,
                            border: '1px solid #F0F0F0',
                          }}
                          actions={[
                            <Button
                              key="export"
                              size="small"
                              type="link"
                              icon={<DownloadOutlined />}
                              onClick={() => {
                                message.success(`已导出报告: ${item.title}`);
                                setSelectedReportIds((prev) =>
                                  prev.filter((id) => id !== item.id),
                                );
                              }}
                            >
                              导出
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={
                              <Checkbox
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedReportIds((prev) =>
                                    e.target.checked
                                      ? [...prev, item.id]
                                      : prev.filter((id) => id !== item.id),
                                  );
                                }}
                              />
                            }
                            title={
                              <Space size={6} wrap>
                                <FileTextOutlined style={{ fontSize: 16, color: '#1677FF' }} />
                                {/* 报告名称：点击进入报告详情 */}
                                <a
                                  onClick={() => navigate('/app/ledger-demo/report')}
                                  style={{ fontSize: 13, fontWeight: 600 }}
                                >
                                  {item.title}
                                </a>
                                <Tag color={item.freq === 'daily' ? 'geekblue' : 'purple'} style={{ margin: 0 }}>
                                  {item.freq === 'daily' ? '每日' : '每周'}
                                </Tag>
                                <Tag color={item.status === 'failed' ? 'red' : item.status === 'viewed' ? 'default' : 'blue'} style={{ margin: 0 }}>
                                  {item.status === 'failed' ? '推送失败' : item.status === 'viewed' ? '已查看' : '已送达'}
                                </Tag>
                              </Space>
                            }
                            description={
                              <div style={{ marginTop: 2 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  推送日期:
                                  <span style={{ marginLeft: 4, color: '#262626' }}>
                                    {item.deliveredAt || '—'}
                                  </span>
                                </Text>
                              </div>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default Overview;
