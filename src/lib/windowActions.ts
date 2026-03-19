// ============================================================
// Window Actions - Pure, framework-agnostic window management
// logic extracted from React hooks and Zustand slices.
//
// These functions have ZERO framework imports.
// They can be called from React hooks, Solid effects, or tests.
// ============================================================

import type { WindowState, SnapZone } from './types';

// ---- Constants ----
export const CASCADE_OFFSET = 30;

// ---- Snap Zone Detection (Cinnamon-style) ----

/**
 * Given a mouse position and viewport dimensions, determine which
 * snap zone (if any) the cursor is in.
 * Pure function — no DOM access, all dimensions passed in.
 */
export function detectSnapZone(
  mouseX: number,
  mouseY: number,
  viewportW: number,
  viewportH: number,
  threshold = 8,
  cornerSize = 60,
): SnapZone | null {
  const atLeft = mouseX <= threshold;
  const atRight = mouseX >= viewportW - threshold;
  const atTop = mouseY <= threshold;

  if (atTop && atLeft) return 'top-left';
  if (atTop && atRight) return 'top-right';
  if (atTop) return 'maximize';
  if (atLeft && mouseY < cornerSize) return 'top-left';
  if (atLeft && mouseY > viewportH - cornerSize) return 'bottom-left';
  if (atRight && mouseY < cornerSize) return 'top-right';
  if (atRight && mouseY > viewportH - cornerSize) return 'bottom-right';
  if (atLeft) return 'left';
  if (atRight) return 'right';

  return null;
}

// ---- Snap Bounds Calculation ----

/**
 * Compute the pixel bounds for a given snap zone.
 * desktopW/desktopH should be viewport minus panel height.
 */
export function getSnapBounds(
  zone: SnapZone,
  desktopW: number,
  desktopH: number,
): { x: number; y: number; width: number; height: number } {
  switch (zone) {
    case 'left': return { x: 0, y: 0, width: desktopW / 2, height: desktopH };
    case 'right': return { x: desktopW / 2, y: 0, width: desktopW / 2, height: desktopH };
    case 'maximize': return { x: 0, y: 0, width: desktopW, height: desktopH };
    case 'top-left': return { x: 0, y: 0, width: desktopW / 2, height: desktopH / 2 };
    case 'top-right': return { x: desktopW / 2, y: 0, width: desktopW / 2, height: desktopH / 2 };
    case 'bottom-left': return { x: 0, y: desktopH / 2, width: desktopW / 2, height: desktopH / 2 };
    case 'bottom-right': return { x: desktopW / 2, y: desktopH / 2, width: desktopW / 2, height: desktopH / 2 };
    default: return { x: 0, y: 0, width: desktopW, height: desktopH };
  }
}

// ---- Snap Preview Styles ----

