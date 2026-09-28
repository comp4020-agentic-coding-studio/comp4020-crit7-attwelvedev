# Two-semester course display — Phase 03: Timeline

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28
- **Part of:** `plans/2026-09-28-two-semester-display-00-overview.md`. Read it
  first, especially §2 (TS1, TS2, TS3, TS7, NF1, NF2), §2.4, §3, §4.1 and
  §4.2 (the DOM contract).
- **Depends on phases:** 01 (`termSpanLabel`, `span`/`lastTerm`), 02 (none of
  its code is imported, but its spec `describe("two-semester labels")`
  exists, and this phase adds tests to it).

## 1. Summary

This phase makes the timeline show both semesters of a two-semester course:
- part 1 gets a marker line;
- the next column gets a compact part 2 stub;
- locating, receding and the drag outline treat both parts as one;
- overlay arrows to dependents leave from the stub.

## 2. Requirements (this phase)

### 2.1 Functional

TS1, TS2, TS3 and TS7, all in full.

### 2.2 Non-functional

- NF1: the stub is not `.course-card`, and the budget spec is re-run.
- NF2: the stub's accessible name; axe stays clean.
- NF4.

### 2.3 Out of scope for this phase

- Help text, and the final two-viewport human review (Phase 04).
- Stub hover highlighting in the overlay (overview §2.3).

### 2.4 Assumptions

See overview §2.4. In the example plan, COMP4550 sits at term 6 with
`lastTerm` 7, so its stub is in `[data-term="7"]`. The example is read-only,
so it has no grip and no menu.

## 3. Existing code context (verified 2026-09-28)

`src/components/Timeline.tsx`:
- Props include `view`, `draggingCode`, `draggingBlocked?`,
  `locateRequest: { code: string; token: number } | null` and
  `focusGroupId: string | null`, among others.
- It imports
  `import { dropTargets, groupLeafIds, termBarLabel, termBarWidths, termFamilyUnits } from "./planner-logic";`.

The locate effect:

```tsx
useEffect(() => {
  if (!locateRequest) return;
  const el = document.querySelector(`[data-placed="${locateRequest.code}"]`);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  el.focus({ preventScroll: true });
  el.classList.add("course-card-highlighted");
  const timer = setTimeout(() => el.classList.remove("course-card-highlighted"), 2000);
  return () => {
    clearTimeout(timer);
    el.classList.remove("course-card-highlighted");
  };
}, [locateRequest]);
```

Rendering:
- Placements are grouped by `placement.term` into `placementsByTerm`.
- `const focusLeafIds = focusGroupId ? groupLeafIds(view, focusGroupId) : null;`
- The root is `<div class="timeline-scroll" onMouseOver=… onMouseOut=…>`,
  which contains `<PrereqOverlay …/>` followed by one
  `<section data-term={term.index} class={["term", …, greyed && "term-disallowed", dragOver && "drag-hover-target"]…}>`
  per term.
- Each section ends with
  `<ul class="term-cards">{(placementsByTerm.get(term.index) ?? []).map((placement) => <CourseCard key={placement.code} … receded={focusLeafIds !== null && !(placement.countsToward && focusLeafIds.has(placement.countsToward))} />)}</ul>`.

`src/components/Planner.tsx`:
- `const [searchBlocked, setSearchBlocked] = useState<Record<string, Record<number, string>>>({});`
- `<Timeline … draggingCode={draggingCode} draggingBlocked={draggingCode ? searchBlocked[draggingCode] : undefined} … locateRequest={locateRequest} …/>`
- `<Sidebar … onSearchResults={(courses) => setSearchBlocked((prev) => ({ ...prev, ...Object.fromEntries(courses.map((course) => [course.code, course.hardBlocked])) }))} … onLocateCourse={(code) => setLocateRequest({ code, token: Date.now() })} />`.
- `draggingCode` is set by both mouse drags (`onDragStart={setDraggingCode}`)
  and touch drags (`useTouchDrag(plannerRef, { onDragStart: setDraggingCode, … })`).

`src/components/touch-drag.ts` adds `drag-hover-target` directly to the
hovered `[data-term]` element, and removes it from all elements on end.

`src/components/CourseCard.tsx`:
- The `<li class="course-card …" data-placed={placement.code} data-family={family ?? undefined} tabIndex={-1} …>`
  renders `<CourseCardHeader …/>` first, then the state badge `<p class="badge badge-state-…">`.
