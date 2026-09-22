/**
 * 8-6 告警规则 — 新建 / 编辑（独立下转页面，V1.6）
 * 需求文档：统一运行监控中心-需求说明文档 V1.6
 *
 * 四大核心配置块：
 *   ① 告警基本信息（规则名 / 描述 / 级别 / 生效范围 / 负责人 / 启用状态）
 *   ② 告警指标（监控维度 / 监控指标 / 聚合方式 / 统计窗口 / 过滤条件）
 *   ③ 告警规则配置（触发条件 / 连续次数 / 静默 / 自动恢复 / 恢复窗口 /
 *                  修复建议「可能原因 ↔ 处置动作」动态行 / 规则预览）
 *   ④ 告警通知（通知方式 / 通知对象 / 通知模板 / 频率限制 / 免打扰 / 升级策略）
 *
 * V1.6 变更：
 * - 监控维度精简为 业务 / 状态 / 成本（性能维度已并入三维）
 * - 「可能原因 ↔ 处置动作」按行序号成对带入 8-5 详情抽屉
 * - 底部吸底操作栏：保存并启用 / 保存为草稿 / 测试规则 / 取消
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Space, Button, Form, Row, Col, Divider, Anchor, Input, Select, InputNumber, Switch, Tooltip,
  Typography, message, Modal, Tag, Alert, DatePicker,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined, QuestionCircleOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { mockAlertRules } from '../../mock/monitoring';
import { getMetricMeta } from '../../mock/monitoring-metrics';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 告警级别选项
const levelOptions = [
  { label: '严重', value: 'severe' },
  { label: '警告', value: 'warning' },
  { label: '提示', value: 'info' },
];

// V1.6 监控维度精简：业务 / 状态 / 成本
const dimensionOptions = [
  { label: '业务', value: 'business' },
  { label: '状态', value: 'status' },
  { label: '成本', value: 'cost' },
];

// V1.6 指标库（精简三维）
const metricLibrary: Record<string, { label: string; defaultUnit: string; thresholdHint: string }[]> = {
  business: [
    { label: '业务调用总量', defaultUnit: '次', thresholdHint: '异常波动告警' },
    { label: '任务完成率', defaultUnit: '%', thresholdHint: '≥ 95%' },
    { label: '不合规回答率', defaultUnit: '%', thresholdHint: '≤ 0.5%' },
    { label: '高风险拦截数', defaultUnit: '次', thresholdHint: '趋势告警' },
  ],
  status: [
    { label: '心跳成功率', defaultUnit: '%', thresholdHint: '≥ 99.95%' },
    { label: '运行状态变更', defaultUnit: '次', thresholdHint: '离线 / 异常' },
    { label: 'GPU 显存使用率', defaultUnit: '%', thresholdHint: '≤ 85%' },
  ],
  cost: [
    { label: '周期总成本', defaultUnit: '元', thresholdHint: '超预算' },
    { label: 'Token 消耗', defaultUnit: 'tokens', thresholdHint: '突增告警' },
    { label: '实例闲置率', defaultUnit: '%', thresholdHint: '≤ 15%' },
  ],
};

// 聚合方式选项
const aggregationOptions = [
  { label: '求和', value: 'sum' }, { label: '平均', value: 'avg' },
  { label: '最大', value: 'max' }, { label: '最小', value: 'min' },
  { label: 'P95', value: 'p95' }, { label: 'P99', value: 'p99' },
  { label: '计数', value: 'count' }, { label: '占比', value: 'ratio' },
];

// 运算符选项
const operatorOptions = [
  { label: '>', value: '>' }, { label: '≥', value: '>=' },
  { label: '<', value: '<' }, { label: '≤', value: '<=' },
  { label: '=', value: '=' }, { label: '≠', value: '!=' },
  { label: '环比变化', value: 'wow' }, { label: '同比变化', value: 'yoy' },
];

// 通知方式选项
const notificationChannelOptions = [
  { label: '站内通知', value: 'station' },
  { label: '短信', value: 'sms' },
  { label: '邮件', value: 'email' },
];

// 通知模板选项
const notificationTemplateOptions = [
  { label: '严重告警模板', value: 'tpl_severe' },
  { label: '警告告警模板', value: 'tpl_warning' },
  { label: '提示告警模板', value: 'tpl_info' },
];

// 统计窗口选项
const windowOptions = [
  { label: '1 分钟', value: 1 },
  { label: '5 分钟', value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '1 小时', value: 60 },
];

// 升级策略触发条件
const escalationConditionOptions = [
  { label: '未处置超时', value: 'timeout' },
  { label: '重复触发达 N 次', value: 'repeats' },
];

// 升级对象
const escalationTargetOptions = [
  { label: '上级管理员', value: 'supervisor' },
  { label: '信息科主管', value: 'director' },
  { label: '自定义用户', value: 'custom' },
];

// 气泡说明（V1.6 强制要求 ⓘ）
const fieldTooltips: Record<string, string> = {
  continuousHits: '避免「狼来了」式误报。指标需连续 N 个统计窗口都超阈才会告警，过滤一两次偶发抖动。例：设为 2 次、5 分钟窗口 → 需连续 10 分钟都超阈才报警。推荐 2–3 次。',
  silentMinutes: '避免告警刷屏。同一条告警发出后，在静默时间内不再重复推送。例：设为 30 分钟，告警发出后 30 分钟内不会被同一个问题反复吃短信。',
  autoRecovery: '指标自己好了，告警自动关。开启后指标回落到正常范围时系统自动把告警置为「已关闭」，关闭时需到 8-5 告警事件处置手动闭环。',
  recoveryWindow: '避免「假恢复」。指标需连续 N 次窗口都回落达标才算「真的恢复」。例：设为 2 次、5 分钟窗口 = 连续 10 分钟达标才自动恢复。N 取值 1–10，默认 2 次。',
};

// 修复建议行类型
interface RemediationRow {
  id: string;
  cause: string;
  action: string;
}

const AlertRuleForm = () => {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = !!params.id;

  const [form] = Form.useForm();
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(false);
  const [remediationRows, setRemediationRows] = useState<RemediationRow[]>([
    { id: '1', cause: '', action: '' },
  ]);
  const [selectedDimension, setSelectedDimension] = useState<string>('business');
  const [preview, setPreview] = useState<string>('当 指标 在 5 分钟窗口内 > 阈值，连续 2 次触发严重告警');

  // 加载初始值（编辑模式）
  useEffect(() => {
    if (isEditing) {
      const rule = mockAlertRules.find((r) => r.id === params.id);
      if (rule) {
        setSelectedDimension(rule.dimension);
        setAutoRecoveryEnabled(rule.autoRecovery?.enabled ?? false);
        form.setFieldsValue({
          name: rule.name,
          description: rule.description,
          level: rule.level,
          dimension: rule.dimension,
          metricName: rule.metricName,
          aggregation: rule.aggregation,
          windowMinutes: rule.windowMinutes,
          triggerOperator: rule.trigger.operator,
          triggerThreshold: rule.trigger.threshold,
          triggerUnit: rule.trigger.unit,
          continuousHits: rule.continuousHits,
          silentMinutes: rule.silentMinutes,
          autoRecovery: rule.autoRecovery.enabled,
          recoveryWindow: rule.autoRecovery.windowCount,
          scopeType: rule.scope.type,
          scopeDepartments: rule.scope.departments,
          scopeAgents: rule.scope.agents,
          owner: rule.owner,
          enabled: rule.enabled,
          notificationChannels: rule.notification.channels,
          notificationTargets: rule.notification.targets,
          notificationTemplate: rule.notification.templateId,
          rateLimitPerHour: rule.notification.rateLimitPerHour ?? 6,
        });
        if (rule.remediation) {
          setRemediationRows(
            rule.remediation.possibleCauses.map((c, i) => ({
              id: `r${i}`,
              cause: c,
              action: rule.remediation!.actions[i] || '',
            })),
          );
        }
      }
    }
  }, [isEditing, params.id, form]);

  // 添加修复建议行
  const addRemediationRow = () => {
    setRemediationRows([
      ...remediationRows,
      { id: Date.now().toString(), cause: '', action: '' },
    ]);
  };
  const removeRemediationRow = (id: string) => {
    if (remediationRows.length === 1) return;
    setRemediationRows(remediationRows.filter((row) => row.id !== id));
  };
  const updateRemediationRow = (id: string, field: 'cause' | 'action', value: string) => {
    setRemediationRows(
      remediationRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  // 规则预览拼接
  const updatePreview = () => {
    const v = form.getFieldsValue(true);
    const metric = v.metricName || '指标';
    const op = v.triggerOperator || '>';
    const thr = v.triggerThreshold || '阈值';
    const unit = v.triggerUnit || '';
    const win = v.windowMinutes || 5;
    const cnt = v.continuousHits || 1;
    const lvl = levelOptions.find((o) => o.value === v.level)?.label || '严重';
    setPreview(`当 ${metric} 在 ${win} 分钟窗口内 ${op} ${thr}${unit}，连续 ${cnt} 次触发${lvl}告警`);
  };

  // 保存规则
  const handleSave = async (asEnabled: boolean) => {
    try {
      await form.validateFields();
      const validRemediation = remediationRows
        .filter((row) => row.cause.trim() || row.action.trim())
        .map((row, idx) => ({ order: idx + 1, cause: row.cause, action: row.action }));

      // eslint-disable-next-line no-console
      console.log('Save alert rule:', { ...form.getFieldsValue(true), remediation: validRemediation, enabled: asEnabled });
      message.success(isEditing ? '规则更新成功' : (asEnabled ? '规则已保存并启用' : '规则已保存为草稿'));
      navigate('/app/monitoring/alerts');
    } catch (e) {
      // 校验失败
    }
  };

  // 取消返回
  const handleCancel = () => {
    Modal.confirm({
      title: '确认离开？',
      content: '当前有未保存的修改，确认离开本页？',
      okText: '确认离开',
      cancelText: '继续编辑',
      onOk: () => navigate('/app/monitoring/alerts'),
    });
  };

  // 测试规则（回放 24h 数据预估触发次数）
  const handleTestRule = () => {
    const est = Math.floor(Math.random() * 12) + 1;
    Modal.info({
      title: '规则回放预估',
      content: (
        <Space direction="vertical">
          <Text>以最近 24 小时历史数据回放，预估该规则会触发 <Text strong style={{ color: '#FF4D4F' }}>{est}</Text> 次告警。</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>建议结合预期告警量调整阈值与静默时间。</Text>
        </Space>
      ),
    });
  };

  // 修复建议行
  const remediationSection = useMemo(() => (
    <div>
      <Text strong>修复建议（可能原因 ↔ 处置动作）</Text>
      <Text type="secondary" style={{ marginLeft: 8 }}>每行一组对应关系，触发告警时按行序号成对带入 8-5 详情抽屉</Text>

      {remediationRows.map((row, index) => (
        <Row key={row.id} gutter={8} style={{ marginTop: 12 }} align="middle">
          <Col flex="240px">
            <Input
              placeholder={`可能原因 ${index + 1}`}
              value={row.cause}
              onChange={(e) => updateRemediationRow(row.id, 'cause', e.target.value)}
              maxLength={50}
              suffix={<Text type="secondary" style={{ fontSize: 11 }}>{row.cause.length}/50</Text>}
            />
          </Col>
          <Col style={{ width: 28, textAlign: 'center' }}><Text>→</Text></Col>
          <Col flex="1">
            <Input
              placeholder={`处置动作 ${index + 1}（与上一行原因一一对应）`}
              value={row.action}
              onChange={(e) => updateRemediationRow(row.id, 'action', e.target.value)}
              maxLength={100}
              suffix={<Text type="secondary" style={{ fontSize: 11 }}>{row.action.length}/100</Text>}
            />
          </Col>
          <Col style={{ width: 32, textAlign: 'center' }}>
            <Button
              type="text" danger icon={<MinusCircleOutlined />}
              onClick={() => removeRemediationRow(row.id)}
              disabled={remediationRows.length === 1}
            />
          </Col>
        </Row>
      ))}

      <Button
        type="dashed" icon={<PlusOutlined />}
        onClick={addRemediationRow} style={{ marginTop: 12, width: '100%' }}
      >
        添加一行
      </Button>
    </div>
  ), [remediationRows]);

  return (
    <div style={{ padding: 24, paddingBottom: 96, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* 顶部导航 + 标题 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleCancel}>返回告警管理</Button>
        </Space>
        <Paragraph style={{ margin: '16px 0 0', fontSize: 20, fontWeight: 600 }}>
          {isEditing ? '编辑告警规则' : '新建告警规则'}
        </Paragraph>
        <Text type="secondary">配置告警规则、阈值、通知方式；规则触发后事件由 8-5 告警事件处置页查看与处置</Text>
      </Card>

      <Row gutter={16}>
        <Col flex="1">
          <Form
            form={form} layout="vertical" requiredMark="optional"
            initialValues={{
              enabled: true,
              level: 'severe',
              dimension: 'business',
              metricName: '任务完成率',
              aggregation: 'avg',
              windowMinutes: 5,
              triggerOperator: '<',
              triggerThreshold: 95,
              triggerUnit: '%',
              continuousHits: 2,
              silentMinutes: 30,
              autoRecovery: false,
              recoveryWindow: 2,
              notificationChannels: ['station', 'sms'],
              notificationTargets: ['it_admin'],
              notificationTemplate: 'tpl_severe',
              rateLimitPerHour: 6,
              scopeType: 'all',
              owner: '黄帅帅',
            }}
            onValuesChange={() => updatePreview()}
          >
            {/* ① 告警基本信息 */}
            <Card id="sec-basic" bordered={false} style={{ marginBottom: 16 }} title="① 告警基本信息">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                    <Input placeholder="请输入规则名称（同一工作区内唯一）" maxLength={50} showCount />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="level" label="告警级别" rules={[{ required: true, message: '请选择告警级别' }]}>
                    <Select placeholder="请选择" options={levelOptions} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="description" label="规则描述">
                    <TextArea placeholder="说明规则的业务含义、适用场景，便于团队协同理解" rows={2} maxLength={200} showCount />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="scopeType" label="生效范围" rules={[{ required: true, message: '请选择生效范围' }]}>
                    <Select
                      options={[
                        { label: '全院', value: 'all' },
                        { label: '指定科室', value: 'department' },
                        { label: '指定智能体', value: 'agent' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="scopeDepartments" label="指定科室（多选）" dependencies={['scopeType']}>
                    {({ getFieldValue }) => {
                      const t = getFieldValue('scopeType');
                      return t === 'department' ? (
                        <Select mode="multiple" placeholder="选择科室" options={['心内科', '影像科', '医务科', '药剂科', '急诊科', '内科', '门诊部', '体检科'].map((v) => ({ label: v, value: v }))} />
                      ) : <Input disabled placeholder="仅在「指定科室」时可编辑" />;
                    }}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="scopeAgents" label="指定智能体（多选）" dependencies={['scopeType']}>
                    {({ getFieldValue }) => {
                      const t = getFieldValue('scopeType');
                      return t === 'agent' ? (
                        <Select mode="multiple" showSearch placeholder="选择智能体" options={['心电图智能辅助诊断系统', '胸部 CT 影像智能分析平台', '病历智能生成与质控系统', '智能导诊与分诊系统'].map((v) => ({ label: v, value: v }))} />
                      ) : <Input disabled placeholder="仅在「指定智能体」时可编辑" />;
                    }}
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="owner" label="规则负责人" rules={[{ required: true, message: '请输入负责人' }]}>
                    <Input placeholder="默认为创建人" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="enabled" label="启用状态" valuePropName="checked">
                    <Switch checkedChildren="启用" unCheckedChildren="停用" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* ② 告警指标 */}
            <Card id="sec-metric" bordered={false} style={{ marginBottom: 16 }} title="② 告警指标">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="dimension" label="监控维度" rules={[{ required: true, message: '请选择监控维度' }]}>
                    <Select
                      placeholder="请选择" options={dimensionOptions}
                      onChange={(v) => setSelectedDimension(v)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="metricName" label="监控指标" rules={[{ required: true, message: '请选择监控指标' }]}>
                    <Select
                      placeholder="请选择"
                      // V1.7 §8-6：监控指标下拉右侧加 ⓘ Tooltip，鼠标悬浮单个选项时弹出该指标描述
                      optionRender={(option) => {
                        const label = String(option.label || option.value);
                        const meta = getMetricMeta(label);
                        return (
                          <Space size={6} style={{ width: '100%' }}>
                            <span style={{ flex: 1 }}>{label}</span>
                            <Tooltip
                              title={
                                <div style={{ maxWidth: 280 }}>
                                  <div>{meta.definition}</div>
                                  {meta.unit && <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.7)' }}>单位：{meta.unit}</div>}
                                  {meta.threshold && <div style={{ color: 'rgba(255,255,255,0.7)' }}>建议阈值：{meta.threshold}</div>}
                                  {meta.priority && <div style={{ color: 'rgba(255,255,255,0.7)' }}>指标分级：{meta.priority}</div>}
                                </div>
                              }
                              color="#1F1F1F"
                              mouseEnterDelay={0.3}
                            >
                              <QuestionCircleOutlined style={{ color: '#BFBFBF', fontSize: 12 }} onClick={(e) => e.stopPropagation()} />
                            </Tooltip>
                          </Space>
                        );
                      }}
                      options={(metricLibrary[selectedDimension] || []).map((m) => ({
                        label: `${m.label} (${m.defaultUnit}) · 参考 ${m.thresholdHint}`,
                        value: m.label,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="aggregation" label="聚合方式" rules={[{ required: true, message: '请选择聚合方式' }]}>
                    <Select placeholder="请选择" options={aggregationOptions} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="windowMinutes" label="统计窗口" rules={[{ required: true, message: '请选择统计窗口' }]}>
                    <Select placeholder="请选择" options={windowOptions} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="filters" label="过滤条件（可选，多条件 AND 组合）">
                    <Input placeholder="如：科室=心内科 AND 模型=GPT-4（条件构造器占位）" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* ③ 告警规则配置 */}
            <Card id="sec-rule" bordered={false} style={{ marginBottom: 16 }} title="③ 告警规则配置">
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name="triggerOperator" label="运算符" rules={[{ required: true, message: '请选择' }]}>
                    <Select options={operatorOptions} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="triggerThreshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="triggerUnit" label="单位（与指标联动）">
                    <Input placeholder="ms / % / 元" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="continuousHits" label={
                    <Space>连续触发次数 ⓘ<Tooltip title={fieldTooltips.continuousHits}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  } rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="次" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="silentMinutes" label={
                    <Space>静默时间 ⓘ<Tooltip title={fieldTooltips.silentMinutes}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  } rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber min={5} style={{ width: '100%' }} addonAfter="分钟" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="autoRecovery" label={
                    <Space>自动恢复 ⓘ<Tooltip title={fieldTooltips.autoRecovery}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  } valuePropName="checked">
                    <Switch onChange={setAutoRecoveryEnabled} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="recoveryWindow" label={
                    <Space>恢复窗口数 ⓘ<Tooltip title={fieldTooltips.recoveryWindow}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  }>
                    <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="个窗口" disabled={!autoRecoveryEnabled} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />
              {remediationSection}
              <Divider style={{ margin: '12px 0' }} />

              <Form.Item label="规则预览">
                <Card size="small" style={{ background: '#F0F5FF', borderColor: '#ADC6FF' }}>
                  <Space>
                    <Tag color="blue">实时预览</Tag>
                    <Text>{preview}</Text>
                  </Space>
                </Card>
              </Form.Item>
            </Card>

            {/* ④ 告警通知 */}
            <Card id="sec-notify" bordered={false} title="④ 告警通知">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="notificationChannels" label="通知方式" rules={[{ required: true, message: '请选择通知方式' }]}>
                    <Select mode="multiple" placeholder="请选择" options={notificationChannelOptions} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="notificationTargets" label="通知对象" rules={[{ required: true, message: '请选择通知对象' }]}>
                    <Select
                      mode="multiple" placeholder="请选择"
                      options={[
                        { label: 'IT 管理员', value: 'it_admin' },
                        { label: '规则负责人', value: 'rule_owner' },
                        { label: '自定义用户组', value: 'custom_group' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="notificationTemplate" label="通知模板" rules={[{ required: true, message: '请选择通知模板' }]}>
                    <Select placeholder="请选择" options={notificationTemplateOptions} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="rateLimitPerHour" label="通知频率限制">
                    <InputNumber min={1} max={100} style={{ width: '100%' }} addonAfter="次/小时" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quietHours" label="免打扰时段">
                    <RangePicker picker="time" format="HH:mm" style={{ width: '100%' }} placeholder={['开始', '结束']} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="escalationEnabled" label="升级策略" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="escalationCondition" label="升级条件" dependencies={['escalationEnabled']}>
                    {({ getFieldValue }) => (
                      <Select
                        disabled={!getFieldValue('escalationEnabled')}
                        placeholder="未处置超时 / 重复触发达 N 次"
                        options={escalationConditionOptions}
                      />
                    )}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="escalationTargets" label="升级对象" dependencies={['escalationEnabled']}>
                    {({ getFieldValue }) => (
                      <Select
                        mode="multiple" disabled={!getFieldValue('escalationEnabled')}
                        placeholder="上级管理员 / 信息科主管 / 自定义用户组"
                        options={escalationTargetOptions}
                      />
                    )}
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Form>
        </Col>

        {/* 右侧锚点导航 */}
        <Col flex="200px">
          <Card bordered={false} style={{ position: 'sticky', top: 24 }}>
            <Anchor
              offsetTop={80}
              items={[
                { key: 'sec-basic', href: '#sec-basic', title: '① 告警基本信息' },
                { key: 'sec-metric', href: '#sec-metric', title: '② 告警指标' },
                { key: 'sec-rule', href: '#sec-rule', title: '③ 告警规则配置' },
                { key: 'sec-notify', href: '#sec-notify', title: '④ 告警通知' },
              ]}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>说明</Text>
              <Text style={{ fontSize: 12 }}>· 规则触发后事件上报 8-5 告警事件处置</Text>
              <Text style={{ fontSize: 12 }}>· 可能原因↔处置动作按行成对带入 8-5 详情</Text>
              <Text style={{ fontSize: 12 }}>· 处置完成自动同步审计中心（模块 12）</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 底部操作栏 - 吸底固定（V1.7：交给 BasicLayout 自动避开侧边栏，ProLayout 已为 fixed 元素让出空间） */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '16px 24px', background: '#fff',
          borderTop: '1px solid #f0f0f0', zIndex: 100,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
        }}
      >
        <Button type="text" icon={<PlayCircleOutlined />} onClick={handleTestRule}>测试规则</Button>
        <div style={{ flex: 1 }} />
        <Button onClick={handleCancel}>取消</Button>
        <Button onClick={() => handleSave(false)}>保存为草稿</Button>
        <Button type="primary" onClick={() => handleSave(true)}>保存并启用</Button>
      </div>
    </div>
  );
};

export default AlertRuleForm;
