// ============================================================
// Notes App - Full Markdown notes with live preview & export
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AppProps } from '../core/types';
import { vfs } from './vfs';

const NOTES_DIR = '/home/kasm-user/notes';

// ============================================================
// Markdown Parser - Custom GFM-compatible parser (no libraries)
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

/** Parse inline markdown: bold, italic, strikethrough, code, links, images */
function parseInline(text: string): (MdNode | string)[] {
  const result: (MdNode | string)[] = [];
  let i = 0;

  while (i < text.length) {
    // Inline code
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        result.push(h('code', { className: 'md-inline-code' }, text.slice(i + 1, end)));
        i = end + 1;
        continue;
      }
    }

    // Images ![alt](src)
    if (text[i] === '!' && text[i + 1] === '[') {
      const altEnd = text.indexOf(']', i + 2);
      if (altEnd !== -1 && text[altEnd + 1] === '(') {
        const srcEnd = text.indexOf(')', altEnd + 2);
        if (srcEnd !== -1) {
          const alt = text.slice(i + 2, altEnd);
          const src = text.slice(altEnd + 2, srcEnd);
          result.push(h('img', { src, alt, className: 'md-image' }));
          i = srcEnd + 1;
          continue;
        }
      }
    }

    // Links [text](url)
    if (text[i] === '[') {
      const textEnd = text.indexOf(']', i + 1);
      if (textEnd !== -1 && text[textEnd + 1] === '(') {
        const urlEnd = text.indexOf(')', textEnd + 2);
        if (urlEnd !== -1) {
          const linkText = text.slice(i + 1, textEnd);
          const url = text.slice(textEnd + 2, urlEnd);
          result.push(h('a', { href: url, target: '_blank', rel: 'noopener' }, ...parseInline(linkText)));
          i = urlEnd + 1;
          continue;
        }
      }
    }

    // Bold **text**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        result.push(h('strong', {}, ...parseInline(text.slice(i + 2, end))));
        i = end + 2;
        continue;
      }
    }

    // Strikethrough ~~text~~
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end !== -1) {
        result.push(h('del', {}, ...parseInline(text.slice(i + 2, end))));
        i = end + 2;
        continue;
      }
    }

    // Italic *text*
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1 && end > i + 1) {
        result.push(h('em', {}, ...parseInline(text.slice(i + 1, end))));
        i = end + 1;
        continue;
      }
    }

    // Plain text - accumulate until next special char
    let next = i + 1;
    while (next < text.length && !'`![*~'.includes(text[next])) {
      next++;
    }
    result.push(text.slice(i, next));
    i = next;
  }

  return result;
}

/** Parse a full markdown string into MdNode tree */
function parseMarkdown(md: string): MdNode[] {
  const lines = md.split('\n');
  const nodes: MdNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(h('pre', { className: 'md-code-block' },
        h('code', { className: lang ? `language-${lang}` : '' }, codeLines.join('\n'))
      ));
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      nodes.push(h('hr', { className: 'md-hr' }));
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push(h(`h${level}`, { className: 'md-heading' }, ...parseInline(headingMatch[2])));
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+[-| :]*$/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      const alignLine = lines[i + 1];
      const aligns = alignLine.split('|').map(c => c.trim()).filter(Boolean).map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        bodyRows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean));
        i++;
      }
      nodes.push(h('table', { className: 'md-table' },
        h('thead', {},
          h('tr', {}, ...headerCells.map((cell, ci) =>
            h('th', { style: { textAlign: aligns[ci] || 'left' } }, ...parseInline(cell))
          ))
        ),
        h('tbody', {}, ...bodyRows.map(row =>
          h('tr', {}, ...row.map((cell, ci) =>
            h('td', { style: { textAlign: aligns[ci] || 'left' } }, ...parseInline(cell))
          ))
        ))
      ));
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const inner = parseMarkdown(quoteLines.join('\n'));
      nodes.push(h('blockquote', { className: 'md-blockquote' }, ...inner));
      continue;
    }

    // Task list / Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const items: { text: string; checked?: boolean; indent: number }[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*+]\s(\[([xX ])\]\s)?(.*)/)!;
        const indent = m[1].length;
        const isTask = m[2] !== undefined;
        const checked = isTask ? m[3] !== ' ' : undefined;
        items.push({ text: m[4], checked, indent });
        i++;
      }
      const hasTask = items.some(it => it.checked !== undefined);
      nodes.push(h('ul', { className: hasTask ? 'md-task-list' : 'md-ul' },
        ...items.map(it => {
          if (it.checked !== undefined) {
            return h('li', { className: 'md-task-item' },
              h('input', { type: 'checkbox', checked: it.checked, disabled: true }),
              ' ',
              ...parseInline(it.text)
            );
          }
          return h('li', {}, ...parseInline(it.text));
        })
      ));
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ''));
        i++;
      }
      nodes.push(h('ol', { className: 'md-ol' },
        ...items.map(text => h('li', {}, ...parseInline(text)))
      ));
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph - collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !lines[i].startsWith('#') && !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !/^---+\s*$/.test(lines[i]) && !/^\*\*\*+\s*$/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+[-| :]*$/.test(lines[i + 1] || ''))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(h('p', { className: 'md-paragraph' }, ...parseInline(paraLines.join('\n'))));
    }
  }

  return nodes;
}

