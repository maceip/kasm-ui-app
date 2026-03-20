// ============================================================
// Notes App - Full Markdown notes with live preview & export
// SolidJS port
// ============================================================

import { createSignal, createMemo, onCleanup, Show, For, type JSX } from 'solid-js';
import type { AppProps } from '../core/types';
import { SplitPane } from '../layout/SplitPane';
import { vfs } from './vfs';

const NOTES_DIR = '/home/kasm-user/notes';

// ============================================================
// Markdown Parser - Custom GFM-compatible parser (no libraries)
// All pure logic — identical to React version
// ============================================================

interface MdNode {
  type: string;
  props?: Record<string, any>;
  children?: (MdNode | string)[];
}

function h(type: string, props?: Record<string, any>, ...children: (MdNode | string | (MdNode | string)[])[]): MdNode {
  const flat = children.flat().filter(c => c !== '' && c !== undefined && c !== null);
  return { type, props: props || {}, children: flat.length > 0 ? flat : undefined };
}

function parseInline(text: string): (MdNode | string)[] {
  const result: (MdNode | string)[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) { result.push(h('code', { className: 'md-inline-code' }, text.slice(i + 1, end))); i = end + 1; continue; }
    }
    if (text[i] === '!' && text[i + 1] === '[') {
      const altEnd = text.indexOf(']', i + 2);
      if (altEnd !== -1 && text[altEnd + 1] === '(') {
        const srcEnd = text.indexOf(')', altEnd + 2);
        if (srcEnd !== -1) { result.push(h('img', { src: text.slice(altEnd + 2, srcEnd), alt: text.slice(i + 2, altEnd), className: 'md-image' })); i = srcEnd + 1; continue; }
      }
    }
    if (text[i] === '[') {
      const textEnd = text.indexOf(']', i + 1);
      if (textEnd !== -1 && text[textEnd + 1] === '(') {
        const urlEnd = text.indexOf(')', textEnd + 2);
        if (urlEnd !== -1) { result.push(h('a', { href: text.slice(textEnd + 2, urlEnd), target: '_blank', rel: 'noopener' }, ...parseInline(text.slice(i + 1, textEnd)))); i = urlEnd + 1; continue; }
      }
    }
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) { result.push(h('strong', {}, ...parseInline(text.slice(i + 2, end)))); i = end + 2; continue; }
    }
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end !== -1) { result.push(h('del', {}, ...parseInline(text.slice(i + 2, end)))); i = end + 2; continue; }
    }
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1 && end > i + 1) { result.push(h('em', {}, ...parseInline(text.slice(i + 1, end)))); i = end + 1; continue; }
    }
    let next = i + 1;
    while (next < text.length && !'`![*~'.includes(text[next])) next++;
    result.push(text.slice(i, next));
    i = next;
  }
  return result;
}

function parseMarkdown(md: string): MdNode[] {
  const lines = md.split('\n');
  const nodes: MdNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++;
      nodes.push(h('pre', { className: 'md-code-block' }, h('code', { className: lang ? `language-${lang}` : '' }, codeLines.join('\n'))));
      continue;
    }
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) { nodes.push(h('hr', { className: 'md-hr' })); i++; continue; }
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) { nodes.push(h(`h${headingMatch[1].length}`, { className: 'md-heading' }, ...parseInline(headingMatch[2]))); i++; continue; }
    if (line.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+[-| :]*$/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      const aligns = lines[i + 1].split('|').map(c => c.trim()).filter(Boolean).map(c => { if (c.startsWith(':') && c.endsWith(':')) return 'center'; if (c.endsWith(':')) return 'right'; return 'left'; });
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) { bodyRows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean)); i++; }
      nodes.push(h('table', { className: 'md-table' },
        h('thead', {}, h('tr', {}, ...headerCells.map((cell, ci) => h('th', { style: { textAlign: aligns[ci] || 'left' } }, ...parseInline(cell))))),
        h('tbody', {}, ...bodyRows.map(row => h('tr', {}, ...row.map((cell, ci) => h('td', { style: { textAlign: aligns[ci] || 'left' } }, ...parseInline(cell))))))
      ));
      continue;
    }
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) { quoteLines.push(lines[i].replace(/^>\s?/, '')); i++; }
      nodes.push(h('blockquote', { className: 'md-blockquote' }, ...parseMarkdown(quoteLines.join('\n'))));
      continue;
    }
    if (/^\s*[-*+]\s/.test(line)) {
      const items: { text: string; checked?: boolean }[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*+]\s(\[([xX ])\]\s)?(.*)/)!;
        const isTask = m[2] !== undefined;
        items.push({ text: m[4], checked: isTask ? m[3] !== ' ' : undefined });
        i++;
      }
      const hasTask = items.some(it => it.checked !== undefined);
      nodes.push(h('ul', { className: hasTask ? 'md-task-list' : 'md-ul' }, ...items.map(it => {
        if (it.checked !== undefined) return h('li', { className: 'md-task-item' }, h('input', { type: 'checkbox', checked: it.checked, disabled: true }), ' ', ...parseInline(it.text));
        return h('li', {}, ...parseInline(it.text));
      })));
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s/, '')); i++; }
      nodes.push(h('ol', { className: 'md-ol' }, ...items.map(text => h('li', {}, ...parseInline(text)))));
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('>') && !lines[i].startsWith('```') && !/^---+\s*$/.test(lines[i]) && !/^\*\*\*+\s*$/.test(lines[i]) && !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+[-| :]*$/.test(lines[i + 1] || ''))) {
      paraLines.push(lines[i]); i++;
    }
    if (paraLines.length > 0) nodes.push(h('p', { className: 'md-paragraph' }, ...parseInline(paraLines.join('\n'))));
  }
  return nodes;
}

