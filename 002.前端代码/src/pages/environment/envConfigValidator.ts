/**
 * 环境配置 必填校验与变更范围工具
 * 对应需求文档：环境配置-需求说明文档V1.2 §1 §2
 *
 * 用途：抽取沙盒 / 正式环境页共用的必填校验与 diff 计算逻辑，避免两页重复。
 *
 * V1.2 变更：
 * - 删除 runtime 分组（运行环境字段已下线）
 * - permission 改为 PermissionItem[]，至少 1 条且每条 5 字段必填
 * - 校验 hospitalSystem 不可重复
 */
import type { PermissionItem, SandboxEnvConfig, ProdEnvConfig } from '../../mock/environment';

export type EnvConfig = SandboxEnvConfig | ProdEnvConfig;

/** 校验单条权限条目 5 字段是否全部必填，返回首个错误文案，无错误返回 null */
const validatePermissionItem = (item: PermissionItem, index: number): string | null => {
  const prefix = `第 ${index + 1} 条权限`;
  if (!item.hospitalSystem) return `${prefix}：请选择医院业务系统`;
  if (!item.dataScope) return `${prefix}：请选择数据授权范围`;
  if (!item.opPermission) return `${prefix}：请选择操作权限类型`;
  if (!item.permissionUrl) return `${prefix}：请填写权限接口地址`;
  if (!item.permissionAuth) return `${prefix}：请选择权限认证方式`;
  return null;
};

/** 必填校验，返回首个错误文案，无错误返回 null */
export const validateEnvRequired = (draft: EnvConfig): string | null => {
  if (!draft.install.dockerVersion) return '请填写 Docker 版本';
  if (!draft.install.dockerComposeVersion) return '请填写 Docker Compose 版本';
  if (!draft.resource.cpu || draft.resource.cpu < 4) return 'CPU 必须 ≥ 4 Core';
  if (!draft.resource.ram || draft.resource.ram < 16) return 'RAM 必须 ≥ 16 GB';
  if (!draft.resource.disk || draft.resource.disk < 50) return 'Disk 必须 ≥ 50 GB';
  if (!draft.network.ipAddress) return '请填写网络地址';
  if (!draft.network.ports || draft.network.ports.length === 0) return '请至少添加一个端口';
  if (!draft.network.loginAuth) return '请选择登录认证方式';
  if (!draft.permission || draft.permission.length < 1) return '请至少添加一条业务系统权限';
  for (let i = 0; i < draft.permission.length; i += 1) {
    const err = validatePermissionItem(draft.permission[i], i);
    if (err) return err;
  }
  // hospitalSystem 不可重复（非空值互斥）
  const seen = new Set<string>();
  for (const it of draft.permission) {
    const sys = it.hospitalSystem?.trim();
    if (!sys) continue;
    if (seen.has(sys)) return `医院业务系统「${sys}」重复，请修改`;
    seen.add(sys);
  }
  return null;
};

/** 关键分组（涉及资源/网络/权限）—— 文档 §1 §2 明确：保存时仅当改动这些分组才二次确认/必填变更原因 */
export type CriticalGroupKey = 'resource' | 'network' | 'permission';

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
};

/** 检测 config -> draft 之间改动的关键分组，返回改动的 key 列表 */
export const diffCriticalGroups = (
  config: EnvConfig,
  draft: EnvConfig,
): CriticalGroupKey[] => {
  const changed: CriticalGroupKey[] = [];
  if (JSON.stringify(config.resource) !== JSON.stringify(draft.resource)) {
    changed.push('resource');
  }
  if (
    config.network.ipAddress !== draft.network.ipAddress ||
    !arraysEqual(config.network.ports, draft.network.ports) ||
    config.network.loginAuth !== draft.network.loginAuth
  ) {
    changed.push('network');
  }
  if (JSON.stringify(config.permission) !== JSON.stringify(draft.permission)) {
    changed.push('permission');
  }
  return changed;
};

/** 关键分组的中文标签 */
export const criticalGroupLabel: Record<CriticalGroupKey, string> = {
  resource: '运行资源配置',
  network: '网络资源配置',
  permission: '权限配置',
};
