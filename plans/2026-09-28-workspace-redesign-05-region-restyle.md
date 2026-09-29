# Workspace redesign — Phase 05: region restyle and timeline chrome

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read §3
  (visual verification rule) and §4.4 (constants).
- **Depends on phases:** 02, for the details panel as the third region.

## 1. Summary

The workspace gets its new look:
- solid rounded regions on a slightly darker page background
- a radius hierarchy (regions, cards, controls)
- frosted glass only on an allowlisted set of floating layers, **enforced by
  a spec check**
- Requirements reordered: "What's left" without TDP, Total, then Checks with
  bars and plain notes
- the timeline grouped into years under sticky frosted headers, with edge
  fades and ‹ › scroll buttons

The layout mechanics (widths, resizing) are unchanged in this phase.

## 2. Requirements (this phase)

### 2.1 Functional

- WR20–WR25: all.
- WR22: the allowlist check covers layers added in later phases too. Their
  selectors are listed now.
- Carried from the Phase 02 review (2026-09-29): decide once, site-wide,
  whether figures (units, weights, class numbers, dates) use a monospaced
  face, as in the mockup. Today they use tabular numerals, inconsistently.
  Phase 02 deliberately didn't make that call for the details sidebar alone.

### 2.2 Non-functional

- The card-height budget and every overflow and fit test still pass.
- axe (in a real browser, with contrast) is clean at 1920×1080 and 390×844.
- Motion: none added, apart from the hover transitions already present.

### 2.3 Out of scope for this phase

| Item | Phase |
| --- | --- |
| Resizing and the drawer | 06 |
| Phone tabs and sheet | 07 |
| The glass on the sheet and tab bar | 07 (the selectors are pre-allowlisted in Task 13) |

### 2.4 Assumptions

See overview §2.4. The existing tokens in `src/styles.css:7-48` stay.
New tokens are added; none are renamed.

## 3. Existing code context (verified 2026-09-28)

**`src/styles.css`** (2,329 lines)
- Tokens at :7-48: `--ink #17181a`, `--unigrey`, `--muted #6b6f76`,
  `--paper #f5f6f8`, `--surface #fff`, `--line #e0e2e7`, `--gold #be830e`,
  `--gold-tint`, `--moss`, `--amber`, `--rust` and their tints, the family
  colours, `--radius: 0.6rem`, `--reqs-w-*` and `--timeline-min: 31rem`.
- `.planner-layout` (:466) is `container: planner / inline-size`.
- `.planner-panes` (:470) is a column flex (stacked) and becomes
  side-by-side at container ≥ 49.5rem (:1901).
- `.timeline-scroll` (:902) is a flex row with `overflow-x: auto;
  overflow-y: hidden`.
- `.term` (:1113) and `.term-head` (:1129) hold an `h2` with the term label.
- :1223 is the **sibling-dependent** two-semester outline rule:
  `.timeline-scroll[data-drag-span="2"]
  .term.drag-hover-target:not(.term-disallowed) + .term`.

**`src/components/Timeline.tsx`**
- It renders `div.timeline > div.timeline-scroll > section.term[data-term]`
  for each `view.terms`, with:
  - `div.term-head` (h2 and `p.term-units`)
  - `div.term-bar`
  - an overload badge
  - `p.term-reason`
  - `ul.term-cards`
- `dragOverTerm` state holds the term under a mouse drag.
- `PrereqOverlay` is the first child of `.timeline-scroll`. It measures card
  rects, so wrappers are fine.

**`src/components/Sidebar.tsx`**
- Sections in order: "What's left" (`SidebarSection id="outstanding"`), the
  search section (gone after Phase 04; if Phase 04 hasn't landed, leave it
  in place), then Total with `section[aria-label="program checks"] >
  h3 "Checks" > ul.checks-list > li[data-check] > h4` plus either
  `ProgressBar` or `<p>not tracked — verify on P&C</p>`.
- Top-level groups use `SidebarSection` (`li.requirement-group[data-group]`).

**`src/components/planner-logic.ts`**
- `outstandingItems(view)` pushes `"${check.label} — not tracked, verify on
  P&C"` for `check.ok === null`. That's the TDP line WR24 removes.
