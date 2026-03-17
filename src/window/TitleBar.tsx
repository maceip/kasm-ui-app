// ============================================================
// TitleBar - Window title bar with controls
// Combines: React Desktop's TitleBar (OS-native look),
// Golden Layout's header controls, rc-dock's panel header
// ============================================================

import { memo } from 'react';
import { useDesktopStore } from '../core/store';
import { PopoutButton } from './PopoutWindow';
import type { WindowState } from '../core/types';

interface TitleBarProps {
  win: WindowState;
  onDragStart: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onPopout?: () => void;
}

export const TitleBar = memo(function TitleBar({ win, onDragStart, onDoubleClick, onPopout }: TitleBarProps) {
  const isMaximized = win.state === 'maximized' || win.state.startsWith('snapped');

  return (
    <div
      className={`kasm-titlebar ${win.focused ? 'kasm-titlebar--focused' : ''}`}
      onMouseDown={onDragStart}
      onDoubleClick={onDoubleClick}
    >
      <div className="kasm-titlebar__left">
        {win.icon && <span className="kasm-titlebar__icon">{win.icon}</span>}
        <span className="kasm-titlebar__title">{win.title}</span>
      </div>

      <div className="kasm-titlebar__controls" onMouseDown={e => e.stopPropagation()}>
        {win.minimizable && (
          <button
            className="kasm-titlebar__btn kasm-titlebar__btn--minimize"
            onClick={() => useDesktopStore.getState().minimizeWindow(win.id)}
            title="Minimize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        )}
        {win.maximizable && (
          <button
            className="kasm-titlebar__btn kasm-titlebar__btn--maximize"
            onClick={() => isMaximized ? useDesktopStore.getState().restoreWindow(win.id) : useDesktopStore.getState().maximizeWindow(win.id)}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1.5" y="3" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
                <polyline points="3,3 3,1.5 8.5,1.5 8.5,7 7,7" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            )}
          </button>
        )}
        {onPopout && (
          <PopoutButton
            onClick={onPopout}
            className="kasm-titlebar__btn"
          />
        )}
        {win.closable && (
          <button
            className="kasm-titlebar__btn kasm-titlebar__btn--close"
            onClick={() => useDesktopStore.getState().closeWindow(win.id)}
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
