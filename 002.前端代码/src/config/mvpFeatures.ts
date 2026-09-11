/**
 * MVP 阶段暂不开放的门户能力。
 * 后续迭代只需调整这里的开关即可恢复对应入口。
 */
export const mvpFeatures = {
  portalNavigation: false,
  smsLogin: false,
  selfRegistration: false,
  medicalAssistant: false,
  agentNeeds: false,
  projectApplication: false,
  resourceCenter: false,
  ledgerProfile360: false,
  ledgerRiskLevel: false,
  thirdPartyEvaluation: false,
  monitoringDimensionDashboards: false,
  auditProject: false,
  auditAgentBehavior: false,
  thirdPartyEvaluationPlatformConfig: false,
} as const;

/** MVP 一级模块白名单。演示面板和历史 localStorage 均不能重新开启白名单外模块。 */
export const mvpModuleKeys = new Set([
  'home',
  'agent-center',
  'ledger',
  'evaluation',
  'monitoring',
  'user-center',
  'audit',
  'system-config',
]);

/** MVP 二级页面白名单；未列出的二级入口继续保留代码，但不展示。 */
export const mvpSubPageKeys = new Set([
  'ledger:overview',
  'ledger:list',
  'evaluation:tasks',
  'evaluation:indicators',
  'evaluation:datasets',
  'monitoring:overview',
  'monitoring:alert-rules',
  'monitoring:alert-events',
  'user-center:list',
  'user-center:roles',
  'user-center:function',
  'system-config:dictionaries',
  'system-config:models',
]);
