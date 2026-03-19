// ============================================================
// SolidJS Store - Composed from domain slices
// Uses solid-js/store createStore with draft-based mutations.
// ============================================================

import { createStore } from 'solid-js/store';
import { v4 as uuid } from 'uuid';
import type { WindowState, AppDefinition, SnapZone, Workspace, PanelConfig, Notification, Project, AgentSession, AgentTask, AgentBackend, GitNode, PanelPosition } from './types';
import { PANEL_HEIGHT_DEFAULT } from './types';
import {
  CASCADE_OFFSET,
  applyFocusWindow,
  applyMoveWindow,
  applyResizeWindow,
  applySnapWindow,
  applyMinimizeWindow,
  applyMaximizeWindow,
  applyRestoreWindow,
  applyUpdateWindowTitle,
} from '../lib/windowActions';

// ---- Hot Corner Types ----
export type HotCornerAction = 'expo' | 'scale' | 'show-desktop' | 'none';

export interface HotCornerActions {
  topLeft: HotCornerAction;
  topRight: HotCornerAction;
  bottomLeft: HotCornerAction;
  bottomRight: HotCornerAction;
}

// ---- Panel Defaults ----
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

const defaultWorkspaces: Workspace[] = [
  { id: 'ws-1', name: 'Workspace 1', windowIds: [] },
  { id: 'ws-2', name: 'Workspace 2', windowIds: [] },
  { id: 'ws-3', name: 'Workspace 3', windowIds: [] },
  { id: 'ws-4', name: 'Workspace 4', windowIds: [] },
];

// ---- Store Shape ----
export interface DesktopStoreState {
  // Window state
  windows: WindowState[];
  nextZIndex: number;
  cascadeIndex: number;

  // Workspace state
  workspaces: Workspace[];
  activeWorkspaceId: string;

  // Shell state
  panelConfig: PanelConfig;
  activeThemeId: string;
  appMenuOpen: boolean;
  expoMode: 'off' | 'expo' | 'scale';
  hotCornerActions: HotCornerActions;
  agentSidebarOpen: boolean;
  _minimizedByShowDesktop: string[];

  // Notification state
  notifications: Notification[];

  // Project state
  projects: Project[];
  activeProjectId: string | null;
}

const DESKTOP_WIDTH = () => window.innerWidth;
const DESKTOP_HEIGHT = () => window.innerHeight - PANEL_HEIGHT_DEFAULT;

// ---- Create the Store ----
const [state, setState] = createStore<DesktopStoreState>({
  // Window
  windows: [],
  nextZIndex: 100,
  cascadeIndex: 0,

  // Workspace
  workspaces: defaultWorkspaces,
  activeWorkspaceId: 'ws-1',

  // Shell
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

  // Notifications
  notifications: [],

  // Projects
  projects: [],
  activeProjectId: null,
});

// ---- Exported Reactive State (read-only proxy) ----
export const desktop = state;

