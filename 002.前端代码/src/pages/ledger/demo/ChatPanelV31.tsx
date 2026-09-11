/**
 * 统一台账中心 - 智能化升级 Demo
 * §3.1.2 Agent 对话浮层组件(2026-07-03 V1.3 升级)
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.1.2:
 *   - 唤起 Agent 对话入口后,对话窗口顶部同步展示与 3.1.1 一致的态势汇报内容
 *   - 指标名称加粗可点击分流(无卡片)
 *   - 自然语言问答 + 推荐问句 + 跨中心聚合作答
 *   - 返回:答案、图表(mini 图表)、可下钻清单
 *   - 信息科管理员:全院;科室用户:本科室
 *
 * V1.2 升级要点(2026-07-03)视觉与接入中心 AgentAssistant 100% 对齐:
 *   - 面板尺寸:480 → 440(对齐 CHAT_WIDTH); 后扩到 560 承载指标清单; 2026-07-03 再统一抬到 480
 *     (历史轨迹: 480 → 440 → 560 → 480, 当前两处 Agent 对话窗口完全等宽)
 *   - 高度:min(80vh, 720px) → 660(对齐 CHAT_HEIGHT)
 *   - 顶栏:标题由「医小管·台账助手」+「全院数据权限/本科室数据权限·跨中心聚合」→ 简化为「医小管」+「全院数据权限·跨中心聚合」/「本科室数据权限·跨中心聚合」(副标题位置文字相同,主标题对齐)
 *   - 工具栏:MoreOutlined 下拉(报告/速读/清空)保留,与接入中心结构保持一致
 *   - 输入区:上传/图片/链接/重置 + TextArea/语音/发送 两行布局 → Space.Compact 单行紧凑布局(对齐接入中心 AgentAssistant 输入区)
 *   - 输入区底部:补充「医小管仅在您授权下处理数据, 全程仅操作本人表单(单文件 ≤ 30M)」对齐接入中心
 *   - 录音 banner:补 Alert 录音提示,完全对齐接入中心
 *   - 拖拽上传高亮:对齐接入中心 .agent-chat-dropzone / agentChatPanelIn keyframes
 *   - 保留独有:① 欢迎消息内嵌关键指标 + 分流链接(替代原顶部蓝条);② 推荐问句 chip(蓝色填充 + 圆角);③ mini chart + 下钻链接(聚合作答场景)
 * V1.3 升级要点(2026-07-03):
 *   - 删除对话窗口顶部「同步态势·全院」蓝条(原 89 行)
 *   - 态势汇报由机器人旁欢迎气泡统一承载(PRD §3.1.1)
 *   - 欢迎消息改为「一句式问候 + 关键指标内嵌文本 + 链接分流 + 推荐问句」,与接入中心 AgentAssistant 消息流一致
 *   - 关键指标可点击跳转状态列表,管理员/科室用户分别走全院/本科室口径
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Input,
  Button,
  Tag,
  Space,
  Empty,
  Segmented,
  Tooltip,
  Typography,
  Alert,
  message,
  Dropdown,
  Upload,
  type UploadProps,
} from 'antd';
import {
  SendOutlined,
  CloseOutlined,
  ThunderboltFilled,
  ReloadOutlined,
  MessageOutlined,
  CaretRightOutlined,
  AudioOutlined,
  PaperClipOutlined,
  LinkOutlined,
  FileTextOutlined,
  BellOutlined,
  MoreOutlined,
  ClearOutlined,
} from '@ant-design/icons';
// 视觉规范:机器人形象 100% 复用接入中心 AgentRobotIcon(保持与接入中心完全统一)
import AgentRobotIcon from '../../agent-center/smart/AgentRobotIcon';
import {
  buildPlatformAdminMetrics,
  buildDeptAdminMetrics,
  type StatusMetrics,
  type LedgerWelcomeAgent,
} from './StatusBubbleV31';

const { Text } = Typography;
const CHAT_PANEL_WIDTH = 480;

// ============ 类型 ============
interface MsgLinkItem {
  name: string;
  sub?: string;
  to: string;
}
interface MsgGuideAction {
  key: string;
  label: string;
  kind: 'navigate' | 'question' | 'view-detail';
  value: string;
  primary?: boolean;
}
interface MsgMiniBar {
  title: string;
  data: Array<{ name: string; value: number }>;
}
interface AgentMsg {
  id: string;
  role: 'agent' | 'user';
  // 文本片段（含加粗高亮 token）
  text: string;
  // 可点击分流清单
  links?: MsgLinkItem[];
  // mini 图表
  chart?: MsgMiniBar;
  // 推荐问句(仅欢迎语附带)
  suggestions?: string[];
  // PRD:欢迎语同步附带引导动作 / 气泡操作按钮
  guideActions?: MsgGuideAction[];
}

// ============ Mock 推荐问句 ============
// 管理员（§3.1.2 信息科管理员）：全院视角
const SUGGESTIONS_ADMIN = [
  '当前哪些智能体正在告警？',
  '我科室哪个智能体现在不能用？',
  '我想要查看【某智能体】的 360 画像',
  '请帮我生成今日全院智能体管理报告',
];
// 科室用户（§4.1.2 科室用户）：本科室视角
//   - 「我科室哪个智能体现在不能用?」「哪个智能体本月用得最多?」等贴合使用场景
const SUGGESTIONS_DEPT = [
  '哪个智能体本月用得最多?',
  '我科室哪个智能体现在不能用?',
  '查看【某智能体】的 360 画像',
];

const SUGGESTIONS_DETAIL = [
  '这个智能体的基本信息是什么？',
  '它适合处理哪些场景？',
  '它对接了哪些资源？',
  '它的评测结果怎么样？',
];

const detailOutOfScope = (detailView: 'profile' | 'detail') =>
  `超出当前智能体${detailView === 'profile' ? '360画像页' : '信息详情页'}信息范围，暂无法为您解答，我们将持续完善。`;

/** 详情页只回答页面已经呈现的结构化信息，不调用台账聚合推理。 */
const detailAnswer = (q: string, agent: LedgerWelcomeAgent, detailView: 'profile' | 'detail'): AgentMsg => {
  const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const reply = (text: string): AgentMsg => ({ id, role: 'agent', text });
  if (/基本信息|概况|介绍|是什么/.test(q)) {
    return reply(`【${agent.name}】编号为 **${agent.idCode || '—'}**，版本 **${agent.version || '—'}**，所属科室为 **${agent.department || '—'}**，诊疗环节为 **${agent.diagnosisPhase || '—'}**。`);
  }
  if (/名称|叫什么/.test(q)) return reply(`该智能体名称为【${agent.name}】。`);
  if (/编号|编码/.test(q)) return reply(`该智能体编号为 **${agent.idCode || '—'}**。`);
  if (/版本/.test(q)) return reply(`当前智能体版本为 **${agent.version || '—'}**。`);
  if (/科室|部门/.test(q)) return reply(`该智能体所属科室为 **${agent.department || '—'}**。`);
  if (/场景|功能|做什么|诊疗环节|适合/.test(q)) {
    return reply(`该智能体的诊疗环节为 **${agent.diagnosisPhase || '—'}**。功能描述：${agent.description || '暂无'}。`);
  }
  if (/来源|供应商|厂商/.test(q)) {
    return reply(`智能体来源为 **${agent.sourceType || '—'}**，供应商为 **${agent.vendor || '—'}**。`);
  }
  if (/联系人|联系方式|电话/.test(q)) {
    return reply(`技术联系人为 **${agent.techContact || '—'}**，联系方式为 **${agent.techContactPhone || '—'}**。`);
  }
  if (/风险/.test(q)) return reply(`当前风险分级为 **${agent.riskLevel || '—'}**。`);
  if (/运行状态|在线|上线|接入时间/.test(q)) {
    return reply(`当前运行状态为 **${agent.runtimeStatus || agent.availableStatus || '—'}**，接入时间为 **${agent.accessTime || '—'}**，上线时间为 **${agent.onlineTime || '—'}**。`);
  }
  if (/技术|模型|接入方式|接口/.test(q)) {
    return reply(`该智能体通过 **${agent.accessType || '—'}** 接入，使用模型 **${agent.modelName || '—'}**。敏感接口凭证仅按页面权限展示。`);
  }
  if (/资源|对接/.test(q)) {
    return reply(agent.resourceNames?.length ? `已对接资源：${agent.resourceNames.join('、')}。` : '当前页面显示该智能体暂无已对接资源。');
  }
  if (/评测|分数|得分/.test(q)) {
    return reply(agent.evaluationScore != null ? `当前页面显示的准入评测总分为 **${agent.evaluationScore} 分**。` : '当前页面暂无准入评测结果。');
  }
  return reply(detailOutOfScope(detailView));
};

