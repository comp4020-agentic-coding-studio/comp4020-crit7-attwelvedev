# Workspace redesign — Phase 06: free resizing, fold order, mid-width drawer

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read §3,
  §4.2 (`LayoutPrefs`, `LayoutInput`, `LayoutResult`, `SnapTarget`,
  `computeLayout`, `reqsSnapTargets`) and §4.4 (constants).
- **Depends on phases:** 02 (the panel) and 05 (the region styling the
  docked panel uses).

## 1. Summary

A pure layout engine decides every width from the planner's container width
and the saved preferences. The rules:
- the timeline keeps its one-year minimum
- Requirements steps down by whole columns and then folds
- only after that does the sidebar shrink
- when even that fails, the sidebar becomes a drawer

Two `WorkspaceDivider`s replace the side-by-side half of `ReqsResizeHandle`.
They resize freely with soft snaps, fold or close past their minimums,
reset on double-click, are fully keyboard-operable, and show a frosted size
label.

Widths are saved per browser and applied before first paint. The details
panel docks as a third region, switching to two columns from its own width.

**Stays for Phase 07:** the stacked layout's split handle (the vertical axis
of `ReqsResizeHandle`, `split-resize.ts`, `panel-split`).

## 2. Requirements (this phase)

### 2.1 Functional

- WR32, WR33, WR34, WR35, WR36, WR37, WR38, WR39, WR41, WR42: all.
- WR40: everything except retiring `panel-split`, which happens in
  Phase 07.

### 2.2 Non-functional

- No horizontal overflow at any desktop width, in any state (details
  closed, narrow, wide, or drawer).
- The fitted page doesn't scroll vertically.
- Divider hit areas are at least 44px.
- axe is clean in each state.
- Motion: grid-column changes transition over 200ms only when not dragging,
  and none under `prefers-reduced-motion`.
- The drawer slides in over 200ms, or instantly under reduced motion.

### 2.3 Out of scope for this phase

The stacked layout: tabs and sheet are Phase 07. Until then, stacked keeps
today's split handle, and `details.mode === "sheet"` renders the Phase 02
fixed drawer.

### 2.4 Assumptions

See overview §2.4. Phase-specific: with default preferences and details
closed, the engine must reproduce today's sidebar widths. The existing
`spec/layout.test.ts:80-110` expectations (1920 → 715px, 1440 → 498px,
1100 and 900 → 280px, stacked at 800 and 390; and 3/2/1 columns) stay as
regression tests.

## 3. Existing code context (verified 2026-09-28)

**`src/components/panel-state.ts`**
- Exports:
  - `NAV_KEY="panel-nav"`, `REQS_KEY="panel-reqs"`,
    `REQS_COLS_KEY="panel-reqs-cols"`
  - `type ReqsColumns = 1|2|3`
  - `interface ReqsState { collapsed: boolean; columns: ReqsColumns }` and
    `DEFAULT_REQS`
  - `StorageLike`, `DatasetHost`, `safeStorage()`
  - `parseColumns`, `reqsStateFromDataset`, `applyReqsState`,
    `saveReqsState`
  - `SPLIT_KEY`, `SplitStop`, `DEFAULT_SPLIT`, `parseSplit`, `applySplit`,
    `saveSplit`
  - `setNavHidden`
- `panel-state.test.ts:162-184` checks that `Base.astro`'s inline script
  uses the same keys.

**`src/layouts/Base.astro:20-27`** (the inline head script):

```js
try { var s = localStorage, h = document.documentElement;
  if (s.getItem("panel-nav") === "hidden") h.dataset.nav = "hidden";
  if (s.getItem("panel-reqs") === "collapsed") h.dataset.reqs = "collapsed";
  var c = s.getItem("panel-reqs-cols"); if (c === "1" || c === "2") h.dataset.reqsCols = c;
  var p = s.getItem("panel-split"); if (p === "30" || p === "70") h.dataset.split = p;
} catch (e) {}
```

**`src/components/reqs-resize.ts`**
- `ReqsSize = 0|ReqsColumns`
- `REQS_WIDTH_REM = {0:3, 1:17.5, 2:31.1, 3:44.7}`
- `parseFit`, `sizeOf`, `stateFor`, `nearestIndex`, `snapSize`,
  `stepSize`, `sizeLabel`

**`src/components/reqs-fit.ts`**
- `useReqsFit(panesRef): 0 | ReqsColumns` reads the CSS `--reqs-fit`
  through a ResizeObserver.
