// ============================================================
// System Tray - Cinnamon-style status icons
// ============================================================

import { createSignal } from 'solid-js';
import './systemTray.css';

export function SystemTray() {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <div class="kasm-system-tray">
      <button
        class="kasm-system-tray__expand"
        onClick={() => setExpanded(!expanded())}
        title={expanded() ? 'Collapse' : 'Show hidden icons'}
      >
        {expanded() ? '\u25C2' : '\u25B8'}
      </button>
      <div class={`kasm-system-tray__icons ${expanded() ? 'kasm-system-tray__icons--expanded' : ''}`}>
        <TrayIcon icon="\u{1F50A}" title="Volume: 100%" />
        <TrayIcon icon="\u{1F4F6}" title="Connected" />
        <TrayIcon icon="\u{1F50B}" title="Battery: 100%" />
      </div>
    </div>
  );
}

function TrayIcon(props: { icon: string; title: string }) {
  return (
    <button class="kasm-system-tray__icon" title={props.title}>
      {props.icon}
    </button>
  );
}
