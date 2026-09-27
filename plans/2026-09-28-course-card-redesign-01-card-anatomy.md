# Course card redesign — Phase 01: Card anatomy

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-28-course-card-redesign-00-overview.md`. Read
  it first: §2.1.A (CR1–CR11), §2.2, §3 (commands, rebuild-before-spec,
  red-must-fail rule) and §4.1.
- **Depends on phases:** none.

## 1. Summary

Rebuilds what a course card is made of:
- **Header:** a shared first line (grip, code, units) and a title button
  that opens Details.
- **Timeline cards:** rare actions move into a three-dot menu, and the
  long verify paragraph becomes a badge that opens Details at "Your
  checks".
- **Blocked cards:** they recede without fading their controls.
- **Read-only plans:** they render no editing controls.

At the end, placed sidebar cards still exist as cards (Phase 02 turns them
into rows), and no colour coding exists yet (Phase 03).

## 2. Requirements (this phase)

### 2.1 Functional

- **CR1, CR2, CR3:** Task 1.
- **CR5, CR6, CR8, CR11**, and CR7 (no menu, "Place in…" kept, Details via
  the title): Task 2.
- **CR9:** Task 3.
- **CR10:** Task 4.
- CR4 is only partly here: the "Counts toward" text stays as today's plain
  text, moved into the card footer (Task 2). Its dot comes in Task 8 and
  its button in Task 11.

### 2.2 Non-functional

Overview §2.2 accessibility. Axe must stay clean on `/plan/example` and on
a fresh plan with a card menu open.

### 2.3 Out of scope for this phase

- Compact rows (Phase 02).
- Strips, dots and family colours (Phase 03).
- The "Counts toward" button (Phase 04).
- Help copy: Task 19 rewrites Help in one pass. This phase doesn't touch
  `help.astro`, and no Help test changes here.

### 2.4 Assumptions

See overview §2.4. It isn't yet known whether Chromium starts a native
drag of a `draggable` `<li>` when the press lands on a `<button>` inside
it. Task 1 settles this first and defines what to do for either answer.

## 3. Existing code context (verified 2026-09-28)

**`src/components/CourseCard.tsx`** (timeline card). Props, exactly:

```ts
interface Props {
  view: PlanView;
  placement: PlacementView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onRemoved: (removed: RemovedPlacement) => void;
}
```

It exports `RemovedPlacement { code; term; pinnedGroupId: string | null;
label }`.

State and functions: `detailsOpen`, `pending`, and `move(term)`,
`applySuggestion(code, term)`, `remove()`.

Rendered in this order:
1. `<li class="course-card course-card-${placement.state}"
   data-placed={code} aria-busy tabIndex={-1} draggable={!readOnly}
   data-drag-code title={reasons}>`
2. `<strong>{code}</strong>`, then `<span> — {title}</span>`
3. The state badge `p.badge.badge-state-${state}` (visually hidden when
   `available`), then `p.badge.badge-reason`
4. `p.badge.badge-verify` with "Verify on P&C: {placement.verify.join("; ")}"
5. `p.badge.badge-conflict`, `p.badge.badge-unknown`, `p.badge.badge-projected`
6. `p.course-card-allocation`: "Counts toward {groupLabel(view,
   countsToward)}" / "Not counting toward any requirement"
7. `p.badge.badge-unplaced-prereqs`, then `ul.course-card-suggestions` of
   buttons (soft only)
8. `div.course-card-actions`, holding `PlaceInMenu` (placed, currentTerm)
   + Details + Remove
9. `<CourseDetail … open={detailsOpen} onClose=…/>`

**`src/components/AvailableCourseCard.tsx`** (sidebar/search card). Props:
`view, code, course?: CourseCard, placement: PlacementView | null, planId,
onChanged, onAnnounce, onDragStart?, onDragEnd?, openMenuCode,
onMenuOpenChange, onLocateCourse`.

Class: `course-card-sidebar-placed` | `course-card-hard` (allBlocked) |
`course-card-unplaced`. It's draggable only when `!readOnly &&
!placement`.

Rendered in this order:
1. `<strong>{code}</strong><span> — {title}</span>`
2. `<p class="course-card-units">{units} units, {offeredLabel}</p>`
3. The Blocked and reason badges
4. The placed status, "Placed in <button class="course-card-term-link">"
5. `div.course-card-actions`, holding `PlaceInMenu` (unplaced) + Details
6. `CourseDetail`

**`src/components/PlaceInMenu.tsx`.** Props:

```ts
interface Props {
  view: PlanView; code: string; onPlace: (term: number) => void; disabled?: boolean;
  placed?: boolean; currentTerm?: number; hardBlockedOverride?: Record<number, string>;
  open: boolean; onOpenChange: (open: boolean) => void;
}
```

It computes:

```ts
const allTargets = dropTargets(view, code, hardBlockedOverride).filter((t) => t.term !== currentTerm);
const targets = allTargets.filter((t) => t.allowed);
const blockedReasons = Array.from(new Set(allTargets.filter((t) => !t.allowed && t.reason).map((t) => t.reason as string)));
```

It renders a toggle `button[aria-haspopup][aria-expanded]` ("Move to…" /
"Place in…"), then `<ul hidden role="menu" aria-label="Move|Place ${code}
to|in">` of `menuitem` buttons, or "No available terms — reasons". It
closes on any `pointerdown` outside its root.

