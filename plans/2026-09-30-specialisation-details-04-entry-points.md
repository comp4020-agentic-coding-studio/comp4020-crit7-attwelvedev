# Specialisation details — Phase 04: Entry points

- **Date:** 2026-09-30
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-29 (spec) and 2026-09-30
- **Part of:** `plans/2026-09-30-specialisation-details-00-overview.md`.
  Read it first, especially §2 (SD6–SD9, SD24) and §3. Background: the
  spec's §4.1 wireframes "Sidebar", "Search palette" and "Course panel, the
  new line".
- **Depends on phases:** 01 and 02. It is independent of 03, and the two
  can run in either order.

## 1. Summary

Students get three ways to open a specialisation:

- a "Details" button beside each option of the sidebar's "Choose
  Specialisation" fieldset, plus the chosen spec's heading as a link (which
  is also tinted while its panel is open)
- specialisation results in the search palette
- an "On the lists of: …" line at the top of every listed course's details

## 2. Requirements (this phase)

### 2.1 Functional

- SD6 and SD7: Task 9.
- SD24: Task 9.
- SD8: Task 10.
- SD9: Task 11.

### 2.2 Non-functional

N1 for each new control: it's axe-clean, has a 2.75rem target, and its
status is in text.

### 2.3 Out of scope for this phase

- The palette's input label stays "Search courses by code or title", and
  its placeholder stays "e.g. COMP1100". The Phase 04 ruling of the
  workspace-redesign (WR27, commit 0d6af44) settled that label.
- The wide-layout sweep (Phase 05).

### 2.4 Assumptions

See overview §2.4. Only the `spec` choice group has spec pages.
`specialisationByGroup` is null for capstone options, so they get no
Details button.

## 3. Existing code context (verified 2026-09-30)

**`src/components/Sidebar.tsx`** (563 lines):

- The `Props` and `GroupProps` interfaces carry `onOpenDetails: (code:
  string, focus?: DetailsFocus) => void`, `openCode: string | null` and
  `linked: LinkedHighlights | null`. `Group` recurses, passing props down
  explicitly (lines 218-235).
- The choice fieldset (lines 166-182):
  ```tsx
  {group.selectable && (
    <fieldset aria-busy={choicePending}>
      <legend>Choose {group.label}</legend>
      {group.options.map((option) => (
        <label key={option.id}>
          <input type="radio" name={`choice-${group.id}`} checked={group.chosenId === option.id} disabled={readOnly || choicePending} onChange={() => choose(option.id)} />
          {option.label}
        </label>
      ))}
    </fieldset>
  )}
  ```
- The tint:
  ```tsx
  const isHome = linked !== null && linked.home === group.id;
  ```
  At depth > 0 it renders:
  ```tsx
  <li data-group={group.id} class={isHome ? "group-linked" : undefined} data-family={isHome ? group.family : undefined}>
  <Heading tabIndex={-1} onMouseEnter={() => onFocusGroup(group.id)} onMouseLeave={() => onFocusGroup(null)}>{group.label}</Heading>
  ```
  At depth 0 it passes `linked={isHome}` to `SidebarSection`.
- The chosen spec's group (e.g. `arin`) renders at depth 1, inside the
  `spec` section.

**`src/components/SearchPalette.tsx`** (245 lines):

- `Props` includes `onOpenDetails: (code: string) => void`, `onAnnounce`,
  `openCode: string | null` and `view: PlanView`.
- `const TITLES = ".course-card-title, .placed-row-title";` drives the
  arrow keys.
- `onSubmit`:
  ```ts
  const result = await searchCourses(q, planId);
  setResults(result.courses);
  onResults(result.courses);
  const message = outcomeMessage(result, q);
  setStatus({ query: q, message });
  onAnnounce(message);
  ```
- The results area:
  ```tsx
  {pending && <p class="course-search-status">Searching…</p>}
  {!pending && status && results.length === 0 && <p class="course-search-status">{status.message}</p>}
  ```
  followed by `ul.available-courses.course-search-results` and
  `ul.placed-rows.course-search-placed`.
