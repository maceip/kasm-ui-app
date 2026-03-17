// ============================================================
// DockDropIndicator - rc-dock style drag-to-dock system
// Shows drop zone indicators when dragging a tab over a panel
// ============================================================

import { useState, useCallback, useRef } from 'react';
import type { DockDirection } from '../core/types';
import './DockDropIndicator.css';

// ============================================================
// Types
// ============================================================

export type DockDropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

interface DockDropIndicatorProps {
  /** Whether a tab is currently being dragged over this panel */
  visible: boolean;
  /** The currently hovered drop zone, if any */
  activeZone?: DockDropZone | null;
  /** Callback when a zone is hovered */
  onZoneHover?: (zone: DockDropZone | null) => void;
  /** Callback when a tab is dropped on a zone (receives zone + tabId from dataTransfer) */
  onDrop?: (zone: DockDropZone, tabId: string) => void;
  /** Panel dimensions (used for preview sizing) */
  panelRect?: { width: number; height: number };
}

interface ZoneTargetProps {
  zone: DockDropZone;
  active: boolean;
  onEnter: (zone: DockDropZone) => void;
  onLeave: () => void;
  onDrop: (zone: DockDropZone, tabId: string) => void;
}

// ============================================================
// Zone target (the small square indicator for each dock direction)
// ============================================================

function ZoneTarget({ zone, active, onEnter, onLeave, onDrop }: ZoneTargetProps) {
  const positionStyles: Record<DockDropZone, React.CSSProperties> = {
    left: { left: 8, top: '50%', transform: 'translateY(-50%)' },
    right: { right: 8, top: '50%', transform: 'translateY(-50%)' },
    top: { top: 8, left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: 8, left: '50%', transform: 'translateX(-50%)' },
    center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  };

  return (
    <div
      className={`kasm-dock-drop__target kasm-dock-drop__target--${zone} ${active ? 'kasm-dock-drop__target--active' : ''}`}
      style={positionStyles[zone]}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEnter(zone);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        onLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = e.dataTransfer.getData('application/kasm-tab-id');
        onDrop(zone, tabId);
      }}
    />
  );
}

// ============================================================
// Drop preview overlay (shows where the tab will dock)
// ============================================================

function DropPreview({ zone }: { zone: DockDropZone | null }) {
  if (!zone) return null;

  const previewStyles: Record<DockDropZone, React.CSSProperties> = {
    left: { left: 0, top: 0, width: '50%', height: '100%' },
    right: { right: 0, top: 0, width: '50%', height: '100%' },
    top: { left: 0, top: 0, width: '100%', height: '50%' },
    bottom: { left: 0, bottom: 0, width: '100%', height: '50%' },
    center: { left: 0, top: 0, width: '100%', height: '100%' },
  };

  return (
    <div
      className={`kasm-dock-drop__preview kasm-dock-drop__preview--${zone}`}
      style={previewStyles[zone]}
    />
  );
}

// ============================================================
// DockDropIndicator component
// ============================================================

const ZONES: DockDropZone[] = ['left', 'right', 'top', 'bottom', 'center'];

export function DockDropIndicator({
  visible,
  activeZone: controlledZone,
  onZoneHover,
  onDrop,
  panelRect,
}: DockDropIndicatorProps) {
  const [internalZone, setInternalZone] = useState<DockDropZone | null>(null);
  const activeZone = controlledZone !== undefined ? controlledZone : internalZone;

  const handleEnter = useCallback((zone: DockDropZone) => {
    setInternalZone(zone);
    onZoneHover?.(zone);
  }, [onZoneHover]);

  const handleLeave = useCallback(() => {
    setInternalZone(null);
    onZoneHover?.(null);
  }, [onZoneHover]);

  const handleDrop = useCallback((zone: DockDropZone, tabId: string) => {
    onDrop?.(zone, tabId);
    setInternalZone(null);
    onZoneHover?.(null);
  }, [onDrop, onZoneHover]);

  if (!visible) return null;

  return (
    <div className="kasm-dock-drop">
      <DropPreview zone={activeZone ?? null} />
      {ZONES.map((zone) => (
        <ZoneTarget
          key={zone}
          zone={zone}
          active={activeZone === zone}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}

// ============================================================
// useDockDrop hook - manages dock drop state for a panel
// ============================================================

interface UseDockDropOptions {
  panelId: string;
  /** Whether this panel accepts dock drops */
  enabled?: boolean;
  onDock?: (tabId: string, direction: DockDropZone, targetPanelId: string) => void;
}

interface UseDockDropResult {
  /** Whether a tab is currently being dragged over this panel */
  isDragOver: boolean;
  /** The currently active drop zone */
  activeZone: DockDropZone | null;
  /** Props to spread on the panel container */
  panelProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  /** Props for the DockDropIndicator */
  indicatorProps: {
    visible: boolean;
    activeZone: DockDropZone | null;
    onZoneHover: (zone: DockDropZone | null) => void;
    onDrop: (zone: DockDropZone, tabId: string) => void;
  };
}

export function useDockDrop({
  panelId,
  enabled = true,
  onDock,
}: UseDockDropOptions): UseDockDropResult {
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeZone, setActiveZone] = useState<DockDropZone | null>(null);
  const dragEnterCount = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    dragEnterCount.current++;
    setIsDragOver(true);
  }, [enabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [enabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!enabled) return;
    dragEnterCount.current--;
    if (dragEnterCount.current <= 0) {
      dragEnterCount.current = 0;
      setIsDragOver(false);
      setActiveZone(null);
    }
  }, [enabled]);

  // Panel-level drop handler (fires when drop is NOT on a zone target)
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    dragEnterCount.current = 0;
    setIsDragOver(false);

    const tabId = e.dataTransfer.getData('application/kasm-tab-id');
    if (tabId && activeZone) {
      onDock?.(tabId, activeZone, panelId);
    }
    setActiveZone(null);
  }, [enabled, activeZone, onDock, panelId]);

  const handleZoneHover = useCallback((zone: DockDropZone | null) => {
    setActiveZone(zone);
  }, []);

  // Zone-level drop handler (fires when drop IS on a zone target)
  const handleZoneDrop = useCallback((zone: DockDropZone, tabId: string) => {
    setIsDragOver(false);
    dragEnterCount.current = 0;
    if (tabId) {
      onDock?.(tabId, zone, panelId);
    }
    setActiveZone(null);
  }, [onDock, panelId]);

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
      visible: isDragOver,
      activeZone,
      onZoneHover: handleZoneHover,
      onDrop: handleZoneDrop,
    },
  };
}
