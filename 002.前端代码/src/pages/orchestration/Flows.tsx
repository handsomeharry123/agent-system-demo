import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProColumns, ProTable } from '@ant-design/pro-components';
import type { TablePaginationConfig } from 'antd';
import {
  Card, Button, Space, Tag, Typography, Drawer, Descriptions,
  Timeline, message, Modal, Form, Select, Input, Table, Collapse,
  Empty, Dropdown, theme, Popconfirm, Alert, Divider, Badge, DatePicker
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, NodeIndexOutlined,
  HistoryOutlined, UndoOutlined, BarChartOutlined, MoreOutlined,
  FileTextOutlined, CopyOutlined, StopOutlined, CheckCircleOutlined,
  DownOutlined, SearchOutlined, FilterOutlined, DeleteOutlined as BatchDeleteOutlined,
  InboxOutlined
} from '@ant-design/icons';
import type { OrchestrationFlow, FlowStatus, FlowExecutionRecord } from '../../mock/orchestration';
import { mockFlows, mockFlowExecutionRecords, flowStatusColors, getFlowExecutions } from '../../mock/orchestration';
import PageHeader from '../../components/PageHeader';

const { Text, Link } = Typography;
const { Panel } = Collapse;
const { RangePicker } = DatePicker;

// Status color per spec: 草稿（灰）/ 测试中（蓝）/ 上线（绿）/ 下线（红）/ 已归档（灰）
const flowStatusColorMap: Record<FlowStatus, string> = {
  '草稿': 'default',
  '测试中': 'processing',
  '上线': 'success',
  '下线': 'error',
  '已归档': 'default',
};

const statusOptions = [
  { label: '草稿', value: '草稿' },
  { label: '测试中', value: '测试中' },
  { label: '上线', value: '上线' },
  { label: '下线', value: '下线' },
  { label: '已归档', value: '已归档' },
];

const deptOptions = [
  { label: '全院', value: '全院' },
  { label: '心内科', value: '心内科' },
  { label: '呼吸科', value: '呼吸科' },
  { label: '消化科', value: '消化科' },
  { label: '急诊科', value: '急诊科' },
  { label: '药剂科', value: '药剂科' },
  { label: '放射科', value: '放射科' },
  { label: '体检科', value: '体检科' },
];

const creatorOptions = [
  { label: '管理员', value: '管理员' },
  { label: '张医生', value: '张医生' },
  { label: '李护士', value: '李护士' },
];

const executionStatusColors: Record<string, string> = {
  '执行中': 'processing',
  '已完成': 'success',
  '已失败': 'error',
  '已终止': 'default',
};

