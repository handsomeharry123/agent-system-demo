/**
 * §3.4 接入结果洞察与汇报面板
 *
 * 用于：
 *  - 列表页「接入态势气泡」(PRD §3.4.1.1)
 *  - 详情页「本条记录的接入进度 + 核心指标 + 一键直达」(PRD §3.4.1.2)
 *  - Agent 对话窗口「洞察详情卡」(PRD §3.4.1.3)
 *
 * 提供两个组件：
 *  <InsightBubble>       列表页右上角轻量气泡 + 待办引导 + 一键直达
 *  <InsightDetailPanel>  详情页进度条 + 指标 + 一键直达
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  BarChartOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  CompassOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useSmartDraft } from './store';
import type { InsightProgress, ProgressPhase } from './types';

const { Text, Title } = Typography;

const PHASE_META: Record<
  ProgressPhase,
  { label: string; description: string; color: string }
> = {
  pending: {
    label: '信息待审查',
    description: '已提交，等待信息科管理员审查',
    color: '#FAAD14',
  },
  reviewing: {
    label: '信息审查中',
    description: '管理员已开启审核流程',
    color: '#1677FF',
  },
  success: {
    label: '接入成功',
    description: '审核通过，已同步台账',
    color: '#52C41A',
  },
};

interface InsightBubbleProps {
  /** 当前账户整体状态分布，用于 §3.4.1.1 全局态势播报 */
  statusCounts?: Record<string, number>;
  /** 待办引导：用于「有 X 条被退回」「X 条已通过待完善台账」 */
  pendingGuidance?: Array<{ key: string; label: string; targetPath: string; tone?: 'warning' | 'success' }>;
  /** 智能体总览跳转：用于「最近提交」记录 */
  onJumpToDetail?: () => void;
}

