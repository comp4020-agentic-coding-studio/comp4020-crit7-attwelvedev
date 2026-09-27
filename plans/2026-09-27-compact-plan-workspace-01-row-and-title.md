# Compact plan workspace — Phase 01: Completed-semesters control and the title row

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27. The amendment after
  Task 1 was confirmed 2026-09-27.
- **Amended:** 2026-09-27, after Task 1 (`ab8195c`). The user moved the
  controls into the title row and put the prerequisite toggle and "Copy plan
  link" behind a ⋯ "More options" panel. Task 2 is new (the panel). The old
  Task 2 (the title and badge) is rewritten as Task 3, which also moves the
  controls up.
- **Part of:** `plans/2026-09-27-compact-plan-workspace-00-overview.md`. Read
  these sections first:
  - §2.1 A, B and E (FR5), including amended CW4/CW6 and new CW23–CW24
  - §2.2 N1–N4 and N6
  - §2.4, from "README reworded" through "Planner renders the title row"
  - §3
  - §4.1 (the DOM after Task 3)
- **Depends on phases:** none.

## 1. Summary

Task 1 (done) merged the cutoff buttons and readout into one
"Completed through … ‹ ›" control, and took "cutoff" out of every
user-facing page. Task 2 moves "Show prerequisite links" and "Copy plan
link" into a ⋯ "More options" disclosure panel beside the chevrons. Task 3
moves the Planner's controls up into the plan page's title row, next to a
1.4rem `h1` and the example badge, so nothing sits above the timeline. The
phase ends with three commits, each human-reviewed.

## 2. Requirements (this phase)

### 2.1 Functional

- CW1–CW3 and CW5 in full (Task 1, done).
- CW6 as amended: the names and the gold line (Task 1, done), "More
  options" (Task 2), and the position beside the title (Task 3).
- CW23 in full (Task 2).
- CW4 as amended, CW7–CW9 and CW24 in full (Task 3).
- FR5 as amended: the 1920/900/390 renders change only as A and B describe
  (the human reviews of all three tasks).

### 2.2 Non-functional

- N1: no overflow either way at 1920×1080 and 390×844, with the ⋯ panel
  open and closed and the nav shown and hidden.
- N2: each chevron and the ⋯ button is at least 44×44px.
- N3: axe is clean at 1920×1080 with the ⋯ panel open (Task 2), and with
  the new title row (Task 3).
- N4: the invariants stay green, including one `h1` per page (Task 3).
- N6: the human reviews below.

### 2.3 Out of scope for this phase

- Anything in the requirements pane or the split: Phases 02 and 03.
- Renaming internal identifiers (overview §2.3).
- Arrow-key navigation in the ⋯ panel, and any change to `PlaceInMenu`.
- "Plan not found" (it keeps its own `h1` in `[id].astro`).

### 2.4 Assumptions

See overview §2.4. Phase-specific assumptions:

- The chevrons use the existing `section-toggle-icon` SVG class, so they
  don't pick up the `nav-toggle-icon` rotation below 1100px (Task 1).
- The short readout carries `aria-hidden="true"`, so screen readers read
  only the hidden full sentence (CW3) and not both (Task 1).
- The ⋯ panel shares Planner's existing `openMenuCode` state under a
  sentinel key, `"more-options"`, which can't collide with a course code.
  Course codes are four capital letters and four digits.
- The existing test "on %s at %i×%i the tab shares the title's row and
  covers nothing" (in `describe("site nav in the top bar")`) already runs
  on `/plan/example` at 390×844 and 900×800 with the nav hidden. It skips
  any element containing the `h1`, so it keeps covering CW9 once the `h1`
  is inside `.plan-title`.

## 3. Existing code context (verified 2026-09-27, at `ab8195c`)

**`src/components/Planner.tsx`** (after Task 1)

- `interface Props { view: PlanView; }`, and
  `export default function Planner({ view: initialView }: Props)`.
- State used here:
  - `const [showPrereqLinks, setShowPrereqLinks] = useState(false);`
  - `const [openMenuCode, setOpenMenuCode] = useState<string | null>(null);`
  - `const [cutoffPending, setCutoffPending] = useState(false);`
  - `const [linkCopied, setLinkCopied] = useState(false);`
  - `const readOnly = view.plan.readOnly;`
