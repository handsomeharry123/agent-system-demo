/**
 * 智能体建设需求管理 - 生成需求页（1.2）
 *
 * 新建（/create）与编辑草稿（/edit/:id）共用。
 * 结构化需求表单，按字段说明手动输入/选择，实时校验字数与格式。
 *   - 暂存：不做必填校验，落入草稿页（1.3），提示「已暂存到草稿」
 *   - 提交：二次确认 → 全量校验（手机号 / 字数）→ 通过后跳转需求管理页（1.1）
 *           校验失败定位首个错误字段
 *   - 可选：提交前点【智能化匹配】预览 TOP3
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { departmentOptions } from '../../mock/departments';
import PageHeader from '../../components/PageHeader';
import { useSmartDraft } from '../agent-center/smart/store';
import {
  ROLE_DEPT,
  clinicalStageValues,
  resourceOptions,
  urgencyOptions,
  matchAgents,
  buildMatchResult,
  type BuildNeed,
  type ClinicalStage,
  type MatchItem,
  type ResourceType,
  type UrgencyLevel,
} from './types';
import { getNeed, upsertNeed, patchNeed, nowStr, genNeedId, nextSerialNo } from './store';

const { TextArea } = Input;
const { Text } = Typography;

interface FormValues {
  title?: string;
  department?: string;
  reason?: string;
  proposer?: string;
  contactPhone?: string;
  clinicalStage?: ClinicalStage;
  clinicalStageOther?: string;
  functionDesc?: string;
  resources?: ResourceType[];
  urgency?: UrgencyLevel;
}

const NeedForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuth();
  const loginName = currentUser?.name || '当前用户';
  const [form] = Form.useForm<FormValues>();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  const editing = getNeed(id || '');
  const isEdit = !!editing;
  // 编辑「已提交」需求：保存后仍回写为已提交并跳回详情页，不降级为草稿
  const isSubmittedEdit = editing?.status === '已提交';

  // 匹配预览
  const [previewTop, setPreviewTop] = useState<MatchItem[] | null>(null);
  // 提交二次确认
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completionPromptedRef = useRef(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<keyof FormValues>>(new Set());
  const aiFieldClass = (field: keyof FormValues) =>
    aiFilledFields.has(field) ? 'need-ai-prefilled-field' : undefined;

  // 监听诊疗环节，控制「其他」填空框显隐
  const stage = Form.useWatch('clinicalStage', form);

  useEffect(() => {
    if (editing) {
      form.setFieldsValue({
        title: editing.title,
        department: editing.department,
        reason: editing.reason,
        proposer: editing.proposer,
        contactPhone: editing.contactPhone,
        clinicalStage: editing.clinicalStage,
        clinicalStageOther: editing.clinicalStageOther,
        functionDesc: editing.functionDesc,
        resources: editing.resources,
        urgency: editing.urgency,
      });
    } else {
      // 新建默认：提出人预填当前登录人
      form.setFieldsValue({ proposer: loginName, urgency: '中', resources: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (isSubmittedEdit) return undefined;
    pushWelcomeGreeting('agent-needs-create', 'provider', undefined, {
      actions: [{
        key: 'upload-need-file',
        label: '上传文件',
        event: 'agent-register-trigger-upload',
        enabled: true,
      }],
    });
    return () => consumeWelcome();
  }, [consumeWelcome, isSubmittedEdit, pushWelcomeGreeting]);

  useEffect(() => {
    const onAiFill = (event: Event) => {
      const detail = (event as CustomEvent<{
        fields?: Array<{ fieldKey: string; value: string }>;
        rawText?: string;
      }>).detail;
      const detected = Object.fromEntries((detail?.fields ?? []).map((field) => [field.fieldKey, field.value]));
      const rawText = detail?.rawText?.trim();
      const current = form.getFieldsValue();
      const next: FormValues = {};

      if (!current.title && detected.name) next.title = detected.name.slice(0, 30);
      if (!current.department && detected.department) next.department = detected.department;
      if (!current.reason && detected.reason) next.reason = detected.reason.slice(0, 300);
      if (!current.proposer && detected.proposer) next.proposer = detected.proposer.slice(0, 10);
      if (!current.contactPhone && detected.contactPhone) next.contactPhone = detected.contactPhone;
      if (!current.clinicalStage && detected.clinicalStage) next.clinicalStage = detected.clinicalStage as ClinicalStage;
      if (!current.functionDesc && (detected.description || rawText)) next.functionDesc = detected.description || rawText;
      if (!current.reason && !next.reason && (rawText || detected.description)) {
        const source = rawText || detected.description;
        next.reason = source.length >= 50
          ? source.slice(0, 300)
          : `当前业务流程主要依赖人工处理，存在效率低、信息收集不完整和结果不统一等问题。希望建设智能体辅助完成以下工作：${source}`.slice(0, 300);
      }
      if (!current.resources?.length) {
        next.resources = detected.resources
          ? detected.resources.split(/[；;,，]/).filter((item): item is ResourceType => item === '业务系统' || item === '模型')
          : ['业务系统', '模型'];
      }
      if (!current.urgency && detected.urgency) next.urgency = detected.urgency as UrgencyLevel;

      form.setFieldsValue(next);
      const detectedFieldMap: Record<string, keyof FormValues> = {
        name: 'title',
        department: 'department',
        reason: 'reason',
        proposer: 'proposer',
        contactPhone: 'contactPhone',
        clinicalStage: 'clinicalStage',
        clinicalStageCustom: 'clinicalStageOther',
        description: 'functionDesc',
        resources: 'resources',
        urgency: 'urgency',
      };
      setAiFilledFields(new Set(
        (detail?.fields ?? [])
          .map((field) => detectedFieldMap[field.fieldKey])
          .filter((field): field is keyof FormValues => Boolean(field)),
      ));
      const filledCount = Object.keys(next).length;
      if (filledCount) message.success(`已智能填充 ${filledCount} 个需求字段，请核对并补充缺失内容`);
      else message.info('已完成识别，现有字段未被覆盖，请继续补充缺失内容');
    };
    const onPrefillAcknowledged = () => {
      window.setTimeout(promptSubmitWhenComplete, 0);
    };
    window.addEventListener('agent-needs-ai-fill', onAiFill);
    window.addEventListener('agent-needs-prefill-acknowledged', onPrefillAcknowledged);
    return () => {
      window.removeEventListener('agent-needs-ai-fill', onAiFill);
      window.removeEventListener('agent-needs-prefill-acknowledged', onPrefillAcknowledged);
    };
  }, [form]);

  const buildRecord = (values: FormValues, status: BuildNeed['status']): BuildNeed => {
    const now = nowStr(0);
    const baseId = isEdit ? editing!.id : genNeedId();
    const serialNo = isEdit ? editing!.serialNo : nextSerialNo();
    return {
      id: baseId,
      serialNo,
      title: (values.title || '').trim(),
      department: values.department || '',
      reason: values.reason || '',
      proposer: (values.proposer || '').trim(),
      contactPhone: (values.contactPhone || '').trim(),
      clinicalStage: values.clinicalStage || '其他',
      clinicalStageOther: values.clinicalStage === '其他' ? values.clinicalStageOther : undefined,
      functionDesc: values.functionDesc || '',
      resources: values.resources || [],
      urgency: values.urgency || '中',
      matchResult: isEdit ? editing!.matchResult : undefined,
      status,
      applicant: isEdit ? editing!.applicant : loginName,
      submitTime: status === '已提交' ? now : isEdit ? editing!.submitTime : undefined,
      lastUpdateTime: now,
    };
  };

  const promptSubmitWhenComplete = () => {
    if (completionPromptedRef.current || isSubmittedEdit) return;
    void form.validateFields({ validateOnly: true }).then(() => {
      if (completionPromptedRef.current) return;
      completionPromptedRef.current = true;
      pushWelcomeGreeting('agent-needs-complete', 'provider', undefined, {
        actions: [{ key: 'submit-need', label: '提交', event: 'agent-needs-submit', enabled: true }],
      });
    }).catch(() => undefined);
  };

  // 暂存：不做必填校验（仅草稿态需求可用）
  const handleSave = () => {
    const values = form.getFieldsValue();
    const rec = buildRecord(values, '草稿');
    upsertNeed(rec);
    message.success('已暂存到草稿');
    navigate('/app/agent-needs?tab=draft');
  };

  // 提交 / 保存修改：二次确认 → 全量校验
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const draftRecord = buildRecord(values, '已提交');
      const top = matchAgents(draftRecord);
      const rec: BuildNeed = {
        ...draftRecord,
        matchResult: top.length ? buildMatchResult(top, nowStr(0)) : undefined,
      };
      upsertNeed(rec);
      setConfirmOpen(false);
      if (isSubmittedEdit) {
        message.success('需求信息已更新');
        navigate(`/app/agent-needs/detail/${editing!.id}`);
      } else {
        message.success('需求已提交并完成智能化匹配');
        navigate(`/app/agent-needs/detail/${rec.id}`);
        const needMatchRows = Array.from({ length: 3 }).map((_, index) => {
          const item = top[index];
          return {
            rank: index + 1,
            agentCode: item?.agentCode ?? '--',
            agentName: item?.agentName ?? '暂无匹配智能体',
            version: item?.version ?? '--',
            score: item?.score ?? 0,
          };
        });
        window.setTimeout(() => {
          pushWelcomeGreeting('agent-needs-match-result', 'provider', undefined, {
            actions: [
              { key: 'need-preview', label: '需求文档预览', path: `/app/agent-needs/doc/${rec.id}`, enabled: true },
              { key: 'need-download', label: '需求文档下载', path: `/app/agent-needs/doc/${rec.id}?download=pdf`, enabled: true },
            ],
            needMatchRows,
          });
        }, 100);
      }
    } catch (err: any) {
      setConfirmOpen(false);
      // 定位首个错误字段
      const first = err?.errorFields?.[0]?.name;
      if (first) form.scrollToField(first, { behavior: 'smooth', block: 'center' });
      message.error('请完善表单必填项与格式后再提交');
    }
  };

  useEffect(() => {
    const onSubmitByAgent = () => void handleSubmit();
    window.addEventListener('agent-needs-submit', onSubmitByAgent);
    return () => {
      window.removeEventListener('agent-needs-submit', onSubmitByAgent);
    };
  });

  // 智能化匹配预览（不落库）
  const handlePreviewMatch = async () => {
    try {
      const values = await form.validateFields(['clinicalStage', 'functionDesc']);
      const top = matchAgents({
        clinicalStage: values.clinicalStage!,
        functionDesc: values.functionDesc || form.getFieldValue('functionDesc') || '',
        resources: form.getFieldValue('resources') || [],
        department: form.getFieldValue('department') || '',
      });
      setPreviewTop(top);
      // 编辑态可顺带把预览结果落库
      if (isEdit) {
        patchNeed(editing!.id, { matchResult: top.length ? buildMatchResult(top, nowStr(0)) : undefined });
      }
      if (!top.length) message.info('暂无匹配智能体');
    } catch {
      message.warning('请先选择诊疗环节并填写功能描述');
    }
  };

  // 手机号失焦校验
  const phoneValidator = (_: unknown, value: string) => {
    if (!value) return Promise.reject(new Error('请输入联系方式'));
    if (!/^1[3-9]\d{9}$/.test(value)) return Promise.reject(new Error('请输入正确的 11 位手机号'));
    return Promise.resolve();
  };

  const clinicalStageOptions = useMemo(
    () => clinicalStageValues.map((s) => ({ label: s, value: s })),
    [],
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        title={isSubmittedEdit ? '编辑需求' : isEdit ? '编辑需求草稿' : '生成需求'}
        subTitle={
          isSubmittedEdit
            ? '修改已提交需求信息，保存后仍保留在需求管理列表'
            : '按字段说明手动填写建设需求，可暂存为草稿或直接提交'
        }
        showBack
        onBack={() => navigate(-1)}
      />

      <Card style={{ marginTop: 12 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          style={{ maxWidth: 860 }}
          initialValues={{ resources: [], urgency: '中' }}
          onValuesChange={(changedValues) => {
            const changedFields = Object.keys(changedValues) as Array<keyof FormValues>;
            setAiFilledFields((prev) => {
              const next = new Set(prev);
              changedFields.forEach((field) => next.delete(field));
              return next;
            });
            window.setTimeout(promptSubmitWhenComplete, 0);
          }}
        >
          <Form.Item
            className={aiFieldClass('title')}
            label="需求标题"
            name="title"
            rules={[
              { required: true, message: '请输入需求标题' },
              { max: 30, message: '需求标题不超过 30 字' },
            ]}
            extra="一句话概括需求，≤30 字，如「门诊智能预问诊助手」，避免与已有需求重复"
          >
            <Input placeholder="请输入需求标题" maxLength={30} showCount />
          </Form.Item>

          <Form.Item className={aiFieldClass('department')} label="提出科室" name="department" rules={[{ required: true, message: '请选择提出科室' }]}>
            <Select placeholder="请选择提出科室" options={departmentOptions} showSearch style={{ maxWidth: 320 }} />
          </Form.Item>

          <Form.Item
            className={aiFieldClass('reason')}
            label="提出原因"
            name="reason"
            rules={[
              { required: true, message: '请输入提出原因' },
              { min: 50, message: '提出原因不少于 50 字' },
              { max: 300, message: '提出原因不超过 300 字' },
            ]}
            extra="简述业务背景与痛点，说明「为什么要建」，50-300 字"
          >
            <TextArea placeholder="请输入提出原因（50-300 字）" autoSize={{ minRows: 3, maxRows: 6 }} maxLength={300} showCount />
          </Form.Item>

          <Form.Item
            className={aiFieldClass('proposer')}
            label="提出人"
            name="proposer"
            rules={[
              { required: true, message: '请输入提出人' },
              { min: 2, max: 10, message: '提出人限 2-10 个字' },
            ]}
          >
            <Input placeholder="请输入提出人" maxLength={10} showCount style={{ maxWidth: 320 }} />
          </Form.Item>

          <Form.Item
            className={aiFieldClass('contactPhone')}
            label="联系方式"
            name="contactPhone"
            validateTrigger={['onBlur']}
            rules={[{ required: true, validator: phoneValidator }]}
            extra="11 位手机号"
          >
            <Input placeholder="请输入 11 位手机号" maxLength={11} style={{ maxWidth: 320 }} />
          </Form.Item>

          <Form.Item className={aiFieldClass('clinicalStage')} label="诊疗环节" name="clinicalStage" rules={[{ required: true, message: '请选择诊疗环节' }]}>
            <Radio.Group>
              <Space wrap>
                {clinicalStageOptions.map((o) => (
                  <Radio key={o.value} value={o.value}>
                    {o.label}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          {stage === '其他' && (
            <Form.Item
              className={aiFieldClass('clinicalStageOther')}
              label="诊疗环节（其他）"
              name="clinicalStageOther"
              rules={[
                { required: true, message: '请填写诊疗环节' },
                { max: 20, message: '不超过 20 字' },
              ]}
            >
              <Input placeholder="请填写具体诊疗环节" maxLength={20} showCount style={{ maxWidth: 320 }} />
            </Form.Item>
          )}

          <Form.Item
            className={aiFieldClass('functionDesc')}
            label="功能描述"
            name="functionDesc"
            rules={[
              { required: true, message: '请输入功能描述' },
              { max: 500, message: '功能描述不超过 500 字' },
            ]}
            extra="重点说明智能体工作内容、服务对象、输入信息、输出结果；≤500 字"
          >
            <TextArea
              placeholder="参考示例：面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等信息，形成标准化问诊摘要"
              autoSize={{ minRows: 5, maxRows: 10 }}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item className={aiFieldClass('resources')} label="所需资源" name="resources" extra="可多选：业务系统、模型">
            <Checkbox.Group options={resourceOptions} />
          </Form.Item>

          <Form.Item className={aiFieldClass('urgency')} label="需求紧急程度" name="urgency" rules={[{ required: true, message: '请选择需求紧急程度' }]} extra="提出人建议值，最终由 IT 管理员核定">
            <Radio.Group options={urgencyOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          {/* 匹配预览 */}
          <Form.Item label="智能化匹配（可选预览）">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button icon={<ThunderboltOutlined />} onClick={handlePreviewMatch}>
                预览 TOP3 匹配智能体
              </Button>
              {previewTop && (
                previewTop.length > 0 ? (
                  <Table
                    rowKey="agentId"
                    size="small"
                    pagination={false}
                    style={{ maxWidth: 560 }}
                    dataSource={previewTop}
                    columns={[
                      { title: '排名', key: 'rank', width: 56, render: (_v, _r, i) => i + 1 },
                      { title: '智能体编号', dataIndex: 'agentCode', key: 'agentCode', width: 120 },
                      { title: '智能体名称', dataIndex: 'agentName', key: 'agentName' },
                      { title: '匹配度', dataIndex: 'score', key: 'score', width: 84, render: (s: number) => <Tag color="blue">{s}%</Tag> },
                    ]}
                  />
                ) : (
                  <Text type="secondary">暂无匹配智能体</Text>
                )
              )}
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              {/* 已提交需求编辑态不提供「暂存为草稿」，避免把线上需求降级为草稿 */}
              {!isSubmittedEdit && <Button onClick={handleSave}>暂存</Button>}
              <Button type="primary" onClick={() => setConfirmOpen(true)}>
                {isSubmittedEdit ? '保存修改' : '提交'}
              </Button>
              <Button type="text" onClick={() => navigate(-1)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        open={confirmOpen}
        title={isSubmittedEdit ? '确认保存修改' : '确认是否提交'}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleSubmit}
        okText={isSubmittedEdit ? '确认保存' : '确认提交'}
        cancelText="取消"
      >
        <Text>
          {isSubmittedEdit
            ? '保存后将更新该需求信息并返回详情页。请确认所填信息无误。'
            : '提交后将进入需求管理列表，并可执行智能化匹配。请确认所填信息无误。'}
        </Text>
      </Modal>

      <span style={{ display: 'none' }} aria-hidden>{ROLE_DEPT}</span>
    </div>
  );
};

export default NeedForm;
