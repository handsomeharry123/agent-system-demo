export * from './agents';
export * from './users';
export * from './departments';
export * from './seed';
export * from './audit';
export * from './evaluation';
export * from './ledger';
export * from './connectors';

import { mockAgents, starAgents } from './agents';
import { mockUsers } from './users';
import { departments } from './departments';
import type { Agent, LedgerRecord, AgentMetrics, AgentEvaluation, MonitoringData, SecurityRisk, OrchestrationFlow } from '../types/agent';

export const allAgents = mockAgents;
export const allUsers = mockUsers;
export const allDepartments = departments;
export const starAgentIds = starAgents.map((a) => a.id);

export const generateLedgerRecords = (): LedgerRecord[] => {
  const records: LedgerRecord[] = [];
  const operationTypes: LedgerRecord['operationType'][] = [
    '注册', '上线', '下线', '注销', '配置变更', '评测通过', '评测失败',
  ];
  const operators = ['张明华', '李秀英', '王建国', '刘晓燕', '陈志强', '系统自动'];

  starAgents.forEach((agent, idx) => {
    records.push({
      id: `ledger-${idx + 1}`,
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type,
      department: agent.department,
      operationType: '注册',
      operator: operators[idx % operators.length],
      operateAt: agent.createdAt,
      detail: `${agent.name} 正式接入平台`,
    });

    if (agent.lifecycleStatus !== '已接入') {
      records.push({
        id: `ledger-${idx + 1}-eval`,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        department: agent.department,
        operationType: '评测通过',
        operator: '评测委员会',
        operateAt: `2024-${String(idx + 3).padStart(2, '0')}-15 10:00:00`,
        detail: `综合评分 92.5，达到上线标准`,
      });

      records.push({
        id: `ledger-${idx + 1}-online`,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        department: agent.department,
        operationType: '上线',
        operator: operators[idx % operators.length],
        operateAt: `2024-${String(idx + 4).padStart(2, '0')}-01 09:00:00`,
        detail: `经审批通过，正式上线运营`,
      });
    }
  });

  return records.sort((a, b) => new Date(b.operateAt).getTime() - new Date(a.operateAt).getTime());
};

export const generateMonitoringData = (scenario: 'normal' | 'alert' = 'normal'): MonitoringData[] => {
  return starAgents.map((agent) => {
    const isAnomaly = scenario === 'alert' && (agent.id === 'agent-002' || agent.id === 'agent-004');
    const status = isAnomaly ? '异常' : agent.runStatus;

    return {
      agentId: agent.id,
      status: status as MonitoringData['status'],
      calls: scenario === 'alert' ? Math.floor(Math.random() * 100) : Math.floor(Math.random() * 500) + 200,
      errors: scenario === 'alert' ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 5),
      latency: scenario === 'alert' ? Math.floor(Math.random() * 500) + 300 : Math.floor(Math.random() * 200) + 50,
      lastHeartbeat: new Date(Date.now() - Math.random() * 60000).toISOString(),
    };
  });
};

export const generateAlerts = (scenario: 'normal' | 'alert' = 'normal') => {
  if (scenario === 'normal') return [];

  return [
    {
      id: 'alert-001',
      agentId: 'agent-002',
      agentName: '胸部 CT 影像智能分析平台',
      type: '性能异常',
      severity: '严重',
      message: '响应时间超过阈值 300%，当前延迟 1850ms',
      status: '未处理',
      detectedAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'alert-002',
      agentId: 'agent-004',
      agentName: '处方智能审核与用药安全系统',
      type: '错误率升高',
      severity: '高',
      message: '错误率突然升高至 8.5%，超出正常范围',
      status: '未处理',
      detectedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'alert-003',
      agentId: 'agent-003',
      agentName: '病历智能生成与质控系统',
      type: '调用量异常',
      severity: '中',
      message: '凌晨时段调用量突增 500%，可能存在异常调用',
      status: '未处理',
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'alert-004',
      agentId: 'agent-001',
      agentName: '心电图智能辅助诊断系统',
      type: '认证异常',
      severity: '中',
      message: '连续 3 次认证失败，建议检查 API Key 状态',
      status: '处理中',
      detectedAt: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'alert-005',
      agentId: 'agent-005',
      agentName: '智能导诊与分诊系统',
      type: '连接中断',
      severity: '低',
      message: 'WebSocket 连接频繁断开，平均每 5 分钟断连一次',
      status: '未处理',
      detectedAt: new Date(Date.now() - 14400000).toISOString(),
    },
  ];
};