// ============================================================
// HTML generation (for preview and export)
// ============================================================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mdNodesToHtml(nodes: MdNode[]): string {
  function nodeToHtml(n: MdNode | string): string {
    if (typeof n === 'string') return escapeHtml(n);
    const selfClose = ['img', 'hr', 'input', 'br'];
    const attrs = Object.entries(n.props || {})
      .filter(([k]) => k !== 'className' && k !== 'key')
      .map(([k, v]) => {
        if (k === 'style' && typeof v === 'object') {
          const css = Object.entries(v).map(([sk, sv]) => `${sk.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${sv}`).join(';');
          return `style="${css}"`;
        }
        if (typeof v === 'boolean') return v ? k : '';
        return `${k}="${escapeHtml(String(v))}"`;
      }).filter(Boolean).join(' ');
    const cls = n.props?.className ? ` class="${n.props.className}"` : '';
    const tag = n.type;
    const attrStr = attrs ? ' ' + attrs : '';
    if (selfClose.includes(tag)) return `<${tag}${cls}${attrStr} />`;
    const inner = (n.children || []).map(c => nodeToHtml(c)).join('');
    return `<${tag}${cls}${attrStr}>${inner}</${tag}>`;
  }
  return nodes.map(n => nodeToHtml(n)).join('\n');
}

const EXPORT_STYLE = `
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#1a1a2e;background:#fafafa}
h1{font-size:2em;border-bottom:2px solid #e0e0e0;padding-bottom:.3em;margin:1.5em 0 .5em}
h2{font-size:1.5em;border-bottom:1px solid #e0e0e0;padding-bottom:.2em;margin:1.3em 0 .4em}
h3{font-size:1.25em;margin:1.2em 0 .3em}
pre{background:#1e1e2e;color:#cdd6f4;padding:1em;border-radius:8px;overflow-x:auto;margin:1em 0}
pre code{background:none;padding:0;color:inherit}
code{background:#f0f0f5;padding:.15em .4em;border-radius:4px;font-size:.9em}
blockquote{border-left:4px solid #6c5ce7;padding:.5em 1em;margin:1em 0;background:#f5f3ff}
table{border-collapse:collapse;width:100%;margin:1em 0}
th,td{border:1px solid #d0d0d0;padding:8px 12px}
th{background:#f0f0f5;font-weight:600}
hr{border:none;border-top:2px solid #e0e0e0;margin:1.5em 0}
a{color:#2563eb;text-decoration:none}
img{max-width:100%;border-radius:4px}
`;

const WELCOME_MD = `# Welcome to Notes

This is your **markdown notes** app with *live preview* and ~~old features~~ new features!

## Features

- **Bold**, *italic*, ~~strikethrough~~, and \`inline code\`
- Links like [Kasm Technologies](https://kasmweb.com)
- Images, tables, blockquotes, and more

## Task List

- [x] Create the notes app
- [x] Add markdown parser
- [ ] Write more notes
- [ ] Share with the team

## Code Block

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet('World'));
\`\`\`

## Table

| Feature | Status | Priority |
|:--------|:------:|--------:|
| Markdown | Done | High |
| Export | Done | Medium |
| Sync | Planned | Low |

> The best way to predict the future is to invent it. -- Alan Kay

---

### Tips

1. Notes auto-save as you type
2. Use the toolbar to insert markdown syntax
3. Export to clean HTML with the export button
`;

interface NoteEntry { filename: string; title: string; modified: Date; }

// ============================================================
// Notes App Component - SolidJS
// ============================================================

