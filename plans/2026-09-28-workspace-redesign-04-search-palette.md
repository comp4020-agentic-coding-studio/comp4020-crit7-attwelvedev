# Workspace redesign — Phase 04: search palette

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read §3
  and §4.1.
- **Depends on phases:** 02. It uses `runAction` from 03 if present; see
  this file's §2.4.

## 1. Summary

- The "Search courses" section leaves Requirements.
- A search field in the plan's header row (a 44px button on phones) and
  ⌘K / Ctrl-K open a `SearchPalette`.
- The palette does everything the section did:
  - the same API and outcome messages, including the live P&C lookup
  - draggable result cards with "Place in…", or placed rows
- Enter on a result opens it in the details sidebar.
- Dragging a result onto the timeline works with mouse and touch, and the
  palette steps aside while you drag. (The sidebar's grip was removed in the
  Phase 02 review, 2026-09-29; there's no drag from the sidebar.)

## 2. Requirements (this phase)

### 2.1 Functional

- WR26, WR27, WR28, WR29, WR30, WR31: all.
- WR6: palette Enter.

### 2.2 Non-functional

- axe is clean with the palette open, at 1920×1080 and 390×844.
- The palette is a modal `role="dialog"` with `aria-modal="true"` and a
  focus trap. It's the one sanctioned modal, because it's a transient
  chooser.
- Every control is at least 44px.

### 2.3 Out of scope for this phase

- The rest of the palette's finish. It gets `.glass` in Task 11 if Phase 05
  has landed; otherwise Phase 05's Task 13 applies it.
- Phone full-height layout beyond `inset: 0` sizing. Phase 07 checks it.

### 2.4 Assumptions

See overview §2.4.

Phase-specific:
- If Phase 03 has already landed, result cards call `onAction` (Task 9).
  Otherwise they keep calling `placeCourse` through the existing props, and
  Phase 03's Task 9 grep criterion catches the palette when it lands.
  Either order is valid.

## 3. Existing code context (verified 2026-09-28)

**`src/components/CourseSearch.tsx`**
- `export function outcomeMessage(result: SearchResult, query: string):
  string`, tested in `course-search-message.test.ts`. Keep it and move it.
- Default export `CourseSearch`. Its props: `view, planId, onChanged,
  onAnnounce, onDragStart?, onDragEnd?, onResults?, openMenuCode,
  onMenuOpenChange, onLocateCourse, compact, onToggleCompact, onExpand`.
  Phase 02 added `onOpenDetails`.
- It renders a `SidebarSection id="search"` whose summary is a `<form>`:
  - `<label>Course code or title <span class="course-search-field"><svg
    class="course-search-icon"/><input type="text" placeholder="e.g.
    COMP1100"/></span></label>`
  - `<button type="submit">Search</button>`
- Status messages use `p.course-search-status` ("Searching…" or the outcome
  message).
- Unplaced results are `ul.available-courses.course-search-results` of
  `AvailableCourseCard`s. Placed ones are `ul.placed-rows.course-search-placed`
  of `PlacedCourseRow`s.

**`src/components/Sidebar.tsx`**
- It renders `<CourseSearch …/>` between "What's left" and "Total" (around
  line 457).
- It passes `onSearchResults` through from `Planner`, which merges results
  into `searchBlocked` and `searchTwoSemester` (Planner :297-306). Phase 02
  added `knownCards`.
- Its compact-section ids include `"search"`, stored in `sidebar-compact`.

**`src/components/Planner.tsx`**
- The header row is `.plan-title > .plan-title-main (h1, badge) +
  .plan-actions (completed-control, history-controls, MoreOptions)`.
  `.history-controls` (Undo/Redo, from the undo-redo plan) is only on
  editable plans. Below `44rem` it's absolutely positioned at the end of
  the title's line (which gets a 44px minimum height), so on phones
  `.plan-actions` holds only Completed and More options.
- `plannerRef` is the root of `useTouchDrag(plannerRef, {onDragStart,
  onDragEnd, onDrop})`, and `draggingCode` is its state.

**`src/components/touch-drag.ts`**
- Delegated on the root, it picks up `[data-drag-code]`.
- `resolveDrop` finds `[data-term]` or `aside[aria-label='requirements']`.
- The ghost is a clone of the source card.

**`src/components/AvailableCourseCard.tsx`**
- Native `draggable` with `dataTransfer.setData("text/plain", code)`, and
  `onDragStart?(code)`.

**Tests using the inline search**
- `spec/layout.test.ts`:
  - :130: the placeholder isn't cut off at a given width
  - :650-839: `page.fill(".course-search input", …)` then
    `page.click(".course-search button[type=submit]")`, and results under
    `.course-search .course-card` / `.placed-row`
  - :1024-1072: "greys a searched course's hard-blocked terms mid-drag",
    "already-placed search result…", and "lists placed search results…"
- `spec/planner.test.ts`: the search API tests are HTTP-only and unchanged.

### Interfaces from earlier phases (exact)

From Phase 02:

```ts
// Planner: openDetails(code: string, focus?: DetailsFocus): void; knownCards: Record<string, CourseCard>
// Card components: onOpenDetails: (code: string, focus?: DetailsFocus) => void
// CourseDetailsPanel has no grip (removed in the Phase 02 review, 2026-09-29)
```

From Phase 03 (optional; see this file's §2.4), as extended by the
undo-redo plan (`plans/2026-09-29-undo-redo.md`, executed before this
phase):

```ts
// src/components/plan-actions.ts
export type PlanAction =
  | { kind: "place"; code: string; term: number }
  | { kind: "move"; code: string; term: number }
  | { kind: "remove"; code: string }
  | { kind: "pin"; code: string; groupId: string | null }
  | { kind: "check"; code: string; item: string; answer: CheckAnswer | null }
  | { kind: "choice"; groupId: string; childId: string | null }
  | { kind: "cutoff"; cutoff: number };
// Card components, Sidebar and CourseDetailsPanel: onAction: (action: PlanAction) => Promise<void>
// (Sidebar and CourseDetailsPanel no longer take onChanged.)

// src/components/undo-history.ts
export interface ShortcutKeys { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }
export function historyShortcut(keys: ShortcutKeys, mac: boolean): "undo" | "redo" | null;
export function isTextEntry(el: { tagName: string; type?: string; isContentEditable?: boolean } | null): boolean;
// Planner registers the history keydown listener once (useEffect, [readOnly]),
// ignoring isTextEntry(event.target); undo()/redo() read state through refs.
```

## 4. Approach

**Structure.**
- `SearchPalette.tsx` owns the query, results, pending and status state
  that used to live in `CourseSearch`.
- It renders inside `.planner`, so the touch-drag root covers it.
- The trigger (`button.search-trigger`) sits in `.plan-actions`, before the
  completed control:
  - On wide layouts it's styled as a field, "Search courses by code or
    title", with a "⌘K" hint (Ctrl on non-Mac).
  - On phones it collapses to an icon button with the accessible name
    "Search courses".
- `Planner` holds `searchOpen`, and a document `keydown` listener toggles
  it on ⌘K or Ctrl-K.

**Dragging out of the palette.**
- At `dragstart` (native) or `onDragStart` (touch), the palette sets
  `data-dragging` on its backdrop. CSS then hides it with `visibility:
  hidden; pointer-events: none`, so the drop targets underneath are
  reachable while the dragged element stays in the DOM.
- At `dragend` or `onDragEnd` the palette closes.


## 5. Task breakdown

### Task 11: `SearchPalette` with header trigger and ⌘K; retire the inline Search section

- **Description:** WR26–WR29, WR31, and WR6 (palette Enter).
- **Files touched:**
  - new `src/components/SearchPalette.tsx`
  - `src/components/CourseSearch.tsx`: delete it; move `outcomeMessage`
    into a new `src/components/search-message.ts`
  - rename `course-search-message.test.ts` to `search-message.test.ts`
  - `Sidebar.tsx`, `Planner.tsx`, `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** `spec/layout.test.ts`, `describe("search
  palette")`:
  - "header trigger opens the palette and focuses its input", at 1920×1080
    and 390×844. At 390 the trigger is at least 44×44 and named "Search
    courses".
  - "⌘K and Ctrl-K toggle the palette; Escape closes it and returns focus
    to the trigger".
  - "Requirements has no Search section": no `.course-search` inside
    `aside#requirements`.
  - "results match the old section": filling `.course-search input` with
    COMP4550 and submitting shows a `.course-card` with "Place in…". A
    placed code shows a `.placed-row`.
  - "a live-fetch outcome message shows": route `/api/courses/search` to
    `{status:"not_found", courses:[]}`, and the palette shows
    `outcomeMessage`'s text.
  - "ArrowDown moves into results, Enter opens details": the palette closes,
    the details aside shows the code, and the URL has `?course=`.
  - "axe with the palette open" at both viewports.
  - Port the existing inline-search tests (:130, :650-839, :1024-1072) by
    adding an
    `openSearch(page)` helper that clicks `.search-trigger` first. The
    selectors `.course-search input` and `.course-search
    button[type=submit]` stay valid, because the palette keeps those class
    names. Rewrite :130 as "the palette's placeholder isn't cut off".
    Port the undo-redo plan's "history shortcuts" case "leave the search
    box its own text undo" (`spec/layout/undo.test.ts`) the same way,
    through `openSearch(page)`.
  - From the undo-redo plan (UR16): "with the palette open, `${mod}+z`
    doesn't undo". Make a card-menu move, open the palette, move focus to
    a result title (not the input), press `${mod}+z`, and after 1s the
    move still stands.
- **Implementation (green):**
  - `SearchPalette.tsx`. Its default export takes:

    ```ts
    interface Props {
      view: PlanView;
      planId: string;
      open: boolean;
      onClose: () => void;
      onResults: (courses: CourseCard[]) => void;
      onOpenDetails: (code: string) => void;
      onAnnounce: (message: string) => void;
      onDragStart: (code: string) => void;
      onDragEnd: () => void;
      openMenuCode: string | null;
      onMenuOpenChange: (code: string, open: boolean) => void;
      onLocateCourse: (code: string, part?: 2) => void;
      // plus whichever place path exists: onAction (Phase 03) or onChanged
    }
    ```

    - It renders `div.palette-backdrop` > `div.course-search.palette
      [role=dialog][aria-modal=true][aria-label="Search courses"]` with:
      - the same `<form>` markup as `CourseSearch`'s summary
      - the status line
      - the same two result lists, with the same components and classes
    - Focus trap: Tab and Shift-Tab cycle inside it.
    - A click on the backdrop closes it.
    - ArrowDown from the input focuses the first result's `.course-card-title`
      or `.placed-row-title`. Arrow keys move between those titles.
      Enter or click opens details and closes the palette.
    - Pressing Enter in the input submits the search.
  - `Planner`:
    - `const [searchOpen, setSearchOpen] = useState(false)`
    - the trigger button in `.plan-actions`
    - the document `keydown` listener for `(metaKey || ctrlKey) &&
      key === "k"`, which calls `preventDefault` and toggles
    - render `<SearchPalette>` inside `.planner`
    - `onResults` merges into `knownCards`, `searchBlocked` and
      `searchTwoSemester`, as the old `onSearchResults` did
    - the history shortcuts are ignored while the palette is open (UR16).
      Its input is already a text entry, and the history `keydown`
      listener also returns early while `searchOpen`. The listener is
      registered once, so read `searchOpen` through a ref.
  - `Sidebar`: remove `CourseSearch` and its props (`onSearchResults`, the
    search compact id).
  - CSS: the palette is centred, `min(620px, 100% - 2rem)` wide and 12vh
    from the top. At container widths under 49.5rem it's `inset: 0`, full
    screen (WR31).
- **Refactor:** Remove `.course-search` sidebar-section CSS that's no
  longer used, and the `search` entry handling in `loadCompact`.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - `grep -rn "CourseSearch" src` finds nothing.
  - The header (search trigger, completed control, history controls, More
    options) fits one row at 390 with no overflow, or wraps without
    overflow if it can't. At 390 the history controls sit on the title's
    line (see the header note above), so the second row holds the
    trigger, Completed and More options. The "plan title row" suite's
    100px height budget still holds.
- **Depends on:** Phase 02.

### Task 12: Drag out of the palette

- **Description:** WR30.
- **Files touched:**
  - `SearchPalette.tsx`, `Planner.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** in `spec/layout.test.ts`, on an editable plan:
  - "mouse-drag a palette result onto a term": open the palette, search
    COMP4680, and drag its card to `section[data-term="4"]` with
    `page.dragAndDrop`. The course is placed in term 4, and the palette is
    closed.
  - "the palette hides during a drag": between dragstart and drop, the
    backdrop's computed `visibility` is `hidden`.
  - "touch-drag a palette result": at 390×844 with `hasTouch`, hold for
    300ms and move onto the term, using the same technique as the existing
    touch-drag test near :1081. The course is placed.
  - "a refused drop announces its reason": dragging a result onto a term
    in its `hardBlocked` doesn't place it, and the live region shows the
    reason.
- **Implementation (green):**
  - `SearchPalette` takes a new prop, `dragging: boolean`, and renders
    `data-dragging` on the backdrop when it's true or while a native drag it
    started is in progress (`onDragStartCapture`).
    - Touch drags are handled by `Planner`: its `useTouchDrag` `onDragStart`
      sets `paletteDragging = true` when `searchOpen`, so the backdrop stops
      intercepting `elementFromPoint` before the finger moves.
    - Native `onDragEnd` and the touch `onDragEnd` both clear
      `paletteDragging` and call `onClose`.
  - CSS: `.palette-backdrop[data-dragging] { visibility: hidden;
    pointer-events: none; }`.
- **Refactor:** None expected.
- **Acceptance criteria:** `pnpm check` passes.
- **Depends on:** Task 11.

## 6. Phase Definition of Done

- [ ] Tasks 11–12 complete, with tests passing
- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] ⌘K → "COMP4680" → drag onto S1 2029 works in the running app at
  1920×1080. The same works by touch in device emulation at 390×844.
- [ ] Tick Phase 04 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR26–WR29, WR31 | Task 11 |
| WR6 (palette Enter) | Task 11 |
| WR30 | Task 12 |

## 8. Risks / open questions

None.