- `moveCutoff(delta: 1 | -1)` and `copyPlanLink()` exist and stay
  unchanged. `copyPlanLink` sets `linkCopied` for 2s and announces
  "Plan link copied to clipboard".
- `const readout = completedReadout(view.plan.cutoff, view.terms);`
- `Timeline` and `Sidebar` both get
  `onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}`,
  and each `PlaceInMenu` is `open={openMenuCode === <its code>}`. So one
  shared value already means one open menu at a time.
- The returned tree, abridged:

  ```tsx
  <div class="planner" data-cutoff={view.plan.cutoff} ref={plannerRef}>
    <p aria-live="polite" class="visually-hidden">{announcement}</p>
    {/* Size container for the panes; … */}
    <div class="planner-layout">
      <div class="planner-panes">
        <div class="planner-timeline-area">
          <div class="cutoff-controls">
            <div class="completed-control" aria-busy={cutoffPending}>
              <span class="completed-readout" aria-hidden="true">{readout.short}</span>
              <span class="visually-hidden">{readout.full}</span>
              <button type="button" class="completed-step" aria-label="One fewer semester completed" …>‹ svg</button>
              <button type="button" class="completed-step" aria-label="One more semester completed" …>› svg</button>
            </div>
            <label class="show-links-toggle">
              <input type="checkbox" checked={showPrereqLinks}
                onChange={(event) => setShowPrereqLinks((event.target as HTMLInputElement).checked)} />
              Show prerequisite links
            </label>
            {!readOnly && (
              <button type="button" onClick={copyPlanLink}>
                {linkCopied ? "Copied!" : "Copy plan link"}
              </button>
            )}
          </div>
          <Timeline … />
        </div>
        <Sidebar … />
        <ReqsResizeHandle reqs={reqs} onChange={updateReqs} />
      </div>
    </div>
    {removed && <div class="undo-toast" role="status">…</div>}
  </div>
  ```

**`src/components/PlaceInMenu.tsx`** is the look to match, not the
semantics. It renders `div.place-in-menu` > `button[aria-haspopup="true"]
[aria-expanded]` and `ul[role="menu"][hidden]`. It has no Escape or
outside-click handling. Its CSS (`src/styles.css`, around line 1104):

```css
.place-in-menu { position: relative; display: inline-block; }
.place-in-menu ul {
  list-style: none; margin: 0.3rem 0 0; padding: 0.3rem; position: absolute; z-index: 3;
  background: var(--surface); border: 1px solid var(--line); border-radius: 0.6rem;
  box-shadow: 0 10px 30px -12px rgb(23 24 26 / 0.3); min-width: 9rem;
}
```

**`src/pages/plan/[id].astro`** (unchanged since `12059d6`)

