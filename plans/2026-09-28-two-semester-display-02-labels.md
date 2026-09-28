# Two-semester course display — Phase 02: Menu and sidebar labels

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28
- **Part of:** `plans/2026-09-28-two-semester-display-00-overview.md`. Read it
  first, especially §2 (TS4, TS6, NF2), §2.4 (the straddle fixture), §3 and
  §4.1.
- **Depends on phases:** 01 (`termSpanLabel`, `completedParts`).

## 1. Summary

After this phase:
- the "Place in…" and "Move to" menus label each option with the range a
  two-semester course would occupy;
- sidebar and search placed rows show the range, or the straddle form
  "Completed S1 2029 · planned S2 2029", with a matching accessible label.

## 2. Requirements (this phase)

### 2.1 Functional

TS4 (all of it) and TS6 (all of it).

### 2.2 Non-functional

NF2 for menu items and the placed-row locate button. NF4.

### 2.3 Out of scope for this phase

Timeline cards, the stub, and the overlay (Phase 03). Help text (Phase 04).

### 2.4 Assumptions

See overview §2.4. Search results for COMP4550 in a fresh plan render as an
`AvailableCourseCard` with `course` passed as an override. Once it's
placed, they render as a `PlacedCourseRow` in `.course-search .placed-row`.

## 3. Existing code context (verified 2026-09-28)

`src/components/planner-logic.ts`:

```ts
import { matchesFilter } from "../lib/domain/filters";
import type { CourseFilter, Family, ReqExpr } from "../lib/domain/types";
import { NORMAL_TERM_UNITS, type GroupView, type PlacementView, type PlanView } from "../lib/domain/view";

export interface DropTarget { term: number; allowed: boolean; reason: string | null; }
export function dropTargets(view: PlanView, code: string, hardBlockedOverride?: Record<number, string>): DropTarget[];

export interface MenuTargets {
  targets: DropTarget[];
  blockedReasons: string[];
}
export function menuTargets(
  view: PlanView,
  code: string,
  options: { currentTerm?: number; hardBlockedOverride?: Record<number, string> } = {},
): MenuTargets {
  const allTargets = dropTargets(view, code, options.hardBlockedOverride).filter(
    (target) => target.term !== options.currentTerm,
  );
  const targets = allTargets.filter((target) => target.allowed);
  const blockedReasons = Array.from(
    new Set(allTargets.filter((target) => !target.allowed && target.reason).map((target) => target.reason as string)),
  );
  return { targets, blockedReasons };
}

export interface PlacedStatus {
  word: "Completed" | "Planned";
  termLabel: string;
}
// A placed row's status, from the same `completed` flag the progress numbers
// use, so a row never disagrees with its group's bar.
export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus {
  return {
    word: placement.completed ? "Completed" : "Planned",
    termLabel: view.terms[placement.term].label,
  };
}
```

`src/components/PlaceInMenu.tsx`:
- Props: `{ view; code; onPlace(term); disabled?; hardBlockedOverride?; open; onOpenChange }`.
- It calls
  `const { targets, blockedReasons } = menuTargets(view, code, { hardBlockedOverride });`.
- It renders `<ul role="menu" aria-label={\`Place ${code} in\`}>` with one
  `<button role="menuitem">{view.terms[target.term].label}</button>` per
  target.

`src/components/AvailableCourseCard.tsx`:
- `const course = courseOverride ?? view.courses[code];` (non-null past the
  early return).
- It renders
  `<PlaceInMenu view code onPlace={place} disabled={pending} hardBlockedOverride={courseOverride?.hardBlocked} open=… onOpenChange=… />`.

`src/components/CourseCard.tsx`:
- `const course = view.courses[placement.code];`
- `const { targets, blockedReasons } = menuTargets(view, placement.code, { currentTerm: placement.term });`
- Under `<p class="card-menu-heading">Move to</p>` it renders
  `<ul class="card-menu-terms" aria-label={\`Move ${placement.code} to\`}>`
  with buttons `{view.terms[target.term].label}`.

`src/components/PlacedCourseRow.tsx` renders:

```tsx
const { word, termLabel } = placedStatus(view, placement);
…
<p class="placed-row-status">
  {word}{" "}
  <button type="button" class="course-card-term-link" onClick={() => onLocateCourse(code)}
    aria-label={`${code} is ${word === "Completed" ? "completed in" : "planned for"} ${termLabel} — locate it on the timeline`}>
    {termLabel}
  </button>
</p>
```

Existing tests that must stay green:
- `planner-logic.test.ts` `describe("menuTargets")`. Three tests, which
  check `.term` and `.allowed` only.
- `planner-logic.test.ts` `describe("placedStatus")`. It uses
  `toEqual({ word, termLabel })`, so it needs updating to the new shape.
- `spec/layout.test.ts`:
  - "placed rows": expects `.placed-row-status` innerText
    `"Completed S1 2027"` / `"Planned S1 2027"`, and a button named
    `/^COMP1130 is planned for S1 2027/`;
  - search placed row: `"Planned S1 2027"`;
  - locate tests: `/^COMP1100 is (completed in|planned for)/`.

