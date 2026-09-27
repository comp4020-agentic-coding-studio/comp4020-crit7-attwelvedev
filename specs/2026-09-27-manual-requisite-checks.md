# Manual checks for "Verify on P&C" requisite items

- **Date:** 2026-09-27
- **Status:** Approved
- **Approved by user:** yes — 2026-09-27

## 1. Problem / intent

Some requisites can't be checked by the planner: a permission code, a
minimum mark, a WAM, a project supervisor. Since commit 4f1d275 these
evaluate as *unknown*, and a course whose checkable requisites are all met
but which still has one of these lands in the neutral **Check
requirements** state with a "Verify on P&C: …" note — permanently, since
nothing the student does in the planner can resolve it.

The user's intent: let the student record, per item, whether they meet it
(**met / not met / blank**). When the requisite then works out met, the
card drops the "Verify on P&C" note and reads Available — the plan says
what the student actually knows about themselves, not just what the
catalogue can prove.

## 2. Requirements

### 2.1 Functional requirements

1. Every verify item on a course (every entry of
   `CatalogueCourse.requisites.unverifiable`, including advice/instruction
   lines — see probe 2) can be answered **Met**, **Not met** or **Not
   sure**. Not sure is the default and is represented as *no answer*.
2. The control is in the course's **Details** dialog (`CourseDetail.tsx`):
   one labelled three-way choice per item, keyboard- and screen-reader-
   operable (a radio group or equivalent), usable at 390px.
3. Answers feed the existing three-valued evaluation (`evaluate.ts`
   `evalNode`): an unverifiable leaf with answer Met → `ok: true`, Not met
   → `ok: false`, no answer → `ok: null`. Card state follows the whole
   requisite tree as today:
   - `ok === true` → **Available** (FR 3a: even if items on an irrelevant
     OR branch stay blank — e.g. MATH1116 with MATH1115 placed and "MATH1115
     with a mark of 60 or above" = Met is Available with the MATH1113 "mark
     of 80" item blank).
   - `ok === null` → **Check requirements**.
   - `ok === false` → **Needs prerequisites** (existing amber `soft`
     state). Each Not met answer that contributes adds a reason:
     `You marked "<item label>" as not met`.
4. The card's "Verify on P&C: …" line lists only items with **no answer**,
   and is absent when the placement is Available. Answered items never
   appear in it.
5. An item that is AND'ed directly with a course leaf in the parsed tree
   (e.g. MATH1116's `AND(MATH1115, "with a mark of 60 or above")`) is
   labelled with that course — "MATH1115 with a mark of 60 or above" —
   everywhere it is shown (Details control, card note, Not met reason).
   Other items are labelled with their text as-is.
6. Verify items that come from P&C's **incompatibility** field (today
   routed only into `unverifiable`, never into the tree — COMP3820,
   COMP4550, COMP4620, COMP4820, MATH4343) become required: AND'ed with the
   course's prerequisite (or standing alone if it has none). Consequence:
   e.g. COMP4820 moves from Available to Check requirements until they're
   answered Met.
7. The Details requisite tree (`RequisiteTree.tsx`) shows an answered item
   as `✓ met (marked by you)` / `✗ not met (marked by you)`; unanswered
   stays `not checked`.
8. Answers are stored **per plan + course + item text**, independent of
   placement: they survive Move to, remove + re-place, and undo of a
   remove, and are part of the plan (visible to anyone with the plan
   link).
9. The same item text on two different courses is answered independently.
10. An answer whose item text no longer appears on the course (catalogue
    re-scrape, parser change) is ignored — the item shows as blank again;
    the orphaned answer is never displayed.
11. A read-only plan (the example) shows the controls disabled; the
    server rejects answer changes on it (403, like other mutations).
12. The help page's "Check requirements" entry explains that items can be
    marked in Details and what each answer does.

### 2.2 Non-functional requirements

- Accessibility: each item's control is a labelled group (label = item
  label, FR 5); axe (`spec/` `axeViolations`) stays clean.
