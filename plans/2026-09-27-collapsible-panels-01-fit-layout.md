# Collapsible panels — Phase 01: Fit the planner in the viewport

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-collapsible-panels-00-overview.md`. Read
  these sections first:
  - §2 (FR1–5, NFR verification/CI)
  - §3 (commands, render check)
  - §4.1 (DOM shape)
  - §4.4 (tokens and tiers)
  - §4.5 (`spec/browser.ts` API)
- **Depends on phases:** none.
- **Revised 2026-09-27 (during execution, user-approved):** `--reqs-w-2`/`-3`
  were 31/44.5rem, which dropped the formula's `(n − 1) × 0.6rem` gap term;
  depth-2 three-card groups overflowed by 0.2px at 1920. Now 31.1/44.7rem,
  thresholds 63.1/76.7rem, expected asides 498/715px, across all phase files.

## 1. Summary

This phase adds a real-browser test harness, then fixes the 208px sideways
overflow on desktop. The fix makes the planner lay itself out from its own
width, in tiers (3, 2 or 1 sidebar columns, then stacked). When the phase
ends, `/plan/*` never scrolls sideways at any width, 1920×1080 looks as it
does today, and 390×844 is unchanged.

## 2. Requirements (this phase)

### 2.1 Functional

- FR1 (panels expanded; later phases re-assert it for their states)
- FR2, FR3, FR5 in full
- FR4: the "columns that fit" part only. The preference cap is Task 8.

### 2.2 Non-functional

- The Playwright harness and CI Chromium step (NFR verification/CI).
- `spec/invariants.test.ts` stays green.

### 2.3 Out of scope for this phase

- Every control: nav toggle (Phase 02), rail (Phase 03), handle (Phase 04).
- No `data-nav`, `data-reqs` or `data-reqs-cols` rules yet.

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-27)

**Measured root cause.** Headless Chrome on `/plan/example`:

| Viewport | `scrollWidth` | Overflow |
| --- | --- | --- |
| 1920 | 2128 | +208 |
| 1440 | 1648 | +208 |
| 1280 | 1488 | +208 |
| 1100 | 1308 | +208 |
| 390 | 390 | none |

`main` is `width: 100%` and a flex item in the row `.app-shell`. Flex's
`min-width: auto` pins it at the viewport width beside the 208px nav.
Setting `min-width: 0` fixes it; `width: auto` doesn't, because the rule
below wins on specificity.

`src/styles.css:240-252`

```css
main {
  flex: 1;
  width: 100%;
  max-width: 40rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
}

body:has(.planner) main {
  max-width: none;
  width: 100%;
  padding: 1.25rem;
}
```

`src/styles.css:254-257`: `@media (min-width: 1100px) { .app-shell {
flex-direction: row; } … }`. The nav is 13rem there, and
`body:has(.planner) main { padding: 1.25rem 1.5rem; }` is at `:281-283`.

`src/styles.css:289-308`

```css
.planner {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.planner-timeline-area {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--paper);
  padding-block-end: 0.75rem;
  border-block-end: 1px solid var(--line);
  max-height: 50vh;
  overflow-y: auto;
}

.planner > aside {
  min-width: 0;
}
```

`src/styles.css:737-744`

```css
.available-courses {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: 13rem;
  gap: 0.6rem;
}
```

**`src/styles.css:972-1018`** is the block this phase replaces:
`@media (min-width: 1100px)`. It sets:

- `.planner`: `flex-direction: row; align-items: flex-start`
- `.planner > aside`: `order: -1; flex: 0 0 44rem; width: 44rem;
  position: sticky; top: 1rem; max-height: calc(100vh - 2rem);
  overflow-y: auto; scrollbar-gutter: stable`, with a long comment on why
  the gutter is reserved. **Keep that comment.**
- `.planner-timeline-area`: `flex: 1 1 auto; min-width: 0; top: 1rem;
  max-height: calc(100vh - 2rem); overflow-y: auto`
- `.requirements-scroll`: `flex-direction: column; overflow-x: visible`
- `.requirement-group`: `flex: 0 0 auto; width: 100%; min-width: 0`
- `.available-courses`: `grid-template-columns: repeat(var(--group-columns,
  1), 13rem)`

Other CSS facts:

- `.undo-toast` is `position: fixed` (`:546-560`). It must stay outside any
  container; see overview §4.1.
- `.place-in-menu ul` is `position: absolute; z-index: 3` (`:917-927`).
  This is why there are **no per-group containers**: each would become a
  stacking context and trap the menu under the next group.
- `.term` is `flex: 0 0 15rem` (`:600`), and `.timeline-scroll` has
  `gap: 0.75rem; overflow-x: auto` (`:494-500`).
- `.requirement-group` has `padding: 0.9rem 0.75rem` and a 1px border
  (`:350-362`). `.group-children > li` has `border-inline-start: 2px;
  padding-inline-start: 0.75rem` (`:458-461`).

**Measured on `/plan/example` at 1920:** groups with courses exist at depths
0, 1 and 2. The depth-2 groups hold 4 and 6 cards and render 3 columns.

**`src/components/Planner.tsx:148-218`** (the return; the structure matters):

```tsx
<div class="planner" data-cutoff={view.plan.cutoff} ref={plannerRef}>
  <p aria-live="polite" class="visually-hidden">{announcement}</p>
  <div class="planner-timeline-area"> …cutoff controls, readout, <Timeline …/> </div>
  {removed && (<div class="undo-toast" role="status"> … </div>)}
  <Sidebar view={view} planId={view.plan.id} onChanged={setView} onAnnounce={setAnnouncement}
    onDragStart={setDraggingCode} onDragEnd={() => setDraggingCode(null)}
    openMenuCode={openMenuCode} onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
    onLocateCourse={(code) => setLocateRequest({ code, token: Date.now() })} />
</div>
```

**Column-count inputs today:**

- `src/components/Sidebar.tsx:106`: `const columns =
  Math.min(courses.length, MAX_COLUMNS) || 1;` (`MAX_COLUMNS = 3` at `:46`)
- `src/components/Sidebar.tsx:137`: `<ul class="available-courses"
  style={{ "--group-columns": columns }}>`
- `src/components/CourseSearch.tsx:234`: `<ul class="available-courses
  course-search-results" style={{ "--group-columns":
  Math.min(results.length, 3) || 1 }}>`

**Test harness facts**

- `spec/global-setup.ts` boots `dist/server/entry.mjs` and provides
  `baseUrl` via `project.provide`.
- Tests read it with `inject("baseUrl")` from `vitest`.
- Built client assets are `/_astro/*.js` and `/_astro/*.css`.
- `vitest.config.ts` runs `spec/**/*.test.ts` in the `spec` project.
- `package.json` has no browser dependency.
- Chromium revision 1243 is cached locally under
  `~/Library/Caches/ms-playwright`.
- **CI** is `.github/workflows/checks.yml`, job `check`:
  `pnpm install --frozen-lockfile`, then a step named "Build and run the
  spec" running `pnpm check`.

### Interfaces from earlier phases (exact)

None.

## 4. Approach

**Harness first, then the fix.** Task 1 lands the harness green, with a
check that already holds (390×844 doesn't overflow). Task 2 then adds the
failing desktop assertions and makes them pass.

Task 2 is a single commit on purpose: the overflow fix without the tiers
squeezes the timeline to 124px at 1100.

**Tier mechanics** (overview §4.4):

- `.planner-layout` is the `planner` container.
- `.planner-panes` flips between column and row.
- Aside widths and grid tracks are set by selectors inside the three
  `@container planner` blocks.
- The column cap uses a `data-columns` attribute (`min(courses, 3)`), not
  `min()` inside `repeat()`, which browsers support unevenly:
  - ≥63.1rem: `.available-courses:not([data-columns="1"])` → `repeat(2,
    13rem)`
  - ≥76.7rem: `.available-courses[data-columns="3"]` → `repeat(3, 13rem)`

**Side-by-side needs no ≥1100px gate.** Below 1100px the planner is at
most `viewport − 2.5rem` wide, so side-by-side kicks in from about 832px.
That's decision §5a.1.

## 5. Task breakdown

### Task 1: Add a Playwright layout harness to the spec

- [x] **Description:** add a real-browser harness so layout properties that
  jsdom can't measure are checked inside `pnpm check` and CI.
- **Files touched:**
  - `package.json`, `pnpm-lock.yaml`: `pnpm add -D playwright`
  - `spec/browser.ts` (new)
  - `spec/layout.test.ts` (new)
  - `.github/workflows/checks.yml`
  - `spec/README.md`
- **Tests first (red):** write `spec/layout.test.ts`:
  ```ts
  import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
  import type { Browser } from "playwright";
  import { horizontalOverflow, launch, openPage } from "./browser";

  const baseUrl = inject("baseUrl");
  let browser: Browser;
  beforeAll(async () => { browser = await launch(); }, 60_000);
  afterAll(async () => { await browser?.close(); });

  describe("layout", { timeout: 30_000 }, () => {
    it("the plan page doesn't scroll sideways on a phone", async () => {
      const page = await openPage(browser, new URL("/plan/example", baseUrl).href, { width: 390, height: 844 });
      expect(await horizontalOverflow(page)).toBe(0);
      await page.close();
    });
  });
  ```
  It fails first because `./browser` doesn't exist.
- **Implementation (green):**
  - **`spec/browser.ts`**, with exactly the overview §4.5 signatures:
    - **`launch()`** returns `chromium.launch()` from `playwright`. On
      failure, rethrow with the message `Chromium not installed — run
      \`pnpm exec playwright install chromium\``.
    - **`openPage()`**:
      1. Create `browser.newContext({ viewport })`.
      2. If `storage` is given, call `context.addInitScript` with a function
         that writes each entry with `localStorage.setItem`. Pass the entries
         as the init script's argument.
      3. If `blockScripts` is set, call `context.route(/\/_astro\/.*\.js$/,
         (route) => route.abort())`.
      4. `page.goto(url, { waitUntil: "networkidle" })` and return the page.
    - **`horizontalOverflow`**: `page.evaluate(() =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth)`.
    - **`axeViolations`**:
      1. `await page.addScriptTag({ content: (await import("axe-core")).default.source })`.
      2. Run `axe.run(document, { rules: { "color-contrast": { enabled:
         false }, "link-in-text-block": { enabled: false } } })` in the
         page, the same rules as `spec/invariants.test.ts`.
      3. Map the violations to `` `${id}: ${nodes.map(n => n.target.join(" ")).join("; ")}` ``.
  - **`checks.yml`:** before "Build and run the spec", add a step named
    "Install Chromium for the layout spec" running `pnpm exec playwright
    install --with-deps chromium`.
  - **`spec/README.md`:** add a section "## Layout (real browser)". Say that
    `layout.test.ts` drives the built server in headless Chromium (via
    `spec/browser.ts`) for geometry that jsdom can't measure, and give the
    one-time local setup command.
