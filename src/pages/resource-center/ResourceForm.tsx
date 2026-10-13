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
import { initialCenterUsers, type CenterUser } from '../user-center/UserList';
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
  const watchedOwner = Form.useWatch('owner', form);
  const [ownerUsers, setOwnerUsers] = useState<CenterUser[]>(() => {
    try {
      const saved = sessionStorage.getItem('user-center-users');
      return saved ? JSON.parse(saved) as CenterUser[] : initialCenterUsers;
    } catch {
      return initialCenterUsers;
    }
  });
  useEffect(() => {
    const syncUsers = () => {
      try {
        const saved = sessionStorage.getItem('user-center-users');
        setOwnerUsers(saved ? JSON.parse(saved) as CenterUser[] : initialCenterUsers);
      } catch {
        setOwnerUsers(initialCenterUsers);
      }
    };
    window.addEventListener('storage', syncUsers);
    window.addEventListener('user-center-users-updated', syncUsers);
    return () => {
      window.removeEventListener('storage', syncUsers);
      window.removeEventListener('user-center-users-updated', syncUsers);
    };
  }, []);
  const resources = useResources();
  const drafts = useDrafts();
  const registeredResourceCodes = useMemo(() => {
    const codes = new Set<string>();
    resources.filter((item) => item.id !== id).forEach((item) => item.resources.forEach((code) => codes.add(code)));
    return codes;
  }, [resources, id]);
  const current = useCurrentUser();
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
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
      form.setFieldsValue(values);
      if (Array.isArray(values.resources)) handleResourceChange(values.resources);
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
  }, [form]);

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
        // 编辑资源列表中的单个资源时，只编辑当前列表行对应的系统配置。
        // 旧数据可能包含多个系统，保留记录中第一个系统作为当前资源。
        const resourceCode = found.resourceCode || found.resources[0];
        const currentResource = resourceCode ? { ...found, resources: [resourceCode] } : found;
        setEditingResource(currentResource);
        form.setFieldsValue({
          resources: currentResource.resources,
          owner: found.owner,
          contact: found.contact,
        });
        setSelectedResources(currentResource.resources);
        // 子字段:用 name 直接匹配(由 SAMPLE_CONFIG 构造回填值)
        const vals: Record<string, string> = {};
        // 1) 优先用 name
        const perResource = found.resourceProtocols || Object.fromEntries(
          currentResource.resources.map((code) => [code, { protocol: found.protocol, protocolConfig: found.protocolConfig }]),
        );
        const resourceValues: Record<string, unknown> = {};
        currentResource.resources.forEach((code) => {
          const item = perResource[code] || { protocol: found.protocol, protocolConfig: found.protocolConfig };
          const itemVals: Record<string, string> = {};
          const itemCfg = item.protocolConfig as ProtocolConfig & { valuesByName?: Record<string, string> };
          if (itemCfg.valuesByName) Object.assign(itemVals, itemCfg.valuesByName);
          else {
            const itemLabelToName = new Map(PROTOCOL_FIELDS[item.protocol].map((f) => [f.label, f.name]));
            itemCfg.fields.forEach((f) => { const name = itemLabelToName.get(f.label); if (name) itemVals[name] = f.value; });
          }
          resourceValues[code] = { protocol: item.protocol, ...itemVals };
        });
        form.setFieldsValue({ resourceConfigs: resourceValues, ...vals });
        window.setTimeout(() => handleFieldsChange(), 0);
      }
    }
  }, [isEdit, id, form, resources, drafts]);

  const handleResourceChange = (codes: string[]) => {
    const availableCodes = codes.filter((code) => !registeredResourceCodes.has(code));
    const oldConfigs = form.getFieldValue('resourceConfigs') || {};
    const nextConfigs: Record<string, unknown> = {};
    availableCodes.forEach((code) => { nextConfigs[code] = oldConfigs[code] || { protocol: 'HL7' }; });
    form.setFieldValue('resourceConfigs', nextConfigs);
    form.setFieldValue('resources', availableCodes);
    setSelectedResources(availableCodes);
    setTestState('idle');
    setTestMsg({});
  };

  const handleResourceProtocolChange = (code: string, nextProtocol: ProtocolType) => {
    form.setFieldValue(['resourceConfigs', code], { protocol: nextProtocol });
    setSelectedResources((current) => [...current]);
    setTestState('idle');
    setTestMsg({});
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

  const handleOwnerChange = (userId: string) => {
    const user = ownerUsers.find((item) => item.id === userId);
    form.setFieldsValue({ owner: user?.name || '', contact: user?.phone || '' });
    handleFieldsChange({ owner: user?.name || '', contact: user?.phone || '' });
  };

  useEffect(() => () => {
    if (autoTestTimerRef.current) clearTimeout(autoTestTimerRef.current);
  }, []);

  /** 访问测试模拟 */
  const runTest = async (automatic = false) => {
    try {
      await form.validateFields();
    } catch {
      message.warning('请先完善所有已选系统的接入信息后再进行访问测试');
      return;
    }
    setTestState('loading');
    setTestMsg({});
    setTimeout(() => {
      const values = form.getFieldsValue(true) as Record<string, any>;
      const endpoint = Object.values(values.resourceConfigs || {})
        .flatMap((config: any) => [config.ip, config.url, config.broker, config.port])
        .filter(Boolean)
        .join(' ');
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

  /** 按系统分别构造接入配置，整条多系统注册仍保存为一条记录 */
  const buildResource = (asDraft: boolean): ResourceItem => {
    const all = form.getFieldsValue(true);
    const resourceProtocols: NonNullable<ResourceItem['resourceProtocols']> = {};
    (all.resources || []).forEach((code: string) => {
      const values = all.resourceConfigs?.[code] || {};
      const p = (values.protocol || 'HL7') as ProtocolType;
      const fields = PROTOCOL_FIELDS[p].map((f) => ({ label: f.label, value: values[f.name] || '' }));
      const valuesByName: Record<string, string> = {};
      PROTOCOL_FIELDS[p].forEach((f) => { valuesByName[f.name] = values[f.name] || ''; });
      resourceProtocols[code] = {
        protocol: p,
        protocolConfig: { fields, valuesByName } as ProtocolConfig,
      };
    });
    const first = resourceProtocols[(all.resources || [])[0]];
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
      protocol: first?.protocol || 'HL7',
      protocolConfig: first?.protocolConfig || { fields: [] },
      resourceProtocols,
      status: asDraft ? 'draft' : 'registered',
      updatedAt: now,
      creator: current.account,
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
      await form.validateFields(['resources', 'owner', 'contact']);
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
          initialValues={{ resourceConfigs: {} }}
          onValuesChange={handleFieldsChange}
          style={{ maxWidth: 960 }}
        >
        <Form.Item
            name="resources"
            label="资源列表"
            className={aiFieldClass('resources')}
            rules={[
              { required: true, message: '请至少选择 1 个资源' },
              {
                validator: async (_, codes: string[] = []) => {
                  const duplicates = codes.filter((code) => registeredResourceCodes.has(code));
                  if (duplicates.length) throw new Error(`以下资源已注册，不能重复注册：${duplicates.join('、')}`);
                },
              },
            ]}
          >
            {isEdit ? (
              <Input value={editingResource?.resources.map(resourceName).join('、') || ''} disabled />
            ) : <Select
              mode="multiple"
              placeholder="搜索资源名称(如 HIS / PACS / EMR)"
              showSearch
              filterOption={false}
              onSearch={setResourceSearch}
              optionLabelProp="label"
              maxTagCount="responsive"
              onChange={(codes: string[]) => handleResourceChange(codes)}
            >
              {filteredGroups.map((g) => (
                <Select.OptGroup key={g.group} label={g.group}>
                  {g.items.map((i) => (
                    <Select.Option key={i.code} value={i.code} label={i.code} disabled={registeredResourceCodes.has(i.code)}>
                      <Space>
                        <Tag color="blue">{i.code}</Tag>
                        <Text>{i.name}</Text>
                        {registeredResourceCodes.has(i.code) && <Tag>已注册</Tag>}
                      </Space>
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="owner"
                label="资源负责人"
                className={aiFieldClass('owner')}
                rules={[{ required: true, message: '请选择资源负责人' }]}
              >
                <Select
                  placeholder="请选择资源负责人"
                  showSearch
                  optionFilterProp="label"
                  options={ownerUsers.filter((user) => user.status === '正常').map((user) => ({
                    value: user.id,
                    label: `${user.name} / ${user.employeeId} / ${user.department}`,
                    name: user.name,
                  }))}
                  value={ownerUsers.find((user) => user.name === watchedOwner)?.id}
                  onChange={handleOwnerChange}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contact"
                label="联系方式"
                className={aiFieldClass('contact')}
                rules={[
                  { required: true, message: '请输入联系方式' },
                  { pattern: /^[0-9\-+\s]{7,20}$/, message: '请输入合法联系方式' },
                ]}
              >
                <Input placeholder="如:13800001001" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>

          {selectedResources.map((code) => {
            const currentProtocol = (form.getFieldValue(['resourceConfigs', code, 'protocol']) || 'HL7') as ProtocolType;
            return (
              <Card
                key={code}
                type="inner"
                title={<Space><Tag color="blue">{code}</Tag><Text>{resourceName(code)}</Text></Space>}
                style={{ marginBottom: 16 }}
              >
                <Form.Item
                  name={['resourceConfigs', code, 'protocol']}
                  label="对接方式"
                  rules={[{ required: true, message: '请选择对接方式' }]}
                >
                  <Select
                    onChange={(value: ProtocolType) => handleResourceProtocolChange(code, value)}
                    options={(['HL7', 'FHIR', 'DICOM', 'DB', 'MQ'] as ProtocolType[]).map((p) => ({
                      value: p,
                      label: <Tag color={PROTOCOL_COLOR[p]} icon={<ApiOutlined />}>{PROTOCOL_LABEL[p]}</Tag>,
                    }))}
                  />
                </Form.Item>
                <Typography.Title level={5}>{PROTOCOL_LABEL[currentProtocol]} 接入信息</Typography.Title>
                <Row gutter={16}>
                  {PROTOCOL_FIELDS[currentProtocol].map((f) => (
                    <Col span={12} key={f.name}>
                      <Form.Item
                        name={['resourceConfigs', code, f.name]}
                        label={f.label}
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
            );
          })}

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

export default ResourceForm;
