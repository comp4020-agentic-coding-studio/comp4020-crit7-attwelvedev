# Course card redesign — Plan overview

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27 (spec approval),
  plus three planning rulings on 2026-09-28 (§2.4)
- **Source spec:** `specs/2026-09-27-course-card-redesign.md`. Its
  requirement IDs (CR1–CR25, E1–E10) are the ones used here. This file
  restates them so a session never needs the spec.

## 0. How to use these plans

Files in this set:

- `plans/2026-09-28-course-card-redesign-00-overview.md` (this file)
- `plans/2026-09-28-course-card-redesign-01-card-anatomy.md`: Tasks 1–4
- `plans/2026-09-28-course-card-redesign-02-placed-rows.md`: Tasks 5–6
- `plans/2026-09-28-course-card-redesign-03-family-colours.md`: Tasks 7–10
- `plans/2026-09-28-course-card-redesign-04-jumps.md`: Tasks 11–13
- `plans/2026-09-28-course-card-redesign-05-plan-chrome.md`: Tasks 14–17
- `plans/2026-09-28-course-card-redesign-06-budget-and-review.md`: Tasks 18–19

Each implementation session reads **this overview plus exactly one phase
file**. Task numbers are global across the files. Tick a phase in §5 only
once that phase file's Definition of Done is met.

Builds on commits `cb2b3f2..a261afe` (buttons in `.course-card-actions`,
"Placed in <term>" on placed sidebar cards, placed cards receding by
colour, the `--muted` token). Phase files copy every signature they use.

## 1. Summary

The degree planner's course cards are too tall (180–690px on the timeline
at 1920×1080), show rare actions on every card (a wall of disabled buttons
on the read-only example), and don't connect a course to the requirement
it serves. This feature rebuilds the card:
- **Anatomy:** code and units on one line, the title opening Details, a
  drag grip, and rare actions in a three-dot menu.
- **Placed courses:** compact rows in the sidebar.
- **Colour:** each requirement family gets a colour, shown as a strip on
  timeline cards, dots on headings and a per-term bar.
- **Links:** two-way jumps between cards and requirements.
- **Plan chrome:** a clearer "Completed through" picker, "Completed" labels
  on past terms, a sidebar hide button that no longer floats over
  content, and a spec-enforced height budget.

## 2. Requirements

### 2.1 Functional requirements

**A. Card anatomy** (timeline cards, unplaced sidebar cards, unplaced
search results, unless stated)

- **CR1:** the first line is the code (bold) with units right-aligned:
  "6u", or "12+12u" for a two-semester course. Its accessible text is
  "6 units" / "12+12 units".
- **CR2:** the title is on its own line(s) with no em dash. It is a button
  that opens Details, with an underline on hover and keyboard focus.
- **CR3:** each draggable card has a six-dot grip where a drag starts. The
  rest of the card body also starts a drag wherever the browser supports
  it. The grip is not a tab stop.
- **CR4:** timeline cards show "Counts toward <group>" with the group's
  colour dot, as a button (E5). With no group, "Not counting toward any
  requirement" is plain text with no dot.
- **CR5:** timeline cards have a three-dot "More options" disclosure (not
  an ARIA menu) containing, in order:
  1. Details
  2. a "Move to" list (the reachable terms, excluding the current one and
     omitting blocked ones, or "No available terms — <reasons>")
  3. Remove (immediate, with the existing Undo)

  It closes on Escape (focus returns to the toggle), on an outside press,
  and when any other menu opens. Each panel has a unique ID and fits in
  390px.
- **CR6:** the visible "Move to…", "Details" and "Remove" buttons leave
  timeline cards.
- **CR7:** unplaced sidebar and search cards keep a visible "Place in…" and
  the offering line, have no three-dot menu, and lose their "Details"
  button (the title opens Details).
- **CR8:** "Needs prerequisites" suggestion buttons stay visible.
- **CR9:** the verify paragraph becomes one badge button, "Verify on P&C: N
  item(s)". It opens Details with focus on "Your checks".
- **CR10:** blocked cards recede with muted text and the paper background,
  not opacity. They keep the dashed border and "Blocked" badge, and their
  controls render at full strength.
