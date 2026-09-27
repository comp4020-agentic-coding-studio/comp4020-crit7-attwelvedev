# Collapsible panels — Phase 05: Snapping resize

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-collapsible-panels-00-overview.md`. Read
  these sections first:
  - §2 (FR4 preference cap, FR16–21, FR25)
  - §3
  - §4.1–4.5, especially the §4.4 widths and cascade order
  - §0 explains the renumbering: this was Phase 04. Its tasks keep the
    numbers 7–8 but run after Phase 04's Tasks 9–10
- **Depends on phases:** 01, 02, 03 and 04.

## 1. Summary

This phase adds a resize handle between the sidebar and the timeline.
Dragging it snaps live between collapsed / 1 / 2 / 3 columns, and the
keyboard steps through the same sizes. The chosen column count is saved and
painted before first render. When it ends, the whole feature is complete.

## 2. Requirements (this phase)

### 2.1 Functional

- FR16–21 in full.
- FR4: the preference cap.
- FR25: the `panel-reqs-cols` line.
- FR12: re-asserted, so expanding restores the preferred columns.
- FR1: re-asserted at every size.
- FR27 and FR28: re-asserted. The page still doesn't scroll vertically,
  and the handle spans the panes' full height.

### 2.2 Non-functional

- The handle is focusable, with full separator ARIA.
- Its hit area is at least 2.75rem wide, although it's drawn 1rem wide.
- In-browser axe is clean at 1 column and collapsed.
- Pointer handling must not interfere with `touch-drag.ts`.

### 2.3 Out of scope for this phase

- Free widths.
- Any animation.

### 2.4 Assumptions

See overview §2.4. Phase-specific assumption: a pointer drag that ends in
`pointercancel` commits what's showing, so what you see is what's saved.

## 3. Existing code context (verified 2026-09-27)

**`src/components/touch-drag.ts:101-104`**

```ts
function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== "touch") return; // mouse/pen keep native HTML5 DnD
  const card = (event.target as Element | null)?.closest<HTMLElement>("[data-drag-code]");
  const code = card?.getAttribute("data-drag-code");
  if (!card || !code) return;