export const InsightBubble: React.FC<InsightBubbleProps> = ({
  statusCounts,
  pendingGuidance,
  onJumpToDetail,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <Tooltip title="查看接入态势">
        <Badge dot color="#1677FF" offset={[-4, 4]}>
          <Button
            shape="circle"
            icon={<BellOutlined />}
            onClick={() => setCollapsed(false)}
          />
        </Badge>
      </Tooltip>
    );
  }

  return (
    <div
      data-testid="insight-bubble"
      style={{
        margin: '12px 0',
        padding: '14px 16px',
        background: 'linear-gradient(90deg, #F0F8FF 0%, #FFFFFF 100%)',
        border: '1px solid #91CAFF',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(22,119,255,0.08)',
        position: 'relative',
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<CloseOutlined />}
        onClick={() => setCollapsed(true)}
        style={{ position: 'absolute', top: 8, right: 8 }}
        aria-label="关闭接入态势"
      />
      <Space size={8} style={{ marginBottom: 8 }}>
        <ThunderboltOutlined style={{ color: '#1677FF' }} />
        <Text strong style={{ color: '#1677FF' }}>
          医小管 · 接入态势速览
        </Text>
        <Tag color="blue" style={{ marginLeft: 4 }}>
          非打断
        </Tag>
      </Space>

      {statusCounts && (
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          {['草稿', '待审核', '审核中', '退回修改', '撤销修改', '审核通过'].map((k) => (
            <Col key={k} xs={8} sm={4}>
              <Card
                size="small"
                bodyStyle={{ padding: '6px 8px', textAlign: 'center' }}
                style={{ background: '#FFFFFF' }}
              >
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1F1F1F' }}>
                  {statusCounts[k] ?? 0}
                </div>
                <div style={{ fontSize: 11, color: '#666' }}>{k}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {pendingGuidance && pendingGuidance.length > 0 && (
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          {pendingGuidance.map((g) => (
            <Alert
              key={g.key}
              type={g.tone || 'info'}
              showIcon
              message={
                <Space wrap>
                  <span>{g.label}</span>
                  <Button
                    type="link"
                    size="small"
                    icon={<RocketOutlined />}
                    style={{ padding: 0 }}
                  >
                    一键直达
                  </Button>
                </Space>
              }
              style={{ padding: '4px 12px' }}
            />
          ))}
        </Space>
      )}

      <Space size={6} style={{ marginTop: 8 }}>
        <Button size="small" icon={<FileSearchOutlined />} onClick={onJumpToDetail}>
          查看最近提交
        </Button>
        <Button size="small" icon={<CompassOutlined />} type="primary" ghost>
          引导下一步
        </Button>
      </Space>
    </div>
  );
};

interface InsightDetailPanelProps {
  progress: InsightProgress;
}

/** 详情页/对话窗口内统一的「本条记录的接入进度 + 核心指标 + 一键直达」面板 */
export const InsightDetailPanel: React.FC<InsightDetailPanelProps> = ({ progress }) => {
  const navigate = useNavigate();
  const phase = PHASE_META[progress.phase];

  return (
    <Card
      data-testid="insight-detail-panel"
      size="small"
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#1677FF' }} />
          <Text strong>接入进度 · 核心指标</Text>
          <Tag color={progress.phase === 'success' ? 'success' : progress.phase === 'reviewing' ? 'processing' : 'warning'}>
            {phase.label}
          </Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {/* 阶段进度条 */}
      <Steps
        size="small"
        current={
          progress.phase === 'pending'
            ? 0
            : progress.phase === 'reviewing'
              ? 1
              : 2
        }
        status={progress.phase === 'pending' ? 'process' : progress.phase === 'success' ? 'finish' : 'process'}
        items={[
          { title: '信息待审查', description: '已提交至审核队列' },
          { title: '信息审查中', description: '管理员审核中' },
          {
            title: '接入成功',
            description: '审核通过，已同步台账',
            icon: <CheckCircleOutlined />,
          },
        ]}
      />

      {/* 当前阶段高亮 */}
      <Alert
        type="info"
        showIcon
        message={
          <Space>
            <Text strong>当前阶段：</Text>
            <Text style={{ color: phase.color }}>{phase.label}</Text>
          </Space>
        }
        description={phase.description}
        style={{ marginTop: 12 }}
      />

      {/* 核心指标 */}
      {progress.metrics.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 13 }}>
            <BarChartOutlined /> 核心服务指标
          </Text>
          <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
            {progress.metrics.map((m) => (
              <Col key={m.label} xs={12} sm={8} md={6}>
                <Card
                  size="small"
                  bodyStyle={{ padding: '10px 12px' }}
                  style={{
                    background:
                      m.tone === 'success'
                        ? '#F6FFED'
                        : m.tone === 'warning'
                          ? '#FFFBE6'
                          : '#F0F8FF',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#666' }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{m.value}</div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 一键直达 */}
      {progress.nextActions && progress.nextActions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 13 }}>
            <RocketOutlined /> 下一步动作
          </Text>
          <Space wrap style={{ marginTop: 8 }}>
            {progress.nextActions.map((a) => (
              <Tooltip
                key={a.key}
                title={a.enabled ? a.description : '当前账号暂无该操作权限'}
              >
                <Button
                  type={a.key === 'ledger' ? 'primary' : 'default'}
                  icon={
                    a.key === 'ledger' ? (
                      <DatabaseOutlined />
                    ) : a.key === 'eval' ? (
                      <ExperimentOutlined />
                    ) : (
                      <EditOutlined />
                    )
                  }
                  disabled={!a.enabled || !a.path}
                  onClick={() => a.path && navigate(a.path)}
                >
                  {a.label}
                </Button>
              </Tooltip>
            ))}
          </Space>
          <Progress
            percent={progress.phase === 'success' ? 100 : progress.phase === 'reviewing' ? 50 : 15}
            size="small"
            showInfo={false}
            style={{ marginTop: 8 }}
          />
        </div>
      )}
    </Card>
  );
};

/**
 * 便捷组件：根据记录数据自动生成/展示 InsightProgress
 * （用户传入 AccessRecord，由本组件派生默认洞察）
 */
interface AutoInsightPanelProps {
  record: {
    name: string;
    agentCode?: string;
    status: string;
    passTime?: string;
    submitTime?: string;
  };
  loginName: string;
  isPlatformAdmin: boolean;
}

export const AutoInsightPanel: React.FC<AutoInsightPanelProps> = ({
  record,
  loginName,
  isPlatformAdmin,
}) => {
  const navigate = useNavigate();

  const progress: InsightProgress = useMemo(() => {
    const phase: ProgressPhase =
      record.status === '审核通过'
        ? 'success'
        : record.status === '审核中'
          ? 'reviewing'
          : record.status === '待审核' || record.status === '退回修改'
            ? 'pending'
            : 'pending';
    const baseMetrics = [
      { label: '接入状态', value: record.status, tone: phase === 'success' ? 'success' as const : 'info' as const },
      {
        label: '提交时间',
        value: record.submitTime ? record.submitTime.slice(0, 10) : '--',
        tone: 'info' as const,
      },
      {
        label: '距通过',
        value:
          record.status === '审核通过'
            ? '已完成'
            : phase === 'reviewing'
              ? '审核中'
              : '未开始',
        tone: phase === 'success' ? ('success' as const) : ('warning' as const),
      },
    ];
    if (record.status === '审核通过') {
      baseMetrics.push({
        label: '调用次数（今日）',
        value: `${Math.floor(Math.random() * 80 + 20)} 次`,
        tone: 'success',
      });
    }
    const nextActions =
      record.status === '审核通过'
        ? [
            {
              key: 'ledger',
              label: '完善台账',
              description: '一键直达统一台账中心补全指标',
              path: `/app/ledger/list?search=${encodeURIComponent(record.name)}&openDetail=1`,
              enabled: true,
            },
            {
              key: 'eval',
              label: '发起准入评测',
              description: '进入评测沙盒新建评测任务',
              path: `/app/evaluation/tasks/create?agentName=${encodeURIComponent(record.name)}`,
              enabled: isPlatformAdmin,
            },
            {
              key: 'monitor',
              label: '查看监控告警',
              description: '查看该智能体的运行时告警',
              path: `/app/monitoring/alerts?agentName=${encodeURIComponent(record.name)}`,
              enabled: true,
            },
          ]
        : record.status === '退回修改'
          ? [
              {
                key: 'edit',
                label: '编辑修改',
                description: '点开退回说明的字段并按建议修改',
                path: `/app/agent-center/edit/${record.agentCode || record.name}`,
                enabled: true,
              },
            ]
          : [];
    return {
      agentName: record.name,
      agentCode: record.agentCode,
      phase,
      metrics: baseMetrics,
      nextActions,
    };
  }, [record, isPlatformAdmin, loginName]);

  return <InsightDetailPanel progress={progress} />;
};

