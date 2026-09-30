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

## 2026-09-27 — A passing invariant that checked presence, not structure

Resolved by 09b79ac..4ff0f9c.

I had just tightened the parser's harness so no course code could be
left in unverifiable prose, and it passed. Then I noticed COMP4500 was
still read completely wrong. Its two degree routes (AACOM with COMP2120
and 12 units at 3000/4000 level, *or* AENSE with COMP3500) had been AND'd
into one list. An AACOM student was being asked for COMP3500 and the
AENSE degree too. Every code was in the tree, just joined the wrong way,
so a presence check could never see it.

The obvious fix was a COMP4500 fixture next to the others. I did that,
fixing the four gaps behind it: an "OR" opening a sentence now joins the
routes, "You also must be studying:" is a lead-in, program names can
carry a mid-name "(Honours)", and a level total can have no subject. But
a fixture only protects the one course. What actually went missing was
the degree codes "(AACOM)" and "(AENSE)", which fell into prose. So a
second invariant now fails on any bracketed program or subject code left
in an unverifiable leaf.

How I knew it was right: I ran the new invariant against the *previous*
parser and it flagged exactly COMP3500 and COMP4500. COMP3500 had the
same lead-in bug, unreported. The invariant passes on the fixed one. A
before/after dump of every tree showed the evaluation changed only for
those two courses; everything else was prose merging into one verify
line. A real-catalogue test checks the AACOM route alone reaches "Check
requirements" and drops to "Needs prerequisites" without COMP2120. In
the built app's Details panel, the two routes show as separate "All of"
groups.

## 2026-09-27 — A cosmetic report that turned out to be a crash

Resolved by 3db2ac1.

Claude reported that COMP4500's "Pin to" list showed raw group ids. I
pushed back, since in my plans it showed labels, and I was right for any
plan with a capstone chosen. The ids only appeared in a new plan with no
capstone picked. There, the list included every capstone option's
groups, and those groups weren't in the active tree that labels come
from.

The obvious fix was to filter the dropdown, which is one line in the UI.
Instead I had the same list traced to the server, because the pin check
used the same function. That turned up the real problem. Pin a course
under one capstone option, then switch capstone, and the allocator threw
on the now-ineligible pin. The switch and every later load of that plan
returned 500, so the plan was broken for good. A UI-only filter would
have hidden the ids and left the crash in place.

The fix works at three levels. There's one "active eligible leaves" rule
for the dropdown, the server's pin check (now a 409) and the allocator.
Changing a choice clears any pin it invalidates, in the same
transaction. And building the view treats a leftover stale pin as
Automatic instead of throwing, so plans already saved in that state
render again.

