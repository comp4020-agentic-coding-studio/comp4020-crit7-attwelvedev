# Specialisation details — Phase 02: Panel

- **Date:** 2026-09-30
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-29 (spec) and 2026-09-30
  (planning rulings)
- **Part of:** `plans/2026-09-30-specialisation-details-00-overview.md`.
  Read it first, especially §2 (SD10–SD15, SD19–SD23), §3 and §4.2.
  Background for this phase: the spec's §4.1 wireframes "Desktop docked,
  narrow" and "Chosen".
- **Depends on phases:** 01.

## 1. Summary

The details panel learns to show a specialisation as well as a course:

- typed subjects in the panel state, with one back/forward trail labelled
  Back and Forward
- `?spec=` rendered on the server
- a `DetailsFrame` shell extracted from `CourseDetailsPanel` and shared by
  both panels
- a new `SpecialisationDetailsPanel` with every P&C section, the chosen
  spec's "In your plan" block, and the course lines' plan status

After this phase, `/plan/example?spec=ARIN-SPEC` renders the whole P&C page.
The unchosen "Fit with your plan" block is Phase 03, and the entry points
are Phase 04.

## 2. Requirements (this phase)

### 2.1 Functional

- SD10: all of it (Task 5).
- SD11: the shared trail and Back/Forward (Task 3); the frame (Task 4).
- SD12: all of it (Tasks 3, 5).
- SD13: the accessible names (Task 4).
- SD14: all of it (Task 5).
- SD15: all of it, including the phone tab and peek (Task 5).
- SD19: blocks, tags, course lines, and the chosen-spec status (Task 5).
  Phase 03 adds the what-if suffixes.
- SD20, SD21, SD22, SD23: all of them (Task 5).

### 2.2 Non-functional

- N1 for the new panel (axe at both viewports).
- N3: no spec data in `PlanView`.
- N5: browser tests go in the new `spec/layout/specialisation-details.test.ts`.

### 2.3 Out of scope for this phase

- The unchosen planning block and the Choose/Switch button (Phase 03).
- The sidebar, search and course-panel entry points (Phase 04).
- The wide two-column wrappers and the all-states sweep (Phase 05).

Until Phase 03 lands, an unchosen spec simply has no planning section.

### 2.4 Assumptions

See overview §2.4. Every code on a spec list and in its prose is in
`view.courses`, so `canOpen = (c) => c in view.courses` holds for all of
them.

## 3. Existing code context (verified 2026-09-30)

**`src/components/details-state.ts`** (51 lines) exports:

```ts
export type DetailsFocus = "top" | "requisites";
export interface DetailsState { code: string | null; history: string[]; index: number; focus: DetailsFocus; token: number; }
export const EMPTY_DETAILS: DetailsState = { code: null, history: [], index: -1, focus: "top", token: 0 };
const COURSE_CODE = /^[A-Z]{4}\d{4}$/;
export function openCourse(state: DetailsState, code: string, focus: DetailsFocus = "top"): DetailsState
export function stepHistory(state: DetailsState, dir: -1 | 1): DetailsState
export function closeDetails(state: DetailsState): DetailsState   // { ...state, code: null }
export function courseParam(search: string): string | null
export function withCourseParam(href: string, code: string | null): string
```

- `openCourse` bumps `token`. Re-opening the same subject keeps the history
  and only changes `focus` and `token`. Opening after stepping back drops
  the entries ahead.
- `src/components/details-state.test.ts` tests exactly these.

**`src/pages/plan/[id].astro`:**

```astro
const courseCode = courseParam(Astro.url.search);
const initialDetails = view && courseCode ? getCourseDetails(courseCode, id) : null;
<Planner client:load view={view} title={title} initialDetails={initialDetails} />
```

**`src/components/Planner.tsx`** (853 lines). The relevant pieces:

- `interface Props { view: PlanView; title: string; initialDetails?: CourseDetailsView | null }`
- The state:
  ```ts
  const [details, setDetails] = useState<DetailsState>(() =>
    initialDetails ? { ...openCourse(EMPTY_DETAILS, initialDetails.course.code), token: 0 } : EMPTY_DETAILS)
  ```
- The URL effect:
  `window.history.replaceState(null, "", withCourseParam(location.href, details.code))`,
  with deps `[details.code]`.
