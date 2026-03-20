// ============================================================
// App Menu - Cinnamon-style application launcher
// Category sidebar + app grid + fuzzy search
// ============================================================

import { createSignal, createMemo, createEffect, onCleanup, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { desktop, toggleAppMenu, closeAppMenu, createWindow } from '../core/store';
import { appRegistry, appCategories } from '../apps/registry';
import { LiquidGlass } from '../components/LiquidGlass';
import './appMenu.css';

export function AppMenuButton() {
  return (
    <LiquidGlass
      cornerRadius={8}
      padding="0"
      blurAmount={0.04}
      saturation={160}
      displacementScale={30}
      aberrationIntensity={1}
      elasticity={0.08}
      onClick={() => toggleAppMenu()}
      style={{ display: 'inline-flex' }}
    >
      <div
        class={`kasm-panel-btn kasm-app-menu-btn ${desktop.appMenuOpen ? 'kasm-panel-btn--active' : ''}`}
        style={{ background: 'transparent' }}
      >
        <span class="kasm-panel-btn__icon">{'\u25C6'}</span>
        <span>Apps</span>
      </div>
    </LiquidGlass>
  );
}

export function AppMenu() {
  const [search, setSearch] = createSignal('');
  const [activeCategory, setActiveCategory] = createSignal('all');
  let searchRef: HTMLInputElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  // Focus search when menu opens
  createEffect(() => {
    if (desktop.appMenuOpen) {
      setSearch('');
      setActiveCategory('all');
      setTimeout(() => searchRef?.focus(), 50);
    }
  });

  // Close on click outside
  createEffect(() => {
    if (!desktop.appMenuOpen) return;
    const handler = (e: PointerEvent | MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node) &&
          !(e.target as Element)?.closest('.kasm-app-menu-btn')) {
        closeAppMenu();
      }
    };
    document.addEventListener('pointerdown', handler);
    onCleanup(() => document.removeEventListener('pointerdown', handler));
  });

  const filteredApps = createMemo(() => {
    let apps = appRegistry;
    const cat = activeCategory();
    if (cat !== 'all') {
      apps = apps.filter(a => a.category === cat);
    }
    const q = search().trim().toLowerCase();
    if (q) {
      apps = apps.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return apps;
  });

  const handleLaunch = (appId: string) => {
    const app = appRegistry.find(a => a.id === appId);
    if (app) {
      createWindow(app);
      closeAppMenu();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeAppMenu();
  };

  return (
    <Show when={desktop.appMenuOpen}>
      <Portal>
      <div class="kasm-app-menu" ref={menuRef} onKeyDown={handleKeyDown}>
        <div class="kasm-app-menu__search">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search applications..."
            value={search()}
            onInput={e => setSearch(e.currentTarget.value)}
            class="kasm-app-menu__search-input"
          />
        </div>
        <div class="kasm-app-menu__body">
          <div class="kasm-app-menu__categories">
            <button
              class={`kasm-app-menu__category ${activeCategory() === 'all' ? 'kasm-app-menu__category--active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              <span>{'\u229E'}</span> All
            </button>
            <For each={appCategories}>
              {(cat) => (
                <button
                  class={`kasm-app-menu__category ${activeCategory() === cat.id ? 'kasm-app-menu__category--active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span>{cat.icon}</span> {cat.name}
                </button>
              )}
            </For>
          </div>
          <div class="kasm-app-menu__grid">
            <Show when={filteredApps().length === 0}>
              <div class="kasm-app-menu__empty">No applications found</div>
            </Show>
            <For each={filteredApps()}>
              {(app) => (
                <button
                  class="kasm-app-menu__app"
                  onClick={() => handleLaunch(app.id)}
                  title={app.description}
                >
                  <span class="kasm-app-menu__app-icon">{app.icon}</span>
                  <span class="kasm-app-menu__app-name">{app.name}</span>
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="kasm-app-menu__footer">
          <button class="kasm-app-menu__footer-btn" onClick={() => closeAppMenu()}>
            {'\u23FB'} Session
          </button>
        </div>
      </div>
      </Portal>
    </Show>
  );
}
