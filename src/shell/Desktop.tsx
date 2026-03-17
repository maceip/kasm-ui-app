// ============================================================
// Desktop Surface - Main workspace area
// Renders all windows for the active workspace
// ============================================================

import { memo, useCallback } from 'react';
import { useDesktopStore } from '../core/store';
import { Window } from '../window/Window';
import { appRegistry } from '../apps/registry';
import type { WindowState } from '../core/types';
import './desktop.css';

const WindowWithApp = memo(function WindowWithApp({ win }: { win: WindowState }) {
  const app = appRegistry.find(a => a.id === win.appId);
  if (!app) return null;
  const AppComponent = app.component;
  const handleTitleChange = useCallback((title: string) => {
    useDesktopStore.getState().updateWindowTitle(win.id, title);
  }, [win.id]);
  return (
    <Window win={win}>
      <AppComponent windowId={win.id} onTitleChange={handleTitleChange} />
    </Window>
  );
});

export function Desktop() {
  const windows = useDesktopStore(s => s.windows);
  const activeWorkspaceId = useDesktopStore(s => s.activeWorkspaceId);
  const workspaces = useDesktopStore(s => s.workspaces);
  const sidebarOpen = useDesktopStore(s => s.agentSidebarOpen);
  const closeAppMenu = useDesktopStore(s => s.closeAppMenu);

  const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
  const visibleWindows = windows.filter(
    w => activeWs?.windowIds.includes(w.id)
  );

  return (
    <div className={`kasm-desktop ${!sidebarOpen ? 'kasm-desktop--no-sidebar' : ''}`} onMouseDown={closeAppMenu}>
      {visibleWindows.map(win => (
        <WindowWithApp key={win.id} win={win} />
      ))}

      {/* Clean empty desktop - no branding overlay */}
    </div>
  );
}
