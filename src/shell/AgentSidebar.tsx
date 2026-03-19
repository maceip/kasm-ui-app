// ============================================================
// Agent Sidebar - Multi-agent orchestration panel
// ============================================================

import { createSignal, createMemo, createEffect, Show, For, type JSX } from 'solid-js';
import {
  desktop, createProject, setActiveProject, toggleAgentSidebar,
  spawnAgent, setActiveAgent, removeAgent,
} from '../core/store';
import { SlidingPane } from '../components/SlidingPane';
import type { Project, AgentSession, AgentBackend, AgentStatus, AgentTask, GitNode } from '../core/types';
import './agentSidebar.css';

// === Agent brand metadata ===
const AGENT_BRANDS: Record<AgentBackend, { label: string; color: string; icon: () => JSX.Element }> = {
  'codex':        { label: 'Codex',       color: '#10a37f', icon: OaiIcon },
  'claude-code':  { label: 'Claude Code', color: '#d97706', icon: AnthIcon },
  'gemini-code':  { label: 'Gemini',      color: '#4285f4', icon: GemIcon },
  'cursor-agent': { label: 'Cursor',      color: '#a855f7', icon: CurIcon },
  'devin':        { label: 'Devin',       color: '#06b6d4', icon: DevIcon },
  'junie':        { label: 'Junie',       color: '#e34f82', icon: JunIcon },
  'cody':         { label: 'Cody',        color: '#ff5543', icon: CodIcon },
  'custom':       { label: 'Custom',      color: '#888',    icon: () => <span style={{"font-size": '14px'}}>{'*'}</span> },
};

// ============================================================
// Main Sidebar (desktop)
// ============================================================

