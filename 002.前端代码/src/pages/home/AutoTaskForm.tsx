/**
 * 首页 V1.x · 自动化任务「新建」表单子页
 *
 * PRD §3.3.1《新建/编辑自动化任务页面》落地版 —— 独立二级路由 /app/home/auto-tasks/new,
 * 不再用右侧 Drawer 弹出,直接下钻到本页。
 *
 * 设计要点:
 *   - 右上角固定展示「取消」「保存」操作
 *   - 主体表单字段照搬 PRD §3.3.1:
 *     ① 任务名称(必) ② 提示词(必) + 模型下拉 ③ 连接器(可选,多选)
 *     ④ 执行频率(必)三段 Tabs:周期 / 按间隔 / 单次
 *     ⑤ 生效日期区间(可选,仅周期与按间隔时显示)
 *   - 提交成功 → navigate('/app/home/overview', { state: { autoTaskCreated: { name, firstRunName } } }),
 *     首页 useEffect 读 state 把「任务创建成功」气泡推到对话区,保留「返回调用方页」语义
 *   - 编辑能力留待后续版本(目前只看 new),由 /app/home/auto-tasks 列表页提供
 */

import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  type FormProps,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Tabs,
  TimePicker,
  Typography,
} from 'antd';
import HomeSidebarV2, { ensureRunHistoryMock, initialAutoTasks, type AutoTask } from './HomeSidebarV2';
import ModelSelector from './ModelSelector';
import { getAutoTaskTemplate } from './autoTaskTemplates';

const { TextArea } = Input;
const { Text } = Typography;

type FrequencyType = 'cycle' | 'interval' | 'once';

const formatNextRunIn = (values: {
  frequencyType: FrequencyType;
  cyclePeriod?: 'day' | 'week' | 'month';
  cycleTime?: unknown;
  intervalValue?: number;
  intervalUnit?: 'hour' | 'minute';
  onceAt?: unknown;
}) => {
  const now = dayjs();
  const formatDiff = (target: dayjs.Dayjs) => {
    const minutes = Math.max(1, target.diff(now, 'minute'));
    if (minutes < 60) return `约 ${minutes} 分钟后执行`;
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `约 ${hours} 小时后执行`;
    return `约 ${Math.ceil(hours / 24)} 天后执行`;
  };

  if (values.frequencyType === 'interval') {
    const value = values.intervalValue ?? 1;
    if (values.intervalUnit === 'minute') return `约 ${value} 分钟后执行`;
    return `约 ${value} 小时后执行`;
  }

  if (values.frequencyType === 'once') {
    const once = values.onceAt as { isValid?: () => boolean; diff?: (d: dayjs.Dayjs, unit: 'minute') => number } | undefined;
    if (once && typeof once.diff === 'function') return formatDiff(once as dayjs.Dayjs);
    return '待下次调度';
  }

  const timeLike = values.cycleTime as { hour?: () => number; minute?: () => number } | undefined;
  const hour = typeof timeLike?.hour === 'function' ? timeLike.hour() : 9;
  const minute = typeof timeLike?.minute === 'function' ? timeLike.minute() : 0;
  let next = now.hour(hour).minute(minute).second(0).millisecond(0);
  if (!next.isAfter(now)) {
    next = values.cyclePeriod === 'month' ? next.add(1, 'month') : values.cyclePeriod === 'week' ? next.add(1, 'week') : next.add(1, 'day');
  }
  return formatDiff(next);
};

const AutoTaskForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const templateId =
    (location.state as { autoTaskTemplateId?: string } | null)?.autoTaskTemplateId ??
    searchParams.get('template');
  const template = getAutoTaskTemplate(templateId);
  const returnPath = template ? '/app/home/auto-tasks/templates' : '/app/home/auto-tasks';
  const [form] = Form.useForm();
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(template?.frequency.type ?? 'cycle');
  const [saving, setSaving] = useState(false);
  const initialValues = useMemo(() => {
    const base = {
      model: 'auto',
      frequencyType: 'cycle' as FrequencyType,
      cyclePeriod: 'day',
      cycleWeekdays: [],
      cycleMonthdays: [],
      intervalValue: 1,
      intervalUnit: 'hour',
      intervalWeekdays: [],
      connectors: [],
    };
    if (!template) return base;
    return {
      ...base,
      name: template.name,
      prompt: template.prompt,
      frequencyType: template.frequency.type,
      cyclePeriod: template.frequency.cyclePeriod ?? 'day',
      cycleTime: template.frequency.cycleTime ? dayjs(`2026-01-01 ${template.frequency.cycleTime}`) : undefined,
      intervalValue: template.frequency.intervalValue ?? 1,
      intervalUnit: template.frequency.intervalUnit ?? 'hour',
    };
  }, [template]);

  const handleFinishFailed: FormProps['onFinishFailed'] = ({ errorFields }) => {
    const firstError = errorFields[0];
    if (firstError) {
      form.scrollToField(firstError.name, { block: 'center' });
      message.error(firstError.errors[0] || '请检查并完善必填项');
    }
  };

  const handleCancel = () => {
    navigate(returnPath);
  };

  const handleFinish = (values: {
    name: string;
    prompt: string;
    model: string;
    connectors: string[];
    frequencyType: FrequencyType;
    cyclePeriod?: 'day' | 'week' | 'month';
    cycleWeekdays?: string[];
    cycleMonthdays?: string[];
    cycleTime?: unknown;
    intervalValue?: number;
    intervalUnit?: 'hour' | 'minute';
    intervalWeekdays?: string[];
    onceAt?: unknown;
    dateRange?: [unknown, unknown];
  }) => {
    setSaving(true);
    const taskId = `t${Date.now()}`;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const firstRunName = `${values.name}-${stamp}`;
    const nextRunIn = formatNextRunIn(values);

    /* 把表单频率字段浓缩为一行描述,用于侧栏/列表 display */
    const frequencyDesc = (() => {
      const fmt = (d: unknown): string => {
        if (!d) return '';
        const x = d as { format?: (s: string) => string };
        if (typeof x.format === 'function') return x.format('HH:mm');
        return '';
      };
      switch (values.frequencyType) {
        case 'cycle': {
          const t = fmt(values.cycleTime);
          if (values.cyclePeriod === 'week' && values.cycleWeekdays?.length) {
            return `每周 ${values.cycleWeekdays.join('、')} ${t}`.trim();
          }
          if (values.cyclePeriod === 'month' && values.cycleMonthdays?.length) {
            return `每月 ${values.cycleMonthdays.join('、')} 号 ${t}`.trim();
          }
          return `每天 ${t}`.trim();
        }
        case 'interval': {
          const u = values.intervalUnit === 'hour' ? '小时' : values.intervalUnit === 'minute' ? '分钟' : '';
          return `每 ${values.intervalValue ?? ''}${u}一次`.trim();
        }
        case 'once': {
          const t = fmt(values.onceAt);
          return `仅执行一次 ${t}`.trim();
        }
        default:
          return '手动执行';
      }
    })();
    const newTask: AutoTask = {
      id: taskId,
      name: values.name,
      updatedAt: '刚刚',
      status: '成功',
      enabled: true,
      frequencyDesc,
      runs: [
        { id: `${taskId}-r1`, name: firstRunName, updatedAt: '刚刚', status: '成功', enabled: true, nextRunIn, summary: '首次执行已生成' },
      ],
    };

    /* 同步写入 HomeSidebarV2 暴露的 mock,保持侧栏列表与本页一致 */
    initialAutoTasks.unshift(newTask);
    ensureRunHistoryMock(newTask, newTask.runs[0]);

    message.success(`保存成功：${values.name}`);
    navigate('/app/home/auto-tasks');
    setSaving(false);
  };

  return (
    <div
      data-testid="home-auto-task-new"
      style={{
        padding: 16,
        background: '#F0F2F5',
        height: 'calc(100dvh - 64px)',
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <Row gutter={16} style={{ height: '100%' }}>
        {/* 第二层功能区始终保留；进入新建页时仅替换右侧第三区域。 */}
        <Col
          xs={0}
          sm={0}
          md={6}
          lg={6}
          xl={6}
          xxl={6}
          style={{ height: '100%' }}
          data-testid="home-v1-side-col"
        >
          <HomeSidebarV2
            initialActiveKey="auto-task"
            onNewTask={() => navigate('/app/home/overview')}
            onRestoreSession={(id) =>
              navigate('/app/home/overview', { state: { restoreSessionId: id } })
            }
            onRestoreRun={(id) =>
              navigate('/app/home/overview', { state: { restoreRunId: id } })
            }
            onOpenConnector={() => navigate('/app/home/connector')}
            onOpenAutoTasks={() => navigate('/app/home/auto-tasks')}
          />
        </Col>

        <Col span={18} style={{ height: '100%', minWidth: 0 }}>
          <Card
            bordered={false}
            styles={{
              body: {
                padding: 0,
                background: '#FFFFFF',
                borderRadius: 8,
                overflow: 'auto',
                height: '100%',
              },
            }}
            style={{ height: '100%' }}
            data-testid="auto-task-new-content"
          >
      <div style={{ padding: '18px 24px 28px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: '#262626' }}>
            自动化 / {template?.name ?? '新建自动化任务'}
          </div>
          <Space size={8}>
            <Button size="small" onClick={handleCancel} data-testid="auto-task-cancel">
              取消
            </Button>
            <Button
              type="primary"
              size="small"
              loading={saving}
              onClick={() => form.submit()}
              data-testid="auto-task-submit"
            >
              保存
            </Button>
          </Space>
        </div>

      <div style={{ width: '100%', maxWidth: 880, margin: '0 auto' }}>
        <style>{`
          .auto-task-compact-form { width: 100%; }
          .auto-task-compact-form .ant-form { width: 100%; }
          .auto-task-compact-form .ant-form-item { margin-bottom: 18px; }
          .auto-task-compact-form .ant-form-item-label { padding-bottom: 5px; }
          .auto-task-compact-form .ant-form-item-label > label { font-size: 13px; }
          .auto-task-compact-form .ant-tabs-nav { margin-bottom: 12px; }
          .auto-task-compact-form .ant-input,
          .auto-task-compact-form .ant-input-affix-wrapper,
          .auto-task-compact-form .ant-input-number,
          .auto-task-compact-form .ant-picker,
          .auto-task-compact-form .ant-select { width: 100%; }
          .auto-task-compact-form .ant-input-textarea { width: 100%; }
        `}</style>
        <Card
          data-testid="auto-task-form-card"
          styles={{ body: { padding: 24 } }}
          style={{ width: '100%' }}
        >
          <Form
            form={form}
            className="auto-task-compact-form"
            size="small"
            layout="vertical"
            style={{ width: '100%' }}
            onFinish={handleFinish}
            onFinishFailed={handleFinishFailed}
            initialValues={initialValues}
          >
            <Form.Item name="frequencyType" hidden>
              <Input />
            </Form.Item>

            {/* 1) 任务名称(必填) */}
            <Form.Item
              name="name"
              label="自动化任务名称"
              rules={[
                { required: true, message: '请填写任务名称' },
                { max: 50, message: '任务名称不可超过 50 个字符' },
              ]}
            >
              <Input
                placeholder="如:今日全院智能体运行情况报告"
                showCount
                maxLength={50}
                data-testid="auto-task-name"
              />
            </Form.Item>

            {/* 2) 提示词(必填) + 位于编辑区底部的模型选择 */}
            <Form.Item
              name="prompt"
              label="提示词"
              rules={[{ required: true, message: '请填写提示词' }]}
              style={{ marginBottom: 0 }}
            >
              <TextArea
                placeholder="描述本次自动化任务需完成的具体内容,如:汇总今日全院智能体的调用量、成功率、告警信息"
                autoSize={{ minRows: 6, maxRows: 10 }}
                style={{ borderRadius: '6px 6px 0 0', resize: 'vertical' }}
                data-testid="auto-task-prompt"
              />
            </Form.Item>
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderTop: 0,
                borderRadius: '0 0 6px 6px',
                padding: '5px 8px',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Form.Item name="model" noStyle>
                <ModelSelector
                  size="small"
                  variant="borderless"
                  compact
                  style={{ width: 104, fontSize: 12 }}
                  testId="auto-task-model"
                />
              </Form.Item>
            </div>

            {/* 3) 连接器(可选) */}
            <Form.Item
              label="连接器"
              name="connectors"
            >
              <Select
                mode="multiple"
                placeholder="选择已连接的连接器(可选)"
                options={[
                  { value: 'wechat', label: '微信' },
                  { value: 'wecom', label: '企业微信' },
                  { value: 'feishu', label: '飞书' },
                  { value: 'dingtalk', label: '钉钉' },
                  { value: 'qqmail', label: 'QQ 邮箱' },
                  { value: 'email', label: '企业邮箱' },
                  { value: 'sms', label: '短信网关' },
                ]}
              />
            </Form.Item>

            {/* 4) 执行频率(必填) */}
            <Form.Item label="执行频率" required>
              <Tabs
                activeKey={frequencyType}
                onChange={(k) => {
                  const v = k as FrequencyType;
                  setFrequencyType(v);
                  form.setFieldValue('frequencyType', v);
                }}
                items={[
                  {
                    key: 'cycle',
                    label: '周期',
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Space>
                          <Form.Item name="cyclePeriod" noStyle>
                            <Select
                              style={{ width: 110 }}
                              options={[
                                { value: 'day', label: '每天' },
                                { value: 'week', label: '每周' },
                                { value: 'month', label: '每月' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item
                            name="cycleTime"
                            noStyle
                            rules={[
                              {
                                required: frequencyType === 'cycle',
                                message: '请选择执行时间',
                              },
                            ]}
                          >
                            <TimePicker format="HH:mm" placeholder="09:00" />
                          </Form.Item>
                        </Space>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prev, cur) => prev.cyclePeriod !== cur.cyclePeriod}
                        >
                          {({ getFieldValue }) =>
                            getFieldValue('cyclePeriod') === 'week' ? (
                              <Form.Item name="cycleWeekdays" noStyle>
                                <Checkbox.Group>
                                  <Space size={4} wrap>
                                    {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d) => (
                                      <Checkbox key={d} value={d}>
                                        {d}
                                      </Checkbox>
                                    ))}
                                  </Space>
                                </Checkbox.Group>
                              </Form.Item>
                            ) : getFieldValue('cyclePeriod') === 'month' ? (
                              <Form.Item name="cycleMonthdays" noStyle>
                                <Checkbox.Group>
                                  <Space size={2} wrap>
                                    {Array.from({ length: 31 }, (_, i) => `${i + 1}`).map((d) => (
                                      <Checkbox key={d} value={d}>
                                        {d}
                                      </Checkbox>
                                    ))}
                                  </Space>
                                </Checkbox.Group>
                              </Form.Item>
                            ) : null
                          }
                        </Form.Item>
                      </div>
                    ),
                  },
                  {
                    key: 'interval',
                    label: '按间隔',
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Space>
                          <span>每</span>
                          <Form.Item name="intervalValue" noStyle>
                            <Input type="number" min={1} style={{ width: 80 }} />
                          </Form.Item>
                          <Form.Item name="intervalUnit" noStyle>
                            <Select
                              style={{ width: 100 }}
                              options={[
                                { value: 'hour', label: '小时' },
                                { value: 'minute', label: '分钟' },
                              ]}
                            />
                          </Form.Item>
                          <span>执行一次</span>
                        </Space>
                        <div>
                          <Text type="secondary">仅在以下星期内按间隔执行</Text>
                          <div style={{ marginTop: 6 }}>
                            <Form.Item name="intervalWeekdays" noStyle>
                              <Checkbox.Group>
                                <Space size={2} wrap>
                                  {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d) => (
                                    <Checkbox key={d} value={d}>
                                      {d}
                                    </Checkbox>
                                  ))}
                                </Space>
                              </Checkbox.Group>
                            </Form.Item>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'once',
                    label: '单次',
                    children: (
                      <Form.Item
                        name="onceAt"
                        rules={[
                          {
                            required: frequencyType === 'once',
                            message: '请选择执行时间',
                          },
                        ]}
                      >
                        <DatePicker
                          showTime
                          format="YYYY-MM-DD HH:mm"
                          style={{ width: '100%' }}
                          placeholder="选择具体执行日期与时间"
                        />
                      </Form.Item>
                    ),
                  },
                ]}
              />
            </Form.Item>

            {/* 5) 生效日期区间(可选) — 仅周期/按间隔时显示 */}
            {frequencyType !== 'once' && (
              <Form.Item
                label="生效日期区间"
                name="dateRange"
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Form>
        </Card>

      </div>
      </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AutoTaskForm;
