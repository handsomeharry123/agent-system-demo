/**
 * 统一台账中心 - 智能化升级 Demo
 * §3.1 态势汇报气泡组件(2026-07-03 V1.1 升级)
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.1.1：
 *   - 进入首页时，智能助手以非打断气泡主动汇报关键态势
 *   - 自上而下：问候 → 整体 → 进度 → 风险 → 分流/对话引导
 *   - 关键指标名称加粗可点击分流（无卡片）
 *   - 停留数秒后收起、可手动关闭
 *   - 信息科管理员：全院数据；科室用户：本科室数据
 *
 * V1.1 升级要点(2026-07-03):
 *   1. 高度控制对齐接入中心(page-level 欢迎气泡 V2.1/V2.2):
 *      - maxHeight 280/420 + 贴内容,不固定 top/bottom
 *      - 移除 min-width 强制(由 .agent-welcome-bubble 控制)
 *   2. 增加【生成报告】+【订阅速读】快捷操作按钮(PRD §3.1.1 汇报引导)
 *   3. 位置公式改为「机器人左上方」,跟随内联 left/top
 *   4. 三角指示器指向机器人 entry
 *   5. 文字间距/字号 与接入中心 welcome-bubble 视觉一致
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ThunderboltFilled,
  CloseOutlined,
  FileTextOutlined,
  BellOutlined,
  RightOutlined,
} from '@ant-design/icons';

const COMPACT_MAX = 280;
const EXPANDED_MAX = 460;

// ============ 指标聚合口径（来源：mock/ledger + 监控中心 + 评测中心） ============
// 平台管理员（信息科管理员）口径 → PRD §3.1.1
// 科室用户口径 → PRD §4.1.1：本科室视角
//   - 含：本月调用量 / 正常运行率（使用情况）
//   - 含：告警 / 故障 / 已恢复 / 评测中（运行风险 + 评测进度）
//   - 不含：待评测（科室端无该指标）、覆盖率（与本科室使用无关）
export interface StatusMetrics {
  totalAgents: number;
  monthNew: number;
  // 管理员：待评测 + 评测中；科室用户：仅评测中
  pendingEval: number;
  evaluating: number;
  alarmCount: number;
  faultCount: number;
  recoveredCount: number;
  // §4.1.1 科室用户专有（管理员默认 0,不展示）
  monthlyCallVolume: number;
  onlineRatePercent: number;
  // 范围标识
  scopeLabel: string;
}

export interface LedgerWelcomeAgent {
  id?: string;
  name: string;
  availableStatus: string;
  monthlyCalls: number;
  alarmCount: number;
  faultCount: number;
  abnormalConnections?: number;
  idCode?: string;
  version?: string;
  department?: string;
  diagnosisPhase?: string;
  description?: string;
  sourceType?: string;
  vendor?: string;
  techContact?: string;
  techContactPhone?: string;
  riskLevel?: string;
  runtimeStatus?: string;
  accessTime?: string;
  onlineTime?: string;
  accessType?: string;
  modelName?: string;
  resourceNames?: string[];
  evaluationScore?: number;
}

export const buildPlatformAdminMetrics = (): StatusMetrics => ({
  totalAgents: 30,
  monthNew: 6,
  pendingEval: 8,
  evaluating: 4,
  alarmCount: 12,
  faultCount: 3,
  recoveredCount: 7,
  monthlyCallVolume: 0,
  onlineRatePercent: 0,
  scopeLabel: '全院',
});

export const buildDeptAdminMetrics = (): StatusMetrics => ({
  totalAgents: 11,
  monthNew: 1,
  // §4.1.1 科室用户不展示「待评测」(无该口径)
  pendingEval: 0,
  evaluating: 1,
  alarmCount: 2,
  faultCount: 1,
  recoveredCount: 1,
  // §4.1.1 科室用户专有指标
  monthlyCallVolume: 38000,
  onlineRatePercent: 98.4,
  scopeLabel: '本科室',
});

// ============ 单条分流指标 ============
interface MetricChip {
  key: string;
  label: string;
  value: number | string;
  // 跳转 URL（params 形式）
  to: string;
  // 视觉色：默认蓝/橙/红
  tone: 'primary' | 'warning' | 'danger';
}

const MetricLink: React.FC<{ metric: MetricChip; onClick: (to: string) => void; showLabel?: boolean }> = ({
  metric,
  onClick,
  showLabel = true,
}) => {
  const palette = {
    primary: { color: '#1677FF', bg: 'rgba(22,119,255,0.08)' },
    warning: { color: '#FA8C16', bg: 'rgba(250,140,22,0.10)' },
    danger: { color: '#FF4D4F', bg: 'rgba(255,77,79,0.10)' },
  }[metric.tone];
  return (
    <span
      data-testid={`ledger-metric-${metric.key}`}
      onClick={() => onClick(metric.to)}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '1px 8px',
        margin: '0 2px',
        borderRadius: 4,
        background: palette.bg,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
        (e.currentTarget as HTMLElement).style.filter = 'brightness(0.95)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.textDecoration = 'none';
        (e.currentTarget as HTMLElement).style.filter = 'none';
      }}
      title={`点击进入「${metric.label}」列表`}
    >
      {showLabel && <span style={{ fontSize: 12, color: '#595959' }}>{metric.label}</span>}
      <strong style={{ fontSize: 13, color: palette.color, fontWeight: 600 }}>
        {metric.value}
      </strong>
    </span>
  );
};

const MetricTile: React.FC<{ metric: MetricChip; onClick: (to: string) => void; wide?: boolean }> = ({
  metric,
  onClick,
  wide,
}) => {
  const palette = {
    primary: { color: '#1677FF', bg: '#F0F7FF', border: '#BAE0FF' },
    warning: { color: '#FA8C16', bg: '#FFF7E6', border: '#FFD591' },
    danger: { color: '#FF4D4F', bg: '#FFF1F0', border: '#FFA39E' },
  }[metric.tone];
  return (
    <button
      type="button"
      data-testid={`ledger-metric-tile-${metric.key}`}
      onClick={() => onClick(metric.to)}
      title={`点击进入「${metric.label}」列表`}
      style={{
        gridColumn: wide ? '1 / -1' : undefined,
        minWidth: 0,
        border: `1px solid ${palette.border}`,
        borderRadius: 6,
        background: palette.bg,
        padding: '7px 8px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          display: 'block',
          color: '#595959',
          fontSize: 11,
          lineHeight: '16px',
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {metric.label}
      </span>
      <strong
        style={{
          display: 'block',
          color: palette.color,
          fontSize: 15,
          lineHeight: '20px',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {metric.value}
      </strong>
    </button>
  );
};

// ============ 主体气泡 ============
export interface StatusBubbleProps {
  metrics: StatusMetrics;
  pageKind?: 'overview' | 'list' | 'detail' | 'global';
  detailAgent?: LedgerWelcomeAgent;
  detailView?: 'profile' | 'detail';
  // 由调用方传入（机器人 icon 的 DOM ref），用于计算气泡定位
  anchorRef: React.RefObject<HTMLElement>;
  // 当锚点由拖拽移动时传入变化值，触发气泡重新计算位置
  anchorPositionKey?: string;
  // 关闭回调
  onClose: () => void;
  // 模式：'page' = 总览首页大卡片式气泡；'robot' = 机器人旁的紧凑式气泡
  variant?: 'page' | 'robot';
  // PRD §3.1.1:停留数秒后自动收起;默认 8 秒;hover 时暂停计时
  autoCollapseMs?: number;
  // V1.1：汇报引导钩子（生成报告 / 订阅速读），由父组件注入
  onGenerateReport?: () => void;
  onSubscribeBriefing?: () => void;
  // V1.1：唤起对话钩子
  onOpenChat?: () => void;
  // 详情页 360 画像气泡：切换到智能体信息详情页
  onViewDetail?: () => void;
}

export const StatusBubbleV31: React.FC<StatusBubbleProps> = ({
  metrics,
  pageKind = 'overview',
  detailAgent,
  detailView = 'profile',
  anchorRef,
  anchorPositionKey,
  onClose,
  variant = 'page',
  autoCollapseMs = 8000,
  onGenerateReport,
  onSubscribeBriefing,
  onOpenChat,
  onViewDetail,
}) => {
  const navigate = useNavigate();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(false);

  // PRD §3.1.1:停留数秒后自动收起,hover 时暂停,离开后继续倒计时
  // (V1.2 去掉顶部进度条 UI 后,内部不再 setState,直接用 setTimeout)
  useEffect(() => {
    if (paused) return;
    const tick = window.setTimeout(onClose, autoCollapseMs);
    return () => window.clearTimeout(tick);
  }, [paused, onClose, autoCollapseMs]);

  // 跟随 anchor 定位: 气泡在机器人**左上角**(右下角对齐机器人左上角)
  //   - 与接入中心 AgentAssistant 的 getRobotBubblePlacement 公式保持一致
  //   - 水平:bubble.right = robot.left - gap(气泡在机器人左侧)
  //   - 垂直:bubble.bottom = robot.top - gap(气泡底部对齐机器人顶部)
  //   - 视口夹紧避免超出
  useEffect(() => {
    const compute = () => {
      if (!anchorRef.current || !bubbleRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const bubbleW = bubbleRef.current.offsetWidth || 360;
      const bubbleH = bubbleRef.current.offsetHeight || 220;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 12; // bubble 右/下边到 robot 左/上边的距离
      const margin = 8;
      const width = Math.min(bubbleW, vw - margin * 2);
      const desiredLeft = rect.left - gap - width;
      const desiredTop = rect.top - gap - bubbleH;
      const left = Math.max(margin, Math.min(desiredLeft, vw - width - margin));
      const top = Math.max(margin, Math.min(desiredTop, vh - bubbleH - margin));
      setPos({ left, top });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef, pageKind, anchorPositionKey]);

  const handleMetricClick = (to: string) => {
    onClose();
    navigate(to);
  };

  // 路由映射：管理员口径走全院路由,科室用户走本科室(由 store / user.department 过滤)
  const isDept = metrics.scopeLabel !== '全院';
  const isDetail = pageKind === 'detail';
  const activeDetailAgent: LedgerWelcomeAgent = detailAgent || {
    name: '当前智能体',
    availableStatus: '未知',
    monthlyCalls: 0,
    alarmCount: metrics.alarmCount,
    faultCount: metrics.faultCount,
  };

  const allMetric: MetricChip = {
    key: 'all',
    label: isDept ? '本科室智能体' : '全院智能体',
    value: `${metrics.totalAgents} 个`,
    to: '/app/ledger/list',
    tone: 'primary',
  };
  const monthNewMetric: MetricChip = {
    key: 'monthNew',
    label: '本月新增',
    value: `${metrics.monthNew} 个`,
    to: '/app/ledger/list?accessMonth=' + new Date().toISOString().slice(0, 7),
    tone: 'primary',
  };
  // §4.1.1 科室用户:无「待评测」指标
  const pendingEval: MetricChip | null = isDept
    ? null
    : {
        key: 'pendingEval',
        label: '待评测',
        value: `${metrics.pendingEval} 个`,
        to: '/app/evaluation/tasks?tab=pending_eval',
        tone: 'warning',
      };
  const evaluating: MetricChip = {
    key: 'evaluating',
    label: '评测中',
    value: `${metrics.evaluating} 个`,
    to: '/app/evaluation/tasks?tab=evaluating',
    tone: 'warning',
  };
  const alarm: MetricChip = {
    key: 'alarm',
    label: '告警',
    value: `${metrics.alarmCount} 次`,
    to: '/app/monitoring/alert-events?tab=pending_handle',
    tone: 'danger',
  };
  const fault: MetricChip = {
    key: 'fault',
    label: '故障',
    value: `${metrics.faultCount} 次`,
    to: '/app/monitoring/alert-events?tab=fault',
    tone: 'danger',
  };
  const recovered: MetricChip = {
    key: 'recovered',
    label: '已恢复',
    value: `${metrics.recoveredCount} 次`,
    to: '/app/monitoring/alert-events?tab=recovered',
    tone: 'primary',
  };
  // §4.1.1 科室用户专有:本月调用量 + 正常运行率
  const monthlyCallMetric: MetricChip | null = isDept
    ? {
        key: 'monthlyCall',
        label: '本月调用量',
        value: metrics.monthlyCallVolume.toLocaleString(),
        to: '/app/monitoring/business?preset=callVolume&range=monthly',
        tone: 'primary',
      }
    : null;
  const onlineRateMetric: MetricChip | null = isDept
    ? {
        key: 'onlineRate',
        label: '正常运行率',
        value: `${metrics.onlineRatePercent.toFixed(1)}%`,
        to: '/app/monitoring/business?preset=onlineRate&range=monthly',
        tone: 'primary',
      }
    : null;

  // V1.1：是否包含报告/订阅/对话引导（决定气泡是否膨胀到 EXPANDED_MAX）
  const hasRichContent = isDetail || !!onGenerateReport || !!onSubscribeBriefing || !!onOpenChat;
  const maxHeight = hasRichContent ? EXPANDED_MAX : COMPACT_MAX;

  return (
    <div
      data-testid="ledger-status-bubble"
      ref={bubbleRef}
      onMouseEnter={() => {
        setHovered(true);
        setPaused(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setPaused(false);
      }}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 1100,
        width: isDetail ? 360 : 392,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight,
        background: '#FFFFFF',
        borderRadius: 12,
        boxShadow: hovered
          ? '0 12px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(22,119,255,0.18)'
          : '0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(22,119,255,0.10)',
        padding: '12px 14px 14px',
        fontSize: 12,
        lineHeight: 1.5,
        color: '#262626',
        transition: 'box-shadow 0.2s',
        overflow: 'hidden',
        // V1.1：贴内容 + flex 列布局,内层 minHeight:0 + overflowY:auto 允许滚动
        display: 'flex',
        flexDirection: 'column',
        animation: 'agent-welcome-pop 280ms ease-out',
      }}
    >
      {/* 头部：标题 + 关闭按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ThunderboltFilled style={{ color: '#1677FF', fontSize: 13 }} />
          <strong style={{ fontSize: 13, color: '#1677FF' }}>医小管</strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: 'transparent',
            border: 'none',
            color: '#8C8C8C',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <CloseOutlined style={{ fontSize: 10 }} />
        </button>
      </div>

      {/* 中段(允许滚动) — V1.1:贴内容,不强制 flex:1 撑高 */}
      <div
        data-testid="ledger-status-bubble-content"
        style={{
          // 仅当内容溢出时滚动,平时贴内容
          overflowY: 'auto',
        }}
      >
        {isDetail ? (
          <>
            <div style={{ fontSize: 12, color: '#262626', marginBottom: 6 }}>
              您好，我是医小管。当前为您展示
              <strong>【{activeDetailAgent.name}】</strong>
              的{detailView === 'profile' ? '360画像' : '信息详情'}，有什么该智能体相关问题可以直接问我~
            </div>
          </>
        ) : (
          <>
        <div style={{ fontSize: 12, color: '#262626', marginBottom: 8 }}>
          <div style={{ lineHeight: '20px', marginBottom: 8 }}>
            你好，我是医小管！这是{isDept ? '本科室智能体今日使用速览' : '今日全院智能体台账速览'}。
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 6,
              marginBottom: 8,
            }}
          >
            <MetricTile metric={allMetric} onClick={handleMetricClick} />
            <MetricTile metric={monthNewMetric} onClick={handleMetricClick} />
            {!isDept && pendingEval && <MetricTile metric={pendingEval} onClick={handleMetricClick} />}
            <MetricTile metric={evaluating} onClick={handleMetricClick} />
            {isDept && monthlyCallMetric && <MetricTile metric={monthlyCallMetric} onClick={handleMetricClick} wide />}
            {isDept && onlineRateMetric && <MetricTile metric={onlineRateMetric} onClick={handleMetricClick} />}
            <MetricTile metric={alarm} onClick={handleMetricClick} />
            <MetricTile metric={fault} onClick={handleMetricClick} />
            <MetricTile metric={recovered} onClick={handleMetricClick} />
          </div>
          <div
            style={{
              lineHeight: '20px',
              color: '#595959',
              background: '#FAFAFA',
              border: '1px solid #F0F0F0',
              borderRadius: 6,
              padding: '6px 8px',
            }}
          >
            建议优先处理告警与故障。需要的话，我可以帮你生成管理报告或订阅台账速读。
          </div>
        </div>

        {/* V1.1：汇报引导(PRD §3.1.1 / §3.3.1) */}
        {(onGenerateReport || onSubscribeBriefing) && (
          <div
            style={{
              marginTop: 6,
              padding: '6px 8px',
              background: 'linear-gradient(90deg,#F0F8FF 0%,#E6F4FF 100%)',
              border: '1px solid #91CAFF',
              borderRadius: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {onGenerateReport && (
                <button
                  type="button"
                  data-testid="ledger-bubble-generate-report"
                  onClick={() => {
                    onGenerateReport();
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '4px 8px',
                    background: '#1677FF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <FileTextOutlined style={{ fontSize: 11 }} />
                  生成报告
                </button>
              )}
              {onSubscribeBriefing && (
                <button
                  type="button"
                  data-testid="ledger-bubble-subscribe"
                  onClick={() => {
                    onSubscribeBriefing();
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '4px 8px',
                    background: '#fff',
                    color: '#1677FF',
                    border: '1px solid #91CAFF',
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <BellOutlined style={{ fontSize: 11 }} />
                  订阅速读
                </button>
              )}
            </div>
          </div>
        )}

          </>
        )}
      </div>
    </div>
  );
};

export default StatusBubbleV31;