export function NotesApp(props: AppProps) {
  const [notes, setNotes] = createSignal<NoteEntry[]>([]);
  const [activeFile, setActiveFile] = createSignal<string | null>(null);
  const [content, setContent] = createSignal('');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let editorRef: HTMLTextAreaElement | undefined;

  // Clean up pending save timer on unmount
  onCleanup(() => { if (saveTimer) clearTimeout(saveTimer); });

  // Ensure notes directory exists
  if (!vfs.exists(NOTES_DIR)) vfs.mkdirp(NOTES_DIR);
  const existing = vfs.readDir(NOTES_DIR).filter(n => n.type === 'file' && n.name.endsWith('.md'));
  if (existing.length === 0) vfs.writeFile(`${NOTES_DIR}/welcome.md`, WELCOME_MD);

  function extractTitle(c: string, filename: string): string {
    const match = c.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : filename.replace(/\.md$/, '');
  }

  function refreshNotes() {
    try {
      const entries = vfs.readDir(NOTES_DIR)
        .filter(n => n.type === 'file' && n.name.endsWith('.md'))
        .map(n => ({ filename: n.name, title: extractTitle(vfs.readFile(`${NOTES_DIR}/${n.name}`), n.name), modified: n.modified }))
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
      setNotes(entries);
      if (!activeFile() && entries.length > 0) openNote(entries[0].filename);
    } catch { setNotes([]); }
  }

  function openNote(filename: string) {
    try {
      const text = vfs.readFile(`${NOTES_DIR}/${filename}`);
      setContent(text);
      setActiveFile(filename);
      props.onTitleChange?.(`Notes - ${extractTitle(text, filename)}`);
    } catch { setContent(''); }
  }

  function createNote() {
    const filename = `note-${Date.now()}.md`;
    vfs.writeFile(`${NOTES_DIR}/${filename}`, `# New Note\n\nStart writing here...\n`);
    refreshNotes();
    openNote(filename);
  }

  function deleteNote() {
    const af = activeFile();
    if (!af) return;
    try { vfs.rm(`${NOTES_DIR}/${af}`); } catch { /* */ }
    setActiveFile(null);
    setContent('');
    props.onTitleChange?.('Notes');
    setTimeout(refreshNotes, 50);
  }

  function handleContentChange(newContent: string) {
    setContent(newContent);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const af = activeFile();
      if (af) {
        vfs.writeFile(`${NOTES_DIR}/${af}`, newContent);
        props.onTitleChange?.(`Notes - ${extractTitle(newContent, af)}`);
        refreshNotes();
      }
    }, 1000);
  }

  function insertAtCursor(before: string, after: string = '', placeholder: string = '') {
    if (!editorRef) return;
    const start = editorRef.selectionStart;
    const end = editorRef.selectionEnd;
    const c = content();
    const selected = c.slice(start, end);
    const insert = before + (selected || placeholder) + after;
    handleContentChange(c.slice(0, start) + insert + c.slice(end));
    setTimeout(() => {
      editorRef!.focus();
      const cursorPos = start + before.length + (selected || placeholder).length;
      editorRef!.selectionStart = selected ? start + before.length : start + before.length;
      editorRef!.selectionEnd = selected ? start + before.length + selected.length : cursorPos;
    }, 0);
  }

  const toolbarActions = [
    { label: 'B', title: 'Bold', action: () => insertAtCursor('**', '**', 'bold text') },
    { label: 'I', title: 'Italic', action: () => insertAtCursor('*', '*', 'italic text') },
    { label: 'H', title: 'Heading', action: () => insertAtCursor('## ', '', 'Heading') },
    { label: '~', title: 'Strikethrough', action: () => insertAtCursor('~~', '~~', 'text') },
    { label: '<>', title: 'Code', action: () => insertAtCursor('```\n', '\n```', 'code here') },
    { label: '``', title: 'Inline Code', action: () => insertAtCursor('`', '`', 'code') },
    { label: 'Link', title: 'Link', action: () => insertAtCursor('[', '](https://)', 'link text') },
    { label: 'List', title: 'List', action: () => insertAtCursor('- ', '', 'item') },
    { label: '1.', title: 'Ordered List', action: () => insertAtCursor('1. ', '', 'item') },
    { label: '>', title: 'Blockquote', action: () => insertAtCursor('> ', '', 'quote') },
    { label: '---', title: 'Horizontal Rule', action: () => insertAtCursor('\n---\n', '') },
    { label: '[ ]', title: 'Task', action: () => insertAtCursor('- [ ] ', '', 'task') },
  ];

  function exportHtml() {
    const c = content();
    const parsed = parseMarkdown(c);
    const html = mdNodesToHtml(parsed);
    const title = extractTitle(c, activeFile() || 'note');
    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${EXPORT_STYLE}</style></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeFile() || 'note').replace(/\.md$/, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Preview as HTML string
  const previewHtml = createMemo(() => mdNodesToHtml(parseMarkdown(content())));

  // Initial load
  refreshNotes();

  return (
    <div class="kasm-app kasm-notes" style={{ "flex-direction": 'row' }}>
      <SplitPane orientation="horizontal" sizes={[200]} minSizes={[120, 300]}>
        {/* Sidebar */}
        <div class="kasm-notes__sidebar">
          <div class="kasm-notes__sidebar-header">
            <span class="kasm-notes__sidebar-title">Notes</span>
            <div class="kasm-notes__sidebar-actions">
              <button class="kasm-notes__btn kasm-notes__btn--small" onClick={createNote} title="New note">+</button>
              <button class="kasm-notes__btn kasm-notes__btn--small kasm-notes__btn--danger" onClick={deleteNote} title="Delete note" disabled={!activeFile()}>&times;</button>
            </div>
          </div>
          <div class="kasm-notes__note-list">
            <For each={notes()}>
              {(note) => (
                <button
                  class={`kasm-notes__note-item ${activeFile() === note.filename ? 'kasm-notes__note-item--active' : ''}`}
                  onClick={() => openNote(note.filename)}
                >
                  <div class="kasm-notes__note-title">{note.title}</div>
                  <div class="kasm-notes__note-date">{note.modified.toLocaleDateString()}</div>
                </button>
              )}
            </For>
            <Show when={notes().length === 0}>
              <div class="kasm-notes__empty">No notes yet</div>
            </Show>
          </div>
        </div>

        {/* Main area */}
        <div class="kasm-notes__main">
          <div class="kasm-notes__toolbar">
            <div class="kasm-notes__toolbar-buttons">
              <For each={toolbarActions}>
                {(btn) => (
                  <button class="kasm-notes__toolbar-btn" onClick={btn.action} title={btn.title} disabled={!activeFile()}>
                    {btn.label}
                  </button>
                )}
              </For>
            </div>
            <button class="kasm-notes__btn kasm-notes__btn--export" onClick={exportHtml} disabled={!activeFile()} title="Export as HTML">
              Export HTML
            </button>
          </div>

          <SplitPane orientation="horizontal" minSizes={[200, 200]}>
            <div class="kasm-notes__editor-pane">
              <textarea
                ref={editorRef}
                class="kasm-notes__editor"
                value={content()}
                onInput={e => handleContentChange(e.currentTarget.value)}
                placeholder={activeFile() ? 'Start writing markdown...' : 'Select or create a note'}
                disabled={!activeFile()}
                spellcheck={false}
              />
            </div>
            <div class="kasm-notes__preview-pane">
              <div class="kasm-notes__preview-label">Preview</div>
              <div class="kasm-notes__preview" innerHTML={previewHtml()} />
            </div>
          </SplitPane>
        </div>
      </SplitPane>

      <style>{notesStyles}</style>
    </div>
  );
}

