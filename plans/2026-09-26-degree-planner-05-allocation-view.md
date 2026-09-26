# Degree Planner — Phase 05: Allocation & full plan view

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first:
  §4.2 types, §4.3 `PlanView`/`GroupView`/`CheckView`/`CourseCard`, §4.4 API
  contract.
- **Depends on phases:** 04.

## 1. Summary

Count each placed course toward at most one requirement group, using a
min-cost-flow allocation that fills minimums first, respects caps (`unitsMax`)
and pins, and never splits a course. Complete `buildPlanView`: two-segment
progress (completed vs planned by cutoff) for every group and the 192-unit
total; the program-wide checks; selectable-group views; course cards. Add the
cutoff, choice and pin endpoints. After this phase the backend is complete.

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements FR3 (cutoff, choices, pins persistence), FR22 (the API),
FR23, FR24 (logic and API), FR25 (logic and API), FR26 (the data), FR27, and
FR36 (the TDP check showing untracked when `tdpCourses` is null). The full text
is in overview §2.1.

### 2.2 Non-functional

Building the view for the example plan takes under 50 ms (the median of 5 runs
in a unit test).

### 2.3 Out of scope for this phase

Rendering bars, pins or choosers in the UI (Phase 06).

### 2.4 Assumptions

See overview §2.4. Strict single allocation replaces the brief's
double-counting. Courses are allocated whole.

## 3. Existing code context (verified 2026-09-26)

**AACOM tree** (`src/data/aacom-2027.ts`, from Phase 01). The top-level groups in
order (0–8) are `prog-a`, `prog-b`, `math-disc`, `compulsory`, `spec`
(selectable: `arin`, `hccc`, `syar`, `thcs`), `comp-upper`, `ict`, `capstone`
(selectable: `cap-research`, `cap-team`, `cap-intern`), and `electives`.

- Specialisation leaves:
  - `arin-a`: max 12
  - `arin-b`: min 12
  - `hccc-core`: ALL COMP3900
  - `hccc-b`: min 12
  - `hccc-c`: max 6
  - `syar-b`: min 12
  - `syar-a`: max 12
  - `thcs-b`: min 12
  - `thcs-a`: max 12; includes COMP3630, which is also compulsory
- Capstone leaves: `cap-team-proj` (COMP4500), `cap-team-4k` (COMP 4000
  filter), `cap-intern-proj` (COMP4820), `cap-intern-4k`.
- Checks: `lvl1000-max` (60), `comp4000-min` (48), `tdp-min` (12).

**Example plan** (`src/data/example-plan.ts`): cutoff 2, choices
`{ spec: "arin", capstone: "cap-research" }`, 8 terms × 24 units = 192. Its
1000-level units are 48 and its 4000-level COMP units are 60.

### Interfaces from earlier phases (exact)

- Types from overview §4.2.
- `src/lib/domain/filters.ts`:
  `matchesFilter(course: CatalogueCourse, f: CourseFilter, tdp: Set<string> | null): boolean`
  and `filterLabel(f: CourseFilter): string`.
- `src/lib/domain/feasibility.ts`:
  `createFeasibility(cat: Catalogue): { earliestTerm(code: string): number; hardBlock(code: string, term: number): string | null; hardBlockedTerms(code: string): Record<number, string> }`.
- `src/lib/domain/evaluate.ts`:
  - `export interface Suggestion { code: string; action: "place" | "move"; term: number; text: string }`
  - `export interface PlacementEval { code; term; span; lastTerm; state: "available" | "soft" | "hard"; reasons: string[]; suggestions: Suggestion[]; verify: string[]; conflictWith: string[]; loser: boolean; completed: boolean; placedPrereqs: string[]; unplacedPrereqs: string[]; requisiteStatus: … }`
  - `export function evaluatePlan(cat: Catalogue, feas: ReturnType<typeof createFeasibility>, plan: PlanState): { placements: PlacementEval[]; termUnits: number[] }`
- `src/lib/domain/terms.ts`: `offeredLabel`, `offeringStatus`, `horizonYear`.
- `src/lib/repo.ts` (all take `db: Db` first): `loadCatalogue`,
  `invalidateCatalogue`, `loadProgram(db): ProgramDef`,
  `getPlan(db, id): PlanState | null`, `createPlan(db): string`,
  `upsertPlacement(db, id, code, term)`, `deletePlacement(db, id, code)`.
