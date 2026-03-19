// ============================================================
// Layout Persistence - Save/load desktop state to localStorage
// Debounced auto-save via SolidJS createEffect
// ============================================================

import { createEffect, onCleanup } from 'solid-js';
import { desktop, _setState, createWindow } from './store';
import { appRegistry } from '../apps/registry';
import type { PanelPosition, WindowState } from './types';
import * as store from './store';

const VALID_POSITIONS: PanelPosition[] = ['top', 'bottom', 'left', 'right'];
const VALID_AUTOHIDE = ['never', 'always', 'intellihide'] as const;
const VALID_WINDOW_STATES: WindowState['state'][] = [
  'normal', 'minimized', 'maximized',
  'snapped-left', 'snapped-right',
  'snapped-top-left', 'snapped-top-right',
  'snapped-bottom-left', 'snapped-bottom-right',
];

function isValidPosition(v: string): v is PanelPosition {
  return (VALID_POSITIONS as string[]).includes(v);
}

function isValidAutohide(v: string): v is (typeof VALID_AUTOHIDE)[number] {
  return (VALID_AUTOHIDE as readonly string[]).includes(v);
}

function isValidWindowState(v: string): v is WindowState['state'] {
  return (VALID_WINDOW_STATES as string[]).includes(v);
}

const STORAGE_KEY = 'kasm-ui-layout';
const DEBOUNCE_MS = 2000;

interface SerializedLayout {
  version: 1;
  windows: Array<{
    id: string;
    appId: string;
    title: string;
    icon?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    maxWidth?: number;
    maxHeight?: number;
    zIndex: number;
    state: string;
    focused: boolean;
    resizable: boolean;
    closable: boolean;
    maximizable: boolean;
    minimizable: boolean;
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    windowIds: string[];
  }>;
  activeWorkspaceId: string;
  activeThemeId: string;
  panelConfig: {
    position: string;
    height: number;
    autohide: string;
  };
}

export function saveLayout(): void {
  const layout: SerializedLayout = {
    version: 1,
    windows: (desktop.windows as WindowState[]).map(w => ({
      id: w.id,
      appId: w.appId,
      title: w.title,
      icon: w.icon,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      minWidth: w.minWidth,
      minHeight: w.minHeight,
      maxWidth: w.maxWidth,
      maxHeight: w.maxHeight,
      zIndex: w.zIndex,
      state: w.state,
      focused: w.focused,
      resizable: w.resizable,
      closable: w.closable,
      maximizable: w.maximizable,
      minimizable: w.minimizable,
    })),
    workspaces: desktop.workspaces.map(ws => ({
      id: ws.id,
      name: ws.name,
      windowIds: [...ws.windowIds],
    })),
    activeWorkspaceId: desktop.activeWorkspaceId,
    activeThemeId: desktop.activeThemeId,
    panelConfig: {
      position: desktop.panelConfig.position,
      height: desktop.panelConfig.height,
      autohide: desktop.panelConfig.autohide,
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.warn('Failed to save layout:', e);
  }
}

export function loadLayout(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const layout: SerializedLayout = JSON.parse(raw);
    if (layout.version !== 1) return;

    // Restore workspaces
    if (layout.workspaces && layout.workspaces.length > 0) {
      _setState('workspaces', layout.workspaces);
      _setState('activeWorkspaceId', layout.activeWorkspaceId || layout.workspaces[0].id);
    }

    // Restore theme
    if (layout.activeThemeId) {
      store.setTheme(layout.activeThemeId);
    }

    // Restore panel config
    if (layout.panelConfig) {
      const pos = layout.panelConfig.position;
      const ah = layout.panelConfig.autohide;
      store.setPanelConfig({
        ...(isValidPosition(pos) ? { position: pos } : {}),
        height: layout.panelConfig.height,
        ...(isValidAutohide(ah) ? { autohide: ah } : {}),
      });
    }

    // Restore windows
    if (layout.windows && layout.windows.length > 0) {
      for (const savedWindow of layout.windows) {
        const app = appRegistry.find(a => a.id === savedWindow.appId);
        if (!app) continue;

        createWindow(app, {
          id: savedWindow.id,
          title: savedWindow.title,
          icon: savedWindow.icon,
          x: savedWindow.x,
          y: savedWindow.y,
          width: savedWindow.width,
          height: savedWindow.height,
          minWidth: savedWindow.minWidth,
          minHeight: savedWindow.minHeight,
          maxWidth: savedWindow.maxWidth,
          maxHeight: savedWindow.maxHeight,
          zIndex: savedWindow.zIndex,
          state: isValidWindowState(savedWindow.state) ? savedWindow.state : 'normal',
          focused: savedWindow.focused,
          resizable: savedWindow.resizable,
          closable: savedWindow.closable,
          maximizable: savedWindow.maximizable,
          minimizable: savedWindow.minimizable,
        });
      }
    }

  } catch (e) {
    console.warn('Failed to load layout:', e);
  }
}

export function setupPersistence(): void {
  // Load layout immediately
  loadLayout();

  // Auto-save on state changes (debounced) via reactive tracking
  let timer: ReturnType<typeof setTimeout> | null = null;

  createEffect(() => {
    // Track all relevant state by reading it
    void desktop.windows.length;
    void desktop.workspaces.length;
    void desktop.activeWorkspaceId;
    void desktop.activeThemeId;
    void desktop.panelConfig.position;
    void desktop.panelConfig.height;
    void desktop.panelConfig.autohide;

    // Debounced save
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveLayout(), DEBOUNCE_MS);
  });

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });
}
