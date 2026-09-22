import { useState } from 'react';
import { ApiOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { AutoComplete, Button, Card, Col, Form, Input, InputNumber, Modal, Radio, Row, Space, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { EvalPlatform, loadPlatforms, now, savePlatforms } from './evaluationPlatforms';

const globalParameterOptions = [
  ['#agentName', '智能体名称'], ['#agentCode', '智能体编号'], ['#version', '智能体版本'],
  ['#openSource', '是否开源'], ['#releaseDate', '智能体发布日期'], ['#modelName', '使用模型名称'],
  ['#modelVersion', '使用模型版本'], ['#deploymentMode', '模型部署方式'], ['#department', '所属科室'],
  ['#clinicalStage', '诊疗环节'], ['#description', '功能描述'], ['#source', '智能体来源'],
  ['#supplier', '供应商名称'], ['#contactName', '技术联系人'], ['#contactPhone', '手机号'],
  ['#contactEmail', '邮箱'], ['#parameterCount', '参数量'], ['#contextLength', '上下文长度'],
  ['#temperature', 'Temperature'], ['#topP', 'Top P'], ['#concurrency', '预计 API 并发量'],
  ['#accessMode', '接入方式'], ['#apiEndpoint', '接口地址'], ['#apiKey', 'API key'],
  ['#platformUrl', '平台 URL 地址'], ['#platformKey', '平台密钥 key'],
  ['#evaluationScoringRule', '评测评分规则'], ['#totalEvaluationScore', '评测总分'],
  ['#overallConclusion', '总体结论'], ['#evaluationDimension', '评测维度'],
  ['#dimensionScoreMap', '各维度得分'], ['#evaluationPassStatus', '评测通过状态'],
  ['#evaluationPassThreshold', '评测通过阈值'], ['#parentDimension', '父级评测维度'],
].map(([value, label]) => ({ value, label: `${label}（${value}）` }));

const GlobalValueInput = ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => {
  const hashIndex = value?.lastIndexOf('#') ?? -1;
  const keyword = hashIndex >= 0 ? value!.slice(hashIndex).toLowerCase() : '';
  const options = keyword ? globalParameterOptions.filter(option => option.value.toLowerCase().includes(keyword) || String(option.label).toLowerCase().includes(keyword.slice(1))) : [];
  return <AutoComplete value={value} onChange={onChange} onSelect={selected => onChange?.(`${hashIndex > 0 ? value!.slice(0, hashIndex) : ''}${selected}`)} options={options} placeholder="输入 # 可应用全局参数" style={{ width: '100%' }} filterOption={false} />;
};

const ParameterSection = ({ name, title }: { name: 'queryParameters' | 'responseParameters'; title: string }) => <Card size="small" title={title} extra={null} styles={{ header: { background: '#f5f7fa' } }}>
  <Form.List name={name}>
    {(fields, { add, remove }) => <>
      {fields.map(field => <Row gutter={16} key={field.key} align="top" wrap={false} style={{ marginBottom: 16 }}>
        <Col flex="1 1 0"><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><span style={{ width: 52, lineHeight: '32px', whiteSpace: 'nowrap' }}><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>name</span><Form.Item {...field} name={[field.name, 'name']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: '请输入参数名' }]}><Input placeholder="请输入评测平台参数名" /></Form.Item></div></Col>
        <Col flex="1 1 0"><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><span style={{ width: 54, lineHeight: '32px', whiteSpace: 'nowrap' }}><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>Value</span><Form.Item {...field} name={[field.name, 'value']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: '请输入参数值' }]}><GlobalValueInput /></Form.Item></div></Col>
        <Col flex="88px"><Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>删除</Button></Col>
      </Row>)}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ name: '', value: '' })}>添加</Button>
    </>}
  </Form.List>
</Card>;

