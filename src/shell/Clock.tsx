// ============================================================
// Clock Applet - Cinnamon-style clock in panel
// ============================================================

import { useState, useEffect } from 'react';

export function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <button className="kasm-panel-btn" title={time.toLocaleString()}>
      <span style={{ fontSize: 12 }}>{timeStr}</span>
      <span style={{ fontSize: 10, opacity: 0.7 }}>{dateStr}</span>
    </button>
  );
}
