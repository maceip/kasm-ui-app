// ============================================================
// TabPanel - rc-dock style tabbed panel system
// SolidJS port
// ============================================================

import { createSignal, Show, For, type JSX } from 'solid-js';
import { DockDropIndicator, createDockDrop } from './DockDropIndicator';
import type { DockDropZone } from './DockDropIndicator';
import type { DockDirection } from '../core/types';
import './tabPanel.css';

export interface Tab {
  id: string;
  title: string;
  icon?: string;
  closable?: boolean;
  content: JSX.Element;
}

interface TabPanelProps {
  tabs: Tab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onTabReorder?: (fromIdx: number, toIdx: number) => void;
  panelId?: string;
  onDock?: (tabId: string, direction: DockDirection, targetPanelId?: string) => void;
  onMaximize?: (panelId: string) => void;
  onFloat?: (tabId: string) => void;
  className?: string;
}

const FLOAT_DRAG_THRESHOLD = 40;

export function TabPanel(props: TabPanelProps) {
  const panelId = () => props.panelId ?? '';
  const [internalActiveId, setInternalActiveId] = createSignal(props.tabs[0]?.id ?? '');
  const [dragOverIdx, setDragOverIdx] = createSignal<number | null>(null);
  const [isMaximized, setIsMaximized] = createSignal(false);
  const activeId = () => props.activeTabId ?? internalActiveId();
  let panelRef: HTMLDivElement | undefined;
  let tabDragStartPos: { x: number; y: number } | null = null;

  const setActive = (id: string) => {
    setInternalActiveId(id);
    props.onTabChange?.(id);
  };

  const activeTab = () => props.tabs.find(t => t.id === activeId()) ?? props.tabs[0];

  const handleDockCb = (tabId: string, direction: DockDropZone, targetPanelId: string) => {
    props.onDock?.(tabId, direction as DockDirection, targetPanelId);
  };

  const dock = createDockDrop({
    panelId: panelId(),
    enabled: !!props.onDock,
    onDock: handleDockCb,
  });

  const handleMaximize = () => {
    setIsMaximized(prev => !prev);
    if (panelId()) {
      props.onMaximize?.(panelId());
    }
  };

  const handleTabDragStart = (e: DragEvent, tab: Tab, index: number) => {
    e.dataTransfer!.setData('text/plain', String(index));
    e.dataTransfer!.setData('application/kasm-tab-id', tab.id);
    e.dataTransfer!.setData('application/kasm-source-panel', panelId());
    e.dataTransfer!.effectAllowed = 'move';
    tabDragStartPos = { x: e.clientX, y: e.clientY };
  };

  const handleTabDragEnd = (e: DragEvent, tab: Tab) => {
    if (!tabDragStartPos || !panelRef || !props.onFloat) return;
    const panelRect = panelRef.getBoundingClientRect();
    const outsidePanel =
      e.clientX < panelRect.left - FLOAT_DRAG_THRESHOLD ||
      e.clientX > panelRect.right + FLOAT_DRAG_THRESHOLD ||
      e.clientY < panelRect.top - FLOAT_DRAG_THRESHOLD ||
      e.clientY > panelRect.bottom + FLOAT_DRAG_THRESHOLD;
    if (outsidePanel && e.dataTransfer!.dropEffect === 'none') {
      props.onFloat(tab.id);
    }
    tabDragStartPos = null;
  };

  return (
    <div
      ref={panelRef}
      class={`kasm-tab-panel ${isMaximized() ? 'kasm-tab-panel--maximized' : ''} ${dock.isDragOver() ? 'kasm-tab-panel--drag-over' : ''} ${props.className || ''}`}
      onDragEnter={dock.panelProps.onDragEnter}
      onDragOver={dock.panelProps.onDragOver}
      onDragLeave={dock.panelProps.onDragLeave}
      onDrop={dock.panelProps.onDrop}
    >
      <div class="kasm-tab-panel__header">
        <div class="kasm-tab-panel__tabs">
          <For each={props.tabs}>
            {(tab, i) => (
              <div
                class={`kasm-tab-panel__tab ${tab.id === activeId() ? 'kasm-tab-panel__tab--active' : ''} ${dragOverIdx() === i() ? 'kasm-tab-panel__tab--drag-over' : ''}`}
                onClick={() => setActive(tab.id)}
                draggable={true}
                onDragStart={(e) => handleTabDragStart(e, tab, i())}
                onDragEnd={(e) => handleTabDragEnd(e, tab)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i()); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(fromIdx) && fromIdx !== i()) {
                    props.onTabReorder?.(fromIdx, i());
                  }
                  setDragOverIdx(null);
                }}
              >
                <Show when={tab.icon}>
                  <span class="kasm-tab-panel__tab-icon">{tab.icon}</span>
                </Show>
                <span class="kasm-tab-panel__tab-title">{tab.title}</span>
                <Show when={tab.closable !== false}>
                  <button
                    class="kasm-tab-panel__tab-close"
                    onClick={(e) => { e.stopPropagation(); props.onTabClose?.(tab.id); }}
                  >
                    {'\u2715'}
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
        <div class="kasm-tab-panel__header-actions">
          <Show when={props.onMaximize}>
            <button
              class="kasm-tab-panel__maximize-btn"
              onClick={handleMaximize}
              title={isMaximized() ? 'Restore' : 'Maximize'}
            >
              {isMaximized() ? '\u29C9' : '\u25A1'}
            </button>
          </Show>
        </div>
      </div>
      <div class="kasm-tab-panel__content">
        <For each={props.tabs}>
          {(tab) => (
            <div
              class="kasm-tab-panel__pane"
              style={{ display: tab.id === activeId() ? 'block' : 'none' }}
            >
              {tab.content}
            </div>
          )}
        </For>
      </div>

      <DockDropIndicator {...dock.indicatorProps} />
    </div>
  );
}
