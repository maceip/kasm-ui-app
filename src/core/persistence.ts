// ============================================================
// Layout Persistence - Save/load desktop state to localStorage
// Debounced auto-save on every state change
// ============================================================

import { useEffect, useRef } from 'react';
import { useDesktopStore } from './store';
import { appRegistry } from '../apps/registry';

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
  const state = useDesktopStore.getState();

  const layout: SerializedLayout = {
    version: 1,
    windows: state.windows.map(w => ({
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
    workspaces: state.workspaces.map(ws => ({
      id: ws.id,
      name: ws.name,
      windowIds: [...ws.windowIds],
    })),
    activeWorkspaceId: state.activeWorkspaceId,
    activeThemeId: state.activeThemeId,
    panelConfig: {
      position: state.panelConfig.position,
      height: state.panelConfig.height,
      autohide: state.panelConfig.autohide,
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

    const state = useDesktopStore.getState();

    // Restore workspaces
    if (layout.workspaces && layout.workspaces.length > 0) {
      useDesktopStore.setState({
        workspaces: layout.workspaces,
        activeWorkspaceId: layout.activeWorkspaceId || layout.workspaces[0].id,
      });
    }

    // Restore theme
    if (layout.activeThemeId) {
      state.setTheme(layout.activeThemeId);
    }

    // Restore panel config (partial - keep applets from default)
    if (layout.panelConfig) {
      state.setPanelConfig({
        position: layout.panelConfig.position as any,
        height: layout.panelConfig.height,
        autohide: layout.panelConfig.autohide as any,
      });
    }

    // Restore windows using the app registry
    if (layout.windows && layout.windows.length > 0) {
      for (const savedWindow of layout.windows) {
        const app = appRegistry.find(a => a.id === savedWindow.appId);
        if (!app) continue; // Skip removed/unregistered apps

        state.createWindow(app, {
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
          state: savedWindow.state as any,
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

export function usePersistence(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load layout on mount
  useEffect(() => {
    loadLayout();
  }, []);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    const unsub = useDesktopStore.subscribe(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        saveLayout();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}