- `CheckView` (view.ts): `{ id, label, bound: "min" | "max", units,
  completed, planned, ok: boolean | null }`.

**Tests**
- `spec/layout.test.ts` "progress bars" (:3465) and "card height budget"
  (:3520).
- The "family colours" suite (:3011).
- Any test reading "not tracked — verify on P&C" in What's left: grep for
  `not tracked` and update it.

### Interfaces from earlier phases (exact)

From Phase 02:
- `<aside class="details-panel" aria-label="Course details">`, rendered by
  `CourseDetailsPanel` (fixed drawer CSS for now).
- The details sidebar has no grip (removed in the Phase 02 review).

From Phase 04 (if landed):
- `div.palette-backdrop > div.course-search.palette[role=dialog]`
- `button.search-trigger`

From the undo-redo plan (`plans/2026-09-29-undo-redo.md`):
- `.plan-actions > div.history-controls > button.history-button` ×2
  (Undo, Redo), editable plans only, after `.completed-control`. Below
  `44rem` it's absolutely positioned at the end of the title's line.

### Execution review rulings (2026-09-29)

These were settled with the user before implementation. They override the
text below where the two differ.

1. **Scroller.** Today `.planner-timeline-area` scrolls vertically and
   `.timeline-scroll` scrolls sideways, so a sticky year head inside the
   latter can never stick. `.timeline-scroll` becomes the timeline
   region's only scroller, in both axes. The region itself doesn't scroll,
   and the toolbar, legend and hint sit fixed above the scroller as the
   region head. The tests that set `.planner-timeline-area.scrollTop`
   (plan-header-and-fit "scrolls each pane on its own", and the timeline
   prereq-legend in-view test) switch to the new scroller. Their
   assertions don't change.
2. **Requirements region.** `aside#requirements` stays its own scroller
   and takes the radius and border directly. There's no inner scroll div.
3. **Figures.** Not monospaced. Every figure (units, weights, class
   numbers, dates) uses `font-variant-numeric: tabular-nums` through one
   shared rule. This is done in Task 13.
4. **Year source.** `Timeline` groups by `TERMS[term.index].year` from
   `src/lib/domain/terms.ts`. `TermView` is unchanged, so the payload is
   too.

Routine calls made in the same review:
- The new browser describes go in new files, because `timeline.test.ts`
  is at 876 of its 1000 lines: `spec/layout/regions.test.ts` (Task 13)
  and `spec/layout/timeline-years.test.ts` (Task 15). Task 14's browser
  tests go in `requirements-panel.test.ts`.
- `.details-head` isn't sticky yet. Task 13 makes it sticky so that its
  glass shows anything.
- "The page behind the planner" means `body:has(.planner)`.
- Sidebar's section order is already What's left, then Total (holding
  Checks), then the groups. So Task 14 only adds the notes.

## 4. Approach

**Tokens.** Add these to `:root`:
- `--ground: #e8eaee` (page behind regions; hue-biased like `--paper`)
- `--r-region: 16px`, `--r-card: 9px`, `--r-control: 8px`
- `--glass: rgb(255 255 255 / 0.74)`, `--glass-edge: rgb(255 255 255 / 0.9)`
- `--glass-blur: blur(18px) saturate(1.6)`

**Glass utility.**
- `.glass { background: var(--glass); backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur); }`
- `@media (prefers-reduced-transparency: reduce) { .glass { background:
  var(--surface); backdrop-filter: none; -webkit-backdrop-filter: none; } }`

**Glass allowlist** (WR22). These are the only elements allowed a
`backdrop-filter`:

```
.timeline-year-head, .details-head, .palette, .undo-toast, .drag-ghost,
.size-tip, .tabbar, .sheet-head
```

The check is a `spec/layout.test.ts` test. It walks every element in the
document and asserts that any element whose computed `backdropFilter` isn't
"none" matches one of those selectors. Later phases' layers are listed now,
so adding glass anywhere else fails the build. That puts the rule in the
harness, not just in a review.

**Regions.**
- `.planner-timeline-area`, `aside#requirements` and `.details-panel` get
  `.region` styling: `--surface` background, a 1px `--line` border,
  `border-radius: var(--r-region)`, and `overflow: hidden` with an inner
  scroller.
