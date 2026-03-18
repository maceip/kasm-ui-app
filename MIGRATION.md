# Migration Guide: React → SolidJS

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
│   ├── SystemMonitor.tsx   ← Hard: useRef state machine, rAF, canvas
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
│   ├── LiquidGlass.tsx    ← Hard: forwardRef, useId, ResizeObserver
│   ├── SlidingPane.tsx    ← Medium: animation, mount tracking
│   ├── liquidGlassUtils.ts ← Keep: pure math (no framework)
│   └── liquidGlassShaderUtils.ts ← Keep: pure WebGL (no framework)
```

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

Pattern mapping is 1:1. No logic changes needed.

| React Pattern | SolidJS Equivalent |
|--------------|-------------------|
| `useState(x)` | `createSignal(x)` |
| `useMemo(() => x, [deps])` | `createMemo(() => x)` (auto-tracked) |
| `useEffect(() => { ... }, [deps])` | `createEffect(() => { ... })` (auto-tracked) |
| `useEffect cleanup` | `onCleanup(() => { ... })` |
| `useRef(x)` | `let ref = x` (plain variable) |
| `useCallback(fn, [deps])` | `fn` (no wrapper needed) |
| `memo(Component)` | Not needed (components run once) |
| `{arr.map(x => <C key={x.id} />)}` | `<For each={arr}>{x => <C />}</For>` |
| `{cond && <C />}` | `<Show when={cond}><C /></Show>` |
| `useDesktopStore(s => s.x)` | `store.x` (reactive property access) |
| `Context.Provider` | Module-level store or `createContext` |

**Files in this tier:**
- Clock.tsx, SystemTray.tsx, WorkspaceSwitcher.tsx, HotCorners.tsx
- Calculator.tsx, TextEditor.tsx, Settings.tsx, OAuthApps.tsx
- Desktop.tsx, WindowList.tsx, ExpoView.tsx
- TitleBar.tsx, DockDropIndicator.tsx
- ThemeProvider.tsx (becomes a simple `createEffect`)

### Tier 2: Moderate Effort (half day each)

Logic extraction needed, but patterns have clear Solid equivalents.

| Component | React-Specific Pattern | Solid Strategy |
|-----------|----------------------|----------------|
| Panel.tsx | `checkOverlap` in useEffect with many deps | `createMemo` auto-tracks |
| AppMenu.tsx | `useRef` for focus, `useMemo` for search | Plain variables, `createMemo` |
| NotificationCenter.tsx | `useRef` snapshot diffing | `createEffect` with `on()` |
| AgentSidebar.tsx | Many individual selectors | Direct store property access |
| Terminal.tsx | Command parser (pure), scroll refs | Extract parser, `ref` directive |
| FileManager.tsx | Drag-drop, keyboard handlers | Same event model, `createSignal` |
| Notes.tsx | SplitPane integration | Uses SplitPane (port that first) |
| CollabEditor.tsx | `useSyncExternalStore` | `createResource` or `from()` |
| CollabProvider.tsx | Context + lazy WebSocket | Module-level store + `createResource` |
| SlidingPane.tsx | Animation mount tracking | CSS transitions + `<Show>` |
| TabPanel.tsx | HTML drag-and-drop API | Same API, different state model |
| DockingDemo.tsx | Tree algorithms (already pure) | Same algorithms, `createStore` for tree |

### Tier 3: Hard Port (1-2 days each)

These components have deep React-specific patterns that need redesign.

| Component | Why It's Hard | Solid Strategy |
|-----------|--------------|----------------|
| **Window.tsx** | `useEffect` chains for drag/resize lifecycle; global listener add/remove on state toggle; `memo` boundary for performance | `createEffect` + `onCleanup` is actually simpler; logic already extracted to `lib/windowActions.ts` |
| **SplitPane.tsx** | Recursive constraint solver with 8 `useCallback`s and complex `useEffect` dependency chains | Rewrite as a class-based controller; Solid component calls controller methods |
| **LiquidGlass.tsx** | `forwardRef`, `useId`, `ResizeObserver` in `useEffect`, SVG filter with dynamic IDs | `ref` prop (no forwardRef), manual ID generation, `createEffect` for observer |
| **SystemMonitor.tsx** | `useRef` for frame counters, `requestAnimationFrame` loop, canvas drawing in `useEffect` | Extract metrics collector class; Solid component just renders canvas |
| **PopoutWindow.tsx** | **`createPortal`** to an external browser window — no direct SolidJS equivalent | Use Solid's `render()` to mount into the popup's container div; manage lifecycle manually |

---

## Recommended Migration Order

### Phase 1: Foundation (do first)
1. Replace `package.json` deps: `react` → `solid-js`, `zustand` → remove, add `solid-js/store`
2. Replace Vite plugin: `@vitejs/plugin-react` → `vite-plugin-solid`
3. Port `src/core/store.ts` → Solid `createStore` (uses `lib/windowActions.ts`)
4. Port `src/theme/ThemeProvider.tsx` → simple `createEffect`
5. Port `src/core/persistence.ts` → `createEffect` with `onCleanup`

### Phase 2: Shell (desktop chrome)
6. Port Desktop.tsx, Panel.tsx, AppMenu.tsx, WindowList.tsx
7. Port Clock, SystemTray, WorkspaceSwitcher, HotCorners, ExpoView
8. Port NotificationCenter.tsx, AgentSidebar.tsx

### Phase 3: Window System (critical path)
9. Port Window.tsx (logic already in `lib/windowActions.ts`)
10. Port TitleBar.tsx
11. Port SplitPane.tsx (hardest layout component)
12. Port TabPanel.tsx, DockDropIndicator.tsx
13. Port PopoutWindow.tsx (hardest overall — needs `render()` approach)

### Phase 4: Apps
14. Port easy apps: Calculator, TextEditor, Settings, OAuthApps
15. Port medium apps: Terminal, FileManager, Notes, DockingDemo
16. Port hard apps: SystemMonitor, CollabEditor
17. Port LiquidGlass component

### Phase 5: Collaboration
18. Port CollabProvider.tsx
19. Wire up `useCollabDoc` equivalent with Solid's `from()` or custom primitive

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

1. **Props are not destructurable in Solid** — use `props.x`, not `const { x } = props`
2. **Components run once** — no "re-render" concept; don't put logic after JSX return
3. **`<For>` vs `.map()`** — `<For>` does keyed reconciliation; `.map()` recreates all DOM
4. **No `memo`** — components are already non-re-executing; remove all `memo()` wrappers
5. **No `useCallback`** — function identity is stable because components don't re-run
6. **`createEffect` tracks automatically** — no dependency arrays needed
7. **Store updates are granular** — `setStore('windows', i, 'x', newX)` updates only that path
