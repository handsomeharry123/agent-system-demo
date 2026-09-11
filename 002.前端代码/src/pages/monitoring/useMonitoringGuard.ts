/**
 * 统一运行监控中心 — 角色权限守卫（V1.8）
 *
 * PRD 规定：本模块仅 IT 管理员可见与操作；「告警规则管理」与「待分派事件」仅管理员可见。
 * 提供两个 hook：
 *   - useMonitoringGuard：通用模块守卫（非管理员 → 无权限态），同时暴露 currentUserName 用于
 *     「处理人是当前用户本人」判定（影响 操作列开始处理/处理/转派 三按钮的可见性）
 *   - useAdminOnly：管理子页守卫（规则管理 / 待分派事件，仅管理员可见）
 */
import { useAuth } from '../../hooks/useAuth';

export interface MonitoringGuard {
  /** 当前用户是否含「信息科管理员」角色 */
  isAdmin: boolean;
  /** 当前登录用户名（用于 handler === currentUserName 判定）；未登录时为 undefined */
  currentUserName?: string;
}

export const useMonitoringGuard = (): MonitoringGuard => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles?.includes('信息科管理员') ?? false;
  const currentUserName = currentUser?.name;
  return { isAdmin, currentUserName };
};

export const useAdminOnly = (): MonitoringGuard => {
  return useMonitoringGuard();
};