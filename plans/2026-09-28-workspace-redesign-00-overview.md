# Workspace redesign: plan overview

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28 (spec
  `specs/2026-09-28-workspace-redesign.md`, approved)

## 0. How to use these plans

This plan is split into one overview and eight phase files:

| File | Phase |
| --- | --- |
| `plans/2026-09-28-workspace-redesign-00-overview.md` | this file |
| `…-01-course-data.md` | Tasks 1–3 |
| `…-02-details-sidebar.md` | Tasks 4–7 |
| `…-03-linked-and-undo.md` | Tasks 8–10 |
| `…-04-search-palette.md` | Tasks 11–12 |
| `…-05-region-restyle.md` | Tasks 13–15 |
| `…-06-free-resizing.md` | Tasks 16–19 |
| `…-07-phone-layout.md` | Tasks 20–21 |
| `…-08-help-and-review.md` | Tasks 22–23 |

- An implementation session reads **this overview plus exactly one phase
  file**.
- Task numbers are global across all files.
- A phase is ticked in §5 when its phase Definition of Done is met.
- Where this plan and the spec disagree, the spec wins. Fix the plan in
  place.
- **Visual reference:** the approved mockup (v4),
  https://claude.ai/artifact/CYXpgf526edaSgxFHaUwwQ. Its requisite trees
  and allocation are hard-coded, so take only its look and interaction from
  it, never domain logic. Human reviews compare against it.

## 1. Summary

The planner's per-card course-details `<dialog>` becomes a single course
details sidebar beside the timeline. The sidebar shows everything a student
would otherwise look up on Programs & Courses, and every section they can act
on works in place. While a course is open, the rest of the workspace
responds: its requirement group is tinted and its prerequisites are marked.
The workspace is also restyled:
- IntelliJ-style solid regions, with frosted glass only on floating layers
- three regions that resize freely, with soft snaps
- a drawer for details at mid widths
- tabs and a bottom sheet on phones
- search moved to a ⌘K palette opened from the plan header

The audience is ANU Advanced Computing students planning a degree.

## 2. Requirements

The requirements are **WR1–WR48 and the non-functional requirements in
`specs/2026-09-28-workspace-redesign.md` §2**, copied by reference and not
restated here, so there's only one source. Phase files cite WR numbers.

### 2.1 Functional requirements

WR1–WR48 (spec §2.1).

### 2.2 Non-functional requirements

Spec §2.2. In summary:
- Controls at least 44px.
- axe clean in every state (in a real browser), and `spec/invariants.test.ts`
  green.
- No horizontal overflow, the fitted page doesn't scroll vertically, and the
  card-height budget holds with no course open.
- Motion only in response to actions, and off under `prefers-reduced-motion`.
- `PlanView` payload unchanged, and the 50ms view-build test holds.
- Glass must not visibly stutter; if it does, fall back to solid.
- `pnpm check` green on every commit.
- Visual review at 1920×1080, 390×844, 1280×800 and 900×800.

### 2.3 Out of scope

Spec §2.3:
- workload
- comparing two courses at once
- per-strip-cell requisite previews
- per-plan widths
- site-nav changes
- draggable placed rows
- dropping onto Requirements on phones
- Escape closing the sidebar from outside it
- dark mode

### 2.4 Assumptions

Spec §2.4, plus these verified in code while planning:
- A check's answer key is the unverifiable leaf's own text.
  `evaluate.ts:200` looks up `answers[expr.text]`, and `VerifyCheck.item` is
  the same string (`evaluate.ts:259-261`). So a tree node's check is the
  `placement.checks` entry with `item === node.text`.
- `CourseCard.requisiteRaw` is the prerequisite sentence only
  (`repo.ts:87`, from `json.prerequisites`). That is what "As written on
  Programs & Courses" shows.
- JSON `assessment[].weight` is a bare number string such as "30"
  (`data/2027/courses/COMP2100.json`). The UI appends "%" when the weight is
  all digits and otherwise shows it verbatim.
- Moves have no undo today; only Remove offers one (`Planner.tsx:321-328`).
  WR46 extends undo to moves and places through one central action path
  (Task 9).

## 3. Shared context & conventions

- **Stack.**
  - Astro 7 with the node adapter, and Preact 10 islands (`Planner` is
    `client:load`).
  - SQLite through better-sqlite3 and Drizzle.
  - TypeScript 6 and Vitest 4. Playwright Chromium drives the browser specs.
  - pnpm 11.