**`src/components/MoreOptions.tsx`.** Props `{ open: boolean; onOpenChange:
(open: boolean) => void; children }`. Its root is `div.more-options`
(`ref`, Escape closes it and refocuses the toggle). The toggle is
`button.more-options-toggle aria-label="More options" aria-expanded
aria-controls="more-options-panel"` with the three-dot SVG. The panel is
`div#more-options-panel.more-options-panel hidden={!open}`. It closes on
an outside `pointerdown`. Planner uses it with `MORE_OPTIONS =
"more-options"` in the shared `openMenuCode`.

**`src/components/CourseDetail.tsx`.** Props `{ view; code; course?;
planId; open: boolean; onChanged; onAnnounce; onClose }`. `useEffect(() =>
{ if (open) dialogRef.current?.showModal(); else …close(); }, [open])`.
When `placement.checks.length > 0` it renders `<h3>Your checks</h3>` then
one `fieldset.verify-check` per check. The first focusable element is the
"Close" button. It renders twice for a placed course (timeline card and
sidebar entry), so IDs must come from `useId()`.

**`src/components/planner-logic.ts`:** `dropTargets(view, code,
hardBlockedOverride?) → DropTarget[]` (`{ term; allowed; reason: string |
null }`), `groupLabel(view, groupId)`. Tests are in
`planner-logic.test.ts`, which builds real views with `buildPlanView(cat,
AACOM_2027, plan)` and `emptyPlan()`.

**`src/lib/domain/view.ts`:** `CourseCard.units: number`, `twoSemester:
boolean` (units is per semester), `offeredLabel`. Placement fields used:
`verify: string[]` (the unanswered labels), `checks`, `state`, `term`.

**CSS (`src/styles.css`):**
- `.course-card` (padding `0.7rem 0.8rem`, radius `0.7rem`)
- `.course-card strong`
- `.course-card-hard { opacity: 0.6; border-style: dashed; }`
- `.course-card-soft`
- `.course-card-actions` (flex wrap, gap `0.4rem`)
- `.course-card-units, .course-card-allocation` (0.85em, unigrey)
- `.course-card-sidebar-placed` (paper, `--muted`)
- `.course-card-sidebar-placed strong, .course-card-sidebar-placed
  .course-card-units { color: var(--muted); }`
- `.more-options*` (toggle 2.75rem, panel `min-width: 14rem`, `>*`
  `min-height: 2.75rem`)
- `.badge*`, `.place-in-menu*`
- `.visually-hidden`
- `[draggable="true"] { cursor: grab }`

