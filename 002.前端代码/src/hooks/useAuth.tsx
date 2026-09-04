import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../types/user';
import { mockUsers } from '../mock/users';
import { authApi } from '../services/auth';

interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  loginBySms: (phone: string, verificationCode: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole, userName?: string) => void;
  hasPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('auth_user');
    try { return cached ? JSON.parse(cached) as User : null; } catch { return null; }
  });

  const isAuthenticated = currentUser !== null;

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const result = await authApi.passwordLogin(username, password);
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('auth_user', JSON.stringify(result.user));
    setCurrentUser(result.user);
    return true;
  }, []);

  const loginBySms = useCallback(async (phone: string, verificationCode: string): Promise<boolean> => {
    const result = await authApi.smsLogin(phone, verificationCode);
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('auth_user', JSON.stringify(result.user));
    setCurrentUser(result.user);
    return true;
  }, []);

  const logout = useCallback(() => {
    void authApi.logout().catch(() => undefined);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('auth_token')) return;
    void authApi.me().then((user) => {
      setCurrentUser(user);
      localStorage.setItem('auth_user', JSON.stringify(user));
    }).catch(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setCurrentUser(null);
    });
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
      const codes = currentUser.permissionCodes ?? [];
      const candidates = [
        `${module}:${action}`,
        module,
      ];
      return candidates.some((prefix) =>
        codes.some((code) => code === prefix || code.startsWith(`${prefix}:`)),
      );
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        loginBySms,
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