// ============ 模拟回答生成 ============
const mockAnswer = (
  q: string,
  scope: string,
  metrics: StatusMetrics,
): AgentMsg => {
  const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. 告警
  if (q.includes('告警')) {
    return {
      id,
      role: 'agent',
      text: `根据监控中心最新事件,${scope}当前**有 ${metrics.alarmCount} 条告警**未关闭,以运行异常类为主(占比约 67%)。`,
      chart: {
        title: `${scope}告警类型分布`,
        data: [
          { name: '运行异常', value: 8 },
          { name: '接口超时', value: 3 },
          { name: '权限异常', value: 1 },
        ],
      },
      links: [
        { name: '影像AI辅助诊断系统', sub: '运行异常 · 3 次', to: '/app/monitoring/alert-events?agent=imagx' },
        { name: '智能导诊助手 v2.1', sub: '接口超时 · 2 次', to: '/app/monitoring/alert-events?agent=triage' },
        { name: '病历生成助手', sub: '权限异常 · 1 次', to: '/app/monitoring/alert-events?agent=emr' },
      ],
    };
  }

  // 2. 新增纳管
  if (q.includes('新增')) {
    return {
      id,
      role: 'agent',
      text: `接入中心近 30 天共**新增纳管 ${metrics.monthNew} 个**智能体,主要集中在**辅助诊断**与**病历生成**两个环节。`,
      chart: {
        title: '近 6 月新增智能体趋势',
        data: [
          { name: '1月', value: 4 },
          { name: '2月', value: 3 },
          { name: '3月', value: 5 },
          { name: '4月', value: 4 },
          { name: '5月', value: 6 },
          { name: '6月', value: metrics.monthNew },
        ],
      },
      links: [
        { name: '肺结节智能筛查系统 v2.0', sub: '影像科 · 6月12日上线', to: '/app/ledger/detail/lung-ai' },
        { name: '智能用药审核', sub: '药剂科 · 6月20日上线', to: '/app/ledger/detail/med-audit' },
      ],
    };
  }

  // 3. 待评测 / 评测进度
  if (q.includes('评测') || q.includes('审核')) {
    return {
      id,
      role: 'agent',
      text: `${scope}**待评测 ${metrics.pendingEval} 个、评测中 ${metrics.evaluating} 个**;最近一次评测完成平均用时 4.2 天,通过率 78%。`,
      links: [
        { name: '待评测 · 8 个', sub: '点击进入待评测列表', to: '/app/evaluation/tasks?tab=pending_eval' },
        { name: '评测中 · 4 个', sub: '点击进入评测中列表', to: '/app/evaluation/tasks?tab=evaluating' },
      ],
    };
  }

  // 4. 心内科 / 特定科室
  if (q.includes('心内科') || q.includes('科室') || q.includes('本科室')) {
    return {
      id,
      role: 'agent',
      text: `心内科当前纳管智能体 **3 个**,本月调用量合计 **8.4 万次**,正常运行率 **98.7%**,暂无未恢复告警。`,
      chart: {
        title: '心内科智能体本月调用分布',
        data: [
          { name: '心电分析', value: 42000 },
          { name: '冠脉CTA评估', value: 28000 },
          { name: '智能预问诊', value: 14000 },
        ],
      },
      links: [
        { name: '心电智能分析系统', sub: '在线 · 调用 4.2万', to: '/app/ledger/detail/ecg-ai' },
        { name: '冠脉CTA评估助手', sub: '在线 · 调用 2.8万', to: '/app/ledger/detail/cta-ai' },
        { name: '智能预问诊', sub: '在线 · 调用 1.4万', to: '/app/ledger/detail/pretriage' },
      ],
    };
  }

  // 4.b 科室用户专有:本科室哪个智能体不能用(可用状态)
  //  PRD §4.1.2 M1.5 聚合作答 + §4.2.3 字段「可用状态」
  if (scope === '本科室' && (q.includes('不能用') || q.includes('不可用') || q.includes('可用状态'))) {
    return {
      id,
      role: 'agent',
      text: `本科室当前有 **1 个智能体受故障影响暂时不可用** —— 冠脉 CTA 评估助手(EMR 字段映射异常,已通知厂商处理中);其余 10 个智能体运行正常。`,
      links: [
        { name: '冠脉 CTA 评估助手', sub: 'EMR 字段映射异常 · 处理中', to: '/app/ledger/detail/cta-ai' },
        { name: '查看本科室全部智能体', to: '/app/ledger/list' },
      ],
    };
  }

  // 4.c 科室用户专有:本月调用量最高(本科室视角)
  //  PRD §4.1.2 + §4.2.3「本科室调用量」
  if (scope === '本科室' && q.includes('调用量')) {
    return {
      id,
      role: 'agent',
      text: `本科室**本月调用量最高的智能体**为心电智能分析系统,累计调用 **4.2 万次**,日均 1400+ 次,占本科室本月调用量的 **38%**。`,
      chart: {
        title: '本科室本月调用量 TOP5',
        data: [
          { name: '心电分析', value: 42000 },
          { name: '冠脉CTA评估', value: 28000 },
          { name: '智能预问诊', value: 14000 },
          { name: '心内查房助手', value: 8500 },
          { name: '用药审核', value: 6200 },
        ],
      },
      links: [
        { name: '心电智能分析系统', sub: '调用 4.2万 · 活跃 38%', to: '/app/ledger/detail/ecg-ai' },
        { name: '冠脉 CTA 评估助手', sub: '调用 2.8万', to: '/app/ledger/detail/cta-ai' },
        { name: '智能预问诊', sub: '调用 1.4万', to: '/app/ledger/detail/pretriage' },
      ],
    };
  }

  // 4.d 科室用户专有:活跃度(本科室视角) — PRD §4.2.3「活跃度」字段
  if (scope === '本科室' && q.includes('活跃度')) {
    return {
      id,
      role: 'agent',
      text: `本科室**本月活跃度最高的智能体**为心电智能分析系统,活跃用户 **42 人**,人均日使用频次 **8.3 次**,覆盖本科室 87% 的医生。`,
      chart: {
        title: '本科室智能体活跃用户数',
        data: [
          { name: '心电分析', value: 42 },
          { name: '冠脉CTA评估', value: 31 },
          { name: '智能预问诊', value: 28 },
          { name: '心内查房助手', value: 19 },
          { name: '用药审核', value: 16 },
        ],
      },
      links: [
        { name: '心电智能分析系统', sub: '活跃 42 人 · 87% 覆盖', to: '/app/ledger/detail/ecg-ai' },
        { name: '查看本科室活跃详情', to: '/app/monitoring/business?preset=activeUsers&range=monthly' },
      ],
    };
  }

  // 5. 故障 TOP5
  if (q.includes('故障') && (q.includes('TOP') || q.includes('最多'))) {
    return {
      id,
      role: 'agent',
      text: `过去 7 天${scope}**故障 TOP5 智能体**如下(按故障次数降序):`,
      chart: {
        title: '故障次数 TOP5',
        data: [
          { name: '影像AI', value: 5 },
          { name: '智能导诊', value: 4 },
          { name: '病历生成', value: 3 },
          { name: '用药审核', value: 2 },
          { name: '心电分析', value: 1 },
        ],
      },
      links: [
        { name: '影像AI辅助诊断系统', sub: '5 次 · 已恢复 3', to: '/app/ledger/detail/imagx' },
        { name: '智能导诊助手 v2.1', sub: '4 次 · 已恢复 4', to: '/app/ledger/detail/triage' },
        { name: '病历生成助手', sub: '3 次 · 已恢复 2', to: '/app/ledger/detail/emr' },
      ],
    };
  }

  // 6. 调用量最高
  if (q.includes('调用')) {
    return {
      id,
      role: 'agent',
      text: `${scope}**本月调用量最高的智能体**为影像AI辅助诊断系统,累计调用 **12.4 万次**,日均 4100+ 次,在线率 99.2%。`,
      links: [
        { name: '查看本月调用 TOP10', to: '/app/monitoring/business?preset=callVolume&range=monthly' },
        { name: '查看影像AI详情', to: '/app/ledger/detail/imagx' },
      ],
    };
  }

  // 7. 生成报告
  if (q.includes('报告')) {
    return {
      id,
      role: 'agent',
      text: `好的,正在为你聚合**${scope}智能体管理情况**数据……(建设中,可在「台账总览→生成报告」直接生成图文报告)。`,
      links: [
        { name: '立即生成报告', to: '/app/ledger-demo/report' },
      ],
    };
  }

  // 兜底
  return {
    id,
    role: 'agent',
    text: `已收到你的提问:"${q}",我正在跨接入中心/评测中心/监控中心聚合数据,稍后给你准确答复。`,
    links: [{ name: '查看全部智能体', to: '/app/ledger/list' }],
  };
};