- Planner also uses `fit` for the undo toast's `undo-toast-above-bar`.

**`src/components/ReqsResizeHandle.tsx`**
- Props: `{ reqs: ReqsState; split: SplitStop; fit: 0 | ReqsColumns;
  onChange(next: Panels, commit: boolean) }`.
- It handles both axes: `stacked = fit === 0`.

**`src/components/split-resize.ts`**
- `Panels { reqs: ReqsState; split: SplitStop }`, plus `snapSplit`,
  `stepSplit` and `splitLabel`. It stays until Phase 07.

**`Planner.tsx`**
- State: `reqs` and `split`, `updateReqs(next, commit)` and
  `updatePanels(next, commit)`.
- `showInSidebar` expands a collapsed sidebar.
- It renders `<ReqsResizeHandle>` last in `.planner-panes`.
- `Sidebar`'s `button.reqs-hide` (the chevron riding the handle) and
  `button.reqs-rail` (the collapsed rail, still a drop target) stay.

**`src/styles.css`**
- :1895-1970 has the tier container queries (49.5 / 63.1 / 76.7rem). They
  set `--reqs-fit`, the aside `flex-basis: var(--reqs-w-N)`, and
  `.available-courses` tracks `repeat(N, 13rem)`.
- :2180-2210 has the `data-reqs-cols` preference caps.
- :2209-2250 has the collapsed rail.
- The comment at :1895 records that each threshold is the sidebar width +
  a 1rem handle + `--timeline-min`.

**Tests to rewrite**
- `spec/layout.test.ts`:
  - "requirements resize handle" (:1356-1690): keyboard steps,
    localStorage, preview-then-save, can't exceed fit, horizontal on
    phones, split steps. Keep the stacked-axis cases for Phase 07.
  - "hide requirements on the handle" (:2145).
  - "requirements sidebar collapse" (:548).
  - "plan page fits the screen" (:375).
- `src/components/reqs-resize.test.ts`, including the :109 token-sync
  check.
- `src/components/panel-state.test.ts`.

### Interfaces from earlier phases (exact)

From Phase 02:

```ts
// CourseDetailsPanel renders <aside class="details-panel" aria-label="Course details"> with its header
// Planner: details: DetailsState (details.code !== null = open), openDetails(code, focus?)
```

From Phase 05:
- CSS classes `.region` and `.glass`, and the tokens `--r-region`,
  `--glass*`.
- `.details-head.glass`.
- The glass allowlist includes `.size-tip`.
- The timeline (Task 15, as built after its review on 2026-09-29):
  - `.timeline-scroll` is the timeline's only scroller, in both axes.
    `.planner-timeline-area` is a region that doesn't scroll (a flex
    column with `overflow: hidden`), and the toolbar and legend sit fixed
    above the scroller.
  - It's a one-row grid of `div.timeline-year[data-year]`, each placed in
    its column explicitly. Each year is a sticky transparent
    `.timeline-year-head` (the label's row plus its terms' sticky
    `.term-top` rows), then two `section.term[data-term]`.
  - A term is a 13rem card plus `--term-pad` (0.5rem) either side. The
    region has no inner gutter, and the scroller's ends are padded by
    `--edge` (0.5rem). `--year-band` is 2.75rem, or 1.9rem below the
    49.5rem container.
  - The frosted header is one element, `div.timeline-glass.glass`, which
    shares the years' grid row. It's sticky on both axes and `100cqi`
    wide, since `.timeline-scroll-wrap` is an inline-size container. It
    never scrolls sideways because Chromium blurred only the part of a
    scroll-wide strip that was on screen at first paint. The hairlines
    are `::after` lines drawn over it. In the glass allowlist,
    `.timeline-glass` replaces `.timeline-year-head`.
  - `--timeline-min` (31rem) is unchanged. Two terms and their padding
    now come to about 28rem, so it has slack.
  - The ‹ › buttons (`.timeline-toolbar`) float over the band's right end,
    and are hidden below 49.5rem.
  - The gold cutoff line is gone. Completed terms say "Completed" in their
    headings.

## 4. Approach

### 4.1 `computeLayout` (pure; `src/components/workspace-layout.ts`)

Constants (overview §4.4), all in px, computed from `remPx`:
- `DIVIDER = 1rem`, `TL_MIN = 31rem`, `RAIL = 3rem`, `REQS_MIN = 17.5rem`
- `CARD = 13rem`, `GAP = 0.6rem`
- `DETAILS_MIN = 360`, `DETAILS_DEFAULT = 440`, `DETAILS_WIDE = 760`,
  `DETAILS_MAX = 960`