- A local `function openDetails(code)` calls `onClose()` and then
  `onOpenDetails(code)`.

**`src/components/search-message.ts`:**
`export function outcomeMessage(result: SearchResult, query: string): string`.
It has cases for found (`Found 1 course matching "q"` / `Found N courses
matching "q"`), fetched, not_found (two wordings), error and invalid. Its
test is `src/components/search-message.test.ts`.

**`src/components/CourseDetailsPanel.tsx`,** after Phase 02 Task 4, renders
through `DetailsFrame`, with its body as
`children={() => (…sections…)}`. The first section is "In your plan"
(placed only), then "When it runs".

**`src/styles.css`:**

- `.details-body > .details-section:first-child { border-block-start: 0 }`
  (1696).
- In `@container details (min-width: 628px)`,
  `.details-body > .details-section:nth-child(2) { border-block-start: 0 }`
  (1715).
- `.placed-row-title` hover and focus underline (2767-2790).
- `.group-linked` (2948) and `.family-dot` (3000).

**Tests that pin behaviour here:**

- `spec/layout/undo.test.ts:283` selects the radio with
  `fieldset.getByLabel("Human-Centred & Creative Computing")`. Playwright's
  `getByLabel` also matches `aria-label` by substring, so the new button
  named "Details: Human-Centred & Creative Computing" would make it match
  two elements. Phase 03's `specialisation-details.test.ts` "says Switched
  when the radio changes an existing choice" does the same.
- `spec/layout/search-palette.test.ts` covers the palette (298 lines). This
  phase's new cases go in `specialisation-details.test.ts`.
- `spec/layout/helpers.ts`:
  - `baseUrl` and `useBrowser()`.
  - `openSearch(page)` opens the palette and waits for `.palette input`.
  - `planWithPlacement(code, term = 0): Promise<string>` returns an
    editable plan's id, with nothing chosen.

  The toast is `.undo-toast` (`role="status"`).

### Interfaces from earlier phases (exact)

From Task 2 (`src/data/specialisations.ts`):

```ts
export interface SpecialisationInfo extends SpecialisationData { groupId: string; label: string; lists: SpecList[] }
// SpecialisationData has: code, title, url, year, scrapedAt, minUnits, introduction, topics, learningOutcomes, requirements, otherInformation, relevantDegrees
export const SPECIALISATIONS: SpecialisationInfo[];
export function specialisationByCode(code: string): SpecialisationInfo | null;
export function specialisationByGroup(groupId: string): SpecialisationInfo | null;
export function specialisationsListing(courseCode: string): SpecialisationInfo[];
```

From Task 3 (`src/components/details-state.ts`):

```ts
export function courseCode(state: DetailsState): string | null;
export function specCode(state: DetailsState): string | null;
```

From Task 5:

- In `Planner.tsx`, `function openSpec(code: string)` opens
  `{ kind: "spec", code }`, recording the opener. `openDetails(code,
  focus?)` opens a course.
- In `spec-logic.ts`, `export function chosenSpecGroup(view: PlanView):
  string | null;`.
- The test file `spec/layout/specialisation-details.test.ts`, and the panel
  `aside[aria-label="Specialisation details"]`, whose h2 contains the code.

## 4. Approach

### 4.1 Sidebar (Task 9)

- **New props** on `Props` and `GroupProps`: `onOpenSpec: (code: string) =>
  void; openSpecCode: string | null`, passed through the recursion.
- **Each option** becomes:
  ```tsx
  <div class="choice-option" key={option.id}>
    <label>…radio… {option.label}</label>
    {spec && (
      <button type="button" class="choice-details" aria-label={`Details: ${option.label}`}
        aria-current={openSpecCode === spec.code ? "true" : undefined}
        onClick={() => onOpenSpec(spec.code)}>Details</button>
    )}
  </div>
  ```
  Here `const spec = specialisationByGroup(option.id)`. It works on
  read-only plans too, since it only reads.