export function AgentSidebar() {
  const project = () => desktop.projects.find(p => p.id === desktop.activeProjectId) ?? null;

  // Bootstrap a default project if none exist
  createEffect(() => {
    if (desktop.projects.length === 0) {
      createProject('Default Project', '/home/kasm-user');
    }
  });

  const [spawnMenuOpen, setSpawnMenuOpen] = createSignal(false);

  const handleSpawn = (backend: AgentBackend) => {
    if (!desktop.activeProjectId) return;
    spawnAgent(desktop.activeProjectId, backend);
    setSpawnMenuOpen(false);
  };

  return (
    <Show when={desktop.agentSidebarOpen} fallback={
      <button class="kasm-agent-sidebar__toggle" onClick={() => toggleAgentSidebar()} title="Open agent panel">
        <span class="kasm-agent-sidebar__toggle-icon">{'\u{1F916}'}</span>
      </button>
    }>
      <div class="kasm-agent-sidebar">
        <div class="kasm-agent-sidebar__header">
          <button class="kasm-agent-sidebar__collapse" onClick={() => toggleAgentSidebar()} title="Collapse">
            {'\u25C0'}
          </button>
          <ProjectSwitcher
            projects={desktop.projects as Project[]}
            activeId={desktop.activeProjectId}
            onSelect={setActiveProject}
            onCreate={createProject}
          />
        </div>

        <Show when={project()}>
          {(p) => <GitBlocks nodes={p().gitNodes} agents={p().agents} />}
        </Show>

        <div class="kasm-agent-sidebar__agents">
          <div class="kasm-agent-sidebar__section-header">
            <span>Agents</span>
            <span class="kasm-agent-sidebar__agent-count">
              {project() ? `${project()!.agents.filter(a => a.status === 'working').length}/${project()!.agents.length}` : '0/0'}
            </span>
          </div>

          <For each={project()?.agents ?? []}>
            {(agent) => (
              <AgentCard
                agent={agent}
                isActive={project()?.activeAgentId === agent.id}
                onFocus={() => desktop.activeProjectId && setActiveAgent(desktop.activeProjectId, agent.id)}
                onRemove={() => desktop.activeProjectId && removeAgent(desktop.activeProjectId, agent.id)}
              />
            )}
          </For>

          <div class="kasm-agent-sidebar__spawn-wrap">
            <button
              class="kasm-agent-sidebar__spawn-btn"
              onClick={() => setSpawnMenuOpen(!spawnMenuOpen())}
            >
              + Spawn Agent
            </button>
            <Show when={spawnMenuOpen()}>
              <div class="kasm-agent-sidebar__spawn-menu">
                <For each={Object.keys(AGENT_BRANDS) as AgentBackend[]}>
                  {(backend) => (
                    <button
                      class="kasm-agent-sidebar__spawn-option"
                      onClick={() => handleSpawn(backend)}
                    >
                      <span class="kasm-agent-sidebar__spawn-option-icon">{AGENT_BRANDS[backend].icon()}</span>
                      <span>{AGENT_BRANDS[backend].label}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <Show when={project() && project()!.tasks.length > 0}>
          <div class="kasm-agent-sidebar__tasks">
            <div class="kasm-agent-sidebar__section-header">Tasks</div>
            <For each={project()!.tasks.slice(0, 5)}>
              {(task) => (
                <div class={`kasm-agent-sidebar__task kasm-agent-sidebar__task--${task.status}`}>
                  <StatusDot status={task.status === 'done' ? 'done' : task.status === 'in-progress' ? 'working' : 'idle'} />
                  <span class="kasm-agent-sidebar__task-title">{task.title}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <AgentDetailPane
          agent={project()?.agents.find(a => a.id === project()?.activeAgentId) ?? null}
          onClose={() => desktop.activeProjectId && setActiveAgent(desktop.activeProjectId, '')}
        />
      </div>
    </Show>
  );
}

function AgentDetailPane(props: { agent: AgentSession | null; onClose: () => void }) {
  const brand = () => props.agent ? AGENT_BRANDS[props.agent.backend] : null;
  return (
    <SlidingPane
      isOpen={!!props.agent}
      from="left"
      width="280px"
      title={props.agent?.name || ''}
      subtitle={brand()?.label}
      onRequestClose={props.onClose}
    >
      <Show when={props.agent}>
        {(agent) => (
          <div style={{ padding: '16px', "font-size": '12px', color: 'var(--kasm-surface-text)' }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "margin-bottom": '16px' }}>
              <span style={{ "font-size": '24px' }}>{brand()?.icon()}</span>
              <div>
                <div style={{ "font-weight": 600, "font-size": '14px' }}>{agent().name}</div>
                <div style={{ display: 'flex', "align-items": 'center', gap: '4px', color: 'var(--kasm-text-muted)' }}>
                  <StatusDot status={agent().status} />
                  <span>{agent().status}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
              <DetailRow label="Backend" value={brand()?.label || agent().backend} />
              <DetailRow label="Branch" value={agent().branch || 'none'} />
              <DetailRow label="Tokens" value={`${agent().tokensUsed.toLocaleString()}`} />
              <DetailRow label="Cost" value={`$${agent().costUsd.toFixed(4)}`} />
              <DetailRow label="Created" value={new Date(agent().createdAt).toLocaleTimeString()} />
              <DetailRow label="Last active" value={new Date(agent().lastActivity).toLocaleTimeString()} />
            </div>
          </div>
        )}
      </Show>
    </SlidingPane>
  );
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', "justify-content": 'space-between' }}>
      <span style={{ color: 'var(--kasm-text-muted)' }}>{props.label}</span>
      <span style={{ "font-family": "'JetBrains Mono', monospace", "font-size": '11px' }}>{props.value}</span>
    </div>
  );
}

// ============================================================
// Mobile FAB (Floating Action Button)
// ============================================================

export function AgentFAB() {
  const [expanded, setExpanded] = createSignal(false);
  const project = () => desktop.projects.find(p => p.id === desktop.activeProjectId);

  return (
    <div class={`kasm-agent-fab ${expanded() ? 'kasm-agent-fab--expanded' : ''}`}>
      <Show when={expanded()}>
        <For each={project()?.agents ?? []}>
          {(agent, i) => (
            <button
              class="kasm-agent-fab__agent"
              style={{
                '--fab-offset': `${(i() + 1) * 52}px`,
                "border-color": AGENT_BRANDS[agent.backend]?.color,
              } as JSX.CSSProperties}
              onClick={() => {
                if (desktop.activeProjectId) setActiveAgent(desktop.activeProjectId, agent.id);
                setExpanded(false);
              }}
              title={agent.name}
            >
              <StatusDot status={agent.status} />
              {AGENT_BRANDS[agent.backend]?.icon()}
            </button>
          )}
        </For>
      </Show>
      <button
        class="kasm-agent-fab__main"
        onClick={() => setExpanded(!expanded())}
      >
        {expanded() ? '\u2715' : '\u{1F916}'}
      </button>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ProjectSwitcher(props: {
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, path: string) => string;
}) {
  const [open, setOpen] = createSignal(false);
  const active = () => props.projects.find(p => p.id === props.activeId);

  return (
    <div class="kasm-project-switcher">
      <button class="kasm-project-switcher__btn" onClick={() => setOpen(!open())}>
        <span class="kasm-project-switcher__name">{active()?.name || 'No project'}</span>
        <span class="kasm-project-switcher__arrow">{open() ? '\u25B4' : '\u25BE'}</span>
      </button>
      <Show when={open()}>
        <div class="kasm-project-switcher__dropdown">
          <For each={props.projects}>
            {(p) => (
              <button
                class={`kasm-project-switcher__item ${p.id === props.activeId ? 'kasm-project-switcher__item--active' : ''}`}
                onClick={() => { props.onSelect(p.id); setOpen(false); }}
              >
                {p.name}
                <span class="kasm-project-switcher__item-agents">
                  {p.agents.length} agent{p.agents.length !== 1 ? 's' : ''}
                </span>
              </button>
            )}
          </For>
          <button
            class="kasm-project-switcher__item kasm-project-switcher__item--new"
            onClick={() => {
              const name = `Project ${props.projects.length + 1}`;
              props.onCreate(name, '/home/kasm-user');
              setOpen(false);
            }}
          >
            + New Project
          </button>
        </div>
      </Show>
    </div>
  );
}

function AgentCard(props: {
  agent: AgentSession;
  isActive: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const brand = () => AGENT_BRANDS[props.agent.backend];
  return (
    <div
      class={`kasm-agent-card ${props.isActive ? 'kasm-agent-card--active' : ''}`}
      onClick={props.onFocus}
      style={{ '--agent-color': brand()?.color } as JSX.CSSProperties}
    >
      <div class="kasm-agent-card__icon">{brand()?.icon()}</div>
      <div class="kasm-agent-card__info">
        <div class="kasm-agent-card__name">{props.agent.name}</div>
        <div class="kasm-agent-card__meta">
          <StatusDot status={props.agent.status} />
          <span>{props.agent.status}</span>
          {props.agent.tokensUsed > 0 && <span class="kasm-agent-card__tokens">{(props.agent.tokensUsed / 1000).toFixed(1)}k tok</span>}
        </div>
      </div>
      <button
        class="kasm-agent-card__remove"
        onClick={e => { e.stopPropagation(); props.onRemove(); }}
        title="Remove agent"
      >
        {'\u2715'}
      </button>
    </div>
  );
}

function StatusDot(props: { status: AgentStatus | AgentTask['status'] }) {
  const cls = () =>
    props.status === 'working' || props.status === 'in-progress' ? 'kasm-status-dot--working' :
    props.status === 'waiting' || props.status === 'assigned' ? 'kasm-status-dot--waiting' :
    props.status === 'error' ? 'kasm-status-dot--error' :
    props.status === 'done' ? 'kasm-status-dot--done' :
    '';
  return <span class={`kasm-status-dot ${cls()}`} />;
}

// ============================================================
// 3D Git Blocks - CSS 3D isometric visualization
// ============================================================

function GitBlocks(props: { nodes: GitNode[]; agents: AgentSession[] }) {
  const displayNodes = createMemo(() => {
    if (props.nodes.length > 0) return props.nodes.slice(-12);
    const now = Date.now();
    const mockNodes: GitNode[] = [
      { hash: 'main-1', short: 'abc1234', message: 'Initial commit', branch: 'main', isMerged: true, parentHashes: [], timestamp: now - 300000 },
      { hash: 'main-2', short: 'def5678', message: 'Add auth module', branch: 'main', isMerged: true, parentHashes: ['main-1'], timestamp: now - 200000 },
      { hash: 'main-3', short: 'ghi9012', message: 'Fix tests', branch: 'main', isMerged: true, parentHashes: ['main-2'], timestamp: now - 100000 },
    ];
    props.agents.forEach((agent, i) => {
      if (agent.branch || agent.status === 'working') {
        const branchName = agent.branch || `agent/${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
        mockNodes.push({
          hash: `agent-${i}`,
          short: agent.id.slice(0, 7),
          message: `${agent.name}: working`,
          branch: branchName,
          isMerged: false,
          parentHashes: ['main-3'],
          timestamp: now - (50000 * (props.agents.length - i)),
        });
      }
    });
    return mockNodes.slice(-12);
  });

  const branches = createMemo(() => {
    const map = new Map<string, GitNode[]>();
    displayNodes().forEach(n => {
      const br = n.branch || 'main';
      if (!map.has(br)) map.set(br, []);
      map.get(br)!.push(n);
    });
    return Array.from(map.entries());
  });

  return (
    <div class="kasm-git-blocks">
      <div class="kasm-git-blocks__scene">
        <For each={branches()}>
          {([branchName, branchNodes], branchIdx) => (
            <div
              class="kasm-git-blocks__lane"
              style={{ '--lane-idx': branchIdx() } as JSX.CSSProperties}
            >
              <div class="kasm-git-blocks__branch-label">{branchName}</div>
              <For each={branchNodes}>
                {(node, nodeIdx) => (
                  <div
                    class={`kasm-git-blocks__block ${node.isMerged ? 'kasm-git-blocks__block--merged' : 'kasm-git-blocks__block--unmerged'}`}
                    style={{
                      '--node-idx': nodeIdx(),
                      '--branch-color': branchName === 'main' ? 'var(--kasm-success)' : `hsl(${branchIdx() * 60 + 200}, 70%, 55%)`,
                    } as JSX.CSSProperties}
                    title={`${node.short}: ${node.message}`}
                  >
                    <div class="kasm-git-blocks__block-face kasm-git-blocks__block-face--front" />
                    <div class="kasm-git-blocks__block-face kasm-git-blocks__block-face--top" />
                    <div class="kasm-git-blocks__block-face kasm-git-blocks__block-face--right" />
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
      <div class="kasm-git-blocks__legend">
        <span class="kasm-git-blocks__legend-item">
          <span class="kasm-git-blocks__legend-block kasm-git-blocks__legend-block--merged" /> merged
        </span>
        <span class="kasm-git-blocks__legend-item">
          <span class="kasm-git-blocks__legend-block kasm-git-blocks__legend-block--unmerged" /> pending
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Tiny inline SVG brand icons (16x16)
// ============================================================

function OaiIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#10a37f"><path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07z"/></svg>;
}
function AnthIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#d97706"><path d="M17.3 3.54h-3.67l6.7 16.92H24Zm-10.61 0L0 20.46h3.74l1.37-3.55h7l1.37 3.55h3.74L10.54 3.54Zm-.37 10.22 2.29-5.95 2.29 5.95Z"/></svg>;
}
function GemIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#4285f4"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>;
}
function CurIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#a855f7"><path d="M11.5.13 1.89 5.68a.84.84 0 0 0-.42.73v11.19c0 .3.16.57.42.72l9.61 5.55a1 1 0 0 0 1 0l9.61-5.55a.84.84 0 0 0 .42-.72V6.41a.84.84 0 0 0-.42-.73L12.5.13a1.01 1.01 0 0 0-1 0M2.66 6.34h18.55c.26 0 .43.29.3.52L12.23 22.92c-.06.1-.23.06-.23-.06V12.34a.59.59 0 0 0-.3-.51l-9.11-5.26c-.11-.06-.06-.23.06-.23"/></svg>;
}
function DevIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#06b6d4"/><path d="M8.5 7h3.5a5 5 0 0 1 0 10H8.5V7zm2 2v6H12a3 3 0 0 0 0-6h-1.5z" fill="white"/></svg>;
}
function JunIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#e34f82"><path d="M2.35 24A2.35 2.35 0 0 1 0 21.65V10.99c0-1.32.54-2.62 1.47-3.56l5.97-5.96A5.01 5.01 0 0 1 10.99 0h10.67A2.35 2.35 0 0 1 24 2.35v10.66a5.06 5.06 0 0 1-1.47 3.55l-5.97 5.97A5.02 5.02 0 0 1 13.01 24H2.35Zm8.97-6.85H5.49v1.37h5.83v-1.37Z"/></svg>;
}
function CodIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v8.5M12 13.5V22M2 12h8.5M13.5 12H22M4.93 4.93l6.01 6.01M13.06 13.06l6.01 6.01M19.07 4.93l-6.01 6.01M10.94 13.06l-6.01 6.01" stroke="#ff5543" stroke-width="2.5" stroke-linecap="round"/></svg>;
}
