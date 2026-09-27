# Collapsible site nav, collapsible + resizable requirements sidebar — Plan overview

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Source spec:** `specs/2026-09-27-collapsible-panels.md`, including its
  §5a decisions made during planning.

## 0. How to use these plans

Files in this set:

- `plans/2026-09-27-collapsible-panels-00-overview.md` (this file)
- `plans/2026-09-27-collapsible-panels-01-fit-layout.md`: Tasks 1–2
- `plans/2026-09-27-collapsible-panels-02-nav-collapse.md`: Tasks 3–4
- `plans/2026-09-27-collapsible-panels-03-sidebar-collapse.md`: Tasks 5–6
- `plans/2026-09-27-collapsible-panels-04-snapping-resize.md`: Tasks 7–8

Each implementation session reads **this overview plus exactly one phase
file**. Task numbers are global across the files. Tick a phase in §5 only
once that phase file's Definition of Done is met.

## 1. Summary

On desktop the planner page is 208px wider than the viewport. Students have
been scrolling sideways to push the site nav off-screen, which is an
accidental way to hide chrome they don't need while arranging a plan. This
feature does four things:

- **Fixes the overflow.** The planner lays itself out from its own width,
  in three tiers: a 3-column sidebar, then 2 columns, then 1 column, then
  the stacked layout.
- **Adds an explicit hide control for the site nav,** with a small tab to
  bring it back.
- **Lets the requirements sidebar collapse** into a slim rail that shows
  program progress and still accepts drops.
- **Lets the sidebar snap-resize** between collapsed, 1, 2 and 3 card
  columns.

Every choice is remembered per browser and applied before first paint.

## 2. Requirements

These are the spec's numbered requirements, carried over with the §5a
decisions applied. Phase files cite them as `FRn`.

### 2.1 Functional requirements

**Fit (Phase 01)**

1. At every viewport width, `document.documentElement.scrollWidth ===
   clientWidth` on `/plan/*`, whether panels are expanded or collapsed.
