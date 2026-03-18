// ============================================================
// Window List - Cinnamon-style taskbar window buttons
// Shows running apps in the active workspace
// ============================================================

import { useDesktopStore } from '../core/store';

export function WindowList() {
  const windows = useDesktopStore(s => s.windows);
  const activeWorkspaceId = useDesktopStore(s => s.activeWorkspaceId);
  const workspaces = useDesktopStore(s => s.workspaces);

  const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
  const visibleWindows = windows.filter(w => activeWs?.windowIds.includes(w.id));

  return (
    <>
      {visibleWindows.map(win => (
        <button
          key={win.id}
          className={`kasm-panel-btn ${win.focused ? 'kasm-panel-btn--focused' : ''} ${win.state === 'minimized' ? '' : 'kasm-panel-btn--active'}`}
          onClick={() => {
            if (win.focused && win.state !== 'minimized') {
              useDesktopStore.getState().minimizeWindow(win.id);
            } else {
              useDesktopStore.getState().focusWindow(win.id);
            }
          }}
          title={win.title}
          style={{ maxWidth: 180 }}
        >
          <span className="kasm-panel-btn__icon">{win.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{win.title}</span>
        </button>
      ))}
    </>
  );
}
