// ============================================================
// Window Component - Desktop window with title bar
// Combines: React Desktop's Window, rc-dock's DockPanel,
// Cinnamon's window management, Re-Flex's resize constraints
// ============================================================

import { useRef, useCallback, useState, useEffect, memo } from 'react';
import { useDesktopStore } from '../core/store';
import { TitleBar } from './TitleBar';
import { PopoutWindow } from './PopoutWindow';
import type { WindowState, SnapZone } from '../core/types';
import './window.css';

interface WindowProps {
  win: WindowState;
  children: React.ReactNode;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export const Window = memo(function Window({ win, children }: WindowProps) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<ResizeDir>(null);
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
      const zone = detectSnapZone(e.clientX, e.clientY);
      setSnapPreview(zone);
    };

    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const zone = detectSnapZone(e.clientX, e.clientY);
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
      let newW = s.w, newH = s.h, newX = s.wx, newY = s.wy;

      if (resizing.includes('e')) newW = s.w + dx;
      if (resizing.includes('w')) { newW = s.w - dx; newX = s.wx + dx; }
      if (resizing.includes('s')) newH = s.h + dy;
      if (resizing.includes('n')) { newH = s.h - dy; newY = s.wy + dy; }

      // Re-Flex style constraints
      newW = Math.max(win.minWidth, Math.min(newW, win.maxWidth ?? Infinity));
      newH = Math.max(win.minHeight, Math.min(newH, win.maxHeight ?? Infinity));

      if (newX !== s.wx || newY !== s.wy) {
        useDesktopStore.getState().moveWindow(win.id, Math.max(0, newX), Math.max(0, newY));
      }
      useDesktopStore.getState().resizeWindow(win.id, newW, newH);
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

// Cinnamon snap zone detection
function detectSnapZone(mouseX: number, mouseY: number): SnapZone {
  const threshold = 8;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cornerSize = 60;

  const atLeft = mouseX <= threshold;
  const atRight = mouseX >= w - threshold;
  const atTop = mouseY <= threshold;

  if (atTop && atLeft) return 'top-left';
  if (atTop && atRight) return 'top-right';
  if (atTop) return 'maximize';
  if (atLeft && mouseY < cornerSize) return 'top-left';
  if (atLeft && mouseY > h - cornerSize) return 'bottom-left';
  if (atRight && mouseY < cornerSize) return 'top-right';
  if (atRight && mouseY > h - cornerSize) return 'bottom-right';
  if (atLeft) return 'left';
  if (atRight) return 'right';

  return null;
}

function SnapPreviewOverlay({ zone }: { zone: SnapZone }) {
  const style = getSnapPreviewStyle(zone);
  if (!style) return null;

  return (
    <div className="kasm-snap-preview" style={style} />
  );
}

function getSnapPreviewStyle(zone: SnapZone): React.CSSProperties | null {
  const panelH = 48;
  switch (zone) {
    case 'left':
      return { left: 0, top: 0, width: '50%', bottom: panelH };
    case 'right':
      return { right: 0, top: 0, width: '50%', bottom: panelH };
    case 'maximize':
      return { left: 0, top: 0, right: 0, bottom: panelH };
    case 'top-left':
      return { left: 0, top: 0, width: '50%', height: `calc(50% - ${panelH / 2}px)` };
    case 'top-right':
      return { right: 0, top: 0, width: '50%', height: `calc(50% - ${panelH / 2}px)` };
    case 'bottom-left':
      return { left: 0, bottom: panelH, width: '50%', height: `calc(50% - ${panelH / 2}px)` };
    case 'bottom-right':
      return { right: 0, bottom: panelH, width: '50%', height: `calc(50% - ${panelH / 2}px)` };
    default:
      return null;
  }
}

function getResizeCursor(dir: ResizeDir): string {
  switch (dir) {
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'nw': case 'se': return 'nwse-resize';
    default: return '';
  }
}
