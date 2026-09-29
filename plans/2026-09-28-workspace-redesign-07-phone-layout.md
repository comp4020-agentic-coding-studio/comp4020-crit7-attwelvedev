# Workspace redesign — Phase 07: phone tabs and bottom sheet

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read §3,
  §4.2 (`LayoutResult.details.mode === "sheet"`) and §4.4 (phone
  threshold).
- **Depends on phases:** 02 and 06.

## 1. Summary

Below the phone threshold (a planner container under 49.5rem):
- A floating, frosted Timeline / Requirements tab bar shows one region at a
  time. It replaces the stacked split, its handle, the stacked "Hide
  requirements" button and the collapsed bar (CW10–CW22).
- Course details open in a bottom sheet with three heights: peek, half and
  full. You change the height by tapping the handle or by dragging it.
- Remove is available from the sheet and the ⋯ menu.
- `panel-split` and `split-resize.ts` are retired, which completes WR40.

## 2. Requirements (this phase)

### 2.1 Functional

- WR43, WR44, WR45: all.
- WR40: retiring `panel-split`.

### 2.2 Non-functional

- axe is clean at 390×844 on each tab, and with the sheet at each height.
- No vertical page scroll on the fitted page.
- Controls are at least 44px, including each tab, the handle and the sheet
  buttons.
- Motion: height changes animate over 250ms, and are instant under reduced
  motion.