- `useCourseDetails(details.code, initialView.plan.id, initialDetails)`.
- `function openDetails(code: string, focus: DetailsFocus = "top")`: it
  records `openerRef` when nothing is open, calls
  `setDetails((s) => openCourse(s, code, focus))`, and locates a placed
  course.
- A close effect returns focus to `openerRef` when `details.code` becomes
  null.
- `layoutInput.detailsOpen: details.code !== null`.
- `const linked = details.code ? linkedHighlights(view, details.code, knownCards[details.code]) : null;`
- `openCode={details.code}` is passed to Timeline, Sidebar and SearchPalette.
- `function showInSidebar(kind: ShowRequest["kind"], id: string)`: on a
  phone (`stacked`) it calls `setTab("requirements")`, when folded it
  unfolds, then it calls `setShowRequest({ kind, id, token: Date.now() })`.
- The panel is built in `const detailsPanel = details.code && (<CourseDetailsPanel view details card fetched onOpen onBack onForward onClose onPlace onRemove onAction mode wide onToggleWide />)`.
  It's placed inside `.planner-panes` when
  `detailsInPanes = sideBySide && (mode docked || drawer)`, otherwise after
  them.
- `onBack` is `setDetails((s) => stepHistory(s, -1))`, `onForward` the
  same with `1`, and `onClose` is `setDetails(closeDetails)`. The details
  divider's close release also calls `setDetails(closeDetails)`.

**`src/components/CourseDetailsPanel.tsx`** (667 lines):

- It holds `SheetHandle` (lines 113-206, with detents
  `peek`/`half`/`full` from `./sheet-detent`) and `Icon` (lines 208-214).
- Its component state: `const [detent, setDetent] = useState<Detent>("half")`,
  reset on `details.token`, and `dragHeight`.
- It renders:
  ```tsx
  <aside id="course-details" class="details-panel region" data-mode={mode} data-detent={sheet ? detent : undefined} data-dragging=… style={--sheet-h} aria-label="Course details" onKeyDown={Escape → onClose}>
  ```
  - Then `div.details-head(.sheet-head).glass`, containing:
    - `div.details-nav`: Previous and Next (`aria-label="Previous course"` /
      `"Next course"`, disabled at the ends), the `SheetHandle` when
      `sheet`, the wide toggle only when `mode === "docked"`, and Close
      (`aria-label="Close details"`)
    - `<h2 ref={headingRef} tabIndex={-1}>` with `.details-code`,
      `.details-meta` and `.details-title`
    - `ul.details-pills`
  - Then `div.details-body`, `hidden={sheet && detent === "peek" && dragHeight === null}`.
  - Then `footer.details-footer`: the `ExternalLink` "Open <code> on
    Programs & Courses" and `.details-note` "Details from Programs & Courses
    <edition>, updated <date>".
