export type OperationType = '登录' | '查看' | '创建' | '编辑' | '删除' | '审批' | '导出';
export type OperationResult = '成功' | '失败';
export type OperationModule =
  | '智能体中心'
  | '台账管理'
  | '评测中心'
  | '编排中心'
  | '监控中心'
  | '安全中心'
  | '数据资产'
  | '用户中心'
  | '系统设置';

export interface AuditLog {
  id: string;
  operationTime: string;
  operator: string;
  operatorRole: string;
  operatorDept: string;
  operationType: OperationType;
  module: OperationModule;
  operationObject: string;
  objectId?: string;
  result: OperationResult;
  ipAddress: string;
  userAgent?: string;
  detail?: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
}

const operationTypes: OperationType[] = ['登录', '查看', '创建', '编辑', '删除', '审批', '导出'];
const operationModules: OperationModule[] = [
  '智能体中心', '台账管理', '评测中心', '编排中心', '监控中心',
  '安全中心', '数据资产', '用户中心', '系统设置',
];
const results: OperationResult[] = ['成功', '失败'];
const roles = ['信息科管理员', '科室管理员'];
const departments = ['信息中心', '心内科', '影像科', '药剂科', '急诊科', '医务科'];

const operators: Record<string, string> = {
  '信息科管理员': '张明华',
  '科室管理员': '钱文博',
};