- **Commands.**
  - `pnpm test:unit`: unit tests (`src/**/*.test.ts`).
  - `pnpm test`: `astro build && vitest run`, which runs all projects,
    including `spec/`.
  - `pnpm check`: `astro check` plus `pnpm test`. **It must be green before
    every commit.**
  - One unit file: `pnpm vitest run --project unit <path>`.
  - One spec suite: `pnpm build && pnpm vitest run --project spec -t
    "<describe name>"`. Spec tests run against `dist/`, so rebuild first.
  - `pnpm db:generate`: writes a Drizzle migration after `schema.ts`
    changes. Commit both.
- **Layering.**
  - `src/lib/domain/*` is pure: no DB, no DOM.
  - `src/lib/repo.ts` never imports `db.ts`.
  - Only `plan-service.ts` and the API routes import `db`.
  - Pure UI logic goes in `src/components/*.ts` (e.g. `planner-logic.ts`),
    unit-tested in node. Components are `.tsx`.
- **Code style.**
  - Match the surrounding comment density: comments explain *why*, as in
    `CourseCard.tsx`.
  - Storage access always goes through `safeStorage()` in try/catch
    (`panel-state.ts`).
  - Server render and first client render must match. Read browser-only
    state in `useEffect`.
- **Tests.**
  - Unit tests sit beside the module (`x.test.ts`).
  - HTTP and SSR contract tests: `spec/planner.test.ts`.
  - Real-browser geometry, behaviour and axe: `spec/layout/*.test.ts`,
    using the helpers in `spec/browser.ts` (`openPage(browser, url,
    viewport, {storage})`, `horizontalOverflow`, `verticalOverflow`,
    `axeViolations`) and `spec/layout/helpers.ts`.
  - **Split on 2026-09-29.** The phase files still say
    `spec/layout.test.ts`, with line numbers from before the split. That
    single file is now one file per area (`page-and-nav`,
    `plan-header-and-fit`, `requirements-panel`, `timeline`,
    `course-cards`, `details`, `sidebar-groups`, `undo`), so vitest runs
    them in parallel (about 7 minutes down to about 1). Read a phase
    file's `spec/layout.test.ts` as "the file for that area". Find a named
    `describe` with `grep -n 'describe("<name>"' spec/layout/*.test.ts`,
    and put a new one in the file for its area (see `spec/README.md`).
  - Route checks: `spec/invariants.test.ts`.
- **Commits** (CLAUDE.md).
  - One commit per task once `pnpm check` passes. The message says what
    changed and why.
  - Never hand-edit `dist/` or `.astro/`.
  - Log any qualifying process moment to `PROCESS_LOG.md` as it happens, in
    its header's format.
- **Visual changes.**
  - Verify by running the app at 1920×1080 and 390×844 (CLAUDE.md), plus
    1280×800 and 900×800 where a task says so.
  - The render is the truth, not the source.
- **Ask the user first** before:
  - adding dependencies
  - editing `.gitignore`, `CLAUDE.md` or settings
  - changing a WR ruling
- **Superseded rules** (spec §6): collapsible-panels FR17/21 and its "free
  widths" out-of-scope item; compact-plan-workspace CW10–CW22; the search
  section's placement; CR2/CR5.1/CR9 "Details dialog"; the Help phrases tied
  to the dialog; "no new animation". Everything else in earlier specs stands,
  especially CR card anatomy, CR17, CR22 and the card-height budget.

## 4. Shared design

### 4.1 Architecture sketch

```
Planner (state owner)
 ├─ details: DetailsState         (Task 4)  → URL ?course (replaceState)
 ├─ runAction(PlanAction)         (Task 9)  → api → setView + undo toast (+ knock-on, Task 10)
 ├─ layout: LayoutResult          (Task 16) ← ResizeObserver(panes) + LayoutPrefs (Task 17)
 ├─ SearchPalette                 (Task 11) inside .planner (touch-drag root)
 └─ .planner-panes
     ├─ Sidebar (Requirements region)
     ├─ WorkspaceDivider "reqs"   (Task 18)
     ├─ Timeline region
     ├─ WorkspaceDivider "details"(Task 18)
     └─ CourseDetailsPanel        (Tasks 5–7; drawer/sheet modes, Tasks 19/21)
```

