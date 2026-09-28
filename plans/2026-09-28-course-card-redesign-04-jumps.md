# Course card redesign — Phase 04: Jumps between cards and requirements

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-28-course-card-redesign-00-overview.md`. Read
  it first: E4, E5, E8, CR4, CR11, §2.2 (reduced motion) and §4.3
  (`ShowRequest`).
- **Depends on phases:** 01 (card footer, receding CSS list), 02 (the
  receding list trimmed to `.course-card-hard` in Task 6) and 03
  (`familyOf`, `.family-dot`, `data-group` on group `<li>`s).

## 1. Summary

The link between a course and its requirement starts working both ways:
- **Card to group:** a timeline card's "Counts toward <group>" becomes a
  button that reveals, scrolls to, highlights and focuses that exact
  group in the sidebar, expanding the sidebar or group first if needed.
- **"What's left" items** jump the same way, to a group or a check row.
- **Group to cards:** hovering or focusing a group heading recedes every
  timeline card that doesn't count toward that group.

## 2. Requirements (this phase)

### 2.1 Functional

- **E5 and CR4 (the button):** Task 11.
- **E8:** Task 12.
- **E4:** Task 13.
- **CR11:** these links work on read-only plans (Tasks 11–12 test on the
  read-only example).

### 2.2 Non-functional

- Axe clean.
- Focus moves only on activation (E5/E8), never on hover (E4).
- `behavior: "auto"` under `prefers-reduced-motion: reduce`.

### 2.3 Out of scope for this phase

- Help copy (Task 19).
- Changing how "locate on timeline" works (it stays as is).

### 2.4 Assumptions

- See overview §2.4.
- **Top-level headings** are keyboard-focusable (`button.section-toggle`),
  so E4 listens to hover and focus there.
- **Nested headings** (`h3`–`h6`) aren't in the tab order, so they
  respond to hover. They get `tabIndex={-1}` here only so E5 can focus
  them programmatically.
- **E5 then E4 (ruled 2026-09-28, execution review):** E5 focuses a
  top-level toggle programmatically, which fires its `onFocus`, so after a
  jump to a top-level group the other timeline cards recede until focus
  leaves. That is intended; there's no guard against it.

## 3. Existing code context (verified 2026-09-28)

**`src/components/Planner.tsx`:**
- state includes `reqs` (`ReqsState`, with `.collapsed: boolean`),
  `openMenuCode`, `locateRequest: { code: string; token: number } | null`;
- `function updateReqs(next: ReqsState, commit: boolean)` sets the state,
  calls `applyReqsState(document.documentElement, next)` synchronously and
  saves on commit;
- the Sidebar `onShow={() => updateReqs({ ...reqs, collapsed: false },
  true)}` expands from the rail or stacked bar;
- Timeline gets `view, planId, draggingCode, draggingBlocked, onChanged,
  onAnnounce, onDragStart, onDragEnd, showPrereqLinks, openMenuCode,
  onMenuOpenChange, onRemoved, locateRequest`;
- Sidebar gets `view, planId, onChanged, onAnnounce, onDragStart,
  onDragEnd, onSearchResults, openMenuCode, onMenuOpenChange,
  onLocateCourse, onHide, onShow, dropReady, onDropRemove`.

**`src/components/Timeline.tsx`:**
- props as listed above;
- it maps placements into `<CourseCard key view placement planId
  onChanged onAnnounce onDragStart onDragEnd openMenuCode onMenuOpenChange
  onRemoved />`;
- the locate effect is the model for highlighting:

```ts
useEffect(() => {
  if (!locateRequest) return;
  const el = document.querySelector(`[data-placed="${locateRequest.code}"]`);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  el.focus({ preventScroll: true });
  el.classList.add("course-card-highlighted");
  const timer = setTimeout(() => el.classList.remove("course-card-highlighted"), 2000);
  return () => { clearTimeout(timer); el.classList.remove("course-card-highlighted"); };
}, [locateRequest]);
```

**`src/components/Sidebar.tsx`:**
- the local `compact: Set<string>` state and `setSectionCompact(id,
  value)`;
- section IDs are `"outstanding"`, `"search"`, `"total"` and
  `\`group-${id}\`` (top level only);
