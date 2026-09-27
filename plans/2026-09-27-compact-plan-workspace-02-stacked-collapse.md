# Compact plan workspace — Phase 02: Collapsible requirements in the stacked layout

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-27-compact-plan-workspace-00-overview.md`. Read
  these sections first:
  - §2.1 D and E (FR15, FR29)
  - §2.2 N1–N3
  - §2.4, especially the toast ruling and the bar-fill ruling
  - §3
  - §4.1–4.4, especially the §4.3 cascade order
- **Depends on phases:** none in this set. It builds on the finished
  collapsible-panels feature.

## 1. Summary

In the stacked layout, the requirements get a "Hide requirements" button
and collapse to a bar along the bottom of the planner. The bar shows
progress, restores on activation and stays a drop target. The collapsed
state is the same `panel-reqs` key the desktop rail uses. The undo toast
lifts above the bar while it's showing. The phase ends with two commits.

## 2. Requirements (this phase)

### 2.1 Functional

- CW15: the button part. The split's Collapsed stop comes in Phase 03.
- CW16, CW18, CW19, CW20 and CW21 in full.
- CW17: expanding to 50%. Restoring a saved 30 or 70 is Phase 03, since the
  split doesn't exist yet.
- CW22 in full (Task 5).
- FR15 is replaced; FR29's collapsed clause ("all of it but the collapsed
  bar").

### 2.2 Non-functional

- N1: no overflow either way at 390×844 collapsed, with the nav shown and
  hidden.
- N2: the stacked "Hide requirements" and the bar are each at least 44px
  tall.
- N3: axe is clean at 390×844 collapsed.
- N5: no animation.

### 2.3 Out of scope for this phase

- The stacked split handle, the `panel-split` key and restoring a saved
  ratio (Phase 03).
- The row and the title (Phase 01).

### 2.4 Assumptions

See overview §2.4. Phase-specific assumptions:

- The stacked aside stays a block container. The button is right-aligned
  with `width: fit-content; margin-inline-start: auto`, so the horizontal
  `.requirements-scroll` below it isn't turned into a shrinkable flex item.
- The stacked "Hide requirements" chevron (the same `m15 6-6 6 6 6` path)
  is rotated to point down: the pane tucks away toward the bottom.

## 3. Existing code context (verified 2026-09-27, at `12059d6`)

**`src/components/Sidebar.tsx`: the aside, the collapse button and the
rail** (inside `Sidebar()`; `completedPct`/`plannedPct` come from
`progressSegments(view.total.completed, view.total.planned,
view.total.required)`)

```tsx
    <aside
      id="requirements"
      aria-label="requirements"
      class={dropReady ? "reqs-drop-ready" : undefined}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { … onDropRemove(code); }}
    >
      <button type="button" class="reqs-hide" ref={hideRef} aria-controls="requirements-content" aria-expanded="true"
        onClick={() => { onHide(); railRef.current?.focus(); }}>
        <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Hide requirements
      </button>
      <button type="button" class="reqs-rail" ref={railRef} aria-controls="requirements-content" aria-expanded="false"
        onClick={() => { onShow(); hideRef.current?.focus(); }}>
        {/* One span for the whole name: … */}
        <span class="visually-hidden">
          Show requirements: {view.total.completed} completed, {view.total.planned} planned of {view.total.required}
        </span>
        <span class="reqs-rail-label" aria-hidden="true">
          Requirements
        </span>
        <span class="reqs-rail-bar" aria-hidden="true">
          <span class="reqs-rail-completed" style={{ height: `${completedPct}%` }} />
          <span class="reqs-rail-planned" style={{ height: `${plannedPct}%`, insetBlockEnd: `${completedPct}%` }} />
        </span>
      </button>
      <ul class="requirements-scroll" id="requirements-content"> … </ul>
    </aside>
