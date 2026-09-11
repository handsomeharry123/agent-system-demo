import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/user';

const hasPermissionInModule = (
  permissionCodes: string[] | undefined,
  moduleKey: string,
  roles: UserRole[] = [],
): boolean =>
  permissionCodes?.some((code) => code === moduleKey || code.startsWith(`${moduleKey}:`)) === true;

/** 模块无任何功能权限时禁止渲染其页面，避免页面接口产生连续 403 提示。 */
const FunctionalPermissionRoute = ({ moduleKey }: { moduleKey: string }) => {
  const { currentUser } = useAuth();
  const permissionCodes = currentUser?.permissionCodes;

  // 兼容升级前缓存的登录信息：等待 /auth/me 刷新实际权限后再判断。
  if (!permissionCodes) return null;

  return hasPermissionInModule(permissionCodes, moduleKey, currentUser?.roles)
    ? <Outlet />
    : <Navigate to="/app/home/dashboard" replace />;
};

export { hasPermissionInModule };
export default FunctionalPermissionRoute;