How I knew it was right: we reproduced the 500 against the built server
with a throwaway database before touching code. Five tests were written
first and all failed: two unit, one view (a stale pin must not throw),
and two API specs (409 for an unchosen option; switch capstone → 200,
page 200, and switching back doesn't revive the pin). After the fix the
same curl sequence gave 409 / 200 / 200, and Pin to lists only the
chosen option's labelled groups at both viewports.

## 2026-09-27 — A labelling rule tested on two courses, run on all of them

Resolved by 4034947.

The manual-checks spec labels a verify item with the course it's AND'ed
with, so MATH1116's fragment "with a mark of 60 or above" reads "MATH1115
with a mark of 60 or above". The plan wrote that as "an unverifiable leaf
whose parent AND contains exactly one course leaf", with label tests on
MATH1116 and COMP4550 only. Two of the plan's own synthetic tests then
failed: their fixture, `AND(course, item)`, qualified under the rule, but
the expected strings used the bare text.

The obvious fix was to make the tests match the code, or the code match
the tests. I did neither before running the rule over every undergrad
course and listing each label that differed from its text. The rule got
MATH1116 and MATH2222 right but produced "COMP2100 Competitive entry based
on application and interviews" on COMP4820, "COMP3900 You will need to
contact the School of Computing…" on COMP4020, and similar labels on
COMP3770 and COMP3430. Those are sentence-level ANDs that happen to hold
one course. The earlier parse change (b5f5984) had just moved COMP4820's
permission items into that AND, so the rule would have mislabelled the
feature's headline example.

The call was to narrow the rule to the parser's real shape for "CODE
followed by its qualifier": an AND of exactly one course and one item.
It's the same shape the synthetic fixture has, so those tests now expect
the labelled string, as FR 5 says they should. I checked it by re-running
the catalogue-wide listing. The labelled set shrank to MATH1115, MATH1116
and MATH2222, all correct readings. The correction also lives in the
harness: `verify-labels.test.ts` now pins COMP4820's and COMP4020's items
to plain text, so a rule that widens again fails on real data, not just
on the one course the plan thought of.

## 2026-09-27 — A spacing test that passed before the fix existed

Resolved by cb2b3f2..a261afe.

A course card's buttons sat flush against each other. The obvious check
for the fix was to measure the gaps between the children of the new
`.course-card-actions` row. I wrote that first and ran it against the
unfixed code as a red step, and it passed. The old markup had no
`.course-card-actions`, so the check measured nothing and reported "no
touching pairs". That test would have guarded only the new structure. A
later refactor that dropped the wrapper would still pass it, which is the
exact regression it was meant to catch.

The rewrite measures the render, not the markup: every visible button on
every card, pairwise, at both marking viewports. It asserts that at least
one pair was measured, so an empty selection fails instead of passing
quietly. Against the rebuilt unfixed code it went red with the real
failures (`COMP1130 Move to…/Details: 0.0px`, including a vertical 0px
between wrapped rows that I hadn't noticed), then green with the fix.
Because the specs run against the built `dist/`, each red/green step
needed a fresh `pnpm build`. Without that, the "red" run would have been
testing stale output.

I applied the same rule to the two sibling fixes in the range. The
opacity check multiplies opacity up each button's whole ancestor chain,
because opacity set on the card, not the button, was the actual bug, and
it went red on the old CSS before going green. The hover-border check
pins the computed border width at rest and on hover, since the defect
was a cascade-order slip that no markup inspection would show.

## 2026-09-28 — Bounding SSR assertions to the card, not a character count

Resolved by 469404b.

Adding the new card header (grip SVG, a wrapper div, a title button)
broke three `spec/planner.test.ts` checks that the plan never listed:
`sidebar-placed" draggable="false"[\s\S]{0,60}COMP1100` and two
`data-placed="…"[\s\S]{0,400}<badge text>`. Nothing they tested had
changed. The markup between a card's opening tag and its text had just
grown past a guessed window.

The obvious fix was to widen the windows (60→200, 400→900). I rejected
it. It loosens each assertion, since a larger window can reach into the
next card's markup and match there, and Phase 03's strips and dots would
push the text past the new numbers anyway. Instead each regex now
searches `(?:(?!<dialog)[\s\S])*?`, which runs from the card's opening
tag to its Details dialog (the card's last child). The text has to be in
that same card's body, however long the header gets. That's stricter
than before, not looser.

How I knew it was right: the full `pnpm check` went from 6 failures to
535/535. The same run also caught a real regression the source didn't
show. The new visually-hidden unit text, being absolutely positioned,
escaped the sidebar's scrolling strip and widened the page to 3351px at
390px, found by listing absolutely positioned elements past the viewport
edge. Making `.course-card` `position: relative` fixed it, and the 390×844
screenshot confirmed it. The corrections live in the tests themselves, so
later phases that grow the card can't reintroduce either failure.

## 2026-09-28 — Choosing the card menu's panel from renders, not the plan

Resolved by 6c90d4a.

The plan anchored each timeline card's three-dot panel to its toggle
with `position: absolute`. Every Task 2 test passed, including one
asserting the panel sat inside `.timeline-scroll` horizontally. The
screenshot didn't: only "Details" showed. `.timeline-scroll` is
`overflow-x: auto`, which forces vertical clipping too, so it cut the
panel off at the column's content height (panel 293–547px, scroller
76–353px).

The obvious fix was the simplest one: open the panel in place and let
the card grow. It was built, and I nearly shipped it. I stopped the
check run and asked how the floating alternative would handle the edge
cases instead of judging from a description. Five cases were rendered
side by side with the floating version simulated by injected CSS/JS:
top card, lowest card in a full column, last column, and phone top and
low. In place avoided overlap but pushed the card's own header out of
view on a phone. Floating stayed next to its toggle in the common cases,
so I chose it, with a flip-above rule, viewport clamping, a max height,
and close-on-scroll so it can't detach from its toggle.

How I knew it was right: the test that had let the clipping through was
changed. For each button in the panel it now requires
`document.elementFromPoint` at the button's centre to hit that button,
and requires that no `overflow-y: hidden` ancestor was scrolled to get
there. The ancestor guard matters: the first version passed on the
clipped panel, because `scrollIntoView` quietly scrolled the hidden
overflow. With the guard it failed on the clipped build and passed on
the floating one. A new close-on-scroll test failed with its listener
disabled. The real build's screenshots matched the approved simulation
in all five cases.

## 2026-09-28 — Keeping a row's status test strict and changing the CSS instead

Resolved by 9f2b8c5.

Phase 02's plan specified a compact row for placed courses, with two
lines that contradicted each other. The CSS made the status line
`display: flex; gap: 0.35rem`, and the test required its `innerText` to
be "Completed S1 2027". Built as written, the render read
"Completed\nS1 2027": flex blockifies its children, so Chromium's
innerText breaks the line between the word and the term button, even
though the markup has a plain space.

The obvious fix was the test. Switching to whitespace-normalised
`textContent` would have passed at once and kept the planned CSS. I
kept the test instead, because `innerText` is the closest proxy the
spec has for how the status reads as a phrase. Normalising it away
would have hidden exactly the kind of drift the test exists to catch.
I dropped the flex and let the source's space and the inline button do
the spacing, then amended the plan's CSS line, so the plan still
describes what was built.

How I knew it was right: the same test, unchanged, failed on the flex
build and passed on the inline one. Screenshots at 390×844 and
1920×1080 showed the word and the term button still aligned, with the
same gap, in both the two-line and the one-line layouts.

## 2026-09-28 — Persisting colour families as data instead of patching them in on load

Resolved by 0265a2e.

Phase 03's plan put a `family` on each top-level `GroupDef` in
`aacom-2027.ts` and resolved it in `view.ts`, on the premise that
"another program only has to edit data". Implemented as written, every
new family test passed — but the unit suite's existing seed test,
"loadProgram round-trips AACOM_2027", failed: `family` vanished. The
plan had missed that the running app never reads `AACOM_2027` at request
time; seed writes it into SQLite and every view comes from
`loadProgram(db)`. Shipped as planned, every group would have rendered
neutral grey in the real app while the unit tests stayed green.

Two fixes were on the table. The one with no migration — have
`loadProgram` copy families from `AACOM_2027` by group id — would have
made the round-trip test pass by re-injecting the value from outside the
DB, silencing the very check that caught the gap, and would reintroduce
the hard-coded lookup the plan set out to avoid. I chose a nullable
`requirement_groups.family` column instead (migration 0004), even though
the overview said "no schema change": that rule protects saved plans and
the API, and this is a reference table seed rebuilds on every boot. I
recorded it as a scoped exemption, overview ruling 4, so later phases
don't re-litigate it.

The evidence it was right: the round-trip test passes unmodified, so it
still proves nothing is lost between data and view, and `pnpm check` is
green with 574 tests.

## 2026-09-28 — Paying for the term bar by removing a line, not shaving margins

Resolved by b29353a.

Task 10 added a family bar under each term's "N/24 units" line, with a
hard limit: the timeline may move down at most 10px at 390×844, because
every pixel there comes out of E10's phone budget (first card fully in
the pane). I measured before and after on the built app rather than
trusting the CSS arithmetic: term 0's first card went from 330.5px to
341.3px, a 10.8px shift. The plan's own numbers (6px bar + 8px margin −
3.2px trimmed) could never meet its own limit.

