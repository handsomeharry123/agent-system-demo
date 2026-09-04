import {
  HomeOutlined,
  BulbOutlined,
  RobotOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ApartmentOutlined,
  DashboardOutlined,
  SafetyCertificateOutlined,
  FundOutlined,
  UserOutlined,
  AuditOutlined,
  SettingOutlined,
  DeploymentUnitOutlined,
  MedicineBoxOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { mvpFeatures, mvpModuleKeys, mvpSubPageKeys } from './mvpFeatures';

/**
 * 一级模块的单一配置源
 * 供 BasicLayout（侧边栏渲染）与 DemoFloatButton（模块显隐树）共同消费
 *
 * 字段：
 *   key       - 模块唯一标识（同时作为 localStorage 持久化的 key）
 *   name      - 显示名
 *   path      - 模块入口路径（一级菜单点击后跳转的地址）
 *   icon      - 侧边栏图标
 *   defaultVisible - V1.0 文档规定的默认显隐
 *   defaultRoleVisible - 默认哪些角色可见（'itAdmin' | 'itUser' | 'both'）
 *   children  - 二级子页面列表
 */

export type ModuleKey =
  | 'home'
  | 'assistant'
  | 'workbench'
  | 'agent-needs'
  | 'project-application'
  | 'agent-center'
  | 'ledger'
  | 'resource-center'
  | 'evaluation'
  | 'orchestration'
  | 'monitoring'
  | 'security'
  | 'data-asset'
  | 'environment'
  | 'user-center'
  | 'audit'
  | 'system-config';

export interface SubPage {
  key: string;
  name: string;
  path: string;
  defaultVisible: boolean;
  /** 二级子页面的角色基线：未设置 = 跟随父模块 */
  defaultRoleVisible?: 'itAdmin' | 'itUser' | 'both';
}

export interface MasterModule {
  key: ModuleKey;
  name: string;
  path: string;
  icon: ReactNode;
  defaultVisible: boolean;
  defaultRoleVisible: 'itAdmin' | 'itUser' | 'both';
  children?: SubPage[];
}

export const masterMenu: MasterModule[] = [
  {
    key: 'home',
    name: '首页',
    path: '/app/home/dashboard',
    icon: <DashboardOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
  },
  {
    key: 'assistant',
    name: '医小管',
    path: '/app/home/overview',
    icon: <RobotOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
  },
  {
    key: 'workbench',
    name: '工作台',
    path: '/app/home/workbench',
    icon: <HomeOutlined />,
    // 默认演示不展示工作台（用户可在右下角"演示操作"中按需开启）
    defaultVisible: false,
    defaultRoleVisible: 'both',
  },
  // 智能体建设需求管理（V1.0）：业务方手动录入标准化建设需求 + 与已纳管智能体智能化匹配 TOP3
  //   - 位于「首页」与「智能体接入中心」之间；仅一级入口、无二级菜单
  //   - 面向院内所有已认证用户（信息科 IT 管理员 / 科室管理员 / 普通业务用户）
  {
    key: 'agent-needs',
    name: '智能体建设需求管理',
    path: '/app/agent-needs',
    icon: <BulbOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
  },
  {
    key: 'project-application',
    name: '立项申报管理中心',
    path: '/app/project-application',
    icon: <ProjectOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
  },
  {
    key: 'agent-center',
    name: '智能体接入中心',
    path: '/app/agent-center',
    icon: <RobotOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
    // 一级入口直接进入注册管理页面；新建注册是页内路由，不进入侧边栏菜单树。
    // 不保留隐藏 children，避免旧版 localStorage 显隐配置将其重新显示为二级菜单。
  },
  {
    key: 'ledger',
    name: '统一台账中心',
    path: '/app/ledger',
    icon: <DatabaseOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
    children: [
      { key: 'ledger:overview', name: '台账总览', path: '/app/ledger', defaultVisible: true },
      { key: 'ledger:list', name: '台账列表', path: '/app/ledger/list', defaultVisible: true },
      // V1.5 已下线「权限治理」二级入口；权限治理统一收敛至「统一安全治理中心」承载
    ],
  },
  // 医院资源管理中心（V1.0）：统一管理院内业务系统资源注册、对接方式与权限申请审批
  {
    key: 'resource-center',
    name: '医院资源管理中心',
    path: '/app/resource-center',
    icon: <MedicineBoxOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
    children: [
      // 资源管理（注册/编辑/删除入口）：仅信息科管理员可见，科室管理员看不到此菜单
      { key: 'resource-center:resources', name: '资源管理', path: '/app/resource-center/resources', defaultVisible: true, defaultRoleVisible: 'itAdmin' },
      // V1.1.1:「注册资源草稿」收敛为「资源管理」下的第二个 Tab,不再单独占位
      { key: 'resource-center:applies', name: '申请管理', path: '/app/resource-center/applies', defaultVisible: true },
    ],
  },
  {
    key: 'evaluation',
    name: '统一准入评测沙盒',
    path: '/app/evaluation',
    icon: <ExperimentOutlined />,
    defaultVisible: true,
    // V1.7：模块一级对两类角色均可见；但仅「评测任务管理」对科室管理员开放，
    // 「指标展示」「数据集管理」仍为信息科管理员专属（通过子页 defaultRoleVisible 收敛）
    defaultRoleVisible: 'both',
    children: [
      // V1.6：默认进入「任务管理」页；指标展示（只读）、数据集管理均为同级子页面
      { key: 'evaluation:tasks', name: '评测任务管理', path: '/app/evaluation/tasks', defaultVisible: true, defaultRoleVisible: 'both' },
      { key: 'evaluation:indicators', name: '指标列表', path: '/app/evaluation/indicators', defaultVisible: true, defaultRoleVisible: 'itAdmin' },
      { key: 'evaluation:datasets', name: '数据集管理', path: '/app/evaluation/datasets', defaultVisible: true, defaultRoleVisible: 'itAdmin' },
    ],
  },
  {
    key: 'orchestration',
    name: '多智能体编排协同中心',
    path: '/app/orchestration',
    icon: <ApartmentOutlined />,
    defaultVisible: false, // V1.0 默认关闭
    defaultRoleVisible: 'itAdmin', // 高危：仅信息科管理员
    children: [
      { key: 'orchestration:home', name: '编排中心首页', path: '/app/orchestration', defaultVisible: true },
      { key: 'orchestration:scenes', name: '场景配置', path: '/app/orchestration/scenes', defaultVisible: true },
      { key: 'orchestration:flows', name: '流程列表', path: '/app/orchestration/flows', defaultVisible: true },
    ],
  },
  {
    key: 'monitoring',
    name: '统一运行监控中心',
    path: '/app/monitoring',
    icon: <DashboardOutlined />,
    defaultVisible: true,
    // V1.10：本模块 IT 管理员 + 科室管理员均可见
    defaultRoleVisible: 'both',
    children: [
      { key: 'monitoring:overview', name: '监控告警总览', path: '/app/monitoring', defaultVisible: true, defaultRoleVisible: 'both' },
      { key: 'monitoring:business', name: '业务监控', path: '/app/monitoring/business', defaultVisible: true, defaultRoleVisible: 'both' },
      { key: 'monitoring:status', name: '状态监控', path: '/app/monitoring/status', defaultVisible: true, defaultRoleVisible: 'both' },
      { key: 'monitoring:cost', name: '成本监控', path: '/app/monitoring/cost', defaultVisible: true, defaultRoleVisible: 'both' },
      { key: 'monitoring:security', name: '安全监控', path: '/app/monitoring/security', defaultVisible: true, defaultRoleVisible: 'itAdmin' },
      // 6. 告警规则管理（仅信息科管理员；科室管理员不可见）
      { key: 'monitoring:alert-rules', name: '告警规则管理', path: '/app/monitoring/alert-rules', defaultVisible: true, defaultRoleVisible: 'itAdmin' },
      // 6. 告警事件处置
      { key: 'monitoring:alert-events', name: '告警事件处置', path: '/app/monitoring/alert-events', defaultVisible: true, defaultRoleVisible: 'both' },
    ],
  },
  {
    key: 'security',
    name: '统一安全治理中心',
    path: '/app/security',
    icon: <SafetyCertificateOutlined />,
    // 默认演示不展示治理中心（用户可在右下角"演示操作"中按需开启）
    defaultVisible: false,
    defaultRoleVisible: 'itAdmin', // 高危：仅信息科管理员
    children: [
      { key: 'security:overview', name: '安全治理总览', path: '/app/security', defaultVisible: true },
      { key: 'security:events', name: '告警事件处置', path: '/app/security/events', defaultVisible: true },
      { key: 'security:rules', name: '治理规则管理', path: '/app/security/rules', defaultVisible: true },
    ],
  },
  {
    key: 'data-asset',
    name: '医疗数据资产中心',
    path: '/app/data-asset',
    icon: <FundOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'itAdmin', // 高危：仅信息科管理员
    children: [
      { key: 'data-asset:datasets', name: '数据集资产列表', path: '/app/data-asset/datasets', defaultVisible: true },
      { key: 'data-asset:collection', name: '采集任务列表', path: '/app/data-asset/collection-tasks', defaultVisible: true },
    ],
  },
  {
    key: 'user-center',
    name: '用户中心',
    path: '/app/user-center',
    icon: <UserOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'itAdmin', // 高危：仅信息科管理员
    children: [
      { key: 'user-center:list', name: '用户列表', path: '/app/user-center', defaultVisible: true },
      { key: 'user-center:roles', name: '角色管理', path: '/app/user-center/roles', defaultVisible: true },
      { key: 'user-center:function', name: '功能权限配置', path: '/app/user-center/function-permission', defaultVisible: true },
    ],
  },
  {
    key: 'audit',
    name: '审计中心',
    path: '/app/audit/logs',
    icon: <AuditOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'both',
    // MVP 与「智能体接入中心」一致：一级入口直达业务页，不展示二级菜单。
    // 项目审计和智能体行为审计仅从 MVP 导航隐藏，页面代码仍保留便于后续恢复。
  },
  // 环境配置（V1.1）：沙盒/正式两套运行环境的参数配置 + 环境内智能体；仅平台管理员
  {
    key: 'environment',
    name: '环境配置',
    path: '/app/environment/sandbox',  // 一级跳转到沙盒默认
    icon: <DeploymentUnitOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'itAdmin',
    children: [
      { key: 'environment:sandbox', name: '沙盒环境', path: '/app/environment/sandbox', defaultVisible: true },
      { key: 'environment:production', name: '正式环境', path: '/app/environment/production', defaultVisible: true },
    ],
  },
  // 系统配置（V1.0）：必须置于系统菜单末尾，仅信息科管理员可见
  {
    key: 'system-config',
    name: '系统配置',
    path: '/app/system-config/dictionaries',
    icon: <SettingOutlined />,
    defaultVisible: true,
    defaultRoleVisible: 'itAdmin',
    children: [
      { key: 'system-config:dictionaries', name: '数据字典', path: '/app/system-config/dictionaries', defaultVisible: true },
      { key: 'system-config:models', name: '模型配置', path: '/app/system-config/models', defaultVisible: true },
      { key: 'system-config:evaluation-platforms', name: '第三方评测平台接入', path: '/app/system-config/evaluation-platforms', defaultVisible: true, defaultRoleVisible: 'itAdmin' },
    ],
  },
];

/** 根据角色 + 显隐集合计算最终菜单（含子项） */
export interface ResolvedSubPage {
  key: string;
  name: string;
  path: string;
}

export interface ResolvedModule {
  key: string;
  name: string;
  path: string;
  icon: ReactNode;
  children?: ResolvedSubPage[];
}

export type MenuRoleKey = 'itAdmin' | 'itUser' | 'hospitalLeader';

/**
 * 菜单 key 与功能权限中心 permission_code 的映射。
 * 两套 key 的命名早于彼此存在，不能直接用菜单 key 做前缀判断。
 */
const MODULE_PERMISSION_KEYS: Record<ModuleKey, string> = {
  home: 'home',
  assistant: 'assistant',
  workbench: 'workbench',
  'agent-needs': 'needs',
  'project-application': 'project',
  'agent-center': 'access',
  ledger: 'ledger',
  'resource-center': 'resource',
  evaluation: 'evaluation',
  orchestration: 'orchestration',
  monitoring: 'monitor',
  security: 'security',
  'data-asset': 'data-asset',
  environment: 'environment',
  'user-center': 'user',
  audit: 'audit',
  'system-config': 'system',
};

const SUB_PAGE_PERMISSION_KEYS: Record<string, string> = {
  'evaluation:tasks': 'evaluation:task',
  'evaluation:indicators': 'evaluation:index',
  'evaluation:datasets': 'evaluation:data',
  'monitoring:overview': 'monitor:overview',
  'monitoring:business': 'monitor:business',
  'monitoring:status': 'monitor:status',
  'monitoring:cost': 'monitor:cost',
  'monitoring:security': 'monitor:security',
  'monitoring:alert-rules': 'monitor:rules',
  'monitoring:alert-events': 'monitor:event',
  'user-center:list': 'user:list',
  'user-center:roles': 'user:role',
  'user-center:function': 'user:function',
  'audit:project': 'audit:project',
  'audit:behavior': 'audit:agent',
  'audit:logs': 'audit:log',
  'system-config:dictionaries': 'system:dict',
  'system-config:models': 'system:model',
  'system-config:evaluation-platforms': 'system:evaluation-platform',
};

const hasPermissionPrefix = (permissionCodes: string[], prefix: string): boolean =>
  permissionCodes.some((code) => code === prefix || code.startsWith(`${prefix}:`));

/** 功能权限配置是菜单展示的最终依据。 */
export const hasMenuModulePermission = (
  permissionCodes: string[] | undefined,
  moduleKey: ModuleKey,
): boolean => permissionCodes !== undefined && hasPermissionPrefix(
  permissionCodes,
  moduleKey === 'audit' && !mvpFeatures.auditProject ? 'audit:log' : MODULE_PERMISSION_KEYS[moduleKey],
);

/** 二级入口至少需要拥有该页面本身或其任一操作权限。 */
export const hasMenuSubPagePermission = (
  permissionCodes: string[] | undefined,
  subPageKey: string,
): boolean => permissionCodes !== undefined && hasPermissionPrefix(
  permissionCodes,
  SUB_PAGE_PERMISSION_KEYS[subPageKey] ?? subPageKey,
);

const HOSPITAL_LEADER_MODULES = new Set<ModuleKey>([
  'home',
  'assistant',
  'ledger',
  'monitoring',
]);

const HOSPITAL_LEADER_SUB_PAGES = new Set([
  'ledger:overview',
  'ledger:list',
  'monitoring:overview',
  'monitoring:business',
  'monitoring:status',
  'monitoring:cost',
]);

/** 医院领导仅拥有需求指定页面的查看入口。 */
export const isHospitalLeaderModule = (moduleKey: ModuleKey): boolean =>
  HOSPITAL_LEADER_MODULES.has(moduleKey);

/** 医院领导仅拥有需求指定二级页面的查看入口。 */
export const isHospitalLeaderSubPage = (subPageKey: string): boolean =>
  HOSPITAL_LEADER_SUB_PAGES.has(subPageKey);

/**
 * 判断单个模块在「当前角色 + 用户显隐集合」下是否最终可见。
 * BasicLayout（侧边栏）与 DemoFloatButton（演示树）必须共用同一份判定，
 * 否则会出现"演示面板勾选 ↔ 侧边栏"两侧状态不对齐的问题。
 */
export const isModuleVisible = (
  module: MasterModule,
  visibleModules: Record<string, boolean>,
  demoRole: MenuRoleKey,
): boolean => {
  if (!mvpModuleKeys.has(module.key)) return false;
  // MVP 暂不提供医小管；忽略历史 localStorage 中可能残留的“显示”偏好。
  if (module.key === 'assistant' && !mvpFeatures.medicalAssistant) return false;
  if (demoRole === 'hospitalLeader' && !isHospitalLeaderModule(module.key)) return false;
  // 角色基线：管理员专属模块对普通用户永远不可见
  if (module.defaultRoleVisible === 'itAdmin' && demoRole === 'itUser') return false;
  // 用户显隐偏好：未设置 = 视为默认（避免「全不选」后被默认值合并回 true）
  const pref = visibleModules[module.key];
  if (pref === false) return false;
  return true;
};

/** 同上，针对二级子页面 */
export const isSubPageVisible = (
  module: MasterModule,
  sub: SubPage,
  visibleModules: Record<string, boolean>,
  visibleSubPages: Record<string, boolean>,
  demoRole: MenuRoleKey,
): boolean => {
  if (!mvpSubPageKeys.has(sub.key)) return false;
  // 【关键】父模块不可见时，子页面一律不可见
  // 否则会出现"父未勾 + 子仍在 checkedKeys"→ antd Tree 联动模式下父又被标为已勾
  if (!isModuleVisible(module, visibleModules, demoRole)) return false;
  if (demoRole === 'hospitalLeader' && !isHospitalLeaderSubPage(sub.key)) return false;
  // 子页面级角色基线：未设置 = 跟随父模块
  const subRole = sub.defaultRoleVisible || module.defaultRoleVisible;
  if (subRole === 'itAdmin' && demoRole === 'itUser') return false;
  const pref = visibleSubPages[sub.key];
  if (pref === false) return false;
  return true;
};

export const resolveMenu = (
  visibleModules: Record<string, boolean>,
  visibleSubPages: Record<string, boolean>,
  demoRole: MenuRoleKey,
): ResolvedModule[] => {
  return masterMenu
    .filter((m) => isModuleVisible(m, visibleModules, demoRole))
    .map((m) => {
      const children = m.children
        ?.filter((sub) => isSubPageVisible(m, sub, visibleModules, visibleSubPages, demoRole))
        .map((sub) => ({ key: sub.key, name: sub.name, path: sub.path }));
      return {
        key: m.key,
        name: m.name,
        path: m.path,
        icon: m.icon,
        children: children && children.length > 0 ? children : undefined,
      };
    });
};
