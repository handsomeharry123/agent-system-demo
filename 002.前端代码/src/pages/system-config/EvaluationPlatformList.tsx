import { useMemo, useState } from 'react';
import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ExperimentOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { EvalPlatform, evaluationCreatePath, loadPlatforms, savePlatforms } from './evaluationPlatforms';

const { Text } = Typography;

export default function EvaluationPlatformList() {
  const nav = useNavigate();
  const [rows, setRows] = useState(loadPlatforms);
  const [q, setQ] = useState('');
  const [enabled, setEnabled] = useState<string>();
  const [tab, setTab] = useState('all');

  const update = (next: EvalPlatform[]) => {
    setRows(next);
    savePlatforms(next);
  };

  const data = useMemo(
    () =>
      rows.filter(
        (row) =>
          (tab === 'draft' ? row.draft : !row.draft) &&
          (!q || `${row.name}${row.description}${row.provider}`.toLowerCase().includes(q.toLowerCase())) &&
          (!enabled || String(row.enabled) === enabled),
      ),
    [rows, q, enabled, tab],
  );

  const remove = (row: EvalPlatform) => {
    if (row.preset) {
      message.warning('预置评测平台不可删除');
      return;
    }
    Modal.confirm({
      title: '确认是否删除？',
      content: `删除后将无法恢复「${row.name}」的配置。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => update(rows.filter((item) => item.id !== row.id)),
    });
  };

  const test = (row: EvalPlatform) => {
    message.loading({ content: '正在验证部署服务与鉴权信息…', key: 'connect', duration: 0.7 });
    setTimeout(() => {
      update(rows.map((item) => (item.id === row.id ? { ...item, connected: 'success' } : item)));
      Modal.success({ title: '测试验证正常', content: `${row.name} 联通成功，评测服务响应正常。` });
    }, 750);
  };

  const columns: ColumnsType<EvalPlatform> = [
    {
      title: '平台名称',
      dataIndex: 'name',
      width: 190,
      fixed: 'left',
      render: (value, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, whiteSpace: 'nowrap' }}>
          <Button
            type="link"
            title={value}
            style={{ height: 'auto', minWidth: 0, padding: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={() => nav(`/app/system-config/evaluation-platforms/${row.id}`)}
          >
            {value}
          </Button>
          {row.preset && <Tag color="blue" style={{ flex: '0 0 auto', margin: 0 }}>预置</Tag>}
        </div>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      width: 125,
      align: 'center',
      render: (value, row) => (
        <Space size={8} wrap={false}>
          <Switch
            size="small"
            checked={value}
            onChange={(checked) => {
              update(rows.map((item) => (item.id === row.id ? { ...item, enabled: checked } : item)));
              message.success(`${row.name} 已${checked ? '启用' : '停用'}`);
            }}
          />
          <Text type={value ? undefined : 'secondary'} style={{ whiteSpace: 'nowrap' }}>
            {value ? '已启用' : '已停用'}
          </Text>
        </Space>
      ),
    },
    { title: '平台简介', dataIndex: 'description', width: 220, ellipsis: { showTitle: true } },
    { title: '提供方', dataIndex: 'provider', width: 150, ellipsis: { showTitle: true } },
    {
      title: '联通状态',
      dataIndex: 'connected',
      width: 100,
      align: 'center',
      render: (value) => (
        <Tag color={value === 'success' ? 'success' : value === 'failed' ? 'error' : 'default'} style={{ margin: 0 }}>
          {value === 'success' ? '联通成功' : value === 'failed' ? '联通失败' : '未测试'}
        </Tag>
      ),
    },
  ];

  if (tab === 'draft') {
    columns.push(
      { title: '最后编辑时间', dataIndex: 'updatedAt', width: 165 },
      {
        title: '操作',
        width: 130,
        fixed: 'right',
        render: (_, row) => (
          <Space size={4} wrap={false}>
            <Button type="link" style={{ paddingInline: 4 }} onClick={() => nav(`/app/system-config/evaluation-platforms/${row.id}/edit`)}>编辑</Button>
            <Button danger type="link" disabled={row.preset} style={{ paddingInline: 4 }} onClick={() => remove(row)}>删除</Button>
          </Space>
        ),
      },
    );
  } else {
    columns.push({
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, row) => (
        <Space size={0} wrap={false} style={{ width: '100%', whiteSpace: 'nowrap' }}>
          <Button type="link" style={{ paddingInline: 6 }} icon={<EyeOutlined />} onClick={() => nav(`/app/system-config/evaluation-platforms/${row.id}`)}>详情</Button>
          <Tooltip title={row.connected === 'success' ? '' : '请先完成联通测试'}>
            <span><Button type="link" style={{ paddingInline: 6 }} icon={<ExperimentOutlined />} disabled={row.connected !== 'success'} onClick={() => nav(evaluationCreatePath(row.id))}>去评测</Button></span>
          </Tooltip>
          <Dropdown trigger={['click']} menu={{ items: [
            { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => nav(`/app/system-config/evaluation-platforms/${row.id}/edit`) },
            { key: 'test', label: '联通测试', icon: <ApiOutlined />, onClick: () => test(row) },
            { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, disabled: Boolean(row.preset), onClick: () => remove(row) },
          ] }}>
            <Button type="link" style={{ paddingInline: 6 }} icon={<MoreOutlined />}>更多</Button>
          </Dropdown>
        </Space>
      ),
    });
  }

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
      <PageHeader
        title="第三方评测平台接入"
        subTitle="统一配置、验证并管理第三方评测平台"
        breadcrumb={[{ path: '', breadcrumbName: '系统配置' }, { path: '', breadcrumbName: '第三方评测平台接入' }]}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/app/system-config/evaluation-platforms/create')}>新增评测平台</Button>}
      />
      <div style={{ marginTop: 16, padding: '4px 20px 20px', background: '#fff', borderRadius: 8 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: `评测平台管理 (${rows.filter((row) => !row.draft).length})` },
            { key: 'draft', label: `草稿 (${rows.filter((row) => row.draft).length})` },
          ]}
        />
        <Space wrap style={{ marginBottom: 16 }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索平台名称 / 简介 / 提供方" value={q} onChange={(event) => setQ(event.target.value)} style={{ width: 300 }} />
          <Select allowClear placeholder="启用状态" value={enabled} onChange={setEnabled} style={{ width: 130 }} options={[{ value: 'true', label: '启用' }, { value: 'false', label: '停用' }]} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          tableLayout="fixed"
          scroll={{ x: tab === 'draft' ? 1045 : 1010 }}
          onRow={() => ({ style: { height: 64 } })}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 个平台` }}
        />
      </div>
    </div>
  );
}
