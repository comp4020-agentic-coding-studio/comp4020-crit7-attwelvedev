# Max-only group progress bars

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28 (wording "of up to
  N"; clamp every bar; "of up to" on every max-bound bar)

## 1. Summary

Four specialisation groups set only a cap: "(max 12)" or "(max 6)", with
`unitsRequired: 0` and a `unitsMax`. The domain already handles them
correctly: the allocation solver enforces the cap, and `GroupView`
carries `unitsMax`. But the sidebar draws their progress bar against
`unitsRequired`, which is 0. The bar stays empty, its text reads
"0 completed, 12 planned of 0", and it reports `aria-valuenow` 12
against `aria-valuemax` 0. The same out-of-range ARIA value already
appears on every bar that goes over its minimum, e.g. "0 completed, 60
planned of 48". This fix:
- draws cap-only groups against their cap;
- makes every max-bound bar read "of up to N";
- clamps every bar's `aria-valuenow` to its `aria-valuemax`;
- adds a `spec/` check over every progress bar so this class of bug
  can't come back unnoticed.

It is display only, and independent of the course card redesign plan
set.

## 2. Requirements

### 2.1 Functional requirements

1. **R1 (cap-only groups):** a group with `unitsRequired === 0` and a
   non-null `unitsMax` draws its bar against `unitsMax` with `bound="max"`,
   so the bar fills toward the cap and `aria-valuemax` is the cap. Every
   other group keeps `unitsRequired` with `bound="min"`, including groups
   with both a minimum and a max, such as `arin` (24/24).
2. **R2 (wording):** every max-bound bar's text (visible and
   `aria-valuetext`) reads "C completed, P planned of up to N". That
   covers cap-only groups and the "At most 60 units at 1000-level" check.
   The over-limit note stays: "— X unit(s) over the N-unit limit".
   Min-bound text is unchanged: "C completed, P planned of N", plus the
   existing "— X unit(s) more than the N-unit minimum, already covered".
3. **R3 (ARIA range):** every `ProgressBar` sets `aria-valuenow` to
   `min(completed + planned, required)`, so it never exceeds
   `aria-valuemax`. `aria-valuetext` keeps the true numbers and any over
   note.
4. **R4 (harness):** a `spec/` check over every `[role="progressbar"]`
   inside `#requirements` asserts that:
   - `aria-valuenow` ≤ `aria-valuemax`;
   - `aria-valuemax` > 0 whenever `aria-valuenow` > 0;
   - no bar's `aria-valuetext` ends in "of 0".

   It runs on `/plan/example` and on a fresh plan for each
   specialisation choice (`arin`, `hccc`, `syar`, `thcs`), so all four
   cap-only groups are rendered at least once.

### 2.2 Non-functional requirements

- Axe stays clean on `/plan/example` at 1920×1080.
- No visual change beyond the affected bars' fill and text: no colour or
  layout change. Checked by screenshot at 1920×1080 and 390×844.

### 2.3 Out of scope

- Requirements data, allocation, `GroupView.satisfied` and evaluation.
- The rail's accessible name ("Show requirements: … of 192") and the
  Total bar's target.
- The course card redesign phases (`plans/2026-09-28-course-card-redesign-*`).
- Changing a group's label (the "(max 12)" suffix stays).

### 2.4 Assumptions

