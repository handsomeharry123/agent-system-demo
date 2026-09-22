// 统一台账中心 - 智能体信息详情页（画像 V1.8 §2.2）
//
// 依据《统一台账中心-需求说明文档 V1.8》§2.2：
//   · 布局：左侧展示智能体虚拟形象，形象周边以关联图谱形式展示所对接的资源；
//   · 右侧以 Tab 标签页形式集中展示 基本信息 / 技术信息 / 备案材料 / 已对接资源信息 / 评测结果信息 五个标签页；
//   · 默认选中「基本信息」；五个标签页内容互不重复展示；
//   · 基本信息字段（V1.8 §2.2.1）：智能体编号 / 名称 / 版本 / 所属科室 / 诊疗环节 / 功能描述 / 风险分级 / 运行状态 / 智能体来源 / 供应商名称 / 技术联系人 / 联系方式；
//   · 技术信息（V1.8 §2.2.2）：按 API / SDK / OTel 动态展示对应子字段；
//   · 备案材料（V1.8 §2.2.3）：在线预览 + 下载；支持 PDF；单文件 ≤30MB；
//   · 已对接资源信息（V1.8 §2.2.4）：资源名称 / 资源负责人 / 联系方式 / 对接方式；
//   · 评测结果信息（V1.8 §2.2.5）：总分 + 安全性各维度得分 + 多次评测结果趋势图；
//   · 顶栏操作：【← 返回】【编辑/取消/保存(编辑态)】【禁用/启用】【风险分级】；
//   · 风险分级 / 运行状态 / 接入时间 / 上线时间 不可编辑；
//   · 风险等级：仅 高度关注 / 中度关注 / 一般关注（V1.8 不再区分初/复）。

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  Radio,
  message,
  Empty,
  Tooltip,
  Drawer,
  Tabs,
  Alert,
  Result,
  Flex,
  Segmented,
  Upload,
} from 'antd';
import { Radar } from '@ant-design/charts';
import {
  EditOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  MonitorOutlined,
  FileSearchOutlined,
  DownloadOutlined,
  StopOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  PlusOutlined,
  LockOutlined,
  UploadOutlined,
  BgColorsOutlined,
  UndoOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import ProfileView360 from './ProfileView360';
import AgentLifecycleProgress, { type AgentLifecycleStage } from '../../components/AgentLifecycleProgress';
import { useAuth } from '../../hooks/useAuth';
import {
  generateAgentAvatar,
  getAgentAvatar,
  resetAgentAvatar,
  saveAgentAvatar,
} from '../../utils/agentAvatar';
import {
  ledgerAgents,
  currentUser,
  STATUS_COLOR,
  SOURCE_COLOR,
  ENUMS,
  type LedgerAgent,
  type FilingAttachment,
} from '../../mock/ledger';
import { mockEvaluationTasks } from '../../mock/evaluation';
import { useAccessRecords } from '../agent-center/store';
import { initialPujiangTasks } from '../evaluation/pujiang/data';
import { findProjectApplicationId } from '../project-application';
import { mockAgentsV18 } from '../../mock/monitoringV18';
import { matchAgentByName } from '../../utils/agentNameMatcher';

const { Title, Text, Paragraph, Link } = Typography;

// 来源展示（V1.5）
const SOURCE_DISPLAY: Record<string, string> = {
  自研: '自研',
  外采: '第三方',
  合作开发: '合作研发',
};

// V1.8 风险分级配色（仅三级，无初/复区分）
const RISK_COLOR: Record<string, string> = {
  高度关注: 'red',
  中度关注: 'orange',
  一般关注: 'default',
};

// ============== 风险标签（V1.8 单级，不带初/复角标）==============
const RiskTag: React.FC<{
  agent: LedgerAgent;
  drawer?: boolean;
}> = ({ agent, drawer }) => {
  const level = agent.riskLevel;
  if (level === '待分级' || level === '待复核' || !level) {
    return <Tag color="default">— 未分级</Tag>;
  }
  const color = RISK_COLOR[level] || 'default';
  const tag = <Tag color={color}>{level}</Tag>;
  if (!drawer) return tag;
  const basis = agent.riskBasis || agent.riskReviewBasis;
  return (
    <Tooltip
      title={
        basis ? (
          <div style={{ maxWidth: 360, maxHeight: 320, overflowY: 'auto' }}>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>判定依据</div>
            {basis}
          </div>
        ) : (
          '暂无判定依据'
        )
      }
      placement="left"
      color="#fff"
    >
      <span style={{ cursor: 'help' }}>{tag}</span>
    </Tooltip>
  );
};

// ============== 头像（智能体虚拟形象）==============
const AgentAvatar: React.FC<{ agent: LedgerAgent; size?: number; src?: string }> = ({ agent, size = 80, src }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        margin: '0 auto',
        padding: Math.max(3, size * 0.035),
        borderRadius: '28%',
        background: 'linear-gradient(135deg, rgba(22,119,255,.28), rgba(54,207,201,.24))',
        boxShadow: '0 10px 28px rgba(22,119,255,.18)',
      }}
    >
      <img
        src={src || getAgentAvatar(agent)}
        alt={`${agent.name}头像`}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '25%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
};

