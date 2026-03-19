// ============================================================
// System Monitor - Real browser performance metrics
// Uses Performance API, memory API, and PerformanceObserver
// ============================================================

import { createSignal, createEffect, onCleanup, For, Show, type JSX } from 'solid-js';
import type { AppProps } from '../core/types';
import './apps.css';

interface MetricPoint {
  value: number;
  timestamp: number;
}

interface ProcessInfo {
  name: string;
  cpu: number;
  memory: number;
  pid: number;
}

// Real metric hooks using browser Performance API
function useRealCPU(interval = 1000) {
  const [points, setPoints] = createSignal<MetricPoint[]>([]);
  let lastIdle = 0;
  let lastTotal = 0;

  createEffect(() => {
    let prev = performance.now();
    let busyTime = 0;

    // Measure main-thread busyness via requestAnimationFrame timing
    let rafId: number;
    const measureFrame = () => {
      const now = performance.now();
      const dt = now - prev;
      // If frame took > 20ms, thread was busy
      if (dt > 20) busyTime += Math.min(dt - 16.67, dt);
      prev = now;
      rafId = requestAnimationFrame(measureFrame);
    };
    rafId = requestAnimationFrame(measureFrame);

    const timer = setInterval(() => {
      // CPU usage = fraction of time the main thread was busy
      const usage = Math.min(100, (busyTime / interval) * 100);
      busyTime = 0;
      setPoints(prev => [...prev.slice(-59), { value: usage, timestamp: Date.now() }]);
    }, interval);

    onCleanup(() => {
      clearInterval(timer);
      cancelAnimationFrame(rafId);
    });
  });

  return points;
}

function useRealMemory(interval = 1000) {
  const [points, setPoints] = createSignal<MetricPoint[]>([]);

  createEffect(() => {
    const timer = setInterval(() => {
      const perf = performance as any;
      if (perf.memory) {
        // Chrome's non-standard memory API
        const used = perf.memory.usedJSHeapSize;
        const total = perf.memory.jsHeapSizeLimit;
        const pct = (used / total) * 100;
        setPoints(prev => [...prev.slice(-59), { value: pct, timestamp: Date.now() }]);
      } else {
        // Estimate from performance entries
        const entries = performance.getEntriesByType('resource');
        const totalTransferred = entries.reduce((sum, e: any) => sum + (e.transferSize || 0), 0);
        const estimatedPct = Math.min(100, (totalTransferred / (256 * 1024 * 1024)) * 100);
        setPoints(prev => [...prev.slice(-59), { value: Math.max(5, estimatedPct), timestamp: Date.now() }]);
      }
    }, interval);
    onCleanup(() => clearInterval(timer));
  });

  return points;
}

function useNetworkActivity(interval = 1000) {
  const [points, setPoints] = createSignal<MetricPoint[]>([]);
  let lastCount = 0;
  let lastSize = 0;

  createEffect(() => {
    const timer = setInterval(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const totalSize = entries.reduce((sum, e) => sum + (e.transferSize || 0), 0);
      const deltaSize = totalSize - lastSize;
      lastSize = totalSize;
      // Convert bytes/sec to Mbps (rough)
      const mbps = Math.max(0, (deltaSize * 8) / (interval * 1000));
      setPoints(prev => [...prev.slice(-59), { value: Math.min(100, mbps * 10), timestamp: Date.now() }]);
    }, interval);
    onCleanup(() => clearInterval(timer));
  });

  return points;
}

function useDOMMetric(interval = 1000) {
  const [points, setPoints] = createSignal<MetricPoint[]>([]);

  createEffect(() => {
    const timer = setInterval(() => {
      const nodeCount = document.querySelectorAll('*').length;
      // Normalize: 0-2000 nodes = 0-100%
      const pct = Math.min(100, (nodeCount / 2000) * 100);
      setPoints(prev => [...prev.slice(-59), { value: pct, timestamp: Date.now() }]);
    }, interval);
    onCleanup(() => clearInterval(timer));
  });

  return points;
}

function useFPS(interval = 1000) {
  const [points, setPoints] = createSignal<MetricPoint[]>([]);

  createEffect(() => {
    let frameCount = 0;
    let rafId: number;
    const countFrame = () => {
      frameCount++;
      rafId = requestAnimationFrame(countFrame);
    };
    rafId = requestAnimationFrame(countFrame);

    const timer = setInterval(() => {
      const fps = Math.min(144, (frameCount / interval) * 1000);
      frameCount = 0;
      // Normalize FPS to percentage (60fps = 100%)
      const pct = Math.min(100, (fps / 60) * 100);
      setPoints(prev => [...prev.slice(-59), { value: pct, timestamp: Date.now() }]);
    }, interval);

    onCleanup(() => {
      clearInterval(timer);
      cancelAnimationFrame(rafId);
    });
  });

  return points;
}

