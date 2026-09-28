# Two-semester course display — Phase 04: Mirrored stub, per-part units, help and review

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-28. Amended the same
  day after Phase 03 shipped (ends `51b00d7`), in two user rulings:
  - the timeline shows each part's own units (TS10), and part 1's marker
    term locates part 2 (TS11);
  - then, for consistency, the part 2 stub mirrors part 1's card instead of
    being one whole-stub button (TS2 amended). The term label is the
    button to the other part, everywhere.

  These are new Tasks 10–11. The old Tasks 10–11 (help, review) became
  12–13.
- **Part of:** `plans/2026-09-28-two-semester-display-00-overview.md`. Read it
  first, especially §2 (TS2, TS9, TS10, TS11, NF1–NF3), §2.4, §3, §4.1,
  §4.2 and §6.
- **Depends on phases:** 01, 02, 03.

## 1. Summary

This phase:
- rebuilds the part 2 stub as a small card laid out like part 1's:
  - its first line is the code and that semester's units ("12u");
  - its second line is "Part 2 of 2 · continued from [S1 2030]", where
    only the term is a button, back to part 1;
- shows part 1's own units ("12u") instead of "12+12u";
- makes the term in part 1's marker ("S2 2030") a button to the stub;
- adds a Help section explaining two-semester courses;
- runs the two-viewport review with the user;
- closes out the feature.

## 2. Requirements (this phase)

### 2.1 Functional

TS2 (as amended), TS10 and TS11 in full (Tasks 10–11), then TS9 (Task 12),
which describes them too.

### 2.2 Non-functional

- NF1: the stub's term never breaks inside itself and the stub never
  overflows its column. The card height budget is re-run (the stub is
  still never `.course-card`).
- NF2: the stub's and the marker's term buttons are named like the placed
  row's buttons, and the stub's units have a spoken form; axe stays clean.
- NF3 (Task 13), plus a final re-run of NF1, NF2 and NF4.

### 2.3 Out of scope for this phase

- Any behaviour change beyond Tasks 10–11. If the review surfaces one, send
  it back through `plan-feature` as SKILL.md says, rather than patching it
  here.
- Units anywhere a course appears whole: the unplaced sidebar card and
  search-result cards keep "12+12u". Details shows no units, and gains none.
- Any change to `unitsLabel` or to how progress or term units are counted.

### 2.4 Assumptions

See overview §2.4. In particular:
- The example plan has COMP4550 at term 6: its marker reads "Part 1 of 2 ·
  continues in S2 2030", and its stub is in `[data-term="7"]`. It's planned
  in both parts, since the cutoff is 2.
- The API refuses COMP4550 at the final term (`POST …/placements` with
  term 7 returns 409, checked 2026-09-28). The "no part 2 term" case can't
  be set up in a browser spec. It's pinned at unit level instead, by
  `partOneMarker` and `placedStatus` (Tasks 5 and 7), which both drop part 2
  there.
- **Stub shape (prototyped and measured 2026-09-28, both viewports, in
  the running example plan):**
  - Head line "COMP4550 … 12u" fits easily.
  - "Part 2 of 2 · continued from" is 171px against 180px of line. With
    the 69px term button it wraps before the term, which then sits on its
    own line like part 1's "S2 2030". The term itself is one line.
  - The stub grows from 34px to 89px, with no horizontal overflow.
  - The user accepted a wrap before the term to keep the wording parallel
    with the card's "Part 1 of 2 · continues in".
- **Marker button (measured 2026-09-28):** swapping part 1's term span for
  a term-link button takes COMP4550's card from 286px to 291px. Only
  two-semester cards carry it, so the budget's median doesn't move.

## 3. Existing code context (verified 2026-09-28, at `51b00d7`)

`src/components/planner-logic.ts`:

```ts
// The short form fits a card's first line; the full one is what assistive
// technology hears, since "6u" reads aloud as a letter. A two-semester
// course's `units` is per semester, so it shows as that amount twice.
export function unitsLabel(course: { units: number; twoSemester: boolean }): UnitsLabel;
// { units: 12, twoSemester: true }  → { short: "12+12u", full: "12+12 units" }
// { units: 12, twoSemester: false } → { short: "12u", full: "12 units" }
```

