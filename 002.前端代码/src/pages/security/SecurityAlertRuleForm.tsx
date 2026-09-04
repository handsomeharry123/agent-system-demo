/**
 * 8-3 告警规则 — 新建 / 编辑（独立下转页面）
 * 需求文档：统一安全治理中心-需求说明文档 V1.4
 *
 * 四大核心配置块（每块可折叠）：
 *   ① 告警基本信息
 *   ② 告警指标
 *   ③ 告警规则配置（含「可能原因 ↔ 处置动作」动态行编辑器 + 规则预览）
 *   ④ 告警通知（含免打扰时段、升级策略）
 *
 * 页面右侧锚点导航（基本信息 / 告警指标 / 规则配置 / 告警通知）
 * 底部吸底操作栏：保存并启用 / 保存为草稿 / 测试规则 / 取消
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card, Space, Button, Form, Row, Col, Divider, Anchor, Input, Select, InputNumber, Switch, Tooltip,
  Typography, message, Modal, Tag, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined, QuestionCircleOutlined, PlayCircleOutlined,
} from '@ant-design/icons';

import { mockAlertRules, mockCollectionConfigs } from '../../mock/security';
import {
  securityAlertLevelList,
  securityAggregationList,
  securityOperatorList,
  securityNotifyChannelList,
  securityNotifyTemplateList,
  escalationConditionList,
  escalationTargetList,
  checkFrequencyList,
  type AlertRule,
  type RemediationRow,
  type SecurityMetricKey,
  type SecurityDimension,
} from '../../types/security';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// 告警级别（V1.4：紧急/重要/一般 — 与 8-2 事件级别一致）
const alertLevelOptions = securityAlertLevelList.map((v) => ({ label: v, value: v }));

// 监控维度（V1.4：本页仅 系统/网络 可配置）
const dimensionOptions: { label: string; value: SecurityDimension }[] = [
  { label: '系统', value: '系统' },
  { label: '网络', value: '网络' },
];

// 指标候选（联动 A1 采集项，V1.4 系统/网络下未启用采集项置灰）
const metricOptions: Record<SecurityDimension, { label: string; value: SecurityMetricKey; aggregationHint: string }[]> = {
  系统: [
    { label: '服务间通信加密状态', value: '服务间通信加密状态', aggregationHint: '建议「状态命中」' },
    { label: '密码明文存放', value: '密码明文存放', aggregationHint: '建议「状态命中」' },
    { label: '内部访问认证', value: '内部访问认证', aggregationHint: '建议「状态命中」' },
    { label: '配置项基线偏离', value: '配置项基线偏离', aggregationHint: '建议「计数」' },
  ],
  网络: [
    { label: '高危端口暴露数', value: '高危端口暴露数', aggregationHint: '建议「计数」' },
    { label: '公网开放面', value: '公网开放面', aggregationHint: '建议「计数」' },
    { label: '内网隔离状态', value: '内网隔离状态', aggregationHint: '建议「状态命中」' },
  ],
  身份: [],
  数据: [],
  模型: [],
  应用: [],
};

// 统计窗口 = 检查频率（不可低于采集频率粒度；列表仅显示高于等于采集频率的项）
const windowOptions = checkFrequencyList.map((v) => ({ label: v, value: v }));

// 响应动作（V1.4：自动阻断/服务隔离 仅紧急级别可用）
const responseActionOptions = [
  { label: '告警通知', value: '告警通知' },
  { label: '自动阻断', value: '自动阻断' },
  { label: '服务隔离', value: '服务隔离' },
  { label: '仅记录', value: '仅记录' },
];

// 通知对象
const notifyTargetOptions = [
  { label: '平台管理员', value: '平台管理员' },
  { label: '规则负责人', value: '规则负责人' },
  { label: '自定义用户或用户组', value: '自定义用户或用户组' },
];

// 气泡说明（V1.4 字段说明）
const fieldTooltips: Record<string, string> = {
  continuousHits:
    '**一句话**：避免「狼来了」式误报。\n**怎么用**：指标需连续 N 次窗口都超阈才会告警，过滤一两次偶发抖动。\n**举例**：设为 2 次、每日窗口 → 需连续 2 天都超阈才报警。\n**心得**：设小了容易「报警刷屏」，设大了发现问题会变慢，推荐 2–3 次。',
  silentMinutes:
    '**一句话**：同一个问题，不要在短时间内反复推送。\n**怎么用**：告警发出后，在静默时间内不重复推送同样的告警通知。\n**举例**：设为 30 分钟 → 告警发出后 30 分钟内不会被同一个问题反复发短信。\n**心得**：防止半夜被同一个问题反复吵醒；紧急问题建议设短，一般问题可设长。',
  autoRecovery:
    '**一句话**：指标自己好了，告警自动关闭，人不用管。\n**怎么用**：开启后，指标回落到阈值以下时系统自动把告警置为「已恢复」，发一条站内恢复通知（不发短信）。\n**关闭时**：管理员需到 8-2 告警事件处置手动点「标记已关闭」。\n**心得**：波动较大的指标（如端口扫描结果）建议开启；需人工复盘的高危事件建议关闭。',
  recoveryWindow:
    '**一句话**：避免「假恢复」后告警反复开关。\n**怎么用**：指标要连续 N 次窗口都达标，系统才认可「真的恢复」。\n**举例**：设为 2 次、每日窗口 → 连续 2 天都达标才自动恢复。\n**设置**：N 取值 1–10，推荐 2 次；仅在「自动恢复」开启时生效。',
};

const SecurityAlertRuleForm = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!params.id;
  const isCopy = searchParams.get('copy') === '1';

  // 加载数据（编辑：按 id 取；新建/复制：取空 + 预填）
  const editingRule = useMemo(
    () => (isEditing && !isCopy ? mockAlertRules.find((r) => r.id === params.id) : undefined),
    [isEditing, isCopy, params.id],
  );

  const [form] = Form.useForm<AlertRule>();
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(false);
  const [remediationRows, setRemediationRows] = useState<RemediationRow[]>([
    { cause: '', action: '' },
  ]);
  const [selectedDimension, setSelectedDimension] = useState<SecurityDimension>('系统');
  const [preview, setPreview] = useState<string>('当 指标 在 每日窗口内 > 阈值，连续 2 次触发紧急告警');
  // 标记 form 是否已经初始化（避免 onValuesChange 提前覆盖 preview）
  const [initialized, setInitialized] = useState(false);

  // 编辑时：回显数据
  useEffect(() => {
    if (isEditing && editingRule) {
      const r = isCopy
        ? { ...editingRule, id: undefined as any, name: `${editingRule.name}-副本` }
        : editingRule;
      form.setFieldsValue(r as any);
      setSelectedDimension(r.dimension);
      setAutoRecoveryEnabled(!!r.autoRecovery);
      setRemediationRows(r.remediation && r.remediation.length > 0 ? r.remediation : [{ cause: '', action: '' }]);
      setInitialized(true);
      updatePreview();
    } else {
      // 新建：默认值
      form.setFieldsValue({
        dimension: '系统',
        alertLevel: '重要',
        level: '重要',
        enabled: true,
        scopeType: 'all',
        owner: '当前管理员',
        metric: '服务间通信加密状态',
        aggregation: '状态命中',
        window: '每日',
        operator: '状态命中',
        threshold: '命中',
        continuousHits: 1,
        silentMinutes: 30,
        autoRecovery: false,
        recoveryWindow: 2,
        responseActions: ['告警通知'],
        notifyChannels: ['站内通知'],
        notifyTargets: ['平台管理员'],
        notifyTemplate: '重要告警模板',
        rateLimitPerHour: 6,
        escalationEnabled: false,
      } as any);
      setSelectedDimension('系统');
      setInitialized(true);
      setTimeout(() => updatePreview(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRule?.id, isCopy]);

  // 动态行
  const addRemediationRow = () => {
    setRemediationRows([...remediationRows, { cause: '', action: '' }]);
  };
  const removeRemediationRow = (idx: number) => {
    if (remediationRows.length === 1) return;
    setRemediationRows(remediationRows.filter((_, i) => i !== idx));
  };
  const updateRemediationRow = (idx: number, field: 'cause' | 'action', value: string) => {
    setRemediationRows(
      remediationRows.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  // 规则预览拼接
  const updatePreview = () => {
    const v = form.getFieldsValue(true);
    const metric = v.metric || '指标';
    const op = v.operator || '>';
    const thr = v.threshold || '阈值';
    const win = v.window || '每日';
    const cnt = v.continuousHits || 1;
    const lvl = v.alertLevel || '重要';
    setPreview(`当 ${metric} 在 ${win}窗口内 ${op} ${thr}，连续 ${cnt} 次触发${lvl}告警`);
  };

  // 保存规则
  const handleSave = async (asEnabled: boolean) => {
    try {
      const values = await form.validateFields();
      const validRemediation = remediationRows
        .filter((row) => row.cause.trim() || row.action.trim())
        .map((row, idx) => ({ order: idx + 1, cause: row.cause, action: row.action }));

      if (validRemediation.length === 0) {
        message.error('请至少填写 1 行「可能原因 ↔ 处置动作」对应关系');
        return;
      }

      // 紧急级别校验：自动阻断/服务隔离仅紧急可用
      if (values.alertLevel !== '紧急' &&
        (values.responseActions || []).some((a: string) => a === '自动阻断' || a === '服务隔离')) {
        message.error('「自动阻断 / 服务隔离」仅在「紧急」级别下可用');
        return;
      }

      // eslint-disable-next-line no-console
      console.log('Save security alert rule:', {
        ...values,
        enabled: asEnabled,
        remediation: validRemediation,
      });
      message.success(
        isEditing
          ? '规则更新成功'
          : asEnabled
            ? '规则已保存并启用'
            : '规则已保存为草稿',
      );
      navigate('/app/security/rules');
    } catch (e) {
      // 校验失败
    }
  };

  // 取消
  const handleCancel = () => {
    Modal.confirm({
      title: '确认离开？',
      content: '当前有未保存的修改，确认离开本页？',
      okText: '确认离开',
      cancelText: '继续编辑',
      onOk: () => navigate('/app/security/rules'),
    });
  };

  // 测试规则（24h 数据回放预估）
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

  // 采集项联动：当前维度未启用的采集项置灰
  const enabledCollectionItems = useMemo(() => {
    const c = mockCollectionConfigs.find((x) => x.dimension === selectedDimension);
    if (!c || !c.enabled) return new Set<string>();
    return new Set(c.items || []);
  }, [selectedDimension]);

  const metricChoices = useMemo(() => {
    return (metricOptions[selectedDimension] || []).map((m) => {
      const enabled = enabledCollectionItems.size === 0
        ? true
        : Array.from(enabledCollectionItems).some((i) => i.includes(m.label.slice(0, 2)) || m.label.includes(i));
      return { ...m, disabled: !enabled, hint: !enabled ? '先去「采集配置」启用' : m.aggregationHint };
    });
  }, [selectedDimension, enabledCollectionItems]);

  // 当前维度的采集对象（仅 scopeType=scope 时可勾选）
  const collectionTargets = useMemo(
    () => mockCollectionConfigs.find((c) => c.dimension === selectedDimension)?.targets || [],
    [selectedDimension],
  );

  // 修复建议行
  const remediationSection = useMemo(() => (
    <div>
      <Text strong>修复建议（可能原因 ↔ 处置动作）</Text>
      <Text type="secondary" style={{ marginLeft: 8 }}>每行一组对应关系，触发告警时按行序号成对上报</Text>

      {remediationRows.map((row, index) => (
        <Row key={index} gutter={8} style={{ marginTop: 12 }} align="middle">
          <Col flex="240px">
            <Input
              placeholder={`可能原因 ${index + 1}`}
              value={row.cause}
              onChange={(e) => updateRemediationRow(index, 'cause', e.target.value)}
              maxLength={50}
              suffix={<Text type="secondary" style={{ fontSize: 11 }}>{row.cause.length}/50</Text>}
            />
          </Col>
          <Col style={{ width: 28, textAlign: 'center' }}><Text>→</Text></Col>
          <Col flex="1">
            <Input
              placeholder={`处置动作 ${index + 1}`}
              value={row.action}
              onChange={(e) => updateRemediationRow(index, 'action', e.target.value)}
              maxLength={100}
              suffix={<Text type="secondary" style={{ fontSize: 11 }}>{row.action.length}/100</Text>}
            />
          </Col>
          <Col style={{ width: 32, textAlign: 'center' }}>
            <Button
              type="text" danger icon={<MinusCircleOutlined />}
              onClick={() => removeRemediationRow(index)}
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
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* 顶部面包屑 + 标题 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleCancel}>
            ← 返回治理规则管理
          </Button>
        </Space>
        <Paragraph style={{ margin: '16px 0 0', fontSize: 20, fontWeight: 600 }}>
          {isCopy ? '复制告警规则' : isEditing ? '编辑告警规则' : '新建告警规则'}
        </Paragraph>
        <Text type="secondary">
          平台自采 + 本模块完整闭环；告警事件触发后统一回 8-2 告警事件处置
        </Text>
      </Card>

      <Row gutter={16}>
        <Col flex="1">
          {!enabledCollectionItems.size && (
            <Alert
              type="warning" showIcon
              style={{ marginBottom: 16 }}
              message="当前维度的「采集配置」未启用"
              description="为保证规则有数据可比对，请先在「采集配置」中启用相关采集项。"
            />
          )}

          <Form
            form={form} layout="vertical" requiredMark="optional"
            onValuesChange={(_changed, _all) => {
              if (!initialized) return;
              updatePreview();
            }}
          >
            {/* ① 告警基本信息 */}
            <Card id="sec-basic" bordered={false} style={{ marginBottom: 16 }} title="① 告警基本信息">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                    <Input placeholder="如：服务间通信未加密（同一维度内唯一）" maxLength={50} showCount />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="dimension" label="所属 Tab（监控维度）" rules={[{ required: true }]}>
                    <Select
                      disabled={isEditing}
                      options={dimensionOptions}
                      onChange={(v: SecurityDimension) => setSelectedDimension(v)}
                    />
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
                  <Form.Item name="alertLevel" label="告警级别" rules={[{ required: true, message: '请选择告警级别' }]}>
                    <Select placeholder="请选择" options={alertLevelOptions} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="scopeType" label="生效范围" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { label: '全平台', value: 'all' },
                        { label: '指定采集对象', value: 'scope' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="scopeTargetIds" label="指定采集对象" dependencies={['scopeType']}>
                    {({ getFieldValue }) => (
                      <Select
                        mode="multiple"
                        disabled={getFieldValue('scopeType') !== 'scope' || collectionTargets.length === 0}
                        placeholder={getFieldValue('scopeType') === 'scope' ? '选择采集对象' : '仅在「指定采集对象」时可编辑'}
                        options={collectionTargets.map((t) => ({ label: t.name, value: t.id }))}
                      />
                    )}
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
                  <Form.Item name="metric" label="监控指标（联动 A1 采集项）" rules={[{ required: true }]}>
                    <Select
                      placeholder="请选择"
                      options={metricChoices.map((m) => ({
                        label: m.disabled ? `${m.label}（${m.hint}）` : `${m.label} · ${m.hint}`,
                        value: m.value,
                        disabled: m.disabled,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="aggregation" label="聚合方式" rules={[{ required: true }]}>
                    <Select options={securityAggregationList.map((v) => ({ label: v, value: v }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="window" label="统计窗口" rules={[{ required: true }]} tooltip="不可低于子 Tab A1 的采集频率粒度">
                    <Select options={windowOptions} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="filters" label="过滤条件（可选，多条件 AND 组合）" tooltip="字段：采集对象 / IP 段 / 服务名 / 端口范围；运算符：等于 / 不等于 / 包含 / 不包含">
                    <Input placeholder="条件构造器占位 — 例：IP 段 = 10.0.0.0/8 AND 服务名 = api-gateway" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* ③ 告警规则配置 */}
            <Card id="sec-rule" bordered={false} style={{ marginBottom: 16 }} title="③ 告警规则配置">
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name="operator" label="触发运算符" rules={[{ required: true }]}>
                    <Select options={securityOperatorList.map((v) => ({ label: v, value: v }))} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: '请输入阈值' }]}>
                    <Input placeholder="如：0 / 命中" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="continuousHits" label={
                    <Space>连续触发次数<Tooltip title={<pre style={{ whiteSpace: 'pre-wrap' }}>{fieldTooltips.continuousHits}</pre>}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  } rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="次" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="silentMinutes" label={
                    <Space>静默时间<Tooltip title={<pre style={{ whiteSpace: 'pre-wrap' }}>{fieldTooltips.silentMinutes}</pre>}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  } rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber min={5} style={{ width: '100%' }} addonAfter="分钟" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="autoRecovery" label={
                    <Space>自动恢复<Tooltip title={<pre style={{ whiteSpace: 'pre-wrap' }}>{fieldTooltips.autoRecovery}</pre>}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  } valuePropName="checked">
                    <Switch onChange={setAutoRecoveryEnabled} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="recoveryWindow" label={
                    <Space>恢复窗口数<Tooltip title={<pre style={{ whiteSpace: 'pre-wrap' }}>{fieldTooltips.recoveryWindow}</pre>}><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                  }>
                    <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="个窗口" disabled={!autoRecoveryEnabled} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="responseActions" label="自动响应动作" rules={[{ required: true, message: '请至少选择一个' }]}>
                    <Select mode="multiple" options={responseActionOptions} />
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
                  <Form.Item name="notifyChannels" label="通知方式" rules={[{ required: true, message: '请选择通知方式' }]}>
                    <Select mode="multiple" options={securityNotifyChannelList.map((v) => ({ label: v, value: v }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="notifyTargets" label="通知对象" rules={[{ required: true, message: '请选择通知对象' }]}>
                    <Select mode="multiple" options={notifyTargetOptions} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="notifyTemplate" label="通知模板" rules={[{ required: true, message: '请选择通知模板' }]}>
                    <Select options={securityNotifyTemplateList.map((v) => ({ label: v, value: v }))} />
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
                  <Form.Item name="quietHours" label="免打扰时段" tooltip="紧急级别忽略该设置">
                    <Input placeholder="如 22:00 - 08:00（空表示关闭）" />
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
                        options={escalationConditionList.map((v) => ({ label: v, value: v }))}
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
                        options={escalationTargetList.map((v) => ({ label: v, value: v }))}
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
              <Text style={{ fontSize: 12 }}>· 模式 A：本模块自采 + 可配置</Text>
              <Text style={{ fontSize: 12 }}>· 采集对象联动 A1 已启用项</Text>
              <Text style={{ fontSize: 12 }}>· 告警事件触发后回 8-2 处置</Text>
              <Text style={{ fontSize: 12 }}>· 闭环数据归档审计中心</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 底部操作栏 - 吸底固定 */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 240, right: 0,
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

export default SecurityAlertRuleForm;
