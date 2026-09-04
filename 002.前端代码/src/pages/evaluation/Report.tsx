// =============================================================================
// 评测结果详情页（V1.6 §三 · 3.3）
//   · 3.3.1 智能体基本信息
//   · 3.3.2 最新评测结果总览（核心结论 + 具体说明）
//   · 3.3.3 最新评测结果详情：① 表格（维度/指标/原始值/得分/评测完成时间）② 柱状图
//   · 3.3.4 历次评测结果详情：① 表格（历次时间/维度/得分/结论）② 折线图
//   · 顶部操作：审核（仅管理员）/ 报告查看 / 报告下载（PDF）/ 返回
//   · 报告 PDF：基于 docx 模板 V1 前端渲染（jspdf + html2canvas）
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Descriptions,
  Row,
  Col,
  Statistic,
  Table,
  Result,
  Modal,
  message,
  Alert,
  Divider,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  AuditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Column, Line } from '@ant-design/charts';
import PageHeader from '../../components/PageHeader';
import AgentLifecycleProgress, { type AgentLifecycleStage } from '../../components/AgentLifecycleProgress';
import ApprovalTimeline, { type ApprovalTimelineItem } from '../../components/ApprovalTimeline';
import {
  getTaskById,
  getReportByTaskId,
  getHistoryByAgent,
  dimensionColorMap,
  riskLevelColorMap,
  statusColorMap,
  conclusionColorMap,
  type EvaluationTask,
  type EvaluationReport as ReportModel,
  type DimensionScore,
  type IndicatorType,
  type EvalDimension,
} from '../../mock/evaluation';
import { useAuth } from '../../hooks/useAuth';
import { generateReportPdf, downloadReportBlob, safeFilename, buildReportHtml } from './ReportPdf';
import { useSmartDraft } from '../agent-center/smart/store';
import { useAccessRecords } from '../agent-center/store';
import { findProjectApplicationId } from '../project-application';
import { ledgerAgents } from '../../mock/ledger';
import { initialPujiangTasks } from './pujiang/data';

const { Text, Title, Paragraph } = Typography;

const indicatorNameMap: Record<IndicatorType, string> = {
  ASR: '攻击成功率',
  GCR: '生成合规率',
  RR: '拒绝率',
  PLR: '隐私泄露率',
};

const calcScoreColor = (s: number) => (s >= 80 ? '#52C41A' : s >= 60 ? '#FAAD14' : '#FF4D4F');