The obvious fix was to shave the bar's bottom margin to 0.4rem, which
lands at 9.2px — inside the limit, but still spending 9px of the tightest
budget in the app and leaving the header a line taller than it needs to
be. Instead I moved "N/24 units" onto the heading's line, right-aligned
the way a course card already shows "6u", so the header loses a whole
line. The bar then costs nothing: the same measurement now reads 320.7px,
9.8px *higher* than before the bar existed, which also hands slack back
to E10 for Phase 06.

Because a header change ripples, I checked who else builds on it before
editing: Phase 05's Task 15 puts a "Completed" label inside that same
count, so I updated its plan to say it now shares the heading row, and
its existing "header height unchanged within 2px" check is what will
catch it wrapping in a narrow column. Verified with `pnpm check` (591
tests) and renders at both marking viewports.

## 2026-09-28 — Turning a highlight that passed every test into a checked rule

Resolved by 1f549b5..9178eaa.

Task 11's plan gave the sidebar highlight `outline-offset: -3px`, drawn
inside the box so the phone's horizontal strip (a scroller) couldn't clip
it. Every spec test for the jump passed: the right group was highlighted,
focused, scrolled into view and cleared. The screenshot of a "What's left"
jump to a check row showed what those tests couldn't: the gold line sat
over the row's text, so "not tracked" read as "hot tracked", and the
nested "Artificial Intelligence — foundations" heading touched it too.
Top-level sections have padding for an inset outline. Check rows and
nested groups have none.

The obvious fixes were to leave it for the final human review, or to
pad the rows. Padding would shift the sidebar's layout everywhere to fix
something visible for 2 seconds. Instead I asked what the inset was for:
only the strip's own items get clipped. So the outline sits outside the
box (+2px, like the timeline card highlight) everywhere except
`.requirement-group`, where it stays inset. The user ruled on the
deviation before I changed a value the plan fixed, and I updated the plan
in place.

A second look at a screenshot wouldn't stop this coming back, so I added
a spec check for the rule itself. For a highlighted check row, nested
group and top-level group, the outline's inward reach
(`max(0, -outline-offset)`) must be at most border plus padding on every
side. It failed red on exactly the two cases the screenshot showed (a
3px reach into 0px of room) and passed on the top-level group. After the
fix it's green, as is `pnpm check` (615 tests), and re-rendered at both
marking viewports.

## 2026-09-28 — Matching the completed-semesters menu to its neighbour, not the platform

Resolved by 0439dbc..6ff5939.

The plan replaced the ‹ › chevrons, which read as carousel arrows, with
a native `<select>`. That's the obvious accessible choice: the platform
gives you keyboard handling, the name and the value for free. It passed
every test it was given. Seeing it rendered, I stopped the task: a
browser-styled select sat right next to the More options disclosure and
looked like it came from another app. The row now had two different
kinds of dropdown for what users see as the same kind of thing.

