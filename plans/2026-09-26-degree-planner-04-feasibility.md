# Degree Planner — Phase 04: Feasibility (hard/soft blocking)

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first:
  §4.2 types, §4.3 `PlanView`, §4.4 API contract.
- **Depends on phases:** 03.

## 1. Summary

Decide, for every placed course, whether it's **hard-blocked** (impossible: not
offered, requisites unreachable by any plan over earlier terms, evaluated
recursively, or a two-semester course with no following term), **soft-blocked**
(possible, but the current plan doesn't meet its requisite), or **available**.
Blocks come with specific reasons, and soft blocks with suggestions. Flag
incompatible pairs and term overload. The placement API refuses hard-blocked
drops with 409.

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements FR15, FR16 (the logic), FR17 (the server-side refusal and
`hardBlocked` in the view), FR19 (occupancy and requisite timing), FR20, FR21
(the logic), and FR34 (never hard-blocked on offering). The full text is in
overview §2.1.

### 2.2 Non-functional

Pure modules. `earliestTerm` is memoised per catalogue instance.

### 2.3 Out of scope for this phase

Allocation and progress (Phase 05). The UI (Phase 06).

### 2.4 Assumptions

See overview §2.4. In particular, codes not in the catalogue count as reachable
for hard blocks and unmet for soft blocks.

## 3. Existing code context (verified 2026-09-26)

**Real data facts** the tests rely on, from the 2027 scrape:

| Course | Offered | Requisite |
| --- | --- | --- |
| COMP1100 | S1/S2 | none |
| COMP1130 | S1 | none |
| COMP1730 | S1/S2 (in catalogue) | none |
| COMP1110 | S1/S2 | 1100 \| 1130 \| 1730 |
| COMP1140 | S2 | 1130 |
| COMP2300 | S1 | (1100\|1130\|1730) AND 6u 1000-level MATH |
| COMP2310 | S2 | (1110\|1140) AND (2300 \| ENGN2219) — ENGN2219 isn't in the catalogue |
| COMP3300 | S2 | 2310 |
| COMP3630 | S1 | 24u COMP AND (6u MATH \| 1600) |
| COMP3600 | S2 | same requisite as COMP3630 |
| COMP2100 | S1/S2 | (1110\|1140) AND 6u 1000-level MATH, plus a BSc/ASCAD other-program sentence |
| COMP2120 | S2 | concurrent 2100 |
| COMP4550 | S1/S2 | 12 units per part, two-semester |
| COMP4600 | no offerings | |

### Interfaces from earlier phases (exact)

- Types from overview §4.2.
- `src/lib/domain/terms.ts`: `TERMS`, `termLabel(index)`,
  `horizonYear(courses: Iterable<CatalogueCourse>): number`,
  `offeringStatus(course: CatalogueCourse, term: Term, horizon: number): OfferingStatus`,
  `offeredLabel(course: CatalogueCourse): string`.
- `src/lib/domain/requisites.ts`:
  `parseRequisites(input: { prerequisites: string; incompatibilities: string }): ParsedRequisites`.
- `src/lib/catalogue/from-pandc.ts`: `fromPandc(json, tdpCourses, parse?)`. Unit
  tests build a `Catalogue` from `data/2027/courses/*.json`, filtered by
  `isUndergrad`, using `fromPandc(json, null, parseRequisites)`, with
  `horizonYear` from `horizonYear()`.
- `src/lib/repo.ts`: `export type Db = BetterSQLite3Database`,
  `loadCatalogue(db: Db): Catalogue` (WeakMap-memoised),
  `invalidateCatalogue(db: Db): void`.
- `src/lib/plan-service.ts`:
  `export type ServiceResult = { status: 200; view: PlanView } | { status: 400 | 403 | 404 | 409; error: string }`
  and `export function placeCourse(planId: string, code: string, term: number): ServiceResult`.
- `src/lib/domain/view.ts`:
  `export function buildPlanView(cat: Catalogue, program: ProgramDef, plan: PlanState): PlanView`.
  It currently fills `plan`, `terms`, `placements` (code, term, span, completed)
  and `courses` (title, units, url, description). Task 10 adds `hardBlocked`,
  `projectedTerms`, `offeredLabel` and `offeringUnknown` to the cards.
- `spec/planner.test.ts` exists (HTTP tests). It creates a plan via
  `POST /api/plans` and places via `POST /api/plans/<id>/placements`.

## 4. Approach

### 4.1 Feasibility (`src/lib/domain/feasibility.ts`)

- `earliestTerm(code)` is the minimum t in 0–7 where `offeringStatus` isn't
  `not-offered` and `reachableBefore(prereq, t)`, or `Infinity`. It's memoised.
  A code on the current recursion stack returns `Infinity` (cycle). A code not in
  the catalogue returns `-1` (unknown ≠ impossible).
- `reachableBefore(expr, t)`:
  - `course`: `earliestTerm(X) < t` (`≤ t` if concurrent). A two-semester X
    needs `earliestTerm(X) + 1 < t`.
  - `units(n, f)`: n ≤ 24·t **and** the units of catalogue courses matching f
    with `earliestTerm < t` sum to ≥ n.
  - `and`: every item; `or`: any item.
  - `program`: its `satisfied` value.
  - `unverifiable`: true.
- `hardBlock(code, t)` returns the first applicable reason, or `null`:
  1. `"${code} isn't offered in ${label} (offered that year: ${list || "none"})"`
  2. `"${code} runs over two consecutive semesters; there is no semester after ${label}"`,
     or `"…part 2 isn't offered in ${nextLabel}"`
  3. The requisite-failure message from `explainUnreachable(expr, t)`:
     - course: `"Needs ${X}, which can't be completed before ${label} (earliest: ${earliestLabel | "never"})"`
     - units: `"Needs ${n} units of ${filterLabel} before ${label}; at most ${m} are achievable by then"`
     - or: `"Needs one of ${codes}; none can be completed before ${label}"`
     - and: its failing children's messages joined by `"; "`

### 4.2 Plan evaluation (`src/lib/domain/evaluate.ts`)

For each placement it produces `PlacementEval { code, term, span, lastTerm,
state, reasons, suggestions, verify, conflictWith, loser, completed,
placedPrereqs, unplacedPrereqs, requisiteStatus }`, where `requisiteStatus` is
the `ReqExpr` annotated with `ok: boolean | null` per node.

- Soft evaluation uses actual placements. A course leaf is satisfied iff X is
  placed and `lastTerm(X) < t` (`≤ t` if concurrent). A units leaf sums the units
  of placed non-loser courses matching the filter with `lastTerm < t`.
- Conflict losers follow FR20.
- Term load counts each occupied term: a two-semester course contributes its
  per-part units to both t and t+1.

## 5. Task breakdown

### Task 10: Hard-block feasibility with specific reasons; enforce it in the API

- **Description:** FR15(a–c) and FR17's server-side refusal.
- **Files touched:** `src/lib/domain/feasibility.ts` (new),
  `src/lib/domain/feasibility.test.ts` (new), `src/lib/plan-service.ts`,
  `src/lib/domain/view.ts` (`courses[code].hardBlocked`, `projectedTerms`, `offeredLabel`, `offeringUnknown`),
  `spec/planner.test.ts`.
- **Tests first (red):** the real catalogue with the parser.
  - `COMP3630 in S1 2027 is hard-blocked by the 24-unit clause`: the reason
    contains `24 units of COMP` and `S1 2027`.
  - `COMP3600 in S1 2028 is not offered`: the reason contains `isn't offered in S1 2028`.
  - `COMP3600 in S2 2028 is not hard-blocked` (enough COMP achievable by then).
  - `multi-hop chain`: COMP3300 → COMP2310 → (COMP1110 | COMP1140) →
    (COMP1100 | COMP1130). The expected values are
    `earliestTerm("COMP1110") === 1`, `earliestTerm("COMP2310") === 3` (S2-only,
    and it needs COMP1110 or COMP1140, whose earliest is 1), and
    `hardBlock("COMP3300", 3)` contains `COMP2310` and `S2 2028`.
    `hardBlock("COMP3300", 5)` is `null`. (COMP2310's alternative `ENGN2219`
    isn't in the catalogue, so it counts as reachable, by design.)
  - `COMP4550 in S2 2030 is hard-blocked (no following semester)`.
  - `COMP4600 (unknown offering) is never hard-blocked on offering` (FR34).
  - `cycles terminate`: a synthetic catalogue where A needs B and B needs A gives
    `earliestTerm` of `Infinity` for both, and a hardBlock reason mentions the
    other code.
  - `unknown prereq codes don't hard-block`: a synthetic course needing
    `or(ZZZZ1111)` isn't hard-blocked at term 1.
  - Spec test: `placing COMP3630 in term 0 returns 409` and the error contains
    `24 units`.
- **Implementation (green):**
  `export function createFeasibility(cat: Catalogue): { earliestTerm(code: string): number; hardBlock(code: string, term: number): string | null; hardBlockedTerms(code: string): Record<number, string> }`,
  implementing this file's §4.1 with memoisation keyed by code. `placeCourse` returns 409
  with the reason when `hardBlock` is non-null. The feasibility instance is
  memoised alongside `loadCatalogue` and invalidated with it.
- **Refactor:** Share `filterLabel(f: CourseFilter): string` (e.g. "COMP
  3000–4000-level courses") in `src/lib/domain/filters.ts`, together with
  `matchesFilter(course: CatalogueCourse, f: CourseFilter, tdp: Set<string> | null): boolean`.
- **Acceptance criteria:**
  - The tests pass.
  - The example plan has zero hard-blocked placements (asserted in Task 13).
- **Depends on:** 8, 9.

### Task 11: Soft-block evaluation, conflicts, suggestions, load

- **Description:** FR15 (soft/available), FR16, FR19, FR20 and FR21.
- **Files touched:** `src/lib/domain/evaluate.ts` (new),
  `src/lib/domain/evaluate.test.ts` (new).
- **Tests first (red):**
  - `COMP2100 alone in S1 2028 is soft-blocked with suggestions for COMP1110 and
    COMP1140`: the state is `"soft"`; the suggestions include
    `{ code: "COMP1140", action: "place", term: 1 }` (the earliest
    non-hard-blocked term ≤ 1 with load room, since COMP1140 is S2-only) and a
    COMP1110 entry. A unit-shortfall message is present for the 6 MATH units.
  - `placing COMP1140 in S2 2027 and MATH1115 in S1 2027 makes COMP2100
    available`.
  - `a prereq placed in the same term only satisfies concurrent leaves`: COMP2120
    with COMP2100 in the same term is available; COMP2310 with COMP2300 in the
    same term is soft.
  - `a prereq placed too late yields a "move" suggestion`.
  - `COMP1100 + COMP1130 conflict`: both have a non-empty `conflictWith`; the
    later one (or, on a tie, COMP1130) has `loser: true`.
  - `losers don't count toward unit leaves`.
  - `two-semester course occupies t and t+1`: load for COMP4550 at T6 is 12 in
    both T6 and T7; `lastTerm === 7`; `completed` is false when cutoff = 7.
  - `load over 24 flags overload`.
  - `every hard-blocked placement keeps state "hard" and its reasons`, for a
    placement in a not-offered term.
  - `requisiteStatus marks leaves ok/false/null (null for unverifiable)`.
- **Implementation (green):**
  - `export interface Suggestion { code: string; action: "place" | "move"; term: number; text: string }`
  - `export interface PlacementEval` (fields per this file's §4.2)
  - `export function evaluatePlan(cat: Catalogue, feas: ReturnType<typeof createFeasibility>, plan: PlanState): { placements: PlacementEval[]; termUnits: number[] }`
- **Refactor:** None expected.
- **Acceptance criteria:** the tests pass.
- **Depends on:** 10.


## 6. Phase Definition of Done

- [x] Every task in §5 is complete and its tests pass
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] `POST /api/plans/<id>/placements` with COMP3630 at term 0 returns 409 with a 24-unit reason (spec test)
- [x] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR15 | Tasks 10, 11 |
| FR16 (logic) | Task 11 |
| FR17 (server) | Task 10 |
| FR19 | Tasks 10, 11 |
| FR20 (logic) | Task 11 |
| FR21 (logic) | Task 11 |
| FR34 (no offering-block) | Task 10 |

## 8. Risks / open questions

None.
