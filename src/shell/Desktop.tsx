// ============================================================
// Desktop Surface - Main workspace area
// Renders all windows for the active workspace
// ============================================================

import { createMemo, For } from 'solid-js';
import { desktop, updateWindowTitle, closeAppMenu } from '../core/store';
import { Window } from '../window/Window';
import { appRegistry } from '../apps/registry';
import type { WindowState } from '../core/types';
import './desktop.css';

function WindowWithApp(props: { win: WindowState }) {
  const app = () => appRegistry.find(a => a.id === props.win.appId);
  return (
    <>
      {(() => {
        const a = app();
        if (!a) return null;
        const AppComponent = a.component;
        const handleTitleChange = (title: string) => {
          updateWindowTitle(props.win.id, title);
        };
        return (
          <Window win={props.win}>
            <AppComponent windowId={props.win.id} onTitleChange={handleTitleChange} />
          </Window>
        );
      })()}
    </>
  );
}

export function Desktop() {
  const visibleWindows = createMemo(() => {
    const activeWs = desktop.workspaces.find(ws => ws.id === desktop.activeWorkspaceId);
    return (desktop.windows as WindowState[]).filter(
      w => activeWs?.windowIds.includes(w.id)
    );
  });

  return (
    <div
      class={`kasm-desktop ${!desktop.agentSidebarOpen ? 'kasm-desktop--no-sidebar' : ''}`}
      onPointerDown={() => closeAppMenu()}
    >
      <For each={visibleWindows()}>
        {(win) => <WindowWithApp win={win} />}
      </For>
    </div>
  );
}
