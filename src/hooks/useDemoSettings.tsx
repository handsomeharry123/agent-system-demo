import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { masterMenu, type ModuleKey } from '../config/masterMenu';
import { useAuth } from './useAuth';
import type { UserRole } from '../types/user';

/**
 * Demo 演示设置
 *
 * - 持久化到 localStorage（key = `demo_settings_v1`）
 * - 演示角色与 useAuth 解耦：选择后调用 useAuth.switchRole() 切换 currentUser
 * - 演示模块显隐作为侧边栏渲染的最终过滤条件
 *
 * 默认显隐遵循 V1.0 文档 + 最新调整：
 *   - 工作台 关闭
 *   - 多智能体编排协同中心 关闭
 *   - 统一安全治理中心 关闭
 *   - 其余 8 个一级模块 开启
 */

const STORAGE_KEY = 'demo_settings_v1';

export type DemoRole = '信息科管理员' | '科室管理员' | '医院领导';

interface DemoSettings {
  demoRole: DemoRole;
  /** 按角色模拟新用户身份，用于演示首次使用场景 */
  newUserRoles: Record<DemoRole, boolean>;
  visibleModules: Record<string, boolean>;
  visibleSubPages: Record<string, boolean>;
}

const computeDefaults = (): DemoSettings => {
  const visibleModules: Record<string, boolean> = {};
  const visibleSubPages: Record<string, boolean> = {};
  masterMenu.forEach((m) => {
    visibleModules[m.key] = m.defaultVisible;
    m.children?.forEach((sub) => {
      visibleSubPages[sub.key] = sub.defaultVisible;
    });
  });
  return {
    demoRole: '信息科管理员',
    newUserRoles: {
      '信息科管理员': false,
      '科室管理员': false,
      '医院领导': false,
    },
    visibleModules,
    visibleSubPages,
  };
};

/**
 * 合并"用户偏好"与"默认值"，但**所有未在用户偏好中出现的 key 也会被显式写为默认值**。
 * 目的：避免「全不选」后再读取时，被 `{ ...defaults, ...parsed }` 合并回去出现"刚取消的勾选又回来"的分叉。
 */
const mergeWithDefaults = (parsed: Partial<DemoSettings> | null | undefined): DemoSettings => {
  const defaults = computeDefaults();
  if (!parsed) return defaults;
  return {
    demoRole:
      parsed.demoRole === '信息科管理员' ||
      parsed.demoRole === '科室管理员' ||
      parsed.demoRole === '医院领导'
        ? parsed.demoRole
        : '信息科管理员',
    newUserRoles: {
      ...defaults.newUserRoles,
      ...(parsed.newUserRoles || {}),
    },
    // 偏好中显式 false 也保留 false（不会因「key 不存在 = 默认 true」而漏写）
    visibleModules: { ...defaults.visibleModules, ...(parsed.visibleModules || {}) },
    visibleSubPages: { ...defaults.visibleSubPages, ...(parsed.visibleSubPages || {}) },
  };
};

const loadFromStorage = (): DemoSettings => {
  if (typeof window === 'undefined') return computeDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return computeDefaults();
    const parsed = JSON.parse(raw) as Partial<DemoSettings>;
    return mergeWithDefaults(parsed);
  } catch {
    return computeDefaults();
  }
};

const saveToStorage = (settings: DemoSettings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 静默失败
  }
};

interface DemoSettingsContextValue extends DemoSettings {
  setDemoRole: (role: DemoRole) => void;
  setRoleNewUser: (role: DemoRole, enabled: boolean) => void;
  setModuleVisible: (moduleKey: ModuleKey | string, visible: boolean) => void;
  setSubPageVisible: (subKey: string, visible: boolean) => void;
  /** 一键全选 / 全不选；同时影响一级模块 + 二级子页面 */
  setAllVisible: (visible: boolean) => void;
  /** 仅设置一级模块显隐（不动子页面） */
  setAllModulesVisible: (visible: boolean) => void;
  /** 仅设置二级子页面显隐（不动一级模块） */
  setAllSubPagesVisible: (visible: boolean) => void;
  resetToDefaults: () => void;
}

const DemoSettingsContext = createContext<DemoSettingsContextValue | null>(null);

export const DemoSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<DemoSettings>(() => loadFromStorage());
  const { currentUser, switchRole } = useAuth();

  // 启动时如果 localStorage 里的角色与 currentUser 不一致，校正 currentUser
  useEffect(() => {
    if (currentUser && !currentUser.roles.includes(settings.demoRole as UserRole)) {
      switchRole(settings.demoRole as UserRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 任意变更即写回 localStorage
  useEffect(() => {
    saveToStorage(settings);
  }, [settings]);

  const setDemoRole = useCallback(
    (role: DemoRole) => {
      setSettings((prev) => ({ ...prev, demoRole: role }));
      switchRole(role as UserRole);
    },
    [switchRole],
  );

  const setRoleNewUser = useCallback((role: DemoRole, enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      newUserRoles: { ...prev.newUserRoles, [role]: enabled },
    }));
  }, []);

  const setModuleVisible = useCallback((moduleKey: ModuleKey | string, visible: boolean) => {
    setSettings((prev) => ({
      ...prev,
      visibleModules: { ...prev.visibleModules, [moduleKey]: visible },
    }));
  }, []);

  const setSubPageVisible = useCallback((subKey: string, visible: boolean) => {
    setSettings((prev) => ({
      ...prev,
      visibleSubPages: { ...prev.visibleSubPages, [subKey]: visible },
    }));
  }, []);

  const setAllVisible = useCallback((visible: boolean) => {
    setSettings((prev) => {
      // 全选 / 全不选 时**显式写入**每个 key 的 true/false，
      // 避免「全不选」后被「未设置 = 默认 true」合并回去，导致演示树与侧边栏分叉
      const nextVisibleModules: Record<string, boolean> = {};
      const nextVisibleSubPages: Record<string, boolean> = {};
      masterMenu.forEach((m) => {
        nextVisibleModules[m.key] = visible;
        m.children?.forEach((sub) => {
          nextVisibleSubPages[sub.key] = visible;
        });
      });
      return {
        ...prev,
        visibleModules: nextVisibleModules,
        visibleSubPages: nextVisibleSubPages,
      };
    });
  }, []);

  const setAllModulesVisible = useCallback((visible: boolean) => {
    setSettings((prev) => {
      const next: Record<string, boolean> = { ...prev.visibleModules };
      masterMenu.forEach((m) => {
        next[m.key] = visible;
      });
      return { ...prev, visibleModules: next };
    });
  }, []);

  const setAllSubPagesVisible = useCallback((visible: boolean) => {
    setSettings((prev) => {
      const next: Record<string, boolean> = { ...prev.visibleSubPages };
      masterMenu.forEach((m) => {
        m.children?.forEach((sub) => {
          next[sub.key] = visible;
        });
      });
      return { ...prev, visibleSubPages: next };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(computeDefaults());
  }, []);

  return (
    <DemoSettingsContext.Provider
      value={{
        ...settings,
        setDemoRole,
        setRoleNewUser,
        setModuleVisible,
        setSubPageVisible,
        setAllVisible,
        setAllModulesVisible,
        setAllSubPagesVisible,
        resetToDefaults,
      }}
    >
      {children}
    </DemoSettingsContext.Provider>
  );
};

export const useDemoSettings = (): DemoSettingsContextValue => {
  const ctx = useContext(DemoSettingsContext);
  if (!ctx) {
    throw new Error('useDemoSettings must be used within a DemoSettingsProvider');
  }
  return ctx;
};