- A cap-only group's `completed + planned` never exceeds `unitsMax`,
  because the allocation solver caps it (`allocation.test.ts`, "unitsMax
  caps a leaf…"). R2's over-limit note therefore only ever shows on the
  1000-level check. The code handles both cases the same way anyway.

## 3. Existing code context (verified 2026-09-28, HEAD `0cc8825`)

**`src/components/ProgressBar.tsx`**, the whole component:

```tsx
interface Props {
  label: string;
  completed: number;
  planned: number;
  required: number;
  bound?: "min" | "max";
  family?: Family;
}

export default function ProgressBar({ label, completed, planned, required, bound = "min", family }: Props) {
  const { completedPct, plannedPct } = progressSegments(completed, planned, required);
  const over = completed + planned - required;
  const overNote =
    required > 0 && over > 0
      ? bound === "max"
        ? ` — ${over} unit${over === 1 ? "" : "s"} over the ${required}-unit limit`
        : ` — ${over} unit${over === 1 ? "" : "s"} more than the ${required}-unit minimum, already covered`
      : "";
  const text = `${completed} completed, ${planned} planned of ${required}${overNote}`;
  return (
    <div class="progress-bar" data-family={family}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={required}
        aria-valuenow={completed + planned} aria-valuetext={text} class="progress-bar-track">
        <span class="progress-bar-completed" style={{ width: `${completedPct}%` }} />
        <span class="progress-bar-planned" style={{ width: `${plannedPct}%`, insetInlineStart: `${completedPct}%` }} />
      </div>
      <p class="progress-bar-text">{text}</p>
    </div>
  );
}
```

(The attributes are condensed onto fewer lines here. The source has
one per line, and the comment on `bound` in `Props` explains min/max.)

**`src/components/Sidebar.tsx`** has three `ProgressBar` call sites:
- `Group` (about line 138):
  `<ProgressBar label={group.label} completed={group.completed}
  planned={group.planned} required={group.unitsRequired}
  family={group.family} />`, used for top-level and nested groups;
- Total (about line 469): `required={view.total.required}`, no bound;
- each tracked check (about line 486): `required={check.units}
  bound={check.bound}`.

**`src/lib/domain/view.ts`:** `GroupView` includes `unitsRequired:
number; unitsMax: number | null;` (set from `group.unitsMax ?? null`).
`CheckView` includes `bound: "min" | "max"; units: number`.

**`src/components/planner-logic.ts`:** pure helpers used by components,
e.g. `export function progressSegments(completed: number, planned:
number, required: number): ProgressSegments`. It imports
`type GroupView` from `../lib/domain/view` already.

**Data (`src/data/aacom-2027.ts`):**
- the cap-only groups are `arin-a` (max 12), `hccc-c` (max 6), `syar-a`
  (max 12) and `thcs-a` (max 12), nested under the specialisations
  `arin`, `hccc`, `syar` and `thcs`, which are the choices of group
  `spec`;
- no other group has `unitsRequired: 0`;
- the only max-bound check is `lvl1000-max`, "At most 60 units at
  1000-level" (60);
- `/plan/example` has `arin` chosen and shows "At least 48 units of
  4000-level COMP" as "0 completed, 60 planned of 48 — 12 units more
  than the 48-unit minimum, already covered" (valuenow 60 > valuemax
  48).

**Tests:**
- Unit: Vitest project `unit` (`src/**/*.test.ts`). `planner-logic.test.ts`
  has `cat` (the real catalogue), `emptyPlan()`, and imports `AACOM_2027`
  and `buildPlanView`. Run one file with `pnpm exec vitest run --project
  unit src/components/planner-logic.test.ts`.
- Spec: Playwright Chromium against the **built** server. Rebuild before
  every red or green run: `pnpm build && pnpm exec vitest run
  spec/layout.test.ts -t "<name>"`. Helpers in `spec/layout.test.ts`
  include `withPlan(viewport, check)` (opens `/plan/example`), `openPage`,
  `axeViolations`, `baseUrl` and `browser`. A fresh plan comes from
  `POST /api/plans` with header `origin: baseUrl` and `redirect:
  "manual"`, and the ID is the last segment of `location`. A spec choice
  is `PUT /api/plans/<id>/choices` with JSON `{ groupId: "spec", childId }`
  and headers `origin` plus `content-type: application/json`.
- `spec/planner.test.ts:229` asserts that the example HTML matches
  `/\d+ completed, \d+ planned of \d+/`. It still passes, because min
  bars keep that form.
- Full gate: `pnpm check` (typecheck, build, all tests).

**Conventions:**
- comments explain why;
- pure helpers live in `planner-logic.ts` with tests in
  `planner-logic.test.ts`;
- one commit per task once `pnpm check` is green, ending with the
  session's Co-Authored-By line;
- a spec check that finds nothing to measure must fail (assert a count
  above 0 first).

## 4. Approach

Move the bar's numbers into two pure helpers, so the rules are
unit-tested directly and `ProgressBar`/`Sidebar` only render:
- `progressBarNumbers` decides the text and the ARIA values for any bar
  (R2, R3);
- `groupBarTarget` decides what a group's bar is measured against (R1).

