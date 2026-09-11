/**
 * 统一台账中心 - 智能化升级(全站 Agent 浮窗宿主)
 * §3.1.1 + §3.1.2 + §3.2.2 + §3.3 全局 Agent 浮窗宿主组件
 * (视觉与接入中心 AgentAssistant 完全统一)
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.1：
 *   - §3.1.1 进入首页(台账总览 / 台账列表)时,智能助手以**非打断气泡**主动汇报关键态势
 *   - §3.1.2 点击机器人 / 气泡唤起 Agent 对话窗口,顶部同步态势 + 自然语言问答 + 推荐问句
 *   - §3.2.2 智能体详情页(360 画像) — 详情页欢迎语「这是【智能体名称】的 360 画像…」
 *   - §3.3 报告页(总览/科室应用成效) — 报告编辑页专用对话窗口,聚焦报告相关问答
 *   - 关键指标名称加粗可点击分流(无卡片)
 *   - 气泡停留数秒后收起、可手动关闭
 *   - 信息科管理员:全院数据;科室用户:本科室数据
 *
 * 设计:
 *   - **机器人形象 100% 复用接入中心**:AgentRobotIcon(mood / size / badge / badgePulse / handWave)
 *   - **动画 100% 对齐接入中心**:hover 上浮、mood 表情变化、bounce 新消息吸引
 *   - **对话面板 100% 对齐接入中心**:ChatPanelV31 视觉与样式一致
 *   - **位置策略**:固定右下角 24px(PRD 未要求可拖动,保持稳定体验)
 *   - **触发路径**:
 *     /app/ledger        (总览)   — §3.1.1 全院态势汇报气泡
 *     /app/ledger/list   (列表)   — §3.1.1 全院态势汇报气泡
 *     /app/ledger/detail/:id  — §3.2.2 智能体 360 画像欢迎语
 *     /app/ledger-demo/*      — Demo(原行为)
 *   - **与接入中心 AgentAssistant 并存**:两 Agent 视觉一致,功能不同(台账 Agent 专责态势汇报与台账问答)
 *
 * V1.1 升级要点(2026-07-03):
 *   - StatusBubbleV31 / ChatPanelV31 接入报告/订阅/对话 三个回调钩子
 *   - AgentFloatHost 内部把 navigate('/app/ledger-demo/report') 注入钩子
 *   - showRobot 路径增加 /app/ledger-demo/, robot 默认显示
 *   - bubbleTriggerPath 扩展到详情页/Demo(详情页有专属欢迎语)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// PRD §3.1.1/§4.1.1: 态势汇报由首次进入页面时的非打断气泡承担,
//   关闭后不再在右下角浮「重看态势汇报」按钮(避免和机器人 icon 重复);
//   用户可点机器人再次唤起对话窗口
import StatusBubbleV31, {
  buildPlatformAdminMetrics,
  buildDeptAdminMetrics,
  type StatusMetrics,
  type LedgerWelcomeAgent,
} from '../../pages/ledger/demo/StatusBubbleV31';
import ChatPanelV31 from '../../pages/ledger/demo/ChatPanelV31';
import AgentRobotIcon from '../../pages/agent-center/smart/AgentRobotIcon';
import type { AgentMood } from '../../pages/agent-center/smart/types';
import { useDemoSettings } from '../../hooks/useDemoSettings';
import { ledgerAgents } from '../../mock/ledger';

// ============ 路由判定:哪些路径需要弹气泡欢迎语 ============
// PRD §3.1.1:进入首页(台账总览) / 列表(台账列表)时,Agent 主动弹气泡
//   - 总览首页: /app/ledger(精确)
//   - 列表页:   /app/ledger/list(精确 + 带 query 的形式,如 ?accessMonth=...)
//   - 详情页:   /app/ledger/detail/:id(走详情页欢迎语"360 画像")
//   - Demo:     /app/ledger-demo/list
//   - 其他页面: 仅显示机器人 icon,不弹气泡
const isBubbleTriggerPath = (pathname: string): boolean => {
  if (pathname === '/app/ledger') return true;
  if (pathname === '/app/ledger/list') return true;
  if (pathname.startsWith('/app/ledger/list?')) return true;
  if (/^\/app\/ledger\/detail\/[^/]+/.test(pathname)) return true;
  return false;
};

// 详情页走专属欢迎语(§3.2.2 智能体 360 画像)
const isDetailPath = (pathname: string): boolean =>
  /^\/app\/ledger\/detail\/[^/]+/.test(pathname);

const getDetailId = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/app\/ledger\/detail\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
};

// 报告页(避免在报告编辑页重复弹态势汇报气泡)
const isReportPath = (pathname: string): boolean =>
  pathname.startsWith('/app/ledger-demo/report');

// ============ 接入中心 AgentAssistant 的位置记忆 key(进入台账页面时清掉,避免拖动后残留到中部) ============
const AGENT_CENTER_ASSISTANT_POS_KEY = 'agent_assistant_pos_v1';
const LEDGER_ROBOT_POS_KEY = 'ledger_agent_robot_pos_v1';
const ROBOT_SIZE = 64;
const ROBOT_MARGIN = 24;

type FloatPos = { left: number; top: number };

const getDefaultRobotPos = (): FloatPos => ({
  left: Math.max(ROBOT_MARGIN, window.innerWidth - ROBOT_SIZE - ROBOT_MARGIN),
  top: Math.max(ROBOT_MARGIN, window.innerHeight - ROBOT_SIZE - ROBOT_MARGIN),
});

const clampRobotPos = (pos: FloatPos): FloatPos => ({
  left: Math.min(
    Math.max(ROBOT_MARGIN, pos.left),
    Math.max(ROBOT_MARGIN, window.innerWidth - ROBOT_SIZE - ROBOT_MARGIN),
  ),
  top: Math.min(
    Math.max(ROBOT_MARGIN, pos.top),
    Math.max(ROBOT_MARGIN, window.innerHeight - ROBOT_SIZE - ROBOT_MARGIN),
  ),
});

const loadRobotPos = (): FloatPos | null => {
  try {
    const raw = localStorage.getItem(LEDGER_ROBOT_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') {
      return clampRobotPos(parsed);
    }
  } catch {
    // ignore
  }
  return null;
};

const saveRobotPos = (pos: FloatPos) => {
  try {
    localStorage.setItem(LEDGER_ROBOT_POS_KEY, JSON.stringify(clampRobotPos(pos)));
  } catch {
    // ignore
  }
};

// ============ 组件 ============
export const AgentFloatHost: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { demoRole } = useDemoSettings();

  // 角色映射:demoRole('信息科管理员' | '科室管理员') → scope
  const scope: 'platform_admin' | 'dept_admin' = useMemo(() => {
    return demoRole === '信息科管理员' ? 'platform_admin' : 'dept_admin';
  }, [demoRole]);

  // 指标(管理员 vs 科室用户)
  const metrics: StatusMetrics = useMemo(
    () => (scope === 'platform_admin' ? buildPlatformAdminMetrics() : buildDeptAdminMetrics()),
    [scope],
  );

  const pageKind: 'overview' | 'list' | 'detail' | 'global' = useMemo(() => {
    if (isDetailPath(location.pathname)) return 'detail';
    if (location.pathname === '/app/ledger/list') return 'list';
    if (location.pathname === '/app/ledger') return 'overview';
    return 'global';
  }, [location.pathname]);

  const detailAgent: LedgerWelcomeAgent | undefined = useMemo(() => {
    const id = getDetailId(location.pathname);
    if (!id) return undefined;
    const agent = ledgerAgents.find((item) => item.id === id || item.idCode === id);
    if (!agent) return undefined;
    const faultCount =
      agent.runtimeStatus === '异常' || agent.runtimeStatus === '离线' ? 1 : 0;
    const alarmCount = agent.alarmCount?.daily ?? agent.alarmCount?.monthly ?? agent.alarmCount?.total ?? 0;
    const abnormalConnections =
      agent.linkedResources?.filter((item) => item.linkStatus === 'abnormal').length ?? 0;
    const availableStatus =
      agent.runtimeStatus === '在线'
        ? faultCount > 0
          ? '受故障影响'
          : '可用'
        : agent.runtimeStatus || '未上线';
    return {
      id: agent.id,
      name: agent.name,
      availableStatus,
      monthlyCalls: agent.callVolume?.monthly ?? 0,
      alarmCount,
      faultCount,
      abnormalConnections,
      idCode: agent.idCode,
      version: agent.version,
      department: agent.department,
      diagnosisPhase: agent.diagnosisPhase.join(' / '),
      description: agent.description,
      sourceType: agent.sourceType,
      vendor: agent.vendor,
      techContact: agent.techContact,
      techContactPhone: agent.techContactPhone,
      riskLevel: agent.riskLevel,
      runtimeStatus: agent.runtimeStatus,
      accessTime: agent.accessTime,
      onlineTime: agent.onlineTime,
      accessType: agent.accessType,
      modelName: agent.modelName,
      resourceNames: agent.linkedResources.map((item) => item.name),
      evaluationScore: agent.evaluationReport?.totalScore,
    };
  }, [location.pathname]);

  // 接入中心 AgentAssistant 同款动画状态
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false); // 对话浮层开关(对齐 AgentAssistant)
  const [bubbleOpen, setBubbleOpen] = useState(false); // 态势汇报气泡开关
  const [detailView, setDetailView] = useState<'profile' | 'detail'>('profile');
  const [mood, setMood] = useState<AgentMood>('idle');
  // badgePulse: 新消息时 600ms 内播放红点放大闪烁 + bounce;手 wave
  const [badgePulse, setBadgePulse] = useState(false);
  const sitUntilRef = useRef(0); // 收起对话后 0.7s 内播放挫手→坐下→回站
  const [bouncing, setBouncing] = useState(false);
  const [robotPos, setRobotPos] = useState<FloatPos>(() => loadRobotPos() || getDefaultRobotPos());
  const [draggingRobot, setDraggingRobot] = useState(false);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  const robotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDetailView('profile');
  }, [location.pathname]);

  useEffect(() => {
    const handleDetailViewChange = (event: Event) => {
      const detail = (event as CustomEvent<{ agentId?: string; view?: 'profile' | 'detail' }>).detail;
      if (detail?.agentId && detailAgent?.id && detail.agentId !== detailAgent.id) return;
      if (detail?.view) setDetailView(detail.view);
    };
    window.addEventListener('ledger-detail-view-change', handleDetailViewChange);
    return () => window.removeEventListener('ledger-detail-view-change', handleDetailViewChange);
  }, [detailAgent?.id]);

  // V1.1：报告生成 / 订阅速读 钩子(由 useNavigate 注入)
  const handleGenerateReport = () => {
    navigate('/app/ledger-demo/report');
  };
  const handleSubscribeBriefing = () => {
    // V2：跳台账总览页 + 触发抽屉打开(由 index.tsx 监听 ?openSubscribe=1)
    navigate('/app/ledger?openSubscribe=1');
  };
  const handleViewDetail = () => {
    window.dispatchEvent(
      new CustomEvent('ledger-view-detail', {
        detail: { agentId: detailAgent?.id },
      }),
    );
  };

  const enableReportActions = pageKind !== 'detail';

  // 进入台账页面时,重置接入中心 AgentAssistant 的 sessionStorage 位置
  //   —— 因为 AgentAssistant 是全站挂载,如果不重置,用户之前拖到的中部位置
  //   会跟着进入台账页面,造成中部出现一个机器人遮挡表格
  //   同时清掉 V1.0 老版"全局 dismiss 标记"(per-page 化后已废弃),避免旧浏览器残留
  useEffect(() => {
    if (isBubbleTriggerPath(location.pathname) || isReportPath(location.pathname)) {
      try {
        sessionStorage.removeItem(AGENT_CENTER_ASSISTANT_POS_KEY);
        // 旧 V1.0 全局 key — V1.1 起改用内存态,清掉防止旧用户被永久屏蔽
        sessionStorage.removeItem('agent_float_bubble_dismissed_v1');
        sessionStorage.removeItem('agent_float_bubble_dismissed_v1::/app/ledger');
        sessionStorage.removeItem('agent_float_bubble_dismissed_v1::/app/ledger/list');
      } catch {
        // ignore
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      setRobotPos((pos) => {
        const next = clampRobotPos(pos);
        saveRobotPos(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = event.clientX - start.mouseX;
      const dy = event.clientY - start.mouseY;
      if (!dragMovedRef.current && Math.hypot(dx, dy) < 3) return;
      dragMovedRef.current = true;
      setDraggingRobot(true);
      setRobotPos(clampRobotPos({ left: start.posX + dx, top: start.posY + dy }));
    };

    const onMouseUp = () => {
      if (!dragStartRef.current) return;
      dragStartRef.current = null;
      setDraggingRobot(false);
      setRobotPos((pos) => {
        const next = clampRobotPos(pos);
        if (dragMovedRef.current) saveRobotPos(next);
        return next;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    setRobotPos((pos) => clampRobotPos(pos));
  }, [location.pathname]);

  // 内存态 dismiss 跟踪 — 用 ref 避免重渲染,且不被 sessionStorage 持久化
  //   - 用户在当前页面手动关闭气泡后,本次停留内不再弹
  //   - 离开页面(切走/刷新)后 ref 被丢弃,下次进入会重新弹(符合 PRD §3.1.1)
  //   - 路径变化(切台账页)时,先清空 ref 再 setBubbleOpen,确保新页面也弹
  const dismissedRef = useRef(false);
  useEffect(() => {
    // 路径变化:重置 dismiss 标记 + 重新评估是否弹气泡
    dismissedRef.current = false;
    // 报告编辑页不弹态势汇报气泡(避免遮挡编辑)
    if (isReportPath(location.pathname)) {
      setBubbleOpen(false);
      return;
    }
    if (!isBubbleTriggerPath(location.pathname)) {
      setBubbleOpen(false);
      return;
    }
    setBubbleOpen(true);
    // 进入时短暂 happy 表情 + bounce 动画(对齐接入中心新消息吸引)
    setMood('happy');
    setBadgePulse(true);
    setBouncing(true);
    setTimeout(() => setMood('idle'), 700);
    setTimeout(() => setBadgePulse(false), 700);
    setTimeout(() => setBouncing(false), 1200);
  }, [location.pathname]);

  // 手动关闭气泡:dismiss 仅本次停留(离开页面后失效)
  const handleCloseBubble = () => {
    setBubbleOpen(false);
    dismissedRef.current = true;
  };

  const handleRobotMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      posX: robotPos.left,
      posY: robotPos.top,
    };
    dragMovedRef.current = false;
  };

  // 点击机器人 → 关闭气泡 + 唤起对话窗口 + happy 表情
  const handleRobotClick = (event?: React.MouseEvent<HTMLDivElement>) => {
    if (dragMovedRef.current) {
      event?.preventDefault();
      event?.stopPropagation();
      dragMovedRef.current = false;
      return;
    }
    setBubbleOpen(false);
    dismissedRef.current = true;
    setOpen(true);
    setMood('happy');
    setTimeout(() => setMood('idle'), 700);
  };

  // 关闭对话窗口 → 播放挫手→坐下→回站 过渡(对齐接入中心)
  const handleChatClose = () => {
    setOpen(false);
    sitUntilRef.current = Date.now() + 700;
  };

  // 是否在台账相关页面(决定机器人是否显示)
  const showRobot = useMemo(() => {
    const path = location.pathname;
    return path === '/app/ledger' || path.startsWith('/app/ledger/');
  }, [location.pathname]);

  // 未读数(模拟:告警 + 故障)
  const unreadCount = metrics.alarmCount + metrics.faultCount;
  // 接入中心规则:hover && !open → mood = 'hover'
  const effectiveMood: AgentMood = hover && !open ? 'hover' : mood;
  // 接入中心 sit 动画:收起对话后 0.7s 内显示
  const sitting = sitUntilRef.current > Date.now();

  // bounce 动画类名(对齐接入中心 .agent-robot-bounce)
  const animClass = bouncing && !open ? 'agent-robot-bounce' : sitting ? 'agent-robot-sit' : undefined;

  if (!showRobot) return null;

  return (
    <>
      {/* ===== 右下角浮动机器人 icon(完全复用接入中心 AgentRobotIcon) ===== */}
      <div
        ref={robotRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseDown={handleRobotMouseDown}
        onClick={handleRobotClick}
        // §3.1.1 动画类名:
        //   - bounce: 新消息来时 整体上下跳
        //   - sit: 收起对话后 0.7s 内播放挫手→坐下→回站
        //   - 与 hover transform 互斥 (bounce 优先于 hover)
        className={animClass}
        aria-label="唤起医小管(台账助手)"
        role="button"
        style={{
          position: 'fixed',
          left: robotPos.left,
          top: robotPos.top,
          width: ROBOT_SIZE,
          height: ROBOT_SIZE,
          cursor: draggingRobot ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: 1050,
          // 接入中心规范:transform hover 时 translateY(-4px) scale(1.05)
          opacity: draggingRobot ? 0.75 : 1,
          transition: draggingRobot ? 'none' : 'transform 200ms ease-out, opacity 150ms ease-out',
          transform:
            hover && !bouncing && !sitting && !draggingRobot
              ? 'translateY(-4px) scale(1.05)'
              : 'translateY(0) scale(1)',
        }}
      >
        <AgentRobotIcon
          mood={effectiveMood}
          size={64}
          badge={unreadCount > 0 ? unreadCount : false}
          // 新消息吸引动画
          badgePulse={badgePulse}
          handWave={badgePulse}
        />
        {/* hover 时显示 hover 浮窗(对齐接入中心样式) */}
        {hover && !open && (
          <div
            style={{
              position: 'absolute',
              right: 80,
              top: 12,
              background: '#1F1F1F',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
            }}
          >
            医小管 · 台账助手
          </div>
        )}
      </div>

      {/* ===== 气泡欢迎语(进入台账总览/列表/详情时弹出) ===== */}
      {bubbleOpen && !open && (
        <StatusBubbleV31
          metrics={metrics}
          pageKind={pageKind}
          detailAgent={detailAgent}
          detailView={detailView}
          anchorRef={robotRef}
          anchorPositionKey={`${Math.round(robotPos.left)}:${Math.round(robotPos.top)}:${draggingRobot ? 1 : 0}`}
          onClose={handleCloseBubble}
          variant="robot"
          onGenerateReport={enableReportActions ? handleGenerateReport : undefined}
          onSubscribeBriefing={enableReportActions ? handleSubscribeBriefing : undefined}
          onOpenChat={handleRobotClick}
          onViewDetail={pageKind === 'detail' ? handleViewDetail : undefined}
        />
      )}

      {/* ===== 对话浮层(点击机器人 / 气泡唤起) ===== */}
      {open && (
        <ChatPanelV31
          scope={scope}
          pageKind={pageKind}
          detailAgent={detailAgent}
          detailView={detailView}
          onClose={handleChatClose}
          onGenerateReport={enableReportActions ? handleGenerateReport : undefined}
          onSubscribeBriefing={enableReportActions ? handleSubscribeBriefing : undefined}
          onViewDetail={pageKind === 'detail' ? handleViewDetail : undefined}
        />
      )}
    </>
  );
};

export default AgentFloatHost;
