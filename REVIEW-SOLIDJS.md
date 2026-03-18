# Ryan Carniato-Style Review: Kasm UI Desktop Environment

## The Elephant in the Room: This Isn't SolidJS

This is a **React 19 + Zustand application**, not SolidJS. For a fully-fledged multi-window desktop environment with real-time drag, resize, snap, multi-workspace management, and collaboration, that framework choice fights you at every turn.

---

## 1. The Rendering Model is Fundamentally Wrong for a Window Manager

### The Problem: VDOM Diffing on Every Mouse Move

The drag handler in `src/window/Window.tsx:52-56`:

```tsx
const onMove = (e: MouseEvent) => {
  const x = e.clientX - dragOffset.current.x;
  const y = e.clientY - dragOffset.current.y;
  useDesktopStore.getState().moveWindow(win.id, Math.max(0, x), Math.max(0, y));
  const zone = detectSnapZone(e.clientX, e.clientY);
  setSnapPreview(zone);
};
```

Every single mousemove event during a drag:

1. Calls `moveWindow`, which does `set()` in Zustand
2. Zustand's `set()` creates a **new `windows` array** with **new window objects** via `.map()` (see `windowSlice.ts:167-171`)
3. **Every subscriber** to `useDesktopStore(s => s.windows)` re-renders -- `Desktop.tsx`, `WindowList.tsx`, `Panel.tsx`, `ExpoView.tsx`
4. `Desktop` re-renders and runs `.filter()` on the new array, then maps over `visibleWindows` creating new JSX for **every window**, not just the one being dragged
5. React's VDOM diff catches that only one window's `style.left` and `style.top` changed, but it still had to **create the entire VDOM tree** and diff it to figure that out
6. `setSnapPreview(zone)` triggers a **second** render of the dragged Window component
7. `WindowList` re-renders, re-filters windows, re-creates all button JSX

At 60fps, that's **120+ VDOM tree creations and diffs per second**, most concluding "nothing changed."

### What Solid Does Differently

In Solid, a signal update to `window.x` triggers **only** the DOM node's `style.left` binding. No VDOM. No diffing. No component re-execution. One signal write -> one DOM mutation.

```tsx
// SolidJS equivalent
const [windowX, setWindowX] = createSignal(80);
// In JSX: style={{ left: `${windowX()}px` }}
// setWindowX(200) -> ONLY the style binding updates. Nothing else.
```

### The `memo` Band-Aid

`Window` and `WindowWithApp` are wrapped in `memo()` (`Window.tsx:21`, `Desktop.tsx:13`). But the `win` prop is a **new object** on every Zustand state change (`.map()` creates new objects). `memo` compares `prevWin !== nextWin` -> always `true` -> always re-renders. In Solid, this problem doesn't exist because there is no component re-execution.

---

## 2. The Zustand Store Architecture: Immutability at War with Performance

### Every Action Rebuilds the Entire Window Array

Every action in `windowSlice.ts` -- `moveWindow`, `focusWindow`, `resizeWindow` -- does:

```ts
set((s: any) => ({
  windows: s.windows.map((w: WindowState) => /* ... */)
}));
```

That `.map()` creates a new array, N new window objects, and GC pressure from all the old objects. During a drag at 60fps with 10 windows: **600 arrays** and **6,000 objects per second** that immediately become garbage. GC pauses manifest as micro-stutters.

### Solid's Store Model

```tsx
const [windows, setWindows] = createStore<WindowState[]>([]);

// Move a window - only subscribers to THIS window's x/y update
setWindows(
  w => w.id === id,
  { x: newX, y: newY, state: 'normal' }
);
```

Zero new arrays. Zero new objects. Zero GC pressure.

---

## 3. Selector Granularity: Death by a Thousand Subscriptions

### The WindowList Anti-Pattern

`src/shell/WindowList.tsx:12-13`:
```tsx
const { focusWindow, minimizeWindow } = useDesktopStore();
```

Destructures **the entire store** without a selector. Re-renders on *any* store change.

`Panel.tsx` subscribes to five separate selectors. When `windows` changes during a drag, `Panel` re-renders. But Panel doesn't display window positions -- it only cares about window *count* for intellihide. Full render cost for irrelevant data changes.

### Solid's Fine-Grained Approach

Access `store.windows.length` or `store.windows[i].state`, and the component only re-runs when *that specific derived value* changes. No manual selector optimization needed.

---

## 4. Effect Cleanup Patterns: useEffect Is a Foot Gun Here

### The Drag Effect Problem

`Window.tsx:49-82` registers/unregisters global listeners every time `dragging` changes. Creates new closures, adds/removes event listeners, sets/clears body styles on every toggle.

Solid's `createEffect` + `onCleanup` is explicit and doesn't re-run setup unless tracked signals change:

