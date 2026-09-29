# Specialisation details — Plan overview

- **Date:** 2026-09-30
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-29. The spec
  `specs/2026-09-29-specialisation-details.md` was approved through
  brainstorm-feature. The toast wording and phased layout were confirmed on
  2026-09-30.

## 0. How to use these plans

Files in this set:

| File | Holds |
| --- | --- |
| `plans/2026-09-30-specialisation-details-00-overview.md` | This file |
| `plans/2026-09-30-specialisation-details-01-data.md` | Tasks 1–2 |
| `plans/2026-09-30-specialisation-details-02-panel.md` | Tasks 3–5 |
| `plans/2026-09-30-specialisation-details-03-what-if.md` | Tasks 6–8 |
| `plans/2026-09-30-specialisation-details-04-entry-points.md` | Tasks 9–11 |
| `plans/2026-09-30-specialisation-details-05-layout-help-review.md` | Tasks 12–14 |

- Each session reads this overview plus exactly one phase file, and runs it
  with `/execute-plan <phase file>`.
- Task numbers are global.
- Tick a phase in §5 only once its phase Definition of Done is met.
- The spec (`specs/2026-09-29-specialisation-details.md`) is the full
  text behind every SD number. Its §4.1 holds the agreed wireframes. Read
  the sections a phase names; the rest is background.

## 1. Summary

The planner is "P&C with a planning layer on top", but specialisations have
no information in it. P&C's page for each specialisation holds its
introduction, outcomes, verbatim requirement lists, rules, Other Information
and Relevant Degrees. This feature opens a specialisation in the existing
details panel, the one courses use, with all of that content.

Two planning additions sit on top:

- For the specialisation the student has chosen, a jump to its progress in
  the Requirements sidebar.
- For one they haven't chosen, a true what-if: re-running allocation as if
  it were chosen shows what would count, what would move, and which
  requirements would fall short. A Choose or Switch button applies it with
  undo.

Students open specialisations from the sidebar's radio options, from search,
and from a course's details. The scrape (the external `anu-pandc` 0.3.1)
lost whole P&C sections, so an in-repo supplement and merge script restore
them. A drift test keeps the merged data and the app's own model in step.

## 2. Requirements

The SD numbers are the spec's; its §2.1 has the full wording.

### 2.1 Functional requirements

**A. Data**

