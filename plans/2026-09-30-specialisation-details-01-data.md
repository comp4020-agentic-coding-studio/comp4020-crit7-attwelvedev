# Specialisation details — Phase 01: Data

- **Date:** 2026-09-30
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-29 (spec) and 2026-09-30
  (planning rulings)
- **Part of:** `plans/2026-09-30-specialisation-details-00-overview.md`.
  Read it first, especially §2 (SD1–SD5), §3 (conventions) and §4.2
  (shared types).
- **Depends on phases:** none.

## 1. Summary

This phase makes the specialisation content exist as clean, committed data
the app can import:

- a hand-written supplement of what the scrape lost
- a merge script and the merged file it generates
- a typed module linking each P&C specialisation to the app's requirement
  groups
- a drift test that fails if the two ever disagree

No UI changes. At the end, `pnpm check` is green, and PROCESS_LOG.md has an
entry on the lost-sections discovery.

## 2. Requirements (this phase)

### 2.1 Functional

- SD1: all of it (Task 1).
- SD2: all of it (Task 1).
- SD3: the static import (Task 2).
- SD4: the link module, as amended (Task 2).
- SD5: all of it (Task 2).

### 2.2 Non-functional

- N3: nothing here touches `PlanView`.
- N4: the static import.

### 2.3 Out of scope for this phase

Any rendering. The panel is Phase 02; entry points are Phase 04.

### 2.4 Assumptions

See overview §2.4. Phase-specific: Node runs `scripts/*.ts` directly, as
`package.json` already does with `node scripts/check-evidence.ts`, so the
script must use erasable TypeScript only: no enums, no namespaces,
`import type` for types.

## 3. Existing code context (verified 2026-09-30)

- **The scraped files** are `data/2027/subplans/{ARIN,HCCC,SYAR,THCS}-SPEC.json`
  (plus `.md`, unused).
  - Their keys: `kind, year, scraped_at, code, url, title, min_units,
    introduction, learning_outcomes, requirements, specialisations,
    all_course_codes`.
  - `introduction` is one string with paragraphs separated by `\n\n`.
    SYAR's ends "Depending on the chosen courses, students will learn
    about:".
  - Each `requirements` entry is either `{type:"text", content}` or
    `{type:"group", heading, courses:[{code,title,units:null}]}`.
  - HCCC's entries, in order:
    1. text "Advice to Students"
    2. text "This Undergraduate Specialisation requires … courses:"
    3. text "This specialisation is only available to students studying BAC
       (AACOM) and BACR&D (AACRD)."
    4. group "The 24 units must consist of:" [COMP3900]
    5. text "AND"
    6. group "A minimum of 12 units from completion of courses from the
       following list:" [COMP4020, COMP4350, COMP4528, COMP4610]
    7. text "AND"
    8. group "A maximum of 6 units from completion of courses from the
       following list:" [COMP3540, COMP3670]
- **The P&C group order matches `AACOM_2027`'s children order** for every
  spec:
  - ARIN: arin-a (max 12), then arin-b (min 12).
  - HCCC: hccc-core, hccc-b, hccc-c.
  - SYAR: syar-b (min 12), then syar-a (max 12).
  - THCS: thcs-b (min 12), then thcs-a (max 12).

  See `src/data/aacom-2027.ts:14-131`: `const specialisations: GroupDef[]`,
  under `{ id: "spec", selectable: true, children: specialisations }` at
  lines 238-247.
- **Relevant `GroupDef` fields** (`src/lib/domain/types.ts`): `id; label;
  kind; ruleType; unitsRequired: number; unitsMax?: number; selectable?:
  boolean; courses?: string[]; filter?: CourseFilter; children?:
  GroupDef[]; family?: Family`.
- **How `aacom-2027.ts` imports JSON:** `import tdp from
  "../../data/2027/tdp.json";`. It carries a comment explaining that a
  static import is needed because the Dockerfile ships only `dist/`.
- **Script pattern** (`scripts/check-evidence.ts`): it exports pure
  functions, and `main()` runs only under
  `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { main(); }`.
  Its test, `scripts/check-evidence.test.ts`, imports
  `from "./check-evidence.ts"` (with the extension) and runs in the spec
  project (`vitest.config.ts` includes `scripts/**/*.test.ts`).
