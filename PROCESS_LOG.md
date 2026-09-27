<!--
Append-only working log of candidate PROCESS.md moments, in the order they
happened. Each entry: a `## <date> — <short title>` heading, then a commit
citation (`resolved by <sha>` or `<sha>..<sha>`), then 150-300 words on what
the call was, why it beat the obvious one, and how the result was checked.
Never edit or reorder past entries; append new ones at the end. Pick the
best 1-2 for PROCESS.md when the deliverable is due.
-->

## 2026-09-26 — Fixing allocation priority at the data layer, not the cost formula

Resolved by d0c20b4.

Phase 05's plan specified the allocation solver's reward as
`-(1000 - order(T))` per top-level group plus a flat `-10` per inner-group
hop, with `order(T)` the group's array index. Implementing it verbatim and
running the plan's own named test (`a compulsory COMP3630 in THCS stays
compulsory`) failed: my worked calculation showed the deep THCS path
(`-1006`) beats `compulsory`'s direct path (`-997`), because a single `-10`
inner-hop bonus exceeds the `1`-unit gap between adjacent orders.

The obvious fix — rescale the order step so adjacent orders dominate any
inner-hop total — worked for that case, but broke a second one
(`COMP4550` vs. `comp-upper`): I derived the two needed inequalities
algebraically (`STEP > 10` for the first pairing, `STEP < 5` for the
second) and they're mutually exclusive. No scaling constant satisfies
both simultaneously, for any tuning — a fact only found by writing out
both inequalities side by side, not by trial-and-error on numbers.

The correction that actually held: this isn't an algorithm-tuning problem
at all. `comp-upper`'s generic COMP-3000/4000 filter was accidentally
double-purposing capstone's *project* courses as ordinary electives — a
data-modelling gap, not a solver defect. Excluding those three codes from
`comp-upper`'s filter (`excludeCodes`) fixed it with zero risk to every
other allocation the solver already got right, and is checkable by
running exactly the two named tests plus the full suite, not by re-deriving
the formula. The harness itself now encodes the fix (`allocation.test.ts`
tests both pairings explicitly), so a future change to the group tree
that reintroduces the overlap fails a test immediately instead of silently
misallocating a capstone course.

## 2026-09-26 — A grid overflow that no getBoundingClientRect check caught

Resolved by 688c4f4.

Across several human-review rounds a course card kept visually crossing
into the timeline, and every attempt to fix it (removing centering,
raising a breakpoint, resizing the sidebar) left the same symptom. Every
`getBoundingClientRect()` check I ran — including one where the user
pasted the identical measurement from their own Retina browser, byte for
byte matching mine — said the grid fit cleanly. That agreement was the
actual clue: two independently-run measurements can't both be wrong the
same way, so the bug had to be something a bounding-rect check can't see
at all, not a viewport or zoom difference.

It wasn't: `.requirements-scroll` (a `<ul>`) reset only
`padding-block-end`, never the browser's default `padding-inline-start`
list indent, silently narrowing every group's available width below what
its three explicit 13rem grid tracks needed. CSS Grid's explicit tracks
don't shrink to fit, and `overflow: visible` doesn't clip — so the
*painted* cards spilled past the border while the container's own
reported box stayed exactly the size its parent gave it. Fixed with a
full `padding: 0` reset, not a size tweak. Caught only by treating the
disagreement between two matching measurements and one screenshot as
proof the measurement was targeting the wrong thing, not by adjusting
widths until a screenshot looked right — and the sibling fix from the
same session (a global `box-sizing: border-box` reset, since one card's
own padding+border was similarly invisible to a plain `width` check)
closes the same class of bug everywhere, not just here.

## 2026-09-26 — A hover-triggered overlay that only failed under real use

Resolved by 2f58380.

Task 15's plan specified the prerequisite overlay as hover/focus-only:
show lines from a card to its placed prerequisites while hovering or
focused, clear them on leave or blur. It matched the spec, passed axe,
and every `overlayEdges` unit test (the pure edge-selection logic) held.
It only broke under the one thing a unit test can't exercise: a human
actually tracing a link. When a prerequisite sat several terms away, the
natural move — scroll the timeline to see both ends of the line — is
also the thing that fires `mouseleave`/blur on the source card, so the
line vanished exactly when the user tried to follow it off-screen.

The fix wasn't in `overlayEdges` at all (which was already correct and
stayed untouched) but in the trigger: replaced hover/focus with an
explicit "Show prerequisite links" checkbox in `Planner.tsx` that draws
every placed course's edges at once (`view.placements.flatMap(p =>
overlayEdges(view, p.code))`). That removes the transient hover state
that caused the loss, rather than trying to patch the timing (e.g.
delaying clear-on-leave, which would just trade "vanishes on scroll" for
"stale line lingers after moving to a different card").

This is exactly the class of bug the plan's own Human Review step exists
to catch: nothing about it shows up in a jsdom test (no scrolling, no
real hover timing), only in a person actually using the built page. The
correction landed in the plan itself, not just the code — Task 15's
acceptance criteria and human-review script were rewritten to describe
the checkbox, so a future reader of the plan sees the real interaction
contract instead of a stale hover description that no longer matches
what ships.

## 2026-09-26 — A TypeScript HTML parser port checked against real scraped output, not just read-through

Resolved by b1421ab.

Task 16 needed `fetch-pandc.ts` to reproduce `anu_pandc/parse/courses.py`'s
requisite-section extraction exactly, so a live-fetched stub agrees with the
already-committed, already-trusted `data/2027/courses/*.json`. A straight
read-through port — walk the section's DOM, concatenate `.textContent`,
collapse whitespace — looked right and would have passed a superficial
glance. It silently disagreed with the real data in two ways only a
byte-for-byte diff against `COMP2100.json`/`MATH1116.json` surfaced: BeautifulSoup's
`get_text(" ", strip=True)` inserts a separator at *every* text-node boundary,
not just direct-child ones, so a mid-sentence `<a>COMP1110</a>` picks up a
leading and trailing space the naive port dropped; and `get_text()` with no
separator (used for the description) inserts none, so `fromMATH1115` in the
source stays un-spaced. Guessing at "close enough" whitespace handling and
moving on would have shipped a parser that diverges from the offline scraper
on real pages — exactly the kind of drift Task 16 exists to prevent.

The fix: a single `textOf(nodes, separator)` helper that collects every leaf
text node individually (trimmed) and joins with the given separator, used
with `" "` for the requisite section and `""` for the description, matching
BS4's own per-call separator semantics rather than one hardcoded joining
rule. Checked by running the port against two real, live-fetched fixture
pages and asserting exact string equality against the already-scraped JSON,
not just "looks plausible" — the same discipline the offline scraper's own
output already carries.

## 2026-09-27 — "Swipe to hide the nav" was page overflow, found by measuring the render

Resolved by 009ebcf..29a3c5f.

I'd described students swiping sideways to push the site nav off-screen,
and the obvious reading was a missing feature: add a nav-hide toggle and
move on. Before planning that, I had headless Chrome measure
`scrollWidth` on `/plan/example` at five widths. Every desktop width
overflowed by exactly 208px, the nav's width, and 390 didn't. The "swipe"
was a layout bug: `main` was a `width: 100%` flex item whose default
`min-width: auto` pinned it at viewport width beside the nav. Reading the
CSS wouldn't have shown this. The rule looks harmless, and `width: auto`
doesn't fix it, because a more specific rule wins.

Fixing only that would have squeezed the timeline to 124px at 1100, so the
planner now lays itself out from its own width in 3/2/1-column tiers. The
correction landed in the harness rather than just the CSS. `009ebcf` adds a
real-browser Playwright spec to `pnpm check` and CI. `29a3c5f` makes it fail
on any sideways overflow at six widths, and checks tier widths, rendered
track counts and cards staying inside their groups. Planning the container
also surfaced a constraint before it shipped: layout containment would
re-anchor the fixed undo toast, so the toast stays outside the container.
Checked by the spec going red (+208, a 704px aside at every width) then
green, and by before/after renders at 1920, 1280, 1100, 900 and 390. 390 is
pixel-identical.

## 2026-09-27 — The plan's width tokens contradicted its own formula, by 0.2px

Resolved by 29a3c5f.

The plan derived sidebar widths from `n × 13rem + (n − 1) × 0.6rem +
4.5rem` but listed 31rem and 44.5rem for two and three columns. Both drop
the gap term. Implemented verbatim, every test passed except the
card-containment check at 1920, where three cards in a depth-2 group ended
0.2px past their group. The tempting move was to relax the test's 1px
margin, since 0.2px is invisible. That would have hidden a real fit
failure: 2 columns cleared by only 0.4px, so any font or border change
would tip it. Instead I measured the chain from aside to grid in the
browser. The overhead was exactly the 69px the plan budgeted, which put the
error in the tokens, not the budget. I corrected them to 31.1rem and
44.7rem, with thresholds of 63.1rem and 76.7rem, in the plan set and the
code. That also caught a knock-on issue for Phase 04's snap logic:
`(31.1 + 44.7) / 2` isn't exact in floating point, so its "midpoint →
larger" tie-break now carries a tolerance. Checked by the full layout spec
passing unweakened, and by each reference viewport landing in the same tier
as before.

## 2026-09-27 — Right-aligning the wrapped controls so › stays under the finger

Resolved by 63bfa46.

Task 3 moved "Completed through … ‹ › ⋯" into the plan's title row. The
plan wrapped the group onto its own line on a phone with
`justify-content: space-between`, which puts a lone wrapped item at the
line's start. Every test passed, including the plan's check that the
wrapped group starts at the row's left edge. Reviewing the 390px render, I
asked for the group to stay right-aligned when it wraps, because the
readout's width changes with each semester.

That beat the obvious alternatives. Leaving it left-aligned looked fine in
a still screenshot, but the label runs from "Nothing completed yet"
(254px) to "Completed through S2 2027" (293px). So the › button jumps with
each press, and tapping it repeatedly misses. Fixing the readout's width
would also hold the buttons still, but it wastes space on short labels and
depends on the term labels. `margin-inline-start: auto` on the group keeps
‹ › ⋯ at the line's end at every width, matching the one-line desktop row.

The correction went into the harness, not just the CSS. CW24 was amended
in the plan, and a new layout test at 390 and 1920 records ‹, › and ⋯,
presses ›, waits for the readout to change, and requires every button
within 1px of where it was. It failed first on the phone, with the buttons
moving about 36px, and passes after the fix. The old left-edge check was
superseded by a right-edge one, not loosened. So any future change that
lets the controls drift as the label changes now fails `pnpm check`
instead of relying on someone noticing in a screenshot.

## 2026-09-27 — Letting JS tell the undo toast the layout, because CSS can't

Resolved by cbfb2d3.

Collapsing the stacked requirements to a bar along the bottom created a new
problem: dropping a course on the bar shows the undo toast, and the toast
sat directly on top of the bar it had just been dropped on. The obvious fix
is one more rule in the stacked `@container planner` block. It can't work:
a container query only styles descendants of the container, and the toast
has to stay outside `.planner-layout`, because a size container becomes the
containing block for a `position: fixed` child and would pin the toast to
the panes. Moving the toast inside, or repeating the tier thresholds in a
JS media query, would trade one bug for a second source of truth.

The call was to read the layout CSS already publishes. The panes' tiers set
`--reqs-fit` (0 means stacked), and the resize handle was already observing
it. That observer moved into a `useReqsFit` hook owned by `Planner`, which
passes `fit` to the handle and marks the toast `undo-toast-above-bar` only
when the layout is stacked and collapsed. CSS still decides the layout, and
JS only relays it.

The check lives in `spec/`. A new "undo toast placement" test drops a
course on the 390×844 bar and requires the toast to end above the bar. It
failed first with the toast's bottom at 820px over the bar's 780px. Two
more rows pin the toast at 24px at 1920×1080 collapsed and at 390×844
expanded, and the existing resize-handle tests confirm the fit cap still
works after the move.

## 2026-09-27 — Resetting the timeline's stacking, not raising the handle

Resolved by da4a20d.

The plan turned the requirements resize handle horizontal in the stacked
phone layout, drawn 1rem tall with a 2.75rem hit area from a `::before`
that reaches 14px into each pane. Its CSS went in as written, and every
new test passed but one: the plan's hit-area probe, `elementFromPoint`
12px above the line, returned a course card in the timeline instead of the
handle. The handle is later in the DOM and positioned, so on paper it
should have painted on top.

Walking the element chain showed `.planner-timeline-area` at `z-index: 2`.
That value belongs to the base rule, which keeps the unfitted stacked
timeline sticky above the requirements scrolling under it. The fitted
layout makes the pane `position: static`, which I'd assumed disabled the
z-index. It doesn't on a flex item: flex items honour z-index without
positioning, so the timeline was its own stacking context above the
handle.

The obvious fix is `z-index: 3` on the handle. It would have passed the
probe, but it would also have lifted the handle's lower hit area over the
sticky "Hide requirements" button (`z-index: 1`). The plan says that button
must keep winning where the two overlap, and the probe deliberately sits
near the left edge for that reason. So the call was to remove the
irrelevant z-index where it stops meaning anything: `z-index: auto` in the
fitted stacked rule that already makes the timeline static, with a comment
naming the flex-item rule.

The check is the plan's own `spec/` test, now green on both probes. The
unchanged "Hide requirements" tests confirm the button still takes its
clicks, and the fitted-layout and collapse suites all passed (436 of 436).
The amendment is written into the phase file, so the plan still describes
what was built.

## 2026-09-27 — The overlay that measured itself

Resolved by 2f6af65.

The timeline showed two vertical scrollbars, and it scrolled past the
bottom of the semester columns. The obvious guess was the pane's own
`overflow-y: auto` plus too much padding. Measuring in Chromium told a
different story. `.timeline-scroll` only sets `overflow-x: auto`, and CSS
computes the other axis to `auto` as well, so the strip was a second
vertical scroller inside the pane. It had something to scroll because it
was 1463px tall inside against columns 1444px tall.

The extra 19px came from the prerequisite-lines SVG. `PrereqOverlay` sized
it from `scroll.scrollHeight`, but the absolutely positioned SVG is part of
that same scroll size. Once it was set from one tall measurement (taken
before the webfonts arrived and the cards got shorter), every later
measurement read back its own height. It could grow and never shrink.

Hiding the inner scrollbar with `overflow-y: hidden` alone would have
looked fixed and left the bug in place: a box with `overflow: hidden` can
still be scrolled from script, and the timeline's "locate this card"
`scrollIntoView` would have nudged it by the stale overhang. So the fix
does both. It pins `overflow-y`, and it collapses the SVG to 0×0 before
reading the size, so the measurement only sees the columns. A
ResizeObserver measures again when the columns change size without a new
view (fonts, window resizes), so the lines stay on the cards as well.

The check is a new `spec/layout.test.ts` case at both marking viewports.
It asserts the strip's `overflow-y` is `hidden`, that it has no inner
vertical overflow, and that the SVG ends at the bottom of the tallest
column. It failed before the change and passes after, with `pnpm check`
green on all 438 tests.

## 2026-09-27 — Mouse drop-target outline: document dragover over per-term dragleave

Resolved by a7936e0.

Touch drags outlined the term under the finger in gold; mouse drags didn't,
and the outline also lit up hard-blocked (greyed) terms, promising a drop the
planner would refuse. The obvious mouse implementation is per-term state set
on `dragover` and cleared on `dragleave` when `relatedTarget` falls outside
the column — the standard guard against dragleave firing on every move
between a column's own children. It typechecked, built, and every existing
spec passed.

I didn't trust that, because no existing spec exercised a mouse drag over a
term at all. So I wrote one first-class browser check per marking viewport
in `spec/layout.test.ts`: a real Playwright mouse drag at 1920×1080 and a CDP
touch drag at 390×844, each over a blocked term (no outline) and an allowed
one (outline). The mouse case failed: Chromium leaves `dragleave`'s
`relatedTarget` null, so the guard cleared the highlight on every child
crossing. The fix mirrors what touch-drag.ts already does — while a drag is
live, a single document-level `dragover` resolves `closest("[data-term]")` —
and the blocked-term rule became one selector,
`.term.drag-hover-target:not(.term-disallowed)`, shared by both paths.

How I knew it was right: both specs pass, and removing the `:not()` guard
makes both fail, so the check actually pins the behaviour. Mid-drag
screenshots at both viewports confirmed the outline on the allowed column
and none on the blocked one.

## 2026-09-27 — Drawing every qualifying prereq, dashed, instead of picking one

Resolved by e6f492d..5c1b394.

I noticed COMP3242's "6 units of (COMP3670 or MATH1013 ...)" and
COMP2300's "6 units of 1000-level MATH" never linked the MATH course I'd
placed. Rather than patch those two, I had the whole catalogue's parsed
requisites run through a scan that bucketed every leaf kind. It showed
the overlay only followed plain course leaves: 6 code-list pools and 29
subject/level pools drew nothing. It also turned up a second gap, a start-
vs-last-term mismatch with evaluate.ts for two-semester courses, and a
separate parser problem (COMP4880's "all of the following: COMP1110" is
lost as unverifiable text) that I've kept out of this fix.

The obvious way to show "one of several" is to pick the single course
that satisfies it. I rejected that: the choice is arbitrary and would
jump as cards move. Instead every qualifying placed course gets a line,
and the edge carries a kind. Required (named on an all-AND path) draws
solid; option (an OR branch or pool member) draws dashed, so two MATH
lines into COMP2300 don't read as "needs both". I also reversed hover:
with links on, it now dims the rest of the graph instead of hiding it,
and with links off it draws nothing.

How I knew it was right: I printed the edges for a test plan and checked
each one against the P&C wording (COMP2310's "COMP2300 or ENGN2219"
correctly comes out as an option). Unit tests pin each edge kind and the
two-semester timing. A new spec/layout.test.ts check runs the real
render at both marking viewports. It first failed on my own assumption
of 4 hovered lines: it was 7, because hover also highlights COMP3242's
outgoing links, which is correct.

## 2026-09-27 — Closing the loophole in the "no silent drops" invariant

Resolved by b8a9cf0.

While completing the prereq overlay, a catalogue scan showed eleven
undergrad courses with real codes stuck inside unverifiable text.
COMP4880's COMP1110, COMP3425's whole "6 units from COMP1100 or ..." list,
and the INFS "at least one of the following" lists were never checked or
linked. And because an unverifiable leaf under an AND never counts as
met, those courses stayed flagged no matter what was placed. The parser
already had a whole-catalogue "no silent drops" invariant, and it passed.
It counted a code as found if it showed up anywhere, *including inside
unverifiable prose*, so the check was blind to exactly this failure.

The obvious fix was to patch each phrasing and add a fixture for it.
That would have fixed these eleven and left the next new phrasing just
as invisible. So the correction went into the harness first: a stricter
invariant fails on any code left in an unverifiable leaf for the
courses the planner loads. Its three exceptions are each named with a
reason (MATH1115's permission condition, MATH2222's mark thresholds,
SOCY2166's conditional concurrency). Then came one fixture per phrasing,
all red before the parser changes.

How I knew the fixes were right and nothing else moved: I dumped every
course's parsed tree before and after and diffed them. That diff caught
a regression the tests didn't: making "including" a connective (needed
for MATH2307) also chopped COMP4550's prose verify text in two. I
narrowed it to "including" only when a code or "either" follows, and
pinned that with a test. The final diff changed only the intended
courses plus five postgrad ones, all improvements. COMP4880 also had a
real semantic bug, now fixed: COMP3670 alone suffices again.

## 2026-09-27 — "Unknown" as a third answer, not a permanent warning

Resolved by 4f1d275..442bee8.

After the parser fixes, COMP4550 and COMP4011 in the example plan still
said "Needs prerequisites", even though every checkable requirement was
placed. The evaluator gave an unverifiable leaf (a permission code, a
mark, a WAM) `ok: null`, but its "and" demanded every item be exactly
`true`. Meanwhile feasibility treated the same leaf as met. So the two
disagreed, and 21 of 87 undergrad courses could never become Available,
whatever the plan.

The obvious fix was to treat those leaves as met and let the existing
"Verify on P&C" line carry the caveat. I rejected that because
"Available" would overclaim for a course gated on a WAM of 70. I chose
three-valued logic instead: an unmet item still makes an "and" false and
a met one still makes an "or" true, otherwise "unknown" wins. Unknown
gets its own neutral "Check requirements" state, not the amber warning.
The same review found a second false alarm. The card's "N prerequisites
not placed" counted every alternative of an "or", even one already
satisfied. It now counts the fewest more courses needed.

How I knew it was right: a truth-table test pins each and/or case, and
MATH1116 goes to "check" with MATH1115 placed (only the mark is left)
but "soft" without it. The check that guards against regressions is an
invariant: the example plan, which is meant to be a complete plan, must
have no placement still flagged "soft". It failed on five courses before
the change and passes now. I also rendered the new badge at both marking
viewports, against the built server and a throwaway database.
