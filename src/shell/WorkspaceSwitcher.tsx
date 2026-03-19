// ============================================================
// Workspace Switcher - Cinnamon-style workspace thumbnails
// ============================================================

import { For } from 'solid-js';
import { desktop, switchWorkspace } from '../core/store';
import type { WindowState } from '../core/types';
import './workspaceSwitcher.css';

export function WorkspaceSwitcher() {
  return (
    <div class="kasm-workspace-switcher">
      <For each={desktop.workspaces}>
        {(ws, i) => {
          const wsWindows = () => (desktop.windows as WindowState[]).filter(w => ws.windowIds.includes(w.id) && w.state !== 'minimized');
          return (
            <button
              class={`kasm-workspace-switcher__item ${ws.id === desktop.activeWorkspaceId ? 'kasm-workspace-switcher__item--active' : ''}`}
              onClick={() => switchWorkspace(ws.id)}
              title={ws.name}
            >
              <span class="kasm-workspace-switcher__index">{i() + 1}</span>
              {wsWindows().length > 0 && (
                <span class="kasm-workspace-switcher__dot" />
              )}
            </button>
          );
        }}
      </For>
    </div>
  );
}
