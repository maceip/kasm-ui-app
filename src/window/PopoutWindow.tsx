// ============================================================
// PopoutWindow - New tab approach (replaces React portal popup)
// Instead of window.open + createPortal, we simply open a new tab.
// This massively simplifies the implementation.
// ============================================================

import './PopoutWindow.css';

// ============================================================
// PopoutButton - trigger component for popout from title bars
// ============================================================

interface PopoutButtonProps {
  onClick: () => void;
  title?: string;
  className?: string;
}

export function PopoutButton(props: PopoutButtonProps) {
  return (
    <button
      class={`kasm-popout-btn ${props.className || ''}`}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
      title={props.title || 'Open in new tab'}
      aria-label={props.title || 'Open in new tab'}
    >
      <svg
        class="kasm-popout-btn__icon"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 1h3v3" />
        <path d="M13 1L7 7" />
        <path d="M11 8v4a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1h4" />
      </svg>
    </button>
  );
}