// Styles (identical to React version)
const notesStyles = `
.kasm-notes { display: flex; flex-direction: row !important; height: 100%; overflow: hidden; }
.kasm-notes__sidebar { display: flex; flex-direction: column; background: var(--kasm-surface-bg); border-right: 1px solid var(--kasm-surface-border); min-width: 120px; max-width: 350px; flex-shrink: 0; overflow: hidden; }
.kasm-notes__sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--kasm-surface-border); flex-shrink: 0; }
.kasm-notes__sidebar-title { font-weight: 600; font-size: 13px; color: var(--kasm-surface-text); }
.kasm-notes__sidebar-actions { display: flex; gap: 4px; }
.kasm-notes__btn { border: 1px solid var(--kasm-surface-border); border-radius: 4px; background: transparent; color: var(--kasm-surface-text); cursor: pointer; }
.kasm-notes__btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
.kasm-notes__btn:disabled { opacity: 0.3; cursor: default; }
.kasm-notes__btn--small { width: 26px; height: 26px; font-size: 16px; display: flex; align-items: center; justify-content: center; padding: 0; }
.kasm-notes__btn--danger:hover:not(:disabled) { background: var(--kasm-danger); color: white; border-color: var(--kasm-danger); }
.kasm-notes__btn--export { padding: 4px 10px; font-size: 11px; background: var(--kasm-accent); color: var(--kasm-accent-text); border-color: var(--kasm-accent); white-space: nowrap; }
.kasm-notes__btn--export:hover:not(:disabled) { background: var(--kasm-accent-hover); }
.kasm-notes__note-list { flex: 1; overflow-y: auto; padding: 4px; }
.kasm-notes__note-item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: none; border-radius: 6px; background: transparent; color: var(--kasm-surface-text); cursor: pointer; margin-bottom: 2px; }
.kasm-notes__note-item:hover { background: rgba(255,255,255,0.06); }
.kasm-notes__note-item--active { background: var(--kasm-accent) !important; color: var(--kasm-accent-text) !important; }
.kasm-notes__note-title { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kasm-notes__note-date { font-size: 10px; opacity: 0.6; margin-top: 2px; }
.kasm-notes__empty { text-align: center; padding: 20px; opacity: 0.4; font-size: 12px; }
.kasm-notes__main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.kasm-notes__toolbar { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; gap: 8px; background: var(--kasm-surface-bg); border-bottom: 1px solid var(--kasm-surface-border); flex-shrink: 0; }
.kasm-notes__toolbar-buttons { display: flex; gap: 2px; flex-wrap: wrap; }
.kasm-notes__toolbar-btn { padding: 3px 7px; border: 1px solid var(--kasm-surface-border); border-radius: 4px; background: transparent; color: var(--kasm-surface-text); cursor: pointer; font-size: 11px; font-family: monospace; font-weight: 600; min-width: 28px; text-align: center; }
.kasm-notes__toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: var(--kasm-accent); }
.kasm-notes__toolbar-btn:disabled { opacity: 0.3; cursor: default; }
.kasm-notes__editor-pane { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.kasm-notes__editor { flex: 1; border: none; outline: none; resize: none; padding: 12px; font-family: monospace; font-size: 13px; line-height: 1.6; background: var(--kasm-window-bg); color: var(--kasm-window-text); width: 100%; }
.kasm-notes__preview-pane { display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--kasm-window-bg); }
.kasm-notes__preview-label { padding: 4px 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--kasm-text-muted); background: var(--kasm-surface-bg); border-bottom: 1px solid var(--kasm-surface-border); flex-shrink: 0; }
.kasm-notes__preview { flex: 1; overflow-y: auto; padding: 16px 20px; line-height: 1.7; color: var(--kasm-window-text); }
.kasm-notes__preview h1 { font-size: 1.8em; border-bottom: 2px solid var(--kasm-surface-border); padding-bottom: 0.3em; margin: 1em 0 0.4em; }
.kasm-notes__preview h2 { font-size: 1.4em; border-bottom: 1px solid var(--kasm-surface-border); padding-bottom: 0.2em; margin: 1em 0 0.4em; }
.kasm-notes__preview h3 { font-size: 1.2em; margin: 1em 0 0.3em; }
.kasm-notes__preview .md-paragraph { margin: 0.6em 0; }
.kasm-notes__preview a { color: var(--kasm-accent); text-decoration: none; }
.kasm-notes__preview strong { font-weight: 700; }
.kasm-notes__preview em { font-style: italic; }
.kasm-notes__preview del { opacity: 0.5; text-decoration: line-through; }
.kasm-notes__preview .md-inline-code { background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; font-family: monospace; }
.kasm-notes__preview .md-code-block { background: rgba(0,0,0,0.3); border: 1px solid var(--kasm-surface-border); border-radius: 6px; padding: 12px 16px; overflow-x: auto; margin: 0.8em 0; }
.kasm-notes__preview .md-code-block code { font-family: monospace; background: none; padding: 0; white-space: pre; }
.kasm-notes__preview .md-blockquote { border-left: 4px solid var(--kasm-accent); padding: 0.5em 1em; margin: 0.8em 0; background: rgba(255,255,255,0.03); border-radius: 0 6px 6px 0; }
.kasm-notes__preview .md-table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 13px; }
.kasm-notes__preview .md-table th, .kasm-notes__preview .md-table td { border: 1px solid var(--kasm-surface-border); padding: 6px 12px; }
.kasm-notes__preview .md-table th { background: var(--kasm-surface-bg); font-weight: 600; }
.kasm-notes__preview .md-hr { border: none; border-top: 2px solid var(--kasm-surface-border); margin: 1.2em 0; }
.kasm-notes__preview .md-ul, .kasm-notes__preview .md-ol { margin: 0.5em 0; padding-left: 1.5em; }
.kasm-notes__preview .md-task-list { list-style: none; padding-left: 0; }
.kasm-notes__preview .md-task-item { display: flex; align-items: baseline; gap: 0.4em; }
.kasm-notes__preview .md-image { max-width: 100%; border-radius: 6px; margin: 0.5em 0; display: block; }
`;
