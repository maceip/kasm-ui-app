// ============================================================
// Theme Provider - Applies CSS custom properties from theme
// Golden Layout theming approach via Cinnamon CSS variables
// ============================================================

import { useEffect, createContext, useContext } from 'react';
import { useDesktopStore } from '../core/store';
import { themes } from './themes';
import type { Theme } from '../core/types';

const ThemeContext = createContext<Theme>(themes.dark);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeId = useDesktopStore(s => s.activeThemeId);
  const theme = themes[themeId] ?? themes.dark;

  useEffect(() => {
    const root = document.documentElement;
    const { colors } = theme;

    // Apply all theme colors as CSS custom properties
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--kasm-${camelToKebab(key)}`, value);
    }
    root.style.setProperty('--kasm-border-radius', theme.borderRadius);
    root.style.setProperty('--kasm-font-family', theme.fontFamily);
    root.style.setProperty('--kasm-font-size', theme.fontSize);

    // Set color-scheme for native elements
    root.style.colorScheme = theme.isDark ? 'dark' : 'light';
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