**Tests that this phase supersedes** (update them, don't delete them):
- `spec/planner.test.ts:232`, "Move to… for a placed COMP3630 omits …":
  it matches `<ul hidden role="menu" aria-label="Move COMP3630 to">`.
- `spec/layout.test.ts:1561–1671`, `describe("more options")`: the helper
  `moreOptions = page.getByRole("button", { name: "More options" })`
  (substring match), and tests at 1611 ("shares one open menu…") and 1627
  ("a press outside a course's Move to… menu…") use the "Move to…" button.
- `spec/layout.test.ts:1864`, the `openDetails` helper in `describe("manual
  checks")`: clicks the card's "Details" button.
- `spec/layout.test.ts:1916`: `card.locator(".badge-verify").count()` must
  be 0 after answering Met. Keep that class on the new badge, so the
  assertion stays meaningful.
- Existing mouse drags (`spec/layout.test.ts:616–745`) start with
  `card.hover()` at the card's centre, which after Task 1 may be the title
  button.
- `spec/planner.test.ts:315`, "each placed card has a Details button"
  (read-only `/plan/example`, matches `>Details<`): it breaks once Task 2
  drops the visible button on read-only plans. Task 1 replaces it (ruling,
  2026-09-28, found in execution review).

### Interfaces from earlier phases (exact)

None.

## 4. Approach

**Header** (`CourseCardHeader`), for both card kinds:

```
┌───────────────────────────────┐
│ ⋮⋮ COMP1130                 6u │  .course-card-head: grip (draggable only), code, units
│    Programming as Problem     │  button.course-card-title (opens Details)
│    Solving (Advanced)         │
```

**Timeline card:**
- The badges and suggestions keep their place.
- Then `div.course-card-foot` holds `p.course-card-allocation` and the
  card's `MoreOptions` (not rendered on read-only plans).
- The three-dot toggle is drawn at 2rem, with a 2.75rem hit area from a
  `::before`, so it doesn't grow the card.
- The panel **floats with `position: fixed`** (ruling 2026-09-28, option
  2, chosen over opening in place after side-by-side renders). An
  absolutely positioned panel was tried first and was clipped:
  `.timeline-scroll` is `overflow-x: auto`, so it also clips vertically,
  and it cut the panel off at the column's content height (panel
  293–547px, scroller 76–353px at 1920×1080). When it opens, before
  paint:
  - it's end-aligned to the toggle, 4px below it;
  - it flips 4px above when there's no room below;
  - failing both, it's pinned to the viewport's bottom gutter;
  - it's clamped to an 8px gutter horizontally, with `max-height:
    100vh − 16px` and its own scroll.

  It closes on any scroll outside the panel (it would otherwise detach
  from its toggle) and on resize. z-index 9: above the page, below the
  undo toast (10) and the touch-drag ghost (20).

**Sidebar/search card:** header, `p.course-card-offered`
(`offeredLabel`), the badges, then `div.course-card-actions` with "Place
in…" (not rendered on read-only plans).

**The Details trigger:** the title button sets `detailsOpen`. CR9's badge
opens the same dialog with `focusChecks`. The dialog then focuses its
"Your checks" heading (`tabIndex={-1}`) instead of "Close".

**Receding** (CR10): one CSS rule for "a card that recedes":
`background: var(--paper); color: var(--muted)`, with `strong` and
`.course-card-title` muted, and no `opacity`. The dashed border stays on
`.course-card-hard`. Task 13 (E4) adds `.course-card-receded` to the same
selector list.

## 5. Task breakdown

### Task 1: Shared card header with units, title button and drag grip

- [x] **Description:** add `unitsLabel`, create `CourseCardHeader`, and use
  it in both card components in place of `<strong>` + " — title" (and, in
  `AvailableCourseCard`, the units part of the old units line). The title
  opens Details. `AvailableCourseCard`'s visible "Details" button goes
  (CR7). The timeline card keeps its Details button until Task 2.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/CourseCardHeader.tsx` (new)
  - `src/components/CourseCard.tsx`
  - `src/components/AvailableCourseCard.tsx`
  - `src/components/CourseDetail.tsx` (heading only; ruling 2026-09-28)
  - `src/styles.css`
  - `spec/layout.test.ts`
  - `spec/planner.test.ts`
- **Step 0 (settle the drag question, before any test):**
  1. Temporarily wrap the timeline card's `<strong>` in a `<button>`,
     rebuild, and run a scratch Playwright script in the session
     scratchpad, not the repo. It presses on that button and moves 40px
     onto an open term. Record whether `dragstart` fires, via
     `page.evaluate` listening on `document`.
  2. Revert the scratch change.
  3. **If it fires:** keep every existing drag test as written.
     **If it doesn't:** CR3 already allows it ("wherever the browser
     supports"). Change each existing drag test's `card.hover()` to
     `card.locator(".course-card-grip").hover()` in this task, and state
     the finding in the commit message.
