# Collapsible panels — Phase 03: Collapsible requirements sidebar

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-collapsible-panels-00-overview.md`. Read
  these sections first:
  - §2 (FR10–15, FR13, FR25)
  - §3
  - §4.1 (DOM)
  - §4.2 (keys and the head script)
  - §4.3 (`panel-state.ts`)
  - §4.4 (tokens, and **cascade order**)
  - §4.5
- **Depends on phases:** 01 and 02.

## 1. Summary

This phase:

- Moves the sidebar's collapsed/columns state into `Planner`, backed by
  `panel-state.ts`.
- Adds a "Hide requirements" button, and a 3rem rail (vertical label +
  program progress) that brings the sidebar back.
- Adds the `panel-reqs` head-script line, so the collapsed state paints
  immediately.
- Makes the rail signal that it's a drop target while a placed course is
  being dragged.

When it ends, the sidebar collapses and expands in the side-by-side layout,
persists across reloads with no flash, still accepts a course dropped on it
to remove it, and nothing changes in the stacked layout.

## 2. Requirements (this phase)

### 2.1 Functional

- FR10, FR11, FR12, FR13, FR14 and FR15 in full.
- FR25: the `panel-reqs` line.
- FR1: re-asserted while collapsed.

### 2.2 Non-functional

- Focus moves between the hide button and the rail.
- The rail is at least 44px tall and 48px wide.
- In-browser axe is clean while collapsed.
- Invariants stay green.

### 2.3 Out of scope for this phase

- The resize handle, the `panel-reqs-cols` head line and the
  preference-cap CSS (all Phase 05, formerly 04).
- `ReqsState.columns` is carried and saved here but has no visual effect
  until Task 8.

### 2.4 Assumptions

See overview §2.4. Phase-specific assumption: static `aria-expanded` is
always truthful. The hide button is only visible while expanded (`true`),
and the rail only while collapsed (`false`). So the server render and
hydration never disagree.

## 3. Existing code context (verified 2026-09-27)

**`src/components/Sidebar.tsx`: Props (`:10-20`)**

```ts
interface Props {
  view: PlanView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string) => void;
}
```

**`src/components/Sidebar.tsx`: start of the return (`:247-262`)**

```tsx
<aside
  aria-label="requirements"
  onDragOver={(event) => event.preventDefault()}
  onDrop={async (event) => {
    event.preventDefault();
    onDragEnd?.();
    if (readOnly) return;
    const code = event.dataTransfer?.getData("text/plain");
    if (!code || !view.placements.some((p) => p.code === code)) return;
    const result = await removeCourse(planId, code);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }}
>
  <ul class="requirements-scroll">
