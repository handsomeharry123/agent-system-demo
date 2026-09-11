// =============================================================================
// 新建 / 编辑评测任务页（V1.9 §三 · 3.2）
//   · 字段：智能体（编号 / 名称 / 版本 / 科室 / 风险等级 取自台账）、
//           评测标准（团体标准《智能体安全评测规范》默认带入）、
//           评测维度（全量覆盖：输入安全 / 输出安全 / 行为安全 / 数据安全 / 工具安全）、
//           测试样本量（V1.9：三档滑动条，类似调节音量的左右滑动组件，
//                       在三档间切换，默认选中「快速评测」档位，
//                       **不支持按单个维度分别配置**，一档统辖全维度）
//   · 「暂存」存为草稿；「开始评测」直接进入「评测中」状态并跳转「评测中」Tab
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Form,
  Select,
  Slider,
  message,
  Modal,
} from 'antd';
import {
  CheckCircleOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  mockEvaluationTasks,
  ALL_DIMENSIONS,
  ALL_SAMPLE_LEVELS,
  dimensionColorMap,
  sampleLevelPercent,
  type EvaluationTask,
  type EvalDimension,
  type SampleLevel,
} from '../../mock/evaluation';
import { mockAgents } from '../../mock/agents';
import { matchAgentByName } from '../../utils/agentNameMatcher';
import { useAuth } from '../../hooks/useAuth';
import { useSmartDraft } from '../agent-center/smart/store';

const { Text } = Typography;

const EVAL_STANDARD = '团体标准《智能体安全评测规范》';

// V1.9 §3.2 测试样本量：三档滑动条（类似调节音量的左右滑动组件）
//   · 三档位（slider value）→ 测试样本量档位
//   · 默认选中「快速评测」档位
//   · marks 在 0/50/100 三处显示档位名称,左右拖动只在三个档位间切换
const SAMPLE_LEVEL_VALUES: SampleLevel[] = ['快速评测', '标准评测', '深度评测'];
const SLIDER_INDEX: Record<SampleLevel, number> = {
  快速评测: 0,
  标准评测: 50,
  深度评测: 100,
};
const SLIDER_FROM_INDEX: Record<number, SampleLevel> = {
  0: '快速评测',
  50: '标准评测',
  100: '深度评测',
};

