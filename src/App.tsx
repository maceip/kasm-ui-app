// ============================================================
// App Root - Kasm UI Desktop Environment
// Combines all systems into a unified desktop experience
// ============================================================

import { createEffect, onCleanup } from 'solid-js';
import { ThemeProvider } from './theme/ThemeProvider';
import { CollabProvider } from './collab/CollabProvider';
import { Desktop } from './shell/Desktop';
import { Panel } from './shell/Panel';
import { AppMenu } from './shell/AppMenu';
import { NotificationToasts } from './shell/NotificationCenter';
import { ExpoView } from './shell/ExpoView';
import { HotCorners } from './shell/HotCorners';
import { AgentSidebar, AgentFAB } from './shell/AgentSidebar';
import {
  desktop, addNotification, switchWorkspace, setExpoMode,
  createWindow,
} from './core/store';
import { setupPersistence } from './core/persistence';
import { appRegistry } from './apps/registry';
import { vfs } from './apps/vfs';
import './styles/global.css';

function spawnWindows(count: number) {
  const apps = appRegistry.filter(a => !a.singleton);
  const cols = 10;
  for (let i = 0; i < count; i++) {
    const app = apps[i % apps.length];
    const col = i % cols;
    const row = Math.floor(i / cols);
    createWindow(app, {
      x: 20 + col * 60,
      y: 20 + row * 40,
      width: 400,
      height: 300,
      focused: false,
    });
  }
}

export default function App() {
  // Set up layout persistence (auto-save/load)
  setupPersistence();

  // VFS: restore from OPFS on mount, auto-persist every 5s
  vfs.restoreState();
  const stop = vfs.startAutoPersist(5000);
  onCleanup(() => stop());

  // Expose panel config as CSS custom properties / data attributes
  createEffect(() => {
    document.documentElement.dataset.panelPosition = desktop.panelConfig.position;
    document.documentElement.style.setProperty('--kasm-panel-h', `${desktop.panelConfig.height}px`);
  });

  // Spawn N windows on startup via ?spawn=N (default 100)
  const spawnParam = new URLSearchParams(window.location.search).get('spawn');
  const spawnCount = spawnParam === null ? 100 : parseInt(spawnParam, 10);
  if (spawnCount > 0) spawnWindows(spawnCount);

  // Welcome notification on first load
  const timer1 = setTimeout(() => {
    addNotification({
      title: 'Welcome to Kasm UI',
      body: 'A bleeding-edge SolidJS desktop environment. Open the Apps menu to explore!',
      icon: '\u25C6',
      urgency: 'normal',
    });
  }, 1500);

  const timer2 = setTimeout(() => {
    if ('showDirectoryPicker' in window) {
      addNotification({
        title: 'Connect a local folder',
        body: 'Click the folder icon in the panel to give Kasm access to a local directory. Your files will appear in the File Manager.',
        icon: '\u{1F4C2}',
        urgency: 'low',
        duration: 8000,
      });
    }
  }, 4000);

  onCleanup(() => { clearTimeout(timer1); clearTimeout(timer2); });

  // Keyboard shortcuts (Cinnamon-style)
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.altKey) {
      const wsIdx = desktop.workspaces.findIndex(ws => ws.id === desktop.activeWorkspaceId);
      if (e.key === 'ArrowRight' && wsIdx < desktop.workspaces.length - 1) {
        switchWorkspace(desktop.workspaces[wsIdx + 1].id);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && wsIdx > 0) {
        switchWorkspace(desktop.workspaces[wsIdx - 1].id);
        e.preventDefault();
      }
      if (e.key === 'ArrowUp') {
        setExpoMode(desktop.expoMode === 'expo' ? 'off' : 'expo');
        e.preventDefault();
      }
      if (e.key === 'ArrowDown') {
        setExpoMode(desktop.expoMode === 'scale' ? 'off' : 'scale');
        e.preventDefault();
      }
    }
  };
  window.addEventListener('keydown', handler);
  onCleanup(() => window.removeEventListener('keydown', handler));

  return (
    <ThemeProvider>
      <CollabProvider>
        <AgentSidebar />
        <AgentFAB />
        <Desktop />
        <Panel />
        <AppMenu />
        <NotificationToasts />
        <ExpoView />
        <HotCorners />
      </CollabProvider>
    </ThemeProvider>
  );
}
