// ============================================================
// Terminal Emulator - Full shell with VFS integration
// Pipes, env vars, globbing, tab completion, colored output
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import type { AppProps } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import './apps.css';
import { vfs } from './vfs';

interface TermLine {
  text: string;
  type: 'input' | 'output' | 'error';
  html?: boolean;
}

const HOME = '/home/kasm-user';
const BOOT_TIME = Date.now();

const MAN_PAGES: Record<string, string> = {
  ls: 'ls [-l] [-a] [path] - list directory contents',
  cd: 'cd [path] - change the working directory',
  pwd: 'pwd - print name of current working directory',
  mkdir: 'mkdir <path> - create a directory',
  rmdir: 'rmdir <path> - remove an empty directory',
  rm: 'rm [-r] <path> - remove files or directories',
  touch: 'touch <path> - create an empty file or update timestamp',
  cat: 'cat <file...> - concatenate and print files',
  echo: 'echo [text] [> file] [>> file] - display a line of text',
  cp: 'cp [-r] <src> <dst> - copy files and directories',
  mv: 'mv <src> <dst> - move (rename) files',
  head: 'head [-n N] <file> - output the first part of files',
  tail: 'tail [-n N] <file> - output the last part of files',
  wc: 'wc <file> - print line, word, and byte counts',
  grep: 'grep <pattern> <file...> - search for pattern in files',
  find: 'find <path> -name <pattern> - search for files',
  chmod: 'chmod <mode> <path> - change file mode bits',
  clear: 'clear - clear the terminal screen',
  history: 'history - display command history',
  alias: 'alias [name=value] - create or list aliases',
  export: 'export [NAME=VALUE] - set environment variable',
  unset: 'unset <NAME> - remove environment variable',
  env: 'env - print environment variables',
  which: 'which <command> - locate a command',
  man: 'man <command> - display manual page for command',
  date: 'date - display current date and time',
  whoami: 'whoami - print current user name',
  hostname: 'hostname - show system hostname',
  uname: 'uname [-a] - print system information',
  uptime: 'uptime - show how long system has been running',
  free: 'free - display amount of free and used memory',
  df: 'df - report file system disk space usage',
  du: 'du [-s] [path] - estimate file space usage',
  tree: 'tree [path] - list contents in tree format',
  sort: 'sort - sort lines of text from stdin',
  uniq: 'uniq - report or omit repeated lines from stdin',
  tee: 'tee <file> - read stdin, write to stdout and file',
  neofetch: 'neofetch - display system information with ASCII art',
  help: 'help - list all available commands',
};

const ALL_COMMANDS = Object.keys(MAN_PAGES);

