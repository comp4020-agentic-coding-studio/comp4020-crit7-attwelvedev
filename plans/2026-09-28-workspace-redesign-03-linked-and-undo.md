# Workspace redesign — Phase 03: linked highlighting, unified undo, knock-on warnings

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read §2.4
  (moves had no undo), §3 and §4.2 (`PlanAction`, `UndoEntry`).
- **Depends on phases:** 02.

## 1. Summary

While a course is open in the details sidebar:
- its requirement group is tinted and tagged
- groups it could count toward are tagged
- timeline cards show "Prerequisite of X" / "Needs X" chips
- the open course's card has a gold ring

Every move, place and remove now goes through one `runAction` path in
`Planner`, whether it came from a drag, a menu, a suggestion, the strip,
"Place in…" or the panel. Each one offers Undo with matching wording. When a
change breaks another planned course's prerequisites, the toast says so.

## 2. Requirements (this phase)

### 2.1 Functional

- WR16, WR17, WR19: all.
- WR18: the gold ring. `aria-current` was done in Phase 02.
- WR46, WR47: all.

### 2.2 Non-functional

- The card-height budget (`spec/layout.test.ts` "card height budget") still
  passes. It's measured with no course open, so chips don't count.
- axe is clean with a course open and chips showing.

### 2.3 Out of scope for this phase

- The palette (Phase 04), styling finish (Phase 05), and resizing
  (Phase 06).
- The "Show prerequisite links" overlay is unchanged (WR19).

### 2.4 Assumptions

See overview §2.4.

Phase-specific:
- `upsertPlacement` keeps a course's pin on a move (`repo.ts:232-240`
  updates only `termIndex`), so undoing a move is a move back.
- Undoing a remove re-places the course and restores its pin, as
  `handleUndo` does today.
- Undoing a place removes the course.

## 3. Existing code context (verified 2026-09-28)

**`src/components/Planner.tsx`**
- `UNDO_TIMEOUT_MS = 8000`.
- `handleRemoved(info: RemovedPlacement)` sets `removed` and starts the
  timer.
- `performPlace(term, code)` checks `dropTargets(view, code,
  searchBlocked[code])`, then calls `placeCourse`.
- `performRemove(code)` builds `RemovedPlacement {code, term,
  pinnedGroupId, label: "${code} — ${title}"}`.
- `handleUndo()` calls `placeCourse`, then `setPin` if the course was
  pinned, and announces "Restored {label}".
- The toast markup is `div.undo-toast[role=status]`, with a `span`
  "Removed {label}." and the button "Undo" / "Restoring…". While stacked and
  collapsed it adds `undo-toast-above-bar`.

**API calls made directly from components today** (they must move to
`runAction`):
- `CourseCard.tsx`: `move(term)`, `applySuggestion(code, term)` and
  `remove()`. Each calls `placeCourse` or `removeCourse` and
  `onChanged`/`onRemoved`.
- `AvailableCourseCard.tsx`: `place(term)`.
- `Timeline.tsx`: `handleDrop(term, code)`.
- `Planner.performPlace` / `performRemove`: touch drop, sidebar drop, and
  the panel's strip and Remove (Phase 02).

**Types**
- `RemovedPlacement` is exported from `CourseCard.tsx`, and `Timeline`
  imports it for its `onRemoved` prop.
- `PlacementView.state` is one of `"hard" | "soft" | "check" |
  "available"`, where soft means "Needs prerequisites".
- `ReqExpr` course leaf: `{ kind: "course"; code: string; concurrent:
  boolean }`.

**Existing toast tests**
- `spec/layout.test.ts:982` and :2961 expect the text to contain
  "Removed COMP1130" (re-verified 2026-09-29; were :954 and :2896).
- "undo toast placement" is at :1333.

**Sidebar**
- A nested group is `li[data-group={id}]`, and a top-level group is a
  `SidebarSection`, both in `Sidebar.tsx`'s `Group`.

**Timeline card**
- `li.course-card[data-placed]`, which already has a `receded` class hook.

