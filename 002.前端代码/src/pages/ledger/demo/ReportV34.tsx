/**
 * 统一台账中心 - 智能化升级 Demo
 * §3.3 / §4.3 智能总结分析 - 报告生成页（V1.0 精简版）
 *
 * 依据两份 docx 模板：
 *   - 信息科管理员：/Users/harry/Desktop/CC_TEST/agent-system/全院智能体运行管理情况报告模板.docx
 *   - 科室管理员  ：/Users/harry/Desktop/CC_TEST/agent-system/科室智能体运行情况报告模板-以放射科为例.docx
 *
 * V1.0 精简要点（2026-07-06）：
 *   - 去掉原 V1.x 的批注 / 增删 / 速读订阅 / PPT 导出等冗余逻辑
 *   - 页面只保留两个核心操作：「编辑」「导出」
 *   - 报告内容节点与两份 docx 模板 1:1 对齐（5 大模块 + 编制说明）
 *   - 角色识别：根据 useAuth 自动决定加载哪一份模板
 *   - 导出：PDF（jspdf+html2canvas 切片 A4）、Word（结构化 HTML.doc）；不做 PPT
 *   - 编辑：进入「编辑模式」可在原段落上原地修改 TextArea，并自动保存本地草稿
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Tag,
  message,
  Tooltip,
  Divider,
  Dropdown,
  Input,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  CheckOutlined,
  FileWordOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import { useAuth } from '../../../hooks/useAuth';
import { buildPlatformReport, buildDeptReport, type ReportNode } from './reportData';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type ReportScope = 'platform_admin' | 'dept_admin';

const DRAFT_STORAGE_KEY = 'ledger_demo_report_v34_draft';

const scopeFromRoles = (roles?: string[]): ReportScope =>
  roles?.includes('科室管理员') && !roles.includes('信息科管理员') ? 'dept_admin' : 'platform_admin';

// 草稿 key 同时绑定当前登录用户与角色,避免演示切换账户时互相覆盖
const draftKey = (userId: string | undefined, scope: ReportScope) =>
  `${DRAFT_STORAGE_KEY}::${userId || 'guest'}::${scope}`;

const loadDraft = (userId: string | undefined, scope: ReportScope): ReportNode[] | null => {
  try {
    const raw = localStorage.getItem(draftKey(userId, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const saveDraft = (userId: string | undefined, scope: ReportScope, nodes: ReportNode[]) => {
  try {
    localStorage.setItem(draftKey(userId, scope), JSON.stringify(nodes));
  } catch {
    /* ignore */
  }
};

// ============ 简易图表（SVG） ============
const MiniBar: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  const W = 600;
  const H = 200;
  const pad = { top: 16, right: 16, bottom: 40, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const barW = innerW / Math.max(data.length, 1);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = pad.top + innerH * (1 - p);
        return (
          <g key={p}>
            <line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke="#F0F0F0" />
            <text x={pad.left - 4} y={y + 3} fontSize={10} fill="#8C8C8C" textAnchor="end">
              {Math.round(maxV * p)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / maxV) * innerH;
        const x = pad.left + i * barW + barW * 0.18;
        const w = barW * 0.64;
        return (
          <g key={d.name}>
            <rect x={x} y={pad.top + innerH - h} width={w} height={h} fill="#1677FF" rx={2} />
            <text x={x + w / 2} y={pad.top + innerH - h - 4} fontSize={10} fill="#262626" textAnchor="middle">
              {d.value}
            </text>
            <text
              x={x + w / 2}
              y={H - pad.bottom + 16}
              fontSize={10}
              fill="#595959"
              textAnchor="middle"
              transform={`rotate(-22 ${x + w / 2} ${H - pad.bottom + 16})`}
            >
              {d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const MiniLine: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  const W = 600;
  const H = 200;
  const pad = { top: 16, right: 16, bottom: 40, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const stepX = innerW / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => ({
    x: pad.left + i * stepX,
    y: pad.top + innerH - (d.value / maxV) * innerH,
    ...d,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pad.left + (data.length - 1) * stepX} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="line-grad-r34" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1677FF" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#1677FF" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = pad.top + innerH * (1 - p);
        return (
          <g key={p}>
            <line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke="#F0F0F0" />
            <text x={pad.left - 4} y={y + 3} fontSize={10} fill="#8C8C8C" textAnchor="end">
              {Math.round(maxV * p)}
            </text>
          </g>
        );
      })}
      <path d={areaD} fill="url(#line-grad-r34)" />
      <path d={pathD} fill="none" stroke="#1677FF" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#1677FF" strokeWidth={2} />
          <text x={p.x} y={p.y - 8} fontSize={10} fill="#262626" textAnchor="middle">
            {p.value}
          </text>
          <text x={p.x} y={H - pad.bottom + 16} fontSize={10} fill="#595959" textAnchor="middle">
            {p.name}
          </text>
        </g>
      ))}
    </svg>
  );
};

