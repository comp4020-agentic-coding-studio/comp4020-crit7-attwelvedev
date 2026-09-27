# Compact plan workspace — Phase 01: Completed-semesters row and compact title

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-compact-plan-workspace-00-overview.md`. Read
  these sections first:
  - §2.1 A, B and E (FR5)
  - §2.2 N1–N4 and N6
  - §2.4, the CW5 README ruling and the kept `.cutoff-controls` class
  - §3
- **Depends on phases:** none.

## 1. Summary

The timeline's three control lines become one row, whose label is the short
"Completed through …" readout. The word "cutoff" leaves every user-facing
page. The plan page's title shrinks, and the example note becomes a badge
beside it. The phase ends with two commits, each human-reviewed.

## 2. Requirements (this phase)

### 2.1 Functional

- CW1–CW6 in full (Task 1).
- CW7–CW9 in full (Task 2).
- FR5 as amended: the 1920/900/390 renders change only as A and B describe
  (both tasks' human reviews).

### 2.2 Non-functional

- N1: no overflow either way at 1920×1080 and 390×844 with the new row.
- N2: each chevron is at least 44×44px.
- N3: axe is clean at 1920×1080 with the new row and title.
- N4: the invariants stay green.
- N6: the human reviews below.

### 2.3 Out of scope for this phase

- Anything in the requirements pane or the split: Phases 02 and 03.
- Renaming internal identifiers (overview §2.3).

### 2.4 Assumptions

See overview §2.4. Phase-specific assumptions:

- The chevrons use the existing `section-toggle-icon` SVG class, so they
  don't pick up the `nav-toggle-icon` rotation below 1100px.
- The short readout carries `aria-hidden="true"`, so screen readers read only
  the hidden full sentence (CW3), not both.

## 3. Existing code context (verified 2026-09-27, at `12059d6`)

**`src/components/Planner.tsx`, the readout (lines 145–150)**

```tsx
  const cutoff = view.plan.cutoff;
  const cutoffReadout =
    cutoff <= 0
      ? "Nothing on the timeline counts as completed yet."
      : cutoff >= view.terms.length
        ? "Every semester on the timeline counts as completed."
        : `Completed through ${view.terms[cutoff - 1].label} — planned from ${view.terms[cutoff].label} onward.`;
```

**The controls, inside `div.planner-timeline-area` before `<Timeline>`**

`moveCutoff(delta: 1 | -1)` and `copyPlanLink()` exist and are unchanged.

```tsx
            <div class="cutoff-controls" aria-busy={cutoffPending}>
              <button
                type="button"
                disabled={readOnly || cutoffPending || view.plan.cutoff <= 0}
                onClick={() => moveCutoff(-1)}
              >
                Move cutoff earlier
              </button>
              <button
                type="button"
                disabled={readOnly || cutoffPending || view.plan.cutoff >= 8}
                onClick={() => moveCutoff(1)}
              >
                Move cutoff later
              </button>
              <label class="show-links-toggle">
                <input
                  type="checkbox"
                  checked={showPrereqLinks}
                  onChange={(event) => setShowPrereqLinks((event.target as HTMLInputElement).checked)}
                />
                Show prerequisite links
              </label>
              {!readOnly && (
                <button type="button" onClick={copyPlanLink}>
                  {linkCopied ? "Copied!" : "Copy plan link"}
                </button>
              )}
            </div>
            <p class="cutoff-readout">{cutoffReadout} The gold line on the timeline marks that boundary.</p>
```

**`src/components/planner-logic.ts`** is pure: no DOM, and unit-tested in
`planner-logic.test.ts`. Its imports are `import type { ReqExpr } from
"../lib/domain/types"` and `import type { GroupView, PlanView } from
"../lib/domain/view"`. `PlanView.terms` is `TermView[]`, where each term
has `label: string` (e.g. "S1 2027").

**`src/pages/plan/[id].astro`, the body**

```astro
<Base title={title}>
  {
    view ? (
      <>
        <h1>{title}</h1>
        {view.plan.readOnly && <p role="note">This is an example — Start your own plan</p>}
        <Planner client:load view={view} />
      </>
    ) : (
      <h1>Plan not found</h1>
    )
  }
</Base>
```

**`src/pages/help.astro:35–41`**

```astro
  <h2>The completion cutoff</h2>
  <p>
    The planner needs to know which of your placed courses are already done versus still planned, but it doesn't
    track individual grades or results — instead, you set one boundary with "Move cutoff earlier/later". Everything
    before it counts as completed; everything from there on is still planned. It's a simplification: it doesn't
    handle a failed or repeated course, part-time study, or leave of absence.
  </p>
