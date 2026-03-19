// ============================================================
// Desktop Surface - Main workspace area
// Renders all windows for the active workspace
//
// SOLID 2.0 ALIGNMENT:
// - No memo() (Solid components don't re-render)
// - No useCallback() (stable function identity)
// - .map() → <For each={...}> in Solid, with accessor children
// ============================================================

import { useDesktopStore } from '../core/store';
import { Window } from '../window/Window';
import { appRegistry } from '../apps/registry';
import type { WindowState } from '../core/types';
import './desktop.css';

// No memo() — Solid components run once. Removing makes port mechanical.
function WindowWithApp(props: { win: WindowState }) {
  const app = appRegistry.find(a => a.id === props.win.appId);
  if (!app) return null;
  const AppComponent = app.component;
  // No useCallback — function identity is stable in Solid.
  const handleTitleChange = (title: string) => {
    useDesktopStore.getState().updateWindowTitle(props.win.id, title);
  };
  return (
    <Window win={props.win}>
      <AppComponent windowId={props.win.id} onTitleChange={handleTitleChange} />
    </Window>
  );
}

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
      {/* Solid 2.0: <For each={visibleWindows}>{(win) => <WindowWithApp win={win()} />}</For> */}
      {visibleWindows.map(win => (
        <WindowWithApp key={win.id} win={win} />
      ))}
    </div>
  );
}