```

**Touch dropping** already resolves through the aside, so the bar is a
touch drop target by construction. From `src/components/touch-drag.ts:58`:
`if (el?.closest("aside[aria-label='requirements']")) return { kind:
"remove" };`, where `el = document.elementFromPoint(x, y)`.

**`src/components/Planner.tsx`**

- `const [reqs, setReqs] = useState<ReqsState>(DEFAULT_REQS);`
- A `useEffect` syncs `reqs` from `document.documentElement.dataset`.
- `function updateReqs(next: ReqsState, commit: boolean)` calls `setReqs`
  and `applyReqsState(document.documentElement, next)`, then
  `saveReqsState(next)` if `commit`.
- It renders:
  - `<div class="planner-panes">` containing the timeline area, then
    `<Sidebar … onHide={() => updateReqs({ ...reqs, collapsed: true },
    true)} onShow={() => updateReqs({ ...reqs, collapsed: false }, true)}
    … />`, then `<ReqsResizeHandle reqs={reqs} onChange={updateReqs} />`
  - after `.planner-layout`: `{removed && (<div class="undo-toast"
    role="status"> … </div>)}`

**`src/components/ReqsResizeHandle.tsx`**, current, to be changed by Task 5:

```tsx
import { useEffect, useRef, useState } from "preact/hooks";
import type { ReqsColumns, ReqsState } from "./panel-state";
import { parseFit, sizeLabel, sizeOf, snapSize, stateFor, stepSize } from "./reqs-resize";

interface Props {
  reqs: ReqsState;
  onChange: (next: ReqsState, commit: boolean) => void;
}