- **The chosen heading:** when `specialisationByGroup(group.id)` is set,
  the heading's content is
  `<button type="button" class="requisite-code choice-heading-link" onClick={() => onOpenSpec(spec.code)}>{group.label}</button>`.
  The heading keeps its `tabIndex={-1}` and hover handlers.
- **The tint:** `const specHome = openSpecCode !== null && specialisationByCode(openSpecCode)?.groupId === group.id;`
  and `const isHome = (linked !== null && linked.home === group.id) || specHome;`.
  The "counts here" tag stays only for `linked`.
- **CSS:**
  - `.choice-option`: flex, align-items center.
  - `.choice-details`: right after its label (*amended at Task 9's review,
    2026-09-30:* not `margin-inline-start: auto`, which pushed it about
    1000px from its label in a three-column region), no border or background,
    `var(--muted)`, min-height 2.75rem, padding-inline 0.5rem. Underline on
    hover and focus-visible, as `.placed-row-title` does.
    `[aria-current="true"]` is `var(--gold-ink)`, weight 600.
- **Planner** passes `onOpenSpec={openSpec}` and
  `openSpecCode={specCode(details)}`.

### 4.2 Search (Task 10)

In `spec-logic.ts`:

```ts
export function matchSpecialisations(query: string): SpecialisationInfo[];
```

It returns SPECIALISATIONS order.

- An empty query matches nothing.
- **Code match:** the trimmed, upper-cased query matching
  `/^[A-Z]{4}(-SPEC)?$/`, where the spec's code starts with its first four
  letters followed by "-".
- **Otherwise a word match:** every query word (lower-cased, split on
  non-letters, only those of 3+ letters counted, at least one required) is
  a prefix of some word in `title` or `label`, lower-cased and split on
  non-letters.

In `search-message.ts`:
`export function outcomeMessage(result: SearchResult, query: string, specCount = 0): string`.

- With `specCount > 0` and status `found`: `Found ${n} course${s} and
  ${k} specialisation${s} matching "${query}"`.
- With `specCount > 0` and status `not_found`: `Found ${k}
  specialisation${s} matching "${query}"`.
- Everything else is unchanged.

In `SearchPalette.tsx`:

- New props `onOpenSpec: (code: string) => void; openSpecCode: string |
  null`.
- New state `specResults`. `onSubmit` sets it from
  `matchSpecialisations(q)` before awaiting the API, and passes its length
  to `outcomeMessage`.
- The status paragraph shows only when `results.length === 0 &&
  specResults.length === 0`.
- Before the course lists, when there are spec results:
  ```tsx
  <section class="palette-specs" aria-label="Specialisations">
    <h3>Specialisations</h3>
    <ul class="palette-spec-rows">
      {specResults.map((s) => (
        <li key={s.code} class="palette-spec-row" data-family="specialisation">
          <button type="button" class="palette-spec-title" aria-current={openSpecCode === s.code ? "true" : undefined} onClick={() => openSpec(s.code)}>
            <strong>{s.code}</strong> {s.title}
          </button>
          <span class="palette-spec-meta">{s.minUnits} units, Specialisation</span>
          {chosenSpecGroup(view) === s.groupId && <span class="palette-spec-status">Chosen</span>}
        </li>
      ))}
    </ul>
  </section>
  ```
  A local `openSpec` closes the palette first, then calls `onOpenSpec`.
