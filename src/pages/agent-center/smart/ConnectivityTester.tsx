/**
 * §3.3 / §4.2.3 智能化连通测试面板
 *
 * 功能：
 *   - 启动测试：依次呈现 DNS 解析 → 建连 → 认证 → 请求 → 返回 5 阶段状态与耗时
 *   - 失败自动诊断：定位失败阶段、错误码、原因
 *   - 解决步骤：编号化建议 + 「按建议修改」（触发 onLocateField）
 *   - 测试通过：仅推送"测试验证正常"结果气泡（不再沉淀知识库 / 推送历史方案）
 *   - 测试失败：推送「测试验证异常」结果气泡 + Agent 联网搜索解决方案
 *
 * 父组件：Registration.tsx 通过 form + testFields 获取实时数据，
 *        调用 startTest(formValues) 触发，组件负责推进步骤与写入 store。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Progress,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  KeyOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { useSmartDraft } from './store';
import type { ConnDiagnostics, ConnStage, ConnStep, HistoricalPlan } from './types';

const { Text, Paragraph } = Typography;

interface Props {
  form?: FormInstance;
  onLocateField?: (fieldKey: string) => void;
  /** 连通必填项完整后由父级传入稳定签名，变化时自动发起测试 */
  autoTriggerKey?: string;
  onTestStart?: () => void;
  /** 用户填写的接口信息 */
  getConnectionFormValues: () => {
    accessMode?: string;
    apiEndpoint?: string;
    apiKey?: string;
    platformUrl?: string;
    platformKey?: string;
    agentName?: string;
  };
}

/**
 * §4.2.3 PRD：连通测试失败时, Agent 联网搜索解决方案。
 *   - 在 mock 环境下，模拟 WebSearch 返回「与失败错误码强相关」的 1-2 条解决方案
 *   - 真实环境应替换为后端检索（WebSearch 接口 / 内部知识库 RAG）
 *   - 失败原因 / 错误码 / 失败阶段 决定返回哪些条目
 */