- **`scripts/scrape-2027.sh`** runs `.venv/bin/anu-pandc get … --save data
  …` and then rewrites `data/2027/SOURCE.md` and `tdp.json`.
- **`src/lib/domain/data-2027.test.ts`** already checks that the subplans
  exist. Leave it alone.
- **PROCESS_LOG.md header format:** a `## <date> — <short title>` heading,
  then `Resolved by <sha>.` (or a range), then 150-300 words on the call,
  why it beat the obvious one, and how it was checked.

### Interfaces from earlier phases (exact)

None.

## 4. Approach

### 4.1 The supplement (`data/2027/subplans-supplement.json`)

```json
{
  "source": "Hand-copied from https://programsandcourses.anu.edu.au/2027/specialisation/<CODE> on 2026-09-29: the sections anu-pandc 0.3.1 doesn't capture. Edit this, then run node scripts/merge-subplans.ts.",
  "specialisations": {
    "ARIN-SPEC": { "otherInformation": ["…"], "relevantDegrees": ["…", "…"] },
    "HCCC-SPEC": { "otherInformation": ["…"], "relevantDegrees": ["…", "…"], "headings": ["Advice to Students"] },
    "SYAR-SPEC": { "topics": ["…13 items…"], "otherInformation": ["…"], "relevantDegrees": ["…", "…"] },
    "THCS-SPEC": { "otherInformation": ["…", "…"], "relevantDegrees": ["…", "…"] }
  }
}
```

- **Text source.** Take the text from the spec's SD1 reference (verbatim,
  including SYAR's "files systems" typo). Re-check each page live with
  `curl -sL <url>` before committing.
- **Paragraphs.** THCS's Other Information is two paragraphs: the MATH4343
  permission code, then COMP4011's special topics. The others are one each.
- **Types**, in `src/data/specialisation-types.ts`:
  - `SupplementEntry = { topics?: string[]; otherInformation: string[];
    relevantDegrees: string[]; headings?: string[] }`
  - `SubplanSupplement = { source: string; specialisations: Record<string,
    SupplementEntry> }`

### 4.2 Merge rules (`mergeSubplan`)

- **Introduction.** `scraped.introduction.split(/\n{2,}/)`, then each
  paragraph `.trim()`, empty ones dropped.
- **Requirements**, mapped in order:
  - `group` → `{ type: "list", heading, courses: courses.map(c => c.code) }`
  - text exactly `"AND"` → `{ type: "and" }`
  - text listed in `extra.headings` → `{ type: "heading", content }`
  - any other text → `{ type: "text", content }`
- **Throws** (with the code in the message) if an `extra.headings` entry
  matches no text entry. That stops a re-scrape from silently dropping a
  fix.
- **Copied fields:** `code, title, url, year, scrapedAt ← scraped_at,
  minUnits ← min_units, learningOutcomes ← learning_outcomes`. Plus
  `topics ← extra.topics ?? []`, `otherInformation`, `relevantDegrees`.
- **`all_course_codes` and `specialisations` are dropped.**
  `all_course_codes` isn't needed: prose codes are linked at render.
- **`mergeAll`:**
  - It sorts by code.
  - It throws if a scraped code has no supplement entry, or if the
    supplement names a code that wasn't scraped.
  - It returns `{ generatedBy: "scripts/merge-subplans.ts from data/2027/subplans/*.json and data/2027/subplans-supplement.json. Don't hand-edit: change the supplement and re-run.", specialisations }`.
- **Output.** `main()` writes `JSON.stringify(file, null, 2) + "\n"` to
  `data/2027/specialisations.json`.

### 4.3 The link module (`src/data/specialisations.ts`)

```ts
import merged from "../../data/2027/specialisations.json";
import { AACOM_2027 } from "./aacom-2027";
```

- **Links.** `const GROUP_OF: Record<string, string> = { "ARIN-SPEC":
  "arin", "HCCC-SPEC": "hccc", "SYAR-SPEC": "syar", "THCS-SPEC": "thcs" }`.
- **Building each entry.** Find the selectable `SPEC_CHOICE_GROUP` ("spec")
  in `AACOM_2027.groups`, then its child with id `GROUP_OF[code]`. Pair the
  entry's *k*-th `list` block with `child.children[k]`:
  - `groupId`, `label`, and `unitsMax ?? null`
  - `shortLabel`: `label.split(" — ")[1] ?? label`
