import { useEffect } from 'react';
import { Button, Card, Descriptions, Space, Table, Tag, message } from 'antd';
import { DownloadOutlined, EyeOutlined, RadarChartOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../../components/PageHeader';
import { useSmartDraft } from '../../agent-center/smart/store';
import { specFor } from './platforms';

export default function ThirdPartyTaskDetail() {
  const { platformKey } = useParams();
  const platform = specFor(platformKey);
  const navigate = useNavigate();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const agentName = '超声检查预约助手';
  const agentId = 'AGT-2026-009';
  const scores = platform.dimensions.map((dimension, index) => ({ dimension, score: 92 - index * 3, time: '2026-08-12 15:40:00' }));
  const history = [
    { time: '2026-06-18 14:20:00', scores: scores.map(({ score }) => Math.max(60, score - 10)), conclusion: '退回修改' },
    { time: '2026-07-16 10:30:00', scores: scores.map(({ score }) => Math.max(65, score - 5)), conclusion: '退回修改' },
    { time: '2026-08-12 15:40:00', scores: scores.map(({ score }) => score), conclusion: '评测通过' },
  ];
  const trend = history.map((item) => Object.fromEntries([
    ['time', item.time.slice(0, 10)],
    ...platform.dimensions.map((dimension, index) => [dimension, item.scores[index]]),
  ]));
  const chartColors = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#2f54eb'];
  const downloadReport = () => {
    const report = [
      `${platform.name}智能体评测结果报告`,
      '',
      `智能体编号：AG-0001`,
      `智能体名称：${agentName}`,
      `智能体版本：${platform.versions[0]}`,
      '评测结论：评测通过',
      '',
      '评测结果详情：',
      ...scores.map(({ dimension, score, time }) => `${dimension}：${score}分（${time}）`),
    ].join('\n');
    const blob = new Blob(['\uFEFF', report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${platform.name}评测结果报告-AG-0001.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.success('评测结果报告已开始下载');
  };
  useEffect(() => {
    const eventName = `${platform.key}-report-download`;
    window.addEventListener(eventName, downloadReport);
    pushWelcomeGreeting(platform.key === 'medagentbench' ? 'medagentbench-evaluation-report' : 'cp-env-evaluation-report', 'admin', () => [agentName], {
      windowReplacements: [agentName],
      actions: [
        { key: `${platform.key}-download`, label: '评测结果报告下载', event: eventName, enabled: true },
        { key: `${platform.key}-360`, label: '查看360画像', path: `/app/ledger/detail/${agentId}?view=360`, enabled: true },
      ],
    });
    return () => { window.removeEventListener(eventName, downloadReport); consumeWelcome(); };
  }, [consumeWelcome, platform.key, pushWelcomeGreeting]);
  return <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100%' }}><PageHeader title={`${platform.name}结果详情`} subTitle="查看最新及历次评测结果" showBack onBack={() => navigate(-1)} extra={<Space><Button icon={<RadarChartOutlined />} onClick={() => navigate(`/app/ledger/detail/${agentId}?view=360`)}>360画像</Button><Button icon={<EyeOutlined />} onClick={() => message.info('正在打开评测结果报告预览')}>报告查看</Button><Button type="primary" icon={<DownloadOutlined />} onClick={downloadReport}>报告下载</Button></Space>} /><Card title="智能体基本信息" style={{ marginTop: 16 }}><Descriptions column={3} bordered><Descriptions.Item label="智能体编号">AG-0001</Descriptions.Item><Descriptions.Item label="智能体名称">{agentName}</Descriptions.Item><Descriptions.Item label="智能体版本">{platform.versions[0]}</Descriptions.Item></Descriptions></Card><Card title="最新评测结果总览" style={{ marginTop: 16 }}><Descriptions column={1} bordered><Descriptions.Item label="核心结论"><Tag color="success">评测通过</Tag></Descriptions.Item><Descriptions.Item label="具体说明">各项评测维度均达到平台准入要求，智能体表现稳定。</Descriptions.Item></Descriptions></Card><Card title="最新评测结果详情" style={{ marginTop: 16 }}><Table rowKey="dimension" pagination={false} dataSource={scores} columns={[{ title: '评测维度', dataIndex: 'dimension' }, { title: '得分', dataIndex: 'score', render: value => <strong style={{ color: value >= 85 ? '#52c41a' : '#fa8c16' }}>{value} 分</strong> }, { title: '评测完成时间', dataIndex: 'time' }]} /><div style={{ height: 300, marginTop: 24 }}><ResponsiveContainer><BarChart data={scores}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dimension" tick={{ fontSize: 11 }} interval={0} angle={platform.dimensions.length > 3 ? -15 : 0} textAnchor={platform.dimensions.length > 3 ? 'end' : 'middle'} height={platform.dimensions.length > 3 ? 80 : 45} /><YAxis domain={[0, 100]} /><ChartTooltip /><Bar dataKey="score" name="评测得分" fill="#1677ff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card><Card title="历次评测结果详情" style={{ marginTop: 16 }}><Table rowKey="time" pagination={false} dataSource={history} columns={[{ title: '历次评测时间', dataIndex: 'time', fixed: 'left', width: 180 }, ...platform.dimensions.map((dimension, index) => ({ title: dimension, width: 170, render: (_: unknown, record: typeof history[number]) => `${record.scores[index]} 分` })), { title: '评测结论', dataIndex: 'conclusion', fixed: 'right', width: 110, render: value => <Tag color={value === '评测通过' ? 'success' : 'error'}>{value}</Tag> }]} scroll={{ x: Math.max(900, platform.dimensions.length * 170 + 290) }} /><div style={{ height: 340, marginTop: 24 }}><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis domain={[60, 100]} /><ChartTooltip /><Legend />{platform.dimensions.map((dimension, index) => <Line key={dimension} type="monotone" dataKey={dimension} stroke={chartColors[index % chartColors.length]} strokeWidth={2} activeDot={{ r: 5 }} />)}</LineChart></ResponsiveContainer></div></Card></div>;
}