```

**`README.md:16`** (served in full at `/readme/`, where `spec/readme.test.ts`
asserts the page carries every word, so it follows the edit automatically):
`a guess); every mutation (a placement, a moved cutoff, a pin) is enforced`.

**`spec/planner.test.ts:211–217`**, superseded by CW2 (its labels change
because the requirement changes them):

```ts
  it("the cutoff has keyboard buttons", async () => {
    const id = await createPlan();
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toContain("Move cutoff earlier");
    expect(html).toContain("Move cutoff later");
  });
```

`spec/planner.test.ts:107` expects `/plan/example` to contain "This is an
example". That still holds.

**`src/styles.css`**

- `h1 { font-size: clamp(1.6rem, 1.3rem + 1vw, 2.1rem); }` (line 69), and
  `h1, h2, … { margin: 0 0 0.5rem; line-height: 1.2; }`. At 1920 a
  document page's `h1` computes to 33.6px.
- `p { margin: 0 0 0.75rem; max-width: 65ch; }`.
- Below 1100px, with the nav hidden (lines 341–346):

  ```css
  :root[data-nav="hidden"] h1 {
    display: flex;
    align-items: center;
    min-height: 2.75rem;
    padding-inline-start: 3.5rem;
  }
  ```

  The `.nav-show` tab (2.75rem square, `position: absolute`, no insets)
  sits at main's content corner.
- `.cutoff-controls { display: flex; align-items: center; gap: 0.5rem;
  margin-block-end: 0.5rem; flex-wrap: wrap; }` and `.cutoff-readout {
  font-size: 0.85rem; color: var(--unigrey); margin: 0 0 0.75rem; }`
  (lines 486–498).
- `.course-card[aria-busy="true"], .cutoff-controls[aria-busy="true"],
  fieldset[aria-busy="true"] { opacity: 0.6; }` (around line 886).
- `.section-toggle-icon { flex: 0 0 auto; width: 1rem; height: 1rem;
  fill: none; stroke: currentColor; stroke-width: 2.5; … }`.
- `.visually-hidden` exists.

**Measured at 390×844 on `/plan/example`** (before this phase):

- the first `.term` sits 150px below the top of `.planner-timeline-area`
- the `h1` is 25.6px

### Interfaces from earlier phases (exact)

None.

## 4. Approach

`completedReadout` is pure, so the three branches are unit-tested without a
DOM. The row keeps the `.cutoff-controls` class and flex-wrap. The visible
short readout is `aria-hidden`, and the full sentence sits beside it as
`.visually-hidden`, so assistive technology hears it exactly once. The
chevrons carry the accessible names.

The title wraps `h1` and the badge in `div.plan-title`, a wrapping flex row.
The nav-hidden `h1` rule keeps indenting the `h1` beside the tab, and its
`min-height: 2.75rem` keeps a wrapped badge below the tab.

## 5. Task breakdown

### Task 1: Merge the cutoff controls into one completed-semesters row, and drop "cutoff" from user-facing text

- [x] **Description:** add `completedReadout`, rebuild the row in Planner,
  restyle it, and rewrite the Help section and the README phrase.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `src/pages/help.astro`
  - `README.md`
  - `spec/planner.test.ts`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit** (`planner-logic.test.ts`), `describe("completedReadout")`, with
    `terms = [{label:"S1 2027"},{label:"S2 2027"},{label:"S1 2028"}]`:
    - `(0, terms)` → `{ short: "Nothing completed yet", full: "Nothing on
      the timeline counts as completed yet. The gold line on the timeline
      marks that boundary." }`
    - `(-1, terms)` gives the same result as 0
    - `(3, terms)` and `(9, terms)` → `{ short: "All semesters completed",
      full: "Every semester on the timeline counts as completed. The gold
      line on the timeline marks that boundary." }`
    - `(2, terms)` → `{ short: "Completed through S2 2027", full: "Completed
      through S2 2027 — planned from S1 2028 onward. The gold line on the
      timeline marks that boundary." }`
  - **`spec/planner.test.ts`:** replace "the cutoff has keyboard buttons"
    with "the completed semesters have keyboard buttons". It expects the
    created plan's HTML to contain `aria-label="One fewer semester
    completed"` and `aria-label="One more semester completed"`. This is
    superseded by CW2, not weakened.
  - **`spec/layout.test.ts`**, new `describe("completed-semesters row")`:
    1. At 1920×1080 on `/plan/example`:
       - `.completed-readout` has text "Completed through S2 2027"
       - both chevrons are `disabled` (read-only plan) and `boundingBox()`
         ≥ 44×44
       - the chevrons' and `.show-links-toggle`'s vertical centres are
         within 4px of the readout's (one row)
       - `horizontalOverflow` and `verticalOverflow` are 0
    2. At 1920×1080 on a fresh editable plan: the "Copy plan link" button's
       vertical centre is within 4px of the readout's.
       - Create the plan with `POST /api/plans`, as `planWithPlacement`
         does.
       - Move `planWithPlacement` from inside `describe("requirements rail
         as a drop target")` up to module scope, so both blocks can use it.
    3. On that plan:
       - Clicking the › button (`getByRole("button", { name: "One more
         semester completed" })`) increments `.planner`'s `data-cutoff` by
         1 (use `expect.poll`) and changes `.completed-readout`'s text.
       - The ‹ button is then enabled.
    4. At 390×844 on `/plan/example`:
       - the first `.term`'s top is at most 100px below
         `.planner-timeline-area`'s top (it's 150 today)
       - `horizontalOverflow` is 0
    5. **No "cutoff" in user-facing text,** for each of `/plan/example`,
       the fresh plan, `/help/` and `/readme/`, at 1920×1080:

       ```ts
       page.evaluate(() => [
         document.body.innerText,
         ...[...document.querySelectorAll("[aria-label],[aria-valuetext],[title]")].flatMap((el) => [
           el.getAttribute("aria-label"),
           el.getAttribute("aria-valuetext"),
           el.getAttribute("title"),
         ]),
       ].join(" "))
       ```

       The result must not match `/cutoff/i`.
    6. `/help/` `body.innerText` contains "One more semester completed",
       "One fewer semester completed" and "gold line".
