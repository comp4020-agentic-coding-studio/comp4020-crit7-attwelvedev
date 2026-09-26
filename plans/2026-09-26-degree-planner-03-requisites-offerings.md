# Degree Planner — Phase 03: Requisite parser & offering status

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first,
  especially the `ReqExpr`, `ParsedRequisites`, `CourseFilter` and
  `OfferingStatus` types in §4.2.
- **Depends on phases:** 01 (data, adapter), 02 (Task 8 wires the parser into
  the seed in `db.ts`).

## 1. Summary

Two pure modules, each pinned by real 2027 data:
- `parseRequisites()` turns P&C requisite prose into an AND/OR expression tree
  of course, unit-count and program leaves, with anything else kept as explicit
  `unverifiable` text. It is wired into boot seeding.
- `offeringStatus()` classifies each (course, term) as offered, not-offered,
  projected (2029–30) or unknown (no published offerings).

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements FR11, FR12 (the `unverifiable` data behind the verify
badge), FR14, and FR34 (the `unknown` status). The full text is in overview
§2.1.

### 2.2 Non-functional

- The parser never throws on any scraped course.
- No silent drops: every course code in the prerequisite text ends up somewhere
  in the parsed result.

### 2.3 Out of scope for this phase

Using these results for blocking (Phase 04). The badge UI (Phase 06).

### 2.4 Assumptions

See overview §2.4. The parser's precedence (OR binds tighter than AND) is known
to read COMP4350's "either A or B and C" too strictly. That's accepted: the
worst case is a false soft-block.

## 3. Existing code context (verified 2026-09-26)

**Real requisite phrasings** in `data/2027/courses/*.json`, which the grammar
must handle. `prerequisites` and `incompatibilities` are separate strings;
`"None"` means empty.

- Lead-ins: "To enrol in this course you must have (successfully) completed(:)",
  "To enrol in this course, you must…", "To enrol you must…", or no lead-in at
  all ("12 units of 3000 and/or 4000 level COMP courses.").