```

The handle has no `data-drag-code`, so the planner-level touch listeners
ignore it. Its own `setPointerCapture` keeps the moves on the handle.

**Hydration convention:** the server render and the first client render
must agree, then state syncs in `useEffect`. This is the pattern in
`Sidebar.tsx`'s compaction state and in Task 5's `reqs` state.

### Interfaces from earlier phases (exact)

**From Task 1, `spec/browser.ts`**

```ts
export function launch(): Promise<Browser>;
export function openPage(browser: Browser, url: string, viewport: Viewport, options?: OpenOptions): Promise<Page>;
export function horizontalOverflow(page: Page): Promise<number>;
export function axeViolations(page: Page): Promise<string[]>;
```

`OpenOptions` is `{ storage?: Record<string, string>; blockScripts?:
boolean }`.

**From Task 2**

- The DOM is `.planner > .planner-layout > .planner-panes >
  [.planner-timeline-area, aside#requirements, …]`.
- `.planner-panes` carries `--reqs-fit`:
  - `0` when stacked
  - `1` at `@container planner (min-width: 49.5rem)`
  - `2` at 63.1rem
  - `3` at 76.7rem
- Tier blocks set `.planner-panes > aside { flex-basis/width:
  var(--reqs-w-N) }`.
- Tier blocks set grid tracks through
  `.available-courses:not([data-columns="1"])` (≥63.1rem) and
  `.available-courses[data-columns="3"]` (≥76.7rem).
- `:root` has `--reqs-w-rail: 3rem; --reqs-w-1: 17.5rem; --reqs-w-2: 31.1rem;
  --reqs-w-3: 44.7rem; --timeline-min: 31rem;`.
- In the 49.5rem block, `.planner-panes > aside` also has `display: flex;
  flex-direction: column` (Task 5).

**From Task 3, `src/components/panel-state.ts`**

```ts
export const REQS_COLS_KEY = "panel-reqs-cols";
export type ReqsColumns = 1 | 2 | 3;
export interface ReqsState { collapsed: boolean; columns: ReqsColumns; }
export function parseColumns(raw: string | null | undefined): ReqsColumns;
```

`saveReqsState` always writes `panel-reqs-cols`. `applyReqsState` sets
`data-reqs-cols` to `"1"` or `"2"` and deletes it for 3.
`panel-state.test.ts` has a drift guard that reads `Base.astro` and asserts
it contains `"panel-nav"` and `"panel-reqs"`.

**From Task 5, `src/components/Planner.tsx`**

```ts
const [reqs, setReqs] = useState<ReqsState>(DEFAULT_REQS);
useEffect(() => setReqs(reqsStateFromDataset(document.documentElement.dataset)), []);
function updateReqs(next: ReqsState, commit: boolean) { … }  // setReqs + applyReqsState(document.documentElement, next) + (commit ? saveReqsState(next) : nothing)
```

- `<Sidebar … onHide onShow dropReady />`
- `onShow` is `updateReqs({ ...reqs, collapsed: false }, true)`.
- The aside has `id="requirements"`.
- `.reqs-rail` is visible only under `:root[data-reqs="collapsed"]`.
- The last block in the planner CSS is the collapsed `@container planner
  (min-width: 49.5rem)` block, and it must stay last.

**From Tasks 4 and 5:** the `Base.astro` inline head script's `try` holds
the `panel-nav` and `panel-reqs` lines.

**From Task 10 (Phase 04)**

- `spec/browser.ts` also exports `verticalOverflow(page: Page):
  Promise<number>`, which is `scrollHeight − clientHeight` of `<html>`.
- `styles.css` has a fit group right after the 76.7rem tier block and before
  the collapsed block. It's `@media (min-height: 30rem) { … }`, and inside it
  `@container planner (min-width: 49.5rem)` sets:
  - `.planner-panes { align-items: stretch; }`
  - `.planner-timeline-area, .planner-panes > aside { position: static;
    max-height: none; }`
  - `:root[data-reqs="collapsed"] .reqs-rail { flex: 1 1 auto; min-height:
    0; }`
- So at viewports at least 30rem tall, the panes have a definite height,
  the aside and timeline fill it, and nothing is sticky. Below 30rem tall,
  the old sticky `top: 1rem; max-height: calc(100vh − 2rem)` panes apply.

## 4. Approach

**Pure logic in `src/components/reqs-resize.ts`,** unit-tested:

```ts
import type { ReqsColumns, ReqsState } from "./panel-state";
export type ReqsSize = 0 | ReqsColumns; // 0 = collapsed rail
export const REQS_WIDTH_REM: Readonly<Record<ReqsSize, number>> = { 0: 3, 1: 17.5, 2: 31.1, 3: 44.7 };
export function parseFit(raw: string): 0 | ReqsColumns;              // "1"|"2"|"3" (trimmed) → n; anything else → 0 (stacked)
export function sizeOf(state: ReqsState, fit: ReqsColumns): ReqsSize; // collapsed → 0; else min(columns, fit)
export function stateFor(size: ReqsSize, prev: ReqsState): ReqsState; // 0 → { ...prev, collapsed: true }; n → { collapsed: false, columns: n }
export function snapSize(widthRem: number, fit: ReqsColumns): ReqsSize; // nearest REQS_WIDTH_REM among 0..fit; exact midpoint → larger
export function stepSize(size: ReqsSize, key: string, fit: ReqsColumns): ReqsSize | null;
  // ArrowLeft/ArrowDown → max(0, size−1); ArrowRight/ArrowUp → min(fit, size+1); Home → 0; End → fit; other keys → null
export function sizeLabel(size: ReqsSize): string; // "Collapsed" | "1 column" | "2 columns" | "3 columns"
```

The snap midpoints are 10.25rem, 24.3rem and 37.9rem. The widths are
tenths of a rem, and their float sums aren't exact (`(31.1 + 44.7) / 2` is
`37.900000000000006`), so `snapSize` compares the two distances with a
`1e-9` tolerance before applying "exact midpoint → larger".

**The component `src/components/ReqsResizeHandle.tsx`** is rendered by
Planner right after `<Sidebar>` inside `.planner-panes`. With `order: -1`
it sits after the aside (also `order: -1`), by DOM order, and before the
timeline.