const MiniPie: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const palette = ['#1677FF', '#13C2C2', '#52C41A', '#FA8C16', '#722ED1', '#EB2F96', '#FAAD14', '#A0D911'];
  let cursor = -Math.PI / 2;
  const cx = 90;
  const cy = 90;
  const R = 70;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        {data.map((d, i) => {
          const angle = total === 0 ? 0 : (d.value / total) * Math.PI * 2;
          const start = cursor;
          const end = cursor + angle;
          const x1 = cx + R * Math.cos(start);
          const y1 = cy + R * Math.sin(start);
          const x2 = cx + R * Math.cos(end);
          const y2 = cy + R * Math.sin(end);
          const large = angle > Math.PI ? 1 : 0;
          cursor = end;
          return (
            <path
              key={d.name}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={palette[i % palette.length]}
              stroke="#fff"
              strokeWidth={1}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={32} fill="#fff" />
        <text x={cx} y={cy - 2} fontSize={11} fill="#8C8C8C" textAnchor="middle">
          合计
        </text>
        <text x={cx} y={cy + 16} fontSize={16} fill="#262626" textAnchor="middle" fontWeight={600}>
          {total}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        {data.map((d, i) => (
          <div
            key={d.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '3px 0',
              fontSize: 12,
            }}
          >
            <Space size={6}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: palette[i % palette.length],
                  display: 'inline-block',
                }}
              />
              <span>{d.name}</span>
            </Space>
            <span>
              {d.value}{' '}
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({total === 0 ? 0 : ((d.value / total) * 100).toFixed(1)}%)
              </Text>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MatrixHeatmap: React.FC<{
  rows: string[];
  cols: string[];
  data: number[][];
  legend?: string;
  editable?: boolean;
  onPatchCell?: (rowIdx: number, colIdx: number, val: number) => void;
  onPatchRow?: (rowIdx: number, val: string) => void;
  onPatchCol?: (colIdx: number, val: string) => void;
  onPatchLegend?: (val: string) => void;
}> = ({ rows, cols, data, legend, editable, onPatchCell, onPatchRow, onPatchCol, onPatchLegend }) => {
  const flat = data.flat();
  const maxV = Math.max(...flat, 1);
  const labelW = 130;
  const cellW = 90;
  const cellH = 36;
  const headerH = 80;
  const W = labelW + cols.length * cellW + 16;
  const H = headerH + rows.length * cellH + (legend ? 36 : 12);
  const colorOf = (v: number) => {
    if (v === 0) return '#FAFAFA';
    const a = Math.max(0.15, Math.min(1, v / maxV));
    const r = Math.round(255 - (255 - 22) * a);
    const g = Math.round(255 - (255 - 119) * a);
    const b = Math.round(255 - (255 - 255) * a);
    return `rgb(${r},${g},${b})`;
  };
  const textColorOf = (v: number) => {
    if (v === 0) return '#BFBFBF';
    const a = v / maxV;
    return a > 0.55 ? '#fff' : '#262626';
  };

  // 编辑模式:用 HTML 表格 + Input 替换 SVG,便于文字和数值编辑
  if (editable) {
    return (
      <div style={{ padding: '4px 0' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 12,
            width: '100%',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr>
              <th style={{ width: labelW, background: '#F0F5FF', border: '1px solid #D9D9D9', padding: 6, color: '#1677FF' }}>
                智能体 \ 系统
              </th>
              {cols.map((c, j) => (
                <th
                  key={`h-${j}`}
                  style={{ background: '#F0F5FF', border: '1px solid #D9D9D9', padding: 4, color: '#1677FF' }}
                >
                  <Input
                    size="small"
                    value={c}
                    onChange={(e) => onPatchCol?.(j, e.target.value)}
                    style={{ textAlign: 'center', minWidth: 60 }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rname, i) => (
              <tr key={`r-${i}`}>
                <td style={{ background: '#F0F5FF', border: '1px solid #D9D9D9', padding: 4, color: '#1677FF' }}>
                  <Input
                    size="small"
                    value={rname}
                    onChange={(e) => onPatchRow?.(i, e.target.value)}
                  />
                </td>
                {cols.map((_c, j) => {
                  const v = data[i]?.[j] ?? 0;
                  return (
                    <td
                      key={`c-${i}-${j}`}
                      style={{
                        background: colorOf(v),
                        border: '1px solid #D9D9D9',
                        padding: 4,
                        textAlign: 'center',
                        color: textColorOf(v),
                      }}
                    >
                      <Input
                        size="small"
                        type="number"
                        step={0.1}
                        value={String(v)}
                        onChange={(e) => {
                          const num = Number(e.target.value);
                          onPatchCell?.(i, j, Number.isFinite(num) ? num : 0);
                        }}
                        style={{ width: '90%', textAlign: 'center' }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {legend !== undefined && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#8C8C8C' }}>
            <Input
              size="small"
              value={legend}
              onChange={(e) => onPatchLegend?.(e.target.value)}
              style={{ maxWidth: '100%' }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', padding: '4px 0' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {cols.map((c, j) => {
          const x = labelW + j * cellW + cellW / 2;
          const y = headerH - 8;
          return (
            <g key={`col-${j}`} transform={`translate(${x},${y}) rotate(-45)`}>
              <text x={0} y={0} fontSize={11} fill="#262626" textAnchor="start">
                {c}
              </text>
            </g>
          );
        })}
        {rows.map((rname, i) => (
          <g key={`row-${i}`}>
            <text
              x={labelW - 8}
              y={headerH + i * cellH + cellH / 2 + 4}
              fontSize={11}
              fill="#262626"
              textAnchor="end"
            >
              {rname}
            </text>
            {cols.map((_c, j) => {
              const v = data[i]?.[j] ?? 0;
              const x = labelW + j * cellW;
              const y = headerH + i * cellH;
              return (
                <g key={`cell-${i}-${j}`}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={cellW - 4}
                    height={cellH - 4}
                    fill={colorOf(v)}
                    stroke={v === 0 ? '#D9D9D9' : '#fff'}
                    strokeWidth={1}
                    strokeDasharray={v === 0 ? '3,2' : ''}
                    rx={3}
                  />
                  <text
                    x={x + cellW / 2}
                    y={y + cellH / 2 + 4}
                    fontSize={11}
                    fill={textColorOf(v)}
                    textAnchor="middle"
                    fontWeight={v > 0 ? 500 : 400}
                  >
                    {v === 0 ? '—' : v.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
        {legend && (
          <g transform={`translate(${labelW}, ${H - 28})`}>
            <text x={0} y={12} fontSize={10} fill="#8C8C8C">
              {legend}
            </text>
            <g transform={`translate(${W - labelW - 220}, 4)`}>
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <rect
                  key={i}
                  x={i * 40}
                  y={0}
                  width={36}
                  height={10}
                  fill={colorOf(p * maxV)}
                  stroke="#fff"
                />
              ))}
              <text x={0} y={22} fontSize={9} fill="#8C8C8C">
                低
              </text>
              <text x={W - labelW - 40} y={22} fontSize={9} fill="#8C8C8C" textAnchor="end">
                高
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

// ============ 渲染节点 ============
// 通用编辑型输入:editable=true 时显示 Input/TextArea,只读时显示 children
const EditableText: React.FC<{
  editable: boolean;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  inputProps?: React.ComponentProps<typeof Input>;
  textStyle?: React.CSSProperties;
}> = ({ editable, value, onChange, multiline, inputProps, textStyle }) => {
  if (!editable) {
    return <span style={textStyle}>{value}</span>;
  }
  if (multiline) {
    return (
      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoSize={{ minRows: 1 }}
        {...(inputProps as unknown as React.ComponentProps<typeof TextArea>)}
      />
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...inputProps}
    />
  );
};

const NodeRenderer: React.FC<{
  node: ReportNode;
  editable: boolean;
  onTextChange: (id: string, text: string) => void;
  onPatch: (id: string, patch: Partial<ReportNode>) => void;
}> = ({ node, editable, onTextChange, onPatch }) => {
  // 通用便捷封装:onTextChange 仍负责 text 字段;其它字段走 onPatch
  const patch = (p: Partial<ReportNode>) => onPatch(node.id, p);
  if (node.type === 'cover' && node.cover) {
    const c = node.cover;
    const editableLine: React.CSSProperties = {
      padding: 0,
      margin: 0,
    };
    const editableInputProps: React.ComponentProps<typeof Input> = {
      size: 'small',
      style: { maxWidth: 360 },
    };
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '64px 32px 56px',
          borderBottom: '3px double #1677FF',
          marginBottom: 24,
          background: 'linear-gradient(180deg, #F0F5FF 0%, #ffffff 100%)',
        }}
      >
        <EditableText
          editable={editable}
          value={c.hospital}
          onChange={(v) => patch({ cover: { ...c, hospital: v } })}
          textStyle={{ fontSize: 14, color: '#8C8C8C', letterSpacing: 4 }}
          inputProps={editableInputProps}
        />
        <div style={{ marginTop: 24, marginBottom: 32 }}>
          <EditableText
            editable={editable}
            value={c.reportTitle}
            onChange={(v) => patch({ cover: { ...c, reportTitle: v } })}
            textStyle={{ fontSize: 32, color: '#1677FF', fontWeight: 600, lineHeight: 1.2 }}
            inputProps={{ size: 'large', style: { maxWidth: 520, fontSize: 24, textAlign: 'center', color: '#1677FF' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
        <Space direction="vertical" size={6} style={{ fontSize: 14, color: '#262626', alignItems: 'center' }}>
          <EditableText
            editable={editable}
            value={c.deptName}
            onChange={(v) => patch({ cover: { ...c, deptName: v } })}
            textStyle={editableLine}
            inputProps={editableInputProps}
          />
          <EditableText
            editable={editable}
            value={c.period}
            onChange={(v) => patch({ cover: { ...c, period: v } })}
            textStyle={editableLine}
            inputProps={editableInputProps}
          />
          <EditableText
            editable={editable}
            value={c.generatedBy}
            onChange={(v) => patch({ cover: { ...c, generatedBy: v } })}
            textStyle={editableLine}
            inputProps={editableInputProps}
          />
          <EditableText
            editable={editable}
            value={c.reportDate}
            onChange={(v) => patch({ cover: { ...c, reportDate: v } })}
            textStyle={editableLine}
            inputProps={editableInputProps}
          />
        </Space>
      </div>
    );
  }
  if (node.type === 'toc' && node.toc) {
    return (
      <Card
        size="small"
        style={{ marginBottom: 24, border: '1px solid #D6E4FF' }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Title level={4} style={{ marginTop: 0, marginBottom: 12, color: '#1677FF' }}>
          目  录
        </Title>
        <div style={{ columns: 2, columnGap: 24 }}>
          {node.toc.items.map((it, idx) => (
            <div
              key={it.anchor}
              style={{
                padding: '4px 0',
                fontSize: 13,
                color: '#262626',
                borderBottom: '1px dashed #F0F0F0',
                breakInside: 'avoid',
              }}
            >
              <EditableText
                editable={editable}
                value={it.label}
                onChange={(v) => {
                  const items = node.toc!.items.map((x, i) => (i === idx ? { ...x, label: v } : x));
                  patch({ toc: { items } });
                }}
                textStyle={{}}
                inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
              />
            </div>
          ))}
        </div>
        <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          (在 Word 中右键点击此处,选择「更新域」自动生成目录。)
        </Text>
      </Card>
    );
  }
  if (node.type === 'h2') {
    return (
      <div id={`sec-${node.id}`} style={{ scrollMarginTop: 16, marginTop: 24 }}>
        <div
          style={{
            marginTop: 0,
            marginBottom: 12,
            borderBottom: '2px solid #1677FF',
            paddingBottom: 6,
          }}
        >
          <EditableText
            editable={editable}
            value={node.text || ''}
            onChange={(v) => onTextChange(node.id, v)}
            textStyle={{ fontSize: 22, fontWeight: 600, color: '#1677FF' }}
            inputProps={{ size: 'large', style: { fontSize: 20, fontWeight: 600, color: '#1677FF' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
      </div>
    );
  }
  if (node.type === 'h3') {
    return (
      <div id={`sec-${node.id}`} style={{ scrollMarginTop: 16, marginTop: 16 }}>
        <div style={{ padding: '4px 0', marginBottom: 4 }}>
          <EditableText
            editable={editable}
            value={node.text || ''}
            onChange={(v) => onTextChange(node.id, v)}
            textStyle={{ fontSize: 15, fontWeight: 600, color: '#1677FF' }}
            inputProps={{ size: 'small', style: { fontSize: 15, fontWeight: 600, color: '#1677FF' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
      </div>
    );
  }
  if (node.type === 'p') {
    if (editable) {
      return (
        <TextArea
          value={node.text}
          onChange={(e) => onTextChange(node.id, e.target.value)}
          autoSize={{ minRows: 2 }}
          style={{ marginBottom: 8 }}
        />
      );
    }
    return (
      <Paragraph style={{ fontSize: 14, lineHeight: 1.85, marginBottom: 10, color: '#262626' }}>
        {node.text}
      </Paragraph>
    );
  }
  if (node.type === 'kpi' && node.kpis) {
    return (
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {node.kpis.map((k, idx) => (
          <Col key={`${k.label}-${idx}`} span={Math.floor(24 / node.kpis!.length)}>
            <Card
              size="small"
              style={{ background: '#FAFAFA', textAlign: 'center', border: '1px solid #F0F0F0' }}
              bodyStyle={{ padding: 14 }}
            >
              <div style={{ fontSize: 11, color: '#8C8C8C' }}>
                <EditableText
                  editable={editable}
                  value={k.label}
                  onChange={(v) => {
                    const kpis = node.kpis!.map((x, i) => (i === idx ? { ...x, label: v } : x));
                    patch({ kpis });
                  }}
                  textStyle={{}}
                  inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
                />
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: k.color || '#1677FF',
                  marginTop: 4,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'baseline',
                  gap: 4,
                  flexWrap: 'wrap',
                }}
              >
                <EditableText
                  editable={editable}
                  value={k.value}
                  onChange={(v) => {
                    const kpis = node.kpis!.map((x, i) => (i === idx ? { ...x, value: v } : x));
                    patch({ kpis });
                  }}
                  textStyle={{}}
                  inputProps={{ size: 'small', style: { width: 80, textAlign: 'center', color: k.color, fontWeight: 700 } as React.ComponentProps<typeof Input>['style'] }}
                />
                {k.unit !== undefined && (
                  <EditableText
                    editable={editable}
                    value={k.unit || ''}
                    onChange={(v) => {
                      const kpis = node.kpis!.map((x, i) => (i === idx ? { ...x, unit: v } : x));
                      patch({ kpis });
                    }}
                    textStyle={{ fontSize: 12, color: '#8C8C8C', fontWeight: 400 }}
                    inputProps={{ size: 'small', style: { width: 70, fontSize: 12, color: '#8C8C8C' } as React.ComponentProps<typeof Input>['style'] }}
                  />
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }
  if (node.type === 'chart' && node.chart) {
    const ch = node.chart;
    return (
      <Card
        size="small"
        style={{ marginBottom: 12, border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div style={{ fontSize: 13, color: '#262626', fontWeight: 600 }}>
          <EditableText
            editable={editable}
            value={ch.title}
            onChange={(v) => patch({ chart: { ...ch, title: v } })}
            textStyle={{}}
            inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
        <Divider style={{ margin: '8px 0' }} />
        {ch.chartType === 'bar' && <MiniBar data={ch.data} />}
        {ch.chartType === 'line' && <MiniLine data={ch.data} />}
        {ch.chartType === 'pie' && <MiniPie data={ch.data} />}
      </Card>
    );
  }
  if (node.type === 'table' && node.table) {
    const tb = node.table;
    return (
      <Card
        size="small"
        style={{ marginBottom: 12, border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div style={{ fontSize: 13, color: '#262626', fontWeight: 600 }}>
          <EditableText
            editable={editable}
            value={tb.title}
            onChange={(v) => patch({ table: { ...tb, title: v } })}
            textStyle={{}}
            inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {tb.headers.map((h, ci) => (
                <th
                  key={`${h}-${ci}`}
                  style={{
                    background: '#F0F5FF',
                    border: '1px solid #D9D9D9',
                    padding: 0,
                    textAlign: 'left',
                    color: '#1677FF',
                    fontWeight: 600,
                  }}
                >
                  <div style={{ padding: '8px 10px' }}>
                    <EditableText
                      editable={editable}
                      value={h}
                      onChange={(v) => {
                        const headers = tb.headers.map((x, i) => (i === ci ? v : x));
                        patch({ table: { ...tb, headers } });
                      }}
                      textStyle={{}}
                      inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tb.rows.map((r, ri) => (
              <tr key={r.key}>
                {r.cells.map((cell, ci) => (
                  <td
                    key={`${r.key}-${ci}`}
                    style={{ border: '1px solid #D9D9D9', padding: 0, color: '#262626' }}
                  >
                    <div style={{ padding: '8px 10px' }}>
                      <EditableText
                        editable={editable}
                        value={cell}
                        onChange={(v) => {
                          const rows = tb.rows.map((x, i) => {
                            if (i !== ri) return x;
                            const cells = x.cells.map((c, j) => (j === ci ? v : c));
                            return { ...x, cells };
                          });
                          patch({ table: { ...tb, rows } });
                        }}
                        textStyle={{}}
                        inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if (node.type === 'matrix' && node.matrix) {
    const mx = node.matrix;
    return (
      <Card
        size="small"
        style={{ marginBottom: 12, border: '1px solid #F0F0F0' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div style={{ fontSize: 13, color: '#262626', fontWeight: 600 }}>
          <EditableText
            editable={editable}
            value={mx.title}
            onChange={(v) => patch({ matrix: { ...mx, title: v } })}
            textStyle={{}}
            inputProps={{ size: 'small', style: { maxWidth: '100%' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <MatrixHeatmap
          rows={mx.rows}
          cols={mx.cols}
          data={mx.data}
          legend={mx.legend}
          editable={editable}
          onPatchCell={(rowIdx, colIdx, val) => {
            const data = mx.data.map((r, i) =>
              i === rowIdx ? r.map((c, j) => (j === colIdx ? val : c)) : r,
            );
            patch({ matrix: { ...mx, data } });
          }}
          onPatchRow={(rowIdx, val) => {
            const rows = mx.rows.map((r, i) => (i === rowIdx ? val : r));
            patch({ matrix: { ...mx, rows } });
          }}
          onPatchCol={(colIdx, val) => {
            const cols = mx.cols.map((c, i) => (i === colIdx ? val : c));
            patch({ matrix: { ...mx, cols } });
          }}
          onPatchLegend={(val) => patch({ matrix: { ...mx, legend: val } })}
        />
      </Card>
    );
  }
  if (node.type === 'colophon' && node.colophon) {
    const co = node.colophon;
    return (
      <div
        id={`sec-${node.id}`}
        style={{
          marginTop: 32,
          padding: 20,
          background: '#F0F5FF',
          borderLeft: '4px solid #1677FF',
          borderRadius: 4,
          scrollMarginTop: 16,
        }}
      >
        <Title level={4} style={{ marginTop: 0, marginBottom: 12, color: '#1677FF' }}>
          附:编制说明
        </Title>
        <Paragraph style={{ fontSize: 13, lineHeight: 1.85, marginBottom: 6 }}>
          ① 本报告由智能体管理平台基于台账聚合数据一键生成,统计口径统一,统计周期与筛选范围(科室/时间)见封面。
        </Paragraph>
        <Paragraph style={{ fontSize: 13, lineHeight: 1.85, marginBottom: 6 }}>
          ② 各模块图表由系统按实时数据自动生成,本模板内全部数据与图表均为示例;比率类指标在图表处注明分子分母口径。
        </Paragraph>
        <Paragraph style={{ fontSize: 13, lineHeight: 1.85, marginBottom: 12 }}>
          ③ 各模块文字综述由智能助手自动生成初稿,管理员可在平台编辑页在线调整后发布。
        </Paragraph>
        <div style={{ textAlign: 'right', color: '#595959', fontSize: 13 }}>
          <EditableText
            editable={editable}
            value={co.generator}
            onChange={(v) => patch({ colophon: { ...co, generator: v } })}
            textStyle={{}}
            inputProps={{ size: 'small', style: { maxWidth: 280, textAlign: 'right' } as React.ComponentProps<typeof Input>['style'] }}
          />
          <br />
          <EditableText
            editable={editable}
            value={co.reportDate}
            onChange={(v) => patch({ colophon: { ...co, reportDate: v } })}
            textStyle={{}}
            inputProps={{ size: 'small', style: { maxWidth: 200, textAlign: 'right' } as React.ComponentProps<typeof Input>['style'] }}
          />
        </div>
      </div>
    );
  }
  return null;
};

// ============ 主页面 ============
const ReportV34: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const roleScope = scopeFromRoles(currentUser?.roles);
  const [scope, setScope] = useState<ReportScope>(roleScope);
  const deptName = useMemo(() => {
    const u = currentUser;
    if (!u) return '放射科';
    return u.department || '放射科';
  }, [currentUser]);

  const [nodes, setNodes] = useState<ReportNode[]>(() => {
    // 默认按当前用户+角色加载草稿,未命中则用真实演示模板
    const cached = loadDraft(currentUser?.id, roleScope);
    if (cached) return cached;
    return roleScope === 'platform_admin' ? buildPlatformReport() : buildDeptReport(deptName);
  });
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const reportContainerAttr = 'data-r34-report';
  const reportRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (roleScope === scope) return;
    setScope(roleScope);
    setEditing(false);
    const cached = loadDraft(currentUser?.id, roleScope);
    setNodes(cached || (roleScope === 'platform_admin' ? buildPlatformReport() : buildDeptReport(deptName)));
    setSavedAt(cached ? new Date().toLocaleString('zh-CN', { hour12: false }) : '');
  }, [roleScope, scope, deptName, currentUser?.id]);

  useEffect(() => {
    if (!editing) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveDraft(currentUser?.id, scope, nodes);
      setSavedAt(new Date().toLocaleString('zh-CN', { hour12: false }));
    }, 1200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [nodes, editing, scope, currentUser?.id]);

  // 段落文本编辑(仅影响本地 state,不做持久化)
  const handleTextChange = (id: string, text: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  };

  // 任意字段编辑:用于 cover/toc/h2/h3/p/kpi/chart/table/matrix/colophon 的细粒度修改
  const handlePatch = (id: string, patch: Partial<ReportNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  // 导出工具
  const waitView = async () => {
    if (editing) {
      setEditing(false);
      await new Promise((r) => setTimeout(r, 120));
    }
  };

  const findContainer = (): HTMLElement | null => {
    if (reportRef.current) return reportRef.current;
    return document.querySelector<HTMLElement>(`[${reportContainerAttr}]`);
  };

  const exportToPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const hide = message.loading({ content: '正在生成 PDF…', duration: 0 });
    await waitView();
    try {
      const node = findContainer();
      if (!node) {
        message.error('未找到报告正文容器');
        return;
      }
      const canvas = await html2canvas(node, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const marginX = 10;
      const marginY = 10;
      const imgW = pdfW - marginX * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      // 切片 A4:每一页只承载 pdfH - 2*marginY 的内容高度,统一从顶端裁切
      const pageContentH = pdfH - marginY * 2;
      let heightLeft = imgH;
      let position = marginY;
      pdf.addImage(imgData, 'JPEG', marginX, position, imgW, imgH);
      heightLeft -= pageContentH;
      while (heightLeft > 0) {
        pdf.addPage();
        // 负的 position 把图片向上移,让下一页内容刚好进入可视区
        position = marginY - (imgH - heightLeft);
        pdf.addImage(imgData, 'JPEG', marginX, position, imgW, imgH);
        heightLeft -= pageContentH;
      }
      const filename = `${scope === 'platform_admin' ? '全院智能体运行管理情况报告' : `${deptName}智能体运行情况报告`}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
      hide();
      message.success('PDF 已导出');
    } catch (err) {
      hide();
      console.error(err);
      message.error('PDF 导出失败,请重试');
    } finally {
      setExporting(false);
    }
  };

  const exportToWord = () => {
    if (exporting) return;
    setExporting(true);
    const hide = message.loading({ content: '正在生成 Word…', duration: 0 });
    try {
      // 用结构化 HTML 输出(.doc 文件,MS Word 可直接打开)
      const esc = (s: string) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const kpiHtml = (kpis: NonNullable<ReportNode['kpis']>) => `
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;">
          <tr>${kpis.map((k) => `<th style="background:#F0F5FF;color:#1677FF;">${esc(k.label)}</th>`).join('')}</tr>
          <tr>${kpis
            .map(
              (k) =>
                `<td style="text-align:center;color:${esc(k.color || '#1677FF')};font-weight:600;font-size:18px;">${esc(k.value)}${
                  k.unit ? `<span style="font-size:12px;color:#8C8C8C;font-weight:400;">&nbsp;${esc(k.unit)}</span>` : ''
                }</td>`,
            )
            .join('')}</tr>
        </table>`;
      const tableHtml = (t: NonNullable<ReportNode['table']>) => `
        <h4>${esc(t.title)}</h4>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;">
          <tr>${t.headers.map((h) => `<th style="background:#F0F5FF;color:#1677FF;">${esc(h)}</th>`).join('')}</tr>
          ${t.rows
            .map(
              (r) =>
                `<tr>${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`,
            )
            .join('')}
        </table>`;

      const sectionsHtml = nodes
        .map((n) => {
          switch (n.type) {
            case 'cover': {
              const c = n.cover!;
              return `
                <div style="text-align:center;padding:48px 0;border-bottom:2px double #1677FF;">
                  <div style="color:#8C8C8C;letter-spacing:4px;">${esc(c.hospital)}</div>
                  <h1 style="color:#1677FF;margin:24px 0;">${esc(c.reportTitle)}</h1>
                  <p>${esc(c.deptName)}<br/>${esc(c.period)}<br/>${esc(c.generatedBy)}<br/>${esc(c.reportDate)}</p>
                  <p style="background:#FFF7E6;padding:10px;border:1px solid #FFD591;color:#874D00;text-align:left;">${esc(c.templateNote)}</p>
                </div>`;
            }
            case 'toc': {
              const items = n.toc!.items
                .map((it) => `<li>${esc(it.label)}</li>`)
                .join('');
              return `<h3>目  录</h3><ol>${items}</ol>`;
            }
            case 'h2':
              return `<h2 style="border-bottom:2px solid #1677FF;padding-bottom:4px;">${esc(n.text)}</h2>`;
            case 'h3':
              return `<h3 style="color:#1677FF;">${esc(n.text)}</h3>`;
            case 'p':
              return `<p>${esc(n.text)}</p>`;
            case 'kpi':
              return kpiHtml(n.kpis!);
            case 'chart':
              return `<h4>${esc(n.chart!.title)}</h4><p style="color:#8C8C8C;font-size:12px;">(图表数据:${n
                .chart!.data.map((d) => `${esc(d.name)}=${d.value}`)
                .join(' / ')})</p>`;
            case 'table':
              return tableHtml(n.table!);
            case 'matrix':
              return `<h4>${esc(n.matrix!.title)}</h4><p style="color:#8C8C8C;font-size:12px;">(${n.matrix!.rows.length}×${n
                .matrix!.cols.length} 对接矩阵,深度按调用量加权,详见平台预览)</p>`;
            case 'colophon': {
              const c = n.colophon!;
              return `
                <h3>附:编制说明</h3>
                <p>① 本报告由智能体管理平台基于台账聚合数据一键生成,统计口径统一,统计周期与筛选范围(科室/时间)见封面。</p>
                <p>② 各模块图表由系统按实时数据自动生成,本模板内全部数据与图表均为示例;比率类指标在图表处注明分子分母口径。</p>
                <p>③ 各模块文字综述由智能助手自动生成初稿,管理员可在平台编辑页在线调整后发布。</p>
                <p style="text-align:right;">${esc(c.generator)}<br/>${esc(c.reportDate)}</p>`;
            }
            default:
              return '';
          }
        })
        .join('\n');

      const html = `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>${
          scope === 'platform_admin' ? '全院智能体运行管理情况报告' : `${deptName}智能体运行情况报告`
        }</title>
        <style>body{font-family:"Microsoft YaHei","SimSun",sans-serif;max-width:900px;margin:24px auto;line-height:1.8;color:#262626;} h2{margin-top:24px;} h3{margin-top:16px;}</style>
        </head><body>${sectionsHtml}</body></html>`;

      const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `${scope === 'platform_admin' ? '全院智能体运行管理情况报告' : `${deptName}智能体运行情况报告`}_${new Date().toISOString().slice(0, 10)}.doc`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      hide();
      message.success('Word 已导出');
    } catch (err) {
      hide();
      console.error(err);
      message.error('Word 导出失败,请重试');
    } finally {
      setExporting(false);
    }
  };

  const exportMenu = {
    items: [
      {
        key: 'word',
        label: exporting ? '导出中…' : '导出 Word (.doc)',
        icon: <FileWordOutlined style={{ color: '#1677FF' }} />,
        disabled: exporting,
      },
      {
        key: 'pdf',
        label: exporting ? '导出中…' : '导出 PDF (.pdf)',
        icon: <FilePdfOutlined style={{ color: '#F5222D' }} />,
        disabled: exporting,
      },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'pdf') exportToPdf();
      else if (key === 'word') exportToWord();
    },
  };

  const stats = useMemo(() => {
    return {
      modules: nodes.filter((n) => n.type === 'h2').length,
      charts: nodes.filter((n) => n.type === 'chart').length,
      tables: nodes.filter((n) => n.type === 'table').length,
      kpis: nodes.filter((n) => n.type === 'kpi').length,
    };
  }, [nodes]);

  const isPlatformReport = scope === 'platform_admin';

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ maxWidth: '60%', margin: '0 auto' }}>
        <PageHeader
          title={
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                size="small"
                onClick={() => navigate('/app/ledger')}
              />
              <span>
                {isPlatformReport ? '全院智能体运行管理情况报告' : '本科室智能体运行情况报告'}
              </span>
              {savedAt && (
                <Tag color="success">
                  已自动保存 @ {savedAt}
                </Tag>
              )}
            </Space>
          }
          subTitle={`统计周期:2026-01-01 至 2026-06-30 · 统计范围:${
            isPlatformReport ? '全院全部智能体' : `${deptName}本科室智能体`
          } · 共 ${stats.modules} 个模块`}
          extra={
            <Space>
              <Tooltip title={editing ? '完成编辑并回到预览' : '切换为编辑模式'}>
                <Button
                  type={editing ? 'primary' : 'default'}
                  icon={editing ? <CheckOutlined /> : <EditOutlined />}
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? '完成' : '编辑'}
                </Button>
              </Tooltip>
              <Dropdown menu={exportMenu} trigger={['click']}>
                <Button type="primary" icon={<DownloadOutlined />} loading={exporting}>
                  导出
                </Button>
              </Dropdown>
            </Space>
          }
        />

        {/* 报告正文 */}
        <Card
          bordered={false}
          style={{
            marginTop: 12,
            border: '1px solid #F0F0F0',
            background: '#fff',
          }}
          bodyStyle={{ padding: '32px 40px', minHeight: 600 }}
        >
        <div {...({ [reportContainerAttr]: '' } as any)} ref={reportRef}>
          {nodes.map((n) => (
            <NodeRenderer
              key={n.id}
              node={n}
              editable={editing}
              onTextChange={handleTextChange}
              onPatch={handlePatch}
            />
          ))}
          {/* 报告尾部 */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 16,
              borderTop: '2px solid #1677FF',
              textAlign: 'right',
              color: '#8C8C8C',
              fontSize: 12,
            }}
          >
            — 报告结束 —
            <br />
            {isPlatformReport ? '××××医院信息科' : `${deptName}管理员`} · {new Date().toISOString().slice(0, 10)}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
};

export default ReportV34;
