// ============================================================
// Workspace Slice - Workspace management state & actions
// ============================================================

import { v4 as uuid } from 'uuid';
import type { StateCreator } from 'zustand';
import type { Workspace } from '../types';

const defaultWorkspaces: Workspace[] = [
  { id: 'ws-1', name: 'Workspace 1', windowIds: [] },
  { id: 'ws-2', name: 'Workspace 2', windowIds: [] },
  { id: 'ws-3', name: 'Workspace 3', windowIds: [] },
  { id: 'ws-4', name: 'Workspace 4', windowIds: [] },
];

export interface WorkspaceSlice {
  // State
  workspaces: Workspace[];
  activeWorkspaceId: string;

  // Actions
  switchWorkspace: (id: string) => void;
  addWorkspace: () => void;
  removeWorkspace: (id: string) => void;
}

export const createWorkspaceSlice: StateCreator<WorkspaceSlice & Record<string, any>, [], [], WorkspaceSlice> = (set) => ({
  // === State ===
  workspaces: defaultWorkspaces,
  activeWorkspaceId: 'ws-1',

  // === Actions ===
  switchWorkspace: (id) => {
    set({ activeWorkspaceId: id });
  },

  addWorkspace: () => {
    const id = `ws-${uuid()}`;
    set((s: any) => ({
      workspaces: [...s.workspaces, {
        id,
        name: `Workspace ${s.workspaces.length + 1}`,
        windowIds: [],
      }],
    }));
  },

  removeWorkspace: (id) => {
    set((s: any) => {
      if (s.workspaces.length <= 1) return s;
      const ws = s.workspaces.find((w: Workspace) => w.id === id);
      const remaining = s.workspaces.filter((w: Workspace) => w.id !== id);
      const targetWs = remaining[0];
      return {
        workspaces: remaining.map((w: Workspace) =>
          w.id === targetWs.id
            ? { ...w, windowIds: [...w.windowIds, ...(ws?.windowIds ?? [])] }
            : w
        ),
        activeWorkspaceId: s.activeWorkspaceId === id ? targetWs.id : s.activeWorkspaceId,
      };
    });
  },
});
