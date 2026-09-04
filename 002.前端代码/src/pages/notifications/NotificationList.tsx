import { useState } from 'react';
import { ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Space, Tag, Typography, Drawer, Descriptions, Input, Select, message, Badge, Popconfirm } from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  BellOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

type NotificationType = '系统公告' | '审批结果' | '告警通知' | '操作提醒' | '反馈处理结果';
type ReadStatus = '未读' | '已读';

interface NotificationItem {
  id: number;
  title: string;
  type: NotificationType;
  summary: string;
  content: string;
  time: string;
  readStatus: ReadStatus;
}

const notificationTypeOptions: { label: string; value: NotificationType | '全部' }[] = [
  { label: '全部', value: '全部' },
  { label: '系统公告', value: '系统公告' },
  { label: '审批结果', value: '审批结果' },
  { label: '告警通知', value: '告警通知' },
  { label: '操作提醒', value: '操作提醒' },
  { label: '反馈处理结果', value: '反馈处理结果' },
];

const readStatusOptions: { label: string; value: '全部' | ReadStatus }[] = [
  { label: '全部', value: '全部' },
  { label: '未读', value: '未读' },
  { label: '已读', value: '已读' },
];

const mockNotifications: NotificationItem[] = [
  { id: 1, title: '智能体上线审批通过', type: '审批结果', summary: '心电图智能辅助诊断系统已正式上线运行', content: '心电图智能辅助诊断系统已通过准入评测，正式上线运行。您可以在工作台中开始使用该智能体。', time: '2026-05-22 10:30', readStatus: '未读' },
  { id: 2, title: '评测任务完成通知', type: '审批结果', summary: '胸部 CT 影像分析平台评测已完成', content: '胸部 CT 影像分析平台已完成全部评测项目，评测通过，可进入试运行阶段。', time: '2026-05-22 09:15', readStatus: '未读' },
  { id: 3, title: '系统维护公告', type: '系统公告', summary: '5月25日 02:00-04:00 进行系统维护', content: '系统将于5月25日凌晨2点至4点进行例行维护，届时部分功能将暂时不可用。', time: '2026-05-22 08:00', readStatus: '已读' },
  { id: 4, title: '异常告警', type: '告警通知', summary: '处方审核系统响应时间异常', content: '处方审核系统响应时间超过阈值，当前平均响应时间为 6.2 秒，请检查系统状态。', time: '2026-05-21 16:45', readStatus: '未读' },
  { id: 5, title: '新功能上线', type: '系统公告', summary: '多智能体编排功能已上线', content: '多智能体编排协同中心已上线，支持将多个智能体串联成工作流程。', time: '2026-05-21 14:30', readStatus: '已读' },
  { id: 6, title: '数据共享申请被拒绝', type: '审批结果', summary: '您的数据共享申请已被拒绝', content: '您申请的数据共享请求因权限不足已被拒绝，请联系管理员。', time: '2026-05-20 11:20', readStatus: '已读' },
  { id: 7, title: '智能体注册申请待审批', type: '操作提醒', summary: '影像分析系统 v2.1 注册申请待审批', content: '影像分析系统 v2.1 提交了注册申请，请尽快处理。', time: '2026-05-20 10:00', readStatus: '未读' },
  { id: 8, title: '用户反馈已处理', type: '反馈处理结果', summary: '您反馈的问题已处理完成', content: '您提交的关于诊断建议准确率低的问题已处理，系统已完成优化。', time: '2026-05-19 17:30', readStatus: '已读' },
];

const typeTagColor: Record<NotificationType, string> = {
  '系统公告': 'blue',
  '审批结果': 'green',
  '告警通知': 'red',
  '操作提醒': 'gold',
  '反馈处理结果': 'purple',
};

const NotificationList = () => {
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);

  const unreadCount = notifications.filter((n) => n.readStatus === '未读').length;

  const handleMarkAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readStatus: '已读' as ReadStatus } : n))
    );
    message.success('已标记为已读');
  };

  const handleDelete = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    message.success('已删除');
  };

  const handleBatchRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: '已读' as ReadStatus })));
    message.success('已全部标记为已读');
  };

  const handleBatchDelete = (ids: number[]) => {
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    message.success('已删除所选通知');
  };

  const handleViewDetail = (record: NotificationItem) => {
    setSelectedNotification(record);
    setDetailVisible(true);
    if (record.readStatus === '未读') {
      handleMarkAsRead(record.id);
    }
  };

  const columns: ProColumns<NotificationItem>[] = [
    {
      title: '',
      dataIndex: 'readStatus',
      key: 'readStatus',
      width: 24,
      render: (_, record) =>
        record.readStatus === '未读' ? (
          <Badge status="error" />
        ) : null,
    },
    {
      title: '通知标题',
      dataIndex: 'title',
      key: 'title',
      render: (_, record) => (
        <a onClick={() => handleViewDetail(record)}>{record.title}</a>
      ),
    },
    {
      title: '通知类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (_, record) => (
        <Tag color={typeTagColor[record.type]}>{record.type}</Tag>
      ),
    },
    {
      title: '通知摘要',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      render: (_, record) => <Text type="secondary">{record.summary}</Text>,
    },
    {
      title: '发送时间',
      dataIndex: 'time',
      key: 'time',
      width: 160,
      sorter: (a, b) => a.time.localeCompare(b.time),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.readStatus === '未读' && (
            <Button type="text" size="small" icon={<ReadOutlined />} onClick={() => handleMarkAsRead(record.id)}>
              标记已读
            </Button>
          )}
          <Popconfirm title="确定删除该通知？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, background: '#F5F5F5' }}>
      <PageHeader
        title="通知列表"
        subTitle={`共 ${notifications.length} 条通知，未读 ${unreadCount} 条`}
        extra={
          <Space>
            <Button icon={<CheckOutlined />} onClick={handleBatchRead} disabled={unreadCount === 0}>
              全部标记已读
            </Button>
          </Space>
        }
      />

      <ProTable
        headerTitle={false}
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => []}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
        request={async (params) => {
          const { keyword, type, readStatus: rs, pageSize, current } = params;
          let filtered = [...notifications];
          if (keyword) {
            filtered = filtered.filter(
              (n) =>
                n.title.includes(keyword) ||
                n.summary.includes(keyword) ||
                n.content.includes(keyword)
            );
          }
          if (type && type !== '全部') {
            filtered = filtered.filter((n) => n.type === type);
          }
          if (rs && rs !== '全部') {
            filtered = filtered.filter((n) => n.readStatus === rs);
          }
          const start = ((current || 1) - 1) * (pageSize || 10);
          const end = start + (pageSize || 10);
          return { data: filtered.slice(start, end), success: true, total: filtered.length };
        }}
        columns={columns}
        rowKey="id"
        tableAlertRender={({ selectedRowKeys }) => (
          <Space size={8}>
            <Text>已选择 {selectedRowKeys.length} 条</Text>
            <Popconfirm
              title="确定删除所选通知？"
              onConfirm={() => {
                handleBatchDelete(selectedRowKeys as number[]);
              }}
            >
              <Button size="small" danger>
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        )}
        rowSelection={{}}
        options={false}
      />

      <Drawer
        title={selectedNotification?.title}
        placement="right"
        width={480}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
      >
        {selectedNotification && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="通知类型">
              <Tag color={typeTagColor[selectedNotification.type]}>{selectedNotification.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发送时间">{selectedNotification.time}</Descriptions.Item>
            <Descriptions.Item label="通知内容">
              <div style={{ whiteSpace: 'pre-wrap' }}>{selectedNotification.content}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default NotificationList;