- `TITLES` becomes `".palette-spec-title, .course-card-title, .placed-row-title"`.
- **CSS:** `.palette-spec-row` is `var(--surface)`, with
  `box-shadow: inset 4px 0 0 var(--family)`, the `.placed-row` grid
  (code/title, meta, status) and the palette's padding. `.palette-spec-title`
  is styled like `.placed-row-title` (it's a button).
- **Planner** passes `onOpenSpec={openSpec}` and
  `openSpecCode={specCode(details)}`.

### 4.3 Course panel line (Task 11)

- **New prop** on `CourseDetailsPanel`: `onOpenSpec: (code: string) =>
  void`, which Planner passes as `openSpec`.
- **The line.** `const listings = specialisationsListing(code);` When it's
  non-empty, the body starts with:
  ```tsx
  <p class="details-lists">On the lists of:{" "}
    {listings.map((s, i) => (
      <Fragment key={s.code}>
        {i > 0 && (i === listings.length - 1 ? " and " : ", ")}
        <span class="family-dot" data-family="specialisation" aria-hidden="true" />
        <button type="button" class="requisite-code details-lists-link" onClick={() => onOpenSpec(s.code)}>{s.title}</button>
        {chosenSpecGroup(view) === s.groupId && " (your specialisation)"}
      </Fragment>
    ))}
  </p>
  ```
  It uses P&C's `title`, which matches the spec panel's own heading.
- **CSS:**
  - `.details-lists`: `grid-column: 1 / -1`, 0.9rem, and margin-block
    0.25rem 0.75rem.
  - The rule-less first section has to survive the new first child:
    - `.details-body > .details-lists + .details-section { border-block-start: 0 }`
    - in the container query,
      `.details-body > .details-lists ~ .details-section:nth-child(3) { border-block-start: 0 }`,
      with the existing `nth-child(2)` rule applying only when there's no
      `.details-lists`:
      `.details-body:not(:has(> .details-lists)) > .details-section:nth-child(2)`

## 5. Task breakdown

### Task 9: Sidebar Details buttons, chosen-heading link and tint

- [x] **Description.** This file's §4.1.
- **Files touched:**
  - `src/components/Sidebar.tsx`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/layout/undo.test.ts:283`: use
    `fieldset.getByRole("radio", { name: "Human-Centred & Creative Computing" })`.
    That's the same radio, now found unambiguously; the change is in the
    commit message.
  - `spec/layout/specialisation-details.test.ts`, including the same fix
    to Phase 03's "says Switched when the radio changes an existing
    choice" (its `getByLabel("Human-Centred & Creative Computing")`, found
    at execution on 2026-09-30).
- **Tests first (red),** at 1920:
  1. On `/plan/example`, the "Choose Specialisation" group has four buttons
     named `Details: <label>`: Artificial Intelligence, Human-Centred &
     Creative Computing, Systems & Architecture, and Theoretical Computer
     Science. The capstone fieldset has none.
  2. Selecting "Details: Systems & Architecture":
     - The Specialisation details panel opens on SYAR-SPEC, with URL
       `spec=SYAR-SPEC`.
     - That button has `aria-current="true"`.
     - No radio changes: ARIN's stays checked.
  3. Clicking the text "Artificial Intelligence" in the label still selects
     its radio. Use an editable plan with nothing chosen, and check the
     toast says "Chose Artificial Intelligence for Specialisation.".
  4. On `/plan/example`, the chosen heading `[data-group="arin"] >
     h3 button` opens ARIN-SPEC. While it's open, `[data-group="arin"]` has
     the class `group-linked`. After Close it doesn't.
  5. axe is `[]` at 1920 and 390, with the panel open from a Details
     button.
- **Implementation (green).** Per this file's §4.1.
- **Refactor.** None.
- **Acceptance criteria:**
  - The tests pass.
  - `spec/layout/undo.test.ts` and `sidebar-groups.test.ts` pass.
  - `pnpm check` is green.
- **Human review.** The user looks at the Specialisation section at 1920
  (a three-column requirements region and a one-column one) and at 390.
  A pass means:
  - "Details" reads as a quiet secondary action beside each option.
  - A long label ("Human-Centred & Creative Computing") wraps without
    pushing the button off the row.
  - The tint on the chosen group while its panel is open matches the
    course tint.

  The task isn't done until the user says so explicitly.

  *Accepted 2026-09-30,* with Details kept beside its label rather than at
  the row's end (§4.1 amended).
- **Depends on:** Task 5.

### Task 10: Specialisation results in the search palette

- [ ] **Description.** This file's §4.2.
- **Files touched:**
  - `src/components/spec-logic.ts`
  - `src/components/spec-logic.test.ts`
  - `src/components/search-message.ts`
  - `src/components/search-message.test.ts`
  - `src/components/SearchPalette.tsx`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/layout/specialisation-details.test.ts`
- **Tests first (red):**
  - Unit, `matchSpecialisations`:
    - "arin", "ARIN" and "arin-spec" give `[ARIN-SPEC]`.
    - "theoretical" gives `[THCS-SPEC]`.
    - "systems" gives `[SYAR-SPEC]`.
    - "human centred" gives `[HCCC-SPEC]`.
    - "artificial intelligence" gives `[ARIN-SPEC]`.
    - "COMP1100", "" and "ai" (under 3 letters) give `[]`.
  - Unit, `outcomeMessage`:
    - `not_found` with 1 spec gives `Found 1 specialisation matching
      "ARIN"`.
    - `found` with 2 courses and 1 spec gives `Found 2 courses and 1
      specialisation matching "artificial intelligence"`.
    - With `specCount` 0, every existing case is unchanged (the existing
      tests stay as they are).
  - Browser, 1920, `/plan/example`:
    1. Open search, type "ARIN", submit. An h3 "Specialisations" is shown,
       and one `.palette-spec-row` containing "ARIN-SPEC", "Artificial
       Intelligence", "24 units, Specialisation" and "Chosen". No "No
       course found" status is visible.
    2. ArrowDown from the input focuses `.palette-spec-title`. Enter
       closes the palette and opens the ARIN-SPEC panel.
    3. "artificial intelligence" shows the spec row above the course
       card(s) (COMP3620 among them).
    4. axe is `[]` with the results shown, at 1920 and 390 (full-screen
       palette).
- **Implementation (green).** Per this file's §4.2.
- **Refactor.** None.
- **Acceptance criteria:**
  - The tests pass.
  - `spec/layout/search-palette.test.ts` passes unchanged.
  - `pnpm check` is green.
- **Depends on:** Task 5.

### Task 11: "On the lists of" line in a course's details

- [ ] **Description.** This file's §4.3.
- **Files touched:**
  - `src/components/CourseDetailsPanel.tsx`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/layout/specialisation-details.test.ts`
- **Tests first (red):**
  1. On `/plan/example?course=COMP3670` at 1920, the body's first child is
     `p.details-lists`. Its text is "On the lists of: Artificial
     Intelligence (your specialisation) and Human-Centred and Creative
     Computing". Both names are buttons.
  2. Selecting "Human-Centred and Creative Computing" opens HCCC-SPEC. Back
     returns to COMP3670.
  3. `?course=COMP1100` has no `.details-lists`.
  4. **The rule survives:** on `?course=COMP3670`,
     - narrow: the first `.details-section` has a computed
       `border-top-width` of "0px"
     - after "Widen details": the first section in each column (the 1st and
       2nd `.details-section`) has "0px"
  5. axe is `[]`.
- **Implementation (green).** Per this file's §4.3.
- **Refactor.** None.
- **Acceptance criteria:**
  - The tests pass.
  - `spec/layout/details.test.ts` passes unchanged.
  - `pnpm check` is green.
- **Depends on:** Task 5.

## 6. Phase Definition of Done

- [ ] Tasks 9–11 are complete and their tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] A specialisation opens from all three places, and each opening joins
  the one back/forward trail
- [ ] Task 9's human review is explicitly accepted by the user
- [ ] Tick Phase 04 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| SD6 | Task 9 |
| SD7 | Task 9 |
| SD24 | Task 9 |
| SD8 | Task 10 |
| SD9 | Task 11 |
| N1 (new controls) | Tasks 9, 10, 11 |

## 8. Risks / open questions

None.
