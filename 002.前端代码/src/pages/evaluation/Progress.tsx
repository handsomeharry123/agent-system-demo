// =============================================================================
// 评测中进度详情页（V1.6 保留）
//   · 顶部：任务状态、终止评测、查看评测报告、刷新
//   · 总体进度：环形 + 剩余时间
//   · 维度进度：5 维度独立卡片，含指标完成步骤
//   · 执行日志：全部 / 关键事件 / 错误
// =============================================================================
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Progress,
  Row,
  Col,
  Descriptions,
  Timeline,
  Alert,
  Radio,
  Modal,
  Statistic,
  Result,
  Steps,
  Badge,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import {
  mockEvaluationTasks,
  dimensionColorMap,
  sampleLevelPercent,
  type EvalDimension,
  type SampleLevel,
} from '../../mock/evaluation';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

type DimensionStatus = '待执行' | '执行中' | '已完成' | '失败';

interface DimensionState {
  name: EvalDimension;
  status: DimensionStatus;
  sampleLevel: SampleLevel;
  percent: number;
  processed: number;
  total: number;
  remainingMinutes: number;
  currentIndicator?: string;
  indicators: { name: string; status: '已完成' | '执行中' | '待执行' | '失败'; score?: number }[];
}

const generateDimensionState = (
  name: EvalDimension,
  sampleLevel: SampleLevel,
  index: number,
  taskProgress?: number,
  dimensionCount = 5,
): DimensionState => {
  const baseTotal = { 快速评测: 150, 标准评测: 300, 深度评测: 500 }[sampleLevel];
  const completedDimensionUnits =
    taskProgress === undefined ? undefined : (taskProgress / 100) * dimensionCount;
  const dimensionPercent =
    completedDimensionUnits === undefined
      ? index === 0
        ? 100
        : index === 1
          ? 65
          : 0
      : Math.max(0, Math.min(100, Math.round((completedDimensionUnits - index) * 100)));
  const status: DimensionStatus =
    dimensionPercent >= 100 ? '已完成' : dimensionPercent > 0 ? '执行中' : '待执行';
  const processed = Math.round(baseTotal * (dimensionPercent / 100));
  const percent = Math.round((processed / baseTotal) * 100);
  return {
    name,
    status,
    sampleLevel,
    percent,
    processed,
    total: baseTotal,
    remainingMinutes: status === '已完成' ? 0 : 60,
    currentIndicator: status === '执行中' ? '防越狱与提示注入' : undefined,
    indicators: [
      { name: '防越狱与提示注入', status: status === '已完成' ? '已完成' : status === '执行中' ? '已完成' : '待执行', score: status === '已完成' || status === '执行中' ? 90 + Math.random() * 8 : undefined },
      { name: '有害性拒绝', status: status === '已完成' ? '已完成' : status === '执行中' ? '执行中' : '待执行', score: status === '已完成' ? 92 : undefined },
      { name: '数据越权访问阻断', status: status === '已完成' ? '已完成' : '待执行', score: status === '已完成' ? 87 : undefined },
    ],
  };
};

const ProgressDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromTab = searchParams.get('fromTab') || '';
  const tasksQs = fromTab && fromTab !== 'all' ? `?tab=${encodeURIComponent(fromTab)}` : '';
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

  const task = mockEvaluationTasks.find((t) => t.id === id);

  // 评测中时每 5s 轮询刷新
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (task?.status === '评测中') {
      const t = setInterval(() => setTick((x) => x + 1), 5000);
      return () => clearInterval(t);
    }
  }, [task?.status]);

  const dimensionStates = useMemo<DimensionState[]>(() => {
    if (!task) return [];
    return task.dimensions.map((d, i) =>
      generateDimensionState(d.dimension, d.sampleLevel, i, task.progress, task.dimensions.length),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, tick]);

  if (!task) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Result status="404" title="评测任务不存在" subTitle="该评测任务可能已被删除" extra={<Button onClick={() => navigate(`/app/evaluation/tasks${tasksQs}`)}>返回评测列表</Button>} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 顶部进度：按已处理数据量计算
  // ---------------------------------------------------------------------------
  const totalCount = dimensionStates.reduce((acc, d) => acc + d.total, 0);
  const processedCount = dimensionStates.reduce((acc, d) => acc + d.processed, 0);
  const overallPercent =
    task.progress ?? (totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0);
  const remainingMin = Math.max(...dimensionStates.map((d) => d.remainingMinutes), 0);

  // ---------------------------------------------------------------------------
  // 执行日志
  // ---------------------------------------------------------------------------
  const allLogs: { time: string; event: string; level: 'info' | 'key' | 'error' }[] = [
    { time: '2026-05-15 14:20:00', event: '评测任务已创建，等待管理员启动', level: 'info' },
    { time: '2026-05-15 14:25:10', event: '评测任务已启动，沙盒环境准备就绪', level: 'key' },
    { time: '2026-05-15 14:25:15', event: '开始执行「输入安全」评测（标准评测）', level: 'info' },
    { time: '2026-05-15 14:28:30', event: '输入安全 - 防越狱与提示注入 得分 92.5', level: 'key' },
    { time: '2026-05-15 14:32:10', event: '输入安全 - 恶意文件检测 得分 88.0', level: 'key' },
    { time: '2026-05-15 14:35:45', event: '输入安全 - 恶意 URL 拦截 得分 86.7', level: 'key' },
    { time: '2026-05-15 14:40:20', event: '「输入安全」评测已完成（用时 15 分 05 秒）', level: 'key' },
    { time: '2026-05-15 14:40:25', event: '开始执行「输出安全」评测（标准评测）', level: 'info' },
    { time: '2026-05-15 14:50:20', event: '输出安全 - 有害性拒绝 得分 95.0', level: 'key' },
    { time: '2026-05-15 14:55:30', event: '输出安全 - 偏见与公平性 执行中...', level: 'info' },
    { time: '2026-05-15 14:48:00', event: '输入安全 - 知识与记忆能力 样本解析失败 3 条，已自动跳过', level: 'error' },
  ];
  const [logFilter, setLogFilter] = useState<'all' | 'key' | 'error'>('all');
  const logs = useMemo(() => {
    if (logFilter === 'all') return allLogs;
    if (logFilter === 'key') return allLogs.filter((l) => l.level === 'key' || l.level === 'info');
    return allLogs.filter((l) => l.level === 'error');
  }, [logFilter]);

  // ---------------------------------------------------------------------------
  // 操作处理
  // ---------------------------------------------------------------------------
  const handleTerminate = () => {
    Modal.confirm({
      title: '确认终止评测',
      content: '任务正在评测中，撤销将终止当前评测，是否确认？',
      okText: '确认撤销',
      okType: 'danger',
      onOk: () => {
        message.success('已撤销');
        navigate(`/app/evaluation/tasks${tasksQs}`);
      },
    });
  };

  const handleViewReport = () => navigate(`/app/evaluation/tasks/${task.id}/report?fromTab=${encodeURIComponent(fromTab || 'all')}`);
  const handleRestart = () => {
    Modal.confirm({
      title: '重新评测',
      content: '将以原任务配置生成新的评测草稿，确认？',
      okText: '生成草稿',
      onOk: () => {
        message.success('已生成新草稿');
        navigate('/app/evaluation/tasks/create');
      },
    });
  };

  const statusTag = (() => {
    if (task.status === '评测中') return <Tag color="processing">评测中</Tag>;
    if (task.status === '审核通过') return <Tag color="success">已完成 · 准入</Tag>;
    if (task.status === '退回重测') return <Tag color="error">已完成 · 退回</Tag>;
    if (task.status === '撤销') return <Tag color="default">已撤销</Tag>;
    if (task.status === '待审核') return <Tag color="gold">已完成 · 待审核</Tag>;
    return <Tag>{task.status}</Tag>;
  })();

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }} wrap>
          <Space wrap>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/app/evaluation/tasks${tasksQs}`)}>
              返回
            </Button>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {task.taskNo} — {task.agentName} 评测
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>评测进度详情</Text>
            </div>
            {statusTag}
          </Space>
          <Space wrap>
            {task.status === '评测中' && (
              <Button danger icon={<StopOutlined />} onClick={handleTerminate}>
                终止评测
              </Button>
            )}
            {(task.status === '审核通过' || task.status === '待审核' || task.status === '评测完成') && (
              <Button type="primary" icon={<FileTextOutlined />} onClick={handleViewReport}>
                查看评测报告
              </Button>
            )}
            {task.status === '撤销' && isAdmin && (
              <Button type="primary" icon={<ExperimentOutlined />} onClick={handleRestart}>
                重新评测
              </Button>
            )}
            {task.status === '评测中' && <Button icon={<ReloadOutlined />} onClick={() => message.success('已刷新最新进度')}>刷新</Button>}
          </Space>
        </Space>
      </Card>

      {/* 总体进度 + 发起信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="总体进度">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress
                type="circle"
                percent={task.status === '评测中' ? overallPercent : 100}
                size={140}
                strokeColor={task.status === '撤销' ? '#BFBFBF' : '#1677FF'}
              />
              <div style={{ marginTop: 16 }}>
                {task.status === '评测中' ? (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Statistic
                      prefix={<ClockCircleOutlined />}
                      value={`${remainingMin} 分钟`}
                      valueStyle={{ fontSize: 16, color: '#1677FF' }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>预计剩余时间</Text>
                  </Space>
                ) : task.status === '撤销' ? (
                  <Text type="secondary">任务已撤销</Text>
                ) : (
                  <Text type="success">评测已完成</Text>
                )}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="发起信息">
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
              <Descriptions.Item label="任务编号">{task.taskNo}</Descriptions.Item>
              <Descriptions.Item label="智能体编号">{task.agentCode}</Descriptions.Item>
              <Descriptions.Item label="归属科室">{task.department}</Descriptions.Item>
              <Descriptions.Item label="风险分级">
                <Tag>{task.riskLevel}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发起人">{task.creator || <Text type="secondary">-</Text>}</Descriptions.Item>
              <Descriptions.Item label="发起时间">{task.createTime}</Descriptions.Item>
              <Descriptions.Item label="预计完成时间">
                {task.status === '评测中' ? `约 ${remainingMin} 分钟后` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="已耗时">
                {task.status === '评测中' ? '刚刚开始' : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="评测维度与样本量" span={2}>
                <Space wrap>
                  {task.dimensions.map((d) => (
                    <Tag key={d.dimension} color={dimensionColorMap[d.dimension]}>
                      {d.dimension} · {d.sampleLevel}（抽取 {sampleLevelPercent[d.sampleLevel]}%）
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* 维度进度卡片 */}
      <Card title="维度进度" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {dimensionStates.map((dim) => {
            const badgeStatus =
              dim.status === '已完成' ? 'success' :
              dim.status === '执行中' ? 'processing' :
              dim.status === '失败' ? 'error' : 'warning';
            return (
              <Col xs={24} lg={12} key={dim.name}>
                <Card size="small">
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
                    <Space>
                      <Tag color={dimensionColorMap[dim.name]} style={{ fontSize: 14 }}>{dim.name}</Tag>
                      <Badge status={badgeStatus} text={dim.status} />
                    </Space>
                    <Space size={4}>
                      <Tag color="blue">{dim.sampleLevel}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dim.processed} / {dim.total} · {dim.percent}%
                      </Text>
                    </Space>
                  </Space>

                  <Progress
                    percent={dim.percent}
                    strokeColor={dim.status === '已完成' ? '#52C41A' : dim.status === '失败' ? '#FF4D4F' : '#1677FF'}
                    showInfo={false}
                  />

                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>当前计算指标：</Text>
                    <div style={{ marginTop: 4 }}>
                      {dim.currentIndicator ? (
                        <Tag icon={<ClockCircleOutlined />}>⏳ {dim.currentIndicator}</Tag>
                      ) : dim.status === '待执行' ? (
                        <Text type="secondary">等待执行...</Text>
                      ) : (
                        <Space wrap>
                          {dim.indicators.filter((i) => i.status === '已完成').slice(0, 3).map((ind, idx) => (
                            <Tag key={idx} color="success">
                              ✅ {ind.name} {ind.score ? `${ind.score.toFixed(1)}分` : ''}
                            </Tag>
                          ))}
                        </Space>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>指标完成进度：</Text>
                    <Steps
                      size="small"
                      direction="vertical"
                      current={dim.indicators.filter((i) => i.status === '已完成').length}
                      style={{ marginTop: 6 }}
                      items={dim.indicators.map((ind) => ({
                        title: (
                          <Space>
                            <Text>{ind.name}</Text>
                            {ind.score !== undefined && (
                              <Text type={ind.score >= 60 ? 'success' : 'danger'} style={{ fontSize: 12 }}>
                                {ind.score.toFixed(1)}分
                              </Text>
                            )}
                          </Space>
                        ),
                        status:
                          ind.status === '已完成' ? 'finish' :
                          ind.status === '执行中' ? 'process' :
                          ind.status === '失败' ? 'error' : 'wait',
                        icon:
                          ind.status === '执行中' ? <ClockCircleOutlined /> :
                          ind.status === '已完成' ? <CheckCircleOutlined /> : undefined,
                      }))}
                    />
                  </div>

                  <Descriptions
                    column={1}
                    size="small"
                    style={{ marginTop: 8, background: '#FAFAFA', padding: 8, borderRadius: 4 }}
                  >
                    <Descriptions.Item label="预计剩余时间">
                      {dim.status === '已完成' ? '已完成' : `约 ${dim.remainingMinutes} 分钟`}
                    </Descriptions.Item>
                  </Descriptions>

                  {dim.status === '失败' && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginTop: 8 }}
                      message="该维度执行失败"
                      description={
                        <a onClick={() => message.info('展开完整错误堆栈（演示）')}>点击查看完整错误详情</a>
                      }
                    />
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* 执行日志 */}
      <Card title="执行日志">
        <Space style={{ marginBottom: 16 }} wrap>
          <Text type="secondary">日志级别：</Text>
          <Radio.Group value={logFilter} onChange={(e) => setLogFilter(e.target.value)}>
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="key">关键事件</Radio.Button>
            <Radio.Button value="error">错误</Radio.Button>
          </Radio.Group>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {logs.length} 条</Text>
        </Space>
        <Timeline
          items={logs.map((log) => ({
            color: log.level === 'key' ? 'green' : log.level === 'error' ? 'red' : 'blue',
            children: (
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>{log.time}</Text>
                <Text>{log.event}</Text>
              </Space>
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default ProgressDetail;