- **Refactor:** none.
- **Acceptance criteria:**
  - `pnpm check` passes locally, and the new test appears in the `spec`
    project's output.
  - With Chromium uninstalled, the failure names the install command.
  - `checks.yml` has the new step before `pnpm check`.
  - Commit: "Add a real-browser layout harness to the spec".
- **Depends on:** none.

### Task 2: Lay the planner out from its own width, in 3/2/1-column tiers

- [x] **Description:**
  - Stop `main` pinning the page wider than the viewport.
  - Wrap the panes in a `planner` size container.
  - Pick stacked or side-by-side, the aside width and the card column count
    from the planner's width (overview §4.4).
- **Files touched:**
  - `src/components/Planner.tsx`
  - `src/components/Sidebar.tsx`
  - `src/components/CourseSearch.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
  - `PROCESS_LOG.md` (after the commit)
- **Tests first (red):** add to `spec/layout.test.ts`. All run on
  `/plan/example`.
  1. **`horizontalOverflow` is 0** at each of 1920×1080, 1440×900, 1280×800,
     1100×800, 900×800 and 800×800 (`it.each`).
  2. **Layout and tier per viewport** (`it.each`):

     | Viewport | Layout | Aside `offsetWidth` |
     | --- | --- | --- |
     | 1920×1080 | side-by-side | 715 (44.7rem) |
     | 1440×900 | side-by-side | 498 (31.1rem) |
     | 1100×800 | side-by-side | 280 (17.5rem) |
     | 900×800 | side-by-side | 280 |
     | 800×800 | stacked | — |
     | 390×844 | stacked | — |

     Side-by-side means `aside.getBoundingClientRect().right <=
     timelineArea.getBoundingClientRect().left` and their `top`s are within
     1px. Stacked means `aside.top >= timelineArea.bottom`.
  3. **Column counts:**
     - At 1920, some `.available-courses[data-columns="3"]` has
       `getComputedStyle(ul).gridTemplateColumns.split(" ").length === 3`.
     - At 1440 that same list has 2.
     - At 1100 it has 1.
  4. **Cards stay inside their group** at 1920, 1440, 1100 and 390. For
     every `.available-courses > *`, `rect.right <= group.right - 1`, where
     `group` is `card.parentElement.closest("li")` (the nearest group `li`
     above the grid; the card itself may be an `li`). This guards the
     depth-2 budget.

  Tests 1 and 2 fail today: the overflow is +208, and the aside is 704px at
  every desktop width. Test 3 fails at 1440 and 1100.
- **Implementation (green):**
  - **`Planner.tsx`:**
    - Wrap `div.planner-timeline-area` and `<Sidebar …/>` in `<div
      class="planner-layout"><div class="planner-panes"> … </div></div>`,
      in that order.
    - Leave the `aria-live` `<p>` and the `undo-toast` as direct children
      of `.planner`, outside `.planner-layout`.
    - Add a one-line comment on the wrapper saying why the toast stays
      outside (fixed positioning vs layout containment).
  - **`Sidebar.tsx:137`:** replace `style={{ "--group-columns": columns }}`
    with `data-columns={columns}`. Keep `columns`, `MAX_COLUMNS` and its
    comment, but reword the comment to say the grid's tracks are chosen in
    CSS from this attribute and the sidebar's width tier.
  - **`CourseSearch.tsx:234`:** replace the `style` with
    `data-columns={Math.min(results.length, 3) || 1}`.
  - **`styles.css`:**
    1. Add the `:root` tokens from overview §4.4.
    2. Add `min-width: 0;` to the base `main` rule, with a comment on why:
       flex `min-width: auto` let a `width: 100%` main sit beside the
       desktop nav and overflow by the nav's width.
    3. Add `.planner-layout { container: planner / inline-size; }`.
    4. Rename every `.planner > aside` selector to `.planner-panes > aside`.
    5. Move `.planner`'s `display: flex; flex-direction: column; gap: 1rem`
       onto `.planner-panes`, and add `--reqs-fit: 0` there. `.planner`
       keeps no layout rules.
    6. Delete the `@media (min-width: 1100px)` block at `:972-1018`, and
       replace it with three blocks:
       - **`@container planner (min-width: 49.5rem)`:**
         - `.planner-panes { flex-direction: row; align-items: flex-start;
           --reqs-fit: 1; }`
         - `.planner-panes > aside { order: -1; flex: 0 0 var(--reqs-w-1);
           width: var(--reqs-w-1); position: sticky; top: 1rem; max-height:
           calc(100vh - 2rem); overflow-y: auto; scrollbar-gutter: stable;
           }`, keeping the existing gutter comment. Update its "44rem /
           exactly three cards" wording to point at the §4.4 width formula.
         - The existing `.planner-timeline-area`, `.requirements-scroll` and
           `.requirement-group` rules, moved over verbatim.
       - **`@container planner (min-width: 63.1rem)`:**
         - `.planner-panes { --reqs-fit: 2; }`
         - `.planner-panes > aside { flex-basis: var(--reqs-w-2); width:
           var(--reqs-w-2); }`
         - `.available-courses:not([data-columns="1"]) {
           grid-template-columns: repeat(2, 13rem); }`
       - **`@container planner (min-width: 76.7rem)`:**
         - `--reqs-fit: 3`, with width `var(--reqs-w-3)`
         - `.available-courses[data-columns="3"] { grid-template-columns:
           repeat(3, 13rem); }`
    7. Above the three blocks, add a comment that the thresholds are
       `width + 1rem gap + --timeline-min`, written as literals because
       `@container` can't read `var()`, and that the widths budget for
       depth-2 groups.
- **Refactor:** remove the now-unused `--group-columns` wording anywhere it
  remains (grep `group-columns`, which should give no hits).
- **Acceptance criteria:**
  - All Task 1 and Task 2 layout tests pass.
  - `pnpm check` is green, with the invariants unchanged.
  - `grep -rn "group-columns" src` finds nothing, and no `.planner`,
    `.planner-panes`, `.requirements-scroll` or `.available-courses` rule
    remains inside any `@media (min-width: 1100px)` block.
  - Render check (overview §3) at 1920×1080 and 390×844 matches today
    except for the removed overflow.
  - Commit: "Lay the planner out from its own width so the page never
    scrolls sideways".
  - After committing, append a `PROCESS_LOG.md` entry per its header
    format, citing this commit's sha. Leave it for the user to edit. The
    moment is that the "swipe to hide the nav" the user described turned
    out to be page overflow, found by measuring the render rather than
    reading the source. The fix landed in the harness (Task 1's browser
    spec now fails on any sideways overflow), and the containment and
    toast constraint was caught before it shipped.
- **Human review:** screenshots at 1280×800, 1100×800 and 900×800 of
  `/plan/example`. A pass means:
  - The 2-column and 1-column sidebars read cleanly: headings, progress
    bars and the search box aren't cramped.
  - The timeline shows at least one full year without clipping.
  - The user explicitly accepts the 1-column tier on tablets.
- **Depends on:** Task 1.

## 6. Phase Definition of Done

- [x] Tasks 1–2 complete, with their tests passing
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] Two commits exist (Task 1, Task 2), and the PROCESS_LOG entry cites
      Task 2's sha
- [x] Task 2's human review accepted by the user
- [x] Tick Phase 01 in overview §5 and commit

**Outcome (2026-09-27):** Task 1 `009ebcf`, Task 2 `29a3c5f`, PROCESS_LOG
`f2145ac`. Task 2's review was accepted. It flagged the course-search
placeholder being cut off in the 1-column tier (and at 390). At the user's
request that was fixed as a separate follow-up, `c6d1e88`: the placeholder is
now "e.g. COMP1100", with a layout test measuring its fit at five widths.

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR1 (expanded) | Task 2, test 1 |
| FR2 | Task 2, test 2 |
| FR3 | Task 2, tests 3–4 |
| FR4 (fit) | Task 2, tests 2–3 |
| FR5 | Task 2, test 2 + render check |
| NFR verification/CI | Task 1 |

## 8. Risks / open questions

None.
