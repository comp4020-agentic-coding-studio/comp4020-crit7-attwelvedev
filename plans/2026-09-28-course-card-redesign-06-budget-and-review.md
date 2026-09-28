# Course card redesign — Phase 06: Height budget, Help, and review

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27; E10's phone target
  ruled 2026-09-28
- **Part of:** `plans/2026-09-28-course-card-redesign-00-overview.md`. Read
  it first: E10, CR24, §2.4 and §6 (the feature DoD this phase closes).
- **Depends on phases:** 01–05, all ticked.

## 1. Summary

This phase does three things:
- It locks the redesign's main promise, shorter cards, into a `spec/`
  measurement, and tunes spacing within fixed limits if the measurement
  fails.
- It rewrites the Help page for every control this feature changed.
- It ends with the user's review of the rendered result and the Help
  copy. That review is the one thing tests can't settle.

## 2. Requirements (this phase)

### 2.1 Functional

- **E10:** Task 18.
- **CR24:** Task 19.
- Human acceptance of CR1–CR23 and E1–E9 as rendered: Task 19.

### 2.2 Non-functional

- No content may be removed to meet the budget: no clamping, hiding or
  truncating of card text. Only the levers in Task 18 may change.

### 2.3 Out of scope for this phase

- Anything not already specified in overview §2.

### 2.4 Assumptions

- See overview §2.4.
- **Measured 2026-09-28 before the redesign:** at 390×844 with the nav
  shown, the timeline pane is 279px tall and the first card starts 64px
  below its top, leaving 215px.
- **Measured before the redesign:** timeline cards at 1920×1080 were
  177–690px, with a median of about 221px.

## 3. Existing code context (verified 2026-09-28)

After Phases 01–05, a timeline card is `<li class="course-card …"
data-placed data-family>` containing:
- `div.course-card-head` (`.course-card-grip`, `strong.course-card-code`,
  `.course-card-unit-count`);
- `button.course-card-title`;
- badges (`p.badge…`, `button.badge.badge-verify`);
- `ul.course-card-suggestions` (soft only);
- `div.course-card-foot` (`button|p.course-card-allocation` and
  `div.more-options.course-card-menu`).

Relevant CSS starting values:
- `.course-card { padding: 0.7rem 0.8rem; }`;
- `body { line-height: 1.5; }`;
- `.badge { margin-block-start: 0.4rem; font-size: 0.78em; }`;
- `.course-card-foot { margin-top: 0.35rem; }`;
- `.course-card-allocation` at 0.85em;
- `.course-card-title { margin-top: 0.15rem; }`.

The timeline pane is `.planner-timeline-area`. Terms are `[data-term]`
sections holding `ul.term-cards`.

**`src/pages/help.astro`** (83 lines). The sections that describe changed
controls:
- **"The basics"** (line 14): "Drag a course from one to the other, or
  use its "Place in…" button…", and "More options" (⋯) next to
  "Completed through …".
- **"What a course card is telling you"** (lines 22–45), "Check
  requirements": 'The "Verify on P&amp;C" note on the card says what'…
  'under "Your checks" in the course's Details'.
- **"Completed semesters"** (lines 47–55): 'Beside the plan's title,
  "Completed through …" names the last semester you've finished; its ‹
  and › buttons ("One fewer semester completed" and "One more semester
  completed") move that boundary a semester at a time. The gold line on
  the timeline marks it…'.
- **"P&C and TDP"** (line 60): 'When a badge says "Verify on P&amp;C"…'.
- **"Pinning a course"** (line 73): '"Pin to" option (in its Details
  dialog)'.

**Help tests:**
- `spec/layout.test.ts:1422`, "Help describes the chevrons by name and
  the gold line": it expects "One more semester completed", "One fewer
  semester completed", "gold line" and "More options";
- 1400: no "cutoff" anywhere;
- 1841: "beside the plan's title" and not "Above the timeline".

`README.md` has no card-control text (verified 2026-09-28 by grep for
Move to/Place in/Remove/Details/chevron/Hide requirements).

### Interfaces from earlier phases (exact)

These are class names, not code signatures, which Task 18 measures:
- `.term-cards .course-card`;
- `.planner-timeline-area`;
- `[data-term="0"] .term-cards .course-card`.

The controls Help must name, as built:
- the title button (opens Details);
- "More options for <code>" (the three-dot menu, with Details, Move to
  and Remove);
- "Place in…" (unplaced sidebar/search cards);
- the six-dot grip;
- "Verify on P&C: N items" (opens Details at "Your checks");
- rows reading "Completed <term>" / "Planned <term>";
- family colours (strip, dots, bars) and "Counts toward <group>" (jumps
  to the group);
- "What's left" items (jump);
- the "Completed through …" menu (`button.completed-toggle` beside the
  title, reading e.g. "Completed through S2 2027", opening a list of
  "Nothing yet", each semester and "All semesters"; plain text on the
  read-only example). Revised from a native picker in Phase 05;
- "Completed" term labels;
- "Hide requirements": an icon-only chevron on the divider between the
  timeline and the requirements (its name and tooltip). Revised from a
  text button in Phase 05.

## 4. Approach

- **Measure first; tune only if red.**
- **The allowed levers**, each with a floor:
  1. `.course-card` block padding, down to `0.55rem`;
  2. `.course-card-title` line-height, down to `1.3`;
  3. `.course-card-allocation` font size, down to `0.8rem`;
  4. `.badge` top margin, down to `0.25rem`;
  5. `.course-card-foot` top margin, down to `0.2rem`.
