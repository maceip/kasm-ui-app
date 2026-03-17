// ============================================================
// TabPanel - rc-dock style tabbed panel system
// Golden Layout tab UI + rc-dock caching + drag reorder +
// dock-to-dock, float-out, maximize support
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { DockDropIndicator, useDockDrop } from './DockDropIndicator';
import type { DockDropZone } from './DockDropIndicator';
import type { DockDirection } from '../core/types';
import './tabPanel.css';

export interface Tab {
  id: string;
  title: string;
  icon?: string;
  closable?: boolean;
  content: React.ReactNode;
}

interface TabPanelProps {
  tabs: Tab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onTabReorder?: (fromIdx: number, toIdx: number) => void;
  /** Unique panel identifier for dock targeting */
  panelId?: string;
  /** Called when a tab is docked onto this panel */
  onDock?: (tabId: string, direction: DockDirection, targetPanelId?: string) => void;
  /** Called when maximize button is clicked */
  onMaximize?: (panelId: string) => void;
  /** Called when a tab is floated out of the panel */
  onFloat?: (tabId: string) => void;
  className?: string;
}

// Drag threshold in pixels to distinguish click from drag-to-float
const FLOAT_DRAG_THRESHOLD = 40;

export function TabPanel({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabReorder,
  panelId = '',
  onDock,
  onMaximize,
  onFloat,
  className = '',
}: TabPanelProps) {
  const [internalActiveId, setInternalActiveId] = useState(tabs[0]?.id ?? '');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const activeId = activeTabId ?? internalActiveId;
  const panelRef = useRef<HTMLDivElement>(null);
  const tabDragStartPos = useRef<{ x: number; y: number } | null>(null);

  const setActive = useCallback((id: string) => {
    setInternalActiveId(id);
    onTabChange?.(id);
  }, [onTabChange]);

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  // Dock drop hook
  const handleDock = useCallback((tabId: string, direction: DockDropZone, targetPanelId: string) => {
    onDock?.(tabId, direction as DockDirection, targetPanelId);
  }, [onDock]);

  const { isDragOver, activeZone, panelProps: dockPanelProps, indicatorProps } = useDockDrop({
    panelId,
    enabled: !!onDock,
    onDock: handleDock,
  });

  // Handle maximize toggle
  const handleMaximize = useCallback(() => {
    setIsMaximized(prev => !prev);
    if (panelId) {
      onMaximize?.(panelId);
    }
  }, [panelId, onMaximize]);

  // Handle tab drag start - set up for both reorder and dock/float
  const handleTabDragStart = useCallback((e: React.DragEvent, tab: Tab, index: number) => {
    // Set data for both internal reorder and cross-panel docking
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.setData('application/kasm-tab-id', tab.id);
    e.dataTransfer.setData('application/kasm-source-panel', panelId);
    e.dataTransfer.effectAllowed = 'move';

    tabDragStartPos.current = { x: e.clientX, y: e.clientY };
  }, [panelId]);

  // Handle tab drag end - check if it was dragged out of the panel (float)
  const handleTabDragEnd = useCallback((e: React.DragEvent, tab: Tab) => {
    if (!tabDragStartPos.current || !panelRef.current || !onFloat) return;

    const panelRect = panelRef.current.getBoundingClientRect();
    const endX = e.clientX;
    const endY = e.clientY;

    // Check if the tab was dropped outside the panel bounds
    const outsidePanel =
      endX < panelRect.left - FLOAT_DRAG_THRESHOLD ||
      endX > panelRect.right + FLOAT_DRAG_THRESHOLD ||
      endY < panelRect.top - FLOAT_DRAG_THRESHOLD ||
      endY > panelRect.bottom + FLOAT_DRAG_THRESHOLD;

    if (outsidePanel && e.dataTransfer.dropEffect === 'none') {
      onFloat(tab.id);
    }

    tabDragStartPos.current = null;
  }, [onFloat]);

  return (
    <div
      ref={panelRef}
      className={`kasm-tab-panel ${isMaximized ? 'kasm-tab-panel--maximized' : ''} ${isDragOver ? 'kasm-tab-panel--drag-over' : ''} ${className}`}
      {...dockPanelProps}
    >
      <div className="kasm-tab-panel__header">
        <div className="kasm-tab-panel__tabs">
          {tabs.map((tab, i) => (
            <div
              key={tab.id}
              className={`kasm-tab-panel__tab ${tab.id === activeId ? 'kasm-tab-panel__tab--active' : ''} ${dragOverIdx === i ? 'kasm-tab-panel__tab--drag-over' : ''}`}
              onClick={() => setActive(tab.id)}
              draggable
              onDragStart={(e) => handleTabDragStart(e, tab, i)}
              onDragEnd={(e) => handleTabDragEnd(e, tab)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(i);
              }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                if (!isNaN(fromIdx) && fromIdx !== i) {
                  onTabReorder?.(fromIdx, i);
                }
                setDragOverIdx(null);
              }}
            >
              {tab.icon && <span className="kasm-tab-panel__tab-icon">{tab.icon}</span>}
              <span className="kasm-tab-panel__tab-title">{tab.title}</span>
              {tab.closable !== false && (
                <button
                  className="kasm-tab-panel__tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose?.(tab.id);
                  }}
                >
                  &#x2715;
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="kasm-tab-panel__header-actions">
          {onMaximize && (
            <button
              className="kasm-tab-panel__maximize-btn"
              onClick={handleMaximize}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? '\u29C9' : '\u25A1'}
            </button>
          )}
        </div>
      </div>
      <div className="kasm-tab-panel__content">
        {/* rc-dock style: cache all tab content, only show active */}
        {tabs.map(tab => (
          <div
            key={tab.id}
            className="kasm-tab-panel__pane"
            style={{ display: tab.id === activeId ? 'block' : 'none' }}
          >
            {tab.content}
          </div>
        ))}
      </div>

      {/* Dock drop indicator overlay */}
      <DockDropIndicator {...indicatorProps} />
    </div>
  );
}