- **It throws at import** if a link, a child, or a list's group is missing.
  It's static data, so failing loudly in every test beats rendering half a
  page.
- **Lookups:**
  - `specialisationByCode` accepts only exact codes (`"ARIN-SPEC"`).
  - `specialisationByGroup("arin")`.
  - `specialisationsListing(courseCode)` returns every spec whose lists
    include the code, in `SPECIALISATIONS` order.

### 4.4 The drift test (`spec/specialisation-data.test.ts`, non-browser)

For each `SPECIALISATIONS` entry, against `AACOM_2027`'s own group:

1. `minUnits === group.unitsRequired`.
2. The number of `list` blocks equals `group.children.length`.
3. For each list *k*: the set of `courses` equals the set of
   `children[k].courses`.
4. If the heading matches `/maximum of (\d+) units/i`, then
   `children[k].unitsMax === N`. If it matches `/minimum of (\d+) units/i`,
   then `children[k].unitsRequired === N`.

A failure names the spec, the list heading, and the missing or extra codes.

## 5. Task breakdown

### Task 1: Supplement, merge script and merged data

- [ ] **Description.** Add the supplement from the live P&C pages, a pure
  and tested merge script, the generated `data/2027/specialisations.json`,
  and a freshness test, per this file's §4.1–4.2. Also add the merge step to
  the scrape script and a package script.
- **Files touched:**
  - `data/2027/subplans-supplement.json` (new)
  - `src/data/specialisation-types.ts` (new; the overview §4.2 types plus
    `ScrapedSubplan`, `SupplementEntry`, `SubplanSupplement`)
  - `scripts/merge-subplans.ts` (new)
  - `scripts/merge-subplans.test.ts` (new)
  - `data/2027/specialisations.json` (new, generated)
  - `scripts/scrape-2027.sh`: append `node scripts/merge-subplans.ts`
    after the `anu-pandc get` line
  - `package.json`: add `"data:subplans": "node scripts/merge-subplans.ts"`
- **Exact exports** of `scripts/merge-subplans.ts`:
  ```ts
  export function mergeSubplan(scraped: ScrapedSubplan, extra: SupplementEntry): SpecialisationData;
  export function mergeAll(scraped: ScrapedSubplan[], supplement: SubplanSupplement): SpecialisationsFile;
  export function readInputs(root?: string): { scraped: ScrapedSubplan[]; supplement: SubplanSupplement }; // root defaults to "."
  ```
  `ScrapedSubplan` in `specialisation-types.ts`:
  ```ts
  export interface ScrapedSubplan {
    kind: "subplan"; year: string; scraped_at: string; code: string; url: string; title: string;
    min_units: number; introduction: string; learning_outcomes: string[];
    requirements: (
      | { type: "text"; content: string }
      | { type: "group"; heading: string; courses: { code: string; title: string; units: number | null }[] }
    )[];
    specialisations: unknown[]; all_course_codes: string[];
  }
  ```
- **Tests first (red)**, in `scripts/merge-subplans.test.ts`:
  1. `mergeSubplan` splits the introduction into trimmed paragraphs: a
     `"A\n\nB\n\n\nC"` fixture gives `["A","B","C"]`.
  2. It maps a group to `{type:"list", heading, courses:[codes]}`, `"AND"`
     to `{type:"and"}`, a listed heading to `{type:"heading"}`, and other
     text to `{type:"text"}`, in order.
  3. It throws when `extra.headings` names text the scrape doesn't have.
  4. `mergeAll` throws on a scraped code with no supplement entry, and on a
     supplement code that wasn't scraped. It sorts by code.
  5. **Freshness:** `mergeAll(...Object.values(readInputs()))` deep-equals
     `JSON.parse(readFileSync("data/2027/specialisations.json"))`. The
     failure message says "run node scripts/merge-subplans.ts".
  6. **The real data:**
     - SYAR has 13 topics and HCCC has a `heading` "Advice to Students".
     - Every spec has at least one `otherInformation` paragraph, and
       exactly two `relevantDegrees` containing "(AACOM)" and "(AACRD)".
     - No `text` block equals "AND".
- **Implementation (green).** Write the types, then the script per this
  file's §4.2, then the supplement per §4.1 (verified against `curl`). Run
  `node scripts/merge-subplans.ts` and commit the output.
