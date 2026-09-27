# Collapsible panels — Phase 02: Collapsible site nav

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-collapsible-panels-00-overview.md`. Read
  these sections first:
  - §2 (FR6–9, FR22–25)
  - §3
  - §4.2 (keys, attributes, the final head script)
  - §4.3 (`panel-state.ts` API)
  - §4.5 (browser helpers)
- **Depends on phases:** 01 (for `spec/browser.ts` and the fit layout).

## 1. Summary

This phase:

- Creates `src/components/panel-state.ts`, the single owner of panel storage
  keys and attributes, for the nav and the sidebar.
- Adds the pre-paint head script. Its nav line lands now; later phases add
  theirs.
- Adds a "Hide navigation" button and a pinned "Show navigation" tab at
  ≥1100px on every page.

When it ends, the nav hides and shows, the choice survives a reload with no
flash, and nothing changes below 1100px.

## 2. Requirements (this phase)

### 2.1 Functional

- FR6, FR7, FR8, FR9 in full.
- FR22, FR23 and FR24 for the module and all three keys. The sidebar keys
  are consumed in later phases.
- FR25: the nav line of the head script.
- FR1: re-asserted with the nav hidden.

### 2.2 Non-functional

- Focus moves between the hide button and the tab.
- Both are at least 44px.
- In-browser axe is clean with the nav hidden.
- `spec/invariants.test.ts` stays green: the nav landmark stays in the DOM.

### 2.3 Out of scope for this phase

- The sidebar's use of `ReqsState` (Phase 03).
- The `panel-reqs` and `panel-reqs-cols` head-script lines (Tasks 5 and 8).

### 2.4 Assumptions

See overview §2.4. Phase-specific assumptions:

- **The nav script can be a bundled Astro `<script>`,** since only clicks
  need it. The pre-paint part is the inline head script.
- **Static `aria-expanded` values are always truthful.** Each control is
  visible only in the state it describes:
  - the hide button renders only while the nav is shown, so it's always
    `true`
  - the tab renders only while it's hidden, so it's always `false`

## 3. Existing code context (verified 2026-09-27)

`src/layouts/Base.astro` (the whole file; there are no `<script>`s anywhere
in `src/pages` or `src/layouts` today):

```astro
---
import "../styles.css";

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div class="app-shell">
      <nav aria-label="site">
        <a href="/" class="brand">ANU Degree Planner</a>
        <div class="nav-links">
          <a href="/">Home</a>
          <a href="/plan/example">Example plan</a>
          <a href="/help/">Help</a>
          <a href="/readme/">Design notes</a>
        </div>
      </nav>
      <main>
        <slot />
      </main>
    </div>
  </body>
