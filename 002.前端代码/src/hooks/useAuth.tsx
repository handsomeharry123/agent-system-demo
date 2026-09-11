import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, UserRole } from '../types/user';
import { mockUsers } from '../mock/users';

interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole, userName?: string) => void;
  hasPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultAdmin =
  mockUsers.find((u) => u.roles.includes('信息科管理员')) || mockUsers[0];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(defaultAdmin);

  const isAuthenticated = currentUser !== null;

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const user = mockUsers.find(
      (u) => (u.name === username || u.employeeId === username) && u.password === password
    );

    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const switchRole = useCallback((role: UserRole, userName?: string) => {
    // 优先按 userName + role 联合匹配；不传 userName 时按原 find 行为
    const user = userName
      ? mockUsers.find((u) => u.name === userName && u.roles.includes(role))
      : mockUsers.find((u) => u.roles.includes(role));
    if (user) {
      setCurrentUser({ ...user, roles: [role] });
    } else if (!userName) {
      // 找不到对应的种子用户时，至少保证 roles 包含切换目标
      setCurrentUser((prev) => (prev ? { ...prev, roles: [role] } : prev));
    }
    // 显式传 userName 但 mock 中找不到 → 不动 currentUser（避免脱节）
  }, []);

  const hasPermission = useCallback(
    (module: string, action: string): boolean => {
      if (!currentUser) return false;

      const roles = currentUser.roles;

      const permissions: Record<UserRole, Record<string, string[]>> = {
        医院领导: {
          home: ['view'],
          assistant: ['view'],
          ledger: ['view'],
          monitoring: ['view'],
        },
        信息科管理员: {
          '*': ['*'],
        },
        // 科室管理员：仅本科室记录 + 发起注册
        科室管理员: {
          agentCenter: ['view', 'create'],
          ledger: ['view'],
          monitoring: ['view'],
          audit: ['view'],
        },
      };

      // 多角色：任一角色命中即放行
      for (const role of roles) {
        const rolePerms = permissions[role];
        if (rolePerms['*'] && rolePerms['*'].includes('*')) {
          return true;
        }
        const modulePerms = rolePerms[module];
        if (modulePerms && modulePerms.includes(action)) {
          return true;
        }
      }
      return false;
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        logout,
        switchRole,
        hasPermission,
      }}
    >
      {children}
      {import.meta.env.DEV && (() => {
        // 验证脚本使用：暴露 switchRole 到 window,verify 可主动调
        if (typeof window !== 'undefined') {
          (window as any).__useAuthSetRole = switchRole;
        }
        return null;
      })()}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