I ruled that it should be a disclosure in More options' design, and that
read-only plans show plain text instead of a greyed control, as CR11
already does for Place in…. The plan was updated in place (E6, Task 14,
and the Help references Phase 06 depends on) before any code changed.

Two things made the new version more than a restyle. Reusing
`MoreOptions` was the obvious route, but the spec finds the page's More
options by `querySelector(".more-options-panel")`. A second instance
earlier in the row would have quietly retargeted three existing tests,
and they would have passed while measuring the wrong control. So
`CompletedMenu` has its own classes and shares only the look. Second, a
text toggle changes width with its label ("Nothing completed yet" vs
"Completed through S2 2027"), which would shift More options on every
change. All the labels share one grid cell, so the toggle is always the
widest label's width. The spec asserts both controls' left, right and
top edges move ≤ 1px when the cutoff changes, at both marking viewports.
The Escape, one-open-menu and axe-when-open checks were red first and
are now green, `pnpm check` passes 647 tests, and I checked the render
closed and open at both viewports.

## 2026-09-28 — Moving "Hide requirements" out of the scroller instead of patching its bar

Resolved by 0e5c9ce..6e0a169.

E2's plan put the sidebar's hide button in an opaque sticky bar, so
cards would scroll under it instead of showing through beside it. Built
as written, it passed its own test, but the full suite caught an
existing one failing: on a phone, the resize handle's hit area reaches
14px into the requirements, and the new full-width bar swallowed it.
The obvious move was to fiddle with z-indexes. I found there's no
setting that works: a sticky element is its own stacking context, so
the handle can't sit above the bar while the button sits above the
handle. Each patch meant a trade-off (a smaller handle target, a button
that starts a resize, or a taller bar).

Offered those trade-offs, I asked instead whether the button needed to
be there at all. The real cause was a sticky control inside a
scrolling pane, and every trade-off only managed that. I chose to move
the button out of the aside onto the handle itself, as a small chevron
chip. It sits in a zero-size flex item whose negative margins centre
its 44px target on the handle's line, so it takes no row. That gave
back the 52px the old button's row took, and the handle and the button
no longer fight. The plan (E2, Task 16, and the Help list Phase 06
relies on) was revised and committed before any code.

How I knew it was right: the new spec asserts the button is outside the
aside, centred on the handle within 2px, 44px square and axe-clean, and
that the sidebar content starts at the top (≤ 8px, red at 52px). The
phone hit-area probe that failed under the bar passes unchanged. The
render then showed something the tests didn't: on a short page the chip
floated over the sticky timeline. I added a check for that
(`elementFromPoint` at the chip's centre must belong to the timeline),
watched it fail, then fixed the z-index.

## 2026-09-28 — Re-setting the phone height budget from a measurement, not a lever

Resolved by 215e7a0.

E10 backed "shorter cards" with a `spec/` budget. On the phone that meant
the first card fully in the timeline pane, plus half the second. The plan
gave five spacing levers, each with a floor, and one rule: if a budget
still fails at the floors, stop and ask. No clamping text, and no other
rules.

The levers went in one at a time, re-measured after each. Two did
nothing, and each got a cause before it counted as spent. The "Counts
toward" font lever lost on specificity (`button.course-card-allocation`
set its own 0.85em), so it had to cover both rules. The badge-margin lever
couldn't work, because the only badge on those cards is visually hidden
and out of flow. With all five at their floors, the phone showed 46.0px
of the second card against the 55.0px it needed.

The obvious move was one more lever, footer line-height. Worked through,
it missed by 0.04px, and a budget that passes on rounding is no budget.
The measurement showed where the height was: COMP1130's title and its
"Counts toward" each wrap to three lines, which no rule may shorten. So
the target was wrong, not the spacing. Claude proposed "the second card's
code line is visible", which is enough to show another course follows. I
chose that over adding levers, and it went into the plan as ruling 6
before the test changed.

How I knew it was right: the desktop median went from red at 159.4px to
green at 149.0px, keeping only the three levers that were needed. On
failure, the spec prints the sorted heights and the pane geometry, so a
regression shows its numbers. One number in Claude's report ("149.9")
came from a run nobody had seen. It was re-measured before the commit.

## 2026-09-28 — A green menu test that the render contradicted

Resolved by 217be2a.

Phase 02 Task 3 made Place in… and Move to label each option for a
two-semester course as a range ("S1 2028 – S2 2028"). The plan's tests
checked the menu *text* against a range regex, and they went green. The
obvious next step was to commit.

The CLAUDE.md rule that the render is the truth caught what the text
check couldn't. Screenshots at 1920×1080 and 390×844 showed every Place
in… option broken over two lines ("S1 2028 – S2 / 2028"). The list is
absolutely positioned inside an inline-block only as wide as its toggle,
so it shrinks to `min-width: 9rem` (144px). The ranges don't fit, and each
item measured 59px against about 38px for a single line. Move to sits in a
wider panel and was fine, which is why it didn't show up in the source.