</html>
```

**Nav CSS in `src/styles.css`**

- **Base, `:201-238`:** `nav[aria-label="site"] { background: var(--ink);
  color: #fff; display: flex; … }`. Links are `rgb(255 255 255 / 0.75)`,
  and hover is `#fff` on `rgb(255 255 255 / 0.08)`.
- **Desktop, `:254-284`:** inside `@media (min-width: 1100px)`:
  - `nav[aria-label="site"] { flex-direction: column; align-items:
    flex-start; gap: 1.5rem; width: 13rem; flex: 0 0 13rem; padding: 1.5rem
    1.1rem; position: sticky; top: 0; height: 100vh; }`
  - `main { padding: 2.5rem 3rem; }`
  - `body:has(.planner) main { padding: 1.25rem 1.5rem; }`, specificity
    (0,1,2)
- **Shared:** `.visually-hidden` exists (`:177-187`). `:focus-visible` is a
  2px gold outline (`:104-107`). The base `button` styling is at `:137-157`.
- **Storage convention to match:** `src/components/Sidebar.tsx:48-69`
  (`loadCompact` and `saveCompact`, with try/catch and a comment on why not
  persisting is fine).
- **Unit tests** live beside their source as `src/components/*.test.ts` and
  run in node with no DOM (see `planner-logic.test.ts`).
- **Invariants:** `spec/invariants.test.ts` asserts `doc.querySelector("nav")`
  exists and runs axe in jsdom on the server HTML. jsdom doesn't load the
  linked CSS, so axe sees every control regardless of the CSS state.

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

`spec/layout.test.ts` already has a shared `browser` in
`beforeAll`/`afterAll` and `const baseUrl = inject("baseUrl")`.

## 4. Approach

**The tab sits outside `<nav>`,** so it stays visible when the nav is
`display: none`. It's placed just before `<nav>` in `.app-shell` and
positioned `fixed` (top 0.5rem, left 0.5rem, 2.75rem square, `z-index: 5`,
above the sticky timeline's `z-index: 2`).

- **The gutter:** `:root[data-nav="hidden"] main { padding-inline-start:
  3.75rem; }` (0.5 + 2.75 + 0.5). Its specificity (0,2,1) beats
  `body:has(.planner) main` (0,1,2).
- **The planner gets the room automatically,** because the tiers come from
  its own width.
- **Placement:** the hide button goes at the bottom of the sticky, full-height
  desktop nav (`margin-block-start: auto`), styled like a nav link.
- **Everything is gated to `@media (min-width: 1100px)`,** so below it
  neither control shows and `data-nav` has no effect.

## 5. Task breakdown

### Task 3: `panel-state.ts`, the single owner of panel keys and attributes

- [ ] **Description:** a DOM-free module (it works on any object with a
  `dataset`, and on an injected storage) that reads, applies and saves panel
  state. Types and signatures are exactly overview §4.3.
- **Files touched:**
  - `src/components/panel-state.ts` (new)
  - `src/components/panel-state.test.ts` (new)
- **Tests first (red):** in `panel-state.test.ts`, using a `fakeStorage()`
  helper backed by a `Map`, and a `throwingStorage` whose every method
  throws:
  - **`parseColumns`:**
    - `"1"`, `"2"` and `"3"` map to 1, 2 and 3.
    - `null`, `undefined`, `""`, `"0"`, `"4"`, `"2.5"` and `"two"` all
      map to 3.
  - **`reqsStateFromDataset`:**
    - `{}` gives `DEFAULT_REQS`.
    - `{ reqs: "collapsed", reqsCols: "1" }` gives `{ collapsed: true,
      columns: 1 }`.
    - `{ reqs: "yes" }` gives `collapsed: false`.
  - **`applyReqsState`** (on `{ dataset: {} as DOMStringMap }`):
    - `{collapsed: true, columns: 2}` sets `reqs: "collapsed"` and
      `reqsCols: "2"`.
    - Then `{collapsed: false, columns: 3}` deletes both keys.
  - **`saveReqsState`:**
    - It writes `panel-reqs = "collapsed"` or removes it, and always writes
      `panel-reqs-cols` as `"1"`, `"2"` or `"3"`.
    - With `throwingStorage` or `null` it doesn't throw.
  - **`setNavHidden`:**
    - `true` sets `dataset.nav = "hidden"` and stores `panel-nav =
      "hidden"`.
    - `false` deletes the attribute and removes the key.
    - It doesn't throw with `throwingStorage`.
  - **Drift guard:** read `src/layouts/Base.astro` with `readFileSync` (the
    path is relative to `process.cwd()`) and assert it contains
    `` `"${NAV_KEY}"` ``. This test **fails until Task 4** adds the head
    script, so write it in this task but expect it red until then. Task 3
    and Task 4 commit together.
- **Implementation (green):**
  - **`safeStorage()`:** `try { return window.localStorage; } catch {
    return null; }`. It also returns `null` when `typeof window ===
    "undefined"`.
  - **`parseColumns`:** returns `raw === "1" ? 1 : raw === "2" ? 2 : 3`.
  - **Writers:** `saveReqsState` and `setNavHidden` default `storage =
    safeStorage()` and wrap every call in try/catch. Copy the comment
    convention from `saveCompact`.
  - **Removing attributes:** `applyReqsState` and `setNavHidden` remove an
    attribute with `delete root.dataset.x`.
  - **Module header comment:** it owns the keys; the inline head script in
    `Base.astro` mirrors them, and the drift test keeps them in step.
- **Refactor:** none.
- **Acceptance criteria:**
  - `pnpm test:unit` passes every `panel-state` test except the drift guard,
    which is red until Task 4.
  - `astro check` is clean.
- **Depends on:** none within the phase. It needs Phase 01 only to be
  committed first.

### Task 4: Hide and show the site nav, applied before first paint

- [ ] **Description:** add the head script's nav line, the two controls, the
  click script and the ≥1100px CSS.
- **Files touched:**
  - `src/layouts/Base.astro`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** add to `spec/layout.test.ts`:
  1. **Hide, focus, persist.** At 1920×1080 on `/plan/example`:
     - `nav[aria-label="site"]` is visible, and `button.nav-show` is hidden.
     - Click `button.nav-hide`. The nav is not visible, `.nav-show` is
       visible, and `document.activeElement` is `.nav-show`.
     - `horizontalOverflow` is 0.
     - `h1.getBoundingClientRect().left >= navShow.getBoundingClientRect().right`.
     - `localStorage.getItem("panel-nav") === "hidden"`.
     - `page.reload()`: the nav is still hidden.
     - Click `.nav-show`. The nav is visible, focus is on `.nav-hide`, and
       the storage key is `null`.
  2. **No flash.** `openPage(…, 1920×1080, { storage: { "panel-nav":
     "hidden" }, blockScripts: true })` on `/help/`: the nav is not visible,
     and `.nav-show` is visible. This proves the state comes from the inline
     script plus CSS, not from bundled JS.
  3. **Ignored on small screens.** The same seeding at 390×844 on
     `/plan/example`: the nav is visible, and neither `.nav-hide` nor
     `.nav-show` is visible.
  4. **Axe while hidden.** At 1920×1080 on `/plan/example` with the nav
     hidden by seeding, `axeViolations(page)` equals `[]`.
  5. **Room for a wider tier.** At 1440×900 with the nav hidden by seeding,
     the aside's `offsetWidth` is 715 (3 columns). The planner widens from
     74rem to about 84rem.

  Tests 1–5 fail, and Task 3's drift guard is also red.
- **Implementation (green):**
  - **`Base.astro` head:** after the viewport `<meta>`, add the overview
    §4.2 script, **only the comment and the `panel-nav` line** inside the
    `try`, using `var` (it's `is:inline`, so it isn't transpiled).
  - **`Base.astro` body:**
    - Before `<nav>`, add `<button type="button" class="nav-show"
      aria-controls="site-nav" aria-expanded="false"><svg
      class="nav-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"
      focusable="false"><path d="m9 6 6 6-6 6" /></svg><span
      class="visually-hidden">Show navigation</span></button>`.
    - Give `<nav>` the id `site-nav`.
    - After `.nav-links`, add `<button type="button" class="nav-hide"
      aria-controls="site-nav" aria-expanded="true"><svg …><path d="m15 6-6
      6 6 6" /></svg>Hide navigation</button>`.
    - Add a bundled `<script>` at the end of `<body>`:
      ```ts
      import { setNavHidden } from "../components/panel-state";
      const root = document.documentElement;
      const show = document.querySelector<HTMLButtonElement>(".nav-show");
      const hide = document.querySelector<HTMLButtonElement>(".nav-hide");
      hide?.addEventListener("click", () => { setNavHidden(root, true); show?.focus(); });
      show?.addEventListener("click", () => { setNavHidden(root, false); hide?.focus(); });
      ```
      Add a comment on why focus moves.
  - **`styles.css`** (in the shell section):
    - `.nav-show, .nav-hide { display: none; }`
    - Inside the existing `@media (min-width: 1100px)` block:
      - **`.nav-hide`:** `display: inline-flex; align-items: center; gap:
        0.35rem; margin-block-start: auto; min-height: 2.75rem`, styled like
        `.nav-links a`: transparent background, no border,
        `rgb(255 255 255 / 0.75)` text, the same hover.
      - **Hide the nav:** `:root[data-nav="hidden"] nav[aria-label="site"]
        { display: none; }`
      - **`:root[data-nav="hidden"] .nav-show`:** `display: inline-flex;
        align-items: center; justify-content: center; position: fixed; top:
        0.5rem; left: 0.5rem; z-index: 5; width: 2.75rem; height: 2.75rem;
        padding: 0; background: var(--ink); color: #fff; border-color:
        var(--ink)`
      - **The gutter:** `:root[data-nav="hidden"] main {
        padding-inline-start: 3.75rem; }`, with a comment that it's the
        tab's width plus 0.5rem on each side.
    - `.nav-toggle-icon { width: 1rem; height: 1rem; fill: none; stroke:
      currentColor; stroke-width: 2.5; stroke-linecap: round;
      stroke-linejoin: round; }`
- **Refactor:** none.
- **Acceptance criteria:**
  - Every Task 3 and Task 4 test is green.
  - `pnpm check` passes, including invariants on all four routes.
  - Render check at 1920×1080 with the nav shown and hidden, and at 390×844.
  - Commit (Tasks 3 and 4 together): "Let the site nav be hidden behind a
    pinned tab, remembered per browser".
- **Human review:** screenshots at 1920×1080 of `/plan/example` and `/help/`
  with the nav hidden, plus the hide button in the shown nav. A pass means:
  - The tab reads as subtle but unmistakably clickable.
  - It never covers content.
  - The hide button looks like it belongs in the nav.

  The user accepts explicitly.
- **Depends on:** Task 3.

## 6. Phase Definition of Done

- [ ] Tasks 3–4 complete, with their tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] One commit covering Tasks 3 and 4
- [ ] Task 4's human review accepted by the user
- [ ] Tick Phase 02 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR6 | Task 4, test 1 |
| FR7 | Task 4, tests 1–2 |
| FR8 | Task 4, test 1 (h1 vs tab) |
| FR9 | Task 4, test 3 |
| FR22–24 | Task 3 |
| FR25 (nav) | Task 4, test 2; Task 3 drift guard |
| FR1 (nav hidden) | Task 4, test 1 |
| NFR a11y | Task 4, tests 1 and 4 |

## 8. Risks / open questions

None.
