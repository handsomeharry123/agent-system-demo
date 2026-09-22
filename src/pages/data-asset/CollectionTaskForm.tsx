/**
 * 医疗数据资产中心 - D2.2 新建 / 编辑 采集任务页
 * 规范：§6.2 D2.2（V1.4）
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Modal,
  message,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  mockCollectionTasks,
  mockDatasetAgents,
  mockDatasets,
  defaultSchema,
  type Dataset,
  type AgentLite,
} from '../../mock/data-asset';

const { Text, Title } = Typography;

interface FormValues {
  name: string;
  description?: string;
  agentId: string;
  datasetId: string;
  enabled: boolean;
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  statusCode: number;
  message: string;
}

const CollectionTaskForm = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const [form] = Form.useForm<FormValues>();
  const [agentId, setAgentId] = useState<string | undefined>();
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [newDatasetOpen, setNewDatasetOpen] = useState(false);
  const [newDsForm] = Form.useForm();
  const [extraDatasets, setExtraDatasets] = useState<Dataset[]>([]);

  // 编辑模式：拉取任务数据
  useEffect(() => {
    if (isEdit && params.id) {
      const t = mockCollectionTasks.find((x) => x.id === params.id);
      if (t) {
        form.setFieldsValue({
          name: t.name,
          description: t.description,
          agentId: t.agentId,
          datasetId: t.datasetId,
          enabled: t.status === '已启用',
        });
        setAgentId(t.agentId);
        setDatasetId(t.datasetId);
      }
    }
  }, [isEdit, params.id, form]);

  // 已被其他任务绑定的智能体（编辑模式不限制）
  const boundAgentIds = useMemo(() => {
    if (isEdit && params.id) {
      // 编辑模式：除自身外其他任务占用的 agent
      return new Set(
        mockCollectionTasks
          .filter((t) => t.id !== params.id)
          .map((t) => t.agentId),
      );
    }
    return new Set(mockCollectionTasks.map((t) => t.agentId));
  }, [isEdit, params.id]);

  const agentOptions = useMemo(
    () =>
      mockDatasetAgents.map((a) => ({
        label: a.name,
        value: a.id,
        disabled: boundAgentIds.has(a.id) && !isEdit ? false : boundAgentIds.has(a.id),
      })),
    [boundAgentIds, isEdit],
  );

  const allDatasets = useMemo(() => [...mockDatasets, ...extraDatasets], [extraDatasets]);
  const datasetOptions = useMemo(
    () => allDatasets.map((d) => ({ label: d.name, value: d.id })),
    [allDatasets],
  );

  const selectedAgent: AgentLite | undefined = mockDatasetAgents.find((a) => a.id === agentId);
  const selectedDataset = allDatasets.find((d) => d.id === datasetId);

  // 重复绑定校验
  const validateAgent = async (_: any, value: string) => {
    if (!value) return;
    if (boundAgentIds.has(value) && !(isEdit && params.id)) {
      throw new Error('该智能体已被其他任务绑定，请先解绑');
    }
  };

  // 任务名称系统内唯一校验
  const validateUniqueName = async (_: any, value: string) => {
    if (!value) return;
    const trimmed = value.trim();
    const conflict = mockCollectionTasks.find(
      (t) => t.name === trimmed && t.id !== params.id,
    );
    if (conflict) {
      throw new Error('该任务名称已被占用，请换一个');
    }
  };

  // 测试连接
  const handleTest = async () => {
    if (!agentId) {
      message.warning('请先选择关联智能体');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      const ok = Math.random() > 0.2;
      const result: TestResult = ok
        ? {
            ok: true,
            latencyMs: 200 + Math.floor(Math.random() * 400),
            statusCode: 200,
            message: 'Callback Handler 可达，握手成功',
          }
        : {
            ok: false,
            latencyMs: 30000,
            statusCode: 504,
            message: 'Callback Handler 连接超时（30s），请检查智能体网络可达性',
          };
      setTestResult(result);
      setTesting(false);
    }, 800);
  };

  // 保存为草稿 / 保存并启用
  const handleSave = (nextEnabled: boolean) => {
    form
      .validateFields()
      .then((values) => {
        const payload = { ...values, enabled: nextEnabled };
        if (isEdit) {
          message.success('采集任务已更新');
        } else {
          message.success(nextEnabled ? '采集任务已创建并启用' : '采集任务已保存为草稿');
        }
        // 这里仅模拟保存；真实场景会调 API
        // eslint-disable-next-line no-console
        console.log('[save]', payload);
        navigate('/app/data-asset/collection-tasks');
      })
      .catch(() => {
        message.error('表单校验未通过，请检查');
      });
  };

  // 取消
  const handleCancel = () => {
    if (form.isFieldsTouched()) {
      Modal.confirm({
        title: '放弃未保存的修改？',
        content: '当前有未保存的修改，确认离开？',
        okButtonProps: { danger: true },
        onOk: () => navigate('/app/data-asset/collection-tasks'),
      });
      return;
    }
    navigate('/app/data-asset/collection-tasks');
  };

  // 新建数据集
  const handleCreateDataset = () => {
    newDsForm
      .validateFields()
      .then((values) => {
        const ds: Dataset = {
          id: `ds-${Date.now()}`,
          name: values.name,
          description: values.description || '',
          agentId: agentId ?? '',
          agentName: selectedAgent?.name ?? '',
          department: selectedAgent?.department ?? '',
          schema: defaultSchema,
          recordTotal: 0,
          todayNew: 0,
          last7dNew: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setExtraDatasets((prev) => [...prev, ds]);
        form.setFieldsValue({ datasetId: ds.id });
        setDatasetId(ds.id);
        setNewDatasetOpen(false);
        newDsForm.resetFields();
        message.success('数据集已创建');
      })
      .catch(() => {});
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleCancel}
              style={{ marginLeft: -8 }}
            />
            {isEdit ? '编辑采集任务' : '新建采集任务'}
          </Space>
        }
        subTitle={isEdit ? '修改任务名称 / 描述 / 开关；智能体与目标数据集锁定' : '配置智能体 → 目标数据集的绑定关系'}
        breadcrumb={[
          { path: '/app/data-asset/collection-tasks', breadcrumbName: '医疗数据资产中心' },
          { path: '/app/data-asset/collection-tasks', breadcrumbName: '采集任务列表' },
          { path: '', breadcrumbName: isEdit ? '编辑' : '新建' },
        ]}
      />

      <Card bordered={false}>
        <Form<FormValues>
          form={form}
          layout="vertical"
          initialValues={{
            enabled: true,
          }}
          style={{ maxWidth: 800 }}
        >
          <Form.Item
            label="任务名称"
            name="name"
            rules={[
              { required: true, message: '请输入任务名称' },
              { max: 50, message: '不超过 50 字符' },
              { validator: validateUniqueName },
            ]}
          >
            <Input placeholder="系统内唯一，建议包含智能体名 + 用途" />
          </Form.Item>

          <Form.Item label="任务描述" name="description">
            <Input.TextArea rows={3} placeholder="可选，说明任务用途" />
          </Form.Item>

          <Form.Item
            label="关联智能体"
            name="agentId"
            rules={[{ required: true, message: '请选择关联智能体' }, { validator: validateAgent }]}
            extra="已被其他任务绑定的智能体置灰不可选"
          >
            <Select
              placeholder="从已注册智能体中选择"
              disabled={isEdit}
              options={agentOptions}
              onChange={(v) => setAgentId(v)}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                目标数据集
                {!isEdit && (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (!agentId) {
                        message.warning('请先选择关联智能体');
                        return;
                      }
                      newDsForm.resetFields();
                      setNewDatasetOpen(true);
                    }}
                    style={{ padding: 0 }}
                  >
                    新建数据集
                  </Button>
                )}
              </Space>
            }
            name="datasetId"
            rules={[{ required: true, message: '请选择目标数据集' }]}
            extra="编辑模式下不可修改，避免数据混入"
          >
            <Select
              placeholder="选择数据集或点击右侧新建"
              disabled={isEdit}
              options={datasetOptions}
              onChange={(v) => setDatasetId(v)}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="采集开关"
            name="enabled"
            valuePropName="checked"
            extra="开关开启即全量入库，不做采样、不做条件过滤"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="测试连接" extra="验证 Callback Handler 可达性">
            <Space>
              <Button
                icon={<ApiOutlined />}
                loading={testing}
                onClick={handleTest}
                disabled={!agentId}
              >
                测试连接
              </Button>
              {testResult && (
                <Space>
                  {testResult.ok ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      {testResult.message}（{testResult.latencyMs} ms / {testResult.statusCode}）
                    </Tag>
                  ) : (
                    <Tag color="error" icon={<CloseCircleOutlined />}>
                      {testResult.message}
                    </Tag>
                  )}
                </Space>
              )}
            </Space>
          </Form.Item>

          {isEdit && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="编辑模式下：关联智能体与目标数据集不可修改（避免数据混入），仅可修改名称 / 描述 / 开关"
            />
          )}

          <Divider style={{ margin: '8px 0 16px' }} />

          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              数据集 Schema 预览（{selectedDataset?.schema.version ?? '—'}）
            </Text>
          </div>
          <Table
            size="small"
            rowKey="name"
            pagination={false}
            dataSource={selectedDataset?.schema.fields ?? []}
            columns={[
              { title: '字段名', dataIndex: 'name', width: 220, render: (v: string) => <Text code>{v}</Text> },
              { title: '类型', dataIndex: 'type', width: 120, render: (v: string) => <Tag color="purple">{v}</Tag> },
              {
                title: '是否必填',
                dataIndex: 'required',
                width: 100,
                render: (r: boolean) => (r ? <Tag color="red">必填</Tag> : <Tag>选填</Tag>),
              },
              { title: '字段描述', dataIndex: 'description' },
            ]}
          />
        </Form>
      </Card>

      {/* 底部操作 */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#fff',
          padding: '12px 24px',
          marginTop: 16,
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}
      >
        <Button onClick={handleCancel}>取消</Button>
        {!isEdit && (
          <Button
            icon={<SaveOutlined />}
            onClick={() => handleSave(false)}
          >
            保存为草稿
          </Button>
        )}
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => handleSave(true)}
        >
          {isEdit ? '保存修改' : '保存并启用'}
        </Button>
      </div>

      {/* 新建数据集弹窗 */}
      <Modal
        title="新建数据集"
        open={newDatasetOpen}
        onCancel={() => setNewDatasetOpen(false)}
        onOk={handleCreateDataset}
        okText="创建"
      >
        <Title level={5} style={{ marginTop: 0 }}>
          将创建于智能体：{selectedAgent?.name ?? '—'}
        </Title>
        <Form form={newDsForm} layout="vertical">
          <Form.Item
            label="数据集名称"
            name="name"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder="请输入数据集名称" />
          </Form.Item>
          <Form.Item label="数据集描述" name="description">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item label="Schema 模板">
            <Tag color="blue">{defaultSchema.version}</Tag>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              包含 {defaultSchema.fields.length} 个预定义字段
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CollectionTaskForm;
