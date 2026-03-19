// ============================================================
// Clock Applet - Cinnamon-style clock in panel
// ============================================================

import { createSignal, onCleanup } from 'solid-js';

export function Clock() {
  const [time, setTime] = createSignal(new Date());

  const timer = setInterval(() => setTime(new Date()), 1000);
  onCleanup(() => clearInterval(timer));

  const timeStr = () => time().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = () => time().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <button class="kasm-panel-btn" title={time().toLocaleString()}>
      <span style={{ "font-size": '12px' }}>{timeStr()}</span>
      <span style={{ "font-size": '10px', opacity: 0.7 }}>{dateStr()}</span>
    </button>
  );
}