const Flows = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<OrchestrationFlow | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<FlowStatus[]>([]);
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();

  const handleViewDetail = (flow: OrchestrationFlow) => {
    setSelectedFlow(flow);
    setDetailVisible(true);
  };

  const handleEditFlow = (flow: OrchestrationFlow) => {
    setDetailVisible(false);
    navigate(`/app/orchestration/flows/${flow.id}`);
  };

  const handleCreate = async () => {
    await form.validateFields();
    const values = form.getFieldsValue();
    message.success('流程创建成功');
    setCreateModalVisible(false);
    form.resetFields();
    navigate(`/app/orchestration/flows/new`);
  };

  const handleViewVersion = (flow: OrchestrationFlow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFlow(flow);
    setVersionModalVisible(true);
  };

  const handleViewExecution = (flow: OrchestrationFlow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFlow(flow);
    setExecutionDrawerVisible(true);
  };

  const handleStatusChange = (flow: OrchestrationFlow, newStatus: FlowStatus) => {
    message.success(`流程「${flow.name}」已${newStatus === '上线' ? '上线' : newStatus === '下线' ? '下线' : '归档'}`);
  };

  const handleBatchArchive = () => {
    message.success(`已批量归档 ${selectedRowKeys.length} 个流程`);
    setSelectedRowKeys([]);
  };

  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个流程吗？删除后不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      onOk: () => {
        message.success(`已批量删除 ${selectedRowKeys.length} 个流程`);
        setSelectedRowKeys([]);
      }
    });
  };

  // Filter flows
  const filteredFlows = mockFlows.filter(flow => {
    if (searchText && !flow.name.toLowerCase().includes(searchText.toLowerCase()) &&
        !flow.description.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(flow.status)) {
      return false;
    }
    if (deptFilter.length > 0 && !flow.applicableDepts.some(d => deptFilter.includes(d))) {
      return false;
    }
    if (creatorFilter.length > 0 && !creatorFilter.includes(flow.creator)) {
      return false;
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const flowDate = new Date(flow.updateTime).getTime();
      const start = new Date(dateRange[0]).getTime();
      const end = new Date(dateRange[1]).getTime() + 86400000; // Add one day to include the end date
      if (flowDate < start || flowDate > end) {
        return false;
      }
    }
    return true;
  });

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (record: OrchestrationFlow) => ({
      disabled: record.status === '已归档', // 已归档状态不可选
    }),
  };

  const columns: ProColumns<OrchestrationFlow>[] = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (_, record) => (
        <Link onClick={() => handleEditFlow(record)}>{record.name}</Link>
      ),
    },
    {
      title: '流程描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      render: (val) => <Text type="secondary" ellipsis>{val}</Text>,
    },
    {
      title: '适用科室',
      key: 'applicableDepts',
      width: 150,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {record.applicableDepts.slice(0, 3).map((dept) => (
            <Tag key={dept} color="blue">{dept}</Tag>
          ))}
          {record.applicableDepts.length > 3 && (
            <Tag color="default">+{record.applicableDepts.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '节点数',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 80,
      render: (val) => <Text>{val} 个节点</Text>,
      sorter: (a, b) => a.nodeCount - b.nodeCount,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: FlowStatus) => (
        <Tag color={flowStatusColorMap[val]}>{val}</Tag>
      ),
      valueType: 'select',
      valueEnum: statusOptions.reduce((acc, opt) => {
        acc[opt.value] = { text: opt.label };
        return acc;
      }, {} as Record<string, { text: string }>),
    },
    {
      title: '当前版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (val) => <Tag>{val}</Tag>,
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 100,
      render: (val) => <Text type="secondary">{val}</Text>,
    },
    {
      title: '今日执行',
      dataIndex: 'todayExecutionCount',
      key: 'todayExecutionCount',
      width: 100,
      render: (val) => <Text>{val?.toLocaleString() || 0} 次</Text>,
      sorter: (a, b) => (a.todayExecutionCount || 0) - (b.todayExecutionCount || 0),
    },
    {
      title: '近7天成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      width: 110,
      render: (val: number) => (
        <Space>
          <Text type={val >= 95 ? 'success' : val >= 90 ? 'warning' : 'danger'}>
            {val !== undefined ? `${val}%` : '-'}
          </Text>
          {val !== undefined && val < 95 && <BarChartOutlined style={{ color: '#faad14' }} />}
        </Space>
      ),
    },
    {
      title: '最近编辑时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      width: 160,
      render: (val) => <Text type="secondary">{val}</Text>,
      sorter: (a, b) => a.updateTime.localeCompare(b.updateTime),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const renderArchivedActions = () => (
          <Space size="small">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>查看</Button>
            <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => message.success(`流程「${record.name}」已复制`)}>复制</Button>
          </Space>
        );

        if (record.status === '已归档') {
          return renderArchivedActions();
        }

        const moreItems: MenuProps['items'] = [];

        // 草稿状态操作
        if (record.status === '草稿') {
          moreItems.push({ key: 'test', icon: <PlayCircleOutlined />, label: '提交测试', onClick: () => handleStatusChange(record, '测试中') });
          moreItems.push({ type: 'divider' });
          moreItems.push({ key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除流程「${record.name}」吗？`,
              onOk: () => message.success('流程已删除')
            });
          }});
        }

        // 测试中状态操作
        if (record.status === '测试中') {
          moreItems.push({ key: 'publish', icon: <CheckCircleOutlined />, label: '发布上线', onClick: () => handleStatusChange(record, '上线') });
          moreItems.push({ key: 'backToDraft', icon: <UndoOutlined />, label: '退回草稿', onClick: () => handleStatusChange(record, '草稿') });
          moreItems.push({ type: 'divider' });
          moreItems.push({ key: 'debug', icon: <BarChartOutlined />, label: '调试', onClick: () => handleEditFlow(record) });
        }

        // 上线状态操作
        if (record.status === '上线') {
          moreItems.push({ key: 'pause', icon: <PauseCircleOutlined />, label: '暂停', onClick: () => handleStatusChange(record, '下线') });
          moreItems.push({ key: 'version', icon: <HistoryOutlined />, label: '版本管理', onClick: () => handleViewVersion(record, {} as any) });
          moreItems.push({ key: 'execution', icon: <BarChartOutlined />, label: '执行记录', onClick: () => handleViewExecution(record, {} as any) });
        }

        // 下线状态操作
        if (record.status === '下线') {
          moreItems.push({ key: 'resume', icon: <PlayCircleOutlined />, label: '重新启用', onClick: () => handleStatusChange(record, '上线') });
          moreItems.push({ key: 'archive', icon: <HistoryOutlined />, label: '归档', onClick: () => handleStatusChange(record, '已归档') });
          moreItems.push({ key: 'execution', icon: <BarChartOutlined />, label: '执行记录', onClick: () => handleViewExecution(record, {} as any) });
        }

        return (
          <Space size="small">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditFlow(record)}>编辑</Button>
            {record.status === '上线' && (
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>查看</Button>
            )}
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="link" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: token.colorBgLayout, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="流程管理"
        subTitle="管理编排流程、版本与执行记录"
        extra={[
          <Button
            key="createFromTemplate"
            icon={<FileTextOutlined />}
            onClick={() => message.info('模板库功能开发中')}
          >
            从模板创建
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建流程
          </Button>,
        ]}
      />

      <Card styles={{ body: { padding: 12, flex: 1, display: 'flex', flexDirection: 'column' } }} style={{ flex: 1 }}>
        {/* Search and Filter Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="搜索流程名称或描述"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            mode="multiple"
            placeholder="状态"
            style={{ minWidth: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            allowClear
            maxTagCount={1}
          />
          <Select
            mode="multiple"
            placeholder="科室"
            style={{ minWidth: 120 }}
            value={deptFilter}
            onChange={setDeptFilter}
            options={deptOptions}
            allowClear
            maxTagCount={1}
          />
          <Select
            mode="multiple"
            placeholder="创建人"
            style={{ minWidth: 100 }}
            value={creatorFilter}
            onChange={setCreatorFilter}
            options={creatorOptions}
            allowClear
            maxTagCount={1}
          />
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
              } else {
                setDateRange(null);
              }
            }}
            style={{ width: 240 }}
          />
          <Button icon={<FilterOutlined />} onClick={() => { setSearchText(''); setStatusFilter([]); setDeptFilter([]); setCreatorFilter([]); setDateRange(null); }}>
            重置
          </Button>
        </div>

        {/* Batch Action Toolbar */}
        {selectedRowKeys.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, padding: '8px 12px', background: token.colorPrimaryBg, borderRadius: 4 }}>
            <Space>
              <Text strong style={{ color: token.colorPrimary }}>已选择 {selectedRowKeys.length} 项</Text>
              <Button size="small" icon={<InboxOutlined />} onClick={handleBatchArchive}>批量归档</Button>
              <Button size="small" danger icon={<BatchDeleteOutlined />} onClick={handleBatchDelete}>批量删除</Button>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </Space>
          </div>
        )}

        <ProTable<OrchestrationFlow>
          columns={columns}
          dataSource={filteredFlows}
          rowKey="id"
          size="small"
          search={false}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical">
                    <Text type="secondary">暂无编排流程</Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                      新建第一个编排流程
                    </Button>
                    <Button type="link" onClick={() => message.info('模板库功能开发中')}>浏览模板库</Button>
                  </Space>
                }
              />
            ),
          }}
        />
      </Card>

      {/* Flow Detail Drawer */}
      <Drawer
        title="流程详情"
        placement="right"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        extra={
          <Space>
            <Button icon={<HistoryOutlined />} onClick={(e: any) => selectedFlow && handleViewVersion(selectedFlow, e)}>
              版本管理
            </Button>
            <Button type="primary" icon={<NodeIndexOutlined />} onClick={() => selectedFlow && handleEditFlow(selectedFlow)}>
              编辑流程
            </Button>
          </Space>
        }
      >
        {selectedFlow && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="流程名称" span={2}>
                <Text strong>{selectedFlow.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={flowStatusColors[selectedFlow.status]}>{selectedFlow.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前版本">
                {selectedFlow.version}
              </Descriptions.Item>
              <Descriptions.Item label="节点数">
                {selectedFlow.nodeCount}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {selectedFlow.creator}
              </Descriptions.Item>
              <Descriptions.Item label="运行次数">
                {selectedFlow.runCount.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="今日执行">
                {selectedFlow.todayExecutionCount || 0} 次
              </Descriptions.Item>
              <Descriptions.Item label="成功率">
                {selectedFlow.successRate !== undefined ? `${selectedFlow.successRate}%` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedFlow.createTime}
              </Descriptions.Item>
              <Descriptions.Item label="最后编辑">
                {selectedFlow.updateTime}
              </Descriptions.Item>
              <Descriptions.Item label="最后运行">
                {selectedFlow.lastRunTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="适用科室" span={2}>
                <Space wrap>
                  {selectedFlow.applicableDepts.map((dept) => (
                    <Tag key={dept} color="blue">{dept}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedFlow.description}
              </Descriptions.Item>
            </Descriptions>

            <Card title="节点列表" size="small">
              {selectedFlow.nodes.length > 0 ? (
                <Timeline
                  items={selectedFlow.nodes.map((node) => ({
                    color: node.type === 'start' || node.type === 'end' ? 'gray' : 'blue',
                    children: (
                      <Space>
                        <Text>{node.name}</Text>
                        <Tag>{node.type === 'start' ? '开始' : node.type === 'end' ? '结束' : node.type === 'input' ? '输入' : node.type === 'output' ? '输出' : node.type === 'agent' ? 'Agent' : node.type === 'condition' ? '条件' : node.type}</Tag>
                      </Space>
                    ),
                  }))}
                />
              ) : (
                <Text type="secondary">暂无节点</Text>
              )}
            </Card>

            <Card title="最近执行记录" size="small">
              <Timeline
                items={[
                  {
                    color: 'green',
                    children: (
                      <div>
                        <Text>流程执行成功</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {selectedFlow.lastRunTime}
                        </Text>
                      </div>
                    ),
                  },
                  {
                    color: 'blue',
                    children: (
                      <div>
                        <Text>流程启动</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          运行了 {selectedFlow.runCount.toLocaleString()} 次
                        </Text>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      {/* Version Management Modal */}
      <Modal
        title="版本管理"
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={720}
      >
        {selectedFlow && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              message="版本说明"
              description="每次发布自动生成版本号，支持查看历史版本的画布快照、版本间差异对比，以及一键回滚到指定历史版本。"
              type="info"
              showIcon
            />
            <Card size="small" type="inner" title="版本历史">
              <Table
                size="small"
                dataSource={selectedFlow.versions || []}
                rowKey="version"
                pagination={false}
                columns={[
                  { title: '版本号', dataIndex: 'version', key: 'version', render: (val) => <Tag>{val}</Tag> },
                  { title: '发布时间', dataIndex: 'publishTime', key: 'publishTime' },
                  { title: '变更说明', dataIndex: 'changeNote', key: 'changeNote' },
                  {
                    title: '操作',
                    key: 'action',
                    width: 160,
                    render: (_, record) => (
                      <Space>
                        {record.isCurrent ? (
                          <Tag color="green">当前版本</Tag>
                        ) : (
                          <>
                            <Button type="link" size="small">查看</Button>
                            <Popconfirm title="确认回滚" description="回滚后当前版本将被归档，是否继续？" onConfirm={() => message.success('已回滚到 ' + record.version)}>
                              <Button type="link" size="small" danger icon={<UndoOutlined />}>回滚</Button>
                            </Popconfirm>
                          </>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Modal>

      {/* Execution Records Drawer */}
      <Drawer
        title="执行记录"
        placement="right"
        width={900}
        open={executionDrawerVisible}
        onClose={() => setExecutionDrawerVisible(false)}
      >
        {selectedFlow && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Collapse defaultActiveKey={['filters']}>
              <Panel header="筛选条件" key="filters">
                <Space wrap>
                  <Select placeholder="执行状态" style={{ width: 120 }} allowClear>
                    <Select.Option value="执行中">执行中</Select.Option>
                    <Select.Option value="已完成">已完成</Select.Option>
                    <Select.Option value="已失败">已失败</Select.Option>
                    <Select.Option value="已终止">已终止</Select.Option>
                  </Select>
                  <Input placeholder="触发用户" style={{ width: 120 }} allowClear />
                  <Input placeholder="触发科室" style={{ width: 120 }} allowClear />
                </Space>
              </Panel>
            </Collapse>

            <Table
              dataSource={getFlowExecutions(selectedFlow.id)}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: '实例ID',
                  dataIndex: 'id',
                  key: 'id',
                  render: (val) => <Text code>{val}</Text>,
                },
                { title: '触发用户', dataIndex: 'triggerUser', key: 'triggerUser' },
                { title: '触发科室', dataIndex: 'triggerDept', key: 'triggerDept' },
                { title: '触发时间', dataIndex: 'triggerTime', key: 'triggerTime' },
                { title: '版本', dataIndex: 'flowVersion', key: 'flowVersion', render: (val) => <Tag>{val}</Tag> },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (val) => <Tag color={executionStatusColors[val]}>{val}</Tag>,
                },
                { title: '总耗时', dataIndex: 'duration', key: 'duration' },
              ]}
              expandable={{
                expandedRowRender: (record) => (
                  <Card size="small" title="节点执行详情">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Descriptions size="small" column={4}>
                        <Descriptions.Item label="总节点">{record.totalNodes}</Descriptions.Item>
                        <Descriptions.Item label="成功"><Text type="success">{record.completedNodes}</Text></Descriptions.Item>
                        <Descriptions.Item label="失败"><Text type="danger">{record.failedNodes}</Text></Descriptions.Item>
                        <Descriptions.Item label="跳过">{record.skippedNodes}</Descriptions.Item>
                      </Descriptions>
                      <Timeline
                        items={record.nodes?.map((node) => ({
                          color: nodeStatusColors[node.status] || 'gray',
                          children: (
                            <Space direction="vertical" size={0}>
                              <Text strong>{node.nodeName}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {node.nodeType === 'start' ? '开始节点' : node.nodeType === 'end' ? '结束节点' : node.nodeType === 'input' ? '输入节点' : node.nodeType === 'output' ? '输出节点' : node.nodeType === 'agent' ? 'Agent节点' : node.nodeType === 'condition' ? '条件分支' : node.nodeType}
                                {' | '}
                                {node.status}
                                {node.duration && ` | 耗时: ${node.duration}`}
                              </Text>
                              {node.input && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  输入: {JSON.stringify(node.input)}
                                </Text>
                              )}
                              {node.output && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  输出: {JSON.stringify(node.output)}
                                </Text>
                              )}
                              {node.error && (
                                <Text type="danger" style={{ fontSize: 12 }}>
                                  错误: {node.error}
                                </Text>
                              )}
                            </Space>
                          ),
                        }))}
                      />
                    </Space>
                  </Card>
                ),
              }}
            />
          </Space>
        )}
      </Drawer>

      {/* Create Flow Modal */}
      <Modal
        title="新建流程"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={handleCreate}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="请输入流程名称，≤30字" maxLength={30} showCount />
          </Form.Item>
          <Form.Item
            name="description"
            label="流程描述"
          >
            <Input.TextArea rows={3} placeholder="请输入流程描述（选填）" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="applicableDepts"
            label="适用科室"
            rules={[{ required: true, message: '请选择适用科室' }]}
          >
            <Select mode="multiple" placeholder="请选择适用科室" options={deptOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const nodeStatusColors: Record<string, string> = {
  '已完成': 'green',
  '执行中': 'blue',
  '已跳过': 'gray',
  '已失败': 'red',
  '降级': 'orange',
  '超时': 'red',
};

export default Flows;