- `PHONE = 49.5rem`

The steps:
1. If `containerPx < PHONE`, return `mode: "stacked"`, with `details: {mode:
   "sheet"}` when open and `{mode: "closed"}` otherwise.
2. `target(n) = gridOverheadPx + n·CARD + (n−1)·GAP` for n = 1..3, where
   `gridOverheadPx` defaults to 4.5rem.
3. **Requirements width.**
   - `reqs = prefs.reqsFolded ? RAIL : (prefs.reqsWidthPx ?? target(3))`,
     clamped to ≥ `REQS_MIN`.
   - `details = open ? clamp(prefs.detailsWidthPx, DETAILS_MIN,
     DETAILS_MAX) : 0`.
   - `avail = containerPx − DIVIDER·(open ? 2 : 1)`.
4. **Step Requirements down**, while `reqs + details + TL_MIN > avail` and
   `reqs !== RAIL`:
   - If `reqs > target(1)`, set `reqs` to the largest `target(n) < reqs`.
     Whole columns, so a free width between targets drops to the target
     below it.
   - Otherwise set `reqs = RAIL`. Also set `autoFolded = open`: the fold is
     only "automatic" if details forced it.
5. **Then shrink the sidebar**: `details = min(details, max(DETAILS_MIN,
   avail − reqs − TL_MIN))`. It only ever shrinks; without the `min` it
   would widen a docked 440 to fill the room (review ruling 1).
6. **Drawer fallback.** If it still doesn't fit and details are open,
   recompute steps 3–5 with details closed, then return `details: {mode:
   "drawer", px: min(DETAILS_DEFAULT, containerPx)}`.
7. `timelinePx = avail − reqs − (docked ? details : 0)`.

The rail's soft snap (WR33) is the release-to-fold zone: any Requirements
width below `REQS_MIN − 60` releases to the rail, so a drag toward the rail
can't come to rest partway there. `reqsSnapTargets` covers only the column
widths.

`reqsSnapTargets(remPx, overhead)` returns `[{px: target(1), label: "One
card column"}, {px: target(2), label: "Two card columns"}, {px: target(3),
label: "Three card columns"}]`.

Also exported, all pure and unit-tested:

```ts
export const DETAILS_SNAPS: SnapTarget[];   // [{px:440,label:"Default width"},{px:680,label:"Two-column details"}]
export function snap(px: number, targets: SnapTarget[], threshold?: number): { px: number; target: SnapTarget | null };
export interface DragOutcome { prefs: LayoutPrefs; label: string; warn: boolean; snapped: boolean; release: "fold" | "close" | null }
export function dragPrefs(which: "reqs" | "details", start: LayoutPrefs, startLayout: LayoutResult,
  dxPx: number, targets: SnapTarget[], input: LayoutInput): DragOutcome;
export function keyPrefs(which: "reqs" | "details", key: string, shift: boolean,
  layout: LayoutResult, prefs: LayoutPrefs, input: LayoutInput): LayoutPrefs | "toggle" | null;
export function unfoldPrefs(input: LayoutInput): { prefs: LayoutPrefs } | { error: string };
```

**`dragPrefs` rules:**
- Requirements: the raw width is `startWidth + dx`.
  - Below `REQS_MIN − 60`: `release: "fold"` with the label "Release to
    fold requirements".
  - Otherwise clamp to `[REQS_MIN, avail − (open ? DETAILS_MIN : 0) −
    TL_MIN]` and snap.
  - If the raw width passes the maximum by more than 8px, the label is "The
    timeline needs room for one year" and `warn` is true.
  - When details are open and the new width leaves them less than
    `detailsWidthPx`, the returned prefs also lower `detailsWidthPx` to
    `avail − reqs − TL_MIN` (never below `DETAILS_MIN`). Otherwise
    `computeLayout`'s fold order would step Requirements back down a whole
    column mid-drag (review ruling 2).
- Details: the raw width is `startWidth − dx`.
  - Below `DETAILS_MIN − 70`: `release: "close"` with the label "Release to
    close details".
  - Otherwise clamp to `[DETAILS_MIN, min(DETAILS_MAX, avail − RAIL −
    TL_MIN)]` and snap to `DETAILS_SNAPS`.
- Otherwise the label is the snap label or `"<n> px"`, with ", requirements
  fold" appended when the result would auto-fold.