- Both marking viewports (1920×1080, 390×844) with no sideways overflow in
  the Details dialog.
- Server validation mirrors pins/choices: unknown plan 404, read-only 403,
  unplaced course 400, item text not among the course's verify items 400/409.

### 2.3 Out of scope

- The "No published offering — verify on P&C" badge.
- `otherPrograms` notes ("Students enrolled in … must …").
- Program leaves (e.g. "studying AENSE") — not manually overridable.
- Feasibility / **Blocked**: still optimistic about unverifiable leaves; a
  Not met answer yields Needs prerequisites, never Blocked.
- Requirement allocation and progress bars: unaffected.
- Classifying items as requirement vs advice (rejected, probe 2).

### 2.4 Assumptions (confirmed)

- Students answer about themselves honestly — it's their own plan
  (accepted by user with the design).
- Item text is a stable enough key; drift resets to blank (FR 10) —
  confirmed as acceptable in the approved design.

## 3. Existing context

- `src/lib/domain/types.ts`: `ReqExpr` has `{ kind: "unverifiable"; text }`;
  `ParsedRequisites.unverifiable: string[]`.
- `src/lib/domain/requisites.ts` `parseRequisites`: incompatibility-bucket
  sentences with no course code are pushed to `unverifiable` but not into
  `prereq` (the FR 6 gap); `collectUnverifiable` gathers tree leaves.
- `src/lib/domain/evaluate.ts`: `evalNode` returns `ok: null` for
  unverifiable; and/or are Kleene since 4f1d275; `state` is
  `"hard" | "soft" | "check" | "available"`; `verify` =
  `course.requisites.unverifiable`; reasons come from failing units leaves;
  `prereqsToPlace` from `coursesToPlace`.
- `src/lib/domain/view.ts` `buildPlanView` / `CourseCard.verify`;
  `src/components/CourseCard.tsx` renders `Verify on P&C: …` from
  `placement.verify`; `CourseDetail.tsx` renders the requisite tree and Pin
  to; `RequisiteTree.tsx` renders `statusText`.
- Persistence: `src/lib/schema.ts` — `plan_courses` (PK plan+course,
  `pinned_group_id`), `plan_choices` (PK plan+group). `deletePlacement`
  deletes the `plan_courses` row, so answers can't live on it (FR 8) — a
  new table is needed. Migrations in `drizzle/` via `pnpm db:generate`.
- Service/API pattern: `src/lib/plan-service.ts` (`setPin`, `setChoice`
  → `ServiceResult`), routes under `src/pages/api/plans/[id]/*.ts` (PUT with
  JSON body), client calls in `src/components/api.ts`.
- `PlanState` (`types.ts`) is what `evaluatePlan` receives; `getPlan`
  (`repo.ts`) assembles it.
- Inventory (2026-09-27, 87 undergrad courses): 25 have verify items; 5 of
  those have items outside the tree (FR 6). Items include advice lines
  (COMP4011/4020/4045 "Students who meet the pre-requisites can request a
  permission code…", COMP3770 "Finding a project/supervisor is best done…",
  MATH2222 "please consult the MSI First-year Coordinator").

## 4. Design

**Data model.** New table `plan_checks (plan_id, course_code, item_text,
answer)` with PK `(plan_id, course_code, item_text)`; `answer ∈ {"met",
"not-met"}`; no row = Not sure. `PlanState` gains `checks:
Record<courseCode, Record<itemText, "met" | "not-met">>`, loaded by
`getPlan`. Not deleted by `deletePlacement` (FR 8); deleted with the plan.

**Parsing (FR 6).** `parseRequisites` AND's the incompatibility-bucket
unverifiable sentences into `prereq` (so they're ordinary unverifiable
leaves). `unverifiable` stays the full list.

