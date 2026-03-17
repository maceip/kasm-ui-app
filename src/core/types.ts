// ============================================================
// Kasm UI - Core Type Definitions
// Unified desktop environment type system
// ============================================================

// === Window Management (Cinnamon + rc-dock) ===
export interface WindowState {
  id: string;
  title: string;
  icon?: string;
  appId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  zIndex: number;
  state: 'normal' | 'minimized' | 'maximized' | 'snapped-left' | 'snapped-right' | 'snapped-top-left' | 'snapped-top-right' | 'snapped-bottom-left' | 'snapped-bottom-right';
  focused: boolean;
  resizable: boolean;
  closable: boolean;
  maximizable: boolean;
  minimizable: boolean;
}

// === Snap Zones (Cinnamon window tiling) ===
export type SnapZone =
  | 'left' | 'right' | 'top' | 'maximize'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | null;

// === Docking Layout (rc-dock model) ===
export type DockDirection = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'float';

// === Panel / Taskbar (Cinnamon panel system) ===
export type PanelPosition = 'top' | 'bottom' | 'left' | 'right';
export type PanelZone = 'left' | 'center' | 'right';

export interface PanelApplet {
  id: string;
  type: string;
  zone: PanelZone;
  order: number;
  config?: Record<string, any>;
}

export interface PanelConfig {
  position: PanelPosition;
  height: number;
  autohide: 'never' | 'always' | 'intellihide';
  applets: PanelApplet[];
}

// === App System (Cinnamon app menu) ===
export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  category: string;
  description?: string;
  component: React.ComponentType<AppProps>;
  singleton?: boolean;
}

export interface AppProps {
  windowId: string;
  onTitleChange?: (title: string) => void;
}

export type AppCategory = {
  id: string;
  name: string;
  icon: string;
};

// === Workspace System (Cinnamon workspaces) ===
export interface Workspace {
  id: string;
  name: string;
  windowIds: string[];
}

// === Notification System (Cinnamon notifications) ===
export interface Notification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  urgency: 'low' | 'normal' | 'critical';
  timestamp: number;
  read: boolean;
  actions?: { label: string; action: () => void }[];
  duration?: number; // ms, 0 = persistent
}

// === Theme System (Golden Layout themes + Cinnamon CSS) ===
export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    // Shell
    panelBg: string;
    panelText: string;
    panelBorder: string;
    // Desktop
    desktopBg: string;
    // Windows
    windowBg: string;
    windowText: string;
    windowBorder: string;
    titleBarBg: string;
    titleBarText: string;
    titleBarBgFocused: string;
    titleBarTextFocused: string;
    // Accents
    accent: string;
    accentHover: string;
    accentText: string;
    // Surfaces
    surfaceBg: string;
    surfaceText: string;
    surfaceBorder: string;
    // Tabs (Golden Layout model)
    tabBg: string;
    tabText: string;
    tabActiveBg: string;
    tabActiveText: string;
    tabHoverBg: string;
    // Splitters (Re-Flex model)
    splitterBg: string;
    splitterHover: string;
    // Notifications
    notificationBg: string;
    notificationText: string;
    // Snap preview
    snapPreviewBg: string;
    // Scrollbar
    scrollbarTrack: string;
    scrollbarThumb: string;
    // Semantic status colors
    danger: string;
    dangerHover: string;
    success: string;
    warning: string;
    info: string;
    // Terminal
    terminalBg: string;
    terminalFg: string;
    terminalPrompt: string;
    terminalPath: string;
    terminalError: string;
    terminalHighlight: string;
    // Muted / Overlay
    textMuted: string;
    overlayBg: string;
  };
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
}

// === Collaboration (ShareJS model) ===
export interface CollabPresence {
  clientId: string;
  userId?: string;
  cursor?: { line: number; col: number };
  selection?: { start: number; end: number };
  color: string;
  name: string;
}

// === Splitter Constraints (Re-Flex model) ===
export interface SplitConstraints {
  minSize?: number;
  maxSize?: number;
  flex?: number;
  direction?: -1 | 1;
}

// === Multi-Agent Orchestration ===

export type AgentBackend = 'codex' | 'claude-code' | 'gemini-code' | 'cursor-agent' | 'devin' | 'junie' | 'cody' | 'custom';
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'done';

export interface AgentSession {
  id: string;
  backend: AgentBackend;
  name: string;
  status: AgentStatus;
  taskId?: string;
  branch?: string;
  windowId?: string;       // linked terminal window
  tokensUsed: number;
  costUsd: number;
  createdAt: number;
  lastActivity: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'assigned' | 'in-progress' | 'review' | 'done';
  assignedAgentId?: string;
  branch?: string;
  filesChanged: string[];
  createdAt: number;
}

export interface GitNode {
  hash: string;
  short: string;
  message: string;
  branch?: string;
  isMerged: boolean;
  parentHashes: string[];
  author?: string;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;                // VFS or local mount path
  agents: AgentSession[];
  tasks: AgentTask[];
  gitNodes: GitNode[];         // for 3D visualization
  activeAgentId?: string;
}
