# Specialisation details — Phase 03: What-if

- **Date:** 2026-09-30
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-29 (spec) and 2026-09-30
  (the toast wording)
- **Part of:** `plans/2026-09-30-specialisation-details-00-overview.md`.
  Read it first, especially §2 (SD16–SD19), §3, and the §4.3 HTTP contract.
  Background: the spec's §4.1 wireframes "Desktop docked, narrow" (the Fit
  block), "None chosen yet" and "What-if states".
- **Depends on phases:** 01 and 02.

## 1. Summary

An unchosen specialisation's panel gets "Fit with your plan", driven by a
server what-if: the plan re-evaluated with that option chosen. It shows:

- the option's progress
- which placed courses would count, and where each counts today
- which courses would stop counting toward the current spec
- which requirements would stop being met

The block carries the Choose or Switch button (applied through the existing
choice action, with undo). Every choice toast gains the switch form. The
course lines under Requirements say "would count" or "wouldn't count here".

## 2. Requirements (this phase)

### 2.1 Functional

- SD16: all of it (Tasks 6, 8).
- SD17: all of it, including the amended toast (Task 8).
- SD18: all of it (Tasks 7, 8).
- SD19: the unchosen suffixes "would count" and "wouldn't count here[,
  over the N-unit limit]" (Task 8).

### 2.2 Non-functional

- N1: the Fit block is axe-clean in every state.
- N3: the what-if never rides in `PlanView`.
- N5: browser tests go in `spec/layout/specialisation-details.test.ts`.

### 2.3 Out of scope for this phase

The entry points (Phase 04), and the wide/phone sweep (Phase 05). No
per-list what-if figures (overview §2.3).

### 2.4 Assumptions

See overview §2.4: a what-if is `buildPlanView` with the choice swapped.

## 3. Existing code context (verified 2026-09-30)

**`src/lib/domain/view.ts`:**

- `export function buildPlanView(cat: Catalogue, program: ProgramDef, plan: PlanState): PlanView`,
  which is pure.
- `GroupView` has `{ id; label; kind; ruleType; unitsRequired: number;
  unitsMax: number | null; selectable: boolean; chosenId: string | null;
  options: { id: string; label: string }[]; completed: number; planned:
  number; satisfied: boolean; courses: string[]; filterLabel: string |
  null; missing: string[]; children: GroupView[]; family: Family }`.
  - A selectable group's `children` holds only the chosen option's view.
  - `satisfied` is `completed + planned >= unitsRequired`.
- `PlacementView` extends `PlacementEval` with `{ countsToward: string |
  null; pinned: boolean }`. `countsToward` is always a leaf group id or
  null.
- `PlanView = { plan: { id; readOnly; cutoff }; terms; placements; groups;
  checks; total; courses: Record<string, CourseCard> }`.

**`src/lib/domain/types.ts`:** `PlanState = { id; readOnly; cutoff;
choices: Record<string, string>; placements: Placement[]; checks? }` and
`Family = "foundations" | "specialisation" | "advanced" | "ict" |
"capstone" | "neutral"`.

**`src/lib/plan-service.ts`:**

- It imports `db`, `buildPlanView`, `getPlan`, `loadCatalogue` and
  `loadProgram`, and has a module-local
  `findGroup(groups: GroupDef[], groupId): GroupDef | null`.
- `setChoice` validates like this, which the what-if mirrors:
  ```ts
  const group = findGroup(program.groups, groupId);
  if (!group || !group.selectable) return { status: 400, error: `${groupId} is not a selectable group` };
  if (childId !== null && !(group.children ?? []).some((c) => c.id === childId)) return { status: 400, error: `${childId} is not an option of ${groupId}` };
  ```
- Plan-not-found is `{ status: 404, error: "plan not found" }`.

**Route style** (`src/pages/api/plans/[id]/choices.ts`): a local
`json(body, status)` helper, `export const PUT: APIRoute = async ({ params, request }) => …`,
reading `params.id`.

**`src/components/api.ts`:** `fetchCourseDetails(code, planId?)` is the
GET pattern to copy:

