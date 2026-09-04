/**
 * 360 画像视图 — 关联资源拓扑地图 (V2.8 多级辐射版)
 *
 * 设计要点:
 *  1. 智能体居中,向外辐射 3-5 层环形拓扑(ring=1..4)
 *  2. 每条连线分两层:
 *      - 底层实线(底色,静态)
 *      - 上层 stroke-dasharray 虚线 + topo-line-flow* 动画 → "电流"流动效果
 *  3. 中心使用 AgentRobotIcon(V5 萌系 + 科技点睛)作为主角,3 圈错相脉冲雷达波纹
 *  4. 节点卡片用 HTML div 渲染,可显示子类型徽标 + 状态 + 联系方式
 *  5. 异常节点:连线变红 + 反向电流 + 节点红光闪烁 + 右上角红色 !
 *  6. 装饰环:实线 + 虚线交错,最外层 SMIL <animateTransform> 缓慢旋转
 *
 * 依赖:
 *  - AgentRobotIcon(萌系机器人,V5) - src/pages/agent-center/smart/AgentRobotIcon.tsx
 *  - topoTheme - 本目录配色常量
 *  - multiRingLayout - 本目录布局算法
 *  - global.css topo-flow-* / topo-pulse-ring / topo-core-breathe keyframes
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Empty } from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import AgentRobotIcon from '../../agent-center/smart/AgentRobotIcon';
import type { LedgerAgent, LinkedResource } from '../../../mock/ledger';
import { TOPO_THEME, TOPO_SUBTYPE_BADGE } from './topoTheme';
import { multiRingLayout, type RingPosition } from './multiRingLayout';

interface MultiRingTopologyProps {
  agent: LedgerAgent;
  onResourceDrill: (resource: LinkedResource) => void;
  /** 视口尺寸(viewBox),默认 760×540 */
  width?: number;
  height?: number;
}

// 装饰环数量,等于布局 ring 数组长度。
const RING_COUNT = 4;
// 收窄 RingLevel 至 LinkedResource.ring 允许范围 (1..4)
type AllowedRing = 1 | 2 | 3 | 4;
// V2.9:缩小节点卡片,加大环间距,避免 ~18 个节点遮挡
const TOPO_NODE_MAX_W = 96;
const TOPO_NODE_MAX_H = 38;

const NODE_KIND_LABEL: Record<NonNullable<LinkedResource['nodeKind']>, string> = {
  domain: '业务域',
  system: '院内系统',
  platform: '平台',
  interface: '接口',
  data: '数据',
};