const generateAuditLogs = (): AuditLog[] => {
  const logs: AuditLog[] = [];
  const now = new Date();

  for (let i = 0; i < 50; i++) {
    const operatorRole = roles[Math.floor(Math.random() * roles.length)];
    const operator = operators[operatorRole];
    const operatorDept = departments[Math.floor(Math.random() * departments.length)];
    const operationType = operationTypes[Math.floor(Math.random() * operationTypes.length)];
    const module = operationModules[Math.floor(Math.random() * operationModules.length)];
    const result = Math.random() > 0.1 ? '成功' : '失败';
    const timestamp = new Date(now.getTime() - i * 3600000 * (Math.random() * 2 + 0.5));

    let operationObject = '';
    let objectId = '';
    let detail = '';
    let beforeData: Record<string, any> | undefined;
    let afterData: Record<string, any> | undefined;

    switch (module) {
      case '智能体中心':
        const agents = ['心电图智能辅助诊断系统', '胸部CT影像智能分析平台', '病历智能生成与质控系统'];
        operationObject = agents[Math.floor(Math.random() * agents.length)];
        objectId = `agent-00${Math.floor(Math.random() * 5) + 1}`;
        if (operationType === '登录' || operationType === '查看') {
          detail = `${operator}于${timestamp.toLocaleTimeString('zh-CN')}访问智能体详情`;
        } else if (operationType === '创建') {
          detail = `${operator}新增智能体「${operationObject}」`;
          afterData = { status: '已接入', version: 'v1.0' };
        } else if (operationType === '编辑') {
          detail = `${operator}编辑智能体「${operationObject}」配置`;
          beforeData = { version: 'v1.0', maxConcurrent: 100 };
          afterData = { version: 'v1.1', maxConcurrent: 200 };
        } else if (operationType === '删除') {
          detail = `${operator}删除智能体「${operationObject}」`;
          beforeData = { status: '已上线', name: operationObject };
        }
        break;
      case '用户中心':
        const users = ['王建国', '刘晓燕', '陈志强', '周莉', '吴强'];
        operationObject = users[Math.floor(Math.random() * users.length)];
        objectId = `user-00${Math.floor(Math.random() * 10) + 1}`;
        if (operationType === '查看') {
          detail = `${operator}查看用户「${operationObject}」信息`;
        } else if (operationType === '创建') {
          detail = `${operator}创建用户账号「${operationObject}」`;
          afterData = { status: '正常', role: '科室管理员' };
        } else if (operationType === '编辑') {
          detail = `${operator}编辑用户「${operationObject}」信息`;
          beforeData = { department: '心内科', phone: '138****1001' };
          afterData = { department: '影像科', phone: '139****1002' };
        } else if (operationType === '审批') {
          detail = `${operator}审批用户「${operationObject}」权限升级申请`;
          beforeData = { role: '科室管理员' };
          afterData = { role: '信息科管理员' };
        }
        break;
      case '数据资产':
        const assets = ['心电图诊断数据集', '胸部CT影像数据集', '病历文书数据集', '处方审核记录数据集'];
        operationObject = assets[Math.floor(Math.random() * assets.length)];
        objectId = `asset-00${Math.floor(Math.random() * 8) + 1}`;
        if (operationType === '查看') {
          detail = `${operator}查看数据资产「${operationObject}」`;
        } else if (operationType === '创建') {
          detail = `${operator}上传数据资产「${operationObject}」`;
          afterData = { recordCount: 12580, classification: '敏感' };
        } else if (operationType === '导出') {
          detail = `${operator}导出数据资产「${operationObject}」`;
          afterData = { exportFormat: 'CSV', recordCount: 5000 };
        } else if (operationType === '审批') {
          detail = `${operator}审批数据共享申请「${operationObject}」`;
        }
        break;
      case '评测中心':
        const tasks = ['智能问诊评测', '影像分析评测', '病历生成评测'];
        operationObject = tasks[Math.floor(Math.random() * tasks.length)];
        objectId = `eval-00${Math.floor(Math.random() * 5) + 1}`;
        if (operationType === '查看') {
          detail = `${operator}查看评测任务「${operationObject}」`;
        } else if (operationType === '创建') {
          detail = `${operator}创建评测任务「${operationObject}」`;
          afterData = { status: '待评测', score: null };
        } else if (operationType === '审批') {
          detail = `${operator}审核评测报告「${operationObject}」`;
          beforeData = { status: '评测中' };
          afterData = { status: '已通过', score: 92.5 };
        }
        break;
      case '编排中心':
        const scenes = ['门诊分诊场景', '影像检查场景', '用药审核场景'];
        operationObject = scenes[Math.floor(Math.random() * scenes.length)];
        objectId = `scene-00${Math.floor(Math.random() * 5) + 1}`;
        if (operationType === '查看') {
          detail = `${operator}查看编排场景「${operationObject}」`;
        } else if (operationType === '创建') {
          detail = `${operator}创建编排场景「${operationObject}」`;
          afterData = { status: '草稿', agentCount: 2 };
        } else if (operationType === '编辑') {
          detail = `${operator}编辑编排场景「${operationObject}」`;
          beforeData = { status: '草稿' };
          afterData = { status: '已发布' };
        }
        break;
      case '安全中心':
        const risks = ['数据泄露风险', '权限越界风险', '认证失效风险'];
        operationObject = risks[Math.floor(Math.random() * risks.length)];
        objectId = `risk-00${Math.floor(Math.random() * 5) + 1}`;
        if (operationType === '查看') {
          detail = `${operator}查看安全风险「${operationObject}」`;
        } else if (operationType === '审批') {
          detail = `${operator}处理安全风险「${operationObject}」`;
          beforeData = { status: '待处理' };
          afterData = { status: '已处理', handler: operator };
        }
        break;
      case '系统设置':
        operationObject = '系统配置';
        objectId = 'config-001';
        if (operationType === '查看') {
          detail = `${operator}查看系统配置`;
        } else if (operationType === '编辑') {
          detail = `${operator}修改系统配置「${operationObject}」`;
          beforeData = { maxLoginAttempts: 5, sessionTimeout: 1800 };
          afterData = { maxLoginAttempts: 3, sessionTimeout: 3600 };
        }
        break;
      default:
        operationObject = `${module}对象`;
        detail = `${operator}对${module}执行${operationType}操作`;
    }

    if (result === '失败') {
      detail += '，操作失败';
      beforeData = undefined;
      afterData = undefined;
    }

    logs.push({
      id: `log-${String(i + 1).padStart(6, '0')}`,
      operationTime: timestamp.toLocaleString('zh-CN'),
      operator,
      operatorRole,
      operatorDept,
      operationType,
      module,
      operationObject,
      objectId,
      result,
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      detail,
      beforeData,
      afterData,
    });
  }

  return logs.sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime());
};

export const mockAuditLogs = generateAuditLogs();

export const getAuditLogs = () => mockAuditLogs;

export const getAuditLogById = (id: string): AuditLog | undefined => {
  return mockAuditLogs.find((log) => log.id === id);
};

export const getAuditLogsByOperator = (operator: string): AuditLog[] => {
  return mockAuditLogs.filter((log) => log.operator === operator);
};

export const getAuditLogsByModule = (module: OperationModule): AuditLog[] => {
  return mockAuditLogs.filter((log) => log.module === module);
};

export const getAuditLogsByTimeRange = (startTime: string, endTime: string): AuditLog[] => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return mockAuditLogs.filter((log) => {
    const logTime = new Date(log.operationTime).getTime();
    return logTime >= start && logTime <= end;
  });
};
