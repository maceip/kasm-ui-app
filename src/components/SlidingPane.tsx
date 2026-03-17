// ============================================================
// SlidingPane - Animated slide-in panel from any edge
// Based on react-sliding-pane patterns, adapted for Kasm UI
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SlidingPaneProps {
  isOpen: boolean;
  from?: 'left' | 'right' | 'bottom';
  width?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
  shouldCloseOnEsc?: boolean;
  shouldCloseOnOverlay?: boolean;
  onRequestClose: () => void;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

const TRANSITION_MS = 300;

export function SlidingPane({
  isOpen,
  from = 'right',
  width = '400px',
  title,
  subtitle,
  children,
  className = '',
  hideHeader = false,
  shouldCloseOnEsc = true,
  shouldCloseOnOverlay = true,
  onRequestClose,
  onAfterOpen,
  onAfterClose,
}: SlidingPaneProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Open animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        if (isMounted.current) setAnimating(true);
      });
      const timer = setTimeout(() => onAfterOpen?.(), TRANSITION_MS);
      return () => clearTimeout(timer);
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setVisible(false);
          onAfterClose?.();
        }
      }, TRANSITION_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key
  useEffect(() => {
    if (!isOpen || !shouldCloseOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, shouldCloseOnEsc, onRequestClose]);

  if (!visible) return null;

  const transforms: Record<string, { closed: string; open: string }> = {
    right: { closed: 'translateX(100%)', open: 'translateX(0)' },
    left: { closed: 'translateX(-100%)', open: 'translateX(0)' },
    bottom: { closed: 'translateY(100%)', open: 'translateY(0)' },
  };

  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10003,
    ...(from === 'right' ? { top: 0, right: 0, bottom: 48, width } : {}),
    ...(from === 'left' ? { top: 0, left: 0, bottom: 48, width } : {}),
    ...(from === 'bottom' ? { left: 0, right: 0, bottom: 0, height: width } : {}),
    transform: animating ? transforms[from].open : transforms[from].closed,
    transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
    background: 'var(--kasm-surface-bg)',
    borderLeft: from === 'right' ? '1px solid var(--kasm-surface-border)' : undefined,
    borderRight: from === 'left' ? '1px solid var(--kasm-surface-border)' : undefined,
    borderTop: from === 'bottom' ? '1px solid var(--kasm-surface-border)' : undefined,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0,0,0,0.3)',
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10002,
          background: 'rgba(0,0,0,0.3)',
          opacity: animating ? 1 : 0,
          transition: `opacity ${TRANSITION_MS}ms ease`,
          pointerEvents: animating ? 'auto' : 'none',
        }}
        onClick={shouldCloseOnOverlay ? onRequestClose : undefined}
      />

      {/* Pane */}
      <div className={`kasm-sliding-pane ${className}`} style={positionStyle}>
        {!hideHeader && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--kasm-surface-border)',
            flexShrink: 0,
          }}>
            <div>
              {title && <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--kasm-surface-text)' }}>{title}</div>}
              {subtitle && <div style={{ fontSize: 11, color: 'var(--kasm-text-muted)', marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button
              onClick={onRequestClose}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--kasm-surface-text)',
                fontSize: 16,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 4,
              }}
            >
              {'\u2715'}
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </>
  );
}
