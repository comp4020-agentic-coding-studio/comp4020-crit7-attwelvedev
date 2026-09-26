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
