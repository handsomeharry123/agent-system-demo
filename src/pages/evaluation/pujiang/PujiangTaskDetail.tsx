import { useEffect, useMemo, useState } from 'react';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Dropdown, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../../components/PageHeader';
import AgentLifecycleProgress from '../../../components/AgentLifecycleProgress';
import { useDemoSettings } from '../../../hooks/useDemoSettings';
import { useSmartDraft } from '../../agent-center/smart/store';
import { PUJIANG_DIMENSIONS, getPujiangTask } from './data';
import { mockEvaluationTasks } from '../../../mock/evaluation';
import { useAccessRecords } from '../../agent-center/store';
import { findProjectApplicationId } from '../../project-application';

const { Text, Title } = Typography;

const PujiangTaskDetail = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const task = useMemo(() => getPujiangTask(id), [id]);
  const { demoRole } = useDemoSettings();
  const { pushWelcomeGreeting } = useSmartDraft();
  const accessRecords = useAccessRecords();
  const [preview, setPreview] = useState(false);
  const reportReady = task.status === '评测通过' || task.status === '退回修改';
  const accessRecord = accessRecords.find((item) => item.agentCode === task.agentCode || item.name === task.agentName);
  const safetyTask = mockEvaluationTasks.find((item) => item.agentCode === task.agentCode || item.agentName === task.agentName);
  const projectApplicationId = findProjectApplicationId(task.agentName, task.department);
  const latest = reportReady ? PUJIANG_DIMENSIONS.map((dimension, index) => ({ key: dimension, dimension, score: task.scores[index], completeTime: task.completeTime || '-' })) : [];
  const history = reportReady ? [
    { time: '2026-05-18', scores: task.scores.map((score) => score - 9), conclusion: '退回修改' },
    { time: '2026-06-22', scores: task.scores.map((score) => score - 4), conclusion: '退回修改' },
    { time: task.completeTime?.slice(0, 10) || '2026-07-28', scores: task.scores, conclusion: task.status === '评测通过' ? '评测通过' : '退回修改' },
  ] : [];
  const trend = history.map((item) => Object.fromEntries([['time', item.time], ...PUJIANG_DIMENSIONS.map((dimension, index) => [dimension, item.scores[index]])]));
  const download = (format: 'pdf' | 'doc') => {
    const content = `浦江实验室智能体评测报告\n\n智能体：${task.agentName}\n智能体编号：${task.agentCode}\n评测结论：${task.status}\n\n${latest.map((item) => `${item.dimension}：${item.score}分`).join('\n')}`;
    const blob = new Blob([content], { type: format === 'pdf' ? 'application/pdf' : 'application/msword' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `浦江评测报告-${task.agentCode}.${format}`; link.click(); URL.revokeObjectURL(link.href);
  };

  useEffect(() => {
    const handleDownload = () => download('pdf');
    window.addEventListener('pujiang-report-download', handleDownload);
    return () => window.removeEventListener('pujiang-report-download', handleDownload);
  });

  useEffect(() => {
    pushWelcomeGreeting(
      'pujiang-evaluation-report',
      demoRole === '信息科管理员' ? 'admin' : 'dept',
      () => [task.agentName],
      {
        windowReplacements: [task.agentName],
        actions: [
          {
            key: 'download-pujiang-report',
            label: '评测结果报告下载',
            event: 'pujiang-report-download',
            enabled: reportReady,
          },
          {
            key: 'view-agent-360-profile',
            label: '查看360画像',
            path: `/app/ledger/detail/${encodeURIComponent(task.agentId)}?view=360`,
            enabled: task.status === '评测通过',
            reason: '仅评测通过的智能体可查看360画像',
          },
        ],
      },
    );
  }, [demoRole, pushWelcomeGreeting, reportReady, task.agentId, task.agentName, task.status]);

  return <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
    <PageHeader title={<Space>medbench评测结果详情<Tag color={task.status === '评测中' ? 'processing' : task.status === '评测通过' ? 'success' : task.status === '退回修改' ? 'error' : 'default'}>{task.status}</Tag></Space>} subTitle="查看最新评测结果与历次评测趋势" showBack onBack={() => navigate('/app/evaluation/tasks?module=pujiang')} extra={<Space><Button icon={<EyeOutlined />} disabled={!reportReady} onClick={() => setPreview(true)}>查看评测报告</Button><Dropdown disabled={!reportReady} menu={{ items: [{ key: 'pdf', label: '下载 PDF 版', onClick: () => download('pdf') }, { key: 'doc', label: '下载 Word 版', onClick: () => download('doc') }] }}><Button type="primary" icon={<DownloadOutlined />} disabled={!reportReady}>下载评测报告</Button></Dropdown></Space>} />
    <div style={{ marginTop: 16 }}>
      <AgentLifecycleProgress
        currentStage={task.status === '评测通过' ? '上线' : '浦江实验室评测'}
        stagePaths={{
          ...(projectApplicationId ? { '立项': `/app/project-application/detail/${encodeURIComponent(projectApplicationId)}` } : {}),
          ...(accessRecord ? { '接入': `/app/agent-center/detail/${encodeURIComponent(accessRecord.id)}` } : {}),
          ...(safetyTask ? { '安全性评测': `/app/evaluation/tasks/${encodeURIComponent(safetyTask.id)}/report` } : {}),
          '浦江实验室评测': `/app/evaluation/tasks/pujiang/${encodeURIComponent(task.id)}`,
          ...(task.status === '评测通过' ? { '上线': `/app/ledger/detail/${encodeURIComponent(task.agentId)}?view=360` } : {}),
        }}
      />
    </div>
    <Card title="智能体基本信息" style={{ marginTop: 16 }}><Descriptions bordered column={3}><Descriptions.Item label="智能体编号">{task.agentCode}</Descriptions.Item><Descriptions.Item label="智能体名称">{task.agentName}</Descriptions.Item><Descriptions.Item label="智能体版本">{task.version}</Descriptions.Item><Descriptions.Item label="评测状态"><Tag color={task.status === '评测中' ? 'processing' : task.status === '评测通过' ? 'success' : task.status === '退回修改' ? 'error' : 'default'}>{task.status}</Tag></Descriptions.Item><Descriptions.Item label="提交评测时间">{task.submitTime || '-'}</Descriptions.Item><Descriptions.Item label="评测完成时间">{task.completeTime || '-'}</Descriptions.Item></Descriptions></Card>
    <Card title="最新评测结果总览" style={{ marginTop: 16 }}>{reportReady ? <Space direction="vertical"><Space><Text strong>核心结论</Text><Tag color={task.status === '评测通过' ? 'success' : 'error'}>{task.status}</Tag></Space><Text type="secondary">{task.resultDesc}</Text></Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评测结果" />}</Card>
    <Card title="最新评测结果详情" style={{ marginTop: 16 }}>{reportReady ? <><Table pagination={false} dataSource={latest} columns={[{ title: '评测维度', dataIndex: 'dimension' }, { title: '评测得分', dataIndex: 'score', render: (value) => <Text strong style={{ color: value >= 85 ? '#52c41a' : '#fa8c16' }}>{value} 分</Text> }, { title: '评测完成时间', dataIndex: 'completeTime' }]} /><div style={{ height: 300, marginTop: 24 }}><ResponsiveContainer><BarChart data={latest}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dimension" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><ChartTooltip /><Bar dataKey="score" name="评测得分" fill="#1677ff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评测结果" />}</Card>
    <Card title="历次评测结果详情" style={{ marginTop: 16 }}>{reportReady ? <><Table pagination={false} rowKey="time" dataSource={history} columns={[{ title: '历次评测时间', dataIndex: 'time' }, ...PUJIANG_DIMENSIONS.map((dimension, index) => ({ title: dimension, render: (_: unknown, record: typeof history[number]) => `${record.scores[index]} 分` })), { title: '评测结论', dataIndex: 'conclusion', render: (value) => <Tag color={value === '评测通过' ? 'success' : 'error'}>{value}</Tag> }]} scroll={{ x: 1200 }} /><div style={{ height: 340, marginTop: 24 }}><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis domain={[60, 100]} /><ChartTooltip /><Legend />{PUJIANG_DIMENSIONS.map((dimension, index) => <Line key={dimension} type="monotone" dataKey={dimension} stroke={['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2'][index]} strokeWidth={2} />)}</LineChart></ResponsiveContainer></div></> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评测结果" />}</Card>
    <Modal open={preview} onCancel={() => setPreview(false)} footer={<Button onClick={() => setPreview(false)}>关闭</Button>} width={760} title="浦江实验室智能体评测报告"><Title level={4} style={{ textAlign: 'center' }}>浦江实验室智能体评测报告</Title><Descriptions bordered column={2}><Descriptions.Item label="智能体">{task.agentName}</Descriptions.Item><Descriptions.Item label="评测结论">{task.status}</Descriptions.Item>{latest.map((item) => <Descriptions.Item key={item.dimension} label={item.dimension}>{item.score} 分</Descriptions.Item>)}</Descriptions></Modal>
  </div>;
};

export default PujiangTaskDetail;