Spec helpers in `spec/layout.test.ts`:
- `planWithPlacement(code)` places at term 0 only.
- `openPage(browser, url, viewport)`.
- The search UI is `page.fill(".course-search input", …)` then
  `page.click(".course-search button[type=submit]")`.
- A card's menu opens with
  ``page.locator(`[data-placed="${code}"]`).getByRole("button", { name: `More options for ${code}` })``.
- `baseUrl` comes from `inject("baseUrl")`.
- API calls use `fetch(new URL(path, baseUrl), { method, headers: { origin: baseUrl, "content-type": "application/json" }, body })`.

### Interfaces from earlier phases (exact)

```ts
// src/lib/domain/terms.ts (Task 1)
// "S1 2028 – S2 2028" (en dash, spaced) for span 2 when the next term
// exists; otherwise the single label. Throws RangeError like termLabel.
export function termSpanLabel(index: number, span: number): string;

// src/lib/domain/evaluate.ts, PlacementEval (Task 2); PlacementView extends it
completed: boolean;      // every occupied term is before the cutoff
completedParts: number;  // 0, 1 or 2 occupied terms before the cutoff
span: number;            // existing: 1 or 2
lastTerm: number;        // existing: term + span - 1 (8 for a final-term two-semester course)
```

## 4. Approach