- **CR11:** read-only plans render no three-dot menu and no "Place in…"
  (not even disabled ones). The title, "Counts toward", row term buttons
  and the verify badge still work.

**B. Compact rows for placed courses**

- **CR12:** in requirement groups and search results, a course that is on
  the timeline renders as a compact row, not a card.
- **CR13:** a group's rows sit in one list below its unplaced cards.
- **CR14:** a row shows the code, then the title (ellipsis when it doesn't
  fit; full title in its accessible name and `title`; opens Details), then
  the status.
- **CR15:** the status is "Completed <term>" when the placement is
  completed, otherwise "Planned <term>". The term is a button that locates
  the course on the timeline (scroll, focus, highlight), as "Placed in"
  does today.
- **CR16:** a row wraps to two lines (code + title, then status) when
  narrow.
- **CR17:** rows are not draggable.

**C. Colour by requirement family**

- **CR18:** the families are:

  | Family | Top-level groups |
  | --- | --- |
  | foundations | `prog-a`, `prog-b`, `math-disc`, `compulsory` |
  | specialisation | `spec` (and all nested) |
  | advanced | `comp-upper` |
  | ict | `ict` |
  | capstone | `capstone` (and all nested) |
  | neutral | `electives` |
- **CR19:** each non-neutral family has one hue (§4.2), passing §2.2's
  colour checks.
- **CR20:** timeline cards get a 4px left strip in the family colour of
  the top-level group their `countsToward` sits under. Neutral and
  not-counting cards get none.
- **CR21:** top-level sidebar group headings get a family dot. Nested
  headings and Electives get none.
- **CR22:** sidebar cards, compact rows and search results have no strip.
- **CR23:** colour is never the only signal: "Counts toward" text and
  heading labels stay.

**D. Extensions**