- `outstandingItems(view)` renders `<ul class="outstanding-list">{items.map((item)
  => <li key={item.id}>{item.text}</li>)}</ul>`;
- the Total section has `<section aria-label="program checks"><h3>Checks</h3><ul
  class="checks-list">`, with one `<li key={check.id}><h4>{check.label}</h4>…</li>`
  per check;
- `Group` depth 0 renders `SidebarSection` (after Task 8, with
  `family`/`groupId`, giving `data-group` on its `<li>`); nested groups
  render `<li data-group={group.id}><Heading>{label}</Heading>…`.

**`src/components/SidebarSection.tsx`** (after Task 8): props `{ id;
label; compact; onToggle; class?; summary?; compactSummary?; children?;
family?; groupId? }`. It renders `<h2><button class="section-toggle"
aria-expanded aria-controls onClick={onToggle}>…{label}</button></h2>`.

**`src/components/planner-logic.ts`:**
- `OutstandingItem { id; text }`, with IDs `choice-<groupId>`,
  `group-<groupId>` (leaf groups) and `check-<checkId>`;
- `groupLabel(view, groupId)`.

**`src/components/CourseCard.tsx`** (after Task 8): the footer holds `<p
class="course-card-allocation">{family dot}{"Counts toward …" | "Not
counting toward any requirement"}</p>` and the card `MoreOptions`. Props,
exactly (unchanged since before this feature):

```ts
interface Props {
  view: PlanView;
  placement: PlacementView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onRemoved: (removed: RemovedPlacement) => void;
}
```

**CSS:** `.course-card-highlighted { outline: 3px solid var(--gold);
outline-offset: 2px; }`. The receding list is `.course-card-hard { … }`
with muted `strong` / `.course-card-title` / `.course-card-offered`
(Tasks 4, 6).

