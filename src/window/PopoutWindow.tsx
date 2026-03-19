// ============================================================
// PopoutWindow - Golden Layout browser popout system
// Renders children in a new browser window via window.open()
// Uses React portal + stylesheet copying for seamless rendering
// ============================================================

import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { copyStylesheets } from '../lib/domUtils';
import './PopoutWindow.css';

// Memo boundary prevents unrelated parent re-renders from
// reconciling the portal DOM, which would steal popup focus.
// SOLID 2.0: Not needed — Solid components don't re-render.
// The Solid port uses render() to mount into the popup, not a portal.
const PopoutContent = memo(function PopoutContent({ children }: { children: React.ReactNode }) {
  return <div className="kasm-popout-container">{children}</div>;
});

// ============================================================
// Types
// ============================================================

interface PopoutWindowProps {
  /** Whether the popout window is open */
  open: boolean;
  /** Window title */
  title?: string;
  /** Window dimensions */
  width?: number;
  height?: number;
  /** Window position (screen coordinates) */
  left?: number;
  top?: number;
  /** Called when the popup window is closed (by user or programmatically) */
  onClose: () => void;
  /** Called when popup is blocked by browser */
  onBlock?: () => void;
  /** Called after the popup window successfully opens */
  onOpen?: (popupWindow: Window) => void;
  /** Whether to close the popup when the parent component unmounts (default: true) */
  closeOnUnmount?: boolean;
  /** Whether to copy stylesheets from parent to popup (default: true) */
  copyStyles?: boolean;
  /** Children to render inside the popout window */
  children: React.ReactNode;
  /** Additional window features string */
  features?: string;
}

interface PopoutButtonProps {
  /** Called when the popout button is clicked */
  onClick: () => void;
  /** Button title/tooltip */
  title?: string;
  className?: string;
}

// ============================================================
// PopoutWindow component
// NOTE: This component uses React's createPortal — the hardest
// pattern to port to SolidJS. See MIGRATION.md for strategy.
// ============================================================

export function PopoutWindow({
  open,
  title = '',
  width = 800,
  height = 600,
  left,
  top,
  onClose,
  onBlock,
  onOpen,
  closeOnUnmount = true,
  copyStyles: shouldCopyStyles = true,
  children,
  features: extraFeatures,
}: PopoutWindowProps) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const popupRef = useRef<Window | null>(null);
  const closeCheckInterval = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Stable refs so the popup effect doesn't re-run on every parent render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  // Track mount state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Clean up on unmount or close — no useCallback (stable in Solid)
  const cleanup = (shouldClose = true) => {
    if (closeCheckInterval.current !== null) {
      clearInterval(closeCheckInterval.current);
      closeCheckInterval.current = null;
    }
    if (shouldClose && popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    if (isMountedRef.current) setContainerEl(null);
  };

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    // Center relative to parent window
    const parentLeft = window.screenLeft ?? window.screenX ?? 0;
    const parentTop = window.screenTop ?? window.screenY ?? 0;
    const screenLeft = left ?? Math.round(parentLeft + (window.outerWidth - width) / 2);
    const screenTop = top ?? Math.round(parentTop + (window.outerHeight - height) / 2);

    const featuresList = [
      `width=${width}`,
      `height=${height}`,
      `left=${screenLeft}`,
      `top=${screenTop}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes',
    ];

    if (extraFeatures) {
      featuresList.push(extraFeatures);
    }

    const popup = window.open('', '', featuresList.join(','));
    if (!popup) {
      if (onBlockRef.current) {
        onBlockRef.current();
      } else {
        console.warn('PopoutWindow: Popup blocked by browser.');
      }
      onCloseRef.current();
      return;
    }

    popupRef.current = popup;

    // Set up the popup document
    popup.document.title = title;

    // Create a container div in the popup body
    const container = popup.document.createElement('div');
    container.id = 'kasm-popout-root';
    container.className = 'kasm-popout-root';
    popup.document.body.appendChild(container);

    // Reset popup body styles
    popup.document.body.style.margin = '0';
    popup.document.body.style.padding = '0';
    popup.document.body.style.overflow = 'hidden';

    // Copy all stylesheets from parent to popup
    if (shouldCopyStyles) {
      copyStylesheets(document, popup.document);
    }

    if (isMountedRef.current) setContainerEl(container);

    // Notify caller the popup is open
    onOpenRef.current?.(popup);

    // Handle popup window close via beforeunload
    const handleUnload = () => {
      onCloseRef.current();
    };
    popup.addEventListener('beforeunload', handleUnload);

    // Poll for popup close (50ms for responsiveness, like react-new-window)
    closeCheckInterval.current = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        onCloseRef.current();
      }
    }, 50);

    return () => {
      popup.removeEventListener('beforeunload', handleUnload);
      cleanup(closeOnUnmount);
    };
    // Only re-run when `open` changes. Title updates handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cleanup]);

  // Update title when it changes
  useEffect(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.document.title = title;
    }
  }, [title]);

  // Render children into the popup via portal.
  // Key: wrap in a memo boundary so unrelated parent re-renders
  // don't cause the portal to reconcile and steal popup focus.
  if (!containerEl || !open) return null;

  return createPortal(
    <PopoutContent>{children}</PopoutContent>,
    containerEl,
  );
}

// ============================================================
// PopoutButton - trigger component for popout from title bars
// ============================================================

export function PopoutButton({
  onClick,
  title = 'Open in new window',
  className = '',
}: PopoutButtonProps) {
  return (
    <button
      className={`kasm-popout-btn ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
    >
      {/* External window icon (Unicode box with arrow) */}
      <svg
        className="kasm-popout-btn__icon"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 1h3v3" />
        <path d="M13 1L7 7" />
        <path d="M11 8v4a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1h4" />
      </svg>
    </button>
  );
}
