// ============================================================
// Window Component - Desktop window with title bar
// Combines: React Desktop's Window, rc-dock's DockPanel,
// Cinnamon's window management, Re-Flex's resize constraints
// ============================================================

import { useRef, useCallback, useState, useEffect, memo } from 'react';
import { useDesktopStore } from '../core/store';
import { TitleBar } from './TitleBar';
import { PopoutWindow } from './PopoutWindow';
import {
  detectSnapZone,
  getSnapPreviewStyle,
  getResizeCursor,
  computeResize,
  type ResizeDir,
} from '../lib/windowActions';
import type { WindowState, SnapZone } from '../core/types';
import './window.css';

interface WindowProps {
  win: WindowState;
  children: React.ReactNode;
}

export const Window = memo(function Window({ win, children }: WindowProps) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<ResizeDir | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapZone | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, wx: 0, wy: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const isMaximized = win.state === 'maximized';
  const isMinimized = win.state === 'minimized';

  // --- Drag (title bar) ---
  const onDragStart = useCallback((e: React.MouseEvent) => {
    const { focusWindow, restoreWindow } = useDesktopStore.getState();
    if (isMaximized) {
      // Unmaximize on drag
      restoreWindow(win.id);
      const defaultWidth = 800;
      dragOffset.current = { x: defaultWidth / 2, y: 15 };
    } else {
      dragOffset.current = { x: e.clientX - win.x, y: e.clientY - win.y };
    }
    setDragging(true);
    focusWindow(win.id);
    e.preventDefault();
  }, [win.id, win.x, win.y, isMaximized]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      useDesktopStore.getState().moveWindow(win.id, Math.max(0, x), Math.max(0, y));

      // Snap zone detection (Cinnamon-style edge snapping)
      const zone = detectSnapZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      setSnapPreview(zone);
    };

    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const zone = detectSnapZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      if (zone) {
        useDesktopStore.getState().snapWindow(win.id, zone);
      }
      setSnapPreview(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('kasm-dragging');

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.classList.remove('kasm-dragging');
    };
  }, [dragging, win.id]);

  // --- Resize (Re-Flex constraint-aware) ---
  const onResizeStart = useCallback((dir: ResizeDir, e: React.MouseEvent) => {
    if (!win.resizable) return;
    setResizing(dir);
    resizeStart.current = {
      x: e.clientX, y: e.clientY,
      w: win.width, h: win.height,
      wx: win.x, wy: win.y,
    };
    useDesktopStore.getState().focusWindow(win.id);
    e.preventDefault();
    e.stopPropagation();
  }, [win.id, win.width, win.height, win.x, win.y, win.resizable]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      const s = resizeStart.current;

      const result = computeResize(
        resizing, dx, dy,
        s.wx, s.wy, s.w, s.h,
        win.minWidth, win.minHeight, win.maxWidth, win.maxHeight,
      );

      if (result.x !== s.wx || result.y !== s.wy) {
        useDesktopStore.getState().moveWindow(win.id, result.x, result.y);
      }
      useDesktopStore.getState().resizeWindow(win.id, result.width, result.height);
    };

    const onUp = () => setResizing(null);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    const cursor = getResizeCursor(resizing);
    document.body.style.cursor = cursor;
    document.body.classList.add('kasm-resizing');

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.classList.remove('kasm-resizing');
    };
  }, [resizing, win.id, win.minWidth, win.minHeight, win.maxWidth, win.maxHeight]);

  // Double-click title to maximize/restore
  const onTitleDoubleClick = useCallback(() => {
    const { maximizeWindow, restoreWindow } = useDesktopStore.getState();
    if (isMaximized) {
      restoreWindow(win.id);
    } else {
      maximizeWindow(win.id);
    }
  }, [win.id, isMaximized]);

  if (isMinimized) return null;

  if (poppedOut) {
    // When popped out, render nothing in the main window.
    // The popup is fully independent - no portal, no focus stealing.
    // We only keep a ref to detect when the popup closes.
    return (
      <PopoutWindow
        open
        title={win.title}
        width={win.width}
        height={win.height}
        onClose={() => setPoppedOut(false)}
      >
        {children}
      </PopoutWindow>
    );
  }

  return (
    <>
      {/* Snap preview overlay (Cinnamon) */}
      {snapPreview && dragging && (
        <SnapPreviewOverlay zone={snapPreview} />
      )}

      <div
        ref={windowRef}
        className={`kasm-window ${win.focused ? 'kasm-window--focused' : ''} ${isMaximized ? 'kasm-window--maximized' : ''} ${dragging ? 'kasm-window--dragging' : ''}`}
        style={{
          left: win.x,
          top: win.y,
          width: win.width,
          height: win.height,
          zIndex: win.zIndex,
        }}
        onMouseDown={() => useDesktopStore.getState().focusWindow(win.id)}
      >
        <TitleBar
          win={win}
          onDragStart={onDragStart}
          onDoubleClick={onTitleDoubleClick}
          onPopout={() => setPoppedOut(true)}
        />
        <div className="kasm-window__content">
          {children}
        </div>

        {/* Resize handles (Re-Flex style) */}
        {win.resizable && !isMaximized && (
          <>
            <div className="kasm-window__resize kasm-window__resize--n" onMouseDown={e => onResizeStart('n', e)} />
            <div className="kasm-window__resize kasm-window__resize--s" onMouseDown={e => onResizeStart('s', e)} />
            <div className="kasm-window__resize kasm-window__resize--e" onMouseDown={e => onResizeStart('e', e)} />
            <div className="kasm-window__resize kasm-window__resize--w" onMouseDown={e => onResizeStart('w', e)} />
            <div className="kasm-window__resize kasm-window__resize--ne" onMouseDown={e => onResizeStart('ne', e)} />
            <div className="kasm-window__resize kasm-window__resize--nw" onMouseDown={e => onResizeStart('nw', e)} />
            <div className="kasm-window__resize kasm-window__resize--se" onMouseDown={e => onResizeStart('se', e)} />
            <div className="kasm-window__resize kasm-window__resize--sw" onMouseDown={e => onResizeStart('sw', e)} />
          </>
        )}
      </div>
    </>
  );
});

// Snap preview overlay - uses portable getSnapPreviewStyle from lib
function SnapPreviewOverlay({ zone }: { zone: SnapZone }) {
  const style = getSnapPreviewStyle(zone, 48);
  if (!style) return null;
  return <div className="kasm-snap-preview" style={style as React.CSSProperties} />;
}
