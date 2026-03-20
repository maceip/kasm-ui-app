// ============================================================
// Notification Center - Cinnamon-style notifications
// Toast popups + notification tray in panel
// ============================================================

import { createSignal, createEffect, on, Show, For } from 'solid-js';
import { desktop, dismissNotification, markNotificationRead, clearNotifications } from '../core/store';
import { formatTimeAgo } from '../lib/domUtils';
import type { Notification } from '../core/types';
import './notifications.css';

// Panel applet (bell icon with count)
export function NotificationApplet() {
  const [showTray, setShowTray] = createSignal(false);
  const unread = () => desktop.notifications.filter(n => !n.read).length;

  return (
    <div class="kasm-notif-applet">
      <button
        class={`kasm-panel-btn ${unread() > 0 ? 'kasm-panel-btn--active' : ''}`}
        onClick={() => setShowTray(!showTray())}
      >
        <span class="kasm-panel-btn__icon">{'\u{1F514}'}</span>
        <span class={`kasm-notif-applet__badge ${unread() > 0 ? '' : 'kasm-notif-applet__badge--hidden'}`}>{unread() || 0}</span>
      </button>
      <Show when={showTray()}>
        <NotificationTray onClose={() => setShowTray(false)} />
      </Show>
    </div>
  );
}

function NotificationTray(props: { onClose: () => void }) {
  const handleClear = () => {
    clearNotifications();
    props.onClose();
  };

  return (
    <div class="kasm-notif-tray">
      <div class="kasm-notif-tray__header">
        <span>Notifications</span>
        <Show when={desktop.notifications.length > 0}>
          <button class="kasm-notif-tray__clear" onClick={handleClear}>
            Clear all
          </button>
        </Show>
      </div>
      <div class="kasm-notif-tray__list">
        <Show when={desktop.notifications.length === 0}>
          <div class="kasm-notif-tray__empty">No notifications</div>
        </Show>
        <For each={desktop.notifications}>
          {(n) => (
            <div
              class={`kasm-notif-tray__item ${!n.read ? 'kasm-notif-tray__item--unread' : ''}`}
              onClick={() => markNotificationRead(n.id)}
            >
              <div class="kasm-notif-tray__item-header">
                {n.icon && <span>{n.icon}</span>}
                <span class="kasm-notif-tray__item-title">{n.title}</span>
                <button
                  class="kasm-notif-tray__item-dismiss"
                  onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                >
                  {'\u2715'}
                </button>
              </div>
              <div class="kasm-notif-tray__item-body">{n.body}</div>
              <div class="kasm-notif-tray__item-time">
                {formatTimeAgo(n.timestamp)}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// Toast popup manager
export function NotificationToasts() {
  const [toasts, setToasts] = createSignal<Notification[]>([]);
  function handleNotification(notification: Notification) {
    setToasts(prev => [notification, ...prev].slice(0, 5));
    const duration = notification.duration ?? (notification.urgency === 'critical' ? 8000 : 4000);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== notification.id));
      }, duration);
    }
  }

  // Track notification IDs reactively; `on()` provides the previous value
  // so we never mutate external state outside the reactive graph.
  createEffect(on(
    () => desktop.notifications.map(n => n.id),
    (currentIds, prevIds) => {
      const prev = prevIds ?? [];
      const newOnes = desktop.notifications.filter(n => !prev.includes(n.id));
      newOnes.forEach(n => handleNotification(n));
    }
  ));

  return (
    <Show when={toasts().length > 0}>
      <div class="kasm-notif-toasts">
        <For each={toasts()}>
          {(toast) => (
            <div class={`kasm-notif-toast kasm-notif-toast--${toast.urgency}`}>
              <div class="kasm-notif-toast__header">
                {toast.icon && <span>{toast.icon}</span>}
                <span class="kasm-notif-toast__title">{toast.title}</span>
                <button
                  class="kasm-notif-toast__close"
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                >
                  {'\u2715'}
                </button>
              </div>
              <div class="kasm-notif-toast__body">{toast.body}</div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
