// ============================================================
// Theme Provider - Applies CSS custom properties from theme
// Golden Layout theming approach via Cinnamon CSS variables
// ============================================================

import { createEffect, createContext, useContext, type JSX } from 'solid-js';
import { desktop } from '../core/store';
import { themes } from './themes';
import type { Theme } from '../core/types';

const ThemeContext = createContext<() => Theme>(() => themes.dark);

export function useTheme(): Theme {
  return useContext(ThemeContext)();
}

export function ThemeProvider(props: { children: JSX.Element }) {
  const theme = () => themes[desktop.activeThemeId] ?? themes.dark;

  createEffect(() => {
    const t = theme();
    const root = document.documentElement;

    for (const [key, value] of Object.entries(t.colors)) {
      root.style.setProperty(`--kasm-${camelToKebab(key)}`, value);
    }
    root.style.setProperty('--kasm-border-radius', t.borderRadius);
    root.style.setProperty('--kasm-font-family', t.fontFamily);
    root.style.setProperty('--kasm-font-size', t.fontSize);
    root.style.colorScheme = t.isDark ? 'dark' : 'light';
  });

  return (
    <ThemeContext.Provider value={theme}>
      {props.children}
    </ThemeContext.Provider>
  );
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