- `const course = view.courses[placement.code];`

`src/components/PrereqOverlay.tsx`:
- `centreOf(code)` queries `` scroll!.querySelector(`[data-placed="${code}"]`) ``.
- For each `edge` (`{ from, to, kind }`, where `from` is the prerequisite
  and `to` the dependent), it does
  `const from = centreOf(edge.from); const to = centreOf(edge.to);`.
- It renders
  `<line key={line.key} class={…} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />`.

`src/components/planner-logic.ts`:
- `export function familyOf(view: PlanView, groupId: string | null): Family`.
- `overlayEdges(view, code)` already requires a two-semester prereq's
  `lastTerm` to be before the dependent.

`src/styles.css`:
- `.term-cards` is a flex column with `gap: 0.6rem`.
- `.term-cards .course-card, .available-courses .course-card { width: 13rem; flex-shrink: 0; }`
- `.course-card { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 0.7rem; padding: 0.55rem 0.8rem; }`
- `.course-card-offered, .course-card-allocation { font-size: 0.85em; color: var(--unigrey); margin: 0.35rem 0 0; }`
- `.course-card-receded { background: var(--paper); color: var(--muted); }`
- `.course-card-highlighted { outline: 3px solid var(--gold); outline-offset: 2px; }`
- `.term-cards .course-card[data-family]:not([data-family="neutral"]) { box-shadow: inset 4px 0 0 var(--family); }`
- `.term.drag-hover-target:not(.term-disallowed) { outline: 2px solid var(--gold); outline-offset: -2px; }`
- `[data-family="…"] { --family: var(--family-…); }` is defined globally.

In `spec/layout.test.ts`:
- `describe("card height budget")` measures `.term-cards .course-card`
  (the median ≤ 150px at 1920×1080) and the first two cards of
  `[data-term="0"]` at 390×844.
- The existing touch-drag test `"outlines the term under a touch drag, but
  not a hard-blocked one"` shows how to drive touch with
  `Input.dispatchTouchEvent`. It uses the `centre(selector)` and
  `outlined(page, term)` helpers defined in that describe.

### Interfaces from earlier phases (exact)

```ts
// src/lib/domain/terms.ts (Task 1)
export function termSpanLabel(index: number, span: number): string;

// PlacementView (extends PlacementEval), fields used here:
code: string; term: number; span: number; lastTerm: number;
countsToward: string | null; completedParts: number;
```

## 4. Approach

- **Stub placement:** `partTwoPlacements(view, term)` returns placements
  with `span === 2 && lastTerm === term && lastTerm < view.terms.length`.
  The Timeline renders those after the term's cards as `<PartTwoStub>`.
- **One recede rule:** a single local `recededFor(placement)` in Timeline
  feeds both part 1 and the stub.
- **Locate:** the stub's button calls a new Timeline prop
  `onLocateCourse(code)`, which Planner wires to the same
  `setLocateRequest` the sidebar uses. The locate effect highlights part 1
  and also `[data-part-two=code]`, and focus stays on part 1.
- **Drag outline for both terms:** Timeline sets
  `data-drag-span="2"` on `.timeline-scroll` while a two-semester course is
  dragged. A CSS adjacent-sibling rule outlines the term after an outlined
  one. It works for mouse and touch, because both paths set
  `drag-hover-target` on the hovered section, and the sections are
  adjacent siblings after the overlay `<svg>`.
- **Search drags:** a two-semester course dragged from search isn't in
  `view.courses`. Planner records `twoSemester` from search results next
  to `searchBlocked` and passes `draggingTwoSemester` to Timeline.
- **Overlay:** the `from` end of an edge prefers `[data-part-two=from]` and
  falls back to `[data-placed=from]`. The `to` end stays `[data-placed]`.
  Lines gain `data-from`/`data-to` so the spec can find them.

## 5. Task breakdown

### Task 5: Part 1 marker line on two-semester timeline cards

- [ ] **Description:** add `partOneMarker` and render it as a line under
  the title of two-semester timeline cards.
- **Files touched:** `src/components/planner-logic.ts`,
  `src/components/planner-logic.test.ts`, `src/components/CourseCard.tsx`,
  `src/styles.css`, `spec/layout.test.ts`.
