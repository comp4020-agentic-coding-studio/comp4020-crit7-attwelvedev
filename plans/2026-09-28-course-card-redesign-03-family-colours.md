# Course card redesign — Phase 03: Requirement family colours

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-28-course-card-redesign-00-overview.md`. Read
  it first: §2.1.C (CR18–CR23), E1, E3, §2.2 colour rules, §4.2 palette
  and §4.3 types.
- **Depends on phases:** 01 (the card footer holding
  `p.course-card-allocation`) and 02 (`.placed-row`, which Task 8's CR22
  test checks has no strip).

## 1. Summary

Each top-level requirement group gets a family. Families carry the
palette in overview §4.2, and a unit test on `styles.css` keeps the
palette legible (contrast, separation, colour-blindness), so a later
colour edit can't quietly break it.

The colour then appears in four places:
- a strip on timeline cards;
- a dot beside "Counts toward" and on top-level group headings;
- the groups' progress bars;
- a per-term bar under each term's unit count.

## 2. Requirements (this phase)

### 2.1 Functional

- **CR18, CR19:** Task 7.
- **CR20–CR23:** Task 8. This includes CR4's dot. CR4's button is Task 11.
- **E3:** Task 9.
- **E1:** Task 10.

### 2.2 Non-functional

- The overview §2.2 colour rules, enforced by Task 7's test.
- Colour is never the only signal.

### 2.3 Out of scope for this phase

- The "Counts toward" jump, and heading hover (Phase 04).
- Help copy (Task 19).

### 2.4 Assumptions

- See overview §2.4 (the hues were pre-checked).
- `color-mix()` is supported by the Chromium the spec runs.

## 3. Existing code context (verified 2026-09-28)

**`src/lib/domain/types.ts`:**

```ts
export type GroupKind = "core" | "major" | "minor" | "specialisation" | "elective";
export interface GroupDef {
  id: string; label: string; kind: GroupKind; ruleType: RuleType;
  unitsRequired: number; unitsMax?: number; selectable?: boolean;
  courses?: string[]; filter?: CourseFilter; children?: GroupDef[];
}
```

**`src/data/aacom-2027.ts`, `AACOM_2027.groups`,** top level in order:
`prog-a`, `prog-b`, `math-disc`, `compulsory`, `spec` (selectable,
`children: specialisations`: arin/hccc/syar/thcs, each with nested
children such as `arin-a`), `comp-upper`, `ict`, `capstone` (selectable,
`children: capstoneOptions`), `electives`. Its tests are in
`src/data/aacom-2027.test.ts` (`describe("AACOM_2027")`).

**`src/lib/domain/view.ts`:**
- `GroupView` has `id, label, kind, ruleType, unitsRequired, unitsMax,
  selectable, chosenId, options, completed, planned, satisfied, courses,
  filterLabel, missing, children: GroupView[]`.
- It's built by the inner `function buildGroupView(group: GroupDef):
  GroupView` inside `buildPlanView`, and called as
  `program.groups.map(buildGroupView)`. Children are built with
  `activeChildren.map(buildGroupView)`.
- No test deep-compares a `GroupView` (verified by grep).

**`src/components/planner-logic.ts`:** `groupLabel(view, groupId)` walks
`view.groups` recursively. That's the pattern to copy for `familyOf`.

**`src/components/CourseCard.tsx`** after Phase 01:
- the root is `<li class="course-card course-card-${state}"
  data-placed=…>`;
- its footer is `div.course-card-foot` holding `<p
  class="course-card-allocation">{placement.countsToward ? \`Counts toward
  ${groupLabel(view, placement.countsToward)}\` : "Not counting toward any
  requirement"}</p>` and the card `MoreOptions`.

**`src/components/SidebarSection.tsx`:**
- props are `{ id; label; compact; onToggle; class?; summary?;
  compactSummary?; children? }`;
- it renders `<li class="requirement-group…">` containing `<h2><button
  class="section-toggle" …><svg class="section-toggle-icon" …/>{label}</button></h2>`,
  then `{summary}`.

**`src/components/Sidebar.tsx`, `Group`:**
- `progress = <ProgressBar label={group.label} completed={group.completed}
  planned={group.planned} required={group.unitsRequired} />`;
- depth 0 renders `<SidebarSection id={\`group-${group.id}\`}
  label={group.label} compact={compact} onToggle=… summary={progress}>`;
- deeper levels render `<li><Heading>{group.label}</Heading>{progress}{body}</li>`;
- the Total section and each check use `ProgressBar` too, and must stay
  gold.

**`src/components/ProgressBar.tsx`:**
- props are `{ label; completed; planned; required; bound?: "min" | "max" }`;
- it renders `<div class="progress-bar"><div role="progressbar" …
  class="progress-bar-track"><span class="progress-bar-completed"
  style={{ width }} /><span class="progress-bar-planned" style={{ width,
  insetInlineStart }} /></div><p class="progress-bar-text">…</p></div>`.

**`src/components/Timeline.tsx`:** each term section renders `<h2>{term.label}</h2><p
class="term-units">{term.units}/{NORMAL_TERM_UNITS} units</p>`, the
overload badge, then `ul.term-cards`. `NORMAL_TERM_UNITS = 24` is exported
from `view.ts`.

**Term units:** `TermView.units` sums `course.units` once per term a
course occupies. A two-semester course counts in both `term` and
`term + 1`. `PlacementView.lastTerm` is the last occupied term, and
`loser` placements have `countsToward === null`.

**CSS:**
- `.progress-bar-completed { background: var(--gold); … }`
- `.progress-bar-planned { background: var(--gold-tint); border-inline-start:
  1px solid var(--surface); }`
- `.term-units { font-size: 0.82rem; color: var(--unigrey); margin: 0 0
  0.5rem; }`
- `.section-toggle` (flex, gap `0.35rem`)
- tokens on `:root` (line 7ff.), with `--rust #ab3a2e`, `--amber #a15d10`,
  `--moss #3f7d5c`, `--gold #be830e`

**Unit test project:** `src/**/*.test.ts` runs in Node, and `node:fs` is
available (`planner-logic.test.ts` already reads `data/2027/courses`).

### Interfaces from earlier phases (exact)

- `p.course-card-allocation` inside `div.course-card-foot` in
  `CourseCard.tsx` (Task 2).
- `.term-cards .course-card` is the timeline card selector (unchanged
  from before this feature).
- `li.placed-row` is the compact row for a placed course in groups and
  search results (Task 5; its markup is `<li class="placed-row"><strong
  class="placed-row-code">…</strong><button
  class="placed-row-title">…</button><p class="placed-row-status">…</p>…</li>`).
- The receding CSS selector list `.course-card-hard` (Task 4, trimmed in
  Task 6). It isn't used here.

## 4. Approach

- **Data, not a UI lookup:** `family` lives on the top-level `GroupDef`,
  and `GroupView.family` is resolved in `view.ts`, so nested groups
  inherit it and another program only has to edit data.
- **CSS:** one custom property per family. Any element with `data-family`
  gets `--family`, and every consumer (strip, dot, bar, segment) reads
  `var(--family)`.
- **The palette test** parses the hexes out of `styles.css`, so the CSS
  file is the single source and the test can't drift from it.

## 5. Task breakdown

### Task 7: Family type, data and palette, with a palette-legibility test

- [ ] **Description:**
  - Add the `Family` type and `GroupDef.family`, and set it on the nine
    top-level groups.
  - Resolve `GroupView.family` with inheritance.
  - Add the `familyOf`, `FAMILY_ORDER` and `FAMILY_LABELS` helpers.
  - Add the tokens and the `data-family` mapping.
  - Add `family-palette.test.ts`.
- **Files touched:**
  - `src/lib/domain/types.ts`
  - `src/data/aacom-2027.ts`
  - `src/data/aacom-2027.test.ts`
  - `src/lib/domain/view.ts`
  - `src/lib/domain/view.test.ts`
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/family-palette.test.ts` (new)
  - `src/styles.css`
- **Tests first (red):**
  - **`aacom-2027.test.ts`,** "top-level groups carry the agreed
    families": the map `id → family` equals `{ "prog-a": "foundations",
    "prog-b": "foundations", "math-disc": "foundations", compulsory:
    "foundations", spec: "specialisation", "comp-upper": "advanced", ict:
    "ict", capstone: "capstone", electives: "neutral" }`, and no nested
    `GroupDef` sets `family`.
  - **`view.test.ts`,** "nested groups inherit their top-level family":
    with `choices: { spec: "arin" }`, the view's `spec` group,
    `spec.children[0]` (arin) and every descendant have `family ===
    "specialisation"`, and `electives.family === "neutral"`.
  - **`planner-logic.test.ts`, `describe("familyOf")`:**
    - with the same view, `familyOf(view, "arin-a")` is "specialisation";
    - `familyOf(view, "compulsory")` is "foundations";
    - `familyOf(view, null)` and `familyOf(view, "nope")` are "neutral";
    - `FAMILY_ORDER` equals `["foundations", "specialisation",
      "advanced", "ict", "capstone", "neutral"]`;
    - `Object.keys(FAMILY_LABELS)` is the same set.
  - **`family-palette.test.ts`** (red: the tokens don't exist yet):
    1. It reads `src/styles.css` and extracts `/--family-([a-z]+):
       (#[0-9a-f]{6})/g`. The six keys must be exactly the `FAMILY_ORDER`
       values.
    2. Each non-neutral hue has WCAG contrast ≥ 3 against `#ffffff`,
       using the relative-luminance formula with sRGB linearisation.
    3. For every pair (a, b) where a is a non-neutral family and b is
       another family (including neutral) or one of rust `#ab3a2e`, amber
       `#a15d10`, moss `#3f7d5c` or gold `#be830e` (read from the same
       file's `--rust:` / `--amber:` / `--moss:` / `--gold:`), CIE76 ΔE
       in CIELAB (D65) is ≥ 20 unsimulated. After applying each Machado
       2009 severity-1.0 matrix to the linear RGB of both colours, it is
       ≥ 10. The matrices, verbatim:
       ```ts
       deut: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]
       prot: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]
       trit: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]]
       ```
       Clamp to [0, 1] after the matrix. Failure messages name the pair,
       the vision type and the ΔE.
    4. **A self-check that the test can fail:** the same helper, run on
       `#1f2f86` vs `#27358f`, reports ΔE < 20. This proves the check
       isn't vacuous.
- **Implementation (green):**
  - `types.ts`:
    - `export type Family = "foundations" | "specialisation" | "advanced"
      | "ict" | "capstone" | "neutral";`
    - add `family?: Family;` to `GroupDef` with a comment saying it's
      top-level only.
  - `aacom-2027.ts`: add `family: "…"` to each of the nine top-level
    group objects, per CR18.
  - `view.ts`:
    - `GroupView` gains `family: Family`;
    - `buildGroupView(group: GroupDef, family: Family)` sets `family` and
      builds children with `activeChildren.map((c) => buildGroupView(c,
      family))`;
    - the top-level call is `program.groups.map((g) => buildGroupView(g,
      g.family ?? "neutral"))`;
    - import `Family`.
  - `planner-logic.ts`:
    ```ts
    export const FAMILY_ORDER: readonly Family[] = ["foundations", "specialisation", "advanced", "ict", "capstone", "neutral"];
    export const FAMILY_LABELS: Record<Family, string> = {
      foundations: "Foundations", specialisation: "Specialisation", advanced: "3000/4000-level COMP",
      ict: "ICT", capstone: "Capstone", neutral: "Electives",
    };
    export function familyOf(view: PlanView, groupId: string | null): Family
    ```
    `familyOf` uses a recursive search like `groupLabel`'s and returns the
    found group's `family`, or "neutral".
  - `styles.css`:
    - in `:root`, after the state tokens, add the six `--family-*` tokens
      from overview §4.2, each with its hue-name comment, and a comment
      pointing at `family-palette.test.ts`;
    - then six rules, one per family:
      `[data-family="foundations"] { --family: var(--family-foundations); }`
      and so on.
- **Refactor:** the colour maths (`luminance`, `contrast`, `toLab`,
  `simulate`, `deltaE`) are local functions in the test file. They're
  test-only and not exported.
- **Acceptance criteria:**
  - All tests pass.
  - Temporarily changing `--family-specialisation` to `#3b4fb0` makes
    the palette test fail with a protanopia message (checked once, then
    reverted).
  - `pnpm check` is green.
- **Depends on:** none within this phase.

### Task 8: Strips on timeline cards, dots on "Counts toward" and headings

- [ ] **Description:** timeline cards get `data-family` and a CSS strip;
  "Counts toward" gets a dot; top-level `SidebarSection` headings get a
  dot. Neutral gets neither.
- **Files touched:**
  - `src/components/CourseCard.tsx`
  - `src/components/SidebarSection.tsx`
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** a new `describe("family colours")` in
  `spec/layout.test.ts`, on `withPlan` at 1920×1080. Use these constants:
  `rgb(31, 47, 134)` = foundations, `rgb(141, 146, 153)` = neutral.
  1. `[data-placed="COMP1130"]` has `data-family="foundations"`, and its
     computed `box-shadow` contains `rgb(31, 47, 134)`.
  2. `[data-placed="INFS1001"]` (counts toward Electives in the example):
     `data-family="neutral"` and `box-shadow` "none".
  3. `[data-placed="COMP1130"] .course-card-allocation .family-dot` has a
     computed background `rgb(31, 47, 134)` and `aria-hidden="true"`. The
     allocation text still contains "Counts toward Programming as Problem
     Solving" (CR23).
  4. Headings:
     - the h2 in `[data-group="prog-a"]` has a `.family-dot`, and so does
       `spec`'s;
     - `electives`' h2 has none;
     - no `.family-dot` exists inside any `h3`–`h6` (CR21);
     - this adds `data-group` to top-level sections, used again in
       Phase 04.
  5. **CR22:** every `.available-courses .course-card` and `.placed-row`
     has computed `box-shadow` "none".
  6. `axeViolations(page)` is `[]`.
- **Implementation (green):**
  - `CourseCard.tsx`:
    - `const family = placement.countsToward ? familyOf(view,
      placement.countsToward) : null;`
    - on the `<li>`, `data-family={family ?? undefined}`;
    - inside `.course-card-allocation`, before the text when `family &&
      family !== "neutral"`: `<span class="family-dot"
      data-family={family} aria-hidden="true" />`.
  - `SidebarSection.tsx`:
    - new optional props `family?: Family` and `groupId?: string`;
    - `data-group={groupId}` on the `<li>`;
    - inside `button.section-toggle`, after the chevron SVG and before
      `{label}`, when `family && family !== "neutral"`: `<span
      class="family-dot" data-family={family} aria-hidden="true" />`.
  - `Sidebar.tsx`: at depth 0, pass `family={group.family}` and
    `groupId={group.id}`. Nested `<li>`s get `data-group={group.id}`, for
    Phase 04. Nothing else changes.
  - `styles.css`:
    - `.term-cards .course-card[data-family]:not([data-family="neutral"])
      { box-shadow: inset 4px 0 0 var(--family); }`
    - `.family-dot { display: inline-block; flex: 0 0 auto; width:
      0.6rem; height: 0.6rem; border-radius: 50%; background:
      var(--family); margin-inline-end: 0.35rem; vertical-align: 0.05em; }`
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass; they fail on the Task 7 build.
  - `pnpm check` is green.
  - A screenshot at both viewports shows strips on timeline cards only.
  - **Human review:** at Task 19.
- **Depends on:** Task 7.

### Task 9: Group progress bars in their family colour

- [ ] **Description:** `ProgressBar` accepts `family`, and requirement
  groups (every depth) pass theirs. The Total bar and the check bars pass
  none and stay gold.
- **Files touched:**
  - `src/components/ProgressBar.tsx`
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** in `describe("family colours")`, on `withPlan`:
  - the `prog-a` section's `.progress-bar-completed` background is
    `rgb(31, 47, 134)`, and its `.progress-bar-planned` background is not
    `rgb(245, 237, 222)` (the gold tint);
  - `electives`' completed segment is `rgb(141, 146, 153)`;
  - the Total section's completed segment (`.requirement-group` whose
    `h2` text is "Total") and the first `.checks-list
    .progress-bar-completed` are still `rgb(190, 131, 14)` (gold);
  - the nested bar `[data-group="arin-a"] .progress-bar-completed` is
    violet, `rgb(140, 95, 201)`. The example plan chooses the AI
    specialisation: its COMP2620 counts toward "Artificial Intelligence —
    foundations (max 12)".
- **Implementation (green):**
  - `ProgressBar.tsx`: new optional prop `family?: Family`, rendered as
    `data-family={family}` on `div.progress-bar`.
  - `Sidebar.tsx`: `progress` passes `family={group.family}`.
  - `styles.css`:
    - `.progress-bar[data-family] .progress-bar-completed { background:
      var(--family); }`
    - `.progress-bar[data-family] .progress-bar-planned { background:
      color-mix(in srgb, var(--family) 25%, #fff); }`
    - Update the comment above `.outstanding-panel` (gold now appears
      only on the Total bar, the checks and actions).
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - `spec/planner.test.ts` "renders a two-segment progress bar per group"
    still passes.
- **Depends on:** Task 7.

### Task 10: Per-term family bar under each term's unit count

- [ ] **Description:**
  - Add `termFamilyUnits`, `termBarWidths` and `termBarLabel`.
  - Render `div.term-bar[role=img]` with one segment per family in each
    term header.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/Timeline.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("termFamilyUnits")`,** with `{ ...emptyPlan(),
    choices: { spec: "arin" }, placements: [...] }` holding:
    - COMP1100 in term 0;
    - COMP1130 in term 0 (incompatible with COMP1100, so a loser counts
      "none");
    - INFS1001 in term 0;
    - COMP4550 in term 5 (two semesters).

    For **every** term t in 0..7, the sum of `termFamilyUnits(view,
    t).map(s => s.units)` equals `view.terms[t].units`. Also:
    - term 0 contains `{ key: "foundations", units: 6 }` and `{ key:
      "none", units: 6 }`;
    - both term 5 and term 6 contain COMP4550's units under
      "capstone" (or whatever `familyOf(view, countsToward)` gives;
      compute it, don't hard-code it);
    - keys appear in `FAMILY_ORDER` order, then "none";
    - zero-unit keys are omitted.
  - **Unit, `describe("termBarWidths")`:**
    - `([{units: 12}, {units: 6}], 18)` → `[50, 25]` (out of 24);
    - `([{units: 18}, {units: 12}], 30)` → `[60, 40]` (an overload scales
      to its total).
  - **Unit, `describe("termBarLabel")`:**
    - `[{key: "foundations", units: 12}, {key: "ict", units: 6}, {key:
      "none", units: 6}]` → "12 units Foundations, 6 units ICT, 6 units
      not counting";
    - `[]` → "No units planned";
    - `{key: "neutral", units: 6}` → "6 units Electives".
  - **Spec, in `describe("family colours")`:**
    - on `withPlan`, each `[data-term] .term-bar` has `role="img"` and an
      `aria-label` equal to the label computed from its segments (assert
      it starts with a digit, or is "No units planned");
    - for `[data-term="0"]` (24 units), the sum of its
      `.term-bar-segment` widths is within 1px of the bar's
      `clientWidth`;
    - the first segment's background is a family colour;
    - `axeViolations` is `[]`.
- **Implementation (green):**
  - `planner-logic.ts`:
    ```ts
    export type TermSegmentKey = Family | "none";
    export interface TermSegment { key: TermSegmentKey; units: number }
    export function termFamilyUnits(view: PlanView, term: number): TermSegment[]
    export function termBarWidths(segments: readonly { units: number }[], termUnits: number): number[]
    export function termBarLabel(segments: readonly TermSegment[]): string
    ```
    - `termFamilyUnits` sums, over placements with `p.term <= term &&
      term <= p.lastTerm`, `view.courses[p.code]?.units ?? 0` under key
      `p.countsToward ? familyOf(view, p.countsToward) : "none"`. It
      orders by `[...FAMILY_ORDER, "none"]` and drops zeros.
    - `termBarWidths` computes `units / Math.max(NORMAL_TERM_UNITS,
      termUnits) * 100` (import `NORMAL_TERM_UNITS` from
      `../lib/domain/view`).
    - `termBarLabel` joins `${units} units ${key === "none" ? "not
      counting" : FAMILY_LABELS[key]}` with ", ".
  - `Timeline.tsx`: after `p.term-units`:
    ```tsx
    const segments = termFamilyUnits(view, term.index);
    const widths = termBarWidths(segments, term.units);
    <div class="term-bar" role="img" aria-label={termBarLabel(segments)}>
      {segments.map((s, i) => (
        <span key={s.key} class="term-bar-segment"
          data-family={s.key === "none" ? "neutral" : s.key}
          style={{ width: `${widths[i]}%` }} />
      ))}
    </div>
    ```
  - `styles.css`:
    - `.term-bar { display: flex; height: 0.375rem; margin: 0 0 0.5rem;
      border-radius: 999px; background: var(--line); overflow: hidden; }`
    - `.term-bar-segment { background: var(--family); }`
    - `.term-bar-segment + .term-bar-segment { border-inline-start: 1px
      solid var(--surface); }`
    - `.term-units` margin becomes `0 0 0.3rem`.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - The timeline top at 390×844 moves down by at most 10px versus Task 9
    (bar plus margin). Record it in the commit message: it counts against
    E10's budget.
- **Depends on:** Task 7.

## 6. Phase Definition of Done

- [ ] Tasks 7–10 complete, their tests passing
- [ ] `pnpm exec vitest run --project unit` passes
- [ ] `pnpm check` passes
- [ ] Screenshots at 1920×1080 and 390×844: strips, dots, family bars, term bars
- [ ] Tick Phase 03 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CR18 | Task 7 (aacom test) |
| CR19 | Task 7 (palette test) |
| CR20 | Task 8 (tests 1–2) |
| CR21 | Task 8 (test 4) |
| CR22 | Task 8 (test 5) |
| CR23 | Task 8 (test 3) |
| CR4 (dot) | Task 8 (test 3) |
| E1 | Task 10 |
| E3 | Task 9 |
| NFR colour | Task 7 |

## 8. Risks / open questions

None.
