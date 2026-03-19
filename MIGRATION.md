# Migration Guide: React → SolidJS

> **Target: Solid 2.0** (`solid-js@2.0.0-beta.3`, npm `next` tag, March 2026)
>
> Stable 1.x is `1.9.11`. This guide targets **2.0 beta** because it is the
> direction of the framework and has significant API differences from 1.x.
> If you choose to target 1.x stable instead, see the "1.x Differences" section
> at the bottom.

This document maps every module in the codebase by migration difficulty and provides a concrete porting strategy.

## Architecture After Reorganization

```
src/
├── lib/                    ← TIER 0: Framework-agnostic (zero React imports)
│   ├── types.ts            ← All TypeScript type definitions
│   ├── vfs.ts              ← Virtual filesystem (class, pure logic)
│   ├── ot.ts               ← OT engine, CollabDoc, CollabConnection
│   ├── themes.ts           ← Theme color palettes (data)
│   ├── mosaicUtils.ts      ← Layout math (pure functions)
│   ├── windowActions.ts    ← Snap detection, resize, state transforms
│   └── domUtils.ts         ← copyStylesheets, openPopupWindow, formatTimeAgo
│
├── core/                   ← TIER 1: State management (Zustand → Solid stores)
│   ├── store.ts            ← Zustand facade (34 lines, rewrite to createStore)
│   ├── types.ts            ← Re-export barrel → lib/types.ts
│   ├── persistence.ts      ← Save/load layout (useEffect → createEffect)
│   └── slices/             ← Pure mutation logic, thin Zustand wrappers
│       ├── windowSlice.ts  ← Uses lib/windowActions.ts for all logic
│       ├── workspaceSlice.ts
│       ├── shellSlice.ts
│       ├── notificationSlice.ts
│       └── projectSlice.ts
│
├── apps/                   ← TIER 2: App components (mostly mechanical port)
│   ├── Calculator.tsx      ← Easy: useState → createSignal
│   ├── TextEditor.tsx      ← Easy: useState → createSignal
│   ├── Settings.tsx        ← Easy: useState → createSignal
│   ├── OAuthApps.tsx       ← Easy: state machine, pure logic
│   ├── AgentApps.tsx       ← Easy: terminal simulation
│   ├── Notes.tsx           ← Medium: uses SplitPane, VFS
│   ├── Terminal.tsx         ← Medium: 1000 lines, but logic is pure (extractable)
│   ├── FileManager.tsx     ← Medium: drag-drop, VFS, keyboard shortcuts
│   ├── CollabEditor.tsx    ← Medium: OT integration, prevRef pattern
│   ├── DockingDemo.tsx     ← Medium: tree algorithms (pure), uses TabPanel
│   ├── SystemMonitor.tsx   ← Hard: rAF state machine, canvas drawing
│   ├── registry.ts         ← Keep: binds components (framework-specific)
│   └── vfs.ts              ← Re-export barrel → lib/vfs.ts
│
├── shell/                  ← TIER 2: Desktop shell (mechanical port)
│   ├── Desktop.tsx         ← Easy: <For> replaces .map()
│   ├── Panel.tsx           ← Medium: intellihide effect chain
│   ├── AppMenu.tsx         ← Medium: search, focus management
│   ├── WindowList.tsx      ← Easy: selectors → store accessors
│   ├── WorkspaceSwitcher.tsx ← Easy
│   ├── SystemTray.tsx      ← Easy: toggle state
│   ├── Clock.tsx           ← Easy: setInterval → createEffect
│   ├── NotificationCenter.tsx ← Medium: toast lifecycle, ref-based diffing
│   ├── HotCorners.tsx      ← Easy: event handlers
│   ├── ExpoView.tsx        ← Easy: conditional rendering
│   ├── AgentSidebar.tsx    ← Medium: many selectors, sliding pane
│   └── LocalFolderIndicator.tsx ← Medium: async VFS operations
│
├── window/                 ← TIER 3: Window management (careful port)
│   ├── Window.tsx          ← Hard: drag/resize effects, snap preview
│   ├── TitleBar.tsx        ← Easy: pure presentational
│   ├── PopoutWindow.tsx    ← Hardest: createPortal, no Solid equivalent
│   └── window.css          ← Keep as-is
│
├── layout/                 ← TIER 3: Layout system (careful port)
│   ├── SplitPane.tsx       ← Hard: constraint solver, pointer events
│   ├── TabPanel.tsx        ← Medium: drag-reorder, dock detection
│   ├── DockDropIndicator.tsx ← Easy: state + event handlers
│   └── mosaicUtils.ts      ← Re-export barrel → lib/mosaicUtils.ts
│
├── theme/                  ← TIER 1: Theming (simplifies in Solid)
│   ├── ThemeProvider.tsx   ← Easy: Context → module-level reactive effect
│   └── themes.ts           ← Re-export barrel → lib/themes.ts
│
├── collab/                 ← TIER 1: Collaboration (simplifies in Solid)
│   ├── CollabProvider.tsx  ← Medium: Context → module-level store
│   └── ot.ts              ← Re-export barrel → lib/ot.ts
│
├── components/             ← TIER 2: Shared components
│   ├── LiquidGlass.tsx    ← Medium: forwardRef removed, ResizeObserver effect pre-split
│   ├── SlidingPane.tsx    ← Medium: animation, mount tracking
│   ├── liquidGlassUtils.ts ← Keep: pure math (no framework)
│   └── liquidGlassShaderUtils.ts ← Keep: pure WebGL (no framework)
```

