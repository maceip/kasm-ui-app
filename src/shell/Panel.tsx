// ============================================================
// Panel - Cinnamon-style taskbar with 3-zone layout
// Supports bottom/top positioning with applet slots
// Supports intellihide, always-hide, and never-hide modes
//
// SOLID 2.0 ALIGNMENT:
// - No useCallback (stable function identity)
// - Effect split into compute/apply phases
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useDesktopStore } from '../core/store';
import { AppMenuButton } from './AppMenu';
import { WindowList } from './WindowList';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SystemTray } from './SystemTray';
import { Clock } from './Clock';
import { NotificationApplet } from './NotificationCenter';
import { LocalFolderIndicator } from './LocalFolderIndicator';
import './panel.css';

// --- Portable overlap detection (framework-agnostic) ---
// Solid 2.0: this becomes the COMPUTE phase of a two-phase createEffect.
function computeOverlap(
  autohide: string,
  position: string,
  panelHeight: number,
  windows: { id: string; y: number; height: number; state: string }[],
  activeWindowIds: string[],
): boolean {
  if (autohide !== 'intellihide') return false;

  const panelTop = position === 'bottom'
    ? window.innerHeight - panelHeight
    : 0;
  const panelBottom = position === 'bottom'
    ? window.innerHeight
    : panelHeight;

  return windows.some(w => {
    if (!activeWindowIds.includes(w.id)) return false;
    if (w.state === 'minimized') return false;
    const winBottom = w.y + w.height;
    const winTop = w.y;
    if (position === 'bottom') {
      return winBottom > panelTop && winTop < panelBottom;
    } else {
      return winTop < panelBottom && winBottom > panelTop;
    }
  });
}

export function Panel() {
  const config = useDesktopStore(s => s.panelConfig);
  const windows = useDesktopStore(s => s.windows);
  const workspaces = useDesktopStore(s => s.workspaces);
  const activeWorkspaceId = useDesktopStore(s => s.activeWorkspaceId);
  const sidebarOpen = useDesktopStore(s => s.agentSidebarOpen);

  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // --- Autohide effect (compute/apply split) ---
  // Solid 2.0 pattern:
  //   createEffect(
  //     () => computeOverlap(config, windows, ...),  // COMPUTE: pure, tracked
  //     (shouldHide) => setHidden(shouldHide)          // APPLY: side effect
  //   )
  useEffect(() => {
    // COMPUTE phase
    let shouldHide: boolean;
    if (config.autohide === 'never') {
      shouldHide = false;
    } else if (config.autohide === 'always') {
      shouldHide = true;
    } else {
      const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
      const activeWindowIds = activeWs?.windowIds ?? [];
      shouldHide = computeOverlap(
        config.autohide, config.position, config.height,
        windows, activeWindowIds,
      );
    }
    // APPLY phase
    setHidden(shouldHide);
  }, [config.autohide, config.position, config.height, windows, workspaces, activeWorkspaceId]);

  const shouldSlide = hidden && !hovered;

  const isBottom = config.position === 'bottom';
  const translateValue = shouldSlide
    ? (isBottom ? `translateY(${config.height - 4}px)` : `translateY(-${config.height - 4}px)`)
    : 'translateY(0)';

  return (
    <>
      <div
        ref={panelRef}
        className={`kasm-panel kasm-panel--${config.position} ${shouldSlide ? 'kasm-panel--hidden' : ''} ${!sidebarOpen ? 'kasm-panel--no-sidebar' : ''}`}
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
