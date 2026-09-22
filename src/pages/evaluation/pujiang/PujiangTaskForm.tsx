import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  CheckCircleOutlined,
  CloseOutlined,
  DownloadOutlined,
  EyeOutlined,
  ExportOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { PUJIANG_DIMENSIONS, PUJIANG_PLATFORM, PUJIANG_PLATFORM_URL, addPujiangTask, getPujiangTask, initialPujiangTasks } from './data';
import { useAccessRecords } from '../../agent-center/store';
import { useSmartDraft } from '../../agent-center/smart/store';
import { getTaskById } from '../../../mock/evaluation';

const { Link, Text } = Typography;

interface ApiDocumentFile {
  uid: string;
  name: string;
  size: string;
  url: string;
}

const isTechnicalDocument = (name: string) => /技术|API|接口|SDK|OTel|spec/i.test(name);

const formatFileSize = (size = 0) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const PujiangTaskForm = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accessRecords = useAccessRecords();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();
  const editingTask = useMemo(() => params.get('taskId') ? getPujiangTask(params.get('taskId')!) : undefined, [params]);
  const sourceSafetyTask = useMemo(
    () => params.get('sourceTaskId') ? getTaskById(params.get('sourceTaskId')!) : undefined,
    [params],
  );
  const sourceAgent = useMemo(() => sourceSafetyTask ? {
    id: sourceSafetyTask.agentId,
    agentId: sourceSafetyTask.agentId,
    agentCode: sourceSafetyTask.agentCode,
    agentName: sourceSafetyTask.agentName,
    version: sourceSafetyTask.version,
    department: sourceSafetyTask.department,
    status: '草稿' as const,
    dimensions: [],
    scores: [],
  } : undefined, [sourceSafetyTask]);
  const selectableAgents = useMemo(
    () => sourceAgent && !initialPujiangTasks.some((item) => item.agentCode === sourceAgent.agentCode)
      ? [sourceAgent, ...initialPujiangTasks]
      : initialPujiangTasks,
    [sourceAgent],
  );
  const selectedAgent = editingTask || sourceAgent || initialPujiangTasks[0];
  const [form] = Form.useForm();
  const back = (notice?: string) => { if (notice) message.success(notice); navigate('/app/evaluation/tasks?module=pujiang'); };

  const getRegisteredDocuments = (agentId: string): ApiDocumentFile[] => {
    const agent = selectableAgents.find((item) => item.id === agentId);
    if (!agent) return [];
    const record = accessRecords.find((item) => item.agentCode === agent.agentCode || item.name === agent.agentName);
    return (record?.attachments || [])
      .filter((file) => isTechnicalDocument(file.name))
      .map((file, index) => ({ uid: `${record?.id || agentId}-tech-${index}`, ...file }));
  };

  const initialAgentId = selectedAgent.id;
  const [apiDocuments, setApiDocuments] = useState<ApiDocumentFile[]>(() => getRegisteredDocuments(initialAgentId));

  const counts = useMemo(() => ({
    evaluating: initialPujiangTasks.filter((task) => task.status === '评测中').length,
    passed: initialPujiangTasks.filter((task) => task.status === '评测通过').length,
    returned: initialPujiangTasks.filter((task) => task.status === '退回修改').length,
  }), []);

  useEffect(() => {
    const values = [counts.evaluating, counts.passed, counts.returned];
    pushWelcomeGreeting('pujiang-evaluation-create', 'admin', () => values, {
      windowReplacements: values,
      chips: [
        { key: 'pujiang-create-evaluating', label: `评测中 ${counts.evaluating}`, targetTab: '评测中', tone: 'warning' },
        { key: 'pujiang-create-passed', label: `评测通过 ${counts.passed}`, targetTab: '评测通过', tone: 'success' },
        { key: 'pujiang-create-returned', label: `退回修改 ${counts.returned}`, targetTab: '退回修改', tone: 'error' },
      ],
    });
    const onJump = (event: Event) => {
      const targetTab = (event as CustomEvent<string>).detail;
      if (!['评测中', '评测通过', '退回修改'].includes(targetTab)) return;
      navigate(`/app/evaluation/tasks?module=pujiang&tab=${encodeURIComponent(targetTab)}`);
    };
    window.addEventListener('agent-jump-tab', onJump);
    return () => {
      window.removeEventListener('agent-jump-tab', onJump);
      consumeWelcome();
    };
  }, [consumeWelcome, counts, navigate, pushWelcomeGreeting]);

  const fillAgentFields = (agentId: string) => {
    const agent = selectableAgents.find((item) => item.id === agentId);
    if (!agent) return;
    form.setFieldsValue({
      modelName: agent.agentName.slice(0, 20),
      modelId: agent.agentCode,
      apiEndpoint: `https://api.hospital.example.com/agents/${agent.agentCode.toLowerCase()}/v1`,
    });
    setApiDocuments(getRegisteredDocuments(agentId));
  };

  const previewDocument = (file: ApiDocumentFile) => {
    if (file.url && file.url !== '#') {
      window.open(file.url, '_blank', 'noopener,noreferrer');
      return;
    }
    Modal.info({
      title: `预览：${file.name}`,
      width: 720,
      content: (
        <div style={{ marginTop: 8, padding: '40px 24px', textAlign: 'center', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          <FilePdfOutlined style={{ fontSize: 40, color: '#d4380d' }} />
          <div style={{ marginTop: 10 }}>{file.name}</div>
          <Text type="secondary">（{file.size}）演示文件仅展示元信息</Text>
        </div>
      ),
    });
  };

  const downloadDocument = (file: ApiDocumentFile) => {
    if (file.url && file.url !== '#') {
      const anchor = document.createElement('a');
      anchor.href = file.url;
      anchor.download = file.name;
      anchor.click();
    }
    message.success(`已下载 ${file.name}`);
  };

  const removeApiDocument = (file: ApiDocumentFile) => {
    setApiDocuments((current) => current.filter((item) => item.uid !== file.uid));
    if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
    message.success(`已从本次评测中移除 ${file.name}`);
  };

  const resetApiDocuments = () => {
    apiDocuments.forEach((file) => {
      if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
    });
    const agentId = form.getFieldValue('agentId') as string;
    setApiDocuments(getRegisteredDocuments(agentId));
    message.success('已恢复为接入中心默认技术文档');
  };

  const addApiDocument = (file: UploadFile) => {
    const rawFile = file as UploadFile & { originFileObj?: File };
    const source = rawFile.originFileObj || (file as unknown as File);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      message.error('仅支持上传 PDF 技术文档');
      return Upload.LIST_IGNORE;
    }
    setApiDocuments((current) => [
      ...current,
      {
        uid: file.uid,
        name: file.name,
        size: formatFileSize(file.size),
        url: source instanceof Blob ? URL.createObjectURL(source) : '#',
      },
    ]);
    message.success(`已补充上传 ${file.name}`);
    return false;
  };

  const handlePublicChange = (value: '公开' | '不公开') => {
    if (value !== '公开') return;
    Modal.confirm({
      title: '确认公开评测结果',
      content: '公开后，评测结果将在浦江实验室评测平台榜单对外展示。确认公开吗？',
      okText: '确认公开',
      cancelText: '不公开',
      onCancel: () => form.setFieldValue('resultPublic', '不公开'),
    });
  };

  const startEvaluation = async () => {
    const values = await form.validateFields();
    if (!apiDocuments.length) {
      message.error('请上传智能体 API 文档');
      return;
    }

    const agent = selectableAgents.find((item) => item.id === values.agentId);
    if (!agent) {
      message.error('未找到所选智能体');
      return;
    }

    const submitTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const taskId = `pj-task-${Date.now()}`;
    addPujiangTask({
      id: taskId,
      agentId: agent.agentId,
      agentCode: agent.agentCode,
      agentName: values.modelName,
      version: agent.version,
      department: agent.department,
      status: '评测中',
      dimensions: [...PUJIANG_DIMENSIONS],
      submitTime,
      scores: [],
    });

    navigate(`/app/evaluation/tasks?module=pujiang&tab=${encodeURIComponent('评测中')}`, {
      state: {
        pujiangTaskCreated: {
          taskId,
          agentName: values.modelName,
          submitTime,
        },
      },
    });
  };

  return <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
    <PageHeader title={editingTask ? '编辑 medbench评测任务' : '新建 medbench评测任务'} subTitle="填写参评智能体与 API 提交信息，发起 medbench评测" showBack onBack={() => back('已自动保存为草稿')} />
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        agentId: selectedAgent.id,
        modelName: selectedAgent.agentName.slice(0, 20),
        developerType: '组织团队',
        parameterCount: 7,
        openSource: '否',
        contextLength: 32,
        apiEndpoint: `https://api.hospital.example.com/agents/${selectedAgent.agentCode.toLowerCase()}/v1`,
        temperature: 0.7,
        topP: 0.9,
        modelId: selectedAgent.agentCode,
        apiKey: 'sk-medbench-demo-key',
        concurrency: 32,
        releaseDate: dayjs('2026-07-01'),
        email: 'admin@hospital.example.com',
        resultPublic: '不公开',
      }}
    >
      <Card title="评测对象" style={{ marginTop: 16 }}>
        <Form.Item label="选择智能体" name="agentId" rules={[{ required: true, message: '请选择智能体' }]}>
          <Select style={{ maxWidth: 520 }} showSearch optionFilterProp="label" onChange={fillAgentFields} options={selectableAgents.map((task) => ({ value: task.id, label: `${task.agentName}（${task.agentCode}）` }))} />
        </Form.Item>
        <Form.Item label="评测平台">
          <Space direction="vertical" size={4}>
            <Text strong>{PUJIANG_PLATFORM}</Text>
            <Link href={PUJIANG_PLATFORM_URL} target="_blank" rel="noreferrer"><ExportOutlined /> {PUJIANG_PLATFORM_URL}</Link>
          </Space>
        </Form.Item>
      </Card>

      <Card title="API提交信息" style={{ marginTop: 16 }}>
        <Form.Item label="智能体名称" name="modelName" rules={[{ required: true, message: '请输入智能体名称' }, { max: 20, message: '智能体名称不能超过 20 个字符' }]}>
          <Input showCount maxLength={20} placeholder="请输入智能体名称" />
        </Form.Item>
        <Form.Item label={<Space>开发者类型<Tooltip title="个人指自然人开发者；组织/团队指医院、企业、高校或研发团队"><InfoCircleOutlined /></Tooltip></Space>} name="developerType" rules={[{ required: true, message: '请选择开发者类型' }]}>
          <Radio.Group options={['个人', '组织团队']} />
        </Form.Item>
        <Form.Item label="参数量（单位：十亿）" name="parameterCount" rules={[{ required: true, message: '请输入参数量' }]}>
          <InputNumber min={0.1} step={0.1} precision={1} addonAfter="B" placeholder="请输入参数量" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="是否开源" name="openSource" rules={[{ required: true, message: '请选择是否开源' }]}>
          <Radio.Group options={['是', '否']} />
        </Form.Item>
        <Form.Item label="上下文长度（单位：token）" name="contextLength" rules={[{ required: true, message: '请输入上下文长度' }]}>
          <InputNumber min={1} precision={0} addonAfter="K" placeholder="请输入智能体可支持的上下文长度" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="智能体 API Endpoint" name="apiEndpoint" rules={[{ required: true, message: '请输入智能体 API Endpoint' }, { type: 'url', message: '请输入合法的 URL' }]}>
          <Input placeholder="请输入 API Endpoint URL" />
        </Form.Item>
        <Form.Item label="Temperature" name="temperature" rules={[{ required: true, message: '请输入 Temperature' }, { type: 'number', min: 0, max: 2, message: 'Temperature 须在 0–2 之间' }]}>
          <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} placeholder="请输入 Temperature" />
        </Form.Item>
        <Form.Item label="Top P" name="topP" rules={[{ type: 'number', min: 0, max: 1, message: 'Top P 须在 0–1 之间' }]}>
          <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} placeholder="请输入 Top P" />
        </Form.Item>
        <Form.Item label="智能体 ID" name="modelId" rules={[{ required: true, message: '请输入智能体 ID' }]}>
          <Input placeholder="请输入智能体 ID" />
        </Form.Item>
        <Form.Item label="API Key" name="apiKey">
          <Input.Password placeholder="请输入 API Key" autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="智能体 API 文档" required>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 16px' }}>
            {apiDocuments.length === 0 ? (
              <Text type="secondary">接入注册记录中暂无技术文档，请补充上传</Text>
            ) : apiDocuments.map((file, index) => (
              <div key={file.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '6px 0' }}>
                <Space>
                  <FilePdfOutlined style={{ color: '#d4380d' }} />
                  <Text>附件 {index + 1}：{file.name}</Text>
                  <Text type="secondary">（{file.size}）</Text>
                </Space>
                <Space>
                  <Button type="link" danger size="small" onClick={() => removeApiDocument(file)}>移除</Button>
                  <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => previewDocument(file)}>在线预览</Button>
                  <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => downloadDocument(file)}>下载</Button>
                </Space>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: apiDocuments.length ? 8 : 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
              <Button icon={<UndoOutlined />} onClick={resetApiDocuments}>重置</Button>
              <Upload accept=".pdf,application/pdf" showUploadList={false} beforeUpload={addApiDocument}>
                <Button icon={<UploadOutlined />}>补充上传</Button>
              </Upload>
            </div>
          </div>
        </Form.Item>
        <Form.Item label="预计 API 并发量" name="concurrency" rules={[{ type: 'number', min: 1, message: '预计 API 并发量须为正整数' }]}>
          <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="比如：32" />
        </Form.Item>
        <Form.Item label="GitHub / 官网" name="website" rules={[{ type: 'url', message: '请输入合法的链接' }]}>
          <Input placeholder="请输入可访问的链接" />
        </Form.Item>
        <Form.Item label="智能体发布日期" name="releaseDate" rules={[{ required: true, message: '请选择智能体发布日期' }]}>
          <DatePicker format="YYYY-MM-DD" disabledDate={(date) => date.isAfter(dayjs(), 'day')} placeholder="请选择日期" style={{ width: 320 }} />
        </Form.Item>
        <Form.Item label="邮箱" name="email" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入合法的邮箱地址' }]}>
          <Input placeholder="请输入邮箱地址" />
        </Form.Item>
        <Form.Item label={<Space>评测结果是否公开<Tooltip title="公开后将在评测平台榜单展示；医疗场景建议选择不公开"><InfoCircleOutlined /></Tooltip></Space>} name="resultPublic" rules={[{ required: true, message: '请选择评测结果是否公开' }]}>
          <Radio.Group onChange={(event) => handlePublicChange(event.target.value)} options={['公开', '不公开']} />
        </Form.Item>
      </Card>
    </Form>

    <Card style={{ marginTop: 16 }} bodyStyle={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Space>
        <Button icon={<CloseOutlined />} onClick={() => back()}>取消</Button>
        <Button icon={<SaveOutlined />} onClick={() => back('已暂存为草稿')}>暂存</Button>
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={startEvaluation}>开始评测</Button>
      </Space>
    </Card>
  </div>;
};

export default PujiangTaskForm;