- The card-height budget's phone rule still passes, measured on the
  Timeline tab. **Restore it in full here.** Phase 05 (Task 15, ruled
  2026-09-29) relaxed it to "the first card fits" while the stacked split
  held the timeline to half the screen under a 30px sticky year band. On
  the full-height Timeline tab, the second card's `.course-card-head` must
  fit again. Put back the assertion that Phase 05 removed from
  plan-header-and-fit's "card height budget" test, which now reads "the
  first card fits … (the second's code line returns in Phase 07)".
  **Ruled 2026-09-29 (Phase 1 review):** the budget's bottom edge is
  `min(.planner-timeline-area bottom, .tabbar top)`, because the floating
  tab bar covers the region's foot.

### 2.2a Execution rulings (Phase 1 review, 2026-09-29)

- The browser specs are split by area. The new describes ("phone tabs"
  and "details sheet") go in a new `spec/layout/phone-layout.test.ts`.
  Retired cases leave `requirements-panel.test.ts`,
  `plan-header-and-fit.test.ts` and `undo.test.ts`.
- Other phone specs that use Requirements get a switch to the
  Requirements tab where their guarantee still holds, and are deleted
  where it's gone. No assertion is loosened.
- The saved fold doesn't apply on phones. In stacked mode
  `showInSidebar` switches tab and never unfolds the saved preference.
- Only the explicit "Locate on timeline" callers (`onLocateCourse`)
  switch to Timeline. The locate that `openDetails` fires doesn't.
- `reqs-hide` and `reqs-rail` stay in `Sidebar` for side-by-side, and
  aren't displayed in stacked mode.
- The sheet's pill after Remove is the app's real text, "Not in your
  plan" (Task 21's "Not planned" meant this).
- **Handle semantics (ruled 2026-09-29, Task 21).** axe rejects
  `aria-valuetext` on a plain `<button>` (`aria-allowed-attr`), so the
  handle is `<button class="sheet-handle" role="slider">`, with
  `aria-orientation="vertical"`, `aria-valuemin` 0, `aria-valuemax` 2,
  `aria-valuenow` 0/1/2 and `aria-valuetext` "Peek" / "Half height" /
  "Full height". A tap, Enter or Space cycles the heights (`nextDetent`),
  and ↑/↓ step one height without wrapping.
- **Sheet geometry (amended in Task 21's human review, 2026-09-29).** The
  user asked for this, deliberately drifting from the mockup. The regions
  still run under the floating tab bar, because the frosted content
  beneath it is worth the dead space on a dense small screen. The sheet
  follows them:
  - **Peek and half:** on the region's own 1.25rem side and bottom insets
    and radius. The tab bar (z-index 41, above details at 40, below the
    palette at 42) floats over the sheet's foot, and the sheet's end
    padding and scroll padding keep content clear of it.
  - **Full:** 8px in from every edge, all corners round, over the tab bar,
    which fades out.
  - **Heights** (`sheet-detent.ts`, mirrored in CSS): peek `PEEK_PX` =
    204, which is the 151px header plus the bar's 42px overlap and a gap;
    half is 0.56 × the viewport; full is the viewport less 16.
  - **The peek** hides the pills and the footer, and shows the button
    row, the code and the title.
  - **The handle** is absolutely centred in the header's button row.
  - **The header** keeps the desktop panel's padding.
  - **Scrollbar gutter:** the sheet drops `scrollbar-gutter: stable`.
    With the gutter, the local background stopped short of the header's
    inline-end padding and the page showed through it.
  - **This supersedes §4's "8px from the sides, bottom at tab bar + 8px",
    the 148px peek, and "full: 100% − 8px, square bottom corners".**

### 2.3 Out of scope for this phase

- Dropping onto Requirements on phones (spec §2.3).
- Landscape-specific layouts beyond what the container rule gives.

### 2.4 Assumptions

See overview §2.4.

Phase-specific:
- The tab choice is page state only and isn't saved; it starts on
  Timeline.
- The height choice isn't saved either. It starts at "half" whenever a
  course opens.
- The site nav's own top bar below 1100px (collapsible-panels Unit 2) is
  untouched.

## 3. Existing code context (verified 2026-09-28)

**Stacked layout CSS** (`src/styles.css`)
- The split is `flex-basis` 50%, 30% or 70% (about :2119-2178), driven by
  `html[data-split]`.
- The stacked collapsed bar is about :2250-2330. It reuses `button.reqs-rail`
  as a bottom bar at least 44px tall, and `--reqs-bar-h: 2.75rem`.
- `@media (min-height: 30rem)` fits the page to the viewport (:1987).
- Outside side-by-side, `.requirements-scroll` is a horizontal strip
  (:717) with 17rem groups.

**Components**
- `ReqsResizeHandle.tsx`, stacked-only after Phase 06: props `{ reqs:
  ReqsState; split: SplitStop; onChange(next: Panels, commit: boolean) }`.
- `split-resize.ts`: `SplitSize`, `SPLIT_SIZES`, `Panels`, `splitSizeOf`,
  `panelsFor`, `snapSplit`, `stepSplit`, `splitLabel`.
- `panel-state.ts`: `SPLIT_KEY="panel-split"`, `SplitStop`,
  `DEFAULT_SPLIT`, `parseSplit`, `applySplit`, `saveSplit`.
- `Base.astro`'s head script still reads `panel-split` into
  `html[data-split]`.
- `Sidebar.tsx`:
  - `button.reqs-hide` (the stacked "Hide requirements").
  - `button.reqs-rail` (the rail or bar; name "Show requirements: X
    completed, Y planned of Z").
  - `aside#requirements[aria-label="requirements"]`, the touch-drag remove
    target.
- `Planner.tsx`: the `undo-toast-above-bar` class when stacked and
  collapsed. After Phase 06 the check is `layout.mode === "stacked" &&
  reqs.collapsed`.

**Tests to rewrite or retire**
- `spec/layout.test.ts`:
  - "stacked requirements collapse" (:1191)
  - the stacked-axis cases in the "workspace dividers" suite, which were
    the old resize-handle suite's split cases
  - "undo toast placement" (:1317)
  - "plan page fits the screen" (:375), for the phone cases
  - "card height budget" (:3520), phone rule: term 0's first card, and the
    second card's `.course-card-head`, are inside `.planner-timeline-area`
- `src/components/split-resize.test.ts`.
- `panel-state.test.ts`, for the split keys and the head-script sync.
- Touch-drag tests near :1081 and :1127. The :1081 test drags a
  Requirements card (COMP3630) onto a term at 390×844. With tabs, that only
  works if a drag from the Requirements tab switches to the Timeline (this
  file's §4).

### Interfaces from earlier phases (exact)

From Phase 02:

```ts
// CourseDetailsPanel: <aside class="details-panel" aria-label="Course details">,
// props include onRemove(): void, onClose(): void; Remove button text "Remove from plan"
```

From Phase 05:
- The `.glass` utility, and the panel's sticky header `.details-head.glass`
  (Task 13). The allowlist already includes `.tabbar` and `.sheet-head`.
- The timeline (Task 15, as built after its review on 2026-09-29):
  - `.timeline-scroll` is the timeline's only scroller, in both axes.
    `.planner-timeline-area` is a region that doesn't scroll (a flex
    column with `overflow: hidden`), and the toolbar and legend sit fixed
    above the scroller.
  - It's a one-row grid of `div.timeline-year[data-year]`, each placed in
    its column explicitly. Each year is a sticky transparent
    `.timeline-year-head` (the label's row plus its terms' sticky
    `.term-top` rows), then two `section.term[data-term]`.
  - A term is a 13rem card plus `--term-pad` (0.5rem) either side. The
    region has no inner gutter, and the scroller's ends are padded by
    `--edge` (0.5rem). `--year-band` is 2.75rem, or 1.9rem below the
    49.5rem container.
  - The frosted header is one element, `div.timeline-glass.glass`, which
    shares the years' grid row. It's sticky on both axes and `100cqi`
    wide, since `.timeline-scroll-wrap` is an inline-size container. It
    never scrolls sideways because Chromium blurred only the part of a
    scroll-wide strip that was on screen at first paint. The hairlines
    are `::after` lines drawn over it. In the glass allowlist,
    `.timeline-glass` replaces `.timeline-year-head`.
  - `--timeline-min` (31rem) is unchanged. Two terms and their padding
    now come to about 28rem, so it has slack.
  - The ‹ › buttons (`.timeline-toolbar`) float over the band's right end,
    and are hidden below 49.5rem.
  - The gold cutoff line is gone. Completed terms say "Completed" in their
    headings.
- The phone card-height budget is relaxed to "the first card fits"
  (plan-header-and-fit). §2.2 says to restore it here.

From Phase 06, Tasks 16–18:

```ts
export interface LayoutResult {
  mode: "side-by-side" | "stacked";
  reqsPx: number | "rail";
  details: { mode: "docked"; px: number } | { mode: "drawer"; px: number } | { mode: "sheet" } | { mode: "closed" };
  autoFolded: boolean;
  timelinePx: number;
}
// Planner: const layout = computeLayout({...}); the panel receives data-mode={layout.details.mode}
```

## 4. Approach

**Tabs.**
- `Planner` holds `tab: "timeline" | "requirements"`, and sets
  `data-tab` on `.planner-layout` when `layout.mode === "stacked"`.
- CSS shows only the matching region.
- `nav.tabbar.glass` has `aria-label="Plan view"` and two `button`s with
  `aria-pressed`: "Timeline" and "Requirements". It's fixed at the bottom
  centre, and its bottom padding includes `env(safe-area-inset-bottom)`.
- "Counts toward" and "What's left" jumps (`showInSidebar`) switch to the
  Requirements tab first. "Locate on timeline" switches to Timeline first.
- A touch drag that starts on the Requirements tab switches to the Timeline
  tab as soon as it arms (`useTouchDrag`'s `onDragStart`). So a requirement
  option can still be dragged onto a semester on a phone (WR45), and the
  finger ends up over the terms.

**Sheet.**
- In `data-mode="sheet"`, the panel is `position: fixed`, 8px from the
  sides, bottom at `tabbar height + 8px`. `--sheet-h` depends on
  `data-detent`:
  - peek: 148px, header only (the body is `hidden`)
  - half: 56%
  - full: `100% - 8px`, which covers the tab bar, with square bottom
    corners
- The handle is `button.sheet-handle`, named "Resize details" with
  `aria-valuetext` set to "Peek", "Half height" or "Full height":
  - Tapping it cycles peek → half → full → peek.
  - Dragging it (pointer events with capture) follows the finger, and on
    release settles at the nearest height, chosen by a pure function.
- `.sheet-head` is the panel's sticky header with `.glass` in sheet mode.

**Retiring the split.**
- Delete the split CSS, `split-resize.ts` and its tests, `SPLIT_KEY` and
  related code, the head-script line, and `ReqsResizeHandle.tsx`.
- In stacked mode, the stacked-only `reqs-hide` and `reqs-rail` bar
  rendering and CSS go too.
- In side-by-side, the rail is kept.

## 5. Task breakdown

### Task 20: Phone tab bar replaces the stacked split, handle and collapsed bar

- [x] **Done 2026-09-29.** The specs are in `spec/layout/phone-layout.test.ts`
  ("phone tabs"). `data-tab` is always rendered, and CSS reads it only
  inside the `< 49.5rem` container query, so the server render already
  shows only the timeline on a phone. The Requirements region's list
  rules (vertical groups, 13rem card grid) are now the base rules, not
  side-by-side only. Also ported: phone cases in `page-and-nav`,
  `course-cards`, `timeline` and `timeline-years` (a Requirements-tab
  step) and `sidebar-groups` (moved into "jumps switch tabs"). The
  acceptance grep's only hit is `panel-state.test.ts`'s own
  `not.toContain("panel-split")` guard.

- **Description:** WR43, and WR40's `panel-split` retirement.
- **Files touched:**
  - `Planner.tsx`, `Sidebar.tsx`, `Timeline.tsx` (the jump hooks)
  - `src/styles.css`, `src/layouts/Base.astro`
  - `panel-state.ts` and its test
  - delete `split-resize.ts`, `split-resize.test.ts` and
    `ReqsResizeHandle.tsx`
  - `spec/layout.test.ts`
- **Tests first (red):** `spec/layout.test.ts`, `describe("phone tabs")`
  at 390×844:
  - "one region at a time": the tab bar is visible with two
    `aria-pressed` buttons, each at least 44×44. At the start, the
    Timeline is visible and `aside#requirements` isn't displayed.
    Activating "Requirements" swaps them.
  - "no split handle or collapsed bar on phones": there's no
    `[role=separator]` and no visible `.reqs-rail`.
  - "jumps switch tabs": on the Timeline tab, a card's "Counts toward"
    switches to Requirements and highlights the group. From Requirements, a
    row's term button switches to Timeline and locates the card.
  - "a touch drag from Requirements switches to the Timeline": port the
    :1081 test. On the Requirements tab, press and hold COMP3630's card
    until the drag arms. The Timeline tab becomes active, and dropping on a
    term places the course.
  - "fitted page": `verticalOverflow(page) === 0` on both tabs.
  - "axe on each tab".
  - "card height budget on the Timeline tab": the phone rule as it was
    before Phase 05 (first card plus the second card's code line), with
    the relaxed test restored, per §2.2.
  - "undo toast sits above the tab bar": after a remove, the toast's bottom
    is at or above the tab bar's top.
  - `panel-state.test.ts`: the head script no longer mentions
    `panel-split`, and `SPLIT_KEY` no longer exists (delete the tests that
    covered it).
  - Delete or port the "stacked requirements collapse" (:1191) and
    stacked-split cases. Port any assertion about a guarantee that still
    exists (for example, dropping to remove still works in side-by-side).
- **Implementation (green):**
  - `Planner`:
    - the `tab` state and `data-tab`
    - `<nav class="tabbar glass" aria-label="Plan view">` rendered when
      `layout.mode === "stacked"`
    - `showInSidebar` sets `tab = "requirements"` first; the
      `setLocateRequest` callers set `tab = "timeline"` first
    - the touch-drag `onDragStart` sets `tab = "timeline"` when stacked
    - `nav.tabbar` carries `.glass`
  - CSS:
    - `.planner-layout[data-tab="timeline"] aside#requirements { display:
      none }`, and the converse for `.planner-timeline-area`
    - each region takes the full planner height
    - `.requirements-scroll` becomes a vertical list in stacked mode (it
      was a horizontal strip)
  - Delete the files and rules from this file's §4, "Retiring the split".
- **Refactor:** Remove `undo-toast-above-bar`. Replace it with a rule that
  offsets the toast by the tab bar's height in stacked mode.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - `grep -rn "panel-split\|split-resize\|ReqsResizeHandle\|data-split" src`
    finds nothing.
- **Depends on:** Phase 06.

### Task 21: Details bottom sheet with peek / half / full, handle tap and drag, and Remove from the sheet

- [x] **Done 2026-09-29.** The user accepted the human review ("pass")
  after two rounds. The handle and the geometry were amended per §2.2a.
  - **Specs:** `spec/layout/phone-layout.test.ts` ("details sheet").
  - **Before measurement** Planner passes `"drawer"`, because an
    unmeasured layout reads as stacked. The panel keeps the CSS fixed
    drawer until the width is known.
  - **Overscroll:** the sheet doesn't rubber-band
    (`overscroll-behavior-y: none`), because its white is a local
    background.
  - **`pixelAt` / `detailsHeadEnd`** (`spec/layout/helpers.ts`) read the
    rendered colour under the header's end, so the see-through-header
    bug fails a spec, not just a screenshot.
  - **Found in the review:** the Phase 06 drawer had the same two
    faults. At the user's request it was fixed in a separate commit.
  - **Refactor:** there was no stacked-only interim drawer rule to
    delete. Phase 02's fixed drawer is the base rule that the unmeasured
    panel still uses, so it stays. The drawer's timeline end padding
    now excludes the sheet.

- **Description:** WR44 and WR45.
- **Files touched:**
  - new `src/components/sheet-detent.ts`
  - new `src/components/sheet-detent.test.ts`
  - `CourseDetailsPanel.tsx`, `Planner.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - `sheet-detent.test.ts`:
    - `nextDetent("peek")` is "half", then "full", then back to "peek".
    - `nearestDetent(heightPx, viewportPx)`, with peek = 148, half =
      0.56·vp and full = vp − 8: 160 gives peek, 0.5·vp gives half, 0.9·vp
      gives full.
    - `detentHeights(viewportPx)` returns the three heights.
  - `spec/layout.test.ts`, `describe("details sheet")` at 390×844 with
    `hasTouch`:
    - Opening a course shows the panel with `data-mode="sheet"` and
      `data-detent="half"`. It sits above the tab bar, and the tab bar is
      still usable.
    - Tapping the handle cycles through the heights. At peek the body is
      hidden and the header is visible. At full the panel covers the tab
      bar.
    - Dragging the handle from half to near the top settles at full.
    - "Remove from plan" in the sheet removes the course and shows the undo
      toast. The sheet stays open, showing "Not planned" (WR11).
    - The handle is at least 44px tall and exposes `aria-valuetext`.
    - Escape inside the sheet closes it.
    - axe at each height.
    - Reduced motion: `transition-duration` is 0s.
- **Implementation (green):**

  ```ts
  // src/components/sheet-detent.ts
  export type Detent = "peek" | "half" | "full";
  export function nextDetent(d: Detent): Detent;
  export function detentHeights(viewportPx: number): Record<Detent, number>;
  export function nearestDetent(heightPx: number, viewportPx: number): Detent;
  ```

  - The panel, in sheet mode:
    - `data-detent` state, reset to "half" on each new `details.token`
    - `button.sheet-handle`: a tap calls `nextDetent`; a drag sets
      `--sheet-h` live, then applies `nearestDetent` on release
    - its header gets `.sheet-head.glass`
  - CSS: the sheet rules from this file's §4, with transitions on `height`
    except under `prefers-reduced-motion`.
- **Refactor:** Delete the Phase 02 interim fixed-drawer rules for stacked
  mode.
- **Acceptance criteria:** `pnpm check` passes.
- **Human review:** the app on a phone-sized viewport (390×844, and a real
  phone if one's available). Switch tabs, open a course, drag the sheet
  through its heights, and remove and undo. A pass means:
  - it feels like a native sheet
  - the tab bar never hides something you need
  - you can still read and act on the plan behind the sheet at peek and
    half
- **Depends on:** Task 20.

## 6. Phase Definition of Done

- [ ] Tasks 20–21 complete, with tests passing
- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] Task 21 human review accepted by the user
- [ ] Tick Phase 07 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR43 | Task 20 |
| WR40 (panel-split) | Task 20 |
| WR44, WR45 | Task 21 |

## 8. Risks / open questions

None.