- **Tests first (red):**
  - `planner-logic.test.ts` `describe("partOneMarker")`:
    - COMP4550 at 4 → `"Part 1 of 2 · continues in S2 2029"`;
    - COMP4550 at 7 (hard-blocked, `lastTerm` 8) → `"Part 1 of 2"`;
    - COMP1100 at 0 → `null`.
    Build the views with `buildPlanView(cat, AACOM_2027, { ...emptyPlan(), placements: [...] })`.
  - `spec/layout.test.ts` `describe("two-semester labels")`,
    `"marks part 1 on the example plan's COMP4550 card"`:
    - `withPlan` at 1920×1080;
    - `[data-placed="COMP4550"] .course-card-part` innerText is
      `"Part 1 of 2 · continues in S2 2030"`;
    - no `[data-placed="COMP1130"] .course-card-part` exists.
- **Implementation (green):**
  - `planner-logic.ts`:

    ```ts
    // The line under a two-semester card's title naming where part 2 is; a
    // course left in the final term (hard-blocked) has no part 2 term.
    export function partOneMarker(view: PlanView, placement: PlacementView): string | null {
      if (placement.span !== 2) return null;
      const next = view.terms[placement.lastTerm];
      return next ? `Part 1 of 2 · continues in ${next.label}` : "Part 1 of 2";
    }
    ```

  - `CourseCard.tsx`: after `<CourseCardHeader …/>`, render
    `{marker && <p class="course-card-part">{marker}</p>}` with
    `const marker = partOneMarker(view, placement);`.
  - `styles.css`: add `.course-card-part` to the
    `.course-card-offered, .course-card-allocation` rule.
- **Refactor:** none.
- **Acceptance criteria:**
  - The tests pass.
  - `describe("card height budget")` passes unchanged.
  - `pnpm check` is green.
- **Depends on:** none in this phase (it uses the existing `span`/`lastTerm`).

### Task 6: Part 2 stub, with linked locate, flash and recede

- [ ] **Description:**
  - Add `partTwoPlacements` and a `PartTwoStub` component.
  - Render stubs in the `lastTerm` column.
  - Share one recede rule between part 1 and its stub.
  - Add a Timeline `onLocateCourse` prop wired in Planner.
  - Highlight the stub along with part 1 on locate.
- **Files touched:**
  - `src/components/planner-logic.ts`, `src/components/planner-logic.test.ts`
  - `src/components/PartTwoStub.tsx` (new)
  - `src/components/Timeline.tsx`, `src/components/Planner.tsx`
  - `src/styles.css`, `spec/layout.test.ts`
- **Tests first (red):**
  - `planner-logic.test.ts` `describe("partTwoPlacements")`, on a view with
    COMP4550 at 4, COMP4500 at 7 and COMP1100 at 0:
    - `partTwoPlacements(view, 5)` has codes `["COMP4550"]`;
    - `partTwoPlacements(view, 4)`, `(view, 0)` and `(view, 7)` all return
      `[]`. COMP4500 at 7 has no part 2 term.
  - `spec/layout.test.ts` `describe("two-semester labels")`:
    - `"shows part 2 of the example's COMP4550 in the next term"`, with
      `withPlan` at both 1920×1080 and 390×844 (`it.each`):
      - `[data-term="7"] [data-part-two="COMP4550"]` count is 1;
      - it has no `.course-card` class;
      - its button's accessible name is
        `"COMP4550 part 2 of 2, continued from S1 2030"`;
      - its `data-family` equals part 1's.
    - `"the part 2 stub locates part 1 and both flash"` (desktop):
      - click the stub's button;
      - poll until `document.activeElement` has `data-placed="COMP4550"`;
      - poll until `.course-card-highlighted` elements' `data-placed` /
        `data-part-two` attributes are exactly `["COMP4550", "COMP4550"]`.
    - `"part 2 recedes with part 1"` (desktop):
      - hover the `compulsory` group's heading toggle,
        ``page.locator(`[data-group="compulsory"] > h2 .section-toggle`)``.
        This is the locator `describe("group heading highlights its
        courses")` uses as `toggle(page, id)`. On the example plan COMP4550
        counts toward `cap-research`, not `compulsory`;
      - expect both `[data-placed="COMP4550"]` and
        `[data-part-two="COMP4550"]` to have their receded classes.