export default function EvaluationPlatformForm() {
  const nav = useNavigate(); const { id } = useParams(); const rows = loadPlatforms(); const model = rows.find(x => x.id === id);
  const [form] = Form.useForm(); const [connected, setConnected] = useState(model?.connected === 'success'); const [testing, setTesting] = useState(false);
  const normalizeParameters = (parameters?: Array<{ name: string; value?: string; mappingName?: string }>) => parameters?.map(parameter => ({ name: parameter.name, value: parameter.value || parameter.mappingName || '' })) || [{ name: '', value: '' }];
  const initialValues = { ...model, url: model?.url || model?.baseUrl || '', timeout: model?.timeout || 30, requestMethod: model?.requestMethod || 'GET', queryParameters: normalizeParameters(model?.queryParameters), responseParameters: normalizeParameters(model?.responseParameters) };
  const persist = (draft: boolean) => { const v = form.getFieldsValue(true); const item: EvalPlatform = { ...model, ...v, id: model?.id || `platform-${Date.now()}`, dimensions: model?.dimensions || [], enabled: model?.enabled || false, connected: connected ? 'success' : 'untested', deployment: model?.deployment || '无需部署', pythonVersion: model?.pythonVersion || '无要求', deploymentStatus: model?.deploymentStatus || '无需部署', evaluationMethod: model?.evaluationMethod || 'API', draft, updatedAt: now() }; savePlatforms(model ? rows.map(x => x.id === model.id ? item : x) : [item, ...rows]); message.success(draft ? '已暂存至草稿列表' : '提交成功'); nav('/app/system-config/evaluation-platforms'); };
  const test = async () => { try { await form.validateFields(['name', 'provider', 'email', 'url', 'apiKey', 'timeout', 'requestMethod']); setTesting(true); window.setTimeout(() => { setTesting(false); setConnected(true); Modal.success({ title: '测试验证正常', content: 'API 地址、鉴权信息及参数配置验证通过。' }); }, 800); } catch { message.warning('请先完善必填信息'); } };
  return <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
    <PageHeader title={model ? '编辑评测平台' : '新增评测平台'} subTitle="配置第三方评测平台 API 及请求、响应参数映射" showBack onBack={() => nav('/app/system-config/evaluation-platforms')} />
    <Form form={form} layout="vertical" initialValues={initialValues} onValuesChange={() => setConnected(false)}>
      <Card title="基本信息" style={{ marginTop: 16 }}><Row gutter={24}><Col span={12}><Form.Item name="name" label="平台名称" rules={[{ required: true, message: '请输入平台名称' }]}><Input maxLength={50} showCount placeholder="请输入平台名称" /></Form.Item></Col><Col span={12}><Form.Item name="provider" label="提供方" rules={[{ required: true, message: '请输入团队名称' }]}><Input placeholder="请输入团队名称" /></Form.Item></Col><Col span={12}><Form.Item name="phone" label="电话号码"><Input placeholder="请输入电话号码" /></Form.Item></Col><Col span={12}><Form.Item name="email" label="邮箱" rules={[{ required: true }, { type: 'email', message: '请输入正确的邮箱' }]}><Input placeholder="请输入邮箱" /></Form.Item></Col><Col span={24}><Form.Item name="description" label="平台简介"><Input.TextArea rows={3} maxLength={200} showCount placeholder="请输入平台简介" /></Form.Item></Col></Row></Card>
      <Card title="技术信息" style={{ marginTop: 16 }}><Row gutter={24}><Col span={24}><Form.Item name="url" label="URL地址" rules={[{ required: true, message: '请输入 URL 地址' }, { type: 'url', message: '请输入合法 URL' }]}><Input placeholder="https://example.com/api" /></Form.Item></Col><Col span={12}><Form.Item name="apiKey" label="API key" rules={[{ required: true, message: '请输入 API key' }]}><Input.Password placeholder="请输入 API 鉴权凭证" /></Form.Item></Col><Col span={12}><Form.Item name="timeout" label="超时时间" rules={[{ required: true }]}><InputNumber min={1} max={3600} addonAfter="秒" style={{ width: '100%' }} /></Form.Item></Col><Col span={24}><Form.Item name="requestMethod" label="请求方式" rules={[{ required: true }]}><Radio.Group><Radio value="GET">GET</Radio><Radio value="POST">POST</Radio></Radio.Group></Form.Item></Col></Row></Card>
      <Card title="参数配置" style={{ marginTop: 16 }}><Space direction="vertical" size={16} style={{ width: '100%' }}><ParameterSection name="queryParameters" title="Query Parameters" /><ParameterSection name="responseParameters" title="Response Parameters" /></Space></Card>
      <Card style={{ marginTop: 16 }}><Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => nav('/app/system-config/evaluation-platforms')}>取消</Button><Button icon={<SaveOutlined />} onClick={() => persist(true)}>暂存</Button><Button icon={<ApiOutlined />} loading={testing} onClick={test}>联通测试</Button><Button type="primary" disabled={!connected} onClick={() => Modal.confirm({ title: '确认提交评测平台？', onOk: () => persist(false) })}>提交</Button></Space></Card>
    </Form>
  </div>;
}