// ---- Window Actions ----
export function createWindow(app: AppDefinition, overrides?: Partial<WindowState>): string {
  // Enforce singleton
  if (app.singleton) {
    const existing = state.windows.find(w => w.appId === app.id);
    if (existing) {
      focusWindow(existing.id);
      return existing.id;
    }
  }

  const id = overrides?.id ?? `win-${uuid()}`;
  const z = state.nextZIndex;
  const ci = state.cascadeIndex;
  const offset = (ci % 10) * CASCADE_OFFSET;

  const win: WindowState = {
    id,
    title: app.name,
    icon: app.icon,
    appId: app.id,
    x: 80 + offset,
    y: 40 + offset,
    width: 800,
    height: 600,
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

  setState('windows', w => [...w.map(ww => ({ ...ww, focused: false })), win]);
  setState('nextZIndex', z + 1);
  setState('cascadeIndex', ci + 1);
  // Add to active workspace
  const wsIdx = state.workspaces.findIndex(ws => ws.id === state.activeWorkspaceId);
  if (wsIdx >= 0) {
    setState('workspaces', wsIdx, 'windowIds', ids => [...ids, id]);
  }
  return id;
}

export function closeWindow(id: string): void {
  setState('windows', w => w.filter(ww => ww.id !== id));
  // Remove from all workspaces
  for (let i = 0; i < state.workspaces.length; i++) {
    if (state.workspaces[i].windowIds.includes(id)) {
      setState('workspaces', i, 'windowIds', ids => ids.filter(wid => wid !== id));
    }
  }
}

export function focusWindow(id: string): void {
  const z = state.nextZIndex;
  setState('windows', applyFocusWindow(state.windows as WindowState[], id, z));
  setState('nextZIndex', z + 1);
}

export function minimizeWindow(id: string): void {
  setState('windows', applyMinimizeWindow(state.windows as WindowState[], id));
}

export function maximizeWindow(id: string): void {
  setState('windows', applyMaximizeWindow(state.windows as WindowState[], id, DESKTOP_WIDTH(), DESKTOP_HEIGHT()));
}

export function restoreWindow(id: string): void {
  setState('windows', applyRestoreWindow(state.windows as WindowState[], id));
}

export function snapWindow(id: string, zone: SnapZone | null): void {
  if (!zone) return;
  setState('windows', applySnapWindow(state.windows as WindowState[], id, zone, DESKTOP_WIDTH(), DESKTOP_HEIGHT()));
}

export function moveWindow(id: string, x: number, y: number): void {
  setState('windows', applyMoveWindow(state.windows as WindowState[], id, x, y));
}

export function resizeWindow(id: string, width: number, height: number): void {
  setState('windows', applyResizeWindow(state.windows as WindowState[], id, width, height));
}

export function updateWindowTitle(id: string, title: string): void {
  setState('windows', applyUpdateWindowTitle(state.windows as WindowState[], id, title));
}

// ---- Workspace Actions ----
export function switchWorkspace(id: string): void {
  setState('activeWorkspaceId', id);
}

export function addWorkspace(): void {
  const id = `ws-${uuid()}`;
  setState('workspaces', w => [...w, {
    id,
    name: `Workspace ${w.length + 1}`,
    windowIds: [],
  }]);
}

export function removeWorkspace(id: string): void {
  if (state.workspaces.length <= 1) return;
  const ws = state.workspaces.find(w => w.id === id);
  const remaining = state.workspaces.filter(w => w.id !== id);
  const targetWs = remaining[0];
  setState('workspaces', remaining.map(w =>
    w.id === targetWs.id
      ? { ...w, windowIds: [...w.windowIds, ...(ws?.windowIds ?? [])] }
      : w
  ));
  if (state.activeWorkspaceId === id) {
    setState('activeWorkspaceId', targetWs.id);
  }
}

// ---- Shell Actions ----
export function setPanelConfig(config: Partial<PanelConfig>): void {
  setState('panelConfig', prev => ({ ...prev, ...config }));
}

export function setTheme(id: string): void {
  setState('activeThemeId', id);
}

export function toggleAppMenu(): void {
  setState('appMenuOpen', v => !v);
}

export function closeAppMenu(): void {
  setState('appMenuOpen', false);
}

export function setExpoMode(mode: 'off' | 'expo' | 'scale'): void {
  setState('expoMode', mode);
}

export function setHotCornerActions(actions: Partial<HotCornerActions>): void {
  setState('hotCornerActions', prev => ({ ...prev, ...actions }));
}

export function toggleAgentSidebar(): void {
  setState('agentSidebarOpen', v => !v);
}

export function showDesktop(): void {
  const activeWs = state.workspaces.find(ws => ws.id === state.activeWorkspaceId);
  if (!activeWs) return;
  const toMinimize = (state.windows as WindowState[])
    .filter(w => activeWs.windowIds.includes(w.id) && w.state !== 'minimized')
    .map(w => w.id);
  setState('_minimizedByShowDesktop', toMinimize);
  setState('windows', ws => ws.map(w =>
    toMinimize.includes(w.id) ? { ...w, state: 'minimized' as const, focused: false } : w
  ));
}

export function restoreDesktop(): void {
  const ids = state._minimizedByShowDesktop;
  if (ids.length === 0) return;
  setState('_minimizedByShowDesktop', []);
  setState('windows', ws => ws.map(w =>
    ids.includes(w.id) ? { ...w, state: 'normal' as const } : w
  ));
}

// ---- Notification Actions ----
export function addNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>): string {
  const id = `notif-${uuid()}`;
  const notification: Notification = {
    ...n,
    id,
    timestamp: Date.now(),
    read: false,
  };
  setState('notifications', prev => [notification, ...prev]);
  return id;
}

export function dismissNotification(id: string): void {
  setState('notifications', prev => prev.filter(n => n.id !== id));
}

