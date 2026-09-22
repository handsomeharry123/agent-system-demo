/**
 * 数据字典 - 字典分类列表页
 * 规范：数据字典-需求说明书 V1.0 §1
 *
 * 顶部：关键字搜索 / 新增字典分类（仅非系统内置）/ 导出字典
 * 列表：字典分类名称（文本链接→字典项管理页）/ 编码 / 分类来源 / 启用状态 / 字典项数量 / 最近更新人 / 最近更新时间 / 操作
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Modal,
  Form,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ExportOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { mockDictCategories, type DictCategory } from '../../mock/dict';

const { Text } = Typography;
const { confirm } = Modal;

const CategoryList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isItAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editing, setEditing] = useState<DictCategory | null>(null);

  /** 列表筛选：关键字匹配名称 / 编码 */
  const filtered = useMemo(() => {
    if (!keyword.trim()) return mockDictCategories;
    const k = keyword.toLowerCase();
    return mockDictCategories.filter(
      (c) => c.name.toLowerCase().includes(k) || c.code.toLowerCase().includes(k),
    );
  }, [keyword]);

  /** 鼠标悬浮字典项数量时显示「启用 X / 禁用 Y」明细 */
  const itemCountTip = (c: DictCategory) => `启用 ${c.enabledItemCount} / 禁用 ${c.itemCount - c.enabledItemCount}`;

  const handleToggleEnabled = (c: DictCategory, checked: boolean) => {
    if (c.source === '系统内置' && !checked) {
      message.warning('系统内置分类不支持整体禁用，可对单个字典项启停');
      return;
    }
    message.success(`分类「${c.name}」已${checked ? '启用' : '禁用'}，变更将归档至审计中心`);
  };

  const handleDelete = (c: DictCategory) => {
    if (c.source === '系统内置') {
      message.warning('系统内置分类不可删除');
      return;
    }
    if (c.itemCount > 0) {
      message.warning('该分类下仍有字典项，请先清空后再删除');
      return;
    }
    confirm({
      title: `确认删除字典分类「${c.name}」？`,
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，且本操作将归档至审计中心',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => message.success('删除成功（演示）'),
    });
  };

  const handleEditCategory = (c: DictCategory) => {
    if (c.source === '系统内置') {
      message.info('系统内置分类的名称 / 说明暂不可编辑（演示）');
      return;
    }
    setEditing(c);
    createForm.setFieldsValue({ name: c.name, code: c.code, remark: c.description ?? '' });
    setCreateOpen(true);
  };

  const handleCreateOk = async () => {
    try {
      const values = await createForm.validateFields();
      message.success(`已新增字典分类「${values.name}」（演示），变更将归档至审计中心`);
      setCreateOpen(false);
      createForm.resetFields();
      setEditing(null);
    } catch {
      /* 校验失败，由 Form 自行提示 */
    }
  };

  const handleExport = () => {
    if (!isItAdmin) {
      message.warning('仅信息科管理员可导出字典');
      return;
    }
    message.success('字典导出请求已提交，请稍候下载（含分类与字典项明细）');
  };

  const columns: ColumnsType<DictCategory> = [
    {
      title: '字典分类名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record) => (
        <a onClick={() => navigate(`/app/dict/items/${record.code}`)}>{text}</a>
      ),
    },
    {
      title: '字典编码',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: '分类来源',
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (text: string) =>
        text === '系统内置' ? <Tag color="default">{text}</Tag> : <Tag color="blue">{text}</Tag>,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          disabled={!isItAdmin}
          onChange={(checked) => handleToggleEnabled(record, checked)}
        />
      ),
    },
    {
      title: '字典项数量',
      dataIndex: 'itemCount',
      key: 'itemCount',
      width: 130,
      render: (count: number, record) => (
        <Tooltip title={itemCountTip(record)}>
          <Text>{count}</Text>
        </Tooltip>
      ),
    },
    {
      title: '最近更新人',
      dataIndex: 'updatedBy',
      key: 'updatedBy',
      width: 120,
    },
    {
      title: '最近更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate(`/app/dict/items/${record.code}`)}
          >
            查看字典项
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={!isItAdmin}
            onClick={() => handleEditCategory(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!isItAdmin || record.source === '系统内置' || record.itemCount > 0}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <PageHeader
        title="数据字典"
        subTitle="统一管理各模块下拉字典的来源（仅信息科管理员可配置）"
        breadcrumb={[{ path: '/app/audit', breadcrumbName: '审计中心' }, { path: '', breadcrumbName: '数据字典' }]}
        extra={[
          <Input
            key="search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索字典分类名称 / 编码"
            style={{ width: 280 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />,
          <Button
            key="export"
            icon={<ExportOutlined />}
            disabled={!isItAdmin}
            onClick={handleExport}
          >
            导出字典
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!isItAdmin}
            onClick={() => {
              setEditing(null);
              createForm.resetFields();
              setCreateOpen(true);
            }}
          >
            新增字典分类
          </Button>,
        ]}
      />

      <div style={{ marginTop: 16, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #F0F0F0' }}>
        <Table<DictCategory>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个字典分类` }}
          scroll={{ x: 1100 }}
        />
      </div>

      {/* 新增 / 编辑 字典分类抽屉（演示用 Modal 形式） */}
      <Modal
        title={editing ? `编辑字典分类「${editing.name}」` : '新增字典分类'}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        onOk={handleCreateOk}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="字典分类名称"
            rules={[{ required: true, message: '请输入名称' }, { min: 2, max: 20, message: '长度需 2-20 字' }]}
          >
            <Input placeholder="例如：智能体优先级" />
          </Form.Item>
          <Form.Item
            name="code"
            label="字典编码"
            rules={[
              { required: true, message: '请输入编码' },
              { pattern: /^[A-Z0-9_]{2,32}$/, message: '仅允许大写字母 / 数字 / 下划线，长度 2-32' },
            ]}
            extra="全局唯一，下游模块通过此编码取值"
          >
            <Input placeholder="例如：AGENT_PRIORITY" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="remark" label="说明">
            <Input.TextArea rows={3} maxLength={200} showCount placeholder="用途说明、维护备忘" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryList;
