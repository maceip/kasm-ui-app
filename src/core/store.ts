// ============================================================
// Zustand Store - Central state management
// Combines window management, workspace, notifications
// ============================================================

import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  WindowState, Workspace, Notification, PanelConfig,
  AppDefinition, SnapZone, Theme,
} from './types';

export type HotCornerAction = 'expo' | 'scale' | 'show-desktop' | 'none';

export interface HotCornerActions {
  topLeft: HotCornerAction;
  topRight: HotCornerAction;
  bottomLeft: HotCornerAction;
  bottomRight: HotCornerAction;
}

interface DesktopStore {
  // Windows
  windows: WindowState[];
  nextZIndex: number;
  createWindow: (app: AppDefinition, overrides?: Partial<WindowState>) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  snapWindow: (id: string, zone: SnapZone) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  updateWindowTitle: (id: string, title: string) => void;

  // Workspaces (Cinnamon)
  workspaces: Workspace[];
  activeWorkspaceId: string;
  switchWorkspace: (id: string) => void;
  addWorkspace: () => void;
  removeWorkspace: (id: string) => void;

  // Notifications (Cinnamon)
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  dismissNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Panel
  panelConfig: PanelConfig;
  setPanelConfig: (config: Partial<PanelConfig>) => void;

  // Theme
  activeThemeId: string;
  setTheme: (id: string) => void;

  // App Menu
  appMenuOpen: boolean;
  toggleAppMenu: () => void;
  closeAppMenu: () => void;

  // Expo / Scale view
  expoMode: 'off' | 'expo' | 'scale';
  setExpoMode: (mode: 'off' | 'expo' | 'scale') => void;

  // Hot corners
  hotCornerActions: HotCornerActions;
  setHotCornerActions: (actions: Partial<HotCornerActions>) => void;

  // Show / Restore desktop
  showDesktop: () => void;
  restoreDesktop: () => void;
}

const DESKTOP_WIDTH = () => window.innerWidth;
const DESKTOP_HEIGHT = () => window.innerHeight - 48; // panel height
const CASCADE_OFFSET = 30;

let cascadeIndex = 0;
let _minimizedByShowDesktop: string[] = [];

function getSnapBounds(zone: SnapZone): { x: number; y: number; width: number; height: number } {
  const w = DESKTOP_WIDTH();
  const h = DESKTOP_HEIGHT();
  switch (zone) {
    case 'left': return { x: 0, y: 0, width: w / 2, height: h };
    case 'right': return { x: w / 2, y: 0, width: w / 2, height: h };
    case 'maximize': return { x: 0, y: 0, width: w, height: h };
    case 'top-left': return { x: 0, y: 0, width: w / 2, height: h / 2 };
    case 'top-right': return { x: w / 2, y: 0, width: w / 2, height: h / 2 };
    case 'bottom-left': return { x: 0, y: h / 2, width: w / 2, height: h / 2 };
    case 'bottom-right': return { x: w / 2, y: h / 2, width: w / 2, height: h / 2 };
    default: return { x: 0, y: 0, width: w, height: h };
  }
}

const defaultWorkspaces: Workspace[] = [
  { id: 'ws-1', name: 'Workspace 1', windowIds: [] },
  { id: 'ws-2', name: 'Workspace 2', windowIds: [] },
  { id: 'ws-3', name: 'Workspace 3', windowIds: [] },
  { id: 'ws-4', name: 'Workspace 4', windowIds: [] },
];