- **Implementation (green):**
  - `planner-logic.ts`:

    ```ts
    // The two-semester placements whose second part falls in `term`, drawn
    // there as a stub. One in the final term has no second term to show.
    export function partTwoPlacements(view: PlanView, term: number): PlacementView[] {
      return view.placements.filter((p) => p.span === 2 && p.lastTerm === term && p.lastTerm < view.terms.length);
    }
    ```

  - `PartTwoStub.tsx`. Props:
    `{ code: string; startLabel: string; family: Family | null; receded: boolean; onLocate: () => void }`.
    It renders:

    ```tsx
    <li class={`part-two-stub${receded ? " part-two-stub-receded" : ""}`} data-part-two={code} data-family={family ?? undefined}>
      <button type="button" aria-label={`${code} part 2 of 2, continued from ${startLabel}`} onClick={onLocate}>
        <strong>{code}</strong> · part 2 of 2
      </button>
    </li>
    ```

    Add a comment: not draggable and no menu, because part 1 is the one to
    move; activating it goes to part 1.
  - `Timeline.tsx`:
    - add `familyOf` and `partTwoPlacements` to the `./planner-logic`
      import, and `import PartTwoStub from "./PartTwoStub";`;
    - add prop `onLocateCourse: (code: string) => void`, with a comment
      that the stub uses it, the same as the sidebar's badge;
    - add `const recededFor = (p: PlacementView) => focusLeafIds !== null && !(p.countsToward && focusLeafIds.has(p.countsToward));`
      and use it for `CourseCard`'s `receded`;
    - after the CourseCard map inside `.term-cards`, render
      `partTwoPlacements(view, term.index).map((p) => <PartTwoStub key={\`${p.code}-2\`} code={p.code} startLabel={view.terms[p.term].label} family={p.countsToward ? familyOf(view, p.countsToward) : null} receded={recededFor(p)} onLocate={() => onLocateCourse(p.code)} />)`;
    - locate effect: also query
      `` const part2 = document.querySelector(`[data-part-two="${locateRequest.code}"]`); ``.
      If it's there, add `course-card-highlighted` and remove it in both the
      timer and the cleanup. Focus and scroll stay on part 1.
  - `Planner.tsx`: pass
    `onLocateCourse={(code) => setLocateRequest({ code, token: Date.now() })}`
    to `<Timeline>`.
  - `styles.css`, next to the `.course-card` rules:
    - `.part-two-stub { width: 13rem; flex-shrink: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 0.7rem; }`
    - `.part-two-stub button { display: block; width: 100%; padding: 0.35rem 0.8rem; border: 0; background: none; font: inherit; font-size: 0.85em; color: var(--unigrey); text-align: start; cursor: pointer; }`
    - `.part-two-stub button:hover, .part-two-stub button:focus-visible { text-decoration: underline; text-underline-offset: 0.15em; }`
    - `.part-two-stub[data-family]:not([data-family="neutral"]) { box-shadow: inset 4px 0 0 var(--family); }`
    - `.part-two-stub-receded { background: var(--paper); }` and
      `.part-two-stub-receded button, .part-two-stub-receded strong { color: var(--muted); }`
- **Refactor:** none beyond `recededFor`.
- **Acceptance criteria:**
  - The tests pass, including the phone viewport.
  - `describe("card height budget")` passes unchanged.
  - `spec/invariants.test.ts` axe passes.
  - `pnpm check` is green.
- **Depends on:** Task 5 (same files; the order avoids conflicts).

### Task 7: Outline both terms while dragging a two-semester course

- [ ] **Description:** while a two-semester course is dragged (mouse or
  touch, from the timeline, sidebar or search), an allowed hovered term T
  and the term after it both show the gold outline.
- **Files touched:** `src/components/Timeline.tsx`, `src/components/Planner.tsx`,
  `src/styles.css`, `spec/layout.test.ts`.
- **Tests first (red):** `spec/layout.test.ts`, in the describe holding the
  touch-drag outline test (so it reuses `centre`/`outlined`),
  `"outlines both terms under a touch drag of a two-semester course"`:
  - place COMP4550 at 4 in a fresh plan;
  - open it with `hasTouch` at 390×844 exactly as the existing test does;
  - touch-hold `[data-drag-code="COMP4550"]` and move over
    `[data-term="2"]`, bringing it on screen with `scrollIntoView` as the
    existing test does. Term 2 is allowed: COMP4550's `hardBlocked` is
    only terms 0, 1 and 7, verified against the server on 2026-09-28;
  - poll until `outlined(page, 2)` and `outlined(page, 3)` are both true
    and `outlined(page, 4)` is false.
