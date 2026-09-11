/**
 * §3.1.1 消息气泡组件
 *
 * 12 种消息类型 (text / file-detect / image-detect / link-detect /
 * detecting / prefill / autofix-req / autofix-done / error /
 * pre-audit-summary / pre-audit-issue / pre-audit-test / pre-audit-verdict)
 * 按 type 分发渲染。
 *
 * §4.2.1 智能预审:问题汇总 / 单条问题 / 联通测试 / 预审结论 全部由 Agent 对话窗口呈现
 *   (不在审核注册页新增独立面板 / 卡片 / 状态条)
 */
import { useMemo, useState } from 'react';
import React from 'react';
import { Button, Checkbox, Radio, Space, Tag, Tooltip, Typography } from 'antd';
import {
  ApiOutlined,
  BarChartOutlined,
  BugOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FilePdfOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  LoadingOutlined,
  AudioOutlined,
  MessageOutlined,
  PictureOutlined,
  RocketOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AgentMessage, InsightProgress } from './types';
import { confidenceLevel } from './types';

const { Text } = Typography;

const REGISTER_FIELD_LABELS: Record<string, string> = {
  name: '智能体名称',
  agentCode: '智能体编号',
  version: '智能体版本',
  modelName: '使用模型名称',
  modelVersion: '使用模型版本',
  modelDeploymentMode: '模型部署方式',
  department: '所属科室',
  clinicalStage: '诊疗环节',
  clinicalStageCustom: '诊疗环节（其他）',
  description: '功能描述',
  source: '智能体来源',
  supplier: '供应商名称',
  contactName: '技术联系人',
  contactPhone: '联系方式',
  accessMode: '接入方式',
  apiEndpoint: '接口地址',
  apiKey: 'API key',
  platformUrl: '平台 URL 地址',
  platformKey: '平台密钥 key',
  trackingCode: '埋点代码生成',
};

const NEED_FIELD_LABELS: Record<string, string> = {
  name: '需求标题',
  department: '提出科室',
  reason: '提出原因',
  proposer: '提出人',
  contactPhone: '联系方式',
  clinicalStage: '诊疗环节',
  clinicalStageCustom: '诊疗环节（其他）',
  description: '功能描述',
  resources: '所需资源',
  urgency: '需求紧急程度',
};

const RESOURCE_FIELD_LABELS: Record<string, string> = {
  resources: '资源列表',
  owner: '资源负责人',
  contact: '联系方式',
  protocol: '对接方式',
  version: 'HL7 版本',
  url: 'URL 地址',
  key: '密钥 Key',
  dbType: '数据库类型',
  mqType: 'MQ 类型',
  broker: 'Broker 地址',
  auth: '认证方式',
};

const APPLY_FIELD_LABELS: Record<string, string> = {
  agentId: '选择智能体',
  resourceIds: '申请资源名称',
  reason: '申请理由',
};

const PROJECT_FIELD_LABELS: Record<string, string> = {
  name: '项目名称',
  department: '申报科室',
  superiorDepartment: '上级部门',
  track: '申报赛道',
  leader: '项目负责人',
  contact: '项目联系人',
  phone: '联系方式',
  supports: '希望获得的支持',
  overview: '项目概述',
  painPoints: '项目解决的痛点',
  technologies: '项目运用的核心技术',
  models: '项目运用的大模型',
  deliverables: '项目完成形式',
  assessmentIndicators: '考核指标',
  totalBudget: '已有经费来源合计',
  fundingDetail: '具体来源明细',
  spendingDetail: '具体使用明细',
};

const AUDIT_PROJECT_FIELD_LABELS: Record<string, string> = {
  completion: '完成度',
  completionNote: '建设完成情况说明',
  used: '已使用金额',
  fundDetail: '资金使用明细',
};

const isNeedDetectedFields = (fields?: Array<{ fieldKey: string }>) =>
  Boolean(fields?.some((field) => ['reason', 'proposer', 'resources', 'urgency'].includes(field.fieldKey)));

const isResourceDetectedFields = (fields?: Array<{ fieldKey: string }>) =>
  Boolean(fields?.some((field) => ['owner', 'contact', 'protocol', 'dbType', 'mqType', 'broker'].includes(field.fieldKey)));

const getDetectedFieldLabel = (
  fieldKey: string,
  fields?: Array<{ fieldKey: string; value?: string }>,
) => {
  if (fields?.some((field) => ['completion', 'completionNote', 'used', 'fundDetail'].includes(field.fieldKey))) {
    return AUDIT_PROJECT_FIELD_LABELS[fieldKey] || fieldKey;
  }
  if (fields?.some((field) => ['superiorDepartment', 'leader', 'fundingDetail', 'spendingDetail'].includes(field.fieldKey))) {
    return PROJECT_FIELD_LABELS[fieldKey] || fieldKey;
  }
  if (fields?.some((field) => field.fieldKey === 'agentId' || field.fieldKey === 'resourceIds')) {
    return APPLY_FIELD_LABELS[fieldKey] || fieldKey;
  }
  if (isResourceDetectedFields(fields)) {
    const protocol = fields?.find((field) => field.fieldKey === 'protocol')?.value;
    if (fieldKey === 'transport') return protocol === 'FHIR' ? '接口协议类型' : '协议类型';
    if (fieldKey === 'ip') return protocol === 'DICOM' ? 'DICOM IP 地址' : 'IP 地址';
    if (fieldKey === 'port') return protocol === 'DICOM' ? 'DICOM 端口' : protocol === 'HL7' ? '端口号' : '端口';
    if (fieldKey === 'name' && protocol === 'DICOM') return 'DICOM 名称';
    return RESOURCE_FIELD_LABELS[fieldKey] || fieldKey;
  }
  return (isNeedDetectedFields(fields) ? NEED_FIELD_LABELS[fieldKey] : REGISTER_FIELD_LABELS[fieldKey]) || fieldKey;
};

/**
 * 文件识别 / 图片识别 / 链接抓取 / 文字语音识别气泡
 * 取代旧的「全部采纳 + 每字段一个按钮」: 改为「多选 Checkbox + 底部「确认采纳 (N)」主按钮」
 * - 与 PRD §3.2.1 智能预审 / 智能审查「勾选 + 确认采纳」交互同构
 * - 取消「高置信度自动采纳」: 即便 confidence >= 0.9, 仍需用户显式勾选才能确认
 * - 默认按置信度从高到低排序; 已采纳字段 (acknowledged === true) 在 store 层识别, 默认排除
 */
