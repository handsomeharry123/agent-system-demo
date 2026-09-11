// =============================================================================
// 评测结果审核页（V1.6 §三 · 3.4 · 仅平台管理员）
//   · 3.4.1 智能体基本信息
//   · 3.4.2 评测结果总览
//   · 3.4.3 评测结果详情：① 表格（点击维度行展开指标）② 柱状图按各维度得分从高到低排列
//   · 3.4.4 历次评测结果详情：① 表格 ② 折线图
//   · 3.4.5 审核结论：审核通过 / 退回修改 + 具体说明（500 字以内）
// =============================================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Descriptions,
  Radio,
  Input,
  Row,
  Col,
  Statistic,
  Table,
  Result,
  Alert,
  Modal,
  message,
  Form,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { Column, Line } from '@ant-design/charts';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
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
  type IndicatorType,
  type EvalDimension,
} from '../../mock/evaluation';
import { useAuth } from '../../hooks/useAuth';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const indicatorNameMap: Record<IndicatorType, string> = {
  ASR: '攻击成功率',
  GCR: '生成合规率',
  RR: '拒绝率',
  PLR: '隐私泄露率',
};

const calcScoreColor = (s: number) => (s >= 80 ? '#52C41A' : s >= 60 ? '#FAAD14' : '#FF4D4F');

const TaskReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromTab = searchParams.get('fromTab') || '';
  const fromTabQs = fromTab ? `?fromTab=${encodeURIComponent(fromTab)}` : '';
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

  const task: EvaluationTask | undefined = getTaskById(id || '');
  const report: ReportModel | undefined = task ? getReportByTaskId(task.id) : undefined;
  const [form] = Form.useForm();

  const [conclusion, setConclusion] = useState<'审核通过' | '退回修改' | undefined>();
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!task) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Result
          status="404"
          title="任务不存在"
          subTitle="该评测任务可能已被删除"
          extra={<Button onClick={() => navigate('/app/evaluation/tasks')}>返回任务列表</Button>}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Result
          status="403"
          title="无权访问"
          subTitle="评测结果审核仅对平台管理员开放"
          extra={<Button onClick={() => navigate('/app/evaluation/tasks')}>返回任务列表</Button>}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 排序后的维度
  // ---------------------------------------------------------------------------
  const sortedDimensions = useMemo(() => {
    if (!report) return [];
    return [...report.dimensionScores].sort((a, b) => b.score - a.score);
  }, [report]);

  // 历次
  const history = useMemo(
    () => (task ? getHistoryByAgent(task.agentId, task.id) : []),
    [task]
  );

  // ---------------------------------------------------------------------------
  // 提交审核结论
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    if (!conclusion) {
      message.error('请选择审核结论');
      return;
    }
    if (conclusion === '退回修改' && !comment.trim()) {
      message.error('退回修改时必须填写具体说明');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);

    Modal.confirm({
      title: `确认${conclusion}？`,
      content:
        conclusion === '审核通过'
          ? '审核通过后任务正式归档，作为智能体准入评估依据并同步台账中心。'
          : '退回修改后任务状态将变为「退回重测」，退回原因将同步至用户端。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        task.status = conclusion === '审核通过' ? '审核通过' : '退回重测';
        task.reviewComment = comment.trim();
        task.reviewer = currentUser?.name;
        task.reviewCompleteTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        if (conclusion === '退回修改') {
          task.rejectTime = task.reviewCompleteTime;
        }
        message.success(conclusion === '审核通过' ? '已审核通过并归档' : '已退回，等待用户重新评测');
        // 按审核结论跳转到对应 Tab（与 Tasks.tsx TabKey 对齐：「退回重测」= 列表展示「退回修改」）
        const targetTab = conclusion === '审核通过' ? '审核通过' : '退回重测';
        navigate(`/app/evaluation/tasks?tab=${encodeURIComponent(targetTab)}`);
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 维度表格（带指标展开）
  // ---------------------------------------------------------------------------
  interface DimRow {
    key: string;
    dimension: EvalDimension;
    indicator: IndicatorType;
    indicatorName: string;
    rawValue: number;
    score: number;
    riskLevel: string;
  }

  const dimTableData: DimRow[] = sortedDimensions.map((d) => ({
    key: d.dimension,
    dimension: d.dimension,
    indicator: d.indicator,
    indicatorName: indicatorNameMap[d.indicator],
    rawValue: d.rawValue,
    score: d.score,
    riskLevel: d.riskLevel,
  }));

  const dimColumns: ColumnsType<DimRow> = [
    {
      title: '评测维度',
      dataIndex: 'dimension',
      key: 'dimension',
      width: 130,
      render: (v: EvalDimension) => <Tag color={dimensionColorMap[v]}>{v}</Tag>,
    },
    {
      title: '指标',
      key: 'indicator',
      width: 130,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{r.indicatorName}</Text>
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
      width: 110,
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
  ];

  // 历次表
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

  const lineData = history.flatMap((h) =>
    h.dimensionScores.map((d) => ({
      time: h.evalTime.slice(0, 10),
      dimension: d.dimension,
      score: d.score,
    }))
  );

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <PageHeader
        title="评测结果审核"
        subTitle={`任务编号：${task.taskNo} · ${task.agentName}`}
        showBack
        onBack={() => navigate(`/app/evaluation/tasks/${task.id}/report${fromTabQs}`)}
      />

      {/* 3.4.1 智能体基本信息 */}
      <Card title="3.4.1 智能体基本信息" style={{ marginTop: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="智能体编号">{task.agentCode}</Descriptions.Item>
          <Descriptions.Item label="智能体名称">{task.agentName}</Descriptions.Item>
          <Descriptions.Item label="智能体版本"><Tag>{task.version}</Tag></Descriptions.Item>
          <Descriptions.Item label="风险分级">
            <Tag color={riskLevelColorMap[task.riskLevel]}>{task.riskLevel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="归属科室">{task.department}</Descriptions.Item>
          <Descriptions.Item label="当前状态"><Tag color={statusColorMap[task.status]}>{task.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="提交评测时间">{task.submitTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="评测完成时间">{task.evalCompleteTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="发起人">{task.creator || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 3.4.2 评测结果总览 */}
      {report && (
        <Card title="3.4.2 评测结果总览" style={{ marginTop: 16 }}>
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

      {/* 3.4.3 评测结果详情（柱状图按从高到低） */}
      {report && (
        <Card title="3.4.3 评测结果详情" style={{ marginTop: 16 }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong>① 表格呈现：维度 / 指标 / 原始值 / 得分 / 风险等级</Text>
              <Table
                style={{ marginTop: 8 }}
                size="small"
                pagination={false}
                rowKey="key"
                dataSource={dimTableData}
                columns={dimColumns}
                scroll={{ x: 800 }}
              />
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text strong>② 柱状图呈现：各维度得分（按从高到低排列）</Text>
              <div style={{ marginTop: 12 }}>
                <Column
                  data={sortedDimensions.map((d) => ({ name: d.dimension, value: d.score }))}
                  xField="name"
                  yField="value"
                  autoFit
                  height={280}
                  color={({ value }: any) => calcScoreColor(value)}
                  yAxis={{ min: 0, max: 100 }}
                  label={{ position: 'top', formatter: (d: any) => `${d.value?.toFixed(1) ?? 0}` }}
                  columnStyle={{ radius: [4, 4, 0, 0] }}
                />
              </div>
            </div>
          </Space>
        </Card>
      )}

      {/* 3.4.4 历次评测结果详情 */}
      <Card title="3.4.4 历次评测结果详情" style={{ marginTop: 16 }}>
        {history.length === 0 ? (
          <Alert type="info" showIcon message="该智能体尚无历次评测记录" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong>① 表格呈现</Text>
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
              </div>
            </div>
          </Space>
        )}
      </Card>

      {/* 3.4.5 审核结论 */}
      <Card
        title={
          <Space>
            <AuditOutlined />
            <Text strong>3.4.5 审核结论与说明</Text>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="审核结论"
            required
            rules={[{ required: true, message: '请选择审核结论' }]}
          >
            <Radio.Group
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="审核通过">
                <CheckCircleOutlined style={{ color: '#52C41A' }} /> 审核通过
              </Radio.Button>
              <Radio.Button value="退回修改">
                <CloseCircleOutlined style={{ color: '#FF4D4F' }} /> 退回修改
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {conclusion === '审核通过' && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
              message="审核通过后任务将正式归档，作为智能体准入评估依据并同步台账中心。"
            />
          )}

          <Form.Item
            label={
              <Space>
                具体说明
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {comment.length}/500
                </Text>
              </Space>
            }
            required={conclusion === '退回修改'}
            extra={
              conclusion === '审核通过'
                ? '选填；选「退回修改」时必填，将同步至用户端「退回原因说明 / 具体说明」字段'
                : '必填'
            }
          >
            <TextArea
              rows={4}
              maxLength={500}
              showCount
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                conclusion === '退回修改'
                  ? '请详细说明退回原因及改进建议，将同步至用户端'
                  : '可补充审核意见'
              }
            />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Space>
          <Button
            onClick={() => {
              // 直接返回来源 Tab（如「待审核」）；无 fromTab 时兜底到「全部任务」
              const qs = fromTab && fromTab !== 'all' ? `?tab=${encodeURIComponent(fromTab)}` : '';
              navigate(`/app/evaluation/tasks${qs}`);
            }}
          >
            返回
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting} disabled={!conclusion}>
            提交审核结论
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default TaskReview;
