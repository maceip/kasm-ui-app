// ============================================================
// Notification Center - Cinnamon-style notifications
// Toast popups + notification tray in panel
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDesktopStore } from '../core/store';
import { formatTimeAgo } from '../lib/domUtils';
import type { Notification } from '../core/types';
import './notifications.css';

// Panel applet (bell icon with count)
export function NotificationApplet() {
  const notifications = useDesktopStore(s => s.notifications);
  const [showTray, setShowTray] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="kasm-notif-applet">
      <button
        className={`kasm-panel-btn ${unread > 0 ? 'kasm-panel-btn--active' : ''}`}
        onClick={() => setShowTray(!showTray)}
      >
        <span className="kasm-panel-btn__icon">{'\u{1F514}'}</span>
        <span className={`kasm-notif-applet__badge ${unread > 0 ? '' : 'kasm-notif-applet__badge--hidden'}`}>{unread || 0}</span>
      </button>
      {showTray && <NotificationTray onClose={() => setShowTray(false)} />}
    </div>
  );
}

function NotificationTray({ onClose }: { onClose: () => void }) {
  const notifications = useDesktopStore(s => s.notifications);
  const dismissNotification = useDesktopStore(s => s.dismissNotification);
  const markNotificationRead = useDesktopStore(s => s.markNotificationRead);
  const clearNotifications = useDesktopStore(s => s.clearNotifications);

  const handleClear = () => {
    clearNotifications();
    onClose();
  };

  return (
    <div className="kasm-notif-tray">
      <div className="kasm-notif-tray__header">
        <span>Notifications</span>
        {notifications.length > 0 && (
          <button className="kasm-notif-tray__clear" onClick={handleClear}>
            Clear all
          </button>
        )}
      </div>
      <div className="kasm-notif-tray__list">
        {notifications.length === 0 && (
          <div className="kasm-notif-tray__empty">No notifications</div>
        )}
        {notifications.map(n => (
          <div
            key={n.id}
            className={`kasm-notif-tray__item ${!n.read ? 'kasm-notif-tray__item--unread' : ''}`}
            onClick={() => markNotificationRead(n.id)}
          >
            <div className="kasm-notif-tray__item-header">
              {n.icon && <span>{n.icon}</span>}
              <span className="kasm-notif-tray__item-title">{n.title}</span>
              <button
                className="kasm-notif-tray__item-dismiss"
                onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
              >
                ✕
              </button>
            </div>
            <div className="kasm-notif-tray__item-body">{n.body}</div>
            <div className="kasm-notif-tray__item-time">
              {formatTimeAgo(n.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Toast popup manager
export function NotificationToasts() {
  const [toasts, setToasts] = useState<Notification[]>([]);

  const handleNotification = useCallback((notification: Notification) => {
    setToasts(prev => [notification, ...prev].slice(0, 5));
    const duration = notification.duration ?? (notification.urgency === 'critical' ? 8000 : 4000);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== notification.id));
      }, duration);
    }
  }, []);

  const prevNotifications = useRef<Notification[]>([]);
  const notifications = useDesktopStore(s => s.notifications);

  useEffect(() => {
    // Detect newly added notifications by comparing with previous snapshot
    const prev = prevNotifications.current;
    if (notifications.length > prev.length) {
      const newOnes = notifications.filter(n => !prev.some(p => p.id === n.id));
      newOnes.forEach(n => handleNotification(n));
    }
    prevNotifications.current = notifications;
  }, [notifications, handleNotification]);

  if (toasts.length === 0) return null;

  return (
    <div className="kasm-notif-toasts">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`kasm-notif-toast kasm-notif-toast--${toast.urgency}`}
        >
          <div className="kasm-notif-toast__header">
            {toast.icon && <span>{toast.icon}</span>}
            <span className="kasm-notif-toast__title">{toast.title}</span>
            <button
              className="kasm-notif-toast__close"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              ✕
            </button>
          </div>
          <div className="kasm-notif-toast__body">{toast.body}</div>
        </div>
      ))}
    </div>
  );
}

// formatTimeAgo is now in src/lib/domUtils.ts (framework-agnostic)