**Evaluation (FR 3).** `evaluatePlan` receives the plan's checks;
`evalNode`'s unverifiable case looks up `checks[course][text]`. Not met
leaves under a failing tree produce reasons (FR 3). `verify` on the
placement becomes the *unanswered* items, and is empty when `state ===
"available"` (FR 4).

**Labels (FR 5).** A pure helper derives each item's display label from
the tree: an unverifiable leaf whose parent AND contains exactly one
course leaf gets `"<CODE> <text>"`; otherwise its text. Answers stay keyed
by raw text (FR 8/10), labels are display only.

**API.** `PUT /api/plans/:id/checks` `{ code, item, answer: "met" |
"not-met" | null }` → full `PlanView` (null deletes the row). Service
validates as in §2.2.

**UI.** Details: under the requisite tree, a "Your checks" list — per item
its label and a three-option radio group (Met / Not met / Not sure),
disabled when read-only. Card: unchanged structure; the verify line just
receives fewer items.

**Alternatives rejected.**
- *Available only when every item is Met* — forces answers on irrelevant
  OR branches (MATH1113 mark for a MATH1115 student). Tree logic instead.
- *Hand-tagged advice lines without controls* — a maintained phrase list
  that goes stale; "Met" on advice means "dealt with".
- *Controls on the card* — COMP4550 has four long items; too much for a
  13rem card and 390px.
- *Clear answers on remove, like pins* — loses answers on an accidental
  remove; an answer is about the student, not the semester.
- *A separate "requirement not met" state* — the amber Needs prerequisites
  state with a specific reason is consistent with a missing course.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | ambiguity | "If all these checks are met" vs items on OR branches (MATH1116 mark 60 via MATH1115 *or* mark 80 via MATH1113) | Tree logic: Available when the requisite evaluates met (FR 3) |
| 2 | gap | Many items are advice/instructions, not requirements; parser can't tell them apart | Every item gets the control; Met = "dealt with" (FR 1) |
| 3 | gap | Fragments lack their course ("with a mark of 60 or above") | Label with the AND'ed course (FR 5) |
| 4 | gap | 5 courses' permission-code items (from the incompatibility field) sit outside the tree; COMP4820 reads Available | Make them required leaves (FR 6) |
| 5 | gap | What a Not met answer does | Needs prerequisites with a "You marked … as not met" reason (FR 3) |
| 6 | ambiguity | "The message can be removed" — when partially answered? | Gone when Available; otherwise lists only unanswered items (FR 4) |
| 7 | gap | Where the control lives | Details dialog (FR 2) |
| 8 | gap | Answer lifetime on remove / re-place / undo | Kept per plan + course (FR 8); new table since `deletePlacement` drops the row |
| 9 | assumption | Item text as key; catalogue wording drift | Drift resets to blank, orphans ignored (FR 10) |
| 10 | gap | Same sentence on several courses (e.g. "contact the School of Computing…") | Answered per course (FR 9) |
| 11 | gap | Read-only example plan | Controls disabled, server 403 (FR 11) |
| 12 | gap | Interaction with Blocked / allocation | Unaffected (§2.3) |

## 6. Handoff notes for planning

- Decided — don't re-litigate: tree logic (not "all met"); every item
  controllable; incompatibility-field items become required; Not met →
  amber soft; Details-only controls; answers keyed by plan+course+text and
  kept across remove.
- FR 6 changes existing states (COMP4820 etc. → Check requirements):
  expect real-catalogue test updates, and diff every course's tree before
  and after as done for the parser commits.
- The example-plan invariant ("no soft placements", `evaluate.test.ts`)
  must still hold — the example plan has no answers, so its items stay
  unknown → check, not soft.
- Needs a Drizzle migration (`pnpm db:generate`); never hand-edit
  generated files.
- Keep FR 5 labelling a pure, unit-tested helper; answers must key on raw
  text, not the label.
- Suggested slices: (1) FR 6 parse change; (2) storage + service + API;
  (3) evaluation + labels + verify list; (4) Details UI + tree + help;
  one commit each, `pnpm check` green, both viewports verified for UI.