2. The planner uses the **side-by-side** layout when its own inline size is
   at least **49.5rem**, and the **stacked** layout (today's mobile layout)
   below that. The threshold depends only on the planner's width, not the
   viewport and not the collapse state. So at viewports of roughly
   832–1100px (nav still a top bar) the planner is side-by-side with a
   1-column sidebar.
3. In side-by-side, the sidebar's card column count (1, 2 or 3 × 13rem)
   follows the sidebar's width tier. A group never shows more columns than
   it has courses. This applies to requirement groups and search results.
   In stacked, it stays 1 column as today.
4. The sidebar shows `min(preferred columns, columns that fit)`:
   - 3 columns fit when the planner is at least 76.7rem wide.
   - 2 columns fit at 63.1rem.
   - 1 column fits at 49.5rem.

   The default preference is 3.
5. 1920×1080 renders as today apart from the removed overflow. 390×844 is
   unchanged.

**Site nav (Phase 02)**

6. At ≥1100px on every page, the nav contains a "Hide navigation" button.
7. When hidden, the nav is `display: none`, so it's out of the tab order and
   the accessibility tree. A "Show navigation" tab is pinned top-left.
8. While the nav is hidden, `main`'s inline-start padding grows so the tab
   never overlaps content.
9. Below 1100px there's no toggle, and the stored hidden state is ignored.

**Sidebar collapse (Phase 03)**

10. In side-by-side, the sidebar has a "Hide requirements" button.
11. Collapsed, the sidebar is a 3rem rail showing a vertical "Requirements"
    label and a vertical program-wide progress bar. The completed and
    planned of 192 units are exposed as text.
12. Activating the rail expands the sidebar to the preferred column count.
13. The rail is inside the requirements `<aside>`, so it's a drop target for
    removing a course (native and touch). It shows a drop-ready highlight
    while a placed course is being dragged.
14. The timeline takes the freed width.
15. The stacked layout has no collapse control, and the collapsed state is
    ignored there.

**Resize (Phase 04)**

16. In side-by-side, a resize handle sits between the sidebar and the
    timeline. It's also present beside the collapsed rail.
17. Dragging snaps live between collapsed / 1 / 2 / 3 columns at the
    midpoints between their widths.
18. Dragging below the 1-column snap collapses the sidebar. Dragging out
    from the rail expands it.
19. Sizes above the columns that fit are unreachable.
20. The handle is a focusable `role="separator"` with `aria-orientation`,
    `aria-controls`, `aria-valuemin/max/now` and `aria-valuetext` (e.g.
    "2 columns", "Collapsed").
    - ←/↓ step down, →/↑ step up, through collapsed → 1 → 2 → 3.
    - Home goes to collapsed. End goes to the most columns that fit.
21. Releasing a drag or pressing a key saves the preference as a column
    count or collapsed state. Pointer moves only preview.

**Shared**

22. Both panels start expanded, and the default preference is 3 columns.
23. State is stored in `localStorage` under the keys in §4.2, with every
    access in try/catch. Missing, invalid or unreadable values fall back to
    the defaults.
24. Sidebar state applies to every plan.
25. An inline `<head>` script applies the stored state to `<html>` data
    attributes before first paint. CSS keys only off those attributes.

### 2.2 Non-functional requirements

- **Accessibility**
  - Toggles are `<button>`s with `aria-controls`.
  - Collapsing moves focus to the restoring control, and expanding moves it
    back to the collapse control.
  - Targets are at least 44px on their short side.
  - `spec/invariants.test.ts` stays green. An in-browser axe run passes for
    every collapsed or resized state (same disabled rules as the
    invariants).
- **Motion:** no new animation.
- **Verification**
  - A Playwright-driven `spec/layout.test.ts` runs inside `pnpm check`.
  - `agent-browser` is used for the CLAUDE.md render check at 1920×1080 and
    390×844 before each commit.
- **CI:** the `check` job in `.github/workflows/checks.yml` installs
  Chromium before `pnpm check`.

### 2.3 Out of scope

- Mobile/stacked layout changes beyond FR2's threshold.
- Per-group compaction (already shipped in `5f5f052`).
- Per-plan memory.
- Free, non-snapping widths.
- A nav toggle below 1100px.
- Enabling axe's colour-contrast rule.

### 2.4 Assumptions

All of these were confirmed by the user on 2026-09-27; see the spec's §2.4
and §5a.

- Minimum usable timeline is one year = 2 × 15rem terms + 0.75rem gap,
  rounded to **31rem**.
- Sidebar widths budget for depth-2 nested groups (measured live: `spec →
  … → arin-a`-style groups hold up to 6 cards at depth 2) plus a classic
  15px scrollbar gutter.
- Panels default to expanded. State is global, not per plan.
- Dragging out from the rail expands it, and ← from 1 column collapses it.

## 3. Shared context & conventions

- **Stack**
  - Astro 7 (server output, `@astrojs/node`), with Preact islands
    (`client:load`).
  - Plain global CSS in `src/styles.css`. There are no CSS modules and no
    `<style>` blocks in components.
  - pnpm 11 and Node 24.
- **Commands**
  - `pnpm check`: `astro check` + `astro build` + `vitest run`, covering the
    `unit` project (`src/**/*.test.ts`, node environment) and the `spec`
    project (`spec/**/*.test.ts`, `scripts/**/*.test.ts`, against the
    **built** server booted by `spec/global-setup.ts`, which provides
    `inject("baseUrl")`).
  - `pnpm test:unit`: the unit tests only, which is quicker for pure logic.
  - One-time local setup after Task 1: `pnpm exec playwright install
    chromium`.
- **Render check** (CLAUDE.md, before every commit): run `pnpm dev`. For
  each of `agent-browser set viewport 1920 1080` and `… 390 844`, do
  `agent-browser open http://localhost:4321/plan/example`, then
  `agent-browser screenshot <scratchpad>/<name>.png`, and look at it. Add
  any phase-specific viewports that phase names.
- **Conventions**
  - Components are default-exported function components with an `interface
    Props`.
  - Comments explain *why*, in full sentences. Match that density.
  - Per-viewer storage follows `loadCompact`/`saveCompact` in
    `src/components/Sidebar.tsx`: try/catch everything, and never throw.
- **Commits**
  - One commit per unit of work once `pnpm check` is green. Each phase file
    names its commit points.
  - Messages say what changed and why.
  - End messages with `Co-Authored-By: Claude Opus 5.5
    <noreply@anthropic.com>`.
- **Needs the user's go-ahead:** pushing. Don't hand-edit `dist/` or
  `.astro/`.
- **Process log:** CLAUDE.md requires logging qualifying moments to
  `PROCESS_LOG.md` (append-only, in the format its header comment gives),
  citing a commit that already exists. Phase 01 names one.

## 4. Shared design

### 4.1 DOM shape of the planner (introduced by Task 2)

```
div.planner[data-cutoff]          ← touch-drag root (plannerRef), unchanged
├── p[aria-live]                  ← unchanged
├── div.planner-layout            ← NEW: `container: planner / inline-size`
│   └── div.planner-panes         ← NEW: the flex row/column; carries --reqs-fit
│       ├── div.planner-timeline-area
│       ├── aside#requirements[aria-label="requirements"]   (Sidebar)
│       └── div.reqs-resize[role=separator]                 (Task 8)
└── div.undo-toast                ← stays OUTSIDE .planner-layout
```

Why the wrapper: `container-type` applies layout containment, which makes
the container the containing block for `position: fixed` descendants.
`.undo-toast` is fixed, so it must not be inside the container. The panes
are a child of the container because a container query can't restyle the
container itself.

### 4.2 Stored state and `<html>` attributes

| Storage key | Values | `<html>` attribute | Meaning |
| --- | --- | --- | --- |
| `panel-nav` | `"hidden"` or absent | `data-nav="hidden"` | Site nav hidden (≥1100px only) |
| `panel-reqs` | `"collapsed"` or absent | `data-reqs="collapsed"` | Sidebar collapsed (side-by-side only) |
| `panel-reqs-cols` | `"1"`, `"2"`, `"3"` | `data-reqs-cols="1"`/`"2"` (absent for 3) | Preferred column count |

**The final inline head script** is built up in Base.astro across Tasks 4, 5
and 8. Each phase adds its own line.

```html
<script is:inline>
  // Applies saved panel state before first paint so nothing flashes;
  // src/components/panel-state.ts owns these keys (panel-state.test.ts
  // checks they match).
  try {
    var s = localStorage, h = document.documentElement;
    if (s.getItem("panel-nav") === "hidden") h.dataset.nav = "hidden";
    if (s.getItem("panel-reqs") === "collapsed") h.dataset.reqs = "collapsed";
    var c = s.getItem("panel-reqs-cols");
    if (c === "1" || c === "2") h.dataset.reqsCols = c;
  } catch (e) {}
</script>
```

### 4.3 `src/components/panel-state.ts` (created by Task 3, extended by none)

```ts
export const NAV_KEY = "panel-nav";
export const REQS_KEY = "panel-reqs";
export const REQS_COLS_KEY = "panel-reqs-cols";

export type ReqsColumns = 1 | 2 | 3;
export interface ReqsState {
  collapsed: boolean;
  columns: ReqsColumns;
}
export const DEFAULT_REQS: ReqsState = { collapsed: false, columns: 3 };

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface DatasetHost {
  dataset: DOMStringMap;
}

export function safeStorage(): StorageLike | null;
export function parseColumns(raw: string | null | undefined): ReqsColumns;
export function reqsStateFromDataset(dataset: DOMStringMap): ReqsState;
export function applyReqsState(root: DatasetHost, state: ReqsState): void;
export function saveReqsState(state: ReqsState, storage?: StorageLike | null): void;
export function setNavHidden(root: DatasetHost, hidden: boolean, storage?: StorageLike | null): void;
```

### 4.4 Width tokens and tiers (introduced by Task 2)

`:root` tokens in `src/styles.css`:

```css
--reqs-w-rail: 3rem;
--reqs-w-1: 17.5rem;
--reqs-w-2: 31.1rem;
--reqs-w-3: 44.7rem;
--timeline-min: 31rem;
```

A width is `n × 13rem + (n − 1) × 0.6rem + 4.5rem` of overhead. The overhead
covers group padding and border (1.625rem), two nesting levels (2 ×
0.875rem), a 15px scrollbar gutter and a little slack.

Planner container thresholds are `width + 1rem gap + 31rem`. They're
**literals**, because `@container` conditions can't use `var()`:

| Planner inline size | Layout | `--reqs-fit` on `.planner-panes` | Aside width |
| --- | --- | --- | --- |
| < 49.5rem | stacked | `0` | auto (strip) |
| ≥ 49.5rem | side-by-side | `1` | `--reqs-w-1` |
| ≥ 63.1rem | side-by-side | `2` | `--reqs-w-2` |
| ≥ 76.7rem | side-by-side | `3` | `--reqs-w-3` |

Reference points, with the nav expanded:

| Viewport | Planner width | Result |
| --- | --- | --- |
| 1920 | 104rem | 3 columns; timeline 933px |
| 1440 | 74rem | 2 columns |
| 1280 | 64rem | 2 columns |
| 1100 | 52.75rem | 1 column |
| 900 | 53.75rem | 1 column (nav is a top bar here) |
| 800 | 47.5rem | stacked |
| 390 | — | stacked |

**Cascade order at the end of the planner section** (Tasks 5 and 8 depend
on it):

1. tier blocks (Task 2)
2. preference-cap rules (Task 8)
3. collapsed rules (Task 5), in their own
   `@container planner (min-width: 49.5rem)` block placed last, because they
   have the same specificity as the preference caps and must win

### 4.5 Browser test helpers: `spec/browser.ts` (created by Task 1)

```ts
import type { Browser, Page } from "playwright";
export interface Viewport { width: number; height: number }
export interface OpenOptions {
  storage?: Record<string, string>; // seeded into localStorage before any page script
  blockScripts?: boolean;           // aborts /_astro/*.js (islands + bundled scripts); inline scripts still run
}
export function launch(): Promise<Browser>;
export function openPage(browser: Browser, url: string, viewport: Viewport, options?: OpenOptions): Promise<Page>;
export function horizontalOverflow(page: Page): Promise<number>; // scrollWidth − clientWidth of <html>
export function axeViolations(page: Page): Promise<string[]>;    // "id: target" strings; [] when clean
```

## 5. Phases

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-fit-layout.md` | 1–2 | — | Two commits. No sideways overflow at any width; tiers 3/2/1/stacked. Human review of 1280/1100/900 renders. PROCESS_LOG entry | [x] |
| 02 | `…-02-nav-collapse.md` | 3–4 | 01 | One commit. Nav hides and shows, persists, no flash. Human review of the tab | [x] |
| 03 | `…-03-sidebar-collapse.md` | 5–6 | 01, 02 | Two commits. Rail collapse with drop target and highlight. Human review of the rail | [x] |
| 04 | `…-04-snapping-resize.md` | 7–8 | 01, 02, 03 | One commit. Snapping resize by pointer and keyboard. Human review of the handle | [ ] |

Phase 03 needs Phase 02 for `panel-state.ts` (Task 3) and the head script
(Task 4). Phase 04 needs Phase 03 for the rail and the Planner-owned
`ReqsState` (Task 5).

## 6. Feature-level Definition of Done

- [ ] Every phase in §5 is ticked, and every task is complete with tests
      passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Manually verified with `agent-browser`: on `/plan/example` at 1920×1080,
      hide the nav, collapse the sidebar, drag the handle out to 2 columns,
      and reload. The layout is identical with no flash, the page never
      scrolls sideways, and 390×844 looks as before.
- [ ] Every requirement in §2 is covered (see §7)
- [ ] Every `Human review:` task (2, 4, 5, 8) explicitly accepted by the user
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| FR1 | Task 2 (tests at 6 widths); Tasks 4, 5, 8 (re-assert in their states) |
| FR2 | Task 2 |
| FR3 | Task 2 |
| FR4 | Task 2 (fit); Task 8 (preference cap) |
| FR5 | Task 2 |
| FR6 | Task 4 |
| FR7 | Task 4 |
| FR8 | Task 4 |
| FR9 | Task 4 |
| FR10 | Task 5 |
| FR11 | Task 5 |
| FR12 | Task 5 |
| FR13 | Task 6 |
| FR14 | Task 5 |
| FR15 | Task 5 |
| FR16 | Task 8 |
| FR17 | Task 7 (`snapSize`); Task 8 (wiring) |
| FR18 | Task 7; Task 8 |
| FR19 | Task 7; Task 8 |
| FR20 | Task 7 (`stepSize`, `sizeLabel`); Task 8 |
| FR21 | Task 8 |
| FR22 | Task 3 |
| FR23 | Task 3; Tasks 4, 5, 8 (keys in the head script) |
| FR24 | Task 3 (global keys) |
| FR25 | Tasks 4, 5, 8 (blocked-scripts tests) |
| NFR a11y | Tasks 4, 5, 8 (focus, axe); Task 2 (invariants stay green) |
| NFR verification/CI | Task 1 |

## 8. Risks / open questions

None.