### 4.2 Shared types (verbatim; the producing task in brackets)

```ts
// src/lib/domain/types.ts [Task 1]
export interface AssessmentItem { task: string; weight: string }
export interface ClassOffering { year: number; session: string; mode: string; classNumber: string | null }
export interface CourseExtras {
  learningOutcomes: string[];
  assessment: AssessmentItem[];
  cotaught: string[];
  classes: ClassOffering[];
}

// src/lib/domain/view.ts [Task 3]
export interface CourseDetailsView {
  course: CourseCard;
  scrapedAt: string;            // ISO timestamp from the scrape (or live fetch)
  extras: CourseExtras | null;  // null for live-fetched stubs (WR3)
}
export function courseDetailsView(
  cat: Catalogue, program: ProgramDef, choices: Record<string, string>,
  code: string, extras: CourseExtras | null,
): CourseDetailsView | null;

// src/components/details-state.ts [Task 4]
export type DetailsFocus = "top" | "requisites";
export interface DetailsState { code: string | null; history: string[]; index: number; focus: DetailsFocus; token: number }
export const EMPTY_DETAILS: DetailsState;
export function openCourse(state: DetailsState, code: string, focus?: DetailsFocus): DetailsState;
export function stepHistory(state: DetailsState, dir: -1 | 1): DetailsState;
export function closeDetails(state: DetailsState): DetailsState;
export function courseParam(search: string): string | null;
export function withCourseParam(href: string, code: string | null): string;

// src/components/plan-actions.ts [Task 9]
export type PlanAction =
  | { kind: "place"; code: string; term: number }
  | { kind: "move"; code: string; term: number }
  | { kind: "remove"; code: string };
export interface UndoEntry { message: string; undo: PlanAction; restorePin: string | null }

// src/components/workspace-layout.ts [Task 16]
export interface LayoutPrefs { reqsWidthPx: number | null; reqsFolded: boolean; detailsWidthPx: number }
export interface LayoutInput {
  containerPx: number; remPx: number; detailsOpen: boolean;
  prefs: LayoutPrefs; gridOverheadPx: number;
}
export interface LayoutResult {
  mode: "side-by-side" | "stacked";
  reqsPx: number | "rail";
  // "sheet" whenever mode is "stacked" and details are open. Phase 06
  // renders it as the interim fixed drawer; Phase 07 styles it as the sheet.
  details: { mode: "docked"; px: number } | { mode: "drawer"; px: number } | { mode: "sheet" } | { mode: "closed" };
  autoFolded: boolean;
  timelinePx: number;
}
export interface SnapTarget { px: number; label: string }
export function computeLayout(input: LayoutInput): LayoutResult;
export function reqsSnapTargets(remPx: number, gridOverheadPx: number): SnapTarget[];
```

### 4.3 Cross-phase contract: HTTP

| Method and path | Query | 200 body | Errors | Task |
| --- | --- | --- | --- | --- |
| `GET /api/courses/{code}` | `plan` (optional plan id, for its choices) | `CourseDetailsView` | 400 `{error}` if `{code}` doesn't match `/^[A-Z]{4}\d{4}$/`; 404 `{error}` if the code isn't in the catalogue (no live fetch) | 3 |

The existing endpoints are unchanged.

### 4.4 Shared constants

These are defined once in `workspace-layout.ts` (Task 16) and read by CSS
through custom properties set by the head script and `Planner` (Task 17):

