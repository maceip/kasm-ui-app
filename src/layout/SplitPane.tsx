// ============================================================
// SplitPane - Re-Flex inspired constraint-aware resizable panes
// SolidJS port
// ============================================================

import { createSignal, createEffect, onCleanup, For, type JSX } from 'solid-js';
import type { SplitConstraints } from '../core/types';
import './splitPane.css';

interface SplitPaneProps {
  orientation?: 'horizontal' | 'vertical';
  children: JSX.Element[];
  sizes?: number[];
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

export function SplitPane(props: SplitPaneProps) {
  const orientation = () => props.orientation ?? 'horizontal';
  const minSizes = () => props.minSizes ?? [];
  const maxSizes = () => props.maxSizes ?? [];
  const splitterSize = () => props.splitterSize ?? 4;
  const propagate = () => props.propagate ?? true;
  const maxRecDepth = () => props.maxRecDepth ?? 100;

  const childArray = () => {
    const c = props.children;
    return Array.isArray(c) ? c : [c];
  };

  const count = () => childArray().length;

  const [sizes, setSizes] = createSignal<number[]>(
    props.sizes && props.sizes.length === count() ? [...props.sizes] : Array(count()).fill(1)
  );

  let containerRef: HTMLDivElement | undefined;
  let dragIndex = -1;
  let dragStart = 0;
  let sizesAtDragStart: number[] = [];
  const [isDragging, setIsDragging] = createSignal(false);

  const getContainerSize = () => {
    if (!containerRef) return 0;
    return orientation() === 'horizontal'
      ? containerRef.clientWidth
      : containerRef.clientHeight;
  };

  const getTotalFlex = (s: number[]) => s.reduce((a, b) => a + b, 0);

  const toFlex = (px: number, totalFlex: number, containerSize: number) => {
    if (containerSize === 0) return 0;
    return (px / containerSize) * totalFlex;
  };

  const getMinFlex = (i: number, totalFlex: number, containerSize: number) => {
    const minPx = minSizes()[i] ?? 50;
    return toFlex(minPx, totalFlex, containerSize);
  };

  const getMaxFlex = (i: number, totalFlex: number, containerSize: number) => {
    const maxPx = maxSizes()[i];
    return maxPx !== undefined ? toFlex(maxPx, totalFlex, containerSize) : Infinity;
  };

  const dispatchOffset = (
    splitterIndex: number,
    offset: number,
    currentSizes: number[],
    totalFlex: number,
    containerSize: number,
  ): number[] => {
    const newSizes = [...currentSizes];
    if (offset === 0) return newSizes;
    const mrd = maxRecDepth();
    const prop = propagate();

    if (offset > 0) {
      let remaining = offset;
      for (let i = splitterIndex + 1; i < newSizes.length && remaining > 0; i++) {
        if (!prop && i > splitterIndex + 1) break;
        const minF = getMinFlex(i, totalFlex, containerSize);
        const canShrink = Math.max(0, newSizes[i] - minF);
        const shrinkAmount = Math.min(remaining, canShrink);
        newSizes[i] -= shrinkAmount;
        remaining -= shrinkAmount;
        if (i - splitterIndex >= mrd) break;
      }
      const actualOffset = offset - remaining;
      let growRemaining = actualOffset;
      for (let i = splitterIndex; i >= 0 && growRemaining > 0; i--) {
        if (!prop && i < splitterIndex) break;
        const maxF = getMaxFlex(i, totalFlex, containerSize);
        const canGrow = Math.max(0, maxF - newSizes[i]);
        const growAmount = Math.min(growRemaining, canGrow);
        newSizes[i] += growAmount;
        growRemaining -= growAmount;
        if (splitterIndex - i >= mrd) break;
      }
      if (growRemaining > 0) {
        for (let i = splitterIndex + 1; i < newSizes.length && growRemaining > 0; i++) {
          newSizes[i] += Math.min(growRemaining, actualOffset);
          growRemaining -= Math.min(growRemaining, actualOffset);
        }
      }
    } else {
      let remaining = -offset;
      for (let i = splitterIndex; i >= 0 && remaining > 0; i--) {
        if (!prop && i < splitterIndex) break;
        const minF = getMinFlex(i, totalFlex, containerSize);
        const canShrink = Math.max(0, newSizes[i] - minF);
        const shrinkAmount = Math.min(remaining, canShrink);
        newSizes[i] -= shrinkAmount;
        remaining -= shrinkAmount;
        if (splitterIndex - i >= mrd) break;
      }
      const actualOffset = -offset - remaining;
      let growRemaining = actualOffset;
      for (let i = splitterIndex + 1; i < newSizes.length && growRemaining > 0; i++) {
        if (!prop && i > splitterIndex + 1) break;
        const maxF = getMaxFlex(i, totalFlex, containerSize);
        const canGrow = Math.max(0, maxF - newSizes[i]);
        const growAmount = Math.min(growRemaining, canGrow);
        newSizes[i] += growAmount;
        growRemaining -= growAmount;
        if (i - splitterIndex >= mrd) break;
      }
      if (growRemaining > 0) {
        for (let i = splitterIndex; i >= 0 && growRemaining > 0; i--) {
          newSizes[i] += Math.min(growRemaining, actualOffset);
          growRemaining -= Math.min(growRemaining, actualOffset);
        }
      }
    }
    return newSizes;
  };

  const handlePointerStart = (index: number, clientPos: number) => {
    dragIndex = index;
    dragStart = clientPos;
    sizesAtDragStart = [...sizes()];
    document.body.classList.add('kasm-resizing');
    setIsDragging(true);
    props.onStartResize?.(index);
  };

  const onSplitterMouseDown = (index: number, e: MouseEvent) => {
    const pos = orientation() === 'horizontal' ? e.clientX : e.clientY;
    handlePointerStart(index, pos);
    e.preventDefault();
  };

  const onSplitterTouchStart = (index: number, e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const pos = orientation() === 'horizontal' ? touch.clientX : touch.clientY;
    handlePointerStart(index, pos);
  };

  // Drag effect
  createEffect(() => {
    if (!isDragging()) return;

    const handlePointerMove = (clientPos: number) => {
      if (dragIndex < 0) return;
      const delta = clientPos - dragStart;
      const containerSize = getContainerSize();
      const totalFlex = getTotalFlex(sizesAtDragStart);
      if (containerSize === 0 || totalFlex === 0) return;
      const deltaFlex = (delta / containerSize) * totalFlex;
      const newSizes = dispatchOffset(dragIndex, deltaFlex, sizesAtDragStart, totalFlex, containerSize);
      setSizes(newSizes);
      props.onResize?.(newSizes);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = orientation() === 'horizontal' ? e.clientX : e.clientY;
      handlePointerMove(pos);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const pos = orientation() === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY;
      handlePointerMove(pos);
    };

    const handlePointerEnd = () => {
      if (dragIndex >= 0) {
        const idx = dragIndex;
        dragIndex = -1;
        document.body.classList.remove('kasm-resizing');
        setIsDragging(false);
        props.onStopResize?.(idx, sizes());
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handlePointerEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handlePointerEnd);
    document.addEventListener('touchcancel', handlePointerEnd);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handlePointerEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handlePointerEnd);
      document.removeEventListener('touchcancel', handlePointerEnd);
    });
  });

  // Window resize awareness
  createEffect(() => {
    if (!props.windowResizeAware) return;

    const handleWindowResize = () => {
      const containerSize = getContainerSize();
      if (containerSize === 0) return;
      const currentSizes = sizes();
      const totalFlex = getTotalFlex(currentSizes);
      let newSizes = [...currentSizes];
      let adjusted = false;

      for (let i = 0; i < newSizes.length; i++) {
        const minF = getMinFlex(i, totalFlex, containerSize);
        const maxF = getMaxFlex(i, totalFlex, containerSize);
        if (newSizes[i] < minF) { newSizes[i] = minF; adjusted = true; }
        else if (newSizes[i] > maxF) { newSizes[i] = maxF; adjusted = true; }
      }

      if (adjusted) {
        setSizes(newSizes);
        props.onResize?.(newSizes);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    onCleanup(() => window.removeEventListener('resize', handleWindowResize));
  });

  const totalFlex = () => sizes().reduce((a, b) => a + b, 0);

  return (
    <div
      ref={containerRef}
      class={`kasm-split-pane kasm-split-pane--${orientation()} ${props.className || ''}`}
    >
      <For each={childArray()}>
        {(child, i) => (
          <div style={{ display: 'contents' }}>
            <div
              class="kasm-split-pane__element"
              style={{ flex: (sizes()[i()] ?? 1) / totalFlex() }}
            >
              {child}
            </div>
            {i() < count() - 1 && (
              <div
                class={`kasm-split-pane__splitter kasm-split-pane__splitter--${orientation()}`}
                style={{
                  [orientation() === 'horizontal' ? 'width' : 'height']: `${splitterSize()}px`,
                }}
                onMouseDown={(e) => onSplitterMouseDown(i(), e)}
                onTouchStart={(e) => onSplitterTouchStart(i(), e)}
              />
            )}
          </div>
        )}
      </For>
    </div>
  );
}
