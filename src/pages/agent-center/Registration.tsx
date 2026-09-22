/**
 * 智能体接入中心 - 新建/编辑注册（独立下转页）
 *
 * V3.1 调整：
 *   - 备案材料上传彻底统一：去掉顶部 Tab 切换、不做分类、不限份数、不做必填校验，
 *     仅保留 PDF 格式 + 单文件 ≤30M 基础校验，管理员审核时自行判断材料完整性。
 *
 * V2.6 调整：
 *   - 编辑页（草稿/退回修改/撤销修改）也接入 Agent 智能填入，与新建注册同源
 *   - 备案材料上传组件对齐 V2.x：单 Dragger + 顶部产品/技术/其他三档分段切换
 *   - 9 个 AI 预填字段（name/version/clinicalStage/description/supplier/contactName/contactPhone/apiEndpoint/apiKey）
 *     全部用 AIPrefillWrapper 包裹，支持采纳后 1.2s 闪烁 + 5s 绿色对勾消失
 *   - 进入页面即推送欢迎语（pushWelcomeGreeting），与新建注册页对齐
 *   - 「✏️」图标徽章由 AgentAssistant 自动管理，本页只需插入 AIPrefillWrapper
 *
 * V2.5 调整：
 *   - 基本信息 拆分为两个嵌套子区块，对齐 PRD §1.2.2：
 *     a. 智能体基本信息（智能体名称 / 编号 / 版本 / 所属科室 / 诊疗环节 / 功能描述）
 *     b. 来源与责任信息（智能体来源 / 供应商名称 / 技术联系人 / 联系方式）
 *   - 删除 PRD §1.2.2 / §1.3.2 均未列出的「智能体类型」字段，保持必填字段与 PRD 一致
 *
 * V2.2 调整：原 3 步 Steps + Drawer 调整为单页 3 个分块卡片
 *   - 备案材料上传（OCR 自动填充）
 *   - 基本信息
 *   - 技术信息（接入方式 + 测试验证）
 * 三块在同一页上下铺开，给足空间，避免抽屉视觉狭窄。
 * 进入路径：
 *   - 新建：/app/agent-center/register
 *   - 编辑（草稿/退回修改/撤销修改）：/app/agent-center/edit/:id
 */
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  CloudUploadOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { departmentOptions } from '../../mock/departments';
import PageHeader from '../../components/PageHeader';
import {
  ROLE_ADMIN,
  ROLE_DEPT,
  type AccessMode,
  type AccessRecord,
  sourceOptions,
  clinicalStageOptions,
  accessModeOptions,
  genAgentCode,
} from './types';
import {
  getAccessRecord,
  nowISO,
  upsertAccessRecord,
  useAccessRecords,
} from './store';
import { useSmartDraft } from './smart/store.tsx';
import AIPrefillWrapper from './smart/AIPrefillWrapper';
import ConnectivityTester from './smart/ConnectivityTester';
import { AutoInsightPanel } from './smart/InsightBubble';
import type { ReviewProblem } from './smart/types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// PRD §1.2.1 备案材料（V3.1 统一上传入口）：
//   不分类、不限份数、不做必填校验，管理员审核时自行判断。
//   仅做 PDF 格式 + 单文件 ≤30M 的基础校验。
//   历史附件保留 category 字段用于详情页展示分类（不再用于校验）。
type AttachmentCategory = 'product' | 'tech' | 'other';