```astro
const title = !view ? "Plan not found" : view.plan.readOnly ? "Example plan" : "Your AACOM 2027 plan";
---

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

**`src/pages/help.astro`** (after Task 1)

- The "Completed semesters" paragraph starts its second sentence with
  `Above the timeline, "Completed through …"`.
- "Keeping your plan" reads: "Starting a plan doesn't need an account — but
  that also means **the plan's own web address is the only way back to
  it**. Bookmark it, or save the link somewhere, before you close the tab."
- Neither "Show prerequisite links" nor "Copy plan link" is mentioned
  anywhere on the page.

**`src/styles.css`**

- `h1 { font-size: clamp(1.6rem, 1.3rem + 1vw, 2.1rem); }` (line 69), and
  `h1, h2, … { margin: 0 0 0.5rem; line-height: 1.2; }`. At 1920, a
  document page's `h1` computes to 33.6px.
- `p { margin: 0 0 0.75rem; max-width: 65ch; }`.
- Below 1100px, with the nav hidden:
  `:root[data-nav="hidden"] h1 { display: flex; align-items: center;
  min-height: 2.75rem; padding-inline-start: 3.5rem; }`. It is more
  specific than `.plan-title h1`, so it wins wherever the two conflict. The
  `.nav-show` tab (2.75rem square, `position: absolute`, no insets) sits at
  main's content corner, which is where the `h1` starts.
- The rules from Task 1, around line 486:
  - `.cutoff-controls { display: flex; align-items: center; gap: 0.5rem
    1rem; margin-block-end: 0.75rem; flex-wrap: wrap; }`
  - `.completed-control { display: inline-flex; align-items: center; gap:
    0.25rem; }`
  - `.completed-readout`, `.completed-step` (2.75rem square)
- `.show-links-toggle { display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.9rem; color: var(--unigrey); }`, plus
  `.show-links-toggle input { flex: 0 0 auto; min-width: 0; }`.
- `.course-card[aria-busy="true"], .completed-control[aria-busy="true"],
  fieldset[aria-busy="true"] { opacity: 0.6; }`.
- The fit group (`@media (min-height: 30rem)`, around line 1255) makes
  `main`, `.planner` and `.planner-layout` flex columns. It gives
  `.planner`, `.planner-layout` and `.planner-panes` `flex: 1 1 auto;
  min-height: 0`. A new `.plan-title` child of `.planner` keeps the default
  `flex: 0 1 auto` and doesn't shrink below its content.
- `.planner-timeline-area` has `padding-block-end: 0.75rem` and no top
  padding. `.term`'s top equals `.timeline`'s top (measured).
- Tokens: `--ink`, `--gold-tint: #f5edde`, `--gold-ink: #4d3505`,
  `--surface`, `--line`, `--paper`, `--unigrey`.

**`spec/layout.test.ts`** (after Task 1)

- Module scope: `baseUrl`, `browser`, `planUrl()`, `withPlan(viewport,
  check)`, and `planWithPlacement(code): Promise<string>` (creates an
  editable plan with `code` in term 0).
- `describe("completed-semesters row")` has these tests:
  1. "shows the short readout, the chevrons and the prerequisite toggle on
     one row". It reads `.show-links-toggle`'s `boundingBox()`, which is
     null once the toggle is inside a closed panel. **Superseded in Task
     2.**
  2. "puts Copy plan link on the same row on an editable plan". **Superseded
     in Task 2.**
  3. "the › chevron completes one more semester and enables ‹". Still
     holds.
  4. "gives the first term more room on a phone" (`.term` at most 100px
     below `.planner-timeline-area`). **Superseded in Task 3.**
  5. "no user-facing text says cutoff". Still holds.
  6. "Help describes the chevrons by name and the gold line". **Extended
     in Task 2.**
- `describe("site nav in the top bar")` defines `const navHidden = {
  storage: { "panel-nav": "hidden" } }` inside it.

**`spec/planner.test.ts:107`** expects `/plan/example`'s HTML to contain
"This is an example". That still holds.

**Measured after Task 1** (`.term` top minus `h1` top, on the fitted page):

| Viewport | Editable plan | `/plan/example` |
| --- | --- | --- |
| 1920×1080 | 104px | 140px |
| 390×844 | 142px | 160px |

At 390, main's content box is 350px wide. The completed control is 293px
wide with "Completed through S2 2027", and 254px with "Nothing completed
yet".

### Interfaces from earlier phases (exact)

None. Task 1 is in this phase: `completedReadout(cutoff: number, terms:
readonly { label: string }[]): CompletedReadout` from
`src/components/planner-logic.ts`, with `CompletedReadout { short: string;
full: string }`.

## 4. Approach

**Task 2: a disclosure, not a menu.** `MoreOptions` is a small component
that owns only the markup and the closing behaviour. Planner owns whether
it's open, through the same `openMenuCode` value the course menus use, so
opening either kind of menu closes the other with no new wiring. The
panel's children are the existing checkbox and copy button, moved as they
are, so their behaviour doesn't change. The panel is anchored to the
button's end edge. It extends toward the row's start, where there's always
room, so it can't push the page sideways.

