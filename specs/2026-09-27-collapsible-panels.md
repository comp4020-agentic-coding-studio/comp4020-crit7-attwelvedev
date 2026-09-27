# Collapsible site nav, collapsible + resizable requirements sidebar

- **Date:** 2026-09-27
- **Status:** Approved
- **Approved by user:** yes — 2026-09-27

## 1. Problem / intent

On desktop the planner page is wider than the viewport, so students scroll
sideways to push the site nav off-screen. They've found an accidental way to
hide chrome they don't need while arranging a plan. The intent is to make
that deliberate and discoverable:

- fix the overflow so the page never scrolls sideways
- let the site nav and the requirements sidebar each be hidden with an
  explicit control, and brought back with a small tab or rail
- let the requirements sidebar snap between 1, 2 and 3 card columns, so a
  student can trade sidebar width for timeline width

## 2. Requirements

### 2.1 Functional requirements

**Unit 1: fit the planner in the viewport**

1. At ≥1100px, `document.documentElement.scrollWidth === clientWidth` on
   `/plan/*` at every width, whether panels are expanded or collapsed.
2. `.planner` is a size container. It uses the side-by-side layout while a
   1-column sidebar (or the collapsed rail) plus a timeline of at least one
   year fits beside each other. One year is 2 × 15rem terms + 0.75rem gap,
   about 500px. Below that it uses today's stacked (mobile-style) layout.
3. The requirements sidebar's card column count (1, 2 or 3 × 13rem) follows
   the sidebar's own width tier, never the viewport width or JS. (It was
   first specified as a container query on the aside; see §5a.4 for why it
   became tier selectors.) This applies to requirement groups and to search
   results. A group still never shows more columns than it has courses.
4. The sidebar shows `min(preferred columns, most columns that fit)`, where
   "fit" means the timeline keeps its one-year minimum. The default
   preference is 3. So without interaction you get 3 columns at 1920×1080
   and 2 in the mid range (roughly 1270–1480px with the nav expanded).
5. 1920×1080 looks as it does today apart from the removed overflow.
   390×844 is unchanged.

**Unit 2: collapsible site nav** (≥1100px, every page, one shared state)

6. The nav contains a "Hide navigation" button.
7. When hidden, the nav is removed from layout and from the accessibility
   tree, so its links can't be reached with Tab. A small "Show navigation"
   tab is pinned top-left.
8. While the nav is hidden, `main` gets just enough extra left padding that
   the tab never overlaps content.
9. Below 1100px the nav keeps its current top-bar form, with no toggle.

**Unit 3: collapsible requirements sidebar** (side-by-side layout only)

10. The sidebar has a "Hide requirements" button.
11. Collapsed, it becomes a rail about 3rem wide showing a vertical
    "Requirements" label and a vertical program-wide progress bar. The
    completed/planned x/192u is exposed as text to assistive tech.
12. Clicking or activating the rail expands the sidebar back to the
    preferred column count.
13. The collapsed rail is still a drop target for dragging a course off the
    timeline, which removes it (same handler as the expanded sidebar). It
    highlights during a drag.
14. The timeline takes all the width the collapse frees up.
15. The stacked layout has no collapse control.

**Unit 4: snapping resize** (side-by-side layout only)

16. A resize handle sits on the sidebar's right edge (between sidebar and
    timeline). It's also present on the collapsed rail.
17. Dragging snaps live. The sidebar re-lays out to the nearest of
    collapsed / 1 / 2 / 3 columns each time the pointer crosses a midpoint.
    It never rests at an in-between width.
18. Dragging past the 1-column point collapses the sidebar into the rail,
    the same state as unit 3. Dragging the rail outward expands it.
19. Column counts that don't fit (req 4) can't be reached. The drag stops at
    the widest count that fits.
20. The handle is a focusable `role="separator"` with `aria-orientation`,
    `aria-controls` and `aria-valuetext` (e.g. "2 columns", "Collapsed").
    ←/→ step through collapsed → 1 → 2 → 3. Home goes to collapsed, End to
    the most columns that fit.
21. Releasing a drag or pressing a key saves the preference. The saved value
    is a column count, not a pixel width.

**Shared**

22. Both panels start expanded. The default column preference is 3.
23. State lives in `localStorage` under dedicated keys: nav hidden, sidebar
    collapsed, preferred columns. Every access is wrapped in try/catch.
    Missing, invalid or unreadable values fall back to the defaults (same
    pattern as `loadCompact` in `Sidebar.tsx`).
24. Sidebar state applies to every plan, not per plan.
25. An inline script in `<head>` (`Base.astro`) reads the stored state and
    sets attributes on `<html>` before first paint. CSS keys off those
    attributes and Preact reads the same source, so there's no flash of the
    wrong state and no hydration mismatch.

### 2.2 Non-functional requirements

