// ============================================================
// Notification Slice - Notification state & actions
// ============================================================

import { v4 as uuid } from 'uuid';
import type { StateCreator } from 'zustand';
import type { Notification } from '../types';

export interface NotificationSlice {
  // State
  notifications: Notification[];

  // Actions
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  dismissNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

export const createNotificationSlice: StateCreator<NotificationSlice & Record<string, any>, [], [], NotificationSlice> = (set) => ({
  // === State ===
  notifications: [],

  // === Actions ===
  addNotification: (n) => {
    const id = `notif-${uuid()}`;
    const notification: Notification = {
      ...n,
      id,
      timestamp: Date.now(),
      read: false,
    };
    set((s: any) => ({
      notifications: [notification, ...s.notifications],
    }));
    return id;
  },

  dismissNotification: (id) => {
    set((s: any) => ({
      notifications: s.notifications.filter((n: Notification) => n.id !== id),
    }));
  },

  markNotificationRead: (id) => {
    set((s: any) => ({
      notifications: s.notifications.map((n: Notification) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
});
