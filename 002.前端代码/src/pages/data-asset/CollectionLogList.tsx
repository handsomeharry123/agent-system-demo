/**
 * 医疗数据资产中心 - D2.3 采集日志与异常重试
 * 规范：§6.2 D2.3（V1.4）
 *
 * 默认进入「异常」Tab；支持批量重试 / 标记忽略 / 删除 / 导出 CSV。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Typography,
  Button,
  Space,
  Modal,
  Select,
  DatePicker,
  message,
  Drawer,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EyeOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import {
  mockCollectionLogs,
  mockCollectionTasks,
  type CollectionLog,
  type CollectionLogStatus,
  type FailureReason,
} from '../../mock/data-asset';

const { Text, Paragraph } = Typography;

const statusColorMap: Record<CollectionLogStatus, string> = {
  成功: 'success',
  异常: 'error',
};

const reasonColorMap: Record<FailureReason, string> = {
  格式校验失败: 'orange',
  连接超时: 'red',
  'Schema 不匹配': 'purple',
  未知错误: 'default',
};

const CollectionLogList = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [activeTab, setActiveTab] = useState<'all' | 'success' | 'error'>('error');
  const [taskFilter, setTaskFilter] = useState<string | undefined>(params.id);
  const [reasonFilter, setReasonFilter] = useState<string | undefined>();
  const [showIgnored, setShowIgnored] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [logs, setLogs] = useState<(CollectionLog & { ignored?: boolean })[]>(
    mockCollectionLogs.map((l) => ({ ...l })),
  );
  const [detail, setDetail] = useState<CollectionLog | null>(null);

  // 编辑模式下：URL 带 id，自动锁定到该任务
  useEffect(() => {
    if (params.id) setTaskFilter(params.id);
  }, [params.id]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (!showIgnored && l.ignored) return false;
      if (activeTab === 'success' && l.status !== '成功') return false;
      if (activeTab === 'error' && l.status !== '异常') return false;
      if (taskFilter && l.taskId !== taskFilter) return false;
      if (reasonFilter && l.failureReason !== reasonFilter) return false;
      return true;
    });
  }, [logs, activeTab, taskFilter, reasonFilter, showIgnored]);

  const handleRetry = (record: CollectionLog) => {
    setLogs((prev) =>
      prev.map((l) => (l.id === record.id ? { ...l, retriedCount: l.retriedCount + 1 } : l)),
    );
    message.success('已发起重试');
  };

  const handleBatchRetry = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要重试的记录');
      return;
    }
    setLogs((prev) =>
      prev.map((l) =>
        selectedRowKeys.includes(l.id)
          ? { ...l, retriedCount: l.retriedCount + 1 }
          : l,
      ),
    );
    setSelectedRowKeys([]);
    message.success(`已批量重试 ${selectedRowKeys.length} 条`);
  };

  const handleIgnore = (record: CollectionLog) => {
    setLogs((prev) => prev.map((l) => (l.id === record.id ? { ...l, ignored: true } : l)));
    message.success('已标记忽略');
  };

  const handleBatchIgnore = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要标记的记录');
      return;
    }
    setLogs((prev) =>
      prev.map((l) => (selectedRowKeys.includes(l.id) ? { ...l, ignored: true } : l)),
    );
    setSelectedRowKeys([]);
    message.success(`已批量忽略 ${selectedRowKeys.length} 条`);
  };

  const handleDelete = (record: CollectionLog) => {
    Modal.confirm({
      title: '确认删除日志',
      content: `确认删除日志「${record.id}」？此操作不可恢复。`,
      okButtonProps: { danger: true },
      onOk: () => {
        setLogs((prev) => prev.filter((l) => l.id !== record.id));
        message.success('已删除');
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }
    Modal.confirm({
      title: '确认批量删除',
      content: `确认删除选中的 ${selectedRowKeys.length} 条日志？`,
      okButtonProps: { danger: true },
      onOk: () => {
        setLogs((prev) => prev.filter((l) => !selectedRowKeys.includes(l.id)));
        setSelectedRowKeys([]);
        message.success('批量删除完成');
      },
    });
  };

  const handleExport = () => {
    message.success('日志已导出为 CSV（演示）');
  };

  const columns: ColumnsType<CollectionLog & { ignored?: boolean }> = [
    {
      title: '任务',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 220,
      render: (v: string, r) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => navigate(`/app/data-asset/collection-tasks/${r.taskId}/edit`)}
        >
          {v}
        </Button>
      ),
    },
    { title: '智能体', dataIndex: 'agentName', width: 220, ellipsis: true },
    {
      title: '记录摘要',
      dataIndex: 'summary',
      ellipsis: true,
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: CollectionLogStatus) => (
        <Tag
          color={statusColorMap[s]}
          icon={s === '成功' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {s}
        </Tag>
      ),
    },
    {
      title: '失败原因',
      dataIndex: 'failureReason',
      width: 140,
      render: (v?: string) => (v ? <Tag color={reasonColorMap[v as FailureReason]}>{v}</Tag> : '—'),
    },
    {
      title: '重试次数',
      dataIndex: 'retriedCount',
      width: 100,
      sorter: (a, b) => a.retriedCount - b.retriedCount,
      render: (v: number) =>
        v >= 3 ? (
          <Tooltip title="超过阈值，建议人工介入">
            <Tag color="red">{v}（需人工介入）</Tag>
          </Tooltip>
        ) : (
          <Tag color={v > 0 ? 'orange' : 'default'}>{v}</Tag>
        ),
    },
    {
      title: '最近失败时间',
      dataIndex: 'lastFailedAt',
      width: 170,
      render: (t: string) => (
        <Text type="secondary">{new Date(t).toLocaleString('zh-CN')}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4} wrap>
          {record.status === '异常' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetry(record)}
            >
              重试
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetail(record)}
          >
            查看详情
          </Button>
          {record.status === '异常' && (
            <Button
              type="link"
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleIgnore(record)}
            >
              标记忽略
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const taskOptions = mockCollectionTasks.map((t) => ({ label: t.name, value: t.id }));
  const reasonOptions: { label: string; value: FailureReason }[] = [
    { label: '格式校验失败', value: '格式校验失败' },
    { label: '连接超时', value: '连接超时' },
    { label: 'Schema 不匹配', value: 'Schema 不匹配' },
    { label: '未知错误', value: '未知错误' },
  ];

  const counts = {
    all: logs.length,
    success: logs.filter((l) => l.status === '成功').length,
    error: logs.filter((l) => l.status === '异常').length,
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/app/data-asset/collection-tasks')}
              style={{ marginLeft: -8 }}
            />
            采集日志与异常重试
          </Space>
        }
        subTitle="查看采集成功 / 失败日志，处理异常队列与一键重试"
        breadcrumb={[
          { path: '/app/data-asset/collection-tasks', breadcrumbName: '医疗数据资产中心' },
          { path: '/app/data-asset/collection-tasks', breadcrumbName: '采集任务列表' },
          { path: '', breadcrumbName: '采集日志与异常重试' },
        ]}
        extra={[
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={activeTab !== 'all'}
          >
            导出 CSV
          </Button>,
        ]}
      />

      <Card bordered={false} style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <Space wrap size={16}>
          <Space>
            <Text type="secondary">任务</Text>
            <Select
              placeholder="全部任务"
              allowClear
              style={{ width: 240 }}
              value={taskFilter}
              onChange={(v) => setTaskFilter(v)}
              options={taskOptions}
            />
          </Space>
          <Space>
            <Text type="secondary">失败原因</Text>
            <Select
              placeholder="全部原因"
              allowClear
              style={{ width: 160 }}
              value={reasonFilter}
              onChange={(v) => setReasonFilter(v)}
              options={reasonOptions}
            />
          </Space>
          <Space>
            <Text type="secondary">时间</Text>
            <DatePicker.RangePicker />
          </Space>
          <Space>
            <Text type="secondary">智能体</Text>
            <Select
              placeholder="全部智能体"
              allowClear
              style={{ width: 200 }}
              options={[
                { label: '心电图智能辅助诊断系统', value: 'agent-001' },
                { label: '胸部 CT 影像智能分析平台', value: 'agent-002' },
                { label: '病历智能生成与质控系统', value: 'agent-003' },
                { label: '处方智能审核与用药安全系统', value: 'agent-004' },
                { label: '智能导诊与分诊系统', value: 'agent-005' },
              ]}
            />
          </Space>
          <Button
            onClick={() => setShowIgnored((v) => !v)}
            type={showIgnored ? 'primary' : 'default'}
            icon={showIgnored ? <CheckOutlined /> : undefined}
          >
            {showIgnored ? '已包含已忽略' : '包含已忽略'}
          </Button>
        </Space>
      </Card>

      <Card bordered={false} style={{ overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k as 'all' | 'success' | 'error');
            setSelectedRowKeys([]);
          }}
          items={[
            { key: 'all', label: `全部（${counts.all}）` },
            { key: 'success', label: `成功（${counts.success}）` },
            { key: 'error', label: `异常（${counts.error}）` },
          ]}
        />

        {/* 批量操作栏 */}
        {selectedRowKeys.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              background: '#E6F4FF',
              borderBottom: '1px solid #91CAFF',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text>已选 {selectedRowKeys.length} 条</Text>
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={handleBatchRetry}>
              批量重试
            </Button>
            <Button size="small" icon={<StopOutlined />} onClick={handleBatchIgnore}>
              批量标记忽略
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              批量删除
            </Button>
            <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>
              取消选择
            </Button>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="middle"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1500 }}
        />
      </Card>

      <Drawer
        title="日志详情"
        placement="right"
        width={560}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">记录 ID</Text>
              <div>
                <Text code>{detail.id}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">对话摘要</Text>
              <div>
                <Paragraph copyable>{detail.summary}</Paragraph>
              </div>
            </div>
            <div>
              <Text type="secondary">状态</Text>
              <div>
                <Tag color={statusColorMap[detail.status]}>{detail.status}</Tag>
              </div>
            </div>
            {detail.failureReason && (
              <div>
                <Text type="secondary">失败原因</Text>
                <div>
                  <Tag color={reasonColorMap[detail.failureReason]}>{detail.failureReason}</Tag>
                </div>
              </div>
            )}
            {detail.payload && (
              <div>
                <Text type="secondary">Payload</Text>
                <pre
                  style={{
                    background: '#FAFAFA',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    overflow: 'auto',
                  }}
                >
                  {detail.payload}
                </pre>
              </div>
            )}
            {detail.stack && (
              <div>
                <Text type="secondary">错误堆栈</Text>
                <pre
                  style={{
                    background: '#FFF1F0',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    overflow: 'auto',
                    color: '#CF1322',
                  }}
                >
                  {detail.stack}
                </pre>
              </div>
            )}
            <div>
              <Text type="secondary">最近失败时间</Text>
              <div>
                <Text>{new Date(detail.lastFailedAt).toLocaleString('zh-CN')}</Text>
              </div>
            </div>
            {detail.status === '异常' && (
              <Space>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    handleRetry(detail);
                    setDetail(null);
                  }}
                >
                  重试
                </Button>
                <Button
                  icon={<StopOutlined />}
                  onClick={() => {
                    handleIgnore(detail);
                    setDetail(null);
                  }}
                >
                  标记忽略
                </Button>
              </Space>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default CollectionLogList;
