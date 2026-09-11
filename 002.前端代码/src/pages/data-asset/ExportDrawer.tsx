/**
 * 医疗数据资产中心 - D1.4 导出任务与下载记录抽屉
 * 规范：§6.1 D1.4（V1.4）
 *
 * 两种模式：
 *   - dataset != null：从 D1.1/D1.2/D1.3 触发的「发起导出 + 历史」
 *   - dataset == null：从 D1.1 顶部「导出任务与下载记录」打开的全局视图
 */
import { useMemo, useState } from 'react';
import {
  Drawer,
  Tabs,
  Form,
  Select,
  Input,
  InputNumber,
  DatePicker,
  Radio,
  Switch,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Divider,
  message,
  Modal,
  Alert,
  Tooltip,
  Empty,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HourglassOutlined,
  InboxOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { defaultSchema, mockExportTasks, type Dataset, type ExportTask, type ExportTaskStatus } from '../../mock/data-asset';

const { Text, Paragraph } = Typography;

const statusColorMap: Record<ExportTaskStatus, string> = {
  排队中: 'default',
  打包中: 'processing',
  已完成: 'success',
  已过期: 'warning',
  失败: 'error',
};

const statusIconMap: Record<ExportTaskStatus, React.ReactNode> = {
  排队中: <HourglassOutlined />,
  打包中: <InboxOutlined spin />,
  已完成: <CheckCircleOutlined />,
  已过期: <ClockCircleOutlined />,
  失败: <CloseCircleOutlined />,
};

interface ExportDrawerProps {
  open: boolean;
  dataset: Dataset | null;
  onClose: () => void;
}

const ExportDrawer = ({ open, dataset, onClose }: ExportDrawerProps) => {
  const isGlobal = dataset === null;
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [form] = Form.useForm();
  const [scope, setScope] = useState<'全部' | '按采集时间范围' | '按当前筛选结果' | '按记录数上限'>('全部');
  const [recordLimit, setRecordLimit] = useState<number>(10000);
  const [onlyMine, setOnlyMine] = useState<boolean>(true);
  const [tasks, setTasks] = useState<ExportTask[]>(mockExportTasks);
  const [failureModal, setFailureModal] = useState<{ open: boolean; reason?: string }>({
    open: false,
  });

  // 全局模式下可切换数据集
  const allDatasets = useMemo(() => Array.from(new Set(mockExportTasks.map((t) => t.datasetName))), []);

  const filteredTasks = useMemo(() => {
    if (isGlobal) {
      return onlyMine ? tasks.filter((t) => t.submitter === '王建国') : tasks;
    }
    return tasks.filter((t) => t.datasetId === dataset?.id);
  }, [tasks, dataset, isGlobal, onlyMine]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const newTask: ExportTask = {
        id: `exp-${Date.now()}`,
        datasetId: dataset?.id ?? 'ds-001',
        datasetName: dataset?.name ?? values.dataset,
        submitter: '王建国',
        submittedAt: new Date().toISOString(),
        status: '排队中',
        format: 'JSON',
        scope,
        fields: values.fields,
        recordCount: scope === '按记录数上限' ? recordLimit : undefined,
      };
      setTasks([newTask, ...tasks]);
      message.success('导出任务已提交，进入排队中');
      setActiveTab('list');
    });
  };

  const handleRepack = (record: ExportTask) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === record.id
          ? {
              ...t,
              status: '排队中',
              submittedAt: new Date().toISOString(),
              expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              failureReason: undefined,
            }
          : t,
      ),
    );
    message.success('已重新加入打包队列');
  };

  const handleCancel = (record: ExportTask) => {
    Modal.confirm({
      title: '确认取消导出任务',
      content: `确认取消任务「${record.id}」？`,
      okButtonProps: { danger: true },
      onOk: () => {
        setTasks((prev) => prev.filter((t) => t.id !== record.id));
        message.success('导出任务已取消');
      },
    });
  };

  const handleDelete = (record: ExportTask) => {
    Modal.confirm({
      title: '确认删除记录',
      content: `删除任务「${record.id}」的历史记录？此操作不可恢复。`,
      okButtonProps: { danger: true },
      onOk: () => {
        setTasks((prev) => prev.filter((t) => t.id !== record.id));
        message.success('记录已删除');
      },
    });
  };

  const columns: ColumnsType<ExportTask> = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '数据集',
      dataIndex: 'datasetName',
      key: 'datasetName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (t: string) => (
        <Text type="secondary">{new Date(t).toLocaleString('zh-CN')}</Text>
      ),
    },
    {
      title: '提交人',
      dataIndex: 'submitter',
      key: 'submitter',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: ExportTaskStatus) => (
        <Tag icon={statusIconMap[s]} color={statusColorMap[s]}>
          {s}
        </Tag>
      ),
    },
    {
      title: '记录数 / 大小',
      key: 'count',
      width: 140,
      render: (_, r) => {
        if (r.status === '已完成' || r.status === '已过期') {
          return (
            <Space direction="vertical" size={0}>
              <Text>{(r.recordCount ?? 0).toLocaleString()} 条</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{r.fileSize}</Text>
            </Space>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: '下载链接',
      key: 'download',
      width: 200,
      render: (_, r) => {
        if (r.status !== '已完成') return <Text type="secondary">—</Text>;
        const expire = r.expireAt ? new Date(r.expireAt).getTime() : 0;
        const remain = Math.max(0, Math.floor((expire - Date.now()) / (1000 * 60 * 60 * 24)));
        return (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              style={{ paddingLeft: 0 }}
              onClick={() => message.success('下载已开始')}
            >
              下载导出包
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              有效期剩余 {remain} 天
            </Text>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          {(r.status === '已完成' || r.status === '已过期') && (
            <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRepack(r)}>
              重新打包
            </Button>
          )}
          {(r.status === '排队中' || r.status === '打包中') && (
            <Button type="link" size="small" danger onClick={() => handleCancel(r)}>
              取消
            </Button>
          )}
          {r.status === '失败' && (
            <Button
              type="link"
              size="small"
              icon={<ExclamationCircleOutlined />}
              onClick={() => setFailureModal({ open: true, reason: r.failureReason })}
            >
              查看失败原因
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(r)}
          >
            删除记录
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <DownloadOutlined />
            <span>{isGlobal ? '导出任务与下载记录' : `数据集导出 · ${dataset?.name}`}</span>
          </Space>
        }
        placement="right"
        width={isGlobal ? 960 : 720}
        open={open}
        onClose={onClose}
        destroyOnClose
        extra={
          <Switch
            checked={onlyMine}
            onChange={setOnlyMine}
            checkedChildren="只看我提交的"
            unCheckedChildren="全部"
          />
        }
        footer={
          activeTab === 'create' && !isGlobal ? (
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => form.resetFields()}>重置</Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleSubmit}>
                提交导出任务
              </Button>
            </Space>
          ) : null
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'create' | 'list')}
          items={[
            {
              key: 'create',
              label: isGlobal ? '新建导出' : '新建导出',
              children: isGlobal ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical">
                      <Text type="secondary">全局视图仅展示历史导出任务</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        请从数据集列表 / 详情 / 预览页发起新的导出
                      </Text>
                    </Space>
                  }
                />
              ) : (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="本期仅支持 JSON 格式导出，其他格式（HuggingFace / CSV）作为远期能力"
                  />
                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                      dataset: dataset?.name,
                      fields: defaultSchema.fields.map((f) => f.name),
                      scope: '全部',
                      format: 'JSON',
                    }}
                  >
                    <Form.Item label="数据集" name="dataset">
                      <Input disabled />
                    </Form.Item>

                    <Form.Item
                      label="字段范围"
                      name="fields"
                      rules={[{ required: true, message: '请至少选择一个字段' }]}
                      extra="默认全选，可取消勾选以缩小导出面"
                    >
                      <Select
                        mode="multiple"
                        placeholder="从 Schema 中选择要导出的字段"
                        options={defaultSchema.fields.map((f) => ({
                          label: `${f.name}（${f.description}）`,
                          value: f.name,
                        }))}
                      />
                    </Form.Item>

                    <Form.Item label="记录范围" required>
                      <Radio.Group
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                      >
                        <Radio value="全部">全部</Radio>
                        <Radio value="按采集时间范围">按采集时间范围</Radio>
                        <Radio value="按当前筛选结果">按当前筛选结果</Radio>
                        <Radio value="按记录数上限">按记录数上限</Radio>
                      </Radio.Group>
                    </Form.Item>

                    {scope === '按采集时间范围' && (
                      <Form.Item label="时间范围" extra="仅导出此区间内采集的记录">
                        <DatePicker.RangePicker style={{ width: '100%' }} />
                      </Form.Item>
                    )}
                    {scope === '按记录数上限' && (
                      <Form.Item
                        label="记录数上限"
                        extra="最多导出 100,000 条；超出请缩小范围"
                      >
                        <InputNumber
                          min={1}
                          max={100000}
                          step={1000}
                          value={recordLimit}
                          onChange={(v) => setRecordLimit(v ?? 10000)}
                          style={{ width: '100%' }}
                          formatter={(v) => `${v} 条`}
                          parser={(v) => Number((v ?? '').replace(/[^\d]/g, '')) || 0}
                        />
                      </Form.Item>
                    )}

                    <Divider style={{ margin: '8px 0 16px' }} />

                    <Form.Item
                      label="导出格式"
                      name="format"
                      extra="其他格式（HuggingFace / CSV）作为远期能力，本期置灰"
                    >
                      <Radio.Group>
                        <Radio value="JSON">JSON</Radio>
                        <Tooltip title="远期能力">
                          <Radio value="HuggingFace" disabled>
                            HuggingFace
                          </Radio>
                        </Tooltip>
                        <Tooltip title="远期能力">
                          <Radio value="CSV" disabled>
                            CSV
                          </Radio>
                        </Tooltip>
                      </Radio.Group>
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
            {
              key: 'list',
              label: isGlobal ? `任务列表（${filteredTasks.length}）` : '历史记录',
              children: (
                <Table
                  columns={columns}
                  dataSource={filteredTasks}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  scroll={{ x: 900 }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无导出记录"
                      />
                    ),
                  }}
                />
              ),
            },
          ]}
        />
      </Drawer>

      <Modal
        title="失败原因"
        open={failureModal.open}
        onCancel={() => setFailureModal({ open: false })}
        footer={null}
      >
        <Paragraph copyable>{failureModal.reason}</Paragraph>
      </Modal>
    </>
  );
};

export default ExportDrawer;
