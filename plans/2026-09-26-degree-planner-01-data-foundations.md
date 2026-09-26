# Degree Planner — Phase 01: Data foundations

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first:
  FR1–FR37, the shared types (§4.2), conventions (§3).
- **Depends on phases:** none.

## 1. Summary

Lay the ground every later phase tests against:
- a fast Vitest unit project
- the 8-term model
- a committed, attributed 2027 scrape of AACOM and its courses (including a
  time-boxed search for P&C's transdisciplinary tag)
- an adapter from `anu-pandc` course JSON to the domain `CatalogueCourse`
- the hand-curated AACOM 2027 requirement tree, validated against the scraped
  pages

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements FR7, FR8, FR13, FR36 and FR37, and the data side of FR19
(two-semester detection) and FR35 (the undergrad filter). The full text is in
overview §2.1.

### 2.2 Non-functional

- Unit tests run without building or booting the server.
- Scraping happens offline only, on the dev machine, with `.venv/bin/anu-pandc`.

### 2.3 Out of scope for this phase

Database, seeding, the requisite parser (Phase 03), UI.

### 2.4 Assumptions

See overview §2.4. Specific to this phase: the TD tag is never guessed. If the
time-box finds no machine-readable source, `tdp.json` records
`courses: null`.

## 3. Existing code context (verified 2026-09-26)

- **`package.json` scripts**:
  - `"build": "astro build"`
  - `"typecheck": "astro check"`
  - `"check": "pnpm typecheck && pnpm test"`
  - `"test": "astro build && vitest run"`
  - `"db:generate": "drizzle-kit generate"`
  - `"check:evidence": "node scripts/check-evidence.ts"`
- **`vitest.config.ts`** today:
  ```ts
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    test: {
      include: ["spec/**/*.test.ts", "scripts/**/*.test.ts"],
      globalSetup: ["./spec/global-setup.ts"],
    },
  });
  ```
  `spec/global-setup.ts` (`export default async function setup(project: TestProject): Promise<() => void>`)
  throws unless `./dist/server/entry.mjs` exists, then boots it. As things stand,
  **every** test needs a build and a server.
- **`tsconfig.json`**:
  `{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist", "node_modules"] }`,
  so `astro check` also typechecks `src/**/*.test.ts`.
- **`.gitignore`** lacks `.venv/` and `data/2026/`. Both exist, untracked. The
  2026 data is the wrong program and year, and isn't used.
- **`anu-pandc` 0.3.1** (`.venv/bin/anu-pandc`):
  - `get CODE... --year 2027 --save DIR [--recursive] --format json --format md`
    saves to `DIR/2027/{programs,subplans,courses}/`, and maintains
    `DIR/2027/course-codes.txt` and `scrape-log.md`.
  - `catalogue COMP --year 2027 --save DIR --format json` writes
    `DIR/2027/catalogue-COMP.json` (an array of
    `{code,title,career,units,sessions}`, 128 entries including postgrad) and
    merges into `course-codes.txt`.
  - `courses --year 2027 --save DIR --format json` bulk-fetches every code in
    `course-codes.txt`.
  - A missing page (`COMP4801`, the honours-grade pseudo-course) prints
    `[error] … no such page` and makes the command **exit 1**, so the script
    can't use `set -e`.
- **Course JSON keys**: `kind, year, scraped_at, code, url, title, units`
  (string), `level` (string), `prerequisites` (string, `"None"` when empty),
  `prerequisite_codes, incompatibilities` (string, `"None"` when empty),
  `requisite_raw, cotaught, description, learning_outcomes, assessment`, and
  `offerings: [{ year: "2027", semester: "First Semester" | "Second Semester" | "Spring Session" | …, mode, class_number, summary_url, topic }]`.
  Subplan JSON has `min_units`.
- **Trial scrape facts** (`/tmp/pandc2027`, 2026-09-26):
  - 149 course JSONs, 87 of them undergrad.
  - Offerings cover 2027–2028 only.
  - Undergrad courses with no offerings: COMP1720, 2710, 3425, 3540, 3703, 3710,
    3820, 4600, 4691, 4712, 4880, MGMT2009.
  - Descriptions containing "completed twice, in consecutive semesters":
    COMP3500, 3770 and 4500 (6 units per part) and COMP4550 (12 per part).
  - No page carries a structured TD tag. The word appears only in prose, in
    COMP4500 and SCOM3029.
  - P&C's search API used by `catalogue` is
    `https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses`
    (params `AppliedFilter=FilterByCourses, SearchText, PageIndex, MaxPageSize, SelectedYear`).
- **AACOM 2027 and specialisation structure**: see §4 below. It was transcribed
  from the live P&C pages on 2026-09-26. ML (MACL-SPEC) returns 404 for 2027 and
  has been merged into ARIN.

## 4. Approach

### 4.1 The AACOM 2027 tree (`src/data/aacom-2027.ts`)

Units sum to 192.

| id | label | rule | req / max | courses / filter |
| --- | --- | --- | --- | --- |
| `prog-a` | Programming as Problem Solving | UNITS | 6 | COMP1100, COMP1130 |
| `prog-b` | Structured Programming | UNITS | 6 | COMP1110, COMP1140 |
| `math-disc` | Discrete mathematics | UNITS | 6 | MATH1005, MATH2222 |
| `compulsory` | Compulsory courses | ALL | 48 | COMP2100, 2120, 2300, 2310, 2400, 3600, 3630, 4450 |
| `spec` *(selectable, specialisation)* | Specialisation | UNITS | 24 | children ↓ |
| ├ `arin` | Artificial Intelligence | UNITS | 24/24 | `arin-a` max 12: COMP2620, 3242, 3620, 3670; `arin-b` min 12: COMP4528, 4620, 4650, 4670, 4680, 4691 |
| ├ `hccc` | Human-Centred & Creative Computing | UNITS | 24/24 | `hccc-core` ALL 6: COMP3900; `hccc-b` min 12: COMP4020, 4350, 4528, 4610; `hccc-c` max 6: COMP3540, 3670 |
| ├ `syar` | Systems & Architecture | UNITS | 24/24 | `syar-b` min 12: COMP4045, 4300, 4712; `syar-a` max 12: COMP3300, 3310, 3320, 3610 |
| └ `thcs` | Theoretical Computer Science | UNITS | 24/24 | `thcs-b` min 12: COMP4011, 4600, MATH4343; `thcs-a` max 12: COMP2620, 3610, 3630, 4712 |
| `comp-upper` | 3000/4000-level COMP | UNITS | 18 | filter `{prefixes:["COMP"],minLevel:3000,maxLevel:4000}` |
| `ict` | ICT-related courses | UNITS | 12 | ARTH2181, ASIA3032, DESN2010, ENGN1211, ENVS2015, INFS2024, INFS3002, INFS3024, MATH1013, MATH1115, MATH2301, MATH2307, MGMT2009, MUSI3309, SCOM3029, SOCY2038, SOCY2166, STAT1003, STAT1008 |
| `capstone` *(selectable)* | Capstone | UNITS | 24 | children ↓ |
| ├ `cap-research` | Research project | ALL | 24 | COMP4550 (12+12) |
| ├ `cap-team` | Team project | UNITS | 24/24 | `cap-team-proj` ALL 12: COMP4500 (6+6); `cap-team-4k` UNITS 12: filter COMP 4000–4000 |
| └ `cap-intern` | Internship | UNITS | 24/24 | `cap-intern-proj` ALL 12: COMP4820; `cap-intern-4k` UNITS 12: filter COMP 4000–4000 |
| `electives` | Electives | UNITS | 48 / none | filter `{}` (any course) |

"max N" leaves have `unitsRequired: 0, unitsMax: N`. "min N" leaves have
`unitsRequired: N` and no max; their parent's cap bounds them.

Program checks:
- `lvl1000-max` (max 60, filter `{minLevel:1000,maxLevel:1000}`)
- `comp4000-min` (min 48, filter `{prefixes:["COMP"],minLevel:4000,maxLevel:4000}`)
- `tdp-min` (min 12, filter `{tdp:true}`)

`tdpCourses` is read from `data/2027/tdp.json`.

## 5. Task breakdown

### Task 1: Split Vitest into unit and spec projects; add `terms.ts`

- **Description:** Give pure logic a fast test loop that doesn't boot the server,
  and add the term model.
- **Files touched:** `vitest.config.ts`, `package.json`,
  `src/lib/domain/types.ts` (new, full content of overview §4.2),
  `src/lib/domain/terms.ts` (new), `src/lib/domain/terms.test.ts` (new).
- **Tests first (red):** `src/lib/domain/terms.test.ts`:
  - `TERMS has 8 terms S1 2027 … S2 2030`: asserts
    `TERMS.map(t => t.label)` equals the 8 labels and `TERMS[3]` equals
    `{ index: 3, year: 2028, session: "S2", label: "S2 2028" }`.
  - `termLabel(8) throws RangeError`.
- **Implementation (green):**
  - `export const TERMS: readonly Term[]`
  - `export function termLabel(index: number): string`
  - `vitest.config.ts` becomes
    `test: { projects: [{ extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } }, { extends: true, test: { name: "spec", include: ["spec/**/*.test.ts", "scripts/**/*.test.ts"], globalSetup: ["./spec/global-setup.ts"] } }] }`
  - In `package.json`, add `"test:unit": "vitest run --project unit"`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm test:unit` runs only `src/**` tests, with no build and no server.
  - `pnpm check` still runs the invariants, readme and guestbook specs green.
- **Depends on:** None.

### Task 2: Offline scrape script and committed 2027 data (with TDP time-box)

- **Description:** Produce the committed data every later test uses as fixtures.
- **Files touched:** `scripts/scrape-2027.sh` (new, executable),
  `data/2027/**` (new, generated), `data/2027/SOURCE.md` (new),
  `data/2027/tdp.json` (new), `.gitignore`.
- **Tests first (red):** `src/lib/domain/data-2027.test.ts`:
  - `every AACOM tree course has a scraped JSON`: every code in this list has
    `data/2027/courses/<code>.json`: COMP1100, 1110, 1130, 1140, 2100, 2120,
    2300, 2310, 2400, 3600, 3630, 4450, 4500, 4550, 4820, MATH1005, MATH2222.
  - `subplans exist`: `data/2027/subplans/{ARIN,HCCC,SYAR,THCS}-SPEC.json`
    exist.
  - `catalogue exists`: `data/2027/catalogue-COMP.json` is an array with length
    > 100.
  - `tdp.json has a valid shape`: it parses to
    `{ source: string | null, courses: string[] | null, note: string }`.
- **Implementation (green):**
  - `scripts/scrape-2027.sh` runs `set -u` (not `-e`) and `P=.venv/bin/anu-pandc`, then:
    1. `$P get AACOM ARIN-SPEC HCCC-SPEC SYAR-SPEC THCS-SPEC --year 2027 --save data --recursive --format json --format md || true`
    2. `$P catalogue COMP --year 2027 --save data --format json || true`
    3. `$P courses --year 2027 --save data --format json || true`
    4. It exits 1 only if `data/2027/programs/AACOM.json` is missing.
  - Run the script.
  - **TD time-box (at most ~1 hour):** look for a transdisciplinary filter on
    `https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses`, for
    example by inspecting the P&C catalogue page's search form and filter
    parameters with the browser's network tab. If one exists, add a step to the
    script that writes `tdp.json` with `source` set to the exact request URL and
    `courses` set to the undergrad codes returned. Otherwise write
    `{ "source": null, "courses": null, "note": "No machine-readable TD tag found on P&C (searched <date>); TDP check is untracked." }`.
  - `SOURCE.md`: source site, scrape date, script invocation, "© The Australian
    National University; republished for a non-commercial student project;
    licence unconfirmed".
  - Add `.venv/` and `data/2026/` to `.gitignore`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `bash scripts/scrape-2027.sh` completes on a clean `data/2027/` even though
    COMP4801 has no page.
  - `git status` doesn't show `.venv/` or `data/2026/`.
  - The tests pass.
  - `tdp.json` reflects the time-box outcome and never contains guessed codes.
- **Depends on:** 1.

### Task 3: pandc JSON → `CatalogueCourse` adapter

- **Description:** Normalise scraped course JSON into the domain type (without
  the requisite parse yet), filtering to undergrad courses.
- **Files touched:** `src/lib/catalogue/from-pandc.ts` (new),
  `src/lib/catalogue/from-pandc.test.ts` (new).
- **Tests first (red):** load the real `data/2027/courses/*.json` with `node:fs`.
  - `COMP2100 maps units, level, offerings`: `units === 6`, `level === 2000`,
    offerings include `{ year: 2027, session: "First Semester" }`, and
    `url` ends in `/2027/course/COMP2100`.
  - `COMP4550 is two-semester, 12 units per part`.
  - `COMP4500 is two-semester`; `COMP2100 is not`.
  - `isUndergrad("COMP4550") && !isUndergrad("COMP8280")`.
  - `COMP4600 has no offerings`.
  - `isTdp follows the given tdp list`: `fromPandc(json, ["COMP4500"]).isTdp`
    for COMP4500.
- **Implementation (green):**
  - `export interface PandcCourseJson { code: string; url: string; title: string; units: string; level: string; prerequisites: string; incompatibilities: string; requisite_raw: string; description: string; scraped_at: string; offerings: { year: string; semester: string; mode: string }[] }`
  - `export function isUndergrad(code: string): boolean` (level digit 1–4)
  - `export function fromPandc(json: PandcCourseJson, tdpCourses: string[] | null, parse: (p: { prerequisites: string; incompatibilities: string }) => ParsedRequisites = emptyParse): CatalogueCourse`,
    where `export const emptyParse: (p: { prerequisites: string; incompatibilities: string }) => ParsedRequisites` (exported, because Task 6 imports it) returns
    `{ prereq: null, incompatible: [], unverifiable: [], otherPrograms: [], parseStatus: "ok" }`.
    `twoSemester = /completed twice,? in consecutive semesters/i.test(description)`.
    Offerings are deduplicated by (year, session).
- **Refactor:** None expected.
- **Acceptance criteria:** the tests pass, and the module imports nothing from
  `src/lib/db.ts`.
- **Depends on:** 2.

### Task 4: Hand-curated AACOM 2027 tree, validated against data

- **Description:** Encode this file's §4.1 exactly and validate it.
- **Files touched:** `src/data/aacom-2027.ts` (new),
  `src/data/aacom-2027.test.ts` (new).
- **Tests first (red):**
  - `group ids are unique`.
  - `top-level units sum to 192`: the sum of `unitsRequired` over top-level
    groups is 192, equal to `totalUnits`.
  - `every listed course has scraped data`, except those in an explicit
    `KNOWN_MISSING` array, which must be empty or justified in a comment.
  - `specialisation options are ARIN, HCCC, SYAR, THCS`.
  - `capstone options are research, team, internship`.
  - `ARIN caps match P&C 2027`: `arin-a.unitsMax === 12` and
    `arin-b.unitsRequired === 12`.
  - `tdpCourses mirrors data/2027/tdp.json`.
- **Implementation (green):**
  - `export const AACOM_2027: ProgramDef` with the groups, checks and
    `tdpCourses` from this file's §4.1.
  - A comment above `spec` records that ML was merged into ARIN from 2027
    (MACL-SPEC 2027 is a 404), and that the AACOM page's "Machine Learning" line
    is stale.
- **Refactor:** None expected.
- **Acceptance criteria:** the tests pass, and every list matches the scraped
  subplan and program pages (checked by the test).
- **Human review:** the user compares `src/data/aacom-2027.ts` with the AACOM
  2027 P&C page and confirms the tree reads correctly. It passes when the user
  explicitly accepts it.
- **Depends on:** 2, 3 (types only).


## 6. Phase Definition of Done

- [x] Every task in §5 is complete and its tests pass
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] Task 4's tree has been shown to the user and explicitly accepted
- [x] `git status` doesn't show `.venv/` or `data/2026/`
- [x] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR7 | Task 2 |
| FR8 | Task 4 |
| FR13 | Task 1 |
| FR19 (detection) | Task 3 |
| FR35 (filter) | Task 3 |
| FR36 | Tasks 2, 4 |
| FR37 | Task 2 |
| NFR fast unit loop | Task 1 |

## 8. Risks / open questions

None.
