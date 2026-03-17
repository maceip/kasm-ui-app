// ============================================================
// System Tray - Cinnamon-style status icons
// ============================================================

import { useState } from 'react';
import './systemTray.css';

export function SystemTray() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="kasm-system-tray">
      <button
        className="kasm-system-tray__expand"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Collapse' : 'Show hidden icons'}
      >
        {expanded ? '◂' : '▸'}
      </button>
      <div className={`kasm-system-tray__icons ${expanded ? 'kasm-system-tray__icons--expanded' : ''}`}>
        <TrayIcon icon="🔊" title="Volume: 100%" />
        <TrayIcon icon="📶" title="Connected" />
        <TrayIcon icon="🔋" title="Battery: 100%" />
      </div>
    </div>
  );
}

function TrayIcon({ icon, title }: { icon: string; title: string }) {
  return (
    <button className="kasm-system-tray__icon" title={title}>
      {icon}
    </button>
  );
}