The `spec/` check (R4) is the harness guard. It is split across the two
tasks so each task ends green: Task 1 adds the range assertion, and
Task 2 adds the "of 0" assertion that only R1 can satisfy.

**Rejected:** special-casing cap-only groups inside `ProgressBar` (the
bar would need to know about groups), and changing the data to
`unitsRequired: 12` (it would make the cap a requirement and change
`satisfied`, which is out of scope).

## 5. Task breakdown

### Task 1: One helper for every bar's text and ARIA range, with "of up to N" on max bars

- [x] **Description:** add `progressBarNumbers` and use it in
  `ProgressBar`. Max-bound text says "of up to N", and `aria-valuenow`
  is clamped. Start the harness spec with the range assertion.
- **Files touched:** `src/components/planner-logic.ts`,
  `src/components/planner-logic.test.ts`, `src/components/ProgressBar.tsx`,
  `spec/layout.test.ts`.
- **Tests first (red):**
  - **Unit, `describe("progressBarNumbers")`,** on
    `progressBarNumbers(completed, planned, required, bound)`:
    1. `(6, 0, 6, "min")` gives `{ valueNow: 6, valueMax: 6, text: "6
       completed, 0 planned of 6" }`.
    2. `(0, 60, 48, "min")` gives `valueNow: 48`, `valueMax: 48` and
       `text: "0 completed, 60 planned of 48 — 12 units more than the
       48-unit minimum, already covered"`.
    3. `(48, 0, 60, "max")` gives `{ valueNow: 48, valueMax: 60, text:
       "48 completed, 0 planned of up to 60" }`.
    4. `(0, 66, 60, "max")` gives `valueNow: 60` and `text: "0
       completed, 66 planned of up to 60 — 6 units over the 60-unit
       limit"`.
    5. `(0, 61, 60, "max").text` ends "— 1 unit over the 60-unit limit".
  - **Spec, new `describe("progress bars")` in `spec/layout.test.ts`:**
    `it("every bar's value stays within its range")`. On `withPlan` at
    1920×1080, collect every `#requirements [role="progressbar"]` as `{
    label, now, max, text }`, from `aria-label`, `aria-valuenow`,
    `aria-valuemax` and `aria-valuetext`. Assert that the count is above
    0, then that each bar (labelled in the failure message) has `now <=
    max`. Red: it fails on "At least 48 units of 4000-level COMP" (60 >
    48) and on `arin-a` (12 > 0).
- **Implementation (green):**
  - `planner-logic.ts`:
    ```ts
    export interface ProgressBarNumbers { valueNow: number; valueMax: number; text: string }
    export function progressBarNumbers(
      completed: number, planned: number, required: number, bound: "min" | "max",
    ): ProgressBarNumbers
    ```
    It uses the `overNote` logic moved verbatim from `ProgressBar`. The
    text is `${completed} completed, ${planned} planned of
    ${bound === "max" ? "up to " : ""}${required}${overNote}`, with
    `valueNow: Math.min(completed + planned, required)` and `valueMax:
    required`. A comment says why `valueNow` is clamped (ARIA range;
    `valuetext` has the true numbers).
  - `ProgressBar.tsx`: call `progressBarNumbers(completed, planned,
    required, bound)`. Use `valueMax` for `aria-valuemax`, `valueNow` for
    `aria-valuenow`, and `text` for `aria-valuetext` and the `<p>`.
    Remove the local `over`/`overNote`/`text`. `Props` is unchanged.
- **Refactor:** none expected.
- **Acceptance criteria:**
  - The five unit cases pass.
  - The spec range test passes. `arin-a` passes too, because its
    `valueNow` is clamped to 0; Task 2 then fixes its target.
  - The 1000-level check renders "… of up to 60" on `/plan/example`.
  - `pnpm check` is green.
- **Depends on:** none.

### Task 2: Cap-only groups measure against their cap

- [x] **Description:** add `groupBarTarget` and use it at `Sidebar.tsx`'s
  `Group` call site, so `arin-a`/`hccc-c`/`syar-a`/`thcs-a` read "C
  completed, P planned of up to N" and fill toward the cap. Extend the
  harness spec with the "of 0" assertion across every specialisation.
