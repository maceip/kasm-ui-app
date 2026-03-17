// ============================================================
// Project Slice - Multi-agent orchestration state & actions
// ============================================================

import { v4 as uuid } from 'uuid';
import type { StateCreator } from 'zustand';
import type {
  Project, AgentSession, AgentTask, AgentBackend, GitNode,
} from '../types';

export interface ProjectSlice {
  // State
  projects: Project[];
  activeProjectId: string | null;

  // Actions
  createProject: (name: string, path: string) => string;
  removeProject: (id: string) => void;
  setActiveProject: (id: string) => void;
  spawnAgent: (projectId: string, backend: AgentBackend, name?: string) => string;
  updateAgent: (projectId: string, agentId: string, updates: Partial<AgentSession>) => void;
  removeAgent: (projectId: string, agentId: string) => void;
  setActiveAgent: (projectId: string, agentId: string) => void;
  createTask: (projectId: string, title: string, description?: string) => string;
  updateTask: (projectId: string, taskId: string, updates: Partial<AgentTask>) => void;
  assignTask: (projectId: string, taskId: string, agentId: string) => void;
  updateGitNodes: (projectId: string, nodes: GitNode[]) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice & Record<string, any>, [], [], ProjectSlice> = (set) => ({
  // === State ===
  projects: [],
  activeProjectId: null,

  // === Actions ===
  createProject: (name, path) => {
    const id = uuid();
    const project: Project = {
      id, name, path,
      agents: [], tasks: [], gitNodes: [],
    };
    set((s: any) => ({
      projects: [...s.projects, project],
      activeProjectId: s.activeProjectId ?? id,
    }));
    return id;
  },

  removeProject: (id) => {
    set((s: any) => ({
      projects: s.projects.filter((p: Project) => p.id !== id),
      activeProjectId: s.activeProjectId === id
        ? (s.projects.find((p: Project) => p.id !== id)?.id ?? null)
        : s.activeProjectId,
    }));
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  spawnAgent: (projectId, backend, name) => {
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
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? { ...p, agents: [...p.agents, session] } : p
      ),
    }));
    return id;
  },

  updateAgent: (projectId, agentId, updates) => {
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? {
          ...p,
          agents: p.agents.map(a => a.id === agentId ? { ...a, ...updates, lastActivity: Date.now() } : a),
        } : p
      ),
    }));
  },

  removeAgent: (projectId, agentId) => {
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? {
          ...p,
          agents: p.agents.filter(a => a.id !== agentId),
          activeAgentId: p.activeAgentId === agentId ? undefined : p.activeAgentId,
        } : p
      ),
    }));
  },

  setActiveAgent: (projectId, agentId) => {
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? { ...p, activeAgentId: agentId } : p
      ),
    }));
  },

  createTask: (projectId, title, description) => {
    const id = uuid();
    const task: AgentTask = {
      id, title, description,
      status: 'todo', filesChanged: [],
      createdAt: Date.now(),
    };
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
      ),
    }));
    return id;
  },

  updateTask: (projectId, taskId, updates) => {
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
        } : p
      ),
    }));
  },

  assignTask: (projectId, taskId, agentId) => {
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? {
          ...p,
          tasks: p.tasks.map(t =>
            t.id === taskId ? { ...t, assignedAgentId: agentId, status: 'assigned' } : t
          ),
          agents: p.agents.map(a =>
            a.id === agentId ? { ...a, taskId, status: 'working' } : a
          ),
        } : p
      ),
    }));
  },

  updateGitNodes: (projectId, nodes) => {
    set((s: any) => ({
      projects: s.projects.map((p: Project) =>
        p.id === projectId ? { ...p, gitNodes: nodes } : p
      ),
    }));
  },
});