interface FileDetectBubbleProps {
  msg: AgentMessage;
  onAcknowledgeFields?: (fieldKeys: string[]) => void;
  /** 兼容旧的单字段采纳回调 (仅在没有任何字段时可走兜底分支) */
  onAcknowledge?: (fieldKey: string) => void;
}
const FileDetectBubble = ({ msg, onAcknowledgeFields, onAcknowledge }: FileDetectBubbleProps) => {
  const wrap: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: 12,
  };
  const bubble: React.CSSProperties = {
    maxWidth: '84%',
    background: '#FFFFFF',
    color: '#1F1F1F',
    padding: '10px 14px',
    borderRadius: 12,
    borderTopLeftRadius: 4,
    fontSize: 13,
    lineHeight: 1.6,
    border: '1px solid #F0F0F0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  };
  // 字段按 confidence 倒序; 已被 store 标记 acknowledged=true 的字段(已采纳)排除,不让用户重复操作
  const allFields = msg.payload?.detectedFields ?? [];
  const pendingFields = useMemo(
    () => [...allFields].sort((a, b) => b.confidence - a.confidence),
    [allFields],
  );
  // 兜底: 如果 store 没有 acknowledged 标志(单测/旧数据), 仍按字段全选
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pendingFields.map((f) => f.fieldKey)),
  );
  const allSelected = pendingFields.length > 0 && selected.size === pendingFields.length;
  const noneSelected = selected.size === 0;
  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pendingFields.map((f) => f.fieldKey)));
  };
  const onConfirm = () => {
    if (noneSelected) return;
    if (onAcknowledgeFields) {
      onAcknowledgeFields(pendingFields.filter((f) => selected.has(f.fieldKey)).map((f) => f.fieldKey));
    } else if (onAcknowledge) {
      // 兜底分支: 走旧接口逐字段采纳
      pendingFields.filter((f) => selected.has(f.fieldKey)).forEach((f) => onAcknowledge(f.fieldKey));
    }
    setSelected(new Set());
  };
  return (
    <div style={wrap}>
      <div style={bubble}>
        <Space size={6} style={{ marginBottom: 6 }}>
          {msg.type === 'file-detect' ? (
            <Tag color="blue" icon={<FilePdfOutlined />}>
              文件识别
            </Tag>
          ) : msg.type === 'image-detect' ? (
            <Tag color="purple" icon={<PictureOutlined />}>
              图片识别
            </Tag>
          ) : msg.type === 'text-detect' ? (
            <Tag
              color="green"
              icon={msg.payload?.recognitionMode === 'voice' ? <AudioOutlined /> : <MessageOutlined />}
            >
              {msg.payload?.recognitionMode === 'voice' ? '语音识别' : '文字识别'}
            </Tag>
          ) : (
            <Tag color="cyan" icon={<LinkOutlined />}>
              链接抓取
            </Tag>
          )}
          {msg.payload?.fileName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {msg.payload.fileName}
            </Text>
          )}
        </Space>
        <div style={{ marginBottom: 8 }}>{msg.content}</div>
        {pendingFields.length > 0 ? (
          <div
            style={{
              background: '#F5F5F5',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
            }}
          >
            {pendingFields.map((f) => {
              const checked = selected.has(f.fieldKey);
              return (
                <div
                  key={f.fieldKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    borderBottom: '1px dashed #E8E8E8',
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(f.fieldKey)}
                    data-testid={`file-detect-field-${f.fieldKey}`}
                  >
                    <span style={{ color: '#1F1F1F' }}>{getDetectedFieldLabel(f.fieldKey, msg.payload?.detectedFields)}</span>
                  </Checkbox>
                  <span style={{ flex: 1, color: '#666', fontSize: 11 }}>{f.value}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {onAcknowledgeFields && pendingFields.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Space size={6}>
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && !noneSelected}
                onChange={toggleAll}
                data-testid="file-detect-toggle-all"
              >
                全选
              </Checkbox>
              <Text type="secondary" style={{ fontSize: 11 }}>
                已选 {selected.size} / {pendingFields.length} 个
              </Text>
            </Space>
            <Button
              type="primary"
              size="small"
              disabled={noneSelected}
              onClick={onConfirm}
              icon={<CheckCircleOutlined />}
              data-testid="file-detect-confirm"
            >
              确认采纳{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
          </div>
        )}
        {/* 兜底: 旧接口, 没有任何 onAcknowledgeFields 时退化为单字段平铺按钮(只读显示不下发) */}
        {!onAcknowledgeFields && onAcknowledge && pendingFields.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Space wrap>
              {pendingFields.map((f) => (
                <Button key={f.fieldKey} size="small" onClick={() => onAcknowledge(f.fieldKey)}>
                  采纳 {getDetectedFieldLabel(f.fieldKey, msg.payload?.detectedFields)}
                </Button>
              ))}
            </Space>
          </div>
        )}
      </div>
    </div>
  );
};

interface Props {
  msg: AgentMessage;
  /** prefill 类型气泡点击「采纳本字段」回调 */
  onAcknowledge?: (fieldKey: string) => void;
  /**
   * file-detect / image-detect / link-detect 气泡: 多选采纳回调
   * 接收选中的 fieldKey 列表 (按置信度高 → 低排序, 已采纳 / 已在表单中的字段会被排除)
   * - 取代旧的「全部采纳」主按钮, 改为用户逐项勾选后批量采纳
   * - 与 PRD §3.2.1 智能预审 / 智能审查「勾选 + 确认采纳」交互同构
   */
  onAcknowledgeFields?: (fieldKeys: string[]) => void;
  /** autofix-req 授权 / 拒绝回调 */
  onAuthorizeFix?: (fieldKey: string) => void;
  onRejectFix?: (fieldKey: string) => void;
  // §4.2.1 / §4.3.1 智能预审气泡回调
  /** pre-audit-issue 单条问题「采纳到退回说明」回调 */
  onIssueAdopt?: (problemId: string) => void;
  /** pre-audit-issue 单条问题「忽略」回调 */
  onIssueIgnore?: (problemId: string) => void;
  /** pre-audit-issue 单条问题「定位到字段」回调（注册页智能审查场景） */
  onIssueLocate?: (fieldKey: string) => void;
  /** pre-audit-summary 严重度筛选切换（'all' | severity） */
  onSeverityFilter?: (severity: 'all' | 'error' | 'warning' | 'info') => void;
  /** 当前全局严重度筛选（用于回显 summary 气泡 Radio） */
  severityFilter?: 'all' | 'error' | 'warning' | 'info';
  /** pre-audit-summary 「帮我检查一下」按钮回调（注册页智能审查） */
  onRequestReview?: () => void;
}

/**
 * 时间显示：PRD §3.1.1 字段表 → 对话时间格式 HH:MM, 跨天时显示 YYYY-MM-DD HH:MM
 *  - ts 形如 "2026-06-30 09:30:00" (store.formatNow 产生) 或 ISO 字符串
 */
const fmtTime = (ts: string) => {
  if (!ts) return '';
  // 1) 标准 "YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DD HH:MM" 格式
  const std = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/);
  if (std) {
    const [, y, m, d, hm] = std;
    const isToday = (() => {
      const now = new Date();
      return (
        Number(y) === now.getFullYear() &&
        Number(m) === now.getMonth() + 1 &&
        Number(d) === now.getDate()
      );
    })();
    return isToday ? hm : `${y}-${m}-${d} ${hm}`;
  }
  // 2) 兜底匹配 HH:MM
  const hmOnly = ts.match(/(\d{2}:\d{2})/);
  if (hmOnly) return hmOnly[1];
  return ts;
};

const AgentMessageBubble = ({
  msg,
  onAcknowledge,
  onAcknowledgeFields,
  onAuthorizeFix,
  onRejectFix,
  onIssueAdopt,
  onIssueIgnore,
  onIssueLocate,
  onSeverityFilter,
  onRequestReview,
  severityFilter = 'all',
}: Props) => {
  const isAgent = msg.role === 'agent';
  const isNeedDraftWelcome = msg.id.startsWith('__welcome__:agent-needs-draft:');
  const isProjectApplicationDraftWelcome = msg.id.startsWith('__welcome__:project-application-draft:');
  const isProjectApplicationReviewingWelcome = msg.id.startsWith('__welcome__:project-application-reviewing:');
  const isProjectApplicationRevokedWelcome = msg.id.startsWith('__welcome__:project-application-revoked:');
  const isProjectApplicationPassedWelcome = msg.id.startsWith('__welcome__:project-application-passed:');
  const isProjectApplicationRejectedWelcome = msg.id.startsWith('__welcome__:project-application-rejected:');
  const isResourceDraftWelcome = msg.id.startsWith('__welcome__:resource-center-draft:');
  const isResourceApplyDraftWelcome = msg.id.startsWith('__welcome__:resource-apply-draft:');
  const isResourceApplyReviewingWelcome = msg.id.startsWith('__welcome__:resource-apply-reviewing:');
  const isResourceApplyPendingWelcome = msg.id.startsWith('__welcome__:resource-apply-pending:');
  const isResourceApplyRevokedWelcome = msg.id.startsWith('__welcome__:resource-apply-revoked:');
  const isResourceApplyApprovedWelcome = msg.id.startsWith('__welcome__:resource-apply-approved:');
  const isResourceApplyRejectedWelcome = msg.id.startsWith('__welcome__:resource-apply-rejected:');
  const isAuditProjectWelcome = msg.id.startsWith('__welcome__:audit-project-all:');
  const isAuditProjectApplicationWelcome = msg.id.startsWith('__welcome__:audit-project-application:');
  const isAuditProjectDraftWelcome = msg.id.startsWith('__welcome__:audit-project-draft:');
  const isAuditProjectPendingWelcome = msg.id.startsWith('__welcome__:audit-project-pending:');
  const isAuditProjectReviewingWelcome = msg.id.startsWith('__welcome__:audit-project-reviewing:');
  const isAuditProjectRevokedWelcome = msg.id.startsWith('__welcome__:audit-project-revoked:');
  const isAuditProjectPassedWelcome = msg.id.startsWith('__welcome__:audit-project-passed:');
  const isAuditProjectRejectedWelcome = msg.id.startsWith('__welcome__:audit-project-rejected:');
  const isDirectExpandedDraftWelcome = isNeedDraftWelcome || isProjectApplicationDraftWelcome ||
    isProjectApplicationReviewingWelcome || isProjectApplicationRevokedWelcome ||
    isProjectApplicationPassedWelcome || isProjectApplicationRejectedWelcome ||
    isResourceDraftWelcome ||
    isResourceApplyDraftWelcome || isResourceApplyReviewingWelcome || isResourceApplyPendingWelcome ||
    isResourceApplyRevokedWelcome || isResourceApplyApprovedWelcome || isResourceApplyRejectedWelcome ||
    isAuditProjectWelcome || isAuditProjectApplicationWelcome ||
    isAuditProjectDraftWelcome || isAuditProjectPendingWelcome ||
    isAuditProjectReviewingWelcome || isAuditProjectRevokedWelcome ||
    isAuditProjectPassedWelcome || isAuditProjectRejectedWelcome;
  // 建设需求、资源注册草稿及立项清单欢迎语要求列表直接呈现在欢迎语下方；其他场景仍保持折叠，
  // 避免较长的状态清单挤占对话窗口。
  const [welcomeMiniExpanded, setWelcomeMiniExpanded] = useState(
    () => isDirectExpandedDraftWelcome,
  );
  // §3.4.1.2 「接入进度·核心指标」→ 对话窗口内呈现的「洞察详情」气泡:
  //   - 一键直达按钮（完善台账 / 发起准入评测 / 查看监控告警 / 编辑修改）通过 useNavigate 跳转
  const navigate = useNavigate();

  // ─── 用户消息 ───
  if (!isAgent) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div
          style={{
            maxWidth: '78%',
            background: '#1677FF',
            color: '#FFFFFF',
            padding: '10px 14px',
            borderRadius: 12,
            borderTopRightRadius: 4,
            fontSize: 13,
            lineHeight: 1.6,
            boxShadow: '0 2px 8px rgba(22, 119, 255, 0.18)',
          }}
        >
          <Space size={6} style={{ marginBottom: 4, opacity: 0.85 }}>
            {msg.payload?.fileName ? (
              <>
                {msg.payload.fileName.toLowerCase().endsWith('.pdf') ? (
                  <FilePdfOutlined />
                ) : (
                  <PictureOutlined />
                )}
                <Text style={{ color: '#fff', fontSize: 12 }}>{msg.payload.fileName}</Text>
              </>
            ) : null}
            {msg.payload?.fileSize ? (
              <Text style={{ color: '#fff', fontSize: 11, opacity: 0.8 }}>
                {(msg.payload.fileSize / 1024 / 1024).toFixed(1)} MB
              </Text>
            ) : null}
          </Space>
          <div>{msg.content}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
            {fmtTime(msg.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Agent 消息（按 type 分发） ───
  const wrap: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: 12,
  };
  const bubble: React.CSSProperties = {
    maxWidth: '84%',
    background: '#FFFFFF',
    color: '#1F1F1F',
    padding: '10px 14px',
    borderRadius: 12,
    borderTopLeftRadius: 4,
    fontSize: 13,
    lineHeight: 1.6,
    border: '1px solid #F0F0F0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  };

  switch (msg.type) {
    case 'detecting':
      return (
        <div style={wrap}>
          <div style={bubble}>
            <Space size={8}>
              <span
                className="agent-robot-antenna"
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid #1677FF',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'agent-antenna-spin 1s linear infinite',
                }}
              />
              <Text type="secondary">{msg.content}</Text>
            </Space>
          </div>
        </div>
      );

    case 'file-detect':
    case 'image-detect':
    case 'link-detect':
    case 'text-detect':
      return <FileDetectBubble msg={msg} onAcknowledgeFields={onAcknowledgeFields} onAcknowledge={onAcknowledge} />;

    case 'prefill':
      return (
        <div style={wrap}>
          <div style={bubble}>
            <Space size={6} style={{ marginBottom: 6 }}>
              <Tag color="green">✨ AI 预填</Tag>
            </Space>
            <div style={{ marginBottom: 8 }}>{msg.content}</div>
            {msg.payload?.detectedFields && (
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {msg.payload.detectedFields.map((f) => (
                  <div
                    key={f.fieldKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ minWidth: 96, color: '#1F1F1F' }}>
                      {getDetectedFieldLabel(f.fieldKey, msg.payload?.detectedFields)}
                    </span>
                    {confidenceLevel(f.confidence) === 'low' && (
                      <Text style={{ fontSize: 11, color: '#389E0D' }}>
                        <WarningOutlined /> 请确认
                      </Text>
                    )}
                  </div>
                ))}
              </Space>
            )}
          </div>
        </div>
      );

    case 'autofix-req':
      return (
        <div style={wrap}>
          <div
            style={{
              ...bubble,
              borderColor: '#FFA940',
              background: '#FFFBE6',
            }}
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <Tag color="orange">🛠 Agent 请求纠错</Tag>
            </Space>
            <div style={{ marginBottom: 8 }}>{msg.content}</div>
            {msg.payload?.suggestions?.map((s) => (
              <div
                key={s.fieldKey}
                style={{
                  background: '#FFF',
                  border: '1px solid #FFD591',
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 12, color: '#1F1F1F', marginBottom: 4 }}>
                  <b>{s.fieldKey}</b>：{s.reason}
                </div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <Text type="secondary" delete>
                    {s.currentValue || '（空）'}
                  </Text>
                  <span style={{ margin: '0 6px' }}>→</span>
                  <Text strong style={{ color: '#52C41A' }}>
                    {s.suggestedValue}
                  </Text>
                </div>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onAuthorizeFix?.(s.fieldKey)}
                  >
                    授权修正
                  </Button>
                  <Button size="small" onClick={() => onRejectFix?.(s.fieldKey)}>
                    暂不修正
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        </div>
      );

    case 'autofix-done':
      return (
        <div style={wrap}>
          <div style={bubble}>
            <Space size={6} style={{ marginBottom: 4 }}>
              <CheckCircleOutlined style={{ color: '#52C41A' }} />
              <Tag color="green">已自动修正</Tag>
            </Space>
            <div>{msg.content}</div>
          </div>
        </div>
      );

    case 'error':
      return (
        <div style={wrap}>
          <div
            style={{
              ...bubble,
              borderColor: '#FFA39E',
              background: '#FFF1F0',
              color: '#CF1322',
            }}
          >
            <Space size={6} style={{ marginBottom: 4 }}>
              <CloseCircleOutlined />
              <Text strong style={{ color: '#CF1322' }}>
                识别失败
              </Text>
              {msg.payload?.errorCode && (
                <Tag color="red">{msg.payload.errorCode}</Tag>
              )}
            </Space>
            <div>{msg.content}</div>
          </div>
        </div>
      );

    // ─── §4.2.1 智能预审 · 汇总 ───
    case 'pre-audit-summary': {
      const s = msg.payload?.preAuditSummary;
      return (
        <div style={wrap}>
          <div
            style={{
              ...bubble,
              borderColor: '#91CAFF',
              background: 'linear-gradient(90deg,#F0F8FF 0%, #FFFFFF 100%)',
            }}
            data-testid="pre-audit-summary-msg"
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <ThunderboltOutlined style={{ color: '#1677FF' }} />
              <Tag color="blue">智能预审 · 汇总</Tag>
            </Space>
            <div style={{ marginBottom: 8 }}>{msg.content}</div>
            {s && (
              <Space size={6} wrap style={{ marginBottom: 8 }}>
                <Tag color="error" icon={<BugOutlined />}>错误 {s.errors}</Tag>
                <Tag color="warning" icon={<WarningOutlined />}>警告 {s.warnings}</Tag>
                <Tag color="processing" icon={<InfoCircleOutlined />}>提示 {s.infos}</Tag>
                <Tag>共 {s.total} 项</Tag>
              </Space>
            )}
            {onRequestReview && (
              <div style={{ marginTop: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<ThunderboltOutlined />}
                  onClick={onRequestReview}
                  data-testid="agent-review-rerun"
                >
                  帮我检查一下
                </Button>
              </div>
            )}
            {onSeverityFilter && s && (
              <div>
                <Text type="secondary" style={{ fontSize: 11, marginRight: 6 }}>
                  按严重度筛选：
                </Text>
                <Radio.Group
                  size="small"
                  value={severityFilter}
                  onChange={(e) => onSeverityFilter(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  data-testid="pre-audit-severity-filter"
                >
                  <Radio.Button value="all">全部</Radio.Button>
                  <Radio.Button value="error">错误 {s.errors}</Radio.Button>
                  <Radio.Button value="warning">警告 {s.warnings}</Radio.Button>
                  <Radio.Button value="info">提示 {s.infos}</Radio.Button>
                </Radio.Group>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ─── §4.2.1 智能预审 · 单条问题 ───
    case 'pre-audit-issue': {
      const baseP = msg.payload?.preAuditIssue;
      if (!baseP) return null;
      // 优先读 window 全局采纳/忽略状态（由 Audit.tsx 监听 CustomEvent 写入）
      const winStatus = (window as any).__preAuditIssueStatus?.[baseP.id];
      const p = { ...baseP, status: winStatus || baseP.status || 'open' };
      const adopted = p.status === 'adopted';
      const ignored = p.status === 'ignored';
      const colorMap = {
        error: { border: '#FFA39E', bg: '#FFF1F0', icon: <BugOutlined style={{ color: '#FF4D4F' }} /> },
        warning: { border: '#FFE58F', bg: '#FFFBE6', icon: <WarningOutlined style={{ color: '#FAAD14' }} /> },
        info: { border: '#91D5FF', bg: '#E6F4FF', icon: <InfoCircleOutlined style={{ color: '#1677FF' }} /> },
      };
      const c = colorMap[p.severity];
      return (
        <div style={wrap}>
          <div
            style={{
              ...bubble,
              borderColor: adopted ? '#B7EB8F' : ignored ? '#D9D9D9' : c.border,
              background: adopted ? '#F6FFED' : ignored ? '#FAFAFA' : c.bg,
              opacity: ignored ? 0.6 : 1,
            }}
            data-testid={`pre-audit-issue-msg-${p.id}`}
          >
            <Space size={8} align="start">
              {adopted ? <CheckCircleOutlined style={{ color: '#52C41A' }} /> : c.icon}
              <div style={{ flex: 1 }}>
                <Space size={6} wrap>
                  <Text strong style={{ fontSize: 13 }}>{p.title}</Text>
                  <Tag
                    color={p.severity === 'error' ? 'error' : p.severity === 'warning' ? 'warning' : 'processing'}
                    style={{ fontSize: 11 }}
                  >
                    {p.fieldKey}
                  </Tag>
                  {adopted && <Tag color="success">✓ 已采纳</Tag>}
                  {ignored && <Tag>已忽略</Tag>}
                </Space>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{p.reason}</div>
                {!adopted && !ignored && (
                  <Space size={4} wrap style={{ marginTop: 6 }}>
                    {onIssueLocate && p.fieldKey && (
                      <Button
                        size="small"
                        type="link"
                        data-testid={`pre-audit-issue-locate-${p.id}`}
                        onClick={() => onIssueLocate(p.fieldKey!)}
                        style={{ padding: 0 }}
                      >
                        定位到字段
                      </Button>
                    )}
                    {onIssueAdopt && (
                      <Button
                        size="small"
                        type="link"
                        data-testid={`pre-audit-issue-adopt-${p.id}`}
                        onClick={() => onIssueAdopt?.(p.id)}
                        style={{ padding: 0 }}
                      >
                        采纳到退回说明
                      </Button>
                    )}
                    {onIssueIgnore && (
                      <Button
                        size="small"
                        type="link"
                        data-testid={`pre-audit-issue-ignore-${p.id}`}
                        onClick={() => onIssueIgnore?.(p.id)}
                        style={{ padding: 0 }}
                      >
                        忽略本条
                      </Button>
                    )}
                  </Space>
                )}
              </div>
            </Space>
          </div>
        </div>
      );
    }

    // ─── §4.2.1 智能预审 · 联通测试 ───
    case 'pre-audit-test': {
      // 优先读 window.__preAuditTest (实时状态), 兜底用 msg.payload.preAuditTest
      const t = (window as any).__preAuditTest || msg.payload?.preAuditTest;
      if (!t) return null;
      const stageColor = (s: string) => {
        if (s === 'ok') return <CheckCircleOutlined style={{ color: '#52C41A' }} />;
        if (s === 'fail') return <CloseCircleOutlined style={{ color: '#FF4D4F' }} />;
        if (s === 'running') return <LoadingOutlined style={{ color: '#1677FF' }} />;
        return <span style={{ color: '#999' }}>·</span>;
      };
      return (
        <div style={wrap}>
          <div style={bubble} data-testid="pre-audit-test-msg">
            <Space size={6} style={{ marginBottom: 6 }}>
              <ApiOutlined style={{ color: '#1677FF' }} />
              <Tag color="blue">联通测试</Tag>
            </Space>
            <div style={{ marginBottom: 8 }}>{msg.content}</div>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {t.steps.map((s) => (
                <div
                  key={s.stage}
                  data-testid={`pre-audit-test-step-${s.stage}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: s.status === 'fail' ? '#FF4D4F' : '#1F1F1F',
                  }}
                >
                  {stageColor(s.status)}
                  <span style={{ minWidth: 80 }}>{s.label}</span>
                  <span style={{ color: '#999', fontSize: 11 }}>
                    {s.latencyMs !== undefined ? `${s.latencyMs}ms` : s.status === 'running' ? '进行中' : '--'}
                  </span>
                  {s.errorCode && (
                    <Tag color="red" style={{ fontSize: 10, marginLeft: 4 }}>
                      {s.errorCode}
                    </Tag>
                  )}
                </div>
              ))}
            </Space>
            {t.result && (
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  borderRadius: 4,
                  background: t.result.ok ? '#F6FFED' : '#FFF1F0',
                  border: `1px solid ${t.result.ok ? '#B7EB8F' : '#FFA39E'}`,
                  color: t.result.ok ? '#389E0D' : '#CF1322',
                  fontSize: 12,
                }}
              >
                {t.result.ok ? '✓ 联通成功' : '✗ 联通失败'}：{t.result.message}
                {t.totalMs !== undefined && (
                  <span style={{ marginLeft: 8, color: '#999' }}>总耗时 {t.totalMs}ms</span>
                )}
              </div>
            )}
            {!t.result && (
              <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                正在执行…
              </Text>
            )}
          </div>
        </div>
      );
    }

    // ─── §4.2.1 智能预审 · 结论 ───
    case 'pre-audit-verdict': {
      const v = msg.payload?.preAuditVerdict;
      if (!v) return null;
      const tone =
        v.verdict === 'pass'
          ? { bg: '#F6FFED', border: '#52C41A', icon: <CheckCircleOutlined style={{ color: '#52C41A' }} />, text: '建议通过' }
          : v.verdict === 'reject'
            ? { bg: '#FFF1F0', border: '#FF4D4F', icon: <CloseCircleOutlined style={{ color: '#FF4D4F' }} />, text: '建议退回' }
            : { bg: '#FFFBE6', border: '#FAAD14', icon: <LoadingOutlined style={{ color: '#FAAD14' }} />, text: '信息待补' };
      return (
        <div style={wrap}>
          <div
            style={{ ...bubble, background: tone.bg, borderColor: tone.border }}
            data-testid="pre-audit-verdict-msg"
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <ThunderboltOutlined style={{ color: tone.border }} />
              <Tag color={v.verdict === 'pass' ? 'success' : v.verdict === 'reject' ? 'error' : 'warning'}>
                预审结论 · {tone.text}
              </Tag>
            </Space>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{msg.content}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              理由：{v.reason}（错误 {v.fatalCount} · 警告 {v.warningCount}）
            </Text>
          </div>
        </div>
      );
    }

    // ─── §4.2.3 PRD：连通测试结果气泡（成功 / 失败 整体结果） ───
    case 'conn-test-result': {
      const r = msg.payload?.connTestResult;
      if (!r) return null;
      const ok = r.ok;
      const stageLabelMap: Record<string, string> = {
        dns: 'DNS 解析',
        connect: '建立连接',
        auth: '鉴权验证',
        request: '发送请求',
        response: '接收响应',
      };
      return (
        <div style={wrap}>
          <div
            data-testid="conn-test-result-msg"
            style={{
              ...bubble,
              borderColor: ok ? '#B7EB8F' : '#FFA39E',
              background: ok ? '#F6FFED' : '#FFF1F0',
            }}
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              {ok ? (
                <CheckCircleOutlined style={{ color: '#52C41A' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#FF4D4F' }} />
              )}
              <Tag color={ok ? 'success' : 'error'}>
                {ok ? '测试验证 · 通过' : '测试验证 · 异常'}
              </Tag>
              {!ok && r.errorCode && (
                <Tag color="red">错误 {r.errorCode}</Tag>
              )}
            </Space>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {msg.content}
            </div>
            {!ok && (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {r.failureStage && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    失败阶段：{stageLabelMap[r.failureStage] || r.failureStage}
                  </Text>
                )}
                {r.errorReason && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {r.errorReason}
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>
                  我会联网搜索解决方案，片刻后给到修改建议～
                </Text>
              </Space>
            )}
            {ok && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                5 阶段全部通过，可继续提交注册。
              </Text>
            )}
          </div>
        </div>
      );
    }

    case 'register-submit-confirm': {
      return (
        <div style={wrap}>
          <div
            data-testid="register-submit-confirm-msg"
            style={{
              ...bubble,
              borderColor: '#91CAFF',
              background: 'linear-gradient(90deg,#F0F8FF 0%,#FFFFFF 100%)',
            }}
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <CheckCircleOutlined style={{ color: '#52C41A' }} />
              <Tag color="success">信息完整 · 测试通过</Tag>
            </Space>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {msg.content}
            </div>
            <Button
              type="primary"
              size="small"
              icon={<RocketOutlined />}
              onClick={() => window.dispatchEvent(new Event('agent-register-confirm-submit'))}
            >
              确认提交
            </Button>
          </div>
        </div>
      );
    }

    case 'audit-submit-confirm': {
      return (
        <div style={wrap}>
          <div
            data-testid="audit-submit-confirm-msg"
            style={{
              ...bubble,
              borderColor: '#91CAFF',
              background: 'linear-gradient(90deg,#F0F8FF 0%,#FFFFFF 100%)',
            }}
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <CheckCircleOutlined style={{ color: '#52C41A' }} />
              <Tag color="success">信息完整 · 材料齐全</Tag>
            </Space>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {msg.content}
            </div>
            <Button
              type="primary"
              size="small"
              icon={<RocketOutlined />}
              onClick={() => window.dispatchEvent(new Event('audit-project-confirm-submit'))}
            >
              提交审计
            </Button>
          </div>
        </div>
      );
    }

    // ─── §4.2.3 PRD：连通测试失败 → Agent 联网搜索解决方案气泡 ───
    case 'web-search-solution': {
      const list = msg.payload?.webSearchSolutions ?? [];
      return (
        <div style={wrap}>
          <div
            data-testid="web-search-solution-msg"
            style={{
              ...bubble,
              borderColor: '#91CAFF',
              background: 'linear-gradient(90deg,#F0F8FF 0%, #FFFFFF 100%)',
            }}
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <GlobalOutlined style={{ color: '#1677FF' }} />
              <Tag color="blue">联网搜索 · 解决方案</Tag>
            </Space>
            <div style={{ marginBottom: 8 }}>{msg.content}</div>
            {list.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                暂未匹配到相关方案，请联系平台运维协助排查。
              </Text>
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {list.map((s) => (
                  <div
                    key={s.id}
                    data-testid={`web-search-solution-${s.id}`}
                    style={{
                      border: '1px solid #E8E8E8',
                      background: '#FFFFFF',
                      borderRadius: 6,
                      padding: '10px 12px',
                    }}
                  >
                    <Space size={6} wrap>
                      <Text strong style={{ fontSize: 13 }}>
                        {s.title}
                      </Text>
                      {s.score !== undefined && (
                        <Tag color="blue" style={{ fontSize: 11 }}>
                          匹配 {Math.round(s.score * 100)}%
                        </Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#333', lineHeight: 1.6 }}>
                      {s.summary}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>
                      来源：{s.source}
                    </div>
                    {s.url && (
                      <div style={{ marginTop: 6 }}>
                        <Button
                          size="small"
                          type="link"
                          icon={<LinkOutlined />}
                          data-testid={`web-search-solution-open-${s.id}`}
                          onClick={() => window.open(s.url, '_blank', 'noopener,noreferrer')}
                          style={{ padding: 0 }}
                        >
                          打开查看完整方案 →
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </Space>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
              <Text type="secondary">
                修改完成后请在表单中重新填写并再次发起【测试验证】；通过后即可提交注册。
              </Text>
            </div>
          </div>
        </div>
      );
    }

    // ─── §3.4.1.2 注册信息详情页 · 接入进度 + 核心指标 + 一键直达 ───
    // PRD:「不在详情页新增嵌入式『接入进度 · 核心指标』卡片」, 改为在对话窗口呈现。
    // 此处为紧凑版(适配 ~440px 浮层宽度), 与原 InsightDetailPanel 内容等价但去掉 Card 外壳。
    case 'insight-detail': {
      const p: InsightProgress | undefined = msg.payload?.insightProgress;
      if (!p) return null;
      const phaseIdx = p.phase === 'success' ? 2 : p.phase === 'reviewing' ? 1 : 0;
      const phaseLabelMap: Record<InsightProgress['phase'], string> = {
        pending: '信息待审查',
        reviewing: '信息审查中',
        success: '接入成功',
      };
      const phaseDescMap: Record<InsightProgress['phase'], string> = {
        pending: '已提交至审核队列',
        reviewing: '管理员审核中',
        success: '审核通过，已同步台账',
      };
      const phaseColorMap: Record<InsightProgress['phase'], string> = {
        pending: '#FAAD14',
        reviewing: '#1677FF',
        success: '#52C41A',
      };
      const metricBg = (tone?: 'success' | 'warning' | 'info') =>
        tone === 'success' ? '#F6FFED' : tone === 'warning' ? '#FFFBE6' : '#F0F8FF';
      const actionIcon = (k?: string) => {
        if (k === 'ledger') return <DatabaseOutlined />;
        if (k === 'eval') return <ExperimentOutlined />;
        if (k === 'edit') return <EditOutlined />;
        return <RocketOutlined />;
      };
      return (
        <div style={wrap}>
          <div
            data-testid="insight-detail-msg"
            style={{
              ...bubble,
              borderColor: '#91CAFF',
              background: 'linear-gradient(90deg,#F0F8FF 0%, #FFFFFF 100%)',
              padding: '12px 14px',
            }}
          >
            <Space size={6} style={{ marginBottom: 8 }} wrap>
              <ThunderboltOutlined style={{ color: '#1677FF' }} />
              <Tag color="blue">医小管 · 接入进度</Tag>
              <Tag
                color={p.phase === 'success' ? 'success' : p.phase === 'reviewing' ? 'processing' : 'warning'}
              >
                {phaseLabelMap[p.phase]}
              </Tag>
            </Space>

            {/* 阶段进度条 — 用最简三段水平线替代 antd Steps, 适配窄宽 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                margin: '6px 0 10px',
              }}
            >
              {(['pending', 'reviewing', 'success'] as InsightProgress['phase'][]).map((ph, i) => {
                const reached = i <= phaseIdx;
                const isCurrent = i === phaseIdx;
                return (
                  <React.Fragment key={ph}>
                    <div
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: 11,
                        color: reached ? phaseColorMap[p.phase] : '#BFBFBF',
                        fontWeight: isCurrent ? 600 : 400,
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          margin: '0 auto 4px',
                          background: reached ? phaseColorMap[p.phase] : '#F0F0F0',
                          color: '#FFF',
                          fontSize: 11,
                          lineHeight: '18px',
                          fontWeight: 600,
                        }}
                      >
                        {reached ? (i === 2 ? '✓' : i + 1) : i + 1}
                      </div>
                      {phaseLabelMap[ph]}
                    </div>
                    {i < 2 && (
                      <div
                        style={{
                          flex: '0 0 18px',
                          height: 2,
                          background: i < phaseIdx ? phaseColorMap[p.phase] : '#F0F0F0',
                          marginBottom: 14,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* 当前阶段说明 */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E8E8',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <Text strong style={{ fontSize: 12 }}>当前阶段：</Text>
              <span style={{ color: phaseColorMap[p.phase], marginLeft: 4 }}>
                {phaseLabelMap[p.phase]}
              </span>
              <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                {phaseDescMap[p.phase]}
              </div>
            </div>

            {/* 核心指标 — 2 列栅格, 紧凑卡片 */}
            {p.metrics.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <Text strong style={{ fontSize: 12 }}>
                  <BarChartOutlined /> 核心服务指标
                </Text>
                <div
                  style={{
                    marginTop: 6,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                  }}
                >
                  {p.metrics.map((m) => (
                    <div
                      key={m.label}
                      style={{
                        background: metricBg(m.tone),
                        border: '1px solid #E8E8E8',
                        borderRadius: 6,
                        padding: '6px 8px',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#666' }}>{m.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 下一步动作 — 一键直达 */}
            {p.nextActions.length > 0 && (
              <div>
                <Text strong style={{ fontSize: 12 }}>
                  <RocketOutlined /> 下一步动作
                </Text>
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {p.nextActions.map((a) => (
                    <Tooltip
                      key={a.key}
                      title={a.enabled ? a.description : '当前账号暂无该操作权限'}
                    >
                      <Button
                        size="small"
                        type={a.key === 'ledger' ? 'primary' : 'default'}
                        icon={actionIcon(a.key)}
                        disabled={!a.enabled || !a.path}
                        onClick={() => a.path && navigate(a.path)}
                      >
                        {a.label}
                      </Button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'text':
    default:
      const welcomeChips = msg.payload?.welcomeChips ?? [];
      const welcomeActions = msg.payload?.welcomeActions ?? [];
      const welcomeMiniList = msg.payload?.welcomeMiniList;
      const needMatchRows = msg.payload?.needMatchRows ?? [];
      const hasWelcomeGuides =
        welcomeChips.length > 0 ||
        welcomeActions.length > 0 ||
        needMatchRows.length > 0 ||
        !!(welcomeMiniList && welcomeMiniList.rows.length > 0);
      return (
        <div style={wrap}>
          <div style={needMatchRows.length > 0 ? { ...bubble, maxWidth: '96%', width: 500 } : bubble}>
            <div>{msg.content}</div>
            {hasWelcomeGuides && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px solid #F0F0F0',
                }}
                data-testid={`chat-welcome-guides-${msg.id}`}
              >
                {welcomeChips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {welcomeChips.map((c) => (
                      <Tag.CheckableTag
                        key={c.key}
                        data-testid={`chat-welcome-chip-${c.key}`}
                        checked={c.tone === 'success'}
                        style={{
                          padding: '2px 8px',
                          border: `1px solid ${
                            c.tone === 'warning'
                              ? '#FAAD14'
                              : c.tone === 'success'
                                ? '#52C41A'
                                : c.tone === 'error'
                                  ? '#FF4D4F'
                                  : '#D9D9D9'
                          }`,
                          borderRadius: 999,
                          cursor: c.targetTab ? 'pointer' : 'default',
                        }}
                        onChange={() => {
                          if (!c.targetTab) return;
                          window.dispatchEvent(
                            new CustomEvent('agent-jump-tab', { detail: c.targetTab }),
                          );
                        }}
                      >
                        {c.label}
                      </Tag.CheckableTag>
                    ))}
                  </div>
                )}

                {needMatchRows.length > 0 && (
                  <div
                    data-testid="chat-need-match-table"
                    style={{
                      marginBottom: 10,
                      overflowX: 'auto',
                      border: '1px solid #E8F1FF',
                      borderRadius: 8,
                      background: '#FFFFFF',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        minWidth: 500,
                        borderCollapse: 'collapse',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      <thead>
                        <tr style={{ background: '#F3F8FF' }}>
                          {['智能体编号', '智能体名称', '版本', '匹配度'].map((title) => (
                            <th
                              key={title}
                              style={{
                                padding: '7px 8px',
                                color: '#4B5563',
                                fontWeight: 600,
                                textAlign: title === '匹配度' ? 'right' : 'left',
                                borderBottom: '1px solid #E8F1FF',
                                whiteSpace: 'nowrap',
                                width:
                                  title === '智能体名称'
                                    ? 230
                                    : title === '智能体编号'
                                      ? 92
                                      : title === '版本'
                                        ? 70
                                        : 70,
                              }}
                            >
                              {title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {needMatchRows.map((row) => (
                          <tr key={`${row.rank}-${row.agentCode}`}>
                            <td style={{ padding: '7px 8px', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                              {row.agentCode}
                            </td>
                            <td
                              style={{
                                padding: '7px 8px',
                                borderBottom: '1px solid #F3F4F6',
                                color: '#1677FF',
                                fontWeight: 600,
                                minWidth: 230,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.agentName}
                            </td>
                            <td style={{ padding: '7px 8px', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                              {row.version}
                            </td>
                            <td
                              style={{
                                padding: '7px 8px',
                                borderBottom: '1px solid #F3F4F6',
                                color: row.score >= 70 ? '#1677FF' : '#FA8C16',
                                fontWeight: 700,
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.score}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {welcomeActions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {welcomeActions.map((a) => (
                      <Tooltip
                        key={a.key}
                        title={a.enabled ? '' : (a.reason || '当前账号暂无该操作权限')}
                      >
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          disabled={!a.enabled}
                          data-testid={`chat-welcome-action-${a.key}`}
                          onClick={() => {
                            if (!a.enabled) return;
                            if (a.event) {
                              window.dispatchEvent(new CustomEvent(a.event));
                              return;
                            }
                            if (a.path) navigate(a.path);
                          }}
                        >
                          {a.label}
                        </Button>
                      </Tooltip>
                    ))}
                  </div>
                )}

                {welcomeMiniList && welcomeMiniList.rows.length > 0 && (
                  <div>
                    {!welcomeMiniExpanded ? (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        data-testid="chat-welcome-mini-toggle"
                        onClick={() => setWelcomeMiniExpanded(true)}
                      >
                        {welcomeMiniList.toggleLabel} ›
                      </Button>
                    ) : (
                      <div
                        data-testid="chat-welcome-mini"
                        style={{
                          border: '1px solid #E8E8E8',
                          borderRadius: 8,
                          background: '#FFFFFF',
                          maxHeight: isDirectExpandedDraftWelcome ? 'none' : 220,
                          overflowY: isDirectExpandedDraftWelcome ? 'visible' : 'auto',
                        }}
                      >
                        {welcomeMiniList.rows.map((row) => (
                          <div
                            key={row.recordId}
                            data-testid={`chat-welcome-mini-row-${row.recordId}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 8px',
                              borderBottom: '1px solid #F5F5F5',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {row.title}
                              </div>
                              {(row.subTitle || row.meta) && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: '#999',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {[row.subTitle, row.meta].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </div>
                            <Space size={0} wrap={false}>
                              {row.actions.map((act) => (
                                <Button
                                  key={act.key}
                                  size="small"
                                  type="link"
                                  danger={act.danger}
                                  data-testid={`chat-welcome-mini-action-${act.kind}-${row.recordId}`}
                                  onClick={() => {
                                    window.dispatchEvent(
                                      new CustomEvent('agent-bubble-row-action', {
                                        detail: {
                                          kind: act.kind,
                                          recordId: row.recordId,
                                          path: act.path,
                                        },
                                      }),
                                    );
                                  }}
                                  style={{ padding: '0 6px', fontSize: 12 }}
                                >
                                  {act.label}
                                </Button>
                              ))}
                            </Space>
                          </div>
                        ))}
                        {!isDirectExpandedDraftWelcome && (
                          <Button
                            type="link"
                            size="small"
                            block
                            data-testid="chat-welcome-mini-footer"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent('agent-jump-tab', {
                                  detail: welcomeMiniList.targetTab,
                                }),
                              );
                            }}
                            style={{ fontSize: 12 }}
                          >
                            查看全部 ({welcomeMiniList.totalCount}) ›
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
  }
};

export default AgentMessageBubble;
