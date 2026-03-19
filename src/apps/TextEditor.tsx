// ============================================================
// Text Editor App - Basic code/text editor
// ============================================================

import { createSignal, createMemo, For } from 'solid-js';
import type { AppProps } from '../core/types';
import './apps.css';

const SAMPLE = `// Welcome to Kasm UI Text Editor
// Built with SolidJS + TypeScript 5.9 + Vite 7

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

export function TextEditor(props: AppProps) {
  const [content, setContent] = createSignal(SAMPLE);
  const [fileName, setFileName] = createSignal('untitled.ts');

  const lines = createMemo(() => content().split('\n'));
  const lineCount = createMemo(() => lines().length);

  return (
    <div class="kasm-app kasm-text-editor">
      <div class="kasm-text-editor__toolbar">
        <span class="kasm-text-editor__filename">{fileName()}</span>
        <span class="kasm-text-editor__info">
          {lineCount()} lines · {content().length} chars
        </span>
      </div>
      <div class="kasm-text-editor__body">
        <div class="kasm-text-editor__gutter">
          <For each={lines()}>{(_, i) => (
            <div class="kasm-text-editor__line-number">{i() + 1}</div>
          )}</For>
        </div>
        <textarea
          class="kasm-text-editor__textarea"
          value={content()}
          onInput={e => setContent(e.currentTarget.value)}
          spellcheck={false}
        />
      </div>
    </div>
  );
}