The fix touched a file the task didn't name, so Claude stopped and asked
rather than widening scope. I ruled to fix it inside Task 3, and the
change went into the plan before the commit. Instead of a one-off CSS
tweak, the spec now counts each option's line boxes with a DOM Range and
requires exactly one. A future label that is longer, or a narrower
toggle, fails the test rather than a screenshot.

How I knew it was right: with the `nowrap` rule stashed, the new
assertion failed with `[2,2,2,2,2]`, and with it in place the test
passed. Re-rendering at both viewports showed single-line items (37.6px)
and no horizontal overflow. The same run surfaced a flaky test (MoreOptions
closes on scroll, and a click on the off-screen term 4 card scrolled). It
was fixed by scrolling first, and the test was then red twice for the
right reason before going green three times.

## 2026-09-28 — The part 1 marker broke inside its term label, and the spec only read text

Resolved by ca396a7.

Phase 03 Task 5 added a line under a two-semester card's title, "Part 1
of 2 · continues in S2 2030". Its spec checked the line's innerText, which
passed, as did `pnpm check`. The obvious move was to go on to Task 6.

The render check caught what the text check couldn't. At both 1920×1080
and 390×844 the 13rem card broke the line inside the label ("continues
in S2 / 2030"). This is the same kind of defect the Place in… ranges had
(217be2a), in a different component. Overview §2.4 already said a term
label must never break inside itself. The plan's CSS didn't enforce that,
so Claude finished the independent tasks (6–9) and then brought it to me
before closing the phase, rather than improvising a fix. I ruled to fix
it in Phase 03.

Why this beat the quick fix: putting a non-breaking space into the string
would have leaked ` ` into innerText and the unit tests. Instead,
`partOneMarker` returns the text and the term label separately, and the
card holds the label in a `white-space: nowrap` span. The visible text
is unchanged, so the existing spec didn't move. The plan's Task 5 and the
overview's signature were amended in place first.

How I knew it was right: a new spec counts the label's line boxes with a
DOM Range at both viewports. With only the `nowrap` rule removed it failed
with `expected 2 to be 1` at both sizes, and with the rule back it passed.
Re-rendered cards show "S2 2030" wrapping as a whole. The card height
budget was unchanged.

This kind of label wrap has now come up twice, both times caught only by
a screenshot. One check over every rendered term label would catch the
next one without it.

## 2026-09-28 — Giving server-rendered states their own route list instead of bending a test

Resolved by 5e0ee92.

Phase 02 asked for `/plan/example?course=COMP2100` to be added to
`spec/routes.ts` `ROUTES`, so the jsdom invariants would cover the
server-rendered details sidebar. Doing exactly that turned `pnpm check`
red in a test the plan never mentioned. The layout suite's "the tab shares
the title's row and covers nothing" check also loops over `ROUTES`, and at
390px the plan's interim drawer (`width: min(440px, 100vw)`) covers the
whole screen, nav tab included.

There were two obvious moves, and each quietly lost something. Filtering
`.details-panel` out of that test's "covered" list would weaken a
geometry check to fit one state. Leaving the route out would drop the
invariants coverage the plan wanted. The conflict was really about what
`ROUTES` means: it had silently become two contracts, "every page, for the
invariants" and "every page's default chrome, for layout geometry". A
`?course=` URL is a state of a page, not a page.

So the harness now says so. `STATE_ROUTES` is a separate list that only
`invariants.test.ts` reads, and a comment explains why it stays out of the
geometry test. That keeps both contracts intact. The next server-rendered
state (a phone sheet, a palette opened from the URL) has a named home, and
nobody has to rediscover why it can't just join `ROUTES`.

I checked it from the other side. The full suite went green with
invariants and jsdom axe running on the new route (737 tests). The one
real product gap left, the phone drawer covering the nav tab, is recorded
in the phase file as interim, for Phase 07's bottom sheet to close. It
isn't hidden by a test exception.

## 2026-09-29 — The knock-on warning passed every test and still couldn't be seen on a phone

Resolved by 16c526a.

Task 10 adds a knock-on warning to the undo toast ("COMP2120 now misses a
prerequisite."). Its spec asserted the toast's `textContent`, and it was
green at both marking viewports, as were the full suite and axe. The
obvious call was to commit. The render said otherwise. At 390×844 the
details panel covers the whole screen at z-index 40, and the toast sat
at 10, so any change made from the panel (every strip move, and Remove
since Phase 02) offered its Undo invisibly. Raising the toast then showed
two more problems. The one-line ellipsis cut the sentence off at "COM…",
and `left: 50%` squeezed the toast to half the screen. The part that had
been truncated was exactly the warning the task existed to show.

`textContent` can't see any of this. It reads the DOM, not what's
painted, so text-based assertions pass whatever covers or clips the
text. Instead of trusting the green run, I took screenshots, and I asked
before changing the toast's layering because it touches what Phase 07's
sheet will build on.

The fix is in the harness as well as the CSS. A new 390×844 spec checks
three things. The toast is the element actually hit at its own centre
(`elementFromPoint`), not just present. Its text isn't clipped
(`scrollWidth <= clientWidth`). It spans the phone's width rather than
half of it. Without the CSS change, the spec failed at the first check.
With it, the full suite is green (811 tests), and the phone screenshot
shows the whole sentence wrapped beside Undo.

## 2026-09-29 — Measuring the slow check before fixing it, then budgeting it

Resolved by 404caf9..8b86423.

`pnpm check` had crept up to about seven minutes, one phase at a time.
The obvious explanations were "more tests" (nothing to do) or trimming
fixed waits. Neither had been measured. A JSON-reporter run gave per-file
and per-test times. One file, `spec/layout.test.ts`, took 416s of the
roughly 420s: 299 browser tests at a median of 1.2s with no outliers,
while every other file finished inside 2s. Vitest runs a file's tests
serially and only runs files in parallel, so that file set the wall time
by itself and grew with every plan. So the fix is structural, not
per-test.

The 33 `describe` blocks moved by script into eight
`spec/layout/<area>.test.ts` files, balanced by the measured suite times.
A second script confirmed every block survived byte-for-byte, and the
test count stayed at 827. Three consecutive full runs were green in
66–69s. That also settles the real risk, which was flakiness from
timing-sensitive tests running under parallel load.

A split only holds if nothing grows back, so the correction also went
into the harness. `spec/suite-size.test.ts` fails any browser spec file
over 1,000 lines (about 80s at the measured median) and names the fix.
I proved it fails on the pre-split file and passes now. CLAUDE.md says
where browser suites go and to measure before guessing. The global
`plan-feature` and `execute-plan` skills now check runner parallelism
when planning tests, and watch the check's time against a baseline while
executing.

## 2026-09-29 — Placing Undo/Redo on the phone header without loosening its budget

Resolved by 4eed02d.

The plan put the new Undo/Redo buttons straight after "Completed
through". That worked at 1920, but at 390×844 the two 44px buttons took
the room that label needed. "Nothing completed yet" wrapped onto two
lines, and the header grew to 108px, past the existing "plan title row"
budget of 100px. There were two obvious ways out. Raising the budget
would make the test fit the code rather than the other way round. Hiding
the buttons on phones would break UR13.

I measured where the space went (the Completed toggle shrank from 298px
to 198px). Then I mocked the alternative by injecting CSS into a
screenshot only, and asked with measured numbers for each option. The
choice was Undo/Redo at the end of the title's line on phones. My first
build used `display: contents`. It matched the mock but broke an
existing spec that measures the controls' wrapper box, which Task 4's
acceptance required to pass unchanged. Instead of editing that spec, I
positioned the buttons into the title's line (given a 44px minimum
height) and kept the wrapper. The existing suite passed untouched, and
the header measured 96px.

The check is in the harness. A new 390 case asserts the buttons are
centred on the h1's line, and that the Completed toggle is at most one
control tall, so the original failure can't come back unnoticed. The
user accepted the header at both viewports in human review.

## 2026-09-29 — A phone palette with no way out, caught in the render, not the suite

Resolved by 75f3430.

Workspace-redesign Task 11 moved course search into a modal palette. The
plan says Escape or a backdrop click closes it, and that on phones it's
full screen. I built that as written, and all 874 checks passed,
including the new palette suite: focus trap, Escape, backdrop click, axe
at both viewports, and the 390 full-screen box.

The obvious next step was to commit. A green suite and a plan followed to
the letter look like done. But CLAUDE.md says the render is the truth, so
I screenshotted the palette at 1920×1080 and 390×844 first. The 390 shot
made the gap plain. Full screen leaves no backdrop to tap, and a phone
has no Escape key, so a phone user who opened search could only leave by
placing or opening a course. Every close path the plan named was
reachable only on desktop. That's why the suite, which tests those paths
where they exist, couldn't see the problem.

Adding a button on my own would have been scope creep beyond the plan,
and a silent departure from it. So I stopped and asked, with three
options: a close button everywhere, one on phones only, or leaving the
gap for Phase 07. The ruling was a close button everywhere. It went into
the phase file first, then a test that fails without it: "a 44px close
button closes it" at both viewports, checking size, that it closes, and
that focus returns to the trigger. The button reuses the details panel's
44px icon-button style, so it added no new CSS. The next check ran 876
tests, all green, and a fresh 390 render showed the button beside
Search.

## 2026-09-29 — A glass allowlist check that can't pass by finding no glass

Resolved by 67ef119.

WR22 limits frosted glass to floating layers. The obvious check walks the
page and asserts that every element with a `backdrop-filter` matches the
allowlist. The catch is that this passes just as happily when nothing is
frosted at all. So I made it assert the other direction too: with Details
and the palette open, `.details-head` and `.palette` must actually be
frosted. I added a static pass over `src/styles.css` as well, because
Playwright can't emulate `prefers-reduced-transparency`. It requires the
`.glass` fallback, and it requires every `backdrop-filter` declaration to
sit on an allowlisted selector.

That second assertion failed on a build where the CSS was plainly
correct. Reading `dist/` showed why. The minifier had collapsed the
`backdrop-filter` / `-webkit-backdrop-filter` pair to the last one, the
prefixed form, which Chromium ignores. Glass was shipping nowhere, and a
one-way allowlist test would have been green. Reversing the declaration
order fixed it. The comment on `.glass` says why the prefixed one comes
first, so nobody "tidies" it back.

I knew the fix was right because the same test went green on the rebuilt
`dist/`, with no change to the test. The rendered screenshots showed the
Details head frosting its sections. The rule now lives in the harness:
glass added off the allowlist fails `pnpm check`, and so does glass that
silently stops rendering. The allowlist already names Phases 06–07's
layers (`.size-tip`, `.tabbar`, `.sheet-head`), so they're covered before
they exist.

## 2026-09-29 — Working the layout plan's numbers before building it

Resolved by 20d5be8.

Phase 06's plan specified the layout engine step by step, and the obvious
move was to transcribe it: the steps were precise and the tests were
named. Before writing code I worked the plan's own test cases through its
formulas by hand, and two didn't hold. Step 5 ("shrink the sidebar":
`details = max(DETAILS_MIN, avail − reqs − TL_MIN)`) would *widen* a
docked 440px panel to 638px at a 1920 viewport, contradicting the test
beside it that says it "docks 440". Worse, the drag rule let Requirements
grow up to the room left beside the *minimum* details width, while the
engine steps Requirements down *before* it shrinks details. So a user
widening Requirements past the room details left would watch it jump back
a whole column in the middle of the drag: exactly the "snaps fighting
you" the Task 19 review would reject, found only after a full UI build.

