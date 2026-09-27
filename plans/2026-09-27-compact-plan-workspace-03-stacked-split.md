# Compact plan workspace — Phase 03: Adjustable stacked split

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-compact-plan-workspace-00-overview.md`. Read
  these sections first:
  - §2.1 C, D (CW15, CW17) and E (FR29)
  - §2.2 N1–N3 and N6
  - §2.4: the one-handle, exact-share, 85%-midpoint, midpoint-to-larger
    and stored-values rulings
  - §3
  - §4.1–4.3
- **Depends on phases:** 02.

## 1. Summary

In the fitted stacked layout, the existing resize handle turns horizontal
and sits between the timeline and the requirements. Dragging it, or ↑/↓,
Home and End, snaps the timeline between 30%, 50%, 70% and Collapsed (the
Phase 02 bar). The ratio is saved under `panel-split` and painted before
first render. When this phase ends, the whole feature is complete, in one
commit.

## 2. Requirements (this phase)

### 2.1 Functional

- CW10–CW14 in full.
- CW15: the split's Collapsed stop.
- CW17: restoring a saved 30 or 70 on expanding.
- FR29 as amended: the exact share at each stop.

### 2.2 Non-functional

- N1: no overflow either way at every stop, and with the nav hidden.
- N2: the handle's hit area is at least 44px tall (drawn 1rem).
- N3: axe is clean at 390×844 at every stop and collapsed.
- N5: no animation.
- N6: the human review below.
- Pointer handling mustn't interfere with `touch-drag.ts`: the handle has no
  `data-drag-code`, and captures its own pointer.

### 2.3 Out of scope for this phase

- Free (non-snapping) split sizes.
- A split below 30rem of viewport height (CW14).
- Any side-by-side change: the side-by-side handle behaves exactly as
  before.

### 2.4 Assumptions

See overview §2.4. Phase-specific assumption: a pointer drag that ends in
`pointercancel` commits what's showing, as in side-by-side.

## 3. Existing code context (verified 2026-09-27, at `12059d6`)

**`src/components/reqs-resize.ts`,** exact, from collapsible-panels Phase
05. `reqs-resize.test.ts` covers it, and **that test must stay unchanged
and green**.

```ts
import type { ReqsColumns, ReqsState } from "./panel-state";

export type ReqsSize = 0 | ReqsColumns; // 0 = collapsed rail

export const REQS_WIDTH_REM: Readonly<Record<ReqsSize, number>> = { 0: 3, 1: 17.5, 2: 31.1, 3: 44.7 };

export function parseFit(raw: string): 0 | ReqsColumns { … }
export function sizeOf(state: ReqsState, fit: ReqsColumns): ReqsSize { … }
export function stateFor(size: ReqsSize, prev: ReqsState): ReqsState { … }

export function snapSize(widthRem: number, fit: ReqsColumns): ReqsSize {
  let best: ReqsSize = 0;
  for (let size = 1 as ReqsSize; size <= fit; size++) {
    const gap = Math.abs(widthRem - REQS_WIDTH_REM[size]) - Math.abs(widthRem - REQS_WIDTH_REM[best]);
    // The widths are tenths of a rem, so their midpoints aren't exact in
    // floating point; a pointer on a midpoint (within 1e-9) goes to the
    // larger size.
    if (gap <= 1e-9) best = size;
  }
  return best;
}

