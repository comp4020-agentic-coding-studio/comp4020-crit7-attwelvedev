# Specialisation details in the details panel

- **Date:** 2026-09-29
- **Status:** Approved
- **Approved by user:** yes, 2026-09-29

## 1. Problem / intent

The planner is meant to be a hypothetical Programs & Courses (P&C) with a
planning layer on top. P&C has a page for each specialisation. Each page has:

- an introduction
- learning outcomes
- requirement lists
- rules: the 4000-level minimum, incompatible majors and minors, eligible
  programs
- "Other Information" and "Relevant Degrees"

The planner shows none of this. A specialisation is a radio option in the
Requirements sidebar. Once chosen, only its course lists appear. So a student
decides which specialisation to take with the least information on screen.

The user wants a specialisation to open in the existing details panel (the
course one), with as much of P&C's information as possible. The panel should
add planning value only where the sidebar doesn't already cover it.

- For the chosen specialisation, the sidebar already shows its cards and
  progress. The panel is the P&C page plus a jump to that progress.
- For a specialisation the student hasn't chosen, nothing is on screen. The
  panel answers "what would switching to this do to my plan?" with a true
  what-if.

## 2. Requirements

Numbering is local to this spec (SD = specialisation details).

### 2.1 Functional requirements

**A. Data**

- SD1. Add a hand-written supplement file,
  `data/2027/subplans-supplement.json`, taken from the live P&C 2027 pages.
  Per specialisation it holds what the `anu-pandc` 0.3.1 scrape lost:
  - The **Other Information** text: every page has one.
  - The **Relevant Degrees** list: every page has one.
  - SYAR's **topic list**. It follows "Depending on the chosen courses,
    students will learn about:", which is where the scraped introduction
    now ends.
  - Structural fixes the scrape flattened. HCCC's "Advice to Students" is
    a real P&C heading and must render as a heading, not as body text.

  Reference text, seen on 2026-09-29. Re-check against the live pages when
  writing the file:
  - ARIN Other Information: "This Specialisation is incompatible with the
    Computing and Mathematical Foundations minor and the Intelligent Systems
    major. Students planning to complete COMP4691 Optimisation should ensure
    they complete MATH1013 or MATH1115 from the Information and
    Communications Technology-related course list early in their program."
  - THCS Other Information: "To enrol in MATH4343 students will need to
    apply to the course convener for a permission code." and "COMP4011
    Advanced Topics in Formal Methods and Programming Languages is a special
    topics course and the particular topics taught under this code will
    vary. The topic to be covered in each instance of the course will be
    advertised on the School of Computing website."
  - SYAR Other Information: "COMP4045 Advanced Topics in Computer Systems is
    a special topics course and the particular topics taught under this code
    will vary. The topic to be covered in each instance of the course will
    be advertised on the School of Computing website."
  - HCCC Other Information: "This specialisation is only available to
    students studying BAC (AACOM) and BACR&D (AACRD)."
  - Relevant Degrees, all four: "Bachelor of Advanced Computing (Honours)
    (AACOM)" and "Bachelor of Advanced Computing (Research and Development)
    (Honours) (AACRD)".
  - SYAR topics (13 items, run together in the page HTML, so split them by
    reading the page):
    1. concurrency and the design and implementation of concurrent programs
    2. synchronisation approaches
    3. operating system design
    4. memory management
    5. process scheduling
    6. files systems (sic)
    7. network layers and protocols including datalink, network, and
       transport layer protocols and their performance
    8. modelling and simulation and the limitations and design of such
       systems
    9. numerical calculation
    10. developing algorithms and implementing code that yields good
        performance on high-performance architectures
    11. database design methods
    12. database query processing and optimisation
    13. transaction and security management in a relational database
        management system.
- SD2. A merge script in `scripts/` combines the scraped
  `data/2027/subplans/*.json` with the supplement and writes the merged
  data the app reads.
  - Re-running `scripts/scrape-2027.sh` and then the script must give the
    same result.
  - Nobody hand-edits the scraped JSON.
- SD3. The app bundles the merged data with a **static import**, not a
  runtime fs read. The Dockerfile only ships `dist/`; see the comment in
  `src/data/aacom-2027.ts`.
