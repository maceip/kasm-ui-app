// ============================================================
// HotCorners - 4 screen corner trigger zones
// Each corner triggers a configurable action after 200ms hover
// ============================================================

import { useRef, useCallback } from 'react';
import { useDesktopStore } from '../core/store';
import type { HotCornerAction } from '../core/store';
import './hotCorners.css';

const CORNER_SIZE = 8;
const HOVER_DELAY = 200;

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const cornerPositions: Record<Corner, { testId: string; style: React.CSSProperties }> = {
  topLeft: {
    testId: 'hot-corner-tl',
    style: { top: 0, left: 0 },
  },
  topRight: {
    testId: 'hot-corner-tr',
    style: { top: 0, right: 0 },
  },
  bottomLeft: {
    testId: 'hot-corner-bl',
    style: { bottom: 0, left: 0 },
  },
  bottomRight: {
    testId: 'hot-corner-br',
    style: { bottom: 0, right: 0 },
  },
};

function executeAction(action: HotCornerAction) {
  const store = useDesktopStore.getState();
  switch (action) {
    case 'expo':
      store.setExpoMode(store.expoMode === 'expo' ? 'off' : 'expo');
      break;
    case 'scale':
      store.setExpoMode(store.expoMode === 'scale' ? 'off' : 'scale');
      break;
    case 'show-desktop': {
      const activeWs = store.workspaces.find(ws => ws.id === store.activeWorkspaceId);
      const hasVisible = activeWs && store.windows.some(
        w => activeWs.windowIds.includes(w.id) && w.state !== 'minimized'
      );
      if (hasVisible) {
        store.showDesktop();
      } else {
        store.restoreDesktop();
      }
    }
      break;
    case 'none':
      break;
  }
}

function HotCorner({ corner }: { corner: Corner }) {
  const action = useDesktopStore(s => s.hotCornerActions[corner]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const onEnter = useCallback(() => {
    if (action === 'none') return;
    timerRef.current = setTimeout(() => {
      executeAction(action);
      // Visual flash feedback
      if (flashRef.current) {
        flashRef.current.classList.add('kasm-hot-corner--flash');
        setTimeout(() => {
          flashRef.current?.classList.remove('kasm-hot-corner--flash');
        }, 200);
      }
    }, HOVER_DELAY);
  }, [action]);

  const onLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const { testId, style } = cornerPositions[corner];

  return (
    <div
      ref={flashRef}
      className="kasm-hot-corner"
      data-testid={testId}
      style={{ ...style, width: CORNER_SIZE, height: CORNER_SIZE }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    />
  );
}

export function HotCorners() {
  return (
    <>
      <HotCorner corner="topLeft" />
      <HotCorner corner="topRight" />
      <HotCorner corner="bottomLeft" />
      <HotCorner corner="bottomRight" />
    </>
  );
}
