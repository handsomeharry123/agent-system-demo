/**
 * 医疗数据资产中心 - D1.1 数据集列表页
 * 规范：§6.1 D1.1 数据集列表页（V1.4）
 *
 * V1.4 关键变更：
 *   - 取消顶部 4 张统计指标卡片（数据集数量 / 记录总数 / 今日新增 / 近 7 日新增）
 *   - 列表 10 列：名称 / 描述 / 所属智能体 / 所属科室 / 记录总数 / 今日新增 / Schema 版本 / 创建时间 / 更新时间 / 操作
 *   - 筛选区默认只展示一行：
 *       名称/描述搜索框 + 所属智能体 + 所属科室 + 记录总数 + 今日新增 + 重置/查询
 *     展开后追加：创建时间范围 / 更新时间范围 / Schema 版本
 *   - 筛选状态在页面刷新后保留（sessionStorage 持久化）
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Tag,
  Typography,
  Button,
  Space,
  Tooltip,
  Input,
  Select,
  DatePicker,
  Table,
  Empty,
  Flex,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  DownloadOutlined,
  ProfileOutlined,
  SearchOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  CaretDownOutlined,
  CaretUpOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import PageHeader from '../../components/PageHeader';
import ExportDrawer from './ExportDrawer';
import { mockDatasets, mockDatasetAgents, type Dataset } from '../../mock/data-asset';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const FILTER_STORAGE_KEY = 'data-asset:dataset-list:filters:v1.4';
const COLLAPSE_STORAGE_KEY = 'data-asset:dataset-list:collapsed:v1.4';

interface FilterState {
  /** 名称 / 描述 关键词（两字段任一命中即可） */
  keyword: string;
  agentId?: string;
  department?: string;
  recordTotal?: string;
  todayNew?: string;
  /** 创建时间范围 [起始, 结束] ISO 字符串 */
  createdRange?: [string, string];
  /** 更新时间范围 */
  updatedRange?: [string, string];
  schemaVersion?: string;
}

const EMPTY_FILTERS: FilterState = { keyword: '' };

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