I ruled that step 5 only ever shrinks (a `min`), and that a Requirements
drag squeezes details down to their minimum in the preferences it
returns, so the engine keeps what was dragged. Both went into the phase
file's rulings before any code, so the plan still describes what was
built. The check that the result is right is in the unit suite, not in
my arithmetic: "opening details at 1664 … docks 440" and "widening
requirements beside docked details squeezes details, not the columns"
feed the drag's preferences back into `computeLayout` and assert that the
width survives. Those are the two properties that were broken on paper.

## 2026-09-29 — Measuring the phone card budget against what the tab bar leaves

Resolved by a664b9b.

Phase 07 replaced the phone's stacked split with a floating Timeline /
Requirements tab bar, and its plan said to restore the card-height budget
that Phase 05 had relaxed. The old rule was "term 0's first card, and the
second card's code line, are inside `.planner-timeline-area`". The obvious
move was to put the removed assertion back as it was.

Reviewing the plan against the new layout before building, I saw the
catch. The tab bar is `position: fixed` and floats over the foot of the
full-height Timeline region, so the region's own bottom edge is no longer
the edge of what a student can see. Measured the old way, the second card's
code line could sit entirely under the bar and the test would still pass.
It would pass vacuously on exactly the guarantee it exists for: "you can
see another course follows".