**`keyPrefs` rules:**
- ←/→ move ∓16px, or 64px with Shift.
- On Requirements, ← below the minimum folds and → from folded unfolds.
- Home and End go to the minimum (Requirements folds) or the maximum.
- Enter returns `"toggle"`: fold or unfold Requirements, or switch details
  between `DETAILS_DEFAULT` and `DETAILS_WIDE`.

**`unfoldPrefs`** (WR35, the rail while auto-folded):
- If the saved or default Requirements width fits beside `DETAILS_MIN`,
  keep it and lower `detailsWidthPx` to `avail − reqs − TL_MIN`.
- Otherwise try `REQS_MIN` with `DETAILS_MIN`.
- Otherwise return `{ error: "Not enough room for requirements and details
  together. Close details, or widen the window." }`.

### 4.2 Rendering

- `.planner-panes` becomes a grid in side-by-side mode:
  `grid-template-columns: var(--reqs-col) 1rem minmax(0, 1fr)
  var(--div2-col) var(--details-col)`. `Planner` sets those three custom
  properties from `LayoutResult`.
- The aside's own tier `flex-basis` and `--reqs-fit` rules are deleted.
- Card grids: `.available-courses` uses `grid-template-columns:
  repeat(auto-fill, minmax(max(13rem, calc((100% - (var(--cols) - 1) *
  0.6rem) / var(--cols))), 1fr))`, where `style="--cols: N"` comes from
  `data-columns`. So a group never shows more columns than it has courses
  (collapsible-panels FR3), and cards stretch between snap points.
- First paint. The head script sets these on `<html>` from storage:
  - `--reqs-pref`
  - `--details-pref`
  - `data-reqs="collapsed"`

  The side-by-side CSS default is `--reqs-col: min(var(--reqs-pref,
  44.7rem), 100cqi - 31rem - 1rem)`. So a server-rendered page never
  overflows before hydration. `computeLayout` then refines it.
- `details.mode === "drawer"`: the panel is `position: absolute` over the
  timeline's right edge inside `.planner-layout`, with the `.glass` edge and
  a shadow. The timeline stays interactive.
- WR36: `.details-panel { container: details / inline-size }`, and
  `@container details (min-width: 680px)` puts the body in two columns. The
  header's toggle has `aria-pressed = layout.details.px >= 680`.

### 4.3 Phase 1 review rulings (user, 2026-09-29)

1. `computeLayout` step 5 only shrinks details (the `min` in §4.1).
2. A Requirements drag squeezes `detailsWidthPx` rather than letting the
   engine step Requirements down (§4.1 `dragPrefs`).
3. There was no `.details-body` or wide toggle. Task 18 wraps every
   section after `.details-head` in `div.details-body` (two-column
   auto-flow grid at ≥ 680px) and adds the toggle to `.details-nav`.
4. `.planner-layout`'s containment pins `position: fixed` descendants, so
   the panel sits in `.planner-panes` only when docked or a drawer. In
   `sheet` mode it stays after `.planner-layout`, as in Phase 02.
5. `useContainerWidth` returns 0 before measuring. Planner treats 0 as
   "unmeasured": it renders the side-by-side chrome, sets no inline column
   properties (the CSS defaults lay it out), and nothing reads it as
   stacked.
6. Sidebar keeps rendering `button.reqs-hide`. Side by side, CSS places it
   in the Requirements divider's grid column; stacked, it stays on the
   stacked handle until Phase 07.
7. `gridOverheadPx` is the largest overhead across all the aside's
   `.available-courses`, not the first one's, so nested groups keep their
   columns at a snap target.

