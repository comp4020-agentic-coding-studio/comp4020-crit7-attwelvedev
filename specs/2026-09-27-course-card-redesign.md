# Course card redesign: card anatomy, compact placed rows, requirement colours

- **Date:** 2026-09-27
- **Status:** Approved
- **Approved by user:** yes — 2026-09-27

## 1. Problem / intent

The planner's course cards are the thing students look at most, and the
user judged them weak in several ways:

- They're too tall. Timeline cards range from 180px to 690px at 1920×1080,
  mostly because the full "Verify on P&C" text is printed on the card and
  every card carries three buttons. On a phone the timeline pane shows about
  one card.
- Rare actions are always visible. "Move to…" and "Remove" sit on every
  timeline card, and on the read-only example plan they appear as a wall of
  disabled buttons, which is what a first-time visitor sees.
- Placed timeline cards don't show units, though the term header totals
  them ("24/24 units").
- Placed courses in the requirements list are full cards, so with 9
  requirement groups the sidebar is long. They're mostly done, so they
  should take less room than the courses still to choose.
- The design has few colours for this much structure. A student can't see
  at a glance which requirement each course on the timeline serves.

Three bugs the user also raised (buttons touching, the term button's border
vanishing on hover, placed cards dimming their working buttons) were fixed
first, before this spec, in cb2b3f2..a261afe.

The intent: cards a student can scan, with rare actions behind a menu,
units and requirement shown compactly, done courses receding into compact
rows, and colour tying each timeline course to its requirement. Extensions
agreed in the same conversation make the colour and the card↔requirement
link work in both directions, and fix a handful of nearby clarity problems.

## 2. Requirements

### 2.1 Functional requirements

**A. Card anatomy.** Applies to timeline cards, unplaced sidebar cards and
unplaced search results, unless a requirement says otherwise.

- CR1. The card's first line is the course code (bold) with its units
  right-aligned on the same line, shown as "6u". A two-semester course shows
  its per-semester amount as "12+12u", matching P&C. The units' accessible
  text is "6 units" / "12+12 units" (visually hidden full text, "6u"
  hidden from assistive technology).
- CR2. The title is on its own line(s) below, with no em dash joining it to
  the code. The title is a button that opens the course's Details dialog.
  It is visibly a title at rest and shows an underline on hover and on
  keyboard focus.
- CR3. Each draggable card has a drag handle: a six-dot grip. A drag starts
  from the grip, and also from the rest of the card body wherever the
  browser supports starting a drag there. The grip is not a separate tab
  stop (keyboard and touch-menu users move courses via the menus).
- CR4. Timeline cards show "Counts toward <group label>", preceded by the
  group's colour dot (see C), as a button (see E5). A timeline card that
  counts toward nothing shows "Not counting toward any requirement" as plain
  text, with no dot.
- CR5. Timeline cards have a "More options" three-dot button. It opens a
  disclosure panel (not an ARIA menu), in this order:
  1. Details
  2. A "Move to" list: the same reachable terms "Move to…" offers today
     (current term excluded, blocked terms omitted), or "No available
     terms — <reasons>" when there are none.
  3. Remove. It removes immediately and offers the existing Undo toast.
  The panel closes on Escape (focus back to the three-dot button), on a
  press outside it, and when another card's menu or the page's More options
  opens (one open menu at a time, as today). Each card's panel has a unique
  ID. The panel fits within 390px.
- CR6. The visible "Move to…", "Details" and "Remove" buttons leave
  timeline cards.
- CR7. Unplaced sidebar cards and unplaced search results keep a visible
  "Place in…" button and the offering line (e.g. "S1, S2"). They have no
  three-dot menu. Their title opens Details (CR2), and their visible
  "Details" button goes.
- CR8. "Needs prerequisites" suggestion buttons stay visible on the card.
- CR9. The "Verify on P&C: …" paragraph becomes one badge button reading
  "Verify on P&C: N item" / "N items". Activating it opens Details with focus
  on the "Your checks" section. Its full text stays in Details.
