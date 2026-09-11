// =============================================================================
// 数据集详情页（V1.7 §二 · 2.3）
//   · 2.3.1 数据集基本信息（只读 / 编辑切换）
//   · 2.3.2 数据集题目列表：序号、输入文本、期望输出、题目类型、上传时间、操作
//            - 操作：查看 / 更多（编辑、删除）
//   · 顶部操作：编辑 / 导入题集（→2.4）/ 导出 / 返回
// =============================================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Descriptions,
  Tag,
  Table,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Result,
  Modal,
  Drawer,
  Dropdown,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  DownloadOutlined,
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import {
  mockDatasets,
  ALL_DIMENSIONS,
  dimensionColorMap,
  type EvaluationDataset,
  type EvalDimension,
  type DatasetQuestion,
  type QuestionType,
} from '../../mock/evaluation';
import { useAuth } from '../../hooks/useAuth';

const { Text } = Typography;
const { TextArea } = Input;

const ALL_QUESTION_TYPES: QuestionType[] = [
  '单选题', '多选题', '填空题', '问答题', '场景模拟',
];

const EvaluationDatasetDetail = () => {
  const navigate = useNavigate();
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'edit' ? 'edit' : 'view';
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

  const dataset = useMemo(
    () => mockDatasets.find((d) => d.id === datasetId),
    [datasetId]
  );

  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [form] = Form.useForm();

  // 题目列表：搜索关键字 / 抽屉状态
  const [qKw, setQKw] = useState('');
  const [qDrawerOpen, setQDrawerOpen] = useState(false);
  const [qDrawerMode, setQDrawerMode] = useState<'view' | 'edit'>('view');
  const [activeQuestion, setActiveQuestion] = useState<DatasetQuestion | null>(null);
  const [editForm] = Form.useForm();

  if (!dataset) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Result
          status="404"
          title="数据集不存在"
          subTitle="该数据集可能已被删除"
        />
      </div>
    );
  }

  // 进入编辑模式
  const enterEditMode = () => {
    form.setFieldsValue({
      name: dataset.name,
      dimensions: dataset.dimensions,
      version: dataset.version,
      description: dataset.description,
      status: dataset.status,
    });
    setMode('edit');
  };

  // 保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      Modal.confirm({
        title: '确认保存修改？',
        content: '保存后将更新数据集的基本信息。',
        okText: '确认保存',
        cancelText: '取消',
        onOk: () => {
          const idx = mockDatasets.findIndex((d) => d.id === dataset.id);
          if (idx >= 0) {
            mockDatasets[idx] = {
              ...mockDatasets[idx],
              name: values.name,
              dimensions: values.dimensions as EvalDimension[],
              version: values.version,
              description: values.description,
              status: values.status,
              updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            };
          }
          message.success('保存成功');
          setMode('view');
        },
      });
    } catch {
      message.error('请检查必填字段');
    }
  };

  // 取消
  const handleCancel = () => {
    Modal.confirm({
      title: '是否放弃编辑？',
      content: '未保存的修改将丢失。',
      okText: '确认放弃',
      okType: 'danger',
      cancelText: '继续编辑',
      onOk: () => setMode('view'),
    });
  };

  // 导出 CSV
  const handleExport = () => {
    const headers = ['题目编号', '输入文本', '期望输出', '题目类型'];
    const rows = dataset.questions.map((q) => [q.no, q.input, q.expected, q.type]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.name}-${dataset.version}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已导出 ${dataset.questions.length} 条题目`);
  };

  // ---------------------------------------------------------------------------
  // 题目列表 · 操作（仅信息科管理员可编辑/删除，所有用户可查看）
  // ---------------------------------------------------------------------------

  // 关闭抽屉
  const closeQuestionDrawer = () => {
    setQDrawerOpen(false);
    setActiveQuestion(null);
    setQDrawerMode('view');
  };

  // 查看
  const handleViewQuestion = (q: DatasetQuestion) => {
    setActiveQuestion(q);
    setQDrawerMode('view');
    setQDrawerOpen(true);
  };

  // 编辑
  const handleEditQuestion = (q: DatasetQuestion) => {
    setActiveQuestion(q);
    setQDrawerMode('edit');
    editForm.setFieldsValue({
      no: q.no,
      input: q.input,
      expected: q.expected,
      type: q.type,
    });
    setQDrawerOpen(true);
  };

  // 保存编辑
  const handleSaveQuestion = async () => {
    if (!activeQuestion) return;
    try {
      const values = await editForm.validateFields();
      const idx = mockDatasets.findIndex((d) => d.id === dataset.id);
      if (idx >= 0) {
        const qIdx = mockDatasets[idx].questions.findIndex((q) => q.id === activeQuestion.id);
        if (qIdx >= 0) {
          mockDatasets[idx].questions[qIdx] = {
            ...mockDatasets[idx].questions[qIdx],
            input: values.input,
            expected: values.expected,
            type: values.type as QuestionType,
          };
          mockDatasets[idx] = {
            ...mockDatasets[idx],
            updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          };
        }
      }
      message.success('保存成功');
      closeQuestionDrawer();
    } catch {
      message.error('请检查必填字段');
    }
  };

  // 删除
  const handleDeleteQuestion = (q: DatasetQuestion) => {
    Modal.confirm({
      title: '确认删除该题目？',
      icon: <ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />,
      content: `确认删除题目「${q.no}」？删除后无法恢复，且会同步更新题集数量。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const idx = mockDatasets.findIndex((d) => d.id === dataset.id);
        if (idx >= 0) {
          mockDatasets[idx] = {
            ...mockDatasets[idx],
            questions: mockDatasets[idx].questions.filter((x) => x.id !== q.id),
            questionCount: Math.max(0, mockDatasets[idx].questionCount - 1),
            updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          };
        }
        message.success(`已删除，题集数量已更新为 ${Math.max(0, dataset.questionCount - 1).toLocaleString()}`);
      },
    });
  };

  // 题目过滤（按题目编号 / 输入文本）
  const filteredQuestions = useMemo(() => {
    if (!qKw.trim()) return dataset.questions;
    const kw = qKw.trim().toLowerCase();
    return dataset.questions.filter(
      (q) => q.no.toLowerCase().includes(kw) || q.input.toLowerCase().includes(kw)
    );
  }, [dataset.questions, qKw]);

  // 题目表格列
  const qColumns: ColumnsType<DatasetQuestion> = [
    { title: '序号', key: 'index', width: 80, render: (_, __, idx) => idx + 1 },
    { title: '输入文本', dataIndex: 'input', key: 'input', width: 280, ellipsis: { showTitle: true } },
    { title: '期望输出', dataIndex: 'expected', key: 'expected', width: 280, ellipsis: { showTitle: true } },
    { title: '题目类型', dataIndex: 'type', key: 'type', width: 110, render: (v) => <Tag>{v}</Tag> },
    { title: '上传时间', dataIndex: 'uploadedAt', key: 'uploadedAt', width: 180, render: (v: string) => <span style={{ whiteSpace: 'nowrap' }}>{v}</span> },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        const moreItems = isAdmin
          ? [
              {
                key: 'edit',
                label: (
                  <Space size={6}>
                    <EditOutlined />
                    <span>编辑</span>
                  </Space>
                ),
                onClick: () => handleEditQuestion(record),
              },
              {
                key: 'delete',
                label: (
                  <Space size={6} style={{ color: '#FF4D4F' }}>
                    <DeleteOutlined />
                    <span>删除</span>
                  </Space>
                ),
                onClick: () => handleDeleteQuestion(record),
              },
            ]
          : [];
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewQuestion(record)}
            >
              查看
            </Button>
            {isAdmin && (
              <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
                <Button type="link" size="small" icon={<MoreOutlined />}>
                  更多
                </Button>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <PageHeader
        title={mode === 'edit' ? `编辑数据集：${dataset.name}` : `数据集详情：${dataset.name}`}
        subTitle={`v${dataset.version} · ${dataset.questionCount} 条 · ${dataset.size}`}
        showBack
        onBack={() => navigate('/app/evaluation/datasets')}
        extra={
          mode === 'view' ? (
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
              {isAdmin && (
                <>
                  <Button
                    type="default"
                    icon={<PlusOutlined />}
                    onClick={() => navigate(`/app/evaluation/datasets/${dataset.id}/import-questions`)}
                  >
                    导入题集
                  </Button>
                  <Button type="primary" icon={<EditOutlined />} onClick={enterEditMode}>
                    编辑
                  </Button>
                </>
              )}
            </Space>
          ) : (
            <Space>
              <Button icon={<CloseOutlined />} onClick={handleCancel}>取消</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
            </Space>
          )
        }
      />

      {/* 基本信息 */}
      <Card style={{ marginTop: 16 }} title="数据集基本信息">
        {mode === 'view' ? (
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="数据集名称">{dataset.name}</Descriptions.Item>
            <Descriptions.Item label="适用评测维度">
              <Space wrap size={4}>
                {dataset.dimensions.map((d) => (
                  <Tag
                    key={d}
                    color={dimensionColorMap[d]}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/app/evaluation/indicators')}
                  >
                    {d}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="数据集版本"><Tag color="blue">v{dataset.version}</Tag></Descriptions.Item>
            <Descriptions.Item label="题集数量">{dataset.questionCount.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="数据集大小">{dataset.size}</Descriptions.Item>
            <Descriptions.Item label="使用状态">
              <Tag color={dataset.status === '启用' ? 'success' : 'default'}>{dataset.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{dataset.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{dataset.updatedAt}</Descriptions.Item>
            <Descriptions.Item label="数据集描述" span={3}>
              {dataset.description || <Text type="secondary">暂无描述</Text>}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="name"
                  label="数据集名称"
                  required
                  rules={[
                    { required: true, message: '请输入数据集名称' },
                    { max: 50, message: '50 字以内' },
                  ]}
                >
                  <Input placeholder="请输入数据集名称" maxLength={50} showCount />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="dimensions"
                  label="适用评测维度"
                  required
                  rules={[{ required: true, message: '请选择适用评测维度' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择适用评测维度"
                    options={ALL_DIMENSIONS.map((d) => ({ label: d, value: d }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="version"
                  label="数据集版本"
                  required
                  rules={[{ required: true, message: '请输入数据集版本' }]}
                >
                  <Input placeholder="例如：1.0" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="status" label="使用状态" required>
                  <Select
                    options={[
                      { label: '启用', value: '启用' },
                      { label: '禁用', value: '禁用' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="题集数量">
                  <Input value={dataset.questionCount.toLocaleString()} disabled />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="数据集描述"
              rules={[{ max: 500, message: '500 字以内' }]}
            >
              <TextArea rows={3} maxLength={500} showCount placeholder="请输入数据集描述" />
            </Form.Item>
          </Form>
        )}
      </Card>

      {/* 题目列表 */}
      <Card
        style={{ marginTop: 16 }}
        title="数据集题目列表"
        extra={
          <Input.Search
            allowClear
            placeholder="搜索题目编号 / 输入文本"
            style={{ width: 260 }}
            value={qKw}
            onChange={(e) => setQKw(e.target.value)}
            onSearch={(v) => setQKw(v)}
          />
        }
      >
        {dataset.questions.length === 0 ? (
          <Result
            status="info"
            title="暂无题目"
            subTitle="该数据集尚未包含任何题目"
          />
        ) : (
          <Table
            size="small"
            rowKey="id"
            columns={qColumns}
            dataSource={filteredQuestions}
            pagination={{
              showSizeChanger: true,
              defaultPageSize: 10,
              pageSizeOptions: [10, 20, 50],
              showTotal: (t) => `共 ${t} 条`,
            }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      {/* 题目详情 / 编辑抽屉（2.3.2） */}
      <Drawer
        title={
          qDrawerMode === 'view'
            ? `题目详情 · ${activeQuestion?.no ?? ''}`
            : `编辑题目 · ${activeQuestion?.no ?? ''}`
        }
        open={qDrawerOpen}
        onClose={closeQuestionDrawer}
        width={560}
        destroyOnClose
        footer={
          qDrawerMode === 'edit' && isAdmin
            ? [
                <Button key="cancel" onClick={closeQuestionDrawer}>
                  取消
                </Button>,
                <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveQuestion}>
                  保存
                </Button>,
              ]
            : null
        }
      >
        {activeQuestion && qDrawerMode === 'view' && (
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="题目编号">{activeQuestion.no}</Descriptions.Item>
            <Descriptions.Item label="输入文本">
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {activeQuestion.input}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="期望输出">
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {activeQuestion.expected}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="题目类型">
              <Tag>{activeQuestion.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="上传时间">{activeQuestion.uploadedAt}</Descriptions.Item>
          </Descriptions>
        )}

        {activeQuestion && qDrawerMode === 'edit' && (
          <Form form={editForm} layout="vertical">
            <Form.Item label="题目编号" required>
              <Input value={activeQuestion.no} disabled />
            </Form.Item>
            <Form.Item
              name="input"
              label="输入文本"
              required
              rules={[
                { required: true, message: '请输入输入文本' },
                { max: 500, message: '500 字以内' },
              ]}
            >
              <TextArea rows={4} maxLength={500} showCount placeholder="请输入题目输入文本" />
            </Form.Item>
            <Form.Item
              name="expected"
              label="期望输出"
              required
              rules={[
                { required: true, message: '请输入期望输出' },
                { max: 500, message: '500 字以内' },
              ]}
            >
              <TextArea rows={4} maxLength={500} showCount placeholder="请输入期望输出" />
            </Form.Item>
            <Form.Item
              name="type"
              label="题目类型"
              required
              rules={[{ required: true, message: '请选择题目类型' }]}
            >
              <Select
                placeholder="请选择题目类型"
                options={ALL_QUESTION_TYPES.map((t) => ({ label: t, value: t }))}
              />
            </Form.Item>
            <Form.Item label="上传时间">
              <Input value={activeQuestion.uploadedAt} disabled />
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </div>
  );
};

export default EvaluationDatasetDetail;