const fetchWebSearchSolutions = (
  failStage: ConnStage,
  errorCode: string,
  reason: string,
): Array<{ id: string; title: string; summary: string; source: string; url: string; score: number }> => {
  // 模拟联网搜索的"延迟 + 命中"——按错误码字典返回最相关的 1-2 条
  const dict: Record<
    string,
    Array<{ id: string; title: string; summary: string; source: string; url: string }>
  > = {
    NXDOMAIN: [
      {
        id: 'ws-nx-1',
        title: 'NXDOMAIN 接口域名解析失败 — 排查步骤',
        summary:
          '1) 用 nslookup 域名 验证本地 DNS 是否能解析；2) 若内网域名, 需把 platform-hospital.cn 加入 hosts 或 DNS 转发；3) 若公网域名, 联系 IT 检查出口网络 ACL。',
        source: 'platform-kb.internal/article/conn-nxdomain',
        url: 'https://kb.platform-hospital.cn/article/conn-nxdomain',
      },
      {
        id: 'ws-nx-2',
        title: '智能体接入常见 DNS 故障案例（社区）',
        summary:
          '多位开发者反馈：接口地址拼写错误（多/少字符）或协议头未带 https:// 都会触发 NXDOMAIN。建议先以 IP 形式 ping 域名, 排除网络层后聚焦应用层。',
        source: 'dev-community/search?q=NXDOMAIN+agent',
        url: 'https://community.platform-hospital.cn/search?q=NXDOMAIN+agent',
      },
    ],
    '504': [
      {
        id: 'ws-504-1',
        title: '504 网关超时 — 平台侧长连接配置建议',
        summary:
          '504 多由「网关 5s 默认超时 + 智能体首包慢」共同引起。建议：1) 把客户端超时从 5s 调到 30s；2) 启用 HTTP Keep-Alive 长连接复用；3) 智能体侧确认已完成 SDK 初始化, 避免冷启动延迟。',
        source: 'platform-kb.internal/article/conn-504',
        url: 'https://kb.platform-hospital.cn/article/conn-504',
      },
      {
        id: 'ws-504-2',
        title: '智能体接入超时阈值规范 V2.1',
        summary:
          '平台对所有接入智能体统一推荐超时阈值: 健康检查 3s / 普通对话 30s / 长任务 120s。低于阈值会被网关侧截断, 高于阈值会被熔断器记录。',
        source: 'platform-doc/runtime/timeout-spec',
        url: 'https://docs.platform-hospital.cn/runtime/timeout-spec',
      },
    ],
    '401': [
      {
        id: 'ws-401-1',
        title: '401 鉴权失败 — API Key 签发 / 过期处理',
        summary:
          '401 通常是 API Key 无效或已过期。处置：1) 平台管理端 → 智能体 → 重新签发密钥；2) 在请求头添加 X-Api-Key: <key>；3) 确认密钥复制完整, 包含前缀 sk- 且无空格截断；4) 检查账号是否被禁用。',
        source: 'platform-kb.internal/article/conn-401',
        url: 'https://kb.platform-hospital.cn/article/conn-401',
      },
      {
        id: 'ws-401-2',
        title: 'API Key 命名规范与轮换策略',
        summary:
          '平台要求密钥以 sk- 前缀, 长度 ≥ 32 字符, 单 key 默认有效期 90 天。建议接入端实现 key 轮换（双 key 并行 + 灰度切换），避免过期导致全量 401。',
        source: 'platform-doc/security/key-rotation',
        url: 'https://docs.platform-hospital.cn/security/key-rotation',
      },
    ],
    '400': [
      {
        id: 'ws-400-1',
        title: '400 请求参数不符 — Content-Type 与 body schema 校验',
        summary:
          '400 常见原因：1) 请求头 Content-Type 与 body 不匹配（JSON 必须 application/json）；2) 必填字段缺失（接口地址 / patient / deviceId 等）；3) 字段类型与示例 schema 不符。处置: 先用平台提供的 curl 模板发一次, 排除自身代码。',
        source: 'platform-kb.internal/article/conn-400',
        url: 'https://kb.platform-hospital.cn/article/conn-400',
      },
      {
        id: 'ws-400-2',
        title: '智能体接口字段字典 V3',
        summary:
          '所有接入智能体的入参字段均已在「智能体接口字典 V3」中给出明确定义, 含必填、类型、示例。开发前请先下载对应字段表比对, 避免遗漏或拼写错。',
        source: 'platform-doc/api/field-dict-v3',
        url: 'https://docs.platform-hospital.cn/api/field-dict-v3',
      },
    ],
  };
  const list = dict[errorCode] || [
    {
      id: `ws-gen-${errorCode}`,
      title: `${errorCode || '未知错误'} — 通用排查清单`,
      summary:
        '建议按以下顺序排查：1) 核对接口地址 / 平台 URL 是否完整；2) 重新签发 API Key / 平台密钥；3) 检查 Content-Type / 请求体字段；4) 联系平台运维或在监控告警台账查询该接口状态。',
      source: 'platform-kb.internal/article/conn-generic',
      url: 'https://kb.platform-hospital.cn/article/conn-generic',
    },
  ];
  // 第一条 score=0.92, 第二条 0.78
  return list.map((it, idx) => ({ ...it, score: idx === 0 ? 0.92 : 0.78 }));
};

const STAGE_META: Record<ConnStage, { label: string; icon: React.ReactNode }> = {
  dns: { label: 'DNS 解析', icon: <GlobalOutlined /> },
  connect: { label: '建立连接', icon: <ApiOutlined /> },
  auth: { label: '鉴权验证', icon: <KeyOutlined /> },
  request: { label: '发送请求', icon: <SendOutlined /> },
  response: { label: '接收响应', icon: <ExperimentOutlined /> },
};

const STAGE_ORDER: ConnStage[] = ['dns', 'connect', 'auth', 'request', 'response'];

