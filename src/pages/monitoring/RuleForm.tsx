/**
 * 5.2 新建规则页 / 5.3 规则编辑入口（V2.0）
 * 需求文档：统一运行监控中心-需求说明文档 V2.0 §5.2 / §5.3
 *
 * 字段：规则名称 / 规则类型 / 触发条件
 * 按钮：选择模板 / 暂存 / 模板下载 / 提交
 *
 * V2.0 调整（相对 V1.8）：
 * - 新增「选择模板」抽屉（从页面右侧滑出），抽屉内 5 个分类 Tab：
 *   全部 / 业务监控告警规则 / 状态监控告警规则 / 成本监控告警规则 / 安全监控告警规则
 *   支持按规则名称搜索；选中后点击【确认带入】自动填充规则名称 / 规则类型 /
 *   触发条件 / 触发动作 / 输出提示词等字段
 * - 选择模板抽屉数据源 = 下方「告警规则模板库」四大类（按规则类型自动筛选）
 * - 校验：必填字段缺失气泡提示具体原因
 * - 暂存：保存到「医院资源管理中心 → 资源管理 → 草稿」
 * - 模板下载：导出 .csv 模板
 *
 * V2.0.1 进一步精简：去掉表单内「规则内容」与「规则文件上传」两 Card 区域，
 *   选择模板入口收敛至右侧锚点卡 + 底部吸底操作栏。
 * V2.0.2 进一步收敛：去掉右侧锚点卡，「选择模板」按钮上移至 PageHeader extra
 *   与标题栏同行右侧，底部吸底栏保留模板下载 / 选择模板 / 取消 / 暂存 / 提交。
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Space, Button, Form, Row, Col, Input, Select, InputNumber, Typography,
  message, Modal, Tag, Tooltip, Drawer, List, Empty, Segmented,
} from 'antd';
import {
  ArrowLeftOutlined, CloudUploadOutlined,
  QuestionCircleOutlined, BookOutlined, CheckOutlined, SearchOutlined,
  MinusOutlined, PlusOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { PermissionDenied } from '../../components/PageStates';
import {
  mockAlertRulesV18, mockAlertRuleLibrary, mockMetricCatalog, AlertRuleTypeLabels,
  AlertRuleTypeToMetricGroup, type AlertRuleV18, type AlertRuleType,
  type AlertRuleContent, type MetricOption,
} from '../../mock/monitoringV18';
import { mockAgentMonitoringData } from '../../mock/monitoring';
import { useMonitoringGuard } from './useMonitoringGuard';

const { Text } = Typography;

const operatorOptions = [
  { label: '>', value: '>' }, { label: '<', value: '<' },
  { label: '>=', value: '>=' }, { label: '<=', value: '<=' }, { label: '=', value: '=' },
];

const ALL_AGENTS = 'all';
const DEFAULT_NOTIFICATION_CONTENT = `智能体【{agent_name}】在{time_window}内出现异常：
指标：{metric}
当前值：{current_value}
阈值：{threshold}`;

const agentOptions = [
  { label: '全部 Agent', value: ALL_AGENTS },
  ...mockAgentMonitoringData.map((agent) => ({
    label: `${agent.agentName}（${agent.department}）`,
    value: agent.agentId,
  })),
];

const alertFrequencyOptions = [
  { label: '始终重复告警', value: 0 },
  { label: '每5分钟告警一次', value: 5 },
  { label: '每10分钟告警一次', value: 10 },
  { label: '每15分钟告警一次', value: 15 },
  { label: '每30分钟告警一次', value: 30 },
  { label: '每1小时告警一次', value: 60 },
  { label: '每2小时告警一次', value: 120 },
  { label: '每3小时告警一次', value: 180 },
  { label: '每6小时告警一次', value: 360 },
  { label: '每1天告警一次', value: 1440 },
];

const fieldLabelWithHelp = (label: string, help: string) => (
  <Space size={4}>
    {label}
    <Tooltip title={help}>
      <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
    </Tooltip>
  </Space>
);

const EXECUTION_INTERVAL_MIN = 1;
const EXECUTION_INTERVAL_MAX = 1440;

type ExecutionIntervalInputProps = {
  value?: number | null;
  onChange?: (value: number | null) => void;
};

const ExecutionIntervalInput = ({ value, onChange }: ExecutionIntervalInputProps) => {
  const currentValue = typeof value === 'number' ? value : EXECUTION_INTERVAL_MIN;
  const normalizeValue = (nextValue: number) => (
    Math.min(EXECUTION_INTERVAL_MAX, Math.max(EXECUTION_INTERVAL_MIN, nextValue))
  );
  const updateValue = (nextValue: number) => onChange?.(normalizeValue(nextValue));

  return (
    <Space.Compact>
      <span
        style={{
          height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 14px',
          border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px',
          background: '#fafafa', color: 'rgba(0, 0, 0, 0.88)', whiteSpace: 'nowrap',
        }}
      >
        每
      </span>
      <Button
        icon={<MinusOutlined />}
        aria-label="执行周期减 1 分钟"
        disabled={currentValue <= EXECUTION_INTERVAL_MIN}
        onClick={() => updateValue(currentValue - 1)}
        style={{ width: 40 }}
      />
      <InputNumber
        min={EXECUTION_INTERVAL_MIN}
        max={EXECUTION_INTERVAL_MAX}
        precision={0}
        controls={false}
        value={value}
        onChange={(nextValue) => onChange?.(nextValue === null ? null : normalizeValue(nextValue))}
        aria-label="执行周期（分钟）"
        style={{ width: 88, textAlign: 'center' }}
      />
      <Button
        icon={<PlusOutlined />}
        aria-label="执行周期加 1 分钟"
        disabled={currentValue >= EXECUTION_INTERVAL_MAX}
        onClick={() => updateValue(currentValue + 1)}
        style={{ width: 40 }}
      />
      <span
        style={{
          height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 14px',
          border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0',
          background: '#fafafa', color: 'rgba(0, 0, 0, 0.88)', whiteSpace: 'nowrap',
        }}
      >
        分钟
      </span>
    </Space.Compact>
  );
};

// 「选择模板」抽屉 5 个分类
const DRAWER_TABS = [
  { key: 'all', label: '全部' },
  { key: '业务执行', label: '业务监控告警规则' },
  { key: '运行状态', label: '状态监控告警规则' },
  { key: '成本资源', label: '成本监控告警规则' },
  { key: '安全', label: '安全监控告警规则' },
];

const typeToCategory: Record<AlertRuleType, string> = {
  business: '业务执行', status: '运行状态', cost: '成本资源', security: '安全',
};

// 「指标」下拉分组顺序（与 PRD 4 大类一致）
const METRIC_GROUPS = ['业务监控', '状态监控', '成本监控', '安全监控'] as const;

const RuleForm = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const isEditing = !!params.id;
  const { isAdmin } = useMonitoringGuard();
  const [form] = Form.useForm();
  const [selectedType, setSelectedType] = useState<AlertRuleType>('business');
  const [selectedContentId, setSelectedContentId] = useState<string | undefined>();

  // 抽屉状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<string>('all');
  const [drawerKeyword, setDrawerKeyword] = useState('');
  const [drawerSelectedId, setDrawerSelectedId] = useState<string | undefined>();
  const previewMetric = Form.useWatch('metric', form);
  const previewOperator = Form.useWatch('operator', form);
  const previewThreshold = Form.useWatch('threshold', form);
  const previewUnit = Form.useWatch('unit', form);

  useEffect(() => {
    if (isEditing && params.id) {
      const rule = mockAlertRulesV18.find((r) => r.id === params.id);
      if (rule) {
        setSelectedType(rule.type);
        setSelectedContentId(rule.ruleContentId);
        form.setFieldsValue({
          name: rule.name,
          type: rule.type,
          monitorTargets: rule.monitorTargets || [ALL_AGENTS],
          executionIntervalMinutes: rule.executionIntervalMinutes || 5,
          notificationIntervalMinutes: rule.notificationIntervalMinutes ?? 30,
          alertConsecutiveCycles: rule.alertConsecutiveCycles || 1,
          notificationContent: rule.notificationContent || DEFAULT_NOTIFICATION_CONTENT,
          metric: rule.triggerCondition.metric,
          operator: rule.triggerCondition.operator,
          threshold: rule.triggerCondition.threshold,
          unit: rule.triggerCondition.thresholdUnit,
        });
      }
    }
  }, [isEditing, params.id, form]);

  // 抽屉内的内容库（按 Tab + 关键词过滤）— useMemo 必须在 early return 之前调用
  const drawerOptions = useMemo(() => {
    let arr: AlertRuleContent[] = mockAlertRuleLibrary;
    if (drawerTab !== 'all') arr = arr.filter((c) => c.category === drawerTab);
    const k = drawerKeyword.trim();
    if (k) arr = arr.filter((c) => c.name.includes(k) || c.condition.includes(k));
    return arr;
  }, [drawerTab, drawerKeyword]);

  // 「指标」下拉选项：按当前规则类型联动 —— 优先展示对应分组，
  // 其余 3 大类兜底可选；已选中的指标若不在上述分组也回显
  const metricOptions = useMemo(() => {
    const currentGroup = AlertRuleTypeToMetricGroup[selectedType];
    const currentValue: string | undefined = form.getFieldValue('metric');
    const seen = new Set<string>();
    const groups: { label: string; options: { value: string; label: string; data: MetricOption }[] }[] = [];

    // 1. 当前规则类型对应分组
    if (currentGroup && mockMetricCatalog[currentGroup]) {
      groups.push({
        label: `${AlertRuleTypeLabels[selectedType]}（当前类目）`,
        options: mockMetricCatalog[currentGroup].map((m) => {
          seen.add(m.label);
          return { value: m.label, label: m.label, data: m };
        }),
      });
    }

    // 2. 其余 3 大类
    METRIC_GROUPS.filter((g) => g !== currentGroup).forEach((g) => {
      const opts = mockMetricCatalog[g]
        .filter((m) => !seen.has(m.label))
        .map((m) => {
          seen.add(m.label);
          return { value: m.label, label: m.label, data: m };
        });
      if (opts.length) groups.push({ label: g, options: opts });
    });

    // 3. 已选中但不在上述分组（兜底回显，避免空选）
    if (currentValue && !seen.has(currentValue)) {
      groups.unshift({
        label: '已选',
        options: [{ value: currentValue, label: currentValue, data: { label: currentValue } }],
      });
    }

    return groups;
  }, [selectedType, form]);

  if (!isAdmin) return <PermissionDenied message="告警规则管理仅面向 IT 管理员" />;

  const previewText = `当 ${previewMetric || '指标'} ${previewOperator || '>'} ${previewThreshold ?? '阈值'}${previewUnit || ''} 时触发告警`;

  // 点击【确认带入】 → 写入表单
  const handleConfirmImportTemplate = () => {
    if (!drawerSelectedId) {
      message.warning('请先选中一个模板');
      return;
    }
    const tpl = mockAlertRuleLibrary.find((c) => c.id === drawerSelectedId);
    if (!tpl) return;
    // 自动按模板填字段（解析 condition 拆出 metric/operator/threshold/unit/sustain）
    // 模板形如：「CPU 使用率 > 90% 持续 5 分钟」/「Token 消耗 > 7 日基线 × 3（10 分钟窗口）」
    const condStr = tpl.condition;
    const opMatch = condStr.match(/(>=|<=|>|<|=)/);
    const operator = (opMatch?.[1] as '>' | '<' | '>=' | '<=' | '=') || '>';
    const before = opMatch ? condStr.split(opMatch[1])[0].trim() : condStr;
    const after = opMatch ? condStr.split(opMatch[1])[1]?.trim() || '' : '';

    // 优先尝试从 4 大类指标库里匹配精确指标名（保证下拉能高亮选中）
    const matchedMetric =
      Object.values(mockMetricCatalog)
        .flat()
        .find((m) => before.startsWith(m.label))?.label
      || (before.length > 16 ? before.slice(0, 16) : before);
    // 提取阈值（数字）+ 单位
    const numMatch = after.match(/(\d+(\.\d+)?)/);
    const threshold = numMatch ? Number(numMatch[1]) : 0;
    const unit = (after.match(/[%a-zA-Z\/]+/) || [''])[0] || undefined;
    const tplType: AlertRuleType =
      tpl.category === '业务执行' ? 'business' :
      tpl.category === '运行状态' ? 'status' :
      tpl.category === '成本资源' ? 'cost' : 'security';

    setSelectedType(tplType);
    setSelectedContentId(tpl.id);
    form.setFieldsValue({
      name: tpl.name,
      type: tplType,
      metric: matchedMetric,
      operator,
      threshold,
      unit,
      notificationContent: tpl.outputPromptTemplate || DEFAULT_NOTIFICATION_CONTENT,
    });
    message.success(`已带入模板：${tpl.name}`);
    setDrawerOpen(false);
  };

  // 暂存（保存为草稿到注册资源草稿页）
  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      // eslint-disable-next-line no-console
      console.log('暂存告警规则（草稿）:', values);
      message.success('已暂存到草稿，可前往「医院资源管理中心 → 资源管理 → 草稿」继续编辑');
    } catch {
      // 校验失败 — 已有气泡
    }
  };

  // 提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedContentId) {
        message.error('请先点击「选择模板」从内容库带入规则内容');
        return;
      }
      const content = mockAlertRuleLibrary.find((c) => c.id === selectedContentId);
      // 持久化到 mock（演示用：直接 push 到 mock 数组，让列表页 / 详情页可立即看到）
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const newId = `rule-v18-${Date.now()}`;
      const triggerCondition = {
        metric: values.metric,
        operator: values.operator,
        threshold: values.threshold,
        thresholdUnit: values.unit,
        sustainDuration: '实时',
        description: `${values.metric} ${values.operator} ${values.threshold}${values.unit || ''}`,
      };
      const newRule: AlertRuleV18 = {
        id: isEditing && params.id ? params.id : newId,
        name: values.name,
        type: values.type,
        monitorTargets: values.monitorTargets,
        executionIntervalMinutes: values.executionIntervalMinutes,
        notificationIntervalMinutes: values.notificationIntervalMinutes,
        alertConsecutiveCycles: values.alertConsecutiveCycles,
        notificationContent: values.notificationContent,
        triggerCondition,
        triggerAction: 'warn',
        ruleContentId: selectedContentId,
        ruleConfig: {
          rule_name: values.name,
          trigger_time: now,
          trigger_condition: triggerCondition,
          trigger_action: 'warn',
          output_prompt: values.notificationContent || content?.outputPromptTemplate || '',
        },
        enabled: true,
        createdBy: '黄帅帅',
        createdAt: now,
        updatedAt: now,
        trigger7d: 0,
      };
      if (isEditing && params.id) {
        const idx = mockAlertRulesV18.findIndex((r) => r.id === params.id);
        if (idx >= 0) mockAlertRulesV18[idx] = { ...mockAlertRulesV18[idx], ...newRule };
      } else {
        mockAlertRulesV18.unshift(newRule);
      }
      message.success(isEditing ? '规则更新成功' : '规则创建成功');
      navigate('/app/monitoring/alert-rules');
    } catch (e: any) {
      if (e?.errorFields?.length > 0) {
        const first = e.errorFields[0];
        message.error(`校验失败：${first.errors?.[0] || '请检查必填字段'}（${first.name?.join(' / ')}）`);
      }
    }
  };

  return (
    <div style={{ padding: 24, paddingBottom: 96, background: '#F5F5F5', minHeight: '100vh' }}>
      <PageHeader
        title={isEditing ? '编辑规则' : '新建规则'}
        subTitle="配置告警规则与触发条件；点击「选择模板」从模板库一键带入。仅 IT 管理员可访问"
        showBack
        onBack={() => navigate('/app/monitoring/alert-rules')}
        breadcrumb={[
          { path: '/app/monitoring', breadcrumbName: '统一运行监控中心' },
          { path: '/app/monitoring/alert-rules', breadcrumbName: '告警规则管理' },
          { path: '', breadcrumbName: isEditing ? '编辑规则' : '新建规则' },
        ]}
        extra={
          <Button type="primary" icon={<BookOutlined />} onClick={() => {
            setDrawerTab('all');
            setDrawerKeyword('');
            setDrawerSelectedId(selectedContentId);
            setDrawerOpen(true);
          }}>
            选择模板
          </Button>
        }
      />

      <div style={{ marginTop: 16 }}>
        <Form
          form={form} layout="vertical" requiredMark="optional"
          initialValues={{
            type: 'business', operator: '>', unit: '%',
            monitorTargets: [ALL_AGENTS], executionIntervalMinutes: 5,
            notificationIntervalMinutes: 30, alertConsecutiveCycles: 1,
            notificationContent: DEFAULT_NOTIFICATION_CONTENT,
          }}
        >
            {/* ① 基本信息 */}
            <Card id="sec-basic" bordered={false} style={{ marginBottom: 16 }} title="① 规则基本信息">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }, { max: 50, message: '规则名称不超过 50 字符' }]}>
                    <Input placeholder="请输入规则名称（同一工作区内唯一）" maxLength={50} showCount />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="type" label="规则类型" rules={[{ required: true, message: '请选择规则类型' }]}>
                    <Select
                      placeholder="请选择" options={[
                        { label: '业务监控告警规则', value: 'business' },
                        { label: '状态监控告警规则', value: 'status' },
                        { label: '成本监控告警规则', value: 'cost' },
                        { label: '安全监控告警规则', value: 'security' },
                      ]}
                      onChange={(v) => {
                        setSelectedType(v);
                        setSelectedContentId(undefined);
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="monitorTargets" label="监控对象" rules={[{ required: true, message: '请选择监控对象' }]}>
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount="responsive"
                  placeholder="请选择一个或多个 Agent"
                  options={agentOptions}
                  onSelect={(value: string) => {
                    if (value === ALL_AGENTS) {
                      form.setFieldValue('monitorTargets', [ALL_AGENTS]);
                    } else {
                      const selected = form.getFieldValue('monitorTargets') as string[];
                      form.setFieldValue('monitorTargets', selected.filter((item) => item !== ALL_AGENTS));
                    }
                  }}
                />
              </Form.Item>
            </Card>

            {/* ② 触发条件 */}
            <Card id="sec-trigger" bordered={false} style={{ marginBottom: 16 }} title="② 触发条件">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="metric" label="指标" rules={[{ required: true, message: '请选择指标' }]}>
                    <Select
                      showSearch
                      placeholder="按规则类型筛选，可跨大类搜索"
                      optionFilterProp="label"
                      options={metricOptions}
                      onChange={(value, option) => {
                        // 选中后自动带入推荐单位 / 默认阈值（仅在用户尚未手动改过单位 / 阈值时）
                        const meta = (option as any)?.data as MetricOption | undefined;
                        if (!meta) return;
                        const cur = form.getFieldsValue(['unit', 'threshold']);
                        form.setFieldsValue({
                          unit: meta.unit ?? cur.unit,
                          threshold: meta.defaultThreshold ?? cur.threshold,
                        });
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="operator" label="运算符" rules={[{ required: true, message: '请选择' }]}>
                    <Select options={operatorOptions} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]}>
                    <InputNumber style={{ width: '100%' }} placeholder="如：90" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="unit" label="单位">
                    <Input placeholder="如：% / ms / 元" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="条件预览">
                <Card size="small" style={{ background: '#F0F5FF', borderColor: '#ADC6FF' }}>
                  <Space>
                    <Tag color="blue">实时预览</Tag>
                    <Text>{previewText}</Text>
                  </Space>
                </Card>
              </Form.Item>
            </Card>

            <Card id="sec-notification" bordered={false} style={{ marginBottom: 16 }} title="③ 监控与通知配置">
              <Row gutter={[32, 0]} align="top" wrap>
                <Col flex="0 0 300px">
                  <Form.Item name="executionIntervalMinutes" label={fieldLabelWithHelp('执行周期', '按固定时间间隔执行一次监控任务，支持 1～1440 分钟')} rules={[{ required: true, message: '请输入执行周期' }]}>
                    <ExecutionIntervalInput />
                  </Form.Item>
                </Col>
                <Col flex="1 1 620px" style={{ maxWidth: 820 }}>
                  <Form.Item label={fieldLabelWithHelp('告警频率', '连续多个监控周期满足触发条件后产生告警；可设置重复告警的最短时间间隔')} required>
                    <Space.Compact style={{ width: '100%' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px', background: '#fafafa', whiteSpace: 'nowrap' }}>持续</span>
                      <Form.Item name="alertConsecutiveCycles" noStyle rules={[{ required: true, message: '请输入持续监控周期数' }]}>
                        <InputNumber min={1} max={100} precision={0} controls style={{ width: 92 }} aria-label="持续监控周期数" />
                      </Form.Item>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderTop: '1px solid #d9d9d9', borderBottom: '1px solid #d9d9d9', background: '#fafafa', whiteSpace: 'nowrap' }}>个监控周期满足触发条件，则</span>
                      <Form.Item name="notificationIntervalMinutes" noStyle rules={[{ required: true, message: '请选择告警频率' }]}>
                        <Select options={alertFrequencyOptions} style={{ flex: 1, minWidth: 190 }} popupMatchSelectWidth />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notificationContent" label={fieldLabelWithHelp('通知内容', '支持变量：{agent_name}、{time_window}、{metric}、{current_value}、{threshold}')} rules={[{ required: true, whitespace: true, message: '请输入通知内容' }]}>
                <Input.TextArea rows={6} maxLength={500} showCount placeholder="请输入告警命中后发送的通知内容" />
              </Form.Item>
            </Card>

            {/* 规则内容 / 规则文件上传 已合并至顶部「选择模板」入口（PageHeader extra）+ 底部吸底操作栏 */}
          </Form>
        </div>

      {/* 底部操作栏（吸底） */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 24px', background: '#fff',
          borderTop: '1px solid #f0f0f0', zIndex: 100,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}
      >
        <span />
        <Space>
          <Button onClick={() => navigate('/app/monitoring/alert-rules')}>取消</Button>
          <Button onClick={handleSaveDraft}>暂存</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleSubmit}>
            {isEditing ? '保存' : '提交'}
          </Button>
        </Space>
      </div>

      {/* 「选择告警规则模板」抽屉（PRD §5.2：从页面右侧滑出） */}
      <Drawer
        title="选择告警规则模板"
        placement="right" width={760}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={
          <Tag color="blue">{drawerOptions.length} 个模板</Tag>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button type="primary" icon={<CheckOutlined />} disabled={!drawerSelectedId} onClick={handleConfirmImportTemplate}>
                确认带入
              </Button>
            </Space>
          </div>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input
            allowClear prefix={<SearchOutlined />}
            placeholder="按规则名称 / 触发条件搜索"
            value={drawerKeyword}
            onChange={(e) => setDrawerKeyword(e.target.value)}
          />
          <Segmented
            block
            value={drawerTab}
            onChange={(v) => setDrawerTab(v as string)}
            options={DRAWER_TABS.map((t) => ({ label: t.label, value: t.key }))}
          />
          <List
            size="small"
            dataSource={drawerOptions}
            locale={{ emptyText: <Empty description="该类目下暂无模板" /> }}
            style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}
            renderItem={(c) => {
              const selected = drawerSelectedId === c.id;
              return (
                <List.Item
                  onClick={() => setDrawerSelectedId(c.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 12px',
                    background: selected ? '#E6F4FF' : 'transparent',
                    border: selected ? '1px solid #91CAFF' : '1px solid transparent',
                    borderRadius: 6,
                  }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      <Tag color={
                        c.category === '业务执行' ? 'blue' :
                        c.category === '运行状态' ? 'green' :
                        c.category === '成本资源' ? 'orange' : 'red'
                      }>{c.category}</Tag>
                      {selected && <Tag color="processing" icon={<CheckOutlined />}>已选中</Tag>}
                      <Text strong style={{ fontSize: 13 }}>{c.name}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>触发条件：{c.condition}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>模板 ID：{c.id}</Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Space>
      </Drawer>
    </div>
  );
};

export default RuleForm;
