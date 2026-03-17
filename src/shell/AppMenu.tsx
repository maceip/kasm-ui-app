// ============================================================
// App Menu - Cinnamon-style application launcher
// Category sidebar + app grid + fuzzy search
// ============================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { useDesktopStore } from '../core/store';
import { appRegistry, appCategories } from '../apps/registry';
import { LiquidGlass } from '../components/LiquidGlass';
import './appMenu.css';

export function AppMenuButton() {
  const appMenuOpen = useDesktopStore(s => s.appMenuOpen);
  const toggleAppMenu = useDesktopStore(s => s.toggleAppMenu);

  return (
    <LiquidGlass
      cornerRadius={8}
      padding="0"
      blurAmount={0.04}
      saturation={160}
      displacementScale={30}
      aberrationIntensity={1}
      elasticity={0.08}
      onClick={toggleAppMenu}
      style={{ display: 'inline-flex' }}
    >
      <div
        className={`kasm-panel-btn kasm-app-menu-btn ${appMenuOpen ? 'kasm-panel-btn--active' : ''}`}
        style={{ background: 'transparent' }}
      >
        <span className="kasm-panel-btn__icon">{'\u25C6'}</span>
        <span>Apps</span>
      </div>
    </LiquidGlass>
  );
}

export function AppMenu() {
  const appMenuOpen = useDesktopStore(s => s.appMenuOpen);
  const closeAppMenu = useDesktopStore(s => s.closeAppMenu);
  const createWindow = useDesktopStore(s => s.createWindow);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (appMenuOpen) {
      setSearch('');
      setActiveCategory('all');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [appMenuOpen]);

  // Close on click outside
  useEffect(() => {
    if (!appMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          !(e.target as Element)?.closest('.kasm-app-menu-btn')) {
        closeAppMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [appMenuOpen, closeAppMenu]);

  const filteredApps = useMemo(() => {
    let apps = appRegistry;
    if (activeCategory !== 'all') {
      apps = apps.filter(a => a.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      apps = apps.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return apps;
  }, [search, activeCategory]);

  const handleLaunch = (appId: string) => {
    const app = appRegistry.find(a => a.id === appId);
    if (app) {
      createWindow(app);
      closeAppMenu();
    }
  };

  // Keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeAppMenu();
  };

  if (!appMenuOpen) return null;

  return (
    <div className="kasm-app-menu" ref={menuRef} onKeyDown={handleKeyDown}>
      <div className="kasm-app-menu__search">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search applications..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="kasm-app-menu__search-input"
        />
      </div>
      <div className="kasm-app-menu__body">
        <div className="kasm-app-menu__categories">
          <button
            className={`kasm-app-menu__category ${activeCategory === 'all' ? 'kasm-app-menu__category--active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <span>⊞</span> All
          </button>
          {appCategories.map(cat => (
            <button
              key={cat.id}
              className={`kasm-app-menu__category ${activeCategory === cat.id ? 'kasm-app-menu__category--active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span>{cat.icon}</span> {cat.name}
            </button>
          ))}
        </div>
        <div className="kasm-app-menu__grid">
          {filteredApps.length === 0 && (
            <div className="kasm-app-menu__empty">No applications found</div>
          )}
          {filteredApps.map(app => (
            <button
              key={app.id}
              className="kasm-app-menu__app"
              onClick={() => handleLaunch(app.id)}
              title={app.description}
            >
              <span className="kasm-app-menu__app-icon">{app.icon}</span>
              <span className="kasm-app-menu__app-name">{app.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="kasm-app-menu__footer">
        <button className="kasm-app-menu__footer-btn" onClick={closeAppMenu}>
          ⏻ Session
        </button>
      </div>
    </div>
  );
}
