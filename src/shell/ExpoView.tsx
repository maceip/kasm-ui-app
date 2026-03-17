// ============================================================
// ExpoView - Expo and Scale view for workspace/window overview
// Expo: shows all workspaces side by side with miniature windows
// Scale: shows all windows in current workspace spread in a grid
// ============================================================

import { useEffect, useCallback } from 'react';
import { useDesktopStore } from '../core/store';
import './expoView.css';

export function ExpoView() {
  const expoMode = useDesktopStore(s => s.expoMode);
  const setExpoMode = useDesktopStore(s => s.setExpoMode);
  const workspaces = useDesktopStore(s => s.workspaces);
  const activeWorkspaceId = useDesktopStore(s => s.activeWorkspaceId);
  const windows = useDesktopStore(s => s.windows);
  const switchWorkspace = useDesktopStore(s => s.switchWorkspace);
  const focusWindow = useDesktopStore(s => s.focusWindow);
  const addWorkspace = useDesktopStore(s => s.addWorkspace);

  const close = useCallback(() => setExpoMode('off'), [setExpoMode]);

  // Close on Escape
  useEffect(() => {
    if (expoMode === 'off') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expoMode, close]);

  if (expoMode === 'off') return null;

  if (expoMode === 'expo') {
    return (
      <div className="kasm-expo-overlay kasm-expo-overlay--active" data-testid="expo-view" onClick={close}>
        <div className="kasm-expo-container" onClick={e => e.stopPropagation()}>
          <h2 className="kasm-expo-title">Workspaces</h2>
          <div className="kasm-expo-grid">
            {workspaces.map(ws => {
              const wsWindows = windows.filter(w => ws.windowIds.includes(w.id) && w.state !== 'minimized');
              const isActive = ws.id === activeWorkspaceId;
              return (
                <div
                  key={ws.id}
                  className={`kasm-expo-workspace ${isActive ? 'kasm-expo-workspace--active' : ''}`}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    close();
                  }}
                >
                  <div className="kasm-expo-workspace__preview">
                    {wsWindows.map(w => {
                      // Scale window positions to fit in the thumbnail
                      const scaleX = 200 / window.innerWidth;
                      const scaleY = 130 / window.innerHeight;
                      return (
                        <div
                          key={w.id}
                          className="kasm-expo-miniwindow"
                          style={{
                            left: w.x * scaleX,
                            top: w.y * scaleY,
                            width: w.width * scaleX,
                            height: w.height * scaleY,
                            backgroundColor: `hsl(${hashCode(w.appId) % 360}, 60%, 50%)`,
                            zIndex: w.zIndex,
                          }}
                          title={w.title}
                        >
                          <span className="kasm-expo-miniwindow__icon">{w.icon}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="kasm-expo-workspace__label">{ws.name}</div>
                </div>
              );
            })}
            <div className="kasm-expo-workspace kasm-expo-workspace--add" onClick={() => { addWorkspace(); }}>
              <div className="kasm-expo-workspace__preview kasm-expo-workspace__preview--add">
                <span className="kasm-expo-add-icon">+</span>
              </div>
              <div className="kasm-expo-workspace__label">New Workspace</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scale mode - show windows of current workspace in a grid
  const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
  const visibleWindows = windows.filter(
    w => activeWs?.windowIds.includes(w.id) && w.state !== 'minimized'
  );
  const cols = Math.ceil(Math.sqrt(visibleWindows.length));
  const rows = Math.ceil(visibleWindows.length / cols) || 1;

  return (
    <div className="kasm-expo-overlay kasm-expo-overlay--active" data-testid="scale-view" onClick={close}>
      <div className="kasm-scale-container" onClick={e => e.stopPropagation()}>
        <h2 className="kasm-expo-title">Windows</h2>
        <div
          className="kasm-scale-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {visibleWindows.map(w => (
            <div
              key={w.id}
              className={`kasm-scale-window ${w.focused ? 'kasm-scale-window--focused' : ''}`}
              onClick={() => {
                focusWindow(w.id);
                close();
              }}
            >
              <div className="kasm-scale-window__preview"
                style={{ backgroundColor: `hsl(${hashCode(w.appId) % 360}, 40%, 30%)` }}
              >
                <span className="kasm-scale-window__icon">{w.icon}</span>
              </div>
              <div className="kasm-scale-window__title">{w.title}</div>
            </div>
          ))}
          {visibleWindows.length === 0 && (
            <div className="kasm-scale-empty">No windows in this workspace</div>
          )}
        </div>
      </div>
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