- SD4. Each specialisation `GroupDef` in `src/data/aacom-2027.ts` is linked
  to its P&C code (`ARIN-SPEC` and so on), and each of its child groups to
  the P&C list it models.
- SD5. A `spec/` test fails if the merged data and `aacom-2027.ts` drift
  apart. For each specialisation it checks:
  - that the set of courses in each P&C list equals the linked child
    group's `courses`
  - that `min_units` (24) matches.

  This is the harness-level guard. Hand-copied course lists already live
  in two places.

**B. Entry points**

- SD6. In the sidebar's "Choose Specialisation" fieldset, each option gets a
  **"Details"** text button beside its label.
  - It sits outside the `<label>`, so clicking the label still selects the
    radio.
  - Its accessible name is "Details: <spec title>".
  - While that spec is open in the panel, it has `aria-current="true"`.
- SD7. After a choice, the chosen specialisation's heading in the sidebar
  opens its details. The heading keeps `tabIndex=-1` so jumps can still land
  on it.
- SD8. The search palette also returns specialisations.
  - It matches on the code (with or without "-SPEC") or on title words,
    client-side, when the search is submitted.
  - Results show under a "Specialisations" heading above course results,
    and only when there are any.
  - A result's title joins the palette's arrow-key title list. Enter opens
    it.
  - The status message counts both kinds of result, so "ARIN" never reads
    "No courses match".
- SD9. A course's details panel gets an **"On the lists of: …"** line.
  - It is the first thing in the body, before "In your plan".
  - It names every specialisation whose lists include the course, chosen or
    not, each a link to that specialisation. The chosen one is marked
    "(your specialisation)".
  - It is left out when the course is on no list.
- SD10. Course codes inside P&C prose (Other Information and rule text)
  become links that open that course's details, for codes in the catalogue.

**C. Panel behaviour**

- SD11. Specialisations open in the same single details panel as courses.
  Its layout modes are unchanged: docked (narrow/wide), drawer, phone
  sheet.
  - Courses and specialisations share **one back/forward trail**.
  - The buttons are labelled **"Back" / "Forward"**, replacing "Previous
    course" / "Next course".
- SD12. The open specialisation is reflected as `?spec=ARIN-SPEC` using
  `history.replaceState`, and never alongside `?course=`.
  - A page load with `?spec=` renders the panel open on the server.
  - An unknown code is ignored and the panel stays closed.
- SD13. The panel's accessible name follows its content: "Course details"
  or "Specialisation details".
- SD14. **Header:**
  - the code (`ARIN-SPEC`)
  - meta "24 units, Specialisation", with a comma to match the course
    header
  - P&C's title
  - a pill reading "Chosen" (with the violet family dot) or "Not chosen"

  There is no progress pill.
- SD15. **Planning block, chosen specialisation.**
  - It is headed "In your plan" and reads "You chose this specialisation."
  - A "See your progress in Requirements" button jumps to and flashes the
    sidebar section through the existing `onShowInSidebar` path.
  - On a phone the button switches to the Requirements tab and drops the
    sheet to **peek**. The sheet stays open, so the trail survives.
- SD16. **Planning block, unchosen specialisation** (including when no
  specialisation is chosen yet). It is headed "Fit with your plan" and comes
  from a **true what-if**: the plan re-evaluated on the server with this
  specialisation as the Specialisation choice. It shows:
  - A `ProgressBar` (specialisation family) labelled "If you chose this",
    with a sentence such as "12 completed, 6 planned of 24. 6 units to go."
  - A summary such as "3 of your courses would move here, from Electives and
    Systems and Architecture."
  - **Move rows.** For each course that would count, a line reading "●
    from-group › ● to-group", where "from" is where it counts today.
    Courses that count toward nothing today say "not counting toward
    anything now".
  - Courses that would **stop counting toward the current specialisation**,
    when one is chosen.
  - **Shortfalls.** Any requirement that is satisfied now but wouldn't be
    after the switch, e.g. "Electives would drop to 36 of 48".
  - The zero case: "None of your courses are on its lists yet, so all 24
    units are still to go."
