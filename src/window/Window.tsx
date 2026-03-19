// ============================================================
// Window Component - Desktop window with title bar
// SolidJS port: signals + createEffect for drag/resize
// ============================================================

import { createSignal, createEffect, onCleanup, Show, type JSX } from 'solid-js';
import { focusWindow, moveWindow, resizeWindow as resizeWin, snapWindow, maximizeWindow, restoreWindow, minimizeWindow } from '../core/store';
import { TitleBar } from './TitleBar';
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
  children: JSX.Element;
}

export function Window(props: WindowProps) {
  const [poppedOut, setPoppedOut] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  const [resizing, setResizing] = createSignal<ResizeDir | null>(null);
  const [snapPreview, setSnapPreview] = createSignal<SnapZone | null>(null);
  let dragOffset = { x: 0, y: 0 };
  let resizeStart = { x: 0, y: 0, w: 0, h: 0, wx: 0, wy: 0 };
  let windowRef: HTMLDivElement | undefined;

  const isMaximized = () => props.win.state === 'maximized';
  const isMinimized = () => props.win.state === 'minimized';

  // --- Drag start ---
  const onDragStart = (e: MouseEvent) => {
    if (isMaximized()) {
      restoreWindow(props.win.id);
      dragOffset = { x: 400, y: 15 };
    } else {
      dragOffset = { x: e.clientX - props.win.x, y: e.clientY - props.win.y };
    }
    setDragging(true);
    focusWindow(props.win.id);
    e.preventDefault();
  };

  // --- Drag effect ---
  createEffect(() => {
    if (!dragging()) return;

    const onMove = (e: MouseEvent) => {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      moveWindow(props.win.id, Math.max(0, x), Math.max(0, y));
      const zone = detectSnapZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      setSnapPreview(zone);
    };

    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const zone = detectSnapZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      if (zone) {
        snapWindow(props.win.id, zone);
      }
      setSnapPreview(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('kasm-dragging');

    onCleanup(() => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.classList.remove('kasm-dragging');
    });
  });

  // --- Resize start ---
  const onResizeStart = (dir: ResizeDir, e: MouseEvent) => {
    if (!props.win.resizable) return;
    setResizing(dir);
    resizeStart = {
      x: e.clientX, y: e.clientY,
      w: props.win.width, h: props.win.height,
      wx: props.win.x, wy: props.win.y,
    };
    focusWindow(props.win.id);
    e.preventDefault();
    e.stopPropagation();
  };

  // --- Resize effect ---
  createEffect(() => {
    const dir = resizing();
    if (!dir) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      const s = resizeStart;

      const result = computeResize(
        dir, dx, dy,
        s.wx, s.wy, s.w, s.h,
        props.win.minWidth, props.win.minHeight, props.win.maxWidth, props.win.maxHeight,
      );

      if (result.x !== s.wx || result.y !== s.wy) {
        moveWindow(props.win.id, result.x, result.y);
      }
      resizeWin(props.win.id, result.width, result.height);
    };

    const onUp = () => setResizing(null);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    const cursor = getResizeCursor(dir);
    document.body.style.cursor = cursor;
    document.body.classList.add('kasm-resizing');

    onCleanup(() => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.classList.remove('kasm-resizing');
    });
  });

  const onTitleDoubleClick = () => {
    if (isMaximized()) {
      restoreWindow(props.win.id);
    } else {
      maximizeWindow(props.win.id);
    }
  };

  // Pop out to new tab
  const handlePopout = () => {
    // Open in a new browser tab instead of a popup window
    const url = `${window.location.origin}${window.location.pathname}?popout=${props.win.appId}&windowId=${props.win.id}`;
    window.open(url, '_blank');
  };

  return (
    <Show when={!isMinimized()}>
      <Show when={!poppedOut()} fallback={null}>
        <>
          <Show when={snapPreview() && dragging()}>
            <SnapPreviewOverlay zone={snapPreview()!} />
          </Show>

          <div
            ref={windowRef}
            class={`kasm-window ${props.win.focused ? 'kasm-window--focused' : ''} ${isMaximized() ? 'kasm-window--maximized' : ''} ${dragging() ? 'kasm-window--dragging' : ''}`}
            style={{
              left: `${props.win.x}px`,
              top: `${props.win.y}px`,
              width: `${props.win.width}px`,
              height: `${props.win.height}px`,
              "z-index": props.win.zIndex,
            }}
            onMouseDown={() => focusWindow(props.win.id)}
          >
            <TitleBar
              win={props.win}
              onDragStart={onDragStart}
              onDoubleClick={onTitleDoubleClick}
              onPopout={handlePopout}
            />
            <div class="kasm-window__content">
              {props.children}
            </div>

            <Show when={props.win.resizable && !isMaximized()}>
              <div class="kasm-window__resize kasm-window__resize--n" onMouseDown={e => onResizeStart('n', e)} />
              <div class="kasm-window__resize kasm-window__resize--s" onMouseDown={e => onResizeStart('s', e)} />
              <div class="kasm-window__resize kasm-window__resize--e" onMouseDown={e => onResizeStart('e', e)} />
              <div class="kasm-window__resize kasm-window__resize--w" onMouseDown={e => onResizeStart('w', e)} />
              <div class="kasm-window__resize kasm-window__resize--ne" onMouseDown={e => onResizeStart('ne', e)} />
              <div class="kasm-window__resize kasm-window__resize--nw" onMouseDown={e => onResizeStart('nw', e)} />
              <div class="kasm-window__resize kasm-window__resize--se" onMouseDown={e => onResizeStart('se', e)} />
              <div class="kasm-window__resize kasm-window__resize--sw" onMouseDown={e => onResizeStart('sw', e)} />
            </Show>
          </div>
        </>
      </Show>
    </Show>
  );
}

function SnapPreviewOverlay(props: { zone: SnapZone }) {
  const style = () => getSnapPreviewStyle(props.zone, 48);
  return (
    <Show when={style()}>
      <div class="kasm-snap-preview" style={style() as JSX.CSSProperties} />
    </Show>
  );
}