**Task 3: Planner renders the title row.** The controls need Planner's
state, and a portal can't server-render, so the `h1` moves into Planner.
`[id].astro` passes `title`, and the server HTML still has exactly one
`h1`. The row is two flex groups with `justify-content: space-between` and
`flex-wrap`. When the actions group wraps, it's the only item on its line,
so space-between puts it at the line's start (CW24). The title group wraps
internally, so the badge drops below the `h1` only when it doesn't fit. The
nav-hidden `h1` rule keeps indenting the `h1` beside the tab. Its
`min-height: 2.75rem` keeps a wrapped badge below the tab. With the row
gone from the timeline area, `.cutoff-controls` and its CSS rule are
deleted. The overview ruling that kept the class applied only while the
row existed.

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
- **Amended after completion:** done at `ab8195c`, and the user accepted
  the review. Layout tests 1, 2 and 4 above are superseded by Tasks 2 and
  3, which name each one. Help's "Above the timeline" wording changes in
  Task 3.

### Task 2: Put "Show prerequisite links" and "Copy plan link" behind a ⋯ "More options" panel

- [x] **Description:** add `MoreOptions`, move the checkbox and the copy
  button into it (still inside `.cutoff-controls`, right after
  `.completed-control`), style the panel, and add one Help sentence each
  about where the two actions now live.
- **Files touched:**
  - `src/components/MoreOptions.tsx` (new)
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `src/pages/help.astro`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Superseded** in `describe("completed-semesters row")`. Each one
    changes because CW23 moves the toggle and the copy button into the
    panel. They aren't weakened.
    - Test 1 is renamed "shows the short readout, the chevrons and More
      options on one row". Replace its `.show-links-toggle` check with the
      same check on `page.getByRole("button", { name: "More options" })`:
      its vertical centre is within 4px of the readout's, and its
      `boundingBox()` is at least 44×44. Everything else in the test stays.
    - Test 2 is renamed "puts More options on the readout's row on an
      editable plan". It checks the same thing for ⋯ on a fresh
      `planWithPlacement("COMP1130")` plan, in place of "Copy plan link".
    - Test 6 also expects `/help/`'s `body.innerText` to contain "More
      options".
  - **New `describe("more options")`** in `spec/layout.test.ts`, at
    1920×1080 unless stated. `more` is `page.getByRole("button", { name:
    "More options" })`, and `toggle` is `page.getByLabel("Show
    prerequisite links")`.
    1. **Opens, stays open, and Escape closes it** (fresh plan):
       - `more` has `aria-expanded="false"`, and `aria-controls` names an
         element that exists
       - `toggle` and the "Copy plan link" button aren't visible
       - clicking `more` gives `aria-expanded="true"`, and both become
         visible
       - `toggle.check()` leaves `aria-expanded="true"` and
         `toggle.isChecked()` true
       - `page.keyboard.press("Escape")` gives `aria-expanded="false"`,
         and `document.activeElement` is `more`: check with
         `page.evaluate(() => document.activeElement?.getAttribute("aria-label"))`,
         which equals "More options"
    2. **An outside press closes it** (fresh plan): open, then
       `page.locator("h1").click()`. `aria-expanded` is "false".
    3. **One menu at a time** (fresh plan with COMP1130 placed):
       - open ⋯, then click COMP1130's "Move to…" button
         (`page.getByRole("button", { name: "Move to…" }).first()`)
       - `more` is `aria-expanded="false"`
       - click `more` again. The "Move to…" button is
         `aria-expanded="false"`, and `more` is `"true"`.
    4. **Read-only** (`/plan/example`): after opening, `toggle` is visible
       and `page.getByRole("button", { name: "Copy plan link" })` has
       count 0.
    5. **Fits on a phone** (fresh plan, 390×844, panel open):
       - the panel's `getBoundingClientRect()` has `left >= 0` and
         `right <= 390`
       - `horizontalOverflow` is 0
    6. **Axe** (fresh plan, 1920×1080, panel open): `axeViolations` is
       `[]` (N3).