- The page behind the planner uses `--ground`.

**Inside regions.**
- Groups lose their card look and become sections split by hairlines.
- Course cards keep `--r-card`. Buttons and inputs use `--r-control`.

**Timeline years.**
- `Timeline` groups `view.terms` in pairs by `year` into
  `div.timeline-year`, each holding:
  - `div.timeline-year-head.glass`, sticky at the top, with the year label
    `aria-hidden="true"` (the term h2s already say the year)
  - the two `section.term[data-term]` elements
- The sibling outline rule becomes an explicit class: `Timeline` adds
  `drag-hover-next` to term `dragOverTerm + 1` when
  `draggingTwoSemester`, for mouse drags. `touch-drag.ts` does the same when
  it sets `drag-hover-target` and the drag spans two terms; its callers pass
  the span in.
- The ‹ › buttons live in a new `div.timeline-toolbar` (the region head),
  with the names "Scroll to earlier semesters" / "Scroll to later
  semesters". They're disabled at the ends and scroll by 80% of the client
  width.
- Edge fades are `.timeline-scroll-wrap.more-left` / `.more-right`
  gradients, updated on scroll and resize.

## 5. Task breakdown

### Task 13: Region tokens, radius hierarchy, `.glass` with fallback, and the glass allowlist check

- [x] **Done 2026-09-29.** The user accepted it after one review round,
  which added thin, clear-track scrollbars inset from the regions'
  corners, like the mockup's. Also: the terms became `--paper` lanes, the
  title's h1 keeps proportional digits, and `.details-panel` uses
  `background-attachment: local` so the head's glass frosts only the
  panel. Task 15's year heads are likely to need the same fix on their
  scroller.

- **Description:** WR20–WR22.
- **Files touched:**
  - `src/styles.css`
  - `Planner.tsx` (region class hooks)
  - `CourseDetailsPanel.tsx` (`.details-head.glass`)
  - `Sidebar.tsx`
  - `spec/layout.test.ts`
- **Tests first (red):** in `spec/layout.test.ts`, `describe("regions and
  glass")`:
  - "regions are rounded surfaces on the ground": at 1920×1080,
    `aside#requirements`, `.planner-timeline-area` and `.details-panel`
    (with `?course=COMP2100`) each have `border-top-left-radius` ≥ 14px and
    a computed background equal to `--surface`. The planner's backdrop
    equals `--ground`.
  - "glass only on the allowlist": with `?course=COMP2100` and the palette
    open (if Phase 04 has landed), every element with a computed
    `backdropFilter` other than "none" matches the allowlist in this file's
    §4.
  - "reduced transparency removes glass": Playwright can't emulate
    `prefers-reduced-transparency`, so this is a static check. The test
    reads `src/styles.css` as text (`readFileSync`) and asserts both:
    - it contains a `@media (prefers-reduced-transparency: reduce)` block
      whose `.glass` rule sets `backdrop-filter: none` and `background:
      var(--surface)`
    - every `backdrop-filter:` declaration outside that block sits in a rule
      whose selector is `.glass` or in the allowlist
  - "cards keep a smaller radius than regions": a `.course-card`'s radius
    is less than the region's.
- **Implementation (green):**
  - The tokens and `.glass` from this file's §4.
  - `.region` rules on the three regions.
  - `.glass` is applied to every floating layer that exists at this point:
    - `.details-head`, the panel's sticky header
    - `.undo-toast`
    - the touch-drag ghost `.drag-ghost` (`touch-drag.ts` adds the class to
      its clone)
    - `.palette`, if Phase 04 has landed

    Later layers take `.glass` in their own tasks: `.size-tip` (Task 18),
    `.tabbar` (Task 20) and `.sheet-head` (Task 21).
  - Requirement group cards are flattened: remove their border, radius and
    background, and add `border-block-end: 1px solid var(--line)`.
  - The header controls take the control tier (`--r-control`) and a
    consistent look as one set: `.completed-toggle`, the
    `.history-controls` Undo/Redo `.history-button`s (from the undo-redo
    plan), `.more-options-toggle`, and `button.search-trigger` if Phase
    04 has landed. Keep the history buttons at least 44px, and keep their
    disabled state visibly muted. Below `44rem` they sit at the end of the
    title's line, so check both placements.