function colorize(text: string, color: string): string {
  return `<span style="color:${color}">${escapeHtml(text)}</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function Terminal({ windowId }: AppProps) {
  const theme = useTheme();
  const tc = theme.colors;

  const [lines, setLines] = useState<TermLine[]>([
    { text: 'Welcome to Kasm Terminal v2.0.0', type: 'output' },
    { text: 'Type "help" for available commands.', type: 'output' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [cwd, setCwd] = useState(HOME);
  const [env, setEnv] = useState<Record<string, string>>({
    HOME,
    USER: 'kasm-user',
    SHELL: '/bin/kash',
    PATH: '/usr/bin:/bin',
    PWD: HOME,
    TERM: 'kasm-terminal',
    HOSTNAME: 'kasm-desktop',
    LANG: 'en_US.UTF-8',
    EDITOR: 'nvim',
  });
  const [aliases, setAliases] = useState<Record<string, string>>({
    ll: 'ls -la',
    la: 'ls -a',
    gs: 'echo git status placeholder',
  });
  const [tabSuggestions, setTabSuggestions] = useState<string[]>([]);
  const [tabIndex, setTabIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const resolvePath = useCallback((p: string): string => {
    return vfs.resolvePath(cwd, p);
  }, [cwd]);

  // Expand environment variables in a string
  const expandVars = useCallback((s: string): string => {
    return s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => env[name] ?? '');
  }, [env]);

  // Expand globs in args
  const expandArgs = useCallback((args: string[]): string[] => {
    const result: string[] = [];
    for (const arg of args) {
      if (arg.includes('*') || arg.includes('?')) {
        const expanded = vfs.expandGlob(cwd, arg);
        if (expanded.length > 0) {
          result.push(...expanded);
        } else {
          result.push(arg); // no match, keep literal
        }
      } else {
        result.push(arg);
      }
    }
    return result;
  }, [cwd]);

  // Parse a simple command string into tokens, respecting quotes
  const tokenize = (input: string): string[] => {
    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === "'" && !inDouble) {
        inSingle = !inSingle;
      } else if (c === '"' && !inSingle) {
        inDouble = !inDouble;
      } else if (c === ' ' && !inSingle && !inDouble) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += c;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  };

  // Execute a single command, returns output lines
  const execSingle = useCallback((cmdStr: string, stdinLines?: string[]): { out: TermLine[]; newCwd?: string; newEnv?: Record<string, string>; newAliases?: Record<string, string> } => {
    const out: TermLine[] = [];
    const push = (text: string, type: 'output' | 'error' = 'output', html = false) => {
      out.push({ text, type, html });
    };

    // Handle echo redirection: echo text > file or echo text >> file
    let redirectFile: string | null = null;
    let redirectAppend = false;
    const redirectMatch = cmdStr.match(/^(.+?)\s+(>>|>)\s*(.+)$/);
    if (redirectMatch) {
      cmdStr = redirectMatch[1].trim();
      redirectAppend = redirectMatch[2] === '>>';
      redirectFile = redirectMatch[3].trim();
    }

    const expanded = expandVars(cmdStr);
    const tokens = tokenize(expanded);
    if (tokens.length === 0) return { out };

    let [command, ...args] = tokens;

    // Resolve aliases (one level)
    if (aliases[command]) {
      const aliasTokens = tokenize(aliases[command]);
      command = aliasTokens[0];
      args = [...aliasTokens.slice(1), ...args];
    }

    // Expand globs
    args = expandArgs(args);

    const writeRedirect = (text: string) => {
      if (redirectFile) {
        const fp = resolvePath(redirectFile);
        try {
          if (redirectAppend) {
            vfs.appendFile(fp, text + '\n');
          } else {
            vfs.writeFile(fp, text + '\n');
          }
        } catch (err: any) {
          push(err.message, 'error');
        }
      } else {
        push(text);
      }
    };

    try {
      switch (command) {
        case 'help': {
          push('Available commands: ' + ALL_COMMANDS.join(', '));
          break;
        }

        case 'echo': {
          writeRedirect(args.join(' '));
          break;
        }

        case 'cd': {
          const target = args[0] || '~';
          const resolved = resolvePath(target);
          if (!vfs.exists(resolved)) {
            push(`cd: ${target}: No such file or directory`, 'error');
          } else {
            const node = vfs.getNode(resolved);
            if (node?.type !== 'folder') {
              push(`cd: ${target}: Not a directory`, 'error');
            } else {
              return { out, newCwd: resolved, newEnv: { ...env, PWD: resolved } };
            }
          }
          break;
        }

        case 'pwd': {
          push(cwd);
          break;
        }

        case 'ls': {
          let showAll = false;
          let showLong = false;
          const paths: string[] = [];

          for (const a of args) {
            if (a === '-l') showLong = true;
            else if (a === '-a') showAll = true;
            else if (a === '-la' || a === '-al') { showAll = true; showLong = true; }
            else paths.push(a);
          }

          if (paths.length === 0) paths.push('.');
          for (const p of paths) {
            const resolved = resolvePath(p);
            const node = vfs.getNode(resolved);
            if (!node) {
              push(`ls: cannot access '${p}': No such file or directory`, 'error');
              continue;
            }
            if (node.type !== 'folder') {
              // ls on a file
              if (showLong) {
                push(`${node.permissions} ${node.owner} ${formatBytes(node.size).padStart(6)} ${node.modified.toISOString().split('T')[0]} ${node.name}`);
              } else {
                push(node.name);
              }
              continue;
            }

            const entries = vfs.readDir(resolved);
            let filtered = entries;
            if (!showAll) {
              filtered = entries.filter(e => !e.name.startsWith('.'));
            }
            filtered.sort((a, b) => a.name.localeCompare(b.name));

            if (paths.length > 1) push(`${p}:`);

            if (showLong) {
              push(`total ${filtered.length}`);
              for (const entry of filtered) {
                const sizeStr = formatBytes(entry.type === 'folder' ? 4096 : entry.size).padStart(6);
                const dateStr = entry.modified.toISOString().split('T')[0];
                const nameColored = entry.type === 'folder'
                  ? colorize(entry.name + '/', tc.terminalPath)
                  : entry.permissions.includes('x')
                    ? colorize(entry.name, tc.success)
                    : escapeHtml(entry.name);
                push(`${entry.permissions} ${entry.owner.padEnd(10)} ${sizeStr} ${dateStr} ${nameColored}`, 'output', true);
              }
            } else {
              const colored = filtered.map(entry => {
                if (entry.type === 'folder') return colorize(entry.name, tc.terminalPath);
                if (entry.permissions.includes('x')) return colorize(entry.name, tc.success);
                return escapeHtml(entry.name);
              });
              if (redirectFile) {
                writeRedirect(filtered.map(e => e.name).join('  '));
              } else {
                push(colored.join('  '), 'output', true);
              }
            }
          }
          break;
        }

        case 'mkdir': {
          if (args.length === 0) { push('mkdir: missing operand', 'error'); break; }
          let mkParents = false;
          const mkPaths: string[] = [];
          for (const a of args) {
            if (a === '-p') mkParents = true;
            else mkPaths.push(a);
          }
          for (const p of mkPaths) {
            try {
              if (mkParents) vfs.mkdirp(resolvePath(p));
              else vfs.mkdir(resolvePath(p));
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'rmdir': {
          if (args.length === 0) { push('rmdir: missing operand', 'error'); break; }
          for (const p of args) {
            try {
              const resolved = resolvePath(p);
              const node = vfs.getNode(resolved);
              if (!node) throw new Error(`rmdir: '${p}': No such file or directory`);
              if (node.type !== 'folder') throw new Error(`rmdir: '${p}': Not a directory`);
              vfs.rm(resolved, false);
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'rm': {
          let recursive = false;
          const rmPaths: string[] = [];
          for (const a of args) {
            if (a === '-r' || a === '-rf' || a === '-fr') recursive = true;
            else if (a === '-f') { /* force, just ignore errors */ }
            else rmPaths.push(a);
          }
          if (rmPaths.length === 0) { push('rm: missing operand', 'error'); break; }
          for (const p of rmPaths) {
            try {
              vfs.rm(resolvePath(p), recursive);
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'touch': {
          if (args.length === 0) { push('touch: missing operand', 'error'); break; }
          for (const p of args) {
            try { vfs.touch(resolvePath(p)); } catch (err: any) { push(err.message, 'error'); }
          }
          break;
        }

        case 'cat': {
          if (args.length === 0) {
            // Read from stdin if piped
            if (stdinLines) {
              for (const line of stdinLines) push(line.text);
            } else {
              push('cat: missing operand', 'error');
            }
            break;
          }
          for (const p of args) {
            try {
              const content = vfs.readFile(resolvePath(p));
              writeRedirect(content);
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'cp': {
          let recursive = false;
          const cpArgs: string[] = [];
          for (const a of args) {
            if (a === '-r' || a === '-R') recursive = true;
            else cpArgs.push(a);
          }
          if (cpArgs.length < 2) { push('cp: missing operand', 'error'); break; }
          const dst = cpArgs.pop()!;
          for (const src of cpArgs) {
            try {
              vfs.cp(resolvePath(src), resolvePath(dst), recursive);
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'mv': {
          if (args.length < 2) { push('mv: missing operand', 'error'); break; }
          const mvDst = args.pop()!;
          for (const src of args) {
            try {
              vfs.mv(resolvePath(src), resolvePath(mvDst));
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'head': {
          let n = 10;
          const headPaths: string[] = [];
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i]) || 10; }
            else headPaths.push(args[i]);
          }
          const getLines = (text: string) => text.split('\n').slice(0, n).join('\n');
          if (headPaths.length === 0 && stdinLines) {
            push(stdinLines.slice(0, n).map(l => l.text).join('\n'));
          } else {
            for (const p of headPaths) {
              try {
                const content = vfs.readFile(resolvePath(p));
                writeRedirect(getLines(content));
              } catch (err: any) {
                push(err.message, 'error');
              }
            }
          }
          break;
        }

        case 'tail': {
          let n = 10;
          const tailPaths: string[] = [];
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i]) || 10; }
            else tailPaths.push(args[i]);
          }
          const getLines = (text: string) => { const l = text.split('\n'); return l.slice(-n).join('\n'); };
          if (tailPaths.length === 0 && stdinLines) {
            push(stdinLines.slice(-n).map(l => l.text).join('\n'));
          } else {
            for (const p of tailPaths) {
              try {
                const content = vfs.readFile(resolvePath(p));
                writeRedirect(getLines(content));
              } catch (err: any) {
                push(err.message, 'error');
              }
            }
          }
          break;
        }

        case 'wc': {
          if (args.length === 0 && stdinLines) {
            const text = stdinLines.map(l => l.text).join('\n');
            const lc = text.split('\n').length;
            const wc = text.split(/\s+/).filter(Boolean).length;
            push(`  ${lc}  ${wc}  ${text.length}`);
          } else {
            for (const p of args) {
              try {
                const content = vfs.readFile(resolvePath(p));
                const lc = content.split('\n').length;
                const wc = content.split(/\s+/).filter(Boolean).length;
                push(`  ${lc}  ${wc}  ${content.length} ${p}`);
              } catch (err: any) {
                push(err.message, 'error');
              }
            }
          }
          break;
        }

        case 'grep': {
          if (args.length < 1) { push('grep: missing pattern', 'error'); break; }
          let caseInsensitive = false;
          let showLineNumbers = false;
          const grepArgs: string[] = [];
          for (const a of args) {
            if (a === '-i') caseInsensitive = true;
            else if (a === '-n') showLineNumbers = true;
            else grepArgs.push(a);
          }
          const pattern = grepArgs[0];
          const grepFiles = grepArgs.slice(1);
          const regex = new RegExp(pattern, caseInsensitive ? 'i' : '');

          const searchLines = (lines: string[], prefix: string) => {
            lines.forEach((line, i) => {
              if (regex.test(line)) {
                const ln = showLineNumbers ? `${i + 1}:` : '';
                const highlighted = line.replace(regex, (m) => `<span style="color:${tc.terminalError};font-weight:bold">${escapeHtml(m)}</span>`);
                push(`${prefix}${ln}${highlighted}`, 'output', true);
              }
            });
          };

          if (grepFiles.length === 0 && stdinLines) {
            searchLines(stdinLines.map(l => l.text), '');
          } else {
            for (const p of grepFiles) {
              try {
                const content = vfs.readFile(resolvePath(p));
                const prefix = grepFiles.length > 1 ? `${colorize(p + ':', tc.info)}` : '';
                const fileLines = content.split('\n');
                fileLines.forEach((line, i) => {
                  if (regex.test(line)) {
                    const ln = showLineNumbers ? `${i + 1}:` : '';
                    const highlighted = escapeHtml(line).replace(new RegExp(escapeHtml(pattern), caseInsensitive ? 'gi' : 'g'), (m) => `<span style="color:${tc.terminalError};font-weight:bold">${m}</span>`);
                    push(`${prefix}${ln}${highlighted}`, 'output', true);
                  }
                });
              } catch (err: any) {
                push(err.message, 'error');
              }
            }
          }
          break;
        }

        case 'find': {
          let findPath = '.';
          let findName = '*';
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '-name' && args[i + 1]) { findName = args[++i]; }
            else if (!args[i].startsWith('-')) { findPath = args[i]; }
          }
          try {
            const results = vfs.find(resolvePath(findPath), findName);
            for (const r of results) push(r);
          } catch (err: any) {
            push(err.message, 'error');
          }
          break;
        }

        case 'chmod': {
          if (args.length < 2) { push('chmod: missing operand', 'error'); break; }
          const [mode, ...chmodPaths] = args;
          for (const p of chmodPaths) {
            try {
              vfs.chmod(resolvePath(p), mode);
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'history': {
          history.forEach((cmd, i) => {
            push(`  ${(history.length - i).toString().padStart(4)}  ${cmd}`);
          });
          break;
        }

        case 'alias': {
          if (args.length === 0) {
            for (const [k, v] of Object.entries(aliases)) {
              push(`alias ${k}='${v}'`);
            }
          } else {
            const newAliases = { ...aliases };
            for (const a of args) {
              const eq = a.indexOf('=');
              if (eq > 0) {
                const name = a.substring(0, eq);
                let value = a.substring(eq + 1);
                if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                  value = value.slice(1, -1);
                }
                newAliases[name] = value;
              } else {
                if (aliases[a]) push(`alias ${a}='${aliases[a]}'`);
                else push(`alias: ${a}: not found`, 'error');
              }
            }
            return { out, newAliases };
          }
          break;
        }

        case 'export': {
          if (args.length === 0) {
            for (const [k, v] of Object.entries(env)) {
              push(`declare -x ${k}="${v}"`);
            }
          } else {
            const newEnv = { ...env };
            for (const a of args) {
              const eq = a.indexOf('=');
              if (eq > 0) {
                newEnv[a.substring(0, eq)] = a.substring(eq + 1);
              }
            }
            return { out, newEnv };
          }
          break;
        }

        case 'unset': {
          if (args.length === 0) { push('unset: missing operand', 'error'); break; }
          const newEnv = { ...env };
          for (const a of args) {
            delete newEnv[a];
          }
          return { out, newEnv };
        }

        case 'env': {
          for (const [k, v] of Object.entries(env)) {
            push(`${k}=${v}`);
          }
          break;
        }

        case 'which': {
          if (args.length === 0) { push('which: missing argument', 'error'); break; }
          for (const a of args) {
            if (ALL_COMMANDS.includes(a)) {
              push(`/usr/bin/${a}`);
            } else if (aliases[a]) {
              push(`${a}: aliased to ${aliases[a]}`);
            } else {
              push(`${a} not found`, 'error');
            }
          }
          break;
        }

        case 'man': {
          if (args.length === 0) { push('man: what manual page do you want?', 'error'); break; }
          const page = MAN_PAGES[args[0]];
          if (page) {
            push(`\nNAME\n    ${page}\n`);
          } else {
            push(`No manual entry for ${args[0]}`, 'error');
          }
          break;
        }

        case 'date': {
          push(new Date().toString());
          break;
        }

        case 'whoami': {
          push('kasm-user');
          break;
        }

        case 'hostname': {
          push('kasm-desktop');
          break;
        }

        case 'uname': {
          if (args.includes('-a')) {
            push('KasmOS kasm-desktop 1.0.0 #1 SMP React 19.2.4 x86_64 KasmOS');
          } else {
            push('KasmOS 1.0.0 (React 19 / Vite 7)');
          }
          break;
        }

        case 'uptime': {
          const elapsed = Math.floor((Date.now() - BOOT_TIME) / 1000);
          const hours = Math.floor(elapsed / 3600);
          const mins = Math.floor((elapsed % 3600) / 60);
          const secs = elapsed % 60;
          push(` up ${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}, 1 user, load average: 0.42, 0.38, 0.35`);
          break;
        }

        case 'free': {
          push('              total        used        free      shared  buff/cache   available');
          push('Mem:       16384000     6291456     7340032      262144     2752512     9830400');
          push('Swap:       2097152      131072     1966080');
          break;
        }

        case 'df': {
          push('Filesystem     1K-blocks    Used Available Use% Mounted on');
          push('/dev/sda1       52428800 18874368  33554432  36% /');
          push('tmpfs            8192000        0   8192000   0% /tmp');
          push('/dev/sda2      104857600 42949672  61907928  41% /home');
          break;
        }

        case 'du': {
          let summary = false;
          const duPaths: string[] = [];
          for (const a of args) {
            if (a === '-s' || a === '-sh') summary = true;
            else duPaths.push(a);
          }
          if (duPaths.length === 0) duPaths.push('.');
          for (const p of duPaths) {
            try {
              const resolved = resolvePath(p);
              const size = vfs.du(resolved);
              push(`${formatBytes(size).padStart(8)}\t${p}`);
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'tree': {
          const treePath = args[0] || '.';
          try {
            const resolved = resolvePath(treePath);
            push(vfs.tree(resolved));
          } catch (err: any) {
            push(err.message, 'error');
          }
          break;
        }

        case 'sort': {
          if (stdinLines) {
            const sorted = [...stdinLines].map(l => l.text).sort();
            push(sorted.join('\n'));
          } else if (args.length > 0) {
            try {
              const content = vfs.readFile(resolvePath(args[0]));
              const sorted = content.split('\n').sort();
              writeRedirect(sorted.join('\n'));
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'uniq': {
          const processLines = (lines: string[]): string[] => {
            const result: string[] = [];
            let prev = '';
            for (const line of lines) {
              if (line !== prev) {
                result.push(line);
                prev = line;
              }
            }
            return result;
          };
          if (stdinLines) {
            push(processLines(stdinLines.map(l => l.text)).join('\n'));
          } else if (args.length > 0) {
            try {
              const content = vfs.readFile(resolvePath(args[0]));
              writeRedirect(processLines(content.split('\n')).join('\n'));
            } catch (err: any) {
              push(err.message, 'error');
            }
          }
          break;
        }

        case 'tee': {
          if (args.length === 0) { push('tee: missing operand', 'error'); break; }
          const teeFile = resolvePath(args[0]);
          if (stdinLines) {
            const text = stdinLines.map(l => l.text).join('\n');
            try {
              vfs.writeFile(teeFile, text);
            } catch (err: any) {
              push(err.message, 'error');
            }
            push(text);
          }
          break;
        }

        case 'neofetch': {
          push([
            `  <span style="color:${tc.accent};font-weight:bold">\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557</span>   <span style="color:${tc.terminalPrompt};font-weight:bold">kasm-user</span>@<span style="color:${tc.terminalPrompt};font-weight:bold">kasm-desktop</span>`,
            `  <span style="color:${tc.accent};font-weight:bold">\u2551   \u25C6  KASM  UI  \u25C6  \u2551</span>   <span style="color:${tc.info}">OS:</span> KasmOS 1.0.0`,
            `  <span style="color:${tc.accent};font-weight:bold">\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D</span>   <span style="color:${tc.info}">Shell:</span> kash 2.0`,
            `                           <span style="color:${tc.info}">Terminal:</span> kasm-terminal`,
            `  React 19.2.4             <span style="color:${tc.info}">WM:</span> Kasm Window Manager`,
            `  TypeScript 5.9           <span style="color:${tc.info}">Theme:</span> Kasm Dark`,
            `  Vite 7.2                 <span style="color:${tc.info}">Resolution:</span> ${window.innerWidth}x${window.innerHeight}`,
          ].join('\n'), 'output', true);
          break;
        }

        case 'clear': {
          // handled in execute()
          break;
        }

        default: {
          push(`kash: command not found: ${command}`, 'error');
        }
      }
    } catch (err: any) {
      push(err.message || String(err), 'error');
    }

    return { out };
  }, [cwd, env, aliases, history, resolvePath, expandVars, expandArgs]);

  const execute = useCallback((cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    setHistory(prev => [trimmed, ...prev]);
    setHistoryIdx(-1);
    setTabSuggestions([]);
    setTabIndex(-1);

    if (trimmed === 'clear') {
      setLines([]);
      setInput('');
      return;
    }

    const newLines: TermLine[] = [
      ...lines,
      { text: `<span style="color:${tc.terminalPrompt};font-weight:bold">kasm-user@kasm-desktop</span>:<span style="color:${tc.terminalPath};font-weight:bold">${escapeHtml(cwd === HOME ? '~' : cwd.replace(HOME, '~'))}</span>$ ${escapeHtml(trimmed)}`, type: 'input', html: true },
    ];

    // Split by pipes
    const pipeSegments = trimmed.split(/\s*\|\s*/);
    let currentStdin: TermLine[] | undefined;
    let finalCwd = cwd;
    let finalEnv = env;
    let finalAliases = aliases;

    for (let i = 0; i < pipeSegments.length; i++) {
      const seg = pipeSegments[i].trim();
      if (!seg) continue;
      const result = execSingle(seg, currentStdin);

      if (result.newCwd) finalCwd = result.newCwd;
      if (result.newEnv) finalEnv = result.newEnv;
      if (result.newAliases) finalAliases = result.newAliases;

      if (i < pipeSegments.length - 1) {
        // Pass output as stdin to next command
        currentStdin = result.out;
      } else {
        // Last command: display output
        newLines.push(...result.out);
      }
    }

    if (finalCwd !== cwd) setCwd(finalCwd);
    if (finalEnv !== env) setEnv(finalEnv);
    if (finalAliases !== aliases) setAliases(finalAliases);

    setLines(newLines);
    setInput('');
  }, [lines, cwd, env, aliases, execSingle]);

  // Tab completion
  const handleTab = useCallback(() => {
    const parts = input.split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';

    let suggestions: string[] = [];

    if (parts.length <= 1) {
      // Complete command names
      suggestions = ALL_COMMANDS.filter(c => c.startsWith(lastPart));
      // Also add aliases
      suggestions.push(...Object.keys(aliases).filter(a => a.startsWith(lastPart)));
    } else {
      // Complete file paths
      const resolved = lastPart.includes('/')
        ? resolvePath(lastPart.substring(0, lastPart.lastIndexOf('/') + 1))
        : cwd;
      const prefix = lastPart.includes('/')
        ? lastPart.substring(lastPart.lastIndexOf('/') + 1)
        : lastPart;

      try {
        const entries = vfs.readDir(resolved);
        suggestions = entries
          .filter(e => e.name.startsWith(prefix))
          .map(e => {
            const base = lastPart.includes('/')
              ? lastPart.substring(0, lastPart.lastIndexOf('/') + 1) + e.name
              : e.name;
            return e.type === 'folder' ? base + '/' : base;
          });
      } catch {
        // ignore
      }
    }

    if (suggestions.length === 0) return;

    if (suggestions.length === 1) {
      parts[parts.length - 1] = suggestions[0];
      setInput(parts.join(' '));
      setTabSuggestions([]);
      setTabIndex(-1);
    } else {
      // Show suggestions, cycle through them
      setTabSuggestions(suggestions);
      const nextIdx = (tabIndex + 1) % suggestions.length;
      setTabIndex(nextIdx);
      parts[parts.length - 1] = suggestions[nextIdx];
      setInput(parts.join(' '));
    }
  }, [input, cwd, aliases, tabIndex, resolvePath]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
      return;
    } else {
      if (tabSuggestions.length > 0 && e.key !== 'Tab') {
        setTabSuggestions([]);
        setTabIndex(-1);
      }
    }

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

  const promptPath = cwd === HOME ? '~' : cwd.replace(HOME, '~');

  return (
    <div className="kasm-app kasm-terminal" onClick={() => inputRef.current?.focus()}>
      <div className="kasm-terminal__output">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`kasm-terminal__line kasm-terminal__line--${line.type}`}
            {...(line.html ? { dangerouslySetInnerHTML: { __html: line.text } } : { children: line.text })}
          />
        ))}
        {tabSuggestions.length > 1 && (
          <div className="kasm-terminal__line kasm-terminal__line--output" style={{ opacity: 0.6 }}>
            {tabSuggestions.join('  ')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="kasm-terminal__prompt">
        <span
          className="kasm-terminal__prompt-text"
          dangerouslySetInnerHTML={{
            __html: `<span style="color:${tc.terminalPrompt};font-weight:bold">kasm-user@kasm-desktop</span>:<span style="color:${tc.terminalPath};font-weight:bold">${escapeHtml(promptPath)}</span>$ `
          }}
        />
        <input
          ref={inputRef}
          className="kasm-terminal__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}