// ============ 简易 mini 柱状图(纯 SVG,无需图表库) ============
const MiniBar: React.FC<{ data: Array<{ name: string; value: number }>; title: string }> = ({
  data,
  title,
}) => {
  const W = 380;
  const H = 160;
  const padding = { top: 28, right: 16, bottom: 36, left: 36 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const barW = innerW / data.length;
  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        background: '#FAFAFA',
        borderRadius: 6,
        border: '1px solid #F0F0F0',
      }}
    >
      <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>📊 {title}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* Y 轴网格 */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = padding.top + innerH * (1 - p);
          return (
            <g key={p}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerW}
                y2={y}
                stroke="#F0F0F0"
                strokeWidth={1}
              />
              <text
                x={padding.left - 4}
                y={y + 3}
                fontSize={9}
                fill="#8C8C8C"
                textAnchor="end"
              >
                {Math.round(maxV * p)}
              </text>
            </g>
          );
        })}
        {/* 柱 */}
        {data.map((d, i) => {
          const h = (d.value / maxV) * innerH;
          const x = padding.left + i * barW + barW * 0.15;
          const w = barW * 0.7;
          const y = padding.top + innerH - h;
          return (
            <g key={d.name}>
              <rect x={x} y={y} width={w} height={h} fill="#1677FF" rx={2} />
              <text
                x={x + w / 2}
                y={y - 3}
                fontSize={9}
                fill="#262626"
                textAnchor="middle"
              >
                {d.value}
              </text>
              <text
                x={x + w / 2}
                y={H - padding.bottom + 14}
                fontSize={9}
                fill="#595959"
                textAnchor="middle"
              >
                {d.name.length > 6 ? d.name.slice(0, 6) + '…' : d.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ============ 消息渲染 ============
const renderAgentMsg = (
  m: AgentMsg,
  navigate: (to: string) => void,
  onQuestion: (question: string) => void,
  onViewDetail?: () => void,
) => {
  // 把 **xxx** 转成 <strong>，其余当文本
  const parts = m.text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#262626' }}>
        {parts.map((p, idx) =>
          p.startsWith('**') && p.endsWith('**') ? (
            <strong key={idx} style={{ color: '#1677FF' }}>
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={idx}>{p}</span>
          ),
        )}
      </div>
      {m.guideActions && m.guideActions.length > 0 && (
        <div
          data-testid="ledger-chat-guide-actions"
          style={{
            marginTop: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {m.guideActions.map((action) => (
            <button
              key={action.key}
              type="button"
              data-testid={`ledger-chat-guide-action-${action.key}`}
              onClick={() => {
                if (action.kind === 'navigate') {
                  navigate(action.value);
                } else if (action.kind === 'view-detail') {
                  onViewDetail?.();
                } else {
                  onQuestion(action.value);
                }
              }}
              style={{
                padding: '5px 9px',
                borderRadius: 4,
                border: action.primary ? '1px solid #1677FF' : '1px solid #D6E4FF',
                background: action.primary ? '#1677FF' : '#F0F5FF',
                color: action.primary ? '#FFFFFF' : '#1677FF',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {m.chart && <MiniBar title={m.chart.title} data={m.chart.data} />}
      {m.links && m.links.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#8C8C8C', marginBottom: 4 }}>
            点击查看:
          </div>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {m.links.map((l) => (
              <div
                key={l.name + l.to}
                onClick={() => navigate(l.to)}
                style={{
                  padding: '6px 8px',
                  background: '#F0F5FF',
                  border: '1px solid #D6E4FF',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = '#E6F4FF')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = '#F0F5FF')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CaretRightOutlined style={{ color: '#1677FF', fontSize: 11 }} />
                  <span style={{ fontSize: 13, color: '#262626' }}>{l.name}</span>
                </div>
                {l.sub && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {l.sub}
                  </Text>
                )}
              </div>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
};

// ============ 主体 ============
export interface ChatPanelV31Props {
  scope: 'platform_admin' | 'dept_admin';
  pageKind?: 'overview' | 'list' | 'detail' | 'global';
  detailAgent?: LedgerWelcomeAgent;
  detailView?: 'profile' | 'detail';
  onClose: () => void;
  // V1.1：与父组件配合的快捷操作
  onGenerateReport?: () => void;
  onSubscribeBriefing?: () => void;
  onViewDetail?: () => void;
}

export const ChatPanelV31: React.FC<ChatPanelV31Props> = ({
  scope,
  pageKind = 'overview',
  detailAgent,
  detailView = 'profile',
  onClose,
  onGenerateReport,
  onSubscribeBriefing,
  onViewDetail,
}) => {
  const navigate = useNavigate();
  const metrics: StatusMetrics = useMemo(
    () => (scope === 'platform_admin' ? buildPlatformAdminMetrics() : buildDeptAdminMetrics()),
    [scope],
  );

  const suggestions = useMemo(
    () => (pageKind === 'detail' ? SUGGESTIONS_DETAIL : scope === 'platform_admin' ? SUGGESTIONS_ADMIN : SUGGESTIONS_DEPT),
    [pageKind, scope],
  );

  const [msgs, setMsgs] = useState<AgentMsg[]>([]);
  const [input, setInput] = useState('');
  // PRD §3.1.2 操作表:语音输入(演示态)
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // V1.3 初始欢迎语：态势汇报已由机器人旁的欢迎气泡统一承载，
  //   对话窗口不再顶部蓝条重复；欢迎语改为「一句式问候 + 关键指标 + 推荐问句」，
  //   关键指标内嵌可点击分流链接，与接入中心 AgentAssistant 消息流视觉一致。
  useEffect(() => {
    const isDept = metrics.scopeLabel !== '全院';
    const activeDetailAgent: LedgerWelcomeAgent = detailAgent || {
      name: '当前智能体',
      availableStatus: '未知',
      monthlyCalls: 0,
      alarmCount: metrics.alarmCount,
      faultCount: metrics.faultCount,
    };
    if (pageKind === 'detail') {
      const detailText = `您好，我是**医小管**。当前为您展示【${activeDetailAgent.name}】的${detailView === 'profile' ? '360画像' : '信息详情'}，有什么该智能体相关问题可以直接问我~`;
      setMsgs([
        {
          id: 'welcome',
          role: 'agent',
          text: detailText,
          suggestions,
        },
      ]);
      return;
    }
    // 拼接首条 agent 消息的态势数据
    //   管理员：全院智能体 X · 本月新增 X · 待评测 X · 评测中 X · 告警/故障/恢复
    //   科室：本月调用量 X · 正常运行率 X% · 评测中 X · 告警/故障/恢复
    const overviewText = isDept
      ? pageKind === 'global'
        ? `这是本科室智能体今日使用速览：本科室智能体 **${metrics.totalAgents}** 个、本月新增 **${metrics.monthNew}** 个；本月调用量 **${metrics.monthlyCallVolume.toLocaleString()}** 次、正常运行率 **${metrics.onlineRatePercent.toFixed(1)}%**；今日告警 **${metrics.alarmCount}** 次、故障 **${metrics.faultCount}** 次、已恢复 **${metrics.recoveredCount}** 次；评测中 **${metrics.evaluating}** 个。建议优先关注影响使用的告警与故障。`
        : `顶部是本科室今日使用速览，科室台账直接问我（作答限于本科室授权范围）。`
      : pageKind === 'global'
        ? `这是今日全院智能体台账速览：全院智能体 **${metrics.totalAgents}** 个、本月新增纳管 **${metrics.monthNew}** 个；待评测 **${metrics.pendingEval}** 个、评测中 **${metrics.evaluating}** 个；今日告警 **${metrics.alarmCount}** 次、故障 **${metrics.faultCount}** 次、已恢复 **${metrics.recoveredCount}** 次，建议优先处理告警与故障。需要的话，我可以一键生成《全院智能体管理情况报告》，也可订阅台账速读（日 / 周）。`
        : `台账相关问题都可以直接问我。推荐问题（欢迎语下方展示，点击即问）：`;
    // 关键指标分流链接（每条都是可点击的 a 标签，与 mockAnswer 内的渲染保持一致风格）
    const overviewLinks: MsgLinkItem[] = isDept
      ? [
          { name: `本月调用量 ${metrics.monthlyCallVolume.toLocaleString()}`, sub: '点击查看本月调用量详情', to: '/app/monitoring/business?preset=callVolume&range=monthly' },
          { name: `正常运行率 ${metrics.onlineRatePercent.toFixed(1)}%`, sub: '点击查看正常运行率详情', to: '/app/monitoring/business?preset=onlineRate&range=monthly' },
          { name: `评测中 ${metrics.evaluating}`, sub: '点击查看评测中清单', to: '/app/evaluation/tasks?tab=evaluating' },
          { name: `告警 ${metrics.alarmCount} 次`, sub: '点击查看告警清单', to: '/app/monitoring/alert-events?tab=pending_handle' },
          { name: `故障 ${metrics.faultCount} 次`, sub: '点击查看故障清单', to: '/app/monitoring/alert-events?tab=fault' },
          { name: `恢复 ${metrics.recoveredCount} 次`, sub: '点击查看已恢复清单', to: '/app/monitoring/alert-events?tab=recovered' },
        ]
      : [
          { name: `全院智能体 ${metrics.totalAgents}`, sub: '点击查看全院智能体列表', to: '/app/ledger/list' },
          { name: `本月新增 ${metrics.monthNew}`, sub: '点击查看本月新增', to: '/app/ledger/list?accessMonth=' + new Date().toISOString().slice(0, 7) },
          { name: `待评测 ${metrics.pendingEval}`, sub: '点击查看待评测清单', to: '/app/evaluation/tasks?tab=pending_eval' },
          { name: `评测中 ${metrics.evaluating}`, sub: '点击查看评测中清单', to: '/app/evaluation/tasks?tab=evaluating' },
          { name: `告警 ${metrics.alarmCount} 次`, sub: '点击查看告警清单', to: '/app/monitoring/alert-events?tab=pending_handle' },
          { name: `故障 ${metrics.faultCount} 次`, sub: '点击查看故障清单', to: '/app/monitoring/alert-events?tab=fault' },
          { name: `恢复 ${metrics.recoveredCount} 次`, sub: '点击查看已恢复清单', to: '/app/monitoring/alert-events?tab=recovered' },
          { name: '生成报告', sub: '生成《全院智能体管理情况报告》', to: '/app/ledger-demo/report' },
          { name: '订阅速读', sub: '订阅台账速读（日 / 周）', to: '/app/ledger-demo/report?openSubscribe=1' },
        ];
    const overviewGuideActions: MsgGuideAction[] = isDept
      ? pageKind === 'list'
        ? [
            {
              key: 'list-search',
              label: '检索智能体',
              kind: 'navigate',
              value: '/app/ledger/list',
              primary: true,
            },
            {
              key: 'list-filter',
              label: '筛选 / 排序',
              kind: 'navigate',
              value: '/app/ledger/list',
            },
            {
              key: 'list-detail',
              label: '进入 360 画像',
              kind: 'navigate',
              value: '/app/ledger/detail/AGT-2025-002',
            },
            {
              key: 'list-ask',
              label: '本科室台账问答',
              kind: 'question',
              value: '我科室哪个智能体现在不能用？',
            },
          ]
        : pageKind === 'global'
          ? [
              {
                key: 'global-alerts',
                label: '同步态势分流',
                kind: 'navigate',
                value: '/app/monitoring/alert-events?tab=pending_handle',
                primary: true,
              },
              {
                key: 'global-drilldown',
                label: '聚合作答下钻',
                kind: 'question',
                value: '请汇总本科室告警、故障和可下钻清单',
              },
              {
                key: 'global-agents',
                label: '本科室智能体',
                kind: 'navigate',
                value: '/app/ledger/list',
              },
            ]
          : [
              {
                key: 'dept-alerts',
                label: '查看本科室告警',
                kind: 'navigate',
                value: '/app/monitoring/alert-events?tab=pending_handle',
                primary: true,
              },
              {
                key: 'dept-report',
                label: '生成报告',
                kind: 'navigate',
                value: '/app/ledger-demo/report',
              },
              {
                key: 'dept-subscribe',
                label: '订阅速读',
                kind: 'navigate',
                value: '/app/ledger-demo/report?openSubscribe=1',
              },
              {
                key: 'dept-ask',
                label: '唤起对话提问',
                kind: 'question',
                value: '我科室哪个智能体现在不能用？',
              },
            ]
      : [
          {
            key: 'report',
            label: '生成报告',
            kind: 'navigate',
            value: '/app/ledger-demo/report',
            primary: true,
          },
          {
            key: 'subscribe',
            label: '订阅速读',
            kind: 'navigate',
            value: '/app/ledger-demo/report?openSubscribe=1',
          },
          {
            key: 'alerts',
            label: '查看告警',
            kind: 'navigate',
            value: '/app/monitoring/alert-events?tab=pending_handle',
          },
          {
            key: 'ask-alerts',
            label: '当前告警问答',
            kind: 'question',
            value: '当前哪些智能体正在告警？',
          },
        ];

    const welcome: AgentMsg = {
      id: 'welcome',
      role: 'agent',
      text: isDept
        ? `你好，我是**医小管**。${overviewText}`
        : `你好，我是**医小管**！${overviewText}`,
      links: overviewLinks,
      guideActions: overviewGuideActions,
      suggestions,
    };
    setMsgs([welcome]);
  }, [detailAgent, detailView, metrics, pageKind, scope, suggestions]);

  // 消息追加时滚到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs.length]);

  const handleSend = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const userMsg: AgentMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: q,
    };
    setMsgs((prev) => [...prev, userMsg]);
    setInput('');
    // 模拟思考延迟
    setTimeout(() => {
      setMsgs((prev) => [
        ...prev,
        pageKind === 'detail'
          ? detailAnswer(q, detailAgent || { name: '当前智能体', availableStatus: '未知', monthlyCalls: 0, alarmCount: 0, faultCount: 0 }, detailView)
          : mockAnswer(q, metrics.scopeLabel, metrics),
      ]);
    }, 450);
  };

  // V1.1：上传配置(对接中心一致:PDF+图片,≤30M)
  const uploadProps: UploadProps = {
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isImg = file.type.startsWith('image/');
      const le30 = file.size / 1024 / 1024 <= 30;
      if (!(isPdf || isImg)) {
        message.warning('仅支持 PDF / 图片(单文件 ≤30M)');
        return Upload.LIST_IGNORE;
      }
      if (!le30) {
        message.warning('文件大小不能超过 30M');
        return Upload.LIST_IGNORE;
      }
      message.success(`已识别附件: ${file.name}(台账问答辅助参考)`);
      // 演示态:不真正上传,仅在对话区回显一条提示
      setMsgs((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          text: `📎 ${file.name}`,
        },
        {
          id: `m-${Date.now()}`,
          role: 'agent',
          text: `已收到附件,我已结合台账数据解析;台账问答以查询为主,附件可作为补充信息。如需更精确的回答,建议在提问时说明关注指标(如"本月调用""告警汇总")。`,
        },
      ]);
      return false; // 阻止默认上传
    },
  };

  // 工具栏菜单(快捷操作)
  const toolbarMenu = {
    items: [
      onGenerateReport && {
        key: 'report',
        label: '生成报告',
        icon: <FileTextOutlined />,
        onClick: () => {
          onClose();
          onGenerateReport();
        },
      },
      onSubscribeBriefing && {
        key: 'subscribe',
        label: '订阅速读',
        icon: <BellOutlined />,
        onClick: () => {
          onClose();
          onSubscribeBriefing();
        },
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'clear',
        label: '清空对话',
        icon: <ClearOutlined />,
        disabled: msgs.length === 0,
        onClick: () => setMsgs([]),
      },
    ].filter(Boolean) as any,
  };

  return (
    <>
      {/* 浮层展开 / 收起 keyframes — 与接入中心 AgentAssistant 完全一致 */}
      <style>{`
        @keyframes agentChatPanelIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
      <div
        data-testid="ledger-chat-panel"
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1200,
          // V1.4 视觉对齐接入中心 AgentAssistant:CHAT_PANEL_WIDTH 480(2026-07-03 与接入中心同步抬到 480)
          width: CHAT_PANEL_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
          height: 660,
          maxHeight: 'calc(100vh - 48px)',
          background: '#FFFFFF',
          borderRadius: 12,
          // 与接入中心 boxShadow 保持完全一致
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'agentChatPanelIn 250ms ease-out',
        }}
      >
      {/* ===== 顶栏 — V1.2 与接入中心 AgentAssistant 标题结构完全一致 =====
          主标题统一为「医小管」,副标题保留场景信息「全院数据权限 · 跨中心聚合」/「本科室数据权限 · 跨中心聚合」 */}
      <div
        style={{
          height: 48,
          padding: '0 12px 0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #F0F0F0',
          background: 'linear-gradient(90deg, #F0F8FF 0%, #FFFFFF 100%)',
        }}
      >
        <Space size={10}>
          <div style={{ width: 32, height: 32 }}>
            <AgentRobotIcon mood="idle" size={32} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1F1F1F' }}>医小管</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {scope === 'platform_admin' ? '全院数据权限' : '本科室数据权限'} · 跨中心聚合
            </Text>
          </div>
        </Space>
        <Space size={4}>
          <Dropdown menu={toolbarMenu} trigger={['click']}>
            <Tooltip title="快捷操作">
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Tooltip>
          </Dropdown>
          <Tooltip title="收起对话（不清空会话）">
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
          </Tooltip>
        </Space>
      </div>

      {/* V1.3 移除对话窗口顶部「同步态势·全院」蓝条
          原因：态势汇报由机器人旁的欢迎气泡统一承载（PRD §3.1.1），对话窗口内不再重复展示
          - 删除 89 行顶部蓝条
          - 欢迎消息内仍以一句式问句引导（详见下方 AgentMsg welcome）
          - 关键指标分流仍由每条 agent 回答内的 links/chart 承接（与接入中心一致） */}

      {/* ===== 消息流 ===== */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 12,
          background: '#FAFAFA',
        }}
      >
        {msgs.length === 0 && <Empty description="暂无消息" />}
        {msgs.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 10,
            }}
          >
            {m.role === 'agent' && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  marginRight: 6,
                  marginTop: 2,
                }}
              >
                <AgentRobotIcon mood="idle" size={32} />
              </div>
            )}
            <div
              style={{
                maxWidth: '78%',
                padding: '8px 10px',
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                background: m.role === 'user' ? '#1677FF' : '#FFFFFF',
                color: m.role === 'user' ? '#fff' : '#262626',
                fontSize: 13,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {m.role === 'user' ? (
                m.text
              ) : (
                <>
                  {renderAgentMsg(
                    m,
                    (to) => {
                      onClose();
                      navigate(to);
                    },
                    handleSend,
                    pageKind === 'detail'
                      ? () => {
                          onViewDetail?.();
                          onClose();
                        }
                      : undefined,
                  )}
                  {m.suggestions && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #F0F0F0' }}>
                      <div style={{ fontSize: 11, color: '#8C8C8C', marginBottom: 4 }}>
                        💡 推荐问句(点击直接提问):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {m.suggestions.map((s) => (
                          <Tag
                            key={s}
                            color="blue"
                            style={{ cursor: 'pointer', margin: 0 }}
                            onClick={() => handleSend(s)}
                          >
                            {s}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {m.role === 'user' && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#13C2C2',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginLeft: 6,
                  marginTop: 2,
                }}
              >
                <MessageOutlined style={{ fontSize: 13 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== 输入区 — V1.2 与接入中心 AgentAssistant 完全一致 =====
          Space.Compact 单行:上传/链接/语音/TextArea/发送,底部保留版权提示 */}
      <div
        style={{
          borderTop: '1px solid #F0F0F0',
          padding: 8,
          background: '#FFFFFF',
        }}
      >
        {recording && (
          <Alert
            type="warning"
            showIcon
            message="正在录音…再次点击 🎤 结束录音并自动转写"
            style={{ marginBottom: 8, fontSize: 12, padding: '4px 10px' }}
            banner
          />
        )}
        <Space.Compact style={{ width: '100%' }}>
          <Upload {...uploadProps}>
            <Button icon={<PaperClipOutlined />} title="上传 PDF / 图片" />
          </Upload>
          <Button
            icon={<LinkOutlined />}
            title="粘贴链接自动识别"
            onClick={() => {
              const url = window.prompt('请粘贴链接 URL');
              if (url && /^https?:\/\//.test(url)) {
                setMsgs((prev) => [
                  ...prev,
                  { id: `u-${Date.now()}`, role: 'user', text: `发送链接：${url}` },
                ]);
                setTimeout(() => {
                  setMsgs((prev) => [
                    ...prev,
                    {
                      id: `m-${Date.now()}`,
                      role: 'agent',
                      text: `已抓取链接内容，台账问答以查询为主，可结合此链接继续提问。`,
                    },
                  ]);
                }, 800);
              }
            }}
          />
          <Button
            icon={<AudioOutlined />}
            type={recording ? 'primary' : 'default'}
            onClick={() => {
              setRecording((r) => !r);
              if (!recording) {
                // 演示用：点击后 1.8s 模拟"已识别" + 自动填充文本
                setTimeout(() => {
                  const sample =
                    scope === 'platform_admin'
                      ? '当前哪些智能体正在告警？'
                      : '我科室哪个智能体现在不能用？';
                  setInput(sample);
                  setRecording(false);
                  message.info({ content: '语音识别完成（演示）', duration: 1.2 });
                }, 1800);
              }
            }}
            title="点击 / 长按 语音输入"
          />
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="描述你想了解的台账信息，或粘贴链接（Enter 发送）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleSend()}
            disabled={!input.trim()}
            title="发送（Enter）"
          />
        </Space.Compact>
        {/* 底部数据授权提示 — 完全对齐接入中心 AgentAssistant */}
        <div style={{ marginTop: 6, fontSize: 11, color: '#999', textAlign: 'center' }}>
          <ThunderboltFilled /> 医小管仅在您授权下处理数据，全程仅操作本人表单（单文件 ≤ 30M）
        </div>
      </div>
    </div>
    </>
  );
};

export default ChatPanelV31;
