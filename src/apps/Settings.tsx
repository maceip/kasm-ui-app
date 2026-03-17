// ============================================================
// Settings - Cinnamon-style system settings panel
// Theme selector, panel config, workspace count
// ============================================================

import { useState } from 'react';
import { useDesktopStore } from '../core/store';
import { themeList } from '../theme/themes';
import type { AppProps } from '../core/types';
import './apps.css';

const SECTIONS = ['Appearance', 'Panel', 'Workspaces', 'About'] as const;
type Section = (typeof SECTIONS)[number];

export function Settings({ windowId }: AppProps) {
  const [section, setSection] = useState<Section>('Appearance');
  const { activeThemeId, setTheme, panelConfig, setPanelConfig, workspaces, addWorkspace, removeWorkspace } = useDesktopStore();

  return (
    <div className="kasm-app kasm-settings">
      <div className="kasm-settings__sidebar">
        {SECTIONS.map(s => (
          <button
            key={s}
            className={`kasm-settings__nav-item ${section === s ? 'kasm-settings__nav-item--active' : ''}`}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="kasm-settings__content">
        {section === 'Appearance' && (
          <div className="kasm-settings__section">
            <h3>Theme</h3>
            <div className="kasm-settings__theme-grid">
              {themeList.map(theme => (
                <button
                  key={theme.id}
                  className={`kasm-settings__theme-card ${theme.id === activeThemeId ? 'kasm-settings__theme-card--active' : ''}`}
                  onClick={() => setTheme(theme.id)}
                >
                  <div
                    className="kasm-settings__theme-preview"
                    style={{
                      background: theme.colors.desktopBg,
                      borderColor: theme.colors.accent,
                    }}
                  >
                    <div style={{ background: theme.colors.panelBg, height: 6, borderRadius: 2 }} />
                    <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                      <div style={{ background: theme.colors.windowBg, flex: 1, borderRadius: 2 }} />
                      <div style={{ background: theme.colors.surfaceBg, flex: 1, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {section === 'Panel' && (
          <div className="kasm-settings__section">
            <h3>Panel Position</h3>
            <div className="kasm-settings__option-group">
              {(['bottom', 'top'] as const).map(pos => (
                <label key={pos} className="kasm-settings__radio">
                  <input
                    type="radio"
                    name="panel-pos"
                    checked={panelConfig.position === pos}
                    onChange={() => setPanelConfig({ position: pos })}
                  />
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </label>
              ))}
            </div>

            <h3>Panel Height</h3>
            <input
              type="range"
              min={32}
              max={64}
              value={panelConfig.height}
              onChange={e => setPanelConfig({ height: Number(e.target.value) })}
            />
            <span>{panelConfig.height}px</span>
          </div>
        )}

        {section === 'Workspaces' && (
          <div className="kasm-settings__section">
            <h3>Workspaces ({workspaces.length})</h3>
            <div className="kasm-settings__workspace-list">
              {workspaces.map(ws => (
                <div key={ws.id} className="kasm-settings__workspace-item">
                  <span>{ws.name}</span>
                  <span className="kasm-settings__workspace-count">{ws.windowIds.length} windows</span>
                  {workspaces.length > 1 && (
                    <button
                      className="kasm-settings__workspace-remove"
                      onClick={() => removeWorkspace(ws.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="kasm-settings__add-btn" onClick={addWorkspace}>
              + Add Workspace
            </button>
          </div>
        )}

        {section === 'About' && (
          <div className="kasm-settings__section kasm-settings__about">
            <h2>◆ Kasm UI</h2>
            <p>A bleeding-edge React desktop environment</p>
            <div className="kasm-settings__about-grid">
              <span>React</span><span>19.2.4</span>
              <span>TypeScript</span><span>5.9</span>
              <span>Vite</span><span>7.2</span>
              <span>Zustand</span><span>5.0</span>
            </div>
            <h3 style={{ marginTop: 20 }}>Powered by</h3>
            <ul style={{ fontSize: 12, opacity: 0.8, lineHeight: 2 }}>
              <li>Golden Layout - theming system</li>
              <li>rc-dock - docking / tabs / float model</li>
              <li>Re-Flex - constraint-based resizing</li>
              <li>React Desktop - OS-native UI components</li>
              <li>Cinnamon - desktop shell patterns</li>
              <li>ShareJS - collaborative OT engine</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
