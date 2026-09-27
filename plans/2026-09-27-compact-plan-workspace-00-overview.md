# Compact plan workspace — Plan overview

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Source spec:** `specs/2026-09-27-compact-plan-workspace.md` (approved
  2026-09-27), plus the planning rulings in §2.4.
- **Amended:** 2026-09-27, after Task 1 (`ab8195c`). The user moved the
  plan-page controls into the title row and put the two occasional ones
  behind a ⋯ "More options" panel. That amends CW4 and CW6, adds CW23–CW24,
  splits Phase 01 into Tasks 1–3, and renumbers Phases 02–03 to Tasks 4–7.

## 0. How to use these plans

Files in this set:

- `plans/2026-09-27-compact-plan-workspace-00-overview.md` (this file)
- `plans/2026-09-27-compact-plan-workspace-01-row-and-title.md`: Tasks 1–3
- `plans/2026-09-27-compact-plan-workspace-02-stacked-collapse.md`: Tasks 4–5
- `plans/2026-09-27-compact-plan-workspace-03-stacked-split.md`: Tasks 6–7

Each implementation session reads **this overview plus exactly one phase
file**. Task numbers are global across the files. Tick a phase in §5 only
once that phase file's Definition of Done is met.

This feature builds on the finished collapsible-panels feature
(`plans/2026-09-27-collapsible-panels-00-overview.md`, all five phases
ticked, last commit `12059d6`). It amends three of that feature's
requirements (FR5, FR15, FR29); see §2.1.E. The phase files copy every
collapsible-panels signature they need, so a session never needs to open
those plans.

## 1. Summary

The fitted plan page (`/plan/*`) is still cramped on a phone. At 390×844,
the timeline's half of the screen spends 150px on controls before the
first term card, the title block spends about 75px, and the 50/50 split
between the timeline and the requirements can't be changed. This feature:

- **Merges the cutoff controls into one "completed semesters" control.**
  The short readout ("Completed through S2 2027") becomes the label of two
  chevron buttons. The confusing word "cutoff" leaves every user-facing
  page.
- **Moves the controls into the title row.** The plan page gets a smaller
  `h1`, and the example note becomes a badge beside it. The completed
  control and a ⋯ "More options" button sit at the row's end. The
  prerequisite toggle and "Copy plan link" move into that button's panel,
  so nothing sits above the timeline.
- **Lets the stacked requirements collapse** to a slim bar along the bottom,
  which stays a drop target, as the desktop sidebar collapses to its rail.
- **Makes the stacked split adjustable.** The existing resize handle turns
  horizontal in the stacked layout and snaps the timeline between 30%, 50%,
  70% and Collapsed, remembered per browser.

## 2. Requirements

These are the spec's requirements, carried over unchanged, plus the
planning rulings (§2.4). Phase files cite them as `CWn` and `Nn`.

### 2.1 Functional requirements

**A. Completed-semesters control (every width)**

- **CW1.** The cutoff readout and the two cutoff buttons merge into one
  control. Its visible label is the short readout, followed by two chevron
  buttons (‹ then ›):
  - cutoff inside the timeline: "Completed through <last completed term
    label>", e.g. "Completed through S2 2027"
  - cutoff ≤ 0: "Nothing completed yet"
  - cutoff ≥ number of terms: "All semesters completed"
- **CW2.** The chevrons' accessible names are "One fewer semester completed"
  (‹) and "One more semester completed" (›). They're enabled and disabled
  exactly as the cutoff buttons are today. On read-only plans they stay
  visible and disabled.
- **CW3.** The full sentence stays available to assistive technology as
  visually hidden text, and isn't shown on screen. That's today's readout
  sentence, including "The gold line on the timeline marks that boundary."
- **CW4** (amended after Task 1). The completed-semesters control sits in
  the plan page's title row (B), after the title and badge, at the row's
  end. No controls sit above the timeline, so the first term card starts at
  the top of the timeline area.