Routine calls:
- The palette's `stacked` flag also moves off `fit`.
- The new track formula is scoped to the Requirements aside (not the
  palette's results), and its cards drop their fixed 13rem width.
- The new browser describes live in `spec/layout/workspace-resize.test.ts`.
- `.planner-panes[data-rail]` marks a rail from the layout (an auto-fold has
  no root attribute).

## 5. Task breakdown

### Task 16: `workspace-layout.ts`, the pure layout engine

- [x] **Done 2026-09-29.** Built with review rulings 1 and 2 (§4.3).
  Divider-made widths are whole pixels, and a snapped width rounds up
  (715.2 → 716) so its columns still fit. In a release zone the preview
  holds at the minimum. The constants are exported (`DETAILS_MIN`,
  `DETAILS_DEFAULT`, `DETAILS_TWO_COLUMN` 680, `DETAILS_WIDE` 760,
  `DETAILS_MAX`, `SNAP_THRESHOLD`).

- **Description:** Implement this file's §4.1 exactly.
- **Files touched:**
  - new `src/components/workspace-layout.ts`
  - new `src/components/workspace-layout.test.ts`
- **Tests first (red):** in `workspace-layout.test.ts`, with `remPx = 16`
  and the default overhead (72px):
  - "defaults reproduce today's widths". At ≥1100px viewports the planner
    container is the viewport minus 256px (13rem nav plus 1.5rem padding on
    each side); pin that with a comment. With details closed:
    - `containerPx` 1664 (a 1920 viewport) gives `reqsPx` 715.2 (44.7rem)
    - 1184 (1440) gives 497.6
    - 844 (1100) gives 280
    - 780 gives stacked
  - "opening details at 1664 steps requirements to two columns and docks
    440".
  - "at 1280-wide content, requirements go 3 → 2 → 1 → rail before details
    shrink below 440": walk a table of container widths and assert
    `reqsPx` / `details.px`, with `autoFolded` true only for rail-by-details.
  - "the timeline never drops below 496" in every docked case (a
    property-style loop from 800 to 2000 in steps of 10, details open and
    closed).
  - "drawer when docking can't fit": at 844 with details open, the result
    is `details.mode === "drawer"`, and `reqs` is what it would be with
    details closed.
  - "a folded preference stays folded, with `autoFolded` false".
  - `snap`: 434 snaps to 440 within 16, and 420 doesn't.
  - `dragPrefs`:
    - a Requirements drag past the minimum by 60 gives `release: "fold"`
    - a details drag to 690 snaps to 680 with the label "Two-column
      details"
    - an over-max drag warns "The timeline needs room for one year"
  - `keyPrefs`: ArrowRight +16, Shift +64, Enter gives "toggle", Home on
    Requirements folds.
  - `unfoldPrefs`: at 1184 (auto-folded with details at 440) it returns
    `reqsWidthPx` 280 and `detailsWidthPx` 376. At 1024 (a 1280 viewport)
    it returns the error.
  - `reqsSnapTargets(16, 72)` gives 280, 497.6 and 715.2.
- **Implementation (green):** the exports in overview §4.2 and this file's
  §4.1.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm vitest run --project unit src/components/workspace-layout.test.ts`
    passes.
  - The module imports nothing from Preact or the DOM.
- **Depends on:** None.

### Task 17: Saved widths: storage keys and the head script; retire the column preference

- [x] **Done 2026-09-29.** Also exports `DEFAULT_LAYOUT_PREFS`. The head
  script applies the same 48–4000 integer check as `loadLayoutPrefs`.

- **Description:** WR40, except `panel-split`.
- **Files touched:**
  - `src/components/panel-state.ts`
  - `src/components/panel-state.test.ts`
  - `src/layouts/Base.astro`
- **Tests first (red):** in `panel-state.test.ts`:
  - `loadLayoutPrefs(storage)`:
    - empty storage gives `{reqsWidthPx: null, reqsFolded: false,
      detailsWidthPx: 440}`
    - `panel-reqs-w="600"` gives 600
    - an invalid value (`"abc"`, `"-5"` or `"99999"`) falls back to the
      default
    - storage that throws gives the defaults
  - `saveLayoutPrefs(prefs, storage)` writes `panel-reqs-w` (or removes it
    when null), `panel-details-w` and `panel-reqs`, and removes the
    retired `panel-reqs-cols`.
  - The key-sync test (:162-184) now also expects the head script to read
    `panel-reqs-w` and `panel-details-w` and to set `--reqs-pref` and
    `--details-pref`. The old `panel-reqs-cols` line stays until Task 18,
    which removes it along with its only consumer.
- **Implementation (green):**

  ```ts
  export const REQS_W_KEY = "panel-reqs-w";
  export const DETAILS_W_KEY = "panel-details-w";
  export function loadLayoutPrefs(storage?: StorageLike | null): LayoutPrefs;
  export function saveLayoutPrefs(prefs: LayoutPrefs, storage?: StorageLike | null): void;
  export function applyLayoutPrefs(root: DatasetHost & { style: { setProperty(n: string, v: string): void; removeProperty(n: string): void } }, prefs: LayoutPrefs): void;
  ```

  - Valid widths are integers from 48 to 4000. `reqsFolded` reads the same
    `panel-reqs` key that `ReqsState.collapsed` uses.
  - `Base.astro`'s script: add two guarded `setProperty` calls after the
    existing lines. Nothing is removed in this task, so every existing
    consumer still compiles.
- **Refactor:** None. The removals belong to Task 18, which removes their
  only consumer.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - The new functions are exported and unit-tested. Nothing in the UI reads
    them yet.
- **Depends on:** Task 16 (the `LayoutPrefs` type).

### Task 18: `WorkspaceDivider`s: live resize, soft snaps, fold and close, reset, keyboard, size label; docked details column

- [x] **Done 2026-09-29.** The specs are in `spec/layout/workspace-resize.test.ts`.
  What was built, where it goes past or differs from the steps:
  - Dividers render once the planner is measured (§4.3 ruling 5). They
    carry an optional `onDragStart` prop for the overhead measurement.
  - `gridOverheadPx` is `max(4.5rem, the largest measured)`, so today's
    default widths hold.
  - `workspace-layout.ts` gained `dividerValue` for the aria values.
  - Before measurement, the CSS `--reqs-col` default keeps the old tiers
    (`--reqs-tier`), so a 1440 window doesn't jump on hydration.
  - `.planner-panes[data-measured]` / `[data-rail]` drive the rail once
    measured.
  - The drawer stays the Phase 02 fixed drawer outside the panes until
    Task 19 styles it; only a docked panel moves into the grid.
  - The two-column query is `628px`: 680px less its borders, padding and a
    reserved 10px gutter (`scrollbar-gutter: stable`).
  - Hide and show hand focus over in a layout effect.
  - `ReqsState` keeps `collapsed` only, backed by `LayoutPrefs.reqsFolded`.
    Its dataset and storage helpers were removed with the column
    preference. `saveLayoutPrefs` no longer clears `panel-reqs-cols`
    (the acceptance grep forbids the string, and nothing reads it).
  - User ruling: "every course card stays inside its group" now fails only
    on a card *past* its group's edge. Stretched nested cards end flush,
    as their placed rows do.

- **Description:** WR32–WR34, WR37–WR39, WR41, and the WR36 toggle.
- **Files touched:**
  - new `src/components/WorkspaceDivider.tsx`
  - new `src/components/use-container-width.ts`
  - `Planner.tsx`, `Sidebar.tsx`, `CourseDetailsPanel.tsx`
  - `ReqsResizeHandle.tsx`: stacked axis only now
  - delete `reqs-fit.ts`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** rewrite "requirements resize handle" (:1356-1690)
  as `describe("workspace dividers")` at 1920×1080. Keep its
  stacked-axis cases unchanged for Phase 07.
  - "two separators when details are open, one when closed", each with
    `role="separator"`, `aria-orientation="vertical"` and `aria-controls`.
    Each hit box is at least 44px wide.
  - "dragging the requirements divider resizes freely": releasing at an
    arbitrary width more than 16px from any target leaves the aside at that
    width ±1.
  - "soft snap": releasing within 16px of the two-column target lands
    exactly on it, and the three-course group then has 2 grid tracks.
  - "size label during drag": `.size-tip` appears with the snap label while
    the pointer is down, and is gone after release.
  - "fold past minimum": dragging far left folds to the rail, with `aria-
    expanded` "false" on the rail. Dragging the rail outward unfolds it.
  - "details divider": dragging to about 690 snaps to 680. The panel body
    then has two columns (`.details-body` computed
    `gridTemplateColumns` has 2 tracks), and the wide toggle is
    `aria-pressed="true"`.
  - "the panel docks as the third grid column": with `?course=COMP2100` at
    1920×1080, `.details-panel` is a child of `.planner-panes` with
    `data-mode="docked"`, and its left edge meets the details divider.
    Docked, it no longer covers the plan header. `button.completed-toggle`,
    both `.history-button`s and the More options toggle must each be the
    element hit at its own centre (`elementFromPoint`). Before this phase
    the fixed drawer covered them. The undo-redo plan accepted that
    (user ruling, 2026-09-29) on the understanding that this phase fixes
    it.
  - "release to close": dragging the details divider far right closes the
    panel and removes `?course`.
  - "double-click resets": each divider returns to its default (Requirements
    to three columns if they fit; details to 440).
  - "keyboard": Arrow ±16, Shift+Arrow ±64 and Home/End on each divider.
    `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext`
    update. `aria-valuetext` is the snap label, `"<n> px"`, or "Folded" on
    the rail. Enter folds and unfolds Requirements, and switches details
    between 440 and 760.
  - "widths survive reload": after a drag, reloading the page restores both
    widths.
  - "the rail is still a drop target": keep the :913 suite green.
  - "no overflow in any state": `horizontalOverflow(page) === 0` at 1920,
    1440 and 1280, with details closed, narrow and wide.
  - The :80-120 default-width and column tests stay green unchanged.
- **Implementation (green):**
  - `use-container-width.ts`: `export function useContainerWidth(ref:
    RefObject<HTMLElement>): number` (a ResizeObserver, 0 before mount).
  - `WorkspaceDivider.tsx`. Its default export takes:

    ```ts
    interface Props {
      which: "reqs" | "details";
      layout: LayoutResult;
      input: LayoutInput;
      targets: SnapTarget[];
      onPreview: (prefs: LayoutPrefs) => void;
      onCommit: (prefs: LayoutPrefs, release: "fold" | "close" | null) => void;
      onToggle: () => void;
      onReset: () => void;
    }
    ```

    `aria-valuetext` is the snap label for the current width, `"<n> px"`,
    or "Folded" when Requirements is on the rail.

    - Pointer capture on down. Moves call `dragPrefs` and then `onPreview`,
      and add the `resizing` class to `.planner-panes` (no transition).
      Release calls `onCommit`.
    - `onDblClick` calls `onReset`. `onKeyDown` calls `keyPrefs`.
    - It renders `.size-tip.glass` while dragging, and a 2px `::before`
      line. The hit area is at least 44px, from a wider transparent
      `::after`.
  - The Requirements divider hosts the existing `button.reqs-hide` chevron
    (which Sidebar renders outside the aside today), per the
    course-card-redesign ruling. Sidebar still renders it; CSS places it in
    the divider's grid column (§4.3 ruling 6).
  - `Planner`:
    - `const containerPx = useContainerWidth(layoutRef)`
    - `const [prefs, setPrefs] = useState(DEFAULT)`, read in an effect from
      `loadLayoutPrefs()`
    - `const layout = computeLayout({...})`, with `gridOverheadPx`
      measured once at drag start as the largest aside-width-minus-
      `clientWidth` across the aside's `.available-courses` (§4.3 ruling 7)
    - set the `--reqs-col`, `--div2-col` and `--details-col` properties
    - `onCommit` calls `saveLayoutPrefs`, and `release === "close"` calls
      `setDetails(closeDetails)`
    - `ReqsResizeHandle` renders only when `layout.mode === "stacked"`, and
      its props become `{ reqs: ReqsState; split: SplitStop; onChange(next:
      Panels, commit: boolean): void }`. The `fit` prop and the
      side-by-side branch are deleted.
    - replace the `fit === 0` toast check with `layout.mode === "stacked"`
  - `CourseDetailsPanel` gains two props:
    - `onToggleWide: () => void`. The header's wide toggle
      (`button[aria-pressed]`, "Widen details" / "Narrow details") calls it.
      `Planner` switches `detailsWidthPx` between 440 and 760.
    - `mode: LayoutResult["details"]["mode"]`, rendered as `data-mode`.
  - `Planner` moves `<CourseDetailsPanel>` from after `.planner-layout`
    (Phase 02) into `.planner-panes`, after the details divider, so it
    occupies the grid's last column. It does so when docked or a drawer
    only; in `sheet` mode it stays where it is (§4.3 ruling 4).
  - Add `.details-panel { container: details / inline-size }` and the
    `@container details (min-width: 680px)` rule that puts the body in two
    columns. Task 18's own tests use both.
  - CSS: the grid from this file's §4.2. Delete the tier `flex-basis` rules
    and the `data-reqs-cols` caps, but keep the 49.5rem stacked /
    side-by-side switch. Add the new `.available-courses` track formula.
- **Refactor:** now that the side-by-side path no longer uses them, remove:
  - `REQS_COLS_KEY`, `ReqsColumns`, `parseColumns`, and `columns` from
    `ReqsState` (keep `collapsed`)
  - the `panel-reqs-cols` line in `Base.astro`, and its expectation in the
    key-sync test
  - `reqs-resize.ts` and `reqs-resize.test.ts`. First move `nearestIndex`
    and its test cases into `split-resize.ts` and `split-resize.test.ts`,
    because `split-resize.ts:8` imports it and stays until Phase 07.
  - `--reqs-fit` and `parseFit`
- **Acceptance criteria:**
  - `pnpm check` passes.
  - `grep -rn "reqs-fit\|--reqs-fit\|panel-reqs-cols\|reqsCols" src` finds
    nothing.
- **Depends on:** Tasks 16, 17.

### Task 19: Fold order, the auto-fold notice and rail recovery, the mid-width drawer, and the two-column details container query

- [x] **Done 2026-09-29.** The user accepted the human review ("it all
  feels good"), including the "Requirements folds first" ruling and the
  close/fold asymmetry: details close in their header, Requirements folds
  on its divider (kept as designed).
  - The review raised the details scroll track's square corners. It is now
    rounded to the region's inner corners, checked with real scrollbars
    (Playwright without `--hide-scrollbars`).
  - The fold notice is a no-button toast (`mode: "notice"`), the only
    announcement, per the Phase 03 ruling. It isn't shown for a page that
    loads folded, or mid-drag.
  - `.planner-layout` clips sideways (`overflow-x: clip`), because the
    easing details column and the sliding drawer poked out for a frame.
  - Specs read geometry after `settle()` (in `spec/layout/helpers.ts`),
    now that widths ease.
  - The review also found a Phase 05 bug, fixed in its own commit: wide
    years, from the frosted strip sizing the year columns.

- **Description:** WR35, WR42, and WR36's container query.
- **Files touched:**
  - `Planner.tsx`, `Sidebar.tsx` (rail label and name),
    `CourseDetailsPanel.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** `spec/layout.test.ts`, `describe("fold order and
  drawer")`:
  - At 1280×800 (container 1024px), with details closed, Requirements has
    2 columns.
  - At 1440×900, opening `?course=COMP2100` steps Requirements down by
    whole columns until it folds. Its width at each step is one of the
    targets or the rail, and the timeline is ≥ 496px.
  - When it folds, the live region and the toast say "Requirements folded
    to make room for course details", and the rail's accessible name
    contains "folded to make room".
  - Closing details restores the previous Requirements width.
  - "rail recovery": while auto-folded at 1440×900, activating the rail
    unfolds it at one column and narrows details to about 376px, and both
    are visible with the timeline ≥ 496. At 1280×800 (also auto-folded) it
    announces the `unfoldPrefs` error instead.
  - "drawer at mid widths": at 900×800 with `?course=COMP2100`, the panel
    has `data-mode="drawer"` and overlaps the timeline region's right edge.
    Its divider isn't rendered. A timeline card underneath and to the left
    can still be clicked (its title opens its own details). No horizontal
    overflow.
  - "the two-column body follows the panel's own width": set the details
    width with the keyboard to 679 and then 680. The body has one column,
    then two. The container query from Task 18 does this, not a class.
  - "reduced motion": with `page.emulateMedia({reducedMotion: "reduce"})`,
    `.planner-panes`' and `.details-panel`'s computed
    `transition-duration` is 0s.
  - axe with the drawer open at 900×800, and docked at 1280×800.
- **Implementation (green):**
  - `Planner`:
    - Watch `layout.autoFolded` rising from false to true (skipped while
      `resizing`) and announce and toast the notice.
    - The rail's `onShow` calls `unfoldPrefs(input)`: on `{prefs}` it saves
      them, and on `{error}` it announces.
  - `Sidebar`: the rail's name and label get ", folded to make room for
    course details" when `autoFolded`.
  - CSS: the drawer styling for `.details-panel[data-mode="drawer"]` from
    this file's §4.2, and the transitions from this file's §2.2, with
    reduced motion off. The container query itself landed in Task 18.
- **Refactor:** None expected.
- **Acceptance criteria:** `pnpm check` passes.
- **Human review:** the running app at 1920×1080, 1280×800 and 900×800.
  Drag both dividers, fold and unfold, open and close details, and try the
  drawer. A pass means:
  - resizing feels direct
  - snaps help without fighting you
  - the fold order feels right when comparing a course against the
    requirements
  - the drawer doesn't feel cramped

  This is also the moment to check the spec §6 ruling "Requirements folds
  first".
- **Depends on:** Task 18.

## 6. Phase Definition of Done

- [x] Tasks 16–19 complete, with tests passing
- [x] `pnpm test` passes
- [x] `pnpm check` passes (941 tests, 2026-09-29)
- [x] Task 19 human review accepted by the user
- [x] Tick Phase 06 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR35 | Tasks 16 (engine), 19 (notice and recovery) |
| WR40 (except panel-split) | Task 17 |
| WR32–WR34, WR37–WR39, WR41 | Task 18 |
| WR36 | Tasks 18 (toggle), 19 (container query) |
| WR42 | Tasks 16 (mode), 19 (rendering) |
| NFR overflow / motion / axe | Tasks 18, 19 |

## 8. Risks / open questions

None.