1. **SD1.** A hand-written `data/2027/subplans-supplement.json` holds each
   spec's Other Information and Relevant Degrees, SYAR's 13 topics, and
   which requirement text entries are headings on P&C (HCCC's "Advice to
   Students"). The spec's SD1 has the reference text.
2. **SD2.** `scripts/merge-subplans.ts` merges the scraped
   `data/2027/subplans/*.json` with the supplement into
   `data/2027/specialisations.json`. Re-running it gives an identical file,
   and a test fails if the committed file is stale.
3. **SD3.** The app reads the merged file only by static import.
4. **SD4** *(amended at planning, 2026-09-30).* The program is seeded into
   SQLite from `AACOM_2027`, so a `GroupDef` field would need a migration.
   Instead the link from P&C code to group id lives in a static module,
   `src/data/specialisations.ts`. P&C list *i* maps to the spec group's
   `children[i]`, and the lists turn out to be in the same order.
5. **SD5.** A `spec/` test fails if any P&C list's course set, or
   `min_units`, differs from `AACOM_2027`'s specialisation group.

**B. Entry points**

6. **SD6.** Each "Choose Specialisation" option has a "Details" text button
   outside its `<label>`.
   - Its name is "Details: <option label>".
   - It has `aria-current="true"` while that spec is open.
   - Capstone options get none.
7. **SD7.** The chosen spec's heading in the sidebar is a button that opens
   its details. The heading keeps `tabIndex=-1`.
8. **SD8.** The search palette also returns specialisations.
   - It matches on the code (with or without "-SPEC") or on title words,
     client-side, when the search is submitted.
   - Results appear under a "Specialisations" h3 above course results.
   - Their titles join the arrow-key list.
   - The status message counts both kinds of result.
9. **SD9.** A course's details body starts with "On the lists of: …",
   naming every spec that lists the course.
   - Each name is a link.
   - The chosen one is marked "(your specialisation)".
   - The line is left out when the course is on no list.
10. **SD10.** Catalogue course codes inside P&C prose (Other Information and
    rule text) are links that open that course.

**C. Panel**

11. **SD11.** The same single panel shows either kind of subject, with one
    shared back/forward trail. The buttons are labelled "Back" and
    "Forward".
12. **SD12.** The URL carries `?spec=ARIN-SPEC` (via replaceState), never
    together with `?course=`.
    - A page load with it renders the panel open on the server.
    - An unknown code is ignored.
13. **SD13.** The panel's accessible name is "Course details" or
    "Specialisation details".
14. **SD14.** The header shows:
    - the code
    - "24 units, Specialisation"
    - P&C's title
    - a pill reading "● Chosen" or "Not chosen"

    There is no progress pill.
15. **SD15.** Chosen spec: the block is headed "In your plan" and reads "You
    chose this specialisation." Its "See your progress in Requirements"
    button jumps to and flashes the sidebar group. On a phone it also
    switches to the Requirements tab and drops the sheet to peek.
16. **SD16.** Unchosen spec (including when none is chosen): "Fit with your
    plan", from a server what-if, shows:
    - a `ProgressBar` labelled "If you chose this"
    - a figures sentence
    - a moves summary
    - move rows ("● from › ● to")
    - courses that would stop counting toward the current spec
    - shortfalls, e.g. "Electives would drop to 36 of 48"
    - the zero case
17. **SD17** *(toast wording amended 2026-09-30).* The button reads "Choose
    this specialisation" (gold) or "Switch to this specialisation"
    (neutral).
    - It applies immediately through the existing choice action, with the
      undo toast, and no confirmation.
    - It is hidden on read-only plans, and works while the what-if loads or
      has failed.
    - Toast: a first choice keeps today's "Chose <option> for
      Specialisation". Changing an existing choice, from anywhere including
      the radio, reads "Switched Specialisation from <old> to <new>".
18. **SD18.** What-if loading and error states, with Try again. The what-if
    re-fetches on every new `PlanView`, and a stale answer never overwrites
    a newer one. The P&C sections render straight away.
19. **SD19.** Requirements:
    - P&C's blocks, verbatim and in order: text, headings, "AND" and
      lists.
    - Under each list heading, a tag with the app's short label. For the
      chosen spec the tag is a button that jumps to that sidebar group.
    - Plain course lines: code link, title, units, plan status.
    - For the chosen spec the status adds where the course counts, when
      that isn't here.
    - For an unchosen spec it adds "would count" or "wouldn't count here",
      with ", over the <N>-unit limit" when that list's maximum is full.
20. **SD20.** About: the introduction clamped (Read the full description /
    Show less), SYAR's topics as an unnumbered list, and the learning
    outcomes numbered. The clamp covers the first paragraph only if a
    multi-paragraph clamp is unreliable.
21. **SD21.** Other information, with codes linked.
22. **SD22.** Relevant degrees, with ", your degree" after AACOM.
23. **SD23.** Footer: "Open <CODE> on Programs & Courses ↗" and "Details
    from Programs & Courses 2027, updated <date>".
24. **SD24.** While the chosen spec is open, its sidebar group gets the
    `.group-linked` tint.
25. **SD25.** The Help page gets a "Specialisation details" section.

### 2.2 Non-functional requirements

- **N1.** axe-clean in every state. Plan status is always written out, and
  tap targets are at least 2.75rem.
- **N2.** Verified by rendering at 1920×1080 (the narrow and wide docked
  panel) and 390×844 (the sheet at peek, half and full), with no horizontal
  overflow.
- **N3.** No specialisation data or what-if in `PlanView`, following WR2.
- **N4.** Static imports only, since the Dockerfile ships `dist/`.
- **N5.** Browser tests go in `spec/layout/specialisation-details.test.ts`,
  kept under `spec/suite-size.test.ts`'s 1000-line budget.

### 2.3 Out of scope

- The timeline reacting to an open spec.
- Capstone option details.
- Per-list what-if figures.
- Modelling incompatible majors and minors (shown as P&C text only).
- Changing `anu-pandc`.

### 2.4 Assumptions

- The only program is AACOM (`AACOM_2027`).
- The choice action is undoable. *Verified 2026-09-30:* `historyStep` has a
  `choice` case (`src/components/plan-actions.ts:136-142`), and
  `spec/layout/undo.test.ts` "a specialisation choice offers Undo…" covers
  it.
- Every course on every spec list is in `view.courses`. `buildPlanView`
  collects all of the program tree's courses, including unchosen options
  (`collectGroupCourses`). So are MATH1013 and MATH1115, which are on the
  ICT list.
- A what-if equals `buildPlanView` on the plan with the choice swapped.
  `setChoice` clears pins into the option being left, and `buildPlanView`
  already treats a no-longer-eligible pin as Automatic (`livePin`), so the
  preview matches what switching produces.
- The example plan (`/plan/example`, read-only) has
  `choices: { spec: "arin", capstone: "cap-research" }`
  (`src/data/example-plan.ts:14`).

## 3. Shared context & conventions

- **Stack:** Astro 7 (SSR, `@astrojs/node`), Preact 10, Drizzle and
  better-sqlite3, TypeScript 6 strict, vitest 4, and Playwright for browser
  specs.
- **Commands:**
  - `pnpm test:unit`: `src/**/*.test.ts`.
  - `pnpm build && pnpm exec vitest run --project spec <file>`: one
    spec/scripts file. Global setup boots the built server, so build first.
  - `pnpm check`: types, build and every test. It must be green before each
    commit.
  - `pnpm check:evidence`.
- **Layering:**
  - `src/lib/domain/**` stays pure: no db, no fetch.
  - `src/components/*-logic.ts` and `*-state.ts` stay pure and
    node-testable.
  - Components stay thin over them.
- **Tests:**
  - Unit tests sit next to their source (`src/**/x.test.ts`).
  - Script tests are `scripts/*.test.ts`, in the spec project.
  - Non-browser contract tests are `spec/*.test.ts`.
  - This feature's browser tests all go in the new
    `spec/layout/specialisation-details.test.ts`, which starts with
    `useBrowser()` and uses `spec/layout/helpers.ts`.
  - Existing files are touched only where behaviour they pin changes.
- **Style:** match the surrounding code. Comments say why, not what; prose
  is plain; no "·" meta strings.
- **Commits:**
  - One per task once `pnpm check` passes, with a message that says what
    changed and why.
  - End every message with
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never hand-edit `dist/`, `.astro/` or `data/2027/specialisations.json`.
    Regenerate the merged file with `node scripts/merge-subplans.ts`.
- **PROCESS_LOG.md:** append-only, in the format its header comment shows.
  Cite only commits that already exist.
- **Needs the user:** every `Human review:` task needs explicit sign-off.
  Nothing is pushed or deployed without asking.
- **Visual checks:** run the app and look at both marking viewports (1920
  1080, 390 844). The render is the truth.

## 4. Shared design

### 4.1 Architecture

```
data/2027/subplans/*.json ─┐
data/2027/subplans-supplement.json ─┴─ scripts/merge-subplans.ts ──▶ data/2027/specialisations.json
                                                                        │ static import
src/data/aacom-2027.ts (AACOM_2027) ──────▶ src/data/specialisations.ts (SPECIALISATIONS, lookups)
                                                   │
        ┌──────────────────────────────────────────┼─────────────────────────────┐
  details-state.ts (typed subjects, ?spec=)   spec-logic.ts (pure helpers)   what-if (Phase 03)
        │                                          │                             │
  Planner ── DetailsFrame ── CourseDetailsPanel / SpecialisationDetailsPanel ◀── GET /api/plans/{id}/what-if
```

### 4.2 Shared types (verbatim, as produced)

Task 1 writes these in `src/data/specialisation-types.ts`, which is types
only. The script imports them with `import type` (erased when Node strips
types), so no Node-only code reaches the client bundle. Task 2 re-exports
them from `src/data/specialisations.ts`:

```ts
export type SpecBlock =
  | { type: "text"; content: string }
  | { type: "heading"; content: string }
  | { type: "and" }
  | { type: "list"; heading: string; courses: string[] };

export interface SpecialisationData {
  code: string; // "ARIN-SPEC"
  title: string; // P&C's title
  url: string;
  year: string; // "2027"
  scrapedAt: string; // ISO, from the scrape
  minUnits: number; // 24
  introduction: string[]; // paragraphs
  topics: string[]; // SYAR's list; [] elsewhere
  learningOutcomes: string[];
  requirements: SpecBlock[];
  otherInformation: string[]; // paragraphs
  relevantDegrees: string[];
}

export interface SpecialisationsFile {
  generatedBy: string;
  specialisations: SpecialisationData[];
}
```

Task 2 writes these in `src/data/specialisations.ts`:

```ts
export interface SpecList {
  groupId: string; // "arin-a": the child group this P&C list is modelled by
  label: string; // "Artificial Intelligence — foundations (max 12)"
  shortLabel: string; // "foundations (max 12)"
  unitsMax: number | null;
}

export interface SpecialisationInfo extends SpecialisationData {
  groupId: string; // "arin": the option of the selectable group
  label: string; // the app's label, as the radio shows it
  lists: SpecList[]; // one per `list` block, in order
}

export const SPEC_CHOICE_GROUP = "spec";
export const SPECIALISATIONS: SpecialisationInfo[];
export function specialisationByCode(code: string): SpecialisationInfo | null;
export function specialisationByGroup(groupId: string): SpecialisationInfo | null;
export function specialisationsListing(courseCode: string): SpecialisationInfo[];
```

Task 3 writes these in `src/components/details-state.ts`, replacing
`code`, `openCourse`, `courseParam` and `withCourseParam`:

```ts
export type DetailsSubject = { kind: "course"; code: string } | { kind: "spec"; code: string };

export interface DetailsState {
  subject: DetailsSubject | null;
  history: DetailsSubject[];
  index: number;
  focus: DetailsFocus;
  token: number;
}

export function openSubject(state: DetailsState, subject: DetailsSubject, focus?: DetailsFocus): DetailsState;
export function stepHistory(state: DetailsState, dir: -1 | 1): DetailsState;
export function closeDetails(state: DetailsState): DetailsState;
export function subjectParam(search: string): DetailsSubject | null;
export function withSubjectParam(href: string, subject: DetailsSubject | null): string;
export function courseCode(state: DetailsState): string | null;
export function specCode(state: DetailsState): string | null;
```

### 4.3 Cross-phase contract (HTTP)

| Method and path | Query | 200 body | Errors | Introduced by |
| --- | --- | --- | --- | --- |
| `GET /api/plans/{id}/what-if` | `group=<selectable group id>&option=<child id>` | `WhatIfView` (Phase 03 file §4.1) | 400: not a selectable group, or not one of its options. 404: plan not found. | Task 6 |

It works on read-only plans too; it reads and never writes.

## 5. Phases

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-data.md` | 1–2 | — | Supplement, merge script and merged JSON committed. `SPECIALISATIONS` module and drift test green. PROCESS_LOG entry. | [ ] |
| 02 | `…-02-panel.md` | 3–5 | 01 | `?spec=ARIN-SPEC` renders the full P&C content in the panel. Chosen block, Back/Forward, shared frame. **Human review (Task 5).** | [ ] |
| 03 | `…-03-what-if.md` | 6–8 | 01, 02 | What-if endpoint, Fit block in every state, Choose/Switch with the switch toast. **Human review (Task 8).** | [ ] |
| 04 | `…-04-entry-points.md` | 9–11 | 01, 02 | Sidebar Details buttons, heading link and tint; search results; the course panel's "On the lists of" line. **Human review (Task 9).** | [ ] |
| 05 | `…-05-layout-help-review.md` | 12–14 | 02, 03, 04 | Wide two-column body, phone sheet, all-states sweep, Help section, final review. **Human review (Tasks 13, 14).** | [ ] |

Phases 03 and 04 are independent of each other and can run in either order.

## 6. Feature-level Definition of Done

- [ ] Every phase in §5 is ticked, and every task is complete with tests
  passing
- [ ] `pnpm build && pnpm exec vitest run --project spec
  spec/layout/specialisation-details.test.ts` passes
- [ ] `pnpm check` passes, and so does `pnpm check:evidence`
- [ ] Manually verified at 1920×1080 and 390×844:
  1. Open `/plan/example` and select ARIN's Details button. The panel shows
     P&C's content, "● Chosen", and a progress jump that flashes the
     sidebar group.
  2. Select Back and Forward, and switch to SYAR in the same panel. A
     what-if appears, and the button is hidden (read-only).
  3. In a new plan with courses placed, choose a spec from its panel. The
     "Chose …" toast appears and Undo works.
  4. Switch specs. The toast reads "Switched Specialisation from … to …".
  5. Search "ARIN" and open the spec result.
  6. Open COMP3670's details and follow "On the lists of".
- [ ] Every requirement in §2 is covered (see §7)
- [ ] Every `Human review:` task (5, 8, 9, 13, 14) explicitly accepted by
  the user
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| 2.1.1 SD1 | Task 1 |
| 2.1.2 SD2 | Task 1 |
| 2.1.3 SD3 | Task 2 |
| 2.1.4 SD4 | Task 2 |
| 2.1.5 SD5 | Task 2 |
| 2.1.6 SD6 | Task 9 |
| 2.1.7 SD7 | Task 9 |
| 2.1.8 SD8 | Task 10 |
| 2.1.9 SD9 | Task 11 |
| 2.1.10 SD10 | Task 5 |
| 2.1.11 SD11 | Tasks 3, 4 |
| 2.1.12 SD12 | Task 3 |
| 2.1.13 SD13 | Task 4 |
| 2.1.14 SD14 | Task 5 |
| 2.1.15 SD15 | Task 5 (the phone part is re-checked in Task 12) |
| 2.1.16 SD16 | Tasks 6, 8 |
| 2.1.17 SD17 | Task 8 |
| 2.1.18 SD18 | Tasks 7, 8 |
| 2.1.19 SD19 | Task 5 (static and chosen), Task 8 (what-if suffixes) |
| 2.1.20 SD20 | Task 5 |
| 2.1.21 SD21 | Task 5 |
| 2.1.22 SD22 | Task 5 |
| 2.1.23 SD23 | Task 5 |
| 2.1.24 SD24 | Task 9 |
| 2.1.25 SD25 | Task 13 |
| N1 | Tasks 5, 8, 9, 10, 11 (per piece), Task 12 (sweep) |
| N2 | Task 12 (sweep), Task 14 (review) |
| N3 | Tasks 2, 6 (asserted in tests) |
| N4 | Task 2 |
| N5 | Every browser task; checked by `spec/suite-size.test.ts` |

## 8. Risks / open questions

None.

Risks knowingly accepted:

- Generalising `DetailsState` (Task 3) touches every course entry point.
  Its guard is the existing `spec/layout/details.test.ts`, updated only
  where a label changes.
- A what-if costs one `buildPlanView` per open and per plan change, which
  is acceptable at four specs.
