/**
 * 数据字典 - 字典项管理页
 * 规范：数据字典-需求说明书 V1.0 §2
 *
 * 顶部：面包屑「数据字典 / {分类名称}」 + 分类基本信息
 * 中部：字典项列表（拖拽排序 / 启停 / 默认切换 / 新增 / 批量导入）
 * 右侧抽屉：新增 / 编辑字典项表单
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { findCategoryByCode, type DictItem } from '../../mock/dict';

const { Text, Paragraph } = Typography;
const { confirm } = Modal;

const ItemList = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isItAdmin = currentUser?.roles.includes('信息科管理员') ?? false;
  const category = useMemo(() => findCategoryByCode(code), [code]);

  const [items, setItems] = useState<DictItem[]>(category?.items ?? []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DictItem | null>(null);
  const [form] = Form.useForm();
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setItems(category?.items ?? []);
  }, [category]);

  if (!category) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          title="字典项管理"
          showBack
          onBack={() => navigate('/app/dict')}
        />
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          message={`未找到编码为「${code}」的字典分类`}
          description="该分类可能已被删除或禁用，请返回字典分类列表确认。"
        />
      </div>
    );
  }

  /** 切换默认项：自动取消原默认项（同一分类至多一个） */
  const handleToggleDefault = (item: DictItem) => {
    if (item.isSystemReserved && item.code === 'OTHER') {
      message.warning('「其他（需要自定义填空）」不可设为默认项');
      return;
    }
    if (!isItAdmin) {
      message.warning('仅信息科管理员可配置');
      return;
    }
    setItems((prev) => {
      const next = prev.map((it) => ({ ...it, isDefault: it.id === item.id ? !it.isDefault : false }));
      message.success(`已将「${item.name}」设为默认项（演示），变更将归档至审计中心`);
      return next;
    });
  };

  /** 切换启用：系统保留项不可禁用 */
  const handleToggleEnabled = (item: DictItem, checked: boolean) => {
    if (item.isSystemReserved) {
      message.warning('系统保留项不允许禁用');
      return;
    }
    if (!isItAdmin) {
      message.warning('仅信息科管理员可配置');
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, enabled: checked } : it)));
    message.success(`已${checked ? '启用' : '禁用'}「${item.name}」（演示）`);
  };

  const handleDelete = (item: DictItem) => {
    if (item.isSystemReserved) {
      message.warning('系统保留项不可删除');
      return;
    }
    if (!isItAdmin) {
      message.warning('仅信息科管理员可配置');
      return;
    }
    confirm({
      title: `确认删除字典项「${item.name}」？`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Paragraph>
            系统将自动校验下游引用，若存在引用则禁止删除并提示「该字典项已被 X 条记录引用」。
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            建议优先「禁用」而非删除，以保留历史数据回显。
          </Paragraph>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        message.success('删除成功（演示）');
      },
    });
  };

  const handleEdit = (item: DictItem) => {
    if (!isItAdmin) {
      message.warning('仅信息科管理员可配置');
      return;
    }
    setEditing(item);
    form.setFieldsValue({
      name: item.name,
      code: item.code,
      sort: item.sort,
      isDefault: item.isDefault,
      enabled: item.enabled,
      remark: item.remark ?? '',
    });
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    if (!isItAdmin) {
      message.warning('仅信息科管理员可配置');
      return;
    }
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sort: items.length + 1, enabled: true, isDefault: false });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === editing.id
              ? { ...it, ...values, updatedBy: currentUser?.name ?? '当前用户', updatedAt: new Date().toLocaleString('zh-CN') }
              : it,
          ),
        );
        message.success('编辑成功（演示）');
      } else {
        const newItem: DictItem = {
          id: `new-${Date.now()}`,
          ...values,
          isSystemReserved: false,
          updatedBy: currentUser?.name ?? '当前用户',
          updatedAt: new Date().toLocaleString('zh-CN'),
        };
        // 切换默认项时清掉其他默认
        const next = values.isDefault ? items.map((it) => ({ ...it, isDefault: false })) : items;
        setItems([...next, newItem]);
        message.success('新增成功（演示）');
      }
      setDrawerOpen(false);
    } catch {
      /* 校验失败，Form 内部提示 */
    }
  };

  /** 拖拽排序：演示用，本地直接交换排序 */
  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((it, i) => ({ ...it, sort: i + 1 }));
    });
    message.success('排序已更新（演示）');
  };
  const handleMoveDown = (idx: number) => {
    setItems((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((it, i) => ({ ...it, sort: i + 1 }));
    });
    message.success('排序已更新（演示）');
  };

  const handleBatchImport = () => {
    message.success('已下载 Excel 模板（演示）。上传时按编码唯一性、必填项与格式预校验');
  };

  const columns: ColumnsType<DictItem> = [
    {
      title: '排序',
      key: 'sort',
      width: 110,
      render: (_, __, idx) => (
        <Space size={4}>
          <HolderOutlined style={{ color: '#bfbfbf', cursor: isItAdmin ? 'grab' : 'not-allowed' }} />
          <Text type="secondary">{idx + 1}</Text>
          <Space direction="vertical" size={0} style={{ lineHeight: 1 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 16 }}
              disabled={!isItAdmin || idx === 0}
              onClick={() => handleMoveUp(idx)}
            >
              ↑
            </Button>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 16 }}
              disabled={!isItAdmin || idx === items.length - 1}
              onClick={() => handleMoveDown(idx)}
            >
              ↓
            </Button>
          </Space>
        </Space>
      ),
    },
    { title: '字典项名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: '字典项编码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: '是否默认',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 100,
      render: (v: boolean, record) => {
        const isOther = record.isSystemReserved && record.code === 'OTHER';
        return (
          <Tooltip title={isOther ? '「其他（需自定义填空）」不可设为默认' : ''}>
            <Switch
              checked={v}
              disabled={!isItAdmin || isOther}
              onChange={() => handleToggleDefault(record)}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '是否系统保留',
      dataIndex: 'isSystemReserved',
      key: 'isSystemReserved',
      width: 120,
      render: (v: boolean) =>
        v ? <Tag color="default">系统保留</Tag> : <Tag color="blue">可配置</Tag>,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (v: boolean, record) => (
        <Switch
          checked={v}
          disabled={!isItAdmin || record.isSystemReserved}
          onChange={(checked) => handleToggleEnabled(record, checked)}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text) => text || <Text type="secondary">-</Text>,
    },
    {
      title: '最近更新人 / 时间',
      key: 'updated',
      width: 200,
      render: (_, record) => (
        <Tooltip
          title={
            <div>
              <div>更新人：{record.updatedBy}</div>
              <div>更新时间：{record.updatedAt}</div>
            </div>
          }
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.updatedBy} · {record.updatedAt}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={!isItAdmin}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!isItAdmin || record.isSystemReserved}
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
        title={`${category.name} · 字典项管理`}
        subTitle={`字典编码 ${category.code} ｜ ${category.source} ｜ 共 ${items.length} 项`}
        showBack
        onBack={() => navigate('/app/dict')}
        breadcrumb={[
          { path: '/app/audit', breadcrumbName: '审计中心' },
          { path: '/app/dict', breadcrumbName: '数据字典' },
          { path: '', breadcrumbName: category.name },
        ]}
        extra={[
          <Button key="history" icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
            变更历史
          </Button>,
          <Button key="import" icon={<UploadOutlined />} disabled={!isItAdmin} onClick={handleBatchImport}>
            批量导入
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={() => message.success('导出字典项请求已提交（演示）')}
          >
            导出
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!isItAdmin || !category.allowAddItem}
            onClick={handleCreate}
          >
            新增字典项
          </Button>,
        ]}
      />

      <Card style={{ marginTop: 16 }} size="small">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="字典编码"><Text code>{category.code}</Text></Descriptions.Item>
          <Descriptions.Item label="分类来源">
            {category.source === '系统内置' ? <Tag color="default">系统内置</Tag> : <Tag color="blue">自定义</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="是否支持新增字典项">
            {category.allowAddItem ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div style={{ marginTop: 16, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #F0F0F0' }}>
        <Table<DictItem>
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={false}
          scroll={{ x: 1300 }}
        />
      </div>

      <Drawer
        title={editing ? `编辑字典项「${editing.name}」` : '新增字典项'}
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="字典项名称"
            rules={[{ required: true, message: '请输入' }, { min: 2, max: 20, message: '2-20 字' }]}
          >
            <Input placeholder="例如：导诊分诊" maxLength={20} showCount />
          </Form.Item>
          <Form.Item
            name="code"
            label="字典项编码"
            rules={[
              { required: true, message: '请输入' },
              { pattern: /^[A-Z0-9_]{2,32}$/, message: '大写字母 / 数字 / 下划线，长度 2-32' },
            ]}
            extra={editing?.isSystemReserved ? '系统保留项编码已锁定' : '被下游引用后将锁定'}
          >
            <Input placeholder="例如：TRIAGE" disabled={!!editing?.isSystemReserved} />
          </Form.Item>
          <Form.Item name="sort" label="排序" tooltip="非负整数，亦可通过列表拖拽调整">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isDefault" label="是否默认" tooltip="同一分类至多一个默认项；切换默认会自动取消原默认项">
            <Switch />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用状态"
            tooltip={editing?.isSystemReserved ? '系统保留项不允许禁用' : ''}
          >
            <Switch disabled={!!editing?.isSystemReserved} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title="变更历史（最近 50 条）"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={<Button onClick={() => setHistoryOpen(false)}>关闭</Button>}
        width={720}
      >
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          所有「新增 / 编辑 / 删除 / 启用 / 禁用 / 默认切换 / 排序调整」操作均记录操作人、操作时间、变更前后值，自动归档至审计中心。
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
          <li>
            <Text type="secondary">2026-06-08 15:20</Text> · 王明 · 编辑「退回原因」字典项，新增「技术信息不完整」
          </li>
          <li>
            <Text type="secondary">2026-06-05 11:42</Text> · 王明 · 编辑「智能体类型」分类，调整排序
          </li>
          <li>
            <Text type="secondary">2026-06-02 14:18</Text> · 王明 · 新增字典项「诊疗环节 · 随访管理」
          </li>
          <li>
            <Text type="secondary">2026-05-15 09:10</Text> · 李雪 · 禁用「诊疗环节 · 随访管理」
          </li>
        </ul>
      </Modal>
    </div>
  );
};

export default ItemList;
