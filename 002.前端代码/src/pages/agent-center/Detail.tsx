/**
 * 智能体接入中心 - 注册信息详情（独立下转页）
 *
 * V2.2：从原 Drawer 转为下转页面，给备案材料 / 基本信息 / 技术信息 / 审核说明 / 审核时间线 充足空间。
 * V2.3：PRD §3.4.1.2 — 删除嵌入式「接入进度 · 核心指标」卡片, 改为由 Agent 对话窗口呈现。
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  message,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import AgentLifecycleProgress from '../../components/AgentLifecycleProgress';
import ApprovalTimeline, { type ApprovalTimelineItem } from '../../components/ApprovalTimeline';
import { useAccessRecords } from './store';
import { useSmartDraft } from './smart/store.tsx';
import { useAuth } from '../../hooks/useAuth';
import { findProjectApplicationId } from '../project-application';
import { ledgerAgents } from '../../mock/ledger';
import { initialPujiangTasks } from '../evaluation/pujiang/data';
import { ROLE_ADMIN, ROLE_DEPT } from './types';
import type { InsightProgress, ProgressPhase } from './smart/types';
import {
  mockEvaluationTasks,
  persistChatEvaluationTask,
  type EvalDimension,
  type EvaluationTask,
} from '../../mock/evaluation';

const { Text, Paragraph } = Typography;

const Detail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const records = useAccessRecords();
  const record = records.find((r) => r.id === id);
  const projectApplicationId = record
    ? findProjectApplicationId(record.name, record.department)
    : undefined;
  const relatedSafetyTask = record
    ? mockEvaluationTasks.find((item) =>
        item.agentCode === record.agentCode || item.agentName === record.name,
      )
    : undefined;
  const relatedThirdPartyTask = record
    ? initialPujiangTasks.find((item) =>
        item.agentCode === record.agentCode || item.agentName === record.name,
      )
    : undefined;
  const relatedLedgerAgent = record
    ? ledgerAgents.find((item) =>
        item.idCode === record.agentCode || item.name === record.name,
      )
    : undefined;

  const [showSecret, setShowSecret] = useState(false);

  const { pushWelcomeGreeting, addTaggedMessage, removeMessagesByTag } = useSmartDraft();
  const { currentUser } = useAuth();
  const currentRole = currentUser?.roles[0] || ROLE_DEPT;
  const isPlatformAdmin = currentRole === ROLE_ADMIN;
  const loginName = currentUser?.name || '当前用户';
  const [evaluationTask, setEvaluationTask] = useState<EvaluationTask | null>(null);
  const [evaluationOfferDismissed, setEvaluationOfferDismissed] = useState(false);
  const shouldOfferEvaluation = Boolean(
    record && isPlatformAdmin && record.status === '审核通过' && !evaluationTask && !evaluationOfferDismissed,
  );

  // PRD §3.4.1.2 — 接入进度 + 核心指标改为对话窗口呈现(详情页不嵌入卡片)
  // 在 early-return 之前派生, 避免 hooks 顺序不一致
  const insightProgress: InsightProgress | null = useMemo(() => {
    if (!record) return null;
    const phase: ProgressPhase =
      record.status === '审核通过'
        ? 'success'
        : record.status === '审核中'
          ? 'reviewing'
          : 'pending';
    const metrics: InsightProgress['metrics'] = [
      { label: '接入状态', value: record.status, tone: phase === 'success' ? 'success' : 'info' },
      {
        label: '提交时间',
        value: record.submitTime ? record.submitTime.slice(0, 10) : '--',
        tone: 'info',
      },
      {
        label: '距通过',
        value:
          record.status === '审核通过'
            ? '已完成'
            : phase === 'reviewing'
              ? '审核中'
              : '未开始',
        tone: phase === 'success' ? 'success' : 'warning',
      },
    ];
    if (record.status === '审核通过') {
      metrics.push({
        label: '调用次数（今日）',
        value: `${Math.floor(Math.random() * 80 + 20)} 次`,
        tone: 'success',
      });
    }
    const nextActions: InsightProgress['nextActions'] =
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
              // V2.7: 同步带上 agentCode,与 Audit/index/List/InsightBubble 三入口保持一致
              path: `/app/evaluation/tasks/create?agentName=${encodeURIComponent(record.name)}&agentCode=${encodeURIComponent(record.agentCode)}`,
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
      metrics,
      nextActions,
    };
  }, [record, isPlatformAdmin]);

  // PRD §3.1.1 欢迎语：注册信息详情页 — 提供方 / 管理方文案一致,统一走 provider
  //   只读页气泡直接操作：【返回列表】+【查看附件】(滚动到备案材料 Card,无附件时置灰)
  useEffect(() => {
    if (shouldOfferEvaluation && record) {
      pushWelcomeGreeting('agent-center-eval-offer', 'admin', () => [record.name], {
        actions: [
          { key: 'create-evaluation', label: '确认创建', event: 'agent-detail-create-evaluation', enabled: true },
          { key: 'skip-evaluation', label: '暂不创建', event: 'agent-detail-skip-evaluation', enabled: true },
        ],
      });
      return;
    }
    const fmt = (n: number) => (n > 0 ? String(n) : '暂无');
    const visibleRecords = records.filter((r) => (isPlatformAdmin ? true : r.applicant === loginName));
    const count = (status: string) => visibleRecords.filter((r) => r.status === status).length;
    pushWelcomeGreeting('agent-center-detail', isPlatformAdmin ? 'admin' : 'dept', (_key, _role, surface) =>
      surface === 'bubble'
        ? isPlatformAdmin
          ? [fmt(count('待审核')), fmt(count('审核通过')), fmt(count('退回修改'))]
          : [fmt(count('审核中')), fmt(count('审核通过')), fmt(count('退回修改'))]
        : undefined,
    {
      actions: [
        { key: 'back', label: '返回', path: '/app/agent-center', enabled: true },
        {
          key: 'attachments',
          label: '附件预览 / 下载',
          event: 'agent-detail-scroll-attachments',
          enabled: !!record && record.attachments.length > 0,
          reason: '该记录暂无备案材料',
        },
      ],
    });
  }, [pushWelcomeGreeting, record, isPlatformAdmin, records, loginName, shouldOfferEvaluation]);

  useEffect(() => {
    if (!record || !isPlatformAdmin || record.status !== '审核通过' || evaluationTask) return;
    const clearNavigationFlag = () =>
      navigate(location.pathname, { replace: true, state: {} });
    const onSkip = () => {
      setEvaluationOfferDismissed(true);
      clearNavigationFlag();
      message.info('已暂不创建评测任务');
    };
    const onCreate = () => {
      const dimensions: EvalDimension[] = ['输入安全', '输出安全', '行为安全', '数据安全', '工具安全'];
      const stamp = Date.now();
      const created: EvaluationTask = {
        id: `task-audit-${record.id}-${stamp}`,
        taskNo: `EV${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(stamp).slice(-4)}`,
        agentCode: record.agentCode,
        agentId: record.id,
        agentName: record.name,
        version: record.version,
        riskLevel: '低风险',
        department: record.department,
        status: '评测中',
        sampleLevel: '标准评测',
        dimensions: dimensions.map((dimension) => ({ dimension, sampleLevel: '标准评测' })),
        submitTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
        createTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
        progress: 18,
        progressText: '54 / 300',
        creator: loginName,
      };
      mockEvaluationTasks.unshift(created);
      persistChatEvaluationTask(created);
      window.sessionStorage.setItem('agent-system.latestAuditEvaluationTaskId', created.id);
      setEvaluationTask(created);
      pushWelcomeGreeting(
        'agent-center-eval-created',
        'admin',
        () => [created.taskNo, created.status, created.progressText || '0 / 300'],
        {
          evaluationSummary: {
            taskNo: created.taskNo,
            agentName: created.agentName,
            dimensions: created.dimensions.map((item) => item.dimension),
            sampleLevel: created.sampleLevel,
            samplePercent: created.sampleLevel === '快速评测' ? 30 : created.sampleLevel === '标准评测' ? 60 : 100,
            progress: created.progress ?? 0,
            progressText: created.progressText || '0 / 300',
            estimatedRemaining: '还剩约 1 小时',
          },
          actions: [
            {
              key: 'evaluation-detail',
              label: '查看任务详情',
              event: 'agent-detail-open-current-evaluation',
              enabled: true,
            },
          ],
        },
      );
      message.success(`安全性评测任务 ${created.taskNo} 创建成功`);
      navigate(
        `/app/evaluation/tasks/${encodeURIComponent(created.id)}/report?fromTab=${encodeURIComponent('评测中')}`,
        {
          state: {
            evaluationCreated: true,
            evaluationTaskId: created.id,
          },
        },
      );
    };
    window.addEventListener('agent-detail-create-evaluation', onCreate);
    window.addEventListener('agent-detail-skip-evaluation', onSkip);
    return () => {
      window.removeEventListener('agent-detail-create-evaluation', onCreate);
      window.removeEventListener('agent-detail-skip-evaluation', onSkip);
    };
  }, [
    record,
    isPlatformAdmin,
    evaluationTask,
    location.pathname,
    loginName,
    navigate,
    pushWelcomeGreeting,
  ]);

  // 无论从机器人旁气泡还是展开后的对话消息点击，都只打开本次刚创建的任务。
  // 与评测中心任务列表的「查看详情」保持一致，统一进入 /report 任务详情页；
  // /progress 仅为旧版评测进度演示页，不再作为此处详情入口。
  useEffect(() => {
    const onOpenCurrentEvaluation = () => {
      const taskId =
        evaluationTask?.id ||
        window.sessionStorage.getItem('agent-system.latestAuditEvaluationTaskId');
      if (!taskId) {
        message.warning('未找到本次创建的评测任务');
        return;
      }
      navigate(
        `/app/evaluation/tasks/${encodeURIComponent(taskId)}/report?fromTab=${encodeURIComponent('评测中')}`,
      );
    };
    window.addEventListener('agent-detail-open-current-evaluation', onOpenCurrentEvaluation);
    return () =>
      window.removeEventListener('agent-detail-open-current-evaluation', onOpenCurrentEvaluation);
  }, [evaluationTask, navigate]);

  // 气泡「查看附件」→ 滚动到备案材料 Card
  useEffect(() => {
    const onScroll = () => {
      document
        .querySelector('[data-testid="detail-attachments-card"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('agent-detail-scroll-attachments', onScroll);
    return () => window.removeEventListener('agent-detail-scroll-attachments', onScroll);
  }, []);

  // PRD §3.4.1.2 — 进入详情页时, 把本条记录的进度 + 指标推到对话窗口呈现
  // 同一记录(record.id)重复进入不重复推; 切换记录时清掉上一条再推新的一条
  useEffect(() => {
    if (!insightProgress || !record) return;
    const tag = `__insight__:${record.id}`;
    addTaggedMessage(tag, {
      role: 'agent',
      type: 'insight-detail',
      content: `本条记录「${insightProgress.agentName}」当前接入进度与核心服务指标如下，可点击下方按钮一键直达。`,
      payload: { insightProgress },
    });
    // 卸载 / record 切换时清掉本条 insight 气泡, 避免切换记录后窗口堆两条
    return () => {
      removeMessagesByTag(tag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insightProgress, addTaggedMessage, removeMessagesByTag]);

  if (!record) {
    return (
      <>
        <PageHeader title="注册信息详情" subTitle="未找到对应的注册记录" showBack onBack={() => navigate(-1)} />
        <Card>
          <Empty description="该记录不存在或已被删除" />
        </Card>
      </>
    );
  }

  const auditTimelineItems: ApprovalTimelineItem[] = record.auditHistory
    .filter((node) =>
      ['提交注册申请', '提交审核', '修改重提', '重新注册提交审核', '审核中', '审核通过', '退回修改'].includes(node.label),
    )
    .map((node) => {
      const isSubmit = ['提交注册申请', '提交审核', '修改重提', '重新注册提交审核'].includes(node.label);
      const isReviewing = node.label === '审核中';
      const isCompleted = node.label === '审核通过' || node.label === '退回修改';
      const auditHasFinished = record.status === '审核通过' || record.status === '退回修改';

      return {
        title:
          node.label === '提交注册申请'
            ? '提交审核'
            : node.label === '修改重提'
              ? '重新注册提交审核'
              : node.label,
        time: node.time,
        timeLabel: isSubmit ? '提交审核时间' : isReviewing ? '开始审核时间' : '审核完成时间',
        operator: node.operator,
        operatorLabel: isSubmit ? '提交人' : '审核人',
        description: isCompleted ? node.desc || '—' : undefined,
        descriptionLabel: isCompleted ? '具体说明' : undefined,
        // 与立项详情一致：流程产生终审结论后，此前的“审核中”节点属于已完成步骤。
        status: isReviewing && auditHasFinished ? 'finish' : node.status,
      };
    });

  return (
    <>
      <PageHeader
        title={`注册信息详情：${record.name}`}
        subTitle={`注册编号 ${record.agentCode || '--'} · ${record.department} · ${record.applicant}`}
        showBack
        onBack={() => navigate('/app/agent-center')}
        breadcrumb={[
          { path: '/app/agent-center', breadcrumbName: '智能体接入中心' },
          { path: '/app/agent-center', breadcrumbName: '注册管理' },
          { path: id ? `/app/agent-center/detail/${id}` : '', breadcrumbName: '详情' },
        ]}
      />

      <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 12 }}>
        <AgentLifecycleProgress
          currentStage={record.status !== '审核通过'
            ? '接入'
            : relatedLedgerAgent?.onlineTime
            ? '上线'
            : relatedThirdPartyTask
              ? '浦江实验室评测'
              : relatedSafetyTask || evaluationTask
                ? '安全性评测'
                : '接入'}
          currentStageCompleted={Boolean(
            record.status !== '审核通过'
              ? false
              : relatedLedgerAgent?.onlineTime
              ? true
              : relatedThirdPartyTask
                ? relatedThirdPartyTask.status === '评测通过'
                : relatedSafetyTask || evaluationTask
                  ? (relatedSafetyTask || evaluationTask)?.status === '审核通过'
                  : record.status === '审核通过'
          )}
          stagePaths={{
            ...(projectApplicationId ? { '立项': `/app/project-application/detail/${encodeURIComponent(projectApplicationId)}` } : {}),
            '接入': `/app/agent-center/detail/${encodeURIComponent(record.id)}`,
            ...(record.status === '审核通过' && (relatedSafetyTask || evaluationTask) ? { '安全性评测': `/app/evaluation/tasks/${encodeURIComponent((relatedSafetyTask || evaluationTask)!.id)}/report` } : {}),
            ...(record.status === '审核通过' && relatedThirdPartyTask ? { '浦江实验室评测': `/app/evaluation/tasks/pujiang/${encodeURIComponent(relatedThirdPartyTask.id)}` } : {}),
            ...(record.status === '审核通过' && relatedLedgerAgent ? { '上线': `/app/ledger/detail/${encodeURIComponent(relatedLedgerAgent.id)}?view=360` } : {}),
          }}
        />
        <div data-testid="detail-attachments-card">
        <Card title="备案材料" size="small">
          {record.attachments.length === 0 && <Empty description="无备案材料" />}
          {record.attachments.map((a, i) => (
            <Row key={i} gutter={8} align="middle" style={{ padding: '6px 0' }}>
              <Col flex="auto">
                <Space>
                  <FilePdfOutlined style={{ color: '#d4380d' }} />
                  <Text>附件 {i + 1}：{a.name}</Text>
                  <Text type="secondary">（{a.size}）</Text>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      Modal.info({
                        title: `预览：${a.name}`,
                        width: 720,
                        content: (
                          <div style={{ marginTop: 8 }}>
                            <div
                              style={{
                                background: '#fafafa',
                                border: '1px solid #f0f0f0',
                                borderRadius: 4,
                                padding: '40px 24px',
                                textAlign: 'center',
                                color: '#999',
                              }}
                            >
                              <FilePdfOutlined style={{ fontSize: 36, color: '#d4380d' }} />
                              <div style={{ marginTop: 8 }}>{a.name}</div>
                              <div style={{ marginTop: 4, fontSize: 12 }}>
                                （{a.size}）演示文件仅展示元信息
                              </div>
                            </div>
                          </div>
                        ),
                      });
                    }}
                  >
                    在线预览
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => message.success(`已下载 ${a.name}`)}
                  >
                    下载
                  </Button>
                </Space>
              </Col>
            </Row>
          ))}
        </Card>
        </div>

        <Card title="基本信息" size="small">
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="智能体名称">{record.name}</Descriptions.Item>
            <Descriptions.Item label="智能体编号">{record.agentCode || '--'}</Descriptions.Item>
            <Descriptions.Item label="所属科室">{record.department}</Descriptions.Item>
            <Descriptions.Item label="诊疗环节">{record.clinicalStage}</Descriptions.Item>
            <Descriptions.Item label="智能体来源">{record.source}</Descriptions.Item>
            <Descriptions.Item label="供应商名称">
              {record.source === '自研' ? '--' : record.supplier}
            </Descriptions.Item>
            <Descriptions.Item label="技术联系人">{record.contactName}</Descriptions.Item>
            <Descriptions.Item label="联系方式">{record.contactPhone}</Descriptions.Item>
            <Descriptions.Item label="智能体类型">{record.type}</Descriptions.Item>
            <Descriptions.Item label="智能体版本">{record.version}</Descriptions.Item>
            {(record.modelConfigs?.length
              ? record.modelConfigs
              : [{
                  modelName: record.modelName || '',
                  modelVersion: record.modelVersion || '',
                  deploymentMode: record.modelDeploymentMode || '',
                }]
            ).flatMap((model, index) => [
              <Descriptions.Item
                key={`model-name-${index}`}
                label={`使用模型名称${(record.modelConfigs?.length || 0) > 1 ? `（模型 ${index + 1}）` : ''}`}
              >
                {model.modelName || '--'}
              </Descriptions.Item>,
              <Descriptions.Item
                key={`model-version-${index}`}
                label={`使用模型版本${(record.modelConfigs?.length || 0) > 1 ? `（模型 ${index + 1}）` : ''}`}
              >
                {model.modelVersion || '--'}
              </Descriptions.Item>,
              <Descriptions.Item
                key={`model-deployment-${index}`}
                label={`模型部署方式${(record.modelConfigs?.length || 0) > 1 ? `（模型 ${index + 1}）` : ''}`}
                span={2}
              >
                {model.deploymentMode || '--'}
              </Descriptions.Item>,
            ])}
            <Descriptions.Item label="功能描述" span={2}>
              <Paragraph style={{ marginBottom: 0 }}>{record.description}</Paragraph>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="技术信息" size="small">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="接入方式">
              <Tag
                color={
                  record.accessMode === 'API'
                    ? 'blue'
                    : record.accessMode === 'SDK'
                      ? 'cyan'
                      : 'purple'
                }
              >
                {record.accessMode} 接入
              </Tag>
            </Descriptions.Item>
            {record.accessMode === 'API' && (
              <>
                <Descriptions.Item label="接口地址">
                  <Text copyable>{record.apiEndpoint}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="API key">
                  <Space>
                    <Text code>
                      {showSecret
                        ? record.apiKey
                        : (record.apiKey || '').replace(/(?<=.{4}).(?=.{4})/g, '*')}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={showSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowSecret((s) => !s)}
                    >
                      {showSecret ? '隐藏' : '显示'}
                    </Button>
                  </Space>
                </Descriptions.Item>
              </>
            )}
            {(record.accessMode === 'SDK' || record.accessMode === 'OTel') && (
              <>
                <Descriptions.Item label="平台 URL 地址">
                  <Text copyable>{record.platformUrl}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="平台密钥 key">
                  <Space>
                    <Text code>{showSecret ? record.platformKey : 'sk-****'}</Text>
                    <Button
                      type="text"
                      size="small"
                      icon={showSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowSecret((s) => !s)}
                    >
                      {showSecret ? '隐藏' : '显示'}
                    </Button>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="埋点代码">
                  <pre style={{ background: '#fafafa', padding: 8, borderRadius: 4, margin: 0 }}>
                    {`// ${record.accessMode} 埋点代码片段（点击复制后嵌入智能体应用）\nimport { init } from '@platform/agent-${record.accessMode.toLowerCase()}';\ninit({ endpoint: '${record.platformUrl}', key: '${record.platformKey}' });`}
                  </pre>
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="测试验证">
              {record.connectionTested ? (
                <Tag color={record.connectionStatus === 'success' ? 'green' : 'red'}>
                  {record.connectionStatus === 'success' ? '联通成功' : '联通失败'}
                </Tag>
              ) : (
                <Text type="secondary">未测试</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {(record.returnReason || record.passNote) && (
          <Card title="审核说明" size="small">
            {record.returnReason && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 8 }}
                message="退回修改"
                description={record.returnReason}
              />
            )}
            {record.passNote && (
              <Alert
                type="success"
                showIcon
                message="审核通过意见"
                description={record.passNote}
              />
            )}
          </Card>
        )}

        {/* §3.4.1.2 PRD：接入进度 + 核心指标 + 一键直达 不再在详情页嵌入卡片,
            改为由 Agent 对话窗口呈现(详见 useEffect → addMessage('insight-detail')) */}

        <ApprovalTimeline items={auditTimelineItems} title="审核时间线" />
      </Space>
    </>
  );
};

export default Detail;
