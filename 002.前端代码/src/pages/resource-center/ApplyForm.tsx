/**
 * 医院资源管理中心 - 3.2 申请权限页
 * 规范:医院资源管理中心-需求说明文档V1.1 §3.2
 *   - 操作:暂存 / 访问测试 / 提交
 *   - 字段(均从台账侧回填,不可编辑):
 *       智能体编号 / 智能体名称 / 所属科室 / 诊疗环节 / 功能描述
 *   - 申请资源名称:从已注册资源列表多选
 *   - 所有角色可见(V1.1 §3):信息科管理员 / 科室管理员均可发起申请
 *
 * Submit 写入共享 store:status=pending + submittedAt + trail.append(提交/重新提交)
 * 申请人 = 当前演示账号(V1.1 §3.1 数据隔离:科室管理员视角下,记录归属于本人)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  message,
  Spin,
  Tag,
  Typography,
  Alert,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  SendOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { useSmartDraft } from '../agent-center/smart/store';
import {
  useResources,
  useApplies,
  useDemoRole,
  useCurrentUser,
  addApply,
  updateApply,
  nowAt,
  mockAgents,
  PROTOCOL_LABEL,
  PROTOCOL_COLOR,
  truncate,
  type ProtocolType,
  type ApplyItem,
  type ApplyStatus,
} from '../../mock/resource-center';

const { Text } = Typography;

const ApplyForm = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = searchParams.get('from'); // 编辑草稿 / 退回修改 / 撤销修改
  // 台账列表「申请资源」联动：?agentName=XXX → 自动按名称预选智能体
  // 用 useState 缓存首次挂载时的预填值,避免 setSearchParams 清理 URL 后 Alert 消失
  const [presetAgentName] = useState(() => searchParams.get('agentName') || '');
  const [form] = Form.useForm();
  const resources = useResources();
  const applies = useApplies();
  // V1.2:resource-center mock 内置 demoRole 为英文枚举 'admin' | 'user'(与 useDemoSettings 的中文枚举是两套独立 store)
  const isAdmin = useDemoRole() === 'admin';
  const current = useCurrentUser();
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState<{ code?: string; reason?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  useEffect(() => {
    pushWelcomeGreeting('resource-apply-form', isAdmin ? 'admin' : 'dept');
    return () => consumeWelcome();
  }, [consumeWelcome, isAdmin, pushWelcomeGreeting]);

  useEffect(() => {
    const onAiFill = (event: Event) => {
      const fields = (event as CustomEvent<{ fields?: Array<{ fieldKey: string; value: string }> }>).detail?.fields ?? [];
      const values = Object.fromEntries(fields.map((field) => [field.fieldKey, field.value]));
      if (values.agentId && mockAgents.some((agent) => agent.id === values.agentId)) {
        form.setFieldValue('agentId', values.agentId);
        setSelectedAgentId(values.agentId);
      }
      if (values.resourceIds) {
        const ids = values.resourceIds.split(/[；;,，]/).filter((rid) => resources.some((resource) => resource.id === rid));
        if (ids.length) {
          form.setFieldValue('resourceIds', ids);
          setSelectedResourceIds(ids);
        }
      }
      if (values.reason) form.setFieldValue('reason', values.reason.slice(0, 200));
      if (Object.keys(values).length) message.success('已识别并填充权限申请信息，请补充缺失字段后提交');
    };
    window.addEventListener('resource-apply-ai-fill', onAiFill);
    return () => window.removeEventListener('resource-apply-ai-fill', onAiFill);
  }, [form, resources]);

  // 编辑态
  const init = from ? applies.find((a) => a.id === from) : null;
  // 优先使用编辑态的 agentId;否则按台账联动的 agentName 反查 mockAgents.id
  const presetAgentFromName = presetAgentName
    ? mockAgents.find((a) => a.name === presetAgentName || a.name.includes(presetAgentName) || presetAgentName.includes(a.name))
    : undefined;
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(init?.agentId ?? presetAgentFromName?.id);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>(init ? [init.resourceId] : []);

  useEffect(() => {
    if (init) {
      form.setFieldsValue({
        agentId: init.agentId,
        resourceIds: [init.resourceId],
        reason: init.reason || '',
      });
    } else if (presetAgentFromName) {
      // 台账列表「申请资源」联动：自动选中匹配的智能体
      form.setFieldsValue({ agentId: presetAgentFromName.id });
    }
    // 消费后清掉 URL 中的 agentName 参数,避免刷新重复触发
    if (presetAgentName) {
      const next = new URLSearchParams(searchParams);
      next.delete('agentName');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAgent = mockAgents.find((a) => a.id === selectedAgentId);

  // 越权范围校验:申请人选了未在已通过申请中的资源
  const unauthorizedResources = selectedResourceIds.filter((rid) => {
    const r = resources.find((x) => x.id === rid);
    if (!r) return false;
    // 演示规则:每个资源若没有对应的 approved 申请,标记为越权风险
    const hasApproved = applies.some((a) => a.resourceId === rid && a.status === 'approved');
    return !hasApproved && selectedAgent !== undefined; // 已选智能体但资源未在已通过列表中
  });

  /** 智能体基础信息(只读展示,源自台账侧) */
  const agentInfoView = selectedAgent ? (
    <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
      <Descriptions.Item label="智能体编号">{selectedAgent.id}</Descriptions.Item>
      <Descriptions.Item label="智能体名称">
        <Tooltip title={selectedAgent.name}>{truncate(selectedAgent.name, 10)}</Tooltip>
      </Descriptions.Item>
      <Descriptions.Item label="所属科室">{selectedAgent.dept}</Descriptions.Item>
      <Descriptions.Item label="诊疗环节">{selectedAgent.stage}</Descriptions.Item>
      <Descriptions.Item label="申请人">{selectedAgent.applicant}</Descriptions.Item>
      <Descriptions.Item label="功能描述">
        <Tooltip title={selectedAgent.description}>
          <Text type="secondary">{truncate(selectedAgent.description, 20)}</Text>
        </Tooltip>
      </Descriptions.Item>
    </Descriptions>
  ) : (
    <Alert type="info" message="请先选择智能体,系统将自动从台账侧回填基础信息" showIcon style={{ marginBottom: 16 }} />
  );

  /** 访问测试 */
  const runTest = async () => {
    try {
      await form.validateFields();
    } catch {
      message.warning('请先完善必填字段');
      return;
    }
    setTestState('loading');
    setTestMsg({});
    setTimeout(() => {
      if (Math.random() > 0.1) {
        setTestState('success');
        message.success('访问测试通过');
      } else {
        setTestState('fail');
        setTestMsg({ code: 'CONN_REFUSED_403', reason: '对端服务返回 403,资源不可达,请检查 IP/端口与授权策略。' });
        message.error('访问测试失败');
      }
    }, 1200);
  };

  /** 构造新申请记录 */
  const buildApplyItem = (status: ApplyStatus): ApplyItem | null => {
    if (!selectedAgent) return null;
    const resourceId = selectedResourceIds[0];
    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) return null;
    const now = nowAt();
    const seq = (applies.length + 1).toString().padStart(4, '0');
    const baseId = init?.id || `A-2026-${seq}`;
    const it: ApplyItem = {
      id: baseId,
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      department: selectedAgent.dept,
      stage: selectedAgent.stage,
      description: selectedAgent.description,
      resourceId: resource.id,
      resourceName: resource.resources.join('/'),
      reason: form.getFieldValue('reason') || '',
      status,
      applicant: current.name,
      applicantAccount: current.account, // V1.1 §3.1 数据隔离:归属于当前演示账号
      trail: [],
    };
    return it;
  };

  /** 暂存 */
  const handleDraft = async () => {
    try {
      await form.validateFields(['agentId', 'resourceIds']);
      const it = buildApplyItem('draft');
      if (!it) { message.error('资源不存在'); return; }
      if (init) {
        updateApply(init.id, { ...it, status: 'draft', draftAt: nowAt() });
      } else {
        addApply({ ...it, draftAt: nowAt() });
      }
      message.success('申请已暂存到「草稿 Tab」');
      setTimeout(() => navigate('/app/resource-center/applies?tab=draft'), 600);
    } catch {
      message.error('请先选择智能体与至少 1 个申请资源');
    }
  };

  /** 提交 */
  const handleSubmit = async () => {
    try {
      await form.validateFields();
      if (unauthorizedResources.length > 0) {
        Modal.confirm({
          title: '检测到可能越权的资源',
          content: `所选资源 [${unauthorizedResources.join(', ')}] 暂未在已通过的申请中;提交后若智能体实际访问这些资源,平台将进行告警阻断。是否继续提交?`,
          okText: '仍要提交',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => doSubmit(),
        });
        return;
      }
      doSubmit();
    } catch {
      message.error('存在未填写的必填字段,请检查');
    }
  };

  const doSubmit = () => {
    setSubmitting(true);
    const it = buildApplyItem('pending');
    if (!it) {
      setSubmitting(false);
      message.error('资源不存在');
      return;
    }
    const now = nowAt();
    if (init) {
      // 重新提交(rejected / revoked → pending)
      updateApply(init.id, {
        ...it,
        status: 'pending',
        submittedAt: now,
        reviewingAt: undefined,
        rejectedAt: undefined,
        approvedAt: undefined,
        appendTrail: { action: '重新提交', operator: it.applicant, at: now, comment: '修改后重新提交审核', status: 'process', targetStatus: 'pending' },
      });
    } else {
      addApply({
        ...it,
        submittedAt: now,
        trail: [{ action: '提交', operator: it.applicant, at: now, status: 'process', targetStatus: 'pending' }],
      });
    }
    setSubmitting(false);
    message.success('申请已提交,进入「待审核」Tab');
    setTimeout(() => navigate('/app/resource-center/applies?tab=pending'), 600);
  };

  return (
    <>
      <PageHeader
        title={init ? `编辑申请 - ${init.id}` : '申请权限'}
        subTitle="为智能体发起院内业务系统资源访问权限申请"
        showBack
        onBack={() => navigate('/app/resource-center/applies')}
        breadcrumb={[
          { path: '/app/resource-center', breadcrumbName: '医院资源管理中心' },
          { path: '/app/resource-center/applies', breadcrumbName: '申请管理' },
          { path: '/app/resource-center/apply-form', breadcrumbName: init ? '编辑申请' : '申请权限' },
        ]}
      />

      <Card bordered={false}>
        <Form form={form} layout="vertical" initialValues={{ agentId: init?.agentId ?? presetAgentFromName?.id, resourceIds: init ? [init.resourceId] : [] }} style={{ maxWidth: 960 }}>
          {/* 台账列表「申请资源」联动提示:展示已带入的智能体,支持手动改选 */}
          {presetAgentName && (
            <Alert
              type={presetAgentFromName ? 'success' : 'info'}
              showIcon
              style={{ marginBottom: 16 }}
              message={
                presetAgentFromName
                  ? `已自动带入智能体：${presetAgentFromName.name}（${presetAgentFromName.id}）`
                  : `已带入智能体名称「${presetAgentName}」,请在下方手动选择对应智能体`
              }
            />
          )}

          <Form.Item
            name="agentId"
            label="选择智能体"
            extra="智能体基础信息(编号/名称/所属科室/诊疗环节/功能描述/申请人)从台账侧实时回填,不可编辑"
            rules={[{ required: true, message: '请选择智能体' }]}
          >
            <Select
              placeholder="搜索智能体编号 / 名称 / 科室"
              showSearch
              optionFilterProp="label"
              onChange={(v: string) => setSelectedAgentId(v)}
              options={mockAgents.map((a) => ({
                value: a.id,
                label: `${a.id} - ${a.name} (${a.dept})`,
              }))}
            />
          </Form.Item>

          {agentInfoView}

          <Form.Item
            name="resourceIds"
            label="申请资源名称"
            extra="从已注册资源列表多选;至少选择 1 项,提交前可发起连通性测试"
            rules={[{ required: true, message: '请至少选择 1 个资源' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择要申请的院内业务系统资源"
              maxTagCount="responsive"
              optionLabelProp="label"
              onChange={(v: string[]) => setSelectedResourceIds(v)}
            >
              {resources.map((r) => (
                <Select.Option key={r.id} value={r.id} label={`${r.id} ${r.resources.join('/')}`}>
                  <Space wrap>
                    <Tag color="default">{r.id}</Tag>
                    <Text>{r.resources.join(' / ')}</Text>
                    <Tag color={PROTOCOL_COLOR[r.protocol as ProtocolType]}>{PROTOCOL_LABEL[r.protocol as ProtocolType]}</Tag>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请理由(选填)"
            extra="≤200 字,辅助管理员理解业务场景"
            rules={[{ max: 200, message: '申请理由不超过 200 字' }]}
          >
            {/* 申请理由为选填,V1.1 字段外但对评审可读性有帮助 */}
            <textarea
              rows={3}
              maxLength={200}
              placeholder="如:为患者提供智能导诊与预问诊,需访问 HIS 患者信息与 EMR 病历摘要"
              style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' }}
            />
          </Form.Item>

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
                testState === 'loading' ? '正在测试连通性…' :
                testState === 'success' ? '访问测试通过' :
                `访问测试失败 - ${testMsg.code}`
              }
              description={testState === 'fail' ? `${testMsg.reason} (修改任一字段后请重新测试)` : undefined}
            />
          )}

          <Form.Item>
            <Space wrap>
              <Button type="default" icon={testState === 'loading' ? <ReloadOutlined spin /> : <ApiOutlined />} onClick={runTest} loading={testState === 'loading'}>
                访问测试
              </Button>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={submitting}>
                {init && (init.status === 'rejected' || init.status === 'revoked') ? '重新提交' : '提交'}
              </Button>
              <Button icon={<SaveOutlined />} onClick={handleDraft}>暂存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
};

// Modal reference
import { Modal } from 'antd';

export default ApplyForm;
