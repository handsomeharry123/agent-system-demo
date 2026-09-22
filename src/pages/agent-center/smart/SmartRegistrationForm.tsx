/**
 * §3.1.2 新建注册页 (智能填写版)
 *
 * 与既有 Registration.tsx 的差异：
 *   - 表单字段值可被 Agent 对话浮层识别并回填
 *   - 字段高亮 "✨ AI 预填" + 悬浮气泡显示来源/置信度/采纳按钮
 *   - 用户采纳/修改后高亮自动消失
 *   - 数据流：AgentAssistant (3.1.1) → SmartDraftProvider.store → 表单字段
 *
 * 整体结构：PageHeader + 备案材料上传 Card + 基本信息 Card + 技术信息 Card + 底部吸底栏
 *
 * 入口：/app/agent-center/smart-register
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Steps,
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
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { departmentOptions } from '../../../mock/departments';
import PageHeader from '../../../components/PageHeader';
import {
  ROLE_ADMIN,
  ROLE_DEPT,
  sourceOptions,
  clinicalStageOptions,
  accessModeOptions,
  genAgentCode,
  type AccessMode,
} from '../types';
import {
  getAccessRecord,
  nowISO,
  upsertAccessRecord,
  useAccessRecords,
} from '../store';
import { useAuth } from '../../../hooks/useAuth';
import { useSmartDraft } from './store.tsx';
import AIPrefillWrapper from './AIPrefillWrapper';
import ConnectivityTester from './ConnectivityTester';
import type { AgentMessage } from './types';
import type { ReviewProblem } from './types';

const { Text } = Typography;
const { TextArea } = Input;

// ──────────────────────────────────────────────────────────────────────
// 测试验证流程状态
// ──────────────────────────────────────────────────────────────────────
const TEST_STAGES = ['建立连接', '鉴权验证', '发送请求', '接收响应'];

// PRD §1.2.1 备案材料 3 档: 产品说明书 / 技术规格书 / 其他材料
type Category = 'product' | 'tech' | 'other';
const CATEGORY_LABEL: Record<Category, string> = {
  product: '产品说明书',
  tech: '技术规格书',
  other: '其他材料',
};
const CATEGORY_ORDER: Category[] = ['product', 'tech', 'other'];
const REQUIRED_CATEGORY: Category[] = ['product', 'tech'];
const CATEGORY_MAX: Record<Category, number> = { product: 1, tech: 1, other: 5 };

const isFilled = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : !!v);

const isRequiredRegistrationInfoComplete = (v: Record<string, any>) => {
  const modelConfigs = Array.isArray(v.modelConfigs) ? v.modelConfigs : [];
  const modelsOk =
    modelConfigs.length > 0 &&
    modelConfigs.every(
      (item: Record<string, unknown>) =>
        isFilled(item?.modelName) &&
        /^\d+\.\d+$/.test(String(item?.modelVersion || '')) &&
        isFilled(item?.deploymentMode),
    );
  const commonOk =
    isFilled(v.name) &&
    String(v.name).trim().length >= 2 &&
    String(v.name).trim().length <= 20 &&
    /^\d+\.\d+$/.test(v.version || '') &&
    typeof v.parameterCount === 'number' &&
    isFilled(v.openSource) &&
    typeof v.contextLength === 'number' &&
    typeof v.temperature === 'number' &&
    isFilled(v.releaseDate) &&
    modelsOk &&
    isFilled(v.department) &&
    isFilled(v.description) &&
    String(v.description || '').length <= 500 &&
    isFilled(v.contactName) &&
    String(v.contactName).trim().length >= 2 &&
    String(v.contactName).trim().length <= 10 &&
    /^1[3-9]\d{9}$/.test(v.contactPhone || '') &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contactEmail || '') &&
    isFilled(v.accessMode);
  if (!commonOk) return false;
  if (v.accessMode === 'API') return isFilled(v.apiEndpoint);
  if (v.accessMode === 'SDK' || v.accessMode === 'OTel') {
    return isFilled(v.platformUrl) && isFilled(v.platformKey);
  }
  return true;
};

const SmartRegistrationForm = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const role = currentUser?.roles[0] || ROLE_ADMIN;
  const isDeptAdmin = role === ROLE_DEPT;
  const loginName = currentUser?.name || '当前用户';

  const records = useAccessRecords();

  const {
    pendingPrefills,
    prefillMeta,
    addMessage,
    clearPrefill,
    pushWelcomeGreeting,
    setWelcomePreviewProblems,
    setReviewProblems,
    connSteps,
    connDiagnostics,
    historicalPlans,
    pushHistoricalPlans,
    // §4.3 V5.0: 备案材料生成提示改为机器人旁侧气泡, 不再走 addMessage
    setMaterialOffer,
    // §3.1.1 Agent 对话窗口上传 PDF → 自动同步到「备案材料」列表(同 store bridge)
    pendingUploadedFile,
    clearUploadedFile,
  } = useSmartDraft();

  const [form] = Form.useForm();

  const [submitting, setSubmitting] = useState(false);
  const [tested, setTested] = useState(false);
  const [testStage, setTestStage] = useState(-1);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [showSecret, setShowSecret] = useState(false);
  // PRD §1.2.1 备案材料（产品说明书 / 技术规格书 / 其他材料）合在一个上传组件内,
  //   顶部按材料类型切换,下方一个 Dragger + 列表区
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 初始值
  useEffect(() => {
    form.setFieldsValue({
      version: '1.0',
      parameterCount: 7,
      openSource: '否',
      contextLength: 32,
      temperature: 0.7,
      topP: 0.9,
      concurrency: 32,
      releaseDate: dayjs(),
      accessMode: 'API',
      modelConfigs: [{ modelName: '', modelVersion: '', deploymentMode: '本地化部署' }],
      department: isDeptAdmin ? currentUser?.department : undefined,
    });
  }, [form, isDeptAdmin, currentUser]);

  // PRD §4.2：接入必填项完整即自动跑连通测试
  //   - 监听 5 个接入相关字段：accessMode / apiEndpoint / apiKey / platformUrl / platformKey
  //   - 签名规则：必填项完整才输出稳定签名,字段变化/补全即触发,缺字段时输出空串
  //   - 解决 V3.2 拆出 SmartRegistrationForm 时未同步「必填完整即自动跑」逻辑导致的两个问题:
  //     ① PDF 一次性预填 → setFieldsValue 不触发 blur,旧版失焦哨兵失灵
  //     ② PDF 预填后必填信息完整了但 fileList 没变,runReview 不跑 → 材料缺失通知不出现
  const watchedAccessMode = Form.useWatch('accessMode', form);
  const watchedApiEndpoint = Form.useWatch('apiEndpoint', form);
  const watchedApiKey = Form.useWatch('apiKey', form);
  const watchedPlatformUrl = Form.useWatch('platformUrl', form);
  const watchedPlatformKey = Form.useWatch('platformKey', form);
  const watchedRegistrationValues = Form.useWatch([], form);
  const connAutoTriggerKey = useMemo(() => {
    const mode = watchedAccessMode;
    if (mode === 'API') {
      const ep = String(watchedApiEndpoint || '').trim();
      const ak = String(watchedApiKey || '').trim();
      // AI 预填字段必须先由用户明确采纳；手动修改会清除 prefillMeta，可直接测试。
      if (!ep || !ak) return '';
      if (prefillMeta.apiEndpoint?.acknowledged === false || prefillMeta.apiKey?.acknowledged === false) return '';
      return `API::${ep}::${ak}`;
    }
    if (mode === 'SDK' || mode === 'OTel') {
      const pu = String(watchedPlatformUrl || '').trim();
      const pk = String(watchedPlatformKey || '').trim();
      if (!pu || !pk) return '';
      if (prefillMeta.platformUrl?.acknowledged === false || prefillMeta.platformKey?.acknowledged === false) return '';
      return `${mode}::${pu}::${pk}`;
    }
    return '';
  }, [watchedAccessMode, watchedApiEndpoint, watchedApiKey, watchedPlatformUrl, watchedPlatformKey, prefillMeta]);

  // §3.1.1 P1.3 语义联动填充：
  //   - 用户输入「功能描述」后,实时推断临床环节 + 所属科室
  //   - 仅在字段尚未被用户手动填写过 (userTouched 集合) 时覆盖
  //   - 监听 description 变化放至下面的 form onValuesChange 中（避免 useForm 未挂载警告）
  const [userTouched, setUserTouched] = useState<Set<string>>(new Set());
  const inferFromDescription = useCallback((text: string) => {
    if (!text) return;
    const t = text.toLowerCase();
    const stageMap: Array<[RegExp, string]> = [
      [/分诊|导诊|预问诊|问诊/, '导诊分诊'],
      [/检查|化验|检验|影像|ct|x光|mri|拍片/, '辅助检查'],
      [/读片|阅片|识别|分类.*?病灶|辅助诊断|诊断/, '辅助诊断'],
      [/用药|治疗|给药|方案|剂量/, '辅助治疗'],
      [/住院|入院/, '住院'],
      [/手术|术前|术后|麻醉/, '手术'],
      [/挂号|预约/, '预约挂号'],
    ];
    let stage: string | null = null;
    for (const [re, name] of stageMap) {
      if (re.test(t)) { stage = name; break; }
    }
    if (stage && !userTouched.has('clinicalStage')) {
      form.setFieldsValue({ clinicalStage: stage });
    }
    const deptMap: Array<[RegExp, string]> = [
      [/心电|心律|心脏|心血管|心肌/, '心内科'],
      [/ct|x光|mri|影像|放射|拍片|读片/, '影像科'],
      [/手术|麻醉/, '麻醉科'],
      [/急诊/, '急诊科'],
      [/儿科|儿童|新生儿/, '儿科'],
      [/产科|孕产|孕妇|产妇/, '产科'],
      [/肿瘤|癌症|化疗/, '肿瘤科'],
      [/皮肤|皮疹/, '皮肤科'],
      [/化验|检验|微生物|细菌/, '检验科'],
    ];
    let dept: string | null = null;
    for (const [re, name] of deptMap) {
      if (re.test(t)) { dept = name; break; }
    }
    if (dept && !userTouched.has('department')) {
      form.setFieldsValue({ department: dept });
    }
  }, [form, userTouched]);

  // PRD §3.1.1 触发时机：「进入新建注册页」-> 主动推送一条 page-level 欢迎语
  //   - 写入 store.activeWelcome 后机器人旁会同步弹气泡 (8s 自动收起)
  //   - store.messages 中也会同步生成一条相同文案的消息 (窗口内展示)
  // 提供方 (provider) = 智能体提供方, 无论科室管理员还是信息科管理员, 进入「新建注册」时走同一句欢迎语
  // 防止 React StrictMode 双调用导致重复推送: store.pushWelcomeGreeting 内部已做去重
  useEffect(() => {
    pushWelcomeGreeting(
      'smart-register',
      'provider',
      undefined,
      {
        actions: [
          { key: 'upload', label: '📎 上传材料', event: 'agent-register-trigger-upload', enabled: true },
          { key: 'voice', label: '🎤 语音描述', event: 'agent-register-trigger-voice', enabled: true },
        ],
      },
    );
  }, [pushWelcomeGreeting]);

  // PRD §4.2.3：连通测试成功 / 失败的提示由 ConnectivityTester 推 'conn-test-result' 气泡。
  //   进入新建注册页时不再推送 'historical-plan'（PRD §3.3.2 历史方案复用已下线）。
  //   仅清空同 source 旧消息，防止之前会话遗留气泡。
  useEffect(() => {
    pushHistoricalPlans([], 'page-init');
    // 仅 mount-only 触发一次即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // §3.2 填写内容智能审查：进入页面 1.2s 后自动跑一次 runReview
  //   - 4 大类规则：必填缺失 / 格式不符 / 前后不一致 / 材料与字段不匹配
  //   - 表单 onValuesChange debounce 800ms 触发重审
  // ─────────────────────────────────────────────────────────────────
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const materialOfferKeyRef = useRef('');
  const materialOfferDismissedRef = useRef(false);
  useEffect(() => () => {
    if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
  }, []);

  const getMissingMaterialCategories = useCallback((list: UploadFile[]) => {
    const byCategory: Record<Category, UploadFile[]> = {
      product: list.filter((f) => (f as any).category === 'product'),
      tech: list.filter((f) => (f as any).category === 'tech'),
      other: list.filter((f) => (f as any).category === 'other'),
    };
    return REQUIRED_CATEGORY.filter((k) => byCategory[k].length === 0);
  }, []);

  const maybePushMaterialGenerationOffer = useCallback((list: UploadFile[] = fileList) => {
    const missingDocs = getMissingMaterialCategories(list);
    if (missingDocs.length === 0) {
      materialOfferKeyRef.current = '';
      materialOfferDismissedRef.current = false;
      // §4.3 V5.0: 改为机器人旁侧气泡;文件齐全时清空 offer
      setMaterialOffer(null);
      return;
    }
    const v = form.getFieldsValue(true) as Record<string, any>;
    if (!isRequiredRegistrationInfoComplete(v)) return;
    const nextKey = missingDocs.join('|');
    if (materialOfferDismissedRef.current && materialOfferKeyRef.current === nextKey) return;
    if (materialOfferKeyRef.current === nextKey) return;
    materialOfferKeyRef.current = nextKey;
    materialOfferDismissedRef.current = false;
    // §4.3 V5.0: 提示卡片改为机器人旁独立侧气泡,不再进入 ChatPanel messages
    //   - 之前 addMessage({type:'material-generation-offer'}) 会让对话窗口堆叠提示卡片
    //   - 现在写到 store.materialOffer, AgentAssistant 在机器人旁独立渲染
    setMaterialOffer({ missingCategories: missingDocs as Array<'product' | 'tech'> });
  }, [setMaterialOffer, fileList, form, getMissingMaterialCategories]);

  const runReview = useCallback(() => {
    const v = form.getFieldsValue(true) as Record<string, any>;
    const problems: ReviewProblem[] = [];
    const fileListByCategoryNow: Record<Category, UploadFile[]> = {
      product: fileList.filter((f) => (f as any).category === 'product'),
      tech: fileList.filter((f) => (f as any).category === 'tech'),
      other: fileList.filter((f) => (f as any).category === 'other'),
    };
    // ① 备案材料审查
    if (fileListByCategoryNow.product.length === 0) {
      problems.push({
        id: 'm-product-required',
        severity: 'error',
        category: 'materials',
        title: '「产品说明书」未上传',
        reason: 'PRD §1.2.1 要求：产品说明书为必填材料',
        impact: '审核环节会被退回；预审建议标记为「资料不全」',
        autoFixable: false,
        status: 'open',
      });
    }
    if (fileListByCategoryNow.tech.length === 0) {
      problems.push({
        id: 'm-tech-required',
        severity: 'error',
        category: 'materials',
        title: '「技术规格书」未上传',
        reason: 'PRD §1.2.1 要求：技术规格书为必填材料',
        impact: '无法发起连通测试，【测试验证】将置灰',
        autoFixable: false,
        status: 'open',
      });
    }
    // ② 基本信息
    if (v.name) {
      const dup = records.some(
        (r) => r.name === v.name && r.id !== `acc-${Date.now()}`,
      );
      const sameName = records.some((r) => r.name === v.name);
      if (sameName) {
        problems.push({
          id: 'r-name-dup',
          severity: 'error',
          fieldKey: 'name',
          category: 'basic',
          title: '智能体名称已被占用',
          reason: '当前名称已存在其他注册记录',
          impact: '提交将被阻断',
          suggestion: '可加版本号或科室后缀',
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
        impact: '审核环节标记为「不规范」',
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
        reason: '必填字段',
        impact: '无法生成智能体编号',
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
        reason: '限制 11 位 1[3-9] 开头的手机号',
        impact: '管理员无法联系接口人',
        status: 'open',
      });
    }
    // ③ 一致性
    if (v.source === '自研' && v.supplier && v.supplier.trim()) {
      problems.push({
        id: 'c-source-supplier',
        severity: 'warning',
        fieldKey: 'supplier',
        category: 'basic',
        title: '来源 = 自研,供应商应为空',
        reason: '字段前后不一致',
        impact: '审核阶段会被标注',
        status: 'open',
      });
    }
    // ④ 技术信息
    if (v.accessMode === 'API' && v.apiEndpoint && !/^https?:\/\//.test(v.apiEndpoint)) {
      problems.push({
        id: 't-endpoint-format',
        severity: 'error',
        fieldKey: 'apiEndpoint',
        category: 'tech',
        title: '接口地址格式错误',
        reason: '应包含 http(s):// 协议头',
        impact: '连通测试必失败',
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
        impact: '【提交】将置灰',
        status: 'open',
      });
    }
    if (v.apiKey && !/^sk-/.test(v.apiKey)) {
      problems.push({
        id: 't-key-prefix',
        severity: 'warning',
        fieldKey: 'apiKey',
        category: 'tech',
        title: 'API Key 缺少标准前缀',
        reason: '平台要求密钥以「sk-」开头',
        impact: '鉴权阶段可能被网关拒绝',
        autoFixable: true,
        autoFixValue: `sk-${v.apiKey}`,
        status: 'open',
      });
    }
    if ((v.accessMode === 'SDK' || v.accessMode === 'OTel') && !v.platformUrl) {
      problems.push({
        id: 't-platform-required',
        severity: 'error',
        fieldKey: 'platformUrl',
        category: 'tech',
        title: `${v.accessMode} 接入需要先点击「获取 ${v.accessMode}」`,
        reason: `${v.accessMode} 接入由平台自动签发 URL 与密钥`,
        impact: '提交被阻断',
        status: 'open',
      });
    }
    setReviewProblems(problems);
    // §3.2.1 同步刷新机器人旁气泡的「智能预审·紧凑版」
    //   - 与对话窗口内的 pre-audit-issue 同一份数据源(problems), 不另算
    //   - 前 3 条按"错误 > 警告 > 提示 + 原顺序"截取, 气泡高度受限时再展示「查看全部」
    //   - problems 全为空时(用户上传完所有文件 / 修完字段) → 传 null, 让气泡预警区清空
    const openProblems = problems.filter((p) => p.status === 'open');
    if (openProblems.length === 0) {
      setWelcomePreviewProblems(null);
    } else {
      const sortedForBubble = [...openProblems].sort((a, b) => {
        const rank = (s: ReviewProblem['severity']) =>
          s === 'error' ? 0 : s === 'warning' ? 1 : 2;
        return rank(a.severity) - rank(b.severity);
      });
      setWelcomePreviewProblems({
        total: openProblems.length,
        items: sortedForBubble.slice(0, 3).map((p) => ({
          id: p.id,
          title: p.title,
          severity: p.severity,
          fieldKey: p.fieldKey || undefined,
          category: p.category,
        })),
      });
    }
    maybePushMaterialGenerationOffer(fileList);
  }, [form, fileList, maybePushMaterialGenerationOffer, records, setReviewProblems, setWelcomePreviewProblems]);

  // 进入页面 1.2s 后自动跑一次审查
  useEffect(() => {
    const t = setTimeout(() => runReview(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
    reviewTimerRef.current = setTimeout(() => runReview(), 300);
    return () => {
      if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
    };
  }, [fileList, runReview]);

  // PRD §4.2 fix: 接入必填项完整（connAutoTriggerKey 由空变非空）瞬间,
  //   不依赖 runReview / onValuesChange 时序, 主动触发一次材料缺失评估,
  //   确保 PDF 一次性预填后机器人旁「产品说明书缺失」提示立即出现。
  //   - 只在 signature 真正变化的瞬间跑（依赖 connAutoTriggerKey 字符串）,
  //     避免 fileList 没变时反复打扰。
  //   - 注意:必须 reset materialOfferKeyRef 的去重逻辑（fileList 没变,去重会跳过同 key）,
  //     这里直接重置该 ref, 让下一次 offer 真正生效。
  useEffect(() => {
    materialOfferKeyRef.current = '';
    maybePushMaterialGenerationOffer(fileList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connAutoTriggerKey]);

  // §3.2.1 监听字段定位事件：保留内部审查定位能力，但不再向 Agent 对话窗口推格式校验提示。
  useEffect(() => {
    const onLocate = (e: Event) => {
      const fieldKey = (e as CustomEvent<string>).detail;
      if (!fieldKey) return;
      form.scrollToField(fieldKey, { behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('agent-review-locate-field', onLocate);
    return () => {
      window.removeEventListener('agent-review-locate-field', onLocate);
    };
  }, [form]);

  // §3.3 把 ConnectivityTester 结果同步到本地 tested/testResult（影响 buildRecord 与提交门控）
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

  // ──────────────────────────────────────────────────────────────────
  // 关键：监听 pendingPrefills (来自 AgentAssistant)
  //   - 每次新值进入，调用 setFieldsValue 回填到表单
  //   - 已 acknowledged 的不回填
  // ──────────────────────────────────────────────────────────────────
  const lastPrefillRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const changedKeys = Object.keys(pendingPrefills).filter(
      (k) => pendingPrefills[k] !== lastPrefillRef.current[k],
    );
    if (changedKeys.length === 0) return;
    const patch: Record<string, unknown> = {};
    const firstModel = { ...(form.getFieldValue(['modelConfigs', 0]) || {}) };
    changedKeys.forEach((k) => {
      const meta = prefillMeta[k];
      if (meta?.acknowledged) return;
      if (k === 'modelName') firstModel.modelName = pendingPrefills[k];
      else if (k === 'modelVersion') firstModel.modelVersion = pendingPrefills[k];
      else if (k === 'modelDeploymentMode') firstModel.deploymentMode = pendingPrefills[k];
      else patch[k] = pendingPrefills[k];
    });
    if (changedKeys.some((k) => ['modelName', 'modelVersion', 'modelDeploymentMode'].includes(k))) {
      const current = form.getFieldValue('modelConfigs') || [];
      patch.modelConfigs = [firstModel, ...current.slice(1)];
    }
    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch);
    }
    lastPrefillRef.current = { ...pendingPrefills };
  }, [pendingPrefills, prefillMeta, form]);

  // ──────────────────────────────────────────────────────────────────
  // 采纳反馈:监听 prefillMeta 中 acknowledged 由 false → true 的字段
  //   - 表单滚动到该字段 (AIPrefillWrapper 已加 1.2s 闪烁 class)
  //   - 仅取本轮刚刚被采纳的 (新 acknowledgedAt) 字段
  // ──────────────────────────────────────────────────────────────────
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
      // 滚动到第一个被采纳字段 (antd Form 自带 scrollToField)
      const first = newAcks[0];
      // 延迟一帧等待 AIPrefillWrapper 注入 ack-flash className
      requestAnimationFrame(() => {
        form.scrollToField(first, { behavior: 'smooth', block: 'center' });
      });
    }
  }, [prefillMeta, form]);

  // ──────────────────────────────────────────────────────────────────
  // 备案材料上传 — PRD §1.2.1
  //   产品说明书(必填) / 技术规格书(必填) / 其他材料(可选,多文件)
  //   全部走同一个上传组件: 单 Dragger + 下方按类别分别渲染的列表区
  //   每条文件记录携带 category 字段 (product/tech/other),由 activeCategory 控制
  //   仍按 PRD 文案提示「上传成功 / 仅支持 PDF / 单文件 ≤30M」
  // ──────────────────────────────────────────────────────────────────
  // 每个类别单独的最大文件数: 产品/技术 限 1 份,其他 最多 5 份
  // 上传时手动选择本文件归到哪个类别 (默认 product)
  const [activeCategory, setActiveCategory] = useState<Category>('product');

  const fileListByCategory: Record<Category, UploadFile[]> = {
    product: fileList.filter((f) => (f as any).category === 'product'),
    tech: fileList.filter((f) => (f as any).category === 'tech'),
    other: fileList.filter((f) => (f as any).category === 'other'),
  };
  const missingRequired = REQUIRED_CATEGORY.filter((k) => fileListByCategory[k].length === 0);

  // ──────────────────────────────────────────────────────────────────
  // §3.1.1 Agent 对话窗口上传 PDF → 自动同步到「备案材料」列表
  //   - AgentAssistant.handleUpload 写入 store.pendingUploadedFile(仅 PDF,图片不入备案)
  //   - 本 effect 监听后 append 到本地 fileList,并调 clearUploadedFile 置空
  //   - 同 uid 已存在则跳过(防 React StrictMode 双跑 / 二次上传)
  //   - category 字段:与 Registration 一致的文件名启发式归类(product / tech / other),
  //     受 CATEGORY_MAX(product/tech=1, other=5)截断,避免单类别超量影响后续提交校验
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const f = pendingUploadedFile;
    if (!f) return;
    setFileList((prev) => {
      if (prev.some((x) => x.uid === f.uid)) return prev;
      const lowerName = (f.name || '').toLowerCase();
      const cat: Category = /(技术|spec|sdk|api|接口|otel)/i.test(lowerName)
        ? 'tech'
        : /(产品|说明|product)/i.test(lowerName)
          ? 'product'
          : 'other';
      const others = prev.filter((x) => (x as any).category !== cat);
      const nextForCategory = [
        ...prev.filter((x) => (x as any).category === cat),
        { uid: f.uid, name: f.name, size: f.size, type: f.type, status: 'done', category: cat } as UploadFile,
      ].slice(0, CATEGORY_MAX[cat]);
      return [...others, ...nextForCategory];
    });
    message.success(`已同步至备案材料:${f.name}`);
    clearUploadedFile();
    // CATEGORY_MAX 是模块级常量,不会变化,这里省略依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUploadedFile, clearUploadedFile]);

  const handleUpload = (info: { file: UploadFile; fileList: UploadFile[] }) => {
    const cat = activeCategory;
    const f = info.file;
    const isPdf = f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf'));
    const size = f.size ?? 0;
    if (!isPdf) {
      message.error(`上传失败,仅支持 PDF 类型文件（${CATEGORY_LABEL[cat]}）`);
    }
    if (size > 30 * 1024 * 1024) {
      message.error(`上传失败,单文件超过最大限制 30M（${f.name}）`);
    }
    // 校验当前类别的份数上限
    const maxN = CATEGORY_MAX[cat];
    const nextForCategory = info.fileList.filter((it) => {
      const okPdf = it.type === 'application/pdf' || (it.name && it.name.toLowerCase().endsWith('.pdf'));
      const okSize = (it.size ?? 0) <= 30 * 1024 * 1024;
      return okPdf && okSize;
    });
    // 替每条上传文件挂上 category 字段 (持久化进 attachments)
    const tagged = nextForCategory.map((it) => ({ ...it, category: cat } as UploadFile));
    // 其他类别的旧文件保留
    const others = fileList.filter((x) => (x as any).category !== cat);
    const merged = [...others, ...tagged];
    if (tagged.length > maxN) {
      message.error(`${CATEGORY_LABEL[cat]} 最多上传 ${maxN} 份`);
      setFileList([...others, ...tagged.slice(0, maxN)]);
      return;
    }
    setFileList(merged);
    if (isPdf && size <= 30 * 1024 * 1024) {
      message.success(`上传成功（${CATEGORY_LABEL[cat]} · ${f.name}）`);
    }
  };

  // 删除时按前缀定位, 仅剔除本类别下的文件
  const handleRemove = (file: UploadFile) => {
    setFileList((prev) => prev.filter((x) => x.uid !== file.uid));
    return true;
  };

  useEffect(() => {
    const onGenerate = (e: Event) => {
      const category = (e as CustomEvent<Category>).detail;
      if (category !== 'product' && category !== 'tech') return;
      const label = CATEGORY_LABEL[category];
      const currentValues = form.getFieldsValue(true) as Record<string, any>;
      if (!isRequiredRegistrationInfoComplete(currentValues)) {
        message.warning('请先补全页面必填信息，再生成备案材料');
        return;
      }
      addMessage({
        role: 'agent',
        type: 'detecting',
        content: `正在依据当前已填信息生成${label}，生成完成后会自动归档到「备案材料」。`,
      });
      window.setTimeout(() => {
        const agentName = (form.getFieldValue('name') || '智能体').replace(/[\\/:*?"<>|]/g, '');
        const generatedFile: UploadFile = {
          uid: `generated-${category}-${Date.now()}`,
          name: `${agentName}-${label}.pdf`,
          size: 1.2 * 1024 * 1024,
          type: 'application/pdf',
          status: 'done',
          category,
        } as UploadFile;
        setFileList((prev) => {
          const others = prev.filter((x) => (x as any).category !== category);
          return [...others, generatedFile];
        });
        materialOfferKeyRef.current = '';
        materialOfferDismissedRef.current = false;
        // §4.3 V5.0: 生成成功后清掉机器人旁 offer 气泡(同 category 已补齐)
        setMaterialOffer(null);
        message.success(`${label}已生成并上传到备案材料`);
        addMessage({
          role: 'agent',
          type: 'autofix-done',
          content: `${label}已生成，并已上传到「备案材料」。你可以在材料列表中预览、删除或重新上传。`,
        });
      }, 900);
    };
    const onDismiss = () => {
      materialOfferDismissedRef.current = true;
      // §4.3 V5.0: 关闭侧气泡
      setMaterialOffer(null);
      message.info('已暂不生成备案材料');
    };
    window.addEventListener('agent-generate-registration-doc', onGenerate);
    window.addEventListener('agent-dismiss-material-generation-offer', onDismiss);
    return () => {
      window.removeEventListener('agent-generate-registration-doc', onGenerate);
      window.removeEventListener('agent-dismiss-material-generation-offer', onDismiss);
    };
  }, [addMessage, form]);

  // 旧的 runTest 已被 ConnectivityTester 取代,仅保留校验逻辑供 validateAll 使用
  const runTest = async () => {
    /* noop — ConnectivityTester 已在 store 层推进 connSteps/diagnostics */
  };

  // ──────────────────────────────────────────────────────────────────
  // 校验 + 提交 / 暂存
  // ──────────────────────────────────────────────────────────────────
  const validateAll = async (): Promise<boolean> => {
    try {
      await form.validateFields();
    } catch {
      message.error('请检查表单填写，存在未通过的校验');
      return false;
    }
    if (missingRequired.length > 0) {
      const names = missingRequired.map((k) => CATEGORY_LABEL[k]).join(' / ');
      message.error(`备案材料必填项缺失：${names}`);
      return false;
    }
    const v = form.getFieldsValue();
    if (!/^1[3-9]\d{9}$/.test(v.contactPhone || '')) {
      message.error('请输入正确的 11 位手机号');
      return false;
    }
    if (!/^\d+\.\d+$/.test(v.version || '')) {
      message.error('版本号仅允许「数字.数字」格式');
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

  const buildRecord = (status: '草稿' | '待审核') => {
    const v = form.getFieldsValue(true);
    const id = `acc-${Date.now()}`;
    const code = v.department
      ? genAgentCode(
          v.department,
          records.map((r) => r.agentCode),
        )
      : '';
    // 诊疗环节: 选「其他」时把 custom 文本合并进临床环节字段
    const clinicalStage =
      v.clinicalStage === '其他' && v.clinicalStageCustom
        ? `其他-${v.clinicalStageCustom}`
        : v.clinicalStage || '';
    return {
      id,
      name: v.name || '未命名草稿',
      agentCode: code,
      version: v.version || '',
      parameterCount: v.parameterCount,
      openSource: v.openSource,
      contextLength: v.contextLength,
      temperature: v.temperature,
      topP: v.topP,
      concurrency: v.concurrency,
      releaseDate: v.releaseDate?.format?.('YYYY-MM-DD') || v.releaseDate || '',
      modelName: v.modelConfigs?.[0]?.modelName || '',
      modelVersion: v.modelConfigs?.[0]?.modelVersion || '',
      modelDeploymentMode: v.modelConfigs?.[0]?.deploymentMode,
      modelConfigs: v.modelConfigs || [],
      department: v.department || '',
      clinicalStage,
      source: v.source || '自研' as const,
      supplier: v.supplier || '',
      contactName: v.contactName || '',
      contactPhone: v.contactPhone || '',
      contactEmail: v.contactEmail || '',
      type: v.type || '其他',
      description: v.description || '',
      applicant: loginName,
      applicantRole: role,
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
      auditHistory: [],
    };
  };

  const saveDraft = async () => {
    try {
      await form.validateFields(['name']);
    } catch {
      return;
    }
    const rec = buildRecord('草稿');
    upsertAccessRecord(rec as any);
    message.success('注册表单填写记录已暂存至草稿状态列表页');
    setTimeout(() => navigate('/app/agent-center?tab=草稿'), 400);
  };

  const submitRegister = async () => {
    if (!(await validateAll())) return;
    if (!tested || !testResult?.ok) {
      message.error('当前无法提交注册，请完成连通测试并确保可正常连通');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    const rec = buildRecord('待审核');
    upsertAccessRecord(rec as any);
    setSubmitting(false);
    message.success('提交成功');
    // 给对话助手推一条成功反馈
    addMessage({
      role: 'agent',
      type: 'autofix-done',
      content: '已为你提交注册,接下来进入审核中状态,我会持续陪你跟进审核进度。',
    });
    setTimeout(() => navigate('/app/agent-center?tab=待审核'), 600);
  };

  // 信息完整且测试通过后，由医小管询问是否代提交。相同表单/测试签名只提示一次。
  const submitPromptKeyRef = useRef('');
  useEffect(() => {
    if (!tested || !testResult?.ok || !connAutoTriggerKey) return;
    const values = watchedRegistrationValues || form.getFieldsValue(true);
    if (!isRequiredRegistrationInfoComplete(values) || missingRequired.length > 0) return;
    const key = `${connAutoTriggerKey}::${values.name}::${values.version}::${fileList.map((f) => f.uid).join(',')}`;
    if (submitPromptKeyRef.current === key) return;
    submitPromptKeyRef.current = key;
    addMessage({
      role: 'agent',
      type: 'register-submit-confirm',
      content: '注册信息已完整且测试验证通过，是否需要帮你提交注册信息？',
    });
  }, [tested, testResult, connAutoTriggerKey, watchedRegistrationValues, form, missingRequired.length, fileList, addMessage]);

  useEffect(() => {
    const onConfirmSubmit = () => void submitRegister();
    window.addEventListener('agent-register-confirm-submit', onConfirmSubmit);
    return () => window.removeEventListener('agent-register-confirm-submit', onConfirmSubmit);
  });

  // 用户手动修改字段 → 清除 AI 预填高亮 (AIPrefillWrapper 内部已自动处理)
  // 但还要给 store 一个通知, 让对话助手下次推送不再以 "高亮未确认" 状态展示
  const handleUserChange = (key: string) => {
    clearPrefill(key);
  };

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="新建注册"
        subTitle="对话 + 多模态 + AI 预填 → 备案材料 → 基本信息 → 技术信息 → 测试验证 → 提交"
        showBack
        onBack={() => navigate(-1)}
        breadcrumb={[
          { path: '/app/agent-center', breadcrumbName: '智能体接入中心' },
          { path: '/app/agent-center', breadcrumbName: '注册管理' },
          { path: '/app/agent-center/smart-register', breadcrumbName: '新建注册' },
        ]}
        extra={null}
      />

      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onValuesChange={(changed) => {
          // §3.1 P1.3: 用户主动改过 clinicalStage / department 后,不再被语义联动覆盖
          const keys = Object.keys(changed || {});
          if (keys.some((k) => k === 'clinicalStage' || k === 'department')) {
            setUserTouched((prev) => {
              const next = new Set(prev);
              keys.forEach((k) => next.add(k));
              return next;
            });
          }
          // §3.1 P1.3: description 输入触发语义联动
          if (typeof changed?.description === 'string') {
            inferFromDescription(changed.description);
          }
          // §3.2 表单值变化 800ms debounce 触发实时审查
          if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
          reviewTimerRef.current = setTimeout(() => runReview(), 800);
        }}
      >
        {/* ① 备案材料上传 — PRD §1.2.1：合一个上传组件,3 类材料同入口 */}
        <Card title="① 备案材料上传" style={{ marginBottom: 16 }}>
          {/* 类别选择(本组上传的文件归到哪一类) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前上传至：
            </Text>
            {CATEGORY_ORDER.map((k) => (
              <Tag.CheckableTag
                key={k}
                checked={activeCategory === k}
                onChange={(checked) => checked && setActiveCategory(k)}
                style={{
                  padding: '2px 10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                {CATEGORY_LABEL[k]}
                {REQUIRED_CATEGORY.includes(k) && (
                  <span style={{ color: '#FF4D4F', marginLeft: 4 }}>*</span>
                )}
                <span style={{ marginLeft: 6, color: '#999' }}>
                  {fileListByCategory[k].length}/{CATEGORY_MAX[k]}份
                </span>
              </Tag.CheckableTag>
            ))}
          </div>
          {/* 单 Dragger — 所有材料共用一个拖拽区,通过上方类别选项决定归类 */}
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
              点击或拖拽 PDF（{CATEGORY_LABEL[activeCategory]}）
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 11, marginTop: 2 }}>
              {activeCategory === 'other'
                ? '可选 · 单文件 ≤30M · 最多 5 份'
                : '必填 · 单文件 ≤30M · 限 1 份'}
            </p>
          </Upload.Dragger>
          {/* 3 类材料分组列表 */}
          <div style={{ marginTop: 12 }}>
            {CATEGORY_ORDER.map((k) => {
              const list = fileListByCategory[k];
              if (list.length === 0) return null;
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                    {CATEGORY_LABEL[k]}（{list.length}/{CATEGORY_MAX[k]}）：
                  </Text>
                  {list.map((f) => (
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
              );
            })}
            {fileList.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                限定 PDF 格式 · 单文件 ≤ 30M · 支持多文件上传
              </Text>
            ) : missingRequired.length > 0 ? (
              <Tag color="warning" style={{ marginTop: 4 }}>
                缺：{missingRequired.map((k) => CATEGORY_LABEL[k]).join(' / ')}
              </Tag>
            ) : null}
          </div>
        </Card>

        {/* ② 基本信息 */}
        <Card title="② 基本信息" style={{ marginBottom: 16 }}>
          <Card type="inner" title="a. 智能体基本信息" style={{ marginBottom: 16 }}>
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
                          const dup = records.some((r) => r.name === value);
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
                <Form.Item shouldUpdate={(p, c) => p.department !== c.department} noStyle>
                  {({ getFieldValue }) => {
                    const dept = getFieldValue('department') as string | undefined;
                    const code =
                      dept &&
                      genAgentCode(
                        dept,
                        records.map((r) => r.agentCode),
                      );
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
                <AIPrefillWrapper
                  fieldKey="version"
                  onUserChange={() => handleUserChange('version')}
                >
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
                <Form.Item label="是否开源" name="openSource" rules={[{ required: true, message: '请选择是否开源' }]}>
                  <Radio.Group options={['是', '否']} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="智能体发布日期" name="releaseDate" rules={[{ required: true, message: '请选择智能体发布日期' }]}>
                  <DatePicker format="YYYY-MM-DD" disabledDate={(date) => date.isAfter(dayjs(), 'day')} placeholder="请选择日期" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.List
                  name="modelConfigs"
                  rules={[{
                    validator: async (_, value) => {
                      if (!value?.length) throw new Error('请至少添加一条模型信息');
                    },
                  }]}
                >
                  {(fields, { add, remove }, { errors }) => (
                    <div style={{ width: '100%' }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text strong>模型信息</Text>
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ deploymentMode: '本地化部署' })}
                        >
                          添加模型
                        </Button>
                      </Space>
                      {fields.map((field, index) => (
                        <Card
                          key={field.key}
                          size="small"
                          title={`模型 ${index + 1}`}
                          extra={fields.length > 1 ? (
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                              删除
                            </Button>
                          ) : null}
                          style={{ marginBottom: 12, background: '#FAFAFA' }}
                        >
                          <Row gutter={16}>
                            <Col span={12}>
                              <AIPrefillWrapper fieldKey="modelName" onUserChange={() => handleUserChange('modelName')}>
                                <Form.Item
                                  name={[field.name, 'modelName']}
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
                                  name={[field.name, 'modelVersion']}
                                  label="使用模型版本"
                                  rules={[
                                    { required: true, message: '请输入使用模型版本' },
                                    { pattern: /^\d+\.\d+$/, message: '格式：数字.数字，如 1.1 / 2.1' },
                                  ]}
                                >
                                  <Input placeholder="如：1.0 / 1.1 / 2.0 / 2.1" allowClear />
                                </Form.Item>
                              </AIPrefillWrapper>
                            </Col>
                            <Col span={24}>
                              <AIPrefillWrapper fieldKey="modelDeploymentMode" onUserChange={() => handleUserChange('modelDeploymentMode')}>
                                <Form.Item
                                  name={[field.name, 'deploymentMode']}
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
                          </Row>
                        </Card>
                      ))}
                      <Form.ErrorList errors={errors} />
                    </div>
                  )}
                </Form.List>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="department"
                  label="所属科室"
                  rules={[{ required: true, message: '请选择所属科室' }]}
                  tooltip="Agent 会依据功能描述语义联动推荐科室"
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
                    <Select
                      placeholder="请选择诊疗环节"
                      options={clinicalStageOptions}
                      onChange={(v) => {
                        // 选「其他」时联动显示 custom 输入框 (PRD §3.1.2.2.1 表 5)
                        form.setFieldValue('clinicalStageCustom', v === '其他' ? '' : undefined);
                      }}
                    />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                {/* PRD §3.1.2.2.1 诊疗环节选「其他」时联动出现的文本框, 限制 20 字 + 实时字数提示 */}
                <Form.Item
                  noStyle
                  shouldUpdate={(p, c) => p.clinicalStage !== c.clinicalStage}
                >
                  {({ getFieldValue }) =>
                    getFieldValue('clinicalStage') === '其他' ? (
                      <Form.Item
                        name="clinicalStageCustom"
                        label="诊疗环节（其他）"
                        tooltip="选「其他」时必填, 限制 20 字"
                        rules={[{ max: 20, message: '不超过 20 字' }]}
                      >
                        <Input
                          placeholder="请补充诊疗环节"
                          maxLength={20}
                          showCount
                          allowClear
                        />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
              </Col>
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
                    label="手机号"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号' },
                    ]}
                  >
                    <Input placeholder="11 位手机号" maxLength={11} />
                  </Form.Item>
                </AIPrefillWrapper>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="contactEmail"
                  label="邮箱"
                  rules={[
                    { required: true, message: '请输入邮箱地址' },
                    { type: 'email', message: '请输入合法的邮箱地址' },
                  ]}
                >
                  <Input placeholder="请输入邮箱地址" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Card>

        {/* ③ 技术信息 */}
        <Card title="③ 技术信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="参数量（单位：十亿）" name="parameterCount" rules={[{ required: true, message: '请输入参数量' }]}>
                <InputNumber min={0.1} step={0.1} precision={1} addonAfter="B" placeholder="请输入参数量" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="上下文长度（单位：token）" name="contextLength" rules={[{ required: true, message: '请输入上下文长度' }]}>
                <InputNumber min={1} precision={0} addonAfter="K" placeholder="请输入智能体可支持的上下文长度" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Temperature" name="temperature" rules={[{ required: true, message: '请输入 Temperature' }, { type: 'number', min: 0, max: 2, message: 'Temperature 须在 0–2 之间' }]}>
                <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} placeholder="请输入 Temperature" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Top P" name="topP" rules={[{ type: 'number', min: 0, max: 1, message: 'Top P 须在 0–1 之间' }]}>
                <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} placeholder="请输入 Top P" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="预计 API 并发量" name="concurrency" rules={[{ type: 'number', min: 1, message: '预计 API 并发量须为正整数' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="比如：32" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="accessMode"
            label="接入方式"
            rules={[{ required: true, message: '请选择接入方式' }]}
          >
            <Radio.Group
              options={accessModeOptions}
              optionType="button"
              buttonStyle="solid"
              onChange={(e) => {
                const nextMode = e.target.value as AccessMode;
                // Form.Item 注入的 onChange 被覆盖，需手动回写字段
                form.setFieldsValue({ accessMode: nextMode });
                // SDK / OTel：点击接入方式即自动签发 URL + 密钥，并复制埋点代码
                if (nextMode === 'SDK' || nextMode === 'OTel') {
                  const url = `https://otel.platform-hospital.cn/agent/${form.getFieldValue('agentCode') || 'new'}`;
                  const key = `sk-${nextMode.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
                  form.setFieldsValue({ platformUrl: url, platformKey: key });
                  const code = `// ${nextMode} 埋点代码（点击右侧复制按钮后嵌入智能体应用）\nimport { init } from '@platform/agent-${nextMode.toLowerCase()}';\ninit({\n  endpoint: '${url}',\n  apiKey: '${key}',\n});`;
                  navigator.clipboard?.writeText(code);
                  message.success(`${nextMode} 已签发，埋点代码已复制到剪贴板`);
                  addMessage({
                    role: 'agent',
                    type: 'autofix-done',
                    content: `已为你自动获取 ${nextMode} 接入配置（平台 URL + 密钥），并将埋点代码复制到剪贴板，直接粘贴到智能体应用即可完成接入。`,
                  });
                }
              }}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.accessMode !== c.accessMode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('accessMode') as AccessMode | undefined;
              const isApi = mode === 'API';
              const isSdkLike = mode === 'SDK' || mode === 'OTel';
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
                                    navigator.clipboard?.writeText(
                                      form.getFieldValue('apiEndpoint') || '',
                                    );
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
                                    navigator.clipboard?.writeText(
                                      form.getFieldValue('apiKey') || '',
                                    );
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

                  {/* SDK / OTel 接入分支 */}
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
                              <Button
                                type="link"
                                size="small"
                                onClick={() => {
                                  form.setFieldsValue({
                                    platformUrl: `https://otel.platform-hospital.cn/agent/${form.getFieldValue('agentCode') || 'new'}`,
                                    platformKey: `sk-${mode!.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`,
                                  });
                                  message.success(`${mode} 已签发：URL + 密钥已生成`);
                                }}
                              >
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

          {/* §3.3 智能化连通测试：替换原「测试验证」按钮 + Steps */}
          <Space direction="vertical" style={{ width: '100%' }}>
            <ConnectivityTester
              autoTriggerKey={connAutoTriggerKey}
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
              onLocateField={(fieldKey) =>
                form.scrollToField(fieldKey, { behavior: 'smooth', block: 'center' })
              }
              onTestStart={() => {
                // PRD §4.2: 新一次连通测试启动时,清掉上一次结果,
                //   避免「上次通过」徽标覆盖在「正在测试」之上
                setTested(false);
                setTestResult(null);
              }}
            />
          </Space>
        </Card>

        {/* 底部吸底栏 */}
        <Card
          size="small"
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            marginBottom: 0,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}
          styles={{ body: { padding: '12px 16px' } }}
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
                disabled={!tested || !testResult || !testResult.ok}
              >
                提交注册
              </Button>
            </Tooltip>
          </Space>
        </Card>
      </Form>
    </>
  );
};

export default SmartRegistrationForm;