### Interfaces from earlier phases (exact)

From Phase 02, Tasks 4–7:

```ts
// src/components/details-state.ts
export type DetailsFocus = "top" | "requisites";
export interface DetailsState { code: string | null; history: string[]; index: number; focus: DetailsFocus; token: number }
// src/components/planner-logic.ts
export function prereqCodes(expr: ReqExpr | null): string[];
export function dependentsOf(view: PlanView, code: string): string[];
export interface StripCell {
  term: number; label: string; year: number; session: "S1" | "S2";
  state: "here" | "part2" | "offered" | "projected" | "not-offered" | "needs-prereqs" | "cant-start" | "unknown";
  units: number; allowed: boolean; reason: string | null; actionLabel: string;
}
export function stripCells(view: PlanView, code: string, card: CourseCard): StripCell[];
// Planner state: `details: DetailsState`, `knownCards: Record<string, CourseCard>`,
// `openDetails(code: string, focus?: DetailsFocus): void`
// CourseDetailsPanel props include `onPlace: (term: number) => void; onRemove: () => void`
// Card components take `onOpenDetails: (code: string, focus?: DetailsFocus) => void`
// Timeline and Sidebar take `openCode: string | null` (Task 7)
```

## 4. Approach

**Linked highlights.**
- One pure function computes everything from the view and the open code.
- `Planner` passes the result to `Sidebar` (groups) and `Timeline` (cards).
- The chips are rendered only while a course is open. They reuse the
  `.badge` styles.

**Plan actions.**
- `plan-actions.ts` is pure: it builds actions, undo entries and messages.
- `Planner.runAction` is the only caller of `placeCourse` and
  `removeCourse`.
- Components get one prop, `onAction: (action: PlanAction) => void`.
- The toast becomes `undo: { entry: UndoEntry; knockOn: string } | null`.

## 5. Task breakdown

### Task 8: Linked highlights: group tint and tags, card chips, gold ring

