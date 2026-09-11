export type AgentType =
  | '辅助诊断'
  | '影像分析'
  | '病历生成'
  | '用药审核'
  | '导诊分诊'
  | '智能问诊'
  | '随访管理'
  | '健康评估';

export type LifecycleStatus =
  | '已接入'
  | '评测中'
  | '试运行中'
  | '已上线'
  | '已注销';

export type RunStatus = '在线' | '离线' | '异常';

export type AuthType = 'APIKey' | 'OAuth2' | 'JWT' | 'Basic';

export type DeployMode = '本地部署' | '私有云' | '公有云' | '混合部署';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  department: string;
  supplier: string;
  version: string;
  description: string;
  modelSource: string;
  deployMode: DeployMode;
  techArch: string;
  apiProtocol: string;
  apiEndpoint: string;
  authType: AuthType;
  authCredential?: string;
  healthCheckUrl?: string;
  timeout?: number;
  retryStrategy?: string;
  attachments?: string[];
  remark?: string;
  lifecycleStatus: LifecycleStatus;
  runStatus?: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMetrics {
  agentId: string;
  totalCalls: number;
  successRate: number;
  avgResponseTime: number;
  dailyCalls: { date: string; count: number }[];
  errorDistribution: { type: string; count: number }[];
}

export interface AgentEvaluation {
  id: string;
  agentId: string;
  status: '待评测' | '评测中' | '已完成';
  score: number;
  indicators: {
    name: string;
    score: number;
  }[];
  reportUrl?: string;
  evaluatedAt?: string;
}

export interface LedgerRecord {
  id: string;
  agentId: string;
  agentName: string;
  agentType: AgentType;
  department: string;
  operationType: '注册' | '上线' | '下线' | '注销' | '配置变更' | '评测通过' | '评测失败';
  operator: string;
  operateAt: string;
  detail?: string;
}

export interface MonitoringData {
  agentId: string;
  status: RunStatus;
  calls: number;
  errors: number;
  latency: number;
  lastHeartbeat: string;
}

export interface SecurityRisk {
  id: string;
  agentId: string;
  agentName: string;
  riskType: '数据泄露' | '权限越界' | '异常调用' | '认证失效' | '合规风险';
  severity: '低' | '中' | '高' | '严重';
  status: '待处理' | '处理中' | '已解决' | '已忽略';
  description: string;
  detectedAt: string;
  handler?: string;
  resolvedAt?: string;
}

export interface OrchestrationFlow {
  id: string;
  name: string;
  description: string;
  agents: string[];
  status: '草稿' | '已部署' | '运行中' | '已暂停' | '已下线';
  createdAt: string;
  updatedAt: string;
}
