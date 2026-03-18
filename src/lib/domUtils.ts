// ============================================================
// DOM Utilities - Framework-agnostic DOM helpers.
// Used by both React and (future) Solid components.
// ============================================================

/**
 * Copy all stylesheets, <style> elements, and CSS custom properties
 * from one document to another. Used by PopoutWindow to mirror
 * the parent's theme and styles into a child browser window.
 */
export function copyStylesheets(sourceDoc: Document, targetDoc: Document): void {
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

  // Copy computed CSS variables
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

/**
 * Open a popup window with sensible defaults.
 * Returns the Window object, or null if blocked.
 * Pure DOM — no framework dependency.
 */
export function openPopupWindow(opts: {
  title?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  extraFeatures?: string;
}): Window | null {
  const {
    title = '',
    width = 800,
    height = 600,
    extraFeatures,
  } = opts;

  const parentLeft = window.screenLeft ?? (window as any).screenX ?? 0;
  const parentTop = window.screenTop ?? (window as any).screenY ?? 0;
  const screenLeft = opts.left ?? Math.round(parentLeft + (window.outerWidth - width) / 2);
  const screenTop = opts.top ?? Math.round(parentTop + (window.outerHeight - height) / 2);

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

  if (extraFeatures) featuresList.push(extraFeatures);

  const popup = window.open('', '', featuresList.join(','));
  if (!popup) return null;

  popup.document.title = title;
  popup.document.body.style.margin = '0';
  popup.document.body.style.padding = '0';
  popup.document.body.style.overflow = 'hidden';

  return popup;
}

/**
 * Format a timestamp as a human-readable "time ago" string.
 * Pure function — no framework dependency.
 */
export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
