export type UserRole = '医院领导' | '信息科管理员' | '科室管理员';

export type UserStatus = '正常' | '在职' | '已停用';

/** V1.1 文档定义：本科室 / 全部 / 指定 */
export type AgentScope = 'dept' | 'all' | 'custom';

/** V1.1 文档定义：一般 / 重要 / 核心 / 敏感 */
export type DataClassification = '一般' | '重要' | '核心' | '敏感';

/** 数据范围来源：继承自所属组织 / 用户级覆盖 */
export type DataPermissionSource = 'inherit' | 'override';

/** 同步结果 */
export type SyncStatus = 'success' | 'partial' | 'failed';

export interface User {
  id: string;
  name: string;
  /** 工号：从医院系统同步，唯一标识 */
  employeeId: string;
  /** 所属组织（科室） */
  department: string;
  /** 一个用户可同时拥有多个角色 */
  roles: UserRole[];
  phone: string;
  email?: string;
  avatar?: string;
  password?: string;
  status: UserStatus;
  lastLoginAt?: string;
  /** 从医院系统同步该用户的时间 */
  syncTime: string;
  /** 数据范围来源：inherit = 继承自所属组织；override = 用户级覆盖 */
  dataPermissionSource: DataPermissionSource;
  createdAt: string;
  updatedAt: string;
}

/** 组织（科室）数据权限规则 */
export interface OrganizationRule {
  id: string;
  /** 组织/科室名称 */
  orgName: string;
  /** 是否全院默认规则（首行固定） */
  isDefault: boolean;
  /** 全院默认规则不可重置 */
  isFixed: boolean;
  agentScope: AgentScope;
  customAgents?: string[];
  dataClassifications: DataClassification[];
  note?: string;
  updatedAt: string;
  /** 当前继承该规则的用户数量 */
  inheritedUserCount: number;
  /** 该组织下被用户级覆盖的用户数 */
  overrideUserCount: number;
  /** 是否已单独配置（false = 沿用全院默认） */
  configured: boolean;
}

/** 用户级数据权限覆盖 */
export interface UserOverride {
  id: string;
  userId: string;
  userName: string;
  employeeId: string;
  department: string;
  roles: UserRole[];
  /** 组织默认范围（对照参考） */
  orgDefault: { agentScope: AgentScope; customAgents?: string[]; dataClassifications: DataClassification[] };
  /** 覆盖后的范围 */
  userScope: { agentScope: AgentScope; customAgents?: string[]; dataClassifications: DataClassification[] };
  reason: string;
  /** 随组织变动失效 / 截止日期到期失效 / 长期有效 */
  expiryStrategy: 'onOrgChange' | 'byDate' | 'permanent';
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** 员工同步日志条目 */
export interface SyncLogEntry {
  id: string;
  syncAt: string;
  result: SyncStatus;
  added: number;
  updated: number;
  disabled: number;
  message: string;
}

export interface RolePermission {
  role: UserRole;
  modules: {
    [module: string]: {
      view: boolean;
      create: boolean;
      update: boolean;
      delete: boolean;
      approve: boolean;
    };
  };
}

export interface LoginForm {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}