---

## Pre-Alignment Already Done (Solid 2.0 Patterns in React)

The React codebase has been restructured so that porting to Solid 2.0 is
**mechanical** — most changes are find-and-replace, not redesigns.

### What's been pre-aligned:

| Pattern | What We Did | Port Is Now |
|---------|------------|-------------|
| **`memo()` removed** | Removed from Window, TitleBar, Desktop/WindowWithApp. Solid components don't re-render. | Delete import |
| **`useCallback()` removed** | Removed from Window, Desktop, ExpoView, Panel, LiquidGlass, PopoutWindow. Solid functions are stable. | Delete import |
| **`forwardRef` removed** | LiquidGlass now takes `outerRef` prop instead. Solid passes ref as a regular prop. | Rename `outerRef` → `ref` |
| **`useId()` removed** | LiquidGlass uses manual counter `glass-${++nextGlassId}`. Works identically in Solid. | Keep as-is |
| **Effects: compute/apply split** | Window drag/resize, Panel intellihide, LiquidGlass ResizeObserver/shader all split into compute phase (pure) and apply phase (side effect). Comments mark phases. | Map to `createEffect(compute, apply)` |
| **Props: `props.x` pattern** | Key components (Window, TitleBar, SnapPreviewOverlay, GlassFilter) use `props` object. | Remove local destructuring, use `props.x` |
| **Draft-style mutations** | `lib/windowActions.ts` exports both `apply*` (immutable, Zustand) and `draft*` (mutating, Solid 2.0 stores). | Use `draft*` variants with `setStore(s => { draftFocusWindow(s.windows, id, z) })` |
| **Pure logic extracted** | `lib/windowActions.ts`, `lib/domUtils.ts`, `lib/mosaicUtils.ts` — all framework-agnostic. | Import unchanged |
| **Whole-store subscriptions fixed** | WindowList, WorkspaceSwitcher, NotificationCenter, Settings use granular selectors. | Map to `store.propertyName` |

### Remaining React-isms (need manual port):

