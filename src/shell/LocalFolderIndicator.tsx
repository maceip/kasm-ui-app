// ============================================================
// Local Folder Indicator - Shows mount status in system tray
// LED dot + folder icon, click to mount/unmount
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { vfs } from '../apps/vfs';
import { useDesktopStore } from '../core/store';
import './localFolderIndicator.css';

export function LocalFolderIndicator() {
  const [mounts, setMounts] = useState<string[]>(vfs.getMountedPaths());
  const [mounting, setMounting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const addNotification = useDesktopStore(s => s.addNotification);

  useEffect(() => {
    return vfs.onMountChange(setMounts);
  }, []);

  const handleMount = useCallback(async () => {
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
  }, [addNotification]);

  const handleUnmount = useCallback(async (mountPoint: string) => {
    await vfs.unmount(mountPoint);
    setShowPopup(false);
  }, []);

  const handleRefresh = useCallback(async (mountPoint: string) => {
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
  }, [addNotification]);

  const isConnected = mounts.length > 0;
  const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  return (
    <div className="kasm-local-folder">
      <button
        className="kasm-local-folder__btn"
        onClick={() => setShowPopup(!showPopup)}
        title={isConnected ? `Local: ${mounts.join(', ')}` : 'Connect local folder'}
      >
        <span className={`kasm-local-folder__led ${isConnected ? 'kasm-local-folder__led--on' : ''} ${mounting ? 'kasm-local-folder__led--pulse' : ''}`} />
        <span className="kasm-local-folder__icon">
          {isConnected ? '\u{1F4C2}' : '\u{1F4C1}'}
        </span>
      </button>

      {showPopup && (
        <div className="kasm-local-folder__popup">
          <div className="kasm-local-folder__popup-header">Local Folders</div>

          {mounts.length > 0 ? (
            <div className="kasm-local-folder__mount-list">
              {mounts.map(mp => (
                <div key={mp} className="kasm-local-folder__mount-item">
                  <span className="kasm-local-folder__mount-led" />
                  <span className="kasm-local-folder__mount-path">{mp}</span>
                  <button
                    className="kasm-local-folder__mount-action"
                    onClick={() => handleRefresh(mp)}
                    title="Refresh"
                  >
                    {'\u{1F504}'}
                  </button>
                  <button
                    className="kasm-local-folder__mount-action kasm-local-folder__mount-action--eject"
                    onClick={() => handleUnmount(mp)}
                    title="Disconnect"
                  >
                    {'\u23CF'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="kasm-local-folder__empty">
              No local folders connected
            </div>
          )}

          {isSupported ? (
            <button
              className="kasm-local-folder__connect-btn"
              onClick={handleMount}
              disabled={mounting}
            >
              {mounting ? 'Connecting...' : '+ Connect folder'}
            </button>
          ) : (
            <div className="kasm-local-folder__unsupported">
              File System Access API not available in this browser
            </div>
          )}
        </div>
      )}
    </div>
  );
}
