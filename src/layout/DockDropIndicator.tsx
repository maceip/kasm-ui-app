// ============================================================
// DockDropIndicator - rc-dock style drag-to-dock system
// SolidJS port
// ============================================================

import { createSignal, Show, For, type JSX } from 'solid-js';
import type { DockDirection } from '../core/types';
import './DockDropIndicator.css';

export type DockDropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

interface DockDropIndicatorProps {
  visible: boolean;
  activeZone?: DockDropZone | null;
  onZoneHover?: (zone: DockDropZone | null) => void;
  onDrop?: (zone: DockDropZone, tabId: string) => void;
  panelRect?: { width: number; height: number };
}

interface ZoneTargetProps {
  zone: DockDropZone;
  active: boolean;
  onEnter: (zone: DockDropZone) => void;
  onLeave: () => void;
  onDrop: (zone: DockDropZone, tabId: string) => void;
}

function ZoneTarget(props: ZoneTargetProps) {
  const positionStyles: Record<DockDropZone, JSX.CSSProperties> = {
    left: { left: '8px', top: '50%', transform: 'translateY(-50%)' },
    right: { right: '8px', top: '50%', transform: 'translateY(-50%)' },
    top: { top: '8px', left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: '8px', left: '50%', transform: 'translateX(-50%)' },
    center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  };

  return (
    <div
      class={`kasm-dock-drop__target kasm-dock-drop__target--${props.zone} ${props.active ? 'kasm-dock-drop__target--active' : ''}`}
      style={positionStyles[props.zone]}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); props.onEnter(props.zone); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragLeave={(e) => { e.stopPropagation(); props.onLeave(); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        const tabId = e.dataTransfer.getData('application/kasm-tab-id');
        props.onDrop(props.zone, tabId);
      }}
    />
  );
}

function DropPreview(props: { zone: DockDropZone | null }) {
  const previewStyles: Record<DockDropZone, JSX.CSSProperties> = {
    left: { left: '0', top: '0', width: '50%', height: '100%' },
    right: { right: '0', top: '0', width: '50%', height: '100%' },
    top: { left: '0', top: '0', width: '100%', height: '50%' },
    bottom: { left: '0', bottom: '0', width: '100%', height: '50%' },
    center: { left: '0', top: '0', width: '100%', height: '100%' },
  };

  return (
    <Show when={props.zone}>
      <div
        class={`kasm-dock-drop__preview kasm-dock-drop__preview--${props.zone}`}
        style={previewStyles[props.zone!]}
      />
    </Show>
  );
}

const ZONES: DockDropZone[] = ['left', 'right', 'top', 'bottom', 'center'];

export function DockDropIndicator(props: DockDropIndicatorProps) {
  const [internalZone, setInternalZone] = createSignal<DockDropZone | null>(null);
  const activeZone = () => props.activeZone !== undefined ? props.activeZone : internalZone();

  const handleEnter = (zone: DockDropZone) => {
    setInternalZone(zone);
    props.onZoneHover?.(zone);
  };

  const handleLeave = () => {
    setInternalZone(null);
    props.onZoneHover?.(null);
  };

  const handleDrop = (zone: DockDropZone, tabId: string) => {
    props.onDrop?.(zone, tabId);
    setInternalZone(null);
    props.onZoneHover?.(null);
  };

  return (
    <Show when={props.visible}>
      <div class="kasm-dock-drop">
        <DropPreview zone={activeZone() ?? null} />
        <For each={ZONES}>
          {(zone) => (
            <ZoneTarget
              zone={zone}
              active={activeZone() === zone}
              onEnter={handleEnter}
              onLeave={handleLeave}
              onDrop={handleDrop}
            />
          )}
        </For>
      </div>
    </Show>
  );
}

// ============================================================
// createDockDrop - manages dock drop state for a panel
// ============================================================

interface CreateDockDropOptions {
  panelId: string;
  enabled?: boolean;
  onDock?: (tabId: string, direction: DockDropZone, targetPanelId: string) => void;
}

export function createDockDrop(opts: CreateDockDropOptions) {
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [activeZone, setActiveZone] = createSignal<DockDropZone | null>(null);
  let dragEnterCount = 0;

  const handleDragEnter = (e: DragEvent) => {
    if (!opts.enabled) return;
    e.preventDefault();
    dragEnterCount++;
    setIsDragOver(true);
  };

  const handleDragOver = (e: DragEvent) => {
    if (!opts.enabled) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  };

  const handleDragLeave = (_e: DragEvent) => {
    if (!opts.enabled) return;
    dragEnterCount--;
    if (dragEnterCount <= 0) {
      dragEnterCount = 0;
      setIsDragOver(false);
      setActiveZone(null);
    }
  };

  const handleDrop = (e: DragEvent) => {
    if (!opts.enabled) return;
    e.preventDefault();
    dragEnterCount = 0;
    setIsDragOver(false);
    const tabId = e.dataTransfer!.getData('application/kasm-tab-id');
    if (tabId && activeZone()) {
      opts.onDock?.(tabId, activeZone()!, opts.panelId);
    }
    setActiveZone(null);
  };

  const handleZoneHover = (zone: DockDropZone | null) => {
    setActiveZone(zone);
  };

  const handleZoneDrop = (zone: DockDropZone, tabId: string) => {
    setIsDragOver(false);
    dragEnterCount = 0;
    if (tabId) {
      opts.onDock?.(tabId, zone, opts.panelId);
    }
    setActiveZone(null);
  };

  return {
    isDragOver,
    activeZone,
    panelProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    indicatorProps: {
      get visible() { return isDragOver(); },
      get activeZone() { return activeZone(); },
      onZoneHover: handleZoneHover,
      onDrop: handleZoneDrop,
    },
  };
}