- **Accessibility**
  - Toggles are `<button>`s with `aria-expanded` and `aria-controls`.
  - Collapsing moves focus to the control that restores the panel;
    expanding moves focus to the collapse button.
  - Every target is at least 44px on the short side.
  - `spec/invariants.test.ts` (axe floor, landmarks, one h1) passes in every
    state.
- **Motion:** no animation, so nothing to handle for `prefers-reduced-motion`.
- **Verification:** check the render at 1920×1080 and 390×844 (CLAUDE.md),
  plus the 1-column sidebar (about 17rem). Headings, progress bars and the
  search box must hold up at that width.
- **Overflow regression check:** add a check to `spec/` that fails if the
  planner overflows horizontally at desktop widths.
- `pnpm check` green before each commit.

### 2.3 Out of scope

- Any change to the mobile/stacked layout beyond req 2's breakpoint move.
- Per-requirement-group compaction (the user's separate, uncommitted
  `SidebarSection` work).
- Per-plan memory of panel state.
- Free, non-snapping sidebar widths.
- A nav collapse control below 1100px.

### 2.4 Assumptions (confirmed)

| Assumption | How confirmed |
| --- | --- |
| Minimum usable timeline is one year (two terms, about 500px) | Presented with the tier numbers; user accepted the tiers |
| Panels default to expanded | Stated in the final summary; approved |
| State is global, not per plan | Stated in the final summary; approved |
| Dragging the rail outward expands it; ← from 1 column collapses | Flagged explicitly as unasked-for defaults; approved |
| Expanding restores the preferred column count | Stated in the final summary; approved |
| Nav toggle exists on every page with one shared state | User chose this over planner-only |

## 3. Existing context

- **Overflow root cause** (measured with headless Chrome on `/plan/example`):
  - `body:has(.planner) main { width: 100%; }` (`src/styles.css:250`, and
    `:242`) inside the ≥1100px row `.app-shell` (`:255`).
  - Flex `min-width: auto` pins `main` at the viewport width beside the
    208px nav, so the page is +208px at 1920, 1440, 1280 and 1100.
  - `min-width: 0` fixes it. `width: auto` doesn't, because `:250` wins on
    specificity.
  - After the fix the timeline would measure 944px at 1920, 304px at 1280
    and 124px at 1100, which is why the tiers (req 2–4) ship in the same
    unit.
- **Site nav** is static markup in `src/layouts/Base.astro` with no JS.
  Desktop styles are at `src/styles.css:254–284` (13rem, sticky column).
- **Sidebar sizing** is at `src/styles.css:978–1017`.
  - `.planner > aside` is a fixed 44rem with `scrollbar-gutter: stable`,
    sized for exactly 3 × 13rem cards + 2 × 0.6rem gaps + 0.75rem inline
    padding each side.
  - `.available-courses` uses `repeat(var(--group-columns, 1), 13rem)`.
- **`--group-columns`** is set inline from JS:
  - `Sidebar.tsx:137`: `min(courses, MAX_COLUMNS=3)`
  - `CourseSearch.tsx:234`: `min(results, 3)`
  - Unit 1 has to cap this by the sidebar's container width instead.
- **Timeline terms** are `flex: 0 0 15rem` (`src/styles.css:600`) inside
  `.timeline-scroll`, which scrolls horizontally itself (`:494`).
- **The sidebar's drop handler** (drag back to remove, planner spec req 23)
  must keep working on the rail.
- **Planner spec** (`specs/2026-09-26-degree-planner.md`):
  - req 28 defines the sidebar's contents
  - §2.2 requires the invariants harness over every route in
    `spec/routes.ts`
- **Uncommitted work** in `Sidebar.tsx`, `SidebarSection.tsx`,
  `CourseSearch.tsx` and `styles.css` (per-group compaction) touches the
  same files. It has to be committed first.

## 4. Design

**Layout mechanism**
- Two nested size containers:
  - `.planner` decides side-by-side vs stacked from its own inline size.
  - The aside decides its column count from its own inline size.
