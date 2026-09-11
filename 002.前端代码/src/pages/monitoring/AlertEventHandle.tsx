/**
 * 6.3 事件处理页（V1.8）
 * 需求文档：统一运行监控中心-需求说明文档 V1.8 §6.3
 *
 * 字段：序号 / 事件类型 / 关联智能体 / 触发告警内容 / 处理人 / 通知方式 / 触发时间 /
 *       处理时间记录线（处理 - 退回 - 再次处理）/ 处理结果（已处理 / 已忽略）/ 处理方案 / 开始处理时间
 * 按钮：处理 / 返回
 *
 * 处理：填写处理结果 + 处理方案 → 进入「处理中 / 已忽略」
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Card, Space, Typography, Button, Tag, Form, Input, Radio, message, Tooltip,
  Timeline, Descriptions, Alert as AntAlert,
} from 'antd';
import {
  ArrowLeftOutlined, PlayCircleOutlined, ReloadOutlined, ClockCircleOutlined,
  CheckCircleOutlined, MinusCircleOutlined, RollbackOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  mockAlertEventsV18, NotifyChannelLabels, type AlertEventV18,
} from '../../mock/monitoringV18';
import { useMonitoringGuard } from './useMonitoringGuard';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const AlertEventHandle = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const { isAdmin, currentUserName } = useMonitoringGuard();
  const [event, setEvent] = useState<AlertEventV18 | null>(null);
  const [saving, setSaving] = useState(false);
  const [handleForm] = Form.useForm();

  useEffect(() => {
    if (params.id) {
      const e = mockAlertEventsV18.find((x) => x.id === params.id);
      setEvent(e || null);
    }
  }, [params.id]);

  // 访问条件：信息科管理员全开；科室管理员仅当本人是处理人时可进入处理页
  if (event && !isAdmin && event.handler !== currentUserName) {
    return <Text type="secondary">该事件非您处理，无权访问</Text>;
  }
  if (!event) return <Text type="secondary">事件不存在</Text>;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 提交处理
  const submitHandle = async () => {
    try {
      const values = await handleForm.validateFields();
      setSaving(true);
      const isIgnored = values.handleResult === '已忽略';
      const operator = currentUserName || '当前用户';
      const updated: AlertEventV18 = {
        ...event,
        status: isIgnored ? 'ignored' : 'handling',
        handleStartTime: now,
        handleCompleteTime: isIgnored ? now : event.handleCompleteTime,
        handler: event.handler || operator,
        handleResult: values.handleResult,
        handlePlan: values.handlePlan,
        reviewOpinion: isIgnored ? '同意忽略该告警事项' : event.reviewOpinion,
        reviewRemark: isIgnored ? `处理人确认该事件无需继续处置：${values.handlePlan}` : event.reviewRemark,
        handleTimeline: [
          ...(event.handleTimeline || []),
          { time: now, action: isIgnored ? '已忽略' : '开始处理', operator, remark: values.handlePlan },
        ],
      };
      const idx = mockAlertEventsV18.findIndex((x) => x.id === event.id);
      if (idx >= 0) mockAlertEventsV18[idx] = updated;
      setEvent(updated);
      message.success(isIgnored ? '已忽略事件' : '已开始处理，事件进入「处理中事件」');
      setTimeout(() => {
        navigate(isIgnored ? '/app/monitoring/alert-events?tab=ignored' : '/app/monitoring/alert-events?tab=handling');
      }, 800);
    } catch (e) {
      // 校验失败
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title="事件处理"
        subTitle="填写处理结果与处理方案，事件进入「处理中事件」或「已忽略事件」"
        showBack
        onBack={() => navigate('/app/monitoring/alert-events')}
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '/app/monitoring/alert-events', breadcrumbName: '告警事件处置' },
          { path: '', breadcrumbName: '事件处理' },
        ]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />}>刷新</Button>
          </Space>
        }
      />

      <Card bordered={false} style={{ marginTop: 16 }} title="事件基本信息">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="序号">{event.id.slice(-3)}</Descriptions.Item>
          <Descriptions.Item label="事件类型">
            <Tag color={event.eventType === 'business' ? 'blue' : event.eventType === 'status' ? 'green' : event.eventType === 'cost' ? 'orange' : 'red'}>
              {event.eventType === 'business' ? '业务监控' : event.eventType === 'status' ? '状态监控' : event.eventType === 'cost' ? '成本监控' : '安全监控'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="关联智能体">
            <Link to={`/app/ledger/list?agentId=${event.agentId}`}>{event.agentName}</Link>
            <Text type="secondary" style={{ marginLeft: 6 }}>· {event.department}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="处理人">{event.handler || '—'}</Descriptions.Item>
          <Descriptions.Item label="通知方式">
            <Space size={2} wrap>
              {event.notifyChannels.map((c) => <Tag key={c} color="blue">{NotifyChannelLabels[c]}</Tag>)}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="触发时间">{event.triggerTime}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card bordered={false} style={{ marginTop: 16 }} title="触发告警内容（统一结构）">
        <Card size="small" style={{ background: '#F0F5FF', borderColor: '#ADC6FF' }}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="规则名称">{event.triggerContent.rule_name}</Descriptions.Item>
            <Descriptions.Item label="触发时间">{event.triggerContent.trigger_time}</Descriptions.Item>
            <Descriptions.Item label="触发条件">
              <Space direction="vertical" size={2}>
                <Space><Text type="secondary">指标：</Text><Text code>{event.triggerContent.trigger_condition.metric}</Text></Space>
                <Space><Text type="secondary">运算符：</Text><Text code>{event.triggerContent.trigger_condition.operator}</Text></Space>
                <Space><Text type="secondary">阈值：</Text><Text code>{event.triggerContent.trigger_condition.threshold}{event.triggerContent.trigger_condition.thresholdUnit}</Text></Space>
                <Space><Text type="secondary">持续时间：</Text><Text code>{event.triggerContent.trigger_condition.sustainDuration}</Text></Space>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="触发动作">
              <Tag color="processing">{event.triggerContent.trigger_action}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="输出提示词">
              <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{event.triggerContent.output_prompt}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Card>

      <Card bordered={false} style={{ marginTop: 16 }} title="处理时间记录线（处理 - 退回 - 再次处理）">
        {event.handleTimeline && event.handleTimeline.length > 0 ? (
          <Timeline
            items={event.handleTimeline.map((it) => ({
              color: it.action === '审核通过' ? 'green' : it.action === '已忽略' ? 'gray' : it.action === '退回' ? 'red' : it.action === '分派' ? 'orange' : 'blue',
              children: (
                <div>
                  <Space>
                    <Text strong>{it.action}</Text>
                    <Text type="secondary"><ClockCircleOutlined /> {it.time}</Text>
                    <Tag>{it.operator}</Tag>
                  </Space>
                  {it.remark && <Paragraph style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>{it.remark}</Paragraph>}
                </div>
              ),
            }))}
          />
        ) : <Text type="secondary">暂无处置记录</Text>}
        {event.returnReason && (
          <AntAlert
            type="warning" showIcon style={{ marginTop: 8 }}
            message={<Space><RollbackOutlined />退回处理说明</Space>}
            description={event.returnReason}
          />
        )}
      </Card>

      <Card bordered={false} style={{ marginTop: 16 }} title="处理结果与处理方案">
        <Form form={handleForm} layout="vertical">
          <Form.Item name="handleResult" label="处理结果" rules={[{ required: true, message: '请选择' }]}>
            <Radio.Group>
              <Radio value="已处理"><CheckCircleOutlined style={{ color: '#52C41A' }} /> 已处理</Radio>
              <Radio value="已忽略"><MinusCircleOutlined style={{ color: '#8c8c8c' }} /> 已忽略</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="handlePlan" label="处理方案" rules={[{ required: true, message: '请填写处理方案' }]}>
            <TextArea rows={5} maxLength={500} showCount placeholder="详细说明告警事件的处理过程（退回后再次处理时也请填写本次处理思路）" />
          </Form.Item>
          <Form.Item label="开始处理时间">
            <Text>{now}</Text>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => navigate('/app/monitoring/alert-events')}>返回</Button>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={submitHandle} loading={saving}>
          处理
        </Button>
      </div>
    </div>
  );
};

export default AlertEventHandle;