const ConnectivityTester: React.FC<Props> = ({
  onLocateField,
  autoTriggerKey,
  onTestStart,
  getConnectionFormValues,
}) => {
  const {
    connSteps,
    setConnSteps,
    connDiagnostics,
    setConnDiagnostics,
    historicalPlans,
    pushHistoricalPlans,
    addMessage,
  } = useSmartDraft();

  const [running, setRunning] = useState(false);
  // 本地状态镜像 + 写 store：保证 functional update 类型安全
  const [localSteps, setLocalSteps] = useState<ConnStep[]>([]);
  const [localDiagnostics, setLocalDiagnostics] = useState<ConnDiagnostics | null>(null);
  const lastAutoTriggerRef = useRef<string>('');

  // 模拟故障注入：当 apiKey 包含 "expired" 或 endpoint 含 "timeout" 时在指定阶段失败
  const decideOutcome = (vals: ReturnType<Props['getConnectionFormValues']>) => {
    const ek = vals.apiEndpoint || '';
    const ak = vals.apiKey || '';
    if (/badhost/.test(ek)) {
      return { failStage: 'dns' as ConnStage, code: 'NXDOMAIN', reason: '无法解析接口域名，请检查接口地址' };
    }
    if (/504-FAIL/.test(ak)) {
      return { failStage: 'connect' as ConnStage, code: '504', reason: '网关超时（接口超时），请检查网络与平台地址连通性' };
    }
    if (/401-FAIL/.test(ak)) {
      return { failStage: 'auth' as ConnStage, code: '401', reason: '鉴权失败，API Key 无效或已过期' };
    }
    if (/400/.test(ek)) {
      return { failStage: 'request' as ConnStage, code: '400', reason: '请求参数不符，请核对必填字段与 Content-Type' };
    }
    return { failStage: null, code: null, reason: null };
  };

  // 构建诊断的解决步骤
  const buildSteps = (
    failStage: ConnStage | null,
    code: string | null,
  ) => {
    if (!failStage || !code) return [];
    const stepsMap: Record<ConnStage, Array<{ idx: number; title: string; detail: string; fieldKey?: string }>> = {
      dns: [
        { idx: 1, title: '检查接口域名拼写', detail: '核对接口地址是否存在明显拼写错误，可改用 IP 探测网络层是否可达', fieldKey: 'apiEndpoint' },
        { idx: 2, title: '确认 DNS 服务器配置', detail: '在终端执行 nslookup / dig，确认内网 DNS 是否能解析该域名' },
        { idx: 3, title: '联系平台运维确认出口', detail: '如使用内网域名，请确认平台已加入白名单' },
      ],
      connect: [
        { idx: 1, title: '延长请求超时阈值', detail: '将超时从 5s 调整到 30s，并启用长连接复用（参见过往成功方案 hp-1）', fieldKey: 'apiEndpoint' },
        { idx: 2, title: '确认平台 URL 已签发', detail: 'SDK / OTel 接入需要先点击「获取 SDK / OTel」拿到有效的 platformUrl', fieldKey: 'platformUrl' },
        { idx: 3, title: '检查网络代理 / 防火墙', detail: '联系信息科确认目标端口是否在出站白名单中' },
      ],
      auth: [
        { idx: 1, title: '确认 API Key 是否有效', detail: '在请求头添加 X-Api-Key，并通过平台重新签发密钥', fieldKey: 'apiKey' },
        { idx: 2, title: '检查密钥字段是否密文粘贴', detail: '密钥包含前缀 sk- 时，请完整复制而非截取', fieldKey: 'apiKey' },
        { idx: 3, title: '确认账号未被禁用', detail: '错误 401 也可能由账号停用引起，可在监控告警台账查询该 Key 状态' },
      ],
      request: [
        { idx: 1, title: '核对请求体参数', detail: '移除冗余字段、补全必填字段；类型与示例保持一致', fieldKey: 'apiEndpoint' },
        { idx: 2, title: '核对请求头 Content-Type', detail: 'JSON 请求需声明 application/json；表单提交使用 application/x-www-form-urlencoded' },
        { idx: 3, title: '参考历史成功方案', detail: '过往「门诊预问诊智能体」在修复后联通成功，可一键复用', fieldKey: 'apiEndpoint' },
      ],
      response: [
        { idx: 1, title: '检查响应体大小与解析', detail: '若响应过大被截断，可分页 / 流式接收' },
        { idx: 2, title: '核对返回 schema', detail: '确认返回 JSON 结构与 SDK 期望一致，必要时启用容错解析' },
      ],
    };
    return stepsMap[failStage] || [];
  };

  // 启动测试
  const startTest = useCallback(async () => {
    if (running) return;
    const v = getConnectionFormValues();
    // 校验必填
    if (v.accessMode === 'API' && !v.apiEndpoint) {
      message.error('请先填写接口地址');
      return;
    }
    if ((v.accessMode === 'SDK' || v.accessMode === 'OTel') && !v.platformUrl) {
      message.error('请先获取 SDK / OTel 平台 URL');
      return;
    }

    onTestStart?.();
    setRunning(true);
    setLocalDiagnostics(null);
    setConnDiagnostics(null);

    const outcomes = decideOutcome(v);
    const initSteps: ConnStep[] = STAGE_ORDER.map((stage) => ({
      stage,
      label: STAGE_META[stage].label,
      status: 'pending',
    }));
    setLocalSteps(initSteps);
    setConnSteps(initSteps);

    // 逐步推进
    for (let i = 0; i < STAGE_ORDER.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 600));
      const stage = STAGE_ORDER[i];
      const isFailStage = outcomes.failStage === stage;
      // 通过 setLocalSteps 的 functional update 推进 (本地副本决定 UI 渲染)
      setLocalSteps((prev) => {
        const next = [...prev];
        const target = next.find((s) => s.stage === stage);
        if (!target) return prev;
        target.status = isFailStage ? 'fail' : 'running';
        target.latencyMs = 80 + Math.floor(Math.random() * 120);
        if (isFailStage && outcomes.code && outcomes.reason) {
          target.errorCode = outcomes.code;
          target.errorReason = outcomes.reason;
        }
        return next;
      });
      if (isFailStage) {
        // 把后续阶段 mark pending 并停止
        setLocalSteps((prev) =>
          prev.map((s) =>
            STAGE_ORDER.indexOf(s.stage) > i ? { ...s, status: 'pending' } : s,
          ),
        );
        // 生成诊断
        const diag: ConnDiagnostics = {
          failureStage: outcomes.failStage!,
          errorCode: outcomes.code!,
          errorReason: outcomes.reason!,
          hintFieldKey:
            outcomes.failStage === 'auth' ? 'apiKey' :
            outcomes.failStage === 'dns' ? 'apiEndpoint' :
            outcomes.failStage === 'request' ? 'apiEndpoint' :
            outcomes.failStage === 'connect' ? 'platformUrl' : undefined,
          steps: buildSteps(outcomes.failStage!, outcomes.code),
        };
        setLocalDiagnostics(diag);
        setRunning(false);
        message.error(`测试验证异常（${outcomes.code}）`);
        // §4.2.3 PRD：连通测试失败 → 1) 先在对话窗口推送「测试验证异常」结果气泡；
        //                  2) Agent 联网搜索解决方案（按错误码匹配 Top2），气泡中给出修改建议
        //   - 同 source 的旧消息会在 store 层被替换, 不堆叠
        //   - 不再推送 'historical-plan'（PRD §3.3.2 知识库/方案复用已下线）
        addMessage({
          role: 'agent',
          type: 'conn-test-result',
          content: `测试验证异常（${outcomes.code}）`,
          payload: {
            connTestResult: {
              ok: false,
              errorCode: outcomes.code!,
              errorReason: outcomes.reason!,
              failureStage: outcomes.failStage!,
              totalMs: undefined,
            },
          },
        });
        addMessage({
          role: 'agent',
          type: 'web-search-solution',
          content: '我正在联网搜索解决方案……',
          payload: {
            webSearchSolutions: fetchWebSearchSolutions(
              outcomes.failStage!,
              outcomes.code!,
              outcomes.reason!,
            ),
          },
        });
        // 同步清掉同 source 的旧 historical-plan（防止切换页面后遗留）
        pushHistoricalPlans([], 'test-fail');
        return;
      }
      // 当前阶段成功 → 标 ok
      setLocalSteps((prev) => {
        const next = [...prev];
        const target = next.find((s) => s.stage === stage);
        if (target) target.status = 'ok';
        return next;
      });
    }
    // 全程通过
    setRunning(false);
    message.success('测试验证正常');
    // §4.2.3 PRD：连通测试成功 → 仅弹"测试验证正常"，不再推送历史方案/知识库沉淀
    //   - PRD §3.3.2「知识库沉淀 / 方案复用」已下线, 不再调用 saveHistoricalPlan
    //   - 也不推送 historical-plan 气泡, 避免误导用户在成功后再做"复用"动作
    addMessage({
      role: 'agent',
      type: 'conn-test-result',
      content: '✓ 测试验证正常',
      payload: {
        connTestResult: {
          ok: true,
          totalMs: undefined,
        },
      },
    });
    // 清掉同 source 的旧 historical-plan（防止页面内历史方案残留）
    pushHistoricalPlans([], 'test-pass');
  }, [running, getConnectionFormValues, onTestStart, setConnSteps, setConnDiagnostics, addMessage, pushHistoricalPlans, historicalPlans]);

  useEffect(() => {
    if (!autoTriggerKey || running) return;
    if (lastAutoTriggerRef.current === autoTriggerKey) return;
    lastAutoTriggerRef.current = autoTriggerKey;
    void startTest();
  }, [autoTriggerKey, running, startTest]);

  // 当组件 mount 时把历史匹配度排个序
  useEffect(() => {
    // no-op; 仅占位保持 hook 顺序稳定
  }, []);

  // §3.3.2 历史方案复用：根据失败诊断 (failStage + errorCode) 匹配 Top3
  const recommendPlansForDiagnostics = (
    outcomes: ReturnType<typeof decideOutcome>,
  ): HistoricalPlan[] => {
    if (!historicalPlans.length) return [];
    const code = outcomes.code || '';
    return [...historicalPlans]
      .map((p) => {
        let score = 0.5;
        if (p.symptom.includes(code)) score += 0.35;
        if (
          (outcomes.failStage === 'auth' && p.symptom.includes('401')) ||
          (outcomes.failStage === 'connect' && p.symptom.includes('504'))
        ) {
          score += 0.1;
        }
        return { ...p, matchScore: Math.min(0.99, score) };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  };

  // 通过时推荐：默认按 matchScore 排序 Top3
  const recommendPlansForPass = (plans: HistoricalPlan[]): HistoricalPlan[] => {
    if (!plans.length) return [];
    return [...plans]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  };

  const totalSteps = STAGE_ORDER.length;
  const okCount = localSteps.filter((s) => s.status === 'ok').length;
  const failIdx = localSteps.findIndex((s) => s.status === 'fail');
  const progressPct =
    failIdx >= 0
      ? Math.round(((failIdx + 0.5) / totalSteps) * 100)
      : okCount === totalSteps && totalSteps > 0
        ? 100
        : Math.round((okCount / totalSteps) * 100);
  // 同步本地 steps / diagnostics 到 store (供 Registration 提交门控读取)
  useEffect(() => {
    setConnSteps(localSteps);
  }, [localSteps, setConnSteps]);
  useEffect(() => {
    setConnDiagnostics(localDiagnostics);
  }, [localDiagnostics, setConnDiagnostics]);

  return (
    <div data-testid="connectivity-tester" data-auto-trigger-key={autoTriggerKey || ''}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* 测试控制条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: running
              ? 'linear-gradient(90deg, #E6F4FF 0%, #FFFFFF 100%)'
              : '#FAFAFA',
            border: `1px solid ${running ? '#91CAFF' : '#F0F0F0'}`,
            borderRadius: 6,
          }}
        >
          <Space>
            {running ? (
              <LoadingOutlined style={{ color: '#1677FF' }} />
            ) : (
              <ThunderboltOutlined style={{ color: '#1677FF' }} />
            )}
            <Text strong>
              {running
                ? `测试中…正在${STAGE_META[localSteps.find((s) => s.status === 'running')?.stage || 'dns'].label}`
                : '连通测试'}
            </Text>
            {localSteps.length > 0 && (
              <Tag color={failIdx >= 0 ? 'error' : okCount === totalSteps ? 'success' : 'default'}>
                {failIdx >= 0
                  ? `失败于 ${STAGE_META[localSteps[failIdx].stage].label}`
                  : okCount === totalSteps
                    ? '全流程通过'
                    : `已通过 ${okCount}/${totalSteps}`}
              </Tag>
            )}
          </Space>
          <Space>
            <Button
              type="primary"
              icon={running ? <LoadingOutlined /> : <PlayCircleOutlined />}
              loading={running}
              onClick={startTest}
            >
              {running ? '测试中…' : '测试验证'}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setConnSteps([]);
                setConnDiagnostics(null);
              }}
              disabled={running}
            >
              重置
            </Button>
          </Space>
        </div>

        {/* 进度条 */}
        {localSteps.length > 0 && (
          <Progress
            percent={progressPct}
            size="small"
            status={failIdx >= 0 ? 'exception' : okCount === totalSteps ? 'success' : 'active'}
          />
        )}

        {/* 阶段时间线 */}
        {localSteps.length > 0 && (
          <Card size="small" bodyStyle={{ padding: 12 }}>
            <Timeline
              items={localSteps.map((s) => {
                const meta = STAGE_META[s.stage];
                const color =
                  s.status === 'ok'
                    ? 'green'
                    : s.status === 'fail'
                      ? 'red'
                      : s.status === 'running'
                        ? 'blue'
                        : 'gray';
                return {
                  color,
                  dot:
                    s.status === 'running' ? (
                      <LoadingOutlined style={{ color: '#1677FF' }} />
                    ) : (
                      meta.icon
                    ),
                  children: (
                    <Space size={6} wrap>
                      <Text strong style={{ fontSize: 13 }}>{meta.label}</Text>
                      {s.status === 'ok' && (
                        <>
                          <Tag color="green" style={{ margin: 0 }}>
                            <CheckCircleOutlined /> 通过
                          </Tag>
                          {s.latencyMs !== undefined && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              耗时 {s.latencyMs}ms
                            </Text>
                          )}
                        </>
                      )}
                      {s.status === 'running' && (
                        <Tag color="blue" style={{ margin: 0 }}>进行中</Tag>
                      )}
                      {s.status === 'fail' && (
                        <>
                          <Tag color="red" style={{ margin: 0 }}>
                            错误 {s.errorCode}
                          </Tag>
                          <Text type="danger" style={{ fontSize: 12 }}>
                            {s.errorReason}
                          </Text>
                        </>
                      )}
                      {s.status === 'pending' && (
                        <Tag style={{ margin: 0 }}>等待</Tag>
                      )}
                    </Space>
                  ),
                };
              })}
            />
          </Card>
        )}

        {/* 失败诊断 */}
        {localDiagnostics && (
          <Alert
            type="error"
            showIcon
            message={
              <Space wrap>
                <Text strong>失败诊断</Text>
                <Tag color="red">错误码 {localDiagnostics.errorCode}</Tag>
                <Text type="secondary">{STAGE_META[localDiagnostics.failureStage].label}阶段</Text>
              </Space>
            }
            description={
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text>{localDiagnostics.errorReason}</Text>
                <div>
                  <Text strong style={{ fontSize: 13 }}>解决步骤：</Text>
                  <ol style={{ marginTop: 4, paddingLeft: 18, marginBottom: 0 }}>
                    {localDiagnostics.steps.map((s) => (
                      <li key={s.idx} style={{ marginBottom: 4 }}>
                        <Text strong>{s.title}</Text>
                        <Paragraph style={{ margin: 0, fontSize: 12 }} type="secondary">
                          {s.detail}
                        </Paragraph>
                        {s.fieldKey && onLocateField && (
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => onLocateField(s.fieldKey!)}
                          >
                            按建议修改 →
                          </Button>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </Space>
            }
          />
        )}

        {/* PRD §4.2.3：连通测试通过 / 失败 的整体结果由 Agent 对话窗口的
            'conn-test-result' 气泡统一呈现。下方 alert 仅作为页面内紧凑提示。
            成功时不再展示"已脱敏沉淀"等知识库相关文案。 */}
        {!running && localSteps.length > 0 && failIdx < 0 && okCount === totalSteps && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="测试验证正常"
            description="可在底部点击「提交注册」继续"
          />
        )}
      </Space>
    </div>
  );
};

export default ConnectivityTester;