/** V1.4 文档：默认只展示一行 5 项；展开后追加创建/更新时间/Schema 版本 */
const loadExpanded = (): boolean => {
  try {
    return sessionStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/** ISO 字符串范围 ↔ dayjs 范围（与 D2.1 采集任务列表保持一致） */
const toDayjsRange = (r?: [string, string]): [Dayjs, Dayjs] | undefined =>
  r && r[0] && r[1] ? [dayjs(r[0]), dayjs(r[1])] : undefined;
const toIsoRange = (r?: [Dayjs, Dayjs] | null): [string, string] | undefined =>
  r && r[0] && r[1] ? [r[0].toISOString(), r[1].toISOString()] : undefined;

const DatasetList = () => {
  const navigate = useNavigate();
  const [datasets] = useState<Dataset[]>(mockDatasets);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportContext, setExportContext] = useState<Dataset | null>(null);
  const [globalExportOpen, setGlobalExportOpen] = useState(false);
  // V1.4：默认收起态 = false（即默认只展示一行 5 项）
  const [filterExpanded, setFilterExpanded] = useState<boolean>(loadExpanded);
  const [filters, setFilters] = useState<FilterState>(loadFilters);

  // 任意持久化字段变更后写回 sessionStorage
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

  const agentOptions = useMemo(
    () => [
      { label: '全部智能体', value: '' },
      ...mockDatasetAgents.map((a) => ({ label: a.name, value: a.id })),
    ],
    [],
  );
  const departmentOptions = useMemo(() => {
    const set = new Set(mockDatasets.map((d) => d.department));
    return [
      { label: '全部科室', value: '' },
      ...Array.from(set).map((d) => ({ label: d, value: d })),
    ];
  }, []);
  // Schema 版本候选
  const schemaVersionOptions = useMemo(() => {
    const set = new Set(mockDatasets.map((d) => d.schema.version));
    return Array.from(set).map((v) => ({ label: v, value: v }));
  }, []);

  const openExport = (ds: Dataset) => {
    setExportContext(ds);
    setExportOpen(true);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  /** 任意筛选变更 → 立即落到 state（与 D2.1 行为一致，「查询」按钮仅触发列表重置到第 1 页） */
  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      // 关键词同时在「名称 / 描述」上模糊匹配
      if (filters.keyword) {
        const k = filters.keyword;
        const hit = d.name.includes(k) || (d.description || '').includes(k);
        if (!hit) return false;
      }
      if (filters.agentId && d.agentId !== filters.agentId) return false;
      if (filters.department && d.department !== filters.department) return false;
      if (filters.recordTotal && String(d.recordTotal) !== filters.recordTotal) return false;
      if (filters.todayNew && String(d.todayNew) !== filters.todayNew) return false;
      if (filters.schemaVersion && d.schema.version !== filters.schemaVersion) return false;
      if (filters.createdRange) {
        const [s, e] = filters.createdRange;
        const t = +new Date(d.createdAt);
        if (s && t < +new Date(s)) return false;
        if (e && t > +new Date(e) + 86400000) return false;
      }
      if (filters.updatedRange) {
        const [s, e] = filters.updatedRange;
        const t = +new Date(d.updatedAt);
        if (s && t < +new Date(s)) return false;
        if (e && t > +new Date(e) + 86400000) return false;
      }
      return true;
    });
  }, [datasets, filters]);

  const columns: ColumnsType<Dataset> = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      fixed: 'left',
      render: (_, record) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto', textAlign: 'left', whiteSpace: 'normal' }}
          onClick={() => navigate(`/app/data-asset/datasets/${record.id}`)}
        >
          <Text strong style={{ fontSize: 14, color: '#1F1F1F' }}>
            {record.name}
          </Text>
        </Button>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 240,
      ellipsis: { showTitle: false },
      render: (d: string) => (
        <Tooltip title={d} placement="topLeft">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {d || '—'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '所属智能体',
      dataIndex: 'agentName',
      key: 'agentName',
      width: 200,
      ellipsis: true,
      render: (text: string) => <Text style={{ color: '#595959' }}>{text}</Text>,
    },
    {
      title: '所属科室',
      dataIndex: 'department',
      key: 'department',
      width: 110,
      render: (text: string) => (
        <Tag
          style={{
            margin: 0,
            background: '#F0F5FF',
            borderColor: '#ADC6FF',
            color: '#1D39C4',
            fontWeight: 500,
          }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: '记录总数',
      dataIndex: 'recordTotal',
      key: 'recordTotal',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.recordTotal - b.recordTotal,
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</Text>
      ),
    },
    {
      title: '今日新增',
      dataIndex: 'todayNew',
      key: 'todayNew',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.todayNew - b.todayNew,
      render: (v: number) => (
        <Text strong style={{ color: '#389E0D', fontVariantNumeric: 'tabular-nums' }}>
          +{v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Schema 版本',
      dataIndex: ['schema', 'version'],
      key: 'schemaVersion',
      width: 110,
      render: (_, r) => (
        <Tag
          style={{
            margin: 0,
            background: '#F9F0FF',
            borderColor: '#D3ADF7',
            color: '#531DAB',
            fontFamily: 'SFMono-Regular, Consolas, Menlo, monospace',
            fontWeight: 500,
          }}
        >
          {r.schema.version}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      render: (t: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(t).toLocaleString('zh-CN', { hour12: false })}
        </Text>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      sorter: (a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt),
      defaultSortOrder: 'descend',
      render: (t: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(t).toLocaleString('zh-CN', { hour12: false })}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} split={<span style={{ color: '#E8E8E8' }}>·</span>}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => navigate(`/app/data-asset/datasets/${record.id}/preview`)}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => openExport(record)}
          >
            导出
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ProfileOutlined />}
            style={{ padding: '0 8px' }}
            onClick={() => navigate(`/app/data-asset/datasets/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100%' }}>
      <PageHeader
        title="数据集资产列表"
        subTitle="统一浏览全部已采集的数据集，并发起 JSON 导出"
        breadcrumb={[
          { path: '/app/data-asset/datasets', breadcrumbName: '医疗数据资产中心' },
          { path: '/app/data-asset/datasets', breadcrumbName: '数据集资产列表' },
        ]}
        extra={[
          <Tooltip key="global-export" title="查看全部数据集的导出任务与下载记录">
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setGlobalExportOpen(true)}
            >
              导出任务与下载记录
            </Button>
          </Tooltip>,
          <Button
            key="goto-task"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate('/app/data-asset/collection-tasks')}
          >
            采集任务列表
          </Button>,
        ]}
      />

      {/* V1.4：取消顶部 4 张统计卡片（数据集数量 / 记录总数 / 今日新增 / 近 7 日新增） */}

      {/* 筛选条件区 —— 默认一行 5 项，展开后追加 3 项；筛选状态持久化到 sessionStorage
           结构与 D2.1 采集任务列表一致：受控组件 + Flex，避免 Form/Form.Item 引入的多余内边距 */}
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
            placeholder="名称 / 描述 关键词"
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            style={{ width: 220, height: 32 }}
            allowClear
            value={filters.keyword}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
          />
          <Select
            placeholder="所属智能体"
            allowClear
            style={{ width: 180, height: 32 }}
            value={filters.agentId}
            onChange={(v) => handleFilterChange('agentId', v)}
            options={agentOptions}
          />
          <Select
            placeholder="所属科室"
            allowClear
            style={{ width: 140, height: 32 }}
            value={filters.department}
            onChange={(v) => handleFilterChange('department', v)}
            options={departmentOptions}
          />
          <Input
            placeholder="记录总数"
            allowClear
            style={{ width: 130, height: 32 }}
            value={filters.recordTotal ?? ''}
            onChange={(e) => handleFilterChange('recordTotal', e.target.value || undefined)}
          />
          <Input
            placeholder="今日新增"
            allowClear
            style={{ width: 120, height: 32 }}
            value={filters.todayNew ?? ''}
            onChange={(e) => handleFilterChange('todayNew', e.target.value || undefined)}
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
            onClick={() => {
              /* 受控组件：变更即过滤；此按钮仅做视觉对齐 */
            }}
            style={{ height: 32 }}
          >
            查询
          </Button>
        </Flex>

        {/* 展开行：V1.4 文档要求 —— 创建时间范围 / 更新时间范围 / Schema 版本 */}
        {filterExpanded && (
          <Flex gap={8} align="center" wrap style={{ marginTop: 10 }}>
            <Space size={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
              <RangePicker
                allowClear
                placeholder={['开始日期', '结束日期']}
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
              <Text type="secondary" style={{ fontSize: 12 }}>更新时间</Text>
              <RangePicker
                allowClear
                placeholder={['开始日期', '结束日期']}
                style={{ width: 240, height: 32 }}
                value={toDayjsRange(filters.updatedRange)}
                onChange={(r) =>
                  setFilters((f) => ({
                    ...f,
                    updatedRange: toIsoRange(r as [Dayjs, Dayjs] | null),
                  }))
                }
              />
            </Space>
            <Space size={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>Schema 版本</Text>
              <Select
                allowClear
                placeholder="全部版本"
                style={{ width: 160, height: 32 }}
                value={filters.schemaVersion}
                onChange={(v) => handleFilterChange('schemaVersion', v)}
                options={schemaVersionOptions}
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
              数据集资产列表
            </Text>
            <Tag style={{ background: '#F0F5FF', borderColor: '#ADC6FF', color: '#1D39C4' }}>
              共 {filteredDatasets.length} 条
            </Tag>
          </Space>
        </div>
        <Table<Dataset>
          rowKey="id"
          columns={columns}
          dataSource={filteredDatasets}
          scroll={{ x: 1680 }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 个数据集`,
            style: { padding: '12px 22px' },
          }}
          locale={{
            emptyText: <Empty description="暂无数据集" />,
          }}
          onRow={(record) => ({
            onClick: (e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.ant-btn') || target.closest('.ant-tag')) return;
              navigate(`/app/data-asset/datasets/${record.id}`);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* 行内导出抽屉（绑定到当前数据集） */}
      <ExportDrawer
        open={exportOpen}
        dataset={exportContext}
        onClose={() => setExportOpen(false)}
      />

      {/* 全局导出任务与下载记录抽屉 */}
      <ExportDrawer
        open={globalExportOpen}
        dataset={null}
        onClose={() => setGlobalExportOpen(false)}
      />
    </div>
  );
};

export default DatasetList;