- **Files touched:** `src/components/planner-logic.ts`,
  `src/components/planner-logic.test.ts`, `src/components/Sidebar.tsx`,
  `spec/layout.test.ts`.
- **Tests first (red):**
  - **Unit, `describe("groupBarTarget")`,** on
    `groupBarTarget(group)`:
    1. `{ unitsRequired: 0, unitsMax: 12 }` gives `{ required: 12, bound:
       "max" }`.
    2. `{ unitsRequired: 6, unitsMax: null }` gives `{ required: 6, bound:
       "min" }`.
    3. `{ unitsRequired: 24, unitsMax: 24 }` gives `{ required: 24,
       bound: "min" }`.
    4. For each of `arin`, `hccc`, `syar` and `thcs`: build
       `buildPlanView(cat, AACOM_2027, { ...emptyPlan(), choices: { spec:
       <choice> } })`, walk every group in `view.groups` recursively, and
       assert that `groupBarTarget(group).required > 0` (message: the
       group ID). The walk must visit more than 0 groups.
  - **Spec, in `describe("progress bars")`:**
    `it.each(["example", "arin", "hccc", "syar", "thcs"])("no bar is
    measured against nothing (%s)")`:
    - `"example"` opens `/plan/example`;
    - each other value creates a fresh plan, `PUT`s `{ groupId: "spec",
      childId: <value> }` (expect status 200) and opens `/plan/<id>`,
      at 1920×1080.

    Collect the bars as in Task 1. Assert that the count is above 0,
    then that for each bar `max > 0 || now === 0` and its `text` doesn't
    match `/of 0$/`, labelled by `aria-label`. Red: every case fails on
    its cap-only group ("… planned of 0").
- **Implementation (green):**
  - `planner-logic.ts`:
    ```ts
    export function groupBarTarget(
      group: Pick<GroupView, "unitsRequired" | "unitsMax">,
    ): { required: number; bound: "min" | "max" }
    ```
    It returns `{ required: group.unitsMax, bound: "max" }` when
    `group.unitsRequired === 0 && group.unitsMax !== null`, and
    otherwise `{ required: group.unitsRequired, bound: "min" }`. A
    comment explains that a cap-only group has nothing to reach, only a
    limit, so its bar measures toward the cap.
  - `Sidebar.tsx` `Group`: `const target = groupBarTarget(group);`, then
    pass `required={target.required} bound={target.bound}` to the
    group's `ProgressBar` in place of `required={group.unitsRequired}`.
- **Refactor:** none expected.
- **Acceptance criteria:**
  - The four unit cases pass.
  - All five spec cases pass.
  - `/plan/example` shows `arin-a` as "0 completed, 12 planned of up to
    12", with a full (planned, hatched) bar.
  - `pnpm check` is green.
  - Screenshots at 1920×1080 and 390×844 of the Specialisation section
    show no change beyond `arin-a`'s bar and text.
- **Depends on:** Task 1 (`progressBarNumbers` supplies the "of up to"
  wording, and the `describe("progress bars")` block exists).

## 6. Feature-level Definition of Done

- [x] Tasks 1–2 complete, their tests passing
- [x] `pnpm exec vitest run --project unit` passes
- [x] `pnpm check` passes
- [x] Axe clean on `/plan/example` at 1920×1080 (the existing axe spec
      tests still pass)
- [x] Manually, from renders at 1920×1080 and 390×844 on `/plan/example`:
      `arin-a` reads "of up to 12" with a full bar; the 1000-level check
      reads "of up to 60"; "At least 48 units of 4000-level COMP" still
      reads "… of 48 — 12 units more than the 48-unit minimum, already
      covered"
- [x] Every requirement in §2 is covered (see §7)
- [x] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| R1 (cap-only groups against the cap) | Task 2 |
| R2 ("of up to N" on max bars, notes kept) | Task 1 (helper, check bar), Task 2 (groups) |
| R3 (`aria-valuenow` clamped) | Task 1 |
| R4 (harness over every bar, example + each spec) | Task 1 (range), Task 2 (non-zero target, no "of 0") |
| NFR axe | DoD (existing axe specs) |
| NFR no other visual change | Task 2 screenshots, DoD manual check |

## 8. Risks / open questions

None.