- `menuTargets` works out each target's label with `termSpanLabel(term,
  twoSemester ? 2 : 1)`. `twoSemester` comes from
  `options.twoSemester ?? view.courses[code]?.twoSemester ?? false`, so a
  search result passes it explicitly and plan courses get it for free.
- `placedStatus` uses `termSpanLabel` for the range. Only a straddle
  (`completedParts > 0 && !completed` with a real second term) returns
  `rest`.
- In the single-label case, `word` comes from `completedParts > 0`. That
  equals `completed` for a one-semester course, and gives the final-term
  blocked case a sensible word.

## 5. Task breakdown

### Task 3: Range labels in "Place in…" and "Move to"

- [x] **Description:** `menuTargets` returns a `label` per target, which is
  the range for a two-semester course. `PlaceInMenu` and `CourseCard`
  render `target.label`. `AvailableCourseCard` passes the course's
  `twoSemester` so search results get ranges too.
- **Files touched:** `src/components/planner-logic.ts`,
  `src/components/planner-logic.test.ts`, `src/components/PlaceInMenu.tsx`,
  `src/components/AvailableCourseCard.tsx`, `src/components/CourseCard.tsx`,
  `src/styles.css`, `spec/layout.test.ts`.
- **Tests first (red):**
  - `planner-logic.test.ts` `describe("menuTargets")`:
    - `"labels a one-semester course's targets with the term"`: COMP3630,
      and every `target.label === view.terms[target.term].label`;
    - `"labels a two-semester course's targets with the range it occupies"`:
      COMP4550 on `emptyPlan()`, every label matches
      `/^S[12] \d{4} – S[12] \d{4}$/`, and the target with `term === 6` has
      label `"S1 2030 – S2 2030"`;
    - `"takes twoSemester from the caller for a course outside the plan"`:
      `menuTargets(view, "PSYC1004", { hardBlockedOverride: {}, twoSemester: true })`,
      and `targets[0].label` is `"S1 2027 – S2 2027"`.
  - `spec/layout.test.ts`, new `describe("two-semester labels", { timeout: 30_000 })`:
    - `"search's Place in… lists ranges for a two-semester course"`:
      - create a plan with `POST /api/plans` (as in `planWithPlacement`,
        without placing), open it at 1920×1080, search "COMP4550";
      - click the result card's "Place in…" button;
      - the `menu` named "Place COMP4550 in" has `menuitem`s whose texts
        all match `/^S[12] \d{4} – S[12] \d{4}$/`, with count > 0;
      - each menuitem's text sits on one line (added in execution, see
        below).
    - `"Move to lists ranges for a placed two-semester course"`:
      - place COMP4550 at term 4 in a fresh plan (`planWithPlacement`
        gains an optional `term = 0` argument);
      - scroll the card into view, then open its More options (term 4 starts
        off-screen at 1920, and MoreOptions closes on any scroll, so letting
        `click` scroll would close the menu it just opened);
      - every button in the list named "Move COMP4550 to" matches the same
        regex.
- **Implementation (green):**
  - Import `termSpanLabel` from `"../lib/domain/terms"`.
  - Add `export interface MenuTarget extends DropTarget { label: string; }`.
  - Change `MenuTargets.targets` to `MenuTarget[]`.
  - Add `twoSemester?: boolean` to the options type.
  - In `menuTargets`:
    - compute `const span = (options.twoSemester ?? view.courses[code]?.twoSemester ?? false) ? 2 : 1;`;
    - build `targets` as
      `allTargets.filter((t) => t.allowed).map((t) => ({ ...t, label: termSpanLabel(t.term, span) }))`;
    - comment that a two-semester course's option names both semesters it
      will take up.
  - `PlaceInMenu`:
    - add prop `twoSemester?: boolean` (comment: for a search result, like
      `hardBlockedOverride`);
    - pass it to `menuTargets`;
    - render `{target.label}`.
  - `AvailableCourseCard`: pass `twoSemester={course.twoSemester}`.
  - `CourseCard`: pass `twoSemester: course?.twoSemester` to `menuTargets`
    and render `{target.label}`.
  - `src/styles.css`: `white-space: nowrap` on `.place-in-menu ul button`.
    *Added in execution (ruled 2026-09-28):* the Place in… list is only as
    wide as its toggle (`min-width: 9rem`, 144px), so every range wrapped
    to two lines (59px items) at both 1920 and 390.
- **Refactor:** none.
- **Acceptance criteria:**
  - The new unit and spec tests pass.
  - The existing `menuTargets` tests pass unchanged.
  - A one-semester course's menus render exactly as before, i.e. the
    single-term assertions in existing spec tests are green.
  - `pnpm check` is green.
- **Depends on:** Task 1.

### Task 4: Range and straddle status in placed rows

- [ ] **Description:** replace `PlacedStatus` with the overview §4.1 shape.
  `PlacedCourseRow` renders `word`, the locate button (`termLabel`), then
  `rest`, and takes its accessible label from `spoken`.
- **Files touched:** `src/components/planner-logic.ts`,
  `src/components/planner-logic.test.ts`, `src/components/PlacedCourseRow.tsx`,
  `spec/layout.test.ts`.
- **Tests first (red):**
  - `planner-logic.test.ts` `describe("placedStatus")`:
    - update the two existing expectations to include
      `rest: null, spoken: "completed in S1 2027"` and
      `spoken: "planned for S2 2027"` (COMP1110 at term 1, cutoff 1);
    - add `"gives a two-semester course's range"`: COMP4550 at 4, cutoff 0 →
      `{ word: "Planned", termLabel: "S1 2029 – S2 2029", rest: null, spoken: "planned for S1 2029 to S2 2029" }`;
      with cutoff 6 → `word: "Completed"`,
      `spoken: "completed in S1 2029 to S2 2029"`;
    - add `"splits a two-semester course straddling the cutoff"`: COMP4550
      at 4, cutoff 5 →
      `{ word: "Completed", termLabel: "S1 2029", rest: "· planned S2 2029", spoken: "completed in S1 2029 and planned for S2 2029" }`.
  - `spec/layout.test.ts` inside `describe("two-semester labels")`,
    `"search's placed row shows the straddle and locates part 1"`:
    - fresh plan, place COMP4550 at 4, `PUT` cutoff 5;
    - open at 1920×1080 and search "COMP4550";
    - the `.course-search .placed-row` `.placed-row-status` innerText is
      `"Completed S1 2029 · planned S2 2029"`;
    - the button named
      `/^COMP4550 is completed in S1 2029 and planned for S2 2029 — locate it on the timeline$/`
      exists;
    - clicking it makes `document.activeElement`'s `data-placed`
      `"COMP4550"`.
- **Implementation (green):**
  - Replace `PlacedStatus` with the overview §4.1 interface. The
    `termSpanLabel` import comes from Task 3; add it if Task 3 isn't in
    yet.
  - Rewrite `placedStatus`, keeping and extending its comment (per-part
    now, from the same `completedParts` the progress numbers use):
    - `first = view.terms[placement.term].label`;
    - `second = placement.span === 2 ? (view.terms[placement.lastTerm]?.label ?? null) : null`.
    - If `second && placement.completedParts > 0 && !placement.completed`,
      return the straddle object from the test.
    - Otherwise:
      - if `second`, set `done = placement.completed`, else
        `done = placement.completedParts > 0`;
      - `word = done ? "Completed" : "Planned"`;
      - `verb = done ? "completed in" : "planned for"`;
      - `termLabel = second ? termSpanLabel(placement.term, 2) : first`;
      - `spoken = second ? \`${verb} ${first} to ${second}\` : \`${verb} ${first}\``;
      - `rest: null`.
  - `PlacedCourseRow`:
    - `const status = placedStatus(view, placement);`
    - render `{status.word}{" "}<button … aria-label={\`${code} is ${status.spoken} — locate it on the timeline\`}>{status.termLabel}</button>{status.rest && <> {status.rest}</>}`.
- **Refactor:** none.
- **Acceptance criteria:**
  - The new and updated tests pass.
  - The existing spec strings `"Completed S1 2027"`, `"Planned S1 2027"`
    and `/^COMP1130 is planned for S1 2027/` pass unchanged.
  - `pnpm check` is green.
- **Depends on:** Task 1, Task 2.

## 6. Phase Definition of Done

- [ ] Tasks 3–4 complete, their tests pass, and each is committed
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Menus and placed rows show ranges and the straddle wording in the spec tests above
- [ ] Tick Phase 02 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| TS4 | Task 3 |
| TS6 | Task 4 |
| NF2 (menu items, locate label) | Tasks 3, 4 |
| NF4 | Tasks 3, 4 |

## 8. Risks / open questions

None.
