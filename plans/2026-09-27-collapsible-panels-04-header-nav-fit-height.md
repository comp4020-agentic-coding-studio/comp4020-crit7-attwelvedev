# Collapsible panels — Phase 04: Nav toggle at every width, plan page fits the screen

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27 (added after Phase 02
  shipped; replaces FR9's "no toggle below 1100px")
- **Part of:** `plans/2026-09-27-collapsible-panels-00-overview.md`. Read
  these sections first:
  - §2 (FR1, FR5, FR9, FR26–30)
  - §3
  - §4.2 (the head script; unchanged by this phase)
  - §4.4 (cascade order; this phase adds item 2)
  - §4.5 (browser helpers; this phase adds `verticalOverflow`)
- **Depends on phases:** 01, 02 and 03.

## 1. Summary

This phase:

- Brings the nav's hide control to the narrow top bar. It gets a "Hide
  navigation" button at the end of the brand row with an up chevron. Hidden,
  the bar is replaced by a down-chevron tab at the start of the page title's
  row, with the title indented beside it.
- Fits `/plan/*` to the viewport. The page itself stops scrolling
  vertically. The title stays at the top, and the timeline and the
  requirements each scroll inside the planner. This happens at every width,
  whenever the viewport is at least 30rem tall.

When it ends, the nav hides the same way at every width. The plan page is a
fixed-height workspace, and the Phase 05 resize handle can stretch with the
panes instead of copying the old sticky height.

## 2. Requirements (this phase)

### 2.1 Functional

- FR9 (as amended) and FR26 in full: Task 9.
- FR27, FR28, FR29 and FR30 in full: Task 10.
- FR1: re-asserted in the new states (nav hidden in top-bar mode; the fitted
  page).
- FR5: the amended wording. 1920×1080 and 390×844 change only as FR26–29
  describe.

### 2.2 Non-functional

- Focus moves between the hide button and the tab at every width.
- Both controls are at least 44px.
- In-browser axe is clean at 390×844 with the nav hidden.
- `spec/invariants.test.ts` stays green: the nav landmark stays in the DOM,
  and there's exactly one `h1` per page.
- No new animation.

### 2.3 Out of scope for this phase

- Fitting any page other than `/plan/*` to the viewport. Home, Help and
  Design notes stay scrolling documents.
- Redesigning the top bar or the rail beyond adding the button.
- The resize handle (Phase 05). Its amended CSS is written there.

### 2.4 Assumptions

See overview §2.4. Phase-specific assumptions:

- **One `panel-nav` key for every width.** Hiding on a phone hides on
  desktop too, and vice versa. The head script already applies it
  unconditionally; only the CSS was gated.
- **Every page's first content in `<main>` is its single `<h1>`.** This is
  true of `/`, `/help/`, `/plan/*`, the plan-not-found page and `/readme/`,
  where `README.md` starts with `# ANU Degree Planner`. Exactly one `h1` is a
  jsdom invariant.
- **`(width < 1100px)` media range syntax and `100dvh`** are fine for the
  supported browsers (current Chromium, Firefox and Safari).

## 3. Existing code context (verified 2026-09-27, at `6cebaa0`)

**`src/layouts/Base.astro` body** (the head script is unchanged by this
phase):

```astro
  <body>
    <div class="app-shell">
      <button type="button" class="nav-show" aria-controls="site-nav" aria-expanded="false"
        ><svg class="nav-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
          ><path d="m9 6 6 6-6 6"></path></svg
        ><span class="visually-hidden">Show navigation</span></button
      >
      <nav aria-label="site" id="site-nav">
        <a href="/" class="brand">ANU Degree Planner</a>
        <div class="nav-links">
          …four links…
        </div>
        <button type="button" class="nav-hide" aria-controls="site-nav" aria-expanded="true"
          ><svg class="nav-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
            ><path d="m15 6-6 6 6 6"></path></svg
          >Hide navigation</button
        >
      </nav>
      <main>
        <slot />
      </main>
    </div>
    <script>
      import { setNavHidden } from "../components/panel-state";
      … hide → setNavHidden(root, true); show?.focus()
      … show → setNavHidden(root, false); hide?.focus()
    </script>
  </body>
```

The click script finds both buttons by class, so moving `.nav-show` doesn't
touch it.

**`src/styles.css`, shell section** (from the `.app-shell` rule to the end of
the `@media (min-width: 1100px)` block):

- **`.app-shell`** is `display: flex; flex-direction: column; min-height:
  100vh;`.
- **Top bar (base):** `nav[aria-label="site"]` is `display: flex;
  align-items: center; gap: 1.5rem; padding: 0.85rem 1.25rem; flex-wrap:
  wrap;`. `.nav-links` is `display: flex; flex: 1 1 100%; …`, so the links
  wrap onto a second row under the brand.
- **Main:**
  - `main` is `flex: 1; width: 100%; min-width: 0; max-width: 40rem;
    margin: 0 auto; padding: 2rem 1.25rem 3rem;`.
  - `body:has(.planner) main` is `max-width: none; width: 100%; padding:
    1.25rem;`.
- **The rules Phase 02 added, verbatim:**

  ```css
  /* Hiding the nav is a desktop-only affordance: below 1100px the nav is a
     short top bar that costs no width, so neither control shows and a saved
     `data-nav` has no effect. */
  .nav-show,
  .nav-hide {
    display: none;
  }

  .nav-toggle-icon {
    width: 1rem; height: 1rem; fill: none; stroke: currentColor;
    stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;
  }
  ```

- **Inside `@media (min-width: 1100px)`:**
  - The rail rules: `nav[aria-label="site"] { flex-direction: column; …
    position: sticky; top: 0; height: 100vh; }`.
  - `main { padding: 2.5rem 3rem; }`.
  - `body:has(.planner) main { padding: 1.25rem 1.5rem; }`.
  - Then these:
    - `nav[aria-label="site"] .nav-hide { display: inline-flex;
      align-items: center; gap: 0.35rem; margin-block-start: auto;
      min-height: 2.75rem; padding: 0.35rem 0.6rem; font-size: 0.9rem;
      font-weight: 500; color: rgb(255 255 255 / 0.75); background:
      transparent; border: none; border-radius: 0.4rem; }`
    - `nav[aria-label="site"] .nav-hide:hover { color: #fff; background:
      rgb(255 255 255 / 0.08); }`
    - `:root[data-nav="hidden"] nav[aria-label="site"] { display: none; }`
    - `:root[data-nav="hidden"] .nav-show { display: inline-flex;
      align-items: center; justify-content: center; position: fixed; top:
      0.5rem; left: 0.5rem; z-index: 5; width: 2.75rem; height: 2.75rem;
      padding: 0; background: var(--ink); color: #fff; border-color:
      var(--ink); }`
    - The gutter: `:root[data-nav="hidden"] main { padding-inline-start:
      3.75rem; }`, with its comment.
- **Headings:** the global `h1` is `font-size: clamp(1.6rem, 1.3rem + 1vw,
  2.1rem)` with `margin: 0 0 0.5rem; line-height: 1.2`.

**`src/styles.css`, planner section**

- **Base rules:**
  - `.planner-layout { container: planner / inline-size; }`
  - `.planner-panes { display: flex; flex-direction: column; gap: 1rem;
    --reqs-fit: 0; }`
  - `.planner-timeline-area { position: sticky; top: 0; z-index: 2;
    background: var(--paper); padding-block-end: 0.75rem; border-block-end:
    1px solid var(--line); max-height: 50vh; overflow-y: auto; }`
  - `.planner-panes > aside { min-width: 0; }`
  - `.reqs-rail { … min-height: min(24rem, calc(100vh - 2rem)); … }`
- **`@container planner (min-width: 49.5rem)` (first tier block):**
  - `.planner-panes { flex-direction: row; align-items: flex-start;
    --reqs-fit: 1; }`
  - `.planner-panes > aside { order: -1; display: flex; flex-direction:
    column; flex: 0 0 var(--reqs-w-1); width: var(--reqs-w-1); position:
    sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto;
    scrollbar-gutter: stable; }`
  - `.planner-timeline-area { flex: 1 1 auto; min-width: 0; top: 1rem;
    max-height: calc(100vh - 2rem); overflow-y: auto; }`
- **Next come the 63.1rem and 76.7rem tier blocks,** which set only
  `--reqs-fit`, the aside's `flex-basis`/`width`, and grid tracks.
- **Last comes the collapsed block,** which starts with the comment
  `/* Collapsed sidebar. This block must stay last in the planner section: …
  */` and is a second `@container planner (min-width: 49.5rem)`. It holds:
  - `.reqs-hide { display: inline-flex; … }`
  - `:root[data-reqs="collapsed"] .planner-panes > aside { flex-basis:
    var(--reqs-w-rail); width: var(--reqs-w-rail); overflow: visible;
    scrollbar-gutter: auto; }`
  - The rules that hide the content and show `.reqs-rail { display: flex;
    }`
  - The drop-ready outline.
- **`.undo-toast`** is `position: fixed`. It's rendered inside `.planner`
  but outside `.planner-layout`.

**`src/components/Planner.tsx` render (the DOM this phase styles)**

```
div.planner[data-cutoff] (ref=plannerRef)
├── p[aria-live].visually-hidden
├── div.planner-layout
│   └── div.planner-panes
│       ├── div.planner-timeline-area   (cutoff controls, readout, <Timeline>)
│       └── <Sidebar> → aside#requirements[aria-label="requirements"]
│                        ├── button.reqs-hide
│                        ├── …div#requirements-content / ul.requirements-scroll…
│                        └── button.reqs-rail
└── div.undo-toast (only while an undo is offered)
```

`src/pages/plan/[id].astro` renders `<h1>{title}</h1>`, then (read-only
plans only) `<p role="note">`, then `<Planner client:load />`, all as direct
children of `<main>`.

**`spec/layout.test.ts`**

- The `site nav` describe block has five tests. The third, `"ignores the
  saved state on a phone, where there's no toggle"`, asserts the opposite of
  amended FR9. **Task 9 deletes it.** That isn't weakening a test: the user
  replaced the requirement it encoded on 2026-09-27, and Task 9's tests
  assert the new one.
- The other four tests stay unchanged and must keep passing. Test 1 checks
  `h1.left >= navShow.right` at 1920.
- The `requirements sidebar collapse` and `requirements rail as a drop
  target` blocks (Phase 03) must keep passing unchanged. The drop tests aim
  at the rail's centre, which stays on screen when the rail grows to the
  panes' height.

**`spec/browser.ts`** exports `launch`, `openPage`, `horizontalOverflow` and
`axeViolations` (overview §4.5).

### Interfaces from earlier phases (exact)

From Task 1, `spec/browser.ts`:

```ts
export interface Viewport { width: number; height: number }
export interface OpenOptions { storage?: Record<string, string>; blockScripts?: boolean }
export function launch(): Promise<Browser>;
export function openPage(browser: Browser, url: string, viewport: Viewport, options?: OpenOptions): Promise<Page>;
export function horizontalOverflow(page: Page): Promise<number>;
export function axeViolations(page: Page): Promise<string[]>;
```

In `spec/layout.test.ts`:

- `const baseUrl = inject("baseUrl")`
- a shared `browser`
- `const planUrl = () => new URL("/plan/example", baseUrl).href;`
- `import { ROUTES } from "./routes"` is **not** imported yet. `ROUTES` is
  `["/", "/readme/", "/help/", "/plan/example"]`.

From Task 3, `src/components/panel-state.ts`:
`setNavHidden(root: DatasetHost, hidden: boolean, storage?: StorageLike |
null): void`, with `NAV_KEY = "panel-nav"`. It's unchanged by this phase.

From Task 4, the head script line `if (s.getItem("panel-nav") === "hidden")
h.dataset.nav = "hidden";`. It already runs at every width.

From Task 5, the side-by-side aside is `display: flex; flex-direction:
column`, `.reqs-rail` shows only under `:root[data-reqs="collapsed"]`, and
the collapsed block must stay last in the planner section.

## 4. Approach

**The tab moves into `<main>` as its first child.** In top-bar mode it's
`position: absolute` with **no insets**, so it sits at its static position,
which is the top-left corner of `main`'s content box. That's exactly where
the page's `h1` starts, on every page, whatever `main`'s padding and
centring. Indenting the `h1` by the tab's width plus a gap gives the tab its
own spot on the title row.

- It's absolute rather than fixed, so on scrolling pages it scrolls away
  with the title, as the bar did, and never sits over text.
- At ≥1100px it stays `position: fixed` in the left gutter, as Phase 02
  built it. `main` has no transform or containment, so moving the button
  inside `main` changes nothing there.
- It can't stay before `<nav>`: its static position there is the
  `.app-shell`'s corner, not the title's.

**The chevrons rotate instead of changing markup.** Below 1100px,
`.nav-toggle-icon { transform: rotate(90deg) }` turns the hide button's
left chevron to point up and the tab's right chevron to point down. At
≥1100px there's no transform.

**The hide button joins the brand row.** Below 1100px, `.nav-links { order:
1 }` keeps the links on their own full-width second row. `.nav-hide {
margin-inline-start: auto }` pushes the button to the end of the first row.
The button's shared look (44px, muted white, link-style hover) moves out of
the desktop block into base CSS. Only `margin-block-start: auto` stays
desktop-only.

**Fitting the plan page** is one CSS group, gated on `@media (min-height:
30rem)`:

- `body:has(.planner) .app-shell` is `height: 100dvh`.
- `main`, `.planner` and `.planner-layout` become flex columns. Each child
  on the path to `.planner-panes` gets `flex: 1 1 auto; min-height: 0`, so
  the panes get a definite height: whatever's left under the nav, title and
  note.
- **Stacked:** under `@container planner (width < 49.5rem)`, the timeline is
  `position: static; flex: 0 1 auto; max-height: 50%`. The aside is `flex: 1
  1 0; min-height: 0; overflow-y: auto`.
- **Side-by-side:** under `@container planner (min-width: 49.5rem)`,
  `.planner-panes` is `align-items: stretch`. The timeline and the aside are
  `position: static; max-height: none`, so both fill the panes' height and
  keep their own `overflow-y: auto`. The collapsed `.reqs-rail` is `flex: 1
  1 auto; min-height: 0`, so it fills the aside instead of its old sticky
  minimum.
- **Placement:** after the three tier blocks, because it overrides their
  `position`/`max-height`/`align-items` at equal specificity. Before the
  collapsed block, which must stay last. This becomes overview §4.4 item 2.
- **Below 30rem tall,** none of it applies, and today's sticky panes and page
  scroll remain.

## 5. Task breakdown

### Task 9: Hide the nav at every width, with a tab beside the title in top-bar mode

- [ ] **Description:** show the hide button in the top bar, let a saved or
  clicked `data-nav="hidden"` take effect below 1100px, and place the tab
  beside the page title there.
- **Files touched:**
  - `src/layouts/Base.astro`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** in `spec/layout.test.ts`:
  - Add `import { ROUTES } from "./routes";`.
  - Delete `"ignores the saved state on a phone, where there's no toggle"`
    (see this file's §3 for why).
  - Add a `describe("site nav in the top bar", { timeout: 30_000 }, …)`
    block with `const phone = { width: 390, height: 844 }` and `const
    navHidden = { storage: { "panel-nav": "hidden" } }`. Rotation is read
    through a `rotation(page, selector)` helper, which returns `Math.round(
    Math.atan2(m.b, m.a) * 180 / Math.PI)` for `m = new DOMMatrix(
    getComputedStyle(el).transform === "none" ? "" : getComputedStyle(el).
    transform)`. That's 90 when turned clockwise and 0 when untransformed.
    1. **Hide, focus, persist on a phone.** At `phone` on `/plan/example`:
       - `button.nav-hide` is visible, and its `boundingBox().height >=
         44`.
       - Its vertical centre is within 4px of `.brand`'s vertical centre,
         and its top is above the first `.nav-links a`'s top.
       - `rotation(page, "button.nav-hide .nav-toggle-icon")` is 90.
       - Click it. The nav isn't visible, `button.nav-show` is visible,
         `document.activeElement` is the tab, and `rotation(page,
         "button.nav-show .nav-toggle-icon")` is 90.
       - `localStorage.getItem("panel-nav")` is `"hidden"`, and
         `horizontalOverflow` is 0.
       - Click the tab. The nav is visible, focus is on `.nav-hide`, and the
         key is `null`.
    2. **The tab shares the title's row and covers nothing.** `it.each` over
       every route in `ROUTES` × `[[390, 844], [900, 800]]`, opened with
       `navHidden`. In one `page.evaluate`:
       - `t` is the tab's rect.
       - `text` is a `Range` over `h1`'s contents, and its rect.
       - `covered` is every element matching `main *` that isn't the tab
         or inside it, isn't the `h1` or inside it, and isn't an ancestor of
         the `h1`, whose non-empty rect intersects `t`, mapped to
         `tagName.className`.
       - Assertions:
         - The tab is visible.
         - `text.left >= t.right`.
         - `t.top < text.bottom && t.bottom > text.top`.
         - `covered` equals `[]`.
         - `horizontalOverflow` is 0.
    3. **No flash.** At `phone` on `/help/` with `{ ...navHidden,
       blockScripts: true }`: the nav isn't visible, and the tab is visible.
    4. **Axe while hidden.** At `phone` on `/plan/example` with `navHidden`,
       `axeViolations(page)` equals `[]`.
    5. **The rail is untouched.** At 1920×1080 on `/plan/example`, the
       `.nav-hide` icon's rotation is 0. With `navHidden`, the tab's
       computed `position` is `"fixed"`, and the `h1`'s computed
       `padding-inline-start` is `"0px"`.

  Tests 1–4 fail today, because below 1100px neither control shows and
  `data-nav` does nothing. Test 5 passes already and guards against
  regressions. The four remaining Phase 02 tests stay green.
- **Implementation (green):**
  - **`Base.astro`:**
    - Move the `.nav-show` `<button>` element (unchanged markup) from before
      `<nav>` to be the first child of `<main>`, before `<slot />`.
    - Precede it with `{/* In the top bar's layout the tab has no insets, so
      it sits where main's content starts, which is where every page's title
      starts; see styles.css. */}`.
  - **`styles.css`, shell section:** replace Phase 02's comment and its
    `.nav-show, .nav-hide { display: none; }` rule (keep `.nav-toggle-icon`
    as it is) with the following, in this order:
    - A comment: hiding the nav works at every width. The rail collapses to
      a fixed tab in a left gutter; the top bar collapses to a tab where the
      page title starts, with the title indented beside it.
    - `.nav-show { display: none; }`
    - `nav[aria-label="site"] .nav-hide`, with every declaration it has in
      the desktop block today **except** `margin-block-start: auto`.
    - `nav[aria-label="site"] .nav-hide:hover`, moved verbatim from the
      desktop block.
    - `:root[data-nav="hidden"] nav[aria-label="site"] { display: none; }`,
      moved from the desktop block.
    - `:root[data-nav="hidden"] .nav-show { display: inline-flex;
      align-items: center; justify-content: center; position: absolute;
      z-index: 5; width: 2.75rem; height: 2.75rem; padding: 0; background:
      var(--ink); color: #fff; border-color: var(--ink); }`
    - After `.nav-toggle-icon`, a new `@media (width < 1100px)` block:
      - `nav[aria-label="site"] .nav-links { order: 1; }` and
        `nav[aria-label="site"] .nav-hide { margin-inline-start: auto; }`,
        with a comment that the button ends the brand row while the links
        keep their own row.
      - `.nav-toggle-icon { transform: rotate(90deg); }`, with a comment
        that these are the rail's chevrons turned to the bar's axis: up to
        tuck it away, down to bring it back.
      - `:root[data-nav="hidden"] h1 { display: flex; align-items: center;
        min-height: 2.75rem; padding-inline-start: 3.5rem; }`, with a
        comment that the tab has no insets, so it sits at `main`'s content
        corner, where every page's single `h1` starts, and the indent is
        the tab's 2.75rem plus a 0.75rem gap.
  - **`styles.css`, desktop block:**
    - Reduce `nav[aria-label="site"] .nav-hide` to `margin-block-start:
      auto;`.
    - Delete the `.nav-hide:hover` and `:root[data-nav="hidden"]
      nav[aria-label="site"]` rules (now in base).
    - Reduce `:root[data-nav="hidden"] .nav-show` to `position: fixed; top:
      0.5rem; left: 0.5rem;`.
    - Leave the gutter rule as it is.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests 1–5 pass, along with the four remaining Phase 02 nav tests and
    every Phase 03 test.
  - `pnpm check` passes, including invariants on all four routes.
  - Render check with `agent-browser` at 1920×1080, 900×800 and 390×844,
    nav shown and hidden.
  - Commit: "Let the site nav be hidden at every width, with a tab beside
    the page title on narrow screens".
- **Human review:** screenshots at 390×844 and 900×800 of `/plan/example`
  with the nav shown (the button in the bar) and hidden (the tab beside the
  title), plus `/help/` hidden at 390×844. A pass means:
  - The up-chevron button reads as part of the bar.
  - The down tab and the title read as one row.
  - Nothing is covered.
  - The bar's slightly taller first row (the 44px button) is acceptable.

  The user accepts explicitly.
- **Depends on:** none within the phase (Phases 01–03 done).

### Task 10: Fit the plan page to the screen, each pane scrolling on its own

- [ ] **Description:** add the fit group to `styles.css` and the
  `verticalOverflow` helper, then test every layout state.
- **Files touched:**
  - `spec/browser.ts`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Helper:** add to `spec/browser.ts`, beside `horizontalOverflow`:

    ```ts
    export function verticalOverflow(page: Page): Promise<number> {
      return page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
    }
    ```

    Import it in `spec/layout.test.ts`.
  - Add `describe("plan page fits the screen", { timeout: 30_000 }, …)`
    with `const rect = (s: string) =>
    document.querySelector(s)!.getBoundingClientRect()` used inside
    `page.evaluate`:
    1. **No page scroll in any state.** `it.each` over:
       - `[1920, 1080, {}]`
       - `[1440, 900, {}]`
       - `[1280, 800, {}]`
       - `[1100, 800, {}]`
       - `[900, 800, {}]`
       - `[800, 800, {}]`
       - `[390, 844, {}]`
       - `[1920, 1080, { "panel-nav": "hidden" }]`
       - `[900, 800, { "panel-nav": "hidden" }]`
       - `[390, 844, { "panel-nav": "hidden" }]`
       - `[1920, 1080, { "panel-reqs": "collapsed" }]`
       - `[900, 800, { "panel-reqs": "collapsed" }]`

       On `/plan/example` with that storage, `verticalOverflow` and
       `horizontalOverflow` are both 0.
    2. **Side-by-side panes fill the planner.** At `[1920, 1080]` and
       `[900, 800]`:
       - `aside` and `.planner-timeline-area` tops are within 1px of each
         other.
       - Both bottoms are within 1px of `.planner-panes`' bottom.
       - That bottom is within 1px of `innerHeight −
         parseFloat(getComputedStyle(main).paddingBottom)`.
    3. **Each pane scrolls on its own and the title stays.** At 1920×1080:
       - Record the `h1` top, set `aside.scrollTop = 300`, then read back.
         `aside.scrollTop > 0`, `timeline.scrollTop === 0`,
         `document.scrollingElement.scrollTop === 0`, and the `h1` top is
         unchanged.
       - Then the same with `timeline.scrollTop = 300`: `timeline.scrollTop
         > 0` and `aside.scrollTop` is still its previous value.
    4. **The rail fills the aside.** At 1920×1080 with `{ "panel-reqs":
       "collapsed" }`:
       - `.reqs-rail`'s bottom is within 1px of `aside`'s bottom.
       - `aside`'s bottom is within 1px of `.planner-timeline-area`'s
         bottom.
    5. **Stacked split.** At 390×844, then again with `{ "panel-nav":
       "hidden" }`:
       - With `p` = `.planner-panes`, `t` = timeline and `a` = aside rects:
         `t.height <= p.height / 2 + 1`, `a.top >= t.bottom`, and
         `|a.bottom − p.bottom| <= 1`.
       - `a.height >= p.height / 2 − 17` (half, less the 1rem gap).
    6. **Short viewports keep scrolling.** At 844×390, a landscape phone,
       on `/plan/example`:
       - `getComputedStyle(aside).position` is `"sticky"` (side-by-side,
         unfitted).
       - `verticalOverflow > 0`, and `horizontalOverflow` is 0.

  Tests 1–5 fail today, since the page scrolls and the panes are sticky with
  viewport-based heights. Test 6 passes already and guards the fallback.
- **Implementation (green):** in `styles.css`, add one group immediately
  after the `@container planner (min-width: 76.7rem)` block and before the
  `/* Collapsed sidebar. …` comment:

  ```css
  /* The plan page is a workspace, not a document: once the viewport is tall
     enough for the panes to be useful, the page itself stops scrolling and
     the timeline and requirements scroll inside it, so the title and the nav
     (or its tab) never scroll away. Below 30rem tall (a landscape phone) the
     panes would shrink to slivers, so the page scrolls as before. This group
     sits after the tier blocks because it undoes their sticky positioning at
     equal specificity, and before the collapsed block, which must stay last. */
  @media (min-height: 30rem) {
    body:has(.planner) .app-shell {
      height: 100dvh;
      min-height: 0;
    }

    body:has(.planner) main {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* Every box from main down to the panes flexes, so the panes end up
       with a definite height: whatever the nav, title and note leave. */
    .planner,
    .planner-layout,
    .planner-panes {
      flex: 1 1 auto;
      min-height: 0;
    }

    .planner,
    .planner-layout {
      display: flex;
      flex-direction: column;
    }

    @container planner (width < 49.5rem) {
      .planner-timeline-area {
        position: static;
        flex: 0 1 auto;
        max-height: 50%;
      }

      .planner-panes > aside {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
      }
    }

    @container planner (min-width: 49.5rem) {
      .planner-panes {
        align-items: stretch;
      }

      .planner-timeline-area,
      .planner-panes > aside {
        position: static;
        max-height: none;
      }

      :root[data-reqs="collapsed"] .reqs-rail {
        flex: 1 1 auto;
        min-height: 0;
      }
    }
  }
  ```

- **Refactor:** update the comment above `.requirements-scroll`
  ("…dragged straight up onto the (sticky, above) timeline…") to say "the
  timeline above it". Once fitted, the timeline is always above it rather
  than sticky. Overview §4.4 already lists this group's place in the
  cascade.
- **Acceptance criteria:**
  - Tests 1–6 pass, along with every earlier layout test, including Phase
    03's drop and undo tests.
  - `pnpm check` passes.
  - Render check with `agent-browser` at 1920×1080, 900×800 and 390×844
    (nav shown and hidden), plus 844×390.
  - Commit: "Fit the plan page to the screen so the title stays put and each
    pane scrolls on its own".
- **Human review:** screenshots of `/plan/example`:
  - at 1920×1080 (with the sidebar scrolled part-way)
  - at 900×800
  - at 390×844, nav shown and hidden

  A pass means:
  - The page reads as a workspace: the title fixed at the top, panes
    running to the bottom edge with the bottom padding visible, and nothing
    clipped.
  - On the phone, both halves are usable.

  The user accepts explicitly.
- **Depends on:** Task 9 (test 1 seeds the nav hidden at 390×844 and 900×800,
  which only has an effect after Task 9).

## 6. Phase Definition of Done

- [ ] Tasks 9–10 complete, with their tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Two commits, one per task
- [ ] Human reviews for Tasks 9 and 10 accepted by the user
- [ ] Tick Phase 04 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR9 (amended) | Task 9, tests 1, 3 and 5 |
| FR26 | Task 9, tests 1–3 |
| FR27 | Task 10, test 1 |
| FR28 | Task 10, tests 2–4 |
| FR29 | Task 10, test 5 |
| FR30 | Task 10, test 6 |
| FR1 (new states) | Task 9, tests 1–2; Task 10, test 1 |
| FR5 (amended) | Task 9 and Task 10 human reviews |
| NFR a11y | Task 9, tests 1 and 4 |

## 8. Risks / open questions

None.
