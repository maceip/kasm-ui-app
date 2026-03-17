// ============================================================
// App Registry - Cinnamon-style application definitions
// ============================================================

import type { AppDefinition, AppCategory } from '../core/types';
import { TextEditor } from './TextEditor';
import { FileManager } from './FileManager';
import { Terminal } from './Terminal';
import { Settings } from './Settings';
import { CollabEditor } from './CollabEditor';
import { SystemMonitor } from './SystemMonitor';
import { DockingDemo } from './DockingDemo';
import { Calculator } from './Calculator';
import { CodexApp, ClaudeCodeApp, GeminiCodeApp, CursorAgentApp, DevinApp, JunieApp, CodyApp } from './AgentApps';
import { GitHubApp, GitLabApp } from './OAuthApps';
import { NotesApp } from './Notes';

export const appCategories: AppCategory[] = [
  { id: 'system', name: 'System', icon: '⚙' },
  { id: 'utilities', name: 'Utilities', icon: '🔧' },
  { id: 'development', name: 'Development', icon: '⌨' },
  { id: 'collaboration', name: 'Collaboration', icon: '👥' },
  { id: 'agents', name: 'AI Agents', icon: '🤖' },
];

export const appRegistry: AppDefinition[] = [
  {
    id: 'text-editor',
    name: 'Text Editor',
    icon: '📝',
    category: 'development',
    description: 'Edit text files with syntax highlighting',
    component: TextEditor,
  },
  {
    id: 'file-manager',
    name: 'File Manager',
    icon: '📁',
    category: 'system',
    description: 'Browse and manage files (Nemo-style)',
    component: FileManager,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: '⬛',
    category: 'development',
    description: 'Command line terminal emulator',
    component: Terminal,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙',
    category: 'system',
    description: 'System settings and preferences',
    component: Settings,
    singleton: true,
  },
  {
    id: 'collab-editor',
    name: 'Collab Editor',
    icon: '👥',
    category: 'collaboration',
    description: 'Real-time collaborative text editor (ShareJS OT)',
    component: CollabEditor,
  },
  {
    id: 'system-monitor',
    name: 'System Monitor',
    icon: '📊',
    category: 'system',
    description: 'View system resource usage',
    component: SystemMonitor,
  },
  {
    id: 'docking-demo',
    name: 'Docking Demo',
    icon: '🔲',
    category: 'utilities',
    description: 'Demonstrate docking layout with split panes and tabs',
    component: DockingDemo,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🔢',
    category: 'utilities',
    description: 'Basic calculator',
    component: Calculator,
  },
  // AI Agents
  {
    id: 'codex',
    name: 'Codex',
    icon: '⬡',
    category: 'agents',
    description: 'OpenAI Codex CLI - cloud-based AI coding agent',
    component: CodexApp,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: '✦',
    category: 'agents',
    description: 'Anthropic Claude Code - agentic CLI for software engineering',
    component: ClaudeCodeApp,
  },
  {
    id: 'gemini-code',
    name: 'Gemini Code',
    icon: '✧',
    category: 'agents',
    description: 'Google Gemini Code Assist - AI-powered development',
    component: GeminiCodeApp,
  },
  {
    id: 'cursor-agent',
    name: 'Cursor Agent',
    icon: '▏',
    category: 'agents',
    description: 'Cursor AI Agent - intelligent code editor',
    component: CursorAgentApp,
  },
  {
    id: 'devin',
    name: 'Devin',
    icon: 'Ⓓ',
    category: 'agents',
    description: 'Devin by Cognition - autonomous software engineer',
    component: DevinApp,
  },
  {
    id: 'junie',
    name: 'Junie',
    icon: '⟨⟩',
    category: 'agents',
    description: 'JetBrains Junie - AI coding agent for IDEs',
    component: JunieApp,
  },
  {
    id: 'cody',
    name: 'Cody',
    icon: '✳',
    category: 'agents',
    description: 'Sourcegraph Cody - AI code assistant with code intelligence',
    component: CodyApp,
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: '📝',
    category: 'utilities',
    description: 'Markdown notes with rich export',
    component: NotesApp,
  },
  // Dev Tools - OAuth
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    category: 'development',
    description: 'GitHub - connect repositories and collaborate on code',
    component: GitHubApp,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    category: 'development',
    description: 'GitLab - DevOps platform for repositories and CI/CD',
    component: GitLabApp,
  },
];
