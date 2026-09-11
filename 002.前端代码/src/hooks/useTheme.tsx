import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ThemeKey } from '../theme/themeConfig';

interface ThemeContextValue {
  /** 当前主题风格：simple（简约风，默认）/ tech（科技风） */
  themeKey: ThemeKey;
  setThemeKey: (key: ThemeKey) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'app_theme_key_v1';

const readInitialTheme = (): ThemeKey => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tech' || saved === 'simple') return saved;
  } catch {
    /* ignore */
  }
  return 'simple';
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>(readInitialTheme);

  const setThemeKey = useCallback((key: ThemeKey) => {
    setThemeKeyState(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeKeyState((prev) => {
      const next: ThemeKey = prev === 'tech' ? 'simple' : 'tech';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