- CR10. Blocked cards (timeline `course-card-hard` and sidebar "all terms
  blocked") recede through muted text and the paper background, not
  opacity. They keep the dashed border and "Blocked" badge. Their controls
  render at full strength.
- CR11. On read-only plans, the three-dot menu and "Place in…" are not
  rendered at all (not rendered disabled). The title (Details), "Counts
  toward" (E5), the term buttons on compact rows, and the verify badge all
  still work, because they don't change the plan.

**B. Compact rows for placed courses**

- CR12. In each requirement group, and in search results, a course that is
  already on the timeline renders as a compact row instead of a card.
- CR13. A group's compact rows sit together in a list below its unplaced
  cards.
- CR14. A row shows the code, then the title (truncated with an ellipsis
  when it doesn't fit, full title in the button's accessible name and
  `title`), then the status. The title opens Details.
- CR15. The status reads "Completed <term>" when the course's term index is
  below the plan's cutoff, and "Planned <term>" otherwise. The term is a
  button that locates the course on the timeline, exactly as the current
  "Placed in" term button does (scroll, focus, highlight).
- CR16. When the row is too narrow for one line, it wraps to two: code and
  title, then status.
- CR17. Rows are not draggable.

**C. Colour coding by requirement family**

- CR18. Each top-level requirement group belongs to a colour family:
  | Family | Top-level groups |
  | --- | --- |
  | Foundations | Programming as Problem Solving, Structured Programming, Discrete mathematics, Compulsory courses |
  | Specialisation | Specialisation (all of its nested groups) |
  | Advanced COMP | 3000/4000-level COMP |
  | ICT | ICT-related courses |
  | Capstone | Capstone (all of its nested groups) |
  | Neutral | Electives |
- CR19. Each non-neutral family has one cool hue (5 in total). Candidates:
  indigo, steel blue, violet, plum, slate teal. The final values must pass
  the checks in 2.2.
- CR20. A timeline card has a 4px strip on its left edge in the colour of
  the family of the top-level group its `countsToward` sits under. Neutral
  and not-counting cards have no strip.
- CR21. Each top-level group heading in the sidebar shows a dot in its
  family colour. Nested headings don't get their own dot. Electives shows no
  dot.
- CR22. Sidebar cards, compact rows and search results have no strip.
- CR23. Colour is never the only signal: the "Counts toward" text stays on
  timeline cards, and group headings keep their labels.

**D. Extensions**

- E1. Per-term colour bar. Under each term's unit count, a thin bar split
  into segments: each segment's width is that term's units counting toward
  one family, in that family's colour. Neutral and not-counting units are
  grey, and unused capacity (up to the normal 24-unit load) is empty. An
  overloaded term's bar is scaled to its total. Assistive technology gets
  the same breakdown as text, e.g. "12 units Foundations, 6 units ICT, 6
  units not counting".
- E2. "Hide requirements" no longer floats over the requirements content,
  in both layouts (extended to side-by-side on 2026-09-28: the desktop
  sidebar is also a scroller, and the button floated there too). The button
  sits in a sticky bar with an opaque background spanning the requirements'
  width, so content scrolls under it rather than showing through. The bar
  takes no more height than the button's own row does today. All CW15–CW22
  behaviour is unchanged.
  *Amended in planning, 2026-09-28:* the approved first choice (inside the
  stacked resize handle's row) can't be built from inside the aside,
  because the aside is a scroll container and would clip anything pulled up
  into the handle's row. The approved fallback (this bar) applies. It costs
  nothing extra: the sticky button already occupies its row.
- E3. Each requirement group's progress bar uses its family colour instead
  of gold. Electives uses a neutral grey. Satisfied/unsatisfied stays
  conveyed by the existing text. The overall "Total" bar and the rail's
  progress bar are unchanged.
- E4. Hovering or keyboard-focusing a sidebar group heading keeps the
  timeline cards counting toward that group (including its nested groups)
  at full strength and recedes all other timeline cards. Leaving the
  heading (or blurring it) restores them. This must not steal focus or
  scroll anything. Receding uses the non-opacity treatment from CR10, or an
  equivalent that keeps controls at full strength.
- E5. Activating a timeline card's "Counts toward <group>" button:
  1. expands the requirements if they're hidden (desktop rail or stacked
     bar), using the existing expand path;
  2. expands the target group and any collapsed ancestor group;
  3. scrolls the exact group the course counts toward (the leaf, e.g.
     "Artificial Intelligence — foundations (max 12)") into view,
     vertically and, in the stacked layout, horizontally;
  4. highlights it with the existing gold highlight, clearing any earlier
     highlight when a new one starts (as 2514b69 does for courses);
  5. moves focus to that group's heading.
- E6. The completed-semesters control becomes one native picker labelled
  "Completed through", replacing CW1's readout and CW2's two chevrons. Its
  options are "Nothing yet" and every term label, and "All semesters" for a
  cutoff at the end. Choosing an option sets the cutoff. CW3's full sentence
  stays as the picker's accessible description. On read-only plans the
  picker is visible and disabled (as CW2 did for the chevrons). CW4's
  one-row layout still holds.
- E7. Each completed term's header (term index below the cutoff) says
  "Completed" beside its unit count. The gold boundary line stays.
- E8. Each "What's left" item whose ID names a requirement group jumps to
  that group exactly as E5 does. Each item whose ID names a check jumps to
  and highlights that check's row in the Total section the same way. Items
  with neither stay plain text.
- E9. The "Checks" subheading in the Total section gets spacing above it
  consistent with the section's other subheadings.
- E10. Height budget, enforced by a `spec/` measurement on the example plan:
  at 1920×1080 the median timeline card is at most 150px tall, and at
  390×844 (nav shown, default split) the first timeline card is fully
  visible in the timeline pane and at least half of the second is too.
  *Amended in planning, 2026-09-28, by the user's ruling:* the approved
  "two full cards" target needs cards of 102px or less (the pane has 215px
  below its header), which the agreed card content can't reach.

**E. Documentation**

- CR24. The Help page and README describe the new controls by their new
  names: title opens Details, the three-dot menu holds Move to and Remove,
  "Place in…" on unplaced cards, the drag handle, the verify badge, compact
  rows' Completed/Planned wording, the colour families, the "Counts toward"
  jump and the "Completed through" picker.
- CR25. Existing tests asserting the old controls or wording (e.g. "Placed
  in", visible "Move to…"/"Remove"/"Details" buttons on cards, the cutoff
  chevrons) are updated to the new design, not deleted.

### 2.2 Non-functional requirements

- Accessibility:
  - Every drag keeps a keyboard/touch equivalent (original spec lines
    177–179): "Place in…" on unplaced cards, the three-dot "Move to" list on
    timeline cards.
  - Status is never conveyed by colour or greying alone (CR23).
  - axe stays clean at both marking viewports with menus closed and open.
  - Family colours: each at least 3:1 against `--surface` (#fff) as a
    non-text graphic; distinguishable from each other and from rust
    (#ab3a2e), amber (#a15d10), moss (#3f7d5c) and gold (#be830e),
    including under deuteranopia/protanopia/tritanopia simulation. Planning
    validates them with the `dataviz` skill's palette validator or
    equivalent, and records the results.
  - Visible keyboard focus on every new control; motion (E4, E5 scroll)
    respects `prefers-reduced-motion`.
- Layout: no horizontal page overflow at any width the layout spec already
  tests; both marking viewports (1920×1080, 390×844) checked by render.
- Browsers: drag from the grip and from the card body works in Chromium;
  planning checks Firefox too (see 6).
- Persistence: no schema or API change. E6 reuses the existing cutoff API.

### 2.3 Out of scope

- Compact cards in completed terms (considered, not taken).
- A description preview on cards (rejected: P&C descriptions open with
  boilerplate, so a clipped preview shows filler).
- Any change to the requirements data, allocation or evaluation.
- The Details dialog's own layout, beyond focusing "Your checks" (CR9).
- The overall Total bar and the rail/bar progress colours.

### 2.4 Assumptions (confirmed)

- A placement's `countsToward` is a group ID that can be nested; the family
  comes from its top-level ancestor. Verified in `src/data/aacom-2027.ts`
  (e.g. `arin-a` under `spec`).
- "Completed" means term index below `plan.cutoff`. Verified in
  `completedReadout` (`src/components/planner-logic.ts:188`).
- "What's left" items carry an `id` naming a group or a check. Verified in
  `Sidebar.tsx` (the outstanding list keys by `item.id`); planning confirms
  the exact mapping.
- The prerequisite overlay lines are gold, so family hues don't collide
  with them. Verified in `styles.css` (`.prereq-overlay line`).
- Course descriptions are real P&C text starting with boilerplate. Verified
  via `/api/courses/search`.
- "6u" is readable on the timeline because term headers say "24/24 units".
  The user accepted this for the sidebar too, with the full text for
  assistive technology.

## 3. Existing context

- `src/components/CourseCard.tsx`: timeline card. Renders code/title,
  state badges, verify text, allocation line, suggestions, then (since
  cb2b3f2) a `.course-card-actions` row with `PlaceInMenu` ("Move to…"),
  Details and Remove. Remove reports a `RemovedPlacement` for Undo.
- `src/components/AvailableCourseCard.tsx`: sidebar and search card. Placed
  courses render as `.course-card-sidebar-placed` with "Placed in
  <term button>" (since 863745e), which calls `onLocateCourse`.
- `src/components/PlaceInMenu.tsx`: reachable terms via `dropTargets`,
  closes on outside press, controlled by Planner's `openMenuCode`.
- `src/components/MoreOptions.tsx`: a disclosure with the three-dot icon.
  Hard-codes `id="more-options-panel"`, so it needs a unique ID before
  reuse per card.
- `src/components/Planner.tsx`: owns `openMenuCode`, the cutoff chevrons
  (`completed-step`, `moveCutoff`), the Undo toast (8s), and locate
  highlighting.
- `src/components/Sidebar.tsx`: groups, "What's left" (`outstanding`), the
  rail and stacked bar, "Hide requirements" (`.reqs-hide`, sticky with no
  background at `styles.css:481`, the cause of the phone overlap).
- `src/components/Timeline.tsx`: term columns and headers ("24/24 units").
- `src/lib/domain/view.ts`: `GroupView` (nested `children`),
  `PlacementView.countsToward`, `CourseCard.units` / `twoSemester`,
  `plan.cutoff`.
- `src/styles.css`: tokens at `:root` (ANU palette, `--muted` added in
  a261afe), card and badge rules, `.course-card-highlighted`.
- `spec/layout.test.ts`: Playwright against the built server. The "course
  cards" block (cb2b3f2..a261afe) measures button gaps, the term button's
  hover border and ancestor opacity; extend it rather than start anew.
- `specs/2026-09-27-compact-plan-workspace.md`: CW1–CW22 define the cutoff
  control, stacked split handle and stacked collapse this spec amends (E2,
  E6).
- `specs/2026-09-26-degree-planner.md` lines 177–179: the colour-only and
  drag-equivalent accessibility rules.

## 4. Design

**Card anatomy.**

```
Timeline card                     Unplaced sidebar card
┌─────────────────────────────┐   ┌─────────────────────────────┐
▌⋮⋮ COMP1130               6u │   │⋮⋮ COMP1100               6u │
▌   Programming as Problem    │   │   Programming as Problem    │
▌   Solving (Advanced)        │   │   Solving                   │
▌   [state badges, verify     │   │   S1, S2                    │
▌    badge, suggestions]      │   │   [Place in…]               │
▌   ● Counts toward Prog… ⋯   │   └─────────────────────────────┘
└─────────────────────────────┘
▌ = family strip (CR20)   ⋮⋮ = grip (CR3)   ⋯ = More options (CR5)

Compact row (CR12–CR16)
COMP1130  Programming as Probl…   Completed [S1 2027]
```

**Colour.** One mapping from top-level group to family, and from family to
a CSS custom property (e.g. `--family-foundations`). Recommended: the
family is data, set on each top-level group in the program definition
(`src/data/aacom-2027.ts`) and carried through `GroupView`, rather than a
UI-side lookup by group ID, so a second program gets colours by editing
data. Planning decides; either way, one source of truth.

**Menus.** The per-card three-dot menu reuses `MoreOptions` (given a unique
ID) and the shared `openMenuCode`, so every menu on the page stays
mutually exclusive. Its "Move to" list reuses `PlaceInMenu`'s target logic
(`dropTargets`) rather than a copy.

**Jumps.** E5 and E8 share one "show group" routine alongside the existing
"locate course" one, reusing its highlight and clear-on-new behaviour.

**Alternatives considered and rejected**

- One colour per top-level group (8 + neutral): too many hues to keep
  distinct and clear of the state colours.
- Shades within a family: unreadable on a 4px strip.
- Placed rows in their catalogue order: mixes full cards and rows in the
  same grid.
- Details via the title only, or a visible Details button: the first is
  hard to discover, the second cancels much of the height saving. Title
  plus a menu item was chosen.
- "6 units" on the card: clearer, but the user judged "6u" sufficient given
  the term headers.
- "Placed in <term>" on rows regardless of cutoff: hides done vs planned.
- Worded "Earlier" / "Later" cutoff buttons: still ambiguous ("earlier
  what?"). The picker states its own meaning.
- E2 as an always-sticky opaque bar, or not sticky: the first costs ~2.75rem
  of phone height permanently, the second makes hiding mid-scroll awkward.
  Kept as the fallback only.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | contradiction | 9 groups vs the palette: rust/amber/moss mean state, gold means highlight | 5 cool hues by family, validated against those (CR18–CR19, 2.2) |
| 2 | gap | `countsToward` is a leaf ID; which group sets the colour? | Top-level ancestor (CR20) |
| 3 | ambiguity | Where do placed rows go in a group? | Below the unplaced cards (CR13) |
| 4 | gap | How is Details found once the button goes? | Title button plus menu item on timeline cards (CR2, CR5) |
| 5 | ambiguity | "6u" or "6 units"? | "6u", with "6 units" for assistive technology (CR1) |
| 6 | gap | Rows for completed terms say "Placed in"? | "Completed" / "Planned" by cutoff (CR15) |
| 7 | gap | Do placed search results follow? | Yes, same rows (CR12), keeping e20e2e2's rule |
| 8 | gap | Unplaced cards and the drag alternative | Keep visible "Place in…" (CR7) |
| 9 | gap | Read-only plans: disabled or hidden controls? | Hidden; non-editing links still work (CR11) |
| 10 | gap | Blocked cards dim their own Details via opacity | Recede by colour (CR10) |
| 11 | gap | Two-semester courses' units | "12+12u" (CR1) |
| 12 | gap | `MoreOptions` hard-codes its panel ID | Unique ID per instance (CR5) |
| 13 | assumption | Dragging from a button inside a draggable card | Grip as the dedicated start (CR3); proved first in planning |
| 14 | gap | "Counts toward" jump when the sidebar or group is hidden | Expand sidebar, group and ancestors first (E5) |
| 15 | ambiguity | Jump to the top-level group or the exact one? | The exact (leaf) group (E5) |
| 16 | gap | Phone sidebar scrolls sideways | Scroll into view both ways (E5) |
| 17 | contradiction | E2's divider row is a `role="separator"` | Toggle sits beside the handle, not inside it (E2) |
| 18 | gap | Handle hidden below 30rem tall (CW14) | Opaque sticky bar there (E2) |
| 19 | contradiction | E6 replaces CW1/CW2's compact chevrons | Picker keeps one row (CW4) and read-only disabled (CW2) |
| 20 | gap | "What's left" items that are checks, not groups | Jump to the check row in Total; others stay text (E8) |
| 21 | gap | Extras piling onto a 13rem card | Height budget as a spec check (E10) |
| 22 | assumption | Description preview helps newcomers | Rejected: boilerplate openings (2.3) |
| 23 | gap | Overloaded term in the E1 bar | Bar scales to the term's total (E1) |
| 24 | contradiction | (Planning) E2's handle row can't hold the button: the aside is a scroller and clips it | Approved fallback: opaque sticky bar (E2) |
| 25 | gap | (Planning) The desktop sidebar's hide button floats over content too | User extended E2 to both layouts, 2026-09-28 |
| 26 | contradiction | (Planning) E10's "two full cards" needs cards of 102px or less on a phone | User chose "first card full, half the second" (E10), 2026-09-28 |
| 27 | assumption | (Planning) Five cool hues can stay distinct under colour-blindness | Pre-checked: the chosen set keeps CIE76 ΔE ≥ 12 under deut/prot/trit simulation and ≥ 29 normally, against each other and the state colours |

## 6. Handoff notes for planning

- Prove the risks first, before building on them:
  1. Drag still starts from the grip and the card body in Chromium, and in
     Firefox (Playwright's `firefox` if installable; otherwise record it
     as an unverified browser).
  2. axe stays clean with buttons inside a draggable `<li>`.
  3. The five hues pass 2.2's checks (record the validator output).
  4. E2's toggle fits in the stacked handle row at 390×844.
- The specs run against the built `dist/`; every red/green step needs a
  fresh build. A red step must fail for the right reason: a check that
  finds nothing to measure must fail, not pass (see PROCESS_LOG.md,
  2026-09-27).
- Size: likely too big for one session. Split by the seams in section 2
  (anatomy + menus; compact rows; colour + E1/E3/E4; jumps E5/E8; header
  and control extras E2/E6/E7/E9; height budget E10 last, once the rest has
  landed).
- Settled here, not to re-open: families and their groups, "6u", rows below
  unplaced cards, Completed/Planned wording, title + menu for Details,
  picker for the cutoff, E2's placement with its fallback.
- One commit per unit of work once `pnpm check` passes (CLAUDE.md).