I raised it as a ruling rather than quietly tightening the plan. The user
agreed, and the rule now reads: the budget's bottom edge is
`min(region bottom, .tabbar top)`. That is recorded in the phase file §2.2,
and the spec (`plan-header-and-fit.test.ts`, "card height budget") computes
it that way.

How I knew it was right: before the tab bar existed, the restored test
failed red, waiting for `.tabbar`. With the bar in place it passes, and the
390×844 render shows the second card's code line clear above the pill. Each
scroller also gained end padding of `--tabbar-h + 1rem`, so the last card
of any column can be scrolled out from under the bar. That keeps "the bar
never hides something you need" a property of the layout, not a lucky
screenshot.

## 2026-09-29 — Turning a see-through header into a check that fails

Resolved by 5791174..da70fba.

In Task 21's review, the phone sheet at full height showed a grey smudge
down the right of its frosted header. The obvious read was the Chromium
glass bug from Phase 05, a backdrop blur that doesn't repaint after a
resize. The obvious fix would have been to stop animating the sheet's width
between heights.

I tested that read before acting on it. The smudge survived an instant,
reduced-motion jump and a forced repaint. It also stayed with the shadow
removed and, crucially, with the glass removed: the strip underneath was
simply see-through, and exactly the header's inline-end padding. So the
panel's `local` white wasn't reaching it. Switching the attachment to
`scroll` cleared the strip but brought back the older bug, where the glass
frosts the page behind the panel. Toggling one property at a time found the
cause: `scrollbar-gutter: stable`. The sheet never needs it (it only steadies
the two-column query at 628px), so the sheet drops it. That also removed the
5px handle offset the reserved gutter had caused on touch.