- **Fit:** `fit` starts at 3 (so SSR renders `aria-valuenow` 3). A
  `ResizeObserver` on `ref.current.parentElement` (`.planner-panes`) sets it
  from `parseFit(getComputedStyle(panes).getPropertyValue("--reqs-fit"))`,
  and reads it once on mount. `fitCols = fit === 0 ? 1 : fit`. When `fit`
  is 0 the handle is hidden by CSS anyway.
- **Drag:**
  - `pointerdown` (primary button only): `setPointerCapture` and
    `preventDefault`.
  - `pointermove`: compute `widthRem = (clientX −
    aside.getBoundingClientRect().left) / rootFontPx`, then `snapSize`. When
    the size differs from the latest, call `onChange(stateFor(size, latest),
    false)`.
  - `pointerup` and `pointercancel`: `onChange(latest, true)`.
  - `latest` is a ref, re-synced from props whenever the handle isn't
    dragging.
- **Keys:** `stepSize(sizeOf(reqs, fitCols), key, fitCols)`. When it isn't
  `null`, `preventDefault` and call `onChange(stateFor(next, reqs), true)`.

**The CSS** replaces the side-by-side `gap` with the 1rem handle, so every
threshold and width is unchanged.

- **Height:** the handle's own rules are for the unfitted fallback (sticky,
  `calc(100vh − 2rem)`), matching the panes there.
- **The fit override:** a `@media (min-height: 30rem)` override right after
  them stretches it to the panes' height instead, matching Task 10's fitted
  panes.
- **Why the override comes after:** the handle rules come after the fit
  group in the cascade (overview §4.4), so the override has to follow them.

## 5. Task breakdown

### Task 7: Pure snapping and stepping logic for the sidebar width

- [x] **Description:** create `reqs-resize.ts` exactly as in this file's §4,
  with unit tests. Also add a drift test tying `REQS_WIDTH_REM` to the CSS
  tokens.
- **Files touched:**
  - `src/components/reqs-resize.ts` (new)
  - `src/components/reqs-resize.test.ts` (new)
- **Tests first (red):**
  - **`snapSize`:**
    - With fit 3: `-5` → 0, `10.2` → 0, `10.25` → 1, `24.2` → 1, `24.3` → 2,
      `37.8` → 2, `37.9` → 3, `90` → 3.
    - `90` with fit 2 → 2, and `90` with fit 1 → 1.
  - **`stepSize`:**
    - `(2, "ArrowLeft", 3)` → 1
    - `(0, "ArrowLeft", 3)` → 0
    - `(1, "ArrowRight", 3)` → 2
    - `(2, "ArrowRight", 2)` → 2
    - `(3, "ArrowDown", 3)` → 2
    - `(0, "ArrowUp", 3)` → 1
    - `(2, "Home", 3)` → 0
    - `(0, "End", 2)` → 2
    - `(1, "Enter", 3)` → `null`
  - **`sizeOf`:**
    - `({collapsed:true, columns:2}, 3)` → 0
    - `({collapsed:false, columns:3}, 2)` → 2
    - `({collapsed:false, columns:1}, 3)` → 1
  - **`stateFor`:**
    - `(0, {collapsed:false, columns:2})` → `{collapsed:true, columns:2}`
    - `(3, {collapsed:true, columns:1})` → `{collapsed:false, columns:3}`
  - **`sizeLabel`:** covers all four sizes.
  - **`parseFit`:** `" 2 "` → 2, `"0"` → 0, `""` → 0, `"4"` → 0.
  - **Drift:** `readFileSync("src/styles.css", "utf8")` contains
    `--reqs-w-rail: ${REQS_WIDTH_REM[0]}rem;`,
    `--reqs-w-1: ${REQS_WIDTH_REM[1]}rem;`, and the same for 2 and 3.
- **Implementation (green):**
  - Implement each function in the obvious way from its contract.
  - A header comment says the widths mirror the CSS tokens, the drift test
    enforces it, and snapping is by nearest width.
- **Refactor:** none.
- **Acceptance criteria:**
  - `pnpm test:unit` is green, and `astro check` is clean.
  - No commit on its own: this commits with Task 8.
- **Depends on:** none (Phases 01–04 done).

### Task 8: The resize handle: live snapping by pointer, stepping by keyboard

- [x] **Description:** add the separator component, wire it into Planner,
  add the preference-cap CSS and the head-script columns line.
