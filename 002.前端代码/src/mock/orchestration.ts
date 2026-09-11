import type { AgentType } from '../types/agent';

// ============ Enums ============
export type ClinicType = '门诊' | '急诊' | '住院' | '体检' | '随访';
export type Stage = '挂号' | '分诊' | '问诊' | '检查' | '诊断' | '用药' | '复诊' | '其他';
export type BindingType = 'single' | 'orchestration';
export type SceneStatus = '草稿' | '测试中' | '上线' | '下线' | '已归档';
export type FlowStatus = '草稿' | '测试中' | '上线' | '下线' | '已归档';

// ============ Node Types (6类节点) ============
export type NodeType = 'start' | 'input' | 'output' | 'agent' | 'condition' | 'end';

export interface ConditionRule {
  id: string;
  variable: string;
  operator: '等于' | '不等于' | '包含' | '不包含' | '为空' | '不为空' | '开始为' | '结束为' | '>' | '<' | '≥' | '≤' | '正则';
  value: string;
  valueType: 'input' | 'reference'; // 比较值类型：输入值 or 引用变量
}

export interface ConditionBranch {
  id: string;
  name: string;
  rules: ConditionRule[];
  logic: 'and' | 'or'; // 多条件运算方式
}

export interface FormField {
  id: string;
  type: 'text' | 'select' | 'file';
  label: string;
  variableName: string;
  required: boolean;
  multiple?: boolean; // for select type
  options?: { label: string; value: string }[]; // for select type
  fileTypes?: string[]; // for file type: 图片/PDF/Word/Excel/CSV/DICOM
}

export interface InputMapping {
  agentParamName: string;
  sourceType: 'upstream' | 'constant' | 'expression';
  sourceValue: string;
}

export interface OutputMapping {
  agentFieldName: string;
  outputVariableName: string;
  dataType: string;
}

export interface AgentNodeConfig {
  agentId: string;
  agentName: string;
  agentVersion: string;
  versionType: 'latest' | 'specific';
  callMode: 'sync' | 'async';
  showResultRealTime: boolean;
  inputMappings: InputMapping[];
  outputMappings: OutputMapping[];
  timeout: number;
  retryCount: number;
  retryInterval: number;
  failStrategy: 'skip_continue' | 'fallback' | 'terminate';
  fallbackBranch?: string;
  headers?: { key: string; value: string }[];
}

export interface OutputNodeConfig {
  contentTemplate: string;
  displayVariables: string[];
  displayMode: 'bubble' | 'card' | 'stream';
  interactionMode: 'none' | 'confirm' | 'select' | 'input';
  options?: { label: string; value: string }[];
  prefillContent?: string;
  interactionOutputVar?: string;
}

export interface InputNodeConfig {
  inputMode: 'dialog' | 'form';
  formFields: FormField[];
}

export interface StartNodeConfig {
  welcomeMessage: string;
  guideQuestions: { label: string }[];
}

export interface FlowNode {
  id: string;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  config: {
    // Common
    timeout?: number;
    retryCount?: number;
    retryInterval?: number;
    failStrategy?: string;
    // Start node
    start?: StartNodeConfig;
    // Input node
    input?: InputNodeConfig;
    // Output node
    output?: OutputNodeConfig;
    // Agent node
    agent?: AgentNodeConfig;
    // Condition node
    condition?: {
      branches: ConditionBranch[];
    };
  };
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort: string;
  targetPort: string;
  branchName?: string;
  condition?: string;
}

// ============ Variable System ============
export type VariableType = 'system' | 'node_output' | 'user_defined';

export interface Variable {
  name: string;
  type: VariableType;
  dataType: string;
  source?: string; // for node_output: nodeId
  example?: string;
  description?: string;
}

// ============ Version Management ============
export interface FlowVersion {
  version: string;
  publishTime: string;
  changeNote: string;
  isCurrent: boolean;
  snapshot: {
    nodes: FlowNode[];
    connections: Connection[];
  };
}

// ============ Scene ============
export interface Scene {
  id: string;
  name: string;
  icon: string;
  description: string;
  clinicType: ClinicType;
  stages: Stage[];
  applicableDepts: string[];
  bindingType: BindingType;
  agentId?: string;
  agentName?: string;
  flowId?: string;
  flowName?: string;
  flowVersion?: string;
  entryPositions: ('workbench_home' | 'dept_workbench' | 'patient_portal' | 'api_only')[];
  visibleScope: 'all' | 'dept' | 'role';
  visibleDepts?: string[];
  status: SceneStatus;
  enabled: boolean;
  sortOrder: number;
  quickCommands?: { label: string; command: string }[];
  welcomeMessage?: string;
  createTime: string;
  updateTime: string;
  creator?: string;
}