- **Refactor:** Delete the per-group card rules this replaces.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - The card-height budget still passes.
- **Human review:** the running app at 1920×1080 and 390×844, with and
  without `?course=COMP2100`. A pass means:
  - the regions read as distinct, calm areas
  - the header controls (including Undo/Redo) read as one set
  - only floating layers look frosted
  - nothing looks like boxes inside boxes
  - it matches the approved mockup's spirit (overview §0, "Visual
    reference")
- **Depends on:** Phase 02.

### Task 14: Requirements order: "What's left" without TDP, Total, Checks with bars and plain notes

- [x] **Done 2026-09-29.** A maximum reached exactly reads "At the limit",
  a case the plan didn't name. Two sidebar-groups tests used the example
  plan's TDP line to test jumping to a check. They now use a fresh plan's
  failing 4000-level COMP check, with the same assertions.

- **Description:** WR24 and WR25.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
  - `spec/planner.test.ts`: the SSR assertion at :321 expects "not
    tracked — verify on P&amp;C" inside Checks. Change it to the
    `checkNote` text, "Not tracked yet. Check it on Programs &amp;
    Courses."
- **Tests first (red):**
  - `planner-logic.test.ts`:
    - "outstandingItems omits untracked checks": on the example view there's
      no item containing "TDP". Checks that are `ok === false` are still
      listed.
    - `checkNote(check)`:
      - `{bound:"max", units:60, completed:48, planned:0}` gives "Room for
        12 more units"
      - with 66 in total, it gives "6 units over the limit"
      - `{bound:"min", units:48, completed:0, planned:60}` gives "Covered,
        with 12 units to spare"
      - exactly 48 gives "Covered"
      - 30 gives "18 units still needed"
      - `ok === null` gives "Not tracked yet. Check it on Programs &
        Courses."
  - `spec/layout.test.ts`:
    - "What's left has no TDP line": its text doesn't contain "TDP".
    - "Checks show bar and note": each `li[data-check]` with a tracked check
      has a `[role=progressbar]` and a `p.check-note` equal to `checkNote`.
      The TDP row has "Not tracked" and no bar.
    - Update any test that expected "not tracked — verify on P&C" in What's
      left.
- **Implementation (green):**
  - `export function checkNote(check: CheckView): string` in
    `planner-logic.ts`.
  - `outstandingItems` drops its `ok === null` branch.
  - `Sidebar` renders `p.check-note` under each check, and the section
    order: What's left, Total, Checks, then the groups.
- **Refactor:** None expected.
- **Acceptance criteria:** `pnpm check` passes.
- **Depends on:** Task 13 (same CSS areas).

### Task 15: Year-grouped timeline, sticky frosted year headers, edge fades and scroll buttons

- [x] **Done 2026-09-29.** The user accepted it after several review
  rounds, which ruled:
  - **Scroll buttons:** ‹ › float over the right end of the 44px year band,
    on a backing that fades out toward the start. They're hidden below
    49.5rem, where the band is 30px.
  - **Budgets:** "leaves nothing above the timeline" now measures to the
    year band. The "gives the height back" limits rise by the band (+44
    desktop, +30 phone). The phone card budget is relaxed to "the first
    card fits" until Phase 07 restores it (noted in the Phase 07 file).
  - **Columns:** no lane rectangles. Hairlines divide the years. A term's
    heading shows only its session, with the year visually hidden.
  - **Sticky headers:** term headings are sticky too, merged into one
    frosted header per year: the band runs down behind the transparent
    `.term-top` rows. Those rows repeat a term's drag states (the grey,
    and the outline's top and sides), which the band would otherwise
    cover.
  - **Spacing:** tighter, with the cards unchanged. Every card sits 1rem
    from each column edge, and the header ends clear of a first card's
    5px ring.
  - **Header strip:** after the phase closed, the frosted header was made
    one strip from edge to edge. The region lost its 0.15rem gutter, and
    the hairlines are drawn over the glass. Then it became a single glass
    element, `.timeline-glass`, since touching per-year bands still
    seamed: a backdrop blur stops at its own element's edge. The element
    is viewport-wide and sticky both ways, because Chromium left a
    scroll-wide strip unblurred wherever it was off screen at first
    paint. The allowlist swaps `.timeline-year-head` for
    `.timeline-glass`.
  - **Cutoff line:** the gold cutoff line is removed. The Completed
    control's description and Help now say each completed semester is
    marked in its heading. `.term.term-cutoff` replaced the
    `nth-of-type` rule while it existed.
  - **Details scrollbar:** the panel's scrollbar paints its own white. Its
    `local` background doesn't reach the track.

  Two test changes the user ruled on. The scroller tests now target
  `.timeline-scroll`. The Help test forbids "gold line".

