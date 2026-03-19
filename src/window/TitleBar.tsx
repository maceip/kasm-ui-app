// ============================================================
// TitleBar - Window title bar with controls
// ============================================================

import { Show } from 'solid-js';
import { minimizeWindow, maximizeWindow, restoreWindow, closeWindow } from '../core/store';
import { PopoutButton } from './PopoutWindow';
import type { WindowState } from '../core/types';

interface TitleBarProps {
  win: WindowState;
  onDragStart: (e: MouseEvent) => void;
  onDoubleClick: () => void;
  onPopout?: () => void;
}

export function TitleBar(props: TitleBarProps) {
  const isMaximized = () => props.win.state === 'maximized' || props.win.state.startsWith('snapped');

  return (
    <div
      class={`kasm-titlebar ${props.win.focused ? 'kasm-titlebar--focused' : ''}`}
      onMouseDown={props.onDragStart}
      onDblClick={props.onDoubleClick}
    >
      <div class="kasm-titlebar__left">
        <Show when={props.win.icon}>
          <span class="kasm-titlebar__icon">{props.win.icon}</span>
        </Show>
        <span class="kasm-titlebar__title">{props.win.title}</span>
      </div>

      <div class="kasm-titlebar__controls" onMouseDown={e => e.stopPropagation()}>
        <Show when={props.win.minimizable}>
          <button
            class="kasm-titlebar__btn kasm-titlebar__btn--minimize"
            onClick={() => minimizeWindow(props.win.id)}
            title="Minimize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </button>
        </Show>
        <Show when={props.win.maximizable}>
          <button
            class="kasm-titlebar__btn kasm-titlebar__btn--maximize"
            onClick={() => isMaximized() ? restoreWindow(props.win.id) : maximizeWindow(props.win.id)}
            title={isMaximized() ? 'Restore' : 'Maximize'}
          >
            <Show when={isMaximized()} fallback={
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1" y="1" width="8" height="8" stroke="currentColor" stroke-width="1.2" fill="none" />
              </svg>
            }>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1.5" y="3" width="5.5" height="5.5" stroke="currentColor" stroke-width="1" fill="none" />
                <polyline points="3,3 3,1.5 8.5,1.5 8.5,7 7,7" stroke="currentColor" stroke-width="1" fill="none" />
              </svg>
            </Show>
          </button>
        </Show>
        <Show when={props.onPopout}>
          <PopoutButton
            onClick={props.onPopout!}
            className="kasm-titlebar__btn"
          />
        </Show>
        <Show when={props.win.closable}>
          <button
            class="kasm-titlebar__btn kasm-titlebar__btn--close"
            onClick={() => closeWindow(props.win.id)}
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </button>
        </Show>
      </div>
    </div>
  );
}
