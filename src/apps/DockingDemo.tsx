// ============================================================
// Docking Demo - rc-dock tree layout with drag-to-dock
// Recursive split/tab tree model with full restructuring
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { SplitPane } from '../layout/SplitPane';
import { TabPanel, type Tab } from '../layout/TabPanel';
import type { AppProps, DockDirection } from '../core/types';
import './apps.css';

// ============================================================
// Layout tree types (rc-dock model)
// ============================================================

type LayoutNode =
  | SplitNode
  | TabsNode;

interface SplitNode {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  children: LayoutNode[];
  sizes: number[];
}

interface TabsNode {
  type: 'tabs';
  id: string;
  tabs: Tab[];
  activeTabId: string;
}

// ============================================================
// Tab content registry - keeps content stable across tree moves
// ============================================================

const TAB_REGISTRY: Record<string, Tab> = {
  explorer: { id: 'explorer', title: 'Explorer', icon: '\u{1F4C1}', content: <ExplorerPanel />, closable: false },
  search: { id: 'search', title: 'Search', icon: '\u{1F50D}', content: <SearchPanel /> },
  welcome: { id: 'welcome', title: 'Welcome', icon: '\u{1F44B}', content: <WelcomePanel /> },
  code: { id: 'code', title: 'main.tsx', icon: '\u{1F4DD}', content: <CodePanel /> },
  terminal: { id: 'terminal', title: 'Terminal', icon: '\u2B1B', content: <MiniTerminal />, closable: false },
  output: { id: 'output', title: 'Output', icon: '\u{1F4CB}', content: <OutputPanel /> },
  problems: { id: 'problems', title: 'Problems', icon: '\u26A0', content: <ProblemsPanel /> },
};

function getTab(id: string): Tab {
  return TAB_REGISTRY[id] ?? { id, title: id, content: <div>{id}</div> };
}

// ============================================================
// rc-dock tree algorithms
// ============================================================

/** Generate unique panel ids */
let nextPanelId = 1;
function genPanelId(): string {
  return `panel-${nextPanelId++}`;
}

/** Deep clone a layout node */
function cloneTree(node: LayoutNode): LayoutNode {
  if (node.type === 'tabs') {
    return { ...node, tabs: [...node.tabs] };
  }
  return {
    ...node,
    children: node.children.map(cloneTree),
    sizes: [...node.sizes],
  };
}

/** Find a tab in the tree and return the panel that contains it */
function findTabPanel(tree: LayoutNode, tabId: string): TabsNode | null {
  if (tree.type === 'tabs') {
    return tree.tabs.some(t => t.id === tabId) ? tree : null;
  }
  for (const child of tree.children) {
    const found = findTabPanel(child, tabId);
    if (found) return found;
  }
  return null;
}

/** Find a panel node by its panelId */
function findPanel(tree: LayoutNode, panelId: string): TabsNode | null {
  if (tree.type === 'tabs') {
    return tree.id === panelId ? tree : null;
  }
  for (const child of tree.children) {
    const found = findPanel(child, panelId);
    if (found) return found;
  }
  return null;
}

/**
 * Remove a tab from the tree. Returns the new tree (or null if tree is now empty).
 * Collapses empty panels and flattens single-child splits.
 */
function removeTab(tree: LayoutNode, tabId: string): LayoutNode | null {
  if (tree.type === 'tabs') {
    const newTabs = tree.tabs.filter(t => t.id !== tabId);
    if (newTabs.length === 0) return null;
    const newActive = tree.activeTabId === tabId
      ? newTabs[0].id
      : tree.activeTabId;
    return { ...tree, tabs: newTabs, activeTabId: newActive };
  }

  // Split node: recurse into children
  const newChildren: LayoutNode[] = [];
  const newSizes: number[] = [];

  for (let i = 0; i < tree.children.length; i++) {
    const result = removeTab(tree.children[i], tabId);
    if (result !== null) {
      newChildren.push(result);
      newSizes.push(tree.sizes[i] ?? 1);
    }
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0]; // flatten single-child split
  return { ...tree, children: newChildren, sizes: newSizes };
}

/**
 * Dock a tab onto a target panel in a given direction.
 * - 'center': add tab to existing panel
 * - 'left'/'right': wrap target in horizontal split
 * - 'top'/'bottom': wrap target in vertical split
 */
function dockTab(
  tree: LayoutNode,
  tabId: string,
  targetPanelId: string,
  direction: DockDirection,
): LayoutNode {
  const tab = getTab(tabId);

  // First, remove the tab from its current location (if it exists in the tree)
  let newTree = removeTab(tree, tabId);
  if (newTree === null) {
    // Tree became empty after removal; this shouldn't normally happen
    // but create a fallback
    newTree = { type: 'tabs', id: genPanelId(), tabs: [tab], activeTabId: tabId };
    return newTree;
  }

  // Now dock the tab at the target
  return dockTabInto(newTree, tab, targetPanelId, direction);
}