- **Implementation (green):**
  - `Planner.tsx`:
    - add `const [searchTwoSemester, setSearchTwoSemester] = useState<Record<string, boolean>>({});`,
      filled in the same `onSearchResults` callback with
      `Object.fromEntries(courses.map((course) => [course.code, course.twoSemester]))`;
    - pass
      `draggingTwoSemester={draggingCode ? (view.courses[draggingCode]?.twoSemester ?? searchTwoSemester[draggingCode] ?? false) : false}`
      to `<Timeline>`.
  - `Timeline.tsx`:
    - add prop `draggingTwoSemester: boolean`, with a comment;
    - set `data-drag-span={draggingCode !== null && draggingTwoSemester ? "2" : undefined}`
      on `.timeline-scroll`.
  - `styles.css`, after the `.term.drag-hover-target:not(.term-disallowed)`
    rule:

    ```css
    /* A two-semester course takes the hovered term and the next, so the
       drop outline covers both (sections are adjacent siblings). */
    .timeline-scroll[data-drag-span="2"] .term.drag-hover-target:not(.term-disallowed) + .term {
      outline: 2px solid var(--gold);
      outline-offset: -2px;
    }
    ```

- **Refactor:** none.
- **Acceptance criteria:**
  - The new spec passes.
  - The existing touch-drag outline test passes unchanged, since a
    one-semester drag outlines only one term.
  - `pnpm check` is green.
- **Depends on:** Task 6 (the Timeline prop list).

### Task 8: Overlay arrows to dependents leave from part 2

- [ ] **Description:** an overlay edge whose prerequisite (`from`) is a
  two-semester course starts at its part 2 stub when there is one. Lines
  carry `data-from`/`data-to`.
- **Files touched:** `src/components/PrereqOverlay.tsx`, `spec/layout.test.ts`.
- **Tests first (red):** `spec/layout.test.ts` `describe("two-semester labels")`,
  `"draws COMP4550's arrow to COMP4620 from its part 2 stub"`:
  - fresh plan, place COMP4550 at 4 and COMP4620 at 7 (both verified 200);
  - open at 1920×1080 and turn on the links the way the existing
    `showLinks` helper does:
    `page.getByRole("button", { name: "More options", exact: true }).click()`,
    then `page.getByLabel("Show prerequisite links").check()`, then
    `page.keyboard.press("Escape")`;
  - read `line[data-from="COMP4550"][data-to="COMP4620"]` with its
    `x1`/`y1` plus the svg's `getBoundingClientRect()`;
  - assert that point lies inside
    `[data-part-two="COMP4550"]`'s `getBoundingClientRect()`.
- **Implementation (green):**
  - In `PrereqOverlay.tsx`, change `centreOf(code)` to
    `centreOf(selector: string)` querying `scroll!.querySelector(selector)`.
  - Compute
    ``const from = centreOf(`[data-part-two="${edge.from}"]`) ?? centreOf(`[data-placed="${edge.from}"]`);``
    and ``const to = centreOf(`[data-placed="${edge.to}"]`);``.
  - Comment: a dependent waits for a two-semester prereq's last term
    (`overlayEdges`), so its line leaves from part 2.
  - Add `data-from={line.from} data-to={line.to}` to `<line>`.
- **Refactor:** none.
- **Acceptance criteria:**
  - The spec passes.
  - The existing overlay specs (hover dimming, the COMP3242 hover) pass
    unchanged.
  - `pnpm check` is green.
- **Depends on:** Task 6 (the stub must exist).

## 6. Phase Definition of Done

- [ ] Tasks 5–8 complete, their tests pass, and each is committed
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes, including `describe("card height budget")` and the invariants axe run
- [ ] The example plan at `/plan/example` shows COMP4550's marker in S1 2030 and its stub in S2 2030
- [ ] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| TS1 | Task 5 |
| TS2 | Task 6 |
| TS3 | Task 6 (recede, flash), Task 7 (drag outline) |
| TS7 | Task 8 |
| NF1 | Tasks 5, 6 |
| NF2 (stub name, axe) | Task 6 |
| NF4 | Tasks 5–8 |

## 8. Risks / open questions

None.