// ============ OrchestrationFlow ============
export interface OrchestrationFlow {
  id: string;
  name: string;
  description: string;
  status: FlowStatus;
  version: string;
  nodeCount: number;
  creator: string;
  applicableDepts: string[];
  createTime: string;
  updateTime: string;
  lastRunTime?: string;
  runCount: number;
  todayExecutionCount?: number;
  successRate?: number;
  nodes: FlowNode[];
  connections: Connection[];
  versions?: FlowVersion[];
}

// ============ FlowExecutionRecord ============
export interface FlowExecutionRecord {
  id: string;
  flowId: string;
  flowName: string;
  flowVersion: string;
  triggerUser: string;
  triggerDept: string;
  triggerTime: string;
  status: '执行中' | '已完成' | '已失败' | '已终止';
  duration?: string;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  nodes?: {
    nodeId: string;
    nodeName: string;
    nodeType: NodeType;
    status: '已完成' | '执行中' | '已跳过' | '已失败' | '降级' | '超时';
    startTime?: string;
    endTime?: string;
    duration?: string;
    input?: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    errorCode?: string;
  }[];
}

// ============ Mock Scenes ============
export const mockScenes: Scene[] = [
  {
    id: 'scene-001',
    name: '门诊智能分诊',
    icon: 'MedicineBoxOutlined',
    clinicType: '门诊',
    stages: ['分诊'],
    applicableDepts: ['全院'],
    description: '根据患者主诉智能分诊至对应科室，支持紧急程度评估',
    bindingType: 'orchestration',
    flowId: 'flow-001',
    flowName: '门诊分诊流程',
    flowVersion: 'v1.2',
    quickCommands: [
      { label: '整理主诉', command: '请帮我整理患者的主诉信息' },
      { label: '初步评估', command: '请进行初步病情评估' },
    ],
    welcomeMessage: '您好，我是智能分诊助手，请描述您的症状或不适，我会为您推荐合适的就诊科室。',
    status: '上线',
    enabled: true,
    sortOrder: 1,
    entryPositions: ['workbench_home', 'dept_workbench'],
    visibleScope: 'all',
    createTime: '2025-01-10 08:00:00',
    updateTime: '2026-03-15 14:00:00',
    creator: '管理员',
  },
  {
    id: 'scene-002',
    name: '门诊病历生成',
    icon: 'FileTextOutlined',
    clinicType: '门诊',
    stages: ['问诊', '复诊'],
    applicableDepts: ['全院'],
    description: '自动生成门诊病历文档，支持病历质控',
    bindingType: 'single',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    quickCommands: [
      { label: '生成病历', command: '请帮我生成病历摘要' },
      { label: '病历质控', command: '请进行病历质控检查' },
    ],
    welcomeMessage: '您好，我可以帮您生成规范的门诊病历，请提供患者的基本信息和就诊情况。',
    status: '上线',
    enabled: true,
    sortOrder: 2,
    entryPositions: ['workbench_home'],
    visibleScope: 'all',
    createTime: '2025-01-15 10:00:00',
    updateTime: '2025-04-20 16:00:00',
    creator: '管理员',
  },
  {
    id: 'scene-003',
    name: '处方审核',
    icon: 'SafetyOutlined',
    clinicType: '门诊',
    stages: ['用药'],
    applicableDepts: ['药剂科', '心内科', '呼吸科'],
    description: '实时审核处方用药安全，智能识别药物相互作用',
    bindingType: 'single',
    agentId: 'agent-004',
    agentName: '处方智能审核与用药安全系统',
    quickCommands: [
      { label: '审核处方', command: '请审核以下处方' },
      { label: '用药建议', command: '请提供用药建议' },
    ],
    welcomeMessage: '您好，我是用药安全审核助手，请提供处方信息进行审核。',
    status: '上线',
    enabled: true,
    sortOrder: 3,
    entryPositions: ['workbench_home', 'dept_workbench'],
    visibleScope: 'dept',
    visibleDepts: ['药剂科', '心内科', '呼吸科'],
    createTime: '2025-02-01 09:00:00',
    updateTime: '2025-05-10 11:00:00',
    creator: '管理员',
  },
  {
    id: 'scene-004',
    name: '急诊快速分诊',
    icon: 'FireOutlined',
    clinicType: '急诊',
    stages: ['分诊'],
    applicableDepts: ['急诊科'],
    description: '急诊患者快速分诊评估，识别危急重症',
    bindingType: 'orchestration',
    flowId: 'flow-004',
    flowName: '急诊分诊流程',
    flowVersion: 'v1.1',
    quickCommands: [
      { label: '快速评估', command: '请进行快速病情评估' },
      { label: '危急识别', command: '请识别危急重症' },
    ],
    welcomeMessage: '急诊分诊系统启动，请描述患者的主要症状和生命体征。',
    status: '上线',
    enabled: true,
    sortOrder: 1,
    entryPositions: ['workbench_home', 'dept_workbench'],
    visibleScope: 'dept',
    visibleDepts: ['急诊科'],
    createTime: '2025-02-15 14:00:00',
    updateTime: '2025-05-01 10:00:00',
    creator: '管理员',
  },
  {
    id: 'scene-005',
    name: 'CT影像分析',
    icon: 'CameraOutlined',
    clinicType: '门诊',
    stages: ['检查'],
    applicableDepts: ['放射科', '呼吸科'],
    description: '胸部CT智能影像分析，自动标注病灶',
    bindingType: 'single',
    agentId: 'agent-002',
    agentName: '胸部CT影像智能分析平台',
    quickCommands: [
      { label: '影像分析', command: '请分析CT影像' },
      { label: '报告生成', command: '请生成分析报告' },
    ],
    welcomeMessage: 'CT影像分析系统就绪，请上传影像文件开始分析。',
    status: '上线',
    enabled: true,
    sortOrder: 1,
    entryPositions: ['workbench_home'],
    visibleScope: 'all',
    createTime: '2025-04-01 09:00:00',
    updateTime: '2025-05-20 08:00:00',
    creator: '管理员',
  },
  {
    id: 'scene-006',
    name: '入院综合评估',
    icon: 'MedicineOutlined',
    clinicType: '住院',
    stages: ['分诊', '问诊'],
    applicableDepts: ['全院'],
    description: '入院综合评估与风险识别',
    bindingType: 'single',
    agentId: 'agent-001',
    agentName: '心电图智能辅助诊断系统',
    quickCommands: [
      { label: '综合评估', command: '请进行综合入院评估' },
      { label: '风险识别', command: '请识别住院风险' },
    ],
    welcomeMessage: '住院综合评估系统启动，请提供患者的基本信息和检查结果。',
    status: '上线',
    enabled: true,
    sortOrder: 1,
    entryPositions: ['dept_workbench'],
    visibleScope: 'all',
    createTime: '2025-03-10 10:00:00',
    updateTime: '2025-05-18 15:00:00',
    creator: '管理员',
  },
  {
    id: 'scene-007',
    name: '出院小结生成',
    icon: 'FileTextOutlined',
    clinicType: '住院',
    stages: ['复诊', '其他'],
    applicableDepts: ['全院'],
    description: '自动生成出院小结文档',
    bindingType: 'single',
    agentId: 'agent-003',
    agentName: '病历智能生成与质控系统',
    quickCommands: [
      { label: '生成小结', command: '请生成出院小结' },
    ],
    welcomeMessage: '出院小结生成系统启动，请提供患者住院信息。',
    status: '草稿',
    enabled: false,
    sortOrder: 1,
    entryPositions: ['dept_workbench'],
    visibleScope: 'all',
    createTime: '2025-03-25 10:00:00',
    updateTime: '2025-05-18 11:00:00',
    creator: '管理员',
  },
];