- **CW5.** The word "cutoff" leaves all user-facing text: visible labels,
  accessible names, the Help page and, per the planning ruling, the Design
  notes page (`README.md`, served at `/readme/`). Internal names
  (`data-cutoff`, `moveCutoff`, `plan.cutoff`, CSS class names, the API and
  its error messages) are unchanged.
- **CW6** (amended after Task 1). The Help page's instructions describe the
  new control by its new names, say that it sits beside the plan's title,
  and explain the gold line on the timeline. They also say that "More
  options" (⋯) holds "Show prerequisite links" and "Copy plan link".

**B. Title block (every width, `/plan/*` only)**

- **CW7.** The plan page's `h1` is 1.4rem, smaller than the document pages'
  `h1`. Document pages (`/`, `/help/`, `/readme/`) are unchanged.
- **CW8.** On read-only plans, "This is an example — Start your own plan"
  is a small badge on the `h1`'s row. It wraps below the title only when
  the row doesn't fit. It keeps `role="note"` and its text.
- **CW9.** With the nav hidden below 1100px, the show-navigation tab still
  sits at the start of the title's row, and neither the tab nor the badge
  covers anything.
- **CW23** (added after Task 1). A ⋯ "More options" button follows the
  chevrons:
  - It's a disclosure: `aria-expanded`, `aria-controls`, at least 44×44px.
    It is not an ARIA menu.
  - Its panel holds the native "Show prerequisite links" checkbox and, on
    editable plans, the "Copy plan link" button. On read-only plans it
    holds only the checkbox.
  - The panel stays open while those are used. It closes on Escape (focus
    returns to ⋯), on a pointer press outside it, or on ⋯ again.
  - It shares Planner's one-open-menu state with Place in…/Move to…, so
    opening either closes the other.
  - The panel is aligned to ⋯'s end edge, so opening it never overflows the
    page sideways.
- **CW24** (added after Task 1). The title row has two groups: [title,
  badge] and [completed control, ⋯].
  - When the row doesn't fit, the second group wraps as a whole onto its
    own line, aligned to the line's end (amended during Task 3's review).
    The readout's width changes with the label ("Nothing completed yet" is
    254px, "Completed through S2 2027" is 293px), so only end alignment
    keeps ‹, › and ⋯ fixed while you step through semesters.
  - Stepping the completed semesters never moves ‹, › or ⋯.
  - The badge wraps below the title only when it doesn't fit beside it.
  - On a 390px phone, an editable plan's row is two lines (title, then
    control + ⋯), and the example plan's is three (title, badge, then
    control + ⋯).

**C. Adjustable stacked split (stacked planner, viewport ≥ 30rem tall)**

- **CW10.** In the stacked layout of the fitted page, a resize handle sits
  between the timeline and the requirements. It snaps between four stops,
  each the timeline's share of the planner height: 30%, 50%, 70% and
  Collapsed (see D). The default is 50%. Per the planning ruling, this is
  the **same handle** as the side-by-side sidebar resize handle, turned
  horizontal.
- **CW11.** The handle is a focusable `role="separator"` with
  `aria-orientation="horizontal"`, `aria-controls` and
  `aria-valuemin/max/now`. Its `aria-valuetext` is "Timeline 30%",
  "Timeline 50%", "Timeline 70%" or "Requirements hidden".
  - ↑ moves the boundary up (a smaller timeline), and ↓ moves it down,
    through 30 → 50 → 70 → Collapsed.
  - Home goes to 30%, and End goes to Collapsed.
- **CW12.** Dragging previews live, snapping at the midpoints between
  stops. Releasing a drag, or pressing a key, saves the choice. Pointer
  moves only preview.
- **CW13.** The ratio is stored per browser under `panel-split`: `"30"` or
  `"70"`, and absent for 50. The inline head script applies it to `<html>`
  before first paint, with every storage access in try/catch. Invalid
  values fall back to 50.
- **CW14.** Below 30rem of viewport height the page isn't fitted, so the
  stacked handle is hidden and the split doesn't apply.