- **Stop** as soon as both budgets pass.
- **If all levers are at their floors** and a budget still fails, stop and
  report the measured numbers to the user. Don't change any other rule,
  and don't truncate. This is a requirements question (back to
  `plan-feature` Phase 1), not a tuning one.

## 5. Task breakdown

### Task 18: Height budget as a spec check

- [ ] **Description:** add the E10 measurements, and tune the levers only
  if they fail.
- **Files touched:**
  - `spec/layout.test.ts`
  - `src/styles.css` (only if tuning is needed)
- **Tests first (red):** a new `describe("card height budget")`, on
  `withPlan`:
  1. At 1920×1080: collect the heights of `.term-cards .course-card`.
     Assert the count is > 10, so an empty selection can't pass, and the
     median (the middle value of the sorted list, or the mean of the two
     middle ones) is ≤ 150. The failure message prints the sorted
     heights.
  2. At 390×844, nav shown, no storage: let `area =
     .planner-timeline-area` rect and `[a, b] = [data-term="0"]
     .term-cards .course-card` rects. Assert:
     - `a.top >= area.top` and `a.bottom <= area.bottom` (first card fully
       visible);
     - `Math.min(b.bottom, area.bottom) - b.top >= b.height / 2` (at least
       half of the second).
     Both must exist (`count >= 2`).
  3. **Record** in the commit message whether this was red on the
     Phase-05 build, and the numbers before and after.
- **Implementation (green):** if red, apply this file's §4 levers in
  order, rebuilding and re-running after each. Commit the smallest set
  that passes. If green on first run, there is no CSS change.
- **Refactor:** none.
- **Acceptance criteria:**
  - Both tests pass.
  - No card text is clamped or hidden. Grep `styles.css` for
    `line-clamp` and for `text-overflow` outside `.placed-row-title`: no
    new hits.
  - `pnpm check` is green.
  - Log the measurement moment to `PROCESS_LOG.md` if it qualifies:
    the budget was ruled infeasible at "two cards" and re-set from a
    measurement.
- **Depends on:** Phases 01–05.

### Task 19: Rewrite Help for the new controls; human review of the whole redesign

- [ ] **Description:**
  - Rewrite the affected Help paragraphs.
  - Replace the chevron Help test.
  - Then hand the rendered result to the user for review.
- **Files touched:**
  - `src/pages/help.astro`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **`spec/layout.test.ts:1422`,** renamed "Help describes the new
    controls by name". `/help/` `body.innerText`:
    - contains "Completed through", "gold line", "More options", "Place
      in…", "Counts toward", "Verify on P&C", "Your checks", "Completed"
      and "Planned";
    - contains a sentence mentioning the colour of a requirement (matches
      `/colou?r/i`);
    - does **not** contain "One more semester completed", "One fewer
      semester completed", "‹" or "Move to…".
  - 1400 (no "cutoff") and 1841 ("beside the plan's title") must still
    pass.
- **Implementation (green):** edit only these sections of `help.astro`,
  keeping its voice (second person, plain, no marketing):
  - **The basics:**
    - drag a course by its grip (⋮⋮), or use "Place in…" on a
      requirements-list card;
    - a placed course's own "More options" (⋯) moves it to another
      semester or removes it;
    - click a course's title for its Details;
    - each requirement family has a colour, shown as a strip on timeline
      cards, a dot beside the group's name, and its progress bar; each
      semester's bar shows its mix;
    - "Counts toward <group>" on a card takes you to that group;
    - "What's left" items take you to what they name.
  - **What a course card is telling you, "Check requirements":** the
    card's "Verify on P&C" badge opens Details at "Your checks".
  - **Completed semesters:** "Completed through" beside the plan's title
    is a menu, like More options, that you pick the last finished
    semester from. Semesters before
    the gold line say "Completed". In the requirements list, placed
    courses show as "Completed <semester>" or "Planned <semester>".
  - **P&C and TDP:** keep "Verify on P&C" wording, and say "badge on the
    card".
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - Overview §6 manual steps done, and ticked by the executor.
- **Human review** (required; the task is not done until the user says so
  explicitly):
  1. **Rendered redesign:** screenshots, or a live look, of `/plan/example`
     and a fresh plan at 1920×1080 and 390×844, showing:
     - the card anatomy;
     - an open card menu;
     - compact rows;
     - strips, dots, progress bars and term bars;
     - a "Counts toward" highlight;
     - heading-hover receding;
     - the Completed menu, open;
     - the hide chevron on the handle.

     A pass means: the cards read as scannable; the colours feel part of
     the ANU look, not a rainbow; nothing looks disabled that works;
     nothing overlaps.
  2. **Help copy:** the rendered `/help/` page's changed paragraphs. A
     pass means: accurate to the built controls, in the page's existing
     voice, and understandable to a first-year student who has never seen
     the planner.

  If the user rejects either one, route it back through `plan-feature`,
  as the overview says. Don't patch it freelance.
- **Depends on:** Task 18.

## 6. Phase Definition of Done

- [ ] Tasks 18–19 complete, their tests passing
- [ ] `pnpm exec vitest run --project unit` passes
- [ ] `pnpm check` passes
- [ ] Task 19's two human reviews explicitly accepted by the user
- [ ] Overview §6 feature DoD fully ticked
- [ ] Tick Phase 06 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| E10 | Task 18 |
| CR24 | Task 19 |
| Human acceptance of the rendered design | Task 19 (Human review 1) |
| Help copy quality | Task 19 (Human review 2) |

## 8. Risks / open questions

None. If the budget is infeasible even at the lever floors, this file's
§4 routes it back to the user rather than leaving a gap.