- **E1:** a per-term colour bar under each term's unit count. Each
  segment's width is the term's units per family; neutral and not-counting
  segments are grey; unused capacity up to 24 is empty; an overloaded term
  scales to its total. The same breakdown is available as text (e.g. "12
  units Foundations, 6 units ICT, 6 units not counting").
- **E2:** "Hide requirements" sits in a sticky bar with an opaque
  background spanning the requirements' width, in both layouts, so content
  scrolls under it instead of showing through. It takes no more height
  than today, and CW15–CW22 behaviour is unchanged.
- **E3:** each requirement group's progress bar (nested ones inherit) uses
  its family colour instead of gold; Electives uses grey. The Total bar,
  the check bars and the rail/bar are unchanged.
- **E4:** hovering or keyboard-focusing a sidebar group heading keeps that
  group's (and its nested groups') timeline cards at full strength and
  recedes the others (CR10's treatment). Leaving restores them. It never
  steals focus or scrolls.
- **E5:** activating "Counts toward <group>":
  1. expands the requirements if hidden (rail or stacked bar);
  2. expands the target group's top-level section;
  3. scrolls the exact (leaf) group into view, vertically and
     horizontally;
  4. highlights it in gold, clearing any earlier highlight;
  5. moves focus to its heading.
- **E6:** the completed-semesters control becomes one native picker,
  "Completed through [▾]", replacing the readout and the two chevrons (it
  supersedes CW1/CW2). The options are "Nothing yet" (0), terms 1–7 by
  label, and "All semesters" (8). CW3's full sentence becomes its
  accessible description. It is visible but disabled on read-only plans,
  and still fits on the title row (CW4).
- **E7:** completed terms' headers say "Completed" beside the unit count.
  The gold line stays.
- **E8:** "What's left" items jump to their group (`group-*`, `choice-*`)
  or check row (`check-*`) as E5 does. Others stay text.
- **E9:** the "Checks" subheading in Total gets spacing above it.
- **E10:** a `spec/` height budget:
  - at 1920×1080 on `/plan/example`, the median timeline card is at most
    150px tall;
  - at 390×844 (nav shown, default split), the first timeline card is
    fully inside the timeline pane and at least half of the second is too.

**E. Documentation and tests**

- **CR24:** the Help page describes the new controls by their names.
  `README.md` has no card-control text (verified 2026-09-28) and needs no
  change.
- **CR25:** existing tests asserting old controls or wording are updated
  to the new design, never deleted without a replacement.

### 2.2 Non-functional requirements

- **Accessibility:**
  - every drag keeps a keyboard/touch equivalent ("Place in…", the "Move
    to" list);
  - status is never conveyed by colour or greying alone;
  - axe stays clean at 1920×1080 and 390×844 with menus closed and open;
  - every new control has visible focus;
  - scrolling in E4/E5/E8 uses `behavior: "auto"` under
    `prefers-reduced-motion: reduce`.
- **Colour** (enforced by Task 7's unit test on `src/styles.css`):
  - each family hue is at least 3:1 against `#ffffff`;
  - every pair among the families, and each family against rust `#ab3a2e`,
    amber `#a15d10`, moss `#3f7d5c`, gold `#be830e` and neutral `#8d9299`,
    has CIE76 ΔE ≥ 20 in normal vision and ≥ 10 under Machado 2009
    deuteranopia, protanopia and tritanopia simulation.
- **Layout:** no horizontal page overflow at any width the layout spec
  tests, and both marking viewports are checked by render.
- **Browsers:** Chromium, via the existing Playwright spec. Firefox isn't
  installed, which is acceptable because the CR3 grip is a plain element
  inside the draggable `<li>`, so a drag starting there is ordinary native
  drag.
- **Persistence:** no change to the plan schema or the API. Reference
  tables that seed rebuilds on every boot are exempt: Task 7 adds a
  nullable `requirement_groups.family` column (ruling 4, §2.4).

### 2.3 Out of scope

- Compact cards in completed terms, and a description preview.
- Any change to requirements data, allocation or evaluation.
- The Details dialog's layout, beyond CR9's focus target.
- The Total bar, the check bars and the rail/bar colours.
- Moving "Hide requirements" into the stacked handle's row (rejected in
  planning, §2.4).

### 2.4 Assumptions

- **Completed vs planned:** `PlacementEval.completed` (`lastTerm <
  plan.cutoff`, `src/lib/domain/evaluate.ts:247`) decides it. It's the
  same flag the progress numbers use.
- **Outstanding item IDs:** these are `choice-<groupId>`, `group-<groupId>`
  and `check-<checkId>` (`outstandingItems`, `planner-logic.ts:116–167`).
- **Blocked cards:** a hard-blocked placement is refused by the server
  (409, `plan-service.ts:52–54`), and a fresh plan renders no blocked
  sidebar card. So CR10's browser test adds `course-card-hard` to a
  rendered card and measures the CSS.
- **Planning rulings, 2026-09-28:**
  1. **E2 row placement:** the stacked handle's row can't hold the button
     from inside the scrolling aside, so the spec's approved fallback (the
     opaque bar) applies.
  2. **E2 on desktop:** the user extended E2 to desktop, where the aside
     also scrolls and the button floated.
  3. **E10 phone target:** the user replaced "two full cards" with "first
     card full, half the second", because the pane has 215px below its
     header.
  4. **Family persistence (2026-09-28, during Phase 03):** the app reads
     the program from SQLite (`seed.ts` → `requirement_groups` →
     `repo.ts` `loadProgram`), not from `AACOM_2027`, so `family` needs
     a nullable column there. The user chose that over a hard-coded
     id → family lookup in `loadProgram`.
- **E6's last option:** "All semesters" replaces the last term's label,
  since "Completed through S2 2030" and "all" are the same cutoff.
- **Hues:** the hues in §4.2 were pre-checked on 2026-09-28 with the same
  formulas Task 7 encodes: minimum ΔE 29.2 in normal vision, 12.3 deut,
  17.2 prot, 14.2 trit.

## 3. Shared context & conventions

- **Stack:** Astro 7 SSR (`@astrojs/node`) with Preact islands
  (`src/components/*.tsx`), SQLite via drizzle, pnpm, and Vitest 4 with
  two projects:
  - `unit`: `src/**/*.test.ts`
  - `spec`: `spec/**/*.test.ts`, Playwright Chromium against the **built**
    server (`spec/global-setup.ts` boots `dist/server/entry.mjs` with a
    throwaway DB).
- **Commands:**
  - One unit file: `pnpm exec vitest run --project unit <file>`
  - Spec tests: `pnpm build && pnpm exec vitest run spec/layout.test.ts -t
    "<name>"`. The specs test `dist/`, so **rebuild before every red and
    green run**, or the run tests stale output.
  - Full gate: `pnpm check` (typecheck + build + all tests).
- **Red must fail for the right reason:** a check that finds nothing to
  measure must fail, not pass (assert a count above 0 first). See
  PROCESS_LOG.md, 2026-09-27.
- **Spec helpers** (`spec/layout.test.ts`):
  - `withPlan(viewport, check)` opens `/plan/example`;
  - `planWithPlacement(code)` creates an editable plan with `code` in term
    0 and returns its ID;
  - `openPage`, `axeViolations`, `horizontalOverflow` and
    `verticalOverflow` come from `spec/browser.ts`.
- **Example plan:** read-only, cutoff 2 (S1 and S2 2027 completed), 8 terms
  (`view.terms.length === 8`), 9 top-level groups.
- **Conventions:**
  - Comments explain why, in the surrounding style.
  - CSS tokens live on `:root` in `src/styles.css`.
  - Planner owns cross-component state (`openMenuCode`, `locateRequest`),
    passed down as props with a `token: Date.now()` for repeatable
    requests.
  - Pure helpers go in `src/components/planner-logic.ts` with tests in
    `planner-logic.test.ts`.
- **Line numbers** cited in phase files (`spec/layout.test.ts:1422`, …)
  are as of 2026-09-28. Earlier phases add tests, so find a cited test by
  its `describe`/`it` name if the number has drifted.
- **Never** hand-edit `dist/` or `.astro/`.
- **Commits:** one per task (or per unit of work inside a task) once
  `pnpm check` passes, with a message that says what changed and why,
  ending with the Co-Authored-By line from the session's attribution
  reminder. Log qualifying moments to `PROCESS_LOG.md` (append-only).
- **Visual checks:** check both marking viewports (1920×1080, 390×844) by
  screenshot after each UI task. The render is the truth.

## 4. Shared design

### 4.1 Where things live

| Concern | Home | Introduced |
| --- | --- | --- |
| Units text | `unitsLabel` in `planner-logic.ts` | Task 1 |
| Shared card first line + title + grip | `src/components/CourseCardHeader.tsx` | Task 1 |
| Reachable-term logic shared by menus | `menuTargets` in `planner-logic.ts` | Task 2 |
| Timeline card menu | `CourseCard.tsx` using `MoreOptions` | Task 2 |
| Verify badge text | `verifyBadgeText` in `planner-logic.ts` | Task 3 |
| Completed/Planned wording | `placedStatus` in `planner-logic.ts` | Task 5 |
| Compact row | `src/components/PlacedCourseRow.tsx` | Task 5 |
| Family type and data | `types.ts`, `aacom-2027.ts`, `view.ts` | Task 7 |
| Family lookups | `familyOf`, `FAMILY_LABELS`, `termFamilyUnits` in `planner-logic.ts` | Tasks 7, 10 |
| Group tree lookups | `groupPath`, `groupLeafIds`, `outstandingTarget` in `planner-logic.ts` | Tasks 11–13 |
| Show-in-sidebar requests | `ShowRequest` in `Sidebar.tsx`, state in `Planner.tsx` | Task 11 |
| Cutoff picker options | `cutoffOptions` in `planner-logic.ts` | Task 14 |

### 4.2 Family palette (tokens, Task 7)

```css
--family-foundations: #1f2f86;   /* indigo */
--family-specialisation: #8c5fc9; /* violet */
--family-advanced: #3a8fc2;      /* steel blue */
--family-ict: #b0407d;           /* plum */
--family-capstone: #3d4650;      /* slate */
--family-neutral: #8d9299;       /* grey: Electives, not counting */
```

Any element with `data-family="<f>"` gets `--family: var(--family-<f>)`.
Tints (for planned segments) are
`color-mix(in srgb, var(--family) 25%, #fff)`.

### 4.3 Shared types (exact, as introduced)

```ts
// src/lib/domain/types.ts (Task 7)
export type Family = "foundations" | "specialisation" | "advanced" | "ict" | "capstone" | "neutral";
// GroupDef gains:  family?: Family;   (set on top-level groups only)

// src/lib/domain/view.ts (Task 7). GroupView gains:
//   family: Family;   (top-level: its own; nested: inherited; default "neutral")

// src/components/Sidebar.tsx (Task 11)
export interface ShowRequest { kind: "group" | "check"; id: string; token: number }
```

## 5. Phases

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-card-anatomy.md` | 1–4 | — | New card header, grip and title → Details; timeline three-dot menu; verify badge; blocked cards recede; read-only shows no edit controls | [x] |
| 02 | `…-02-placed-rows.md` | 5–6 | 01 | Placed courses are compact Completed/Planned rows in groups and search | [x] |
| 03 | `…-03-family-colours.md` | 7–10 | 01, 02 | Palette + checks test; strips, dots, family progress bars, per-term bar | [x] |
| 04 | `…-04-jumps.md` | 11–13 | 01, 02, 03 | "Counts toward" and "What's left" jump to requirements; heading hover recedes other cards | [x] |
| 05 | `…-05-plan-chrome.md` | 14–17 | — | Completed-through picker, "Completed" term labels, opaque hide bar, Checks spacing | [ ] |
| 06 | `…-06-budget-and-review.md` | 18–19 | 01–05 | Height budget spec; Help rewrite; **human review** of the render and the Help copy | [ ] |

Phase 05 depends on no other phase and can run any time. Phase 06 is last.

## 6. Feature-level Definition of Done

- [ ] Every phase in §5 is ticked, and every task is complete with tests passing
- [ ] `pnpm exec vitest run --project unit` passes
- [ ] `pnpm check` passes
- [ ] Manually verified at 1920×1080 and 390×844 on `/plan/example` and a
      fresh plan:
  - [ ] drag a sidebar card to a term by its grip;
  - [ ] move and remove a course via its three-dot menu, then Undo;
  - [ ] click a timeline card's "Counts toward" and see its group
        highlighted, with the sidebar hidden beforehand;
  - [ ] click a "What's left" item;
  - [ ] hover a group heading and see the other cards recede;
  - [ ] change "Completed through" and see rows switch between
        Completed and Planned.
- [ ] Every requirement in §2 is covered (see §7)
- [ ] Every `Human review:` task explicitly accepted by the user (Task 19)
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| CR1 | Task 1 |
| CR2 | Task 1 |
| CR3 | Task 1 |
| CR4 | Task 2 (text, footer position), Task 8 (dot), Task 11 (button) |
| CR5 | Task 2 |
| CR6 | Task 2 |
| CR7 | Task 1 (Details via title), Task 2 (no menu, Place in… kept) |
| CR8 | Task 2 (kept, asserted) |
| CR9 | Task 3 |
| CR10 | Task 4 |
| CR11 | Task 2 (edit controls hidden), Tasks 11–12 (links still work read-only) |
| CR12 | Task 5 (groups), Task 6 (search) |
| CR13 | Task 5 |
| CR14 | Task 5 |
| CR15 | Task 5 |
| CR16 | Task 5 |
| CR17 | Task 5 |
| CR18 | Task 7 |
| CR19 | Task 7 |
| CR20 | Task 8 |
| CR21 | Task 8 |
| CR22 | Task 8 |
| CR23 | Task 8 |
| CR24 | Task 19 |
| CR25 | Every task (each lists the tests it supersedes) |
| E1 | Task 10 |
| E2 | Task 16 |
| E3 | Task 9 |
| E4 | Task 13 |
| E5 | Task 11 |
| E6 | Task 14 |
| E7 | Task 15 |
| E8 | Task 12 |
| E9 | Task 17 |
| E10 | Task 18 |
| NFR accessibility (axe, focus) | Tasks 1, 2, 5, 8, 10, 11, 12, 14 |
| NFR reduced motion | Task 11 (shared show routine, also used by Task 12) |
| NFR colour | Task 7 |
| NFR layout | Task 18, plus each UI task's overflow assertion |
| Human acceptance (visual, Help copy) | Task 19 |

## 8. Risks / open questions

None. The risks the spec named are settled:
- drag from a button is covered by the grip (Task 1);
- axe with buttons inside a draggable `<li>` is asserted in Tasks 1–2;
- the hues pass (§2.4);
- E2's placement and E10's target were ruled on 2026-09-28.
