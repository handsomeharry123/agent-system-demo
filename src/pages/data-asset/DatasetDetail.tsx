/**
 * 医疗数据资产中心 - D1.2 数据集详情页
 * 规范：§6.1 D1.2 数据集详情页（V1.4）
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Tabs,
  Tag,
  Typography,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Table,
  Empty,
  Input,
  Modal,
  Form,
  message,
  Tooltip,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ProfileOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ExportDrawer from './ExportDrawer';
import {
  getDatasetById,
  mockCollectionTasks,
  mockExportTasks,
  type CollectionTask,
} from '../../mock/data-asset';

const { Text, Title } = Typography;

const DatasetDetail = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const dataset = getDatasetById(id);
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'tasks' | 'exports'>('overview');
  const [exportOpen, setExportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();

  const linkedTasks = useMemo<CollectionTask[]>(
    () => mockCollectionTasks.filter((t) => t.datasetId === id),
    [id],
  );
  const exportRecords = useMemo(
    () => mockExportTasks.filter((t) => t.datasetId === id),
    [id],
  );

  if (!dataset) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="数据集不存在或已删除" />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => navigate('/app/data-asset/datasets')}>返回列表</Button>
        </div>
      </div>
    );
  }

  const handleEditSave = () => {
    editForm.validateFields().then(() => {
      message.success('数据集信息已更新');
      setEditOpen(false);
    });
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/app/data-asset/datasets')}
              style={{ marginLeft: -8 }}
            />
            数据集详情
          </Space>
        }
        subTitle={dataset.name}
        breadcrumb={[
          { path: '/app/data-asset/datasets', breadcrumbName: '医疗数据资产中心' },
          { path: '/app/data-asset/datasets', breadcrumbName: '数据集资产列表' },
          { path: '', breadcrumbName: dataset.name },
        ]}
        extra={[
          <Button
            key="edit"
            icon={<EditOutlined />}
            onClick={() => {
              editForm.setFieldsValue({ name: dataset.name, description: dataset.description });
              setEditOpen(true);
            }}
          >
            编辑
          </Button>,
          <Button
            key="preview"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/app/data-asset/datasets/${dataset.id}/preview`)}
          >
            数据预览
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => setExportOpen(true)}
          >
            导出
          </Button>,
        ]}
      />

      {/* 数据集头部信息区 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              fontSize: 40,
              color: '#1677FF',
              background: '#E6F4FF',
              width: 64,
              height: 64,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DatabaseOutlined />
          </div>
          <div style={{ flex: 1 }}>
            <Title level={4} style={{ margin: 0 }}>
              {dataset.name}
            </Title>
            <Text type="secondary">{dataset.description}</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Tag color="blue">{dataset.schema.version}</Tag>
                <Tag>{dataset.agentName}</Tag>
                <Tag color="cyan">{dataset.department}</Tag>
              </Space>
            </div>
          </div>
        </div>
      </Card>

      {/* 统计概览（§3.3 4 等分：Col span={6}，合计 24） */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false} style={{ height: '100%' }}>
            <Statistic
              title="记录总数"
              value={dataset.recordTotal}
              suffix="条"
              prefix={<ProfileOutlined style={{ color: '#1677FF' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ height: '100%' }}>
            <Statistic
              title="今日新增"
              value={dataset.todayNew}
              suffix="条"
              prefix={<ReloadOutlined style={{ color: '#52C41A' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ height: '100%' }}>
            <Statistic
              title="近 7 日新增"
              value={dataset.last7dNew}
              suffix="条"
              prefix={<ClockCircleOutlined style={{ color: '#FA8C16' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ height: '100%' }}>
            <Statistic
              title="关联采集任务"
              value={linkedTasks.length}
              suffix="个"
              prefix={<ApartmentOutlined style={{ color: '#722ED1' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card bordered={false} style={{ overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          items={[
            {
              key: 'overview',
              label: '概览',
              icon: <AppstoreOutlined />,
              children: (
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card type="inner" title="元数据配置" style={{ height: '100%' }}>
                      <Table
                        size="small"
                        pagination={false}
                        showHeader={false}
                        dataSource={[
                          { k: '智能体名称', v: dataset.agentName },
                          { k: '所属科室', v: dataset.department },
                          { k: 'Schema 版本', v: dataset.schema.version },
                          { k: '字段数', v: `${dataset.schema.fields.length} 个` },
                          { k: 'Token 数', v: '200 ~ 1,500 / 记录' },
                          { k: '响应耗时', v: '800 ~ 2,800 ms / 记录' },
                        ]}
                        columns={[
                          { dataIndex: 'k', width: 140, render: (t: string) => <Text type="secondary">{t}</Text> },
                          { dataIndex: 'v', render: (t: string) => <Text>{t}</Text> },
                        ]}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card type="inner" title="最近变更" style={{ height: '100%' }}>
                      <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
                          <div>
                            <Text>{new Date(dataset.createdAt).toLocaleString('zh-CN')}</Text>
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>最近一次写入</Text>
                          <div>
                            <Text>{new Date(dataset.updatedAt).toLocaleString('zh-CN')}</Text>
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>导出访问日志</Text>
                          <div>
                            <Text>已记录 {exportRecords.length} 条导出行为，已推送至审计中心</Text>
                          </div>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'schema',
              label: 'Schema',
              icon: <FileTextOutlined />,
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Schema 字段结构为只读展示，本期不提供字段增删改"
                  />
                  <Table
                    size="small"
                    rowKey="name"
                    pagination={false}
                    dataSource={dataset.schema.fields}
                    columns={[
                      {
                        title: '字段名',
                        dataIndex: 'name',
                        width: 220,
                        render: (v: string) => <Text code>{v}</Text>,
                      },
                      {
                        title: '类型',
                        dataIndex: 'type',
                        width: 120,
                        render: (v: string) => <Tag color="purple">{v}</Tag>,
                      },
                      {
                        title: '是否必填',
                        dataIndex: 'required',
                        width: 100,
                        render: (r: boolean) =>
                          r ? (
                            <Tag color="red" icon={<CheckCircleOutlined />}>
                              必填
                            </Tag>
                          ) : (
                            <Tag>选填</Tag>
                          ),
                      },
                      {
                        title: '字段描述',
                        dataIndex: 'description',
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'tasks',
              label: `关联采集任务（${linkedTasks.length}）`,
              icon: <ApartmentOutlined />,
              children: linkedTasks.length === 0 ? (
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Card style={{ height: '100%' }}>
                      <Empty description="暂无关联采集任务" />
                    </Card>
                  </Col>
                </Row>
              ) : (
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Card style={{ height: '100%' }}>
                      <Table
                        size="small"
                        rowKey="id"
                        dataSource={linkedTasks}
                        pagination={false}
                        onRow={(record) => ({
                          onClick: () => navigate(`/app/data-asset/collection-tasks/${record.id}/edit`),
                          style: { cursor: 'pointer' },
                        })}
                        columns={[
                          { title: '任务名称', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
                          { title: '智能体', dataIndex: 'agentName' },
                          {
                            title: '开关状态',
                            dataIndex: 'status',
                            width: 100,
                            render: (s: string) => (
                              <Tag
                                color={
                                  s === '已启用' ? 'success' : s === '采集异常' ? 'error' : 'default'
                                }
                              >
                                {s}
                              </Tag>
                            ),
                          },
                          {
                            title: '最近采集',
                            dataIndex: 'lastCollectedAt',
                            width: 170,
                            render: (t: string) => (
                              <Text type="secondary">{new Date(t).toLocaleString('zh-CN')}</Text>
                            ),
                          },
                          {
                            title: '累计量',
                            dataIndex: 'totalCount',
                            width: 120,
                            render: (v: number) => <Text>{v.toLocaleString()} 条</Text>,
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'exports',
              label: `导出记录（${exportRecords.length}）`,
              icon: <DownloadOutlined />,
              children: (
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Card style={{ height: '100%' }}>
                      {exportRecords.length === 0 ? (
                        <Empty description="暂无导出记录" />
                      ) : (
                        <Table
                          size="small"
                          rowKey="id"
                          dataSource={exportRecords}
                          pagination={false}
                          columns={[
                            { title: '任务 ID', dataIndex: 'id', render: (v: string) => <Text code>{v}</Text> },
                            { title: '提交人', dataIndex: 'submitter' },
                            {
                              title: '提交时间',
                              dataIndex: 'submittedAt',
                              render: (t: string) => (
                                <Text type="secondary">{new Date(t).toLocaleString('zh-CN')}</Text>
                              ),
                            },
                            {
                              title: '状态',
                              dataIndex: 'status',
                              width: 110,
                              render: (s: string) => {
                                const colorMap: Record<string, string> = {
                                  排队中: 'default',
                                  打包中: 'processing',
                                  已完成: 'success',
                                  已过期: 'warning',
                                  失败: 'error',
                                };
                                return <Tag color={colorMap[s]}>{s}</Tag>;
                              },
                            },
                            {
                              title: '记录数 / 大小',
                              render: (_, r) =>
                                r.recordCount ? (
                                  <Space direction="vertical" size={0}>
                                    <Text>{r.recordCount.toLocaleString()} 条</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{r.fileSize}</Text>
                                  </Space>
                                ) : (
                                  <Text type="secondary">—</Text>
                                ),
                            },
                          ]}
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </Card>

      <ExportDrawer
        open={exportOpen}
        dataset={dataset}
        onClose={() => setExportOpen(false)}
      />

      <Modal
        title="编辑数据集"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEditSave}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="数据集名称"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder="请输入数据集名称" />
          </Form.Item>
          <Form.Item name="description" label="数据集描述">
            <Input.TextArea rows={4} placeholder="请输入数据集描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DatasetDetail;