- `src/lib/plan-service.ts`: `ServiceResult`, `placeCourse`, `removeCourse`,
  `getView(planId): PlanView | null`.
- `src/lib/domain/view.ts`: a partial `buildPlanView` (plan, terms, placements
  with eval fields, courses with hardBlocked/projectedTerms/offeredLabel).
- API route pattern (e.g. `src/pages/api/plans/[id]/placements.ts`): an
  `APIRoute` that parses JSON, calls a plan-service function, and returns
  `new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })`.
- Tables (schema from Task 5): `plans(cutoff)`,
  `plan_choices(plan_id, group_id, child_id)`,
  `plan_courses(…, pinned_group_id)`.

## 4. Approach

### 4.1 Allocation (`src/lib/domain/allocation.ts`)

This is min-cost max-flow via successive shortest paths with Bellman-Ford. The
graph is tiny.

- Node scale s = gcd of all item units and all group caps (6 for AACOM).
- Source → item: capacity = units/s.
- Item → each eligible active leaf: capacity = units/s, cost 0. A pinned item
  gets an arc only to its pinned leaf.
- Item → `UNALLOCATED`: cost 0.
- **Top-level group** T → sink, as two parallel arcs:
  - required: capacity `unitsRequired/s`, cost `−(1000 − order(T))`
  - surplus: capacity `(cap − unitsRequired)/s`, cost `−1`
- **Inner group** g → parent, as two parallel arcs:
  - required: capacity `unitsRequired/s`, cost `−10`
  - surplus: capacity `(cap − unitsRequired)/s`, cost `0`
- For every group, `cap = unitsMax ?? (parent cap if parent else Infinity)`. An
  ALL group has cap = its units.
- `order(T)` is the top-level group's index (0–8).
- **Why the main reward sits only at the top level:** a unit then counts once
  per degree requirement, however deeply nested its leaf is. If every level were
  rewarded, a deep path like COMP3630 → `thcs-a` → `thcs` → `spec` would outbid
  `compulsory`, and compulsory would wrongly show as missing COMP3630. The small
  inner bonus makes the solver prefer allocations that also meet inner minimums
  (e.g. `arin-b` ≥ 12).
- **Atomicity**:
  - An item with units/s = 1 is inherently whole in an integral flow.
  - Items with units/s > 1 ("big": COMP4550 24, COMP4500 12, COMP4820 12) have
    their leaf enumerated over the cartesian product of eligible leaves plus
    unallocated. For each combination, the big items' flow is fixed, the
    remaining graph is solved, and the lowest total cost wins.
  - If the product exceeds 256, big items are assigned greedily in order to the
    first eligible leaf with remaining capacity, then the rest is solved.
- Only active subtrees take part: for selectable groups, only the chosen child.

## 5. Task breakdown

### Task 12: Allocation solver (min-cost flow)

- **Description:** FR23–FR25 and this file's §4.1 algorithm, pure.
- **Files touched:** `src/lib/domain/allocation.ts` (new),
  `src/lib/domain/allocation.test.ts` (new).
- **Tests first (red):**
  - `synthetic: minimums before surplus`: two leaves A (req 6) and B (req 6), and
    one course eligible for both plus one eligible only for A. Both leaves end up
    satisfied.
  - `unitsMax caps a leaf and overflow goes elsewhere`: in AACOM, ARIN chosen,
    COMP2620, 3242, 3620 and 3670 all placed. `arin-a` gets exactly 12; the
    other two are allocated to `comp-upper` or `electives`.
  - `MATH1013 goes where it's needed`: with MATH1005 and MATH1013 placed and no
    other ICT course, MATH1005 goes to `math-disc` and MATH1013 to `ict`.
  - `pins are respected`: MATH1013 pinned to `electives` goes to `electives`,
    even though `ict` stays unmet.
  - `pinning to an ineligible group throws` `IneligiblePinError`.
  - `courses are never split`: COMP4550 (24 units, two-semester) with
    `cap-research` chosen is allocated wholly to `cap-research`.
  - `unchosen selectable group gets nothing and is unsatisfied`.
  - `a compulsory COMP3630 in THCS stays compulsory`: `compulsory` is satisfied,
    and `thcs-a` doesn't also count it.
  - `deterministic`: the same input gives the same output.
  - `performance`: allocating the example plan takes under 50 ms (median of 5
    runs).