- [x] **Description:** WR16–WR19 (the ring part of WR18).
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `Planner.tsx`, `Sidebar.tsx`, `Timeline.tsx`, `CourseCard.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
  - `SidebarSection.tsx` (a top-level group's element; added in execution)
- **Tests first (red):**
  - `planner-logic.test.ts`, `linkedHighlights(view, "COMP2100")` on the
    example view:
    - `home` is COMP2100's `countsToward`
    - `could` equals `card.eligibleGroups` without `home`
    - `needs` contains "COMP2120"
    - `prereqOf["COMP1140"]` is "ok"
  - In a view where a prerequisite is placed in the same term without
    `concurrent`, or in a later term, it's "late". With `concurrent` in the
    same term, it's "ok".
  - `linkedHighlights(view, null)` returns `null`.
  - `spec/layout.test.ts`, `describe("linked highlighting")`, after opening
    COMP2100:
    - Its home group element (`[data-group=<home>]` or the top-level
      section) has the class `group-linked` and the text "COMP2100 counts
      here".
    - The card for COMP1140 contains "Prerequisite of COMP2100".
    - COMP2120's card contains "Needs COMP2100".
    - COMP2100's card has the class `course-card-selected`.
    - After closing, none of these classes or texts remain.
    - The prerequisite-links toggle still draws its overlay while a course
      is open (WR19).
- **Implementation (green):**

  ```ts
  export interface LinkedHighlights {
    code: string;
    home: string | null;
    could: string[];
    prereqOf: Record<string, "ok" | "late">;
    needs: string[];
  }
  export function linkedHighlights(view: PlanView, code: string | null, card?: CourseCard): LinkedHighlights | null;
  ```

  - `card` defaults to `view.courses[code]`. When neither exists, the result
    is `null`.
  - `Planner` computes
    `linkedHighlights(view, details.code, knownCards[details.code])` and
    passes `linked` to `Sidebar` and `Timeline`.
  - `Group` adds `group-linked` plus a `span.group-tag` "<CODE> counts here"
    when `id === linked.home`. It adds only the tag, "<CODE> could count
    here", when `linked.could.includes(id)`.
  - `CourseCard` takes `linked: LinkedHighlights | null` and renders
    `p.badge.badge-linked`:
    - "Prerequisite of <CODE>" when `prereqOf[code]` is "ok"
    - "Prerequisite, planned too late" when it's "late"
    - "Needs <CODE>" when `needs` includes the card's code
  - It adds `course-card-selected` when `linked.code === placement.code`.
  - CSS gives `.course-card-selected` a 2px `--gold` ring
    (`box-shadow: 0 0 0 2px var(--gold)`) and tints `.group-linked` with
    `color-mix(in srgb, var(--family) 6%, var(--surface))`.
  - Group elements don't carry `data-family`, so `--family` is unset on
    them. The linked (home) group element gets `data-family={group.family}`
    **only while it's linked**, so no existing `[data-family]` rule starts
    matching groups otherwise (ruling, 2026-09-29).
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - The card-height budget suite passes unchanged.
- **Depends on:** Phase 02.

### Task 9: One `runAction` path for place, move and remove, with undo for all three

- [x] **Description:** WR46. Centralise every plan change and generalise the
  undo toast.
- **Files touched:**
  - new `src/components/plan-actions.ts`
  - new `src/components/plan-actions.test.ts`
  - `Planner.tsx`, `CourseCard.tsx`, `AvailableCourseCard.tsx`,
    `Timeline.tsx`, `Sidebar.tsx`, `CourseDetailsPanel.tsx`, and
    whichever search component exists: `CourseSearch.tsx`, or
    `SearchPalette.tsx` if Phase 04 landed first
  - `spec/layout.test.ts`
- **Tests first (red):** in `plan-actions.test.ts`, on the example view:
  - `actionFor(view, "COMP2100", 3)` is `{kind:"move", code:"COMP2100",
    term:3}`.
  - `actionFor(view, "COMP4680", 4)` is `{kind:"place", …}` (not placed).
  - `undoEntry(view, {kind:"move", code:"COMP2100", term:3})`:
    - `undo` is `{kind:"move", code:"COMP2100", term:2}`
    - `restorePin` is null
    - `message` is "Moved COMP2100 to S2 2028"
  - `undoEntry(view, {kind:"place", code:"COMP4680", term:4})`: `undo` is
    `{kind:"remove", code:"COMP4680"}` and `message` is "Placed COMP4680 in
    S1 2029".
  - `undoEntry` for removing a pinned course: `undo` is a place back into
    its term, `restorePin` is its `countsToward`, and `message` is "Removed
    COMP2100 — Software Construction".
  - `spec/layout.test.ts`, `describe("undo for every plan change")`, on an
    editable plan:
    - Moving a card with its menu shows a toast containing "Moved"; Undo
      restores its term.
    - Place in… shows "Placed"; Undo removes it.
    - A drop onto the requirements shows "Removed"; Undo restores it. The
      existing ":954" and ":2896" assertions stay green.
    - The panel strip's move shows "Moved".
- **Implementation (green):**
  - `plan-actions.ts` exports `PlanAction` and `UndoEntry` (overview §4.2)
    and:

    ```ts
    export function actionFor(view: PlanView, code: string, term: number): PlanAction;
    export function undoEntry(view: PlanView, action: PlanAction): UndoEntry;
    ```

  - `Planner`: `async function runAction(action: PlanAction): Promise<void>`.
    1. For place and move, check refusal through `dropTargets(view, code,
       knownCards[code]?.hardBlocked ?? searchBlocked[code])` and announce
       the reason.
    2. Build `entry = undoEntry(view, action)` from the pre-change view.
    3. Call `placeCourse` or `removeCourse`, then `setView`.
    4. Show the toast `{ entry }`, with `UNDO_TIMEOUT_MS`.
  - `handleUndo` runs `entry.undo` through the API. If `restorePin` is set it
    calls `setPin`. It announces "Undone: <message>". It shows no new undo
    toast.
  - Replace `performPlace`/`performRemove` with calls to `runAction`
    (touch-drop wiring and the Sidebar `onDropRemove`).
  - Components:
    - `CourseCard`: drop the `move`, `applySuggestion` and `remove`
      functions; call `onAction(...)` instead. Keep the local `pending`
      flag by awaiting the promise that `onAction` returns: `onAction:
      (action: PlanAction) => Promise<void>`.
    - `AvailableCourseCard.place`, `Timeline.handleDrop`, and the panel's
      `onPlace`/`onRemove` do the same.
  - Remove `RemovedPlacement`, the `onRemoved` props and `handleRemoved`.
  - The toast text is `{entry.message}.`
  - As executed (2026-09-29): `CourseDetailsPanel.tsx` needed no change;
    Planner passes it `(term) => void runAction(actionFor(…))`. The Undo
    button's pending text is "Undoing…" (was "Restoring…"), since it now
    also undoes moves and places. `planId` and `onAnnounce` went from the
    components that only used them for place, move or remove, like
    `onChanged`. The "drop onto the requirements" case is the existing
    rail/sidebar drop test (:982), not a new one.
- **Refactor:**
  - Delete the now-unused `onChanged` props wherever a component only
    passed it along for place, move or remove. Keep it where `setChoice`,
    `setPin` or `setCheck` still use it.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - `grep -rn "placeCourse\|removeCourse" src/components --include=*.tsx`
    finds only `Planner.tsx`.
- **Depends on:** Task 8 (touches the same props, so sequenced after it).

### Task 10: Knock-on warning in the undo toast

- [x] **Description:** WR47.
- **Files touched:**
  - `src/components/plan-actions.ts`
  - `src/components/plan-actions.test.ts`
  - `Planner.tsx`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - `plan-actions.test.ts`, `newlyBroken(before, after, actedOn)`: given two
    views built with `buildPlanView`, where moving COMP2100 later than
    COMP2120 turns COMP2120 from "available"/"check" into "soft", the
    result is `["COMP2120"]`.
    - It excludes `actedOn`.
    - It ignores courses that were already "soft" or "hard".
  - `knockOnText(["COMP2120"])` is " COMP2120 now misses a prerequisite."
  - `knockOnText(["COMP2120", "COMP4528", "COMP3320"])` is " 3 courses now
    miss a prerequisite, including COMP2120."
  - `knockOnText([])` is "".
  - `spec/layout.test.ts`: on an editable plan with COMP2100 in term 2 and
    COMP2120 in term 3, move COMP2100 to term 4. The toast contains
    "COMP2120 now misses a prerequisite".
- **Implementation (green):**

  ```ts
  export function newlyBroken(before: PlanView, after: PlanView, actedOn: string): string[];
  export function knockOnText(codes: string[]): string;
  ```

  `runAction` appends `knockOnText(newlyBroken(view, result, action.code))`
  to the toast message. The `role=status` toast is the live announcement;
  there is no separate `setAnnouncement`, so it isn't heard twice (ruling,
  2026-09-29).
- **Refactor:** None expected.
- **Acceptance criteria:** `pnpm check` passes.
- **Added in execution (ruling, 2026-09-29):** at 390×844 the details
  panel (z-index 40) covered the toast (10), hiding Undo and the warning
  for any change made from the panel. The toast now sits at 45. Its text
  also wrapped to half the screen or was truncated by an ellipsis, which
  cut off the warning, so it now wraps at `max-content` width. The spec
  "shows over the details panel on a phone" checks all three.
- **Depends on:** Task 9.

## 6. Phase Definition of Done

- [ ] Tasks 8–10 complete, with tests passing
- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] Opening COMP2100 shows its tinted group and chips, and moving it
  offers Undo with the knock-on text
- [ ] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR16, WR17, WR19 | Task 8 |
| WR18 (ring) | Task 8 |
| WR46 | Task 9 |
| WR47 | Task 10 |

## 8. Risks / open questions

None.
