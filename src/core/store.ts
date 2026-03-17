// ============================================================
// Zustand Store - Composed from domain slices
// Each slice lives in ./slices/ for focused, maintainable code.
// This file composes them into a single store for backward compat.
// ============================================================

import { create } from 'zustand';
import { createWindowSlice, type WindowSlice } from './slices/windowSlice';
import { createWorkspaceSlice, type WorkspaceSlice } from './slices/workspaceSlice';
import { createShellSlice, type ShellSlice } from './slices/shellSlice';
import { createNotificationSlice, type NotificationSlice } from './slices/notificationSlice';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';

// Re-export slice types for consumers
export type { WindowSlice } from './slices/windowSlice';
export type { WorkspaceSlice } from './slices/workspaceSlice';
export type { ShellSlice, HotCornerAction, HotCornerActions } from './slices/shellSlice';
export type { NotificationSlice } from './slices/notificationSlice';
export type { ProjectSlice } from './slices/projectSlice';

export type DesktopStore =
  & WindowSlice
  & WorkspaceSlice
  & ShellSlice
  & NotificationSlice
  & ProjectSlice;

export const useDesktopStore = create<DesktopStore>()((...a) => ({
  ...createWindowSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createShellSlice(...a),
  ...createNotificationSlice(...a),
  ...createProjectSlice(...a),
}));