```tsx
createEffect(() => {
  if (!dragging()) return;
  const onMove = (e: MouseEvent) => { /* ... */ };
  document.addEventListener('mousemove', onMove);
  onCleanup(() => document.removeEventListener('mousemove', onMove));
});
```

No dependency arrays. No stale closure bugs. No over-triggering.

---

## 5. Architectural Issues Beyond the Framework

### 5a. The `(get() as any)` Type Escape Hatch

`windowSlice.ts:58-63` casts `get()` as `any` everywhere. Defeats TypeScript and silently breaks if you rename cross-slice methods. Thread `DesktopStore` type through all slices.

### 5b. Z-Index Will Overflow

`focusWindow` increments `nextZIndex` monotonically. After 2^31 focus operations, z-index overflows. Need periodic z-index normalization.

### 5c. The VFS Singleton Problem

`vfs.ts:1098`: Module-level singleton. No way to have multiple instances, inject mocks for testing, or clean up. `_populate()` runs eagerly on import.

### 5d. OT Engine: Correctness Concern

`ot.ts:118`:
```ts
return [pos1, { d: deleteLen(op1) + insertLen(op2) }];
// NOTE: this deletes the inserted text too, which is aggressive
```

The code acknowledges its delete-vs-insert transform deletes the other user's text. This is a data loss bug in collaborative editing.

### 5e. The Tab Cache Problem

`TabPanel.tsx:179-187` renders **all tab content** hiding inactive with `display: none`. Every tab's React tree stays mounted consuming memory. In Solid, use `<Show>` with `keyed` or `<Switch>`.

### 5f. No Virtualization

`Desktop.tsx:42-44` renders all windows for the workspace, plus app content stays mounted even when windows are fully obscured.

---

## 6. What a Solid Rewrite Would Look Like

### State Management

```tsx
const [desktop, setDesktop] = createStore({
  windows: [] as WindowState[],
  workspaces: [] as Workspace[],
  activeWorkspaceId: '',
});

function moveWindow(id: string, x: number, y: number) {
  setDesktop('windows', w => w.id === id, { x, y, state: 'normal' });
}
```

### Window Component

```tsx
function Window(props: { win: WindowState }) {
  // Runs ONCE. Not on every render.
  const [dragging, setDragging] = createSignal(false);

  createEffect(() => {
    if (!dragging()) return;
    const onMove = (e: MouseEvent) => {
      moveWindow(props.win.id, e.clientX - offset.x, e.clientY - offset.y);
    };
    document.addEventListener('mousemove', onMove);
    onCleanup(() => document.removeEventListener('mousemove', onMove));
  });

  return (
    <div style={{ left: `${props.win.x}px`, top: `${props.win.y}px` }}>
      {props.children}
    </div>
  );
}
```

### Desktop Component

```tsx
function Desktop() {
  const visibleWindows = createMemo(() =>
    desktop.windows.filter(w => activeWs()?.windowIds.includes(w.id))
  );

  return (
    <div class="kasm-desktop">
      <For each={visibleWindows()}>
        {(win) => <WindowWithApp win={win} />}
      </For>
    </div>
  );
}
```

`<For>` does keyed reconciliation by reference. Window moves don't re-run `<For>` because array membership didn't change.

---

## 7. Performance Comparison

| Operation | React (current) | Solid (projected) |
|-----------|-----------------|-------------------|
| Window drag (60fps) | Full VDOM diff per frame, all windows re-evaluated | Single `style.left`/`style.top` DOM write per frame |
| Window focus | Entire windows array remapped, all subscribers notified | Single z-index + focused flag toggle |
| Resize handle | 2 Zustand calls, 2 full render cycles | 2 direct style mutations |
| Workspace switch | Full Desktop re-render, all windows re-mounted | `<For>` swaps keyed references, existing DOM reused |
| Theme change | Context re-render propagates through entire tree | CSS custom properties updated, zero component re-execution |
| 20 windows idle | 20 memo comparisons on any store change | Zero work |

---

## 8. What You Got Right

- **Zustand slice composition** (`store.ts`) is clean. Translates directly to Solid stores.
- **CSS custom properties for theming** -- correct approach regardless of framework.
- **The OT architecture** (`CollabDoc` with inflight/pending queues, pause/resume) is production-quality design.
- **VFS design** with OPFS persistence and File System Access API mounts is clever.
- **Snap zone detection** (`detectSnapZone`) is simple and correct.
- **PWA setup** with service worker and manifest.
- **Intellihide panel logic** -- good concept, though implementation re-runs too often.

---

## 9. Summary

You're building a **real-time interactive desktop environment** -- the most performance-sensitive category of web application. React's "re-run the whole component, diff the output" model is designed for document-like UIs with infrequent, coarse-grained updates.

Solid's "run setup once, bind individual DOM nodes to individual signals" model is designed for exactly this. The component function is a *constructor*, not a render function. Updates are O(1) in the number of things that *didn't* change.

**Port to SolidJS. You'll delete more code than you write.**