**Example plan facts** (read-only, AI specialisation chosen):
- COMP1130 counts toward `prog-a`;
- COMP2620 counts toward `arin-a` ("Artificial Intelligence — foundations
  (max 12)");
- COMP2100 counts toward `compulsory`;
- "What's left" contains "At least 12 units of TDP-tagged courses — not
  tracked, verify on P&C" (ID `check-tdp-min`).

### Interfaces from earlier phases (exact)

- `familyOf(view: PlanView, groupId: string | null): Family` (Task 7).
- `GroupView.family: Family` (Task 7).
- `SidebarSection` props `family?: Family; groupId?: string` rendering
  `data-group={groupId}` (Task 8). Nested group `<li data-group={group.id}>`
  (Task 8).
- `<span class="family-dot" data-family={family} aria-hidden="true" />`
  inside `.course-card-allocation` (Task 8).
- `div.course-card-foot` (Task 2).
- The receding selector list starting `.course-card-hard` (Tasks 4, 6).

## 4. Approach

**Request state lives in Planner**, like `locateRequest`, because
revealing a hidden sidebar is Planner's job:

```ts
function showInSidebar(kind: ShowRequest["kind"], id: string) {
  if (reqs.collapsed) updateReqs({ ...reqs, collapsed: false }, true);
  setShowRequest({ kind, id, token: Date.now() });
}
```

**Sidebar handles the request in an effect:**
1. Resolve which section must be expanded (`"total"` for a check, or the
   group's top-level section).
2. Un-compact it.
3. On the next animation frame (after the render that shows it): find
   the target, `scrollIntoView({ block: "nearest", inline: "nearest",
   behavior })`, focus its heading with `preventScroll`, and add
   `requirement-highlighted` for 2s.
4. The effect's cleanup removes the class and cancels the frame and the
   timer. That is the same "a newer request clears the older highlight"
   rule as 2514b69.

**E4:** Sidebar reports the heading under hover/focus through
`onFocusGroup(groupId | null)`. Planner stores it. Timeline turns it into
a leaf-ID set and marks the other cards `course-card-receded`. Nothing
here calls `focus()` or scrolls.

## 5. Task breakdown

### Task 11: "Counts toward" shows its group in the sidebar

- [x] **Description:**
  - Add `groupPath` and `ShowRequest`, the Sidebar show effect,
    Planner's `showInSidebar`, and Timeline/CourseCard `onShowGroup`.
  - The "Counts toward" paragraph becomes a button.
  - Nested headings get `tabIndex={-1}`.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/Sidebar.tsx`
  - `src/components/Planner.tsx`
  - `src/components/Timeline.tsx`
  - `src/components/CourseCard.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("groupPath")`,** on a view with `choices: { spec:
    "arin" }`:
    - `groupPath(view, "arin-a").map((g) => g.id)` is `["spec", "arin",
      "arin-a"]`;
    - `groupPath(view, "prog-a")` is `["prog-a"]`;
    - `groupPath(view, "nope")` is `[]`.
  - **Spec, new `describe("show a group in the sidebar")`,** at 1920×1080
    unless stated. `highlighted` is the list of `data-group` values on
    `.requirement-highlighted`. The button is `page.locator('[data-placed="X"]
    .course-card-allocation')`, and must be a `button` element.
    1. On `withPlan`, click COMP1130's button:
       - `highlighted` polls to `["prog-a"]`;
       - `document.activeElement` is `[data-group="prog-a"] >
         h2 .section-toggle`;
       - after 3s, `highlighted` is `[]`.
    2. On `withPlan`, click COMP2620's button:
       - `highlighted` is `["arin-a"]`;
       - `activeElement.textContent` is "Artificial Intelligence —
         foundations (max 12)";
       - the target's rect is inside `#requirements`' rect vertically.
    3. Clicking COMP1130's then COMP2620's in quick succession leaves only
       `["arin-a"]`.
    4. With storage `{ "panel-reqs": "collapsed" }`, clicking COMP1130's
       expands: `document.documentElement.dataset.reqs` is not "collapsed",
       and `highlighted` becomes `["prog-a"]`.
    5. With storage `{ "sidebar-compact": "[\"group-prog-a\"]" }`, the
       `prog-a` section's toggle reads `aria-expanded="false"` before and
       "true" after, and it's highlighted.
    6. At 390×844 on `withPlan`, click COMP2620's (scroll the timeline to
       it first with `scrollIntoViewIfNeeded`). The target's rect
       intersects `.requirements-scroll`'s rect horizontally, and
       `horizontalOverflow` is 0.
    7. "Not counting…" stays a `p`: on a fresh plan with COMP1100 and
       COMP1130 in term 0 (COMP1130 is the loser),
       `[data-placed="COMP1130"] .course-card-allocation` has `tagName`
       "P".
    8. `axeViolations` is `[]`.
- **Implementation (green):**
  - `planner-logic.ts`: `export function groupPath(view: PlanView,
    groupId: string): GroupView[]`, a recursive search that returns the
    root-to-target chain.
  - `Sidebar.tsx`:
    - `export interface ShowRequest { kind: "group" | "check"; id: string;
      token: number }`;
    - new prop `showRequest: ShowRequest | null`;
    - nested `Heading` gets `tabIndex={-1}`;
    - the effect, keyed on `showRequest` (see this file's §4):
      ```ts
      const sectionId = showRequest.kind === "check" ? "total" : groupPath(view, showRequest.id)[0]?.id;
      if (!sectionId) return;
      setSectionCompact(showRequest.kind === "check" ? "total" : `group-${sectionId}`, false);
      ```
      - then, in `requestAnimationFrame`:
        - `el = document.querySelector<HTMLElement>(kind === "check" ?
          \`[data-check="${id}"]\` : \`[data-group="${id}"]\`)`;
        - `heading = el.querySelector<HTMLElement>(":scope > h2
          .section-toggle, :scope > h3, :scope > h4, :scope > h5, :scope >
          h6")`;
        - `el.scrollIntoView({ block: "nearest", inline: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ?
          "auto" : "smooth" })`;
        - `heading?.focus({ preventScroll: true })`;
        - add `requirement-highlighted`, and remove it after 2000ms;
      - the cleanup cancels the frame, clears the timer and removes the
        class.
  - `Planner.tsx`:
    - `const [showRequest, setShowRequest] = useState<ShowRequest |
      null>(null);`
    - `showInSidebar` as in this file's §4;
    - pass `showRequest={showRequest}` to Sidebar and `onShowGroup={(id)
      => showInSidebar("group", id)}` to Timeline.
  - `Timeline.tsx`: new prop `onShowGroup: (groupId: string) => void`,
    passed to each `CourseCard`.
  - `CourseCard.tsx`:
    - new prop `onShowGroup: (groupId: string) => void`;
    - when `placement.countsToward`, render `<button type="button"
      class="course-card-allocation" onClick={() =>
      onShowGroup(placement.countsToward!)}>{dot}Counts toward
      {label}<span class="visually-hidden">, show in
      requirements</span></button>`;
    - otherwise render the existing `<p class="course-card-allocation">`;
    - the button renders on read-only plans too.
  - `styles.css`:
    - `button.course-card-allocation`: the `.course-card-title` reset
      (no border or background, `font: inherit`, `text-align: start`,
      `padding: 0`), plus `color: var(--unigrey); font-size: 0.85em;`
      and an underline on hover/focus-visible;
    - `.requirement-highlighted { outline: 3px solid var(--gold);
      outline-offset: -3px; }` (inset, so the horizontal strip's
      scroller doesn't clip it).
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - A screenshot of the highlight at both viewports.
- **Depends on:** Phase 03 (Task 8's `data-group` and dot).

### Task 12: "What's left" items jump to their group or check

- [ ] **Description:**
  - Add `outstandingTarget`.
  - Outstanding items with a target become buttons calling a new Sidebar
    prop `onShowInSidebar`.
  - Check rows get `data-check` and focusable `h4`s.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/Sidebar.tsx`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("outstandingTarget")`:**
    - `"group-prog-a"` → `{ kind: "group", id: "prog-a" }`;
    - `"choice-spec"` → `{ kind: "group", id: "spec" }`;
    - `"check-tdp-min"` → `{ kind: "check", id: "tdp-min" }`;
    - `"other"` → `null`;
    - every ID `outstandingItems` produces for `buildPlanView(cat,
      AACOM_2027, emptyPlan())` maps to non-null.
  - **Spec, in `describe("show a group in the sidebar")`:**
    1. On `withPlan`:
       - click the `.outstanding-list` button whose text starts "At least
         12 units of TDP-tagged courses";
       - `.requirement-highlighted` polls to one element with
         `data-check="tdp-min"`;
       - `activeElement` is its `h4`.
    2. The same with storage `{ "sidebar-compact": "[\"total\"]" }`: the
       Total toggle's `aria-expanded` becomes "true".
    3. On a fresh plan: the first outstanding button (a `group-*` item)
       highlights `[data-group=<that id>]`.
    4. `axeViolations` is `[]`.
- **Implementation (green):**
  - `planner-logic.ts`: `export function outstandingTarget(id: string): {
    kind: "group" | "check"; id: string } | null`, which strips the
    `group-` / `choice-` / `check-` prefix.
  - `Sidebar.tsx`:
    - new prop `onShowInSidebar: (kind: ShowRequest["kind"], id: string)
      => void`;
    - each outstanding item with a target renders `<li
      key={item.id}><button type="button" class="outstanding-link"
      onClick={() => onShowInSidebar(t.kind,
      t.id)}>{item.text}</button></li>`, and otherwise the plain text;
    - checks get `<li key={check.id} data-check={check.id}><h4
      tabIndex={-1}>…`.
  - `Planner.tsx`: pass `onShowInSidebar={showInSidebar}`.
  - `styles.css`: `.outstanding-link`, a text-button reset (as
    `button.course-card-allocation`), `color: inherit`, `font-size:
    inherit`, with an underline on hover/focus-visible. The gold bullet
    stays on the `li`.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
- **Depends on:** Task 11.

### Task 13: Hovering or focusing a group heading recedes other timeline cards

- [ ] **Description:**
  - Add `groupLeafIds`.
  - Sidebar reports heading enter/leave through `onFocusGroup`.
  - Planner holds `focusGroupId`, and Timeline marks non-matching cards
    `course-card-receded`.
  - Add `.course-card-receded` to the receding CSS list.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/SidebarSection.tsx`
  - `src/components/Sidebar.tsx`
  - `src/components/Planner.tsx`
  - `src/components/Timeline.tsx`
  - `src/components/CourseCard.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("groupLeafIds")`,** with `choices: { spec: "arin"
    }`:
    - `groupLeafIds(view, "spec")` contains "spec", "arin" and "arin-a";
    - `groupLeafIds(view, "prog-a")` is `new Set(["prog-a"])`;
    - `groupLeafIds(view, "nope")` is an empty set.
  - **Spec, new `describe("group heading highlights its courses")`,** on
    `withPlan` at 1920×1080. `receded` is the sorted list of
    `data-placed` values with the class `course-card-receded`.
    1. Before any hover, `receded` is `[]`.
    2. Hover the `prog-a` section's `.section-toggle`:
       - `receded` doesn't contain "COMP1130" but does contain "COMP2100";
       - `document.activeElement` is still `body`;
       - `.timeline-scroll`'s `scrollLeft` and `#requirements`'
         `scrollTop` are unchanged.
    3. Move the mouse to `h1`: `receded` is `[]`.
    4. Focus the `prog-a` toggle by keyboard (`.focus()`): the same as
       test 2. `.blur()` gives `[]`.
    5. Hover the `spec` toggle: COMP2620 isn't receded (a nested leaf
       counts).
    6. For a receded card, every button's ancestor opacity product is 1
       (the walk from the "course cards" tests).
- **Implementation (green):**
  - `planner-logic.ts`: `export function groupLeafIds(view: PlanView,
    groupId: string): Set<string>`, holding the IDs of the group and all
    its descendants (built with `groupPath`'s search).
  - `SidebarSection.tsx`: new optional prop `onHeadingActive?: (active:
    boolean) => void`, wired on `button.section-toggle` as `onMouseEnter`
    / `onFocus` → `true`, and `onMouseLeave` / `onBlur` → `false`.
  - `Sidebar.tsx`:
    - new prop `onFocusGroup: (groupId: string | null) => void`;
    - depth 0 passes `onHeadingActive={(a) => onFocusGroup(a ? group.id :
      null)}`;
    - nested `Heading` gets `onMouseEnter` / `onMouseLeave` doing the
      same.
  - `Planner.tsx`: `const [focusGroupId, setFocusGroupId] =
    useState<string | null>(null);`, passing `onFocusGroup={setFocusGroupId}`
    to Sidebar and `focusGroupId={focusGroupId}` to Timeline.
  - `Timeline.tsx`:
    - new prop `focusGroupId: string | null`;
    - `const focusLeafIds = focusGroupId ? groupLeafIds(view,
      focusGroupId) : null;`
    - pass `receded={focusLeafIds !== null && !(placement.countsToward &&
      focusLeafIds.has(placement.countsToward))}`.
  - `CourseCard.tsx`: new prop `receded: boolean`, which appends `
    course-card-receded` to the `<li>` class.
  - `styles.css`: add `.course-card-receded` (and its `strong`,
    `.course-card-title` variants) to the receding selector list. It
    keeps its own border style, so only `.course-card-hard` is dashed.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - A screenshot while hovering the Specialisation heading.
- **Depends on:** Task 11 (`groupPath`, nested `data-group`).

## 6. Phase Definition of Done

- [ ] Tasks 11–13 complete, their tests passing
- [ ] `pnpm exec vitest run --project unit` passes
- [ ] `pnpm check` passes
- [ ] Manually, at both viewports:
  - [ ] "Counts toward" with the sidebar hidden;
  - [ ] a "What's left" check item;
  - [ ] heading hover
- [ ] Tick Phase 04 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CR4 (button) | Task 11 |
| E5 | Task 11 (tests 1–6) |
| E8 | Task 12 |
| E4 | Task 13 |
| CR11 (links on read-only) | Tasks 11–12 (run on the read-only example) |
| NFR reduced motion | Task 11 (code path; the scroll behaviour is chosen from `matchMedia`) |

## 8. Risks / open questions

None.