export const MultiRingTopology: React.FC<MultiRingTopologyProps> = ({
  agent,
  onResourceDrill,
  width: preferredWidth = 760,
  height: preferredHeight = 540,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const width = Math.max(520, Math.round(measured.width || preferredWidth));
  const height = Math.max(320, Math.round(measured.height || preferredHeight));
  const scale = clamp(Math.min(width / 760, height / 540), 0.72, 1.12);
  // V2.9:节点基线 78×34,scale 区间收紧(64~96, 28~38),更紧凑的卡片
  const nodeW = Math.round(clamp(78 * scale, 64, TOPO_NODE_MAX_W));
  const nodeH = Math.round(clamp(34 * scale, 28, TOPO_NODE_MAX_H));
  const rings = useMemo(() => {
    // V2.9:加大 4 层环的半径,使 ~18 个节点均匀分布不遮挡
    //   之前 outer=142~220,现在 baseline 180~260
    const usableY = Math.max(180, height - 110);
    const usableX = Math.max(320, width - 160);
    const outer = Math.max(180, Math.min(260, usableY / 2, usableX / (2 * 1.18)));
    // 4 层环间隔均匀:outer*0.45 / 0.65 / 0.83 / 1.0
    return [outer * 0.45, outer * 0.65, outer * 0.83, outer] as const;
  }, [width, height]);
  const cx = width / 2;
  const cy = height / 2;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setMeasured((prev) => {
          const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
          return prev.width === next.width && prev.height === next.height ? prev : next;
        });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 资源归一化:补齐 ring/subType/linkStatus 默认值
  const resources = useMemo<LinkedResource[]>(
    () => agent.linkedResources ?? [],
    [agent.linkedResources],
  );

  // 计算布局坐标
  const positions = useMemo<RingPosition<LinkedResource>[]>(() => {
    const items = resources.map((r, i): LinkedResource & { ring: AllowedRing } => {
      const fallback = (((i % RING_COUNT) + 1) as AllowedRing);
      return { ...r, ring: (r.ring ?? fallback) as AllowedRing };
    });
    return multiRingLayout<LinkedResource & { ring: AllowedRing }>(items, {
      cx,
      cy,
      rings,
      xScale: 1.18,
      nodeSize: { width: nodeW, height: nodeH },
      // V2.9:加大节点间距,减少 ~18 节点碰撞概率
      nodeGap: Math.round(28 * scale),
      collisionIterations: 60,
      bounds: {
        minX: nodeW / 2 + 8,
        maxX: width - nodeW / 2 - 8,
        minY: 50,
        maxY: height - nodeH / 2 - 8,
      },
      ringStartAngles: [
        -Math.PI / 2,
        -Math.PI / 2 + 0.18,
        -Math.PI / 2 - 0.15,
        -Math.PI / 2 + 0.3,
      ],
    });
  }, [resources, cx, cy, height, nodeH, nodeW, rings, scale, width]);

  const positionMap = useMemo(() => new Map(positions.map((p) => [p.node.id, p])), [positions]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '100%',
        flex: 1,
        minHeight: 0,
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${TOPO_THEME.panelBorder}`,
        borderRadius: 8,
        background: TOPO_THEME.panelBg,
        overflow: 'hidden',
      }}
    >
      {/* 标题栏(浮在 SVG 之上) */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 14,
          right: 14,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, whiteSpace: 'nowrap' }}>
          <NodeIndexOutlined style={{ color: TOPO_THEME.normal, flex: '0 0 auto' }} />
          <span style={{ color: '#effbff', fontWeight: 600, flex: '0 0 auto' }}>关联资源拓扑地图</span>
          <span
            title={agent.name}
            style={{
              color: 'rgba(205,231,255,0.62)',
              fontSize: 11,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            · {agent.name}
          </span>
        </div>
      </div>

      {resources.length === 0 ? (
        <div style={{ paddingTop: 130 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: 'rgba(232,247,255,0.72)' }}>尚未对接院内资源</span>
            }
          />
        </div>
      ) : (
        <>
          {/* ===== SVG 装饰层 + 连线 + 中心核心 ===== */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
              position: 'relative',
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block' }}
            >
              <defs>
                {/* 全局辉光滤镜 */}
                <filter id="topo-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* 中心核心径向渐变 */}
                <radialGradient id="topo-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={TOPO_THEME.coreInner} stopOpacity={1} />
                  <stop offset="100%" stopColor={TOPO_THEME.coreOuter} stopOpacity={0.72} />
                </radialGradient>
                {/* 中心柔光晕 */}
                <radialGradient id="topo-halo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={TOPO_THEME.normal} stopOpacity={0.45} />
                  <stop offset="70%" stopColor={TOPO_THEME.normal} stopOpacity={0.06} />
                  <stop offset="100%" stopColor={TOPO_THEME.normal} stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* === 装饰环(交错实线 / 虚线,半径略大于节点半径) === */}
              {TOPO_THEME.decorationRadii.map((r, i) => {
                const isSolid = i % 2 === 0;
                return (
                  <ellipse
                    key={`ring-${i}`}
                    cx={cx}
                    cy={cy}
                    rx={r * 1.18}
                    ry={r}
                    fill="none"
                    stroke={isSolid ? TOPO_THEME.ringSolid : TOPO_THEME.ringDashed}
                    strokeWidth={1}
                    strokeDasharray={isSolid ? '0' : '6 8'}
                    opacity={0.9}
                  />
                );
              })}

              {/* 最外圈缓慢旋转 — 制造雷达扫描感 */}
              <ellipse
                cx={cx}
                cy={cy}
                rx={TOPO_THEME.decorationRadii[TOPO_THEME.decorationRadii.length - 1] * 1.18}
                ry={TOPO_THEME.decorationRadii[TOPO_THEME.decorationRadii.length - 1]}
                fill="none"
                stroke={TOPO_THEME.normal}
                strokeWidth={0.8}
                strokeDasharray="2 10"
                opacity={0.55}
              >
                <animateTransform
                  attributeName="transform"
                  attributeType="XML"
                  type="rotate"
                  from={`0 ${cx} ${cy}`}
                  to={`360 ${cx} ${cy}`}
                  dur="48s"
                  repeatCount="indefinite"
                />
              </ellipse>

              {/* 网格点状背景层(只覆盖内环区域,营造"画布"感) */}
              <g opacity={0.18}>
                {Array.from({ length: 6 }).map((_, row) =>
                  Array.from({ length: 12 }).map((_, col) => {
                    const x = 60 + col * 56;
                    const y = 80 + row * 80;
                    const dist = Math.hypot(x - cx, y - cy);
                    if (
                      dist < 60 ||
                      dist > TOPO_THEME.decorationRadii[TOPO_THEME.decorationRadii.length - 1] + 20
                    ) {
                      return null;
                    }
                    return (
                      <circle
                        key={`g-${row}-${col}`}
                        cx={x}
                        cy={y}
                        r={0.9}
                        fill={TOPO_THEME.normal}
                      />
                    );
                  }),
                )}
              </g>

              {/* 中心柔光晕 */}
              <circle cx={cx} cy={cy} r={92} fill="url(#topo-halo)" />

              {/* 分层说明(右下角),帮助用户读出从中心智能体向外扩展的关系语义 */}
              {[
                { r: rings[0], text: 'L1 业务域' },
                { r: rings[1], text: 'L2 系统/平台' },
                { r: rings[2], text: 'L3 接口/知识' },
                { r: rings[3], text: 'L4 数据/工单' },
              ].map((item, i) => (
                <text
                  key={item.text}
                  x={cx + item.r * 1.18 + 6}
                  y={cy + 38 + i * 12}
                  fill="rgba(205,231,255,0.4)"
                  fontSize={9}
                >
                  {item.text}
                </text>
              ))}

              {/* === 连线:底层 + 电流上层 === */}
              {positions.map((p) => {
                const node = p.node;
                const isAbn = node.linkStatus === 'abnormal';
                const lineColor = isAbn ? TOPO_THEME.abnormal : TOPO_THEME.normal;
                const parent = node.parentId ? positionMap.get(node.parentId) : undefined;
                const startX = parent?.x ?? cx;
                const startY = parent?.y ?? cy;
                const isParentEdge = Boolean(parent);
                const flowClass = isAbn
                  ? 'topo-line-flow-reverse'
                  : !isParentEdge || node.ring === 1
                  ? 'topo-line-flow'
                  : 'topo-line-flow-slow';
                // 标签位置取中点
                const midX = (startX + p.x) / 2;
                const midY = (startY + p.y) / 2;
                const dx = p.x - startX;
                const dy = p.y - startY;
                const curve = isParentEdge ? 16 : 0;
                const ctrlX = midX - (dy / Math.max(Math.hypot(dx, dy), 1)) * curve;
                const ctrlY = midY + (dx / Math.max(Math.hypot(dx, dy), 1)) * curve;
                const pathD = isParentEdge
                  ? `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${p.x} ${p.y}`
                  : `M ${startX} ${startY} L ${p.x} ${p.y}`;
                return (
                  <g key={`line-${node.id}`}>
                    {/* 底层实线(底色) */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth={isAbn ? 2.4 : isParentEdge ? 1.35 : 1.8}
                      strokeDasharray={isAbn ? '9 6' : isParentEdge ? '3 5' : '0'}
                      opacity={isAbn ? 0.95 : isParentEdge ? 0.42 : 0.58}
                      filter={isAbn ? 'url(#topo-glow)' : undefined}
                    />
                    {/* 上层电流流动虚线 */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isAbn ? TOPO_THEME.abnormalTint : TOPO_THEME.normalTint}
                      strokeWidth={isParentEdge ? 1.1 : 1.4}
                      strokeDasharray={isParentEdge ? '5 12' : '6 14'}
                      strokeLinecap="round"
                      className={flowClass}
                      opacity={isParentEdge ? 0.72 : 0.95}
                    />
                    {!isParentEdge && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-26}
                          y={-10}
                          width={52}
                          height={18}
                          rx={9}
                          fill="rgba(3, 13, 34, 0.82)"
                          stroke={isAbn ? TOPO_THEME.abnormal : TOPO_THEME.normal}
                          strokeWidth={0.8}
                          opacity={0.92}
                        />
                        <text
                          y={3}
                          fill={isAbn ? TOPO_THEME.abnormalTint : TOPO_THEME.normalTint}
                          fontSize={10.5}
                          fontWeight={600}
                          textAnchor="middle"
                        >
                          {node.linkType}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* === 中心核心圆 + 呼吸环 + 雷达脉冲 === */}
              {/* 3 圈错相雷达脉冲 */}
              {[0, 0.85, 1.7].map((delay, i) => (
                <circle
                  key={`pulse-${i}`}
                  cx={cx}
                  cy={cy}
                  r={62}
                  fill="none"
                  stroke={TOPO_THEME.normal}
                  strokeWidth={1.4}
                  opacity={0.55}
                  className="topo-pulse-ring"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}

              {/* 实心核心 + 呼吸外环 + 内圈 LED */}
              <g filter="url(#topo-glow)">
                <circle cx={cx} cy={cy} r={58} fill="url(#topo-core)" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={74}
                  fill="none"
                  stroke="rgba(53,242,255,0.35)"
                  strokeWidth={2}
                >
                  <animate
                    attributeName="r"
                    values="72;92;72"
                    dur="2.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.8;0.12;0.8"
                    dur="2.8s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={cx}
                  cy={cy}
                  r={50}
                  fill="none"
                  stroke={TOPO_THEME.normalTint}
                  strokeWidth={1}
                  className="topo-core-breathe"
                />
              </g>

              {/* 智能体名称在 panel header 中显示(避免遮挡 SVG 中心节点) */}

              {/* ===== 节点卡片(SVG <foreignObject>,与 SVG 坐标系严格一致) ===== */}
              {positions.map((p) => {
                const node = p.node;
                const isAbn = node.linkStatus === 'abnormal';
                const badge = node.subType ? TOPO_SUBTYPE_BADGE[node.subType] : undefined;
                const isDomain = node.nodeKind === 'domain';
                const CARD_W = isDomain ? Math.max(78, nodeW - 8) : nodeW;
                const CARD_H = isDomain ? Math.max(32, nodeH - 4) : nodeH;
                return (
                  <foreignObject
                    key={`fo-${node.id}`}
                    x={p.x - CARD_W / 2}
                    y={p.y - CARD_H / 2}
                    width={CARD_W}
                    height={CARD_H}
                    style={{ overflow: 'visible', cursor: 'pointer' }}
                    onClick={() => onResourceDrill(node)}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: CARD_W,
                        height: CARD_H,
                        padding: '4px 6px',
                        textAlign: 'center',
                        borderRadius: 7,
                        background: isAbn
                          ? 'linear-gradient(180deg, rgba(108,24,34,0.96) 0%, rgba(45,10,26,0.95) 100%)'
                          : isDomain
                          ? 'linear-gradient(180deg, rgba(14,77,103,0.96) 0%, rgba(8,39,76,0.94) 100%)'
                          : 'rgba(6,43,82,0.94)',
                        border: `1.2px solid ${isAbn ? TOPO_THEME.abnormal : TOPO_THEME.normal}`,
                        color: '#effbff',
                        fontSize: 9.2 * scale,
                        boxShadow: isAbn
                          ? `0 0 12px ${TOPO_THEME.abnormalGlow}, inset 0 0 10px rgba(255,77,79,0.18)`
                          : `0 0 8px ${TOPO_THEME.normalGlow}, inset 0 0 6px rgba(53,242,255,0.12)`,
                        animation: 'topo-node-pop 320ms ease-out both',
                        lineHeight: 1.35,
                        boxSizing: 'border-box',
                        backdropFilter: 'blur(2px)',
                      }}
                    >
                      {/* 子类型徽标 */}
                      {badge && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -7,
                            left: 5,
                            padding: '1px 5px',
                            borderRadius: 3,
                          fontSize: 8 * scale,
                            fontWeight: 700,
                            letterSpacing: 0.3,
                            color: '#0a1a3a',
                            background: badge.tone,
                            boxShadow: `0 0 5px ${badge.tone}88`,
                          }}
                        >
                          {badge.abbr}
                        </div>
                      )}
                      <div
                        style={{
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={node.name}
                      >
                        {node.name.length > 10 ? `${node.name.slice(0, 10)}…` : node.name}
                      </div>
                      <div
                        style={{
                          fontSize: 8.6 * scale,
                          marginTop: 1,
                          color: isAbn ? TOPO_THEME.abnormalTint : TOPO_THEME.normalTint,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {isAbn ? '对接异常' : NODE_KIND_LABEL[node.nodeKind ?? 'data']}
                      </div>
                      {isAbn && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: TOPO_THEME.abnormal,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            boxShadow: `0 0 6px ${TOPO_THEME.abnormalGlow}`,
                            animation: 'agent-badge-pulse 0.6s ease-in-out 2',
                          }}
                        >
                          !
                        </div>
                      )}
                    </div>
                  </foreignObject>
                );
              })}
            </svg>

            {/* 中心 AgentRobotIcon 浮层(主角,绝对定位) */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
                pointerEvents: 'none',
                filter: 'drop-shadow(0 4px 18px rgba(53,242,255,0.55))',
              }}
            >
              <AgentRobotIcon mood="idle" size={Math.round(clamp(82 * scale, 60, 88))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MultiRingTopology;
