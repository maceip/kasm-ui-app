// ============================================================
// Settings - Cinnamon-style system settings panel
// Theme selector, panel config, workspace count
// ============================================================

import { createSignal, Show, For, type JSX } from 'solid-js';
import { desktop, setTheme, setPanelConfig, addWorkspace, removeWorkspace } from '../core/store';
import { themeList } from '../theme/themes';
import type { AppProps } from '../core/types';
import './apps.css';

const SECTIONS = ['Appearance', 'Panel', 'Workspaces', 'About'] as const;
type Section = (typeof SECTIONS)[number];

export function Settings(props: AppProps) {
  const [section, setSection] = createSignal<Section>('Appearance');

  return (
    <div class="kasm-app kasm-settings">
      <div class="kasm-settings__sidebar">
        <For each={[...SECTIONS]}>{(s) => (
          <button
            class={`kasm-settings__nav-item ${section() === s ? 'kasm-settings__nav-item--active' : ''}`}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        )}</For>
      </div>
      <div class="kasm-settings__content">
        <Show when={section() === 'Appearance'}>
          <div class="kasm-settings__section">
            <h3>Theme</h3>
            <div class="kasm-settings__theme-grid">
              <For each={themeList}>{(theme) => (
                <button
                  class={`kasm-settings__theme-card ${theme.id === desktop.activeThemeId ? 'kasm-settings__theme-card--active' : ''}`}
                  onClick={() => setTheme(theme.id)}
                >
                  <div
                    class="kasm-settings__theme-preview"
                    style={{
                      background: theme.colors.desktopBg,
                      "border-color": theme.colors.accent,
                    }}
                  >
                    <div style={{ background: theme.colors.panelBg, height: '6px', "border-radius": '2px' }} />
                    <div style={{ display: 'flex', gap: '3px', flex: '1' }}>
                      <div style={{ background: theme.colors.windowBg, flex: '1', "border-radius": '2px' }} />
                      <div style={{ background: theme.colors.surfaceBg, flex: '1', "border-radius": '2px' }} />
                    </div>
                  </div>
                  <span>{theme.name}</span>
                </button>
              )}</For>
            </div>
          </div>
        </Show>

        <Show when={section() === 'Panel'}>
          <div class="kasm-settings__section">
            <h3>Panel Position</h3>
            <div class="kasm-settings__option-group">
              <For each={['bottom', 'top'] as const}>{(pos) => (
                <label class="kasm-settings__radio">
                  <input
                    type="radio"
                    name="panel-pos"
                    checked={desktop.panelConfig.position === pos}
                    onChange={() => setPanelConfig({ position: pos })}
                  />
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </label>
              )}</For>
            </div>

            <h3>Panel Height</h3>
            <input
              type="range"
              min={32}
              max={64}
              value={desktop.panelConfig.height}
              onInput={e => setPanelConfig({ height: Number(e.currentTarget.value) })}
            />
            <span>{desktop.panelConfig.height}px</span>
          </div>
        </Show>

        <Show when={section() === 'Workspaces'}>
          <div class="kasm-settings__section">
            <h3>Workspaces ({desktop.workspaces.length})</h3>
            <div class="kasm-settings__workspace-list">
              <For each={desktop.workspaces}>{(ws) => (
                <div class="kasm-settings__workspace-item">
                  <span>{ws.name}</span>
                  <span class="kasm-settings__workspace-count">{ws.windowIds.length} windows</span>
                  <Show when={desktop.workspaces.length > 1}>
                    <button
                      class="kasm-settings__workspace-remove"
                      onClick={() => removeWorkspace(ws.id)}
                    >
                      ✕
                    </button>
                  </Show>
                </div>
              )}</For>
            </div>
            <button class="kasm-settings__add-btn" onClick={addWorkspace}>
              + Add Workspace
            </button>
          </div>
        </Show>

        <Show when={section() === 'About'}>
          <div class="kasm-settings__section kasm-settings__about">
            <h2>◆ Kasm UI</h2>
            <p>A bleeding-edge SolidJS desktop environment</p>
            <div class="kasm-settings__about-grid">
              <span>SolidJS</span><span>1.9</span>
              <span>TypeScript</span><span>5.9</span>
              <span>Vite</span><span>7.2</span>
              <span>solid-js/store</span><span>1.9</span>
            </div>
            <h3 style={{ "margin-top": '20px' }}>Powered by</h3>
            <ul style={{ "font-size": '12px', opacity: '0.8', "line-height": '2' }}>
              <li>Golden Layout - theming system</li>
              <li>rc-dock - docking / tabs / float model</li>
              <li>Re-Flex - constraint-based resizing</li>
              <li>Cinnamon - desktop shell patterns</li>
              <li>ShareJS - collaborative OT engine</li>
            </ul>
          </div>
        </Show>
      </div>
    </div>
  );
}