| Constant | Value |
| --- | --- |
| Timeline minimum | `--timeline-min: 31rem` (existing) |
| Rail width | 3rem (existing `--reqs-w-rail`) |
| Requirements minimum | 17.5rem |
| Requirements column widths | 17.5 / 31.1 / 44.7rem (existing tokens; measured against the rendered grid) |
| Details default | 440px |
| Details wide (the toggle's width) | 760px |
| Details wide threshold | 680px |
| Details minimum / maximum | 360px / 960px |
| Snap threshold | 16px |
| Divider layout width | 1rem (the existing gap between panes; the tier thresholds already budget it) |
| Divider hit area | 44px (visible line 2px, overlapping the neighbours) |
| Card grid | 13rem minimum cards, 0.6rem gaps; default overhead 4.5rem (the existing `--reqs-w-*` formula) |
| Phone threshold | container < 49.5rem (existing) |

## 5. Phases

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-course-data.md` | 1–3 | — | `GET /api/courses/COMP2100` returns outcomes, assessment, classes and co-taught; the plan payload is unchanged | [x] |
| 02 | `…-02-details-sidebar.md` | 4–7 | 01 | Every Details entry point opens one docked sidebar with all WR9 sections; `?course=` SSR works; no `<dialog>` left. **Human review** (Task 7) | [x] |
| 03 | `…-03-linked-and-undo.md` | 8–10 | 02 | Linked highlights while a course is open; every move, place and remove offers Undo with knock-on warnings | [x] |
| 04 | `…-04-search-palette.md` | 11–12 | 02 | Header search and ⌘K palette with draggable results; inline Search section gone | [x] |
| 05 | `…-05-region-restyle.md` | 13–15 | 02 | Regions, glass allowlist check, reordered Requirements, year-grouped timeline. **Human review** (Tasks 13, 15) | [x] |
| 06 | `…-06-free-resizing.md` | 16–19 | 02, 05 | Free three-way resizing with soft snaps, fold order, saved widths and the mid-width drawer. **Human review** (Task 19) | [ ] |
| 07 | `…-07-phone-layout.md` | 20–21 | 02, 06 | Phone tabs and bottom sheet; stacked split retired. **Human review** (Task 21) | [ ] |
| 08 | `…-08-help-and-review.md` | 22–23 | 01–07 | Help rewritten; all-state axe sweep; final visual sign-off. **Human review** (Tasks 22, 23) | [ ] |

Phases 03 and 04 depend only on 02 and may run in either order. Phase 05
depends only on 02 (the sidebar exists to be styled as a region).

## 6. Feature-level Definition of Done

- [ ] Every phase in §5 is ticked, and every task is complete with tests
  passing
- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] Manually verified at 1920×1080, 1280×800, 900×800 and 390×844:
  - open COMP2100 from a timeline card
  - move it with the strip, and undo
  - answer a check inside the tree
  - drag COMP4680 from search onto S1 2029
  - widen details past 680px and see two columns
  - narrow the window to 1280 and see Requirements step down and then fold
  - at 900, see the drawer
  - on a phone, switch tabs and drag the sheet to full height
- [ ] Every requirement in §2 is covered (see §7)
- [ ] Every `Human review:` task explicitly accepted by the user
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| WR1 | Tasks 1, 2 |
| WR2 | Task 3 |
| WR3 | Tasks 3, 5 |
| WR4 | Out of scope (none) |
| WR5 | Task 5 |
| WR6 | Tasks 5, 11 (palette Enter) |
| WR7 | Tasks 4, 5 (grip removed in the Phase 02 review, 2026-09-29) |
| WR8 | Tasks 4, 5 |
| WR9 | Tasks 5 (1, 5), 6 (3, 4), 7 (2, 6) |
| WR10 | Task 5 |
| WR11–WR12 | Task 5 (WR12 as amended: re-derive from every new view) |
| WR13–WR14 | Task 7 |
| WR15 | Tasks 5, 6, 7 |
| WR16–WR17 | Task 8 |
| WR18 | Tasks 7 (aria-current), 8 (ring) |
| WR19 | Task 8 |
| WR20–WR22 | Task 13 (plus the glass on floating layers added by Tasks 11, 18, 20 and 21) |
| WR23 | Task 15 |
| WR24–WR26 | Tasks 14 (24, 25), 11 (26) |
| WR27–WR29, WR31 | Task 11 |
| WR30 | Task 12 |
| WR32–WR34, WR37–WR39, WR41 | Task 18 |
| WR35 | Tasks 16, 19 |
| WR36 | Tasks 18 (toggle), 19 (container query) |
| WR40 | Task 17 |
| WR42 | Task 19 |
| WR43 | Task 20 |
| WR44–WR45 | Task 21 |
| WR46 | Task 9 |
| WR47 | Task 10 |
| WR48 | Task 22 |
| NFR: accessibility / axe | Tasks 5, 11, 18, 20, 21, 23 |
| NFR: no overflow / fitted / card budget | Tasks 15, 18, 20, 23 |
| NFR: motion | Tasks 19, 21 |
| NFR: payload / 50ms | Task 3 |
| NFR: glass performance | Task 23 |
| NFR: visual review | Tasks 7, 13, 15, 19, 21, 23 |

## 8. Risks / open questions

None.
