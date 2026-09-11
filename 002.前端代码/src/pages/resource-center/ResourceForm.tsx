/**
 * 医院资源管理中心 - 2.2 注册资源页
 * 规范:医院资源管理中心-需求说明文档V1.1 §2.2
 *   - 操作:访问测试(连通性) / 提交(校验必填) / 暂存(落注册资源草稿页)
 *   - 字段:资源列表(搜索多选) / 资源负责人(必填) / 联系方式 / 对接方式(动态子字段)
 *   - 对接方式 5 类:HL7 / FHIR / DICOM / 数据库直连 / MQ 消息队列
 *   - 枚举字段下拉化:HL7 版本、FHIR 协议、DB 类型、MQ 类型、MQ 认证方式
 *   - 仅信息科管理员可见(V1.1 §1.4)
 *
 * 子字段回填采用「name 字段标识」而非 label 文案匹配
 * 提交/暂存通过共享 store 写入,跨页面可同步
 * 创建人字段(creator)自动取自当前信息科管理员账号(V1.1 §2.1.2 数据隔离依据)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Spin,
  Tag,
  Typography,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  RESOURCE_CATALOG,
  PROTOCOL_LABEL,
  PROTOCOL_COLOR,
  HL7_VERSION_OPTIONS,
  HL7_TRANSPORT_OPTIONS,
  FHIR_TRANSPORT_OPTIONS,
  DB_TYPE_OPTIONS,
  MQ_TYPE_OPTIONS,
  MQ_AUTH_OPTIONS,
  useResources,
  useDrafts,
  useCurrentUser,
  addResource,
  addDraft,
  updateResource,
  removeDraft,
  nowAt,
  type ProtocolType,
  type ProtocolConfig,
  type ResourceItem,
} from '../../mock/resource-center';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text } = Typography;

// 5 类对接方式子字段定义(name 是字段标识,label 是展示文案,options 决定是 Select 还是 Input)
const PROTOCOL_FIELDS: Record<ProtocolType, { name: string; label: string; required?: boolean; type: 'input' | 'select' | 'textarea' | 'password'; options?: { value: string; label: string }[]; extra?: string }[]> = {
  HL7: [
    { name: 'version', label: 'HL7 版本', required: true, type: 'select', options: HL7_VERSION_OPTIONS },
    { name: 'transport', label: '协议类型', required: true, type: 'select', options: HL7_TRANSPORT_OPTIONS },
    { name: 'ip', label: 'IP 地址', required: true, type: 'input', extra: 'IPv4 格式,如 10.20.30.41' },
    { name: 'port', label: '端口号', required: true, type: 'input', extra: 'MLLP 默认 6661' },
  ],
  FHIR: [
    { name: 'transport', label: '接口协议类型', required: true, type: 'select', options: FHIR_TRANSPORT_OPTIONS },
    { name: 'url', label: 'URL 地址', required: true, type: 'input', extra: 'http/https 开头' },
    { name: 'key', label: '密钥 Key', required: true, type: 'password' },
  ],
  DICOM: [
    { name: 'name', label: 'DICOM 名称', required: true, type: 'input' },
    { name: 'ip', label: 'DICOM IP 地址', required: true, type: 'input' },
    { name: 'port', label: 'DICOM 端口', required: true, type: 'input', extra: 'DICOM 默认 11112' },
  ],
  DB: [
    { name: 'dbType', label: '数据库类型', required: true, type: 'select', options: DB_TYPE_OPTIONS },
    { name: 'ip', label: 'IP 地址', required: true, type: 'input' },
    { name: 'port', label: '端口', required: true, type: 'input', extra: 'MySQL 默认 3306 / Oracle 默认 1521' },
  ],
  MQ: [
    { name: 'mqType', label: 'MQ 类型', required: true, type: 'select', options: MQ_TYPE_OPTIONS },
    { name: 'broker', label: 'Broker 地址', required: true, type: 'input', extra: 'IP 或域名' },
    { name: 'port', label: '端口', required: true, type: 'input', extra: 'Kafka 默认 9092 / RabbitMQ 默认 5672' },
    { name: 'auth', label: '认证方式', required: true, type: 'select', options: MQ_AUTH_OPTIONS },
  ],
};

const resourceName = (code: string) => RESOURCE_CATALOG.find((r) => r.code === code)?.name || code;

const ResourceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const resources = useResources();
  const drafts = useDrafts();
  const current = useCurrentUser();
  const [protocol, setProtocol] = useState<ProtocolType>('HL7');
  const [resourceSearch, setResourceSearch] = useState('');
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState<{ code?: string; reason?: string }>({});
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const { pushWelcomeGreeting, consumeWelcome, addMessage } = useSmartDraft();
  const autoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTestSignatureRef = useRef('');
  const pendingRecognizedFieldsRef = useRef<Record<string, string>>({});
  const pendingAiFieldsRef = useRef<Set<string>>(new Set());
  const aiFieldClass = (fieldKey: string) =>
    aiFilledFields.has(fieldKey) ? 'resource-ai-prefilled-field' : undefined;

  useEffect(() => {
    pushWelcomeGreeting('resource-center-register', 'provider', undefined, {
      actions: [{
        key: 'upload-resource-file',
        label: '上传文件',
        event: 'agent-register-trigger-upload',
        enabled: true,
      }],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isEdit, pushWelcomeGreeting]);

  useEffect(() => {
    const onAiFill = (event: Event) => {
      const fields = (event as CustomEvent<{
        fields?: Array<{ fieldKey: string; value: string }>;
      }>).detail?.fields ?? [];
      if (!fields.length) return;
      fields.forEach(({ fieldKey, value }) => {
        pendingRecognizedFieldsRef.current[fieldKey] = value;
      });
      const values: Record<string, string | string[]> = {};
      fields.forEach(({ fieldKey, value }) => {
        values[fieldKey] = fieldKey === 'resources'
          ? value.split(/[；;,，]/).map((item) => item.trim()).filter(Boolean)
          : value;
        pendingAiFieldsRef.current.add(fieldKey);
      });
      const nextProtocol = values.protocol as ProtocolType | undefined;
      if (nextProtocol && nextProtocol !== protocol) {
        PROTOCOL_FIELDS[protocol].forEach((field) => form.setFieldValue(field.name, undefined));
        setProtocol(nextProtocol);
        lastProtocolRef.current = nextProtocol;
      }
      form.setFieldsValue(values);
      setAiFilledFields((previous) => new Set([...previous, ...Object.keys(values)]));
      setTestState('idle');
      setTestMsg({});
      message.info(`已识别 ${fields.length} 个资源注册字段，请勾选后点击“确认采纳”`);
    };

    const onPrefillAcknowledged = (event: Event) => {
      const fieldKeys = (event as CustomEvent<{ fieldKeys?: string[] }>).detail?.fieldKeys ?? [];
      fieldKeys.forEach((fieldKey) => {
        pendingAiFieldsRef.current.delete(fieldKey);
        delete pendingRecognizedFieldsRef.current[fieldKey];
      });
      setAiFilledFields((previous) => {
        const next = new Set(previous);
        fieldKeys.forEach((fieldKey) => next.delete(fieldKey));
        return next;
      });
      setTestState('idle');
      setTestMsg({});
      handleFieldsChange();
    };
    window.addEventListener('resource-center-ai-fill', onAiFill);
    window.addEventListener('resource-center-prefill-acknowledged', onPrefillAcknowledged);
    return () => {
      window.removeEventListener('resource-center-ai-fill', onAiFill);
      window.removeEventListener('resource-center-prefill-acknowledged', onPrefillAcknowledged);
    };
  }, [form, protocol]);

  /** 资源目录按 group 分组 */
  const groupedCatalog = useMemo(() => {
    const map = new Map<string, typeof RESOURCE_CATALOG>();
    RESOURCE_CATALOG.forEach((r) => {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    });
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, []);

  /** 过滤后的目录项 */
  const filteredGroups = useMemo(() => {
    if (!resourceSearch) return groupedCatalog;
    const k = resourceSearch.toLowerCase();
    return groupedCatalog
      .map((g) => ({ group: g.group, items: g.items.filter((i) => i.name.toLowerCase().includes(k) || i.code.toLowerCase().includes(k)) }))
      .filter((g) => g.items.length > 0);
  }, [groupedCatalog, resourceSearch]);

  /** 编辑态初始化数据(name 字段回填) */
  useEffect(() => {
    if (isEdit && id) {
      const found = [...resources, ...drafts].find((r) => r.id === id);
      if (found) {
        form.setFieldsValue({
          resources: found.resources,
          owner: found.owner,
          contact: found.contact,
          protocol: found.protocol,
        });
        setProtocol(found.protocol);
        // 子字段:用 name 直接匹配(由 SAMPLE_CONFIG 构造回填值)
        const vals: Record<string, string> = {};
        const fieldDef = PROTOCOL_FIELDS[found.protocol];
        const labelToName = new Map(fieldDef.map((f) => [f.label, f.name]));
        // 1) 优先用 name
        const cfg = found.protocolConfig as ProtocolConfig & { valuesByName?: Record<string, string> };
        if (cfg.valuesByName) {
          Object.entries(cfg.valuesByName).forEach(([k, v]) => { vals[k] = v; });
        } else {
          // 2) 兼容老 mock:用 label 映射
          found.protocolConfig.fields.forEach((f) => {
            const name = labelToName.get(f.label);
            if (name) vals[name] = f.value;
          });
        }
        form.setFieldsValue(vals);
        lastProtocolRef.current = found.protocol;
        window.setTimeout(() => handleFieldsChange(), 0);
      }
    }
  }, [isEdit, id, form, resources, drafts]);

  /** 协议切换:弹确认 + 清空子字段 */
  const handleProtocolChange = (newProtocol: ProtocolType, oldProtocol: ProtocolType) => {
    if (newProtocol === oldProtocol) return;
    const oldValues = form.getFieldsValue(PROTOCOL_FIELDS[oldProtocol].map((f) => f.name));
    const hasOldData = Object.values(oldValues).some((v) => v !== undefined && v !== '');
    if (hasOldData) {
      Modal.confirm({
        title: '切换对接方式将清空已填写的子字段',
        content: `当前已填的 ${PROTOCOL_LABEL[oldProtocol]} 子字段将被清空,是否继续?`,
        okText: '确认切换',
        cancelText: '取消',
        onOk: () => {
          form.resetFields(['protocol', ...PROTOCOL_FIELDS[oldProtocol].map((f) => f.name)]);
          setProtocol(newProtocol);
          form.setFieldsValue({ protocol: newProtocol });
          setTestState('idle');
          setTestMsg({});
        },
      });
    } else {
      form.setFieldsValue({ protocol: newProtocol });
      setProtocol(newProtocol);
      setTestState('idle');
      setTestMsg({});
    }
  };

  /** Select onChange 包装:Antd onChange 触发时 form 已写入新值,getFieldValue 拿到的就是新值,
   *  所以这里改用 useRef 维护上一次值,真正区分新旧 */
  const lastProtocolRef = useRef<ProtocolType>('HL7');
  const handleProtocolSelect = (newProtocol: ProtocolType) => {
    const oldProtocol = lastProtocolRef.current;
    lastProtocolRef.current = newProtocol;
    handleProtocolChange(newProtocol, oldProtocol);
  };

  /** 协议子字段变化时自动 reset 测试态 */
  const handleFieldsChange = (changedValues?: Record<string, unknown>) => {
    const changedKeys = Object.keys(changedValues ?? {});
    if (changedKeys.length) {
      changedKeys.forEach((key) => {
        pendingAiFieldsRef.current.delete(key);
        delete pendingRecognizedFieldsRef.current[key];
      });
      setAiFilledFields((previous) => {
        const next = new Set(previous);
        changedKeys.forEach((key) => next.delete(key));
        if (changedKeys.includes('protocol')) {
          Object.values(PROTOCOL_FIELDS).flat().forEach((field) => {
            next.delete(field.name);
            pendingAiFieldsRef.current.delete(field.name);
            delete pendingRecognizedFieldsRef.current[field.name];
          });
        }
        return next;
      });
    }
    if (testState !== 'idle') {
      setTestState('idle');
      setTestMsg({});
    }
    if (autoTestTimerRef.current) clearTimeout(autoTestTimerRef.current);
    autoTestTimerRef.current = setTimeout(async () => {
      if (pendingAiFieldsRef.current.size > 0) return;
      try {
        await form.validateFields({ validateOnly: true });
        const values = form.getFieldsValue(true);
        const signature = JSON.stringify(values);
        if (signature === lastTestSignatureRef.current) return;
        lastTestSignatureRef.current = signature;
        void runTest(true);
      } catch {
        // 字段仍缺失或格式错误时保持等待，用户可继续通过表单或医小管补充。
      }
    }, 600);
  };

  useEffect(() => () => {
    if (autoTestTimerRef.current) clearTimeout(autoTestTimerRef.current);
  }, []);

  /** 访问测试模拟 */
  const runTest = async (automatic = false) => {
    try {
      await form.validateFields();
    } catch {
      message.warning('请先完善必填字段后再进行访问测试');
      return;
    }
    setTestState('loading');
    setTestMsg({});
    setTimeout(() => {
      const values = form.getFieldsValue(true) as Record<string, string>;
      const endpoint = [values.ip, values.url, values.broker, values.port].filter(Boolean).join(' ');
      const hasConnectionProblem = /(?:0\.0\.0\.0|127\.0\.0\.1|unreachable|invalid|0000)/i.test(endpoint);
      if (!hasConnectionProblem) {
        setTestState('success');
        message.success(automatic ? '字段已完整，自动连通测试通过' : '访问测试通过');
        addMessage({
          role: 'agent',
          type: 'conn-test-result',
          content: '连通测试成果：网络连接、协议握手与服务响应均正常。',
          payload: { connTestResult: { ok: true, totalMs: 286 } },
        });
        addMessage({
          role: 'agent',
          type: 'text',
          content: '字段填写完整且格式验证正确，连通测试已通过。是否确认提交本次资源注册？',
          payload: {
            welcomeActions: [{
              key: 'confirm-resource-submit',
              label: '确认提交',
              event: 'resource-center-confirm-submit',
              enabled: true,
            }],
          },
        });
      } else {
        setTestState('fail');
        setTestMsg({ code: 'CONN_TIMEOUT_504', reason: '目标地址不可达(超时 5s),请检查 IP/端口与防火墙策略。' });
        message.error(automatic ? '自动连通测试发现问题，医小管已给出修复建议' : '访问测试失败');
        addMessage({
          role: 'agent',
          type: 'conn-test-result',
          content: '连通测试发现异常，请修正连接配置后重试。',
          payload: {
            connTestResult: {
              ok: false,
              errorCode: 'CONN_TIMEOUT_504',
              errorReason: '目标地址不可达，请检查 IP、端口、防火墙白名单及服务监听状态。',
              failureStage: 'connect',
              totalMs: 5000,
            },
          },
        });
        addMessage({
          role: 'agent',
          type: 'web-search-solution',
          content: '我已联网检索与当前错误最匹配的解决方案，请按以下顺序修复：',
          payload: {
            webSearchSolutions: [
              {
                id: 'resource-connectivity-check',
                title: '检查服务监听地址与端口',
                summary: '确认目标服务已启动并监听正确网卡；不要使用 0.0.0.0、127.0.0.1 或未开放端口作为远端连接地址。修改后我会自动重新测试。',
                source: '平台运维知识库 · 连通性排障指南',
                score: 0.96,
              },
              {
                id: 'resource-firewall-check',
                title: '核对网络策略与防火墙白名单',
                summary: '放通平台出口到目标 IP/端口的 TCP 访问，并检查安全组、ACL、NAT 与院内防火墙策略。',
                source: '联网检索 · 医疗系统接口网络配置实践',
                score: 0.91,
              },
            ],
          },
        });
      }
    }, 1200);
  };

  /** 构造新资源并入 store */
  const buildResource = (asDraft: boolean): ResourceItem => {
    const all = form.getFieldsValue(true);
    const fields = PROTOCOL_FIELDS[protocol].map((f) => ({
      label: f.label,
      value: all[f.name] || '',
    }));
    const valuesByName: Record<string, string> = {};
    PROTOCOL_FIELDS[protocol].forEach((f) => {
      valuesByName[f.name] = all[f.name] || '';
    });
    const config: ProtocolConfig = { fields, valuesByName } as ProtocolConfig;
    const now = nowAt();
    const prefix = asDraft ? 'D' : 'R';
    const seq = asDraft
      ? (drafts.length + 1).toString().padStart(4, '0')
      : (resources.length + 1).toString().padStart(4, '0');
    return {
      id: `${prefix}-${seq}`,
      resources: all.resources || [],
      owner: all.owner || '',
      contact: all.contact || '',
      protocol,
      protocolConfig: config,
      status: asDraft ? 'draft' : 'registered',
      updatedAt: now,
      creator: current.account, // V1.1 §2.1.2:草稿创建人用于"管理员之间数据隔离"
    };
  };

  /** 提交 */
  const handleSubmit = async () => {
    if (testState !== 'success') {
      message.warning('请等待最新一次自动连通测试通过后再提交');
      return;
    }
    try {
      await form.validateFields();
      const r = buildResource(false);
      if (isEdit && id && drafts.some((draft) => draft.id === id)) {
        addResource(r);
        removeDraft(id);
        message.success(`草稿已提交注册,资源 ID: ${r.id}`);
      } else if (isEdit && id && resources.some((resource) => resource.id === id)) {
        updateResource(id, { ...r, id });
        message.success(`资源已更新,资源 ID: ${id}`);
      } else {
        addResource(r);
        message.success(`资源已提交注册,资源 ID: ${r.id}`);
      }
      setTimeout(() => navigate('/app/resource-center/resources'), 600);
    } catch {
      message.error('存在未填写的必填字段,请检查');
    }
  };

  useEffect(() => {
    const onConfirmSubmit = () => void handleSubmit();
    window.addEventListener('resource-center-confirm-submit', onConfirmSubmit);
    return () => window.removeEventListener('resource-center-confirm-submit', onConfirmSubmit);
  });

  /** 暂存 */
  const handleDraft = async () => {
    try {
      await form.validateFields(['resources', 'owner', 'contact', 'protocol']);
      const d = buildResource(true);
      addDraft(d);
      message.success(`资源已暂存到「资源管理 - 草稿 Tab」,草稿 ID: ${d.id}`);
      setTimeout(() => navigate('/app/resource-center/resources?tab=draft'), 600);
    } catch {
      message.error('请先填写资源列表 / 资源负责人 / 联系方式 / 对接方式');
    }
  };

  return (
    <>
      <PageHeader
        title={isEdit ? `编辑资源 - ${id}` : '注册资源'}
        subTitle="新增或编辑院内业务系统资源;支持连通性测试、提交与暂存"
        showBack
        onBack={() => navigate('/app/resource-center/resources')}
        breadcrumb={[
          { path: '/app/resource-center', breadcrumbName: '医院资源管理中心' },
          { path: '/app/resource-center/resources', breadcrumbName: '资源管理' },
          { path: isEdit ? `/app/resource-center/resources/edit/${id}` : '/app/resource-center/resources/new', breadcrumbName: isEdit ? '编辑资源' : '注册资源' },
        ]}
      />

      <Card bordered={false}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ protocol: 'HL7' }}
          onValuesChange={handleFieldsChange}
          style={{ maxWidth: 960 }}
        >
          <Form.Item
            name="resources"
            label="资源列表"
            className={aiFieldClass('resources')}
            extra="支持多选,从医院业务系统分类中搜索;至少选择 1 项"
            rules={[{ required: true, message: '请至少选择 1 个资源' }]}
          >
            <Select
              mode="multiple"
              placeholder="搜索资源名称(如 HIS / PACS / EMR)"
              showSearch
              filterOption={false}
              onSearch={setResourceSearch}
              optionLabelProp="label"
              maxTagCount="responsive"
            >
              {filteredGroups.map((g) => (
                <Select.OptGroup key={g.group} label={g.group}>
                  {g.items.map((i) => (
                    <Select.Option key={i.code} value={i.code} label={i.code}>
                      <Space>
                        <Tag color="blue">{i.code}</Tag>
                        <Text>{i.name}</Text>
                      </Space>
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="owner"
                label="资源负责人"
                className={aiFieldClass('owner')}
                extra="必填,可从已有用户选择或手动输入"
                rules={[{ required: true, message: '请输入资源负责人' }]}
              >
                <Input placeholder="如:张志远" maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contact"
                label="联系方式"
                className={aiFieldClass('contact')}
                extra="手机号或座机号"
                rules={[
                  { required: true, message: '请输入联系方式' },
                  { pattern: /^[0-9\-+\s]{7,20}$/, message: '请输入合法联系方式' },
                ]}
              >
                <Input placeholder="如:13800001001" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="protocol"
            label="对接方式"
            className={aiFieldClass('protocol')}
            extra="不同对接方式动态展示对应子字段(枚举字段已下拉化)"
            rules={[{ required: true, message: '请选择对接方式' }]}
          >
            <Select
              onChange={(v: ProtocolType) => handleProtocolSelect(v)}
              options={(['HL7', 'FHIR', 'DICOM', 'DB', 'MQ'] as ProtocolType[]).map((p) => ({
                value: p,
                label: (
                  <Space>
                    <Tag color={PROTOCOL_COLOR[p]} icon={<ApiOutlined />}>
                      {PROTOCOL_LABEL[p]}
                    </Tag>
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          <Card type="inner" title={`${PROTOCOL_LABEL[protocol]} 子字段`} style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              {PROTOCOL_FIELDS[protocol].map((f) => (
                <Col span={12} key={f.name}>
                  <Form.Item
                    name={f.name}
                    label={f.label}
                    className={aiFieldClass(f.name)}
                    extra={f.extra}
                    rules={[{ required: f.required !== false, message: `请填写 ${f.label}` }]}
                  >
                    {f.type === 'select' && f.options ? (
                      <Select placeholder={`请选择 ${f.label}`} options={f.options} />
                    ) : f.type === 'password' ? (
                      <Input.Password placeholder={`请输入 ${f.label}`} />
                    ) : (
                      <Input placeholder={`请输入 ${f.label}`} />
                    )}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Card>

          {testState !== 'idle' && (
            <Alert
              style={{ marginBottom: 16 }}
              type={testState === 'success' ? 'success' : testState === 'fail' ? 'error' : 'info'}
              showIcon
              icon={
                testState === 'loading' ? <Spin size="small" /> :
                testState === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />
              }
              message={
                testState === 'loading' ? '正在测试连通性,请稍候…' :
                testState === 'success' ? '访问测试通过 - 对端服务可达,配置正确' :
                `访问测试失败 - ${testMsg.code || '未知错误'}`
              }
              description={testState === 'fail' ? `${testMsg.reason} (修改任一字段后请重新测试)` : undefined}
            />
          )}

          <Form.Item style={{ marginTop: 8 }}>
            <Space wrap>
              <Button
                type="default"
                icon={testState === 'loading' ? <ReloadOutlined spin /> : <ApiOutlined />}
                onClick={() => void runTest(false)}
                loading={testState === 'loading'}
              >
                访问测试
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                disabled={testState !== 'success'}
              >
                提交
              </Button>
              <Button icon={<SaveOutlined />} onClick={handleDraft}>
                暂存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
};

// Modal 引用
import { Modal } from 'antd';

export default ResourceForm;
