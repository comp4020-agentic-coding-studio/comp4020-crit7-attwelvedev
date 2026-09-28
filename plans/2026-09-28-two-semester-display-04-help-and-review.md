# Two-semester course display — Phase 04: Help and review

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28
- **Part of:** `plans/2026-09-28-two-semester-display-00-overview.md`. Read it
  first, especially §2 (TS9, NF3), §3 and §6.
- **Depends on phases:** 01, 02, 03.

## 1. Summary

This phase:
- adds a Help section explaining two-semester courses;
- runs the two-viewport review with the user;
- closes out the feature.

## 2. Requirements (this phase)

### 2.1 Functional

TS9.

### 2.2 Non-functional

NF3, plus a final re-run of NF1, NF2 and NF4.

### 2.3 Out of scope for this phase

Any behaviour change. If the review surfaces one, send it back through
`plan-feature` as SKILL.md says, rather than patching it here.

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-28)

`src/pages/help.astro`:
- The sections are `<h2>` + `<p>`/`<dl>`, in this order: "The basics",
  "What a course card is telling you", "Completed semesters", "P&amp;C and
  TDP", "Pinning a course", "Keeping your plan".
- The "Completed semesters" paragraph ends with: "In the requirements list,
  a course you've placed shows as "Completed S1 2027" or "Planned S2 2028"
  to match — click the semester to find the course on the timeline. It's a
  simplification: it doesn't handle a failed or repeated course, part-time
  study, or leave of absence."
- House style: plain second person, curly quotes are avoided (the page uses
  straight `"`), `&amp;` is escaped, and ⋯ / ⋮⋮ name the controls.

`spec/layout.test.ts` loads `/help/` in several layout checks, including
the phone-width overflow and h1 sizing checks. `spec/invariants.test.ts`
runs axe on every route in `spec/routes.ts`.

### Interfaces from earlier phases (exact)

User-visible strings this help text must match exactly:
- **Timeline marker (Task 5):** `Part 1 of 2 · continues in <term>`.
- **Stub (Task 6):** `<CODE> · part 2 of 2`.
- **Menu option (Task 3):** `S1 2028 – S2 2028`.
- **Sidebar row (Task 4):** `Planned S1 2028 – S2 2028`, or when
  straddling, `Completed S1 2028 · planned S2 2028`.
- **Progress (Task 2):** each half's units count as completed once its own
  semester is before the "Completed through" boundary.

## 4. Approach

Insert one new `<h2>Courses that run over two semesters</h2>` section
straight after "Completed semesters", because it builds on that section's
boundary idea. Its paragraph covers:
- which courses these are, with COMP4550 as the example;
- part 1 carries the card and the controls, and part 2 is a marker that
  takes you back to part 1;
- the menus show the pair of semesters;
- each half counts as completed on its own, so the progress bars and the
  row can show half done.

## 5. Task breakdown

### Task 9: Help section on two-semester courses

- [ ] **Description:** add the section described in this file's §4.
- **Files touched:** `src/pages/help.astro`.
- **Tests first (red):** add `"explains courses that run over two
  semesters"` to `spec/layout.test.ts` next to the other `/help/` checks.
  It fetches `/help/` and asserts:
  - there is an `h2` whose text is exactly "Courses that run over two
    semesters";
  - the following paragraph contains "Part 1 of 2", "part 2 of 2",
    "S1 2028 – S2 2028" and "Completed S1 2028 · planned S2 2028".
- **Implementation (green):** write the section in the page's voice. A
  starting draft, which the human review may reword:

  > Some courses, such as COMP4550 (12+12 units), must be taken twice, in
  > two semesters in a row. The planner places them once and they take up
  > both semesters. The card sits in the first semester, marked "Part 1 of
  > 2 · continues in …", and the next semester shows a small "part 2 of 2"
  > marker. Click it to jump back to the card, which is the one to move or
  > remove. In "Place in…" and "Move to", these courses list the pair of
  > semesters they'd take, such as "S1 2028 – S2 2028". Each half counts
  > as completed on its own. If the "Completed through" boundary falls
  > between them, the requirements list shows "Completed S1 2028 · planned
  > S2 2028", and the progress bars count half the units as done.

- **Refactor:** none.
- **Acceptance criteria:**
  - The spec passes.
  - The existing `/help/` layout and axe checks pass.
  - `pnpm check` is green.
- **Human review:** the rendered `/help/` section at 1920×1080. It passes
  if the user says it reads in the page's voice and is accurate to what
  they see on the timeline.
- **Depends on:** Tasks 3, 4, 5, 6 (the strings it quotes).

### Task 10: Two-viewport review and close-out

- [ ] **Description:** run the app, walk the feature at both marking
  viewports with the user, then mark the feature done.
- **Files touched:**
  - `plans/2026-09-28-two-semester-display-00-overview.md` (§5 ticks,
    §6 boxes);
  - `specs/2026-09-28-two-semester-display.md` (`Status: Implemented`);
  - `PROCESS_LOG.md`, only if a qualifying moment happened (overview §3).
- **Tests first (red):** none. This task has no behaviour of its own, and
  `pnpm check` from Tasks 1–9 is the automated gate.
- **Implementation (green):** `pnpm build && pnpm preview` (or
  `pnpm dev`). At **1920×1080** and **390×844**, check each of these:
  1. `/plan/example`: COMP4550 in S1 2030 shows the "Part 1 of 2 ·
     continues in S2 2030" line, and S2 2030 shows the stub with the same
     colour strip as part 1. The stub fits the column without overflow.
  2. Clicking the stub scrolls to and focuses part 1, and both flash.
  3. Hovering the `compulsory` group heading recedes both parts.
  4. With "Show prerequisite links" on, in a plan with COMP4550 at term 4
     and COMP4620 at term 7, the arrow to COMP4620 leaves the stub.
  5. In that plan, set "Completed through" to S1 2029 (cutoff 5). Search
     COMP4550: its row reads "Completed S1 2029 · planned S2 2029", and
     the Total reads 12 completed, 18 planned.
  6. In that plan, COMP4550's Move to lists ranges only. Dragging it
     outlines two columns (mouse at desktop, touch emulation at phone).
- **Refactor:** none.
- **Acceptance criteria:**
  - All six checks were observed at both viewports.
  - `pnpm check` is green.
  - Overview §5 has every phase ticked and §6 has every box ticked.
- **Human review:** the rendered timeline and sidebar for checks 1–6 at
  both viewports. It passes when the user explicitly says the two-semester
  display is right, not on silence.
- **Depends on:** Task 9.

## 6. Phase Definition of Done

- [ ] Tasks 9–10 complete, and Task 9 is committed
- [ ] `pnpm check` passes
- [ ] The user has explicitly accepted Task 9's and Task 10's human reviews
- [ ] Tick Phase 04 in overview §5, complete overview §6, and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| TS9 | Task 9 |
| NF3 | Task 10 |
| NF1, NF2, NF4 (final re-run) | Task 10 |

## 8. Risks / open questions

None.
