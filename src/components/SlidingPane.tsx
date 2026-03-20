// ============================================================
// SlidingPane - Animated slide-in panel from any edge
// SolidJS port
// ============================================================

import { createSignal, createEffect, onCleanup, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

export interface SlidingPaneProps {
  isOpen: boolean;
  from?: 'left' | 'right' | 'bottom';
  width?: string;
  title?: JSX.Element;
  subtitle?: JSX.Element;
  children: JSX.Element;
  className?: string;
  hideHeader?: boolean;
  shouldCloseOnEsc?: boolean;
  shouldCloseOnOverlay?: boolean;
  onRequestClose: () => void;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

const TRANSITION_MS = 300;

export function SlidingPane(props: SlidingPaneProps) {
  const from = () => props.from ?? 'right';
  const width = () => props.width ?? '400px';
  const shouldCloseOnEsc = () => props.shouldCloseOnEsc ?? true;
  const shouldCloseOnOverlay = () => props.shouldCloseOnOverlay ?? true;

  const [visible, setVisible] = createSignal(false);
  const [animating, setAnimating] = createSignal(false);

  // Open/close animation
  createEffect(() => {
    if (props.isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
      const timer = setTimeout(() => props.onAfterOpen?.(), TRANSITION_MS);
      onCleanup(() => clearTimeout(timer));
    } else if (visible()) {
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
        props.onAfterClose?.();
      }, TRANSITION_MS);
      onCleanup(() => clearTimeout(timer));
    }
  });

  // Escape key
  createEffect(() => {
    if (!props.isOpen || !shouldCloseOnEsc()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onRequestClose();
    };
    window.addEventListener('keydown', handler);
    onCleanup(() => window.removeEventListener('keydown', handler));
  });

  const transforms: Record<string, { closed: string; open: string }> = {
    right: { closed: 'translateX(100%)', open: 'translateX(0)' },
    left: { closed: 'translateX(-100%)', open: 'translateX(0)' },
    bottom: { closed: 'translateY(100%)', open: 'translateY(0)' },
  };

  const positionStyle = (): JSX.CSSProperties => {
    const f = from();
    const w = width();
    return {
      position: 'fixed',
      "z-index": 10003,
      ...(f === 'right' ? { top: '0', right: '0', bottom: '48px', width: w } : {}),
      ...(f === 'left' ? { top: '0', left: '0', bottom: '48px', width: w } : {}),
      ...(f === 'bottom' ? { left: '0', right: '0', bottom: '0', height: w } : {}),
      transform: animating() ? transforms[f].open : transforms[f].closed,
      transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
      background: 'var(--kasm-surface-bg)',
      "border-left": f === 'right' ? '1px solid var(--kasm-surface-border)' : undefined,
      "border-right": f === 'left' ? '1px solid var(--kasm-surface-border)' : undefined,
      "border-top": f === 'bottom' ? '1px solid var(--kasm-surface-border)' : undefined,
      display: 'flex',
      "flex-direction": 'column',
      overflow: 'hidden',
      "box-shadow": '0 0 40px rgba(0,0,0,0.3)',
    };
  };

  return (
    <Show when={visible()}>
      <Portal>
        <div
          style={{
            position: 'fixed',
            inset: '0',
            "z-index": 10002,
            background: 'rgba(0,0,0,0.3)',
            opacity: animating() ? 1 : 0,
            transition: `opacity ${TRANSITION_MS}ms ease`,
            "pointer-events": animating() ? 'auto' : 'none',
          }}
          onClick={shouldCloseOnOverlay() ? () => props.onRequestClose() : undefined}
        />

        <div class={`kasm-sliding-pane ${props.className || ''}`} style={positionStyle()}>
          <Show when={!props.hideHeader}>
            <div style={{
              display: 'flex',
              "align-items": 'center',
              "justify-content": 'space-between',
              padding: '12px 16px',
              "border-bottom": '1px solid var(--kasm-surface-border)',
              "flex-shrink": 0,
            }}>
              <div>
                <Show when={props.title}>
                  <div style={{ "font-weight": 600, "font-size": '14px', color: 'var(--kasm-surface-text)' }}>{props.title}</div>
                </Show>
                <Show when={props.subtitle}>
                  <div style={{ "font-size": '11px', color: 'var(--kasm-text-muted)', "margin-top": '2px' }}>{props.subtitle}</div>
                </Show>
              </div>
              <button
                onClick={() => props.onRequestClose()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--kasm-surface-text)',
                  "font-size": '16px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  "border-radius": '4px',
                }}
              >
                {'\u2715'}
              </button>
            </div>
          </Show>
          <div style={{ flex: 1, overflow: 'auto', "min-height": '0' }}>
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}