/** Recursively find and dock a tab into a target panel */
function dockTabInto(
  node: LayoutNode,
  tab: Tab,
  targetPanelId: string,
  direction: DockDirection,
): LayoutNode {
  if (node.type === 'tabs') {
    if (node.id !== targetPanelId) return node;

    // Found the target panel
    if (direction === 'center') {
      return {
        ...node,
        tabs: [...node.tabs, tab],
        activeTabId: tab.id,
      };
    }

    // Wrap in a split
    const newPanel: TabsNode = {
      type: 'tabs',
      id: genPanelId(),
      tabs: [tab],
      activeTabId: tab.id,
    };

    const splitDirection: 'horizontal' | 'vertical' =
      direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';

    const first = direction === 'left' || direction === 'top' ? newPanel : node;
    const second = direction === 'left' || direction === 'top' ? node : newPanel;

    return {
      type: 'split',
      direction: splitDirection,
      children: [first, second],
      sizes: [1, 1],
    };
  }

  // Split node: recurse into children
  return {
    ...node,
    children: node.children.map(child =>
      dockTabInto(child, tab, targetPanelId, direction),
    ),
    sizes: [...node.sizes],
  };
}

/**
 * Fix/normalize the tree:
 * - Flatten single-child splits
 * - Remove empty tab panels
 * - Flatten nested splits with same direction
 */
function fixTree(node: LayoutNode): LayoutNode | null {
  if (node.type === 'tabs') {
    return node.tabs.length === 0 ? null : node;
  }

  // Recurse and filter
  let children: LayoutNode[] = [];
  let sizes: number[] = [];

  for (let i = 0; i < node.children.length; i++) {
    const fixed = fixTree(node.children[i]);
    if (fixed !== null) {
      // Flatten nested splits with same direction
      if (fixed.type === 'split' && fixed.direction === node.direction) {
        const totalSize = node.sizes[i] ?? 1;
        const childTotal = fixed.sizes.reduce((a, b) => a + b, 0) || 1;
        for (let j = 0; j < fixed.children.length; j++) {
          children.push(fixed.children[j]);
          sizes.push((fixed.sizes[j] / childTotal) * totalSize);
        }
      } else {
        children.push(fixed);
        sizes.push(node.sizes[i] ?? 1);
      }
    }
  }

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...node, children, sizes };
}

// ============================================================
// Default layout
// ============================================================

function createDefaultLayout(): LayoutNode {
  nextPanelId = 1; // Reset for deterministic ids
  return {
    type: 'split',
    direction: 'vertical',
    children: [
      {
        type: 'split',
        direction: 'horizontal',
        children: [
          {
            type: 'tabs',
            id: 'panel-sidebar',
            tabs: [getTab('explorer'), getTab('search')],
            activeTabId: 'explorer',
          },
          {
            type: 'tabs',
            id: 'panel-center',
            tabs: [getTab('welcome'), getTab('code')],
            activeTabId: 'welcome',
          },
        ],
        sizes: [1, 3],
      },
      {
        type: 'tabs',
        id: 'panel-bottom',
        tabs: [getTab('terminal'), getTab('output'), getTab('problems')],
        activeTabId: 'terminal',
      },
    ],
    sizes: [3, 1],
  };
}

// ============================================================
// Recursive tree renderer
// ============================================================