- `ExternalLink` (lines 71-81) and `dateLabel` (lines 86-90, UTC "28 Sep
  2026") are module-local.
- A focus effect focuses `headingRef` (or `requisitesRef`) on each
  `details.token` other than 0.
- The description clamp:
  ```ts
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  useEffect(() => { const el = descriptionRef.current; if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 1); }, [code, card?.description, expanded]);
  ```
  It renders `<p ref class={expanded ? "details-description" : "details-description details-clamped"}>` plus
  `button.details-more[aria-expanded]` reading "Read the full description" /
  "Show less".
- The course leaf markup to copy for course lines comes from
  `RequisiteTree.tsx`:
  ```tsx
  <li><span class="requisite-line"><span class="mark-dot" aria-hidden="true" /><span><button type="button" class="requisite-code" onClick>{code}</button>{` ${title}`}<span class="requisite-where">{where}</span></span></span></li>
  ```
  It sits inside `<ul class="requisite-tree">`.

**`src/components/planner-logic.ts`:**

- `groupLabel(view, groupId): string`
- `groupPath(view, groupId): GroupView[]`
- `familyOf(view, groupId | null): Family`
- `placedStatus(view, placement): PlacedStatus`, used as
  `${status.word} ${status.parts[0].termLabel}`
- `unitsLabel(course): { short; full }`, where `full` is "6 units"

**`src/components/workspace-layout.ts`:** exports `LayoutResult`, and
`LayoutResult["details"]["mode"]` is the panel's mode.

**`src/styles.css`:**

- `.details-section` (1690), `.details-body` grid (1700) and
  `@container details (min-width: 628px)` two columns (1710).
- `.details-clamped` (1771) and `.details-more` (1778).
- `.requisite-tree` (2000) and `.requisite-line` (2019).
- `button.requisite-code` (2067-2087) and `.requisite-where` (2088).
- `.details-related ul` (2132), `.family-dot` (3000) and
  `[data-family="specialisation"] { --family: var(--family-specialisation); }`
  (73).

**Tests that pin behaviour here:**

- `spec/layout/details.test.ts:506` clicks
  `getByRole("button", { name: "Previous course" })`. It becomes "Back".
- `spec/layout/helpers.ts`:
  - `detailsPanel = (page) => page.locator('aside[aria-label="Course details"]')`
  - `expectDetailsOpenThenClose` checks `?course=` and
    `"Close details"`
  - `planWithPlacement(code, term = 0): Promise<string>` POSTs
    `/api/plans` with `headers: { origin: baseUrl }`
  - `settle(page)`
- `spec/routes.ts`: `export const STATE_ROUTES = ["/plan/example?course=COMP2100"];`
  The invariants (`spec/invariants.test.ts`) run axe and the other checks
  on every route in it.
- `spec/browser.ts` exports `openPage(browser, url, viewport)`,
  `axeViolations(page): Promise<string[]>` and
  `horizontalOverflow(page): Promise<number>`.
- `src/components/planner-logic.test.ts:44-58` has `loadRealCatalogue()`,
  a helper copied into each domain/logic test file (repo convention: copy
  it, don't share it).

### Interfaces from earlier phases (exact)

From Task 2, `src/data/specialisations.ts`:

```ts
export type SpecBlock =
  | { type: "text"; content: string }
  | { type: "heading"; content: string }
  | { type: "and" }
  | { type: "list"; heading: string; courses: string[] };
export interface SpecialisationData {
  code: string; title: string; url: string; year: string; scrapedAt: string; minUnits: number;
  introduction: string[]; topics: string[]; learningOutcomes: string[];
  requirements: SpecBlock[]; otherInformation: string[]; relevantDegrees: string[];
}
export interface SpecList { groupId: string; label: string; shortLabel: string; unitsMax: number | null }
export interface SpecialisationInfo extends SpecialisationData { groupId: string; label: string; lists: SpecList[] }
export const SPEC_CHOICE_GROUP = "spec";
export const SPECIALISATIONS: SpecialisationInfo[];
export function specialisationByCode(code: string): SpecialisationInfo | null;
export function specialisationByGroup(groupId: string): SpecialisationInfo | null;
export function specialisationsListing(courseCode: string): SpecialisationInfo[];
```

`lists[k]` corresponds to the *k*-th `{type:"list"}` block in
`requirements`.

## 4. Approach

### 4.1 Subjects, not codes (Task 3)

The new state shape is in overview §4.2.

- `openSubject` behaves exactly like `openCourse` did, comparing subjects by
  `kind` and `code`.
- `subjectParam(search)` returns:
  - a course, if `course` matches `/^[A-Z]{4}\d{4}$/`
  - else a spec, if `spec` matches `/^[A-Z]{4}-SPEC$/`
  - else null

  So `?course=` wins if both are present. The page checks a spec code is
  known.
- `withSubjectParam(href, subject)` sets the subject's own parameter and
  deletes the other (or deletes both for null).
- `courseCode(state)` returns the code when the subject is a course, else
  null; `specCode(state)` is the same for a spec.

In Planner:

- Everything course-specific reads `courseCode(details)`: the fetch, the
  card, `linked`, and `openCode` for Timeline, Sidebar and Search.
- `detailsOpen` becomes `details.subject !== null`.
- The close-focus effect keys on `details.subject === null`.

### 4.2 The frame (Task 4)

`src/components/DetailsFrame.tsx` takes over the aside, head, nav,
`SheetHandle`, detent and drag state, the body's peek-hiding, and the
footer. `SheetHandle` and `Icon` move there, and so do `ExternalLink` and
`dateLabel`, as named exports so both panels share them.

```ts
export interface DetailsFrameProps {
  label: "Course details" | "Specialisation details";
  details: DetailsState;
  mode: LayoutResult["details"]["mode"];
  wide: boolean;
  onToggleWide: () => void;
  onBack: () => void;
  onForward: () => void;
  onClose: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
  heading: ComponentChildren; // the h2's contents
  pills: ComponentChildren; // the <li>s of ul.details-pills
  footer: ComponentChildren | null; // null renders no <footer>
  children: (sheet: { peek: () => void }) => ComponentChildren; // .details-body's contents
}
export default function DetailsFrame(props: DetailsFrameProps): JSX.Element;
export function ExternalLink(props: { href: string; children: ComponentChildren }): JSX.Element;
export function dateLabel(iso: string): string | null;
```

- The aside keeps `id="course-details"` for both kinds, because the
  divider's `aria-controls` names it.
- The nav buttons read "Back" and "Forward".
- `peek()` sets the detent to `"peek"`.
- Focus effects stay in each panel.

### 4.3 The specialisation panel (Task 5)

`src/components/SpecialisationDetailsPanel.tsx`:

```ts
interface Props {
  view: PlanView;
  details: DetailsState; // subject.kind === "spec"
  spec: SpecialisationInfo;
  onOpenCourse: (code: string) => void;
  onBack: () => void;
  onForward: () => void;
  onClose: () => void;
  onShowInSidebar: (groupId: string) => void;
  onAction: (action: PlanAction) => Promise<void>; // unused until Phase 03
  mode: LayoutResult["details"]["mode"];
  wide: boolean;
  onToggleWide: () => void;
}
```

Structure, in DOM order:

- **Heading:** `<span class="details-code">{spec.code}</span> <span class="details-meta">{spec.minUnits} units, Specialisation</span> <span class="details-title">{spec.title}</span>`.
- **Pills:** chosen gives `<li><span class="family-dot" data-family="specialisation" aria-hidden="true" />Chosen</li>`;
  otherwise `<li>Not chosen</li>`.
- **Body** (sections are `section.details-section` with an `h3`):
  1. *(chosen only)* **"In your plan"**: `<p>You chose this specialisation.</p>`
     and `<button type="button" class="details-progress-jump">See your progress in Requirements</button>`.
     The button calls `onShowInSidebar(spec.groupId)`, then `sheet.peek()`
     when `mode === "sheet"`.
  2. **"Requirements"**: each `spec.requirements` block in order.
     - `text` is a `<p>`, with its codes run through `linkCodes`.
     - `heading` is `<h4 class="spec-list-heading">`.
     - `and` is `<p class="spec-and">AND</p>`.
     - `list` *k* is:
       - `<h4 class="spec-list-heading">{heading}</h4>`
       - the tag: `<p class="spec-group-tag"><span class="family-dot" data-family="specialisation" aria-hidden="true" />{…}</p>`.
         When chosen, the label is a `<button type="button" class="requisite-code">{lists[k].shortLabel}</button>`
         calling `onShowInSidebar(lists[k].groupId)`; otherwise it's the
         plain shortLabel.
       - `<ul class="requisite-tree spec-courses">` of course lines:
         `li > span.requisite-line > span.mark-dot + span[ button.requisite-code (or strong) code, " title", span.spec-units "6 units", span.requisite-where courseLineStatus(...) ]`.
  3. **"About the specialisation"**: a clamp wrapper `div.spec-about`,
     holding the intro paragraphs, then (if any) `<ul class="spec-topics">`,
     with `details-clamped` until expanded. It uses the course panel's
     clamp-detection pattern, keyed on `spec.code`.
     - Then `button.details-more`.
     - Then `<h3>Learning outcomes</h3><ol class="details-outcomes">`.
     - If the multi-block clamp doesn't truncate reliably in
       Chromium/WebKit, clamp only the first paragraph (SD20). Record which
       in the commit message.
  4. **"Other information"**: one `<p>` per paragraph, through
     `linkCodes`.
  5. **"Relevant degrees"**: `<div class="details-related"><ul>`, with
     ", your degree" appended to the entry containing "(AACOM)".
- **Footer:**
  - `<ExternalLink href={spec.url}>Open {spec.code} on Programs &amp; Courses</ExternalLink>`
  - `<p class="details-note">Details from Programs &amp; Courses {spec.year}, updated {dateLabel(spec.scrapedAt)}</p>`
- **Focus:** the heading is focused on each `details.token` other than 0, as
  the course panel does.

Pure helpers go in `src/components/spec-logic.ts`:

```ts
export function chosenSpecGroup(view: PlanView): string | null;
// groupPath(view, SPEC_CHOICE_GROUP)[0]?.chosenId ?? null

export type ProseSegment = string | { code: string };
export function linkCodes(text: string, canOpen: (code: string) => boolean): ProseSegment[];
// splits on /\b[A-Z]{4}\d{4}\b/; a code canOpen rejects stays in the string

export function courseLineStatus(view: PlanView, code: string, spec: SpecialisationInfo, listGroupId: string): string;
```

`courseLineStatus` returns:

- "Not in your plan" when the course isn't placed.
- Otherwise `${word} ${parts[0].termLabel}` (from `placedStatus`). When the
  spec is chosen, it appends one of:
  - ", counts here" (`countsToward === listGroupId`)
  - `, counts toward ${groupLabel(view, countsToward)}` (another group)
  - ", not counting toward anything" (null)
- An unchosen spec gets the base only. Phase 03 adds the what-if suffix.

The units text is `unitsLabel(view.courses[code]).full`.

**Styles:** new rules in `src/styles.css`, next to the `.details-*` block,
using only existing tokens:

- `.spec-list-heading`: 0.92rem, 600, `var(--ink)`, max-width 60ch.
- `.spec-group-tag`: flex, gap 0.4rem, 0.85rem, `var(--muted)`.
- `.spec-and`: 0.8rem, 700, `var(--muted)`, margin-inline-start matching
  the requisite-tree inset.
- `.spec-courses .requisite-line > span`: grid `1fr auto`, so the units
  figure goes right and the status goes under.
- `.spec-units`: 0.85rem, `var(--muted)`.
- `.spec-topics`: normal list.
- `.details-progress-jump`: the base button, min-height 2.75rem.

## 5. Task breakdown

### Task 3: Typed details subjects, `?spec=` parsing, Back/Forward

- [x] **Description.** Replace course-code state with `DetailsSubject`
  state (overview §4.2, this file's §4.1). Migrate Planner and
  CourseDetailsPanel to it. Rename the nav buttons. Spec subjects aren't
  opened by anything yet.
- **Files touched:**
  - `src/components/details-state.ts`
  - `src/components/details-state.test.ts`
  - `src/components/Planner.tsx`
  - `src/components/CourseDetailsPanel.tsx`: `const code = courseCode(details)!`,
    and the nav labels
  - `src/pages/plan/[id].astro`: use `subjectParam`, taking only a course
    subject for `initialDetails` in this task
  - `spec/layout/details.test.ts:506`: "Previous course" becomes "Back"
- **Tests first (red)**, in `details-state.test.ts` (rewrite the existing
  cases against `openSubject`, keeping every behaviour they pin):
  1. Opening, truncation after stepping back, and re-opening the same
     subject work as before, with subjects.
  2. A mixed trail: open course A, then spec S, then course B. Stepping
     back twice lands on A, and forward then lands on S.
  3. Opening `{kind:"spec", code:"X"}` after `{kind:"course", code:"X"}`
     counts as a new subject.
  4. `subjectParam`:
     - `"?course=COMP2100"` gives a course
     - `"?spec=ARIN-SPEC"` gives a spec
     - both present gives the course
     - `"?spec=arin"`, `"?spec=ARIN"` and `"?course=bad"` give null
  5. `withSubjectParam` sets `spec` and removes `course` (and the reverse),
     and null removes both.
  6. `courseCode` and `specCode` read their own kind only.
- **Implementation (green).** Per this file's §4.1.
  - Planner's initial state is
    `initialDetails ? { ...openSubject(EMPTY_DETAILS, { kind: "course", code: initialDetails.course.code }), token: 0 } : EMPTY_DETAILS`.
  - The URL effect's deps become `[details.subject?.kind, details.subject?.code]`.
  - `detailsPanel` renders `CourseDetailsPanel` only when
    `details.subject?.kind === "course"`.
- **Refactor.** Remove `openCourse`, `courseParam` and `withCourseParam`,
  and grep for their other uses. Only Planner and the page use them today.
- **Acceptance criteria:**
  - `pnpm test:unit` passes.
  - `pnpm build && pnpm exec vitest run --project spec
    spec/layout/details.test.ts` passes, with only the Back label changed.
  - `pnpm check` is green.
- **Depends on:** none in this phase. It uses no Phase 01 exports.

### Task 4: Extract `DetailsFrame` from `CourseDetailsPanel`

- [x] **Description.** Move the shell into `DetailsFrame.tsx` per this
  file's §4.2 and render `CourseDetailsPanel` through it, with no visible
  change except that the accessible name comes from the `label` prop.
- **Files touched:**
  - `src/components/DetailsFrame.tsx` (new)
  - `src/components/CourseDetailsPanel.tsx`
- **Tests first (red).** Add a small case to the new file
  `spec/layout/specialisation-details.test.ts` (start it with
  `useBrowser()`): "the course panel still renders through the shared
  frame". At 1920, `/plan/example?course=COMP2100` has exactly one
  `aside#course-details[aria-label="Course details"]`, and its
  `.details-nav` has buttons named Back, Forward, Narrow details or Widen
  details, and Close details. At 390 it has the `role="slider"` "Resize
  details" handle.

  This is a characterisation test: write it before moving any code, see it
  pass (Task 3 already renamed the buttons), and keep it passing through
  the move. The existing `spec/layout/details.test.ts`,
  `phone-layout.test.ts` and `workspace-resize.test.ts` are the main
  guard. Run them before and after.
- **Implementation (green).** Move the code. Leave the course panel's
  sections and focus effects in place, with its body passed as
  `children={() => (…sections…)}`.
- **Refactor.** Delete the now-unused locals from `CourseDetailsPanel.tsx`.
- **Acceptance criteria:**
  - These all pass unchanged (apart from Task 3's label):
    `spec/layout/details.test.ts`, `phone-layout.test.ts`,
    `workspace-resize.test.ts`, `workspace-states.test.ts` and
    `undo.test.ts`.
  - `CourseDetailsPanel.tsx` no longer defines `SheetHandle`.
  - `pnpm check` is green.
- **Depends on:** Task 3.

### Task 5: `SpecialisationDetailsPanel` with P&C content, served by `?spec=`

- [ ] **Description.** Build the panel of this file's §4.3 and the
  `spec-logic.ts` helpers.
  - Wire Planner's `openSpec` and the `?spec=` server render.
  - Add `/plan/example?spec=ARIN-SPEC` and `/plan/example?spec=HCCC-SPEC`
    to `STATE_ROUTES`.
- **Files touched:**
  - `src/components/spec-logic.ts` (new)
  - `src/components/spec-logic.test.ts` (new)
  - `src/components/SpecialisationDetailsPanel.tsx` (new)
  - `src/components/Planner.tsx`
  - `src/pages/plan/[id].astro`
  - `src/styles.css`
  - `spec/routes.ts`
  - `spec/layout/specialisation-details.test.ts`
- **Planner wiring:**
  - Add the prop `initialSpec?: string | null`. The initial state uses
    `{ kind: "spec", code }` when `initialSpec` is set and there's no
    `initialDetails`.
  - Add `function openSpec(code: string)`: it records the opener as
    `openDetails` does, and calls
    `setDetails((s) => openSubject(s, { kind: "spec", code }))`.
  - `detailsPanel` renders
    `<SpecialisationDetailsPanel spec={specialisationByCode(specCode(details)!)!} onOpenCourse={(c) => openDetails(c)} onShowInSidebar={(id) => showInSidebar("group", id)} …/>`
    for spec subjects.
  - In the page:
    `const subject = subjectParam(Astro.url.search); const initialSpec = view && subject?.kind === "spec" && specialisationByCode(subject.code) ? subject.code : null;`,
    passed to Planner. An unknown spec means no panel.
  - Export `openSpec` to later phases by passing it down as props. Phase 04
    wires the callers.
- **Tests first (red):**
  - `spec-logic.test.ts` uses the real catalogue (copy `loadRealCatalogue`
    from `planner-logic.test.ts:44-58`) with `AACOM_2027` and
    `buildPlanView`:
    1. `chosenSpecGroup` is null for an empty plan and `"arin"` for
       `choices: {spec:"arin"}`.
    2. `linkCodes("complete MATH1013 or MATH1115 early", () => true)`
       gives `["complete ", {code:"MATH1013"}, " or ", {code:"MATH1115"}, " early"]`.
       A code `canOpen` rejects stays inside the string.
    3. `courseLineStatus`:
       - Unplaced gives "Not in your plan".
       - With COMP3670 placed at term 4 and `spec: "arin"`, it gives
         `"<Planned|Completed> <term label>, counts here"`, or `", counts
         toward <label>"` if the allocator put it elsewhere. Assert
         against `view.placements`' own `countsToward` rather than a
         hard-coded group.
       - With the same placement and `spec` unchosen (HCCC's list), it
         gives no suffix.
  - `spec/layout/specialisation-details.test.ts`, at 1920:
    1. **Server render:** fetching `/plan/example?spec=ARIN-SPEC` as HTML
       contains `aria-label="Specialisation details"` and `ARIN-SPEC`.
    2. **The page:**
       - The panel's h2 contains "ARIN-SPEC", "24 units, Specialisation"
         and "Artificial Intelligence", and a pill reads "Chosen".
       - The h3s, in order: "In your plan", "Requirements", "About the
         specialisation", "Learning outcomes", "Other information",
         "Relevant degrees".
       - The h4 "A maximum of 12 units from the following list:" is
         present, followed by the tag button "foundations (max 12)".
       - The COMP2620 line shows "6 units".
    3. **Links:** in Other information, the COMP4691 button opens the
       course panel (URL `course=COMP4691`, no `spec`). Back returns to
       ARIN-SPEC (URL `spec=ARIN-SPEC`).
    4. **HCCC:** `?spec=HCCC-SPEC` has an h4 "Advice to Students" and two
       `.spec-and` elements. A pill reads "Not chosen". The tag
       "foundations (max 6)" is not a button. There's no "In your plan"
       h3.
    5. **SYAR:** `?spec=SYAR-SPEC` has 13 `.spec-topics li`.
    6. **Unknown code:** `?spec=NOPE-SPEC` has no details panel.
    7. **The jump:** selecting "See your progress in Requirements" gives
       `[data-group="arin"]` the class `requirement-highlighted`.
    8. **Clamp:** "Read the full description" is `aria-expanded="false"`
       and becomes true when selected.
    9. **axe:** `axeViolations` is `[]` at 1920.
  - The same file, at 390:
    - With `?spec=ARIN-SPEC`, selecting "See your progress in Requirements"
      turns the Requirements tab `aria-pressed="true"` and the panel's
      `data-detent` to "peek".
    - axe is `[]`, and `horizontalOverflow` is 0.
- **Implementation (green).** Per this file's §4.3.
- **Refactor.** None.
- **Acceptance criteria:**
  - Every test above passes.
  - `spec/invariants.test.ts` passes for both new `STATE_ROUTES` entries.
  - `pnpm check` is green.
- **Human review.** The user opens `/plan/example?spec=ARIN-SPEC`,
  `?spec=HCCC-SPEC` and `?spec=SYAR-SPEC`, at 1920×1080 (the narrow docked
  panel) and at 390×844 (the sheet at half and full). A pass means:
  - It reads as the P&C page with the planner's look: P&C's wording is
    verbatim.
  - The list headings are soft, not shouting.
  - "AND" and the tags are quiet.
  - The course lines match the requisite tree's.
  - Nothing overflows.

  The task isn't done until the user says so explicitly.
- **Depends on:** Tasks 2, 3 and 4.

## 6. Phase Definition of Done

- [ ] Tasks 3–5 are complete and their tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] `/plan/example?spec=ARIN-SPEC` renders every P&C section on the
  server
- [ ] Task 5's human review is explicitly accepted by the user
- [ ] Tick Phase 02 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| SD10 | Task 5 |
| SD11 | Task 3 (trail and labels), Task 4 (frame) |
| SD12 | Task 3 (parsing), Task 5 (server render) |
| SD13 | Task 4 (prop), Task 5 (asserted) |
| SD14 | Task 5 |
| SD15 | Task 5 |
| SD19 (static and chosen) | Task 5 |
| SD20–SD23 | Task 5 |
| N1 (this panel) | Task 5 |

## 8. Risks / open questions

None.
