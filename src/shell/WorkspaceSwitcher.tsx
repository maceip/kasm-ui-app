// ============================================================
// Workspace Switcher - Cinnamon-style workspace thumbnails
// ============================================================

import { useDesktopStore } from '../core/store';
import './workspaceSwitcher.css';

export function WorkspaceSwitcher() {
  const workspaces = useDesktopStore(s => s.workspaces);
  const activeWorkspaceId = useDesktopStore(s => s.activeWorkspaceId);
  const windows = useDesktopStore(s => s.windows);
  const { switchWorkspace } = useDesktopStore();

  return (
    <div className="kasm-workspace-switcher">
      {workspaces.map((ws, i) => {
        const wsWindows = windows.filter(w => ws.windowIds.includes(w.id) && w.state !== 'minimized');
        return (
          <button
            key={ws.id}
            className={`kasm-workspace-switcher__item ${ws.id === activeWorkspaceId ? 'kasm-workspace-switcher__item--active' : ''}`}
            onClick={() => switchWorkspace(ws.id)}
            title={ws.name}
          >
            <span className="kasm-workspace-switcher__index">{i + 1}</span>
            {wsWindows.length > 0 && (
              <span className="kasm-workspace-switcher__dot" />
            )}
          </button>
        );
      })}
    </div>
  );
}