**D. Collapsible requirements in the stacked layout (replaces FR15)**

- **CW15.** The stacked layout has a "Hide requirements" button. It, and
  the split's Collapsed stop, collapse the requirements.
- **CW16.** Collapsed, the requirements become a slim bar along the bottom
  of the planner, at least 44px tall. It shows "Requirements" and a
  horizontal program-progress bar. Its accessible name matches the
  side-by-side rail's: "Show requirements: X completed, Y planned of 192".
- **CW17.** Activating the bar expands the requirements to the saved split
  ratio (50% if none is saved).
- **CW18.** The bar is inside the requirements `<aside>`, so it's a drop
  target for removing a course, by native and touch drag. It shows the
  rail's drop-ready highlight while a placed course is being dragged.
- **CW19.** The collapsed state uses the existing shared `panel-reqs` key.
  Collapsing on a phone collapses the desktop sidebar to its rail, and vice
  versa.
- **CW20.** Collapsing moves focus to the bar, and expanding moves it back
  to "Hide requirements", as with the rail.
- **CW21.** The collapse button and the bar work at every viewport height,
  including below 30rem tall. Only the handle is hidden there (CW14).
- **CW22.** While the stacked requirements are collapsed, the undo toast
  sits above the bar, so it never covers the drop target the course was
  just dropped on.

**E. Amended collapsible-panels requirements**

- **FR5** becomes: 1920×1080 renders as before apart from the removed
  overflow, the fitted height (FR27–28), the completed-semesters control
  (CW1–6), the title row (CW7–8, CW23–24) and the empty space above the
  timeline. 390×844 changes only as FR9, FR26, FR29 and CW1–24 describe.
- **FR15** is replaced by CW15–21.
- **FR29** becomes: in stacked, the timeline takes exactly the saved split
  share of the planner's height (30, 50 or 70%, default 50), or all of it
  but the collapsed bar. The requirements fill the rest, and each scrolls
  on its own.

### 2.2 Non-functional requirements

- **N1.** FR1 (no horizontal overflow) and FR27 (no vertical page scroll on
  the fitted page) hold in every new state: every split stop, collapsed
  stacked, and with the nav hidden.
- **N2.** Every new control (chevrons, ⋯, handle hit area, bar, stacked
  "Hide requirements") is at least 44px on its short side.
- **N3.** In-browser axe (`axeViolations`) is clean:
  - at 390×844 in every split stop and collapsed
  - at 1920×1080 with the new title row, with the ⋯ panel closed and open
- **N4.** `spec/invariants.test.ts` stays green: one `h1` per page, and the
  nav landmark in the DOM.
- **N5.** No new animation.
- **N6.** Human review of the renders at 1920×1080, 900×800 and 390×844,
  including every split stop and collapsed on the phone.

### 2.3 Out of scope

- Per-group scrolling in the requirements strip, and stopping requirement
  cards from stretching to the tallest group.
- Hiding the timeline entirely.
- Hiding the completed-semesters control on read-only plans.
- Any side-by-side layout change beyond the control (A) and the title row
  (B).
