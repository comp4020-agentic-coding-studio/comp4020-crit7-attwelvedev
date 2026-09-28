# Two-semester course display — Plan overview

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28 (spec approval),
  plus planning rulings on 2026-09-28: the part 1 marker gets its own
  line (TS1), and each semester in a placed row is its own locate button
  (TS6, added after Phase 02; Task 7)
- **Source spec:** `specs/2026-09-28-two-semester-display.md`. Its
  requirement numbers 1–9 are TS1–TS9 here. This file restates them so a
  session never needs the spec.

## 0. How to use these plans

Files in this set:

- `plans/2026-09-28-two-semester-display-00-overview.md` (this file)
- `plans/2026-09-28-two-semester-display-01-domain.md`: Tasks 1–2
- `plans/2026-09-28-two-semester-display-02-labels.md`: Tasks 3–4
- `plans/2026-09-28-two-semester-display-03-timeline.md`: Tasks 5–9
- `plans/2026-09-28-two-semester-display-04-help-and-review.md`: Tasks 10–11

Each implementation session reads **this overview plus exactly one phase
file**. Task numbers are global. Tick a phase in §5 only once that phase
file's Definition of Done is met.

## 1. Summary

Some ANU courses must be taken "twice, in consecutive semesters": COMP4550
(12+12), COMP4500 (6+6), COMP3500, COMP3770, COMP8715, COMP8800. The
planner's rules already treat them as spanning two terms: term units, the
term bar, hard-blocks, and prerequisite timing all use `lastTerm`. But the
UI only ever names or shows the **start** term:
- the timeline has nothing in the second semester;
- the sidebar row says "Planned S1 2028";
- the Place in… and Move to menus list single terms.

This feature makes every placement surface show both semesters. It also
makes completed/planned status per part, so a course straddling the
completion cutoff counts its first half as completed. The data model and
placement rules don't change.

## 2. Requirements

### 2.1 Functional requirements

- **TS1: part 1 marker.** The full card stays in the start term. On
  two-semester cards only, a line under the title reads "Part 1 of 2 ·
  continues in S2 2028", or just "Part 1 of 2" when there is no following
  term.
- **TS2: part 2 stub.** The next term shows a compact stub, "COMP4550 ·
  part 2 of 2", in the same family colour.
  - It is not draggable and has no menu.
  - Activating it locates and focuses part 1, as the sidebar row's part 1
    button does.
  - Accessible name: "COMP4550 part 2 of 2, continued from S1 2028".
- **TS3: linked behaviour.** Part 1 and the stub:
  - recede together when a sidebar group is under hover or focus;
  - both flash when the course is located.
  While a two-semester course is dragged over an allowed term T, both T and
  T+1 get the gold drop outline, for mouse and touch alike.
- **TS4: menu ranges.** Every "Place in…" and "Move to" option for a
  two-semester course reads as a range, e.g. "S1 2028 – S2 2028". This
  includes search results with no `view.courses` entry.
- **TS5: per-part completion.** Each part is completed if its own term is
  before the cutoff.
  - Every progress figure attributes each part's per-semester units to
    completed or planned on its own: overall total, each group, each
    program check. A straddling COMP4550 gives 12 completed + 12 planned.
  - The course total (24) and its allocation are unchanged.
  - On the timeline each part already sits in a completed or planned
    column, so there's no card-level status to add.
- **TS6: sidebar placed row.**
  - Both parts on one side of the cutoff: "Planned S1 2028 – S2 2028" (or
    "Completed …").
  - Straddling: "Completed S1 2028 · planned S2 2028".
  - Each semester is its own locate button (ruling 2026-09-28): "S1 2028"
    goes to part 1, "S2 2028" goes to the part 2 stub, focusing the stub's
    button while both parts flash. A two-semester course with no part 2
    term (final term) has one button, to part 1.
  - Each button's accessible label names its part, e.g. "COMP4550 part 1
    is completed in S1 2028 — locate it on the timeline" and "COMP4550
    part 2 is planned for S2 2028 — locate it on the timeline". A
    one-semester row keeps "COMP1130 is planned for S1 2027 — locate it on
    the timeline".
- **TS7: prerequisite overlay.** Arrows from a two-semester course's
  prerequisites land on part 1. Arrows to courses that depend on it leave
  from the part 2 stub, falling back to part 1 when no stub is rendered.
- **TS8: messages.** User-facing text that names the term of a
  two-semester course uses the range. The only such text today is the
  suggestion buttons from `evaluate.ts` ("Place COMP4550 in S1 2028" →
  "Place COMP4550 in S1 2028 – S2 2028"). The undo toast doesn't name a
  term. Feasibility reasons already mention both semesters.
- **TS9: help.** `src/pages/help.astro` explains two-semester courses:
  part 1 / part 2, the range in menus, and per-part completion.

### 2.2 Non-functional requirements