- **Files touched:**
  - `src/components/ReqsResizeHandle.tsx` (new)
  - `src/components/Planner.tsx`
  - `src/layouts/Base.astro`
  - `src/styles.css`
  - `src/components/panel-state.test.ts`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit:** extend the drift guard so `Base.astro` must also contain
    `` `"${REQS_COLS_KEY}"` ``.
  - **Layout tests** in `spec/layout.test.ts` (`/plan/example`; `sep` is
    `page.getByRole("separator", { name: "Resize requirements" })`):
    1. **Initial state.** At 1920×1080: `sep` has `aria-valuenow="3"`,
       `aria-valuemax="3"`, `aria-valuetext="3 columns"` and
       `aria-controls="requirements"`. Its `boundingBox()` top and height
       are within 1px of the aside's (FR28, fitted).
    2. **Keyboard.** At 1920, focus `sep`, then check after each key:

       | Key | `aria-valuetext` | Aside `offsetWidth` | Also |
       | --- | --- | --- | --- |
       | ArrowLeft | "2 columns" | 498 | a `.available-courses[data-columns="3"]` has 2 tracks; `panel-reqs-cols` is `"2"` |
       | ArrowLeft | "1 column" | 280 | 1 track |
       | ArrowLeft | "Collapsed" | 48 | `.reqs-rail` visible |
       | ArrowRight | "1 column" | — | |
       | End | "3 columns" | 715 | |
       | Home | "Collapsed" | — | |

       `horizontalOverflow` and `verticalOverflow` are both 0 after each
       step.
    3. **No flash.** `{ storage: { "panel-reqs-cols": "2" }, blockScripts:
       true }` at 1920: the aside is 498 and the list has 2 tracks.
    4. **Fit cap.**
       - At 1280×800: `aria-valuemax="2"`; End → "2 columns".
       - Seeding `"3"` at 1280 gives an aside of 498.
       - At 1100×800: `aria-valuemax="1"`.
    5. **Pointer preview, then commit.** At 1920:
       - `box = sep.boundingBox()`, then `mouse.move` to its centre, then
         `mouse.down()`.
       - `mouse.move(asideLeft + 20 * 16, centreY, { steps: 5 })`:
         "1 column" and an aside of 280, but
         `localStorage["panel-reqs-cols"]` is still `null`.
       - `mouse.up()`: the key is `"1"`.
       - Drag again to `asideLeft + 5 * 16`: "Collapsed", and `panel-reqs`
         is `"collapsed"`.
       - Drag from the handle beside the rail to `asideLeft + 40 * 16`:
         "3 columns", and `panel-reqs` is `null`.
    6. **Expanding restores the preference.** Seed `{ "panel-reqs":
       "collapsed", "panel-reqs-cols": "2" }` at 1920, then click
       `.reqs-rail`: the aside is 498.
    7. **Stacked.** At 390×844, `sep` isn't visible.
    8. **Axe.** At 1920 with 1 column (seeded) and collapsed (seeded),
       `axeViolations` equals `[]`.
