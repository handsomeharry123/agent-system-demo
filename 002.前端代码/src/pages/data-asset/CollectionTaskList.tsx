/**
 * 医疗数据资产中心 - D2.1 采集任务列表页
 * 规范：§6.2 D2.1 采集任务列表页（V1.4）
 *
 * V1.4 关键变更：
 *   - 取消顶部 4 张统计指标卡片（采集任务数 / 已启用 / 今日采集总量 / 累计采集量）
 *   - 不再提供独立的「采集监控看板」入口与功能；
 *     列表本身已含按任务维度的「今日采集量 / 累计采集量 / 异常数」字段列。
 *     全量趋势与指标看板统一归入远期能力。
 *   - 筛选区默认一行 5 项（任务名称 + 关联智能体 + 所属科室 + 目标数据集 + 采集开关状态）
 *   - 展开行：创建时间范围 + 最近采集时间范围 + 是否含异常（V1.4 文档明确）
 *   - 筛选状态在页面刷新后保留（sessionStorage 持久化）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Switch,
  Modal,
  message,
  Tooltip,
  Flex,
  Input,
  Select,
  DatePicker,
  Table,
  Empty,
  type TablePaginationConfig,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue } from 'antd/es/table/interface';
import {
  PlusOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  WarningOutlined,
  SearchOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import PageHeader from '../../components/PageHeader';
import {
  mockCollectionTasks,
  mockDatasetAgents,
  type CollectionStatus,
  type CollectionTask,
} from '../../mock/data-asset';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const FILTER_STORAGE_KEY = 'data-asset:collection-task-list:filters:v1.4';
const COLLAPSE_STORAGE_KEY = 'data-asset:collection-task-list:collapsed:v1.4';

/** 「是否含异常」筛选三态 */
type WithExceptionFlag = '' | 'with' | 'without';

interface FilterState {
  name: string;
  agentId?: string;
  department?: string;
  datasetName?: string;
  status?: CollectionStatus | '';
  /** 展开行 V1.4：创建时间范围 [起, 止] ISO 字符串 */
  createdRange?: [string, string];
  /** 展开行 V1.4：最近采集时间范围 */
  lastCollectedRange?: [string, string];
  /** 展开行 V1.4：是否含异常 */
  withException?: WithExceptionFlag;
}

const EMPTY_FILTERS: FilterState = { name: '', status: '' };