- SD17. **Choose / Switch button** in the planning block, placed right after
  the summary sentence and before the course rows.
  - It reads "Choose this specialisation" (gold primary) when nothing is
    chosen, and "Switch to this specialisation" (neutral) when another spec
    is chosen.
  - It applies immediately through the existing choice action and shows the
    existing undo toast: "Chose <title>" or "Switched to <title> from
    <title>". There is no confirmation.
  - It is hidden on read-only plans. It works even while the what-if is
    loading or has failed.
- SD18. **What-if states.**
  - Loading: "Working out how this would fit your plan…", in a block with a
    min-height to limit the layout jump.
  - Error: "Couldn't work out how this fits your plan." with a Try again
    button.
  - The P&C sections always render straight away.
  - The what-if re-derives with every new `PlanView`, whatever produced it.
    A stale answer never overwrites a newer one.
- SD19. **Requirements section.**
  - P&C's `requirements` entries render verbatim and in P&C's order. Text
    blocks are plain paragraphs. Each list group has P&C's exact heading.
    HCCC's "AND" connectors and "Advice to Students" heading appear as on
    P&C.
  - Under each list heading, a tag with the app's short label: the part
    after "<spec> — ", e.g. "foundations (max 12)", or "HCCC core" as is.
    For the chosen spec the tag links to that sidebar group; otherwise it
    is plain text.
  - Each course is a plain line, not a card and not draggable:
    - the code as a link that opens its details
    - the title, from the catalogue
    - the units, from the catalogue (the scrape's `units` are null)
    - the plan status: "Completed <term>", "Planned <term>" or "Not in your
      plan"
  - For the chosen spec, the status also says where the course counts when
    that isn't here, e.g. "counts toward Electives".
  - For an unchosen spec, the status adds "would count" or "wouldn't count
    here". A reason is given only when the list's maximum is visibly full,
    e.g. "over the 12-unit limit".
  - There are no per-list what-if figures.
- SD20. **About the specialisation:**
  - The introduction, clamped like a course description, with "Read the
    full description" / "Show less".
  - SYAR's topics as an unnumbered list.
  - Learning outcomes as a numbered list.

  If clamping across several paragraphs plus a list is unreliable across
  browsers, clamp only the first paragraph.
- SD21. **Other information:** the supplement's text, with codes linked
  (SD10).
- SD22. **Relevant degrees:** a list, with ", your degree" after the plan's
  program (AACOM).
- SD23. **Footer:** "Open ARIN-SPEC on Programs & Courses ↗" (the existing
  `ExternalLink`) and "Details from Programs & Courses 2027, updated
  <scraped date>".
- SD24. While the **chosen** specialisation is open, its sidebar section gets
  the existing linked-group tint (`.group-linked`). An unchosen spec has no
  section, so nothing is tinted.
- SD25. The Help page gains a section on specialisation details.

### 2.2 Non-functional requirements

- **Accessibility:**
  - axe-clean in every state.
  - Plan status is always written out, never colour-only.
  - Tap targets of at least 2.75rem.
  - Every P&C link says "(opens in a new tab)" to screen readers.
- **Viewports:** verified by rendering at 1920×1080 (narrow and wide docked
  panel) and 390×844 (sheet at peek, half and full). There is no horizontal
  overflow.
- **Payload:** specialisation data and the what-if are not added to
  `PlanView`, so the plan payload doesn't grow, following WR2.
- **Build and deploy:** static import only (SD3).
- **Tests:** browser `describe`s go in the right `spec/layout/<area>.test.ts`
  and stay within `spec/suite-size.test.ts`'s line budget.

### 2.3 Out of scope

- The timeline reacting to an open specialisation, e.g. receding
  non-matching cards.
- Details for capstone options, which also form a choose-one group but have
  no P&C subplan page.
- Per-list what-if figures.
- Modelling incompatible majors and minors (INSY-MAJ, COMS major, the
  Computing and Mathematical Foundations minor). They're shown only as P&C
  text.
- Changing `anu-pandc` itself.

### 2.4 Assumptions (confirmed)

- The plan's program is always AACOM, so "your degree" is correct. This is
  the only program modelled (`AACOM_2027`).
- The what-if runs on the server with the existing pure domain code, because
  the client doesn't have the catalogue.
- The choice action already goes through undo/redo. **`plan-feature` must
  verify this** against `plan-actions.ts` / `undo-history.ts` before relying
  on it.
- Every course on every specialisation list is in the catalogue, including
  MATH4343, COMP4045, COMP4011, COMP3242 and COMP4020 (checked in
  `data/2027/courses/`).

## 3. Existing context

- **The subplan JSON is used nowhere.** `data/2027/subplans/{ARIN,HCCC,SYAR,
  THCS}-SPEC.json` (plus `.md`) are only checked for existence in
  `src/lib/domain/data-2027.test.ts`.
  - Their fields: `code`, `title`, `min_units`, `introduction`,
    `learning_outcomes`, `requirements`, `url`, `scraped_at` and
    `all_course_codes`.
  - Each `requirements` entry is either `{type:"text", content}` or
    `{type:"group", heading, courses:[{code,title,units:null}]}`.
  - ARIN's `all_course_codes` includes MATH1013 and MATH1115 because of its
    Other Information note, which the scrape didn't capture.
- **The scraper is external.** `scripts/scrape-2027.sh` calls
  `.venv/bin/anu-pandc` (0.3.1). That's why the fix is an in-repo
  supplement plus merge.
- **The specialisations are hand-modelled** in `src/data/aacom-2027.ts`:
  `arin`, `hccc`, `syar`, `thcs`, with children such as `arin-a`/`arin-b`
  and app labels like "Artificial Intelligence — foundations (max 12)".
  They sit under the selectable `spec` group.
- **How choices render.** `src/lib/domain/view.ts` `buildGroupView`: a
  selectable group exposes `options` and `chosenId`, and only the chosen
  child's subtree is built. `src/components/Sidebar.tsx` renders the
  options as a radio fieldset and the chosen child as nested headings.
- **The details panel is course-only.**
  - `src/components/CourseDetailsPanel.tsx`.
  - `src/components/details-state.ts`: its history holds course codes, and
    `courseParam` checks `^[A-Z]{4}\d{4}$`.
  - `src/components/use-course-details.ts`: a client cache keyed by plan
    and code.
  - `src/pages/api/courses/[code].ts`.
  - Spec `specs/2026-09-28-workspace-redesign.md` (WR5–WR12) sets its
    rules. `RequisiteTree.tsx` course leaves (code link, title, "where"
    line) are the model for the list lines.
- **Design system:** `src/styles.css` (tokens `--surface`, `--ink`,
  `--unigrey`, `--muted`, `--line`, `--gold`, `--family-specialisation`
  #8c5fc9; `.details-*`, `.requisite-*`, `.family-dot`, `.group-linked`,
  `.undo-toast`), `ProgressBar.tsx`, `SearchPalette.tsx`.

## 4. Design

The panel shows one of two kinds of subject: a course or a specialisation.
It keeps one shell (header, nav, sheet handle, wide toggle, footer) and has
two bodies. Its state and history hold typed subjects (course or
specialisation), not bare course codes. The URL carries one of `?course=` or
`?spec=`.

Three sources feed a specialisation's body:

1. **The bundled, merged subplan data**: the P&C content. It is available
   immediately, including in the server render.
2. **The current `PlanView`**: plan status per course, which spec is chosen,
   and today's allocation.
3. **A read-only what-if endpoint** for unchosen specs. It evaluates the plan
   with the Specialisation choice swapped, then returns:
   - the spec's completed and planned totals
   - per course, where it would count against where it counts today
   - courses leaving the current spec
   - requirements satisfied now but not after the switch

   The endpoint is keyed by plan (and its current state), so every new
   `PlanView` refreshes it.

**Alternatives rejected:**

- *Simple overlap count instead of a what-if.* It overstates the result: it
  ignores the max-12 caps and courses the allocator needs elsewhere.
- *Patching `anu-pandc`.* It's an external package, and a re-scrape would
  regenerate all of `data/2027/`.
- *Cleaning the text at display time.* That patches over bad data and can't
  restore the missing sections.
- *Merging at import with no script.* The merged result would never be on
  disk to inspect.
- *Separate trails per kind.* The user chose one mixed trail.
- *Confirming before a switch.* Undo already covers it.

### 4.1 UI design

The layout comes from a `frontend-design` first-pass proposal, run in a
read-only Plan subagent. The user settled its open questions as recorded in
§5. It reuses the course panel's shell and classes. Violet
(`--family-specialisation`, the existing family colour) is the only
specialisation accent. Gold is kept for the one primary action. Glass stays
only on the sticky `.details-head.glass`.

**Section order:** header → planning block → Requirements → About → Other
information → Relevant degrees → footer. The planning block comes first
because it's why a planner has this panel, and it mirrors "In your plan" on
courses.

**Desktop docked, narrow, unchosen spec (another spec chosen), what-if
ready**
```
┌ .details-head.glass (sticky) ───────────────────┐
│ [‹] [›]                              [⇔]  [✕]   │
│ ARIN-SPEC  24 units, Specialisation             │
│ Artificial Intelligence                         │
│ ( Not chosen )                                  │
├─────────────────────────────────────────────────┤
│ Fit with your plan                          h3  │
│ If you chose this                               │ ProgressBar family=specialisation
│ ████████████▒▒▒▒▒▒░░░░░░░░░░░░                  │
│ 12 completed, 6 planned of 24. 6 units to go.   │
│ 3 of your courses would move here, from         │
│ Electives and Systems and Architecture.         │
│ Electives would drop to 36 of 48.               │ shortfall line
│ [ Switch to this specialisation ]               │ neutral button
│ Your courses that would count              h4   │
│ COMP3670 Introduction to Machine        6 units │
│ Learning                                        │
│ Completed S1 2026                               │ .requisite-where
│ ● Electives  ›  ● foundations (max 12)          │ .spec-move (NEW)
│ Would stop counting toward Systems & Arch.  h4  │
│ …                                               │
├─────────────────────────────────────────────────┤
│ Requirements                                h3  │
│ This Specialisation requires the completion of  │ plain <p>, verbatim
│ 24 units, which must include a minimum of 12    │
│ units of 4000-level courses.                    │
│ A maximum of 12 units from the following list:  │ .spec-list-heading (NEW)
│ ● foundations (max 12)                          │ .spec-group-tag (NEW)
│ │ COMP2620 Logic                        6 units │ requisite-tree guide line
│ │ Not in your plan                              │
│ │ COMP3670 Introduction to Machine      6 units │
│ │ Learning                                      │
│ │ Completed S1 2026, would count                │
│ A minimum of 12 units from the following list:  │
│ ● advanced (min 12)                             │
│ │ …                                             │
│ This specialisation is not compatible with the  │
│ INSY-MAJ.                                       │
├─────────────────────────────────────────────────┤
│ About the specialisation                    h3  │
│ intro (5-line clamp) [ Read the full description ]
│ Learning outcomes                           h3  │
│ 1. …                                            │
├─────────────────────────────────────────────────┤
│ Other information                           h3  │
│ Students planning to complete COMP4691 …        │ codes = button.requisite-code
│ MATH1013 or MATH1115 … early …                  │
├─────────────────────────────────────────────────┤
│ Relevant degrees                            h3  │
│ • Bachelor of Advanced Computing (Honours)      │
│   (AACOM), your degree                          │
│ • … (Research and Development) (Honours) (AACRD)│
├ .details-footer ────────────────────────────────┤
│ Open ARIN-SPEC on Programs & Courses ↗          │
│ Details from Programs & Courses 2027, updated … │
└─────────────────────────────────────────────────┘
```

**Chosen:** only the pill and the planning block change.
```
│ ( ● Chosen )                                    │
├─────────────────────────────────────────────────┤
│ In your plan                                h3  │
│ You chose this specialisation.                  │
│ [ See your progress in Requirements ]           │
├─────────────────────────────────────────────────┤
│ Requirements …   tags are links to sidebar groups;
│ lines: "Planned S2 2027, counts toward Electives"
```

**None chosen yet:** same as the unchosen layout, but the button is gold,
"Choose this specialisation".

**What-if states:**
```
LOADING                              ERROR
│ Fit with your plan           │     │ Fit with your plan                 │
│ Working out how this would   │     │ Couldn't work out how this fits    │
│ fit your plan… (min-height)  │     │ your plan. [ Try again ]           │
│ [ Switch to this spec… ]     │     │ [ Switch to this spec… ]           │

ZERO                                  READ-ONLY
│ ░░░░░░░░ 0 completed, 0 planned of 24. │  same as ready; button hidden
│ None of your courses are on its lists  │
│ yet, so all 24 units are still to go.  │
```

**Desktop docked, wide** (the existing `@container details (min-width:
628px)`): two `div.details-column` wrappers. The left holds Fit and
Requirements; the right holds About, Other information and Relevant
degrees. Auto-placed grid cells would leave gaps across uneven rows, which
is why the wrappers are needed.
```
┌ header (full width) ──────────────────────────────────────────────┐
├───────────────────────────────┬───────────────────────────────────┤
│ Fit with your plan            │ About the specialisation          │
│ Requirements                  │ Other information                 │
│                               │ Relevant degrees                  │
├───────────────────────────────┴───────────────────────────────────┤
│ footer                                                            │
```

**Phone sheet 390×844:**
- **Peek:** the header only, as the existing rule sets.
- **Half:** the header, the Fit summary and the Choose/Switch button. The
  button sits before the course rows so it's above the fold here.
- **Full:** everything, in the same order.

**Course panel, the new line (SD9):**
```
│ On the lists of: ● Artificial Intelligence      │ .details-lists (NEW), first in body,
│ (your specialisation) and ● Human-Centred and   │ grid-column 1 / -1, no h3, no rule
│ Creative Computing                              │
```

**Sidebar (SD6/SD7):**
```
┌ ● Specialisation ────────────────────┐
│ ┌ Choose Specialisation ───────────┐ │
│ │ ◯ Artificial Intelligence  Details│ │  .choice-details (NEW): text button,
│ │ ◯ Human-Centred & Creative        │ │  --muted, underline on hover/focus
│ │   Computing                Details│ │
│ │ ◉ Systems & Architecture   Details│ │
│ └───────────────────────────────────┘ │
│ Systems & Architecture  ← heading is a link-style button
```

**Search palette (SD8):**
```
│ Specialisations                                  h3  │ only when there are spec results
│ ▌ARIN-SPEC  Artificial Intelligence       Chosen     │ .palette-spec-row (NEW), violet
│ ▌24 units, Specialisation                            │ inset strip like course cards
│ (course results as today)                            │
```

**HCCC inside Requirements:** "Advice to Students" is an h4 in
`.spec-list-heading` style. P&C's "AND" is a quiet connector (`.spec-and`,
NEW: 0.8rem, 700, `--muted`) between lists.