- **NF1:** the card height budget (`spec/layout.test.ts`, "card height
  budget") stays green.
  - The stub never carries the `.course-card` class, because the budget
    measures `.term-cards .course-card`.
  - The TS1 line only appears on two-semester cards (one or two per plan),
    so it doesn't move the median.
- **NF2:** accessible names are accurate for the stub, the marker, the menu
  ranges and the sidebar status. `spec/invariants.test.ts` axe stays clean.
- **NF3:** visually verified at 1920×1080 and 390×844 (CLAUDE.md).
- **NF4:** `pnpm check` is green before every commit.

### 2.3 Out of scope

- A single card spanning both term columns.
- Moving the course by dragging or using the stub.
- An "In progress" status.
- Any change to:
  - two-semester detection (`from-pandc.ts`);
  - the DB schema or the API;
  - hard-block rules, allocation, term-unit counting, or prerequisite
    satisfaction.
- The unplaced sidebar card, which already shows "12+12u".
- Hovering the stub to highlight overlay lines. Hover highlighting stays on
  part 1's `[data-placed]`.

### 2.4 Assumptions

- **Which courses:** a two-semester course is exactly one whose
  `CatalogueCourse.twoSemester` is `true` (verified 2026-09-28).
- **Units:** `units` is the **per-semester** amount. COMP4550 has `units:
  12`, and `view.ts` `totalUnitsOf` doubles it.
- **One row per course:** a placement is one row at its start term. Part 2
  is `lastTerm = term + 1`, from `evaluate.ts` `lastTermOf`.
- **Final term:** a two-semester course placed in the final term
  (index 7) is hard-blocked and `lastTerm` is 8, past `view.terms`. It
  renders part 1 only, with no stub and no range.
- **Example plan:** cutoff 2, COMP4550 at term 6, so it spans S1 2030 –
  S2 2030 and is planned in both. It doesn't straddle the cutoff.
- **Straddle fixture, verified against the running server on 2026-09-28:**
  a fresh plan with COMP4550 at term 4 (200) and COMP4620 at term 7 (200),
  then cutoff 5, gives a straddling COMP4550 (S1 2029 – S2 2029). Today
  that reads `total {completed: 0, planned: 30}`; after TS5 it should read
  `{completed: 12, planned: 18}`.
- **Row wrapping (2026-09-28):** in the ~240px phone search pane the
  straddle row already wraps between words ("· planned" / "S2 2029"). Task
  7's second button adds padding, so the range row may wrap too. That's
  accepted as ordinary wrapping, and Task 11's review looks at it; a term
  label must never break inside itself.
- **Ruling (2026-09-28):** the TS1 marker gets its own line. Measured on
  the 180px header line: ~35px free on a read-only plan and ~15px beside
  the grip, against ~64px for "Part 1 of 2".

## 3. Shared context & conventions

- **Stack:** Astro + Preact islands, TypeScript, Drizzle/SQLite, Vitest.
  Spec tests use Playwright Chromium against the **built** server
  (`spec/global-setup.ts` boots `dist/server/entry.mjs`).
- **Commands:**
  - `pnpm test:unit` runs unit tests (`src/**/*.test.ts`).
  - `pnpm test` builds, then runs unit and spec (`spec/**/*.test.ts`).
  - `pnpm check` runs typecheck plus `pnpm test`. It must be green before
    any commit.
- **Layering:**
  - `src/lib/domain/*` is pure: no DOM, no Preact.
  - `src/components/planner-logic.ts` holds the pure UI helpers, unit-tested
    in `src/components/planner-logic.test.ts` against the real catalogue
    via `buildPlanView`.
  - Components import from both.
- **Tests:** domain tests live beside their modules. Browser behaviour goes
  in `spec/layout.test.ts` (helpers `withPlan`, `planWithPlacement`,
  `openPage`). HTTP-only checks go in `spec/planner.test.ts`.
- **Comments:** match the surrounding density. Explain *why* in full
  sentences, as the existing code does.
- **Commits:** one per task once `pnpm check` passes. The message says what
  changed and why. End it with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never hand-edit:** `dist/`, `.astro/`, or generated `api/*.json`.
- **Process log:** when a qualifying moment happens, log it in
  `PROCESS_LOG.md`, which is append-only and uses the format in its header
  comment. Cite only commits that already exist.
- **Needs the user's go-ahead:** pushing, and accepting any `Human review:`
  task.

## 4. Shared design

### 4.1 Shared signatures (created in the named task, verbatim)

```ts
// src/lib/domain/terms.ts (Task 1)
// "S1 2028 – S2 2028" (en dash, spaced) for span 2 when the next term
// exists; otherwise the single label. Throws RangeError like termLabel.
export function termSpanLabel(index: number, span: number): string;

// src/lib/domain/evaluate.ts, PlacementEval gains (Task 2):
//   How many of the placement's occupied terms fall before the cutoff:
//   0, 1, or (two-semester) 2. `completed` stays "every part completed".
completedParts: number;

// src/components/planner-logic.ts (Task 3)
export interface MenuTarget extends DropTarget {
  label: string;
}
export interface MenuTargets {
  targets: MenuTarget[];
  blockedReasons: string[];
}
export function menuTargets(
  view: PlanView,
  code: string,
  options: { currentTerm?: number; hardBlockedOverride?: Record<number, string>; twoSemester?: boolean } = {},
): MenuTargets;

// src/components/planner-logic.ts (Task 4, built in Phase 02), replaced by Task 7
export interface PlacedStatus {
  word: "Completed" | "Planned";
  termLabel: string; // the locate button's text: "S1 2028" or "S1 2028 – S2 2028"
  rest: string | null; // straddle only: "· planned S2 2028"
  spoken: string; // "planned for S1 2028" / "completed in S1 2028 and planned for S2 2028"
}

// src/components/planner-logic.ts (Task 7), replaces Task 4's PlacedStatus
export interface PlacedPart {
  termLabel: string; // this part's locate button text: "S1 2028"
  spoken: string; // its label after the code: "is planned for S1 2027" / "part 2 is planned for S2 2028"
}
export interface PlacedStatus {
  word: "Completed" | "Planned";
  parts: PlacedPart[]; // one per locate button, part 1 first; two only when part 2 has a term
  joiner: string | null; // between the two buttons: "–", or "· planned" when straddling; null with one part
}

// Task 7: the locate request can name part 2, and the row's callback passes it
// src/components/Timeline.tsx prop (and Planner.tsx state):
locateRequest: { code: string; token: number; part?: 2 } | null;
// src/components/Sidebar.tsx (both prop lists), CourseSearch.tsx, PlacedCourseRow.tsx:
onLocateCourse: (code: string, part?: 2) => void;

// src/components/planner-logic.ts (Task 5, amended 2026-09-28 so the card
// can keep the term label on one line)
export interface PartOneMarker {
  text: string; // "Part 1 of 2 · continues in" / "Part 1 of 2"
  termLabel: string | null; // part 2's term; null in the final term
}
export function partOneMarker(view: PlanView, placement: PlacementView): PartOneMarker | null;

// src/components/planner-logic.ts (Task 6)
export function partTwoPlacements(view: PlanView, term: number): PlacementView[];
```

### 4.2 DOM contract (Phase 03)

- Part 1 keeps `data-placed="CODE"`. It stays the only drag and menu
  target, and the default locate target. A locate request with `part: 2`
  scrolls to and focuses the stub's `<button>` instead, falling back to part
  1 when no stub is rendered (Task 7).
- The stub is `<li class="part-two-stub" data-part-two="CODE">` holding one
  `<button>`, and never `.course-card`.
- Located cards, including the stub, get `.course-card-highlighted`.
- `.timeline-scroll` carries `data-drag-span="2"` while a two-semester
  course is being dragged.
- Overlay `<line>`s carry `data-from` / `data-to` course codes.

## 5. Phases

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-domain.md` | 1–2 | — | `termSpanLabel`; suggestions show ranges; `completedParts` and per-part progress split, checked through the API | [x] |
| 02 | `…-02-labels.md` | 3–4 | 01 | Menus show ranges; sidebar rows show range/straddle status | [x] |
| 03 | `…-03-timeline.md` | 5–9 | 01, 02 | Part 1 marker, part 2 stub, linked locate/recede, per-part locate buttons in placed rows, drag outline, overlay out-edges from part 2 | [x] |
| 04 | `…-04-help-and-review.md` | 10–11 | 01–03 | Help text; **human review** of both viewports; feature done | [ ] |

## 6. Feature-level Definition of Done

- [ ] Every phase in §5 is ticked, and every task is complete with its tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Manually verified at 1920×1080 and 390×844:
  - the example plan shows COMP4550 with its part 1 marker in S1 2030 and a
    part 2 stub in S2 2030;
  - a plan with COMP4550 at term 4 and cutoff 5 shows "Completed S1 2029 ·
    planned S2 2029" in search's placed row, and its "S2 2029" button
    focuses the part 2 stub;
  - Move to lists ranges.
- [ ] Every requirement in §2 is covered (see §7)
- [ ] Task 11's `Human review:` explicitly accepted by the user
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| TS1 | Task 5 |
| TS2 | Task 6 |
| TS3 | Task 6 (recede, flash), Task 8 (drag outline) |
| TS4 | Task 3 |
| TS5 | Task 2 |
| TS6 | Task 4 (range/straddle text), Task 7 (per-part buttons and labels) |
| TS7 | Task 9 |
| TS8 | Task 1 |
| TS9 | Task 10 |
| NF1 | Tasks 5, 6 (budget spec re-run), Task 11 |
| NF2 | Tasks 3, 4, 6, 7 (accessible-name assertions), invariants axe run in every `pnpm check` |
| NF3 | Task 11 |
| NF4 | Every task |

## 8. Risks / open questions

None.