/** 读取持久化筛选状态 */
const loadFilters = (): FilterState => {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return EMPTY_FILTERS;
    return { ...EMPTY_FILTERS, ...(JSON.parse(raw) as FilterState) };
  } catch {
    return EMPTY_FILTERS;
  }
};
const loadCollapsed = (): boolean => {
  try {
    return sessionStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const toDayjsRange = (r?: [string, string]): [Dayjs, Dayjs] | undefined =>
  r && r[0] && r[1] ? [dayjs(r[0]), dayjs(r[1])] : undefined;
const toIsoRange = (r?: [Dayjs, Dayjs] | null): [string, string] | undefined =>
  r && r[0] && r[1] ? [r[0].toISOString(), r[1].toISOString()] : undefined;

const CollectionTaskList = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CollectionTask[]>(mockCollectionTasks);
  // V1.4：默认收起态由持久化恢复
  const [filterExpanded, setFilterExpanded] = useState<boolean>(loadCollapsed);
  const [filters, setFilters] = useState<FilterState>(loadFilters);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
  });
  const tableRef = useRef<HTMLDivElement>(null);

  // 任意筛选状态变更后写回 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);
  useEffect(() => {
    try {
      sessionStorage.setItem(COLLAPSE_STORAGE_KEY, filterExpanded ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [filterExpanded]);

  const exceptionSum = tasks.reduce((s, t) => s + t.exceptionCount, 0);

  const handleToggle = (record: CollectionTask) => {
    const target = record.status === '已启用' ? '已停用' : '已启用';
    if (target === '已停用') {
      Modal.confirm({
        title: '确认停用采集任务？',
        content: `停用后「${record.name}」将停止采集，已有记录不会被删除。`,
        okButtonProps: { danger: true },
        onOk: () => {
          setTasks((prev) =>
            prev.map((t) => (t.id === record.id ? { ...t, status: target } : t)),
          );
          message.success('采集任务已停用');
        },
      });
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === record.id ? { ...t, status: target } : t)),
    );
    message.success('采集任务已启用');
  };

  const handleCopy = (record: CollectionTask) => {
    const newTask: CollectionTask = {
      ...record,
      id: `task-${Date.now()}`,
      name: `${record.name} (副本)`,
      status: '已停用',
      totalCount: 0,
      todayCount: 0,
      exceptionCount: 0,
      createdAt: new Date().toISOString(),
    };
    setTasks([newTask, ...tasks]);
    message.success('任务已复制，请修改名称后启用');
  };

  const handleDelete = (record: CollectionTask) => {
    Modal.confirm({
      title: '确认删除采集任务？',
      content: `删除「${record.name}」后，已采集的数据集记录不会被删除，仅停止后续采集。`,
      okButtonProps: { danger: true },
      onOk: () => {
        setTasks((prev) => prev.filter((t) => t.id !== record.id));
        message.success('采集任务已删除');
      },
    });
  };

  const agentOptions = useMemo(
    () => [
      { label: '全部智能体', value: '' },
      ...mockDatasetAgents.map((a) => ({ label: a.name, value: a.id })),
    ],
    [],
  );
  const departmentOptions = useMemo(() => {
    const set = new Set(tasks.map((t) => t.department));
    return [
      { label: '全部科室', value: '' },
      ...Array.from(set).map((d) => ({ label: d, value: d })),
    ];
  }, [tasks]);
  const statusOptions = useMemo(
    () => [
      { label: '全部状态', value: '' },
      { label: '已启用', value: '已启用' },
      { label: '已停用', value: '已停用' },
      { label: '采集异常', value: '采集异常' },
    ],
    [],
  );
  const withExceptionOptions = useMemo(
    () => [
      { label: '全部', value: '' },
      { label: '含异常', value: 'with' },
      { label: '无异常', value: 'without' },
    ],
    [],
  );

  const handleQuery = () => {
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.name && !t.name.includes(filters.name.trim())) return false;
      if (filters.agentId && t.agentId !== filters.agentId) return false;
      if (filters.department && t.department !== filters.department) return false;
      if (filters.datasetName && !t.datasetName.includes(filters.datasetName.trim()))
        return false;
      if (filters.status && t.status !== filters.status) return false;
      // V1.4 展开筛选：创建时间范围
      if (filters.createdRange) {
        const [s, e] = filters.createdRange;
        const ts = +new Date(t.createdAt);
        if (s && ts < +new Date(s)) return false;
        if (e && ts > +new Date(e) + 86400000) return false;
      }
      // V1.4 展开筛选：最近采集时间范围（"-" 视为从未采集 → 任何时间段都不命中）
      if (filters.lastCollectedRange) {
        if (t.lastCollectedAt === '-' || !t.lastCollectedAt) return false;
        const [s, e] = filters.lastCollectedRange;
        const tlc = +new Date(t.lastCollectedAt);
        if (s && tlc < +new Date(s)) return false;
        if (e && tlc > +new Date(e) + 86400000) return false;
      }
      // V1.4 展开筛选：是否含异常
      if (filters.withException === 'with' && t.exceptionCount === 0) return false;
      if (filters.withException === 'without' && t.exceptionCount > 0) return false;
      return true;
    });
  }, [tasks, filters]);

  const handleTableChange = (
    pag: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter: any,
  ) => {
    setPagination(pag);
  };

  const columns: ColumnsType<CollectionTask> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      fixed: 'left',
      render: (_, record) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto', textAlign: 'left', whiteSpace: 'normal' }}
          onClick={() => navigate(`/app/data-asset/collection-tasks/${record.id}/edit`)}
        >
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: 14, color: '#1F1F1F' }}>
              {record.name}
            </Text>
            {record.description && (
              <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }} ellipsis>
                {record.description}
              </Text>
            )}
          </Space>
        </Button>
      ),
    },
    {
      title: '关联智能体',
      dataIndex: 'agentName',
      key: 'agentName',
      width: 220,
      render: (v: string) => (
        <Tag
          style={{
            margin: 0,
            background: '#F0F5FF',
            borderColor: '#ADC6FF',
            color: '#1D39C4',
            fontWeight: 500,
          }}
        >
          {v}
        </Tag>
      ),
    },
    {
      title: '所属科室',
      dataIndex: 'department',
      key: 'department',
      width: 110,
      render: (v: string) => <Text style={{ color: '#595959' }}>{v}</Text>,
    },
    {
      title: '目标数据集',
      dataIndex: 'datasetName',
      key: 'datasetName',
      width: 200,
      render: (v: string, record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => navigate(`/app/data-asset/datasets/${record.datasetId}`)}
        >
          {v}
        </Button>
      ),
    },
    {
      title: '采集开关',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: CollectionStatus, record) => {
        const isException = s === '采集异常';
        const isOn = s === '已启用';
        const tagColor = isException ? '#FFF1F0' : isOn ? '#F6FFED' : '#F5F5F5';
        const tagBorder = isException ? '#FFA39E' : isOn ? '#B7EB8F' : '#D9D9D9';
        const tagText = isException ? '#CF1322' : isOn ? '#389E0D' : '#595959';
        return (
          <Space size={6} align="center">
            <Tag
              style={{
                margin: 0,
                background: tagColor,
                borderColor: tagBorder,
                color: tagText,
                fontWeight: 500,
              }}
            >
              {s}
            </Tag>
            <Tooltip
              title={
                isException
                  ? '采集存在异常，处理后可重新启用'
                  : '开关开启即全量入库'
              }
            >
              <Switch
                size="small"
                checked={isOn}
                disabled={isException}
                onChange={() => handleToggle(record)}
                checkedChildren="开"
                unCheckedChildren="关"
              />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: '今日采集量',
      dataIndex: 'todayCount',
      key: 'todayCount',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.todayCount - b.todayCount,
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()} 条</Text>
      ),
    },
    {
      title: '累计采集量',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalCount - b.totalCount,
      render: (v: number) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {v.toLocaleString()} 条
        </Text>
      ),
    },
    {
      title: '最近采集时间',
      dataIndex: 'lastCollectedAt',
      key: 'lastCollectedAt',
      width: 170,
      render: (t: string) =>
        t === '-' ? (
          <Text type="secondary">—</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(t).toLocaleString('zh-CN', { hour12: false })}
          </Text>
        ),
    },
    {
      title: '异常数',
      dataIndex: 'exceptionCount',
      key: 'exceptionCount',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.exceptionCount - b.exceptionCount,
      render: (v: number, record) =>
        v > 0 ? (
          <Button
            type="link"
            danger
            size="small"
            icon={<WarningOutlined />}
            style={{ padding: 0 }}
            onClick={() => navigate(`/app/data-asset/collection-tasks/${record.id}/logs`)}
          >
            {v}
          </Button>
        ) : (
          <Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
            0
          </Text>
        ),
    },
    {
      title: '创建信息',
      key: 'created',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false })}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.createdBy}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} split={<span style={{ color: '#E8E8E8' }}>·</span>}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => navigate(`/app/data-asset/collection-tasks/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileSearchOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => navigate(`/app/data-asset/collection-tasks/${record.id}/logs`)}
          >
            查看日志
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => handleCopy(record)}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100%' }}>
      <PageHeader
        title="采集任务列表"
        subTitle="管理智能体采集任务与采集开关（全量入库，不做采样）"
        breadcrumb={[
          { path: '/app/data-asset/collection-tasks', breadcrumbName: '医疗数据资产中心' },
          { path: '/app/data-asset/collection-tasks', breadcrumbName: '采集任务列表' },
        ]}
        extra={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/app/data-asset/collection-tasks/create')}
          >
            新建采集任务
          </Button>,
        ]}
      />

      {/* V1.4：取消顶部 4 张统计卡片（采集任务数 / 已启用 / 今日采集总量 / 累计采集量）
         不再提供独立的「采集监控看板」入口与功能；
         全量趋势与指标看板统一归入远期能力。 */}

      {/* 筛选条件区 —— 单行 + 展开行；控件高度 32px、间距 8px */}
      <Card
        bordered={false}
        style={{
          marginTop: 16,
          border: '1px solid #F0F0F0',
        }}
        bodyStyle={{ padding: '14px 22px' }}
      >
        {/* 第一行：5 个高频筛选 + 展开按钮 + 重置 / 查询 */}
        <Flex gap={8} align="center" wrap>
          <Input
            placeholder="任务名称关键词"
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            style={{ width: 220, height: 32 }}
            allowClear
            value={filters.name}
            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            placeholder="关联智能体"
            style={{ width: 180 }}
            allowClear
            value={filters.agentId}
            onChange={(v) => setFilters((f) => ({ ...f, agentId: v }))}
            options={agentOptions}
          />
          <Select
            placeholder="所属科室"
            style={{ width: 140 }}
            allowClear
            value={filters.department}
            onChange={(v) => setFilters((f) => ({ ...f, department: v }))}
            options={departmentOptions}
          />
          <Input
            placeholder="目标数据集"
            allowClear
            style={{ width: 160, height: 32 }}
            value={filters.datasetName ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, datasetName: e.target.value }))}
          />
          <Select
            placeholder="采集开关"
            style={{ width: 130 }}
            allowClear
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v as CollectionStatus | '' }))}
            options={statusOptions}
          />
          <Button
            type="link"
            size="small"
            onClick={() => setFilterExpanded((v) => !v)}
            icon={filterExpanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
            style={{ height: 32, padding: '0 8px' }}
          >
            {filterExpanded ? '收起' : '展开'}
          </Button>
          <Button onClick={handleReset} style={{ height: 32 }}>
            重置
          </Button>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleQuery}
            style={{ height: 32 }}
          >
            查询
          </Button>
        </Flex>

        {/* 展开行：V1.4 文档要求 —— 创建时间范围 / 最近采集时间范围 / 是否含异常 */}
        {filterExpanded && (
          <Flex gap={8} align="center" wrap style={{ marginTop: 10 }}>
            <Space size={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
              <RangePicker
                allowClear
                style={{ width: 240, height: 32 }}
                value={toDayjsRange(filters.createdRange)}
                onChange={(r) =>
                  setFilters((f) => ({
                    ...f,
                    createdRange: toIsoRange(r as [Dayjs, Dayjs] | null),
                  }))
                }
              />
            </Space>
            <Space size={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>最近采集</Text>
              <RangePicker
                allowClear
                style={{ width: 240, height: 32 }}
                value={toDayjsRange(filters.lastCollectedRange)}
                onChange={(r) =>
                  setFilters((f) => ({
                    ...f,
                    lastCollectedRange: toIsoRange(r as [Dayjs, Dayjs] | null),
                  }))
                }
              />
            </Space>
            <Space size={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>是否含异常</Text>
              <Select
                style={{ width: 130, height: 32 }}
                value={filters.withException ?? ''}
                onChange={(v) =>
                  setFilters((f) => ({ ...f, withException: (v || '') as WithExceptionFlag }))
                }
                options={withExceptionOptions}
              />
            </Space>
          </Flex>
        )}
      </Card>

      {/* 表格区 */}
      <Card
        bordered={false}
        style={{
          marginTop: 16,
          border: '1px solid #F0F0F0',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid #F0F0F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAFBFC',
          }}
        >
          <Space size={12} align="center">
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: 14,
                background: '#1677FF',
                borderRadius: 2,
              }}
            />
            <Text strong style={{ fontSize: 15 }}>
              采集任务列表
            </Text>
            <Tag style={{ background: '#F0F5FF', borderColor: '#ADC6FF', color: '#1D39C4' }}>
              共 {filteredTasks.length} 条
            </Tag>
            {exceptionSum > 0 && (
              <Tag
                style={{
                  background: '#FFF1F0',
                  borderColor: '#FFA39E',
                  color: '#CF1322',
                  fontWeight: 500,
                }}
              >
                <WarningOutlined /> 异常 {exceptionSum}
              </Tag>
            )}
          </Space>
        </div>
        <div ref={tableRef}>
          <Table<CollectionTask>
            rowKey="id"
            columns={columns}
            dataSource={filteredTasks}
            scroll={{ x: 1800 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `共 ${total} 个采集任务`,
              style: { padding: '12px 22px' },
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: <Empty description="暂无采集任务" />,
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default CollectionTaskList;
