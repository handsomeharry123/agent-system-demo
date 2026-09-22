/**
 * MetricLabel — 监控指标名称 + 悬浮气泡说明（V1.7 规范）
 *
 * 用途：统一运行监控中心的所有卡片 / 图表的指标名称后面挂一个浅色「?」气泡，
 *       鼠标悬停时展示该指标的定义、单位、阈值与分级。
 * 交互规范（V1.7 §指标气泡）：
 *   - 悬浮 300ms 后弹出，离开 100ms 后收起（由 Tooltip 默认行为保障）
 *   - 气泡内容 4 行模板：① 一句话定义 ② 单位 ③ 建议阈值 ④ 指标分级
 *   - 深背景 #1F1F1F、字号 12px、行高 1.6、圆角 4px、最大宽度 320px
 *   - 气泡内容可选中复制（Tooltip 默认可选中）
 *
 * 用法：
 *   <MetricLabel name="任务完成率" />
 *   <MetricLabel name="任务完成率" prefix={<RiseOutlined />} />
 *   <MetricLabel name="任务完成率" variant="kpi" />
 */
import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { getMetricMeta, type MetricMeta } from '../mock/monitoring-metrics';

export interface MetricLabelProps {
  /** 指标名称（用于匹配说明文案，找不到时回退通用提示） */
  name: string;
  /** 名称前的图标（可选） */
  prefix?: React.ReactNode;
  /** 名称后的图标（可选，会放在气泡之前） */
  suffix?: React.ReactNode;
  /** 视觉变体：默认「card」（用于 Card title 12-13px）；「kpi」（用于 KPI 卡 12px 灰色标签）；「inline」 */
  variant?: 'card' | 'kpi' | 'inline';
  /** 强制覆盖说明文案（一般不传） */
  metaOverride?: MetricMeta;
  /** 气泡位置 */
  placement?: 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight' | 'left' | 'right';
  /** 名称节点是否允许换行，默认 false（防止破坏 Card title 布局） */
  wrap?: boolean;
}

/** 构建气泡正文：4 行模板（缺则隐藏该行） */
const buildTooltipContent = (meta: MetricMeta) => (
  <div style={{ maxWidth: 320, fontSize: 12, lineHeight: 1.6, color: '#fff', userSelect: 'text' }}>
    {/* 第 1 行：定义与计算口径（始终展示） */}
    <div style={{ color: '#fff' }}>{meta.definition}</div>
    {(meta.unit || meta.threshold || meta.priority) && (
      <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.7)' }}>
        {/* 第 2 行：单位 */}
        {meta.unit && <div>单位：{meta.unit}</div>}
        {/* 第 3 行：建议阈值（无阈值则整行隐藏） */}
        {meta.threshold && <div>建议阈值：{meta.threshold}</div>}
        {/* 第 4 行：指标分级（V1.7 规范第 4 行） */}
        {meta.priority && <div>指标分级：{meta.priority}</div>}
      </div>
    )}
  </div>
);

export const MetricLabel: React.FC<MetricLabelProps> = ({
  name,
  prefix,
  suffix,
  variant = 'card',
  metaOverride,
  placement = 'top',
  wrap = false,
}) => {
  const meta = metaOverride || getMetricMeta(name);

  const nameStyle: React.CSSProperties =
    variant === 'kpi'
      ? { color: 'rgba(0,0,0,0.45)', fontSize: 12, lineHeight: 1.4 }
      : variant === 'inline'
        ? { fontSize: 13, color: 'rgba(0,0,0,0.85)' }
        : { fontSize: 14, color: 'rgba(0,0,0,0.85)', fontWeight: 500, whiteSpace: wrap ? 'normal' : 'nowrap' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      {prefix != null && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{prefix}</span>}
      <span
        style={{
          ...nameStyle,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={name}
      >
        {name}
      </span>
      {suffix != null && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{suffix}</span>}
      <Tooltip
        title={buildTooltipContent(meta)}
        placement={placement}
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0.1}
        color="#1F1F1F"
        overlayInnerStyle={{ borderRadius: 4, padding: '8px 12px', maxWidth: 320 }}
      >
        <QuestionCircleOutlined
          style={{
            color: '#BFBFBF',
            fontSize: 13,
            cursor: 'help',
            flexShrink: 0,
            padding: 0,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#1677FF')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#BFBFBF')}
        />
      </Tooltip>
    </span>
  );
};

export default MetricLabel;