- **Implementation (green):**
  - **`ReqsResizeHandle.tsx`:**
    - `interface Props { reqs: ReqsState; onChange: (next: ReqsState,
      commit: boolean) => void }`.
    - Renders `<div ref={ref} class="reqs-resize" role="separator"
      tabIndex={0} aria-orientation="vertical" aria-controls="requirements"
      aria-label="Resize requirements" aria-valuemin={0}
      aria-valuemax={fitCols} aria-valuenow={size}
      aria-valuetext={sizeLabel(size)} onPointerDown onPointerMove
      onPointerUp onPointerCancel onKeyDown />`.
    - Behaviour per this file's §4.
    - Comments cover why the ResizeObserver reads `--reqs-fit` (CSS is the
      single source of which sizes fit) and why moves only preview.
  - **`Planner.tsx`:** `<ReqsResizeHandle reqs={reqs} onChange={updateReqs}
    />` immediately after `<Sidebar … />`.
  - **`Base.astro` head script:** after the `panel-reqs` line, add `var c =
    s.getItem("panel-reqs-cols"); if (c === "1" || c === "2")
    h.dataset.reqsCols = c;`.
  - **`styles.css`,** placed after Task 2's tier blocks and **before** the
    collapsed block:
    - Base: `.reqs-resize { display: none; }`
    - `@container planner (min-width: 49.5rem)`:
      - `.planner-panes { gap: 0; }`
      - `.reqs-resize { display: block; order: -1; flex: 0 0 1rem;
        align-self: flex-start; position: sticky; top: 1rem; height:
        calc(100vh - 2rem); cursor: col-resize; touch-action: none; }`
      - `.reqs-resize::before { content: ""; position: absolute;
        inset-block: 0; inset-inline: -0.875rem; }`, with a comment that the
        hit area is 2.75rem even though the handle is drawn 1rem wide
      - `.reqs-resize::after { content: ""; position: absolute;
        inset-block: 0; inset-inline-start: calc(50% - 1px); width: 2px;
        border-radius: 1px; background: var(--line); }`
      - `.reqs-resize:hover::after, .reqs-resize:focus-visible::after {
        background: var(--gold); }`
    - Immediately after that block, `@media (min-height: 30rem) {
      @container planner (min-width: 49.5rem) { .reqs-resize { align-self:
      stretch; position: relative; top: auto; height: auto; } } }`. Add a
      comment: in the fitted page (Task 10), the handle spans the panes like
      the aside and timeline do. `position: relative` keeps it the
      containing block for its `::before`/`::after`.
    - `@container planner (min-width: 63.1rem)`:
      - `:root[data-reqs-cols="1"] .planner-panes > aside { flex-basis:
        var(--reqs-w-1); width: var(--reqs-w-1); }`
      - `:root[data-reqs-cols="1"] .available-courses {
        grid-template-columns: 13rem; }`
    - `@container planner (min-width: 76.7rem)`:
      - `:root[data-reqs-cols="2"] .planner-panes > aside { flex-basis:
        var(--reqs-w-2); width: var(--reqs-w-2); }`
      - `:root[data-reqs-cols="2"] .available-courses[data-columns="3"] {
        grid-template-columns: repeat(2, 13rem); }`
    - Precede these with a comment: the preference only ever narrows the
      width the tier allows, and these blocks must come after the fit group
      and before the collapsed block (overview §4.4).
- **Refactor:** now that the handle fills the side-by-side gap, check that
  no rule still assumes a 1rem `gap` between the aside and the timeline.
  Grep for `gap` under `.planner-panes`.
- **Acceptance criteria:**
  - Tests 1–8 and the unit tests pass.
  - `pnpm check` passes.
  - Render check at 1920×1080 (at 3, 2, 1 and collapsed), 900×800 and
    390×844.
  - Commit (Tasks 7 and 8 together): "Let the requirements sidebar
    snap-resize between collapsed, 1, 2 and 3 columns".
- **Human review:** a screen recording or screenshots at 1920×1080: hovering
  and focusing the handle, and mid-drag at each snap. A pass means:
  - The handle is discoverable on hover and focus, but quiet otherwise.
  - The snapping feels deliberate, not jumpy.
  - Collapsing by dragging feels natural.

  The user accepts explicitly.
- **Depends on:** Task 7.

## 6. Phase Definition of Done

- [x] Tasks 7–8 complete, with their tests passing
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] One commit covering Tasks 7 and 8
- [x] Task 8's human review accepted by the user
- [x] Feature DoD (overview §6) walked through with `agent-browser`
- [x] Tick Phase 05 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR4 (preference cap) | Task 8, tests 2–4 |
| FR12 (restores preference) | Task 8, test 6 |
| FR16 | Task 8, tests 1 and 5 (beside the rail) |
| FR17 | Task 7 `snapSize`; Task 8, test 5 |
| FR18 | Task 7; Task 8, test 5 |
| FR19 | Task 7; Task 8, test 4 |
| FR20 | Task 7 `stepSize`/`sizeLabel`; Task 8, tests 1–2 |
| FR21 | Task 8, test 5 (preview vs commit) |
| FR25 (cols) | Task 8, test 3 + drift guard |
| FR1 (every size) | Task 8, test 2 |
| FR27 (re-assert) | Task 8, test 2 (`verticalOverflow`) |
| FR28 (handle height) | Task 8, test 1 |
| NFR a11y | Task 8, tests 1, 2 and 8 |

## 8. Risks / open questions

None.
