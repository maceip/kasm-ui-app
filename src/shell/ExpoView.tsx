// ============================================================
// ExpoView - Expo and Scale view for workspace/window overview
// ============================================================

import { createEffect, onCleanup, Show, For, createMemo } from 'solid-js';
import { desktop, setExpoMode, switchWorkspace, focusWindow, addWorkspace } from '../core/store';
import type { WindowState } from '../core/types';
import './expoView.css';

export function ExpoView() {
  const close = () => setExpoMode('off');

  // Escape key handler
  createEffect(() => {
    if (desktop.expoMode === 'off') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    onCleanup(() => window.removeEventListener('keydown', handler));
  });

  const activeWs = () => desktop.workspaces.find(ws => ws.id === desktop.activeWorkspaceId);
  const visibleWindows = createMemo(() =>
    (desktop.windows as WindowState[]).filter(
      w => activeWs()?.windowIds.includes(w.id) && w.state !== 'minimized'
    )
  );
  const cols = () => Math.ceil(Math.sqrt(visibleWindows().length));
  const rows = () => Math.ceil(visibleWindows().length / cols()) || 1;

  return (
    <Show when={desktop.expoMode !== 'off'}>
      <Show when={desktop.expoMode === 'expo'} fallback={
        // Scale mode
        <div class="kasm-expo-overlay kasm-expo-overlay--active" data-testid="scale-view" onClick={close}>
          <div class="kasm-scale-container" onClick={e => e.stopPropagation()}>
            <h2 class="kasm-expo-title">Windows</h2>
            <div
              class="kasm-scale-grid"
              style={{
                "grid-template-columns": `repeat(${cols()}, 1fr)`,
                "grid-template-rows": `repeat(${rows()}, 1fr)`,
              }}
            >
              <For each={visibleWindows()}>
                {(w) => (
                  <div
                    class={`kasm-scale-window ${w.focused ? 'kasm-scale-window--focused' : ''}`}
                    onClick={() => { focusWindow(w.id); close(); }}
                  >
                    <div class="kasm-scale-window__preview"
                      style={{ "background-color": `hsl(${hashCode(w.appId) % 360}, 40%, 30%)` }}
                    >
                      <span class="kasm-scale-window__icon">{w.icon}</span>
                    </div>
                    <div class="kasm-scale-window__title">{w.title}</div>
                  </div>
                )}
              </For>
              <Show when={visibleWindows().length === 0}>
                <div class="kasm-scale-empty">No windows in this workspace</div>
              </Show>
            </div>
          </div>
        </div>
      }>
        {/* Expo mode */}
        <div class="kasm-expo-overlay kasm-expo-overlay--active" data-testid="expo-view" onClick={close}>
          <div class="kasm-expo-container" onClick={e => e.stopPropagation()}>
            <h2 class="kasm-expo-title">Workspaces</h2>
            <div class="kasm-expo-grid">
              <For each={desktop.workspaces}>
                {(ws) => {
                  const wsWindows = () => (desktop.windows as WindowState[]).filter(w => ws.windowIds.includes(w.id) && w.state !== 'minimized');
                  const isActive = () => ws.id === desktop.activeWorkspaceId;
                  return (
                    <div
                      class={`kasm-expo-workspace ${isActive() ? 'kasm-expo-workspace--active' : ''}`}
                      onClick={() => { switchWorkspace(ws.id); close(); }}
                    >
                      <div class="kasm-expo-workspace__preview">
                        <For each={wsWindows()}>
                          {(w) => {
                            const scaleX = 200 / window.innerWidth;
                            const scaleY = 130 / window.innerHeight;
                            return (
                              <div
                                class="kasm-expo-miniwindow"
                                style={{
                                  left: `${w.x * scaleX}px`,
                                  top: `${w.y * scaleY}px`,
                                  width: `${w.width * scaleX}px`,
                                  height: `${w.height * scaleY}px`,
                                  "background-color": `hsl(${hashCode(w.appId) % 360}, 60%, 50%)`,
                                  "z-index": w.zIndex,
                                }}
                                title={w.title}
                              >
                                <span class="kasm-expo-miniwindow__icon">{w.icon}</span>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                      <div class="kasm-expo-workspace__label">{ws.name}</div>
                    </div>
                  );
                }}
              </For>
              <div class="kasm-expo-workspace kasm-expo-workspace--add" onClick={() => addWorkspace()}>
                <div class="kasm-expo-workspace__preview kasm-expo-workspace__preview--add">
                  <span class="kasm-expo-add-icon">+</span>
                </div>
                <div class="kasm-expo-workspace__label">New Workspace</div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </Show>
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