- **Implementation (green):**
  - **`planner-logic.ts`:**

    ```ts
    export interface CompletedReadout {
      short: string;
      full: string;
    }
    export function completedReadout(cutoff: number, terms: readonly { label: string }[]): CompletedReadout;
    ```

    The branches are as in the tests. `full` is today's sentence plus
    `" The gold line on the timeline marks that boundary."`. Add a comment:
    the short form is the control's visible label, and the full sentence is
    what assistive technology hears.
  - **`Planner.tsx`:**
    - Replace `cutoffReadout` with `const readout =
      completedReadout(view.plan.cutoff, view.terms);`.
    - Replace the two text buttons and `p.cutoff-readout` with the markup
      below. The show-links label and the copy button follow it, unchanged,
      inside the same `div.cutoff-controls`, which loses its `aria-busy`.

      ```tsx
      <div class="completed-control" aria-busy={cutoffPending}>
        <span class="completed-readout" aria-hidden="true">{readout.short}</span>
        <span class="visually-hidden">{readout.full}</span>
        <button type="button" class="completed-step" aria-label="One fewer semester completed"
          disabled={readOnly || cutoffPending || view.plan.cutoff <= 0} onClick={() => moveCutoff(-1)}>
          <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <button type="button" class="completed-step" aria-label="One more semester completed"
          disabled={readOnly || cutoffPending || view.plan.cutoff >= 8} onClick={() => moveCutoff(1)}>
          <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      ```

  - **`styles.css`:**
    - `.cutoff-controls`: change `gap` to `0.5rem 1rem` and
      `margin-block-end` to `0.75rem`.
    - Delete the `.cutoff-readout` rule.
    - Add:
      - `.completed-control { display: inline-flex; align-items: center;
        gap: 0.25rem; }`
      - `.completed-readout { font-size: 0.9rem; font-weight: 600; color:
        var(--ink); margin-inline-end: 0.25rem; }`
      - `.completed-step { display: inline-flex; align-items: center;
        justify-content: center; width: 2.75rem; height: 2.75rem; padding:
        0; }`
    - In the aria-busy rule, replace `.cutoff-controls[aria-busy="true"]`
      with `.completed-control[aria-busy="true"]`.
  - **`help.astro`:**
    - Retitle the section `<h2>Completed semesters</h2>`.
    - Rewrite the paragraph to keep its meaning (one boundary; before it is
      completed, from it on is planned; the simplification caveat).
    - Say it's set with the ‹ and › buttons beside "Completed through …"
      above the timeline, named "One fewer semester completed" and "One
      more semester completed".
    - Say the gold line on the timeline marks the boundary.
  - **`README.md:16`:** change "a moved cutoff" to "a change to the
    completed semesters".
- **Refactor:** grep `src/` for user-facing "cutoff" strings, and
  `src/styles.css` for `.cutoff-readout`; none should remain. Internal
  identifiers, CSS comments and the API stay (overview §2.3).
- **Acceptance criteria:**
  - All the tests above pass.
  - `pnpm check` passes.
  - Render check at 1920×1080, 900×800 and 390×844.
  - Commit: "Merge the cutoff controls into one completed-semesters row and
    drop 'cutoff' from the UI".