const defaultPanel: PanelConfig = {
  position: 'bottom',
  height: 48,
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

export const useDesktopStore = create<DesktopStore>((set, get) => ({
  // === Windows ===
  windows: [],
  nextZIndex: 100,

  createWindow: (app, overrides) => {
    const id = `win-${uuid()}`;
    const z = get().nextZIndex;
    const offset = (cascadeIndex++ % 10) * CASCADE_OFFSET;
    const defaultWidth = 800;
    const defaultHeight = 600;

    const win: WindowState = {
      id,
      title: app.name,
      icon: app.icon,
      appId: app.id,
      x: 80 + offset,
      y: 40 + offset,
      width: defaultWidth,
      height: defaultHeight,
      minWidth: 320,
      minHeight: 200,
      zIndex: z,
      state: 'normal',
      focused: true,
      resizable: true,
      closable: true,
      maximizable: true,
      minimizable: true,
      ...overrides,
    };

    set(s => ({
      windows: [...s.windows.map(w => ({ ...w, focused: false })), win],
      nextZIndex: z + 1,
      workspaces: s.workspaces.map(ws =>
        ws.id === s.activeWorkspaceId
          ? { ...ws, windowIds: [...ws.windowIds, id] }
          : ws
      ),
    }));
    return id;
  },

  closeWindow: (id) => {
    set(s => ({
      windows: s.windows.filter(w => w.id !== id),
      workspaces: s.workspaces.map(ws => ({
        ...ws,
        windowIds: ws.windowIds.filter(wid => wid !== id),
      })),
    }));
  },

  focusWindow: (id) => {
    const z = get().nextZIndex;
    set(s => ({
      windows: s.windows.map(w => ({
        ...w,
        focused: w.id === id,
        zIndex: w.id === id ? z : w.zIndex,
        state: w.id === id && w.state === 'minimized' ? 'normal' : w.state,
      })),
      nextZIndex: z + 1,
    }));
  },

  minimizeWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id ? { ...w, state: 'minimized', focused: false } : w
      ),
    }));
  },

  maximizeWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id
          ? { ...w, state: 'maximized', ...getSnapBounds('maximize') }
          : w
      ),
    }));
  },

  restoreWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id ? { ...w, state: 'normal' } : w
      ),
    }));
  },

  snapWindow: (id, zone) => {
    if (!zone) return;
    const bounds = getSnapBounds(zone);
    const state = zone === 'maximize' ? 'maximized' as const : `snapped-${zone}` as WindowState['state'];
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id ? { ...w, state, ...bounds } : w
      ),
    }));
  },

  moveWindow: (id, x, y) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id ? { ...w, x, y, state: 'normal' } : w
      ),
    }));
  },

  resizeWindow: (id, width, height) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id
          ? {
              ...w,
              width: Math.max(w.minWidth, Math.min(width, w.maxWidth ?? Infinity)),
              height: Math.max(w.minHeight, Math.min(height, w.maxHeight ?? Infinity)),
            }
          : w
      ),
    }));
  },

  updateWindowTitle: (id, title) => {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, title } : w),
    }));
  },

  // === Workspaces (Cinnamon) ===
  workspaces: defaultWorkspaces,
  activeWorkspaceId: 'ws-1',

  switchWorkspace: (id) => {
    set({ activeWorkspaceId: id });
  },

  addWorkspace: () => {
    const id = `ws-${uuid()}`;
    set(s => ({
      workspaces: [...s.workspaces, {
        id,
        name: `Workspace ${s.workspaces.length + 1}`,
        windowIds: [],
      }],
    }));
  },

  removeWorkspace: (id) => {
    set(s => {
      if (s.workspaces.length <= 1) return s;
      const ws = s.workspaces.find(w => w.id === id);
      const remaining = s.workspaces.filter(w => w.id !== id);
      const targetWs = remaining[0];
      return {
        workspaces: remaining.map(w =>
          w.id === targetWs.id
            ? { ...w, windowIds: [...w.windowIds, ...(ws?.windowIds ?? [])] }
            : w
        ),
        activeWorkspaceId: s.activeWorkspaceId === id ? targetWs.id : s.activeWorkspaceId,
      };
    });
  },

  // === Notifications (Cinnamon) ===
  notifications: [],

  addNotification: (n) => {
    const id = `notif-${uuid()}`;
    const notification: Notification = {
      ...n,
      id,
      timestamp: Date.now(),
      read: false,
    };
    set(s => ({
      notifications: [notification, ...s.notifications],
    }));
    return id;
  },

  dismissNotification: (id) => {
    set(s => ({
      notifications: s.notifications.filter(n => n.id !== id),
    }));
  },

  markNotificationRead: (id) => {
    set(s => ({
      notifications: s.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  // === Panel ===
  panelConfig: defaultPanel,
  setPanelConfig: (config) => {
    set(s => ({
      panelConfig: { ...s.panelConfig, ...config },
    }));
  },

  // === Theme ===
  activeThemeId: 'dark',
  setTheme: (id) => {
    set({ activeThemeId: id });
  },

  // === App Menu ===
  appMenuOpen: false,
  toggleAppMenu: () => set(s => ({ appMenuOpen: !s.appMenuOpen })),
  closeAppMenu: () => set({ appMenuOpen: false }),

  // === Expo / Scale ===
  expoMode: 'off',
  setExpoMode: (mode) => set({ expoMode: mode }),

  // === Hot Corners ===
  hotCornerActions: {
    topLeft: 'expo',
    topRight: 'scale',
    bottomLeft: 'show-desktop',
    bottomRight: 'none',
  },
  setHotCornerActions: (actions) => {
    set(s => ({ hotCornerActions: { ...s.hotCornerActions, ...actions } }));
  },

  // === Show / Restore Desktop ===
  showDesktop: () => {
    const s = get();
    const activeWs = s.workspaces.find(ws => ws.id === s.activeWorkspaceId);
    if (!activeWs) return;
    const toMinimize = s.windows
      .filter(w => activeWs.windowIds.includes(w.id) && w.state !== 'minimized')
      .map(w => w.id);
    _minimizedByShowDesktop = toMinimize;
    set(s => ({
      windows: s.windows.map(w =>
        toMinimize.includes(w.id) ? { ...w, state: 'minimized' as const, focused: false } : w
      ),
    }));
  },
  restoreDesktop: () => {
    const ids = _minimizedByShowDesktop;
    if (ids.length === 0) return;
    _minimizedByShowDesktop = [];
    set(s => ({
      windows: s.windows.map(w =>
        ids.includes(w.id) ? { ...w, state: 'normal' as const } : w
      ),
    }));
  },
}));