`src/components/CourseCardHeader.tsx` takes
`units: { units: number; twoSemester: boolean }` and renders
`<span class="course-card-unit-count"><span aria-hidden="true">{label.short}</span><span class="visually-hidden">{label.full}</span></span>`
at the right of `.course-card-head`. It is shared by `CourseCard` (the
timeline card, its only user: `Timeline.tsx`) and `AvailableCourseCard`
(sidebar and search cards, `units={course}`).

`src/components/CourseCard.tsx`:
- It imports
  `import { familyOf, groupLabel, menuTargets, partOneMarker, unplacedCount, verifyBadgeText } from "./planner-logic";`.
- `interface Props` ends with
  `onShowGroup: (groupId: string) => void;`, then
  `// Outside the sidebar group under hover or focus.` and
  `receded: boolean;`. The destructured parameter list mirrors it.
- `const course = view.courses[placement.code];` and
  `const marker = partOneMarker(view, placement);`.
- The header is rendered as
  `<CourseCardHeader code={placement.code} title={course?.title ?? placement.code} units={course ?? { units: 0, twoSemester: false }} grip={!readOnly} onOpenDetails={…} />`.
- The marker:

  ```tsx
  {marker && (
    <p class="course-card-part">
      {marker.text}
      {marker.termLabel && (
        <>
          {" "}
          <span class="course-card-part-term">{marker.termLabel}</span>
        </>
      )}
    </p>
  )}
  ```

`src/components/PartTwoStub.tsx`:

```tsx
interface Props {
  code: string;
  startLabel: string;
  family: Family | null;
  receded: boolean;
  onLocate: () => void;
}
// …
<li class={`part-two-stub${receded ? " part-two-stub-receded" : ""}`} data-part-two={code} data-family={family ?? undefined}>
  <button type="button" aria-label={`${code} part 2 of 2, continued from ${startLabel}`} onClick={onLocate}>
    <strong>{code}</strong> · part 2 of 2
  </button>
</li>
```

`src/components/Timeline.tsx`:
- The prop, under a comment about the stub asking for its part 1:
  `onLocateCourse: (code: string) => void;`.
- `locateRequest: { code: string; token: number; part?: 2 } | null;`, and
  the locate effect already focuses the stub's button for `part === 2`
  (Task 7), with both parts flashing.
- `<CourseCard key={placement.code} view={view} placement={placement} … onShowGroup={onShowGroup} receded={recededFor(placement)} />`.
- The stub render:
  `<PartTwoStub key={\`${p.code}-2\`} code={p.code} startLabel={view.terms[p.term].label} family={p.countsToward ? familyOf(view, p.countsToward) : null} receded={recededFor(p)} onLocate={() => onLocateCourse(p.code)} />`.

`src/components/Planner.tsx`:
- To `<Timeline>`:
  `onLocateCourse={(code) => setLocateRequest({ code, token: Date.now() })}`.
- To `<Sidebar>`:
  `onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}`.

`src/components/PlacedCourseRow.tsx` builds its buttons as
`<button type="button" class="course-card-term-link" onClick={() => onLocateCourse(code, which)} aria-label={\`${code} ${part.spoken} — locate it on the timeline\`}>{part.termLabel}</button>`.

`src/styles.css`:
- `.course-card-term-link { padding: 0.1rem 0.45rem; font-size: inherit; border-radius: 0.35rem; }`;
- `.course-card-part-term { white-space: nowrap; }`, under a comment that a
  term label never breaks inside itself;
- `.course-card { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 0.7rem; padding: 0.55rem 0.8rem; }`;
- `.course-card-head { display: flex; align-items: center; gap: 0.35rem; }`
  and `.course-card-unit-count { margin-inline-start: auto; font-size: 0.8rem; color: var(--unigrey); font-variant-numeric: tabular-nums; }`.
  Neither is scoped to `.course-card`, so the stub can reuse them;
