// ============================================================
// Text Editor App - Basic code/text editor
// ============================================================

import { useState } from 'react';
import type { AppProps } from '../core/types';
import './apps.css';

const SAMPLE = `// Welcome to Kasm UI Text Editor
// Built with React 19 + TypeScript 5.9 + Vite 7

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55

// Features:
// - Dockable windows (rc-dock model)
// - Resizable panes (Re-Flex engine)
// - Desktop shell (Cinnamon patterns)
// - Collaborative editing (ShareJS OT)
// - Golden Layout theming
// - Window snap zones
`;

export function TextEditor({ windowId }: AppProps) {
  const [content, setContent] = useState(SAMPLE);
  const [fileName, setFileName] = useState('untitled.ts');

  const lines = content.split('\n');
  const lineCount = lines.length;

  return (
    <div className="kasm-app kasm-text-editor">
      <div className="kasm-text-editor__toolbar">
        <span className="kasm-text-editor__filename">{fileName}</span>
        <span className="kasm-text-editor__info">
          {lineCount} lines · {content.length} chars
        </span>
      </div>
      <div className="kasm-text-editor__body">
        <div className="kasm-text-editor__gutter">
          {lines.map((_, i) => (
            <div key={i} className="kasm-text-editor__line-number">{i + 1}</div>
          ))}
        </div>
        <textarea
          className="kasm-text-editor__textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