- The aside's width is `min(preferred-width, available width − timeline
  minimum)`. The preferred width is one of four snap widths: rail, 1 column,
  2 columns, 3 columns. Each column width is derived from the card, gap and
  padding numbers above.
- Collapsing the nav or the sidebar changes the containers' sizes, so the
  layout adapts without extra code.

**State flow**
- `<head>` script → `<html data-nav="hidden" data-reqs="collapsed"
  data-req-cols="2">` (names indicative).
- CSS reads the attributes for widths and visibility. Preact components
  read and write the same attributes plus `localStorage`.
- The nav toggle is a small inline script, since the nav is static Astro
  markup. The sidebar controls live in Preact.

**Alternatives considered**
- **Viewport media queries for the tiers.** Rejected: collapsing the nav
  wouldn't promote the planner to a wider layout.
- **A raised breakpoint only (stacked below about 1500px).** Rejected in
  favour of an intermediate 2-column tier.
- **"Rely on collapse" with no tiers.** Rejected: the default 1100–1300px
  view would be cramped.
- **A slim rail with an expand button for the nav.** User chose a fully
  hidden nav with a floating tab.
- **Free-drag resize.** Rejected: cards are a fixed 13rem, so in-between
  widths are dead space. Snapping to column counts was chosen.
- **Stopping the resize at 1 column.** Rejected in favour of dragging
  through to the collapsed rail.
- **A guide line that snaps on release.** Rejected in favour of live
  snapping.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | contradiction | User described a swipe-to-dismiss, but there's no gesture code. It's page overflow | Measured: +208px overflow from `main` `width: 100%` + flex `min-width: auto`. Fix is req 1 |
| 2 | ambiguity | "Sidebar" meant the site nav, not the planner sidebar | User clarified. Both panels are now in scope |
| 3 | gap | Fixing overflow squeezes the timeline to 124–304px on narrower desktops | Tiers: 3 columns → 2 columns → stacked (req 2–4), user's proposal |
| 4 | gap | Static nav + SSR sidebar would flash the wrong state on load | Pre-paint `<head>` script sets `<html>` attributes (req 25) |
| 5 | gap | A floating nav tab could cover content | `main` gains a matching left gutter while the nav is hidden (req 8) |
| 6 | gap | Collapsing the sidebar removes the drag-to-remove drop target | Rail stays a drop target and highlights during a drag (req 13) |
| 7 | ambiguity | What the collapsed rail shows | Vertical label + program progress (req 11) |
| 8 | assumption | Nav toggle scope | Every page, one shared state (req 6–9) |
| 9 | contradiction | Adjustable width vs fixed column tiers | Unified: the saved value is a preferred column count, capped by fit (req 4, 21) |
| 10 | gap | Resize below 1 column | Collapses into the rail (req 18) |
| 11 | gap | Resize feedback during drag | Live snapping (req 17) |
| 12 | gap | A saved preference that doesn't fit the current width | Silently capped; the preference is kept (req 4, 19) |
| 13 | gap | Corrupt or missing storage | Falls back to defaults (req 23) |
| 14 | assumption | Rail drag-out and ← from 1 column | Proposed as defaults; user approved |

## 5a. Decisions added during planning (2026-09-27)

Codebase investigation for `plan-feature` raised these. The user ruled on
each:

1. **Tiers fall back through 1 column before stacking,** as req 2 says,
   rather than the "2 columns, then stacked" first described. So the
   side-by-side layout (1-column sidebar) also applies at about 824–1100px
   viewports, where the nav is still a top bar. The sidebar collapse and
   resize controls apply there too, because they're tied to the side-by-side
   layout, not the viewport.
2. **One fixed side-by-side threshold** (planner ≥ 49.5rem = 1-column
   sidebar + gap + one-year timeline; the sidebar widths gained headroom
   for depth-2 nested groups: 17.5 / 31.1 / 44.7rem). Collapsing the sidebar never lowers
   it. Below it, the collapsed state is ignored and the stacked layout shows
   as today.
3. **Verification uses both tools.**
   - `agent-browser` for the per-commit render checks at 1920×1080 and
     390×844.
   - A Playwright-driven `spec/layout.test.ts` inside `pnpm check`, with a
     Chromium install step added to the `check` job in
     `.github/workflows/checks.yml`.
4. **Implementation constraint found during investigation.**
   `container-type` applies layout containment, which makes the container
   the containing block for `position: fixed` descendants and a stacking
   context.
   - `.undo-toast` is `position: fixed` inside `.planner`, so the planner
     container must be a new wrapper that doesn't contain the toast.
   - Per-group containers would trap `.place-in-menu ul` (`z-index: 3`)
     under the next group, so column counts are driven by the aside's width
     tier (selectors inside the planner container queries), not by per-group
     containers.
   - This still meets the spec's intent: columns follow the sidebar's width
     and never the viewport's.

## 6. Handoff notes for planning

- **Sequencing:** commit the user's pending compaction work first. Then one
  commit per unit: 1 → 2 → 3 → 4, each with `pnpm check` green and the
  render checked at both marking viewports.
- **Unit 1 is one commit on purpose.** The overflow fix without the tiers
  makes 1100–1400px worse.
- **Don't re-litigate:** container queries (not media queries), a fully
  hidden nav with a floating tab, snapping (not free) resize, column-count
  persistence, and the rail as a drop target.
- **Risks**
  - Capping `--group-columns` by container width in CSS needs a mechanism
    that browsers support (math inside `repeat()` counts is uneven). Pick
    and verify one in planning.
  - Pointer capture during the resize drag must not interfere with the
    native and touch drag-and-drop in `touch-drag.ts`.
- **Harness:** add a spec check for no horizontal page overflow at desktop
  widths (req 1). It's a candidate `PROCESS_LOG.md` moment: the fix came
  from checking the render, not the source.