- **Human review:** a pass means:
  - **Screenshots** of `/plan/example` and a fresh editable plan at
    1920×1080, 900×800 and 390×844: the row reads naturally, the chevrons
    are clearly the way to change it, and the row wraps sensibly on the
    phone.
  - **Copy:** the rewritten Help section and the README phrase read clearly
    and on-voice.

  The user accepts explicitly.
- **Depends on:** none.

### Task 2: Shrink the plan page title and turn the example note into a badge beside it

- [ ] **Description:** wrap the title and the note in `div.plan-title`,
  size the plan `h1` at 1.4rem, and style the note as a badge.
- **Files touched:**
  - `src/pages/plan/[id].astro`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** a new `describe("plan title")` in
  `spec/layout.test.ts`:
  1. **At 1920×1080 on `/plan/example`:**
     - `getComputedStyle(h1).fontSize` is `"22.4px"`
     - the `[role="note"]` badge's vertical centre is within 4px of the
       `h1`'s
     - `h1.getBoundingClientRect().right` < `note.getBoundingClientRect().left`
       (same row)
     - the note's text is "This is an example — Start your own plan"
  2. **Document pages unchanged:** at 1920×1080, `/help/`, `/readme/` and
     `/` each have an `h1` font-size of `"33.6px"`.
  3. **Nav hidden, at 390×844 on `/plan/example`** with `{ storage: {
     "panel-nav": "hidden" } }`:
     - the `.nav-show` rect doesn't intersect the note's rect
     - it doesn't intersect the rect of the `h1`'s text: take
       `document.createRange()`, `selectNodeContents(h1)`, then
       `getBoundingClientRect()`
     - `horizontalOverflow` and `verticalOverflow` are 0
  4. **Axe:** at 1920×1080, `/plan/example` and a fresh editable plan have
     `axeViolations` equal to `[]` (N3).
- **Implementation (green):**
  - **`[id].astro`:** replace the `h1` and the note with:

    ```astro
    <div class="plan-title">
      <h1>{title}</h1>
      {view.plan.readOnly && <p role="note" class="plan-badge">This is an example — Start your own plan</p>}
    </div>
    ```

    "Plan not found" is unchanged.
  - **`styles.css`,** next to the `h1` rules and before the nav-hidden
    rules:
    - `.plan-title { display: flex; flex-wrap: wrap; align-items: center;
      gap: 0.25rem 0.75rem; margin-block-end: 0.75rem; }`
    - `.plan-title h1 { font-size: 1.4rem; margin: 0; }`
    - `.plan-badge { margin: 0; padding: 0.15rem 0.6rem; font-size:
      0.8rem; font-weight: 500; color: var(--gold-ink); background:
      var(--gold-tint); border-radius: 999px; }`
    - A comment: the plan page is a workspace, so its title gives height
      back to the planner. The badge wraps below only when the row doesn't
      fit, and the nav-hidden `h1`'s `min-height` keeps a wrapped badge
      clear of the tab.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests 1–4 pass.
  - `spec/planner.test.ts:107` ("This is an example") still passes.
  - `spec/invariants.test.ts` still passes (one `h1`).
  - `pnpm check` passes.
  - Render check at 1920×1080, 900×800 and 390×844, with the nav shown and
    hidden.
  - Commit: "Shrink the plan page title and show the example note as a
    badge beside it".
- **Human review:** screenshots of `/plan/example` at 1920×1080, 900×800
  and 390×844, with the nav shown and hidden. A pass means:
  - the title still reads as the page's heading
  - the badge is legible without shouting
  - on the phone with the nav hidden, the tab, title and badge sit
    together without crowding

  The user accepts explicitly.
- **Depends on:** none. It's independent of Task 1, but done after it.

## 6. Phase Definition of Done

- [ ] Tasks 1–2 complete, with their tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Two commits, one per task
- [ ] Both human reviews accepted by the user
- [ ] Tick Phase 01 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CW1 | Task 1: unit tests, layout test 1 |
| CW2 | Task 1: planner.test, layout tests 1 and 3 |
| CW3 | Task 1: unit tests (`full`), markup |
| CW4 | Task 1: layout tests 1–2 |
| CW5 | Task 1: layout test 5 |
| CW6 | Task 1: layout test 6, human review |
| CW7 | Task 2: tests 1–2 |
| CW8 | Task 2: test 1 |
| CW9 | Task 2: test 3 |
| FR5 (amended) | Tasks 1–2: human reviews |
| N1 | Task 1: tests 1 and 4; Task 2: test 3 |
| N2 | Task 1: test 1 |
| N3 | Task 2: test 4 |
| N4 | Task 2: `pnpm check` |

## 8. Risks / open questions

None.