/** Render MdNode tree to React elements */
function renderMdNode(node: MdNode | string, key: number | string): React.ReactNode {
  if (typeof node === 'string') return node;
  const children = node.children?.map((c, i) => renderMdNode(c, i));
  const props = { ...node.props, key };

  // Self-closing tags
  if (node.type === 'img') return React.createElement('img', props);
  if (node.type === 'hr') return React.createElement('hr', props);
  if (node.type === 'input') return React.createElement('input', props);
  if (node.type === 'br') return React.createElement('br', props);

  return React.createElement(node.type, props, ...(children || []));
}

// ============================================================
// Export HTML generation
// ============================================================

const EXPORT_STYLE = `
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#1a1a2e;background:#fafafa}
h1{font-size:2em;border-bottom:2px solid #e0e0e0;padding-bottom:.3em;margin:1.5em 0 .5em}
h2{font-size:1.5em;border-bottom:1px solid #e0e0e0;padding-bottom:.2em;margin:1.3em 0 .4em}
h3{font-size:1.25em;margin:1.2em 0 .3em}
h4,h5,h6{margin:1em 0 .2em}
p{margin:.8em 0}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
code{background:#f0f0f5;padding:.15em .4em;border-radius:4px;font-size:.9em;font-family:'JetBrains Mono','Fira Code',monospace}
pre{background:#1e1e2e;color:#cdd6f4;padding:1em;border-radius:8px;overflow-x:auto;margin:1em 0}
pre code{background:none;padding:0;color:inherit}
blockquote{border-left:4px solid #6c5ce7;padding:.5em 1em;margin:1em 0;background:#f5f3ff;color:#4a4a6a}
table{border-collapse:collapse;width:100%;margin:1em 0}
th,td{border:1px solid #d0d0d0;padding:8px 12px;text-align:left}
th{background:#f0f0f5;font-weight:600}
tr:nth-child(even){background:#f8f8fc}
hr{border:none;border-top:2px solid #e0e0e0;margin:1.5em 0}
ul,ol{margin:.5em 0;padding-left:1.5em}
li{margin:.25em 0}
img{max-width:100%;border-radius:4px}
del{color:#888}
.task-list{list-style:none;padding-left:0}
.task-list li{display:flex;align-items:center;gap:.4em}
input[type=checkbox]{margin-right:.4em}
`;