```

The whole aside is the drop zone, so a rail rendered inside it inherits the
drop. Touch dragging resolves drops with
`el?.closest("aside[aria-label='requirements']")` in
`src/components/touch-drag.ts:48,58`, so the rail works there too.

The **Total** section already renders the program bar from `view.total`:

```tsx
<ProgressBar label="Total" completed={view.total.completed} planned={view.total.planned} required={view.total.required} />
```

`view.total` is typed `{ required: number; completed: number; planned:
number }` (`src/lib/domain/view.ts:91`).

**`src/components/planner-logic.ts:30`**

```ts
export function progressSegments(completed: number, planned: number, required: number): ProgressSegments
```

It returns `{ completedPct, plannedPct }`, as used by `ProgressBar.tsx`.

**`src/components/Planner.tsx`**

- It imports `useRef, useState` from `preact/hooks` (`:1`). Add
  `useEffect`.
- `const [draggingCode, setDraggingCode] = useState<string | null>(null);`
  (`:22`). It's set by both sidebar and timeline drags, and cleared on drag
  end.
- Sidebar is rendered inside `.planner-panes` (Task 2, overview §4.1).

**CSS**

- `aside.drag-hover-target { box-shadow: inset 0 0 0 2px var(--gold); }`
  (`src/styles.css`, "Touch drag-and-drop" section) is the touch hover.
- The `--gold`, `--gold-tint`, `--line`, `--moss` and `--surface` tokens
  exist in `:root`.
- `.progress-bar-completed` and `.progress-bar-planned` show the segment
  colours to reuse. Grep them in `styles.css`.

**Server-render fact:** `CourseCard.tsx:101-113`. A placed card is one
element with `data-placed={code}`, `draggable={!readOnly}` and
`data-drag-code`. Its `onDragStart` sets the `text/plain` drag data that the
aside's `onDrop` reads.

### Interfaces from earlier phases (exact)

**From Task 1, `spec/browser.ts`**

```ts
export function launch(): Promise<Browser>;
export function openPage(browser: Browser, url: string, viewport: Viewport, options?: OpenOptions): Promise<Page>;
export function horizontalOverflow(page: Page): Promise<number>;
export function axeViolations(page: Page): Promise<string[]>;
```

`OpenOptions` is `{ storage?: Record<string, string>; blockScripts?:
boolean }`.

**From Task 2**

- The DOM is `.planner > .planner-layout > .planner-panes >
  [.planner-timeline-area, aside]`.
- The `@container planner` blocks are at 49.5rem, 63.1rem and 76.7rem.
- `.planner-panes > aside` gets `width` and `flex-basis` from
  `var(--reqs-w-N)`.
- The `--reqs-w-rail: 3rem` token exists.

**From Task 3, `src/components/panel-state.ts`**

```ts
export const REQS_KEY = "panel-reqs";
export type ReqsColumns = 1 | 2 | 3;
export interface ReqsState { collapsed: boolean; columns: ReqsColumns; }
export const DEFAULT_REQS: ReqsState = { collapsed: false, columns: 3 };
export function reqsStateFromDataset(dataset: DOMStringMap): ReqsState;
export function applyReqsState(root: DatasetHost, state: ReqsState): void;
export function saveReqsState(state: ReqsState, storage?: StorageLike | null): void;
```

`panel-state.test.ts` has a drift guard asserting that `Base.astro`
contains `` `"${NAV_KEY}"` ``.

**From Task 4:** the `Base.astro` head has `<script is:inline>` containing
`try { var s = localStorage, h = document.documentElement; if
(s.getItem("panel-nav") === "hidden") h.dataset.nav = "hidden"; } catch (e)
{}`.

## 4. Approach

**The state lives in `Planner`,** not `Sidebar`, because the Phase 05 handle
(a sibling of the aside) drives it too:

```ts
const [reqs, setReqs] = useState<ReqsState>(DEFAULT_REQS);
// The <head> script already painted the stored state; this just brings
// Preact's copy in line after hydration (server render + first client
// render stay equal, as with Sidebar's compaction state).
useEffect(() => setReqs(reqsStateFromDataset(document.documentElement.dataset)), []);
function updateReqs(next: ReqsState, commit: boolean) {
  setReqs(next);
  applyReqsState(document.documentElement, next);
  if (commit) saveReqsState(next);
}
```

Visibility is pure CSS keyed off `data-reqs`, so an attribute change repaints
synchronously and focus can move straight away.

**The rail sits inside the aside,** so native and touch removal keep
working with no new drop code. The only addition is the drop-ready
highlight, driven by `draggingCode`.

**CSS:** the collapsed rules go in a **separate `@container planner
(min-width: 49.5rem)` block, last in the planner section** (overview §4.4
cascade order).

## 5. Task breakdown

### Task 5: Collapse the sidebar to a progress rail, applied before first paint

- [x] **Description:** Planner-owned `ReqsState`, the hide button, the rail,
  the head-script line and the CSS.
- **Files touched:**
  - `src/components/Planner.tsx`
  - `src/components/Sidebar.tsx`
  - `src/layouts/Base.astro`
  - `src/styles.css`
  - `src/components/panel-state.test.ts`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit drift guard:** extend the Task 3 drift test so `Base.astro` must
    also contain `` `"${REQS_KEY}"` ``.
  - **Layout tests** in `spec/layout.test.ts`, on `/plan/example`:
    1. **Hide, focus, persist.** At 1920×1080:
       - Click `button.reqs-hide`.
       - `.reqs-rail` is visible and focused, and `.requirements-scroll` is
         not visible.
       - The aside's `offsetWidth` is 48.
       - `.planner-timeline-area`'s `offsetWidth` grew by at least 600
         versus before.
       - `horizontalOverflow` is 0.
       - `localStorage["panel-reqs"] === "collapsed"`.
       - `reload()`: still collapsed.
       - Click `.reqs-rail`. The aside's `offsetWidth` is 715, focus is on
         `.reqs-hide`, and the key is `null`.
    2. **No flash.** At 1920×1080 with `{ storage: { "panel-reqs":
       "collapsed" }, blockScripts: true }`: the aside's `offsetWidth` is 48
       and `.reqs-rail` is visible.
    3. **Ignored when stacked.** The same seeding at 390×844 and at 800×800:
       `.requirements-scroll` is visible, and neither `.reqs-rail` nor
       `.reqs-hide` is visible.
    4. **Works on a 1-column tablet layout.** At 900×800, clicking
       `.reqs-hide` gives an aside `offsetWidth` of 48.
    5. **The rail's name.** At 1920 collapsed, `page.getByRole("button", {
       name: /^Show requirements: \d+ completed, \d+ planned of 192$/ })`
       has count 1.
    6. **Axe.** At 1920 collapsed (seeded), `axeViolations` equals `[]`.
- **Implementation (green):**
  - **`Planner.tsx`:**
    - Add the §4 state block and imports from `./panel-state`.
    - Pass `onHide={() => updateReqs({ ...reqs, collapsed: true }, true)}`
      and `onShow={() => updateReqs({ ...reqs, collapsed: false }, true)}`
      to `<Sidebar>`.
  - **`Sidebar.tsx` Props:** add these, with a one-line comment each:
    ```ts
    onHide: () => void;
    onShow: () => void;
    // True while a *placed* course is being dragged — the only drag the
    // sidebar accepts (dropping it here removes it from the plan).
    dropReady: boolean;
    ```
    `dropReady` is wired in Task 6. For this task, add the prop and have
    Planner pass `dropReady={false}`.
  - **The `<aside>`:**
    - Add `id="requirements"`.
    - Before `<ul class="requirements-scroll">`, add
      `<button type="button" class="reqs-hide" ref={hideRef}
      aria-controls="requirements-content" aria-expanded="true" onClick={() =>
      { onHide(); railRef.current?.focus(); }}>`. It contains a chevron-left
      SVG (`aria-hidden`, class `section-toggle-icon`) and the text "Hide
      requirements".
    - Then the rail button:
      ```tsx
      <button type="button" class="reqs-rail" ref={railRef} aria-controls="requirements-content" aria-expanded="false"
        onClick={() => { onShow(); hideRef.current?.focus(); }}>
        <span class="visually-hidden">Show requirements: {view.total.completed} completed, {view.total.planned} planned of {view.total.required}</span>
        <span class="reqs-rail-label" aria-hidden="true">Requirements</span>
        <span class="reqs-rail-bar" aria-hidden="true">
          <span class="reqs-rail-completed" style={{ height: `${completedPct}%` }} />
          <span class="reqs-rail-planned" style={{ height: `${plannedPct}%`, insetBlockEnd: `${completedPct}%` }} />
        </span>
      </button>
      ```
      `completedPct` and `plannedPct` come from `progressSegments(view.total.completed,
      view.total.planned, view.total.required)`.
    - `hideRef` and `railRef` are `useRef<HTMLButtonElement>(null)`.
    - Give `<ul class="requirements-scroll">` the id
      `requirements-content`.
    - The whole name sits in **one** visually-hidden span, and the visible
      label is `aria-hidden`. *(Amended during execution, 2026-09-27: the
      original split spans plus `text-transform: capitalize` computed as
      "Show requirements : …" in Chromium. The rail is `display: flex`, so
      each child span is blockified, and accessible-name computation puts
      a space at each block boundary. That failed test 5. The user chose
      this fix.)*
  - **`Base.astro` head script:** add `if (s.getItem("panel-reqs") ===
    "collapsed") h.dataset.reqs = "collapsed";` after the nav line.
  - **`styles.css`:**
    - **Base:** `.reqs-hide, .reqs-rail { display: none; }`
    - **`.reqs-rail`:**
      - Layout: `flex-direction: column; align-items: center; gap: 0.75rem;
        width: 100%; min-height: min(24rem, calc(100vh - 2rem)); padding:
        0.9rem 0`, with `background: var(--surface)`, the 1px `--line`
        border and a `0.9rem` radius.
      - `.reqs-rail-label`: `writing-mode: vertical-rl; transform:
        rotate(180deg); font-weight: 600; color: var(--ink)`.
      - `.reqs-rail-bar`: `position: relative; width: 0.5rem; flex: 1 1
        auto; min-height: 6rem; border-radius: 999px; background:
        var(--line); overflow: hidden`.
      - The two segments are `position: absolute; inset-inline: 0;
        inset-block-end: 0`, coloured like `.progress-bar-completed` and
        `.progress-bar-planned`.
    - **`.reqs-hide`:** `align-self: flex-end; position: sticky; top: 0;
      z-index: 1; margin-block-end: 0.5rem; min-height: 2.75rem`.
    - **New last block in the planner section,** `@container planner
      (min-width: 49.5rem)`:
      - `.reqs-hide { display: inline-flex; align-items: center; gap:
        0.35rem; }`
      - `:root[data-reqs="collapsed"] .planner-panes > aside { flex-basis:
        var(--reqs-w-rail); width: var(--reqs-w-rail); overflow: visible;
        scrollbar-gutter: auto; }`
      - `:root[data-reqs="collapsed"] .requirements-scroll,
        :root[data-reqs="collapsed"] .reqs-hide { display: none; }`
      - `:root[data-reqs="collapsed"] .reqs-rail { display: flex; }`
      - A leading comment that this block must stay last (overview §4.4).
    - The aside needs `display: flex; flex-direction: column` in the
      49.5rem tier block, so `.reqs-hide` can `align-self`. Add it to Task
      2's `.planner-panes > aside` rule.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests 1–6 and the unit drift guard pass.
  - `pnpm check` passes. The invariants' jsdom axe accepts the new buttons,
    whose names come from their text.
  - Render check at 1920×1080 (expanded and collapsed) and 390×844.
  - Commit: "Let the requirements sidebar collapse to a progress rail".
- **Human review:** screenshots at 1920×1080 and 1100×800 of the collapsed
  rail and of the expanded sidebar's "Hide requirements" button. A pass
  means:
  - The rail reads as "the requirements are tucked away here".
  - The vertical bar reads as progress.
  - The hide button is findable but quiet.

  The user accepts explicitly.
- **Depends on:** none in this phase (Phases 01–02 done).

### Task 6: Signal the rail as a drop target while a placed course is dragged

- [x] **Description:** wire `dropReady` and style it, then prove that native
  drag-to-remove works on the collapsed rail.
- **Files touched:**
  - `src/components/Planner.tsx`
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** add to `spec/layout.test.ts` a test "dragging a
  placed course onto the collapsed rail removes it":
  1. Create a plan: `fetch(new URL("/api/plans", baseUrl), { method:
     "POST", headers: { origin: baseUrl }, redirect: "manual" })`. The
     `location` header is `/plan/<id>`.
  2. `fetch(new URL(\`/api/plans/${id}/placements\`, baseUrl), { method:
     "POST", headers: { origin: baseUrl, "content-type": "application/json"
     }, body: JSON.stringify({ code: "COMP1130", term: 0 }) })`.
  3. `openPage` at 1920×1080 on `/plan/<id>` with `{ storage: {
     "panel-reqs": "collapsed" } }`.
  4. Drag: `hover()` the card `[data-placed="COMP1130"]`, then
     `page.mouse.down()`, then `page.mouse.move(railCentreX, railCentreY, {
     steps: 10 })`.
  5. Assert `aside.reqs-drop-ready` has count 1.
  6. `page.mouse.up()`.
  7. `await expect.poll(() => page.locator('[data-placed="COMP1130"]').count()).toBe(0)`.
  8. The class is gone: `aside.reqs-drop-ready` has count 0.
  9. A **second** case: while dragging an *unplaced* sidebar card at 1920
     expanded (`.course-card-unplaced` in the first group), `.reqs-drop-ready`
     has count 0.

  Step 5 fails (no class). Step 7 should already pass, which confirms the
  rail inherited the drop.
- **Implementation (green):**
  - **`Planner.tsx`:** `dropReady={draggingCode !== null &&
    view.placements.some((p) => p.code === draggingCode)}`.
  - **`Sidebar.tsx`:** `class={dropReady ? "reqs-drop-ready" : undefined}`
    on the `<aside>`.
  - **`styles.css`,** in the last collapsed block:
    `:root[data-reqs="collapsed"] .reqs-drop-ready .reqs-rail { outline: 2px
    dashed var(--gold); outline-offset: -4px; background: var(--gold-tint);
    }`, with a comment that the rail is otherwise easy to miss as a drop
    zone. The existing `aside.drag-hover-target` still covers touch hover.
- **Refactor:** none.
- **Acceptance criteria:**
  - The drag test passes.
  - `pnpm check` passes.
  - Render check done.
  - Commit: "Highlight the collapsed rail as a drop target while dragging a
    placed course".
- **Depends on:** Task 5.

## 6. Phase Definition of Done

- [x] Tasks 5–6 complete, with their tests passing
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] Two commits (Task 5, Task 6)
- [x] Task 5's human review accepted by the user
- [x] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR10 | Task 5, tests 1 and 4 |
| FR11 | Task 5, tests 1 and 5 |
| FR12 | Task 5, test 1 |
| FR13 | Task 6 |
| FR14 | Task 5, test 1 (timeline grows) |
| FR15 | Task 5, test 3 |
| FR25 (reqs) | Task 5, test 2 + drift guard |
| FR1 (collapsed) | Task 5, test 1 |
| NFR a11y | Task 5, tests 1 and 6 |

## 8. Risks / open questions

None.
