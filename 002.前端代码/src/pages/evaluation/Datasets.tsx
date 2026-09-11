// =============================================================================
// 数据集管理页（V1.6 §二 · 2.1）
//   · 列表字段：数据集名称 / 适用评测维度 / 数据集版本 / 数据集描述 /
//                题集数量 / 创建时间 / 更新时间 / 数据集大小 / 使用状态
//   · 适用评测维度：可点击跳指标详情页（V1.6 §一 · 1.1）
//   · 列表默认按更新时间倒序
//   · 操作：编辑 / 删除 / 查看详情 / 上传数据集
// =============================================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Select,
  Tag,
  Table,
  Switch,
  Space,
  Modal,
  message,
  Tooltip,
  Typography,
  Dropdown,
} from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  EditOutlined,
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
} from '../../mock/evaluation';
import { useAuth } from '../../hooks/useAuth';

const { Text } = Typography;

const Datasets = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('信息科管理员') ?? false;

  const [datasets, setDatasets] = useState<EvaluationDataset[]>(
    [...mockDatasets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
  const [keyword, setKeyword] = useState('');
  const [dimFilter, setDimFilter] = useState<EvalDimension[]>([]);

  // ---------------------------------------------------------------------------
  // 筛选
  // ---------------------------------------------------------------------------
  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      if (keyword && !d.name.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (dimFilter.length > 0 && !d.dimensions.some((x) => dimFilter.includes(x))) return false;
      return true;
    });
  }, [datasets, keyword, dimFilter]);

  // ---------------------------------------------------------------------------
  // 使用状态切换
  // ---------------------------------------------------------------------------
  const handleToggleStatus = (record: EvaluationDataset, next: boolean) => {
    if (!next) {
      Modal.confirm({
        title: '确认禁用该数据集？',
        icon: <ExclamationCircleOutlined style={{ color: '#FAAD14' }} />,
        content: `禁用后「${record.name}」无法被评测任务选择，但不影响已关联的评测任务。`,
        okText: '确认禁用',
        cancelText: '取消',
        onOk: () => {
          setDatasets((prev) => prev.map((d) => (d.id === record.id ? { ...d, status: '禁用' } : d)));
          message.success('已禁用');
        },
      });
    } else {
      setDatasets((prev) => prev.map((d) => (d.id === record.id ? { ...d, status: '启用' } : d)));
      message.success('已启用');
    }
  };

  // ---------------------------------------------------------------------------
  // 删除
  // ---------------------------------------------------------------------------
  const handleDelete = (record: EvaluationDataset) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />,
      content: `确认删除数据集「${record.name}」？删除后无法恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setDatasets((prev) => prev.filter((d) => d.id !== record.id));
        message.success('已删除');
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 列定义
  // ---------------------------------------------------------------------------
  const columns: ColumnsType<EvaluationDataset> = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => navigate(`/app/evaluation/datasets/${record.id}`)}>
          {text}
        </a>
      ),
    },
    {
      title: '适用评测维度',
      dataIndex: 'dimensions',
      key: 'dimensions',
      width: 160,
      render: (dims: EvalDimension[]) => (
        <Space wrap size={4}>
          {dims.map((d) => (
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
      ),
    },
    {
      title: '数据集版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: '数据集描述',
      dataIndex: 'description',
      key: 'description',
      width: 280,
      ellipsis: { showTitle: true },
    },
    {
      title: '题集数量',
      dataIndex: 'questionCount',
      key: 'questionCount',
      width: 140,
      render: (v) => v.toLocaleString(),
      sorter: (a, b) => a.questionCount - b.questionCount,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      render: (v: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>{v}</span>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 190,
      sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
      defaultSortOrder: 'descend',
      render: (v: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>{v}</span>
      ),
    },
    {
      title: '数据集大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
    },
    {
      title: '使用状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Switch
          checked={record.status === '启用'}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={(checked) => handleToggleStatus(record, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        const moreItems = [
          {
            key: 'edit',
            label: (
              <Space size={6}>
                <EditOutlined />
                <span>编辑</span>
              </Space>
            ),
            onClick: () => navigate(`/app/evaluation/datasets/${record.id}?mode=edit`),
          },
          ...(isAdmin
            ? [
                {
                  key: 'delete',
                  label: (
                    <Space size={6} style={{ color: '#FF4D4F' }}>
                      <DeleteOutlined />
                      <span>删除</span>
                    </Space>
                  ),
                  onClick: () => handleDelete(record),
                },
              ]
            : []),
        ];
        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/app/evaluation/datasets/${record.id}`)}
            >
              查看详情
            </Button>
            <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
              <Button type="link" size="small" icon={<MoreOutlined />}>
                更多
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <PageHeader
        title="数据集管理"
        subTitle="管理评测数据集的导入、维护与启用状态"
        extra={[
          isAdmin ? (
            <Button
              key="upload"
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => navigate('/app/evaluation/datasets/import')}
            >
              上传数据集
            </Button>
          ) : null,
        ]}
      />

      <Card style={{ marginTop: 16 }}>
        <Space wrap size={8} style={{ marginBottom: 12 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索数据集名称"
            style={{ width: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="适用评测维度"
            style={{ minWidth: 240 }}
            value={dimFilter}
            onChange={(v) => setDimFilter(v as EvalDimension[])}
            options={ALL_DIMENSIONS.map((d) => ({ label: d, value: d }))}
          />
          <Button
            onClick={() => {
              setKeyword('');
              setDimFilter([]);
            }}
          >
            重置
          </Button>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
            共 {filteredDatasets.length} 条
          </Text>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredDatasets}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1780 }}
        />
      </Card>
    </div>
  );
};

export default Datasets;
