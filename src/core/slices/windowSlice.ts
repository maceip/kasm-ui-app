// ============================================================
// Window Slice - Window management state & actions
// ============================================================

import { v4 as uuid } from 'uuid';
import type { StateCreator } from 'zustand';
import type { WindowState, AppDefinition, SnapZone } from '../types';
import { PANEL_HEIGHT_DEFAULT } from '../types';

const DESKTOP_WIDTH = () => window.innerWidth;
const DESKTOP_HEIGHT = () => window.innerHeight - PANEL_HEIGHT_DEFAULT;
const CASCADE_OFFSET = 30;

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

export interface WindowSlice {
  // State
  windows: WindowState[];
  nextZIndex: number;
  cascadeIndex: number;

  // Actions
  createWindow: (app: AppDefinition, overrides?: Partial<WindowState>) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  snapWindow: (id: string, zone: SnapZone | null) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  updateWindowTitle: (id: string, title: string) => void;
}

export const createWindowSlice: StateCreator<WindowSlice & Record<string, any>, [], [], WindowSlice> = (set, get) => ({
  // === State ===
  windows: [],
  nextZIndex: 100,
  cascadeIndex: 0,

  // === Actions ===
  createWindow: (app, overrides) => {
    // Enforce singleton: focus existing window instead of opening a duplicate
    if (app.singleton) {
      const existing = (get() as any).windows.find((w: WindowState) => w.appId === app.id);
      if (existing) {
        (get() as any).focusWindow(existing.id);
        return existing.id;
      }
    }

    const id = `win-${uuid()}`;
    const z = get().nextZIndex;
    const ci = get().cascadeIndex;
    const offset = (ci % 10) * CASCADE_OFFSET;
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

    set((s: any) => ({
      windows: [...s.windows.map((w: WindowState) => ({ ...w, focused: false })), win],
      nextZIndex: z + 1,
      cascadeIndex: ci + 1,
      workspaces: s.workspaces.map((ws: any) =>
        ws.id === s.activeWorkspaceId
          ? { ...ws, windowIds: [...ws.windowIds, id] }
          : ws
      ),
    }));
    return id;
  },

  closeWindow: (id) => {
    set((s: any) => ({
      windows: s.windows.filter((w: WindowState) => w.id !== id),
      workspaces: s.workspaces.map((ws: any) => ({
        ...ws,
        windowIds: ws.windowIds.filter((wid: string) => wid !== id),
      })),
    }));
  },

  focusWindow: (id) => {
    const z = get().nextZIndex;
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) => ({
        ...w,
        focused: w.id === id,
        zIndex: w.id === id ? z : w.zIndex,
        state: w.id === id && w.state === 'minimized' ? 'normal' : w.state,
      })),
      nextZIndex: z + 1,
    }));
  },

  minimizeWindow: (id) => {
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) =>
        w.id === id ? { ...w, state: 'minimized', focused: false } : w
      ),
    }));
  },

  maximizeWindow: (id) => {
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) =>
        w.id === id
          ? { ...w, state: 'maximized', ...getSnapBounds('maximize') }
          : w
      ),
    }));
  },

  restoreWindow: (id) => {
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) =>
        w.id === id ? { ...w, state: 'normal' } : w
      ),
    }));
  },

  snapWindow: (id, zone) => {
    if (!zone) return;
    const bounds = getSnapBounds(zone);
    const state = zone === 'maximize' ? 'maximized' as const : `snapped-${zone}` as WindowState['state'];
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) =>
        w.id === id ? { ...w, state, ...bounds } : w
      ),
    }));
  },

  moveWindow: (id, x, y) => {
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) =>
        w.id === id ? { ...w, x, y, state: 'normal' } : w
      ),
    }));
  },

  resizeWindow: (id, width, height) => {
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) =>
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
    set((s: any) => ({
      windows: s.windows.map((w: WindowState) => w.id === id ? { ...w, title } : w),
    }));
  },
});