```ts
const res = await fetch(`/api/courses/${encodeURIComponent(code)}?${params.toString()}`);
const body = (await res.json()) as X | { error: string };
if (!res.ok) return { error: "error" in body ? body.error : "Request failed" };
return body;
```

**`src/components/use-course-details.ts`** has the stale guard to copy: an
effect-local `let stale = false`, set true in cleanup, and a check before
setting state.

**`src/components/plan-actions.ts`:**

```ts
function currentChoice(view: PlanView, groupId: string): string | null { return groupPath(view, groupId).at(-1)?.chosenId ?? null; }
// in historyStep:
case "choice": {
  const option = groupPath(view, action.groupId).at(-1)?.options.find((o) => o.id === action.childId);
  return step(`Chose ${option?.label ?? action.childId} for ${groupLabel(view, action.groupId)}`, [
    { kind: "choice", groupId: action.groupId, childId: currentChoice(view, action.groupId) },
  ]);
}
```

- The toast renders `{message}.{knockOn}`, so messages have no trailing
  period.
- `src/components/plan-actions.test.ts:145-149`, "undoes a choice by
  choosing the previous option back", builds `view` from the example plan
  (spec already `"arin"`) and expects `` `Chose ${otherSpec.label} for Specialisation` ``.
  **This changes to the switch form** in Task 8.
- `spec/layout/undo.test.ts:278-291` chooses from nothing and expects
  "Chose Human-Centred & Creative Computing for Specialisation." It is
  unchanged.

**Browser-test helpers** (`spec/layout/helpers.ts`):

- `baseUrl` and `useBrowser()`.
- `planWithPlacement(code: string, term = 0): Promise<string>`, which
  creates an editable plan (POST `/api/plans` with
  `headers: { origin: baseUrl }`), places one course and returns its id.
- *Amended during execution, 2026-09-30:* the placement is hard-block
  checked (409), and COMP3670 is S2-only with its prereqs unreachable before
  S2 2028, so it's placeable only in terms 3, 5 and 7. The browser fixtures
  use term 5 (S2 2029), which stays planned under Task 7's "S2 2027" cutoff.
  The unit fixtures in Task 6 go through `buildPlanView`, which doesn't
  hard-block, so they keep their terms.

The API needs the same `origin` header for any other change, e.g. to
choose a spec before opening a page:

```ts
await fetch(new URL(`/api/plans/${id}/choices`, baseUrl), {
  method: "PUT",
  headers: { origin: baseUrl, "content-type": "application/json" },
  body: JSON.stringify({ groupId: "spec", childId: "arin" }),
});
```

The toast is `.undo-toast` (`role="status"`). Its Undo button is named
"Undo".

**`src/components/ProgressBar.tsx` props:**
`{ label: string; completed: number; planned: number; required: number; bound?: "min" | "max"; family?: Family; figuresOnly?: boolean }`.

**`src/styles.css`:**

- The gold primary is at lines 311-322:
  `form button[type="submit"], form button:not([type]) { background: var(--gold); border-color: var(--gold); color: #17130a; }`,
  with a hover of `#a8790d`.
