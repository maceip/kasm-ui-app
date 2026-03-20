// ============================================================
// File Manager - Cinnamon Nemo-inspired file browser
// Full VFS integration with CRUD, drag-drop, preview, sorting
// ============================================================

import { createSignal, createMemo, createEffect, onCleanup, Show, For, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { AppProps } from '../core/types';
import './apps.css';
import { vfs } from './vfs';
import type { VFSNode } from './vfs';

type SortKey = 'name' | 'size' | 'modified';
type SortDir = 'asc' | 'desc';

interface ContextMenu {
  x: number;
  y: number;
  target: VFSNode | null;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getIcon(node: VFSNode): string {
  if (node.type === 'folder') {
    const specialFolders: Record<string, string> = {
      Documents: '\u{1F4C1}', Pictures: '\u{1F5BC}', Downloads: '\u{1F4E5}',
      Projects: '\u{1F4BC}', Music: '\u{1F3B5}', '.config': '\u2699',
    };
    return specialFolders[node.name] || '\u{1F4C1}';
  }
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    txt: '\u{1F4DD}', md: '\u{1F4C4}', json: '\u{1F4CB}', csv: '\u{1F4CA}',
    js: '\u{1F4DC}', ts: '\u{1F4DC}', tsx: '\u{1F4DC}', jsx: '\u{1F4DC}',
    html: '\u{1F310}', css: '\u{1F3A8}', svg: '\u{1F3A8}',
    png: '\u{1F5BC}', jpg: '\u{1F5BC}', jpeg: '\u{1F5BC}', gif: '\u{1F5BC}',
    sh: '\u{1F4DF}', bash: '\u{1F4DF}',
    pdf: '\u{1F4D1}', xlsx: '\u{1F4CA}',
    tar: '\u{1F4E6}', gz: '\u{1F4E6}', zip: '\u{1F4E6}',
    m3u: '\u{1F3B6}', mp3: '\u{1F3B5}',
    lua: '\u{1F4DC}', py: '\u{1F40D}',
  };
  return iconMap[ext] || '\u{1F4C4}';
}

const HOME = '/home/kasm-user';

export function FileManager({ windowId }: AppProps) {
  const [path, setPath] = createSignal(HOME);
  const [view, setView] = createSignal<'list' | 'grid'>('list');
  const [search, setSearch] = createSignal('');
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [sortKey, setSortKey] = createSignal<SortKey>('name');
  const [sortDir, setSortDir] = createSignal<SortDir>('asc');
  const [previewFile, setPreviewFile] = createSignal<string | null>(null);
  const [previewContent, setPreviewContent] = createSignal('');
  const [contextMenu, setContextMenu] = createSignal<ContextMenu | null>(null);
  const [editingName, setEditingName] = createSignal<string | null>(null);
  const [editValue, setEditValue] = createSignal('');
  const [clipboard, setClipboard] = createSignal<{ paths: string[]; op: 'copy' | 'cut' } | null>(null);
  const [dragItem, setDragItem] = createSignal<string | null>(null);
  const [refresh, setRefresh] = createSignal(0);
  let editRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const forceRefresh = () => setRefresh(r => r + 1);

  const files = createMemo(() => {
    // track refresh signal
    refresh();
    try {
      return vfs.readDir(path());
    } catch {
      return [];
    }
  });

  const relativePath = createMemo(() => {
    const p = path();
    return p.startsWith(HOME) ? p.substring(HOME.length) || '/' : p;
  });

  const breadcrumbs = createMemo(() => {
    const rp = relativePath();
    return rp === '/'
      ? ['Home']
      : ['Home', ...rp.split('/').filter(Boolean)];
  });

  const filtered = createMemo(() => {
    let list = files();
    const s = search();
    if (s) {
      list = list.filter(f => f.name.toLowerCase().includes(s.toLowerCase()));
    }
    // Sort: folders first, then by sortKey
    const sk = sortKey();
    const sd = sortDir();
    list = [...list].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      let cmp = 0;
      if (sk === 'name') cmp = a.name.localeCompare(b.name);
      else if (sk === 'size') cmp = a.size - b.size;
      else if (sk === 'modified') cmp = a.modified.getTime() - b.modified.getTime();
      return sd === 'asc' ? cmp : -cmp;
    });
    return list;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey() !== key) return '';
    return sortDir() === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const navigateTo = (file: VFSNode) => {
    if (file.type === 'folder') {
      const p = path();
      const newPath = p === '/' ? `/${file.name}` : `${p}/${file.name}`;
      setPath(newPath);
      setSearch('');
      setSelected(new Set());
      setPreviewFile(null);
    } else {
      // Preview text files
      openPreview(file);
    }
  };

  const openPreview = (file: VFSNode) => {
    const p = path();
    const filePath = p === '/' ? `/${file.name}` : `${p}/${file.name}`;
    try {
      const content = vfs.readFile(filePath);
      setPreviewFile(filePath);
      setPreviewContent(content);
    } catch {
      setPreviewFile(null);
    }
  };

  const navigateToBreadcrumb = (idx: number) => {
    if (idx === 0) setPath(HOME);
    else {
      const parts = relativePath().split('/').filter(Boolean);
      setPath(HOME + '/' + parts.slice(0, idx).join('/'));
    }
    setSelected(new Set());
    setPreviewFile(null);
  };

  const goUp = () => {
    const parent = path().split('/').slice(0, -1).join('/') || '/';
    setPath(parent);
    setSelected(new Set());
    setPreviewFile(null);
  };

  const toggleSelect = (name: string, e: MouseEvent) => {
    const newSel = new Set(selected());
    if (e.ctrlKey || e.metaKey) {
      if (newSel.has(name)) newSel.delete(name);
      else newSel.add(name);
    } else {
      newSel.clear();
      newSel.add(name);
    }
    setSelected(newSel);
  };

  const handleContextMenu = (e: MouseEvent, target: VFSNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  };

  const closeContextMenu = () => setContextMenu(null);

  const createNewFolder = () => {
    closeContextMenu();
    const p = path();
    let name = 'New Folder';
    let i = 1;
    while (vfs.exists(`${p}/${name}`)) {
      name = `New Folder (${i++})`;
    }
    try {
      vfs.mkdir(`${p}/${name}`);
      forceRefresh();
      setEditingName(name);
      setEditValue(name);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const createNewFile = () => {
    closeContextMenu();
    const p = path();
    let name = 'New File.txt';
    let i = 1;
    while (vfs.exists(`${p}/${name}`)) {
      name = `New File (${i++}).txt`;
    }
    try {
      vfs.writeFile(`${p}/${name}`, '');
      forceRefresh();
      setEditingName(name);
      setEditValue(name);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const deleteSelected = () => {
    closeContextMenu();
    const cm = contextMenu();
    const toDelete = cm?.target
      ? [cm.target.name]
      : Array.from(selected());
    if (toDelete.length === 0) return;
    const confirmed = window.confirm(`Delete ${toDelete.length} item(s)?`);
    if (!confirmed) return;
    const p = path();
    for (const name of toDelete) {
      try {
        vfs.rm(`${p}/${name}`, true);
      } catch (err: any) {
        console.error(err.message);
      }
    }
    setSelected(new Set());
    setPreviewFile(null);
    forceRefresh();
  };

  const startRename = (name: string) => {
    closeContextMenu();
    setEditingName(name);
    setEditValue(name);
    setTimeout(() => editRef?.select(), 0);
  };

  const finishRename = () => {
    const en = editingName();
    const ev = editValue();
    if (!en || !ev || ev === en) {
      setEditingName(null);
      return;
    }
    const p = path();
    try {
      vfs.mv(`${p}/${en}`, `${p}/${ev}`);
      const newSel = new Set(selected());
      newSel.delete(en);
      newSel.add(ev);
      setSelected(newSel);
      forceRefresh();
    } catch (err: any) {
      console.error(err.message);
    }
    setEditingName(null);
  };

  const handleCopy = () => {
    if (selected().size > 0) {
      const p = path();
      setClipboard({
        paths: Array.from(selected()).map(n => `${p}/${n}`),
        op: 'copy'
      });
    }
  };

  const handlePaste = () => {
    const cb = clipboard();
    if (!cb) return;
    const p = path();
    for (const src of cb.paths) {
      try {
        const srcNode = vfs.getNode(src);
        if (!srcNode) continue;
        let destName = srcNode.name;
        let i = 1;
        while (vfs.exists(`${p}/${destName}`)) {
          const dot = srcNode.name.lastIndexOf('.');
          if (dot > 0 && srcNode.type === 'file') {
            destName = `${srcNode.name.substring(0, dot)} (${i++})${srcNode.name.substring(dot)}`;
          } else {
            destName = `${srcNode.name} (${i++})`;
          }
        }
        vfs.cp(src, `${p}/${destName}`, true);
        if (cb.op === 'cut') {
          vfs.rm(src, true);
        }
      } catch (err: any) {
        console.error(err.message);
      }
    }
    if (cb.op === 'cut') setClipboard(null);
    forceRefresh();
  };

  // Keyboard shortcuts
  createEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c') {
        if (selected().size > 0 && containerRef?.contains(document.activeElement as Node)) {
          e.preventDefault();
          handleCopy();
        }
      }
      if (e.ctrlKey && e.key === 'v') {
        if (clipboard() && containerRef?.contains(document.activeElement as Node)) {
          e.preventDefault();
          handlePaste();
        }
      }
      if (e.key === 'Delete') {
        if (selected().size > 0 && containerRef?.contains(document.activeElement as Node)) {
          deleteSelected();
        }
      }
      if (e.key === 'F2') {
        if (selected().size === 1 && containerRef?.contains(document.activeElement as Node)) {
          startRename(Array.from(selected())[0]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    onCleanup(() => window.removeEventListener('keydown', handler));
  });

  // Close context menu on click outside
  createEffect(() => {
    if (contextMenu()) {
      const handler = () => closeContextMenu();
      window.addEventListener('click', handler);
      onCleanup(() => window.removeEventListener('click', handler));
    }
  });

  // Drag handlers
  const handleDragStart = (e: DragEvent, name: string) => {
    setDragItem(name);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', name);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: DragEvent, targetName: string) => {
    e.preventDefault();
    const di = dragItem();
    if (!di || di === targetName) return;
    const targetNode = files().find(f => f.name === targetName);
    if (!targetNode || targetNode.type !== 'folder') return;
    const p = path();
    try {
      vfs.mv(`${p}/${di}`, `${p}/${targetName}/${di}`);
      setSelected(new Set());
      forceRefresh();
    } catch (err: any) {
      console.error(err.message);
    }
    setDragItem(null);
  };

  const renderName = (file: VFSNode) => {
    if (editingName() === file.name) {
      return (
        <input
          ref={editRef}
          class="kasm-fm__edit-input"
          value={editValue()}
          onInput={e => setEditValue(e.currentTarget.value)}
          onBlur={finishRename}
          onKeyDown={e => {
            if (e.key === 'Enter') finishRename();
            if (e.key === 'Escape') setEditingName(null);
          }}
          autofocus
          onClick={e => e.stopPropagation()}
          onDblClick={e => e.stopPropagation()}
          style={{
            "background": 'rgba(255,255,255,0.1)',
            "border": '1px solid var(--kasm-accent, #6c5ce7)',
            "color": 'inherit',
            "font-family": 'inherit',
            "font-size": 'inherit',
            "padding": '1px 4px',
            "border-radius": '3px',
            "outline": 'none',
            "width": '100%',
            "max-width": '200px',
          }}
        />
      );
    }
    return (
      <span
        onDblClick={(e) => {
          if (file.type !== 'folder') {
            e.stopPropagation();
            startRename(file.name);
          }
        }}
      >
        {file.name}
      </span>
    );
  };

  return (
    <div
      class="kasm-app kasm-file-manager"
      ref={containerRef}
      tabIndex={0}
      onContextMenu={e => handleContextMenu(e, null)}
      onClick={() => { if (!contextMenu()) return; }}
    >
      {/* Toolbar */}
      <div class="kasm-fm__toolbar">
        <button
          class="kasm-fm__nav-btn"
          onClick={goUp}
          disabled={path() === '/'}
          title="Go up"
        >
          {'\u2190'}
        </button>
        <button
          class="kasm-fm__nav-btn"
          onClick={createNewFolder}
          title="New Folder"
          style={{ "font-size": "12px" }}
        >
          {'+\u{1F4C1}'}
        </button>
        <button
          class="kasm-fm__nav-btn"
          onClick={createNewFile}
          title="New File"
          style={{ "font-size": "12px" }}
        >
          {'+\u{1F4C4}'}
        </button>
        <div class="kasm-fm__breadcrumbs">
          <For each={breadcrumbs()}>
            {(crumb, i) => (
              <span>
                <button class="kasm-fm__breadcrumb" onClick={() => navigateToBreadcrumb(i())}>
                  {crumb}
                </button>
                <Show when={i() < breadcrumbs().length - 1}>
                  <span class="kasm-fm__separator">/</span>
                </Show>
              </span>
            )}
          </For>
        </div>
        <input
          class="kasm-fm__search"
          placeholder="Search..."
          value={search()}
          onInput={e => setSearch(e.currentTarget.value)}
        />
        <div class="kasm-fm__view-toggle">
          <button class={view() === 'list' ? 'active' : ''} onClick={() => setView('list')}>{'\u2630'}</button>
          <button class={view() === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>{'\u229E'}</button>
        </div>
      </div>

      {/* Main area with optional preview */}
      <div style={{ "display": "flex", "flex": "1", "overflow": "hidden", "min-height": "0" }}>
        {/* Content */}
        <div class={`kasm-fm__content kasm-fm__content--${view()}`} style={{ "flex": "1" }}>
          <Show when={view() === 'list'} fallback={
            <div class="kasm-fm__grid">
              <For each={filtered()}>
                {(file) => (
                  <div
                    class="kasm-fm__grid-item"
                    onDblClick={() => navigateTo(file)}
                    onClick={e => toggleSelect(file.name, e)}
                    onContextMenu={e => {
                      if (!selected().has(file.name)) {
                        setSelected(new Set([file.name]));
                      }
                      handleContextMenu(e, file);
                    }}
                    draggable={true}
                    onDragStart={e => handleDragStart(e, file.name)}
                    onDragOver={file.type === 'folder' ? handleDragOver : undefined}
                    onDrop={file.type === 'folder' ? (e: DragEvent) => handleDrop(e, file.name) : undefined}
                    style={{
                      "background": selected().has(file.name)
                        ? 'rgba(108, 92, 231, 0.2)'
                        : undefined,
                      "border-radius": "6px",
                    }}
                  >
                    <span class="kasm-fm__grid-icon">{getIcon(file)}</span>
                    <span class="kasm-fm__grid-name">{renderName(file)}</span>
                  </div>
                )}
              </For>
            </div>
          }>
            <table class="kasm-fm__table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('name')} style={{ "cursor": "pointer" }}>
                    Name{sortIndicator('name')}
                  </th>
                  <th onClick={() => toggleSort('size')} style={{ "cursor": "pointer", "width": "90px" }}>
                    Size{sortIndicator('size')}
                  </th>
                  <th onClick={() => toggleSort('modified')} style={{ "cursor": "pointer", "width": "110px" }}>
                    Modified{sortIndicator('modified')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={filtered()}>
                  {(file) => (
                    <tr
                      onDblClick={() => navigateTo(file)}
                      onClick={e => toggleSelect(file.name, e)}
                      onContextMenu={e => {
                        if (!selected().has(file.name)) {
                          setSelected(new Set([file.name]));
                        }
                        handleContextMenu(e, file);
                      }}
                      draggable={true}
                      onDragStart={e => handleDragStart(e, file.name)}
                      onDragOver={file.type === 'folder' ? handleDragOver : undefined}
                      onDrop={file.type === 'folder' ? (e: DragEvent) => handleDrop(e, file.name) : undefined}
                      style={{
                        "background": selected().has(file.name)
                          ? 'rgba(108, 92, 231, 0.2)'
                          : undefined,
                      }}
                    >
                      <td>
                        <span class="kasm-fm__file-icon">{getIcon(file)}</span>
                        {renderName(file)}
                      </td>
                      <td>{file.type === 'file' ? formatSize(file.size) : '--'}</td>
                      <td>{formatDate(file.modified)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
          <Show when={filtered().length === 0}>
            <div class="kasm-fm__empty">No files found</div>
          </Show>
        </div>

        {/* Preview panel */}
        <Show when={previewFile()}>
          <div
            style={{
              "width": "280px",
              "flex-shrink": "0",
              "border-left": "1px solid var(--kasm-surface-border, #333)",
              "display": "flex",
              "flex-direction": "column",
              "background": "var(--kasm-surface-bg, #1a1a2e)",
            }}
          >
            <div style={{
              "padding": "6px 10px",
              "border-bottom": "1px solid var(--kasm-surface-border, #333)",
              "display": "flex",
              "justify-content": "space-between",
              "align-items": "center",
              "font-size": "12px",
              "font-weight": "600",
            }}>
              <span style={{ "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {previewFile()!.split('/').pop()}
              </span>
              <button
                onClick={() => setPreviewFile(null)}
                style={{
                  "border": "none",
                  "background": "transparent",
                  "color": "inherit",
                  "cursor": "pointer",
                  "font-size": "14px",
                  "padding": "0 4px",
                  "opacity": "0.6",
                }}
              >
                {'\u2715'}
              </button>
            </div>
            <pre style={{
              "flex": "1",
              "overflow": "auto",
              "padding": "8px 10px",
              "font-size": "11px",
              "line-height": "1.5",
              "margin": "0",
              "white-space": "pre-wrap",
              "word-break": "break-word",
              "font-family": "'JetBrains Mono', 'Fira Code', monospace",
            }}>
              {previewContent()}
            </pre>
          </div>
        </Show>
      </div>

      {/* Status bar */}
      <div class="kasm-fm__statusbar">
        {filtered().length} items{selected().size > 0 ? ` \u00B7 ${selected().size} selected` : ''} {'\u00B7'} {path()}
        {clipboard() && ` \u00B7 ${clipboard()!.paths.length} in clipboard (${clipboard()!.op})`}
      </div>

      {/* Context menu */}
      <Show when={contextMenu()}>
        {(cm) => (
          <Portal><div
            style={{
              "position": "fixed",
              "left": `${cm().x}px`,
              "top": `${cm().y}px`,
              "background": "var(--kasm-surface-bg, #1a1a2e)",
              "border": "1px solid var(--kasm-surface-border, #333)",
              "border-radius": "6px",
              "padding": "4px 0",
              "z-index": "10000",
              "min-width": "160px",
              "box-shadow": "0 4px 16px rgba(0,0,0,0.4)",
              "font-size": "12px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <Show when={cm().target}>
              {(target) => (
                <>
                  <CtxItem label="Open" onClick={() => { closeContextMenu(); navigateTo(target()); }} />
                  <Show when={target().type === 'file'}>
                    <CtxItem label="Preview" onClick={() => { closeContextMenu(); openPreview(target()); }} />
                  </Show>
                  <CtxItem label="Rename" onClick={() => { startRename(target().name); }} />
                  <CtxItem label="Copy" onClick={() => {
                    closeContextMenu();
                    setClipboard({ paths: [`${path()}/${target().name}`], op: 'copy' });
                  }} />
                  <CtxItem label="Cut" onClick={() => {
                    closeContextMenu();
                    setClipboard({ paths: [`${path()}/${target().name}`], op: 'cut' });
                  }} />
                  <CtxDivider />
                  <CtxItem label="Delete" onClick={deleteSelected} danger />
                  <CtxDivider />
                </>
              )}
            </Show>
            <CtxItem label="New Folder" onClick={createNewFolder} />
            <CtxItem label="New File" onClick={createNewFile} />
            <Show when={clipboard()}>
              {(cb) => (
                <CtxItem label={`Paste (${cb().paths.length})`} onClick={() => { closeContextMenu(); handlePaste(); }} />
              )}
            </Show>
            <CtxDivider />
            <CtxItem label="Refresh" onClick={() => { closeContextMenu(); forceRefresh(); }} />
          </div></Portal>
        )}
      </Show>
    </div>
  );
}

function CtxItem(props: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div
      onClick={props.onClick}
      style={{
        "padding": "5px 16px",
        "cursor": "pointer",
        "color": props.danger ? 'var(--kasm-danger)' : 'inherit',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {props.label}
    </div>
  );
}

function CtxDivider() {
  return <div style={{ "height": "1px", "background": "rgba(255,255,255,0.08)", "margin": "3px 0" }} />;
}