**Reused:**
- **Shell:** `aside.details-panel.region`, `SheetHandle`,
  `.details-head.glass`/`.sheet-head`, `.details-nav`,
  `.details-icon-button`, `.details-wide`, `.details-close`,
  `.details-body`, `.details-section`, `.details-footer`, `ExternalLink`,
  `dateLabel`.
- **Header:** `.details-code`, `.details-meta`, `.details-title`,
  `.details-pills`, `.family-dot[data-family="specialisation"]`.
- **Planning block:** `ProgressBar`, `.details-loading`, the base `button`
  with `min-height: 2.75rem`, the gold primary from
  `form button[type=submit]` (extended to a `.details-choose` class),
  `.undo-toast`.
- **Course lines:** `.requisite-tree`, `.requisite-line`,
  `button.requisite-code`, `.requisite-where`. The requisite-met `.mark`
  column isn't used.
- **About:** `.details-description`, `.details-clamped`, `.details-more`,
  `ol.details-outcomes`.
- **Relevant degrees:** `.details-related ul`.
- **Jumps and tint:** `onShowInSidebar`, `requirement-highlighted`,
  `.group-linked`.

**New visual language, each for a reason:**
- `.spec-move`: the move row, the one memorable element. It shows what a
  switch takes from elsewhere, using family dots that already mean
  "counts toward".
