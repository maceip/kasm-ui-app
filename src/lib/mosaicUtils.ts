// ============================================================
// Mosaic Layout Utilities - Bounding box math from react-mosaic
// Used for tiling window splits and percentage-based layouts
// ============================================================

export type SplitDirection = 'row' | 'column';

/**
 * Bounding box in viewport percentages.
 * { top: 0, right: 0, bottom: 0, left: 0 } = full viewport.
 */
export interface BoundingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function emptyBoundingBox(): BoundingBox {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function boundingBoxAsStyles(box: BoundingBox) {
  return {
    top: `${box.top}%`,
    right: `${box.right}%`,
    bottom: `${box.bottom}%`,
    left: `${box.left}%`,
  };
}

/**
 * Split a bounding box into N sub-boxes based on percentages.
 * Percentages must sum to 100.
 */
export function splitBoundingBox(
  box: BoundingBox,
  percentages: number[],
  direction: SplitDirection,
): BoundingBox[] {
  const results: BoundingBox[] = [];
  let offset = 0;

  for (const pct of percentages) {
    const newBox = { ...box };
    if (direction === 'row') {
      const totalWidth = 100 - box.left - box.right;
      newBox.left = box.left + (totalWidth * offset) / 100;
      newBox.right = box.right + (totalWidth * (100 - offset - pct)) / 100;
    } else {
      const totalHeight = 100 - box.top - box.bottom;
      newBox.top = box.top + (totalHeight * offset) / 100;
      newBox.bottom = box.bottom + (totalHeight * (100 - offset - pct)) / 100;
    }
    results.push(newBox);
    offset += pct;
  }

  return results;
}

/**
 * Convert relative split percentage to absolute viewport percentage.
 */
export function getAbsoluteSplitPercentage(
  box: BoundingBox,
  relPct: number,
  direction: SplitDirection,
): number {
  if (direction === 'column') {
    const h = 100 - box.top - box.bottom;
    return (h * relPct) / 100 + box.top;
  } else {
    const w = 100 - box.right - box.left;
    return (w * relPct) / 100 + box.left;
  }
}

/**
 * Convert absolute viewport percentage to relative bounding box percentage.
 */
export function getRelativeSplitPercentage(
  box: BoundingBox,
  absPct: number,
  direction: SplitDirection,
): number {
  if (direction === 'column') {
    const h = 100 - box.top - box.bottom;
    return h === 0 ? 0 : ((absPct - box.top) / h) * 100;
  } else {
    const w = 100 - box.right - box.left;
    return w === 0 ? 0 : ((absPct - box.left) / w) * 100;
  }
}

/**
 * Clamp percentages to enforce minimum pane sizes.
 * Returns adjusted percentages array.
 */
export function clampSplitPercentages(
  percentages: number[],
  minPct: number = 10,
): number[] {
  const total = percentages.reduce((a, b) => a + b, 0);
  return percentages.map(p => Math.max(minPct, Math.min(total - minPct * (percentages.length - 1), p)));
}

/**
 * Calculate new split percentages after a drag resize.
 * @param percentages Current split percentages
 * @param splitIndex Index of the divider being dragged (between splitIndex and splitIndex+1)
 * @param mousePct Mouse position as percentage of the total available space
 * @param minPct Minimum pane percentage
 */
export function resizeSplit(
  percentages: number[],
  splitIndex: number,
  mousePct: number,
  minPct: number = 10,
): number[] {
  const result = [...percentages];
  const beforeSum = percentages.slice(0, splitIndex).reduce((a, b) => a + b, 0);
  const pairTotal = percentages[splitIndex] + percentages[splitIndex + 1];

  let newLeft = mousePct - beforeSum;
  newLeft = Math.max(minPct, Math.min(pairTotal - minPct, newLeft));

  result[splitIndex] = newLeft;
  result[splitIndex + 1] = pairTotal - newLeft;

  return result;
}