const CreateTask = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetTaskId = searchParams.get('taskId') || undefined;
  const presetTask = presetTaskId
    ? mockEvaluationTasks.find((t) => t.id === presetTaskId)
    : undefined;
  // V2.6 接入中心「立即评测」带入的智能体名称
  //   · agentName 命中 mockAgents → 静默自动选中(精准预填)
  //   · agentName 未命中 → 静默留空,让用户主动选择(顶部 Alert / toast 提示按 PRD 移除)
  const presetAgentName = searchParams.get('agentName') || undefined;
  // V2.7: 改用公共 4 级匹配(精确 → 去尾缀 → 子串 → bigram min-归一化),
  //   兼容接入中心「心电图智能辅助诊断」↔ 台账「心电图智能辅助诊断系统」的尾缀差异
  const matchedAgent = presetAgentName
    ? matchAgentByName(presetAgentName, mockAgents)
    : undefined;
  const { currentUser } = useAuth();
  const { pushWelcomeGreeting, consumeWelcome } = useSmartDraft();

  const [form] = Form.useForm();

  // 选中的智能体
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(matchedAgent?.id);
  // 评测维度：全量覆盖 5 个维度,无需用户选择
  const selectedDims: EvalDimension[] = ALL_DIMENSIONS;
  // 测试样本量（任务级统一一档；V1.9：默认「快速评测」）
  const [sampleLevel, setSampleLevel] = useState<SampleLevel>('快速评测');

  useEffect(() => {
    const connectedAgents = new Set(mockEvaluationTasks.map((task) => task.agentId)).size;
    const countStatus = (status: EvaluationTask['status']) =>
      mockEvaluationTasks.filter((task) => task.status === status).length;
    const values = [
      connectedAgents,
      countStatus('评测中'),
      countStatus('评测完成'),
      countStatus('审核中'),
      countStatus('审核通过'),
      countStatus('退回重测'),
    ];
    pushWelcomeGreeting('evaluation-create', 'admin', () => values, {
      windowReplacements: values,
      chips: [
        { key: 'create-evaluating', label: `安全性评测中 ${values[1]}`, targetTab: '评测中', tone: 'warning' },
        { key: 'create-evaluated', label: `评测完成 ${values[2]}`, targetTab: '评测完成', tone: 'success' },
        { key: 'create-reviewing', label: `审核中 ${values[3]}`, targetTab: '审核中', tone: 'warning' },
        { key: 'create-approved', label: `审核通过 ${values[4]}`, targetTab: '审核通过', tone: 'success' },
        { key: 'create-returned', label: `退回修改 ${values[5]}`, targetTab: '退回重测', tone: 'error' },
      ],
    });
    const onJump = (event: Event) => {
      const targetTab = (event as CustomEvent<string>).detail;
      if (!['评测中', '评测完成', '审核中', '审核通过', '退回重测'].includes(targetTab)) return;
      navigate(`/app/evaluation/tasks?tab=${encodeURIComponent(targetTab)}`);
    };
    window.addEventListener('agent-jump-tab', onJump);
    return () => {
      window.removeEventListener('agent-jump-tab', onJump);
      consumeWelcome();
    };
  }, [consumeWelcome, navigate, pushWelcomeGreeting]);

  // 智能体下拉
  const agentOptions = useMemo(
    () =>
      mockAgents.map((a) => ({
        label: `${a.name}（${a.type} · ${a.department}）`,
        value: a.id,
        agent: a,
      })),
    []
  );

  // 预填：编辑草稿/撤销
  useEffect(() => {
    if (!presetTask) return;
    setSelectedAgentId(presetTask.agentId);
    setSampleLevel(presetTask.sampleLevel);
    form.setFieldsValue({
      agentId: presetTask.agentId,
      dimensions: ALL_DIMENSIONS,
      sampleLevel: presetTask.sampleLevel,
    });
  }, [presetTask, form]);

  // V1.9：挂载时把 sampleLevel 默认值同步进 form,避免 validateFields 校验失败
  useEffect(() => {
    form.setFieldsValue({ sampleLevel, dimensions: ALL_DIMENSIONS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 预填：接入中心「立即评测」带入 agentName(V2.7 改为静默预填,不弹气泡)
  useEffect(() => {
    if (!presetAgentName) return;
    if (matchedAgent) {
      // 命中：自动选中(静默,不弹 toast)
      setSelectedAgentId(matchedAgent.id);
      form.setFieldsValue({ agentId: matchedAgent.id });
    }
    // 未命中:留空,等用户主动选择;红色 * + validateFields 兜底
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    form.setFieldsValue({ agentId });
  };

  // 校验
  const validateAll = (): { ok: boolean; message?: string } => {
    if (!selectedAgentId) return { ok: false, message: '请选择要评测的智能体' };
    if (!sampleLevel) return { ok: false, message: '请选择测试样本量' };
    return { ok: true };
  };

  const buildTask = (status: '评测中' | '草稿'): EvaluationTask | null => {
    const v = validateAll();
    if (!v.ok) {
      message.error(v.message);
      return null;
    }
    const agent = mockAgents.find((a) => a.id === selectedAgentId);
    const taskNo = `EVL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(
      Math.floor(Math.random() * 9999)
    ).padStart(4, '0')}`;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return {
      id: `task-new-${Date.now()}`,
      taskNo,
      agentCode: `${agent?.department || '未分配'}-${String(
        Math.floor(Math.random() * 9999)
      ).padStart(4, '0')}`,
      agentId: selectedAgentId!,
      agentName: agent?.name || '未知智能体',
      version: (agent as any)?.version || '1.0',
      riskLevel: '低风险',
      department: agent?.department || '未分配',
      status,
      sampleLevel: sampleLevel!,
      createTime: now,
      lastEditTime: status === '草稿' ? now : undefined,
      submitTime: status === '评测中' ? now : undefined,
      progress: status === '评测中' ? 0 : undefined,
      creator: currentUser?.name,
      // 维度配置：冗余 sampleLevel，便于 Progress 详情按维度展示
      dimensions: selectedDims.map((d) => ({ dimension: d, sampleLevel: sampleLevel! })),
    };
  };

  const handleStart = async () => {
    await form.validateFields();
    const t = buildTask('评测中');
    if (t) {
      mockEvaluationTasks.unshift(t);
      message.success('已提交评测，任务进入「评测中」');
      navigate('/app/evaluation/tasks?tab=评测中');
    }
  };

  const handleSaveDraft = async () => {
    await form.validateFields();
    const t = buildTask('草稿');
    if (t) {
      mockEvaluationTasks.unshift(t);
      message.success('已暂存为草稿');
      navigate('/app/evaluation/tasks?tab=草稿');
    }
  };

  const handleCancel = () => {
    Modal.confirm({
      title: '确认取消',
      content: '将放弃当前评测配置并返回评测任务列表，确认取消？',
      okText: '确认取消',
      cancelText: '继续编辑',
      onOk: () => navigate('/app/evaluation/tasks'),
    });
  };

  const currentAgent = mockAgents.find((a) => a.id === selectedAgentId);

  // V1.9 滑动条 marks:三档档位名称+对应百分比
  const sampleMarks = useMemo(() => {
    const m: Record<number, React.ReactNode> = {};
    SAMPLE_LEVEL_VALUES.forEach((lv) => {
      const idx = SLIDER_INDEX[lv];
      m[idx] = (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1F1F1F' }}>{lv}</div>
          <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
            抽取 {sampleLevelPercent[lv]}%
          </div>
        </div>
      );
    });
    return m;
  }, []);

  return (
    <div style={{ padding: 24, background: '#F5F5F5', minHeight: '100%' }}>
      <PageHeader
        title={presetTask ? `编辑评测任务：${presetTask.agentName}` : '新建评测任务'}
        subTitle="选择智能体并配置评测维度与测试样本量（三档样本量，一档统辖全维度）"
        showBack
        onBack={() => navigate('/app/evaluation/tasks')}
      />

      {/* V1.9：Form 提到最外层,让所有 Form.Item 真正绑到 useForm 实例上,消除
            「Can not find FormContext」警告并让 validateFields 校验所有字段 */}
      <Form form={form} layout="vertical">
        {/* 评测对象 */}
        <Card style={{ marginTop: 16 }} title="评测对象">
          {/* V2.7: 顶部 Alert 横幅已移除(命中时静默预填,未命中时留空让用户选择) */}
          <Form.Item
            name="agentId"
            label="智能体"
            required
            rules={[{ required: true, message: '请选择智能体' }]}
          >
            <Select
              placeholder="请选择智能体"
              showSearch
              style={{ width: 460 }}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={agentOptions}
              onChange={handleAgentChange}
            />
          </Form.Item>

          {currentAgent && (
            <Card size="small" style={{ background: '#FAFAFA', marginTop: 8 }}>
              <Space wrap size={16}>
                <Text type="secondary">
                  类型：<Tag color="blue">{currentAgent.type}</Tag>
                </Text>
                <Text type="secondary">
                  科室：<Text strong>{currentAgent.department}</Text>
                </Text>
                <Text type="secondary">
                  编号：
                  <Text strong>
                    {(currentAgent as any).code || `${currentAgent.department}-0001`}
                  </Text>
                </Text>
                <Text type="secondary">
                  版本：<Tag>{(currentAgent as any).version || '1.0'}</Tag>
                </Text>
                <Text type="secondary">
                  风险分级：<Tag color="green">{(currentAgent as any).riskLevel || '低风险'}</Tag>
                </Text>
              </Space>
            </Card>
          )}
        </Card>

      {/* 评测标准 */}
      <Card style={{ marginTop: 16 }} title="评测标准">
        <Space>
          <Text>{EVAL_STANDARD}</Text>
        </Space>
      </Card>

      {/* 评测维度（默认全量覆盖,一行展示,无需选择） */}
      <Card style={{ marginTop: 16 }} title="评测维度">
        <Form.Item name="dimensions" style={{ marginBottom: 0 }}>
          <Space size={8} wrap>
            {ALL_DIMENSIONS.map((dim) => (
              <Tag key={dim} color={dimensionColorMap[dim]} style={{ margin: 0 }}>
                {dim}
              </Tag>
            ))}
          </Space>
        </Form.Item>
      </Card>

      {/* 测试样本量 — V1.9：三档滑动条（左右拖动在三档间切换,类似调节音量的左右滑动组件） */}
      <Card
        style={{ marginTop: 16 }}
        title="测试样本量"
      >
        <Form.Item
          name="sampleLevel"
          label="样本量档位"
          required
          rules={[{ required: true, message: '请选择测试样本量档位' }]}
          style={{ marginBottom: 0 }}
        >
          <div style={{ padding: '8px 12px 28px', maxWidth: 720 }}>
            <Slider
              min={0}
              max={100}
              step={null}
              value={SLIDER_INDEX[sampleLevel]}
              marks={sampleMarks}
              tooltip={{ formatter: (v) => SLIDER_FROM_INDEX[v as number] || '' }}
              onChange={(v) => {
                const lv = SLIDER_FROM_INDEX[v as number];
                if (lv) {
                  setSampleLevel(lv);
                  form.setFieldsValue({ sampleLevel: lv });
                }
              }}
            />
          </div>
        </Form.Item>
        {sampleLevel ? (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              本次任务将以 <Tag color="blue">{sampleLevel}</Tag>
              （抽取 {sampleLevelPercent[sampleLevel]}% 题目）覆盖全部
              {ALL_DIMENSIONS.map((d) => (
                <Tag key={d} color={dimensionColorMap[d]} style={{ marginLeft: 2 }}>{d}</Tag>
              ))}{' '}
              全部维度
            </Text>
          </div>
        ) : null}
      </Card>
      </Form>

      {/* 底部按钮 */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space>
            <Button onClick={handleCancel} icon={<CloseOutlined />}>取消</Button>
            <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>暂存</Button>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleStart}>
              开始评测
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default CreateTask;