export function stepSize(size: ReqsSize, key: string, fit: ReqsColumns): ReqsSize | null { … }
// ArrowLeft/ArrowDown → max(0, size−1); ArrowRight/ArrowUp → min(fit, size+1); Home → 0; End → fit; else null
export function sizeLabel(size: ReqsSize): string { … } // "Collapsed" | "1 column" | "2 columns" | "3 columns"
```

**`src/components/panel-state.ts`,** the exports this phase uses or
extends:

```ts
export const NAV_KEY = "panel-nav";
export const REQS_KEY = "panel-reqs";
export const REQS_COLS_KEY = "panel-reqs-cols";
export type ReqsColumns = 1 | 2 | 3;
export interface ReqsState { collapsed: boolean; columns: ReqsColumns; }
export const DEFAULT_REQS: ReqsState = { collapsed: false, columns: 3 };
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface DatasetHost { dataset: DOMStringMap; }
export function safeStorage(): StorageLike | null;
export function applyReqsState(root: DatasetHost, state: ReqsState): void;
export function saveReqsState(state: ReqsState, storage: StorageLike | null = safeStorage()): void;
```

- `setNavHidden` shows the storage pattern: set or delete the attribute,
  then `try { storage?.setItem(…) / storage?.removeItem(…) } catch { /*
  Not persisting is fine … */ }`.
- `panel-state.test.ts` has `fakeStorage()`, `throwingStorage` and
  `host()` helpers, and a `describe("the inline head script in
  Base.astro")` drift guard with one `it` per key: `expect(base).toContain(`
  followed by `` `"${KEY}"` ``.

**`src/layouts/Base.astro`, the inline head script's `try`**

```js
        var s = localStorage, h = document.documentElement;
        if (s.getItem("panel-nav") === "hidden") h.dataset.nav = "hidden";
        if (s.getItem("panel-reqs") === "collapsed") h.dataset.reqs = "collapsed";
        var c = s.getItem("panel-reqs-cols");
        if (c === "1" || c === "2") h.dataset.reqsCols = c;
```

**`src/components/ReqsResizeHandle.tsx`,** side-by-side logic from
collapsible-panels Phase 05, as it stands after Phase 02 (see "Interfaces
from earlier phases" for its Props):

- **State.**
  - `const dragging = useRef(false);`
  - `const latest = useRef(reqs); if (!dragging.current) latest.current =
    reqs;`
  - `const fitCols: ReqsColumns = fit === 0 ? 1 : fit;`
  - `const size = sizeOf(reqs, fitCols);`
- **`onPointerDown`:**
  - `if (event.button !== 0) return;`
  - then `preventDefault()`, `setPointerCapture(event.pointerId)` and
    `dragging.current = true`
- **`onPointerMove`:**
  - `widthRem = (event.clientX − aside.getBoundingClientRect().left) /
    rootFontPx`, where `aside = document.getElementById("requirements")`
  - `next = snapSize(widthRem, fitCols)`
  - if `next !== sizeOf(latest.current, fitCols)`, then `latest.current =
    stateFor(next, latest.current); onChange(latest.current, false)`
- **`endDrag`** (both `onPointerUp` and `onPointerCancel`): `if
  (!dragging.current) return; dragging.current = false;
  onChange(latest.current, true)`.
- **`onKeyDown`:** `next = stepSize(size, event.key, fitCols)`. If it isn't
  `null`, `preventDefault()` and `onChange(stateFor(next, reqs), true)`.
- **The element:** `<div class="reqs-resize" role="separator" tabIndex={0}
  aria-orientation="vertical" aria-controls="requirements"
  aria-label="Resize requirements" aria-valuemin={0}
  aria-valuemax={fitCols} aria-valuenow={size}
  aria-valuetext={sizeLabel(size)} onPointerDown … onKeyDown />`.

**`src/components/Planner.tsx`** (after Phase 02)

- `const [reqs, setReqs] = useState<ReqsState>(DEFAULT_REQS);`
- `useEffect(() => setReqs(reqsStateFromDataset(document.documentElement.dataset)),
  []);`
- `function updateReqs(next: ReqsState, commit: boolean)`, which calls
  `setReqs(next)` and `applyReqsState(document.documentElement, next)`,
  then `saveReqsState(next)` if `commit`
- `const panesRef = useRef<HTMLDivElement>(null); const fit =
  useReqsFit(panesRef);`
- `<ReqsResizeHandle reqs={reqs} fit={fit} onChange={updateReqs} />`

**`src/styles.css`**

The fit group's stacked part, inside `@media (min-height: 30rem)`. Its
timeline rule changes in Task 7 (FR29 amended):

```css
  @container planner (width < 49.5rem) {
    .planner-timeline-area {
      position: static;
      flex: 0 1 auto;
      max-height: 50%;
    }

    .planner-panes > aside {
      flex: 1 1 0;
      min-height: 0;
      overflow-y: auto;
    }
  }
```

**The handle section** (collapsible-panels Phase 05) runs from the comment
"The resize handle between the sidebar and the timeline" to the end of its
`@media (min-height: 30rem) { @container planner (min-width: 49.5rem) {
.reqs-resize { align-self: stretch; position: relative; top: auto; height:
auto; } } }` fit override. In order:

- the base rule `.reqs-resize { display: none; }`
- the side-by-side block `@container planner (min-width: 49.5rem)`, which
  sets:
  - `.planner-panes { gap: 0 }`
  - `.reqs-resize { display: block; order: -1; flex: 0 0 1rem; … cursor:
    col-resize; touch-action: none; }`
  - `::before` with `inset-inline: -0.875rem`
  - `::after`, a 2px `var(--line)` line, gold on `:hover`/`:focus-visible`
- that fit override

Then come the preference caps (`@container planner (min-width: 63.1rem)` and
`(min-width: 76.7rem)`), then the collapsed blocks: side-by-side, then the
Phase 02 stacked blocks.

**`spec/layout.test.ts`,** `describe("requirements resize handle")`:

- It defines `const separator = (page: Page) => page.getByRole("separator",
  { name: "Resize requirements" });` and `stored(page, key)`.
- It contains this test, superseded by CW10:

  ```ts
    it("isn't shown in the stacked layout", async () => {
      const page = await openPage(browser, planUrl(), { width: 390, height: 844 });
      try {
        expect(await separator(page).isVisible()).toBe(false);
      } finally {
        await page.close();
      }
    });
  ```

- `describe("plan page fits the screen")` has the test "on a phone with the
  nav %s the timeline and requirements split the height". It asserts
  `timelineAtMostHalf` (`t.height <= p.height / 2 + 1`) and
  `asideAtLeastHalf` (`a.height >= p.height / 2 - 17`). **It stays
  unchanged and must stay green:** at the default of exactly 50%, with a
  16px handle, both hold.

### Interfaces from earlier phases (exact)

**From Task 4 (Phase 02)**

- In stacked, `:root[data-reqs="collapsed"]` shows `.reqs-rail` as a bar
  along the bottom, with `min-height: var(--reqs-bar-h)`, and hides
  `.requirements-scroll` and `.reqs-hide`.
- Those rules are in `@container planner (width < 49.5rem)`, **after** the
  side-by-side collapsed block.
- A following `@media (min-height: 30rem) { @container planner (width <
  49.5rem) { :root[data-reqs="collapsed"] .planner-timeline-area { flex: 1
  1 auto; max-height: none; } } }` is the last block in the planner
  section.
- `planWithPlacement(code: string): Promise<string>` is at module scope in
  `spec/layout.test.ts`.

**From Task 5 (Phase 02)**

- `src/components/reqs-fit.ts`: `export function useReqsFit(panesRef:
  RefObject<HTMLElement>): 0 | ReqsColumns;` It starts at 3, then reads
  `--reqs-fit` from the panes via a `ResizeObserver`.
- `ReqsResizeHandle`: `interface Props { reqs: ReqsState; fit: 0 |
  ReqsColumns; onChange: (next: ReqsState, commit: boolean) => void }`.
  There's no `ref` on the element, and it has no observer of its own.

## 4. Approach

**One handle, two axes.** `fit === 0` means stacked, and the same element
then resizes the split:

- `aria-orientation="horizontal"`, `aria-valuemin={30}`,
  `aria-valuemax={100}`, `aria-valuenow` = the split size (100 =
  collapsed), and `aria-valuetext` = `splitLabel`
- pointer y against the panes' rect → `snapSplit`
- keys → `stepSplit`

Side-by-side behaves exactly as before. The SSR render is side-by-side
(fit starts at 3) and flips after hydration, following the hydration
convention.

**The split's state is separate from `ReqsState`.** `SplitStop` lives in
`panel-state.ts`, next to the other stored keys. The handle works on
`Panels = { reqs, split }`, because the Collapsed stop changes
`reqs.collapsed` and the other stops change `split` (plus un-collapsing).
Collapsing never touches `split`, so expanding from the bar restores the
saved ratio for free (CW17).

**Reusing the snapping model.** `nearestIndex` is pulled out of
`snapSize`, which keeps its signature and its tests. `snapSplit` uses the
same helper over `SPLIT_SIZES = [30, 50, 70, 100]`, so the midpoints are
40, 60 and 85, and a tie goes to the larger size.

**CSS.** A new block goes right after the Phase 05 fit override (cascade
position 3). It's `@media (min-height: 30rem) { @container planner (width <
49.5rem) { … } }`, which:

- shows the handle
- orders the handle (1) and the aside (2)
- drops the pane gap
- draws a horizontal line
- sets `:root[data-split="30"|"70"] .planner-timeline-area { flex-basis }`

The fit group's stacked timeline rule becomes `flex: 0 0 50%; max-height:
none` (FR29 amended). Task 4's collapsed rule comes later with equal
specificity, so Collapsed still wins over any split.

## 5. Task breakdown

### Task 6: Pure snapping logic and stored state for the stacked split

- [x] **Description:** add `nearestIndex` (with `snapSize` refactored onto
  it), `split-resize.ts`, the split storage in `panel-state.ts` and the
  head-script line.
- **Files touched:**
  - `src/components/reqs-resize.ts`
  - `src/components/reqs-resize.test.ts` (tests added only; existing ones
    unchanged)
  - `src/components/split-resize.ts` (new)
  - `src/components/split-resize.test.ts` (new)
  - `src/components/panel-state.ts`
  - `src/components/panel-state.test.ts`
  - `src/layouts/Base.astro`
- **Tests first (red):**
  - **`reqs-resize.test.ts`,** a new `describe("nearestIndex")`:
    - `(10.2, [3, 17.5])` → 0
    - `(10.25, [3, 17.5])` → 1 (a tie goes to the later one)
    - `(37.9, [3, 17.5, 31.1, 44.7])` → 3 (a float midpoint)
    - `(-5, [1, 2])` → 0
    - `(99, [1, 2])` → 1
  - **`split-resize.test.ts`:**
    - **`snapSplit`:** −10 → 30, 39.9 → 30, 40 → 50, 59.9 → 50, 60 → 70,
      84.9 → 70, 85 → 100, 150 → 100.
    - **`stepSplit`:**
      - `(50,"ArrowDown")` → 70
      - `(70,"ArrowDown")` → 100
      - `(100,"ArrowDown")` → 100
      - `(100,"ArrowUp")` → 70
      - `(30,"ArrowUp")` → 30
      - `(70,"Home")` → 30
      - `(30,"End")` → 100
      - `(50,"ArrowLeft")`, `(50,"ArrowRight")` and `(50,"Enter")` → `null`
    - **`splitLabel`:** 30 → "Timeline 30%", 50 → "Timeline 50%", 70 →
      "Timeline 70%", 100 → "Requirements hidden".
    - **`splitSizeOf`:**
      - `({ reqs: { collapsed: true, columns: 2 }, split: 30 })` → 100
      - `({ reqs: { collapsed: false, columns: 2 }, split: 70 })` → 70
    - **`panelsFor`:**
      - `(100, { reqs: { collapsed: false, columns: 2 }, split: 30 })` →
        `{ reqs: { collapsed: true, columns: 2 }, split: 30 }`
      - `(50, { reqs: { collapsed: true, columns: 1 }, split: 30 })` →
        `{ reqs: { collapsed: false, columns: 1 }, split: 50 }`
  - **`panel-state.test.ts`:**
    - **`parseSplit`:** `"30"` → 30, `"70"` → 70, `"50"` → 50, and `null`,
      `undefined`, `""`, `"40"` and `"abc"` → 50.
    - **`applySplit`:** on `host()`, 30 gives a dataset of `{ split: "30"
      }`, then 50 gives `{}`.
    - **`saveSplit`** with `fakeStorage()`: 70 stores `"70"`, then 50
      removes the key. It doesn't throw with `throwingStorage` or `null`.
    - **Drift guard:** an `it("uses the same split key")` asserting that
      `Base.astro` contains `` `"${SPLIT_KEY}"` ``.
- **Implementation (green):**
  - **`reqs-resize.ts`:**

    ```ts
    // Index of the position nearest `value`; positions ascend. A tie (within
    // 1e-9, since the widths' float midpoints aren't exact) goes to the later,
    // larger one.
    export function nearestIndex(value: number, positions: readonly number[]): number;
    ```

    Move the 1e-9 comment onto it. `snapSize` becomes `return
    nearestIndex(widthRem, SIZES.slice(0, fit + 1).map((s) =>
    REQS_WIDTH_REM[s])) as ReqsSize;`, where `const SIZES: readonly
    ReqsSize[] = [0, 1, 2, 3];`. Its signature is unchanged.
  - **`panel-state.ts`,** after the reqs functions, following
    `setNavHidden`'s storage pattern:

    ```ts
    export const SPLIT_KEY = "panel-split";
    export type SplitStop = 30 | 50 | 70; // the timeline's share of the stacked planner, in %
    export const DEFAULT_SPLIT: SplitStop = 50;
    export function parseSplit(raw: string | null | undefined): SplitStop; // "30" → 30, "70" → 70, else 50
    export function applySplit(root: DatasetHost, split: SplitStop): void; // data-split "30"/"70"; deleted for 50
    export function saveSplit(split: SplitStop, storage: StorageLike | null = safeStorage()): void; // 50 → removeItem
    ```

  - **`split-resize.ts`** (new). The header comment says it's the stacked
    counterpart of `reqs-resize.ts`: the same snapping model on the other
    axis, where Collapsed counts as a 100% timeline.

    ```ts
    import type { ReqsState, SplitStop } from "./panel-state";
    import { nearestIndex } from "./reqs-resize";

    export type SplitSize = SplitStop | 100; // 100 = requirements collapsed to the bar
    export const SPLIT_SIZES: readonly SplitSize[] = [30, 50, 70, 100];
    export interface Panels {
      reqs: ReqsState;
      split: SplitStop;
    }
    export function splitSizeOf(panels: Panels): SplitSize;               // collapsed → 100; else split
    export function panelsFor(size: SplitSize, prev: Panels): Panels;     // 100 → collapse, keep split; n → expand, split n
    export function snapSplit(sharePct: number): SplitSize;               // SPLIT_SIZES[nearestIndex(sharePct, SPLIT_SIZES)]
    export function stepSplit(size: SplitSize, key: string): SplitSize | null;
      // ArrowUp → previous (min 30); ArrowDown → next (max 100); Home → 30; End → 100; other keys → null
    export function splitLabel(size: SplitSize): string;                  // "Timeline N%" | "Requirements hidden"
    ```

  - **`Base.astro`:** after the `panel-reqs-cols` lines, add `var p =
    s.getItem("panel-split"); if (p === "30" || p === "70") h.dataset.split
    = p;`.
- **Refactor:** none beyond `snapSize`.
- **Acceptance criteria:**
  - `pnpm test:unit` is green, including every pre-existing
    `reqs-resize.test.ts` case, unchanged.
  - `astro check` is clean.
  - No commit on its own: this commits with Task 7.
- **Depends on:** none (Phase 02 done).

### Task 7: Turn the resize handle horizontal in the stacked layout to snap the timeline/requirements split

- [x] **Description:** teach `ReqsResizeHandle` the stacked axis, give
  `Planner` the split state, add the stacked CSS, and replace the
  superseded Phase 05 test.
- **Files touched:**
  - `src/components/ReqsResizeHandle.tsx`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red),** in `describe("requirements resize handle")`,
  where `share` = `.planner-timeline-area` height ÷ `.planner-panes` height
  × 100:
  1. **Replace "isn't shown in the stacked layout"** (superseded by CW10)
     with two tests:
     - **"turns horizontal between the timeline and the requirements on a
       phone":** at 390×844, `expect.poll` shows `aria-orientation` is
       `"horizontal"`. Then:
       - `aria-valuemin` is `"30"`, `aria-valuemax` `"100"`,
         `aria-valuenow` `"50"`, `aria-valuetext` "Timeline 50%" and
         `aria-controls` "requirements"
       - the separator's box lies between the timeline's bottom and the
         aside's top, within 1px, and is 16px tall
       - `document.elementFromPoint(box.x + 20, box.y − 12)` and `(box.x +
         20, box.y + box.height + 12)` are both the separator (a 44px hit
         area, N2). Probe near the left edge: the right-aligned sticky
         "Hide requirements" button (`z-index: 1`) deliberately wins the
         hit test where it overlaps the lower hit area.
     - **"is hidden in the stacked layout below 30rem tall":** at 700×400,
       the separator isn't visible.
  2. **Keyboard, at 390×844.** Focus the separator, then check after each
     key (share within 1.5):

     | Key | `aria-valuetext` | Share | Also |
     | --- | --- | --- | --- |
     | ArrowDown | "Timeline 70%" | 70 | `panel-split` is `"70"` |
     | ArrowDown | "Requirements hidden" | — | `.reqs-rail` visible; `panel-reqs` is `"collapsed"` |
     | ArrowDown | "Requirements hidden" | — | |
     | ArrowUp | "Timeline 70%" | 70 | `panel-reqs` is `null` |
     | Home | "Timeline 30%" | 30 | `panel-split` is `"30"` |
     | End | "Requirements hidden" | — | |
     | ArrowUp | "Timeline 70%" | 70 | |
     | ArrowUp | "Timeline 50%" | 50 | `panel-split` is `null` |

     `horizontalOverflow` and `verticalOverflow` are both 0 after each
     step.
  3. **Pointer preview, then commit, at 390×844.** `p` is the panes' box.
     - Press the separator's centre and move to `p.y + 0.3 * p.height`
       (`steps: 5`) without releasing. Then:
       - "Timeline 30%"
       - share ≈ 30
       - `panel-split` is still `null`
     - `mouse.up()`: `panel-split` is `"30"`.
     - Drag again to `p.y + 0.92 * p.height` and release: "Requirements
       hidden", and `panel-reqs` is `"collapsed"`.
     - Drag from the handle, now just above the bar, to `p.y + 0.5 *
       p.height` and release:
       - "Timeline 50%"
       - `panel-reqs` is `null`
       - `panel-split` is `null`
  4. **No flash.** At 390×844, with `{ storage: { "panel-split": "70" },
     blockScripts: true }`: share ≈ 70.
  5. **Expanding restores the ratio (CW17).** At 390×844, seed `{
     "panel-reqs": "collapsed", "panel-split": "30" }`, then click
     `.reqs-rail`. Then share ≈ 30, and `.reqs-hide` is focused.
  6. **Side-by-side untouched.** At 1920×1080, seeding `"panel-split":
     "30"` leaves the aside at 715 and `aria-orientation` at `"vertical"`.
  7. **Axe.** At 390×844, seeded in turn with `{ "panel-split": "30" }`,
     `{}`, `{ "panel-split": "70" }` and `{ "panel-reqs": "collapsed" }`,
     `axeViolations` equals `[]`.
  8. **Fit rows.** Add these rows to the "the page doesn't scroll either
     way" `it.each`:
     - `[390, 844, { "panel-split": "30" }]`
     - `[390, 844, { "panel-split": "70" }]`
     - `[390, 844, { "panel-split": "70", "panel-nav": "hidden" }]`
- **Implementation (green):**
  - **`ReqsResizeHandle.tsx`:**

    ```ts
    interface Props {
      reqs: ReqsState;
      split: SplitStop;
      fit: 0 | ReqsColumns;
      onChange: (next: Panels, commit: boolean) => void;
    }
    ```

    - Re-add `const ref = useRef<HTMLDivElement>(null)` on the element: the
      stacked drag measures `ref.current?.parentElement` (the panes).
    - `latest` becomes `useRef<Panels>({ reqs, split })`, re-synced to `{
      reqs, split }` while not dragging.
    - `const stacked = fit === 0;`
    - **Side-by-side (unchanged in behaviour):**
      - `onPointerMove` compares `next` with `sizeOf(latest.current.reqs,
        fitCols)`, and sets `latest.current = { ...latest.current, reqs:
        stateFor(next, latest.current.reqs) }`.
      - `onKeyDown` sends `{ reqs: stateFor(next, reqs), split }`.
    - **Stacked:**
      - `size = splitSizeOf({ reqs, split })`.
      - `onPointerMove` computes `share = (event.clientY − rect.top) /
        rect.height * 100` from the panes' `getBoundingClientRect()`, then
        `next = snapSplit(share)`. If it differs from
        `splitSizeOf(latest.current)`, then `latest.current =
        panelsFor(next, latest.current); onChange(latest.current, false)`.
      - `onKeyDown` uses `stepSplit(size, event.key)`, then
        `onChange(panelsFor(next, { reqs, split }), true)`.
      - The ARIA is `aria-orientation="horizontal"`, valuemin 30, valuemax
        100, valuenow the size, valuetext `splitLabel(size)`.
    - `onPointerDown` and `endDrag` are unchanged. `aria-label`
      ("Resize requirements") and `aria-controls` stay the same in both
      axes.
    - Comment: one separator sits between the two panes in every layout,
      and the layout decides which axis it resizes.
  - **`Planner.tsx`:**
    - Add `const [split, setSplit] = useState<SplitStop>(DEFAULT_SPLIT);`,
      synced in the existing mount effect with
      `setSplit(parseSplit(document.documentElement.dataset.split))`.
    - Add:

      ```ts
      function updatePanels(next: Panels, commit: boolean) {
        updateReqs(next.reqs, commit);
        setSplit(next.split);
        applySplit(document.documentElement, next.split);
        if (commit) saveSplit(next.split);
      }
      ```

    - Render `<ReqsResizeHandle reqs={reqs} split={split} fit={fit}
      onChange={updatePanels} />`.
    - The Sidebar's `onHide`/`onShow` keep calling `updateReqs`.
  - **`styles.css`:**
    - In the fit group's stacked part, change `.planner-timeline-area`'s
      `flex: 0 1 auto; max-height: 50%;` to `flex: 0 0 50%; max-height:
      none;`. Add a comment: the saved split (below) moves this 50%
      default.
    - **Amended during execution:** the same rule also sets `z-index:
      auto`. The base rule's `z-index: 2` (for the unfitted sticky
      timeline) still makes a stacking context on a static *flex item*,
      which painted the timeline over the handle's upper hit area and
      failed test 1's probe above the line. Raising the handle's z-index
      instead would also have put it over the sticky "Hide requirements"
      button (`z-index: 1`), which must keep winning its overlap.
    - Immediately after the Phase 05 handle fit override, and before the
      preference caps, add:

      ```css
      /* In the fitted stacked page the same handle lies between the timeline
         and the requirements and snaps their split instead. Below 30rem tall
         the page isn't fitted, so there is no split and the handle stays
         hidden. The collapsed blocks at the end still win over data-split. */
      @media (min-height: 30rem) {
        @container planner (width < 49.5rem) {
          .planner-panes {
            gap: 0;
          }

          .reqs-resize {
            display: block;
            order: 1;
            flex: 0 0 1rem;
            position: relative;
            cursor: row-resize;
            touch-action: none;
          }

          .planner-panes > aside {
            order: 2;
          }

          /* Drawn 1rem tall; the hit area is 2.75rem. */
          .reqs-resize::before {
            content: "";
            position: absolute;
            inset-inline: 0;
            inset-block: -0.875rem;
          }

          .reqs-resize::after {
            content: "";
            position: absolute;
            inset-inline: 0;
            inset-block-start: calc(50% - 1px);
            height: 2px;
            border-radius: 1px;
            background: var(--line);
          }

          .reqs-resize:hover::after,
          .reqs-resize:focus-visible::after {
            background: var(--gold);
          }

          :root[data-split="30"] .planner-timeline-area {
            flex-basis: 30%;
          }

          :root[data-split="70"] .planner-timeline-area {
            flex-basis: 70%;
          }
        }
      }
      ```

- **Refactor:** `ReqsResizeHandle`'s old comment "The handle is hidden by
  CSS in the stacked layout (fit 0), so this only keeps the ARIA values in
  range there" is now wrong. Replace it with the one-separator comment
  above.
- **Acceptance criteria:**
  - Tests 1–8 pass.
  - Every other `describe("requirements resize handle")` test (the
    side-by-side ones) still passes, unchanged.
  - The Phase 04 test "split the height" still passes, unchanged.
  - Every Phase 02 stacked-collapse test still passes.
  - `pnpm check` passes.
  - Render check at 1920×1080, 900×800 and 390×844, and at 390×844 at each
    stop.
  - Commit (Tasks 6 and 7 together): "Let the stacked timeline/requirements
    split snap between 30, 50, 70 percent and collapsed".
- **Human review:** screenshots (or a recording) at 390×844:
  - the handle at rest, hovered and focused
  - each of 30%, 50%, 70% and Collapsed
  - mid-drag near a midpoint

  A pass means:
  - the handle is discoverable but quiet
  - each stop leaves both panes usable
  - dragging into Collapsed and back out feels natural

  The user accepts explicitly.
- **Depends on:** Task 6, and Phase 02 (Tasks 4–5).

## 6. Phase Definition of Done

- [x] Tasks 6–7 complete, with their tests passing
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] One commit covering Tasks 6 and 7
- [x] Task 7's human review accepted by the user
- [x] Feature DoD (overview §6) walked through with `agent-browser`
- [x] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CW10 | Task 7: test 1 |
| CW11 | Task 6: `stepSplit`/`splitLabel`; Task 7: tests 1–2 |
| CW12 | Task 6: `snapSplit`; Task 7: test 3 |
| CW13 | Task 6: panel-state tests, drift guard; Task 7: test 4 |
| CW14 | Task 7: test 1 (700×400) |
| CW15 (Collapsed stop) | Task 7: tests 2–3 |
| CW17 (restores 30/70) | Task 7: test 5 |
| FR29 (exact share) | Task 7: tests 2–5 |
| N1 | Task 7: tests 2 and 8 |
| N2 | Task 7: test 1 (hit area) |
| N3 | Task 7: test 7 |
| N6 | Task 7: human review |

## 8. Risks / open questions

None.
