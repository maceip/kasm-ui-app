// ============================================================
// AI Agent Terminal Apps - Coding agent launcher interfaces
// ============================================================

import { useState, useRef, useEffect } from 'react';
import type { AppProps } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import './apps.css';

interface AgentLine {
  text: string;
  type: 'input' | 'output' | 'system';
  html?: boolean;
}

interface AgentConfig {
  name: string;
  description: string;
  color: string;
  logo: React.ReactNode;
}

function AgentTerminal({ windowId, agent }: AppProps & { agent: AgentConfig }) {
  const theme = useTheme();
  const tc = theme.colors;
  const [lines, setLines] = useState<AgentLine[]>([
    { text: `\u250C${'─'.repeat(50)}\u2510`, type: 'system' },
    { text: `│  ${agent.name}`, type: 'system' },
    { text: `│  ${agent.description}`, type: 'system' },
    { text: `\u2514${'─'.repeat(50)}\u2518`, type: 'system' },
    { text: '', type: 'output' },
    { text: 'Type a command or question to interact with the agent.', type: 'output' },
    { text: 'Type "help" for available commands.', type: 'output' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const execute = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || thinking) return;

    setHistory(prev => [trimmed, ...prev]);
    setHistoryIdx(-1);

    const newLines: AgentLine[] = [
      ...lines,
      { text: `<span style="color:${agent.color};font-weight:bold">${agent.name.toLowerCase().replace(/\s+/g, '-')}</span> <span style="color:${tc.textMuted}">$</span> ${trimmed}`, type: 'input', html: true },
    ];

    if (trimmed === 'clear') {
      setLines([]);
      setInput('');
      return;
    }

    if (trimmed === 'help') {
      newLines.push(
        { text: 'Available commands:', type: 'output' },
        { text: '  help     - Show this help message', type: 'output' },
        { text: '  clear    - Clear the terminal', type: 'output' },
        { text: '  version  - Show agent version info', type: 'output' },
        { text: '  status   - Show connection status', type: 'output' },
        { text: '  <any>    - Send a prompt to the agent', type: 'output' },
      );
      setLines(newLines);
      setInput('');
      return;
    }

    if (trimmed === 'version') {
      newLines.push({ text: `${agent.name} v1.0.0 (preview)`, type: 'output' });
      setLines(newLines);
      setInput('');
      return;
    }

    if (trimmed === 'status') {
      newLines.push(
        { text: `Agent: ${agent.name}`, type: 'output' },
        { text: 'Status: Preview mode (no API connected)', type: 'output' },
        { text: 'To enable: connect to the real agent API endpoint', type: 'output' },
      );
      setLines(newLines);
      setInput('');
      return;
    }

    newLines.push({
      text: `<span style="color:${tc.warning}">⟳ ${agent.name} is thinking...</span>`,
      type: 'system',
      html: true,
    });
    setLines(newLines);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      setLines(prev => [
        ...prev.slice(0, -1),
        {
          text: `<span style="color:${agent.color};font-weight:bold">[${agent.name}]</span> Received: "${trimmed}"\n\nThis is a preview environment. Connect to the real ${agent.name} API to enable full agent capabilities.`,
          type: 'output',
          html: true,
        },
      ]);
      setThinking(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      execute(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        const idx = historyIdx + 1;
        setHistoryIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const idx = historyIdx - 1;
        setHistoryIdx(idx);
        setInput(history[idx]);
      } else {
        setHistoryIdx(-1);
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div className="kasm-app kasm-terminal" onClick={() => inputRef.current?.focus()}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        background: tc.surfaceBg,
        borderBottom: `1px solid ${tc.surfaceBorder}`,
        fontSize: 13,
      }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>{agent.logo}</span>
        <span style={{ fontWeight: 700, color: agent.color }}>{agent.name}</span>
        <span style={{ color: tc.textMuted, marginLeft: 'auto', fontSize: 11 }}>Agent Terminal</span>
      </div>
      <div className="kasm-terminal__output" style={{ flex: 1, overflow: 'auto' }}>
        {lines.map((line, i) => (
          <div
            key={i}
            className={`kasm-terminal__line kasm-terminal__line--${line.type === 'system' ? 'output' : line.type}`}
            style={line.type === 'system' ? { color: tc.textMuted } : undefined}
            {...(line.html ? { dangerouslySetInnerHTML: { __html: line.text } } : { children: line.text })}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="kasm-terminal__prompt">
        <span style={{ color: agent.color, fontWeight: 700, marginRight: 4 }}>{'>'}</span>
        <input
          ref={inputRef}
          className="kasm-terminal__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={thinking ? `${agent.name} is thinking...` : `Ask ${agent.name}...`}
          disabled={thinking}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// --- SVG Logos (inline, 24x24) ---

const OpenAILogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L3.5 7v10L12 22l8.5-5V7L12 2zm0 2.2L18.2 8v8L12 19.8 5.8 16V8L12 4.2z" fill="#10a37f"/>
    <path d="M12 7.5L8 9.8v4.4l4 2.3 4-2.3V9.8L12 7.5z" fill="#10a37f"/>
  </svg>
);

const AnthropicLogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 3L10.5 7.5 6 6l2.5 4.5L4 12l4.5 1.5L6 18l4.5-1.5L12 21l1.5-4.5L18 18l-2.5-4.5L20 12l-4.5-1.5L18 6l-4.5 1.5L12 3z" fill="#d97706" strokeWidth="0"/>
    <path d="M12 8l-1.2 3.2L7.5 12l3.3 0.8L12 16l1.2-3.2 3.3-0.8-3.3-0.8L12 8z" fill="#f59e0b"/>
  </svg>
);

const GeminiLogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C12 2 14 8 14 12s-2 10-2 10-2-6-2-10S12 2 12 2z" fill="#4285f4"/>
    <path d="M2 12c0 0 6-2 10-2s10 2 10 2-6 2-10 2S2 12 2 12z" fill="#4285f4"/>
  </svg>
);

const CursorLogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="10" y="3" width="4" height="18" rx="2" fill="#a855f7"/>
    <rect x="7" y="3" width="10" height="3" rx="1" fill="#a855f7" opacity="0.6"/>
    <rect x="7" y="18" width="10" height="3" rx="1" fill="#a855f7" opacity="0.6"/>
  </svg>
);

const DevinLogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#06b6d4" strokeWidth="2" fill="none"/>
    <text x="12" y="16.5" textAnchor="middle" fill="#06b6d4" fontSize="14" fontWeight="bold" fontFamily="sans-serif">D</text>
  </svg>
);

const JunieLogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M8 4L3 12l5 8" stroke="#e34f82" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M16 4l5 8-5 8" stroke="#e34f82" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const CodyLogo = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2v20M2 12h20M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="#ff5543" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// --- Agent configurations ---

const agents: Record<string, AgentConfig> = {
  codex: {
    name: 'Codex',
    description: 'OpenAI Codex CLI - cloud-based AI coding agent',
    color: '#10a37f',
    logo: OpenAILogo,
  },
  claudeCode: {
    name: 'Claude Code',
    description: 'Anthropic Claude Code - agentic CLI for software engineering',
    color: '#d97706',
    logo: AnthropicLogo,
  },
  geminiCode: {
    name: 'Gemini Code',
    description: 'Google Gemini Code Assist - AI-powered development',
    color: '#4285f4',
    logo: GeminiLogo,
  },
  cursorAgent: {
    name: 'Cursor Agent',
    description: 'Cursor AI Agent - intelligent code editor',
    color: '#a855f7',
    logo: CursorLogo,
  },
  devin: {
    name: 'Devin',
    description: 'Devin by Cognition - autonomous software engineer',
    color: '#06b6d4',
    logo: DevinLogo,
  },
  junie: {
    name: 'Junie',
    description: 'JetBrains Junie - AI coding agent for IDEs',
    color: '#e34f82',
    logo: JunieLogo,
  },
  cody: {
    name: 'Cody',
    description: 'Sourcegraph Cody - AI code assistant with code intelligence',
    color: '#ff5543',
    logo: CodyLogo,
  },
};

// --- Exported components ---

export function CodexApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.codex} />;
}

export function ClaudeCodeApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.claudeCode} />;
}

export function GeminiCodeApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.geminiCode} />;
}

export function CursorAgentApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.cursorAgent} />;
}

export function DevinApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.devin} />;
}

export function JunieApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.junie} />;
}

export function CodyApp({ windowId, onTitleChange }: AppProps) {
  return <AgentTerminal windowId={windowId} onTitleChange={onTitleChange} agent={agents.cody} />;
}
