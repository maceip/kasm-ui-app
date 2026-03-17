// ============================================================
// App Root - Kasm UI Desktop Environment
// Combines all systems into a unified desktop experience
// ============================================================

import { useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { CollabProvider } from './collab/CollabProvider';
import { Desktop } from './shell/Desktop';
import { Panel } from './shell/Panel';
import { AppMenu } from './shell/AppMenu';
import { NotificationToasts } from './shell/NotificationCenter';
import { ExpoView } from './shell/ExpoView';
import { HotCorners } from './shell/HotCorners';
import { AgentSidebar, AgentFAB } from './shell/AgentSidebar';
import { useDesktopStore } from './core/store';
import { usePersistence } from './core/persistence';
import { vfs } from './apps/vfs';
import './styles/global.css';

export default function App() {
  const panelConfig = useDesktopStore(s => s.panelConfig);

  // Set up layout persistence (auto-save/load)
  usePersistence();

  // VFS: restore from OPFS on mount, auto-persist every 5s
  useEffect(() => {
    vfs.restoreState();
    const stop = vfs.startAutoPersist(5000);
    return stop;
  }, []);

  // Adjust desktop bounds when panel position changes
  useEffect(() => {
    const desktop = document.querySelector('.kasm-desktop') as HTMLElement;
    if (!desktop) return;

    if (panelConfig.position === 'top') {
      desktop.style.top = `${panelConfig.height}px`;
      desktop.style.bottom = '0';
    } else {
      desktop.style.top = '0';
      desktop.style.bottom = `${panelConfig.height}px`;
    }
  }, [panelConfig.position, panelConfig.height]);

  // Welcome notification on first load
  useEffect(() => {
    const store = useDesktopStore.getState();
    const timer1 = setTimeout(() => {
      store.addNotification({
        title: 'Welcome to Kasm UI',
        body: 'A bleeding-edge React desktop environment. Open the Apps menu to explore!',
        icon: '\u25C6',
        urgency: 'normal',
      });
    }, 1500);

    const timer2 = setTimeout(() => {
      if ('showDirectoryPicker' in window) {
        store.addNotification({
          title: 'Connect a local folder',
          body: 'Click the folder icon in the panel to give Kasm access to a local directory. Your files will appear in the File Manager.',
          icon: '\u{1F4C2}',
          urgency: 'low',
          duration: 8000,
        });
      }
    }, 4000);

    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  // Keyboard shortcuts (Cinnamon-style)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const store = useDesktopStore.getState();

      // Ctrl+Alt+Arrow for workspace switching
      if (e.ctrlKey && e.altKey) {
        const wsIdx = store.workspaces.findIndex(ws => ws.id === store.activeWorkspaceId);
        if (e.key === 'ArrowRight' && wsIdx < store.workspaces.length - 1) {
          store.switchWorkspace(store.workspaces[wsIdx + 1].id);
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' && wsIdx > 0) {
          store.switchWorkspace(store.workspaces[wsIdx - 1].id);
          e.preventDefault();
        }

        // Ctrl+Alt+Up for Expo view
        if (e.key === 'ArrowUp') {
          store.setExpoMode(store.expoMode === 'expo' ? 'off' : 'expo');
          e.preventDefault();
        }

        // Ctrl+Alt+Down for Scale view
        if (e.key === 'ArrowDown') {
          store.setExpoMode(store.expoMode === 'scale' ? 'off' : 'scale');
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
