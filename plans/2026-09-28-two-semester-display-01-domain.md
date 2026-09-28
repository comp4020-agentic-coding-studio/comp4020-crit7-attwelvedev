# Two-semester course display — Phase 01: Domain

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28
- **Part of:** `plans/2026-09-28-two-semester-display-00-overview.md`. Read it
  first, especially §2 (TS5, TS8), §2.4 (the straddle fixture), §3
  (commands and commit rules) and §4.1.
- **Depends on phases:** none.

## 1. Summary

This phase adds two things in the pure domain layer:
- a term-range label helper, used right away by the suggestion buttons;
- per-part completion (`completedParts`), which splits progress units per
  semester.

At the end, the API's plan view reports `{completed: 12, planned: 18}` for
the straddle fixture, and the UI is unchanged apart from suggestion text.

## 2. Requirements (this phase)

### 2.1 Functional

- TS8 (all of it: suggestion text).
- TS5: `completedParts` and the progress split. The timeline needs no work
  (overview TS5).
- Task 1 creates `termSpanLabel`, which Phases 02 and 03 use.

### 2.2 Non-functional

NF4.

### 2.3 Out of scope for this phase

Every component change (Phases 02–03). `placedStatus` keeps its current
shape until Task 4.

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-28)

`src/lib/domain/terms.ts`:

```ts
export const TERMS: readonly Term[] = buildTerms(); // 8 terms, "S1 2027" … "S2 2030"
export function termLabel(index: number): string {
  const term = TERMS[index];
  if (!term) {
    throw new RangeError(`term index out of range: ${index}`);
  }
  return term.label;
}
```

`src/lib/domain/evaluate.ts`:
- It imports `import { termLabel, TERMS } from "./terms";`.
- Inside `evaluatePlan(cat, feas, plan)`:

```ts
const spanOf = (code: string): number => (cat.courses.get(code)?.twoSemester ? 2 : 1);
const lastTermOf = (placement: Placement): number => placement.term + spanOf(placement.code) - 1;
```

- In `suggestionFor(code, concurrent, depTerm)`:

```ts
const text = action === "place" ? `Place ${code} in ${termLabel(target)}` : `Move ${code} to ${termLabel(target)}`;
```

- In the `plan.placements.map`:

```ts
const span = spanOf(p.code);
const lastTerm = lastTermOf(p);
const completed = lastTerm < plan.cutoff;
```

- Each of the three returned objects (`state: "hard"`, the
  `"available" | "check"` one, and `"soft"`) lists `completed,` after
  `loser,`.