A fix I could only see in a screenshot would regress silently, so I put
the check in the harness. `pixelAt` (`spec/layout/helpers.ts`) reads the
rendered colour back from a screenshot through a canvas, with no new
dependency. `detailsHeadEnd` samples 40px into the header's end padding.
Its first sample point, mid-header, passed even with the bug, because at
full height that point sits below the dark nav. I only found out because
I reverted the fix and watched the test pass. The moved point fails red
at rgb(195,195,196) and passes at white.

The user then asked for the same fix in the Phase 06 drawer. The same
check, with the timeline painted black behind it, failed red there
first, and it now guards both.

## 2026-09-30 — Restoring what the scrape silently dropped, and guarding the hand-copied lists

Resolved by b144541..4e7c006.

Specialisations were going to open in the details panel from the scraped
`data/2027/subplans/*.json`. The obvious fix was to tidy that JSON at
display time: split the run-together introduction, drop the stray "AND"
entries, style "Advice to Students". I compared the raw P&C HTML against
the JSON first, and that ruled it out. The scrape hadn't just flattened
the page; it had lost whole sections. Other Information and Relevant
Degrees were missing from every page. SYAR's introduction ended on
"students will learn about:" with the 13 topics gone. No display-time
cleaning can restore content that was never captured, and patching the
external `anu-pandc` was out of scope.

So I fixed the data in the repo. A hand-copied supplement holds the lost
sections, and `scripts/merge-subplans.ts` merges it with the scrape into
one generated file the app imports statically. The merge throws if a
supplement heading stops matching the scrape, or if the two disagree on
which codes exist, so a re-scrape can't quietly undo the fix.

The second call was about course lists that now live in two places: P&C's
lists and the hand-written groups in `aacom-2027.ts` that allocation
actually uses. Instead of trusting the copy, I added a drift test in
`spec/`. It compares each list's course set and "minimum/maximum of N
units" against the linked group.

Both guards were proven red on a deliberate break. Changing one SYAR
topic made the freshness test say "stale: run node scripts/merge-subplans.ts".
Dropping COMP4691 from `arin-b` made the drift test name ARIN, the list
heading and the missing code. Both edits were then reverted, and the suite
went green. One gap stays open: the live re-check of the supplement text on
2026-09-30 couldn't run, because P&C kept timing out. The text is the
reference text copied on 2026-09-29.

## 2026-09-30 — A green suite hid a crash only the rendered sheet showed

Resolved by 8216940.

The specialisation panel passed all eleven of its planned browser tests,
axe at both viewports and `pnpm check`. The obvious move was to call Task 5
done and hand it to review. CLAUDE.md says the render is the truth, so I
screenshotted the panel at 1920 and 390 first, with the phone sheet at
half and full, before asking for sign-off.

That showed two faults the tests couldn't. First, a
`.requisite-line > span` grid rule also caught the line's `mark-dot` span.
That pushed every course name halfway across the panel and hid its dot.
Second, and worse, on a phone the sheet handle did nothing. The course
panel's handle still worked through the same frame, which narrowed it to
the spec side. The page log then showed a `TypeError` reading `shortLabel`.
The cause was a list counter declared in the panel's body. The new
`DetailsFrame` re-runs the body render prop on its own when the sheet
height changes, so the counter ran past the last list and the render
threw. No test had changed the height without also re-rendering the
panel, so nothing had exercised that path.

The fix works out each block's list index from its position, so a
re-render can't drift. I narrowed the grid rule to the line's last span.
I didn't just fix it and move on: I added a step to the phone test that
changes the height on its own after the progress jump, then checks the
sheet reaches full with both tags still drawn. I ran it against the broken
build first. It failed, with "full" expected and "peek" received. After the
fix it passed, the screenshots showed the lines aligned and the handle
working, and the user accepted the review.

## 2026-09-30 — A refetch test that would have passed with no refetch

Resolved by 5b7c50a.

Phase 03's Task 7 wanted a browser test that the what-if refetches when
the plan changes. It said to open an unchosen spec, count `what-if`
requests, change "Completed through", and check the count reaches 2. My
first version also asserted that the count starts at 1, and that failed:
a fresh load already sent 2. The obvious move was to drop my extra
assertion and keep the plan's literal "reaches 2", which then passed.

I didn't take it, because a count that starts at 2 and must "reach 2"
passes whether or not a refetch ever happens. I traced the second load
request to Planner: once it has measured itself it moves the panel into
the panes grid (`detailsInPanes`), which remounts it, so the hook fires
again and drops the first answer as stale. That's an existing layout
behaviour and outside the task, so I noted it and didn't "fix" it.

Instead the test now reads the count once the load settles and expects
exactly one more after the plan change. To check the new test could
catch the fault at all, I took `view` out of the hook's dependency list,
rebuilt, and ran it: it failed. With `view` back it passed, and so did
`pnpm check`. The plan file records the amendment and why, so the next
reader doesn't restore the literal 2.