// ============ Mock Flows ============
// Default nodes for a new flow
const defaultNodes: FlowNode[] = [
  {
    id: 'start-1',
    name: '开始',
    type: 'start',
    x: 300,
    y: 50,
    config: {
      start: {
        welcomeMessage: '您好，我是智能诊疗助手，请问有什么可以帮您？',
        guideQuestions: [
          { label: '我想分诊' },
          { label: '我想问诊' },
          { label: '我想咨询用药' },
        ],
      },
    },
  },
  {
    id: 'end-1',
    name: '结束',
    type: 'end',
    x: 300,
    y: 400,
    config: {},
  },
];

const defaultConnections: Connection[] = [];

export const mockFlows: OrchestrationFlow[] = [
  {
    id: 'flow-001',
    name: '门诊分诊流程',
    description: '根据患者主诉智能分诊至对应科室，支持紧急程度评估',
    status: '上线',
    version: 'v1.2',
    nodeCount: 5,
    creator: '管理员',
    applicableDepts: ['全院', '心内科', '呼吸科', '消化科'],
    createTime: '2025-01-10 08:00:00',
    updateTime: '2026-03-15 14:00:00',
    lastRunTime: '2026-05-25 10:30:00',
    runCount: 15680,
    todayExecutionCount: 1256,
    successRate: 98,
    nodes: [
      ...defaultNodes,
      {
        id: 'input-1',
        name: '收集主诉',
        type: 'input',
        x: 300,
        y: 130,
        config: {
          input: {
            inputMode: 'form',
            formFields: [
              { id: 'ff-1', type: 'text', label: '主要症状', variableName: 'chief_complaint', required: true },
              { id: 'ff-2', type: 'select', label: '症状持续时间', variableName: 'duration', required: true, options: [{ label: '<1天', value: 'less_1d' }, { label: '1-3天', value: '1_3d' }, { label: '>3天', value: 'more_3d' }] },
            ],
          },
        },
      },
      {
        id: 'agent-1',
        name: '智能分诊',
        type: 'agent',
        x: 300,
        y: 230,
        config: {
          agent: {
            agentId: 'agent-005',
            agentName: '智能导诊与分诊系统',
            agentVersion: 'v2.1',
            versionType: 'latest',
            callMode: 'sync',
            showResultRealTime: true,
            inputMappings: [
              { agentParamName: 'chief_complaint', sourceType: 'upstream', sourceValue: 'chief_complaint' },
            ],
            outputMappings: [
              { agentFieldName: 'recommended_department', outputVariableName: 'recommended_dept', dataType: 'string' },
              { agentFieldName: 'urgency_level', outputVariableName: 'urgency', dataType: 'string' },
            ],
            timeout: 30,
            retryCount: 2,
            retryInterval: 5,
            failStrategy: 'terminate',
          },
        },
      },
      {
        id: 'condition-1',
        name: '判断紧急程度',
        type: 'condition',
        x: 300,
        y: 310,
        config: {
          condition: {
            branches: [
              {
                id: 'b-1',
                name: '危急',
                rules: [{ id: 'r-1', variable: 'urgency', operator: '等于', value: 'critical', valueType: 'input' }],
                logic: 'and',
              },
              {
                id: 'b-2',
                name: '普通',
                rules: [{ id: 'r-2', variable: 'urgency', operator: '等于', value: 'normal', valueType: 'input' }],
                logic: 'and',
              },
            ],
          },
        },
      },
    ],
    connections: [
      { id: 'c-1', sourceId: 'start-1', targetId: 'input-1', sourcePort: 'bottom', targetPort: 'top' },
      { id: 'c-2', sourceId: 'input-1', targetId: 'agent-1', sourcePort: 'bottom', targetPort: 'top' },
      { id: 'c-3', sourceId: 'agent-1', targetId: 'condition-1', sourcePort: 'bottom', targetPort: 'top' },
      { id: 'c-4', sourceId: 'condition-1', targetId: 'end-1', sourcePort: 'bottom', targetPort: 'top', branchName: '默认' },
    ],
    versions: [
      { version: 'v1.2', publishTime: '2026-03-15 14:00:00', changeNote: '优化分诊逻辑，增加紧急程度判断', isCurrent: true, snapshot: { nodes: [], connections: [] } },
      { version: 'v1.1', publishTime: '2026-01-20 10:00:00', changeNote: '增加表单输入节点', isCurrent: false, snapshot: { nodes: [], connections: [] } },
      { version: 'v1.0', publishTime: '2026-01-10 08:00:00', changeNote: '初始版本发布', isCurrent: false, snapshot: { nodes: [], connections: [] } },
    ],
  },
  {
    id: 'flow-002',
    name: '急诊分诊流程',
    description: '急诊患者快速评估、危急识别、智能分诊（MVP可用）',
    status: '上线',
    version: 'v1.1',
    nodeCount: 6,
    creator: '管理员',
    applicableDepts: ['急诊科'],
    createTime: '2025-02-28 09:00:00',
    updateTime: '2026-05-01 10:00:00',
    lastRunTime: '2026-05-25 10:15:00',
    runCount: 23560,
    todayExecutionCount: 1832,
    successRate: 97,
    nodes: defaultNodes,
    connections: defaultConnections,
    versions: [
      { version: 'v1.1', publishTime: '2026-05-01 10:00:00', changeNote: '支持条件分支路由', isCurrent: true, snapshot: { nodes: [], connections: [] } },
      { version: 'v1.0', publishTime: '2026-02-28 09:00:00', changeNote: '初始版本发布', isCurrent: false, snapshot: { nodes: [], connections: [] } },
    ],
  },
  {
    id: 'flow-003',
    name: '用药安全审核流程',
    description: '处方实时审核、用药冲突检测、不良反应预警',
    status: '上线',
    version: 'v2.1',
    nodeCount: 4,
    creator: '管理员',
    applicableDepts: ['药剂科', '心内科', '呼吸科'],
    createTime: '2025-02-15 08:00:00',
    updateTime: '2026-05-10 16:00:00',
    lastRunTime: '2026-05-25 10:25:00',
    runCount: 456780,
    todayExecutionCount: 8932,
    successRate: 99,
    nodes: defaultNodes,
    connections: defaultConnections,
    versions: [
      { version: 'v2.1', publishTime: '2026-05-10 16:00:00', changeNote: '增加药物相互作用检测', isCurrent: true, snapshot: { nodes: [], connections: [] } },
    ],
  },
  {
    id: 'flow-004',
    name: '门诊病历生成流程',
    description: '自动生成门诊病历文档，支持病历质控',
    status: '测试中',
    version: 'v0.5',
    nodeCount: 4,
    creator: '管理员',
    applicableDepts: ['全院'],
    createTime: '2025-05-01 10:00:00',
    updateTime: '2026-05-20 14:00:00',
    runCount: 0,
    todayExecutionCount: 0,
    successRate: 0,
    nodes: defaultNodes,
    connections: defaultConnections,
  },
  {
    id: 'flow-005',
    name: '住院综合评估流程',
    description: '入院综合评估与风险识别',
    status: '下线',
    version: 'v1.0',
    nodeCount: 5,
    creator: '管理员',
    applicableDepts: ['全院'],
    createTime: '2025-04-10 10:00:00',
    updateTime: '2026-05-18 15:00:00',
    lastRunTime: '2026-05-18 15:00:00',
    runCount: 3280,
    todayExecutionCount: 0,
    successRate: 94,
    nodes: defaultNodes,
    connections: defaultConnections,
    versions: [
      { version: 'v1.0', publishTime: '2026-04-10 10:00:00', changeNote: '初始版本发布', isCurrent: true, snapshot: { nodes: [], connections: [] } },
    ],
  },
  {
    id: 'flow-006',
    name: '体检报告解读流程',
    description: '体检报告智能解读与健康建议',
    status: '草稿',
    version: 'v0.1',
    nodeCount: 0,
    creator: '管理员',
    applicableDepts: ['体检科'],
    createTime: '2026-05-20 10:00:00',
    updateTime: '2026-05-20 10:00:00',
    runCount: 0,
    todayExecutionCount: 0,
    successRate: 0,
    nodes: [],
    connections: [],
  },
];

