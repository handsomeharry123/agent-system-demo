import type { UserRole, DataClassification, SyncStatus } from '../../types/user';

/** 角色 → Tag 颜色（用户中心 4 个页面共享） */
export const roleColorMap: Record<UserRole, string> = {
  '医院领导': 'gold',
  '信息科管理员': 'red',
  '科室管理员': 'green',
};

/** 数据分级 → Tag 颜色 */
export const dataClassificationColorMap: Record<DataClassification, string> = {
  '一般': 'default',
  '重要': 'blue',
  '核心': 'orange',
  '敏感': 'red',
};

/** 同步结果 → Alert/Tag 类型 */
export const syncStatusColorMap: Record<SyncStatus, string> = {
  success: 'success',
  partial: 'warning',
  failed: 'error',
};

export const syncStatusLabelMap: Record<SyncStatus, string> = {
  success: '成功',
  partial: '部分失败',
  failed: '失败',
};

/** 系统默认角色（信息科管理员 + 科室管理员） */
export const systemRoles: UserRole[] = ['医院领导', '信息科管理员', '科室管理员'];

/** 数据分级全部可选值（按 V1.1 文档） */
export const allDataClassifications: DataClassification[] = ['一般', '重要', '核心', '敏感'];

/** 角色多选下拉选项 */
export const roleOptions = (roles: UserRole[]) => roles.map((r) => ({ label: r, value: r }));
