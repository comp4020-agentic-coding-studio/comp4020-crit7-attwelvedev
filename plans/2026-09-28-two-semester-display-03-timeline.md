# Two-semester course display — Phase 03: Timeline

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28
- **Part of:** `plans/2026-09-28-two-semester-display-00-overview.md`. Read it
  first, especially §2 (TS1, TS2, TS3, TS7, NF1, NF2), §2.4, §3, §4.1 and
  §4.2 (the DOM contract).
- **Depends on phases:** 01 (`termSpanLabel`, `span`/`lastTerm`), 02 (its
  spec `describe("two-semester labels")` exists and this phase adds tests to
  it; Task 7 reshapes Task 4's `placedStatus` and `PlacedCourseRow`).

## 1. Summary

This phase makes the timeline show both semesters of a two-semester course:
- part 1 gets a marker line;
- the next column gets a compact part 2 stub;
- locating, receding and the drag outline treat both parts as one;
- a two-semester placed row gets a locate button per part, the second going
  to the stub;
- overlay arrows to dependents leave from the stub.

## 2. Requirements (this phase)

### 2.1 Functional

TS1, TS2, TS3 and TS7, all in full, and TS6's per-part locate buttons and
labels (Task 7; Task 4 already did its text).

### 2.2 Non-functional

- NF1: the stub is not `.course-card`, and the budget spec is re-run.
- NF2: the stub's accessible name and the row's per-part button names; axe
  stays clean.
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

The placed row and the locate plumbing (for Task 7), as Phase 02 left them:
- `src/components/PlacedCourseRow.tsx` imports
  `import { placedStatus } from "./planner-logic";`, has prop
  `onLocateCourse: (code: string) => void;` and renders:

  ```tsx
  const status = placedStatus(view, placement);
  …
  <p class="placed-row-status">
    {status.word}{" "}
    <button type="button" class="course-card-term-link" onClick={() => onLocateCourse(code)}
      aria-label={`${code} is ${status.spoken} — locate it on the timeline`}>
      {status.termLabel}
    </button>
    {status.rest && <> {status.rest}</>}
  </p>
  ```

- `placedStatus` (Task 4) computes `first` / `second` labels, returns the
  straddle object when `second && completedParts > 0 && !completed`, and
  otherwise a range or single label with `rest: null`.
- `planner-logic.test.ts` `describe("placedStatus")` has the COMP1100 /
  COMP1110 tests, a local `thesisAt(cutoff)` helper (COMP4550 at 4 on
  `emptyPlan()`), `"gives a two-semester course's range"` and
  `"splits a two-semester course straddling the cutoff"`, all asserting the
  Task 4 shape.
- `spec/layout.test.ts` `describe("two-semester labels")` has
  `"search's placed row shows the straddle and locates part 1"`, which finds
  the locate button by
  `/^COMP4550 is completed in S1 2029 and planned for S2 2029 — locate it on the timeline$/`.
  `planWithPlacement(code, term = 0)` takes a term.
- `onLocateCourse: (code: string) => void;` is declared in
  `CourseSearch.tsx` (line 20) and in both prop interfaces of
  `Sidebar.tsx` (lines 29 and 60), which only pass it down.
- `Planner.tsx`:
  `const [locateRequest, setLocateRequest] = useState<{ code: string; token: number } | null>(null);`
  (line 54), and the Sidebar gets
  `onLocateCourse={(code) => setLocateRequest({ code, token: Date.now() })}`
  (line 296).
- `Timeline.tsx` declares `locateRequest: { code: string; token: number } | null;`
  (line 27) under a comment about the sidebar's badge.

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
countsToward: string | null; completedParts: number; completed: boolean;

// src/components/planner-logic.ts (Task 4), which Task 7 replaces
export interface PlacedStatus {
  word: "Completed" | "Planned";
  termLabel: string;
  rest: string | null;
  spoken: string;
}
export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus;
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
- **Per-part row buttons (Task 7):** `placedStatus` returns one
  `PlacedPart` per locate button plus the `joiner` text between them. The
  row passes `part` 2 up through `onLocateCourse`, Planner puts it on the
  locate request, and the locate effect focuses the stub's button for it.
  Visible text is unchanged; only the buttons and their names split.
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

- [x] **Description:** add `partOneMarker` and render it as a line under
  the title of two-semester timeline cards.
- **Amended 2026-09-28 (user ruling, after the render check):** the first
  version (`e38cee9`) returned one string. At both marking viewports the
  13rem card broke that line inside the term label ("continues in S2 /
  2030"), and overview §2.4 says a term label never breaks inside itself.
  `partOneMarker` now returns the text and the term label separately, and
  the card holds the label in a no-wrap span, so any break falls before
  it. The visible text is unchanged. The steps below are the amended ones:
  the original spec and CSS steps still stand, alongside the added
  "Amendment" bullets.
- **Files touched:** `src/components/planner-logic.ts`,
  `src/components/planner-logic.test.ts`, `src/components/CourseCard.tsx`,
  `src/styles.css`, `spec/layout.test.ts`.
- **Tests first (red):**
  - `planner-logic.test.ts` `describe("partOneMarker")` (amended to the
    object shape, every value still pinned):
    - COMP4550 at 4 →
      `{ text: "Part 1 of 2 · continues in", termLabel: "S2 2029" }`;
    - COMP4550 at 7 (hard-blocked, `lastTerm` 8) →
      `{ text: "Part 1 of 2", termLabel: null }`;
    - COMP1100 at 0 → `null`.
    Build the views with `buildPlanView(cat, AACOM_2027, { ...emptyPlan(), placements: [...] })`.
  - `spec/layout.test.ts` `describe("two-semester labels")`,
    `"marks part 1 on the example plan's COMP4550 card"`:
    - `withPlan` at 1920×1080;
    - `[data-placed="COMP4550"] .course-card-part` innerText is
      `"Part 1 of 2 · continues in S2 2030"`;
    - no `[data-placed="COMP1130"] .course-card-part` exists.
  - **Amendment:** new
    `"keeps the marker's term label on one line"`, as an `it.each` at
    1920×1080 and 390×844 with `withPlan`:
    `[data-placed="COMP4550"] .course-card-part-term` exists, its innerText
    is `"S2 2030"`, and its text's client rects share one `top`. Measure it
    the way the Place in… range test does.
- **Implementation (green):**
  - `planner-logic.ts`:

    ```ts
    export interface PartOneMarker {
      text: string; // "Part 1 of 2 · continues in" / "Part 1 of 2"
      termLabel: string | null; // part 2's term, kept whole on the card; null in the final term
    }

    // The line under a two-semester card's title naming where part 2 is; a
    // course left in the final term (hard-blocked) has no part 2 term. The
    // term comes apart from the text so the card can keep it on one line.
    export function partOneMarker(view: PlanView, placement: PlacementView): PartOneMarker | null {
      if (placement.span !== 2) return null;
      const next = view.terms[placement.lastTerm];
      return next
        ? { text: "Part 1 of 2 · continues in", termLabel: next.label }
        : { text: "Part 1 of 2", termLabel: null };
    }
    ```

  - `CourseCard.tsx`: after `<CourseCardHeader …/>`, render
    `{marker && <p class="course-card-part">{marker.text}{marker.termLabel && <> <span class="course-card-part-term">{marker.termLabel}</span></>}</p>}`
    with `const marker = partOneMarker(view, placement);`.
  - `styles.css`: add `.course-card-part` to the
    `.course-card-offered, .course-card-allocation` rule. **Amendment:**
    add `.course-card-part-term { white-space: nowrap; }` after it, with a
    comment that a term label never breaks inside itself.
- **Refactor:** none.
- **Acceptance criteria:**
  - The tests pass, including the amendment's at both viewports.
  - `describe("card height budget")` passes unchanged.
  - `pnpm check` is green.
- **Depends on:** none in this phase (it uses the existing `span`/`lastTerm`).

### Task 6: Part 2 stub, with linked locate, flash and recede

- [x] **Description:**
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

### Task 7: Per-part locate buttons in placed rows

- [x] **Description:** a two-semester placed row (sidebar and search) gets
  one locate button per part: "Planned [S1 2029] – [S2 2029]", or when
  straddling "Completed [S1 2029] · planned [S2 2029]". The part 2 button
  scrolls to and focuses the stub's button, and both parts flash. A
  one-semester row, or a two-semester course with no part 2 term, keeps its
  single button. Added 2026-09-28 by user ruling, after Phase 02 shipped
  Task 4; it replaces Task 4's `PlacedStatus` shape (overview §4.1).
- **Files touched:**
  - `src/components/planner-logic.ts`, `src/components/planner-logic.test.ts`
  - `src/components/PlacedCourseRow.tsx`, `src/components/CourseSearch.tsx`,
    `src/components/Sidebar.tsx`
  - `src/components/Planner.tsx`, `src/components/Timeline.tsx`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - `planner-logic.test.ts` `describe("placedStatus")`: rewrite its tests
    to the new shape. This is a requirement change (overview TS6), not a
    loosened test: every value stays pinned with `toEqual`.
    - COMP1100 (cutoff 1) →
      `{ word: "Completed", parts: [{ termLabel: "S1 2027", spoken: "is completed in S1 2027" }], joiner: null }`;
    - COMP1110 →
      `{ word: "Planned", parts: [{ termLabel: "S2 2027", spoken: "is planned for S2 2027" }], joiner: null }`;
    - `"gives a two-semester course's range"`: `thesisAt(0)` →
      `{ word: "Planned", parts: [{ termLabel: "S1 2029", spoken: "part 1 is planned for S1 2029" }, { termLabel: "S2 2029", spoken: "part 2 is planned for S2 2029" }], joiner: "–" }`;
      `thesisAt(6)` → the same with `word: "Completed"` and spokens
      `"part 1 is completed in S1 2029"` / `"part 2 is completed in S2 2029"`;
    - `"splits a two-semester course straddling the cutoff"`: `thesisAt(5)` →
      `{ word: "Completed", parts: [{ termLabel: "S1 2029", spoken: "part 1 is completed in S1 2029" }, { termLabel: "S2 2029", spoken: "part 2 is planned for S2 2029" }], joiner: "· planned" }`;
    - new `"gives a final-term two-semester course one part"`: a view with
      COMP4550 at 7, cutoff 0 →
      `{ word: "Planned", parts: [{ termLabel: "S2 2030", spoken: "is planned for S2 2030" }], joiner: null }`.
  - `spec/layout.test.ts` `describe("two-semester labels")`:
    - in `"search's placed row shows the straddle and locates part 1"`,
      change the locate button's name to
      `/^COMP4550 part 1 is completed in S1 2029 — locate it on the timeline$/`.
      The `.placed-row-status` innerText assertion
      (`"Completed S1 2029 · planned S2 2029"`) and the focus check stay
      unchanged;
    - new `"a placed row's part 2 button locates the stub"`, same fixture
      (`planWithPlacement("COMP4550", 4)`, `PUT` cutoff 5, 1920×1080,
      search "COMP4550"):
      - click the row's button named
        `/^COMP4550 part 2 is planned for S2 2029 — locate it on the timeline$/`;
      - poll until
        `document.activeElement?.closest("[data-part-two]")?.getAttribute("data-part-two")`
        is `"COMP4550"`;
      - poll until the `.course-card-highlighted` elements'
        `data-placed` / `data-part-two` attributes are exactly
        `["COMP4550", "COMP4550"]` (as in Task 6's stub test).
- **Implementation (green):**
  - `planner-logic.ts`: replace `PlacedStatus` with overview §4.1's
    `PlacedPart` + `PlacedStatus`, and rewrite `placedStatus`, keeping its
    comment's point (per part, from the same `completedParts` the progress
    numbers use) and adding that each part is its own locate button:

    ```ts
    export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus {
      const first = view.terms[placement.term].label;
      const second = placement.span === 2 ? (view.terms[placement.lastTerm]?.label ?? null) : null;
      const says = (done: boolean, label: string) => `${done ? "completed in" : "planned for"} ${label}`;
      const firstDone = placement.completedParts > 0;
      if (!second) {
        return {
          word: firstDone ? "Completed" : "Planned",
          parts: [{ termLabel: first, spoken: `is ${says(firstDone, first)}` }],
          joiner: null,
        };
      }
      const secondDone = placement.completed;
      return {
        word: firstDone ? "Completed" : "Planned",
        parts: [
          { termLabel: first, spoken: `part 1 is ${says(firstDone, first)}` },
          { termLabel: second, spoken: `part 2 is ${says(secondDone, second)}` },
        ],
        joiner: firstDone && !secondDone ? "· planned" : "–",
      };
    }
    ```

    `termSpanLabel` stays imported (`menuTargets` uses it).
  - `PlacedCourseRow.tsx`:
    - import `type PlacedPart` alongside `placedStatus`;
    - prop `onLocateCourse: (code: string, part?: 2) => void`;
    - `const { word, parts, joiner } = placedStatus(view, placement);` and a
      local
      `const locate = (part: PlacedPart, which?: 2) => (<button type="button" class="course-card-term-link" onClick={() => onLocateCourse(code, which)} aria-label={\`${code} ${part.spoken} — locate it on the timeline\`}>{part.termLabel}</button>);`
    - render
      `<p class="placed-row-status">{word}{" "}{locate(parts[0])}{parts[1] && <>{" "}{joiner}{" "}{locate(parts[1], 2)}</>}</p>`,
      so innerText stays "Planned S1 2029 – S2 2029" /
      "Completed S1 2029 · planned S2 2029" / "Planned S1 2027".
  - `CourseSearch.tsx` (line 20) and `Sidebar.tsx` (lines 29 and 60): widen
    `onLocateCourse` to `(code: string, part?: 2) => void`. They only pass
    it through.
  - `Planner.tsx`:
    - `locateRequest` state type becomes
      `{ code: string; token: number; part?: 2 } | null`;
    - the Sidebar's prop becomes
      `onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}`.
      Task 6's Timeline `onLocateCourse` (the stub, to part 1) is
      unchanged.
  - `Timeline.tsx`:
    - `locateRequest` prop type becomes
      `{ code: string; token: number; part?: 2 } | null`, and its comment
      says a row's part 2 button asks for the stub;
    - in the locate effect as Task 6 leaves it (part 1 `el` plus
      `part2`), scroll to and focus
      `const target = (locateRequest.part === 2 && part2?.querySelector("button")) || el;`
      instead of `el` (typed `HTMLElement`, since `el` is already
      narrowed), with a comment that without a stub it falls back to part 1. The highlight still goes on both `el` and `part2`.
- **Refactor:** none.
- **Acceptance criteria:**
  - The rewritten and new tests pass.
  - The one-semester spec strings pass unchanged: `"Completed S1 2027"`,
    `"Planned S1 2027"`, `/^COMP1130 is planned for S1 2027/` and the
    locate tests' `/^COMP1100 is (completed in|planned for)/`.
  - Task 6's `"the part 2 stub locates part 1 and both flash"` passes
    unchanged.
  - `spec/invariants.test.ts` axe passes.
  - `pnpm check` is green.
- **Depends on:** Task 4 (Phase 02, `placedStatus`), Task 6 (the stub and
  the locate effect's `part2`).

### Task 8: Outline both terms while dragging a two-semester course

- [x] **Description:** while a two-semester course is dragged (mouse or
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
- **Depends on:** Task 7 (it edits the same Timeline and Planner lines).

### Task 9: Overlay arrows to dependents leave from part 2

- [x] **Description:** an overlay edge whose prerequisite (`from`) is a
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

- [x] Tasks 5–9 complete, their tests pass, and each is committed
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes, including `describe("card height budget")` and the invariants axe run
- [x] The example plan at `/plan/example` shows COMP4550's marker in S1 2030 and its stub in S2 2030
- [x] A straddling COMP4550's placed row has two locate buttons, and "S2 2029" focuses the stub
- [x] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| TS1 | Task 5 |
| TS2 | Task 6 |
| TS3 | Task 6 (recede, flash), Task 8 (drag outline) |
| TS6 (per-part buttons and labels) | Task 7 |
| TS7 | Task 9 |
| NF1 | Tasks 5, 6 |
| NF2 (stub name, row button names, axe) | Tasks 6, 7 |
| NF4 | Tasks 5–9 |

## 8. Risks / open questions

None.