- **Implementation (green):**
  - **`src/components/MoreOptions.tsx`** (new):

    ```tsx
    import type { ComponentChildren } from "preact";

    interface Props {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: ComponentChildren;
    }

    export default function MoreOptions({ open, onOpenChange, children }: Props);
    ```

    - It renders `div.more-options` (ref `rootRef`) containing:
      - `button.more-options-toggle[type=button]` (ref `toggleRef`), with
        `aria-label="More options"`, `aria-expanded={open}`,
        `aria-controls="more-options-panel"` and `onClick={() =>
        onOpenChange(!open)}`, holding
        `<svg class="more-options-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" /></svg>`
      - `div#more-options-panel.more-options-panel`, with
        `hidden={!open}`, holding `children`
    - `onKeyDown` on the root: on `Escape` while open, call
      `onOpenChange(false)`, then `toggleRef.current?.focus()`.
    - A `useEffect` keyed on `open`: while open, add a document
      `pointerdown` listener that calls `onOpenChange(false)` when
      `!rootRef.current?.contains(event.target as Node)`. Remove it on
      cleanup.
    - Add a comment: it's a disclosure, not an ARIA menu, so the checkbox
      stays a native checkbox and needs no arrow-key handling. Planner owns
      whether it's open, so opening a course's menu closes it.
  - **`Planner.tsx`:**
    - Add `const MORE_OPTIONS = "more-options";` at module scope, with a
      comment: it shares `openMenuCode` with the course menus, and course
      codes never look like this.
    - Replace the `label.show-links-toggle` and the copy button inside
      `div.cutoff-controls` with the following. Keep `label` and `button`
      exactly as they are today.

      ```tsx
      <MoreOptions
        open={openMenuCode === MORE_OPTIONS}
        onOpenChange={(next) => setOpenMenuCode(next ? MORE_OPTIONS : null)}
      >
        <label class="show-links-toggle">…unchanged…</label>
        {!readOnly && <button type="button" onClick={copyPlanLink}>…unchanged…</button>}
      </MoreOptions>
      ```

  - **`styles.css`:**
    - In `.cutoff-controls`, change `gap: 0.5rem 1rem` to `gap: 0.5rem`.
      The row now holds only the completed control and ⋯, and at 390 the
      1rem gap wraps ⋯ onto its own line: 293 + 16 + 44px is more than the
      350px row. That broke Task 1's phone test, and the user approved this
      change during execution. 0.5rem matches Task 3's `.plan-actions`.
    - After the `.show-links-toggle input` rule:
    - `.more-options { position: relative; display: inline-flex; }`
    - `.more-options-toggle { display: inline-flex; align-items: center;
      justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0;
      }`
    - `.more-options-icon { width: 1.25rem; height: 1.25rem; fill:
      currentColor; }`
    - `.more-options-panel { position: absolute; top: 100%;
      inset-inline-end: 0; z-index: 3; display: flex; flex-direction:
      column; align-items: stretch; gap: 0.25rem; margin-block-start:
      0.3rem; padding: 0.5rem; min-width: 14rem; background:
      var(--surface); border: 1px solid var(--line); border-radius:
      0.6rem; box-shadow: 0 10px 30px -12px rgb(23 24 26 / 0.3); }`
    - `.more-options-panel[hidden] { display: none; }`
    - `.more-options-panel > * { min-height: 2.75rem; }`
    - A comment: the panel matches the Place in… menu's look, and it's
      anchored to the button's end edge so it opens toward the row's start
      and never overflows sideways.
  - **`help.astro`:**
    - In "The basics", append a sentence: to see which placed courses lead
      to which, turn on "Show prerequisite links" under "More options"
      (⋯), next to "Completed through …".
    - In "Keeping your plan", append a sentence: "Copy plan link", under
      "More options" (⋯), copies it for you.
- **Refactor:** none.
- **Acceptance criteria:**
  - The superseded tests and new tests 1–6 pass.
  - `completed-semesters row` tests 3 and 5 still pass unchanged.
  - `pnpm check` passes.
  - Render check at 1920×1080, 900×800 and 390×844, with the panel closed
    and open.
  - Commit: "Move the prerequisite-links toggle and Copy plan link behind a
    More options panel".
- **Human review:** a pass means:
  - **Screenshots** of a fresh editable plan and `/plan/example` at
    1920×1080, 900×800 and 390×844, with the panel open: ⋯ reads as "more
    options", the panel looks like the Place in… menu, and nothing is
    clipped.
  - **Copy:** the two new Help sentences.

  The user accepts explicitly.