// ============ Mock Execution Records ============
export const mockFlowExecutionRecords: FlowExecutionRecord[] = [
  {
    id: 'exec-001',
    flowId: 'flow-001',
    flowName: '门诊分诊流程',
    flowVersion: 'v1.2',
    triggerUser: '张医生',
    triggerDept: '心内科',
    triggerTime: '2026-05-25 10:30:00',
    status: '已完成',
    duration: '2m 35s',
    totalNodes: 5,
    completedNodes: 5,
    failedNodes: 0,
    skippedNodes: 0,
    nodes: [
      { nodeId: 'start-1', nodeName: '开始', nodeType: 'start', status: '已完成', startTime: '10:27:55', endTime: '10:27:56', duration: '1s' },
      { nodeId: 'input-1', nodeName: '收集主诉', nodeType: 'input', status: '已完成', startTime: '10:27:56', endTime: '10:28:10', duration: '14s', input: { chief_complaint: '胸痛2小时' }, output: { chief_complaint: '胸痛2小时' } },
      { nodeId: 'agent-1', nodeName: '智能分诊', nodeType: 'agent', status: '已完成', startTime: '10:28:10', endTime: '10:28:55', duration: '45s', input: { chief_complaint: '胸痛2小时' }, output: { recommended_dept: '心内科', urgency: 'urgent' } },
      { nodeId: 'condition-1', nodeName: '判断紧急程度', nodeType: 'condition', status: '已完成', startTime: '10:28:55', endTime: '10:28:56', duration: '1s', output: { selected_branch: '危急' } },
      { nodeId: 'end-1', nodeName: '结束', nodeType: 'end', status: '已完成', startTime: '10:28:56', endTime: '10:28:56', duration: '0s' },
    ],
  },
  {
    id: 'exec-002',
    flowId: 'flow-001',
    flowName: '门诊分诊流程',
    flowVersion: 'v1.2',
    triggerUser: '李护士',
    triggerDept: '急诊科',
    triggerTime: '2026-05-25 09:15:00',
    status: '已完成',
    duration: '1m 48s',
    totalNodes: 5,
    completedNodes: 5,
    failedNodes: 0,
    skippedNodes: 0,
    nodes: [
      { nodeId: 'start-1', nodeName: '开始', nodeType: 'start', status: '已完成', startTime: '09:13:12', endTime: '09:13:13', duration: '1s' },
      { nodeId: 'input-1', nodeName: '收集主诉', nodeType: 'input', status: '已完成', startTime: '09:13:13', endTime: '09:13:25', duration: '12s', input: { chief_complaint: '发热咳嗽3天' }, output: { chief_complaint: '发热咳嗽3天' } },
      { nodeId: 'agent-1', nodeName: '智能分诊', nodeType: 'agent', status: '已完成', startTime: '09:13:25', endTime: '09:14:03', duration: '38s', input: { chief_complaint: '发热咳嗽3天' }, output: { recommended_dept: '呼吸科', urgency: 'normal' } },
      { nodeId: 'condition-1', nodeName: '判断紧急程度', nodeType: 'condition', status: '已完成', startTime: '09:14:03', endTime: '09:14:04', duration: '1s', output: { selected_branch: '普通' } },
      { nodeId: 'end-1', nodeName: '结束', nodeType: 'end', status: '已完成', startTime: '09:14:04', endTime: '09:14:04', duration: '0s' },
    ],
  },
  {
    id: 'exec-003',
    flowId: 'flow-003',
    flowName: '用药安全审核流程',
    flowVersion: 'v2.1',
    triggerUser: '王药师',
    triggerDept: '药剂科',
    triggerTime: '2026-05-25 08:30:00',
    status: '已完成',
    duration: '35s',
    totalNodes: 4,
    completedNodes: 4,
    failedNodes: 0,
    skippedNodes: 0,
    nodes: [],
  },
];