- **Implementation (green):**
  - `export interface AllocItem { code: string; units: number; eligible: string[]; pinned: string | null }`
  - `export interface AllocGroup { id: string; parentId: string | null; order: number; unitsRequired: number; unitsMax: number | null }`
  - `export interface Allocation { byCourse: Record<string, string | null>; unitsByGroup: Record<string, number> }`
  - `export class IneligiblePinError extends Error {}`
  - `export function allocate(groups: AllocGroup[], items: AllocItem[]): Allocation`
  - `export function activeGroups(program: ProgramDef, choices: Record<string, string>): AllocGroup[]`
  - `export function eligibleLeaves(program: ProgramDef, choices: Record<string, string>, course: CatalogueCourse, tdp: Set<string> | null): string[]`
- **Refactor:** None expected.
- **Acceptance criteria:** the tests pass.
- **Depends on:** 4, 10 (`filters.ts`).

### Task 13: Full `buildPlanView`: progress, checks, total; choices/pins/cutoff API

- **Description:** Complete `PlanView` (overview §4.3) and the remaining mutations.
- **Files touched:** `src/lib/domain/view.ts`, `src/lib/domain/view.test.ts`
  (new), `src/lib/repo.ts`, `src/lib/plan-service.ts`,
  `src/pages/api/plans/[id]/cutoff.ts`, `choices.ts` and `pins.ts` (new),
  `spec/planner.test.ts`.
- **Tests first (red):**
  - `view.test.ts`:
    - `courseCard(..., "COMP3630")` has `hardBlocked[0]` set and
      `offeredLabel === "S1"`.
    - `completed vs planned split by cutoff`: in the example plan (cutoff 2),
      `compulsory` has completed 0 and planned 48; `prog-a` has completed 6.
    - `the total is 192 planned+completed for the example`.
    - `program checks`: `lvl1000-max` is ok with 48 units; `comp4000-min` is ok;
      `tdp-min` is `ok: null` when `tdpCourses` is null.
    - `example plan: no placement is hard`.
    - `empty plan: every group is 0/0 and unsatisfied`.
    - `selectable group view lists options and chosenId`.
    - `countsToward and pinned appear on placements`.
  - `spec/planner.test.ts`:
    - `PUT cutoff persists` (reload shows `data-cutoff="3"`)
    - `PUT choices persists and re-allocates`
    - `PUT pin to an ineligible group returns 409`
    - `cutoff 9 returns 400`
    - all mutations on `example` return 403
- **Implementation (green):**
  - `repo.ts`: `setCutoff(db: Db, id: string, cutoff: number): void`,
    `setChoice(db: Db, id: string, groupId: string, childId: string | null): void`,
    `setPin(db: Db, id: string, code: string, groupId: string | null): void`.
  - `plan-service.ts`:
    `setCutoff(planId: string, cutoff: number): ServiceResult`,
    `setChoice(planId: string, groupId: string, childId: string | null): ServiceResult`,
    `setPin(planId: string, code: string, groupId: string | null): ServiceResult`.
    It validates that the group is selectable and the child is one of its
    options, and that the pin target is in the course's `eligibleLeaves`.
  - `buildPlanView` composes feasibility, `evaluatePlan`, `allocate`, groups,
    checks, totals and cards.
  - Export the card builder for reuse by search (Task 16):
    `export function courseCard(cat: Catalogue, program: ProgramDef, choices: Record<string, string>, code: string): CourseCard`.
    `eligibleGroups` uses `choices`; with `{}`, it lists eligible leaves across
    all options.
- **Refactor:** Remove the Task 7 subset code paths that the full builder
  replaces.
- **Acceptance criteria:** the tests pass, and the view for the example plan
  builds in under 50 ms.
- **Depends on:** 7, 11, 12.


## 6. Phase Definition of Done

- [x] Every task in §5 is complete and its tests pass
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] The example-plan view builds in under 50 ms (unit test)
- [x] `/plan/example` has no hard-blocked placement (unit test)
- [x] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR3 (cutoff/choices/pins) | Task 13 |
| FR20 (losers excluded) | Tasks 12, 13 |
| FR22 (API) | Task 13 |
| FR23 | Task 12 |
| FR24 (logic/API) | Tasks 12, 13 |
| FR25 (logic/API) | Tasks 12, 13 |
| FR26 (data) | Task 13 |
| FR27 | Task 13 |
| FR36 (untracked check) | Task 13 |
| NFR performance | Tasks 12, 13 |

## 8. Risks / open questions

None.
