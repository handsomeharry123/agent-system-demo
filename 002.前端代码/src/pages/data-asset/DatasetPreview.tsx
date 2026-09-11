/**
 * 医疗数据资产中心 - D1.3 数据预览页
 * 规范：§6.1 D1.3 数据预览页（V1.4）
 *
 * 列表 + 侧边对话详情；支持全文搜索 / 筛选 / 排序 / 键盘翻页；
 * 仅查看，不修改。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Input,
  Select,
  Slider,
  Table,
  Tag,
  Typography,
  Button,
  Space,
  Drawer,
  Empty,
  message,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  SearchOutlined,
  UserOutlined,
  RobotOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import ExportDrawer from './ExportDrawer';
import {
  getDatasetById,
  getMockDatasetRecords,
  mockDatasetAgents,
  type DatasetRecord,
} from '../../mock/data-asset';

const { Text } = Typography;

const DatasetPreview = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const dataset = getDatasetById(id);
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [latencyRange, setLatencyRange] = useState<[number, number]>([0, 5000]);
  const [sortBy, setSortBy] = useState<'collectedAt' | 'tokenCount'>('collectedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const records = useMemo<DatasetRecord[]>(
    () => (dataset ? getMockDatasetRecords(dataset.id) : []),
    [dataset],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = records.filter((r) => {
      if (s) {
        const hay = (r.summary + r.turns.map((t) => t.content).join(' ')).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (agentFilter && r.agentName !== agentFilter) return false;
      if (r.latencyMs < latencyRange[0] || r.latencyMs > latencyRange[1]) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const v = sortBy === 'collectedAt'
        ? +new Date(a.collectedAt) - +new Date(b.collectedAt)
        : a.tokenCount - b.tokenCount;
      return sortDir === 'asc' ? v : -v;
    });
    return list;
  }, [records, search, agentFilter, latencyRange, sortBy, sortDir]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // 默认选中第一条
  useEffect(() => {
    if (!selected && filtered.length) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selected]);

  // 键盘上下翻页
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((r) => r.id === selected?.id);
      if (e.key === 'ArrowDown' && idx < filtered.length - 1) {
        setSelectedId(filtered[idx + 1].id);
        e.preventDefault();
      } else if (e.key === 'ArrowUp' && idx > 0) {
        setSelectedId(filtered[idx - 1].id);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selected]);

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

  const columns: ColumnsType<DatasetRecord> = [
    {
      title: '对话摘要',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      render: (s: string) => <Text>{s}</Text>,
    },
    {
      title: '智能体',
      dataIndex: 'agentName',
      key: 'agentName',
      width: 200,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '采集时间',
      dataIndex: 'collectedAt',
      key: 'collectedAt',
      width: 170,
      render: (t: string) => (
        <Text type="secondary">{new Date(t).toLocaleString('zh-CN')}</Text>
      ),
    },
    {
      title: 'Token 数',
      dataIndex: 'tokenCount',
      key: 'tokenCount',
      width: 90,
      render: (v: number) => <Text>{v}</Text>,
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5' }}>
      <PageHeader
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/app/data-asset/datasets/${dataset.id}`)}
              style={{ marginLeft: -8 }}
            />
            数据预览
          </Space>
        }
        subTitle={dataset.name}
        breadcrumb={[
          { path: '/app/data-asset/datasets', breadcrumbName: '医疗数据资产中心' },
          { path: '/app/data-asset/datasets', breadcrumbName: '数据集资产列表' },
          { path: `/app/data-asset/datasets/${dataset.id}`, breadcrumbName: dataset.name },
          { path: '', breadcrumbName: '数据预览' },
        ]}
        extra={[
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (filtered.length === 0) {
                message.warning('当前筛选结果为空，无法发起导出');
                return;
              }
              setExportOpen(true);
            }}
          >
            导出当前筛选结果
          </Button>,
        ]}
      />

      {/* 筛选器栏 */}
      <Card bordered={false} style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <Space wrap size={16} style={{ width: '100%' }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="全文搜索对话内容"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            placeholder="智能体"
            allowClear
            style={{ width: 220 }}
            value={agentFilter}
            onChange={setAgentFilter}
            options={mockDatasetAgents.map((a) => ({ label: a.name, value: a.name }))}
          />
          <Space size={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>响应耗时</Text>
            <Slider
              range
              min={0}
              max={5000}
              step={100}
              value={latencyRange}
              onChange={(v) => setLatencyRange(v as [number, number])}
              style={{ width: 200 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {latencyRange[0]} - {latencyRange[1]} ms
            </Text>
          </Space>
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            options={[
              { label: '按采集时间', value: 'collectedAt' },
              { label: '按 Token 数', value: 'tokenCount' },
            ]}
            style={{ width: 140 }}
          />
          <Select
            value={sortDir}
            onChange={(v) => setSortDir(v)}
            options={[
              { label: '倒序', value: 'desc' },
              { label: '正序', value: 'asc' },
            ]}
            style={{ width: 100 }}
          />
          <div style={{ flex: 1 }} />
          <Text type="secondary">共 {filtered.length} 条记录</Text>
        </Space>
      </Card>

      {/* 列表 + 详情（§3.3 主辅 14:10 = 14:10 等比分割） */}
      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card bordered={false} style={{ height: '100%' }}>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              rowClassName={(record) =>
                record.id === selected?.id ? 'ant-table-row-selected' : ''
              }
              onRow={(record) => ({
                onClick: () => setSelectedId(record.id),
              })}
              style={{ cursor: 'pointer' }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered={false} style={{ height: '100%' }} bodyStyle={{ padding: 16 }}>
            {selected ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Text strong>{selected.id}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      会话 {selected.conversationId}
                    </Text>
                  </Space>
                </div>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Tag icon={<ClockCircleOutlined />}>
                    {new Date(selected.collectedAt).toLocaleString('zh-CN')}
                  </Tag>
                  <Tag icon={<ThunderboltOutlined />} color="orange">
                    响应 {selected.latencyMs} ms
                  </Tag>
                  <Tag color="blue">Token {selected.tokenCount}</Tag>
                  <Tag icon={<ApartmentOutlined />}>{selected.department}</Tag>
                </Space>

                {/* 元数据卡：Token 数 / 响应耗时 / 所属采集任务 / 智能体名称（§6.1 D1.3） */}
                <Card type="inner" size="small" title="元数据" style={{ marginBottom: 16 }}>
                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Token 数</Text>
                      <div>
                        <Text strong>{selected.tokenCount.toLocaleString()}</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>响应耗时</Text>
                      <div>
                        <Text strong>{selected.latencyMs.toLocaleString()} ms</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>所属采集任务</Text>
                      <div>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={() => navigate(`/app/data-asset/collection-tasks/${selected.taskId}/edit`)}
                        >
                          {selected.taskName}
                        </Button>
                      </div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>智能体名称</Text>
                      <div>
                        <Text strong>{selected.agentName}</Text>
                      </div>
                    </Col>
                  </Row>
                </Card>

                <Typography.Title level={5} style={{ marginTop: 8 }}>多轮对话</Typography.Title>
                <div
                  style={{
                    background: '#FAFAFA',
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 480,
                    overflowY: 'auto',
                  }}
                >
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {selected.turns.map((t, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          flexDirection: t.role === 'user' ? 'row-reverse' : 'row',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            background: t.role === 'user' ? '#1677FF' : '#52C41A',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {t.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                        </div>
                        <div
                          style={{
                            background: t.role === 'user' ? '#1677FF' : '#fff',
                            color: t.role === 'user' ? '#fff' : 'inherit',
                            border: t.role === 'user' ? 'none' : '1px solid #f0f0f0',
                            borderRadius: 8,
                            padding: '8px 12px',
                            maxWidth: '85%',
                          }}
                        >
                          <div>{t.content}</div>
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.7,
                              marginTop: 4,
                            }}
                          >
                            {new Date(t.timestamp).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </Space>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                  ↑ / ↓ 可在记录间切换浏览
                </Text>
              </div>
            ) : (
              <Empty description="无选中记录" />
            )}
          </Card>
        </Col>
      </Row>

      <ExportDrawer
        open={exportOpen}
        dataset={dataset}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
};

export default DatasetPreview;