- `interface PlacementEval` has `loser: boolean;` then `completed: boolean;`.
- Another use of `termLabel(p.term)` (the "Needs N more units … before
  <term>" reason) names the *dependent's* start term, which is correct for
  a two-semester course. Leave it.

`src/lib/domain/view.ts`. It already has:

```ts
function totalUnitsOf(course: CatalogueCourse): number {
  return course.twoSemester ? course.units * 2 : course.units;
}
```

The three completed/planned accumulations to change are all the same
shape:
- `buildCheckView`:
  `const units = totalUnitsOf(course); if (placement.completed) completed += units; else planned += units;`
- the `leafTotals` loop:
  `const units = totalUnitsOf(course); … if (placement.completed) bucket.completed += units; else bucket.planned += units;`
- the totals loop:
  `const units = totalUnitsOf(course); if (placement.completed) totalCompleted += units; else totalPlanned += units;`

Tests:
- `src/lib/domain/evaluate.test.ts` has these helpers:
  - `plan(placements: {code; term}[], cutoff = 0, checks = {})`
  - `synthetic(code, { units?, offerings?, twoSemester?, prereq?, incompatible?, unverifiable? })`
  - `syntheticCatalogue(courses)` (horizonYear 2028)
  - `loadRealCatalogue()`
- Existing tests there: `"two-semester course occupies t and t+1"` (COMP4550
  at 6, cutoff 7, expects `completed` false).
- `src/lib/domain/view.test.ts` has `loadRealCatalogue()`, `emptyPlan()`,
  `findGroup(groups, id)`, and imports `AACOM_2027` and `buildPlanView`.
- `src/lib/domain/terms.test.ts` imports from `./terms`.
- `spec/planner.test.ts` has `createPlan()`, `postJson`, `putJson`.
  `PUT /api/plans/<id>/cutoff` takes `{ cutoff: number }` and returns the
  view.

Program ids: group `cap-research` (courses `["COMP4550"]`, reached with
`choices: { capstone: "cap-research" }`) and check `comp4000-min`.

### Interfaces from earlier phases (exact)

None.

## 4. Approach

- `completedParts = Math.max(0, Math.min(span, plan.cutoff - p.term))`.
- `completed` keeps its meaning (every part completed, i.e. `lastTerm <
  cutoff`). For a one-semester course `completedParts` is 0 or 1 and equals
  `completed ? 1 : 0`, so nothing else moves.
- Progress: `completedUnits = course.units * completedParts`, and
  `planned = totalUnitsOf(course) - completedUnits`.
- Edge case: a hard-blocked final-term two-semester course (term 7) with
  cutoff 8 has completedParts 1, so it reports 12 completed and 12 planned.
  That's acceptable: part 2 is impossible and the card is already flagged
  Blocked.

## 5. Task breakdown

### Task 1: Add `termSpanLabel` and use it in suggestion text

- [x] **Description:** add `termSpanLabel(index, span)` to `terms.ts`, and
  build `suggestionFor`'s text from it with `spanOf(code)`. A suggestion to
  place a two-semester course then reads as a range.
- **Files touched:** `src/lib/domain/terms.ts`, `src/lib/domain/terms.test.ts`,
  `src/lib/domain/evaluate.ts`, `src/lib/domain/evaluate.test.ts`.
- **Tests first (red):**
  - In `terms.test.ts`, `describe("termSpanLabel")`:
    - `termSpanLabel(2, 1)` is `"S1 2028"`;
    - `termSpanLabel(2, 2)` is `"S1 2028 – S2 2028"` (U+2013, spaced);
    - `termSpanLabel(7, 2)` is `"S2 2030"` (no following term);
    - `termSpanLabel(8, 1)` throws `RangeError`.
  - In `evaluate.test.ts` "synthetic catalogues", add `"suggests a
    two-semester prereq as a range"`:
    - catalogue: `synthetic("ZZAA1000", { twoSemester: true, offerings })` and
      `synthetic("ZZAA2000", { offerings, prereq: { kind: "course", code: "ZZAA1000", concurrent: false } })`,
      where `offerings` is S1 and S2 for both 2027 and 2028
      (`{ year, session: "First Semester" | "Second Semester" }`).
      `syntheticCatalogue` sets `horizonYear: 2028`, so without explicit
      2028 rows, term 3 would be not-offered and hard-blocked. A dependent
      at term 1 would also be hard-blocked, because a two-semester prereq
      at 0 only finishes at 1;
    - place ZZAA2000 alone at term 3;
    - expect a suggestion `{ code: "ZZAA1000", action: "place", term: 0, text: "Place ZZAA1000 in S1 2027 – S2 2027" }`.
- **Implementation (green):**
  - `export function termSpanLabel(index: number, span: number): string`:
    - `const first = termLabel(index);`
    - `const next = span === 2 ? TERMS[index + 1] : undefined;`
    - `return next ? \`${first} – ${next.label}\` : first;`
    - Add a one-line comment saying it's the range a placement starting at
      `index` occupies.
  - In `evaluate.ts`, import `termSpanLabel` and replace both
    `termLabel(target)` in `suggestionFor` with
    `termSpanLabel(target, spanOf(code))`.
- **Refactor:** none.
- **Acceptance criteria:**
  - All four `termSpanLabel` cases pass.
  - The synthetic suggestion test passes.
  - Existing suggestion tests are unchanged and green.
  - `pnpm check` is green.
- **Depends on:** none.

### Task 2: Per-part completion (`completedParts`) and the per-part progress split

- [ ] **Description:**
  - Add `completedParts: number` to `PlacementEval`, set on all three
    return paths.
  - Make the three accumulations in `view.ts` split units per part through
    one helper, so a course straddling the cutoff counts one semester's
    units as completed.
- **Files touched:** `src/lib/domain/evaluate.ts`, `src/lib/domain/evaluate.test.ts`,
  `src/lib/domain/view.ts`, `src/lib/domain/view.test.ts`, `spec/planner.test.ts`.
- **Tests first (red):**
  - `evaluate.test.ts` (real catalogue), `"counts each part before the cutoff as completed"`:
    - COMP4550 at term 4 with cutoff 4 → `completedParts` 0; with 5 → 1
      and `completed` false; with 6 → 2 and `completed` true;
    - a one-semester COMP1100 at 0 with cutoff 1 → `completedParts` 1.
  - `view.test.ts`, new `describe("buildPlanView (straddling two-semester course)")`:
    - plan `{ ...emptyPlan(), cutoff: 5, choices: { capstone: "cap-research" }, placements: [{ code: "COMP4550", term: 4, pinnedGroupId: null }] }`;
    - expect `view.total` to be `{ required: 192, completed: 12, planned: 12 }`;
    - expect `findGroup(view.groups, "cap-research")` completed 12 and
      planned 12;
    - expect `view.checks.find((c) => c.id === "comp4000-min")` completed
      12 and planned 12.
  - `spec/planner.test.ts`, `"a course straddling the cutoff counts its first semester as completed"`:
    - `createPlan()`, place COMP4550 at 4 and COMP4620 at 7 (both 200);
    - `PUT` cutoff 5;
    - expect the returned `total` to be
      `{ required: 192, completed: 12, planned: 18 }`.
- **Implementation (green):**
  - `PlacementEval`: after `completed: boolean;`, add a comment ("How many
    of the occupied terms fall before the cutoff — 0, 1 or 2 — so progress
    can count a straddling two-semester course's first half as done.") and
    `completedParts: number;`.
  - In the map, after `const completed = …`, add
    `const completedParts = Math.max(0, Math.min(span, plan.cutoff - p.term));`
    and add `completedParts,` after `completed,` in all three returned
    objects.
  - `view.ts`: add, below `totalUnitsOf`, a helper with a comment on why:

    ```ts
    function unitsSplit(course: CatalogueCourse, placement: PlacementEval): { completed: number; planned: number } {
      const completed = course.units * placement.completedParts;
      return { completed, planned: totalUnitsOf(course) - completed };
    }
    ```

    Replace each of the three `const units = totalUnitsOf(course); if
    (placement.completed) … else …` blocks with
    `const split = unitsSplit(course, placement);` and add
    `split.completed` / `split.planned` to the respective counters.
- **Refactor:** none beyond the helper.
- **Acceptance criteria:**
  - The new unit and spec tests pass.
  - `view.test.ts` "completed vs planned is split by cutoff" and "the total
    is 192 planned+completed" are unchanged and green.
  - `grep -n "placement.completed" src/lib/domain/view.ts` returns nothing.
  - `pnpm check` is green.
- **Depends on:** none (independent of Task 1).

## 6. Phase Definition of Done

- [ ] Tasks 1–2 complete, their tests pass, and each is committed
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] The spec straddle test shows `completed: 12, planned: 18` through the API
- [ ] Tick Phase 01 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| TS8 | Task 1 |
| TS5 | Task 2 |
| NF4 | Tasks 1, 2 |

## 8. Risks / open questions

None.