- **Description:** WR23. This also replaces the sibling-dependent
  two-semester outline rule.
- **Files touched:**
  - `Timeline.tsx`, `touch-drag.ts`, `Planner.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** in `spec/layout.test.ts`, `describe("timeline
  years")`:
  - "terms are grouped by year": there are 4 `.timeline-year` elements,
    each with exactly 2 `section.term[data-term]`, and the year label text
    equals the terms' year.
  - "year headers stay visible": after scrolling the timeline region
    vertically by 400px, `.timeline-year-head` is still at the region's
    top, and it's `.glass`.
  - "scroll buttons": at 1920×1080 the earlier button starts disabled.
    Clicking the later button increases `scrollLeft`. At the far end the
    later button is disabled.
  - "edge fade shows when more is off-screen": the `more-right` class is
    present initially, and `more-left` appears after scrolling.
  - "two-semester drag outlines both terms across a year boundary": drag
    COMP4550 over the last S2 term of a year. Both it and the next year's
    S1 term have the outline (`drag-hover-target` and `drag-hover-next`).
    Also rerun the existing two-semester drop-outline tests (:977 suite).
  - The card-height budget and overflow suites pass unchanged.
- **Implementation (green):**
  - `Timeline`: group into `div.timeline-year[data-year]`, with
    `div.timeline-year-head.glass` holding `span.timeline-year-label`
    (`aria-hidden`). Add the toolbar with the two buttons, plus
    `div.timeline-scroll-wrap` for the fades, with a scroll and resize
    listener.
  - Add the `drag-hover-next` class logic (this file's §4). `touch-drag.ts`'s
    `TouchDragCallbacks` gains an optional `spanOf?: (code: string) => 1 |
    2`. `Planner` supplies it from `view.courses[code]?.twoSemester ??
    knownCards[code]?.twoSemester`. When it returns 2, the hover
    highlighting also marks `[data-term="<t+1>"]` with `drag-hover-next`,
    and `clearHoverHighlight` clears it.
  - CSS: sticky `.timeline-year-head` (top 0, z-index above the cards).
    Delete the `+ .term` rule at :1223 and replace it with a
    `.term.drag-hover-next` rule.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - No CSS rule depends on terms being adjacent siblings:
    `grep -n "drag-hover-target.*+ \.term" src/styles.css` finds nothing.
- **Human review:** the timeline at 1920×1080 and 390×844 while scrolling
  sideways and vertically. A pass means the years read at a glance, the
  frosted header shows cards softly passing beneath, the fades hint at more
  content, and nothing stutters.
- **Depends on:** Task 13.

## 6. Phase Definition of Done

- [x] Tasks 13–15 complete, with tests passing
- [x] `pnpm test` passes
- [x] `pnpm check` passes (915 tests, 2026-09-29)
- [x] Task 13 and Task 15 human reviews accepted by the user
- [x] Tick Phase 05 in overview §5 and commit

Closed 2026-09-29. axe with colour contrast was clean at 1920×1080 and
390×844 in these states: the example plan, details open, the timeline
scrolled, an empty plan, the palette open, and the undo toast. The shared
`axeViolations` helper turns colour contrast off, so this sweep ran as a
one-off and isn't in `spec/`. It found one violation, fixed in the
"keyboard scroll" commit: an empty plan's timeline couldn't be scrolled
from the keyboard.

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR20, WR21, WR22 | Task 13 |
| WR24, WR25 | Task 14 |
| WR23 | Task 15 |

## 8. Risks / open questions

None.