- `.spec-group-tag`: links P&C's list to the app's label. `.group-tag`'s
  gold chip already means "the open course counts here", so it can't be
  reused.
- `.spec-list-heading`: P&C's full-sentence headings would shout at h4
  weight 700. It uses 0.92rem, weight 600, `max-width: 60ch`.
- `.spec-and`: P&C's exact "AND", kept quiet.
- `.choice-details`: the sidebar has no info icon, so a word is clearer.
- `.palette-spec-row`: `.placed-row`'s grey look means "already placed", so
  it can't be reused.
- `.details-lists`: the new course-panel line.
- `.details-column`: the wide two-column wrappers.
- The course line needs a `1fr auto` grid for its units figure.

**Designer ideas dropped in its own review:** a progress ring, cards per
list, "AND" pills, an ⓘ icon, and a "·" meta separator.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | gap | Where does a student open a specialisation? | All four: a Details button by each radio option, the chosen spec's heading, search, and an "On the lists of" line on courses (SD6–SD9). |
| 2 | ambiguity | The user asked how planning additions differ from the sidebar's existing course list. | They only earn their place for unchosen specs. Chosen: the P&C page plus a jump to the sidebar. Unchosen: a what-if plus Choose/Switch (SD15–SD17). |
| 3 | ambiguity | P&C wording or app labels? | Both. P&C headings verbatim, with the app label as a tag (SD19). |
| 4 | gap | Back/forward with two kinds of subject. | One mixed trail, labelled Back/Forward (SD11). |
| 5 | ambiguity | How "Fit with your plan" is computed. | A true what-if re-running allocation, not a simple overlap (SD16). |
| 6 | contradiction | The user chose "fix the scraper", but the scraper is the external `anu-pandc` package. | An in-repo supplement, merge script and drift test (SD1, SD2, SD5). |
| 7 | gap | The live pages showed the scrape also lost Other Information and Relevant Degrees on every page, and SYAR's topic list. "Advice to Students" is a real heading. | Added to the supplement, with reference text in SD1. |
| 8 | gap | Switching when another spec is chosen. | Immediate, with an undo toast and no confirmation (SD17). |
| 9 | gap | Links in P&C prose. | Course codes are linked (SD10). |
| 10 | gap | The timeline reacting to an open spec. | Out of scope. |
| 11 | gap | Knock-on of a switch on other requirements. | Show move rows, courses leaving the current spec, and shortfalls (SD16). |
| 12 | gap | Per-list what-if figures. | No; the summary only. |
| 13 | gap | The phone jump to Requirements. | Switch tab, and the sheet drops to peek (SD15). |
| 14 | gap | Sidebar tint for an open spec. | Chosen spec only (SD24). |
| 15 | ambiguity | Header meta separator, nav labels, progress pill, the panel's accessible name, read-only wording, "wouldn't count" reasons. | Comma; Back/Forward; no pill; the name follows content; the same wording on read-only with the button hidden; a reason only when the cap is visibly full (SD11, SD13, SD14, SD17, SD19). |
| 16 | gap | The scrape's `units` are null. | Units come from the catalogue; every listed course is in it. |
| 17 | gap | Multi-paragraph clamp support across browsers. | Fall back to clamping the first paragraph (SD20). |

## 6. Handoff notes for planning

- **Do not re-litigate §5.**
- **Suggested order:**
  1. Data: supplement, merge script, link groups to codes, drift test.
  2. Generalise the details state, history and URL to typed subjects.
  3. Specialisation body with the static P&C content.
  4. The what-if endpoint and the planning block.
  5. Entry points: sidebar, search, course line.
  6. Wide/phone layouts, Help, and the review sweep.
- **Verify before relying on it:** that the choice action is covered by
  undo/redo, and how today's undo-toast wording is phrased for choices.
- **Risks:**
  - Generalising `DetailsState` touches every existing course entry point
    and `?course=` behaviour. The existing tests for them must stay green.
  - The what-if cost is one extra evaluation per open or plan change, which
    is acceptable at four specs.
- **Process log:** the discovery that the scrape silently dropped whole P&C
  sections, and the drift test in SD5 that guards against it, is a
  candidate `PROCESS_LOG.md` moment. Log it once the data work is committed,
  citing that commit.
