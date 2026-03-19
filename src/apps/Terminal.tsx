// ============================================================
// Terminal Emulator - Full shell with VFS integration
// SolidJS port - all command logic unchanged
// ============================================================

import { createSignal, createEffect, For, Show } from 'solid-js';
import type { AppProps } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import './apps.css';
import { vfs } from './vfs';

interface TermLine { text: string; type: 'input' | 'output' | 'error'; html?: boolean; }

const HOME = '/home/kasm-user';
const BOOT_TIME = Date.now();

const MAN_PAGES: Record<string, string> = {
  ls: 'ls [-l] [-a] [path] - list directory contents', cd: 'cd [path] - change the working directory',
  pwd: 'pwd - print name of current working directory', mkdir: 'mkdir <path> - create a directory',
  rmdir: 'rmdir <path> - remove an empty directory', rm: 'rm [-r] <path> - remove files or directories',
  touch: 'touch <path> - create an empty file', cat: 'cat <file...> - concatenate and print files',
  echo: 'echo [text] [> file] - display text', cp: 'cp [-r] <src> <dst> - copy files',
  mv: 'mv <src> <dst> - move files', head: 'head [-n N] <file> - first part of files',
  tail: 'tail [-n N] <file> - last part of files', wc: 'wc <file> - line/word/byte counts',
  grep: 'grep <pattern> <file...> - search for pattern', find: 'find <path> -name <pattern> - search files',
  chmod: 'chmod <mode> <path> - change file mode', clear: 'clear - clear the terminal',
  history: 'history - display command history', alias: 'alias [name=value] - create or list aliases',
  export: 'export [NAME=VALUE] - set env variable', unset: 'unset <NAME> - remove env variable',
  env: 'env - print environment variables', which: 'which <command> - locate a command',
  man: 'man <command> - display manual page', date: 'date - display current date and time',
  whoami: 'whoami - print current user', hostname: 'hostname - show hostname',
  uname: 'uname [-a] - print system info', uptime: 'uptime - show uptime',
  free: 'free - display memory usage', df: 'df - report disk space usage',
  du: 'du [-s] [path] - estimate file space', tree: 'tree [path] - list contents in tree format',
  sort: 'sort - sort lines', uniq: 'uniq - omit repeated lines',
  tee: 'tee <file> - read stdin, write to stdout and file', neofetch: 'neofetch - display system info',
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

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false, inDouble = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === ' ' && !inSingle && !inDouble) { if (current) { tokens.push(current); current = ''; } }
    else current += c;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function Terminal(props: AppProps) {
  const theme = useTheme();
  const tc = theme.colors;

  const [lines, setLines] = createSignal<TermLine[]>([
    { text: 'Welcome to Kasm Terminal v2.0.0', type: 'output' },
    { text: 'Type "help" for available commands.', type: 'output' },
  ]);
  const [input, setInput] = createSignal('');
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIdx, setHistoryIdx] = createSignal(-1);
  const [cwd, setCwd] = createSignal(HOME);
  const [env, setEnv] = createSignal<Record<string, string>>({
    HOME, USER: 'kasm-user', SHELL: '/bin/kash', PATH: '/usr/bin:/bin',
    PWD: HOME, TERM: 'kasm-terminal', HOSTNAME: 'kasm-desktop', LANG: 'en_US.UTF-8', EDITOR: 'nvim',
  });
  const [aliases, setAliases] = createSignal<Record<string, string>>({
    ll: 'ls -la', la: 'ls -a', gs: 'echo git status placeholder',
  });
  const [tabSuggestions, setTabSuggestions] = createSignal<string[]>([]);
  const [tabIndex, setTabIndex] = createSignal(-1);
  let bottomRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    void lines().length; // track
    bottomRef?.scrollIntoView({ behavior: 'smooth' });
  });

  const resolvePath = (p: string): string => vfs.resolvePath(cwd(), p);
  const expandVars = (s: string): string => s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => env()[name] ?? '');
  const expandArgs = (args: string[]): string[] => {
    const result: string[] = [];
    for (const arg of args) {
      if (arg.includes('*') || arg.includes('?')) {
        const expanded = vfs.expandGlob(cwd(), arg);
        result.push(...(expanded.length > 0 ? expanded : [arg]));
      } else result.push(arg);
    }
    return result;
  };

  // Execute a single command (pure logic - unchanged from React)
  function execSingle(cmdStr: string, stdinLines?: TermLine[]): { out: TermLine[]; newCwd?: string; newEnv?: Record<string, string>; newAliases?: Record<string, string> } {
    const out: TermLine[] = [];
    const push = (text: string, type: 'output' | 'error' = 'output', html = false) => { out.push({ text, type, html }); };

    let redirectFile: string | null = null;
    let redirectAppend = false;
    const redirectMatch = cmdStr.match(/^(.+?)\s+(>>|>)\s*(.+)$/);
    if (redirectMatch) { cmdStr = redirectMatch[1].trim(); redirectAppend = redirectMatch[2] === '>>'; redirectFile = redirectMatch[3].trim(); }

    const expanded = expandVars(cmdStr);
    const tokens = tokenize(expanded);
    if (tokens.length === 0) return { out };

    let [command, ...args] = tokens;
    const currentAliases = aliases();
    const currentEnv = env();
    const currentCwd = cwd();
    const currentHistory = history();

    if (currentAliases[command]) {
      const aliasTokens = tokenize(currentAliases[command]);
      command = aliasTokens[0];
      args = [...aliasTokens.slice(1), ...args];
    }
    args = expandArgs(args);

    const writeRedirect = (text: string) => {
      if (redirectFile) {
        const fp = resolvePath(redirectFile);
        try { if (redirectAppend) vfs.appendFile(fp, text + '\n'); else vfs.writeFile(fp, text + '\n'); }
        catch (err: any) { push(err.message, 'error'); }
      } else push(text);
    };

    try {
      switch (command) {
        case 'help': push('Available commands: ' + ALL_COMMANDS.join(', ')); break;
        case 'echo': writeRedirect(args.join(' ')); break;
        case 'cd': {
          const target = args[0] || '~';
          const resolved = resolvePath(target);
          if (!vfs.exists(resolved)) { push(`cd: ${target}: No such file or directory`, 'error'); }
          else { const node = vfs.getNode(resolved); if (node?.type !== 'folder') push(`cd: ${target}: Not a directory`, 'error'); else return { out, newCwd: resolved, newEnv: { ...currentEnv, PWD: resolved } }; }
          break;
        }
        case 'pwd': push(currentCwd); break;
        case 'ls': {
          let showAll = false, showLong = false;
          const paths: string[] = [];
          for (const a of args) { if (a === '-l') showLong = true; else if (a === '-a') showAll = true; else if (a === '-la' || a === '-al') { showAll = true; showLong = true; } else paths.push(a); }
          if (paths.length === 0) paths.push('.');
          for (const p of paths) {
            const resolved = resolvePath(p);
            const node = vfs.getNode(resolved);
            if (!node) { push(`ls: cannot access '${p}': No such file or directory`, 'error'); continue; }
            if (node.type !== 'folder') { push(showLong ? `${node.permissions} ${node.owner} ${formatBytes(node.size).padStart(6)} ${node.modified.toISOString().split('T')[0]} ${node.name}` : node.name); continue; }
            let filtered = vfs.readDir(resolved);
            if (!showAll) filtered = filtered.filter(e => !e.name.startsWith('.'));
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            if (paths.length > 1) push(`${p}:`);
            if (showLong) {
              push(`total ${filtered.length}`);
              for (const entry of filtered) {
                const nameColored = entry.type === 'folder' ? colorize(entry.name + '/', tc.terminalPath) : entry.permissions.includes('x') ? colorize(entry.name, tc.success) : escapeHtml(entry.name);
                push(`${entry.permissions} ${entry.owner.padEnd(10)} ${formatBytes(entry.type === 'folder' ? 4096 : entry.size).padStart(6)} ${entry.modified.toISOString().split('T')[0]} ${nameColored}`, 'output', true);
              }
            } else {
              const colored = filtered.map(e => e.type === 'folder' ? colorize(e.name, tc.terminalPath) : e.permissions.includes('x') ? colorize(e.name, tc.success) : escapeHtml(e.name));
              if (redirectFile) writeRedirect(filtered.map(e => e.name).join('  '));
              else push(colored.join('  '), 'output', true);
            }
          }
          break;
        }
        case 'mkdir': { if (args.length === 0) { push('mkdir: missing operand', 'error'); break; } let mkP = false; const mkPaths: string[] = []; for (const a of args) { if (a === '-p') mkP = true; else mkPaths.push(a); } for (const p of mkPaths) { try { if (mkP) vfs.mkdirp(resolvePath(p)); else vfs.mkdir(resolvePath(p)); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'rmdir': { if (args.length === 0) { push('rmdir: missing operand', 'error'); break; } for (const p of args) { try { const r = resolvePath(p); const n = vfs.getNode(r); if (!n) throw new Error(`rmdir: '${p}': No such file or directory`); if (n.type !== 'folder') throw new Error(`rmdir: '${p}': Not a directory`); vfs.rm(r, false); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'rm': { let recursive = false; const rmP: string[] = []; for (const a of args) { if (a === '-r' || a === '-rf' || a === '-fr') recursive = true; else if (a !== '-f') rmP.push(a); } if (rmP.length === 0) { push('rm: missing operand', 'error'); break; } for (const p of rmP) { try { vfs.rm(resolvePath(p), recursive); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'touch': { if (args.length === 0) { push('touch: missing operand', 'error'); break; } for (const p of args) { try { vfs.touch(resolvePath(p)); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'cat': { if (args.length === 0) { if (stdinLines) for (const l of stdinLines) push(l.text); else push('cat: missing operand', 'error'); break; } for (const p of args) { try { writeRedirect(vfs.readFile(resolvePath(p))); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'cp': { let rec = false; const cpA: string[] = []; for (const a of args) { if (a === '-r' || a === '-R') rec = true; else cpA.push(a); } if (cpA.length < 2) { push('cp: missing operand', 'error'); break; } const dst = cpA.pop()!; for (const s of cpA) { try { vfs.cp(resolvePath(s), resolvePath(dst), rec); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'mv': { if (args.length < 2) { push('mv: missing operand', 'error'); break; } const mvD = args.pop()!; for (const s of args) { try { vfs.mv(resolvePath(s), resolvePath(mvD)); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'head': { let n = 10; const hp: string[] = []; for (let i = 0; i < args.length; i++) { if (args[i] === '-n' && args[i+1]) { n = parseInt(args[++i]) || 10; } else hp.push(args[i]); } if (hp.length === 0 && stdinLines) push(stdinLines.slice(0, n).map(l => l.text).join('\n')); else for (const p of hp) { try { writeRedirect(vfs.readFile(resolvePath(p)).split('\n').slice(0, n).join('\n')); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'tail': { let n = 10; const tp: string[] = []; for (let i = 0; i < args.length; i++) { if (args[i] === '-n' && args[i+1]) { n = parseInt(args[++i]) || 10; } else tp.push(args[i]); } if (tp.length === 0 && stdinLines) push(stdinLines.slice(-n).map(l => l.text).join('\n')); else for (const p of tp) { try { const l = vfs.readFile(resolvePath(p)).split('\n'); writeRedirect(l.slice(-n).join('\n')); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'wc': { if (args.length === 0 && stdinLines) { const t = stdinLines.map(l => l.text).join('\n'); push(`  ${t.split('\n').length}  ${t.split(/\s+/).filter(Boolean).length}  ${t.length}`); } else for (const p of args) { try { const c = vfs.readFile(resolvePath(p)); push(`  ${c.split('\n').length}  ${c.split(/\s+/).filter(Boolean).length}  ${c.length} ${p}`); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'grep': { if (args.length < 1) { push('grep: missing pattern', 'error'); break; } let ci = false, ln = false; const ga: string[] = []; for (const a of args) { if (a === '-i') ci = true; else if (a === '-n') ln = true; else ga.push(a); } const pat = ga[0]; const gf = ga.slice(1); const re = new RegExp(pat, ci ? 'i' : ''); if (gf.length === 0 && stdinLines) { stdinLines.map(l => l.text).forEach((l, i) => { if (re.test(l)) { const hl = l.replace(re, m => `<span style="color:${tc.terminalError};font-weight:bold">${escapeHtml(m)}</span>`); push(`${ln ? `${i+1}:` : ''}${hl}`, 'output', true); } }); } else for (const p of gf) { try { const c = vfs.readFile(resolvePath(p)); const pre = gf.length > 1 ? colorize(p + ':', tc.info) : ''; c.split('\n').forEach((l, i) => { if (re.test(l)) { const hl = escapeHtml(l).replace(new RegExp(escapeHtml(pat), ci ? 'gi' : 'g'), m => `<span style="color:${tc.terminalError};font-weight:bold">${m}</span>`); push(`${pre}${ln ? `${i+1}:` : ''}${hl}`, 'output', true); } }); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'find': { let fp = '.', fn = '*'; for (let i = 0; i < args.length; i++) { if (args[i] === '-name' && args[i+1]) fn = args[++i]; else if (!args[i].startsWith('-')) fp = args[i]; } try { for (const r of vfs.find(resolvePath(fp), fn)) push(r); } catch (e: any) { push(e.message, 'error'); } break; }
        case 'chmod': { if (args.length < 2) { push('chmod: missing operand', 'error'); break; } const [mode, ...cp] = args; for (const p of cp) { try { vfs.chmod(resolvePath(p), mode); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'history': { currentHistory.forEach((cmd, i) => push(`  ${(currentHistory.length - i).toString().padStart(4)}  ${cmd}`)); break; }
        case 'alias': { if (args.length === 0) { for (const [k, v] of Object.entries(currentAliases)) push(`alias ${k}='${v}'`); } else { const na = { ...currentAliases }; for (const a of args) { const eq = a.indexOf('='); if (eq > 0) { let v = a.substring(eq + 1); if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1); na[a.substring(0, eq)] = v; } else { if (currentAliases[a]) push(`alias ${a}='${currentAliases[a]}'`); else push(`alias: ${a}: not found`, 'error'); } } return { out, newAliases: na }; } break; }
        case 'export': { if (args.length === 0) { for (const [k, v] of Object.entries(currentEnv)) push(`declare -x ${k}="${v}"`); } else { const ne = { ...currentEnv }; for (const a of args) { const eq = a.indexOf('='); if (eq > 0) ne[a.substring(0, eq)] = a.substring(eq + 1); } return { out, newEnv: ne }; } break; }
        case 'unset': { if (args.length === 0) { push('unset: missing operand', 'error'); break; } const ne = { ...currentEnv }; for (const a of args) delete ne[a]; return { out, newEnv: ne }; }
        case 'env': { for (const [k, v] of Object.entries(currentEnv)) push(`${k}=${v}`); break; }
        case 'which': { if (args.length === 0) { push('which: missing argument', 'error'); break; } for (const a of args) { if (ALL_COMMANDS.includes(a)) push(`/usr/bin/${a}`); else if (currentAliases[a]) push(`${a}: aliased to ${currentAliases[a]}`); else push(`${a} not found`, 'error'); } break; }
        case 'man': { if (args.length === 0) { push('man: what manual page do you want?', 'error'); break; } const pg = MAN_PAGES[args[0]]; if (pg) push(`\nNAME\n    ${pg}\n`); else push(`No manual entry for ${args[0]}`, 'error'); break; }
        case 'date': push(new Date().toString()); break;
        case 'whoami': push('kasm-user'); break;
        case 'hostname': push('kasm-desktop'); break;
        case 'uname': push(args.includes('-a') ? 'KasmOS kasm-desktop 1.0.0 #1 SMP SolidJS x86_64 KasmOS' : 'KasmOS 1.0.0 (SolidJS / Vite)'); break;
        case 'uptime': { const el = Math.floor((Date.now() - BOOT_TIME) / 1000); push(` up ${Math.floor(el/3600)}:${(Math.floor((el%3600)/60)).toString().padStart(2,'0')}:${(el%60).toString().padStart(2,'0')}, 1 user, load average: 0.42, 0.38, 0.35`); break; }
        case 'free': push('              total        used        free      shared  buff/cache   available\nMem:       16384000     6291456     7340032      262144     2752512     9830400\nSwap:       2097152      131072     1966080'); break;
        case 'df': push('Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/sda1       52428800 18874368  33554432  36% /\ntmpfs            8192000        0   8192000   0% /tmp\n/dev/sda2      104857600 42949672  61907928  41% /home'); break;
        case 'du': { let summary = false; const dp: string[] = []; for (const a of args) { if (a === '-s' || a === '-sh') summary = true; else dp.push(a); } if (dp.length === 0) dp.push('.'); for (const p of dp) { try { push(`${formatBytes(vfs.du(resolvePath(p))).padStart(8)}\t${p}`); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'tree': { try { push(vfs.tree(resolvePath(args[0] || '.'))); } catch (e: any) { push(e.message, 'error'); } break; }
        case 'sort': { if (stdinLines) push([...stdinLines].map(l => l.text).sort().join('\n')); else if (args.length > 0) { try { writeRedirect(vfs.readFile(resolvePath(args[0])).split('\n').sort().join('\n')); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'uniq': { const proc = (ls: string[]) => { const r: string[] = []; let prev = ''; for (const l of ls) { if (l !== prev) { r.push(l); prev = l; } } return r; }; if (stdinLines) push(proc(stdinLines.map(l => l.text)).join('\n')); else if (args.length > 0) { try { writeRedirect(proc(vfs.readFile(resolvePath(args[0])).split('\n')).join('\n')); } catch (e: any) { push(e.message, 'error'); } } break; }
        case 'tee': { if (args.length === 0) { push('tee: missing operand', 'error'); break; } if (stdinLines) { const t = stdinLines.map(l => l.text).join('\n'); try { vfs.writeFile(resolvePath(args[0]), t); } catch (e: any) { push(e.message, 'error'); } push(t); } break; }
        case 'neofetch': { push([
          `  <span style="color:${tc.accent};font-weight:bold">\u2554${'═'.repeat(19)}\u2557</span>   <span style="color:${tc.terminalPrompt};font-weight:bold">kasm-user</span>@<span style="color:${tc.terminalPrompt};font-weight:bold">kasm-desktop</span>`,
          `  <span style="color:${tc.accent};font-weight:bold">\u2551   \u25C6  KASM  UI  \u25C6  \u2551</span>   <span style="color:${tc.info}">OS:</span> KasmOS 1.0.0`,
          `  <span style="color:${tc.accent};font-weight:bold">\u255A${'═'.repeat(19)}\u255D</span>   <span style="color:${tc.info}">Shell:</span> kash 2.0`,
          `                           <span style="color:${tc.info}">Terminal:</span> kasm-terminal`,
          `  SolidJS 1.9              <span style="color:${tc.info}">WM:</span> Kasm Window Manager`,
          `  TypeScript 5.9           <span style="color:${tc.info}">Theme:</span> Kasm Dark`,
          `  Vite 8.0                 <span style="color:${tc.info}">Resolution:</span> ${window.innerWidth}x${window.innerHeight}`,
        ].join('\n'), 'output', true); break; }
        case 'clear': break;
        default: push(`kash: command not found: ${command}`, 'error');
      }
    } catch (err: any) { push(err.message || String(err), 'error'); }
    return { out };
  }

  function execute(cmdStr: string) {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    setHistory(prev => [trimmed, ...prev]);
    setHistoryIdx(-1);
    setTabSuggestions([]);
    setTabIndex(-1);

    if (trimmed === 'clear') { setLines([]); setInput(''); return; }

    const currentCwd = cwd();
    const promptPath = currentCwd === HOME ? '~' : currentCwd.replace(HOME, '~');
    const newLines: TermLine[] = [
      ...lines(),
      { text: `<span style="color:${tc.terminalPrompt};font-weight:bold">kasm-user@kasm-desktop</span>:<span style="color:${tc.terminalPath};font-weight:bold">${escapeHtml(promptPath)}</span>$ ${escapeHtml(trimmed)}`, type: 'input', html: true },
    ];

    const pipeSegments = trimmed.split(/\s*\|\s*/);
    let currentStdin: TermLine[] | undefined;
    let finalCwd = currentCwd;
    let finalEnv = env();
    let finalAliases = aliases();

    for (let i = 0; i < pipeSegments.length; i++) {
      const seg = pipeSegments[i].trim();
      if (!seg) continue;
      const result = execSingle(seg, currentStdin);
      if (result.newCwd) finalCwd = result.newCwd;
      if (result.newEnv) finalEnv = result.newEnv;
      if (result.newAliases) finalAliases = result.newAliases;
      if (i < pipeSegments.length - 1) currentStdin = result.out;
      else newLines.push(...result.out);
    }

    if (finalCwd !== currentCwd) setCwd(finalCwd);
    if (finalEnv !== env()) setEnv(finalEnv);
    if (finalAliases !== aliases()) setAliases(finalAliases);

    setLines(newLines);
    setInput('');
  }

  function handleTab() {
    const parts = input().split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';
    let suggestions: string[] = [];

    if (parts.length <= 1) {
      suggestions = ALL_COMMANDS.filter(c => c.startsWith(lastPart));
      suggestions.push(...Object.keys(aliases()).filter(a => a.startsWith(lastPart)));
    } else {
      const resolved = lastPart.includes('/') ? resolvePath(lastPart.substring(0, lastPart.lastIndexOf('/') + 1)) : cwd();
      const prefix = lastPart.includes('/') ? lastPart.substring(lastPart.lastIndexOf('/') + 1) : lastPart;
      try {
        const entries = vfs.readDir(resolved);
        suggestions = entries.filter(e => e.name.startsWith(prefix)).map(e => {
          const base = lastPart.includes('/') ? lastPart.substring(0, lastPart.lastIndexOf('/') + 1) + e.name : e.name;
          return e.type === 'folder' ? base + '/' : base;
        });
      } catch { /* ignore */ }
    }

    if (suggestions.length === 0) return;
    if (suggestions.length === 1) {
      parts[parts.length - 1] = suggestions[0];
      setInput(parts.join(' '));
      setTabSuggestions([]);
      setTabIndex(-1);
    } else {
      setTabSuggestions(suggestions);
      const nextIdx = (tabIndex() + 1) % suggestions.length;
      setTabIndex(nextIdx);
      parts[parts.length - 1] = suggestions[nextIdx];
      setInput(parts.join(' '));
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') { e.preventDefault(); handleTab(); return; }
    else if (tabSuggestions().length > 0) { setTabSuggestions([]); setTabIndex(-1); }

    if (e.key === 'Enter') execute(input());
    else if (e.key === 'ArrowUp') { e.preventDefault(); const h = history(); if (historyIdx() < h.length - 1) { const idx = historyIdx() + 1; setHistoryIdx(idx); setInput(h[idx]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (historyIdx() > 0) { const idx = historyIdx() - 1; setHistoryIdx(idx); setInput(history()[idx]); } else { setHistoryIdx(-1); setInput(''); } }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  const promptPath = () => { const c = cwd(); return c === HOME ? '~' : c.replace(HOME, '~'); };

  return (
    <div class="kasm-app kasm-terminal" onClick={() => inputRef?.focus()}>
      <div class="kasm-terminal__output">
        <For each={lines()}>
          {(line) => (
            <div
              class={`kasm-terminal__line kasm-terminal__line--${line.type}`}
              {...(line.html ? { innerHTML: line.text } : { textContent: line.text })}
            />
          )}
        </For>
        <Show when={tabSuggestions().length > 1}>
          <div class="kasm-terminal__line kasm-terminal__line--output" style={{ opacity: 0.6 }}>
            {tabSuggestions().join('  ')}
          </div>
        </Show>
        <div ref={bottomRef} />
      </div>
      <div class="kasm-terminal__prompt">
        <span
          class="kasm-terminal__prompt-text"
          innerHTML={`<span style="color:${tc.terminalPrompt};font-weight:bold">kasm-user@kasm-desktop</span>:<span style="color:${tc.terminalPath};font-weight:bold">${escapeHtml(promptPath())}</span>$ `}
        />
        <input
          ref={inputRef}
          class="kasm-terminal__input"
          value={input()}
          onInput={e => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autofocus
          spellcheck={false}
        />
      </div>
    </div>
  );
}