- `.details-loading` exists (the course panel's "Loading course details…").
- `.family-dot` is at line 3000.

### Interfaces from earlier phases (exact)

From Task 2 (`src/data/specialisations.ts`):

```ts
export interface SpecList { groupId: string; label: string; shortLabel: string; unitsMax: number | null }
export interface SpecialisationInfo extends SpecialisationData { groupId: string; label: string; lists: SpecList[] }
export const SPEC_CHOICE_GROUP = "spec";
export function specialisationByGroup(groupId: string): SpecialisationInfo | null;
```

From Task 3 (`src/components/details-state.ts`): `DetailsState`,
`specCode(state: DetailsState): string | null`.

From Task 4 (`src/components/DetailsFrame.tsx`): `children: (sheet: { peek: () => void }) => ComponentChildren`.

From Task 5:

- `src/components/SpecialisationDetailsPanel.tsx`, props:
  `{ view; details; spec: SpecialisationInfo; onOpenCourse; onBack; onForward; onClose; onShowInSidebar: (groupId: string) => void; onAction: (action: PlanAction) => Promise<void>; mode; wide; onToggleWide }`.
  - Body order: (chosen) "In your plan", then "Requirements", "About the
    specialisation", "Other information", "Relevant degrees".
  - Course lines are `li > span.requisite-line > span.mark-dot + span[code, title, span.spec-units, span.requisite-where]`.
- `src/components/spec-logic.ts`:
  ```ts
  export function chosenSpecGroup(view: PlanView): string | null;
  export type ProseSegment = string | { code: string };
  export function linkCodes(text: string, canOpen: (code: string) => boolean): ProseSegment[];
  export function courseLineStatus(view: PlanView, code: string, spec: SpecialisationInfo, listGroupId: string): string;
  ```
- The test file `spec/layout/specialisation-details.test.ts` (with
  `useBrowser()`), and the `STATE_ROUTES` entries
  `/plan/example?spec=ARIN-SPEC` and `/plan/example?spec=HCCC-SPEC`.

## 4. Approach

### 4.1 The domain what-if (`src/lib/domain/what-if.ts`, pure)

```ts
export interface WhatIfGroupRef { id: string; label: string; family: Family }

export interface WhatIfView {
  groupId: string; // the selectable group, "spec"
  optionId: string; // "arin"
  completed: number; // the option's totals after the swap
  planned: number;
  required: number;
  // Placed courses counting toward the option after, with where each counts now (null: nothing).
  moves: { code: string; from: WhatIfGroupRef | null; to: WhatIfGroupRef }[];
  // Placed courses counting toward the current option (if another is chosen) now, and where they'd count after.
  leaving: { code: string; from: WhatIfGroupRef; to: WhatIfGroupRef | null }[];
  // Leaf groups outside both options, satisfied now but not after; figures are the after ones.
  shortfalls: { groupId: string; label: string; completed: number; planned: number; required: number }[];
  countsToward: Record<string, string | null>; // after, every placed course
  lists: { groupId: string; completed: number; planned: number; unitsMax: number | null }[]; // the option's children, after
}

export function whatIfChoice(cat: Catalogue, program: ProgramDef, plan: PlanState, groupId: string, optionId: string): WhatIfView;
```

Algorithm:

1. `before = buildPlanView(cat, program, plan)`;
   `after = buildPlanView(cat, program, { ...plan, choices: { ...plan.choices, [groupId]: optionId } })`.
2. A local `find(groups: GroupView[], id): GroupView | null` walks the
   trees. `ref(g) = { id: g.id, label: g.label, family: g.family }`.
3. `option = find(after.groups, optionId)`. `optionIds` is the ids in its
   subtree. `current = plan.choices[groupId]`, and `currentIds` is the ids
   in `find(before.groups, current)`'s subtree, when
   `current && current !== optionId`.
4. **moves:** `after.placements` whose `countsToward ∈ optionIds`, sorted by
   code. `from` is the before placement's `countsToward` found in
   `before.groups` (null if none). `to` is found in `after.groups`.
5. **leaving:** `before.placements` whose `countsToward ∈ currentIds`, with
   `to` from `after`.
6. **shortfalls:** every leaf (`children.length === 0`) of `before.groups`
   whose id is outside `optionIds` and `currentIds`, satisfied before, whose
   same-id leaf in `after` isn't satisfied. It reports the after figures,
   in tree order.
7. **The rest:** `completed`, `planned` and `required` come from `option`.
   `lists` comes from `option.children`. `countsToward` comes from
   `after.placements`.

### 4.2 Service, route, client

- **Service,** in `plan-service.ts`:
  ```ts
  export type WhatIfResult = { status: 200; whatIf: WhatIfView } | { status: 400 | 404; error: string };
  export function getWhatIf(planId: string, groupId: string, optionId: string): WhatIfResult;
  ```
  It returns 404 for a missing plan, and 400 using `setChoice`'s two checks
  and messages. It never checks `readOnly` (it reads).
- **Route:** `src/pages/api/plans/[id]/what-if.ts`,
  `export const GET: APIRoute = ({ params, url }) => …`.
  - It reads `url.searchParams.get("group")` and `get("option")`.
  - A missing one gives 400 `"group and option are required"`.
  - On success it responds 200 with `WhatIfView`; otherwise
    `{ error }` with the status.
- **Client:**
  `export function fetchWhatIf(planId: string, groupId: string, optionId: string): Promise<WhatIfView | { error: string }>`
  in `api.ts`, following the `fetchCourseDetails` pattern.
- **Hook,** `src/components/use-what-if.ts`:
  ```ts
  export interface WhatIfFetch { status: "idle" | "loading" | "ready" | "error"; data: WhatIfView | null; retry: () => void }
  export function useWhatIf(planId: string, groupId: string, optionId: string | null, view: PlanView): WhatIfFetch;
  ```
  - `optionId === null` means idle (the chosen spec).
  - It re-fetches whenever `view` (a new object per plan change), the
    option or a retry counter changes.
  - It keeps the last data *for the same option* while re-fetching, so the
    block doesn't jump. `status` is still "loading" then, and the UI shows
    the data when there is some.
  - A stale response (option or view changed, or unmounted) is dropped.
  - `retry` bumps the counter.

### 4.3 The Fit block (Task 8)

Pure text helpers in `spec-logic.ts`:

```ts
export function fitFigures(w: WhatIfView): string;
// "12 completed, 6 planned of 24. 6 units to go." | "… of 24. Covered." when completed+planned >= required
export function fitSummary(w: WhatIfView): string;
// moves.length === 0: `None of your courses would count toward it yet, so all ${w.required} units are still to go.`
// every from null: `${n} of your courses would count here.`
// else: `${n} of your courses would move here, from ${joinAnd(uniqueFromLabels)}.`   ("A", "A and B", "A, B and C")
export function shortfallText(s: WhatIfView["shortfalls"][number]): string;
// `${label} would drop to ${completed + planned} of ${required}`
export function courseLineStatus(view: PlanView, code: string, spec: SpecialisationInfo, listGroupId: string, whatIf?: WhatIfView | null): string;
// the new optional 5th parameter, used only when the spec is unchosen and the course is placed:
// whatIf.countsToward[code] === listGroupId → ", would count"
// else ", wouldn't count here", plus `, over the ${unitsMax}-unit limit` when that list's entry in whatIf.lists
// has unitsMax !== null && completed + planned >= unitsMax
```

The block, placed first in the body when the spec is unchosen, in DOM
order:

1. `<section class="details-section spec-fit"><h3>Fit with your plan</h3>`.
2. **Loading with no data yet:** `<p class="details-loading">Working out how this would fit your plan…</p>`,
   in a `div.spec-fit-status` with `min-height: 7rem`.
3. **Error with no data:** `<p>Couldn't work out how this fits your plan.</p>`
   plus `<button type="button" onClick={retry}>Try again</button>`.
4. **With data:**
   - `<ProgressBar label="If you chose this" completed planned required family="specialisation" />`
   - `<p>{fitFigures}</p>` (left out when there are no moves: the zero
     sentence already says it)
   - `<p>{fitSummary}</p>`
   - one `<p class="details-warning">{shortfallText}.</p>` per shortfall
5. **The button** (not read-only), always rendered here, whatever the
   what-if status:
   - Nothing chosen: `<button type="button" class="details-choose">Choose this specialisation</button>`.
   - Another spec chosen: `<button type="button">Switch to this specialisation</button>`.
   - It is `disabled` while its own action is pending, and calls
     `onAction({ kind: "choice", groupId: SPEC_CHOICE_GROUP, childId: spec.groupId })`.
6. **With moves:** `<h4>Your courses that would count</h4><ul class="requisite-tree spec-courses">`.
   Each line is the course-line markup, with `where` =
   `${word} ${termLabel}` (from `placedStatus`), then
   `<span class="spec-move">`: a from dot plus the from label (or "not
   counting toward anything now"), the chevron
   `<svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>`,
   then a to dot plus the to shortLabel (from `spec.lists`), and a
   visually-hidden "moves from X to Y" for screen readers.
7. **With leaving entries:** `<h4>Would stop counting toward {currentSpec.label}</h4>`,
   with lines whose `where` is `now counts toward ${to.label}` or `wouldn't
   count toward anything`.

Requirements course lines pass `whatIf.data` to `courseLineStatus` when the
spec is unchosen.

Once the choice lands, the new `PlanView` makes the spec chosen, so the
block becomes "In your plan" (Phase 02's), with no extra wiring.

**CSS:**

- `.details-choose` joins the gold selector list at lines 311-322 (both the
  base rule and the hover), with `min-height: 2.75rem`.
- `.spec-move`: flex, gap 0.3rem, 0.8rem, `var(--muted)`, and its own line.
- `.spec-fit-status`: min-height 7rem.

### 4.4 The toast (Task 8)

In `historyStep`'s `choice` case:

```ts
const group = groupPath(view, action.groupId).at(-1);
const labelOf = (id: string | null) => group?.options.find((o) => o.id === id)?.label ?? id;
const current = currentChoice(view, action.groupId);
const message =
  current !== null && action.childId !== null
    ? `Switched ${groupLabel(view, action.groupId)} from ${labelOf(current)} to ${labelOf(action.childId)}`
    : `Chose ${labelOf(action.childId)} for ${groupLabel(view, action.groupId)}`;
```

The undo list is unchanged. It applies to the radio and the panel alike.

## 5. Task breakdown

### Task 6: `whatIfChoice` domain function, service and GET endpoint

- [x] **Description.** Add this file's §4.1 and the service and route of
  §4.2 (the overview §4.3 contract).
- **Files touched:**
  - `src/lib/domain/what-if.ts` (new)
  - `src/lib/domain/what-if.test.ts` (new)
  - `src/lib/plan-service.ts`
  - `src/pages/api/plans/[id]/what-if.ts` (new)
  - `spec/layout/specialisation-details.test.ts`: a describe for the
    endpoint, which needs no browser page (plain `fetch` against
    `baseUrl`)
- **Tests first (red):**
  - `what-if.test.ts` uses the real catalogue (copy `loadRealCatalogue`
    from `src/components/planner-logic.test.ts:44-58`) and `AACOM_2027`:
    1. **Empty plan, option `"arin"`:** zeros, `required` 24, empty
       `moves`, `leaving` and `shortfalls`. `lists` has ids
       `["arin-a","arin-b"]`.
    2. **Placed COMP3620 (term 4), COMP3670 (term 4) and COMP4620 (term 6),
       nothing chosen, option `"arin"`.** *Probed against the real
       allocator on 2026-09-30:* before the swap all three count toward
       `comp-upper`; after it, COMP3620 and COMP3670 count toward `arin-a`
       and COMP4620 toward `arin-b`. So:
       - `moves` is exactly those three, sorted, each with
         `from.id === "comp-upper"` and those `to.id`s.
       - `completed + planned === 18`.
       - `lists` gives `arin-a` 12 and `arin-b` 6.
       - `shortfalls` is exactly `[{ groupId: "comp-upper", label:
         "3000/4000-level COMP", completed: 0, planned: 0, required: 18 }]`.
       - `leaving` is `[]`.
    3. **Placed COMP3310 (term 4, on syar-a's list) with
       `choices: { spec: "syar" }`, option `"arin"`:** `leaving` contains
       COMP3310, with `from.id === "syar-a"` and `to` equal to the after
       view's `countsToward` for it (looked up in the test, not
       hard-coded).
    4. **Consistency, for case 2:** the set of `shortfalls` ids equals the
       leaves satisfied in one `buildPlanView` and unsatisfied in the
       swapped one, computed independently in the test.
    5. **Purity:** the input `plan.choices` is unchanged afterwards.
  - Endpoint (spec project), against a plan from
    `planWithPlacement("COMP3670", 5)`:
    - `?group=spec&option=arin` gives 200 with `optionId` "arin".
    - `option=nope` gives 400.
    - `group=electives` gives 400.
    - A missing `option` gives 400.
    - An unknown plan gives 404.
    - `/api/plans/example/what-if?group=spec&option=syar` gives 200 (it's
      read-only, and reading is allowed).
- **Implementation (green).** Per this file's §4.1–4.2.
- **Refactor.** None.
- **Acceptance criteria:**
  - `pnpm test:unit` passes.
  - The endpoint tests pass.
  - No `PlanView` field is added (N3). `git diff src/lib/domain/view.ts` is
    empty.
  - `pnpm check` is green.
- **Depends on:** none in this phase (Phase 01's data isn't needed).

### Task 7: `fetchWhatIf` and the `useWhatIf` hook

- [x] **Description.** Add the client function and hook of this file's
  §4.2, and mount the hook in `SpecialisationDetailsPanel` with
  `optionId = chosen ? null : spec.groupId`. Render only the loading and
  error shells for now, so the tests can see them.
- **Files touched:**
  - `src/components/api.ts`
  - `src/components/use-what-if.ts` (new)
  - `src/components/SpecialisationDetailsPanel.tsx`
  - `spec/layout/specialisation-details.test.ts`
- **Tests first (red),** at 1920, on `/plan/example?spec=SYAR-SPEC`
  (unchosen, read-only):
  1. With `page.route("**/what-if*", …)` delaying 1s: "Working out how this
     would fit your plan…" shows, and then goes once the response lands.
  2. With the route fulfilling 500: "Couldn't work out how this fits your
     plan." and a "Try again" button. After un-routing, selecting Try again
     shows no error.
  3. **Refetch on a plan change:**
     - Take a plan from `planWithPlacement("COMP3670", 5)`, and open
       `/plan/{id}?spec=ARIN-SPEC` (unchosen).
     - Count `what-if` requests with `page.on("request")`, and wait for the
       first to finish.
     - Change the plan in the page without closing the panel: select
       `button.completed-toggle`, then `.completed-panel`'s "S2 2027"
       button (as `spec/layout/undo.test.ts` does).
     - The count reaches 2. Task 8 has no move rows yet at this point, so
       this test asserts only the request.
     - *Amended during execution, 2026-09-30:* the count asserted is "one
       more than once the load settles", not a literal 2. Planner moves the
       panel into the panes grid once it has measured itself
       (`detailsInPanes`), which remounts it, so a fresh load already asks
       twice (the first answer is dropped as stale). A literal 2 would pass
       with no refetch at all; checked by removing `view` from the hook's
       deps, which fails the amended test.
  4. On `?spec=ARIN-SPEC` (chosen), no what-if request is made.
- **Implementation (green).** Per this file's §4.2.
- **Refactor.** None.
- **Acceptance criteria:**
  - The tests pass.
  - `pnpm check` is green.
- **Depends on:** Task 6.

### Task 8: The Fit block, Choose/Switch, line suffixes and the switch toast

- [ ] **Description.** Render this file's §4.3 in full, add the helpers to
  `spec-logic.ts`, and change the toast per §4.4.
- **Files touched:**
  - `src/components/spec-logic.ts`
  - `src/components/spec-logic.test.ts`
  - `src/components/SpecialisationDetailsPanel.tsx`
  - `src/components/plan-actions.ts`
  - `src/components/plan-actions.test.ts`
  - `src/styles.css`
  - `spec/layout/specialisation-details.test.ts`
- **Tests first (red):**
  - `spec-logic.test.ts`, with hand-built `WhatIfView` literals:
    1. `fitFigures` for 12/6/24 gives "12 completed, 6 planned of 24. 6
       units to go.", and for 18/6/24 gives "18 completed, 6 planned of 24.
       Covered."
    2. `fitSummary`:
       - With no moves, the zero sentence with 24.
       - Two moves both from null: "2 of your courses would count here."
       - Three moves from Electives, Electives and "Systems & Architecture
         — foundations (max 12)": "3 of your courses would move here, from
         Electives and Systems & Architecture — foundations (max 12)."
    3. `shortfallText`: "Electives would drop to 36 of 48".
    4. `courseLineStatus` with a `whatIf`:
       - The course counting toward the list gives "…, would count".
       - It counting elsewhere with that list at its max gives "…,
         wouldn't count here, over the 12-unit limit".
       - Without the cap full, it gives "…, wouldn't count here".
  - `plan-actions.test.ts`:
    - Update "undoes a choice…" to expect
      `` `Switched Specialisation from Artificial Intelligence to ${otherSpec.label}` ``.
      Its view already has "arin"; the undo list is unchanged.
    - Add "a first choice says Chose": from `choices: {}`, it gives
      `` `Chose ${label} for Specialisation` ``.
  - Browser, 1920:
    1. **Read-only unchosen,** `/plan/example?spec=SYAR-SPEC`:
       - A progressbar named "If you chose this" is present.
       - There's no "Choose" or "Switch" button.
       - The text matches `/would (move|count) here|None of your courses/`.
       - axe is `[]`.
    2. **Editable, nothing chosen:** a plan from
       `planWithPlacement("COMP3670", 5)`, open `?spec=ARIN-SPEC`.
       - "Choose this specialisation" has the class `details-choose`.
       - The "Your courses that would count" list contains COMP3670, and a
         `.spec-move`.
       - Select Choose. The toast contains "Chose Artificial Intelligence
         for Specialisation.", the pill becomes "Chosen", the "In your
         plan" h3 appears, and "Fit with your plan" goes.
    3. **Switch:** in the same plan, now open `?spec=HCCC-SPEC`.
       - The button reads "Switch to this specialisation" (no
         `details-choose`).
       - A "Would stop counting toward Artificial Intelligence" h4 lists
         COMP3670.
       - Select Switch. The toast contains "Switched Specialisation from
         Artificial Intelligence to Human-Centred & Creative Computing.".
         Undo from the toast brings back the "Chosen" state on ARIN's
         radio (`input[type=radio]:checked` is ARIN's).
    4. **Line suffix:** on `?spec=ARIN-SPEC` (unchosen, before step 2's
       Choose), the COMP3670 line's `.requisite-where` contains "would
       count".
    5. **Radio switch path:** in a plan with `arin` chosen, clicking the
       HCCC radio gives a toast containing "Switched Specialisation from".
- **Implementation (green).** Per this file's §4.3–4.4.
- **Refactor.** Make the Choose/Switch button a small local component if
  the pending state clutters the panel.
- **Acceptance criteria:**
  - All the tests above pass.
  - `spec/layout/undo.test.ts` passes unchanged.
  - `pnpm check` is green.
- **Human review.** The user opens, at 1920×1080 and 390×844:
  - `/plan/example?spec=SYAR-SPEC` (read-only unchosen)
  - a fresh plan with a few AI and systems courses placed:
    - its `?spec=ARIN-SPEC`, before choosing (gold Choose)
    - after choosing ARIN, `?spec=SYAR-SPEC` (Switch, stop-counting list,
      shortfalls if any)

  A pass means:
  - The move rows ("● from › ● to") read clearly.
  - The summary and shortfall sentences are plain and correct.
  - The button is above the fold at the sheet's half height.
  - Loading and error don't make the layout jump.

  The task isn't done until the user says so explicitly.
- **Depends on:** Task 7.

## 6. Phase Definition of Done

- [ ] Tasks 6–8 are complete and their tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] The what-if endpoint follows overview §4.3
- [ ] Choosing and switching from the panel toast correctly and undo
- [ ] Task 8's human review is explicitly accepted by the user
- [ ] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| SD16 | Task 6 (data), Task 8 (render) |
| SD17 | Task 8 |
| SD18 | Task 7 (loading, error, retry, refetch, stale), Task 8 (button independent of status) |
| SD19 (unchosen suffixes) | Task 8 |
| N1 (Fit block) | Task 8 |
| N3 | Task 6 |

## 8. Risks / open questions

None.