const Registration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const editingId = params.id;
  const isEdit = !!editingId;

  const { currentUser } = useAuth();
  const role = currentUser?.roles[0] || ROLE_ADMIN;
  const isDeptAdmin = role === ROLE_DEPT;
  const loginName = currentUser?.name || '当前用户';

  // 订阅列表：用于 dup 校验、agentCode 生成
  const records = useAccessRecords();

  // 智能填入：监听 store 中 AgentAssistant 推送的预填值与元数据
  const {
    pendingPrefills,
    prefillMeta,
    addMessage,
    clearPrefill,
    pushWelcomeGreeting,
    reviewProblems,
    setReviewProblems,
    confirmProblem,
    ignoreProblem,
    connSteps,
    setConnSteps,
    connDiagnostics,
    setConnDiagnostics,
    pendingUploadedFile,
    clearUploadedFile,
  } = useSmartDraft();

  // 编辑态：从 store 拉原始记录
  const draftTarget: AccessRecord | undefined = useMemo(() => {
    if (!editingId) return undefined;
    return getAccessRecord(editingId);
  }, [editingId]);

  const [form] = Form.useForm();

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tested, setTested] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    ok: boolean;
    message: string;
    historical?: boolean;
  }>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [connectionValues, setConnectionValues] = useState<{
    accessMode?: AccessMode;
    apiEndpoint?: string;
    apiKey?: string;
    platformUrl?: string;
    platformKey?: string;
  }>({ accessMode: 'API' });

  const refreshConnectionValues = useCallback(() => {
    const v = form.getFieldsValue([
      'accessMode',
      'apiEndpoint',
      'apiKey',
      'platformUrl',
      'platformKey',
    ]);
    setConnectionValues({
      accessMode: v.accessMode,
      apiEndpoint: v.apiEndpoint,
      apiKey: v.apiKey,
      platformUrl: v.platformUrl,
      platformKey: v.platformKey,
    });
  }, [form]);

  const syncConnectionValues = useCallback((v: Record<string, any>) => {
    setConnectionValues({
      accessMode: v.accessMode,
      apiEndpoint: v.apiEndpoint,
      apiKey: v.apiKey,
      platformUrl: v.platformUrl,
      platformKey: v.platformKey,
    });
  }, []);

  const connectionAutoTriggerKey = useMemo(() => {
    const endpoint = String(connectionValues.apiEndpoint || '').trim();
    const apiKey = String(connectionValues.apiKey || '').trim();
    if (connectionValues.accessMode !== 'API' || !endpoint || !apiKey) return '';
    return ['API', endpoint, apiKey].join('|');
  }, [connectionValues]);

  const connectionSignature = useMemo(
    () =>
      [
        connectionValues.accessMode || '',
        String(connectionValues.apiEndpoint || '').trim(),
        String(connectionValues.apiKey || '').trim(),
        String(connectionValues.platformUrl || '').trim(),
        String(connectionValues.platformKey || '').trim(),
      ].join('|'),
    [connectionValues],
  );

  const lastConnectionSignatureRef = useRef('');
  useEffect(() => {
    if (!connectionSignature) return;
    if (!lastConnectionSignatureRef.current) {
      lastConnectionSignatureRef.current = connectionSignature;
      return;
    }
    if (lastConnectionSignatureRef.current === connectionSignature) return;
    lastConnectionSignatureRef.current = connectionSignature;
    setTested(false);
    setTestResult(null);
    setConnSteps([]);
    setConnDiagnostics(null);
  }, [connectionSignature, setConnSteps, setConnDiagnostics]);

  // 进入编辑态：填充表单
  // 修复点：1) 接入方式下的 apiEndpoint / apiKey / platformUrl / platformKey
  //          等 Form.Item 被 <Form.Item shouldUpdate> 门控渲染，首次挂载前调
  //          setFieldsValue 写入的字段在子树挂载时不一定能同步上 store 值。
  //          拆成两个 effect 跑：第一个 effect 写 accessMode（外层 Form.Item
  //          始终挂载）触发 shouldUpdate、子树挂载；第二个 effect 在 commit
  //          之后再写其余字段，确保 Form.Item 已挂载并能从 store 拿到值。
  //       2) 历史 connectionTested=true 不应直接作为"当前测试通过"展示
  //          ——接口地址已变更/为空时显示"测试通过"会让用户困惑，且提交
  //          按钮将绕过重新测试。改为：编辑态清空 tested/testResult，提示
  //          "上次测试结果"作为参考，用户重新测试后再提交。
  const lastEditTargetId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!draftTarget) {
      form.setFieldsValue({
        version: '1.0',
        accessMode: 'API',
        clinicalStage: '其他',
        department: isDeptAdmin ? currentUser?.department : undefined,
      });
      requestAnimationFrame(refreshConnectionValues);
      lastEditTargetId.current = undefined;
      return;
    }
    setFileList(
      draftTarget.attachments.map((a, i) => {
        // V3.1 历史附件按文件名启发式归类（仅用于详情页展示分类标签）：
        //   - 名称含「技术/Spec/SDK/API/接口/OTel」→ 技术规格书
        //   - 名称含「产品/说明/Product」→ 产品说明书
        //   - 其它 → 其他材料
        const lowerName = (a.name || '').toLowerCase();
        const cat: AttachmentCategory = /(技术|spec|sdk|api|接口|otel)/i.test(lowerName)
          ? 'tech'
          : /(产品|说明|product)/i.test(lowerName)
            ? 'product'
            : 'other';
        return {
          uid: `-${i}`,
          name: a.name,
          status: 'done',
          size: 1024 * 1024,
          category: cat,
        } as UploadFile;
      }),
    );
    // 历史测试结果仅作参考展示，不当作"当前已通过"
    setTested(false);
    setTestResult(
      draftTarget.connectionTested
        ? {
            ok: draftTarget.connectionStatus === 'success',
            message: `（上次测试结果，仅供参考）${draftTarget.connectionMessage || '联通成功'}`,
            historical: true,
          }
        : null,
    );
    // 第一步：写 accessMode（外层 Form.Item 始终挂载，可同步触发 shouldUpdate 子树挂载）
    form.setFieldsValue({ accessMode: draftTarget.accessMode });
    requestAnimationFrame(refreshConnectionValues);
    lastEditTargetId.current = draftTarget.id;
  }, [draftTarget, form, isDeptAdmin, currentUser, refreshConnectionValues]);

  // §3.2 审查 debounce timer
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // §3.2.1 实时审查去重:open 问题 id 签名,避免重复推对话消息
  const lastReviewSigRef = useRef<string>('');
  useEffect(() => () => {
    if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
  }, []);

  // 第二步：等 accessMode 子树挂载后再写其余字段
  useEffect(() => {
    if (!draftTarget) return;
    if (lastEditTargetId.current !== draftTarget.id) return;
    // 推迟到 commit 之后，确保子树 Form.Item 已挂载并注册到 store
    const id = requestAnimationFrame(() => {
      form.setFieldsValue({
        name: draftTarget.name,
        agentCode: draftTarget.agentCode,
        version: draftTarget.version,
        modelName: draftTarget.modelName,
        modelVersion: draftTarget.modelVersion,
        modelDeploymentMode: draftTarget.modelDeploymentMode,
        department: draftTarget.department,
        clinicalStage: draftTarget.clinicalStage,
        source: draftTarget.source,
        supplier: draftTarget.supplier,
        contactName: draftTarget.contactName,
        contactPhone: draftTarget.contactPhone,
        type: draftTarget.type,
        description: draftTarget.description,
        apiEndpoint: draftTarget.apiEndpoint,
        apiKey: draftTarget.apiKey,
        platformUrl: draftTarget.platformUrl,
        platformKey: draftTarget.platformKey,
      });
      refreshConnectionValues();
    });
    return () => cancelAnimationFrame(id);
  }, [draftTarget, form, refreshConnectionValues]);

  // ──────────────────────────────────────────────────────────────────
  // V2.6 智能填入：进入页面即推送欢迎语
  //   - 编辑态 / 新建态均复用 'smart-register' key（语义一致：填写注册表单）
  //   - store 内部去重避免 React StrictMode 双调用
  //   - 用户身份标记 provider 角色，与新建注册同源
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const visibleRecords = records.filter((r) => (isDeptAdmin ? r.applicant === loginName : true));
    const count = (status: string) => visibleRecords.filter((r) => r.status === status).length;
    pushWelcomeGreeting('smart-register', isDeptAdmin ? 'dept' : 'admin', (_key, _role, surface) =>
      surface === 'bubble'
        ? isDeptAdmin
          ? [String(count('审核中')), String(count('审核通过')), String(count('退回修改'))]
          : [String(count('待审核')), String(count('审核通过')), String(count('退回修改'))]
        : undefined,
    {
      actions: [
        { key: 'upload', label: '上传', event: 'agent-register-trigger-upload', enabled: true },
        { key: 'voice', label: '语音描述', event: 'agent-register-trigger-voice', enabled: true },
      ],
    });
  }, [pushWelcomeGreeting, isDeptAdmin, records, loginName]);

  // ──────────────────────────────────────────────────────────────────
  // §3.2 填写内容智能审查 — 注册页实时审查
  //   - runReview: 读取表单当前值,产出 ReviewProblem[] 并写入 store
  //   - 4 大类审查:必填缺失 / 格式不符 / 前后不一致 / 材料与字段不匹配
  //   - 错误级别（error）会阻断提交;警告/提示不阻断（仅 toast 提醒）
  //   - 「帮我检查一下」按钮 / 字段失焦 / 提交前 自动触发 runReview
  // V3.1：备案材料不做分类/份数/必填校验,runReview 直接读 fileList.length 判断是否上传材料
  // ──────────────────────────────────────────────────────────────────
  const runReview = useCallback(() => {
    const v = form.getFieldsValue(true) as Record<string, any>;
    const problems: ReviewProblem[] = [];

    // V3.1 备案材料审查：不做必填校验，仅当完全未上传时温和提示
    if (fileList.length === 0) {
      problems.push({
        id: 'm-materials-empty',
        severity: 'warning',
        category: 'materials',
        title: '备案材料暂未上传',
        reason: '建议至少上传一份备案材料(产品说明书 / 技术规格书 / 其他材料)',
        impact: '管理员审核时可能因资料不全而退回',
        autoFixable: false,
        status: 'open',
      });
    }

    // ② 基本信息审查
    if (v.name) {
      const dup = records.some(
        (r) => r.name === v.name && r.id !== draftTarget?.id,
      );
      if (dup) {
        problems.push({
          id: 'r-name-dup',
          severity: 'error',
          fieldKey: 'name',
          category: 'basic',
          title: '智能体名称重复',
          reason: '当前名称已被其他注册使用',
          impact: '提交将失败；请修改为唯一名称',
          suggestion: '可添加版本号或科室后缀，如「智能导诊助手 · 心内 · v2.0」',
          status: 'open',
        });
      }
      if (v.name.length < 2 || v.name.length > 20) {
        problems.push({
          id: 'r-name-len',
          severity: 'warning',
          fieldKey: 'name',
          category: 'basic',
          title: '智能体名称长度不在 2–20 字符',
          reason: `当前长度 ${v.name.length}`,
          impact: '前端校验不通过，提交按钮将置灰',
          status: 'open',
        });
      }
    }
    if (v.version && !/^\d+\.\d+$/.test(v.version)) {
      problems.push({
        id: 'r-version-format',
        severity: 'error',
        fieldKey: 'version',
        category: 'basic',
        title: '版本号格式不符',
        reason: '应为「数字.数字」格式，如 1.0 / 2.1',
        impact: '审核环节会标记为「版本号不规范」',
        suggestion: '1.0',
        status: 'open',
      });
    }
    if (!v.department) {
      problems.push({
        id: 'r-dept-required',
        severity: 'error',
        fieldKey: 'department',
        category: 'basic',
        title: '「所属科室」未选择',
        reason: '智能体编号按「科室编号-准入顺序号」自动生成',
        impact: '无法生成智能体编号；台账归类不准确',
        status: 'open',
      });
    }
    if (v.contactPhone && !/^1[3-9]\d{9}$/.test(v.contactPhone)) {
      problems.push({
        id: 'r-phone-format',
        severity: 'error',
        fieldKey: 'contactPhone',
        category: 'basic',
        title: '联系方式格式错误',
        reason: '限制 11 位手机号（中国大陆 1[3-9]开头）',
        impact: '管理员将无法联系到技术接口人',
        autoFixable: false,
        status: 'open',
      });
    }
    if (v.contactName && (v.contactName.length < 2 || v.contactName.length > 10)) {
      problems.push({
        id: 'r-contact-len',
        severity: 'warning',
        fieldKey: 'contactName',
        category: 'basic',
        title: '技术联系人姓名长度 2–10 字',
        reason: `当前长度 ${v.contactName.length}`,
        impact: '与字段限制不一致，提交将被阻断',
        status: 'open',
      });
    }

    // ③ 一致性：来源 = 自研时,供应商不应填
    if (v.source === '自研' && v.supplier && v.supplier.trim()) {
      problems.push({
        id: 'c-source-supplier',
        severity: 'warning',
        fieldKey: 'supplier',
        category: 'basic',
        title: '智能体来源 = 自研,供应商字段应为空',
        reason: '字段前后不一致,审标记前会被提示',
        impact: '请选择「第三方」或「合作研发」后再保留供应商',
        suggestion: '',
        status: 'open',
      });
    }
    // ③ 一致性：功能描述 vs 诊疗环节
    if (v.description && v.clinicalStage) {
      const d = v.description;
      const map: Record<string, RegExp> = {
        导诊分诊: /分诊|导诊/,
        预问诊: /预问诊|问诊/,
        辅助诊断: /诊断|读片|影像/,
        辅助检查: /检查|化验|检验/,
        辅助治疗: /治疗|用药|方案/,
        住院: /住院|入院/,
        手术: /手术|术前|术后/,
        预约挂号: /挂号|预约/,
      };
      const re = map[v.clinicalStage];
      if (re && !re.test(d)) {
        problems.push({
          id: 'c-stage-desc',
          severity: 'info',
          fieldKey: 'clinicalStage',
          category: 'basic',
          title: '诊疗环节与功能描述不完全一致',
          reason: `选择「${v.clinicalStage}」,但描述里没有出现关键词:${re.source}`,
          impact: '可供二次审核时辅助判断',
          status: 'open',
        });
      }
    }

    // ④ 技术信息审查
    if (v.accessMode === 'API' && v.apiEndpoint && !/^https?:\/\//.test(v.apiEndpoint)) {
      problems.push({
        id: 't-endpoint-format',
        severity: 'error',
        fieldKey: 'apiEndpoint',
        category: 'tech',
        title: '接口地址格式错误',
        reason: '应包含 http(s):// 协议头',
        impact: '连通测试将失败',
        suggestion: 'http://10.10.10.20:8080/chat',
        status: 'open',
      });
    }
    if (v.accessMode === 'API' && !v.apiEndpoint) {
      problems.push({
        id: 't-endpoint-required',
        severity: 'error',
        fieldKey: 'apiEndpoint',
        category: 'tech',
        title: '接口地址未填写',
        reason: 'API 接入方式要求填写接口地址',
        impact: '无法发起连通测试，【提交】将置灰',
        status: 'open',
      });
    }
    if (v.apiKey) {
      // 可自动修复:补全缺失的 sk- 前缀
      if (!/^sk-/.test(v.apiKey)) {
        problems.push({
          id: 't-key-prefix',
          severity: 'warning',
          fieldKey: 'apiKey',
          category: 'tech',
          title: 'API Key 缺少标准前缀',
          reason: '平台要求密钥以「sk-」开头',
          impact: '鉴权阶段可能被平台网关拒绝',
          autoFixable: true,
          autoFixValue: `sk-${v.apiKey}`,
          status: 'open',
        });
      }
    }
    if ((v.accessMode === 'SDK' || v.accessMode === 'OTel') && !v.platformUrl) {
      problems.push({
        id: 't-platform-required',
        severity: 'error',
        fieldKey: 'platformUrl',
        category: 'tech',
        title: `${v.accessMode} 接入需要先点击「获取 ${v.accessMode}」`,
        reason: `${v.accessMode} 接入由平台自动签发 URL 与密钥`,
        impact: '接入信息不完整，提交被阻断',
        status: 'open',
      });
    }
    setReviewProblems(problems);
    // §3.2.1 实时定位问题放入 Agent 聊天气泡（不再渲染独立面板/状态条卡片）：
    //   1) 推一条 pre-audit-summary（错误 / 警告 / 提示 计数 + "帮我检查一下" 按钮）
    //   2) 对每条 open 问题推一条 pre-audit-issue（"定位到字段" / "忽略本条"）
    //   用本次 open 问题 id 签名去重,避免 onValuesChange 800ms debounce 重复堆消息
    const sig = problems
      .filter((p) => p.status === 'open')
      .map((p) => p.id)
      .sort()
      .join('|');
    if (sig === lastReviewSigRef.current) return;
    lastReviewSigRef.current = sig;
    if (problems.length === 0) {
      addMessage({
        role: 'agent',
        type: 'autofix-done',
        content: '✓ 实时审查通过：当前已填内容无错误、未见警告与提示。',
      });
      return;
    }
    const err = problems.filter((p) => p.severity === 'error' && p.status === 'open').length;
    const warn = problems.filter((p) => p.severity === 'warning' && p.status === 'open').length;
    const info = problems.filter((p) => p.severity === 'info' && p.status === 'open').length;
    addMessage({
      role: 'agent',
      type: 'pre-audit-summary',
      content:
        err > 0
          ? `实时审查发现 ${err} 个错误${warn > 0 ? `、${warn} 个警告` : ''}${info > 0 ? `、${info} 个提示` : ''},请逐条查看并修正。`
          : warn > 0
            ? `实时审查发现 ${warn} 个警告${info > 0 ? `、${info} 个提示` : ''},建议确认。`
            : '实时审查未发现错误,请继续完善。',
      payload: {
        preAuditSummary: { errors: err, warnings: warn, infos: info, total: problems.length },
      },
    });
    problems
      .filter((p) => p.status === 'open')
      .forEach((p) => {
        addMessage({
          role: 'agent',
          type: 'pre-audit-issue',
          content: `${p.reason} · ${p.impact}${p.suggestion ? ` · 建议:${p.suggestion}` : ''}`,
          payload: {
            preAuditIssue: {
              id: p.id,
              severity: p.severity,
              fieldKey: p.fieldKey || '',
              title: p.title,
              reason: p.reason,
              status: 'open',
            },
          },
        });
      });
  }, [form, fileList, records, draftTarget, setReviewProblems, addMessage]);

  // §3.2 进入页面 1.2s 后自动跑一次审查；字段失焦触发：直接监听 form onValuesChange 节的 setTimeout
  useEffect(() => {
    const t = setTimeout(() => runReview(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §3.3 把 ConnectivityTester 的结果同步到本地 tested/testResult, 影响 buildRecord 与提交门控
  useEffect(() => {
    if (!connSteps || connSteps.length === 0) return;
    const okCount = connSteps.filter((s) => s.status === 'ok').length;
    const failIdx = connSteps.findIndex((s) => s.status === 'fail');
    if (okCount === connSteps.length) {
      setTested(true);
      setTestResult({ ok: true, message: '联通成功，可提交注册。' });
    } else if (failIdx >= 0 && connDiagnostics) {
      setTested(true);
      setTestResult({
        ok: false,
        message: `联通失败：${connDiagnostics.errorReason}（错误码 ${connDiagnostics.errorCode}）`,
      });
    }
  }, [connSteps, connDiagnostics]);

  // §3.2.1 监听 Agent 对话窗口触发的事件：
  //   - agent-review-locate-field：单条问题气泡点击「定位到字段」→ form.scrollToField
  //   - agent-review-rerun：点击「帮我检查一下」/ 对话窗口输入触发词 → 清空签名后重审
  useEffect(() => {
    const onLocate = (e: Event) => {
      const fieldKey = (e as CustomEvent<string>).detail;
      if (!fieldKey) return;
      form.scrollToField(fieldKey, { behavior: 'smooth', block: 'center' });
    };
    const onRerun = () => {
      lastReviewSigRef.current = '';
      runReview();
    };
    window.addEventListener('agent-review-locate-field', onLocate);
    window.addEventListener('agent-review-rerun', onRerun);
    return () => {
      window.removeEventListener('agent-review-locate-field', onLocate);
      window.removeEventListener('agent-review-rerun', onRerun);
    };
  }, [form, runReview]);

  // V2.6 智能填入：监听 pendingPrefills (来自 AgentAssistant)
  //   - 每次新值进入，调用 setFieldsValue 回填表单
  //   - 已 acknowledged 的字段不回填（防止采纳后又覆盖）
  const lastPrefillRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const changedKeys = Object.keys(pendingPrefills).filter(
      (k) => pendingPrefills[k] !== lastPrefillRef.current[k],
    );
    if (changedKeys.length === 0) return;
    const patch: Record<string, string> = {};
    changedKeys.forEach((k) => {
      const meta = prefillMeta[k];
      if (meta?.acknowledged) return;
      patch[k] = pendingPrefills[k];
    });
    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch);
    }
    lastPrefillRef.current = { ...pendingPrefills };
  }, [pendingPrefills, prefillMeta, form]);

  // V2.6 智能填入：监听字段被采纳后滚动到该字段
  //   - 仅滚动本轮刚被采纳 (新 acknowledgedAt) 的字段
  //   - 与 AIPrefillWrapper 1.2s 闪烁 class 同步
  const lastAckAtRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const newAcks: string[] = [];
    Object.entries(prefillMeta).forEach(([k, m]) => {
      if (!m?.acknowledged || !m.acknowledgedAt) return;
      if (lastAckAtRef.current[k] === m.acknowledgedAt) return;
      lastAckAtRef.current[k] = m.acknowledgedAt;
      newAcks.push(k);
    });
    if (newAcks.length > 0) {
      const first = newAcks[0];
      requestAnimationFrame(() => {
        form.scrollToField(first, { behavior: 'smooth', block: 'center' });
      });
    }
  }, [prefillMeta, form]);

  // V2.6 用户手动改字段 → 清除 AI 预填高亮 (AIPrefillWrapper 内部已自动处理)
  //   这里再兜一层通知 store，让 AgentAssistant 下次推送不再以 "未确认" 标识
  const handleUserChange = (key: string) => {
    clearPrefill(key);
  };

  // ──────────────────────────────────────────────────────────────────
  // §3.1.1 Agent 对话窗口上传 PDF → 同步到「备案材料」列表
  //   - AgentAssistant.handleUpload 写入 store.pendingUploadedFile（仅 PDF）
  //   - 本 effect 监听后 append 到本地 fileList，并调 clearUploadedFile 置空
  //   - 同 uid 已存在则跳过（防 React StrictMode 双跑 / 二次上传）
  //   - category 字段：复用 V3.1 文件名启发式归类（仅用于详情页展示标签）
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const f = pendingUploadedFile;
    if (!f) return;
    setFileList((prev) => {
      if (prev.some((x) => x.uid === f.uid)) return prev;
      const lowerName = (f.name || '').toLowerCase();
      const cat: AttachmentCategory = /(技术|spec|sdk|api|接口|otel)/i.test(lowerName)
        ? 'tech'
        : /(产品|说明|product)/i.test(lowerName)
          ? 'product'
          : 'other';
      return [
        ...prev,
        {
          uid: f.uid,
          name: f.name,
          size: f.size,
          type: f.type,
          status: 'done',
          category: cat,
        } as UploadFile,
      ];
    });
    // 仅 PDF 才走到这里（AgentAssistant 已过滤），不发消息避免重复 toast
    message.success(`已同步至备案材料：${f.name}`);
    clearUploadedFile();
  }, [pendingUploadedFile, clearUploadedFile]);

  // ──────────────────────────────────────────────────────────────────
  // 上传 / OCR / 签发
  //   V3.1：备案材料统一上传入口——不做分类、不限份数、不做必填校验，
  //   仅校验 PDF 格式 + 单文件 ≤30M，管理员审核时自行判断材料完整性。
  //   历史附件保留 category 字段（用于详情页/审核页展示分类标签）。
  // ──────────────────────────────────────────────────────────────────

  const handleRemove = (file: UploadFile) => {
    setFileList((prev) => prev.filter((x) => x.uid !== file.uid));
    return true;
  };

  const handleUpload = (info: { file: UploadFile; fileList: UploadFile[] }) => {
    const f = info.file;
    const isPdf = f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf'));
    const size = f.size ?? 0;
    if (!isPdf) {
      message.error(`上传失败,仅支持 PDF 类型文件（${f.name}）`);
      return;
    }
    if (size > 30 * 1024 * 1024) {
      message.error(`上传失败,单文件超过最大限制 30M（${f.name}）`);
      return;
    }
    // V3.1：不做分类/份数限制，按文件名启发式给个 category 用于详情展示
    const guessed: AttachmentCategory = /(技术|spec|sdk|api|接口|otel)/i.test((f.name || '').toLowerCase())
      ? 'tech'
      : /(产品|说明|product)/i.test((f.name || '').toLowerCase())
        ? 'product'
        : 'other';
    setFileList((prev) => {
      const without = prev.filter((x) => x.uid !== f.uid);
      return [...without, { ...f, category: guessed } as UploadFile];
    });
    message.success(`上传成功（${f.name}）`);
  };

  const obtainSdk = () => {
    form.setFieldsValue({
      platformUrl: 'https://otel.platform-hospital.cn/agent/' + (form.getFieldValue('agentCode') || 'new'),
      platformKey: 'sk-sdk-' + Math.random().toString(36).slice(2, 10),
    });
    message.success('SDK 已签发：URL + 密钥已生成');
  };
  const obtainOtel = () => {
    form.setFieldsValue({
      platformUrl: 'https://otel.platform-hospital.cn/agent/' + (form.getFieldValue('agentCode') || 'new'),
      platformKey: 'sk-otel-' + Math.random().toString(36).slice(2, 10),
    });
    message.success('OTel 已签发：URL + 密钥已生成');
  };

  // ──────────────────────────────────────────────────────────────────
  // 校验并保存
  // ──────────────────────────────────────────────────────────────────
  const validateAll = async (): Promise<boolean> => {
    try {
      await form.validateFields();
    } catch {
      message.error('请检查表单填写，存在未通过的校验');
      return false;
    }
    // V3.1：备案材料不做必填校验，管理员审核时自行判断
    const v = form.getFieldsValue();
    if (!/^1[3-9]\d{9}$/.test(v.contactPhone || '')) {
      message.error('请输入正确的 11 位手机号');
      return false;
    }
    if (!/^\d+\.\d+$/.test(v.version || '')) {
      message.error('版本号仅允许「数字.数字」格式');
      return false;
    }
    if (!v.modelName?.trim() || !v.modelVersion?.trim() || !v.modelDeploymentMode) {
      message.error('请完整填写使用模型名称、使用模型版本和模型部署方式');
      return false;
    }
    if (!/^\d+\.\d+$/.test(v.modelVersion)) {
      message.error('使用模型版本仅允许「数字.数字」格式');
      return false;
    }
    if ((v.description || '').length > 500) {
      message.error('功能描述不超过 500 字');
      return false;
    }
    if (v.accessMode === 'API' && !v.apiEndpoint) {
      message.error('请填写 API 接口地址');
      return false;
    }
    if ((v.accessMode === 'SDK' || v.accessMode === 'OTel') && !v.platformUrl) {
      message.error(`请先点击「获取 ${v.accessMode}」签发平台 URL 与密钥`);
      return false;
    }
    return true;
  };

  const buildRecord = (status: AccessRecord['status'], extra: Partial<AccessRecord> = {}): AccessRecord => {
    const v = form.getFieldsValue(true);
    const id = draftTarget?.id || `acc-${Date.now()}`;
    const code =
      draftTarget?.agentCode ||
      (v.department
        ? genAgentCode(
            v.department,
            records.filter((r) => r.id !== id).map((r) => r.agentCode),
          )
        : '');
    return {
      id,
      name: v.name || '未命名草稿',
      agentCode: code,
      version: v.version || '',
      modelName: v.modelName || '',
      modelVersion: v.modelVersion || '',
      modelDeploymentMode: v.modelDeploymentMode,
      department: v.department || '',
      clinicalStage: v.clinicalStage || '',
      source: v.source,
      supplier: v.supplier,
      contactName: v.contactName,
      contactPhone: v.contactPhone,
      type: v.type,
      description: v.description,
      applicant: draftTarget?.applicant || loginName,
      applicantRole: draftTarget?.applicantRole || role,
      attachments: fileList.map((f) => ({
        name: f.name,
        size: `${((f.size ?? 0) / 1024 / 1024).toFixed(1)} MB`,
        url: '#',
      })),
      accessMode: v.accessMode,
      apiEndpoint: v.apiEndpoint,
      apiKey: v.apiKey,
      platformUrl: v.platformUrl,
      platformKey: v.platformKey,
      connectionTested: tested,
      connectionStatus: testResult?.ok ? 'success' : 'failed',
      connectionMessage: testResult?.message,
      status,
      lastEditTime: nowISO(0),
      auditHistory: draftTarget?.auditHistory || [],
      ...extra,
    };
  };

  // 暂存只校验「智能体名称」必填,其他字段不阻塞草稿保存
  const validateDraft = async (): Promise<boolean> => {
    try {
      await form.validateFields(['name']);
    } catch {
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (!(await validateDraft())) return;
    const rec = buildRecord('草稿');
    upsertAccessRecord(rec);
    message.success('注册表单填写记录已暂存至草稿状态列表页');
    setTimeout(() => navigate('/app/agent-center?tab=草稿'), 400);
  };

  const submitRegister = async () => {
    if (!(await validateAll())) return;
    // 历史测试结果不计入"当前已通过"，必须重新测试
    if (!tested || !testResult?.ok || testResult.historical) {
      message.error('当前无法提交注册，请重新完成连通测试并确保可正常连通');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    const rec = buildRecord('待审核', {
      submitTime: nowISO(0),
      auditHistory: [
        ...(draftTarget?.auditHistory || []),
        {
          label: draftTarget ? '重新注册提交审核' : '提交审核',
          time: nowISO(0),
          status: 'finish',
          operator: loginName,
          desc: '已提交，等待信息科管理员审核',
        },
      ],
    });
    upsertAccessRecord(rec);
    setSubmitting(false);
    message.success('提交成功');
    // V2.6 给对话助手推一条提交成功反馈 (与新建注册页一致)
    addMessage({
      role: 'agent',
      type: 'autofix-done',
      content: draftTarget
        ? '已为你提交修改后的注册表,接下来进入审核中状态,我会持续陪你跟进审核进度。'
        : '已为你提交注册,接下来进入审核中状态,我会持续陪你跟进审核进度。',
    });
    setTimeout(() => navigate('/app/agent-center?tab=待审核'), 600);
  };

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title={draftTarget ? `编辑注册：${draftTarget.name}` : '新建注册'}
        subTitle={
          draftTarget
            ? '修改注册信息并重新提交，或暂存至草稿'
            : '新建智能体注册：备案材料 OCR 识别 → 基本信息 → 技术信息 → 测试验证 → 提交'
        }
        showBack
        onBack={() => navigate(-1)}
        breadcrumb={[
          { path: '/app/agent-center', breadcrumbName: '智能体接入中心' },
          { path: '/app/agent-center', breadcrumbName: '注册管理' },
          {
            path: isEdit ? `/app/agent-center/edit/${editingId}` : '/app/agent-center/register',
            breadcrumbName: isEdit ? `编辑：${draftTarget?.name || ''}` : '新建注册',
          },
        ]}
      />

      {/* §3.2 智能审查结果已统一收回到右下角 Agent 对话气泡（pre-audit-summary + pre-audit-issue），
          不在新建注册页新增独立「实时定位问题」面板/状态条卡片（PRD §3.2.1）。
          用户可在对话窗口看到错误/警告计数,并通过单条问题气泡的「定位到字段」跳转到具体字段。 */}

      {isEdit && draftTarget && (
        <div style={{ marginBottom: 12 }}>
          <AutoInsightPanel
            record={{
              name: draftTarget.name,
              agentCode: draftTarget.agentCode,
              status: draftTarget.status,
              passTime: draftTarget.passTime,
              submitTime: draftTarget.submitTime,
            }}
            loginName={loginName}
            isPlatformAdmin={!isDeptAdmin}
          />
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onValuesChange={(_changedValues, allValues) => {
          syncConnectionValues(allValues);
          // §3.2 表单值变化 800ms debounce 触发实时审查
          if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
          reviewTimerRef.current = setTimeout(() => runReview(), 800);
        }}
      >
        {/* ① 备案材料上传 — PRD §1.2.1（V3.1 统一上传入口）：
              单一 Dragger 接收所有 PDF,不做分类、不限份数、不做必填校验；
              仅校验 PDF 格式 + 单文件 ≤30M,管理员审核时自行判断材料完整性。 */}
        <Card title="① 备案材料上传" style={{ marginBottom: 16 }}>
          <Upload.Dragger
            multiple
            accept=".pdf"
            beforeUpload={() => false}
            onChange={handleUpload}
            showUploadList={false}
            style={{ padding: '8px 0' }}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 13 }}>
              点击或拖拽 上传备案材料 PDF
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 11, marginTop: 2 }}>
              限定 PDF 格式 · 单文件 ≤30M · 智能助手可在右侧根据上传材料自动识别并回填下方表单
            </p>
          </Upload.Dragger>
          <div style={{ marginTop: 12 }}>
            {fileList.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                支持上传产品说明书 / 技术规格书 / 其他材料(如安全测试报告、部署环境说明书)等备案材料,管理员审核时将根据实际提交材料进行判断。
              </Text>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {fileList.map((f) => (
                  <Tag
                    key={f.uid}
                    color="blue"
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      handleRemove(f);
                    }}
                    style={{ marginBottom: 4 }}
                  >
                    {f.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 基本信息 */}
        <Card title="基本信息" style={{ marginBottom: 16 }}>
          {/* 智能体基本信息（对应 PRD §1.2.2.1） */}
          <Card
            type="inner"
            title="a. 智能体基本信息"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <AIPrefillWrapper fieldKey="name" onUserChange={() => handleUserChange('name')}>
                  <Form.Item
                    name="name"
                    label="智能体名称"
                    validateTrigger="onBlur"
                    rules={[
                      { required: true, message: '请输入智能体名称' },
                      { min: 2, max: 20, message: '限制 2–20 个字符' },
                      {
                        validator: async (_rule: unknown, value: string) => {
                          if (!value) return;
                          const dup = records.some(
                            (r) => r.name === value && r.id !== draftTarget?.id,
                          );
                          if (dup) throw new Error('此名称已被使用，请重新命名');
                        },
                      },
                    ]}
                  >
                    <Input placeholder="如：导诊智能体" maxLength={20} showCount />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <Form.Item
                  shouldUpdate={(p, c) => p.department !== c.department}
                  noStyle
                >
                  {({ getFieldValue }) => {
                    const dept = getFieldValue('department') as string | undefined;
                    const code =
                      dept &&
                      (draftTarget?.agentCode ||
                        genAgentCode(
                          dept,
                          records.filter((r) => r.id !== draftTarget?.id).map((r) => r.agentCode),
                        ));
                    return (
                      <Form.Item
                        name="agentCode"
                        label="智能体编号"
                        tooltip="按「科室编号-准入顺序号」自动生成"
                      >
                        <Input
                          value={code || ''}
                          placeholder="选择科室后由系统自动生成"
                          disabled
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper fieldKey="version" onUserChange={() => handleUserChange('version')}>
                  <Form.Item
                    name="version"
                    label="智能体版本"
                    rules={[
                      { required: true, message: '请输入版本号' },
                      { pattern: /^\d+\.\d+$/, message: '格式：数字.数字，如 1.0 / 1.1 / 2.1' },
                    ]}
                  >
                    <Input placeholder="如：1.0 / 1.1 / 2.0 / 2.1" />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper fieldKey="modelName" onUserChange={() => handleUserChange('modelName')}>
                  <Form.Item
                    name="modelName"
                    label="使用模型名称"
                    rules={[{ required: true, message: '请输入使用模型名称' }]}
                  >
                    <Input placeholder="如：DeepSeek-V3 / Qwen2.5" allowClear />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper fieldKey="modelVersion" onUserChange={() => handleUserChange('modelVersion')}>
                  <Form.Item
                    name="modelVersion"
                    label="使用模型版本"
                    rules={[
                      { required: true, message: '请输入使用模型版本' },
                      { pattern: /^\d+\.\d+$/, message: '格式：数字.数字，如 1.1 / 2.1' },
                    ]}
                  >
                    <Input placeholder="如：1.1 / 2.1" allowClear />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper
                  fieldKey="modelDeploymentMode"
                  onUserChange={() => handleUserChange('modelDeploymentMode')}
                >
                  <Form.Item
                    name="modelDeploymentMode"
                    label="模型部署方式"
                    rules={[{ required: true, message: '请选择模型部署方式' }]}
                  >
                    <Radio.Group>
                      <Radio value="本地化部署">本地化部署</Radio>
                      <Radio value="云端部署">云端部署</Radio>
                      <Radio value="混合部署">混合部署</Radio>
                    </Radio.Group>
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="department"
                  label="所属科室"
                  rules={[{ required: true, message: '请选择所属科室' }]}
                >
                  <Select
                    placeholder="请选择科室（科室代码+科室名称）"
                    options={departmentOptions}
                    showSearch
                    disabled={isDeptAdmin}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper
                  fieldKey="clinicalStage"
                  onUserChange={() => handleUserChange('clinicalStage')}
                >
                  <Form.Item name="clinicalStage" label="诊疗环节">
                    <Select placeholder="请选择诊疗环节" options={clinicalStageOptions} />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Form.Item
                noStyle
                shouldUpdate={(p, c) => p.clinicalStage !== c.clinicalStage}
              >
                {({ getFieldValue }) =>
                  getFieldValue('clinicalStage') === '其他' ? (
                    <Col span={12}>
                      <Form.Item
                        name="clinicalStageCustom"
                        label="诊疗环节（自定义）"
                        rules={[{ required: true, message: '请填写诊疗环节名称' }]}
                      >
                        <Input placeholder="请填写诊疗环节名称" maxLength={20} showCount />
                      </Form.Item>
                    </Col>
                  ) : null
                }
              </Form.Item>
              <Col span={24}>
                <AIPrefillWrapper
                  fieldKey="description"
                  onUserChange={() => handleUserChange('description')}
                >
                  <Form.Item
                    name="description"
                    label="功能描述"
                    rules={[
                      { required: true, message: '请输入功能描述' },
                      { max: 500, message: '不超过 500 字' },
                    ]}
                    tooltip="重点说明工作内容、服务对象、输入信息、输出结果"
                  >
                    <TextArea
                      rows={5}
                      placeholder="例：面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等信息，形成标准化问诊摘要"
                      showCount
                      maxLength={500}
                    />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
            </Row>
          </Card>

          {/* 来源与责任信息（对应 PRD §1.2.2.2） */}
          <Card type="inner" title="b. 来源与责任信息">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="source" label="智能体来源">
                  <Select placeholder="自研 / 第三方 / 合作研发" options={sourceOptions} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper
                  fieldKey="supplier"
                  onUserChange={() => handleUserChange('supplier')}
                >
                  <Form.Item
                    name="supplier"
                    label="供应商名称"
                    rules={[{ max: 30, message: '不超过 30 字' }]}
                  >
                    <Input placeholder="请填写供应商全称" maxLength={30} showCount />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper
                  fieldKey="contactName"
                  onUserChange={() => handleUserChange('contactName')}
                >
                  <Form.Item
                    name="contactName"
                    label="技术联系人"
                    rules={[
                      { required: true, message: '请填写技术联系人' },
                      { min: 2, max: 10, message: '2–10 字' },
                    ]}
                  >
                    <Input placeholder="2–10 字" maxLength={10} showCount />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <AIPrefillWrapper
                  fieldKey="contactPhone"
                  onUserChange={() => handleUserChange('contactPhone')}
                >
                  <Form.Item
                    name="contactPhone"
                    label="联系方式"
                    rules={[
                      { required: true, message: '请填写联系方式' },
                      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号' },
                    ]}
                  >
                    <Input placeholder="11 位手机号" maxLength={11} />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
            </Row>
          </Card>
        </Card>

        {/* 技术信息 */}
        <Card title="技术信息" style={{ marginBottom: 16 }}>
          <Form.Item
            name="accessMode"
            label="接入方式"
            rules={[{ required: true, message: '请选择接入方式' }]}
          >
            <Radio.Group options={accessModeOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.accessMode !== c.accessMode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('accessMode') as AccessMode | undefined;
              const isApi = mode === 'API';
              const isSdkLike = mode === 'SDK' || mode === 'OTel';
              // 三组字段一次性全渲染，通过外层 style.display 控制显隐
              // ——这样所有 Form.Item 在 mount 时即注册到 store，能正常从
              //   setFieldsValue 拿到初值，不会因为 shouldUpdate 门控在
              //   子树后挂载而错过回填。
              return (
                <>
                  {/* API 接入分支 */}
                  <div style={{ display: isApi ? 'block' : 'none' }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <AIPrefillWrapper
                          fieldKey="apiEndpoint"
                          onUserChange={() => handleUserChange('apiEndpoint')}
                        >
                          <Form.Item
                            name="apiEndpoint"
                            label="接口地址"
                            rules={[{ required: isApi, message: '请填写接口地址' }]}
                          >
                            <Input
                              placeholder="如：http://10.10.10.20:8080/chat"
                              addonAfter={
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => {
                                    navigator.clipboard?.writeText(form.getFieldValue('apiEndpoint') || '');
                                    message.success('接口地址已复制');
                                  }}
                                >
                                  复制
                                </Button>
                              }
                            />
                          </Form.Item>
                        </AIPrefillWrapper>
                      </Col>
                      <Col span={12}>
                        <AIPrefillWrapper
                          fieldKey="apiKey"
                          onUserChange={() => handleUserChange('apiKey')}
                        >
                          <Form.Item name="apiKey" label="API key">
                            <Input.Password
                              placeholder="默认密文显示（点击 icon1 切换显示 / 隐藏）"
                              visibilityToggle={{
                                visible: showSecret,
                                onVisibleChange: setShowSecret,
                              }}
                              suffix={
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => {
                                    navigator.clipboard?.writeText(form.getFieldValue('apiKey') || '');
                                    message.success('API key 已复制');
                                  }}
                                >
                                  复制
                                </Button>
                              }
                            />
                          </Form.Item>
                        </AIPrefillWrapper>
                      </Col>
                    </Row>
                  </div>

                  {/* SDK / OTel 接入分支（共用一组字段，按模式分发获取动作） */}
                  {isSdkLike && (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="platformUrl"
                          label="平台 URL 地址"
                          rules={[{ required: isSdkLike, message: '请获取平台 URL' }]}
                        >
                          <Input
                            placeholder={`点击右侧「获取 ${mode}」自动签发`}
                            addonAfter={
                              <Button type="link" size="small" onClick={mode === 'SDK' ? obtainSdk : obtainOtel}>
                                获取 {mode}
                              </Button>
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="platformKey"
                          label="平台密钥 key"
                          rules={[{ required: isSdkLike, message: '请获取平台密钥' }]}
                        >
                          <Input.Password
                            placeholder="签发后自动填充"
                            visibilityToggle={{
                              visible: showSecret,
                              onVisibleChange: setShowSecret,
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item label="埋点代码生成" tooltip="根据平台 URL 地址和密钥 key 自动生成">
                          <Form.Item
                            noStyle
                            shouldUpdate={(p, c) =>
                              p.platformUrl !== c.platformUrl || p.platformKey !== c.platformKey
                            }
                          >
                            {({ getFieldValue }) => {
                              const url = (getFieldValue('platformUrl') as string) || '<PLATFORM_URL>';
                              const key = (getFieldValue('platformKey') as string) || '<PLATFORM_KEY>';
                              const code = `// ${mode} 埋点代码（点击右侧复制按钮后嵌入智能体应用）\nimport { init } from '@platform/agent-${mode!.toLowerCase()}';\ninit({\n  endpoint: '${url}',\n  apiKey: '${key}',\n});`;
                              return (
                                <div style={{ position: 'relative' }}>
                                  <pre
                                    style={{
                                      background: '#fafafa',
                                      padding: 12,
                                      borderRadius: 4,
                                      margin: 0,
                                      border: '1px solid #f0f0f0',
                                      overflow: 'auto',
                                      fontSize: 12,
                                    }}
                                  >
                                    <code>{code}</code>
                                  </pre>
                                  <Button
                                    size="small"
                                    icon={<CopyOutlined />}
                                    style={{ position: 'absolute', top: 8, right: 8 }}
                                    onClick={() => {
                                      navigator.clipboard?.writeText(code);
                                      message.success('埋点代码已复制');
                                    }}
                                  >
                                    复制
                                  </Button>
                                </div>
                              );
                            }}
                          </Form.Item>
                        </Form.Item>
                      </Col>
                    </Row>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Space direction="vertical" style={{ width: '100%' }}>
            {/* §3.3 智能化连通测试 — 替换原「测试验证」按钮 + Steps */}
            <ConnectivityTester
              autoTriggerKey={connectionAutoTriggerKey}
              onTestStart={() => {
                setTested(false);
                setTestResult(null);
              }}
              getConnectionFormValues={() => {
                const v = form.getFieldsValue([
                  'accessMode',
                  'apiEndpoint',
                  'apiKey',
                  'platformUrl',
                  'platformKey',
                  'name',
                ]);
                return {
                  accessMode: v.accessMode,
                  apiEndpoint: v.apiEndpoint,
                  apiKey: v.apiKey,
                  platformUrl: v.platformUrl,
                  platformKey: v.platformKey,
                  agentName: v.name,
                };
              }}
              onLocateField={(fieldKey) => {
                form.scrollToField(fieldKey, { behavior: 'smooth', block: 'center' });
              }}
            />
            {/* 同步 ConnectivityTester 状态（向后兼容 buildRecord）：判定最新一次结果 */}
            <TestStatusSync
              steps={connSteps}
              diagnostics={connDiagnostics}
              onResolved={(tr) => {
                setTested(true);
                setTestResult(tr);
              }}
            />
          </Space>
        </Card>

        {/* 底部操作栏：固定底部 / 始终可见 */}
        <Card
          size="small"
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            marginBottom: 0,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Tooltip title="保存为草稿，可稍后回到列表继续编辑">
                <Button icon={<SaveOutlined />} onClick={saveDraft}>
                  暂存
                </Button>
              </Tooltip>
              <Button onClick={() => navigate(-1)}>返回列表</Button>
            </Space>
            <Tooltip
              title={
                !tested
                  ? '请先完成测试验证'
                  : testResult && testResult.historical
                    ? '历史测试结果仅供参考，请重新测试'
                    : testResult && !testResult.ok
                      ? '测试验证未通过，无法提交'
                      : '提交后进入待审核状态'
              }
            >
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={submitRegister}
                disabled={!tested || !testResult || testResult.historical || !testResult.ok}
              >
                提交注册
              </Button>
            </Tooltip>
          </Space>
        </Card>
      </Form>

      {/* 暂未使用但保留旧 hook 以避免 lint 报错 */}
      <span style={{ display: 'none' }} aria-hidden>
        {ROLE_ADMIN}
        <Paragraph style={{ display: 'none' }} />
        <EyeInvisibleOutlined />
        <EyeOutlined />
        <Tag />
      </span>
    </>
  );
};

/**
 * TestStatusSync：监听 ConnectivityTester 的步骤/诊断，把"最新一次测试结果"
 * 投影到外层组件的 tested / testResult 状态。
 * 放在父组件同文件，避免再开一个组件文件。
 */
interface TestStatusSyncProps {
  steps: ReturnType<typeof useSmartDraft>['connSteps'];
  diagnostics: ReturnType<typeof useSmartDraft>['connDiagnostics'];
  onResolved: (tr: { ok: boolean; message: string }) => void;
}

const TestStatusSync: React.FC<TestStatusSyncProps> = ({ steps, diagnostics, onResolved }) => {
  useEffect(() => {
    if (!steps || steps.length === 0) return;
    const okCount = steps.filter((s) => s.status === 'ok').length;
    const failIdx = steps.findIndex((s) => s.status === 'fail');
    if (okCount === steps.length) {
      onResolved({ ok: true, message: '联通成功，可提交注册。' });
    } else if (failIdx >= 0 && diagnostics) {
      onResolved({
        ok: false,
        message: `联通失败：${diagnostics.errorReason}（错误码 ${diagnostics.errorCode}）`,
      });
    }
  }, [steps, diagnostics, onResolved]);
  return null;
};

export default Registration;