- **Tests first (red):**
  - **Unit, `describe("unitsLabel")`:**
    - `{units: 6, twoSemester: false}` → `{ short: "6u", full: "6 units" }`
    - `{units: 12, twoSemester: true}` → `{ short: "12+12u", full: "12+12
      units" }`
    - `{units: 1, twoSemester: false}` → `{ short: "1u", full: "1 unit" }`
  - **`spec/layout.test.ts`, new `describe("card header")`**, at 1920×1080
    on a fresh `planWithPlacement("COMP1130")` plan:
    1. The timeline card `[data-placed="COMP1130"]`:
       - `.course-card-code` text is "COMP1130";
       - in `.course-card-unit-count`, the `[aria-hidden="true"]` span's
         text is "6u", the `.visually-hidden` span's text is "6 units",
         and that span's computed width is "1px" (ruling 2026-09-28:
         Chromium's `innerText` includes visually-hidden text, so
         "innerText is 6u" could never pass);
       - the units' right edge is within 1px of the head's right edge;
       - no text node in the card contains " — ", including the card's
         own Details dialog (ruling 2026-09-28: its `<h2>` is fixed too).
    2. `getByRole("button", { name: "Programming as Problem Solving
       (Advanced), details" })` exists in that card and has
       `aria-expanded` absent. Clicking it opens `dialog[open]` whose
       `aria-label` is "COMP1130 details".
    3. A sidebar card (`.course-card-unplaced` containing "COMP1100") has
       a `.course-card-grip` with `aria-hidden="true"` and no `tabindex`,
       and has 0 buttons named "Details". Its title button opens its
       dialog.
    4. Drag from the grip: hover `.course-card-grip` of the COMP3630
       sidebar card, then `mouse.down`, move 20px, move into an open term
       (the `openTerm` pattern at `spec/layout.test.ts:692`), and
       `mouse.up`. Then `[data-placed="COMP3630"]` has count 1.
    5. `axeViolations(page)` is `[]`, and the same on `/plan/example`.
  - Both card tests at 390×844 as well: `horizontalOverflow` is 0.
  - **`spec/planner.test.ts`:** `html` for a fresh plan matches
    `/class="course-card-code">COMP1100</` and contains `>6u<`.
  - **`spec/planner.test.ts:315`**, renamed "each placed card's title
    opens Details": `/plan/example` html matches
    `/data-placed="COMP1130"[\s\S]{0,600}class="course-card-title"/`.
- **Implementation (green):**
  - `planner-logic.ts`:
    ```ts
    export interface UnitsLabel { short: string; full: string }
    export function unitsLabel(course: { units: number; twoSemester: boolean }): UnitsLabel
    ```
    - amount = `twoSemester ? \`${u}+${u}\` : \`${u}\``
    - `short = \`${amount}u\``
    - `full = \`${amount} unit${!twoSemester && u === 1 ? "" : "s"}\``
  - `CourseCardHeader.tsx`, default export:
    ```ts
    interface Props {
      code: string;
      title: string;
      units: { units: number; twoSemester: boolean };
      grip: boolean;
      onOpenDetails: () => void;
    }
    ```
    It renders a fragment:
    - `div.course-card-head`, containing:
      - `{grip && <span class="course-card-grip" aria-hidden="true">` +
        a 6-dot SVG (two columns of three circles, `fill: currentColor`)
        `</span>}`
      - `<strong class="course-card-code">{code}</strong>`
      - `<span class="course-card-unit-count"><span
        aria-hidden="true">{short}</span><span
        class="visually-hidden">{full}</span></span>`
    - `<button type="button" class="course-card-title"
      aria-label={\`${title}, details\`}
      onClick={onOpenDetails}>{title}</button>` (ruling 2026-09-28: a
      visually-hidden ", details" span is absolutely positioned, and
      Chromium then names the button "… , details" with a stray space)
  - `CourseCard.tsx`: replace the `<strong>`/`<span>` pair with
    `<CourseCardHeader code={placement.code} title={course?.title ??
    placement.code} units={course ?? { units: 0, twoSemester: false }}
    grip={!readOnly} onOpenDetails={() => setDetailsOpen(true)} />`.
  - `AvailableCourseCard.tsx`:
    - the same, with `grip={draggable}`;
    - replace the units line with `<p
      class="course-card-offered">{course.offeredLabel}</p>`;
    - delete its Details button, but keep the `.course-card-actions` div
      for "Place in…";
    - in `styles.css`, change the a261afe rule's `.course-card-units`
      selector to `.course-card-offered`.
  - `styles.css`:
    - `.course-card-head { display: flex; align-items: center; gap:
      0.35rem; }`
    - `.course-card-unit-count { margin-inline-start: auto; font-size:
      0.8rem; color: var(--unigrey); font-variant-numeric: tabular-nums;
      }`
    - `.course-card-grip`: 0.9rem, `color: var(--muted)`, `cursor: grab`
    - `.course-card-title`: reset to plain text (`padding: 0; border: 0;
      background: none; font: inherit; font-weight: 400; color:
      var(--ink); text-align: start; cursor: pointer;` and `display:
      block; margin-top: 0.15rem;`), with `:hover` and `:focus-visible`
      adding `text-decoration: underline; text-underline-offset: 0.15em`.
      The base `button:hover` border rule must not draw a border: set
      `border: 0` on `.course-card-title:hover` too.
    - Rename `.course-card-units` in `.course-card-units,
      .course-card-allocation` to `.course-card-offered`.
  - `CourseDetail.tsx`: the `<h2>` becomes `{code}{" "}<span
    class="course-detail-title">{course.title}</span>`, and
    `.course-detail-title { display: block; }` puts the title on its own
    line, as on the card, with no em dash.
  - Rulings made during execution (2026-09-28):
    - the dialog's help sentences ("Your checks", "Pin to") are reworded
      without " — ", and `RequisiteTree`'s "label — status" separators
      become "label: status", so the em-dash check covers the whole
      dialog (catalogue data, such as descriptions, is left as is);
    - `.course-card` gets `position: relative`, so the hidden units text
      stays inside the card instead of escaping the sidebar's scrolling
      strip and widening the page at 390px;
    - `spec/planner.test.ts:272`, `:307` and `:315` swap their
      `[\s\S]{0,N}` windows for `(?:(?!<dialog)[\s\S])*?`, so the text
      must be in that card's body however long the header is.