| Pattern | Where | Solid 2.0 Equivalent |
|---------|-------|---------------------|
| `createPortal` | PopoutWindow.tsx | `render()` into popup container |
| `Children.toArray` | SplitPane.tsx | `children` is already an array in Solid |
| `useMemo` | SplitPane.tsx | `createMemo()` |
| `PopoutContent` memo boundary | PopoutWindow.tsx | Not needed (Solid doesn't re-render) |
| `useRef` for mutable state | Multiple components | Plain `let` variable |
| `useEffect` dep arrays | All effect sites | Auto-tracked `createEffect(compute, apply)` |
| `useState` | All components | `createSignal(value)` |

---

## Solid 2.0 Beta: What Changed from 1.x

> npm: `solid-js@2.0.0-beta.3` (tagged `next`), released March 2026.
> Reactive core extracted to standalone `@solidjs/signals` package.

### Breaking Changes That Affect This Migration

| Area | 1.x | 2.0 Beta |
|------|-----|----------|
| **Effects** | `createEffect(() => { track; sideEffect; })` single fn | **Two-phase split**: `createEffect(() => tracked, (value) => sideEffect)` — tracking is pure, side effects in second fn |
| **`onMount`** | `onMount(() => { ... })` | **Renamed to `onSettled`** — fires when async subtree resolves |
| **`createResource`** | Primary async primitive | **Removed** — signals can now return Promises; async is first-class in the reactive graph |
| **Stores** | Path-based setters: `setStore('windows', 0, 'x', 100)` | **Draft-based by default**: `setStore(s => { s.windows[0].x = 100 })` using `produce()`-style. Path syntax available via `storePath()` opt-in |
| **`<Index>`** | Separate component | **Removed** — use `<For keyed={false}>` instead |
| **`<For>` children** | `(item, index) => ...` | Children receive **accessors**: `(item, index) => ...` where `item()` and `index()` are functions |
| **`use:` directives** | `use:myDirective={value}` | **Removed** — use `ref` directive factories + arrays instead |
| **Batching** | Synchronous by default | **Microtask-batched** — reads don't reflect writes until flush; `flush()` for synchronous |
| **`mergeProps`** | `mergeProps(a, b)` | Renamed to **`merge(a, b)`** |
| **`splitProps`** | `splitProps(props, [...])` | Replaced by **`omit(props, [...])`** + new **`pick(props, [...])`** |

### New APIs in 2.0

| API | Purpose | Replaces |
|-----|---------|----------|
| `createSignal(fn)` | Derived signal (readonly) — pass a function to get a computed signal | Some `createMemo` use cases |
| `<Loading fallback={...}>` | Show fallback while async subtree resolves, then keep UI stable during background work | Part of what `<Suspense>` did |
| `action()` | Mutation primitive with built-in optimistic update support | Manual effect-based mutations |
| `createOptimistic()` / `createOptimisticStore()` | Optimistic UI state that auto-resolves | Custom rollback patterns |
| `flush()` | Force synchronous effect execution (escape hatch from microtask batching) | `batch()` (which is now default) |
| `@solidjs/signals` | Standalone reactive core, usable outside Solid components | Bundled reactivity |

---

## Migration Tiers

### Tier 0: Already Portable (0 effort)

These files have **zero framework imports**. They work with any framework today.

| File | Lines | Notes |
|------|-------|-------|
| `lib/types.ts` | 236 | All TypeScript types/interfaces |
| `lib/vfs.ts` | 1098 | VirtualFS class, OPFS persistence |
| `lib/ot.ts` | 1081 | OT engine, CollabDoc, CollabConnection |
| `lib/themes.ts` | 223 | Theme color definitions |
| `lib/mosaicUtils.ts` | 133 | Layout bounding box math |
| `lib/windowActions.ts` | 205 | Snap zones, resize, state transforms |
| `lib/domUtils.ts` | 107 | Stylesheet copy, popup opener, time formatting |
| `components/liquidGlassUtils.ts` | ~25000 | Displacement maps (canvas data) |
| `components/liquidGlassShaderUtils.ts` | ~200 | WebGL shader generation |

**Total: ~28,300 lines of portable code**

### Tier 1: Mechanical Conversion (< 1 hour each)

Pattern mapping for Solid **2.0 beta**:

| React Pattern | Solid 2.0 Equivalent |
|--------------|---------------------|
| `useState(x)` | `createSignal(x)` |
| `useMemo(() => x, [deps])` | `createMemo(() => x)` (auto-tracked) or `createSignal(() => x)` for simple derivations |
| `useEffect(() => { /*track*/ /*sideEffect*/ }, [deps])` | `createEffect(() => trackedValue, (val) => { /*sideEffect*/ })` — **two-phase!** |
| `useEffect cleanup` | `onCleanup(() => { ... })` (still works in 2.0) |
| `useRef(x)` | `let ref = x` (plain variable — components run once) |
| `useCallback(fn, [deps])` | `fn` (no wrapper needed — stable identity) |
| `memo(Component)` | Remove entirely (components run once in Solid) |
| `{arr.map(x => <C key={x.id} />)}` | `<For each={arr}>{(item, i) => <C />}</For>` — note: `item()` and `i()` are **accessors** in 2.0 |
| `{cond && <C />}` | `<Show when={cond}><C /></Show>` |
| `useDesktopStore(s => s.x)` | `store.x` (reactive property access on `createStore`) |
| `Context.Provider` | Module-level store or `createContext` |
| `mergeProps(a, b)` | **`merge(a, b)`** (renamed in 2.0) |
| `splitProps(props, keys)` | **`omit(props, keys)`** or **`pick(props, keys)`** (2.0) |

**Files in this tier:**
- Clock.tsx, SystemTray.tsx, WorkspaceSwitcher.tsx, HotCorners.tsx
- Calculator.tsx, TextEditor.tsx, Settings.tsx, OAuthApps.tsx
- Desktop.tsx, WindowList.tsx, ExpoView.tsx
- TitleBar.tsx, DockDropIndicator.tsx
- ThemeProvider.tsx (becomes a simple `createEffect`)

### Tier 2: Moderate Effort (half day each)

Logic extraction needed, but patterns have clear Solid equivalents.

| Component | React-Specific Pattern | Solid 2.0 Strategy |
|-----------|----------------------|---------------------|
| Panel.tsx | `checkOverlap` in useEffect with many deps | Two-phase `createEffect`: compute overlap → apply style |
| AppMenu.tsx | `useRef` for focus, `useMemo` for search | Plain variables, `createMemo` |
| NotificationCenter.tsx | `useRef` snapshot diffing | Two-phase `createEffect`: track notification count → fire toast in apply phase |
| AgentSidebar.tsx | Many individual selectors | Direct store property access |
| Terminal.tsx | Command parser (pure), scroll refs | Extract parser, plain `ref` variable |
| FileManager.tsx | Drag-drop, keyboard handlers | Same event model, `createSignal` |
| Notes.tsx | SplitPane integration | Uses SplitPane (port that first) |
| CollabEditor.tsx | `useSyncExternalStore` | Async signals (2.0) — signals can hold Promises natively; no `createResource` needed |
| CollabProvider.tsx | Context + lazy WebSocket | Module-level store + async signal for connection state |
| SlidingPane.tsx | Animation mount tracking | CSS transitions + `<Show>` |
| TabPanel.tsx | HTML drag-and-drop API | Same API, `createSignal` for state |
| DockingDemo.tsx | Tree algorithms (already pure) | Same algorithms, `createStore` with draft-based setters |

### Tier 3: Hard Port (1-2 days each)

These components have deep React-specific patterns that need redesign.

| Component | Why It's Hard | Solid 2.0 Strategy |
|-----------|--------------|---------------------|
| **Window.tsx** | `useEffect` chains for drag/resize lifecycle; global listener add/remove on state toggle; `memo` boundary | Two-phase `createEffect`: compute drag state → apply DOM position in apply fn. Logic already extracted to `lib/windowActions.ts`. Remove `memo` entirely. |
| **SplitPane.tsx** | Recursive constraint solver with 8 `useCallback`s and complex `useEffect` dependency chains | Rewrite as class-based controller; Solid component calls controller methods. `useCallback` removal simplifies massively. |
| **LiquidGlass.tsx** | ~~`forwardRef`~~ removed, ~~`useId`~~ removed, ResizeObserver effect | **Already pre-aligned**: uses `outerRef` prop (rename to `ref`), manual ID counter, effects pre-split. Just convert `useState` → `createSignal`. |
| **SystemMonitor.tsx** | `useRef` for frame counters, `requestAnimationFrame` loop, canvas drawing in `useEffect` | Extract metrics collector as plain class. Two-phase `createEffect`: track metrics → draw canvas. `requestAnimationFrame` loop lives outside reactive system. |
| **PopoutWindow.tsx** | **`createPortal`** to an external browser window — `Portal` in Solid mounts to same document | Use Solid's `render()` to mount a standalone Solid app into the popup's container div. `copyStylesheets` already extracted to `lib/domUtils.ts`. Manage popup lifecycle with `onCleanup`. |

---

## Recommended Migration Order

### Phase 1: Foundation (do first)
1. `package.json`: `react`/`react-dom` → `solid-js@next`, remove `zustand`, add `solid-js/store`
2. Vite: `@vitejs/plugin-react` → `vite-plugin-solid@next` (2.0-compatible)
3. `tsconfig.json`: add `"jsx": "preserve"`, `"jsxImportSource": "solid-js"`
4. Port `src/core/store.ts` → Solid `createStore` with draft-based setters (uses `lib/windowActions.ts`)
5. Port `src/theme/ThemeProvider.tsx` → simple two-phase `createEffect`
6. Port `src/core/persistence.ts` → `createEffect` with `onCleanup`

### Phase 2: Shell (desktop chrome)
7. Port Desktop.tsx, Panel.tsx, AppMenu.tsx, WindowList.tsx
8. Port Clock, SystemTray, WorkspaceSwitcher, HotCorners, ExpoView
9. Port NotificationCenter.tsx, AgentSidebar.tsx

### Phase 3: Window System (critical path)
10. Port Window.tsx (logic already in `lib/windowActions.ts`)
11. Port TitleBar.tsx
12. Port SplitPane.tsx (hardest layout component)
13. Port TabPanel.tsx, DockDropIndicator.tsx
14. Port PopoutWindow.tsx (hardest overall — needs `render()` approach)

### Phase 4: Apps
15. Port easy apps: Calculator, TextEditor, Settings, OAuthApps
16. Port medium apps: Terminal, FileManager, Notes, DockingDemo
17. Port hard apps: SystemMonitor, CollabEditor
18. Port LiquidGlass component

### Phase 5: Collaboration
19. Port CollabProvider.tsx — use async signals instead of `createResource`
20. Wire up `useCollabDoc` equivalent with `@solidjs/signals` reactive primitives

---

## What NOT to Port

These stay as-is regardless of framework:

- All CSS files (zero changes needed)
- `src/lib/*` (already framework-agnostic)
- `public/*` (PWA manifest, service worker, icons)
- `server/*` (Node.js WebSocket server)
- `tests/*` (Puppeteer — framework-independent)

---

## Key Gotchas

### Solid 2.0 Specific

1. **Two-phase `createEffect` is mandatory** — you cannot perform side effects in the tracking function. The first fn is pure (tracks deps), the second fn is the side effect. This is the single biggest API change from both React and Solid 1.x.
2. **Microtask batching** — signal reads do NOT immediately reflect writes. If you need synchronous updates (e.g., drag handler), call `flush()` after writes.
3. **`<For>` children are accessors** — `item()` and `index()` are functions in 2.0, not values. Forgetting the `()` call is a common bug.
4. **No `createResource`** — async data loading uses signals that return Promises. The reactive graph handles suspension automatically.
5. **Stores use draft setters by default** — `setStore(s => { s.windows[0].x = 100 })` not `setStore('windows', 0, 'x', 100)`. Old path syntax available via `storePath()`.
6. **`use:` directives are gone** — use ref directive factories instead: `<div ref={[myDirective, value]} />`

### General Solid (applies to both 1.x and 2.0)

7. **Props are not destructurable** — use `props.x`, not `const { x } = props`. Use `merge()`/`omit()`/`pick()` for defaults and splitting.
8. **Components run once** — no "re-render" concept. Don't put conditional logic between signal reads and JSX return.
9. **`<For>` vs `.map()`** — `<For>` does keyed DOM reconciliation; `.map()` recreates all DOM nodes.
10. **No `memo`** — components are already non-re-executing; remove all `memo()` wrappers.
11. **No `useCallback`** — function identity is stable because components don't re-run.
12. **Store updates are granular** — only the specific changed path triggers downstream effects.

---

## 1.x Differences

If targeting **Solid 1.9.x stable** instead of 2.0 beta:

| 2.0 Pattern | 1.x Equivalent |
|-------------|----------------|
| `createEffect(track, apply)` | `createEffect(() => { /* both track and apply */ })` |
| `onSettled` | `onMount` |
| `merge(a, b)` | `mergeProps(a, b)` |
| `omit(props, keys)` / `pick(props, keys)` | `splitProps(props, keys)` |
| `<For keyed={false}>` | `<Index>` |
| `<For>` with accessor children | `<For>` with value children (no `()` needed) |
| Draft-based `setStore(s => { s.x = 1 })` | Path-based `setStore('x', 1)` |
| Async signals (Promises in signals) | `createResource(fetcher)` |
| Microtask batching by default | Synchronous by default, `batch()` to batch |
| `ref` directive factories | `use:` directives |
| `<Loading>` | `<Suspense>` (still exists in 2.0 but `<Loading>` covers initial state) |

---

## Version Reference

```
solid-js@latest  = 1.9.11      (stable, March 2026)
solid-js@next    = 2.0.0-beta.3 (beta, March 2026)
solid-js@beta    = 1.10.0-beta.0
@solidjs/signals = standalone reactive core (pre-alpha)
vite-plugin-solid@next = 2.0-compatible compiler
SolidStart       = 2.0.0-alpha.2 (meta-framework, Feb 2026)
```