- `.course-card-offered, .course-card-allocation, .course-card-part { font-size: 0.85em; color: var(--unigrey); margin: 0.35rem 0 0; }`;
- a card recedes with
  `.course-card-hard, .course-card-receded { background: var(--paper); color: var(--muted); }`
  plus `.course-card-receded strong, .course-card-receded .course-card-title { color: var(--muted); }`
  (in a shared rule with the `-hard` selectors). `.course-card-part` keeps
  its unigrey;
- the stub rules, after
  `.term-cards .course-card[data-family]:not([data-family="neutral"])`
  and under a comment ("A two-semester course's second semester: a compact
  stub in the column after its card, never .course-card, so the card
  height budget doesn't measure it. It carries part 1's family strip."):

  ```css
  .part-two-stub { width: 13rem; flex-shrink: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 0.7rem; }
  .part-two-stub button { display: block; width: 100%; padding: 0.35rem 0.8rem; border: 0; background: none; font: inherit; font-size: 0.85em; color: var(--unigrey); text-align: start; cursor: pointer; }
  .part-two-stub button:hover, .part-two-stub button:focus-visible { text-decoration: underline; text-underline-offset: 0.15em; }
  .part-two-stub[data-family]:not([data-family="neutral"]) { box-shadow: inset 4px 0 0 var(--family); }
  .part-two-stub-receded { background: var(--paper); }
  .part-two-stub-receded button, .part-two-stub-receded strong { color: var(--muted); }
  ```

- `.visually-hidden` is absolutely positioned (1px, clipped), which is why
  `.course-card` is `position: relative`.

`spec/layout.test.ts` `describe("two-semester labels")`:
- It has `desktop`, `range`, and
  `highlighted(page)`, which lists `.course-card-highlighted` elements'
  `data-placed ?? data-part-two`.
- `"shows part 2 of the example's COMP4550 in the next term at $width×$height"`
  is an `it.each` over both viewports. It asserts: the stub
  `[data-term="7"] [data-part-two="COMP4550"]` count is 1; it has no
  `.course-card` class; its button is
  `getByRole("button", { name: "COMP4550 part 2 of 2, continued from S1 2030", exact: true })`
  (count 1); and its `data-family` equals part 1's.
- `"the part 2 stub locates part 1 and both flash"` clicks
  `[data-part-two="COMP4550"] button`, then polls for
  `document.activeElement` to have `data-placed="COMP4550"` and for
  `highlighted(page)` to be `["COMP4550", "COMP4550"]`.
- `"part 2 recedes with part 1"` hovers the `compulsory` heading toggle
  and polls for `[data-part-two="COMP4550"].part-two-stub-receded`.
- `"a placed row's part 2 button locates the stub"` polls
  `document.activeElement?.closest("[data-part-two]")`.
- `"draws COMP4550's arrow to COMP4620 from its part 2 stub"` checks that
  the line's start point lies inside the stub's bounding box.
- `"keeps the marker's term label on one line at $width×$height"` finds
  `[data-placed="COMP4550"] .course-card-part-term`, expects innerText
  `"S2 2030"`, and counts its text's distinct client-rect tops (must be 1).
- `"search's Place in… lists ranges for a two-semester course"` finds the
  search card with
  `page.locator(".course-search .course-card").filter({ hasText: "COMP4550" })`
  on a fresh plan (`POST /api/plans`).
- `describe("card header")` `"at %i×%i a timeline card leads with its code
  and units…"` reads units as
  `card.locator(".course-card-unit-count").locator('[aria-hidden="true"]')`
  and `.locator(".visually-hidden")`.

`src/pages/help.astro`:
- The sections are `<h2>` + `<p>`/`<dl>`, in this order: "The basics",
  "What a course card is telling you", "Completed semesters", "P&amp;C and
  TDP", "Pinning a course", "Keeping your plan".
- The "Completed semesters" paragraph ends with: "In the requirements list,
  a course you've placed shows as "Completed S1 2027" or "Planned S2 2028"
  to match — click the semester to find the course on the timeline. It's a
  simplification: it doesn't handle a failed or repeated course, part-time
  study, or leave of absence."
- House style: plain second person, curly quotes are avoided (the page uses
  straight `"`), `&amp;` is escaped, and ⋯ / ⋮⋮ name the controls.

`spec/layout.test.ts` loads `/help/` in several layout checks, including
the phone-width overflow and h1 sizing checks. `spec/invariants.test.ts`
runs axe on every route in `spec/routes.ts`.

### Interfaces from earlier phases (exact)

```ts
// src/components/planner-logic.ts (Task 5, amended)
export interface PartOneMarker {
  text: string; // "Part 1 of 2 · continues in" / "Part 1 of 2"
  termLabel: string | null; // part 2's term, kept whole on the card; null in the final term
}
export function partOneMarker(view: PlanView, placement: PlacementView): PartOneMarker | null;

// src/components/planner-logic.ts (Task 6)
export function partTwoPlacements(view: PlanView, term: number): PlacementView[];

// src/components/planner-logic.ts (Task 7)
export interface PlacedPart {
  termLabel: string; // this part's locate button text: "S1 2028"
  spoken: string; // its label after the code: "is planned for S1 2027" / "part 2 is planned for S2 2028"
}
export interface PlacedStatus {
  word: "Completed" | "Planned";
  parts: PlacedPart[]; // one per locate button, part 1 first; two only when part 2 has a term
  joiner: string | null; // between the two buttons: "–", or "· planned" when straddling; null with one part
}
export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus;

// Task 7: Timeline.tsx prop / Planner.tsx state
locateRequest: { code: string; token: number; part?: 2 } | null;
```

User-visible strings the help text must match exactly (after Tasks 10–11):
- **Timeline marker (Task 5):** `Part 1 of 2 · continues in <term>`, and
  from Task 11 `<term>` is a button that goes to part 2.
- **Stub (Tasks 6, 10):** a first line with `<CODE>` and the per-semester
  units (`12u`), then `Part 2 of 2 · continued from <term>`, where
  `<term>` is a button that goes to part 1.
- **Part 1's card (Task 10):** its per-semester units, `12u`.
- **Menu option (Task 3):** `S1 2028 – S2 2028`.
- **Sidebar row (Task 4):** `Planned S1 2028 – S2 2028`, or when
  straddling, `Completed S1 2028 · planned S2 2028`.
- **Sidebar row buttons (Task 7):** in a two-semester row each semester is
  its own button. The first goes to the card (part 1), the second to the
  part 2 marker.
- **Progress (Task 2):** each half's units count as completed once its own
  semester is before the "Completed through" boundary.

## 4. Approach

One rule for a two-semester course: **the term label is the button, and it
goes to the other part.** The placed row already works this way (Task 7).
This phase applies the rule to part 1's card and the stub.

- **The stub becomes a small card (Task 10):**
  - `PartTwoStub` renders part 1's layout in miniature. First comes a
    `.course-card-head` with `.course-card-code` and the
    `.course-card-unit-count` pair (`12u` visible, `12 units` spoken),
    reusing the card's unscoped classes. Then a `.course-card-part` line,
    "Part 2 of 2 · continued from", followed by the term as
    `<button class="course-card-term-link course-card-part-term">`, which
    locates part 1.
  - The whole-stub button goes, and its `.part-two-stub button` rules with
    it. The stub itself gets the card's padding and `position: relative`,
    and it's still never `.course-card`.
  - The term button's name comes from
    `placedStatus(view, p).parts[0].spoken`, like the placed row's part 1
    button: "COMP4550 part 1 is planned for S1 2030 — locate it on the
    timeline". `PartTwoStub` takes that `PlacedPart` in place of
    `startLabel`.
  - The stub keeps its only button, so the Task 6/7 specs that click
    `[data-part-two] button` and focus it via `part: 2` still work. The
    Timeline locate effect needs no change.
- **Part 1's units (Task 10):** the timeline card passes
  `{ units: course?.units ?? 0, twoSemester: false }` to
  `CourseCardHeader`, so `unitsLabel` gives "12u" / "12 units", one
  semester's worth. `AvailableCourseCard` is untouched, so the sidebar and
  search keep "12+12u". No new helper is needed.
- **Part 1's marker term (Task 11):**
  - The marker's `.course-card-part-term` span becomes the same term-link
    button, so the no-wrap rule and the one-line spec carry over.
  - Its name comes from `placedStatus(view, placement).parts[1].spoken`.
  - It calls a new CourseCard prop `onLocateCourse(code, 2)`. Timeline's
    `onLocateCourse` widens to `(code, part?: 2)` and is passed through,
    and Planner's Timeline wiring passes `part` on, as its Sidebar wiring
    already does.
  - With no part 2 term, `marker.termLabel` is null and `parts` has one
    entry, so no button renders.

## 5. Task breakdown

### Task 10: The stub mirrors part 1's card, and each part shows its own units

- [x] **Description:** the part 2 stub becomes a small card with part 1's
  layout. Its first line is the code and "12u" (spoken "12 units"). Its
  second line is "Part 2 of 2 · continued from [S1 2030]", where only the
  term is a button, and it locates part 1. The whole-stub button is gone.
  Part 1's timeline card shows "12u" (spoken "12 units") instead of
  "12+12u". Sidebar and search cards keep "12+12u". Added 2026-09-28 by
  user rulings (TS2 amended, TS10, the stub's half of TS11).
- **Files touched:** `src/components/PartTwoStub.tsx`,
  `src/components/Timeline.tsx`, `src/components/CourseCard.tsx`,
  `src/styles.css`, `spec/layout.test.ts`.
- **Tests first (red):** `spec/layout.test.ts` `describe("two-semester labels")`:
  - In `"shows part 2 of the example's COMP4550 in the next term at
    $width×$height"`, replace the stub-name assertion with: the stub holds
    exactly one `button`, and it is
    `getByRole("button", { name: /^COMP4550 part 1 is planned for S1 2030 — locate it on the timeline$/ })`
    (count 1). The count, no-`.course-card` and `data-family` assertions
    stay. This is the TS2 requirement change, not a loosened test.
  - New `"shows each part's own units on the timeline at $width×$height"`,
    an `it.each` at 1920×1080 and 390×844 with `withPlan`:
    - on `[data-placed="COMP4550"]` and on `[data-part-two="COMP4550"]`,
      `.course-card-unit-count [aria-hidden="true"]` textContent is
      `"12u"` and `.course-card-unit-count .visually-hidden` is
      `"12 units"`;
    - the stub's `.course-card-code` textContent is `"COMP4550"`, and its
      `.course-card-part` innerText is
      `"Part 2 of 2 · continued from S1 2030"`;
    - the stub's `.course-card-part-term` text is on one line: select its
      contents with a DOM Range and count the distinct rounded `top`s of
      `getClientRects()` (1), as the marker's one-line test does;
    - the stub doesn't overflow: its `scrollWidth` ≤ its `clientWidth`.
  - New `"keeps whole-course units on a search card"` (desktop): a fresh
    plan (`POST /api/plans`), search "COMP4550", and on
    `.course-search .course-card` filtered by "COMP4550" the
    `.course-card-unit-count [aria-hidden="true"]` textContent is
    `"12+12u"`. This one is a regression guard and is expected to pass on
    the red run. Say so when running it.
- **Implementation (green):**
  - `PartTwoStub.tsx`:
    - imports: `import type { PlacedPart } from "./planner-logic";` and
      `import { unitsLabel } from "./planner-logic";` (or one combined
      import);
    - Props become
      `{ code: string; part1: PlacedPart; units: number; family: Family | null; receded: boolean; onLocate: () => void }`.
      `part1` replaces `startLabel`, and `units` is per semester;
    - `const label = unitsLabel({ units, twoSemester: false });`;
    - render:

      ```tsx
      <li class={`part-two-stub${receded ? " part-two-stub-receded" : ""}`} data-part-two={code} data-family={family ?? undefined}>
        <div class="course-card-head">
          <strong class="course-card-code">{code}</strong>
          <span class="course-card-unit-count">
            <span aria-hidden="true">{label.short}</span>
            <span class="visually-hidden">{label.full}</span>
          </span>
        </div>
        <p class="course-card-part">
          Part 2 of 2 · continued from{" "}
          <button
            type="button"
            class="course-card-term-link course-card-part-term"
            onClick={onLocate}
            aria-label={`${code} ${part1.spoken} — locate it on the timeline`}
          >
            {part1.termLabel}
          </button>
        </p>
      </li>
      ```

    - rewrite the component comment: it mirrors part 1's card in
      miniature. It isn't draggable and has no menu, because part 1 is the
      one to move. Its term goes to part 1, as part 1's goes here.
  - `Timeline.tsx`:
    - add `placedStatus` to the `./planner-logic` import;
    - the stub render passes `part1={placedStatus(view, p).parts[0]}` in
      place of `startLabel={…}`, and `units={view.courses[p.code]?.units ?? 0}`.
  - `CourseCard.tsx`: pass
    `units={{ units: course?.units ?? 0, twoSemester: false }}` to
    `CourseCardHeader`, with a comment: a timeline card holds one
    semester, so it shows one semester's units, the amount the term's
    header counts. A two-semester course's other half shows its own on the
    stub.
  - `styles.css`, in the stub rules:
    - `.part-two-stub` gains `position: relative;` (for the
      visually-hidden units, as `.course-card` has it) and
      `padding: 0.35rem 0.8rem;`;
    - delete `.part-two-stub button { … }` and
      `.part-two-stub button:hover, .part-two-stub button:focus-visible { … }`;
    - the receded rules become
      `.part-two-stub-receded { background: var(--paper); color: var(--muted); }`
      and `.part-two-stub-receded strong { color: var(--muted); }`,
      mirroring `.course-card-receded`;
    - update the block comment: the stub is part 1's card in miniature,
      reusing its head and part-line classes.
- **Refactor:** none.
- **Acceptance criteria:**
  - The changed and new specs pass at both viewports.
  - `"the part 2 stub locates part 1 and both flash"`, `"part 2 recedes
    with part 1"`, `"a placed row's part 2 button locates the stub"` and
    `"draws COMP4550's arrow to COMP4620 from its part 2 stub"` pass
    unchanged.
  - `describe("card header")` `"at %i×%i a timeline card leads with its
    code and units…"` (COMP1130, "6u") passes unchanged.
  - `describe("card height budget")` passes unchanged.
  - `spec/invariants.test.ts` axe passes.
  - `pnpm check` is green.
  - The render at both viewports shows the stub as a small card: the code
    and "12u" on its first line, then the part line with "S1 2030" on a
    line of its own as a term button, the family strip, and no overflow.
    Part 1 shows "12u" (CLAUDE.md: the render is the truth).
- **Depends on:** Task 6 (the stub), Task 7 (`placedStatus` parts).

### Task 11: Part 1's marker term locates part 2

- [x] **Description:** the "S2 2030" in part 1's marker becomes the same
  term-link button, named like the placed row's part 2 button. It scrolls
  to and focuses the stub's button, and both parts flash. With no part 2
  term there's no button. Added 2026-09-28 by user ruling (part 1's half of
  TS11).
- **Files touched:** `src/components/CourseCard.tsx`,
  `src/components/Timeline.tsx`, `src/components/Planner.tsx`,
  `spec/layout.test.ts`.
- **Tests first (red):** `spec/layout.test.ts` `describe("two-semester labels")`,
  new `"part 1's marker term locates the part 2 stub at $width×$height"`,
  an `it.each` at 1920×1080 and 390×844 with `withPlan`:
  - in `[data-placed="COMP4550"]`, click the button named
    `/^COMP4550 part 2 is planned for S2 2030 — locate it on the timeline$/`;
  - poll until
    `document.activeElement?.closest("[data-part-two]")?.getAttribute("data-part-two")`
    is `"COMP4550"`;
  - poll until `highlighted(page)` is `["COMP4550", "COMP4550"]`.

  The existing `"marks part 1 on the example plan's COMP4550 card"` (innerText
  `"Part 1 of 2 · continues in S2 2030"`) and `"keeps the marker's term
  label on one line"` must pass unchanged. The final-term "no button" case
  is covered by construction (this file's §2.4): the button renders only when
  `marker.termLabel` and `parts[1]` exist, and Tasks 5 and 7's unit tests
  pin both as absent in the final term.
- **Implementation (green):**
  - `CourseCard.tsx`:
    - add `placedStatus` to the `./planner-logic` import;
    - add prop `onLocateCourse: (code: string, part?: 2) => void;` before
      `receded`, with a comment that the marker's term asks for the part 2
      stub through it, as the sidebar row's part 2 button does. Destructure
      it;
    - `const part2 = placedStatus(view, placement).parts[1];`;
    - replace the `<span class="course-card-part-term">` with
      `<button type="button" class="course-card-term-link course-card-part-term" onClick={() => onLocateCourse(placement.code, 2)} aria-label={\`${placement.code} ${part2.spoken} — locate it on the timeline\`}>{marker.termLabel}</button>`,
      rendered under `{marker.termLabel && part2 && (…)}`.
  - `Timeline.tsx`:
    - widen the prop to `onLocateCourse: (code: string, part?: 2) => void;`,
      and extend its comment: part 1's marker asks for the stub with
      `part` 2;
    - pass `onLocateCourse={onLocateCourse}` to `<CourseCard>`. The stub's
      `onLocate={() => onLocateCourse(p.code)}` is unchanged.
  - `Planner.tsx`: the Timeline's prop becomes
    `onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}`.
- **Refactor:** none.
- **Acceptance criteria:**
  - The new spec passes at both viewports.
  - `"marks part 1…"`, `"keeps the marker's term label on one line"` (both
    viewports), `"the part 2 stub locates part 1 and both flash"` and
    `"a placed row's part 2 button locates the stub"` pass unchanged.
  - `describe("card height budget")` passes unchanged.
  - `spec/invariants.test.ts` axe passes.
  - `pnpm check` is green.
  - The render at both viewports shows "S2 2030" as a term button on the
    marker's second line, matching the stub's "S1 2030", and not broken
    inside itself.
- **Depends on:** Task 7 (the locate-part-2 plumbing), Task 10 (same
  CourseCard and Timeline lines).

### Task 12: Help section on two-semester courses

- [ ] **Description:** add a Help section on two-semester courses, covering
  the behaviour as it stands after Tasks 10–11.
- **Files touched:** `src/pages/help.astro`, `spec/layout.test.ts`.
- **Tests first (red):** add `"explains courses that run over two
  semesters"` to `spec/layout.test.ts` next to the other `/help/` checks.
  It fetches `/help/` and asserts:
  - there is an `h2` whose text is exactly "Courses that run over two
    semesters";
  - the following paragraph contains "Part 1 of 2", "Part 2 of 2",
    "S1 2028 – S2 2028" and "Completed S1 2028 · planned S2 2028".
- **Implementation (green):** insert one new
  `<h2>Courses that run over two semesters</h2>` section straight after
  "Completed semesters", since it builds on that section's boundary idea.
  Write it in the page's voice. A starting draft, which the human review
  may reword:

  > Some courses, such as COMP4550 (12+12 units), must be taken twice, in
  > two semesters in a row. The planner places them once and they take up
  > both semesters, each showing its own 12 units. The first semester has
  > the full card, marked "Part 1 of 2 · continues in …", and the next has
  > a smaller one marked "Part 2 of 2 · continued from …". Click the
  > semester named on either to jump to the other part. The full card is
  > the one to move or remove. In "Place in…" and "Move to", these courses
  > list the pair of semesters they'd take, such as "S1 2028 – S2 2028".
  > Each half counts as completed on its own. If the "Completed through"
  > boundary falls between them, the requirements list shows "Completed S1
  > 2028 · planned S2 2028", and the progress bars count half the units as
  > done. There too, click either semester to find that part.

- **Refactor:** none.
- **Acceptance criteria:**
  - The spec passes.
  - The existing `/help/` layout and axe checks pass.
  - `pnpm check` is green.
- **Human review:** the rendered `/help/` section at 1920×1080. It passes
  if the user says it reads in the page's voice and is accurate to what
  they see on the timeline.
- **Depends on:** Tasks 3, 4, 5, 6, 7, 10, 11 (the strings and behaviour
  it describes).

### Task 13: Two-viewport review and close-out

- [ ] **Description:** run the app, walk the feature at both marking
  viewports with the user, then mark the feature done.
- **Files touched:**
  - `plans/2026-09-28-two-semester-display-00-overview.md` (§5 ticks,
    §6 boxes);
  - `specs/2026-09-28-two-semester-display.md` (`Status: Implemented`);
  - `PROCESS_LOG.md`, only if a qualifying moment happened (overview §3).
- **Tests first (red):** none. This task has no behaviour of its own, and
  `pnpm check` from Tasks 1–12 is the automated gate.
- **Implementation (green):** `pnpm build && pnpm preview` (or
  `pnpm dev`). At **1920×1080** and **390×844**, check each of these:
  1. `/plan/example`:
     - COMP4550 in S1 2030 shows "12u" and the "Part 1 of 2 · continues in
       S2 2030" line, with "S2 2030" as a term button;
     - S2 2030 shows the stub as a small card: "COMP4550 … 12u", then "Part
       2 of 2 · continued from S1 2030" with "S1 2030" as a term button,
       and the same colour strip as part 1;
     - the stub fits the column without overflow, and neither term breaks
       inside itself.
  2. Clicking the stub's "S1 2030" scrolls to and focuses part 1, and both
     flash. Clicking the marker's "S2 2030" scrolls to and focuses the
     stub's button, and both flash.
  3. Hovering the `compulsory` group heading recedes both parts.
  4. With "Show prerequisite links" on, in a plan with COMP4550 at term 4
     and COMP4620 at term 7, the arrow to COMP4620 leaves the stub.
  5. In that plan, set "Completed through" to S1 2029 (cutoff 5), then
     search COMP4550:
     - its row reads "Completed S1 2029 · planned S2 2029";
     - the Total reads 12 completed, 18 planned;
     - its "S1 2029" button focuses part 1, and its "S2 2029" button
       focuses the stub, with both flashing each time;
     - at 390×844 the row may wrap between words (overview §2.4), but no
       term label breaks inside itself.
  6. In that plan, COMP4550's Move to lists ranges only. Dragging it
     outlines two columns (mouse at desktop, touch emulation at phone).
  7. In a fresh plan, the search card for COMP4550 still shows "12+12u".
- **Refactor:** none.
- **Acceptance criteria:**
  - All seven checks were observed at both viewports.
  - `pnpm check` is green.
  - Overview §5 has every phase ticked and §6 has every box ticked.
- **Human review:** the rendered timeline and sidebar for checks 1–7 at
  both viewports. It passes when the user explicitly says the two-semester
  display is right, not on silence.
- **Depends on:** Task 12.

## 6. Phase Definition of Done

- [ ] Tasks 10–13 complete, and Tasks 10, 11 and 12 are each committed
- [ ] `pnpm check` passes, including `describe("card height budget")` and the invariants axe run
- [ ] The example plan shows "12u" on COMP4550's card and on its stub, the stub's "S1 2030" focuses part 1, and the marker's "S2 2030" focuses the stub
- [ ] The user has explicitly accepted Task 12's and Task 13's human reviews
- [ ] Tick Phase 04 in overview §5, complete overview §6, and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| TS2 (as amended: stub mirrors the card) | Task 10 |
| TS10 | Task 10 |
| TS11 | Task 10 (the stub's term), Task 11 (part 1's term) |
| TS9 | Task 12 |
| NF1 (no term break, no overflow, budget re-run) | Tasks 10, 11, 13 |
| NF2 (term-button names, spoken units, axe) | Tasks 10, 11 |
| NF3 | Task 13 |
| NF4 | Tasks 10–13 |

## 8. Risks / open questions

None.