interface TreeRendererProps {
  node: LayoutNode;
  onDock: (tabId: string, direction: DockDirection, targetPanelId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabChange: (panelId: string, tabId: string) => void;
  onTabReorder: (panelId: string, fromIdx: number, toIdx: number) => void;
}

function RenderNode({ node, onDock, onTabClose, onTabChange, onTabReorder }: TreeRendererProps) {
  if (node.type === 'split') {
    return (
      <SplitPane
        orientation={node.direction}
        sizes={node.sizes}
        minSizes={node.children.map(() => 80)}
      >
        {node.children.map((child, i) => (
          <RenderNode
            key={child.type === 'tabs' ? child.id : `split-${i}`}
            node={child}
            onDock={onDock}
            onTabClose={onTabClose}
            onTabChange={onTabChange}
            onTabReorder={onTabReorder}
          />
        ))}
      </SplitPane>
    );
  }

  // Tabs node
  return (
    <TabPanel
      tabs={node.tabs}
      activeTabId={node.activeTabId}
      panelId={node.id}
      onDock={(tabId, direction, _targetPanelId) => {
        onDock(tabId, direction, node.id);
      }}
      onTabChange={(tabId) => onTabChange(node.id, tabId)}
      onTabClose={onTabClose}
      onTabReorder={(fromIdx, toIdx) => onTabReorder(node.id, fromIdx, toIdx)}
    />
  );
}

// ============================================================
// DockingDemo component
// ============================================================

export function DockingDemo({ windowId }: AppProps) {
  const [layout, setLayout] = useState<LayoutNode>(createDefaultLayout);

  const handleDock = useCallback((tabId: string, direction: DockDirection, targetPanelId: string) => {
    setLayout(prev => {
      // Don't dock a tab onto the same panel as 'center' if it's already there
      if (direction === 'center') {
        const targetPanel = findPanel(prev, targetPanelId);
        if (targetPanel && targetPanel.tabs.some(t => t.id === tabId)) {
          return prev; // Tab is already in this panel
        }
      }

      const newTree = dockTab(prev, tabId, targetPanelId, direction);
      return fixTree(newTree) ?? createDefaultLayout();
    });
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    setLayout(prev => {
      const newTree = removeTab(prev, tabId);
      return fixTree(newTree ?? createDefaultLayout()) ?? createDefaultLayout();
    });
  }, []);

  const handleTabChange = useCallback((panelId: string, tabId: string) => {
    setLayout(prev => {
      return updatePanelInTree(prev, panelId, panel => ({
        ...panel,
        activeTabId: tabId,
      }));
    });
  }, []);

  const handleTabReorder = useCallback((panelId: string, fromIdx: number, toIdx: number) => {
    setLayout(prev => {
      return updatePanelInTree(prev, panelId, panel => {
        const newTabs = [...panel.tabs];
        const [moved] = newTabs.splice(fromIdx, 1);
        newTabs.splice(toIdx, 0, moved);
        return { ...panel, tabs: newTabs };
      });
    });
  }, []);

  return (
    <div className="kasm-app kasm-docking-demo">
      <RenderNode
        node={layout}
        onDock={handleDock}
        onTabClose={handleTabClose}
        onTabChange={handleTabChange}
        onTabReorder={handleTabReorder}
      />
    </div>
  );
}

/** Update a specific panel in the tree by its panelId */
function updatePanelInTree(
  node: LayoutNode,
  panelId: string,
  updater: (panel: TabsNode) => TabsNode,
): LayoutNode {
  if (node.type === 'tabs') {
    return node.id === panelId ? updater(node) : node;
  }
  return {
    ...node,
    children: node.children.map(child =>
      updatePanelInTree(child, panelId, updater),
    ),
  };
}

// ============================================================
// Panel content components (unchanged)
// ============================================================

function ExplorerPanel() {
  return (
    <div className="kasm-dock-panel-content">
      <div className="kasm-dock-tree">
        <div className="kasm-dock-tree__item">{'\u{1F4C1}'} src</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C1}'} core</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 40 }}>{'\u{1F4C4}'} types.ts</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 40 }}>{'\u{1F4C4}'} store.ts</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 40 }}>{'\u{1F4C4}'} events.ts</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C1}'} shell</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C1}'} window</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C1}'} layout</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C1}'} apps</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C4}'} App.tsx</div>
        <div className="kasm-dock-tree__item" style={{ paddingLeft: 20 }}>{'\u{1F4C4}'} main.tsx</div>
        <div className="kasm-dock-tree__item">{'\u{1F4C4}'} package.json</div>
        <div className="kasm-dock-tree__item">{'\u{1F4C4}'} tsconfig.json</div>
      </div>
    </div>
  );
}

function SearchPanel() {
  return (
    <div className="kasm-dock-panel-content">
      <input type="text" placeholder="Search files..." style={{ width: '100%', padding: 6, boxSizing: 'border-box' }} />
    </div>
  );
}

function WelcomePanel() {
  return (
    <div className="kasm-dock-panel-content" style={{ padding: 20 }}>
      <h3>Docking Layout Demo</h3>
      <p style={{ fontSize: 13, lineHeight: 1.8 }}>
        This demonstrates the docking system combining:<br />
        <strong>rc-dock</strong> - tabbed panels with drag-to-dock restructuring<br />
        <strong>Re-Flex</strong> - constraint-aware resizable splitters<br />
        <strong>Golden Layout</strong> - themed tab headers<br /><br />
        Try dragging tabs to the drop zone indicators on other panels to restructure the layout!
      </p>
    </div>
  );
}

function CodePanel() {
  return (
    <div className="kasm-dock-panel-content">
      <pre style={{ margin: 0, padding: 12, fontSize: 12, lineHeight: 1.6 }}>{`import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = createRoot(
  document.getElementById('root')!
);

root.render(<App />);`}</pre>
    </div>
  );
}

function MiniTerminal() {
  return (
    <div className="kasm-dock-panel-content" style={{ background: 'var(--kasm-terminal-bg)', color: 'var(--kasm-terminal-fg)', fontFamily: 'monospace', fontSize: 12, padding: 8 }}>
      $ npm run dev<br />
      VITE v7.2.5 ready in 120ms<br />
      {'\u279E'} Local: http://localhost:5173/<br />
    </div>
  );
}

function OutputPanel() {
  return (
    <div className="kasm-dock-panel-content" style={{ fontSize: 12, padding: 8 }}>
      [INFO] Build completed in 0.42s<br />
      [INFO] 0 errors, 0 warnings<br />
    </div>
  );
}

function ProblemsPanel() {
  return (
    <div className="kasm-dock-panel-content" style={{ fontSize: 12, padding: 8 }}>
      No problems detected. {'\u2713'}
    </div>
  );
}