export function getSnapPreviewStyle(
  zone: SnapZone | null,
  panelH: number,
): { left?: number; right?: number; top?: number; bottom?: number; width?: string; height?: string } | null {
  if (!zone) return null;
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

// ---- Resize ----

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function getResizeCursor(dir: ResizeDir | null): string {
  switch (dir) {
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'nw': case 'se': return 'nwse-resize';
    default: return '';
  }
}

/**
 * Compute new window geometry during a resize operation.
 * Returns { x, y, width, height } with constraints applied.
 * Pure function — no DOM, no state mutation.
 */
export function computeResize(
  dir: ResizeDir,
  dx: number,
  dy: number,
  startX: number,
  startY: number,
  startW: number,
  startH: number,
  minW: number,
  minH: number,
  maxW?: number,
  maxH?: number,
): { x: number; y: number; width: number; height: number } {
  let newW = startW, newH = startH, newX = startX, newY = startY;

  if (dir.includes('e')) newW = startW + dx;
  if (dir.includes('w')) { newW = startW - dx; newX = startX + dx; }
  if (dir.includes('s')) newH = startH + dy;
  if (dir.includes('n')) { newH = startH - dy; newY = startY + dy; }

  // Apply constraints
  newW = Math.max(minW, Math.min(newW, maxW ?? Infinity));
  newH = Math.max(minH, Math.min(newH, maxH ?? Infinity));
  newX = Math.max(0, newX);
  newY = Math.max(0, newY);

  return { x: newX, y: newY, width: newW, height: newH };
}

// ---- State Mutations (pure transforms on WindowState[]) ----
//
// Two flavors:
//   apply*  — immutable, returns new array (Zustand / React setState)
//   draft*  — mutating, modifies items in-place (Solid 2.0 produce-style stores)
//
// Both flavors call the same internal helper via `findAndPatch`.

/** Find window by id, apply patch. Immutable version (returns new array). */
function findAndPatch(
  windows: WindowState[],
  id: string,
  patch: (w: WindowState) => Partial<WindowState>,
): WindowState[] {
  return windows.map(w => (w.id === id ? { ...w, ...patch(w) } : w));
}

/** Find window by id, apply patch. Draft/mutating version (Solid 2.0 stores). */
function findAndMutate(
  windows: WindowState[],
  id: string,
  mutate: (w: WindowState) => void,
): void {
  const w = windows.find(w => w.id === id);
  if (w) mutate(w);
}

// ---- Immutable (Zustand / React) ----

export function applyFocusWindow(
  windows: WindowState[],
  id: string,
  nextZIndex: number,
): WindowState[] {
  return windows.map(w => ({
    ...w,
    focused: w.id === id,
    zIndex: w.id === id ? nextZIndex : w.zIndex,
    state: w.id === id && w.state === 'minimized' ? 'normal' as const : w.state,
  }));
}

export function applyMoveWindow(
  windows: WindowState[],
  id: string,
  x: number,
  y: number,
): WindowState[] {
  return findAndPatch(windows, id, () => ({ x, y, state: 'normal' as const }));
}

export function applyResizeWindow(
  windows: WindowState[],
  id: string,
  width: number,
  height: number,
): WindowState[] {
  return findAndPatch(windows, id, (w) => ({
    width: Math.max(w.minWidth, Math.min(width, w.maxWidth ?? Infinity)),
    height: Math.max(w.minHeight, Math.min(height, w.maxHeight ?? Infinity)),
  }));
}

export function applySnapWindow(
  windows: WindowState[],
  id: string,
  zone: SnapZone,
  desktopW: number,
  desktopH: number,
): WindowState[] {
  const bounds = getSnapBounds(zone, desktopW, desktopH);
  const state = zone === 'maximize'
    ? 'maximized' as const
    : `snapped-${zone}` as WindowState['state'];
  return findAndPatch(windows, id, () => ({ state, ...bounds }));
}

export function applyMinimizeWindow(
  windows: WindowState[],
  id: string,
): WindowState[] {
  return findAndPatch(windows, id, () => ({ state: 'minimized' as const, focused: false }));
}

export function applyMaximizeWindow(
  windows: WindowState[],
  id: string,
  desktopW: number,
  desktopH: number,
): WindowState[] {
  const bounds = getSnapBounds('maximize', desktopW, desktopH);
  return findAndPatch(windows, id, () => ({ state: 'maximized' as const, ...bounds }));
}

export function applyRestoreWindow(
  windows: WindowState[],
  id: string,
): WindowState[] {
  return findAndPatch(windows, id, () => ({ state: 'normal' as const }));
}

export function applyUpdateWindowTitle(
  windows: WindowState[],
  id: string,
  title: string,
): WindowState[] {
  return findAndPatch(windows, id, () => ({ title }));
}

// ---- Draft / Mutating (Solid 2.0 produce-style stores) ----
//
// Usage with Solid 2.0:
//   setStore(s => { draftFocusWindow(s.windows, id, nextZ) })
//
// These mutate the array items in-place, which is exactly what
// Solid 2.0's draft-based setStore expects.

export function draftFocusWindow(
  windows: WindowState[],
  id: string,
  nextZIndex: number,
): void {
  for (const w of windows) {
    w.focused = w.id === id;
    if (w.id === id) {
      w.zIndex = nextZIndex;
      if (w.state === 'minimized') w.state = 'normal';
    }
  }
}

export function draftMoveWindow(
  windows: WindowState[],
  id: string,
  x: number,
  y: number,
): void {
  findAndMutate(windows, id, w => { w.x = x; w.y = y; w.state = 'normal'; });
}

export function draftResizeWindow(
  windows: WindowState[],
  id: string,
  width: number,
  height: number,
): void {
  findAndMutate(windows, id, w => {
    w.width = Math.max(w.minWidth, Math.min(width, w.maxWidth ?? Infinity));
    w.height = Math.max(w.minHeight, Math.min(height, w.maxHeight ?? Infinity));
  });
}

export function draftSnapWindow(
  windows: WindowState[],
  id: string,
  zone: SnapZone,
  desktopW: number,
  desktopH: number,
): void {
  const bounds = getSnapBounds(zone, desktopW, desktopH);
  const state = zone === 'maximize'
    ? 'maximized' as const
    : `snapped-${zone}` as WindowState['state'];
  findAndMutate(windows, id, w => {
    w.state = state; w.x = bounds.x; w.y = bounds.y;
    w.width = bounds.width; w.height = bounds.height;
  });
}

export function draftMinimizeWindow(windows: WindowState[], id: string): void {
  findAndMutate(windows, id, w => { w.state = 'minimized'; w.focused = false; });
}

export function draftMaximizeWindow(
  windows: WindowState[],
  id: string,
  desktopW: number,
  desktopH: number,
): void {
  const bounds = getSnapBounds('maximize', desktopW, desktopH);
  findAndMutate(windows, id, w => {
    w.state = 'maximized'; w.x = bounds.x; w.y = bounds.y;
    w.width = bounds.width; w.height = bounds.height;
  });
}

export function draftRestoreWindow(windows: WindowState[], id: string): void {
  findAndMutate(windows, id, w => { w.state = 'normal'; });
}

export function draftUpdateWindowTitle(windows: WindowState[], id: string, title: string): void {
  findAndMutate(windows, id, w => { w.title = title; });
}
