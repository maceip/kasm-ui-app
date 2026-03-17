// ============================================================
// Panel - Cinnamon-style taskbar with 3-zone layout
// Supports bottom/top positioning with applet slots
// Supports intellihide, always-hide, and never-hide modes
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDesktopStore } from '../core/store';
import { AppMenuButton } from './AppMenu';
import { WindowList } from './WindowList';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SystemTray } from './SystemTray';
import { Clock } from './Clock';
import { NotificationApplet } from './NotificationCenter';
import { LocalFolderIndicator } from './LocalFolderIndicator';
import './panel.css';

export function Panel() {
  const config = useDesktopStore(s => s.panelConfig);
  const windows = useDesktopStore(s => s.windows);
  const workspaces = useDesktopStore(s => s.workspaces);
  const activeWorkspaceId = useDesktopStore(s => s.activeWorkspaceId);

  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Detect if any window overlaps the panel (for intellihide)
  const checkOverlap = useCallback(() => {
    if (config.autohide !== 'intellihide') return false;

    const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
    if (!activeWs) return false;

    const panelTop = config.position === 'bottom'
      ? window.innerHeight - config.height
      : 0;
    const panelBottom = config.position === 'bottom'
      ? window.innerHeight
      : config.height;

    return windows.some(w => {
      if (!activeWs.windowIds.includes(w.id)) return false;
      if (w.state === 'minimized') return false;

      const winBottom = w.y + w.height;
      const winTop = w.y;

      // Check vertical overlap with panel
      if (config.position === 'bottom') {
        return winBottom > panelTop && winTop < panelBottom;
      } else {
        return winTop < panelBottom && winBottom > panelTop;
      }
    });
  }, [config, windows, workspaces, activeWorkspaceId]);

  useEffect(() => {
    if (config.autohide === 'never') {
      setHidden(false);
      return;
    }
    if (config.autohide === 'always') {
      setHidden(true);
      return;
    }
    // intellihide
    setHidden(checkOverlap());
  }, [config.autohide, checkOverlap]);

  const shouldSlide = hidden && !hovered;

  const isBottom = config.position === 'bottom';
  const translateValue = shouldSlide
    ? (isBottom ? `translateY(${config.height - 4}px)` : `translateY(-${config.height - 4}px)`)
    : 'translateY(0)';

  return (
    <>
      <div
        ref={panelRef}
        className={`kasm-panel kasm-panel--${config.position} ${shouldSlide ? 'kasm-panel--hidden' : ''}`}
        style={{
          height: config.height,
          transform: translateValue,
        }}
        data-testid="kasm-panel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="kasm-panel__zone kasm-panel__zone--left">
          <AppMenuButton />
        </div>
        <div className="kasm-panel__zone kasm-panel__zone--center">
          <WindowList />
        </div>
        <div className="kasm-panel__zone kasm-panel__zone--right">
          <WorkspaceSwitcher />
          <LocalFolderIndicator />
          <SystemTray />
          <Clock />
          <NotificationApplet />
        </div>
      </div>
      {/* Thin trigger strip at panel edge for hover reveal */}
      {hidden && !hovered && (
        <div
          className={`kasm-panel-trigger kasm-panel-trigger--${config.position}`}
          onMouseEnter={() => setHovered(true)}
        />
      )}
    </>
  );
}
