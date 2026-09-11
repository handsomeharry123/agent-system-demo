import { Button, Card, Descriptions, Empty, Space, Table, Tag, Tooltip } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { evaluationCreatePath, loadPlatforms, ParameterMapping } from './evaluationPlatforms';

const ParameterTable = ({ title, rows }: { title: string; rows?: ParameterMapping[] }) => <Card size="small" title={title} styles={{ header: { background: '#f5f7fa' } }}><Table rowKey={(row, index) => `${row.name}-${index}`} pagination={false} tableLayout="fixed" dataSource={(rows || []).filter(row => row.name || row.value || row.mappingName)} locale={{ emptyText: '暂无参数配置' }} columns={[{ title: 'name', dataIndex: 'name', width: '50%' }, { title: 'Value', width: '50%', render: (_, row) => row.value || row.mappingName || '—' }]} /></Card>;

const descriptionLabelStyle = { width: '13%', minWidth: 120 };
const descriptionContentStyle = { width: '37%', wordBreak: 'break-word' as const };

export default function EvaluationPlatformDetail() {
  const { id } = useParams(); const nav = useNavigate(); const x = loadPlatforms().find(y => y.id === id);
  if (!x) return <Empty description="未找到评测平台" />;
  const item = (label: string, value: ReactNode, span?: number) => <Descriptions.Item label={label} span={span}>{value || '—'}</Descriptions.Item>;
  return <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
    <PageHeader title="评测平台信息详情" subTitle={`查看 ${x.name} 的平台信息与 API 参数映射`} showBack onBack={() => nav(-1)} extra={<Tooltip title={x.connected === 'success' ? '' : '请先完成联通测试'}><span><Button type="primary" icon={<ExperimentOutlined />} disabled={x.connected !== 'success'} onClick={() => nav(evaluationCreatePath(x.id))}>去评测</Button></span></Tooltip>} />
    <Card title="基本信息" style={{ marginTop: 16 }}><Descriptions column={2} bordered labelStyle={descriptionLabelStyle} contentStyle={descriptionContentStyle}>{item('平台名称', x.name)}{item('提供方', x.provider)}{item('邮箱', x.email)}{item('电话号码', x.phone)}{item('平台简介', x.description, 2)}</Descriptions></Card>
    <Card title="技术信息" style={{ marginTop: 16 }}><Descriptions column={2} bordered labelStyle={descriptionLabelStyle} contentStyle={descriptionContentStyle}>{item('URL地址', x.url || x.baseUrl)}{item('API key', x.apiKey ? `${x.apiKey.slice(0, 4)}****` : null)}{item('超时时间', x.timeout ? `${x.timeout} 秒` : null)}{item('请求方式', <Tag color="blue">{x.requestMethod || 'GET'}</Tag>)}</Descriptions></Card>
    <Card title="参数配置" style={{ marginTop: 16 }}><Space direction="vertical" size={16} style={{ width: '100%' }}><ParameterTable title="Query Parameters" rows={x.queryParameters} /><ParameterTable title="Response Parameters" rows={x.responseParameters} /></Space></Card>
    <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}><Button type="primary" onClick={() => nav(-1)}>返回</Button></Space>
  </div>;
}