- Arrow-key navigation in the ⋯ panel (it's a disclosure, not a menu), and
  any change to the Place in…/Move to… menus.
- Renaming internal "cutoff" identifiers, CSS classes, the API, its error
  messages or stored data.
- A smaller `h1` or badges on non-plan pages, including "Plan not found".

### 2.4 Assumptions and planning rulings

From the spec (all confirmed by the user):

- The compaction applies at every width, and FR5 is amended to allow it.
- Split stops are 30/50/70, with a default of 50.
- There's one shared `panel-reqs` key across layouts.
- This feature is built after collapsible-panels Phase 05, reusing its
  snapping helpers and its separator.

Planning rulings (2026-09-27):

- **One handle** (user). The existing `ReqsResizeHandle` element turns
  horizontal in the stacked layout. That supersedes Phase 05's layout test
  "isn't shown in the stacked layout", which is a requirement change
  (CW10), not a weakened test.
- **README reworded** (user). CW5 covers the Design notes page.
- **Three phases** (user).
- **Controls in the title row** (user, after Task 1). The timeline gets the
  row back. Occasional actions go behind ⋯. The completed control stays
  visible at every width, because it's the only label that explains the
  gold line.
- **Phone wrap: title, then control + ⋯** (user). One wrap rule serves
  every width. Title + ⋯ on one line doesn't fit with the nav hidden: a
  56px tab indent, about 249px of title and a 44px ⋯ is more than 350px.
- **Disclosure, not an ARIA menu** (user). The checkbox stays a native
  checkbox, and a disclosure doesn't need arrow-key handling.
- **Planner renders the title row** (planner). The controls need Planner's
  state, and a portal can't server-render. So `[id].astro` passes `title`
  and Planner renders the one `h1`, which the server still renders (N4).
- **The toast needs the layout from JS** (planner). The undo toast sits
  outside the `planner` size container, so no container query can style it.
  Task 5 therefore moves the `--reqs-fit` observer from the handle into
  `Planner`, which marks the toast when the layout is stacked and the
  requirements are collapsed.
- **Exact share** (planner). The timeline takes exactly its split share
  (FR29 as amended), so the handle's position is predictable for dragging.
- **Collapsed snaps at 85%** (planner). For snapping, Collapsed is treated
  as a 100% timeline share, so the midpoints are 40%, 60% and 85%.
- **"Exact midpoint → larger"** (planner), as in Phase 05's `snapSize`.
- **Stored values** (planner). `panel-split` is removed from storage when
  the ratio is 50, and `"30"`/`"70"` are written otherwise.
- **Bar fill through CSS variables** (planner). The rail's progress fill
  moves from inline `height` to the CSS custom properties `--completed` and
  `--planned`. The same markup then fills vertically in the rail and
  horizontally in the bar.
- **The CSS class `.cutoff-controls` is kept** (planner) while the row
  above the timeline exists (Tasks 1–2). It's internal (CW5), and keeping
  it limits churn. Task 3 deletes the row, and the class with it.

## 3. Shared context & conventions

- **Stack**
  - Astro 7 (server output, `@astrojs/node`), with Preact islands
    (`client:load`).
  - Plain global CSS in `src/styles.css`: no CSS modules and no `<style>`
    blocks.
  - pnpm 11 and Node 24.
- **Commands** (from `package.json`)
  - `pnpm check`: `astro check`, then `astro build`, then `vitest run`. It
    runs the `unit` project (`src/**/*.test.ts`) and the `spec` project
    (`spec/**/*.test.ts`), the latter against the built server.
  - `pnpm test:unit`: unit tests only.
  - For a quick layout iteration: `pnpm build && pnpm exec vitest run
    --project spec spec/layout.test.ts -t "<describe name>"`.
- **Browser test helpers** (`spec/browser.ts`, exact):

  ```ts
  export interface Viewport { width: number; height: number }
  export interface OpenOptions {
    storage?: Record<string, string>; // seeded into localStorage before any page script
    blockScripts?: boolean; // aborts /_astro/*.js (islands + bundled scripts); inline scripts still run
  }
  export async function launch(): Promise<Browser>;
  export async function openPage(browser: Browser, url: string, viewport: Viewport, options: OpenOptions = {}): Promise<Page>;
  export function horizontalOverflow(page: Page): Promise<number>;
  export function verticalOverflow(page: Page): Promise<number>;
  export async function axeViolations(page: Page): Promise<string[]>;
  ```

  `spec/layout.test.ts` starts with `const baseUrl = inject("baseUrl")`,
  `planUrl()` (for `/plan/example`) and `withPlan(viewport, check)`. The
  `describe("requirements rail as a drop target")` block has
  `planWithPlacement(code): Promise<string>`, which creates an editable plan
  with `code` placed in term 0 and returns its id.
- **Render check** (CLAUDE.md, before every commit): with `pnpm dev`
  running, for each of `agent-browser set viewport 1920 1080`, `… 900 800`
  and `… 390 844`, run `agent-browser open
  http://localhost:4321/plan/example`, then `agent-browser screenshot
  <scratchpad>/<name>.png`, and look at it. If `pnpm dev` reports a server
  already running on :4321 for this repo, use that one.
- **Conventions**
  - Components are default-exported function components with an
    `interface Props`.
  - Comments explain *why*, in full sentences. Match that density.
  - Per-viewer storage goes through `src/components/panel-state.ts`:
    try/catch everything, and never throw.
  - Server render and first client render must agree. Browser state syncs
    in `useEffect` afterwards.
- **Commits**
  - One commit per task once `pnpm check` is green, except where a phase
    file says two tasks commit together.
  - Messages say what changed and why.
  - End messages with `Co-Authored-By: Claude Opus 5.5
    <noreply@anthropic.com>`.
  - Never push. Don't hand-edit `dist/` or `.astro/`.
- **Tests that change with a requirement.** A test whose expectation
  changes because a requirement here changed it is *superseded*, not
  weakened. Each such test is named in its phase file, together with the
  requirement that supersedes it.
- **Process log:** CLAUDE.md requires logging qualifying moments to
  `PROCESS_LOG.md` (append-only, in the format its header comment gives),
  citing a commit that already exists. Task 5's discovery (container
  queries can't reach the toast, so the fit moved into `Planner`) is a
  candidate, once it's committed.

## 4. Shared design

### 4.1 Planner DOM

This is the DOM once Task 3 has run. The title row is new, and the panes
don't change shape:

```
div.planner[data-cutoff]                       ← touch-drag root
├── p[aria-live]
├── div.plan-title                             ← Task 3: flex-wrap row, outside the container
│   ├── div.plan-title-main                    ← h1, and on read-only plans p.plan-badge[role=note]
│   └── div.plan-actions                       ← div.completed-control, then div.more-options (Task 2)
├── div.planner-layout                         ← container: planner / inline-size
│   └── div.planner-panes                      ← flex; --reqs-fit 0 (stacked) / 1 / 2 / 3
│       ├── div.planner-timeline-area          ← <Timeline> only (Task 3)
│       ├── aside#requirements                 ← Sidebar: .reqs-hide, .reqs-rail, ul#requirements-content.requirements-scroll
│       └── div.reqs-resize[role=separator]    ← ReqsResizeHandle
└── div.undo-toast                             ← fixed; OUTSIDE the container (Task 5 marks it)
```

**Visual order in stacked (Task 7):** the timeline, then the handle, then
the aside. The handle gets `order: 1` and the aside `order: 2`.

### 4.2 Stored state and `<html>` attributes

| Key | Values | `<html>` attribute | Owner |
| --- | --- | --- | --- |
| `panel-nav` | `"hidden"` / absent | `data-nav="hidden"` | existing |
| `panel-reqs` | `"collapsed"` / absent | `data-reqs="collapsed"` | existing; now applies in stacked too (CW19) |
| `panel-reqs-cols` | `"1"`/`"2"`/`"3"` | `data-reqs-cols="1"`/`"2"` | existing |
| `panel-split` | `"30"`/`"70"` / absent | `data-split="30"`/`"70"` (absent for 50) | Task 6 |

### 4.3 Cascade order at the end of the planner section of `src/styles.css`

New rules must keep this order:

1. the tier blocks (`@container planner (min-width: 49.5rem / 63.1rem /
   76.7rem)`)
2. **the fit group** (`@media (min-height: 30rem) { … }`). Task 7 changes
   its stacked timeline rule from "at most 50%" to "exactly 50%".
3. **the resize handle and the preference caps.** Task 7 adds the stacked
   handle and the `data-split` rules here.
4. **the collapsed blocks**, last:
   - the existing side-by-side block, `@container planner (min-width:
     49.5rem)`
   - then Task 4's stacked blocks: `@container planner (width < 49.5rem)`,
     and an `@media (min-height: 30rem)`-wrapped one for the fitted
     timeline

### 4.4 New `:root` token (Task 4)

`--reqs-bar-h: 2.75rem;` is the collapsed bar's height. Task 5 positions the
toast above the bar with it.

## 5. Phases

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-row-and-title.md` | 1–3 | — | Three commits. The completed-semesters control, no "cutoff" in any user-facing text, the ⋯ "More options" panel, and the compact title row that carries both. Human review of each | [x] |
| 02 | `…-02-stacked-collapse.md` | 4–5 | — | Two commits. Stacked "Hide requirements" and the bottom bar (a drop target, shared key), and the toast above the bar. Human review of the bar | [x] |
| 03 | `…-03-stacked-split.md` | 6–7 | 02 | One commit. The handle turns horizontal in stacked and snaps 30/50/70/Collapsed, saved and applied before paint. Human review of the split | [x] |

Phase 02 doesn't need Phase 01: its code and tests don't touch the title
row, and the panes keep their shape. Run them in order anyway. Phase 03 needs Phase 02 for:

- the stacked collapsed CSS (its Collapsed stop)
- the `fit` value that `Planner` passes to the handle (Task 5)

## 6. Feature-level Definition of Done

- [x] Every phase in §5 is ticked, and every task is complete with tests
      passing
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] Manually verified with `agent-browser`:
  - at 390×844 on `/plan/example`: a 1.4rem title, the badge under it, and
    "Completed through S2 2027 ‹ › ⋯" under that, with nothing above the
    timeline
  - drag the handle to 70%, reload: still 70% with no flash
  - press End: the bar shows. Reload at 1920×1080: the sidebar is its rail
  - no page scroll either way throughout
- [x] Every requirement in §2 is covered (see §7)
- [x] Every `Human review:` task (1, 2, 3, 4, 7) explicitly accepted by
      the user
- [x] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| CW1 | Task 1 (`completedReadout`, row markup) |
| CW2 | Task 1 |
| CW3 | Task 1 |
| CW4 (amended) | Task 3 (control in the title row, nothing above the timeline) |
| CW5 | Task 1 (Planner, Help, README, no-"cutoff" test) |
| CW6 (amended) | Task 1 (names, gold line); Task 3 (position, "More options") |
| CW7 | Task 3 |
| CW8 | Task 3 |
| CW9 | Task 3 |
| CW10 | Task 7 |
| CW11 | Task 6 (`stepSplit`, `splitLabel`); Task 7 (ARIA, keys) |
| CW12 | Task 6 (`snapSplit`); Task 7 (drag preview and commit) |
| CW13 | Task 6 (`panel-state` split storage, head script) |
| CW14 | Task 7 (hidden at 700×400) |
| CW15 | Task 4 (button); Task 7 (Collapsed stop) |
| CW16 | Task 4 |
| CW17 | Task 4 (expands to 50); Task 7 (restores a saved 30) |
| CW18 | Task 4 |
| CW19 | Task 4 |
| CW20 | Task 4 |
| CW21 | Task 4 (700×400) |
| CW22 | Task 5 |
| CW23 | Task 2 |
| CW24 | Task 3 |
| FR5 (amended) | Tasks 1, 2, 3 (human reviews at 1920/900/390) |
| FR15 (replaced) | Task 4 (superseded Phase 03 test) |
| FR29 (amended) | Task 7 (exact share at each stop); Task 4 (collapsed) |
| N1 | Tasks 1, 2, 3, 4, 7 (overflow checks) |
| N2 | Tasks 1, 2, 4, 7 |
| N3 | Task 2 (1920, panel open); Task 3 (1920); Task 4 (collapsed at 390); Task 7 (every stop) |
| N4 | Task 3 (`pnpm check` runs invariants) |
| N5 | All CSS tasks: no `transition`/`animation` added |
| N6 | Human reviews on Tasks 1, 2, 3, 4, 7 |

## 8. Risks / open questions

None.