export function markNotificationRead(id: string): void {
  setState('notifications', prev => prev.map(n =>
    n.id === id ? { ...n, read: true } : n
  ));
}

export function clearNotifications(): void {
  setState('notifications', []);
}

// ---- Project Actions ----
export function createProject(name: string, path: string): string {
  const id = uuid();
  const project: Project = {
    id, name, path,
    agents: [], tasks: [], gitNodes: [],
  };
  setState('projects', prev => [...prev, project]);
  if (state.activeProjectId === null) {
    setState('activeProjectId', id);
  }
  return id;
}

export function removeProject(id: string): void {
  setState('projects', prev => prev.filter(p => p.id !== id));
  if (state.activeProjectId === id) {
    const next = state.projects.find(p => p.id !== id);
    setState('activeProjectId', next?.id ?? null);
  }
}

export function setActiveProject(id: string): void {
  setState('activeProjectId', id);
}

export function spawnAgent(projectId: string, backend: AgentBackend, name?: string): string {
  const id = uuid();
  const agentNames: Record<string, string> = {
    'codex': 'Codex', 'claude-code': 'Claude Code', 'gemini-code': 'Gemini',
    'cursor-agent': 'Cursor', 'devin': 'Devin', 'junie': 'Junie',
    'cody': 'Cody', 'custom': 'Agent',
  };
  const session: AgentSession = {
    id, backend,
    name: name || `${agentNames[backend] || 'Agent'} ${id.slice(0, 4)}`,
    status: 'idle',
    tokensUsed: 0, costUsd: 0,
    createdAt: Date.now(), lastActivity: Date.now(),
  };
  const idx = state.projects.findIndex(p => p.id === projectId);
  if (idx >= 0) {
    setState('projects', idx, 'agents', prev => [...prev, session]);
  }
  return id;
}

export function updateAgent(projectId: string, agentId: string, updates: Partial<AgentSession>): void {
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx < 0) return;
  const aIdx = state.projects[pIdx].agents.findIndex(a => a.id === agentId);
  if (aIdx < 0) return;
  setState('projects', pIdx, 'agents', aIdx, prev => ({ ...prev, ...updates, lastActivity: Date.now() }));
}

export function removeAgent(projectId: string, agentId: string): void {
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx < 0) return;
  setState('projects', pIdx, 'agents', prev => prev.filter(a => a.id !== agentId));
  if (state.projects[pIdx].activeAgentId === agentId) {
    setState('projects', pIdx, 'activeAgentId', undefined);
  }
}

export function setActiveAgent(projectId: string, agentId: string): void {
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx >= 0) {
    setState('projects', pIdx, 'activeAgentId', agentId);
  }
}

export function createTask(projectId: string, title: string, description?: string): string {
  const id = uuid();
  const task: AgentTask = {
    id, title, description,
    status: 'todo', filesChanged: [],
    createdAt: Date.now(),
  };
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx >= 0) {
    setState('projects', pIdx, 'tasks', prev => [...prev, task]);
  }
  return id;
}

export function updateTask(projectId: string, taskId: string, updates: Partial<AgentTask>): void {
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx < 0) return;
  const tIdx = state.projects[pIdx].tasks.findIndex(t => t.id === taskId);
  if (tIdx < 0) return;
  setState('projects', pIdx, 'tasks', tIdx, prev => ({ ...prev, ...updates }));
}

export function assignTask(projectId: string, taskId: string, agentId: string): void {
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx < 0) return;
  const tIdx = state.projects[pIdx].tasks.findIndex(t => t.id === taskId);
  if (tIdx >= 0) {
    setState('projects', pIdx, 'tasks', tIdx, prev => ({ ...prev, assignedAgentId: agentId, status: 'assigned' as const }));
  }
  const aIdx = state.projects[pIdx].agents.findIndex(a => a.id === agentId);
  if (aIdx >= 0) {
    setState('projects', pIdx, 'agents', aIdx, prev => ({ ...prev, taskId, status: 'working' as const }));
  }
}

export function updateGitNodes(projectId: string, nodes: GitNode[]): void {
  const pIdx = state.projects.findIndex(p => p.id === projectId);
  if (pIdx >= 0) {
    setState('projects', pIdx, 'gitNodes', nodes);
  }
}

// ---- setState export for persistence ----
export { setState as _setState };

// Re-export slice types for backward compat
export type { PanelPosition };