- **Refactor:** none expected.
- **Acceptance criteria:**
  - The unit and spec tests above pass.
  - The existing "course cards" button-gap test still passes (the title is
    a button now, so it's measured too).
  - `pnpm check` is green.
  - Screenshots at both viewports show the header line and the title with
    no em dash.
- **Depends on:** none.

### Task 2: Timeline card three-dot menu; read-only plans render no edit controls

- [x] **Description:**
  - Extract `menuTargets`.
  - Give `MoreOptions` a per-instance ID, a label and a class.
  - Move Details, the "Move to" term list and Remove into a per-card
    `MoreOptions` in a new card footer, and delete the visible buttons.
  - Stop rendering "Place in…" and card menus on read-only plans.
  - Drop PlaceInMenu's now-unused `placed`/`currentTerm` props.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/MoreOptions.tsx`
  - `src/components/PlaceInMenu.tsx`
  - `src/components/CourseCard.tsx`
  - `src/components/AvailableCourseCard.tsx`
  - `src/styles.css`
  - `spec/planner.test.ts`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("menuTargets")`**, on `buildPlanView(cat,
    AACOM_2027, emptyPlan())`:
    - `menuTargets(view, "COMP3630", { currentTerm: 2 })`: `targets`
      contains no term 0 (hard-blocked) or 2 (current), and every entry
      has `allowed: true`.
    - `blockedReasons` is deduplicated and includes
      `view.courses.COMP3630.hardBlocked[0]`.
    - With `hardBlockedOverride: { 0: "x", 1: "x" }` on `"PSYC1004"`,
      `blockedReasons` is `["x"]`.
  - **`spec/planner.test.ts:232`** (renamed "the Move to list for a placed
    COMP3630 omits …"): it matches `/<ul class="card-menu-terms"
    aria-label="Move COMP3630 to">[\s\S]*?<\/ul>/`, with the same three
    term expectations.
  - **`spec/layout.test.ts`, `describe("more options")`:**
    - `moreOptions` becomes `page.getByRole("button", { name: "More
      options", exact: true })`.
    - 1611 is renamed "shares one open menu with the course menus": use
      `cardMenu = page.getByRole("button", { name: "More options for
      COMP1130" })` in place of `moveTo`. The same four expectations
      apply.
    - 1627 is renamed "a press outside a course's menu closes it, even on
      its own card":
      - open `cardMenu`, then click the card's `.course-card-code`:
        `aria-expanded` becomes "false";
      - reopen it and click `.card-menu-heading`: it stays "true"
        (execution call, 2026-09-28: the list reset leaves
        `.card-menu-terms` unpadded, so `{x: 2, y: 2}` landed on the first
        term button, moving the course and closing the menu);
      - click `h1`: "false".
  - **New `describe("course card menu")`**, at 1920×1080 on a fresh
    `planWithPlacement("COMP1130")` plan unless stated:
    1. The card `[data-placed="COMP1130"]`:
       - has 0 buttons named "Move to…", "Details" (exact) or "Remove"
         visible while the menu is closed;
       - the menu toggle's `aria-controls` resolves to exactly one
         element;
       - two different cards' `aria-controls` values differ.
    2. Opening the menu shows, in DOM order: a button "Details", the text
       "Move to", a `ul.card-menu-terms` whose buttons are the reachable
       terms, and a button "Remove". Escape closes it and focuses the
       toggle.
    3. "Details" in the menu closes the menu and opens `dialog[open]`
       for COMP1130.
    4. Clicking the "S1 2028" term button in the menu moves the card:
       `[data-term="2"] [data-placed="COMP1130"]` has count 1.
    5. "Remove" in the menu removes the card, and `.undo-toast` contains
       "Removed COMP1130". "Undo" restores it.
    6. At 390×844 and at 1920×1080, the open panel's `getBoundingClientRect`
       is inside `.timeline-scroll`'s rect horizontally, and
       `horizontalOverflow` is 0. Also (ruling 2026-09-28), for every
       button in the panel (at least one), after
       `scrollIntoView({ block: "nearest" })`:
       - `document.elementFromPoint` at its centre is that button or
         inside it;
       - every ancestor with `overflow-y` hidden or clip still has
         `scrollTop` 0, because `scrollIntoView` can scroll a hidden
         overflow, which a user can't.

       This catches a panel clipped by a scrolling ancestor, which the
       horizontal bounds alone missed.
    7. With the menu open, `axeViolations` is `[]`.
    7a. (ruling 2026-09-28, option 2) With the menu open, scrolling
       `.timeline-scroll` 200px sideways sets the toggle's `aria-expanded`
       to "false".
    8. **Read-only**, on `withPlan`: `.course-card-menu` has count 0;
       `getByRole("button", { name: "Place in…" })` has count 0; clicking
       the first timeline card's `.course-card-title` opens a dialog.
    9. **CR8:** on a fresh plan with `COMP2100` placed in term 3 (POST as
       in `spec/planner.test.ts`'s soft-card test), `[data-placed="COMP2100"]
       .course-card-suggestions button` has count > 0 and is visible
       with the menu closed.
  - **`spec/layout.test.ts:1864`**, `openDetails`: click
    `[data-placed="${code}"] .course-card-title` instead of the Details
    button.
- **Implementation (green):**
  - `planner-logic.ts`:
    ```ts
    export interface MenuTargets { targets: DropTarget[]; blockedReasons: string[] }
    export function menuTargets(
      view: PlanView,
      code: string,
      options: { currentTerm?: number; hardBlockedOverride?: Record<number, string> } = {},
    ): MenuTargets
    ```
    It holds PlaceInMenu's three computations, verbatim, as the body.
  - `MoreOptions.tsx`:
    - Props become `{ open; onOpenChange; label?: string; class?: string;
      fixed?: boolean; children }`. `fixed` (ruling 2026-09-28) adds
      `.more-options-panel-fixed`. A `useLayoutEffect` on `[open,
      fixed]` then writes the panel's top/left/max-height (§4's rules)
      straight onto the element, so nothing paints at the wrong spot.
      While open, it closes on a capture-phase `scroll` whose target
      isn't inside the panel, and on `resize`. The timeline card passes
      `fixed`.
    - `const panelId = useId();` (from `preact/hooks`), used for the
      panel's `id` and `aria-controls`.
    - The toggle's `aria-label={label ?? "More options"}`.
    - The root's `class={\`more-options${className ? \` ${className}\` :
      ""}\`}`.
    - The existing call in Planner is unchanged.
  - `PlaceInMenu.tsx`:
    - Remove the `placed` and `currentTerm` props. The button label is
      always "Place in…" and the `aria-label` is `Place ${code} in`.
    - Use `menuTargets(view, code, { hardBlockedOverride })`.
  - `CourseCard.tsx`:
    - Delete `.course-card-actions` (PlaceInMenu, Details, Remove) and
      the PlaceInMenu import.
    - After the suggestions, render `<div class="course-card-foot">`. It
      holds the existing `p.course-card-allocation`, then `{!readOnly &&
      <MoreOptions class="course-card-menu" label={\`More options for
      ${placement.code}\`} open={openMenuCode === placement.code}
      onOpenChange={(open) => onMenuOpenChange(placement.code, open)}>…}`
      containing:
      - `<button type="button" onClick={() => {
        onMenuOpenChange(placement.code, false); setDetailsOpen(true);
        }}>Details</button>`
      - `<p class="card-menu-heading">Move to</p>`
      - if `targets.length === 0`: `<p class="card-menu-empty">No
        available terms{reasons.length > 0 && <> — {reasons.join("; ")}</>}</p>`;
        otherwise `<ul class="card-menu-terms" aria-label={\`Move
        ${code} to\`}>`, one `<li><button type="button"
        disabled={pending} onClick={() => { onMenuOpenChange(code,
        false); void move(t.term); }}>{view.terms[t.term].label}</button></li>`
        per target
      - `<button type="button" class="card-menu-remove"
        disabled={pending} onClick={() => { onMenuOpenChange(code,
        false); void remove(); }}>{pending ? "Removing…" : "Remove"}</button>`
    - `targets`/`reasons` come from `menuTargets(view, placement.code, {
      currentTerm: placement.term })`.
  - `AvailableCourseCard.tsx`: render the `.course-card-actions` div (and
    PlaceInMenu) only when `!readOnly && !placement`.
  - `styles.css`:
    - `.course-card-foot { display: flex; align-items: flex-start; gap:
      0.4rem; margin-top: 0.35rem; }` with `.course-card-foot
      .course-card-allocation { flex: 1; margin: 0; }`
    - `.course-card-menu .more-options-toggle { width: 2rem; height:
      2rem; position: relative; }` with `::before { content: "";
      position: absolute; inset: -0.375rem; }`
    - in place of an anchored panel (ruling 2026-09-28, option 2):
      `.more-options-panel-fixed { position: fixed; inset: auto;
      margin: 0; min-width: 12rem; overflow-y: auto; z-index: 9; }`,
      with top/left/max-height set inline by `MoreOptions`
    - `.course-card-menu .more-options-panel > .card-menu-heading,
      .card-menu-empty { min-height: 0; margin: 0.25rem 0 0; font-size:
      0.8rem; color: var(--unigrey); }`
    - `.card-menu-terms`: a list reset in a column
    - term buttons full-width, `text-align: start`, `border: none` (the
      `.place-in-menu ul button` look)
- **Refactor:**
  - Delete `.place-in-menu` rules that only served `placed`. There are
    none today; confirm with a grep.
  - The earlier "course cards" gap test should still pass. The suggestion
    buttons and the three-dot toggle are the only buttons left on a
    timeline card.
- **Acceptance criteria:**
  - All tests above pass.
  - On `/plan/example` at 1920×1080, no timeline card shows a disabled
    button.
  - `pnpm check` is green.
  - Screenshots show the footer with the three-dot toggle on the
    "Counts toward" line, and the open panel inside the card column.
- **Depends on:** Task 1.

### Task 3: Verify badge that opens Details at "Your checks"

- [x] **Description:** replace the verify paragraph with a badge button
  (the class `badge-verify` is kept), and add a `focusChecks` prop to
  `CourseDetail`.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/CourseCard.tsx`
  - `src/components/CourseDetail.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("verifyBadgeText")`:** `1` → "Verify on P&C: 1
    item", `2` → "Verify on P&C: 2 items".
  - **`spec/layout.test.ts`, `describe("manual checks")`**, new test "the
    verify badge opens Details at Your checks". It uses the existing
    `planWithMath1116()`.
    - `[data-placed="MATH1116"] button.badge-verify` has text "Verify on
      P&C: 2 items", and the card's `innerText` doesn't contain "with a
      mark of 60" (execution call, 2026-09-28: `textContent` includes the
      card's own closed dialog, whose legends list the items in full).
    - Clicking it opens `dialog[open]`, and
      `document.activeElement.textContent` is "Your checks".
    - At 390×844, `horizontalOverflow` is 0.
  - The existing test at `spec/layout.test.ts:1916` (count 0 after Met)
    must still pass. It proves the badge disappears, not just the text.
  - **`spec/layout.test.ts:435`**, "scrolls each pane on its own while the
    title stays put" (ruling 2026-09-28, found in execution): the badge
    shrinks the example's tallest column so its timeline fits at
    1920×1080 (scrollHeight 1173 → 887, clientHeight 983). The test runs
    at 1920×800 instead and first asserts that both panes overflow.
- **Implementation (green):**
  - `planner-logic.ts`: `export function verifyBadgeText(count: number):
    string`.
  - `CourseDetail.tsx`:
    - new prop `focusChecks?: boolean`;
    - `const checksId = useId();`;
    - render `<h3 id={checksId} tabIndex={-1}>Your checks</h3>`;
    - in the open effect, after `showModal()`: `if (focusChecks)
      document.getElementById(checksId)?.focus();`. Add `focusChecks` to
      the effect deps.
  - `CourseCard.tsx`:
    - `const [detailsFocus, setDetailsFocus] = useState<"top" |
      "checks">("top")`;
    - the title and menu Details set "top", then open;
    - replace `p.badge-verify` with `<button type="button" class="badge
      badge-verify" onClick={() => { setDetailsFocus("checks");
      setDetailsOpen(true); }}>{verifyBadgeText(placement.verify.length)}</button>`,
      rendered when `placement.verify.length > 0`;
    - pass `focusChecks={detailsFocus === "checks"}`.
  - `styles.css`: `button.badge-verify` keeps the `.badge-verify` look
    (paper, unigrey), and adds `cursor: pointer` and an underline on
    hover/focus-visible, with `border-color: transparent` on hover so
    the base button hover rule doesn't add a border.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass, including all of the existing `describe("manual checks")`.
  - `pnpm check` is green.
  - The MATH1116 timeline card is visibly shorter than before (screenshot).
- **Depends on:** Task 2 (the card's Details state and footer).

### Task 4: Blocked cards recede by colour, not opacity

- [x] **Description:** replace `.course-card-hard`'s opacity with the
  receding treatment, shared with `.course-card-sidebar-placed`.
- **Files touched:**
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **`spec/layout.test.ts`, `describe("course cards")`**, new "a blocked
    card recedes without fading its controls". On a fresh
    `planWithPlacement("COMP1130")` plan at 1920×1080:
    1. Take the first `.course-card-unplaced`, and in `page.evaluate`
       replace its `course-card-unplaced` class with `course-card-hard`.
       This is why: a hard placement is refused by the server (overview
       §2.4), and this test is about the CSS rule, not how the state
       arises.
    2. Assert that it has at least 1 button.
    3. For every button in it, the product of `opacity` over the button
       and all its ancestors is 1. Use the same walk as the existing
       "recedes without fading its buttons" test.
    4. Its `.course-card-code` colour differs from an untouched unplaced
       card's, and its computed `border-top-style` is "dashed".
  - Red on today's CSS: the opacity product is 0.6.
- **Implementation (green):**
  - `.course-card-hard { border-style: dashed; }` loses `opacity`.
  - Merge it into the receding rule: `.course-card-sidebar-placed,
    .course-card-hard { background: var(--paper); color: var(--muted); }`,
    and `… strong, … .course-card-title, … .course-card-offered { color:
    var(--muted); }` for both.
- **Refactor:** keep one selector list (Task 13 appends
  `.course-card-receded` to it). Add a comment naming why opacity is
  banned there.
- **Acceptance criteria:**
  - The test passes and fails on the old CSS (confirm red after
    rebuilding).
  - `pnpm check` is green.
- **Depends on:** Task 1 (`.course-card-title`, `.course-card-offered`).

## 6. Phase Definition of Done

- [x] Tasks 1–4 complete, their tests passing
- [x] `pnpm exec vitest run --project unit` passes
- [x] `pnpm check` passes
- [x] Screenshots at 1920×1080 and 390×844 of `/plan/example` and a fresh
      plan with an open card menu, checked for:
  - [x] no em-dash titles;
  - [x] no disabled buttons on the read-only example;
  - [x] a panel inside its column
- [x] Tick Phase 01 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CR1 | Task 1 |
| CR2 | Task 1 |
| CR3 | Task 1 |
| CR4 (text and position only) | Task 2 |
| CR5 | Task 2 |
| CR6 | Task 2 |
| CR7 | Task 1 (Details via title), Task 2 (no menu; Place in… kept) |
| CR8 | Task 2 (test 9) |
| CR9 | Task 3 |
| CR10 | Task 4 |
| CR11 | Task 2 (test 8) |
| CR25 | Tasks 1–3 (superseded tests listed in §3) |

## 8. Risks / open questions

None. The drag-from-button question is settled by Task 1, step 0, with
both outcomes defined.
