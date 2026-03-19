// ============================================================
// Window List - Cinnamon-style taskbar window buttons
// Shows running apps in the active workspace
// ============================================================

import { createMemo, For } from 'solid-js';
import { desktop, focusWindow, minimizeWindow } from '../core/store';
import type { WindowState } from '../core/types';

export function WindowList() {
  const visibleWindows = createMemo(() => {
    const activeWs = desktop.workspaces.find(ws => ws.id === desktop.activeWorkspaceId);
    return (desktop.windows as WindowState[]).filter(w => activeWs?.windowIds.includes(w.id));
  });

  return (
    <>
      <For each={visibleWindows()}>
        {(win) => (
          <button
            class={`kasm-panel-btn ${win.focused ? 'kasm-panel-btn--focused' : ''} ${win.state === 'minimized' ? '' : 'kasm-panel-btn--active'}`}
            onClick={() => {
              if (win.focused && win.state !== 'minimized') {
                minimizeWindow(win.id);
              } else {
                focusWindow(win.id);
              }
            }}
            title={win.title}
            style={{ "max-width": '180px' }}
          >
            <span class="kasm-panel-btn__icon">{win.icon}</span>
            <span style={{ overflow: 'hidden', "text-overflow": 'ellipsis' }}>{win.title}</span>
          </button>
        )}
      </For>
    </>
  );
}
