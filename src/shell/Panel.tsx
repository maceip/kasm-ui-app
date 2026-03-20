// ============================================================
// Panel - Cinnamon-style taskbar with 3-zone layout
// Supports bottom/top positioning with applet slots
// Supports intellihide, always-hide, and never-hide modes
// ============================================================

import { createSignal, createMemo } from 'solid-js';
import { desktop } from '../core/store';
import { AppMenuButton } from './AppMenu';
import { WindowList } from './WindowList';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SystemTray } from './SystemTray';
import { Clock } from './Clock';
import { NotificationApplet } from './NotificationCenter';
import { LocalFolderIndicator } from './LocalFolderIndicator';
import type { WindowState } from '../core/types';
import './panel.css';

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
  const [hovered, setHovered] = createSignal(false);

  const hidden = createMemo(() => {
    const config = desktop.panelConfig;
    if (config.autohide === 'never') return false;
    if (config.autohide === 'always') return true;
    const activeWs = desktop.workspaces.find(ws => ws.id === desktop.activeWorkspaceId);
    const activeWindowIds = activeWs?.windowIds ?? [];
    return computeOverlap(
      config.autohide, config.position, config.height,
      desktop.windows as WindowState[], activeWindowIds,
    );
  });

  const shouldSlide = () => hidden() && !hovered();

  const translateValue = () => {
    if (!shouldSlide()) return 'translateY(0)';
    const isBottom = desktop.panelConfig.position === 'bottom';
    return isBottom
      ? `translateY(${desktop.panelConfig.height - 4}px)`
      : `translateY(-${desktop.panelConfig.height - 4}px)`;
  };

  return (
    <>
      <div
        class={`kasm-panel kasm-panel--${desktop.panelConfig.position} ${shouldSlide() ? 'kasm-panel--hidden' : ''} ${!desktop.agentSidebarOpen ? 'kasm-panel--no-sidebar' : ''}`}
        style={{
          height: `${desktop.panelConfig.height}px`,
          transform: translateValue(),
        }}
        data-testid="kasm-panel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div class="kasm-panel__zone kasm-panel__zone--left">
          <AppMenuButton />
        </div>
        <div class="kasm-panel__zone kasm-panel__zone--center">
          <WindowList />
        </div>
        <div class="kasm-panel__zone kasm-panel__zone--right">
          <WorkspaceSwitcher />
          <LocalFolderIndicator />
          <SystemTray />
          <Clock />
          <NotificationApplet />
        </div>
      </div>
      {hidden() && !hovered() && (
        <div
          class={`kasm-panel-trigger kasm-panel-trigger--${desktop.panelConfig.position}`}
          onMouseEnter={() => setHovered(true)}
        />
      )}
    </>
  );
}