const EvaluationReport = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromTab = searchParams.get('fromTab') || '';
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const { pushWelcomeGreeting } = useSmartDraft();
  const accessRecords = useAccessRecords();

  // 返回上一级：若来自某个 Tab（Tasks 列表传入 fromTab），返回时切回该 Tab；
  // 否则默认跳到「全部任务」。
  const goBackToTasks = () => {
    const qs = fromTab && fromTab !== 'all' ? `?tab=${encodeURIComponent(fromTab)}` : '';
    navigate(`/app/evaluation/tasks${qs}`);
  };

  // 表格 hover 维度 → 柱状图联动（用 ref + CSS，避免父级 re-render 触发 G2 chart 重渲）
  const hoverDimRef = useRef<EvalDimension | null>(null);
  // G2 图表实例引用（用于表格 hover 时主动触发柱状图高亮）
  const chartRef = useRef<any>(null);

  const task: EvaluationTask | undefined = getTaskById(id || '');
  const report: ReportModel | undefined = task ? getReportByTaskId(task.id) : undefined;
  const safetyPassed = Boolean(report?.conclusion === '准入' || task?.status === '审核通过');
  const isApprovedTabEntry = fromTab === '审核通过';
  const accessRecord = task
    ? accessRecords.find((item) => item.id === task.agentId || item.agentCode === task.agentCode || item.name === task.agentName) ||
      (task.id === 'task-004' ? accessRecords.find((item) => item.id === 'acc-003') : undefined)
    : undefined;
  const projectApplicationId = task ? findProjectApplicationId(task.agentName, task.department) : undefined;
  const thirdPartyTask = task
    ? initialPujiangTasks.find((item) => item.agentId === task.agentId || item.agentCode === task.agentCode || item.agentName === task.agentName)
    : undefined;
  const ledgerAgent = task
    ? ledgerAgents.find((item) => item.id === task.agentId || item.idCode === task.agentCode || item.name === task.agentName)
    : undefined;
  const safetyCompleted = task?.status === '审核通过';
  // 安全评测未审核通过时必须停留在当前节点；不能因同名演示数据提前进入后续阶段。
  const lifecycleStage: AgentLifecycleStage = safetyCompleted && ledgerAgent?.onlineTime
    ? '上线'
    : safetyCompleted && thirdPartyTask
      ? '浦江实验室评测'
      : '安全性评测';

  useEffect(() => {
    if (!task) return undefined;
    const createdFromAgentDetail = Boolean(
      location.state?.evaluationCreated && location.state?.evaluationTaskId === task.id,
    );
    const shouldGuidePujiang =
      isAdmin && isApprovedTabEntry && safetyPassed && lifecycleStage === '安全性评测';
    const role = shouldGuidePujiang ? 'admin' : isAdmin ? 'provider' : 'dept';
    pushWelcomeGreeting(createdFromAgentDetail ? 'agent-center-eval-created' : 'evaluation-report', role, () =>
      createdFromAgentDetail
        ? [task.taskNo, task.status, task.progressText || '0 / 300']
        : [task.agentName],
    createdFromAgentDetail ? {
      evaluationSummary: {
        taskNo: task.taskNo,
        agentName: task.agentName,
        dimensions: task.dimensions.map((item) => item.dimension),
        sampleLevel: task.sampleLevel,
        samplePercent: task.sampleLevel === '快速评测' ? 30 : task.sampleLevel === '标准评测' ? 60 : 100,
        progress: task.progress ?? 0,
        progressText: task.progressText || '0 / 300',
        estimatedRemaining: '还剩约 1 小时',
      },
    } : shouldGuidePujiang ? {
      actions: [
        { key: 'start-pujiang', label: '确认开展', event: 'evaluation-report-start-pujiang', enabled: true },
        { key: 'defer-pujiang', label: '暂不开展', event: 'evaluation-report-defer-pujiang', enabled: true },
      ],
    } : undefined);
    (window as any).__evaluationReportContext = {
      agentName: task.agentName,
      agentCode: task.agentCode,
      version: task.version,
      department: task.department,
      creator: task.creator,
      taskNo: task.taskNo,
      status: task.status,
      riskLevel: task.riskLevel,
      totalScore: task.totalScore,
      submitTime: task.submitTime,
      evalCompleteTime: task.evalCompleteTime,
      reviewComment: task.reviewComment,
      reportReady: !!report,
      overallRisk: report?.overallRisk,
      conclusion: report?.conclusion,
      redLineTriggered: report?.redLineTriggered,
      detailDesc: report?.detailDesc,
      dimensions: report?.dimensionScores.map((item) => ({
        ...item,
        indicatorName: indicatorNameMap[item.indicator],
      })) || [],
      history: getHistoryByAgent(task.agentId, task.id),
    };
    return () => {
      delete (window as any).__evaluationReportContext;
    };
  }, [isAdmin, isApprovedTabEntry, lifecycleStage, location.state, pushWelcomeGreeting, report, safetyPassed, task]);

  useEffect(() => {
    if (
      !task || !isAdmin || !isApprovedTabEntry || !safetyPassed || lifecycleStage !== '安全性评测'
    ) return undefined;
    const onStartPujiang = () => {
      navigate(`/app/evaluation/tasks/pujiang/create?sourceTaskId=${encodeURIComponent(task.id)}`);
    };
    const onDeferPujiang = () => message.info('已暂不开展浦江实验室评测');
    window.addEventListener('evaluation-report-start-pujiang', onStartPujiang);
    window.addEventListener('evaluation-report-defer-pujiang', onDeferPujiang);
    return () => {
      window.removeEventListener('evaluation-report-start-pujiang', onStartPujiang);
      window.removeEventListener('evaluation-report-defer-pujiang', onDeferPujiang);
    };
  }, [isAdmin, isApprovedTabEntry, lifecycleStage, navigate, safetyPassed, task]);

  if (!task) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Result
          status="404"
          title="评测结果不存在"
          subTitle="该评测任务可能尚未完成或已被删除"
          extra={<Button onClick={goBackToTasks}>返回任务列表</Button>}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 维度得分（按从高到低排列）
  // ---------------------------------------------------------------------------
  const sortedDimensions = useMemo(() => {
    if (!report) return [];
    return [...report.dimensionScores].sort((a, b) => b.score - a.score);
  }, [report]);

  // 柱状图数据（稳定引用，避免 Column 重复 re-render 触发 G2 重渲导致 state 丢失）
  const chartData = useMemo(
    () => sortedDimensions.map((d) => ({ name: d.dimension, value: d.score })),
    [sortedDimensions]
  );

  // ---------------------------------------------------------------------------
  // 历次评测记录
  // ---------------------------------------------------------------------------
  const history = useMemo(
    () => (task ? getHistoryByAgent(task.agentId, task.id) : []),
    [task]
  );

  // ---------------------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------------------
  const handleStartReview = () => {
    Modal.confirm({
      title: '发起审核',
      content: `确认对「${task.agentName}」的评测结果发起人工审核？`,
      okText: '确认发起',
      cancelText: '取消',
      onOk: () => {
        task.status = '审核中';
        task.reviewStartTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        message.success('已发起审核');
        navigate(`/app/evaluation/tasks/${task.id}/review`);
      },
    });
  };

  const handleReEval = () => {
    Modal.confirm({
      title: '重新评测',
      content: '将按原任务配置（已根据退回原因调整）发起新一轮评测，确认？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        message.success('已发起新一轮评测任务，状态进入「评测中」');
        navigate('/app/evaluation/tasks');
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 报告 PDF：在线预览（HTML 直接渲染）+ 下载（PDF）
  // ---------------------------------------------------------------------------
  const pdfHostRef = useRef<HTMLDivElement>(null);
  // 预览 Modal 显示的 HTML 字符串（null = Modal 关闭）
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const reportReady = !!report;

  /** 触发 PDF 渲染；返回 blob 或 null（失败时） */
  const buildPdf = async () => {
    if (!pdfHostRef.current) {
      message.error('PDF 渲染容器未就绪');
      return null;
    }
    setGenerating(true);
    try {
      return await generateReportPdf(task, report, history, pdfHostRef.current);
    } catch (err) {
      console.error('[ReportPdf] 生成失败', err);
      message.error('报告生成失败，请稍后重试');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  /**
   * 在线预览：直接用 React 渲染同一份报告 HTML，绕开浏览器内置 PDF viewer
   * （Chrome 部分版本会屏蔽 blob URL 中的 PDF / 部分用户禁用 PDF viewer，
   *  HTML 渲染 100% 可视）
   */
  const onPreviewReport = () => {
    setPreviewHtml(buildReportHtml(task, report, history));
    setPreviewTitle(`${task.agentName} · 评测报告预览`);
  };

  const onDownloadReport = async () => {
    const blob = await buildPdf();
    if (!blob) return;
    const name = `${safeFilename(task.agentName)}_评测报告_${task.taskNo}.pdf`;
    downloadReportBlob(blob, name);
    message.success(`已下载 ${name}`);
  };

  const closePreview = () => {
    setPreviewHtml(null);
  };

  // ---------------------------------------------------------------------------
  // 结论 Tag
  // ---------------------------------------------------------------------------
  const conclusionTag = (() => {
    if (task.status === '审核通过') return <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>审核通过 · 准入</Tag>;
    if (task.status === '退回重测') return <Tag color="error" style={{ fontSize: 14, padding: '4px 12px' }}>已退回</Tag>;
    if (task.status === '审核中') return <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>审核中</Tag>;
    if (task.status === '评测中') return <Tag color="processing" style={{ fontSize: 14, padding: '4px 12px' }}>评测中</Tag>;
    if (report?.conclusion === '准入') return <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>准入</Tag>;
    if (report?.conclusion === '退回') return <Tag color="error" style={{ fontSize: 14, padding: '4px 12px' }}>退回</Tag>;
    return <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>待人工复核</Tag>;
  })();

  // ---------------------------------------------------------------------------
  // 表格数据：最新评测结果详情
  // ---------------------------------------------------------------------------
  const dimColumns: ColumnsType<DimensionScore> = [
    {
      title: '评测维度',
      dataIndex: 'dimension',
      key: 'dimension',
      width: 130,
      render: (v: EvalDimension) => <Tag color={dimensionColorMap[v]}>{v}</Tag>,
    },
    {
      title: '评测指标',
      key: 'indicator',
      width: 130,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{indicatorNameMap[r.indicator]}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.indicator}</Text>
        </Space>
      ),
    },
    {
      title: '原始值',
      dataIndex: 'rawValue',
      key: 'rawValue',
      width: 100,
      render: (v: number) => `${v}%`,
    },
    {
      title: '维度得分',
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (v: number) => (
        <Text style={{ color: calcScoreColor(v), fontWeight: 600, fontSize: 16 }}>{v.toFixed(1)}</Text>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 110,
      render: (v: string) => <Tag color={riskLevelColorMap[v as keyof typeof riskLevelColorMap]}>{v}</Tag>,
    },
    {
      title: '评测完成时间',
      key: 'evalTime',
      render: () => task.evalCompleteTime || '-',
    },
  ];

  // ---------------------------------------------------------------------------
  // 表格数据：历次评测
  // ---------------------------------------------------------------------------
  const historyTableData = history.map((h) => ({
    key: h.taskId,
    evalTime: h.evalTime,
    overallRisk: h.overallRisk,
    conclusion: h.conclusion,
    dimensionScores: h.dimensionScores,
  }));
  const historyColumns: ColumnsType<typeof historyTableData[0]> = [
    { title: '历次评测时间', dataIndex: 'evalTime', key: 'evalTime', width: 170 },
    {
      title: '整体风险等级',
      dataIndex: 'overallRisk',
      key: 'overallRisk',
      width: 130,
      render: (v: string) => <Tag color={riskLevelColorMap[v as keyof typeof riskLevelColorMap]}>{v}</Tag>,
    },
    {
      title: '评测结论',
      dataIndex: 'conclusion',
      key: 'conclusion',
      width: 120,
      render: (v: string) => <Tag color={conclusionColorMap[v as keyof typeof conclusionColorMap]}>{v}</Tag>,
    },
    {
      title: '各维度得分',
      key: 'dimScores',
      render: (_, record) => (
        <Space wrap size={4}>
          {record.dimensionScores.map((d) => (
            <Tag key={d.dimension} color={dimensionColorMap[d.dimension]}>
              {d.dimension}：{d.score}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // 折线图数据：每个维度的历次得分
  // ---------------------------------------------------------------------------
  const lineData = history.flatMap((h) =>
    h.dimensionScores.map((d) => ({
      time: h.evalTime.slice(0, 10),
      dimension: d.dimension,
      score: d.score,
    }))
  );

  const approvalTimeline: ApprovalTimelineItem[] = [];
  if (task.evalCompleteTime) {
    approvalTimeline.push({
      title: '评测完成',
      time: task.evalCompleteTime,
      operator: task.creator,
      description: task.evalResultDesc || (report ? `评测结论：${report.conclusion}` : undefined),
      status: 'finish',
    });
  }
  if (task.reviewStartTime || task.status === '待审核' || task.status === '审核中' || task.status === '审核通过' || task.status === '退回重测') {
    approvalTimeline.push({
      title: '审核中',
      time: task.reviewStartTime,
      operator: task.reviewer || (task.status === '待审核' ? undefined : '信息科管理员'),
      status: task.status === '待审核' || task.status === '审核中' ? 'process' : 'finish',
    });
  }
  if (task.status === '审核通过' || task.status === '退回重测') {
    approvalTimeline.push({
      title: task.status === '审核通过' ? '审核通过' : '退回修改',
      time: task.reviewCompleteTime || task.rejectTime,
      operator: task.reviewer || '信息科管理员',
      description: task.reviewComment,
      status: task.status === '审核通过' ? 'finish' : 'error',
    });
  }

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBackToTasks}>
              返回
            </Button>
            <div>
              <Title level={4} style={{ margin: 0 }}>{task.agentName} 评测结果详情</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>任务编号：{task.taskNo}</Text>
            </div>
            {conclusionTag}
          </Space>
          <Space wrap>
            {task.status === '待审核' && isAdmin && (
              <Button type="primary" icon={<AuditOutlined />} onClick={handleStartReview}>
                审核
              </Button>
            )}
            {task.status === '退回重测' && isAdmin && (
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleReEval}>
                重新评测
              </Button>
            )}
            <Tooltip title={reportReady ? '在线预览评测报告' : '评测完成后可查看报告'}>
              <Button
                icon={<EyeOutlined />}
                onClick={onPreviewReport}
                disabled={!reportReady}
                loading={generating}
              >
                评测结果报告查看
              </Button>
            </Tooltip>
            <Tooltip title={reportReady ? '下载 PDF 报告' : '评测完成后可下载报告'}>
              <Button
                icon={<DownloadOutlined />}
                onClick={onDownloadReport}
                disabled={!reportReady}
                loading={generating}
              >
                评测结果报告下载
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <AgentLifecycleProgress
          currentStage={lifecycleStage}
          currentStageCompleted={Boolean(
            (safetyCompleted && ledgerAgent?.onlineTime) ||
            (safetyCompleted && thirdPartyTask?.status === '评测通过') ||
            (lifecycleStage === '安全性评测' && task.status === '审核通过')
          )}
          stagePaths={{
            ...(projectApplicationId ? { '立项': `/app/project-application/detail/${encodeURIComponent(projectApplicationId)}` } : {}),
            ...(accessRecord ? { '接入': `/app/agent-center/detail/${encodeURIComponent(accessRecord.id)}` } : {}),
            '安全性评测': `/app/evaluation/tasks/${encodeURIComponent(task.id)}/report`,
            ...(safetyCompleted && thirdPartyTask ? { '浦江实验室评测': `/app/evaluation/tasks/pujiang/${encodeURIComponent(thirdPartyTask.id)}` } : {}),
            ...(safetyCompleted && ledgerAgent?.onlineTime ? { '上线': `/app/ledger/detail/${encodeURIComponent(ledgerAgent.id)}?view=360` } : {}),
          }}
        />
      </div>

      {/* 3.3.1 智能体基本信息 */}
      <Card title="3.3.1 智能体基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="智能体编号">{task.agentCode}</Descriptions.Item>
          <Descriptions.Item label="智能体名称">
            <a onClick={() => message.info('跳转智能体详情（演示）')}>{task.agentName}</a>
          </Descriptions.Item>
          <Descriptions.Item label="智能体版本"><Tag>{task.version}</Tag></Descriptions.Item>
          <Descriptions.Item label="风险分级">
            <Tag color={riskLevelColorMap[task.riskLevel]}>{task.riskLevel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="归属科室">{task.department}</Descriptions.Item>
          <Descriptions.Item label="评测状态"><Tag color={statusColorMap[task.status]}>{task.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="发起人">{task.creator || <Text type="secondary">-</Text>}</Descriptions.Item>
          <Descriptions.Item label="提交评测时间">{task.submitTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="评测完成时间">{task.evalCompleteTime || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 3.3.2 最新评测结果总览 */}
      {report && (
        <Card title="3.3.2 最新评测结果总览" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={4}>
              <Statistic
                title="综合得分"
                value={task.totalScore || 0}
                precision={1}
                valueStyle={{ fontSize: 36, color: calcScoreColor(task.totalScore || 0) }}
                suffix="分"
              />
            </Col>
            <Col span={20}>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>整体风险等级：</Text>
                  <Tag color={riskLevelColorMap[report.overallRisk]} style={{ fontSize: 14, marginLeft: 4 }}>
                    {report.overallRisk}
                  </Tag>
                  {report.redLineTriggered && <Tag color="red" style={{ fontSize: 14, marginLeft: 4 }}>已触发评测红线</Tag>}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>核心结论：</Text>
                  <Tag color={conclusionColorMap[report.conclusion]} style={{ fontSize: 14, marginLeft: 4 }}>
                    {report.conclusion}
                  </Tag>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>具体说明：</Text>
                  <Paragraph style={{ margin: 0, marginTop: 2 }}>{report.detailDesc}</Paragraph>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 3.3.3 最新评测结果详情 */}
      {report && (
        <Card title="3.3.3 最新评测结果详情" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong>① 表格呈现：评测维度 / 指标 / 原始值 / 得分 / 评测完成时间（鼠标悬浮行可联动高亮柱状图对应柱子）</Text>
              <Table
                style={{ marginTop: 8 }}
                size="small"
                pagination={false}
                rowKey="dimension"
                dataSource={sortedDimensions}
                columns={dimColumns}
                scroll={{ x: 900 }}
                onRow={(record) => ({
                  onMouseEnter: () => {
                    hoverDimRef.current = record.dimension;
                    const plot = chartRef.current;
                    const g2Chart = plot?.chart;
                    if (g2Chart && typeof g2Chart.emit === 'function') {
                      const datum = { name: record.dimension, value: record.score };
                      g2Chart.emit('element:highlight', {
                        nativeEvent: false,
                        data: { data: datum, group: [datum] },
                      });
                    }
                  },
                  onMouseLeave: () => {
                    hoverDimRef.current = null;
                    const plot = chartRef.current;
                    const g2Chart = plot?.chart;
                    if (g2Chart && typeof g2Chart.emit === 'function') {
                      g2Chart.emit('element:unhighlight', { nativeEvent: false });
                    }
                  },
                  style: { cursor: 'pointer' },
                })}
              />
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text strong>② 柱状图呈现：各评测维度得分（按从高到低排列）</Text>
              <div style={{ marginTop: 12 }}>
                {sortedDimensions.length > 0 ? (
                  <Column
                    data={chartData}
                    xField="name"
                    yField="value"
                    colorField="name"
                    autoFit
                    height={280}
                    // G2 v5：用 scale.color 传颜色数组；同时保留 y.nice（避免覆盖 default scale）
                    scale={{
                      y: { nice: true, min: 0, max: 100 },
                      color: {
                        domain: sortedDimensions.map((d) => d.dimension),
                        range: sortedDimensions.map((d) => calcScoreColor(d.score)),
                      },
                    }}
                    // v5：text 接收 datum；防御性取数避免显示 0
                    label={{
                      position: 'top',
                      text: (d: any) => `${Number(d?.value ?? 0).toFixed(1)}`,
                      style: { fontSize: 12, fontWeight: 600, fill: '#1F1F1F' },
                    }}
                    columnStyle={{ radius: [4, 4, 0, 0] }}
                    // G2 v5 内置交互：hover 柱子时其它柱子变淡（active/inactive）
                    interaction={{
                      elementHighlight: { background: true },
                    }}
                    state={{
                      active: { fill: '#1677FF' },
                      inactive: { fillOpacity: 0.25, strokeOpacity: 0.25 },
                    }}
                    onReady={(plot) => {
                      chartRef.current = plot;
                    }}
                  />
                ) : (
                  <Text type="secondary">暂无数据</Text>
                )}
              </div>
            </div>
          </Space>
        </Card>
      )}

      {/* 3.3.4 历次评测结果详情 */}
      <Card title="3.3.4 历次评测结果详情" style={{ marginBottom: 16 }}>
        {history.length === 0 ? (
          <Alert type="info" showIcon message="该智能体尚无历次评测记录" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong>① 表格呈现：历次评测时间 / 整体风险 / 各维度得分 / 结论</Text>
              <Table
                style={{ marginTop: 8 }}
                size="small"
                pagination={false}
                dataSource={historyTableData}
                columns={historyColumns}
                scroll={{ x: 800 }}
              />
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text strong>② 折线图呈现：按评测时间排序，五个维度分别绘制折线</Text>
              <div style={{ marginTop: 12 }}>
                {lineData.length > 0 ? (
                  <Line
                    data={lineData}
                    xField="time"
                    yField="score"
                    seriesField="dimension"
                    autoFit
                    height={320}
                    color={({ dimension }: any) => dimensionColorMap[dimension as EvalDimension]}
                    yAxis={{ min: 0, max: 100, title: { text: '得分' } }}
                    xAxis={{ title: { text: '评测时间' } }}
                    point={{ size: 5, shape: 'circle' }}
                    smooth
                  />
                ) : (
                  <Text type="secondary">暂无数据</Text>
                )}
              </div>
            </div>
          </Space>
        )}
      </Card>

      {/* 退回原因 / 审核结论说明 */}
      {(task.status === '退回重测' || task.status === '审核通过' || task.status === '审核中') && task.reviewComment && (
        <Card title={task.status === '退回重测' ? '退回原因说明' : '审核结论说明'} style={{ marginBottom: 16 }}>
          <Paragraph style={{ margin: 0 }}>{task.reviewComment}</Paragraph>
        </Card>
      )}

      <ApprovalTimeline items={approvalTimeline} style={{ marginBottom: 16 }} />

      {/* 隐藏 PDF 渲染 host — React 管生命周期，避开 StrictMode 双重挂载问题 */}
      <div
        ref={pdfHostRef}
        aria-hidden
        data-testid="pdf-host"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: 794,
          background: '#fff',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      {/* 报告 PDF 在线预览 Modal —— 直接渲染 HTML，避免 Chrome 屏蔽 blob PDF */}
      <Modal
        open={!!previewHtml}
        onCancel={closePreview}
        title={previewTitle}
        width={960}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={closePreview}>关闭</Button>
          </Space>
        }
        styles={{
          body: {
            height: 720,
            padding: 0,
            background: '#E5E5E5',
            overflowY: 'auto',
          },
        }}
      >
        {previewHtml && (
          <div
            data-testid="report-preview-html"
            // 报告 HTML 由 buildReportHtml 拼装，已 esc() 转义所有动态字符串
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}
          />
        )}
      </Modal>
    </div>
  );
};

export default EvaluationReport;