export const generateSecurityRisks = (scenario: 'normal' | 'alert' = 'normal'): SecurityRisk[] => {
  if (scenario === 'normal') return [];

  return [
    {
      id: 'risk-001',
      agentId: 'agent-003',
      agentName: '病历智能生成与质控系统',
      riskType: '数据泄露',
      severity: '高',
      status: '待处理',
      description: '检测到疑似患者隐私数据外传风险，涉及 127 条病历记录',
      detectedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'risk-002',
      agentId: 'agent-002',
      agentName: '胸部 CT 影像智能分析平台',
      riskType: '权限越界',
      severity: '严重',
      status: '待处理',
      description: '检测到 API 调用权限越界，尝试访问未授权影像数据',
      detectedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'risk-003',
      agentId: 'agent-001',
      agentName: '心电图智能辅助诊断系统',
      riskType: '认证失效',
      severity: '中',
      status: '处理中',
      description: 'API Key 即将过期（剩余 3 天），需要及时更新',
      detectedAt: new Date(Date.now() - 259200000).toISOString(),
      handler: '张明华',
    },
  ];
};

export const generateEvaluationRecords = (): AgentEvaluation[] => {
  return starAgents.slice(0, 4).map((agent, idx) => ({
    id: `eval-${agent.id}`,
    agentId: agent.id,
    status: idx === 0 ? '评测中' : idx === 1 ? '待评测' : '已完成',
    score: 85 + Math.floor(Math.random() * 15),
    indicators: [
      { name: '准确性', score: 80 + Math.floor(Math.random() * 20) },
      { name: '响应速度', score: 75 + Math.floor(Math.random() * 25) },
      { name: '稳定性', score: 80 + Math.floor(Math.random() * 20) },
      { name: '安全性', score: 85 + Math.floor(Math.random() * 15) },
      { name: '易用性', score: 70 + Math.floor(Math.random() * 30) },
    ],
    reportUrl: idx < 2 ? undefined : `/evaluation/report/${agent.id}`,
    evaluatedAt: idx < 2 ? undefined : `2025-${String(idx + 6).padStart(2, '0')}-15 10:00:00`,
  }));
};

export const generateFlows = (): OrchestrationFlow[] => {
  return [
    {
      id: 'flow-001',
      name: '门诊智能分诊流程',
      description: '根据患者主诉智能分诊至对应科室，支持紧急程度评估',
      agents: ['agent-005', 'agent-001'],
      status: '运行中',
      createdAt: '2025-01-10 08:00:00',
      updatedAt: '2026-05-15 14:00:00',
    },
    {
      id: 'flow-002',
      name: '影像检查协同流程',
      description: 'CT 检查自动预约、影像分析、报告生成一体化流程',
      agents: ['agent-002', 'agent-003'],
      status: '已部署',
      createdAt: '2025-03-20 10:00:00',
      updatedAt: '2026-04-01 09:00:00',
    },
    {
      id: 'flow-003',
      name: '用药安全审核流程',
      description: '处方实时审核、用药冲突检测、不良反应预警',
      agents: ['agent-004'],
      status: '运行中',
      createdAt: '2025-02-15 08:00:00',
      updatedAt: '2026-05-10 16:00:00',
    },
  ];
};
