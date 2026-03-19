// ============================================================
// Local Folder Indicator - Shows mount status in system tray
// LED dot + folder icon, click to mount/unmount
// ============================================================

import { createSignal, onCleanup, Show, For } from 'solid-js';
import { vfs } from '../apps/vfs';
import { addNotification } from '../core/store';
import './localFolderIndicator.css';

export function LocalFolderIndicator() {
  const [mounts, setMounts] = createSignal<string[]>(vfs.getMountedPaths());
  const [mounting, setMounting] = createSignal(false);
  const [showPopup, setShowPopup] = createSignal(false);

  const unsub = vfs.onMountChange(setMounts);
  onCleanup(() => unsub());

  const handleMount = async () => {
    setMounting(true);
    try {
      const mountPath = await vfs.mountLocalFolder();
      const folderName = mountPath.split('/').pop() || mountPath;
      addNotification({
        title: 'Local folder connected',
        body: `"${folderName}" is now accessible in the File Manager at ${mountPath}`,
        icon: '\u{1F4C2}',
        urgency: 'normal',
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addNotification({
          title: 'Mount failed',
          body: err.message || 'Could not connect local folder',
          icon: '\u26A0',
          urgency: 'normal',
        });
      }
    } finally {
      setMounting(false);
      setShowPopup(false);
    }
  };

  const handleUnmount = async (mountPoint: string) => {
    await vfs.unmount(mountPoint);
    setShowPopup(false);
  };

  const handleRefresh = async (mountPoint: string) => {
    try {
      await vfs.refreshMount(mountPoint);
      addNotification({
        title: 'Folder refreshed',
        body: `${mountPoint} has been re-read from disk`,
        icon: '\u{1F504}',
        urgency: 'low',
      });
    } catch (err: any) {
      addNotification({
        title: 'Refresh failed',
        body: err.message,
        icon: '\u26A0',
        urgency: 'normal',
      });
    }
  };

  const isConnected = () => mounts().length > 0;
  const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  return (
    <div class="kasm-local-folder">
      <button
        class="kasm-local-folder__btn"
        onClick={() => setShowPopup(!showPopup())}
        title={isConnected() ? `Local: ${mounts().join(', ')}` : 'Connect local folder'}
      >
        <span class={`kasm-local-folder__led ${isConnected() ? 'kasm-local-folder__led--on' : ''} ${mounting() ? 'kasm-local-folder__led--pulse' : ''}`} />
        <span class="kasm-local-folder__icon">
          {isConnected() ? '\u{1F4C2}' : '\u{1F4C1}'}
        </span>
      </button>

      <Show when={showPopup()}>
        <div class="kasm-local-folder__popup">
          <div class="kasm-local-folder__popup-header">Local Folders</div>

          <Show when={mounts().length > 0} fallback={
            <div class="kasm-local-folder__empty">
              No local folders connected
            </div>
          }>
            <div class="kasm-local-folder__mount-list">
              <For each={mounts()}>
                {(mp) => (
                  <div class="kasm-local-folder__mount-item">
                    <span class="kasm-local-folder__mount-led" />
                    <span class="kasm-local-folder__mount-path">{mp}</span>
                    <button
                      class="kasm-local-folder__mount-action"
                      onClick={() => handleRefresh(mp)}
                      title="Refresh"
                    >
                      {'\u{1F504}'}
                    </button>
                    <button
                      class="kasm-local-folder__mount-action kasm-local-folder__mount-action--eject"
                      onClick={() => handleUnmount(mp)}
                      title="Disconnect"
                    >
                      {'\u23CF'}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={isSupported} fallback={
            <div class="kasm-local-folder__unsupported">
              File System Access API not available in this browser
            </div>
          }>
            <button
              class="kasm-local-folder__connect-btn"
              onClick={handleMount}
              disabled={mounting()}
            >
              {mounting() ? 'Connecting...' : '+ Connect folder'}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
