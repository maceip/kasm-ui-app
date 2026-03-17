// ============================================================
// Shell Slice - UI chrome: panel, theme, app menu, expo, etc.
// ============================================================

import type { StateCreator } from 'zustand';
import type { PanelConfig, WindowState } from '../types';
import { PANEL_HEIGHT_DEFAULT } from '../types';

export type HotCornerAction = 'expo' | 'scale' | 'show-desktop' | 'none';

export interface HotCornerActions {
  topLeft: HotCornerAction;
  topRight: HotCornerAction;
  bottomLeft: HotCornerAction;
  bottomRight: HotCornerAction;
}

const defaultPanel: PanelConfig = {
  position: 'bottom',
  height: PANEL_HEIGHT_DEFAULT,
  autohide: 'never',
  applets: [
    { id: 'app-menu', type: 'app-menu', zone: 'left', order: 0 },
    { id: 'window-list', type: 'window-list', zone: 'center', order: 0 },
    { id: 'workspace-switcher', type: 'workspace-switcher', zone: 'right', order: 0 },
    { id: 'system-tray', type: 'system-tray', zone: 'right', order: 1 },
    { id: 'clock', type: 'clock', zone: 'right', order: 2 },
    { id: 'notifications', type: 'notifications', zone: 'right', order: 3 },
  ],
};

export interface ShellSlice {
  // State
  panelConfig: PanelConfig;
  activeThemeId: string;
  appMenuOpen: boolean;
  expoMode: 'off' | 'expo' | 'scale';
  hotCornerActions: HotCornerActions;
  agentSidebarOpen: boolean;
  _minimizedByShowDesktop: string[];

  // Actions
  setPanelConfig: (config: Partial<PanelConfig>) => void;
  setTheme: (id: string) => void;
  toggleAppMenu: () => void;
  closeAppMenu: () => void;
  setExpoMode: (mode: 'off' | 'expo' | 'scale') => void;
  setHotCornerActions: (actions: Partial<HotCornerActions>) => void;
  toggleAgentSidebar: () => void;
  showDesktop: () => void;
  restoreDesktop: () => void;
}

export const createShellSlice: StateCreator<ShellSlice & Record<string, any>, [], [], ShellSlice> = (set, get) => ({
  // === State ===
  panelConfig: defaultPanel,
  activeThemeId: 'dark',
  appMenuOpen: false,
  expoMode: 'off',
  hotCornerActions: {
    topLeft: 'expo',
    topRight: 'scale',
    bottomLeft: 'show-desktop',
    bottomRight: 'none',
  },
  agentSidebarOpen: true,
  _minimizedByShowDesktop: [],

  // === Actions ===
  setPanelConfig: (config) => {
    set((s: any) => ({
      panelConfig: { ...s.panelConfig, ...config },
    }));
  },

  setTheme: (id) => {
    set({ activeThemeId: id });
  },

  toggleAppMenu: () => set((s: any) => ({ appMenuOpen: !s.appMenuOpen })),
  closeAppMenu: () => set({ appMenuOpen: false }),

  setExpoMode: (mode) => set({ expoMode: mode }),

  setHotCornerActions: (actions) => {
    set((s: any) => ({ hotCornerActions: { ...s.hotCornerActions, ...actions } }));
  },

  toggleAgentSidebar: () => set((s: any) => ({ agentSidebarOpen: !s.agentSidebarOpen })),

  showDesktop: () => {
    const s = get() as any;
    const activeWs = s.workspaces.find((ws: any) => ws.id === s.activeWorkspaceId);
    if (!activeWs) return;
    const toMinimize = s.windows
      .filter((w: WindowState) => activeWs.windowIds.includes(w.id) && w.state !== 'minimized')
      .map((w: WindowState) => w.id);
    set((s: any) => ({
      _minimizedByShowDesktop: toMinimize,
      windows: s.windows.map((w: WindowState) =>
        toMinimize.includes(w.id) ? { ...w, state: 'minimized' as const, focused: false } : w
      ),
    }));
  },

  restoreDesktop: () => {
    const ids = (get() as any)._minimizedByShowDesktop as string[];
    if (ids.length === 0) return;
    set((s: any) => ({
      _minimizedByShowDesktop: [],
      windows: s.windows.map((w: WindowState) =>
        ids.includes(w.id) ? { ...w, state: 'normal' as const } : w
      ),
    }));
  },
});