export default function ReqsResizeHandle({ reqs, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts at 3 so the server render and the first client render agree; the
  // observer below corrects it once the panes have a real width.
  const [fit, setFit] = useState<0 | ReqsColumns>(3);
  const dragging = useRef(false);
  const latest = useRef(reqs);
  if (!dragging.current) latest.current = reqs;

  // The CSS tiers already decide how many columns fit and publish it as
  // --reqs-fit on the panes, so reading it back keeps CSS the single source
  // of truth rather than repeating the tier thresholds here.
  useEffect(() => {
    const panes = ref.current?.parentElement;
    if (!panes) return;
    const read = () => setFit(parseFit(getComputedStyle(panes).getPropertyValue("--reqs-fit")));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(panes);
    return () => observer.disconnect();
  }, []);

  // The handle is hidden by CSS in the stacked layout (fit 0), so this only
  // keeps the ARIA values in range there.
  const fitCols: ReqsColumns = fit === 0 ? 1 : fit;
  const size = sizeOf(reqs, fitCols);
  // … onPointerDown / onPointerMove / endDrag / onKeyDown, then the
  // <div ref={ref} class="reqs-resize" role="separator" …> element
}
```

`parseFit(raw: string): 0 | ReqsColumns` comes from
`src/components/reqs-resize.ts`.

**`src/styles.css`**

The rail rules (lines 426–484):

```css
/* The collapse controls only exist in the side-by-side layout (see the
   last @container block); the stacked strip has nothing to collapse into. */
.reqs-hide,
.reqs-rail {
  display: none;
}
.reqs-hide { align-self: flex-end; position: sticky; top: 0; z-index: 1; margin-block-end: 0.5rem; min-height: 2.75rem; }
.reqs-rail { flex-direction: column; align-items: center; gap: 0.75rem; width: 100%;
  min-height: min(24rem, calc(100vh - 2rem)); padding: 0.9rem 0; background: var(--surface);
  border: 1px solid var(--line); border-radius: 0.9rem; }
.reqs-rail-label { writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 600; color: var(--ink); }
.reqs-rail-bar { position: relative; width: 0.5rem; flex: 1 1 auto; min-height: 6rem; border-radius: 999px;
  background: var(--line); overflow: hidden; }
.reqs-rail-completed, .reqs-rail-planned { position: absolute; inset-inline: 0; inset-block-end: 0; }
.reqs-rail-completed { background: var(--gold); }
.reqs-rail-planned { background: var(--gold-tint); }
```

The fit group's stacked part (inside `@media (min-height: 30rem)`):

```css
  @container planner (width < 49.5rem) {
    .planner-timeline-area { position: static; flex: 0 1 auto; max-height: 50%; }
    .planner-panes > aside { flex: 1 1 0; min-height: 0; overflow-y: auto; }
  }
```

The side-by-side collapsed block is the **last** block in the file. It's
`@container planner (min-width: 49.5rem)`, and contains `.reqs-hide {
display: inline-flex; … }` and `:root[data-reqs="collapsed"] …` rules for
the aside, `.requirements-scroll`, `.reqs-hide` and `.reqs-rail`. It ends
with:

```css
  :root[data-reqs="collapsed"] .reqs-drop-ready .reqs-rail {
    outline: 2px dashed var(--gold);
    outline-offset: -4px;
    background: var(--gold-tint);
  }
}
```

`.undo-toast { position: fixed; left: 50%; bottom: 1.5rem; transform:
translateX(-50%); z-index: 10; … }` (around line 722). On the plan page,
`main`'s padding is `1.25rem` below 1100px (`body:has(.planner) main`).

**`spec/layout.test.ts`**

`describe("requirements sidebar collapse")` has this test, which CW19/CW21
supersede (FR15 is replaced):

```ts
  it.each([
    [390, 844],
    [800, 800],
  ])("ignores the saved state in the stacked layout at %i×%i", async (width, height) => {
    const page = await openPage(browser, planUrl(), { width, height }, reqsCollapsed);
    try {
      expect(await page.locator(".requirements-scroll").isVisible()).toBe(true);
      expect(await page.locator(".reqs-rail").isVisible()).toBe(false);
      expect(await page.locator(".reqs-hide").isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  });
```

- `describe("requirements rail as a drop target")` defines `async function
  planWithPlacement(code: string): Promise<string>` inside it. If Phase 01
  Task 1 has already run, it's at module scope.
- `describe("plan page fits the screen")` has an `it.each` of `[width,
  height, storage]` rows, titled "at %i×%i with %o the page doesn't scroll
  either way".
- `describe("requirements resize handle")` (Phase 05) covers the fit cap:
  `aria-valuemax` 2 at 1280×800 and 1 at 1100×800. It's the safety net for
  Task 5's refactor.
- Example-plan totals: "48 completed, 144 planned of 192", so completed is
  25% and planned 75%.

### Interfaces from earlier phases (exact)

None from this set. The collapsible-panels signatures used are:

- `ReqsState`, `ReqsColumns`, `DEFAULT_REQS` and `applyReqsState` from
  `src/components/panel-state.ts`
- `parseFit` from `src/components/reqs-resize.ts`

All are quoted above.

## 4. Approach

**Collapsed stacked is the rail, laid out as a row.** It's the same `<button
class="reqs-rail">`, so the accessible name, the focus hand-off, the
drop-target behaviour (it's inside the aside) and the `panel-reqs` key all
come for free. The CSS decides which way it's drawn.

The fill moves to custom properties on `.reqs-rail-bar` (`--completed`,
`--planned`). Side-by-side, CSS maps them to `height`/`inset-block-end`;
stacked, to `width`/`inset-inline-start`.

**The new stacked rules go last** (overview §4.3). They're
`@container planner (width < 49.5rem)`, and not height-gated, so collapsing
works at every height (CW21). One more block, wrapped in `@media
(min-height: 30rem)`, lets the fitted timeline grow into the freed height.

**The toast (Task 5).** A container query only matches descendants of the
container, and `.undo-toast` has to live outside `.planner-layout` (a
container would become the containing block for the fixed toast). So CSS
can't know the layout is stacked. `Planner` takes over the `--reqs-fit`
observer (`useReqsFit`), passes `fit` down to the handle, and adds
`undo-toast-above-bar` to the toast when `fit === 0 && reqs.collapsed`.

## 5. Task breakdown

### Task 4: Let the stacked requirements collapse to a bar along the bottom of the planner

- [x] **Description:** show "Hide requirements" in stacked, draw the
  collapsed rail as a bottom bar, move the fill to CSS variables, and
  replace the superseded Phase 03 test.
- **Files touched:**
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red),** in `spec/layout.test.ts`:
  - **Replace** the "ignores the saved state in the stacked layout" test
    (superseded by CW19/CW21, since FR15 is replaced). The replacement is
    "applies the saved collapsed state in the stacked layout at %i×%i",
    for `[390, 844]` and `[800, 800]` with `reqsCollapsed`:
    - `.reqs-rail` is visible
    - `.requirements-scroll` and `.reqs-hide` aren't visible
  - **If `planWithPlacement` is still inside its `describe`,** move it to
    module scope, unchanged.
  - **New `describe("stacked requirements collapse")`:**
    1. **Collapse and expand at 390×844 on `/plan/example`.**
       - `button.reqs-hide` is visible, with `boundingBox().height ≥ 44`.
       - Click it. Then:
         - `.reqs-rail` is visible and focused
         - `.requirements-scroll` isn't visible
         - `localStorage["panel-reqs"]` is `"collapsed"`
         - the rail's box has `height ≥ 44` and `width > height`
         - `|aside.bottom − panes.bottom| ≤ 1`
         - `timeline.height ≥ panes.height − aside.height − 17`
         - `horizontalOverflow` and `verticalOverflow` are 0
         - the rail matches `getByRole("button", { name: /^Show
           requirements: \d+ completed, \d+ planned of 192$/ })`
       - Click the rail. Then:
         - `.requirements-scroll` is visible
         - `.reqs-hide` is focused
         - `panel-reqs` is `null`
    2. **No flash.** At 390×844, with `{ storage: { "panel-reqs":
       "collapsed" }, blockScripts: true }`: the rail is visible and
       `.requirements-scroll` isn't.
    3. **The fill follows the progress,** with `panel-reqs` seeded
       collapsed:
       - At 1920×1080, `.reqs-rail-completed`'s height ÷ `.reqs-rail-bar`'s
         height is within 0.02 of 0.25.
       - At 390×844, the same ratio using widths is within 0.02 of 0.25.
    4. **Drop target.** Create a plan with `planWithPlacement("COMP1130")`
       and open it at 390×844 with `panel-reqs` seeded collapsed.
       - Hover `[data-placed="COMP1130"]`, then `mouse.down()`, then move
         to the rail's centre (`steps: 10`). Then:
         - `aside.reqs-drop-ready` count is 1
         - `getComputedStyle(rail).outlineStyle` is `"dashed"`
         - `page.evaluate` of `!!document.elementFromPoint(x,
           y)?.closest("aside[aria-label='requirements']")` at the rail's
           centre is `true` (the touch path)
       - `mouse.up()`, then `expect.poll` of the card count is 0.
    5. **Unfitted height (CW21).** At 700×400:
       - `button.reqs-hide` is visible
       - clicking it shows `.reqs-rail`, and `panel-reqs` is `"collapsed"`
    6. **Axe.** At 390×844 with `panel-reqs` seeded collapsed,
       `axeViolations` equals `[]`.
  - **Fit rows.** Add these rows to the "the page doesn't scroll either
    way" `it.each`:
    - `[390, 844, { "panel-reqs": "collapsed" }]`
    - `[390, 844, { "panel-reqs": "collapsed", "panel-nav": "hidden" }]`
- **Implementation (green):**
  - **`Sidebar.tsx`:** the fill moves onto the bar as custom properties,
    and the inner spans lose their `style`:

    ```tsx
    <span class="reqs-rail-bar" aria-hidden="true" style={`--completed: ${completedPct}%; --planned: ${plannedPct}%`}>
      <span class="reqs-rail-completed" />
      <span class="reqs-rail-planned" />
    </span>
    ```

    Add a comment: the rail draws the fill vertically and the stacked bar
    horizontally, from the same two numbers.
  - **`styles.css`:**
    - Add `--reqs-bar-h: 2.75rem;` to `:root`, after `--timeline-min`, with
      the comment "The collapsed stacked requirements bar."
    - Rewrite the comment above `.reqs-hide, .reqs-rail { display: none;
      }`: the collapse controls are shown by the collapsed blocks at the
      end of the planner section, one per layout.
    - Change the fill rules to:
      - `.reqs-rail-completed { background: var(--gold); height:
        var(--completed); }`
      - `.reqs-rail-planned { background: var(--gold-tint); height:
        var(--planned); inset-block-end: var(--completed); }`
    - **Append, after the side-by-side collapsed block** (so these are the
      last rules in the planner section), with a comment that the stacked
      requirements collapse to a bar along the bottom:

      ```css
      @container planner (width < 49.5rem) {
        .reqs-hide {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          width: fit-content;
          margin-inline-start: auto;
        }

        /* Points down: the requirements tuck away toward the bottom. */
        .reqs-hide .section-toggle-icon {
          transform: rotate(-90deg);
        }

        :root[data-reqs="collapsed"] .planner-panes > aside {
          flex: 0 0 auto;
          min-height: 0;
          overflow: visible;
        }

        :root[data-reqs="collapsed"] .requirements-scroll,
        :root[data-reqs="collapsed"] .reqs-hide {
          display: none;
        }

        :root[data-reqs="collapsed"] .reqs-rail {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 0.75rem;
          min-height: var(--reqs-bar-h);
          padding: 0 1rem;
        }

        :root[data-reqs="collapsed"] .reqs-rail-label {
          writing-mode: horizontal-tb;
          transform: none;
        }

        :root[data-reqs="collapsed"] .reqs-rail-bar {
          width: auto;
          height: 0.5rem;
          min-height: 0;
        }

        :root[data-reqs="collapsed"] .reqs-rail-completed,
        :root[data-reqs="collapsed"] .reqs-rail-planned {
          inset-block: 0;
          inset-inline-end: auto;
          height: auto;
        }

        :root[data-reqs="collapsed"] .reqs-rail-completed {
          inset-inline-start: 0;
          width: var(--completed);
        }

        :root[data-reqs="collapsed"] .reqs-rail-planned {
          inset-inline-start: var(--completed);
          width: var(--planned);
        }

        :root[data-reqs="collapsed"] .reqs-drop-ready .reqs-rail {
          outline: 2px dashed var(--gold);
          outline-offset: -4px;
          background: var(--gold-tint);
        }
      }

      /* In the fitted page, the timeline takes the height the requirements gave up. */
      @media (min-height: 30rem) {
        @container planner (width < 49.5rem) {
          :root[data-reqs="collapsed"] .planner-timeline-area {
            flex: 1 1 auto;
            max-height: none;
          }
        }
      }
      ```

    - Update the side-by-side collapsed block's leading comment: "must stay
      last" becomes "the collapsed blocks must stay last, side-by-side
      first, then stacked".
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests 1–6 and the new fit rows pass.
  - Every existing rail test in `describe("requirements sidebar collapse")`
    and `describe("requirements rail as a drop target")` still passes.
  - `pnpm check` passes.
  - Render check at 1920×1080 (collapsed rail still vertical and filled),
    900×800 and 390×844 (expanded and collapsed).
  - Commit: "Let the stacked requirements collapse to a bar along the
    bottom of the planner".
- **Human review:** screenshots at 390×844:
  - expanded, showing the "Hide requirements" button
  - collapsed, showing the bar
  - mid-drag of a placed course over the bar, showing the drop-ready
    highlight
  - 1920×1080 collapsed, to confirm the rail is unchanged

  A pass means:
  - the button is findable but doesn't crowd the requirements
  - the bar reads as "the requirements, put away", with progress legible
  - the drop highlight is obvious

  The user accepts explicitly.
- **Depends on:** none.

### Task 5: Keep the undo toast above the stacked requirements bar

- [ ] **Description:** move the `--reqs-fit` observer into a `useReqsFit`
  hook owned by `Planner`, pass `fit` to the handle, and raise the toast
  while the stacked bar shows.
- **Files touched:**
  - `src/components/reqs-fit.ts` (new)
  - `src/components/ReqsResizeHandle.tsx`
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red),** in a new `describe("undo toast placement")`:
  1. **Stacked and collapsed.** Create a plan with
     `planWithPlacement("COMP1130")` and open it at 390×844 with
     `panel-reqs` seeded collapsed.
     - Drag `[data-placed="COMP1130"]` onto the rail's centre and release.
     - `expect.poll` of `.undo-toast`'s count is 1.
     - Then the toast's `boundingBox()` bottom is ≤ the rail's
       `boundingBox()` y.
  2. **Unchanged elsewhere.** The same drop-and-poll, then
     `getComputedStyle(toast).bottom` is `"24px"`:
     - at 1920×1080 with `panel-reqs` collapsed, dropping on `.reqs-rail`
     - at 390×844 expanded, dropping on `aside[aria-label="requirements"]`
- **Implementation (green):**
  - **`src/components/reqs-fit.ts`** (new):

    ```ts
    import type { RefObject } from "preact";
    import { useEffect, useState } from "preact/hooks";
    import type { ReqsColumns } from "./panel-state";
    import { parseFit } from "./reqs-resize";

    export function useReqsFit(panesRef: RefObject<HTMLElement>): 0 | ReqsColumns;
    ```

    - The body moves the handle's observer across verbatim, reading
      `panesRef.current` instead of `ref.current?.parentElement`.
    - The initial state is `3`.
    - Carry over the handle's two comments: why it starts at 3, and why it
      reads `--reqs-fit`.
    - Add one sentence: the fit lives in `Planner` because the undo toast,
      outside the size container, needs it too.
  - **`ReqsResizeHandle.tsx`:**
    - `interface Props { reqs: ReqsState; fit: 0 | ReqsColumns; onChange:
      (next: ReqsState, commit: boolean) => void }`.
    - Delete the `useState` fit, its `useEffect`, the `ref`/`ref={ref}`
      (now unused) and the `parseFit` import. Everything else is unchanged.
  - **`Planner.tsx`:**
    - Add `const panesRef = useRef<HTMLDivElement>(null);` and `const fit =
      useReqsFit(panesRef);`.
    - Change to `<div class="planner-panes" ref={panesRef}>` and
      `<ReqsResizeHandle reqs={reqs} fit={fit} onChange={updateReqs} />`.
    - The toast becomes `<div class={fit === 0 && reqs.collapsed ?
      "undo-toast undo-toast-above-bar" : "undo-toast"} role="status">`.
  - **`styles.css`,** after the `.undo-toast` rules:
    - `.undo-toast-above-bar { bottom: calc(1.25rem + var(--reqs-bar-h) +
      0.75rem); }`
    - A comment: 1.25rem is `main`'s bottom padding on the plan page, so
      this clears the collapsed stacked bar, the drop target just used, by
      0.75rem. The class comes from `Planner`, because no container query
      reaches the toast.
- **Refactor:** none beyond the move.
- **Acceptance criteria:**
  - Tests 1–2 pass.
  - Every `describe("requirements resize handle")` test still passes: the
    fit cap still works after the move.
  - `pnpm check` passes.
  - Render check at 1920×1080, 900×800 and 390×844. Also screenshot the
    390×844 collapsed toast.
  - Commit: "Keep the undo toast above the collapsed stacked requirements
    bar".
  - Log the container-query finding to `PROCESS_LOG.md` if it qualifies
    (overview §3), citing this commit.
- **Depends on:** Task 4 (the bar and `--reqs-bar-h`).

## 6. Phase Definition of Done

- [ ] Tasks 4–5 complete, with their tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Two commits, one per task
- [ ] Task 4's human review accepted by the user
- [ ] Tick Phase 02 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CW15 (button) | Task 4: test 1 |
| CW16 | Task 4: tests 1 and 3 |
| CW17 (to 50) | Task 4: test 1 |
| CW18 | Task 4: test 4 |
| CW19 | Task 4: the replaced test, tests 1–2 |
| CW20 | Task 4: test 1 |
| CW21 | Task 4: test 5 |
| CW22 | Task 5: tests 1–2 |
| FR15 (replaced) | Task 4: the replaced test |
| FR29 (collapsed clause) | Task 4: test 1 |
| N1 | Task 4: fit rows, test 1 |
| N2 | Task 4: test 1 |
| N3 (collapsed) | Task 4: test 6 |

## 8. Risks / open questions

None.
