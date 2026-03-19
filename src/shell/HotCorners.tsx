// ============================================================
// HotCorners - 4 screen corner trigger zones
// Each corner triggers a configurable action after 200ms hover
// ============================================================

import type { JSX } from 'solid-js';
import { desktop, setExpoMode, showDesktop, restoreDesktop } from '../core/store';
import type { HotCornerAction } from '../core/store';
import type { WindowState } from '../core/types';
import './hotCorners.css';

const CORNER_SIZE = 8;
const HOVER_DELAY = 200;

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const cornerPositions: Record<Corner, { testId: string; style: JSX.CSSProperties }> = {
  topLeft: {
    testId: 'hot-corner-tl',
    style: { top: '0px', left: '0px' },
  },
  topRight: {
    testId: 'hot-corner-tr',
    style: { top: '0px', right: '0px' },
  },
  bottomLeft: {
    testId: 'hot-corner-bl',
    style: { bottom: '0px', left: '0px' },
  },
  bottomRight: {
    testId: 'hot-corner-br',
    style: { bottom: '0px', right: '0px' },
  },
};

function executeAction(action: HotCornerAction) {
  switch (action) {
    case 'expo':
      setExpoMode(desktop.expoMode === 'expo' ? 'off' : 'expo');
      break;
    case 'scale':
      setExpoMode(desktop.expoMode === 'scale' ? 'off' : 'scale');
      break;
    case 'show-desktop': {
      const activeWs = desktop.workspaces.find(ws => ws.id === desktop.activeWorkspaceId);
      const hasVisible = activeWs && (desktop.windows as WindowState[]).some(
        w => activeWs.windowIds.includes(w.id) && w.state !== 'minimized'
      );
      if (hasVisible) {
        showDesktop();
      } else {
        restoreDesktop();
      }
    }
      break;
    case 'none':
      break;
  }
}

function HotCorner(props: { corner: Corner }) {
  let timerRef: ReturnType<typeof setTimeout> | null = null;
  let flashRef: HTMLDivElement | undefined;

  const onEnter = () => {
    const action = desktop.hotCornerActions[props.corner];
    if (action === 'none') return;
    timerRef = setTimeout(() => {
      executeAction(action);
      if (flashRef) {
        flashRef.classList.add('kasm-hot-corner--flash');
        setTimeout(() => {
          flashRef?.classList.remove('kasm-hot-corner--flash');
        }, 200);
      }
    }, HOVER_DELAY);
  };

  const onLeave = () => {
    if (timerRef) {
      clearTimeout(timerRef);
      timerRef = null;
    }
  };

  const { testId, style } = cornerPositions[props.corner];

  return (
    <div
      ref={flashRef}
      class="kasm-hot-corner"
      data-testid={testId}
      style={{ ...style, width: `${CORNER_SIZE}px`, height: `${CORNER_SIZE}px` }}
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
