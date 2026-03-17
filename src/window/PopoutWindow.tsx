// ============================================================
// PopoutWindow - Golden Layout browser popout system
// Renders children in a new browser window via window.open()
// Uses React portal + stylesheet copying for seamless rendering
// ============================================================

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import './PopoutWindow.css';

// Memo boundary prevents unrelated parent re-renders from
// reconciling the portal DOM, which would steal popup focus.
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
// Copy stylesheets from parent window to child window
// ============================================================

function copyStylesheets(sourceDoc: Document, targetDoc: Document): void {
  // Copy <link> stylesheets
  const links = sourceDoc.querySelectorAll('link[rel="stylesheet"]');
  links.forEach((link) => {
    const clone = targetDoc.createElement('link');
    clone.rel = 'stylesheet';
    clone.href = (link as HTMLLinkElement).href;
    if ((link as HTMLLinkElement).media) {
      clone.media = (link as HTMLLinkElement).media;
    }
    targetDoc.head.appendChild(clone);
  });

  // Copy <style> elements
  const styles = sourceDoc.querySelectorAll('style');
  styles.forEach((style) => {
    const clone = targetDoc.createElement('style');
    clone.textContent = style.textContent;
    targetDoc.head.appendChild(clone);
  });

  // Copy CSS custom properties from :root
  const rootStyles = sourceDoc.documentElement.style.cssText;
  if (rootStyles) {
    targetDoc.documentElement.style.cssText = rootStyles;
  }

  // Also copy computed CSS variables from the parent document element
  const computed = window.getComputedStyle(sourceDoc.documentElement);
  const cssVars: string[] = [];
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    if (prop.startsWith('--')) {
      cssVars.push(`${prop}: ${computed.getPropertyValue(prop)}`);
    }
  }
  if (cssVars.length > 0) {
    const varStyle = targetDoc.createElement('style');
    varStyle.textContent = `:root { ${cssVars.join('; ')} }`;
    targetDoc.head.appendChild(varStyle);
  }
}

// ============================================================
// PopoutWindow component
// ============================================================

export function PopoutWindow({
  open,
  title = '',
  width = 800,
  height = 600,
  left,
  top,
  onClose,
  children,
  features: extraFeatures,
}: PopoutWindowProps) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const popupRef = useRef<Window | null>(null);
  const closeCheckInterval = useRef<number | null>(null);
  // Stable ref for onClose so the popup effect doesn't re-run on every parent render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Clean up on unmount or close
  const cleanup = useCallback(() => {
    if (closeCheckInterval.current !== null) {
      clearInterval(closeCheckInterval.current);
      closeCheckInterval.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setContainerEl(null);
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    // Calculate window position (default to centered)
    const screenLeft = left ?? Math.round((window.screen.width - width) / 2);
    const screenTop = top ?? Math.round((window.screen.height - height) / 2);

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
      console.warn('PopoutWindow: Failed to open popup window. Popup blocker may be active.');
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
    copyStylesheets(document, popup.document);

    setContainerEl(container);

    // Handle popup window close via beforeunload
    const handleUnload = () => {
      onCloseRef.current();
    };
    popup.addEventListener('beforeunload', handleUnload);

    // Poll for popup close (backup for cases where beforeunload doesn't fire)
    closeCheckInterval.current = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        onCloseRef.current();
      }
    }, 500);

    return () => {
      popup.removeEventListener('beforeunload', handleUnload);
      cleanup();
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