- **Depends on:** Task 1.

### Task 3: Move the plan's controls into a compact title row with the example badge

- [ ] **Description:** Planner renders the title row: a 1.4rem `h1`, the
  example badge, then `.completed-control` and `MoreOptions`. The row above
  the timeline goes, and Help's position wording follows.
- **Files touched:**
  - `src/pages/plan/[id].astro`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `src/pages/help.astro`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Superseded:** delete test 4 of `describe("completed-semesters row")`,
    "gives the first term more room on a phone". CW4 (amended) replaces it
    with tests 3–4 below, which are stricter.
  - **New `describe("plan title row")`** in `spec/layout.test.ts`:
    1. **At 1920×1080 on `/plan/example`:**
       - `getComputedStyle(h1).fontSize` is `"22.4px"`
       - the `[role="note"]` badge's vertical centre is within 4px of the
         `h1`'s, `h1.getBoundingClientRect().right` <
         `note.getBoundingClientRect().left`, and the badge's text is "This
         is an example — Start your own plan"
       - `.completed-readout`'s and the ⋯ button's vertical centres are
         within 4px of the `h1`'s (CW4)
       - the ⋯ button's `right` is within 1px of `.plan-title`'s `right`
         (the row's end)
    2. **Document pages unchanged:** at 1920×1080, `/help/`, `/readme/` and
       `/` each have an `h1` font-size of `"33.6px"`.
    3. **Nothing above the timeline:** at 1920×1080 and 390×844, on
       `/plan/example` and a fresh `planWithPlacement("COMP1130")` plan,
       `.term`'s top minus `.planner-timeline-area`'s top is at most 4px.
       There's also no `.cutoff-controls` element (count 0).
    4. **Height given back** (nav shown), `.term` top minus `h1` top (today's
       values in this file's §3):
       - 1920×1080: at most 64px on both plans
       - 390×844: at most 100px on the fresh plan, and at most 125px on
         `/plan/example`
       - `horizontalOverflow` and `verticalOverflow` are 0 in each case
    5. **Phone wrap (CW24)** at 390×844:
       - fresh plan: `.plan-actions`' top ≥ the `h1`'s bottom. Its `left` is
         within 1px of `.plan-title`'s `left`. The ⋯ button's vertical
         centre is within 4px of `.completed-readout`'s.
       - `/plan/example`: the badge's top ≥ the `h1`'s bottom, and
         `.plan-actions`' top ≥ the badge's bottom
    6. **Nav hidden** at 390×844 on `/plan/example`, with `{ storage: {
       "panel-nav": "hidden" } }`:
       - the `.nav-show` rect doesn't intersect the badge's rect
       - it doesn't intersect the `h1`'s text rect (`document.createRange()`,
         `selectNodeContents(h1)`, `getBoundingClientRect()`)
       - `horizontalOverflow` and `verticalOverflow` are 0
    7. **Axe:** at 1920×1080, `/plan/example` and a fresh editable plan
       have `axeViolations` equal to `[]` (N3).
    8. **Help:** `/help/`'s `body.innerText` contains "beside the plan's
       title" and doesn't contain "Above the timeline".
- **Implementation (green):**
  - **`[id].astro`:** the `view` branch becomes `<Planner client:load
    view={view} title={title} />` alone. The `h1` and the note move into
    Planner. "Plan not found" is unchanged.
  - **`Planner.tsx`:**
    - `interface Props { view: PlanView; title: string; }`, and
      `export default function Planner({ view: initialView, title }: Props)`.
    - Directly after the `aria-live` paragraph, and before
      `div.planner-layout`, render the following. `.completed-control` and
      `MoreOptions` move here unchanged, with their children.

      ```tsx
      {/* The plan page is a workspace, so its title row also carries the plan's own controls, leaving the timeline nothing above it. */}
      <div class="plan-title">
        <div class="plan-title-main">
          <h1>{title}</h1>
          {readOnly && (
            <p role="note" class="plan-badge">
              This is an example — Start your own plan
            </p>
          )}
        </div>
        <div class="plan-actions">
          <div class="completed-control" aria-busy={cutoffPending}>…unchanged…</div>
          <MoreOptions …unchanged…>…unchanged…</MoreOptions>
        </div>
      </div>
      ```

    - Delete the now-empty `div.cutoff-controls` from
      `.planner-timeline-area`, which then holds only `<Timeline>`.
  - **`styles.css`:**
    - Delete the `.cutoff-controls` rule.
    - Next to the `h1` rules, before the nav-hidden rules:
      - `.plan-title { display: flex; flex-wrap: wrap; align-items: center;
        justify-content: space-between; gap: 0.5rem 1rem;
        margin-block-end: 0.75rem; }`
      - `.plan-title-main { display: flex; flex-wrap: wrap; align-items:
        center; gap: 0.25rem 0.75rem; min-width: 0; }`
      - `.plan-title h1 { font-size: 1.4rem; margin: 0; }`
      - `.plan-badge { margin: 0; padding: 0.15rem 0.6rem; font-size:
        0.8rem; font-weight: 500; color: var(--gold-ink); background:
        var(--gold-tint); border-radius: 999px; }`
      - `.plan-actions { display: flex; align-items: center; gap: 0.5rem; }`
      - A comment: the plan page is a workspace, so its title row gives
        height back to the planner. When the row doesn't fit, the actions
        group wraps as a whole and space-between starts it at the line's
        start. The badge wraps below the title only when it has to, and
        the nav-hidden `h1`'s `min-height` keeps a wrapped badge clear of
        the tab.
  - **`help.astro`:** in "Completed semesters", change `Above the timeline,
    "Completed through …"` to `Beside the plan's title, "Completed through
    …"`. Task 2's two sentences stay as they are, because ⋯ still sits
    next to "Completed through …".
- **Refactor:** grep `src/` for `cutoff-controls`. None should remain.
- **Acceptance criteria:**
  - The superseded deletion and new tests 1–8 pass.
  - `spec/planner.test.ts:107` ("This is an example") still passes.
  - `spec/invariants.test.ts` still passes (one `h1`).
  - "on %s at %i×%i the tab shares the title's row and covers nothing"
    still passes (CW9).
  - `pnpm check` passes.
  - Render check at 1920×1080, 900×800 and 390×844, with the nav shown and
    hidden.
  - Commit: "Move the plan's controls into a compact title row with the
    example badge".
- **Human review:** screenshots of `/plan/example` and a fresh editable plan
  at 1920×1080, 900×800 and 390×844, with the nav shown and hidden. A pass
  means:
  - the title still reads as the page's heading, and the badge is legible
    without shouting
  - the completed control and ⋯ read as the plan's controls, not as part
    of the heading
  - on the phone, the tab, title, badge and controls sit together without
    crowding
  - the Help sentence reads naturally

  The user accepts explicitly.
- **Depends on:** Task 2.

## 6. Phase Definition of Done

- [ ] Tasks 1–3 complete, with their tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Three commits, one per task
- [ ] All three human reviews accepted by the user
- [ ] Tick Phase 01 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CW1 | Task 1: unit tests, layout test 1 |
| CW2 | Task 1: planner.test, layout tests 1 and 3 |
| CW3 | Task 1: unit tests (`full`), markup |
| CW4 (amended) | Task 3: tests 1, 3 and 4 |
| CW5 | Task 1: layout test 5 |
| CW6 (amended) | Task 1: layout test 6; Task 2: "More options" in test 6; Task 3: test 8; all three human reviews |
| CW7 | Task 3: tests 1–2 |
| CW8 | Task 3: tests 1 and 5 |
| CW9 | Task 3: test 6, and the existing "covers nothing" test |
| CW23 | Task 2: tests 1–5 and the superseded tests 1–2 |
| CW24 | Task 3: test 5 |
| FR5 (amended) | Tasks 1–3: human reviews |
| N1 | Task 1: test 1; Task 2: test 5; Task 3: tests 4 and 6 |
| N2 | Task 1: test 1; Task 2: superseded test 1 |
| N3 | Task 2: test 6; Task 3: test 7 |
| N4 | Task 3: `pnpm check` (invariants) |
| N6 | Human reviews on Tasks 1–3 |

## 8. Risks / open questions

None.