// ============== 关联图谱（运维层拓扑：顶层编排流程 → 中层 IT 资源 → 底层智能体）==============
// 视觉语言参考运维网络拓扑：自顶向下分层、同层多节点并排、节点之间画竖直连接线 + 边标签。
// 数据来源：
//   - 底层：当前 agent（中心）+ 协同智能体（暂无 mock，保留扩展位）
//   - 中层：mock.linkedResources（EMR/PACS/HIS/院内知识库 等 IT 资源）
//   - 顶层：mock.relatedFlows（在线编排流程）
type LayerKind = 'flow' | 'resource' | 'agent';
interface LayerNode {
  key: string;
  kind: LayerKind;
  title: string;
  sub?: string; // 对接方式 / 流程序号
  linkTo?: string;
}
const NODE_THEME: Record<LayerKind, { border: string; bg: string; label: string; tagColor: string }> = {
  flow: { border: '#B37FEB', bg: '#F9F0FF', label: '编排流程', tagColor: 'purple' },
  resource: { border: '#1677FF', bg: '#E6F4FF', label: 'IT 资源', tagColor: 'blue' },
  agent: { border: '#13C2C2', bg: '#E6FFFB', label: '智能体', tagColor: 'cyan' },
};
const ResourceGraph: React.FC<{ agent: LedgerAgent }> = ({ agent }) => {
  // 顶层 — 编排流程
  const flowNodes: LayerNode[] = agent.relatedFlows.map((f) => ({
    key: `flow-${f.id}`,
    kind: 'flow',
    title: f.name,
    sub: `FLOW · ${f.id}`,
  }));
  // 中层 — IT 资源
  const resourceNodes: LayerNode[] = agent.linkedResources.map((r) => ({
    key: `resource-${r.id}`,
    kind: 'resource',
    title: r.name,
    sub: r.linkType,
    linkTo: `/app/resource-center/resources/${r.id}`,
  }));
  // 底层 — 当前智能体（中心）+ 协同智能体（占位：mock 暂无数据，预留 1 位）
  const agentNodes: LayerNode[] = [
    { key: `agent-self-${agent.id}`, kind: 'agent', title: agent.name, sub: agent.type || '智能体' },
  ];

  const hasAny = flowNodes.length > 0 || resourceNodes.length > 0;

  if (!hasAny) {
    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          minHeight: 0,
          background: 'linear-gradient(180deg,#F0F5FF 0%,#FAFAFA 100%)',
          border: '1px solid #F0F0F0',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <AgentAvatar agent={agent} size={100} />
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 500 }}>{agent.name}</div>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              尚未对接任何 IT 资源或编排流程
            </Text>
          </div>
        </div>
      </div>
    );
  }

  // 通用节点渲染：图标占位 + 标题 + sub 边标签
  const renderNode = (n: LayerNode) => {
    const theme = NODE_THEME[n.kind];
    const isResource = n.kind === 'resource';
    const inner = (
      <div
        style={{
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: 6,
          padding: isResource ? '5px 6px' : '6px 9px',
          minWidth: isResource ? 0 : 92,
          maxWidth: isResource ? 'none' : 150,
          width: isResource ? '100%' : undefined,
          boxSizing: 'border-box',
          textAlign: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          cursor: n.linkTo ? 'pointer' : 'default',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Tooltip title={n.title}>
          <div
            style={{
              fontSize: isResource ? 10 : 12,
              fontWeight: 500,
              color: '#262626',
              marginTop: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {n.title}
          </div>
        </Tooltip>
        {n.sub && !isResource && (
          <div style={{ fontSize: 10, color: '#8C8C8C', marginTop: 2, fontFamily: 'monospace' }}>
            {n.sub}
          </div>
        )}
      </div>
    );
    if (n.linkTo) {
      return (
        <a
          key={n.key}
          href={n.linkTo}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: 'none', color: 'inherit', display: 'block', width: '100%' }}
        >
          {inner}
        </a>
      );
    }
    return <div key={n.key}>{inner}</div>;
  };

  // 一行节点（自适应 justify）
  const LayerRow: React.FC<{ nodes: LayerNode[]; layerLabel: string }> = ({ nodes, layerLabel }) => {
    const isResourceLayer = nodes[0]?.kind === 'resource';
    return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          fontSize: 11,
          color: '#8C8C8C',
          marginBottom: 4,
          paddingLeft: 4,
        }}
      >
        {layerLabel}（{nodes.length}）
      </div>
      <div
        style={{
          display: isResourceLayer ? 'grid' : 'flex',
          gridTemplateColumns: isResourceLayer ? 'repeat(6, minmax(0, 1fr))' : undefined,
          flexWrap: isResourceLayer ? undefined : 'wrap',
          gap: isResourceLayer ? 6 : 8,
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {nodes.map((node) => (
          <div
            key={node.key}
            style={isResourceLayer ? { minWidth: 0 } : undefined}
          >
            {renderNode(node)}
          </div>
        ))}
      </div>
    </div>
  );
  };

  // 层间连接线（用纯 CSS 伪元素画一组长整段竖线 + 横线）
  // 实际效果：从上层节点下沿到下层节点上沿的虚线，带一个小型 "via" 标签
  const LayerConnector: React.FC<{ fromLabel?: string; toLabel?: string }> = ({
    fromLabel,
    toLabel,
  }) => (
    <div
      style={{
        position: 'relative',
        height: 12,
        margin: '1px 0',
      }}
      aria-hidden
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 2,
          background:
            'repeating-linear-gradient(180deg, #BFBFBF 0 6px, transparent 6px 12px)',
          transform: 'translateX(-50%)',
        }}
      />
      {(fromLabel || toLabel) && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#fff',
            padding: '0 6px',
            fontSize: 9,
            color: '#595959',
            border: '1px solid #D9D9D9',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {fromLabel && toLabel ? `${fromLabel} → ${toLabel}` : fromLabel || toLabel}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        background: 'linear-gradient(180deg,#F0F5FF 0%,#FAFAFA 100%)',
        border: '1px solid #F0F0F0',
        borderRadius: 8,
        padding: 8,
        overflow: 'hidden',
      }}
    >
      {/* 顶部图例 + 统计 */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 5 }}>
        <Space size={8}>
          <LegendDot color={NODE_THEME.flow.border} label="编排流程" n={flowNodes.length} />
          <LegendDot color={NODE_THEME.resource.border} label="IT 资源" n={resourceNodes.length} />
          <LegendDot color={NODE_THEME.agent.border} label="智能体" n={agentNodes.length} />
        </Space>
      </Flex>

      {/* 自顶向下三层 */}
      {flowNodes.length > 0 && (
        <>
          <LayerRow nodes={flowNodes} layerLabel="① 编排流程（在线协同层）" />
          <LayerConnector fromLabel="调度" toLabel="IT 资源" />
        </>
      )}

      {resourceNodes.length > 0 && (
        <>
          <LayerRow nodes={resourceNodes} layerLabel="② 对接 IT 资源（业务系统层）" />
          <LayerConnector fromLabel="对接方式" toLabel="智能体" />
        </>
      )}

      {/* 底层 — 当前智能体，居中 + avatar */}
      <div style={{ position: 'relative', marginTop: 2 }}>
        <div
          style={{
            fontSize: 11,
            color: '#8C8C8C',
            marginBottom: 3,
            paddingLeft: 4,
          }}
        >
          ③ 智能体（接入层）
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              background: NODE_THEME.agent.bg,
              border: `1px solid ${NODE_THEME.agent.border}`,
              borderRadius: 8,
              padding: '5px 10px',
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AgentAvatar agent={agent} size={38} />
              <div style={{ textAlign: 'left' }}>
                <Tag color={NODE_THEME.agent.tagColor} style={{ marginRight: 0, fontSize: 10 }}>
                  中心智能体
                </Tag>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{agent.name}</div>
                <div style={{ fontSize: 10, color: '#8C8C8C', marginTop: 1 }}>
                  {agent.idCode} · {agent.type}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// 内联图例小点
const LegendDot: React.FC<{ color: string; label: string; n: number }> = ({ color, label, n }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 5,
        background: color,
      }}
    />
    <Text style={{ fontSize: 11, color: '#595959' }}>
      {label}（{n}）
    </Text>
  </span>
);