- **Refactor.** None expected.
- **Acceptance criteria:**
  - `pnpm build && pnpm exec vitest run --project spec
    scripts/merge-subplans.test.ts` passes.
  - Running `node scripts/merge-subplans.ts` twice leaves
    `git diff --exit-code data/2027/specialisations.json` clean.
  - `pnpm check` is green.
- **Depends on:** none.

### Task 2: `SPECIALISATIONS` link module and the drift test

- [ ] **Description.** Build the typed, statically imported module of
  overview §4.2 (`SpecList`, `SpecialisationInfo`, `SPEC_CHOICE_GROUP`,
  `SPECIALISATIONS`, and the three lookups), per this file's §4.3. Add the
  SD5 drift test per §4.4. Then log the PROCESS moment.
- **Files touched:**
  - `src/data/specialisations.ts` (new; also re-exports the
    `specialisation-types.ts` types)
  - `src/data/specialisations.test.ts` (new, unit)
  - `spec/specialisation-data.test.ts` (new, spec project, no browser)
  - `PROCESS_LOG.md` (appended after the commit)
- **Tests first (red):**
  - `src/data/specialisations.test.ts`:
    1. `SPECIALISATIONS.map(s => s.code)` equals
       `["ARIN-SPEC","HCCC-SPEC","SYAR-SPEC","THCS-SPEC"]`.
    2. `specialisationByCode("ARIN-SPEC")?.groupId === "arin"`, and
       `specialisationByCode("ARIN")` and `("NOPE-SPEC")` are null.
    3. `specialisationByGroup("hccc")?.code === "HCCC-SPEC"`, and
       `specialisationByGroup("cap-team")` is null.
    4. ARIN's `lists` are exactly:
       - `{groupId:"arin-a", label:"Artificial Intelligence — foundations
         (max 12)", shortLabel:"foundations (max 12)", unitsMax:12}`
       - then `{groupId:"arin-b", …, shortLabel:"advanced (min 12)",
         unitsMax:null}`
    5. HCCC's first list has `shortLabel` "HCCC core".
    6. `specialisationsListing("COMP3670")` codes are
       `["ARIN-SPEC","HCCC-SPEC"]`, and `specialisationsListing("COMP1100")`
       is `[]`.
    7. Each entry's `label` equals its group's label (ARIN is "Artificial
       Intelligence", HCCC is "Human-Centred & Creative Computing").
  - `spec/specialisation-data.test.ts`: the four checks of this file's
    §4.4, one `it` per spec. Prove it red by temporarily removing COMP4691
    from `arin-b` in a scratch edit, then revert.
- **Implementation (green).** Per this file's §4.3.
- **Refactor.** None.
- **Acceptance criteria:**
  - `pnpm test:unit` passes, and so does `pnpm build && pnpm exec vitest
    run --project spec spec/specialisation-data.test.ts`.
  - `pnpm check` is green. Commit.
  - After that commit, append a PROCESS_LOG.md entry:
    `## 2026-09-30 — Restoring what the scrape silently dropped, and
    guarding the hand-copied lists`, then `Resolved by <Task 1
    sha>..<Task 2 sha>.`, then 150-300 words covering:
    - the call: fix the data in the repo with a supplement, a merge
      script and a drift test, rather than clean it at display time or
      patch `anu-pandc`
    - why that beat the obvious fix: the scrape had lost whole sections
      (Other Information and Relevant Degrees on every page, SYAR's
      topic list), and cleaning at display time can't restore content
      that was never captured
    - how it was checked: comparing the raw P&C HTML against the JSON; the
      freshness and drift tests going red on a deliberate break
  - Commit the log entry on its own, and check it with
    `pnpm check:evidence`.
- **Depends on:** Task 1.

## 6. Phase Definition of Done

- [ ] Tasks 1 and 2 are complete and their tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] `data/2027/specialisations.json` regenerates identically, and the
  drift test goes red on a deliberate course-list edit (then reverted)
- [ ] The PROCESS_LOG.md entry is committed and cites real commits
- [ ] Tick Phase 01 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| SD1 | Task 1 |
| SD2 | Task 1 |
| SD3 | Task 2 |
| SD4 | Task 2 |
| SD5 | Task 2 |
| N3, N4 | Task 2 |

## 8. Risks / open questions

None.
