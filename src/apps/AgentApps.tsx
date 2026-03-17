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

// --- SVG Logos from simple-icons (real brand marks, 24x24) ---

// OpenAI "blossom" mark
const OpenAILogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#10a37f" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>
);

// Anthropic "A" mark
const AnthropicLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#d97706" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
  </svg>
);

// Google Gemini 4-pointed star
const GeminiLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285f4" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
  </svg>
);

// Cursor cube/hexagon mark
const CursorLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#a855f7" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/>
  </svg>
);

// Devin / Cognition - stylized "D" in circle (no simple-icons entry, using brand-accurate representation)
const DevinLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="#06b6d4"/>
    <path d="M8.5 7h3.5a5 5 0 0 1 0 10H8.5V7zm2 2v6H12a3 3 0 0 0 0-6h-1.5z" fill="white"/>
  </svg>
);

// JetBrains mark (angular bracket box)
const JunieLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#e34f82" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.345 23.997A2.347 2.347 0 0 1 0 21.652V10.988C0 9.665.535 8.37 1.473 7.433l5.965-5.961A5.01 5.01 0 0 1 10.989 0h10.666A2.347 2.347 0 0 1 24 2.345v10.664a5.056 5.056 0 0 1-1.473 3.554l-5.965 5.965A5.017 5.017 0 0 1 13.007 24v-.003H2.345Zm8.969-6.854H5.486v1.371h5.828v-1.371ZM3.963 6.514h13.523v13.519l4.257-4.257a3.936 3.936 0 0 0 1.146-2.767V2.345c0-.678-.552-1.234-1.234-1.234H10.989a3.897 3.897 0 0 0-2.767 1.145L3.963 6.514Zm-.192.192L2.256 8.22a3.944 3.944 0 0 0-1.145 2.768v10.664c0 .678.552 1.234 1.234 1.234h10.666a3.9 3.9 0 0 0 2.767-1.146l1.512-1.511H3.771V6.706Z"/>
  </svg>
);

// Sourcegraph wildcard mark (no simple-icons, using brand-accurate asterisk representation)
const CodyLogo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2v8.5M12 13.5V22M2 12h8.5M13.5 12H22M4.93 4.93l6.01 6.01M13.06 13.06l6.01 6.01M19.07 4.93l-6.01 6.01M10.94 13.06l-6.01 6.01" stroke="#ff5543" strokeWidth="2.5" strokeLinecap="round"/>
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