// ============== 主组件 ==============
const LedgerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // V2.4 修复：用 useAuth 当前用户角色判定 isPlatformAdmin
  //  原代码用 mock/ledger 的硬编码 currentUser(恒为 platform_admin) → 任何角色都按管理员处理,
  //  会导致「心内科科室管理员可编辑/启用/禁用信息中心的智能体」越权。
  //  改成读 useAuth 真实角色后,本页的操作按钮 (编辑/禁用/启用) 与 360 画像视图的入口
  //  才与 BasicLayout + List 列表的可见性基线一致。
  const auth = useAuth();
  const isPlatformAdmin = auth?.currentUser?.roles.includes('信息科管理员') ?? false;
  const isHospitalLeader = auth?.currentUser?.roles.includes('医院领导') ?? false;
  const accessRecords = useAccessRecords();

  const agent: LedgerAgent | undefined = useMemo(
    () => ledgerAgents.find((a) => a.id === id),
    [id],
  );

  const [editing, setEditing] = useState(false);
  const [basicForm] = Form.useForm();
  const [techForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState<FilingAttachment | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  // 360 画像视图 / 信息详情页 切换(PRD §3.2.2:详情页默认展示本次新增的「360 画像视图」)
  const [view, setView] = useState<'profile' | 'detail'>('profile');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [avatarSrc, setAvatarSrc] = useState('');
  const [, setRevision] = useState(0);

  useEffect(() => {
    if (agent) setAvatarSrc(getAgentAvatar(agent));
  }, [agent]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('ledger-detail-view-change', {
        detail: { agentId: id, view },
      }),
    );
  }, [id, view]);

  useEffect(() => {
    const handleViewDetail = (event: Event) => {
      const agentId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId;
      if (agentId && agentId !== id) return;
      setView('detail');
    };
    window.addEventListener('ledger-view-detail', handleViewDetail);
    return () => window.removeEventListener('ledger-view-detail', handleViewDetail);
  }, [id]);

  // 列表“更多”菜单复用详情页的查看、编辑和禁用流程。
  useEffect(() => {
    if (searchParams.get('view') === 'detail') setView('detail');
    const action = searchParams.get('action');
    if (action === 'edit' && isPlatformAdmin) handleEdit();
    if (action === 'disable' && isPlatformAdmin && agent?.lifecycleStatus !== '已禁用') {
      handleStatusChange('disable');
    }
    if (action === 'enable' && isPlatformAdmin && agent?.lifecycleStatus === '已禁用') {
      handleStatusChange('enable');
    }
    if (action) {
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
    // 只消费 URL 入口动作一次；handleEdit 在下方定义但组件初始化完成后才执行 effect。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 离开/关闭页面提示（编辑态）
  useEffect(() => {
    if (!editing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '您有未保存的修改，确定离开吗？';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editing]);

  if (!agent) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Result
          status="404"
          title="智能体不存在"
          subTitle="该智能体可能已被删除或归档"
          extra={
            <Button type="primary" onClick={() => navigate('/app/ledger/list')}>
              返回台账列表
            </Button>
          }
        />
      </div>
    );
  }

  // V2.4 修复：跨科室越权访问拦截
  //  原代码仅用 mock/ledger 硬编码的 platform_admin 判定权限,导致任何角色都按管理员渲染。
  //  现在用 useAuth 真实角色 + agent.department 判断:
  //    · 信息科管理员 → 放行(看所有科室)
  //    · 科室管理员 → 仅放行本科室
  //    · 跨科室访问 → 显示"无权访问"页面,而不是继续渲染(避免看到他人科室的智能体详情)
  const authUser = auth?.currentUser;
  const authRole = authUser?.roles?.[0] ?? '信息科管理员';
  const authDept = (authUser as any)?.department as string | undefined;
  const isCrossDept = !isPlatformAdmin && authDept && agent.department && authDept !== agent.department;
  if (isCrossDept) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Result
          icon={<LockOutlined style={{ color: '#8C8C8C' }} />}
          title="无权访问该智能体"
          subTitle={
            <Space direction="vertical" size={4}>
              <Text type="secondary">
                当前角色「{authRole}」归属「{authDept}」,无权查看「{agent.department}」的智能体详情。
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                如需访问,请联系信息科开通跨科室权限,或在台账列表切换到本科室。
              </Text>
            </Space>
          }
          extra={
            <Space>
              <Button type="primary" onClick={() => navigate('/app/ledger/list')}>
                返回台账列表
              </Button>
              <Button onClick={() => navigate('/app/home/workbench')}>
                回到工作台
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  // ============== 操作 ==============
  const handleEdit = () => {
    basicForm.setFieldsValue({
      name: agent.name,
      version: agent.version,
      department: agent.department,
      diagnosisPhase: agent.diagnosisPhase,
      description: agent.description,
      sourceType: agent.sourceType,
      vendor: agent.vendor,
      techContact: agent.techContact,
      techContactPhone: agent.techContactPhone,
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    if (basicForm.isFieldsTouched() || techForm.isFieldsTouched()) {
      Modal.confirm({
        title: '确认取消编辑？',
        content: '当前有未保存的修改，取消后将丢失这些内容。',
        okText: '确认取消',
        cancelText: '继续编辑',
        okButtonProps: { danger: true },
        onOk: () => {
          setEditing(false);
          basicForm.resetFields();
          techForm.resetFields();
        },
      });
    } else {
      setEditing(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await basicForm.validateFields();
      Modal.confirm({
        title: '确认是否保存',
        content: '保存后将同步更新至台账列表与总览页。',
        okText: '是',
        cancelText: '否',
        onOk: async () => {
          setSaving(true);
          try {
            // 模拟接口调用
            await new Promise((r) => setTimeout(r, 500));
            Object.assign(agent, values, techForm.getFieldsValue());
            setRevision((value) => value + 1);
            message.success('保存成功，台账列表已同步更新');
            setEditing(false);
          } catch {
            message.error('保存失败，请稍后重试');
          } finally {
            setSaving(false);
          }
        },
        onCancel: () => {
          // 放弃修改并回到详情页（不做保存）
          setEditing(false);
        },
      });
    } catch {
      // 校验失败 —— 滚动到首个错误项
      setTimeout(() => {
        const firstError = document.querySelector('.ant-form-item-has-error');
        firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleStatusChange = (action: 'disable' | 'enable') => {
    if (action === 'disable') {
      agent.lifecycleStatus = '已禁用';
      agent.runtimeStatus = '禁用';
      // 两个模块的演示数据命名可能带“系统/平台/助手”等不同尾缀，
      // 使用公共名称匹配策略定位运行监控中的同一智能体。
      const monitoredAgent =
        mockAgentsV18.find((item) => item.id === agent.id) ||
        matchAgentByName(agent.name, mockAgentsV18);
      if (monitoredAgent) {
        monitoredAgent.status = '禁用';
        monitoredAgent.instances.online = 0;
        monitoredAgent.heartbeatRate = 0;
        monitoredAgent.relatedAlert = undefined;
      }
      setRevision((value) => value + 1);
      message.success('禁用成功');
      return;
    }

    agent.lifecycleStatus = '已上线';
    agent.runtimeStatus = '在线';
    const monitoredAgent =
      mockAgentsV18.find((item) => item.id === agent.id) ||
      matchAgentByName(agent.name, mockAgentsV18);
    if (monitoredAgent) {
      monitoredAgent.status = '在线';
      monitoredAgent.instances.online = Math.max(1, monitoredAgent.instances.expected);
      monitoredAgent.heartbeatRate = 100;
      monitoredAgent.relatedAlert = undefined;
    }
    setRevision((value) => value + 1);
    message.success('启用成功');
  };

  const handleViewMonitor = () => {
    navigate(`/app/monitoring/business?agent=${agent.id}`);
  };

  const handleViewEvaluation = () => {
    if (!agent.evaluationReport?.reportId) {
      message.info('该智能体尚未完成准入评测');
      return;
    }
    navigate(`/app/evaluation/tasks/${agent.evaluationReport.reportId}/report`);
  };

  const handleGoRiskLevel = () => {
    navigate(`/app/ledger/risk/${agent.id}`);
  };

  const handleGenerateAvatar = () => {
    const next = generateAgentAvatar(agent, avatarPrompt.trim());
    setAvatarSrc(next);
    saveAgentAvatar(agent.id, next);
    message.success(avatarPrompt.trim() ? '已根据提示词生成头像' : '已根据功能描述生成头像');
  };

  const handleUploadAvatar = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('头像图片不能超过 2MB');
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const next = String(reader.result);
      setAvatarSrc(next);
      saveAgentAvatar(agent.id, next);
      message.success('头像上传成功');
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleResetAvatar = () => {
    resetAgentAvatar(agent.id);
    const next = generateAgentAvatar(agent);
    setAvatarSrc(next);
    setAvatarPrompt('');
    message.success('已恢复根据功能描述生成的默认头像');
  };

  // 智能体编号复制
  const handleCopyCode = (text: string) => {
    try {
      navigator.clipboard?.writeText(text);
      message.success('编号已复制');
    } catch {
      message.success('编号已复制');
    }
  };

  // ============== 渲染子区域 ==============
  const canDisable =
    isPlatformAdmin &&
    (agent.lifecycleStatus === '试运行中' || agent.lifecycleStatus === '已上线');
  const canEnable = isPlatformAdmin && agent.lifecycleStatus === '已禁用';

  // 台账详情与立项、接入及评测详情共用同一套流程口径。
  // 已产生上线时间即表示浦江实验室评测通过并自动上线；已有准入评测结果但尚未
  // 上线时，表示流程已进入浦江实验室评测阶段。
  const lifecycleStage: AgentLifecycleStage = agent.onlineTime
    ? '上线'
    : agent.evaluationReport
      ? '浦江实验室评测'
      : agent.accessTime
        ? '接入'
        : '立项';
  const projectApplicationId = findProjectApplicationId(agent.name, agent.department);
  const accessRecord = accessRecords.find((item) =>
    item.agentCode === agent.idCode || item.name === agent.name,
  );
  const safetyTask = mockEvaluationTasks.find((item) =>
    item.agentId === agent.id || item.agentCode === agent.idCode || item.agentName === agent.name,
  );
  const pujiangTask = initialPujiangTasks.find((item) =>
    item.agentId === agent.id || item.agentCode === agent.idCode || item.agentName === agent.name,
  );
  const safetyReportId = safetyTask?.id ?? agent.evaluationReport?.reportId;

  // ============== Tab: 基本信息（V1.8 §2.2.1）==============
  const BasicInfoBlock = (
    <div style={{ paddingTop: 12 }}>
      {editing ? (
        <Form form={basicForm} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="智能体名称"
                name="name"
                rules={[{ required: true, min: 2, max: 20, message: '名称 2-20 个字符' }]}
                extra={<span style={{ fontSize: 12 }}>失焦校验名称唯一性</span>}
              >
                <Input showCount maxLength={20} placeholder="2-20 个字符" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="智能体版本"
                name="version"
                rules={[
                  { required: true, message: '请输入版本号' },
                  { pattern: /^\d+\.\d+$/, message: '版本号格式：数字.数字（如 1.0）' },
                ]}
              >
                <Input placeholder="例：1.0 / 1.1 / 2.0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="所属科室" name="department" rules={[{ required: true }]}>
                <Select options={ENUMS.department.map((d) => ({ label: d, value: d }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="诊疗环节"
                name="diagnosisPhase"
                rules={[{ required: true, message: '请选择诊疗环节' }]}
              >
                <Select
                  mode="multiple"
                  options={ENUMS.diagnosisPhase.map((p) => ({ label: p, value: p }))}
                  placeholder="可多选"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="功能描述"
                name="description"
                rules={[{ required: true, max: 500, message: '功能描述不超过 500 字' }]}
                extra={<span style={{ fontSize: 12 }}>重点说明工作内容、服务对象、输入信息、输出结果</span>}
              >
                <Input.TextArea
                  rows={5}
                  showCount
                  maxLength={500}
                  placeholder="重点说明工作内容、服务对象、输入信息、输出结果（限 500 字）"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="智能体来源" name="sourceType" rules={[{ required: true }]}>
                <Radio.Group
                  options={ENUMS.sourceType.map((s) => ({
                    label: SOURCE_DISPLAY[s] || s,
                    value: s,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="供应商名称"
                name="vendor"
                rules={[
                  { max: 30, message: '供应商名称不超过 30 字' },
                  { required: true, message: '请输入供应商名称' },
                ]}
              >
                <Input showCount maxLength={30} placeholder="2-30 字" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="技术联系人"
                name="techContact"
                rules={[{ required: true, min: 2, max: 10, message: '技术联系人 2-10 字' }]}
              >
                <Input showCount maxLength={10} placeholder="2-10 字" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="联系方式"
                name="techContactPhone"
                rules={[
                  { required: true, message: '请输入联系方式' },
                  { pattern: /^1\d{10}$/, message: '请输入正确的 11 位手机号（以 1 开头）' },
                ]}
              >
                <Input placeholder="请输入 11 位手机号" maxLength={11} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ) : (
        <Descriptions
          column={2}
          size="small"
          bordered
          style={{ marginTop: 12 }}
          labelStyle={{ width: 110, color: '#595959' }}
        >
          <Descriptions.Item label="智能体编号">
            <Space size={6}>
              <Text
                code
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                }}
              >
                {agent.idCode}
              </Text>
              <Tooltip title="点击复制编号">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyCode(agent.idCode)}
                />
              </Tooltip>
              <Tag color="default" style={{ marginRight: 0 }}>
                自动生成 · 不可修改
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="智能体名称">
            <Tooltip title={agent.name}>{agent.name}</Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="智能体版本">
            <Tag style={{ fontFamily: 'monospace' }}>{agent.version}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所属科室">
            {agent.department}
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
              （{agent.departmentCode}）
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="诊疗环节" span={2}>
            <Tooltip title={agent.diagnosisPhase.join(' / ')}>
              {agent.diagnosisPhase.join(' / ')}
            </Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="智能体来源">
            <Tag color={SOURCE_COLOR[agent.sourceType] || 'default'}>
              {SOURCE_DISPLAY[agent.sourceType] || agent.sourceType}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="供应商名称">
            {agent.vendor ? (
              <Tooltip title={agent.vendor}>{agent.vendor}</Tooltip>
            ) : (
              <Text type="secondary">自研（无）</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="功能描述" span={2}>
            <Paragraph
              ellipsis={{ rows: 3, expandable: true, symbol: '展开/收起' }}
              style={{ marginBottom: 0, fontSize: 13 }}
            >
              {agent.description || '—'}
            </Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="技术联系人">{agent.techContact || '—'}</Descriptions.Item>
          <Descriptions.Item label="联系方式">{agent.techContactPhone || '—'}</Descriptions.Item>
          <Descriptions.Item label="风险分级">
            <RiskTag agent={agent} drawer />
          </Descriptions.Item>
          <Descriptions.Item label="运行状态">
            {agent.runtimeStatus ? (
              <Tooltip
                title={agent.runtimeStatus === '异常' ? '异常原因：实例与监控中心断连（演示）' : ''}
              >
                <Tag color={STATUS_COLOR.runtime[agent.runtimeStatus]}>
                  {agent.runtimeStatus}
                </Tag>
              </Tooltip>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="接入时间">{agent.accessTime}</Descriptions.Item>
          <Descriptions.Item label="上线时间">
            {agent.onlineTime || <Text type="secondary">试运行中</Text>}
          </Descriptions.Item>
        </Descriptions>
      )}
    </div>
  );

  // ============== Tab: 技术信息（V1.8 §2.2.2）==============
  const TechInfoBlock = (
    <div style={{ paddingTop: 12 }}>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FFF7E6', borderRadius: 4 }}>
        <Text style={{ fontSize: 12 }}>
          <ExclamationCircleOutlined style={{ color: '#FA8C16', marginRight: 6 }} />
          当前接入方式 <strong>{agent.accessType}</strong>。
          切换接入方式请到「智能体接入中心」修改注册信息，台账侧不支持切换。
        </Text>
      </div>

      <Descriptions
        column={2}
        size="small"
        bordered
        labelStyle={{ width: 140, color: '#595959' }}
      >
        <Descriptions.Item label="接入方式" span={2}>
          <Radio.Group value={agent.accessType} disabled>
            {ENUMS.accessType.map((t) => (
              <Radio.Button key={t} value={t}>
                {t}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Descriptions.Item>

        {agent.accessType === 'API' && (
          <>
            <Descriptions.Item label="API Key" span={2}>
              <Space>
                <Text code style={{ fontFamily: 'monospace' }}>
                  {apiKeyVisible ? agent.apiKey : '********'}
                </Text>
                <Tooltip title={apiKeyVisible ? '隐藏密钥' : '显示密钥'}>
                  <Button
                    type="text"
                    size="small"
                    icon={apiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setApiKeyVisible((v) => !v)}
                  />
                </Tooltip>
                <Tooltip title="复制">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => message.success('已复制')}
                  />
                </Tooltip>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  密文展示，限制 8-64 字符；修改请到接入中心
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="接口地址" span={2}>
              <Space>
                <Text code>{agent.interfaceUrl}</Text>
                <Tooltip title="测试连接">
                  <Button
                    size="small"
                    type="link"
                    onClick={() => message.success('连接成功（演示）')}
                  >
                    测试连接
                  </Button>
                </Tooltip>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  需为合法 URL（http/https 开头）
                </Text>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="埋点代码生成（API）" span={2}>
              <pre
                style={{
                  background: '#F5F5F5',
                  padding: 12,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
{`# API 接入示例（自动生成）
import requests

API_KEY = "${apiKeyVisible ? agent.apiKey : 'sk-****'}"
ENDPOINT = "${agent.interfaceUrl}"

response = requests.post(
    ENDPOINT,
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"query": "..."}
)
print(response.json())`}
              </pre>
              <Tooltip title="复制代码">
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  style={{ marginTop: 4 }}
                  onClick={() => message.success('代码已复制')}
                >
                  复制代码
                </Button>
              </Tooltip>
            </Descriptions.Item>
          </>
        )}

        {agent.accessType === 'SDK' && (
          <>
            <Descriptions.Item label="平台密钥 Key（SDK）" span={2}>
              <Space>
                <Text code style={{ fontFamily: 'monospace' }}>
                  {apiKeyVisible ? agent.apiKey : 'sk-****'}
                </Text>
                <Tooltip title={apiKeyVisible ? '隐藏密钥' : '显示密钥'}>
                  <Button
                    type="text"
                    size="small"
                    icon={apiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setApiKeyVisible((v) => !v)}
                  />
                </Tooltip>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  SDK 鉴权密钥，由接入中心自动签发
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="平台 URL 地址（SDK）" span={2}>
              <Space>
                <Text code>{agent.interfaceUrl}</Text>
                <Tooltip title="复制">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => message.success('已复制')}
                  />
                </Tooltip>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="埋点代码生成（SDK）" span={2}>
              <Space style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  语言：
                </Text>
                <Radio.Group size="small" value={agent.sdkLanguage || 'Java'} disabled>
                  <Radio.Button value="Java">Java</Radio.Button>
                  <Radio.Button value="Python">Python</Radio.Button>
                  <Radio.Button value="Node.js">Node.js</Radio.Button>
                </Radio.Group>
              </Space>
              <pre
                style={{
                  background: '#F5F5F5',
                  padding: 12,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
{`# SDK 接入示例（${agent.sdkLanguage || 'Java'}）
# 由接入中心根据 URL + Key 自动生成
import ${agent.sdkLanguage === 'Java' ? 'java' : 'sdk'}

client = new Client(
    url="${agent.interfaceUrl}",
    api_key="${apiKeyVisible ? agent.apiKey : 'sk-****'}"
)
result = client.invoke("...")
print(result)`}
              </pre>
              <Tooltip title="复制代码">
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  style={{ marginTop: 4 }}
                  onClick={() => message.success('代码已复制')}
                >
                  复制代码
                </Button>
              </Tooltip>
            </Descriptions.Item>
          </>
        )}

        {agent.accessType === 'OTel' && (
          <>
            <Descriptions.Item label="平台密钥 Key（OTel）" span={2}>
              <Space>
                <Text code style={{ fontFamily: 'monospace' }}>
                  {apiKeyVisible ? agent.apiKey : 'sk-****'}
                </Text>
                <Tooltip title={apiKeyVisible ? '隐藏密钥' : '显示密钥'}>
                  <Button
                    type="text"
                    size="small"
                    icon={apiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setApiKeyVisible((v) => !v)}
                  />
                </Tooltip>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  OTel 鉴权密钥，由接入中心自动签发
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="平台 URL 地址（OTel）" span={2}>
              <Space>
                <Text code>{agent.interfaceUrl}</Text>
                <Tooltip title="复制">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => message.success('已复制')}
                  />
                </Tooltip>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="埋点代码生成（OTel）" span={2}>
              <pre
                style={{
                  background: '#F5F5F5',
                  padding: 12,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
{`# OpenTelemetry instrumentation 示例（自动生成）
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(
    endpoint="${agent.interfaceUrl}",
    headers={"x-api-key": "${apiKeyVisible ? agent.apiKey : 'sk-****'}"}
)`}
              </pre>
              <Tooltip title="复制代码">
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  style={{ marginTop: 4 }}
                  onClick={() => message.success('代码已复制')}
                >
                  复制代码
                </Button>
              </Tooltip>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>
    </div>
  );

  // ============== Tab: 备案材料（V1.8 §2.2.3）==============
  const FilingBlock = (
    <div style={{ paddingTop: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          取自接入中心注册表单上传的文件；支持 PDF，单文件 ≤30MB；点击 icon1 在线预览（弹窗/新标签）；点击 icon2 下载。
        </Text>
      </div>
      {agent.filingAttachments.length === 0 ? (
        <Empty description="暂无备案材料" />
      ) : (
        <Row gutter={[12, 12]}>
          {agent.filingAttachments.map((f, idx) => (
            <Col key={f.id} span={12}>
              <Card size="small" bodyStyle={{ padding: 12 }}>
                <Flex justify="space-between" align="flex-start" gap={12}>
                  <Space size={10} align="start">
                    <FileTextOutlined style={{ fontSize: 28, color: '#1677FF' }} />
                    <div style={{ minWidth: 0 }}>
                      <Tooltip title={f.name}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            maxWidth: 240,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {f.name}
                        </div>
                      </Tooltip>
                      <div style={{ fontSize: 12, color: '#8C8C8C', marginTop: 4 }}>
                        附件{idx + 1} · {f.size} · {f.uploadTime}
                      </div>
                    </div>
                  </Space>
                  <Space size={4}>
                    <Tooltip title="在线预览">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => setPreviewFile(f)}
                      />
                    </Tooltip>
                    <Tooltip title="下载">
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => message.success(`已下载 ${f.name}`)}
                      />
                    </Tooltip>
                    {editing && (
                      <Tooltip title="删除">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            Modal.confirm({
                              title: '删除后无法恢复，确认删除？',
                              okText: '确认删除',
                              cancelText: '取消',
                              okButtonProps: { danger: true },
                              onOk: () => message.success('已删除（演示）'),
                            });
                          }}
                        />
                      </Tooltip>
                    )}
                  </Space>
                </Flex>
              </Card>
            </Col>
          ))}
          {editing && (
            <Col span={12}>
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => message.info('点击上传文件（演示）')}
              >
                上传备案材料
              </Button>
            </Col>
          )}
        </Row>
      )}
    </div>
  );

  // ============== Tab: 已对接资源信息（V1.8 §2.2.4）==============
  const LinkedResourcesBlock = (
    <div
      style={{
        paddingTop: 12,
        paddingRight: 4,
        maxHeight: 'min(516px, calc(100vh - 420px))',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          数据取自医院资源管理中心（<strong>非</strong>接入中心注册信息）。
          点击资源名称新标签页打开「医院资源管理中心-资源详情」。
        </Text>
      </div>
      {agent.linkedResources.length === 0 ? (
        <Empty
          description="尚未对接任何资源"
          style={{ padding: '32px 0' }}
        >
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => navigate('/app/resource-center/resources')}
          >
            前往医院资源管理中心配置
          </Button>
        </Empty>
      ) : (
        <Row gutter={[12, 12]}>
          {agent.linkedResources.map((r) => (
            <Col key={r.id} span={12}>
              <Card size="small" bodyStyle={{ padding: 12 }}>
                <Descriptions
                  column={1}
                  size="small"
                  colon={false}
                  labelStyle={{ width: 90, color: '#8C8C8C', fontSize: 12 }}
                >
                  <Descriptions.Item label="资源名称">
                    <Tooltip title={r.name}>
                      <Link
                        onClick={() =>
                          window.open(`/app/resource-center/resources/${r.id}`, '_blank')
                        }
                      >
                        {r.name.length > 20 ? `${r.name.slice(0, 20)}...` : r.name}
                      </Link>
                    </Tooltip>
                  </Descriptions.Item>
                  <Descriptions.Item label="资源负责人">{r.owner}</Descriptions.Item>
                  <Descriptions.Item label="联系方式">{r.contact}</Descriptions.Item>
                  <Descriptions.Item label="对接方式">
                    <Tag color="blue">{r.linkType}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

  // ============== Tab: 评测结果信息（V1.8 §2.2.5）==============
  const EvaluationBlock = (
    <div style={{ paddingTop: 8 }}>
      {!agent.evaluationReport ? (
        <Alert
          type="info"
          showIcon
          message="该智能体尚未完成准入评测"
          description="未生成评测报告时，无法展示准入/运行评测结果。"
        />
      ) : (
        <div>
          {/* 总分摘要：占满内容区，避免半栏布局形成无效留白 */}
          <Row>
            <Col span={24}>
              <Card
                size="small"
                bodyStyle={{ padding: '12px 16px' }}
              >
                <Flex justify="space-between" align="center" gap={16}>
                  <Flex align="center" gap={16}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#1677FF',
                        background: '#E6F4FF',
                        flex: '0 0 auto',
                      }}
                    >
                      <FileSearchOutlined style={{ fontSize: 20 }} />
                    </div>
                    <div>
                      <Flex align="baseline" gap={8}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>评测结果总分</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {agent.evaluationReport.reportId}
                        </Text>
                      </Flex>
                      <div
                        style={{
                          lineHeight: 1.15,
                          fontSize: 30,
                          fontWeight: 700,
                          color:
                            agent.evaluationReport.totalScore >= 80
                              ? '#52C41A'
                              : agent.evaluationReport.totalScore >= 60
                              ? '#FAAD14'
                              : '#FF4D4F',
                        }}
                      >
                        {agent.evaluationReport.totalScore}
                        <span style={{ fontSize: 13, color: '#8C8C8C', fontWeight: 400 }}>
                          {' '}
                          / 100
                        </span>
                      </div>
                    </div>
                  </Flex>
                  <Button
                    type="link"
                    size="small"
                    icon={<FileSearchOutlined />}
                    onClick={handleViewEvaluation}
                  >
                    查看报告
                  </Button>
                </Flex>
              </Card>
            </Col>
          </Row>

          {/* 四维雷达图 + 安全明细 */}
          <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
            <Col span={14} style={{ display: 'flex' }}>
              <Card
                size="small"
                title="安全性各维度得分"
                style={{ width: '100%' }}
                bodyStyle={{ padding: '4px 0' }}
              >
                <div style={{ height: 210 }}>
                  <Radar
                    data={agent.evaluationReport.dimensions.map((d) => ({
                      dimension: d.dimension,
                      score: d.score,
                    }))}
                    xField="dimension"
                    yField="score"
                    area={{ style: { fill: 'rgba(22,119,255,0.25)' } }}
                    line={{ style: { stroke: '#1677FF', lineWidth: 2 } }}
                    point={{ size: 4, style: { fill: '#1677FF', stroke: '#fff' } }}
                    scale={{
                      score: { min: 0, max: 100, nice: true, tickCount: 5 },
                    }}
                    axis={{
                      x: {
                        labelFontSize: 13,
                      },
                      y: { labelFontSize: 11 },
                    }}
                  />
                </div>
              </Card>
            </Col>
            <Col span={10} style={{ display: 'flex' }}>
              <Card
                size="small"
                title="安全性各维度得分明细"
                style={{ width: '100%' }}
                bodyStyle={{ padding: '10px 12px 4px' }}
              >
                {agent.evaluationReport.securityDetails.map((s) => (
                  <div key={s.name} style={{ marginBottom: 7 }}>
                    <Flex justify="space-between" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 12 }}>{s.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{s.score}</span>
                    </Flex>
                    <div
                      style={{
                        height: 6,
                        background: '#F0F0F0',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${s.score}%`,
                          height: '100%',
                          background:
                            s.score >= 80 ? '#52C41A' : s.score >= 60 ? '#FAAD14' : '#FF4D4F',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>

          {/* 多次准入评测历史趋势 */}
          <Card
            size="small"
            style={{ marginTop: 10 }}
            bodyStyle={{ padding: '10px 12px' }}
            title={
              <Space size={6}>
                <HistoryOutlined style={{ color: '#1677FF' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>多次评测结果趋势</span>
              </Space>
            }
          >
            <Row gutter={8}>
              {agent.evaluationReport.history.map((h, idx) => (
                <Col key={`${h.reportId}-${idx}`} flex="1">
                  <div
                    style={{
                      padding: '7px 10px',
                      border: '1px solid #F0F0F0',
                      borderRadius: 6,
                      background: '#FAFAFA',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: h.totalScore >= 80 ? '#52C41A' : '#FAAD14',
                      }}
                    >
                      {h.totalScore}
                    </div>
                    <div style={{ fontSize: 11, color: '#8C8C8C' }}>
                      {h.evaluatedAt}
                    </div>
                    <div style={{ fontSize: 11, color: '#8C8C8C' }}>{h.reportId}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 16, background: '#F5F5F5', minHeight: 'calc(100vh - 64px)' }}>
      {/* 顶栏操作 */}
      <Card bordered={false} bodyStyle={{ padding: 16 }} style={{ marginBottom: 12 }}>
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Space size={10} align="center" wrap>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/app/ledger/list')}
            >
              返回
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {agent.name}
            </Title>
            {/* PRD §3.2.2:详情页默认展示本次新增的「360 画像视图」,可切换回原「智能体信息详情页」 */}
            <Segmented
              value={view}
              onChange={(v) => setView(v as 'profile' | 'detail')}
              options={[
                { label: '360 画像视图', value: 'profile' },
                { label: '智能体信息详情页', value: 'detail' },
              ]}
            />
          </Space>
          {/* 顶部操作按钮仅在「智能体信息详情页」展示;360 画像视图下隐藏,
              360 视图自身的 Panel 内已提供 风险分级 / 报告 / 测试连接 等入口 */}
          {view === 'detail' && (
            <Space wrap>
              {editing ? (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving}
                    onClick={handleSave}
                  >
                    保存
                  </Button>
                  <Button onClick={handleCancelEdit}>取消</Button>
                </>
              ) : (
                isPlatformAdmin && (
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={handleEdit}
                  >
                    编辑
                  </Button>
                )
              )}
              {canDisable && !editing && (
                <Button danger icon={<StopOutlined />} onClick={() => handleStatusChange('disable')}>
                  禁用
                </Button>
              )}
              {canEnable && !editing && (
                <Button icon={<PlayCircleOutlined />} onClick={() => handleStatusChange('enable')}>
                  启用
                </Button>
              )}
              {!editing && !isHospitalLeader && (
                <Button icon={<SafetyCertificateOutlined />} onClick={handleGoRiskLevel}>
                  风险分级
                </Button>
              )}
              {!editing && agent.evaluationReport && (
                <Button icon={<FileSearchOutlined />} onClick={handleViewEvaluation}>
                  查看评测报告
                </Button>
              )}
              {!editing && agent.lifecycleStatus === '已上线' && (
                <Button icon={<MonitorOutlined />} onClick={handleViewMonitor}>
                  查看监控
                </Button>
              )}
            </Space>
          )}
        </Flex>
      </Card>

      <div style={{ marginBottom: 12 }}>
        <AgentLifecycleProgress
          currentStage={lifecycleStage}
          currentStageCompleted={lifecycleStage === '接入' && Boolean(agent.accessTime)}
          stagePaths={{
            ...(projectApplicationId ? { '立项': `/app/project-application/detail/${encodeURIComponent(projectApplicationId)}` } : {}),
            ...(accessRecord ? { '接入': `/app/agent-center/detail/${encodeURIComponent(accessRecord.id)}` } : {}),
            ...(safetyReportId ? { '安全性评测': `/app/evaluation/tasks/${encodeURIComponent(safetyReportId)}/report` } : {}),
            ...(pujiangTask ? { '浦江实验室评测': `/app/evaluation/tasks/pujiang/${encodeURIComponent(pujiangTask.id)}` } : {}),
            '上线': `/app/ledger/detail/${encodeURIComponent(agent.id)}?view=360`,
          }}
        />
      </div>

      {/* 360 画像视图(PRD §3.2.2 — 默认展示) */}
      {view === 'profile' && <ProfileView360 agent={agent} onSwitchToDetail={() => setView('detail')} />}

      {/* 原 V1.8 §2.2 画像布局(view='detail' 时展示,本次不改动) */}
      {view === 'detail' && (
        <>
      {/* V1.8 §2.2 画像布局：左侧虚拟形象 + 关联图谱；右侧 5 个 Tab */}
      <Row gutter={12} align="stretch">
        {/* 左侧：智能体虚拟形象 + 关联图谱 */}
        <Col
          xs={24}
          md={9}
          lg={8}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <Card
            bordered={false}
            bodyStyle={{ padding: 16, height: '100%', boxSizing: 'border-box' }}
            style={{ height: 136, marginBottom: 12, flex: '0 0 auto' }}
          >
            <Flex align="center" gap={16} style={{ height: '100%', minWidth: 0 }}>
              <div style={{ flex: '0 0 auto' }}>
                <AgentAvatar agent={agent} size={96} src={avatarSrc} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Tooltip title={agent.name}>
                  <div
                    style={{
                      marginBottom: 8,
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#262626',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {agent.name}
                  </div>
                </Tooltip>
                <Space size={[4, 4]} wrap>
                  <Tag style={{ marginRight: 0, fontFamily: 'monospace' }}>{agent.version}</Tag>
                  <Tag color="default" style={{ marginRight: 0 }}>{agent.type}</Tag>
                </Space>
                <div style={{ marginTop: 6, fontSize: 12, color: '#8C8C8C' }}>
                  <Text
                    code
                    ellipsis={{ tooltip: agent.idCode }}
                    style={{
                      maxWidth: '100%',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleCopyCode(agent.idCode)}
                  >
                    {agent.idCode} <CopyOutlined />
                  </Text>
                </div>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setAvatarOpen(true)}
                  style={{ height: 24, marginTop: 4, padding: 0 }}
                >
                  设置智能体头像
                </Button>
              </div>
            </Flex>
          </Card>
          <Card
            bordered={false}
            style={{ height: 430, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            styles={{
              header: { flex: '0 0 auto' },
              body: {
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              },
            }}
            title={
              <Space>
                <LinkOutlined style={{ color: '#1677FF' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>已对接资源关联图谱</span>
              </Space>
            }
            extra={
              <Tag color="default" style={{ marginRight: 0, fontSize: 11 }}>
                分层拓扑
              </Tag>
            }
            bodyStyle={{ padding: 12 }}
          >
            <ResourceGraph agent={agent} />
          </Card>
        </Col>

        {/* 右侧：5 个 Tab（V1.8 §2.2：基本信息 / 技术信息 / 备案材料 / 已对接资源信息 / 评测结果信息，默认基本信息） */}
        <Col
          xs={24}
          md={15}
          lg={16}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <Card
            bordered={false}
            bodyStyle={{ padding: '0 16px 16px' }}
            style={{ marginBottom: 12 }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'basic',
                  label: <span style={{ fontSize: 14 }}>基本信息</span>,
                  children: BasicInfoBlock,
                },
                {
                  key: 'tech',
                  label: <span style={{ fontSize: 14 }}>技术信息</span>,
                  children: TechInfoBlock,
                },
                {
                  key: 'filing',
                  label: <span style={{ fontSize: 14 }}>备案材料</span>,
                  children: FilingBlock,
                },
                {
                  key: 'linked',
                  label: <span style={{ fontSize: 14 }}>已对接资源信息</span>,
                  children: LinkedResourcesBlock,
                },
                {
                  key: 'eval',
                  label: <span style={{ fontSize: 14 }}>评测结果信息</span>,
                  children: EvaluationBlock,
                },
              ]}
            />
          </Card>

        </Col>
      </Row>
        </>
      )}

      <Modal
        open={avatarOpen}
        title="设置智能体头像"
        onCancel={() => setAvatarOpen(false)}
        footer={<Button type="primary" onClick={() => setAvatarOpen(false)}>完成</Button>}
        width={600}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 20 }}>
          <AgentAvatar agent={agent} size={132} src={avatarSrc} />
          <div style={{ flex: 1 }}>
            <Text strong>当前头像</Text>
            <Paragraph type="secondary" style={{ margin: '6px 0 12px' }}>
              未设置时，系统会根据智能体名称、类型和功能描述自动生成默认头像。
            </Paragraph>
            <Space wrap>
              <Upload showUploadList={false} accept="image/png,image/jpeg,image/webp" beforeUpload={handleUploadAvatar}>
                <Button icon={<UploadOutlined />}>上传头像</Button>
              </Upload>
              <Button icon={<UndoOutlined />} onClick={handleResetAvatar}>恢复默认</Button>
            </Space>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>支持 PNG、JPG、WebP，文件不超过 2MB</Text>
            </div>
          </div>
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: '#f7faff', border: '1px solid #e6f4ff' }}>
          <Text strong><BgColorsOutlined style={{ color: '#1677ff', marginRight: 6 }} />通过提示词生成</Text>
          <Input.TextArea
            value={avatarPrompt}
            onChange={(event) => setAvatarPrompt(event.target.value)}
            rows={3}
            maxLength={120}
            showCount
            placeholder="例如：专业温暖的医疗问诊机器人，蓝绿色，简洁科技感"
            style={{ marginTop: 10 }}
          />
          <Button type="primary" icon={<BgColorsOutlined />} onClick={handleGenerateAvatar} style={{ marginTop: 12 }}>
            生成并应用头像
          </Button>
        </div>
      </Modal>

      {/* 备案材料在线预览 */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            {previewFile?.name}
          </Space>
        }
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        width={960}
        extra={
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => message.success(`已下载 ${previewFile?.name}`)}
            >
              下载
            </Button>
            <Button onClick={() => window.open('#', '_blank')}>在新标签打开</Button>
          </Space>
        }
      >
        <div
          style={{
            height: '70vh',
            background: '#F5F5F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8C8C8C',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <FileTextOutlined style={{ fontSize: 64, color: '#D9D9D9' }} />
            <div style={{ marginTop: 16, fontSize: 14 }}>
              PDF 在线预览（演示环境嵌入 PDF.js 或 Office Online）
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#BFBFBF' }}>
              {previewFile?.name} · {previewFile?.size}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default LedgerDetail;