function mdNodesToHtml(nodes: MdNode[]): string {
  function nodeToHtml(n: MdNode | string): string {
    if (typeof n === 'string') return escapeHtml(n);
    const selfClose = ['img', 'hr', 'input', 'br'];
    const attrs = Object.entries(n.props || {})
      .filter(([k]) => k !== 'className' && k !== 'key')
      .map(([k, v]) => {
        if (k === 'style' && typeof v === 'object') {
          const css = Object.entries(v).map(([sk, sv]) =>
            `${sk.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${sv}`
          ).join(';');
          return `style="${css}"`;
        }
        if (typeof v === 'boolean') return v ? k : '';
        return `${k}="${escapeHtml(String(v))}"`;
      })
      .filter(Boolean)
      .join(' ');
    const cls = n.props?.className ? ` class="${n.props.className}"` : '';
    const tag = n.type;
    const attrStr = attrs ? ' ' + attrs : '';
    if (selfClose.includes(tag)) return `<${tag}${cls}${attrStr} />`;
    const inner = (n.children || []).map(c => nodeToHtml(c)).join('');
    return `<${tag}${cls}${attrStr}>${inner}</${tag}>`;
  }
  return nodes.map(n => nodeToHtml(n)).join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// Default welcome note
// ============================================================

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

## Blockquote

> The best way to predict the future is to invent it.
> -- Alan Kay

---

### Tips

1. Notes auto-save as you type
2. Use the toolbar to insert markdown syntax
3. Export to clean HTML with the export button
4. All notes are stored in \`/home/kasm-user/notes/\`

![placeholder](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCAyMDAgNjAiPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiIHJ4PSI4IiBmaWxsPSIjNmM1Y2U3Ii8+PHRleHQgeD0iMTAwIiB5PSIzNSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5JbWFnZSBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg==)
`;

// ============================================================
// Note type
// ============================================================

interface NoteEntry {
  filename: string;
  title: string;
  modified: Date;
}

// ============================================================
// Notes App Component
// ============================================================

export const NotesApp: React.FC<AppProps> = ({ windowId, onTitleChange }) => {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [splitPos, setSplitPos] = useState(50); // percent
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isDraggingSidebar = useRef(false);
  const isDraggingSplit = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure notes directory exists
  useEffect(() => {
    if (!vfs.exists(NOTES_DIR)) {
      vfs.mkdirp(NOTES_DIR);
    }
    // Create welcome note if no notes exist
    const existing = vfs.readDir(NOTES_DIR).filter(n => n.type === 'file' && n.name.endsWith('.md'));
    if (existing.length === 0) {
      vfs.writeFile(`${NOTES_DIR}/welcome.md`, WELCOME_MD);
    }
    refreshNotes();
  }, []);

  const refreshNotes = useCallback(() => {
    try {
      const entries = vfs.readDir(NOTES_DIR)
        .filter(n => n.type === 'file' && n.name.endsWith('.md'))
        .map(n => ({
          filename: n.name,
          title: extractTitle(vfs.readFile(`${NOTES_DIR}/${n.name}`), n.name),
          modified: n.modified,
        }))
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
      setNotes(entries);

      // Auto-select first note if none active
      if (!activeFile && entries.length > 0) {
        openNote(entries[0].filename);
      }
    } catch {
      setNotes([]);
    }
  }, [activeFile]);

  function extractTitle(content: string, filename: string): string {
    const match = content.match(/^#\s+(.+)/m);
    if (match) return match[1].trim();
    return filename.replace(/\.md$/, '');
  }

  function openNote(filename: string) {
    try {
      const text = vfs.readFile(`${NOTES_DIR}/${filename}`);
      setContent(text);
      setActiveFile(filename);
      const title = extractTitle(text, filename);
      onTitleChange?.(`Notes - ${title}`);
    } catch {
      setContent('');
    }
  }

  function createNote() {
    const timestamp = Date.now();
    const filename = `note-${timestamp}.md`;
    const defaultContent = `# New Note\n\nStart writing here...\n`;
    vfs.writeFile(`${NOTES_DIR}/${filename}`, defaultContent);
    refreshNotes();
    openNote(filename);
  }

  function deleteNote() {
    if (!activeFile) return;
    if (!confirm(`Delete "${extractTitle(content, activeFile)}"?`)) return;
    try {
      vfs.rm(`${NOTES_DIR}/${activeFile}`);
    } catch {}
    setActiveFile(null);
    setContent('');
    onTitleChange?.('Notes');
    setTimeout(refreshNotes, 50);
  }

  // Auto-save with debounce
  function handleContentChange(newContent: string) {
    setContent(newContent);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (activeFile) {
        vfs.writeFile(`${NOTES_DIR}/${activeFile}`, newContent);
        const title = extractTitle(newContent, activeFile);
        onTitleChange?.(`Notes - ${title}`);
        refreshNotes();
      }
    }, 1000);
  }

  // Toolbar insert helpers
  function insertAtCursor(before: string, after: string = '', placeholder: string = '') {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const insert = before + (selected || placeholder) + after;
    const newContent = content.slice(0, start) + insert + content.slice(end);
    handleContentChange(newContent);
    // Restore cursor position
    setTimeout(() => {
      ta.focus();
      const cursorPos = start + before.length + (selected || placeholder).length;
      ta.selectionStart = selected ? start + before.length : start + before.length;
      ta.selectionEnd = selected ? start + before.length + selected.length : cursorPos;
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
    { label: 'Img', title: 'Image', action: () => insertAtCursor('![', '](https://)', 'alt text') },
    { label: 'Table', title: 'Table', action: () => insertAtCursor('| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n', '') },
    { label: 'List', title: 'List', action: () => insertAtCursor('- ', '', 'item') },
    { label: '1.', title: 'Ordered List', action: () => insertAtCursor('1. ', '', 'item') },
    { label: '>', title: 'Blockquote', action: () => insertAtCursor('> ', '', 'quote') },
    { label: '---', title: 'Horizontal Rule', action: () => insertAtCursor('\n---\n', '') },
    { label: '[ ]', title: 'Task', action: () => insertAtCursor('- [ ] ', '', 'task') },
  ];

  // Export to HTML
  function exportHtml() {
    const parsed = parseMarkdown(content);
    const html = mdNodesToHtml(parsed);
    const title = extractTitle(content, activeFile || 'note');
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_STYLE}</style>
</head>
<body>
${html}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeFile || 'note').replace(/\.md$/, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Parsed preview (memoized)
  const previewNodes = useMemo(() => parseMarkdown(content), [content]);

  // Drag handlers for sidebar resize
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const newWidth = Math.max(120, Math.min(350, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      isDraggingSidebar.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // Drag handlers for split pane resize
  const handleSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplit.current = true;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSplit.current || !container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(20, Math.min(80, pct)));
    };
    const onUp = () => {
      isDraggingSplit.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className="kasm-app kasm-notes" style={{ flexDirection: 'row' }}>
      {/* Sidebar - Note list */}
      <div className="kasm-notes__sidebar" style={{ width: sidebarWidth }}>
        <div className="kasm-notes__sidebar-header">
          <span className="kasm-notes__sidebar-title">Notes</span>
          <div className="kasm-notes__sidebar-actions">
            <button className="kasm-notes__btn kasm-notes__btn--small" onClick={createNote} title="New note">+</button>
            <button
              className="kasm-notes__btn kasm-notes__btn--small kasm-notes__btn--danger"
              onClick={deleteNote}
              title="Delete note"
              disabled={!activeFile}
            >
              &times;
            </button>
          </div>
        </div>
        <div className="kasm-notes__note-list">
          {notes.map(note => (
            <button
              key={note.filename}
              className={`kasm-notes__note-item ${activeFile === note.filename ? 'kasm-notes__note-item--active' : ''}`}
              onClick={() => openNote(note.filename)}
            >
              <div className="kasm-notes__note-title">{note.title}</div>
              <div className="kasm-notes__note-date">{note.modified.toLocaleDateString()}</div>
            </button>
          ))}
          {notes.length === 0 && (
            <div className="kasm-notes__empty">No notes yet</div>
          )}
        </div>
      </div>

      {/* Sidebar resize handle */}
      <div className="kasm-notes__resize-handle" onMouseDown={handleSidebarDragStart} />

      {/* Main area */}
      <div className="kasm-notes__main">
        {/* Toolbar */}
        <div className="kasm-notes__toolbar">
          <div className="kasm-notes__toolbar-buttons">
            {toolbarActions.map(btn => (
              <button
                key={btn.title}
                className="kasm-notes__toolbar-btn"
                onClick={btn.action}
                title={btn.title}
                disabled={!activeFile}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <button
            className="kasm-notes__btn kasm-notes__btn--export"
            onClick={exportHtml}
            disabled={!activeFile}
            title="Export as HTML"
          >
            Export HTML
          </button>
        </div>

        {/* Editor + Preview split */}
        <div className="kasm-notes__split" ref={containerRef}>
          {/* Editor pane */}
          <div className="kasm-notes__editor-pane" style={{ width: `${splitPos}%` }}>
            <textarea
              ref={editorRef}
              className="kasm-notes__editor"
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={activeFile ? 'Start writing markdown...' : 'Select or create a note'}
              disabled={!activeFile}
              spellCheck={false}
            />
          </div>

          {/* Split drag handle */}
          <div className="kasm-notes__split-handle" onMouseDown={handleSplitDragStart}>
            <div className="kasm-notes__split-handle-grip" />
          </div>

          {/* Preview pane */}
          <div className="kasm-notes__preview-pane" style={{ width: `${100 - splitPos}%` }}>
            <div className="kasm-notes__preview-label">Preview</div>
            <div className="kasm-notes__preview">
              {previewNodes.map((node, i) => renderMdNode(node, i))}
            </div>
          </div>
        </div>
      </div>

      <style>{notesStyles}</style>
    </div>
  );
};

// ============================================================
// Styles (using CSS variables from theme)
// ============================================================

const notesStyles = `
.kasm-notes {
  display: flex;
  flex-direction: row !important;
  height: 100%;
  overflow: hidden;
}

/* === Sidebar === */
.kasm-notes__sidebar {
  display: flex;
  flex-direction: column;
  background: var(--kasm-surface-bg);
  border-right: 1px solid var(--kasm-surface-border);
  min-width: 120px;
  max-width: 350px;
  flex-shrink: 0;
  overflow: hidden;
}

.kasm-notes__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--kasm-surface-border);
  flex-shrink: 0;
}

.kasm-notes__sidebar-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--kasm-surface-text);
}

.kasm-notes__sidebar-actions {
  display: flex;
  gap: 4px;
}

.kasm-notes__btn {
  border: 1px solid var(--kasm-surface-border);
  border-radius: 4px;
  background: transparent;
  color: var(--kasm-surface-text);
  cursor: pointer;
  font-family: var(--kasm-font-family);
}

.kasm-notes__btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.08);
}

.kasm-notes__btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.kasm-notes__btn--small {
  width: 26px;
  height: 26px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.kasm-notes__btn--danger:hover:not(:disabled) {
  background: var(--kasm-danger);
  color: white;
  border-color: var(--kasm-danger);
}

.kasm-notes__btn--export {
  padding: 4px 10px;
  font-size: 11px;
  background: var(--kasm-accent);
  color: var(--kasm-accent-text);
  border-color: var(--kasm-accent);
  white-space: nowrap;
}

.kasm-notes__btn--export:hover:not(:disabled) {
  background: var(--kasm-accent-hover);
}

.kasm-notes__note-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.kasm-notes__note-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--kasm-surface-text);
  cursor: pointer;
  font-family: var(--kasm-font-family);
  margin-bottom: 2px;
}

.kasm-notes__note-item:hover {
  background: rgba(255,255,255,0.06);
}

.kasm-notes__note-item--active {
  background: var(--kasm-accent) !important;
  color: var(--kasm-accent-text) !important;
}

.kasm-notes__note-title {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kasm-notes__note-date {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
}

.kasm-notes__note-item--active .kasm-notes__note-date {
  opacity: 0.8;
}

.kasm-notes__empty {
  text-align: center;
  padding: 20px;
  opacity: 0.4;
  font-size: 12px;
}

/* === Resize handles === */
.kasm-notes__resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.15s;
}

.kasm-notes__resize-handle:hover {
  background: var(--kasm-accent);
}

/* === Main area === */
.kasm-notes__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* === Toolbar === */
.kasm-notes__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  gap: 8px;
  background: var(--kasm-surface-bg);
  border-bottom: 1px solid var(--kasm-surface-border);
  flex-shrink: 0;
}

.kasm-notes__toolbar-buttons {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.kasm-notes__toolbar-btn {
  padding: 3px 7px;
  border: 1px solid var(--kasm-surface-border);
  border-radius: 4px;
  background: transparent;
  color: var(--kasm-surface-text);
  cursor: pointer;
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-weight: 600;
  min-width: 28px;
  text-align: center;
}

.kasm-notes__toolbar-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.08);
  border-color: var(--kasm-accent);
}

.kasm-notes__toolbar-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* === Split pane === */
.kasm-notes__split {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.kasm-notes__editor-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.kasm-notes__editor {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
  background: var(--kasm-window-bg);
  color: var(--kasm-window-text);
  width: 100%;
}

.kasm-notes__editor::placeholder {
  color: var(--kasm-text-muted, rgba(255,255,255,0.3));
}

.kasm-notes__split-handle {
  width: 6px;
  cursor: col-resize;
  background: var(--kasm-surface-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.kasm-notes__split-handle:hover {
  background: var(--kasm-accent);
}

.kasm-notes__split-handle-grip {
  width: 2px;
  height: 30px;
  background: rgba(255,255,255,0.2);
  border-radius: 1px;
}

.kasm-notes__split-handle:hover .kasm-notes__split-handle-grip {
  background: rgba(255,255,255,0.5);
}

.kasm-notes__preview-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--kasm-window-bg);
}

.kasm-notes__preview-label {
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--kasm-text-muted, rgba(255,255,255,0.4));
  background: var(--kasm-surface-bg);
  border-bottom: 1px solid var(--kasm-surface-border);
  flex-shrink: 0;
}

.kasm-notes__preview {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  line-height: 1.7;
  color: var(--kasm-window-text);
}

/* === Markdown preview styles === */
.kasm-notes__preview .md-heading {
  margin: 1em 0 0.4em;
  font-weight: 600;
  line-height: 1.3;
}

.kasm-notes__preview h1 { font-size: 1.8em; border-bottom: 2px solid var(--kasm-surface-border); padding-bottom: 0.3em; }
.kasm-notes__preview h2 { font-size: 1.4em; border-bottom: 1px solid var(--kasm-surface-border); padding-bottom: 0.2em; }
.kasm-notes__preview h3 { font-size: 1.2em; }
.kasm-notes__preview h4 { font-size: 1.05em; }
.kasm-notes__preview h5 { font-size: 1em; }
.kasm-notes__preview h6 { font-size: 0.9em; opacity: 0.8; }

.kasm-notes__preview .md-paragraph {
  margin: 0.6em 0;
}

.kasm-notes__preview a {
  color: var(--kasm-accent);
  text-decoration: none;
}

.kasm-notes__preview a:hover {
  text-decoration: underline;
}

.kasm-notes__preview strong { font-weight: 700; }
.kasm-notes__preview em { font-style: italic; }
.kasm-notes__preview del { opacity: 0.5; text-decoration: line-through; }

.kasm-notes__preview .md-inline-code {
  background: rgba(255,255,255,0.08);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.kasm-notes__preview .md-code-block {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--kasm-surface-border);
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 0.8em 0;
  font-size: 12px;
  line-height: 1.5;
}

.kasm-notes__preview .md-code-block code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: none;
  padding: 0;
  white-space: pre;
}

.kasm-notes__preview .md-blockquote {
  border-left: 4px solid var(--kasm-accent);
  padding: 0.5em 1em;
  margin: 0.8em 0;
  background: rgba(255,255,255,0.03);
  border-radius: 0 6px 6px 0;
}

.kasm-notes__preview .md-table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  font-size: 13px;
}

.kasm-notes__preview .md-table th,
.kasm-notes__preview .md-table td {
  border: 1px solid var(--kasm-surface-border);
  padding: 6px 12px;
}

.kasm-notes__preview .md-table th {
  background: var(--kasm-surface-bg);
  font-weight: 600;
}

.kasm-notes__preview .md-table tr:nth-child(even) {
  background: rgba(255,255,255,0.02);
}

.kasm-notes__preview .md-hr {
  border: none;
  border-top: 2px solid var(--kasm-surface-border);
  margin: 1.2em 0;
}

.kasm-notes__preview .md-ul,
.kasm-notes__preview .md-ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.kasm-notes__preview .md-task-list {
  list-style: none;
  padding-left: 0;
  margin: 0.5em 0;
}

.kasm-notes__preview .md-task-item {
  display: flex;
  align-items: baseline;
  gap: 0.4em;
  margin: 0.2em 0;
}

.kasm-notes__preview .md-task-item input[type="checkbox"] {
  margin: 0;
  accent-color: var(--kasm-accent);
}

.kasm-notes__preview li {
  margin: 0.2em 0;
}

.kasm-notes__preview .md-image {
  max-width: 100%;
  border-radius: 6px;
  margin: 0.5em 0;
  display: block;
}

/* === Responsive === */
@media (max-width: 639px) {
  .kasm-notes {
    flex-direction: column !important;
  }
  .kasm-notes__sidebar {
    max-width: 100% !important;
    width: 100% !important;
    max-height: 120px;
    border-right: none;
    border-bottom: 1px solid var(--kasm-surface-border);
  }
  .kasm-notes__resize-handle {
    display: none;
  }
  .kasm-notes__note-list {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 4px;
    padding: 4px;
  }
  .kasm-notes__note-item {
    flex-shrink: 0;
    min-width: 120px;
  }
  .kasm-notes__split {
    flex-direction: column;
  }
  .kasm-notes__editor-pane,
  .kasm-notes__preview-pane {
    width: 100% !important;
    height: 50%;
  }
  .kasm-notes__split-handle {
    width: 100%;
    height: 6px;
    cursor: row-resize;
  }
  .kasm-notes__split-handle-grip {
    width: 30px;
    height: 2px;
  }
  .kasm-notes__toolbar-buttons {
    overflow-x: auto;
  }
}
`;
