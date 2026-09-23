/*
 * Copyright 2024-2026 the original author or authors.
 * Licensed under the Apache License, Version 2.0.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ags-theme';

/** 首帧主题判定：防闪烁脚本已把 .dark 挂上 html，直接读取即可。 */
export function resolveInitialTheme(isDarkClass: boolean): Theme {
  return isDarkClass ? 'dark' : 'light';
}

export function toggle(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

function readInitialTheme(): Theme {
  return resolveInitialTheme(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 双主题运行时切换（A3）。
 *
 * 真正的取值开关在 index.css 第 2 层（html.dark 覆盖 :root），
 * 此处只负责：持久化（localStorage）、切换 html.dark、
 * 以及切换瞬间挂载 .theme-transitioning 过渡类（见 index.css 注释，
 * 常驻 transition 是显式反模式）。
 *
 * 防闪烁：index.html <head> 内联脚本在首帧前按 localStorage 设置
 * .dark，Provider 挂载后读取同一状态接管后续切换。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  const transitionTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 隐私模式等场景下持久化失败不阻断切换
    }
  }, [theme]);

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState((current) => {
      if (current === next) return current;
      const root = document.documentElement;
      root.classList.add('theme-transitioning');
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, 300);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme: () => setTheme(toggle(theme)), setTheme }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