function MiniGraph(props: {
  points: MetricPoint[];
  color: string;
  label: string;
  unit?: string;
  maxLabel?: string;
}) {
  let canvasRef!: HTMLCanvasElement;

  const current = () => {
    const pts = props.points;
    return pts[pts.length - 1]?.value ?? 0;
  };

  createEffect(() => {
    const pts = props.points;
    const color = props.color;
    const canvas = canvasRef;
    if (!canvas || pts.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= h; y += h / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Fill gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, color.replace(')', ', 0.02)').replace('rgb', 'rgba'));

    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (p.value / 100) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const lastX = ((pts.length - 1) / (pts.length - 1)) * w;
    ctx.lineTo(lastX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (p.value / 100) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Current value dot
    if (pts.length > 0) {
      const lastP = pts[pts.length - 1];
      const x = w;
      const y = h - (lastP.value / 100) * h;
      ctx.beginPath();
      ctx.arc(x - 1, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });

  return (
    <div class="kasm-sysmon__metric" data-testid={`sysmon-${props.label.toLowerCase().replace(/\s/g, '-')}`}>
      <div class="kasm-sysmon__metric-header">
        <span class="kasm-sysmon__metric-label">{props.label}</span>
        <span class="kasm-sysmon__metric-value" style={{ color: props.color }}>
          {current().toFixed(1)}{props.unit ?? '%'}
        </span>
      </div>
      <Show when={props.maxLabel}>
        <div class="kasm-sysmon__metric-sub">{props.maxLabel}</div>
      </Show>
      <canvas ref={canvasRef!} width={300} height={80} class="kasm-sysmon__graph" />
    </div>
  );
}

function extractName(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    // Use hostname for external resources, pathname for same-origin
    if (parsed.hostname && parsed.hostname !== window.location.hostname) {
      return parsed.hostname;
    }
    const path = parsed.pathname;
    // Return last path segment or full path
    const segments = path.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : path;
  } catch {
    return url.slice(0, 40);
  }
}

function ProcessTable() {
  const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
  const [sortBy, setSortBy] = createSignal<'cpu' | 'memory'>('cpu');

  createEffect(() => {
    const currentSortBy = sortBy();
    const timer = setInterval(() => {
      const procs: ProcessInfo[] = [];
      let pid = 1;

      // Main document from navigation timing
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        procs.push({
          name: extractName(nav.name) || 'document',
          cpu: Math.round(nav.duration * 10) / 10,
          memory: Math.round(((nav as any).transferSize || 0) / 1024 * 10) / 10,
          pid: pid++,
        });
      }

      // Resource entries as "processes"
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const entry of resourceEntries) {
        procs.push({
          name: extractName(entry.name),
          cpu: Math.round(entry.duration * 10) / 10,
          memory: Math.round((entry.transferSize || 0) / 1024 * 10) / 10,
          pid: pid++,
        });
      }

      // Current page JS heap usage if available
      const perf = performance as any;
      if (perf.memory) {
        procs.push({
          name: 'JS Heap',
          cpu: 0,
          memory: Math.round(perf.memory.usedJSHeapSize / 1024 * 10) / 10,
          pid: pid++,
        });
      }

      // Sort by selected column
      procs.sort((a, b) => b[currentSortBy] - a[currentSortBy]);

      setProcesses(procs);
    }, 2000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="kasm-sysmon__processes">
      <div class="kasm-sysmon__proc-header">
        <span style={{ flex: 1 }}>Resource</span>
        <span
          style={{ width: '80px', cursor: 'pointer', "text-align": 'right' }}
          onClick={() => setSortBy('cpu')}
        >
          Dur ms {sortBy() === 'cpu' ? '\u25BC' : ''}
        </span>
        <span
          style={{ width: '80px', cursor: 'pointer', "text-align": 'right' }}
          onClick={() => setSortBy('memory')}
        >
          Size KB {sortBy() === 'memory' ? '\u25BC' : ''}
        </span>
        <span style={{ width: '50px', "text-align": 'right' }}>PID</span>
      </div>
      <For each={processes()}>
        {(p) => (
          <div class="kasm-sysmon__proc-row">
            <span style={{ flex: 1, overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>{p.name}</span>
            <span style={{ width: '80px', "text-align": 'right' }}>{p.cpu.toFixed(1)}</span>
            <span style={{ width: '80px', "text-align": 'right' }}>{p.memory.toFixed(1)}</span>
            <span style={{ width: '50px', "text-align": 'right', opacity: 0.5 }}>{p.pid}</span>
          </div>
        )}
      </For>
    </div>
  );
}

export function SystemMonitor(props: AppProps) {
  const [tab, setTab] = createSignal<'graphs' | 'processes'>('graphs');
  const cpu = useRealCPU();
  const memory = useRealMemory();
  const network = useNetworkActivity();
  const dom = useDOMMetric();
  const fps = useFPS();

  const memInfo = () => {
    const perf = performance as any;
    return perf.memory
      ? `${(perf.memory.usedJSHeapSize / 1024 / 1024).toFixed(0)} MB / ${(perf.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB`
      : undefined;
  };

  return (
    <div class="kasm-app kasm-sysmon" data-testid="system-monitor">
      <div class="kasm-sysmon__tabs">
        <button
          class={`kasm-sysmon__tab ${tab() === 'graphs' ? 'kasm-sysmon__tab--active' : ''}`}
          onClick={() => setTab('graphs')}
        >
          Graphs
        </button>
        <button
          class={`kasm-sysmon__tab ${tab() === 'processes' ? 'kasm-sysmon__tab--active' : ''}`}
          onClick={() => setTab('processes')}
        >
          Processes
        </button>
      </div>
      <Show when={tab() === 'graphs'} fallback={<ProcessTable />}>
        <div class="kasm-sysmon__graphs">
          <MiniGraph points={cpu()} color="rgb(108, 92, 231)" label="CPU" maxLabel="Main thread utilization" />
          <MiniGraph points={memory()} color="rgb(0, 184, 148)" label="Memory" maxLabel={memInfo()} />
          <MiniGraph points={fps()} color="rgb(46, 204, 113)" label="FPS" unit=" fps" maxLabel="Frames per second (60 = 100%)" />
          <MiniGraph points={dom()} color="rgb(253, 203, 110)" label="DOM Nodes" unit="" maxLabel={`${document.querySelectorAll('*').length} nodes`} />
          <MiniGraph points={network()} color="rgb(0, 180, 216)" label="Network" unit="" maxLabel="Resource transfer activity" />
        </div>
      </Show>
    </div>
  );
}