- Connectives: `or`/`OR`, `and`/`AND`, `,` in lists ("MATH1005 , MATH1013 ,
  MATH1113 , or MATH1115"), `/` ("COMP1110 / COMP1140"), and the shorthand
  "COMP1110 /1140". Parentheses are used, with spaces inside them.
- Concurrency: "have completed or be currently enrolled in COMP2620";
  "successfully completed or be currently studying COMP2100".
- Unit clauses:
  - "24 units of COMP coded courses"
  - "6 units of 1000-level MATH" / "6 units of 1000 level MATH"
  - "6 units of MATH courses" / "6 units of MATHS excluding MATH1003" /
    "6 units of MATH courses (excluding MATH1003 )"
  - "12 units of 3000 and/or 4000 level COMP courses"
  - "12 units of 3000/4000 level (COMP OR INFS courses)"
  - "6 units of COMP2000 -level courses"
  - "6 units of ( COMP3670 or MATH1013 or … )"
  - "12 units of 1,000 level courses"
  - "24 units towards a degree" / "72 units of tertiary courses|study"
  - "12 units of Computer (COMP) or Statistics (STAT) courses"
  - "12 units of 2000-level MUSI, DESN or ARTV courses"
- Program clauses:
  - COMP4450: "must be enrolled in the: Bachelor of Computing (Honours) (HCOMP)
    OR … (COMP-HSPC) OR (Bachelor of Advanced Computing (AACOM) AND have
    successfully completed 24 units of COMP coded courses)"
  - COMP4820: "must be studying a Bachelor of Advanced Computing AND …"
  - COMP4500: "…studying: Bachelor of Advanced Computing (AACOM) AND … OR
    Bachelor of Engineering (Honours) in Software Engineering (AENSE) AND …"
- Other-program sentences: COMP2100 has "Students enrolled in a Bachelor of
  Science (BSC) or Bachelor of Advanced Science (ASCAD) must have successfully
  completed: …".
- Incompatibility text inside the prerequisites field: MATH1005 ("Incompatible:
  MATH6005"), COMP1600 ("It is incompatible with COMP6260 ."), and MATH2222.
- Non-evaluable conditions:
  - marks ("MATH1115 with a mark of 60 or above")
  - WAM ("weighted average mark equivalent to an ANU 70 per cent…")
  - "find a project/supervisor"
  - permission codes ("You will need to contact the School of Computing to
    request a permission code"), which appear in the incompatibilities field for
    COMP4550, COMP4620 and COMP4820
  - "Additional Prerequisite courses for the Advanced Topic will be listed…"
  - "with consent of the Convener"
- Lists with titles: INFS2024 ("at least one of the following courses: INFS1001
  - Business Information Systems COMP1100 - Programming as Problem Solving …").

**Offerings**: `offerings[].year` is a string and `semester` is "First Semester"
/ "Second Semester" / "Spring Session" / etc. The catalogue horizon (the maximum
year) is 2028. COMP4045: 2027 S1, 2028 S2. ENGN1211: 2027 S1 only. COMP3670:
S2 only.

### Interfaces from earlier phases (exact)

- Types from overview §4.2, in `src/lib/domain/types.ts`.
- `src/lib/domain/terms.ts`: `TERMS`, `termLabel(index: number): string`. This
  phase adds to this file.
- `src/lib/catalogue/from-pandc.ts`:
  `fromPandc(json: PandcCourseJson, tdpCourses: string[] | null, parse?: …): CatalogueCourse`
  and `emptyParse`.
- `src/lib/seed.ts`:
  `export function seedReferenceData(db: BetterSQLite3Database, input: SeedInput, parse = emptyParse): void`.
- `src/lib/db.ts` currently calls
  `seedReferenceData(db, loadSeedInput(), /* parser */)` with `emptyParse`
  after `migrate`. Task 8 passes `parseRequisites` there instead.

## 4. Approach

A hand-written tokeniser plus recursive-descent parser (details in Task 8), and
table-driven fixture tests on real courses. Offering status is a pure function
of the course, the term and the catalogue horizon.

## 5. Task breakdown

### Task 8: Requisite parser

- **Description:** `parseRequisites` per FR11, pinned by real 2027 texts, plus a
  no-silent-drop invariant over the whole catalogue. Wire it into seeding.
- **Files touched:** `src/lib/domain/requisites.ts` (new),
  `src/lib/domain/requisites.test.ts` (new), `src/lib/db.ts` (pass
  `parseRequisites`).
- **Tests first (red):** a fixture table. The input is the course JSON's
  `{prerequisites, incompatibilities}` read from `data/2027/courses`. Assert
  deep equality with the expected tree (notation: `C(x)` = course,
  `Cc(x)` = concurrent, `U(n, filter)`, `P(code, sat)`, `V(...)` = any
  unverifiable).

  | Course | Expected `prereq` | Expected `incompatible` / other |
  | --- | --- | --- |
  | COMP1100 | `null` | `[COMP1130]` |
  | COMP1110 | `or(C1100, C1130, C1730)` | `[COMP1140, COMP6710, COMP7710]` |
  | COMP1600 | `and(U(6,{MATH}), or(C1100, C1130))` | includes `COMP6260` (moved out of prereq text) |
  | COMP2100 | `and(or(C1110, C1140), U(6,{MATH, 1000–1000}))` | `otherPrograms.length === 1` (the BSc/ASCAD sentence) |
  | COMP2120 | `Cc(COMP2100)` | `[COMP2130, COMP6120, COMP6311]` |
  | COMP2310 | `and(or(C1110, C1140), or(C2300, ENGN2219))` | |
  | COMP3242 | `and(U(6,{codes:[COMP3670, MATH1013, MATH1014, MATH1115, MATH1116]}), or(C1110, C1140))` | |
  | COMP3310 | `and(or(C2100, C2300), U(6,{COMP, 2000–2000}))` | |
  | COMP3320 | `and(or(C2100, C2300, ENGN2219), or(C1600, U(6,{MATH, excludeCodes:[MATH1003]})))` | |
  | COMP3600 | `and(U(24,{COMP}), or(U(6,{MATH}), C1600))` | `[COMP6466]` |
  | COMP3620 | `and(or(C1110, C1140), Cc(COMP2620))` (the `/1140` shorthand) | |
  | COMP4011 | `and(U(12,{COMP, 3000–4000}), V…)` | `parseStatus` partial or `unverifiable.length ≥ 1` |
  | COMP4450 | `or(P(HCOMP,false), P(HADAN,false), P(COMP-HSPC,false), and(P(AACOM,true), U(24,{COMP})))` | `[COMP2550, COMP6445]` |
  | COMP4550 | `and(or(C2550, Cc(COMP4450)), V, V, V)` | `[COMP4500, COMP4560, COMP4810, COMP4820]`; the permission-code sentence goes to `unverifiable` |
  | COMP4650 | `and(or(C1600, C2100), U(12,{prefixes:[COMP, INFS], 3000–4000}))` | |
  | COMP4670 | `or(C3670, and(or(C1110, C1140), or(MATH1014, MATH1115, MATH1116)))` | |
  | COMP4820 | `and(P(null "Bachelor of Advanced Computing", true), C2100, U(12,{COMP, 3000–3000}))` | |
  | MATH1005 | `null` | `[MATH6005]` (moved from the prereq field) |
  | MATH1116 | `or(and(C(MATH1115), V), and(C(MATH1113), V))` (the mark clauses) | |
  | ENVS2015 | `U(24,{})` ("towards a degree") | |

  Plus:
  - `no silent drops`: for every JSON in `data/2027/courses`, every
    `\b[A-Z]{4}\d{4}\b` in `prerequisites` appears in the result as a course
    leaf, in a units filter's `codes`/`excludeCodes`, in `incompatible`, or in
    some `unverifiable`/`otherPrograms` text.
  - `never throws on any catalogue course`.
  - `"None" → prereq null`.
- **Implementation (green):**
  `export function parseRequisites(input: { prerequisites: string; incompatibilities: string }): ParsedRequisites`.
  1. Split sentences on `. ` or a newline that isn't inside parentheses.
  2. Route sentences matching `/^(Incompatible|It is incompatible|You (are not able|cannot|may not) enrol)/i`
     to incompatibilities.
  3. Route `/^Students (enrolled|studying) in .* must/i` to `otherPrograms`
     unless it names AACOM.
  4. Strip the lead-in filler `/^(To enrol( in this course)?,? you must( have)?( successfully)?( completed)?( the following)?\s*:?)/i`
     and the fillers `either`, `at least one of the following courses`, and
     ` - <Title>` after a code.
  5. Tokenise into:
     - CODE (a code optionally followed by `/NNNN` shorthand, expanded to OR)
     - UNITS (`N units of …` through its noun phrase, mapped to a
       `CourseFilter` via prefix, level and excluding patterns)
     - PROGRAM (`(CODE)` after "Bachelor/Honours Specialisation …")
     - AND (`and`, `AND`, `&`)
     - OR (`or`, `OR`, `/`, `,`)
     - parentheses
     - CONCURRENT marker (`completed or (be )?currently (enrolled in|studying)`)
     - TEXT (anything else)
  6. Recursive descent with OR binding tighter than AND. Runs of TEXT become
     `unverifiable`, and a code inside TEXT stays in that text.
  7. Incompatibility text: every code becomes a list entry; non-code sentences
     (permission codes, "contact …") go to `unverifiable`.
  8. `parseStatus = "partial"` iff any `unverifiable` exists.

  Pass `parseRequisites` into `seedReferenceData` in `db.ts`.
- **Refactor:** Keep the tokeniser patterns in a named table with one comment per
  pattern citing the example it exists for.
- **Acceptance criteria:**
  - Every fixture and invariant test passes.
  - Seeded requisite rows are non-null for courses whose prerequisites aren't
    "None".
- **Depends on:** 3, 6.

### Task 9: Offering status and projection

- **Description:** FR14 and FR34.
- **Files touched:** `src/lib/domain/terms.ts`, `src/lib/domain/terms.test.ts`.
- **Tests first (red):** the catalogue is built from the real data via
  `fromPandc`.
  - `COMP3670 S1 2027 not-offered, S2 2027 offered`.
  - `COMP4045 S2 2029 projected (from 2028 S2), S1 2029 not-offered`.
  - `ENGN1211 S1 2028 not-offered (horizon data), S1 2029 projected (from 2027)`.
  - `COMP4600 unknown in every term`.
  - `horizonYear(catalogue) === 2028`.
  - `offeredLabel`: COMP2100 gives `"S1, S2"`; COMP4600 gives
    `"No published offering"`.
- **Implementation (green):**
  - `export function horizonYear(courses: Iterable<CatalogueCourse>): number`
  - `export function offeringStatus(course: CatalogueCourse, term: Term, horizon: number): OfferingStatus`
  - `export function offeredLabel(course: CatalogueCourse): string`
  - Session mapping: "First Semester" is S1, "Second Semester" is S2. Other
    sessions are ignored on the timeline.
- **Refactor:** None expected.
- **Acceptance criteria:** the tests pass.
- **Depends on:** 3.


## 6. Phase Definition of Done

- [x] Every task in §5 is complete and its tests pass
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] Seeded `course_requisites` rows are non-null wherever `prerequisites` isn't "None" (checked in the seed test or a quick query) — one accepted exception: MATH1005, whose `prerequisites` field is actually incompatibility text ("Incompatible: MATH6005"); Task 8's own fixture table requires this to parse to `null`, and its `MATH6005` code is captured under `incompatible` instead.
- [x] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR11 | Task 8 |
| FR12 (data) | Task 8 |
| FR14 | Task 9 |
| FR34 (status) | Task 9 |

## 8. Risks / open questions

None.
