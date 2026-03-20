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

// ---- Legacy apply*/draft* functions removed ----
// State mutations are now handled directly in src/core/store.ts
// using granular SolidJS path-based setState calls.
// e.g. setState('windows', idx, 'x', newX) instead of
// setState('windows', applyMoveWindow(state.windows, id, x, y))
