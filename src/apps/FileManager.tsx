// ============================================================
// File Manager - Cinnamon Nemo-inspired file browser
// Full VFS integration with CRUD, drag-drop, preview, sorting
// ============================================================

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  const [path, setPath] = useState(HOME);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [clipboard, setClipboard] = useState<{ paths: string[]; op: 'copy' | 'cut' } | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const editRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const forceRefresh = useCallback(() => setRefresh(r => r + 1), []);

  const files = useMemo(() => {
    try {
      return vfs.readDir(path);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, refresh]);

  const relativePath = path.startsWith(HOME) ? path.substring(HOME.length) || '/' : path;
  const breadcrumbs = relativePath === '/'
    ? ['Home']
    : ['Home', ...relativePath.split('/').filter(Boolean)];

  const filtered = useMemo(() => {
    let list = files;
    if (search) {
      list = list.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    }
    // Sort: folders first, then by sortKey
    list = [...list].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'size') cmp = a.size - b.size;
      else if (sortKey === 'modified') cmp = a.modified.getTime() - b.modified.getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [files, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const navigateTo = (file: VFSNode) => {
    if (file.type === 'folder') {
      const newPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
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
    const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
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
      const parts = relativePath.split('/').filter(Boolean);
      setPath(HOME + '/' + parts.slice(0, idx).join('/'));
    }
    setSelected(new Set());
    setPreviewFile(null);
  };

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    setPath(parent);
    setSelected(new Set());
    setPreviewFile(null);
  };

  const toggleSelect = (name: string, e: React.MouseEvent) => {
    const newSel = new Set(selected);
    if (e.ctrlKey || e.metaKey) {
      if (newSel.has(name)) newSel.delete(name);
      else newSel.add(name);
    } else {
      newSel.clear();
      newSel.add(name);
    }
    setSelected(newSel);
  };

  const handleContextMenu = (e: React.MouseEvent, target: VFSNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  };

  const closeContextMenu = () => setContextMenu(null);

  const createNewFolder = () => {
    closeContextMenu();
    let name = 'New Folder';
    let i = 1;
    while (vfs.exists(`${path}/${name}`)) {
      name = `New Folder (${i++})`;
    }
    try {
      vfs.mkdir(`${path}/${name}`);
      forceRefresh();
      setEditingName(name);
      setEditValue(name);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const createNewFile = () => {
    closeContextMenu();
    let name = 'New File.txt';
    let i = 1;
    while (vfs.exists(`${path}/${name}`)) {
      name = `New File (${i++}).txt`;
    }
    try {
      vfs.writeFile(`${path}/${name}`, '');
      forceRefresh();
      setEditingName(name);
      setEditValue(name);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const deleteSelected = () => {
    closeContextMenu();
    const toDelete = contextMenu?.target
      ? [contextMenu.target.name]
      : Array.from(selected);
    if (toDelete.length === 0) return;
    const confirmed = window.confirm(`Delete ${toDelete.length} item(s)?`);
    if (!confirmed) return;
    for (const name of toDelete) {
      try {
        vfs.rm(`${path}/${name}`, true);
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
    setTimeout(() => editRef.current?.select(), 0);
  };

  const finishRename = () => {
    if (!editingName || !editValue || editValue === editingName) {
      setEditingName(null);
      return;
    }
    try {
      vfs.mv(`${path}/${editingName}`, `${path}/${editValue}`);
      const newSel = new Set(selected);
      newSel.delete(editingName);
      newSel.add(editValue);
      setSelected(newSel);
      forceRefresh();
    } catch (err: any) {
      console.error(err.message);
    }
    setEditingName(null);
  };

  const handleCopy = useCallback(() => {
    if (selected.size > 0) {
      setClipboard({
        paths: Array.from(selected).map(n => `${path}/${n}`),
        op: 'copy'
      });
    }
  }, [selected, path]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    for (const src of clipboard.paths) {
      try {
        const srcNode = vfs.getNode(src);
        if (!srcNode) continue;
        let destName = srcNode.name;
        let i = 1;
        while (vfs.exists(`${path}/${destName}`)) {
          const dot = srcNode.name.lastIndexOf('.');
          if (dot > 0 && srcNode.type === 'file') {
            destName = `${srcNode.name.substring(0, dot)} (${i++})${srcNode.name.substring(dot)}`;
          } else {
            destName = `${srcNode.name} (${i++})`;
          }
        }
        vfs.cp(src, `${path}/${destName}`, true);
        if (clipboard.op === 'cut') {
          vfs.rm(src, true);
        }
      } catch (err: any) {
        console.error(err.message);
      }
    }
    if (clipboard.op === 'cut') setClipboard(null);
    forceRefresh();
  }, [clipboard, path, forceRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c') {
        // Only intercept if we have selected files and focus is in the file manager
        if (selected.size > 0 && containerRef.current?.contains(document.activeElement as Node)) {
          e.preventDefault();
          handleCopy();
        }
      }
      if (e.ctrlKey && e.key === 'v') {
        if (clipboard && containerRef.current?.contains(document.activeElement as Node)) {
          e.preventDefault();
          handlePaste();
        }
      }
      if (e.key === 'Delete') {
        if (selected.size > 0 && containerRef.current?.contains(document.activeElement as Node)) {
          deleteSelected();
        }
      }
      if (e.key === 'F2') {
        if (selected.size === 1 && containerRef.current?.contains(document.activeElement as Node)) {
          startRename(Array.from(selected)[0]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [contextMenu]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, name: string) => {
    setDragItem(name);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    if (!dragItem || dragItem === targetName) return;
    const targetNode = files.find(f => f.name === targetName);
    if (!targetNode || targetNode.type !== 'folder') return;
    try {
      vfs.mv(`${path}/${dragItem}`, `${path}/${targetName}/${dragItem}`);
      setSelected(new Set());
      forceRefresh();
    } catch (err: any) {
      console.error(err.message);
    }
    setDragItem(null);
  };

  const renderName = (file: VFSNode) => {
    if (editingName === file.name) {
      return (
        <input
          ref={editRef}
          className="kasm-fm__edit-input"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={finishRename}
          onKeyDown={e => {
            if (e.key === 'Enter') finishRename();
            if (e.key === 'Escape') setEditingName(null);
          }}
          autoFocus
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid var(--kasm-accent, #6c5ce7)',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: '1px 4px',
            borderRadius: 3,
            outline: 'none',
            width: '100%',
            maxWidth: 200,
          }}
        />
      );
    }
    return (
      <span
        onDoubleClick={(e) => {
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
      className="kasm-app kasm-file-manager"
      ref={containerRef}
      tabIndex={0}
      onContextMenu={e => handleContextMenu(e, null)}
      onClick={() => { if (!contextMenu) return; }}
    >
      {/* Toolbar */}
      <div className="kasm-fm__toolbar">
        <button
          className="kasm-fm__nav-btn"
          onClick={goUp}
          disabled={path === '/'}
          title="Go up"
        >
          \u2190
        </button>
        <button
          className="kasm-fm__nav-btn"
          onClick={createNewFolder}
          title="New Folder"
          style={{ fontSize: 12 }}
        >
          {'+\u{1F4C1}'}
        </button>
        <button
          className="kasm-fm__nav-btn"
          onClick={createNewFile}
          title="New File"
          style={{ fontSize: 12 }}
        >
          {'+\u{1F4C4}'}
        </button>
        <div className="kasm-fm__breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              <button className="kasm-fm__breadcrumb" onClick={() => navigateToBreadcrumb(i)}>
                {crumb}
              </button>
              {i < breadcrumbs.length - 1 && <span className="kasm-fm__separator">/</span>}
            </span>
          ))}
        </div>
        <input
          className="kasm-fm__search"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="kasm-fm__view-toggle">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>\u2630</button>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>\u229E</button>
        </div>
      </div>

      {/* Main area with optional preview */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Content */}
        <div className={`kasm-fm__content kasm-fm__content--${view}`} style={{ flex: 1 }}>
          {view === 'list' ? (
            <table className="kasm-fm__table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                    Name{sortIndicator('name')}
                  </th>
                  <th onClick={() => toggleSort('size')} style={{ cursor: 'pointer', width: 90 }}>
                    Size{sortIndicator('size')}
                  </th>
                  <th onClick={() => toggleSort('modified')} style={{ cursor: 'pointer', width: 110 }}>
                    Modified{sortIndicator('modified')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(file => (
                  <tr
                    key={file.name}
                    onDoubleClick={() => navigateTo(file)}
                    onClick={e => toggleSelect(file.name, e)}
                    onContextMenu={e => {
                      if (!selected.has(file.name)) {
                        setSelected(new Set([file.name]));
                      }
                      handleContextMenu(e, file);
                    }}
                    draggable
                    onDragStart={e => handleDragStart(e, file.name)}
                    onDragOver={file.type === 'folder' ? handleDragOver : undefined}
                    onDrop={file.type === 'folder' ? (e) => handleDrop(e, file.name) : undefined}
                    style={{
                      background: selected.has(file.name)
                        ? 'rgba(108, 92, 231, 0.2)'
                        : undefined,
                    }}
                  >
                    <td>
                      <span className="kasm-fm__file-icon">{getIcon(file)}</span>
                      {renderName(file)}
                    </td>
                    <td>{file.type === 'file' ? formatSize(file.size) : '--'}</td>
                    <td>{formatDate(file.modified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="kasm-fm__grid">
              {filtered.map(file => (
                <div
                  key={file.name}
                  className="kasm-fm__grid-item"
                  onDoubleClick={() => navigateTo(file)}
                  onClick={e => toggleSelect(file.name, e)}
                  onContextMenu={e => {
                    if (!selected.has(file.name)) {
                      setSelected(new Set([file.name]));
                    }
                    handleContextMenu(e, file);
                  }}
                  draggable
                  onDragStart={e => handleDragStart(e, file.name)}
                  onDragOver={file.type === 'folder' ? handleDragOver : undefined}
                  onDrop={file.type === 'folder' ? (e) => handleDrop(e, file.name) : undefined}
                  style={{
                    background: selected.has(file.name)
                      ? 'rgba(108, 92, 231, 0.2)'
                      : undefined,
                    borderRadius: 6,
                  }}
                >
                  <span className="kasm-fm__grid-icon">{getIcon(file)}</span>
                  <span className="kasm-fm__grid-name">{renderName(file)}</span>
                </div>
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <div className="kasm-fm__empty">No files found</div>
          )}
        </div>

        {/* Preview panel */}
        {previewFile && (
          <div
            style={{
              width: 280,
              flexShrink: 0,
              borderLeft: '1px solid var(--kasm-surface-border, #333)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--kasm-surface-bg, #1a1a2e)',
            }}
          >
            <div style={{
              padding: '6px 10px',
              borderBottom: '1px solid var(--kasm-surface-border, #333)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 600,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {previewFile.split('/').pop()}
              </span>
              <button
                onClick={() => setPreviewFile(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 4px',
                  opacity: 0.6,
                }}
              >
                \u2715
              </button>
            </div>
            <pre style={{
              flex: 1,
              overflow: 'auto',
              padding: '8px 10px',
              fontSize: 11,
              lineHeight: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}>
              {previewContent}
            </pre>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="kasm-fm__statusbar">
        {filtered.length} items{selected.size > 0 ? ` \u00B7 ${selected.size} selected` : ''} \u00B7 {path}
        {clipboard && ` \u00B7 ${clipboard.paths.length} in clipboard (${clipboard.op})`}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--kasm-surface-bg, #1a1a2e)',
            border: '1px solid var(--kasm-surface-border, #333)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 10000,
            minWidth: 160,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            fontSize: 12,
          }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.target && (
            <>
              <CtxItem label="Open" onClick={() => { closeContextMenu(); if (contextMenu.target) navigateTo(contextMenu.target); }} />
              {contextMenu.target.type === 'file' && (
                <CtxItem label="Preview" onClick={() => { closeContextMenu(); if (contextMenu.target) openPreview(contextMenu.target); }} />
              )}
              <CtxItem label="Rename" onClick={() => { if (contextMenu.target) startRename(contextMenu.target.name); }} />
              <CtxItem label="Copy" onClick={() => {
                closeContextMenu();
                if (contextMenu.target) {
                  setClipboard({ paths: [`${path}/${contextMenu.target.name}`], op: 'copy' });
                }
              }} />
              <CtxItem label="Cut" onClick={() => {
                closeContextMenu();
                if (contextMenu.target) {
                  setClipboard({ paths: [`${path}/${contextMenu.target.name}`], op: 'cut' });
                }
              }} />
              <CtxDivider />
              <CtxItem label="Delete" onClick={deleteSelected} danger />
              <CtxDivider />
            </>
          )}
          <CtxItem label="New Folder" onClick={createNewFolder} />
          <CtxItem label="New File" onClick={createNewFile} />
          {clipboard && (
            <CtxItem label={`Paste (${clipboard.paths.length})`} onClick={() => { closeContextMenu(); handlePaste(); }} />
          )}
          <CtxDivider />
          <CtxItem label="Refresh" onClick={() => { closeContextMenu(); forceRefresh(); }} />
        </div>
      )}
    </div>
  );
}

function CtxItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '5px 16px',
        cursor: 'pointer',
        color: danger ? 'var(--kasm-danger)' : 'inherit',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </div>
  );
}

function CtxDivider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '3px 0' }} />;
}
