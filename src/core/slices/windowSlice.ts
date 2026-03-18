// ============================================================
// Window Slice - Zustand binding for window management.
// Pure mutation logic lives in src/lib/windowActions.ts.
// This file is the ONLY framework-specific layer for window state.
// ============================================================

import { v4 as uuid } from 'uuid';
import type { StateCreator } from 'zustand';
import type { WindowState, AppDefinition, SnapZone } from '../types';
import { PANEL_HEIGHT_DEFAULT } from '../types';
import {
  CASCADE_OFFSET,
  getSnapBounds,
  applyFocusWindow,
  applyMoveWindow,
  applyResizeWindow,
  applySnapWindow,
  applyMinimizeWindow,
  applyMaximizeWindow,
  applyRestoreWindow,
  applyUpdateWindowTitle,
} from '../../lib/windowActions';

const DESKTOP_WIDTH = () => window.innerWidth;
const DESKTOP_HEIGHT = () => window.innerHeight - PANEL_HEIGHT_DEFAULT;

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
      windows: applyFocusWindow(s.windows, id, z),
      nextZIndex: z + 1,
    }));
  },

  minimizeWindow: (id) => {
    set((s: any) => ({
      windows: applyMinimizeWindow(s.windows, id),
    }));
  },

  maximizeWindow: (id) => {
    set((s: any) => ({
      windows: applyMaximizeWindow(s.windows, id, DESKTOP_WIDTH(), DESKTOP_HEIGHT()),
    }));
  },

  restoreWindow: (id) => {
    set((s: any) => ({
      windows: applyRestoreWindow(s.windows, id),
    }));
  },

  snapWindow: (id, zone) => {
    if (!zone) return;
    set((s: any) => ({
      windows: applySnapWindow(s.windows, id, zone, DESKTOP_WIDTH(), DESKTOP_HEIGHT()),
    }));
  },

  moveWindow: (id, x, y) => {
    set((s: any) => ({
      windows: applyMoveWindow(s.windows, id, x, y),
    }));
  },

  resizeWindow: (id, width, height) => {
    set((s: any) => ({
      windows: applyResizeWindow(s.windows, id, width, height),
    }));
  },

  updateWindowTitle: (id, title) => {
    set((s: any) => ({
      windows: applyUpdateWindowTitle(s.windows, id, title),
    }));
  },
});