// ============ Helper Functions ============
export const getScenesByClinicType = (clinicType: ClinicType): Scene[] => {
  return mockScenes.filter((s) => s.clinicType === clinicType);
};

export const getScenesByStage = (stage: Stage): Scene[] => {
  return mockScenes.filter((s) => s.stages.includes(stage));
};

export const getActiveFlows = (): OrchestrationFlow[] => {
  return mockFlows.filter((f) => f.status === '上线');
};

export const getOnlineFlows = (): OrchestrationFlow[] => {
  return mockFlows.filter((f) => f.status === '上线' || f.status === '测试中');
};

export const getFlowById = (id: string): OrchestrationFlow | undefined => {
  return mockFlows.find((f) => f.id === id);
};

export const getSceneById = (id: string): Scene | undefined => {
  return mockScenes.find((s) => s.id === id);
};

export const getFlowExecutions = (flowId: string): FlowExecutionRecord[] => {
  return mockFlowExecutionRecords.filter((e) => e.flowId === flowId);
};

// Node type labels
export const nodeTypeLabels: Record<NodeType, string> = {
  start: '开始节点',
  input: '输入节点',
  output: '输出节点',
  agent: 'Agent节点',
  condition: '条件分支',
  end: '结束节点',
};

// Status color maps
export const flowStatusColors: Record<FlowStatus, string> = {
  '草稿': 'default',
  '测试中': 'processing',
  '上线': 'success',
  '下线': 'warning',
  '已归档': 'default',
};

export const sceneStatusColors: Record<SceneStatus, string> = {
  '草稿': 'default',
  '测试中': 'processing',
  '上线': 'success',
  '下线': 'error',
  '已归档': 'default',
};

export const executionStatusColors: Record<string, string> = {
  '执行中': 'processing',
  '已完成': 'success',
  '已失败': 'error',
  '已终止': 'default',
};

export const nodeStatusColors: Record<string, string> = {
  '已完成': 'success',
  '执行中': 'processing',
  '已跳过': 'default',
  '已失败': 'error',
  '降级': 'warning',
  '超时': 'error',
};
