// ============================================================
// SplitPane - Re-Flex inspired constraint-aware resizable panes
// Full recursive constraint propagation solver with touch support,
// cascading resize, and window-resize awareness
// ============================================================

import { useState, useCallback, useRef, useEffect, Children, useMemo } from 'react';
import type { SplitConstraints } from '../core/types';
import './splitPane.css';

interface SplitPaneProps {
  orientation?: 'horizontal' | 'vertical';
  children: React.ReactNode;
  sizes?: number[]; // initial flex ratios
  minSizes?: number[];
  maxSizes?: number[];
  splitterSize?: number;
  onResize?: (sizes: number[]) => void;
  onStartResize?: (index: number) => void;
  onStopResize?: (index: number, sizes: number[]) => void;
  propagate?: boolean;
  windowResizeAware?: boolean;
  maxRecDepth?: number;
  className?: string;
}

export function SplitPane({
  orientation = 'horizontal',
  children,
  sizes: initialSizes,
  minSizes = [],
  maxSizes = [],
  splitterSize = 4,
  onResize,
  onStartResize,
  onStopResize,
  propagate = true,
  windowResizeAware = false,
  maxRecDepth = 100,
  className = '',
}: SplitPaneProps) {
  const childArray = useMemo(() => Children.toArray(children), [children]);
  const count = childArray.length;

  const [sizes, setSizes] = useState<number[]>(() => {
    if (initialSizes && initialSizes.length === count) return initialSizes;
    return Array(count).fill(1);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef(-1);
  const dragStart = useRef(0);
  const sizesAtDragStart = useRef<number[]>([]);

  // Convert flex ratios to pixel sizes and back
  const getContainerSize = useCallback(() => {
    if (!containerRef.current) return 0;
    return orientation === 'horizontal'
      ? containerRef.current.clientWidth
      : containerRef.current.clientHeight;
  }, [orientation]);

  // Compute total flex from a sizes array
  const getTotalFlex = useCallback((s: number[]) => s.reduce((a, b) => a + b, 0), []);

  // Convert a pixel min/max to flex units given a total flex and container size
  const toFlex = useCallback((px: number, totalFlex: number, containerSize: number) => {
    if (containerSize === 0) return 0;
    return (px / containerSize) * totalFlex;
  }, []);

  // Get min flex for pane i
  const getMinFlex = useCallback((i: number, totalFlex: number, containerSize: number) => {
    const minPx = minSizes[i] ?? 50;
    return toFlex(minPx, totalFlex, containerSize);
  }, [minSizes, toFlex]);

  // Get max flex for pane i
  const getMaxFlex = useCallback((i: number, totalFlex: number, containerSize: number) => {
    const maxPx = maxSizes[i];
    return maxPx !== undefined ? toFlex(maxPx, totalFlex, containerSize) : Infinity;
  }, [maxSizes, toFlex]);

  // ============================================================
  // Recursive constraint propagation solver
  // ============================================================

  /**
   * Recursively compute how much a pane at `index` can stretch
   * in the given direction (+1 = rightward/downward, -1 = leftward/upward).
   * When propagate is enabled and a pane hits its max, the stretch
   * cascades to the next pane in that direction.
   */
  const computeAvailableStretch = useCallback((
    index: number,
    direction: 1 | -1,
    currentSizes: number[],
    totalFlex: number,
    containerSize: number,
    depth: number = 0,
  ): number => {
    if (depth >= maxRecDepth) return 0;
    if (index < 0 || index >= currentSizes.length) return 0;

    const currentFlex = currentSizes[index];
    const maxFlex = getMaxFlex(index, totalFlex, containerSize);
    const available = maxFlex - currentFlex;

    if (!propagate || available > 0) {
      return Math.max(0, available);
    }

    // This pane is at max; cascade to next pane in the same direction
    const nextIndex = index + direction;
    return computeAvailableStretch(nextIndex, direction, currentSizes, totalFlex, containerSize, depth + 1);
  }, [maxRecDepth, propagate, getMaxFlex]);

  /**
   * Recursively compute how much a pane at `index` can shrink
   * in the given direction.
   */
  const computeAvailableShrink = useCallback((
    index: number,
    direction: 1 | -1,
    currentSizes: number[],
    totalFlex: number,
    containerSize: number,
    depth: number = 0,
  ): number => {
    if (depth >= maxRecDepth) return 0;
    if (index < 0 || index >= currentSizes.length) return 0;

    const currentFlex = currentSizes[index];
    const minFlex = getMinFlex(index, totalFlex, containerSize);
    const available = currentFlex - minFlex;

    if (!propagate || available > 0) {
      return Math.max(0, available);
    }

    // This pane is at min; cascade to next pane in the same direction
    const nextIndex = index + direction;
    return computeAvailableShrink(nextIndex, direction, currentSizes, totalFlex, containerSize, depth + 1);
  }, [maxRecDepth, propagate, getMinFlex]);

  /**
   * Distribute an offset across panes starting from the splitter at `index`.
   * Positive offset = splitter moves right/down (pane[index] grows, pane[index+1] shrinks).
   * With propagation, if a pane hits its constraint, the remaining offset
   * cascades to the next pane.
   */
  const dispatchOffset = useCallback((
    splitterIndex: number,
    offset: number,
    currentSizes: number[],
    totalFlex: number,
    containerSize: number,
  ): number[] => {
    const newSizes = [...currentSizes];

    if (offset === 0) return newSizes;

    // Positive offset: panes to the left of splitter grow, panes to the right shrink
    // Negative offset: panes to the left shrink, panes to the right grow

    if (offset > 0) {
      // Growing left side, shrinking right side
      let remaining = offset;

      // First, try to shrink right-side panes (starting from splitter+1 going right)
      for (let i = splitterIndex + 1; i < newSizes.length && remaining > 0; i++) {
        if (!propagate && i > splitterIndex + 1) break;
        const minFlex = getMinFlex(i, totalFlex, containerSize);
        const canShrink = Math.max(0, newSizes[i] - minFlex);
        const shrinkAmount = Math.min(remaining, canShrink);
        newSizes[i] -= shrinkAmount;
        remaining -= shrinkAmount;
        if (remaining <= 0) break;
        if (i - splitterIndex >= maxRecDepth) break;
      }

      const actualOffset = offset - remaining;

      // Now grow left-side panes (starting from splitter going left)
      let growRemaining = actualOffset;
      for (let i = splitterIndex; i >= 0 && growRemaining > 0; i--) {
        if (!propagate && i < splitterIndex) break;
        const maxFlex = getMaxFlex(i, totalFlex, containerSize);
        const canGrow = Math.max(0, maxFlex - newSizes[i]);
        const growAmount = Math.min(growRemaining, canGrow);
        newSizes[i] += growAmount;
        growRemaining -= growAmount;
        if (growRemaining <= 0) break;
        if (splitterIndex - i >= maxRecDepth) break;
      }

      // If we couldn't grow enough on the left, give back to the right
      if (growRemaining > 0) {
        // Re-expand the rightmost pane that was shrunk
        for (let i = splitterIndex + 1; i < newSizes.length && growRemaining > 0; i++) {
          const giveBack = Math.min(growRemaining, actualOffset);
          newSizes[i] += giveBack;
          growRemaining -= giveBack;
        }
      }
    } else {
      // Negative offset: shrinking left side, growing right side
      let remaining = -offset;

      // Shrink left-side panes (starting from splitter going left)
      for (let i = splitterIndex; i >= 0 && remaining > 0; i--) {
        if (!propagate && i < splitterIndex) break;
        const minFlex = getMinFlex(i, totalFlex, containerSize);
        const canShrink = Math.max(0, newSizes[i] - minFlex);
        const shrinkAmount = Math.min(remaining, canShrink);
        newSizes[i] -= shrinkAmount;
        remaining -= shrinkAmount;
        if (remaining <= 0) break;
        if (splitterIndex - i >= maxRecDepth) break;
      }

      const actualOffset = -offset - remaining;

      // Grow right-side panes (starting from splitter+1 going right)
      let growRemaining = actualOffset;
      for (let i = splitterIndex + 1; i < newSizes.length && growRemaining > 0; i++) {
        if (!propagate && i > splitterIndex + 1) break;
        const maxFlex = getMaxFlex(i, totalFlex, containerSize);
        const canGrow = Math.max(0, maxFlex - newSizes[i]);
        const growAmount = Math.min(growRemaining, canGrow);
        newSizes[i] += growAmount;
        growRemaining -= growAmount;
        if (growRemaining <= 0) break;
        if (i - splitterIndex >= maxRecDepth) break;
      }

      // If we couldn't grow enough on the right, give back to the left
      if (growRemaining > 0) {
        for (let i = splitterIndex; i >= 0 && growRemaining > 0; i--) {
          const giveBack = Math.min(growRemaining, actualOffset);
          newSizes[i] += giveBack;
          growRemaining -= giveBack;
        }
      }
    }

    return newSizes;
  }, [propagate, maxRecDepth, getMinFlex, getMaxFlex]);

  // ============================================================
  // Pointer start (mouse + touch unified)
  // ============================================================

  const handlePointerStart = useCallback((index: number, clientPos: number) => {
    dragIndex.current = index;
    dragStart.current = clientPos;
    sizesAtDragStart.current = [...sizes];
    document.body.classList.add('kasm-resizing');
    onStartResize?.(index);
  }, [sizes, onStartResize]);

  const onSplitterMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    const pos = orientation === 'horizontal' ? e.clientX : e.clientY;
    handlePointerStart(index, pos);
    e.preventDefault();
  }, [orientation, handlePointerStart]);

  const onSplitterTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const pos = orientation === 'horizontal' ? touch.clientX : touch.clientY;
    handlePointerStart(index, pos);
  }, [orientation, handlePointerStart]);

  // ============================================================
  // Pointer move / end (mouse)
  // ============================================================

  useEffect(() => {
    const handlePointerMove = (clientPos: number) => {
      if (dragIndex.current < 0) return;

      const idx = dragIndex.current;
      const delta = clientPos - dragStart.current;
      const containerSize = getContainerSize();
      const totalFlex = getTotalFlex(sizesAtDragStart.current);
      if (containerSize === 0 || totalFlex === 0) return;

      const deltaFlex = (delta / containerSize) * totalFlex;

      const newSizes = dispatchOffset(
        idx,
        deltaFlex,
        sizesAtDragStart.current,
        totalFlex,
        containerSize,
      );

      setSizes(newSizes);
      onResize?.(newSizes);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = orientation === 'horizontal' ? e.clientX : e.clientY;
      handlePointerMove(pos);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const pos = orientation === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY;
      handlePointerMove(pos);
    };

    const handlePointerEnd = () => {
      if (dragIndex.current >= 0) {
        const idx = dragIndex.current;
        dragIndex.current = -1;
        document.body.classList.remove('kasm-resizing');
        onStopResize?.(idx, sizes);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handlePointerEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handlePointerEnd);
    document.addEventListener('touchcancel', handlePointerEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handlePointerEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handlePointerEnd);
      document.removeEventListener('touchcancel', handlePointerEnd);
    };
  }, [orientation, getContainerSize, getTotalFlex, dispatchOffset, onResize, onStopResize, sizes]);

  // ============================================================
  // Window resize awareness
  // ============================================================

  useEffect(() => {
    if (!windowResizeAware) return;

    const handleWindowResize = () => {
      const containerSize = getContainerSize();
      if (containerSize === 0) return;

      const totalFlex = getTotalFlex(sizes);

      // Re-clamp all panes to their constraints after window resize
      let newSizes = [...sizes];
      let adjusted = false;

      for (let i = 0; i < newSizes.length; i++) {
        const minFlex = getMinFlex(i, totalFlex, containerSize);
        const maxFlex = getMaxFlex(i, totalFlex, containerSize);

        if (newSizes[i] < minFlex) {
          newSizes[i] = minFlex;
          adjusted = true;
        } else if (newSizes[i] > maxFlex) {
          newSizes[i] = maxFlex;
          adjusted = true;
        }
      }

      if (adjusted) {
        setSizes(newSizes);
        onResize?.(newSizes);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [windowResizeAware, sizes, getContainerSize, getTotalFlex, getMinFlex, getMaxFlex, onResize]);

  const totalFlex = sizes.reduce((a, b) => a + b, 0);

  return (
    <div
      ref={containerRef}
      className={`kasm-split-pane kasm-split-pane--${orientation} ${className}`}
    >
      {childArray.map((child, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div
            className="kasm-split-pane__element"
            style={{ flex: sizes[i] / totalFlex }}
          >
            {child}
          </div>
          {i < count - 1 && (
            <div
              className={`kasm-split-pane__splitter kasm-split-pane__splitter--${orientation}`}
              style={{
                [orientation === 'horizontal' ? 'width' : 'height']: splitterSize,
              }}
              onMouseDown={(e) => onSplitterMouseDown(i, e)}
              onTouchStart={(e) => onSplitterTouchStart(i, e)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
