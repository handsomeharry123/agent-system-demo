/**
 * 6.2 事件分派页（V1.8）
 * 需求文档：统一运行监控中心-需求说明文档 V1.8 §6.2
 *
 * 仅 IT 管理员可访问。
 * 字段：序号 / 事件类型 / 关联智能体 / 触发告警内容 / 处理人 / 通知方式 / 触发告警时间
 * 按钮：分派（将「待分派」事件转为「待处理」）
 *
 * 这里用「待分派事件」列表承载，点击分派按钮后弹出处理人选定弹窗。
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Space, Typography, Button, Tag, Form, Input, Modal, message, Tooltip, Descriptions,
} from 'antd';
import {
  ArrowLeftOutlined, SwapOutlined, ReloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { ProTable, type ProColumns, type ActionType } from '@ant-design/pro-components';
import PageHeader from '../../components/PageHeader';
import { PermissionDenied } from '../../components/PageStates';
import {
  mockAlertEventsV18, NotifyChannelLabels, type AlertEventV18,
} from '../../mock/monitoringV18';
import { useMonitoringGuard } from './useMonitoringGuard';

const { Text } = Typography;

const AlertEventAssign = () => {
  const navigate = useNavigate();
  const { isAdmin } = useMonitoringGuard();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [events, setEvents] = useState<AlertEventV18[]>(mockAlertEventsV18.filter((e) => e.status === 'pending_assign'));
  const [assignModal, setAssignModal] = useState<{ open: boolean; event: AlertEventV18 | null }>({ open: false, event: null });
  const [assignForm] = Form.useForm();

  if (!isAdmin) return <PermissionDenied message="「事件分派」仅面向 IT 管理员" />;

  const columns: ProColumns<AlertEventV18>[] = [
    {
      title: '序号', key: 'index', width: 60, render: (_, __, index) => index + 1,
    },
    {
      title: '事件类型', dataIndex: 'eventType', key: 'eventType', width: 140,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          business: { color: 'blue', label: '业务监控' },
          status: { color: 'green', label: '状态监控' },
          cost: { color: 'orange', label: '成本监控' },
          security: { color: 'red', label: '安全监控' },
        };
        return <Tag color={map[v]?.color}>{map[v]?.label}</Tag>;
      },
    },
    { title: '关联智能体', dataIndex: 'agentName', key: 'agentName', width: 200, ellipsis: true },
    {
      title: '触发告警内容', key: 'triggerContent', width: 320,
      render: (_, r) => (
        <Tooltip title={r.triggerContent.rule_name}>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{r.triggerContent.rule_name}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.triggerContent.trigger_condition.metric} {r.triggerContent.trigger_condition.operator} {r.triggerContent.trigger_condition.threshold}{r.triggerContent.trigger_condition.thresholdUnit}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '处理人', key: 'handler', width: 120,
      render: (_, r) => <Text type="secondary">{r.handler || '—'}</Text>,
    },
    {
      title: '通知方式', key: 'notifyChannels', width: 180,
      render: (_, r) => (
        <Space size={2} wrap>
          {r.notifyChannels.map((c) => <Tag key={c} color="blue">{NotifyChannelLabels[c]}</Tag>)}
        </Space>
      ),
    },
    {
      title: '触发告警时间', dataIndex: 'triggerTime', key: 'triggerTime', width: 170,
      render: (t) => <Text type="secondary"><ClockCircleOutlined /> {t}</Text>,
    },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_, r) => [
        <Button key="assign" type="link" icon={<SwapOutlined />}
          onClick={() => { setAssignModal({ open: true, event: r }); assignForm.resetFields(); }}>分派</Button>,
      ],
    },
  ];

  const submitAssign = async () => {
    if (!assignModal.event) return;
    try {
      const values = await assignForm.validateFields();
      const e = assignModal.event;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      // 更新事件状态
      const updated: AlertEventV18 = {
        ...e,
        status: 'pending_handle',
        assignTime: now,
        assigner: '黄帅帅',
        handler: values.assignee,
        handleTimeline: [
          ...(e.handleTimeline || []),
          { time: now, action: '分派', operator: '黄帅帅', remark: `分派给 ${values.assignee}` },
        ],
      };
      // 更新 mock 数据
      const idx = mockAlertEventsV18.findIndex((x) => x.id === e.id);
      if (idx >= 0) mockAlertEventsV18[idx] = updated;
      setEvents(events.filter((x) => x.id !== e.id));
      message.success('已分派给处理人，事件记录到「待处理事件」');
      setAssignModal({ open: false, event: null });
      actionRef.current?.reload();
    } catch (e) { /* ignore */ }
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title="事件分派"
        subTitle="将「待分派事件」分派给具体处理人，事件进入「待处理事件」"
        showBack
        onBack={() => navigate('/app/monitoring/alert-events')}
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '/app/monitoring/alert-events', breadcrumbName: '告警事件处置' },
          { path: '', breadcrumbName: '事件分派' },
        ]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>刷新</Button>
          </Space>
        }
      />

      <Card bordered={false} style={{ marginTop: 16 }} title={`待分派事件 · 共 ${events.length} 条`}>
        {events.length === 0 ? (
          <Text type="secondary">当前没有待分派的事件</Text>
        ) : (
          <ProTable<AlertEventV18>
            rowKey="id" actionRef={actionRef} search={false}
            columns={columns} dataSource={events}
            pagination={{ defaultPageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1500 }}
          />
        )}
      </Card>

      <Modal
        open={assignModal.open}
        title="事件分派"
        onCancel={() => setAssignModal({ open: false, event: null })}
        onOk={submitAssign}
        okText="分派"
        cancelText="取消"
        destroyOnClose
      >
        {assignModal.event && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="事件类型">
                <Tag color={assignModal.event.eventType === 'business' ? 'blue' : assignModal.event.eventType === 'status' ? 'green' : assignModal.event.eventType === 'cost' ? 'orange' : 'red'}>
                  {assignModal.event.eventType === 'business' ? '业务监控' : assignModal.event.eventType === 'status' ? '状态监控' : assignModal.event.eventType === 'cost' ? '成本监控' : '安全监控'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联智能体">{assignModal.event.agentName}</Descriptions.Item>
              <Descriptions.Item label="触发告警内容">{assignModal.event.triggerContent.rule_name}</Descriptions.Item>
              <Descriptions.Item label="触发告警时间">{assignModal.event.triggerTime}</Descriptions.Item>
            </Descriptions>
            <Form form={assignForm} layout="vertical">
              <Form.Item name="assignee" label="处理人" rules={[{ required: true, message: '请输入处理人' }]}>
                <Input placeholder="请输入 IT 管理员姓名" />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AlertEventAssign;