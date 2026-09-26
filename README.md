# ANU Degree Planner

This is a full-stack replacement for the manual process of planning a degree
against ANU's Programs & Courses site (`programsandcourses.anu.edu.au`, "P&C")
— a system where a student opens
a shareable plan, sees the **Bachelor of Advanced Computing (Honours)**
requirement tree for the **2027** cohort starting Semester 1, drags courses
onto an 8-semester timeline, and sees clearly, for every course, whether it's
available, blocked, and why — computed from a real recursive prerequisite
check against P&C's own course data, not a static checklist.

## What good looks like here

Good means three things hold at once: the state shown for every course is
never wrong (available/soft-blocked/hard-blocked, with a specific reason, not
a guess); every mutation (a placement, a moved cutoff, a pin) is enforced
server-side and persists exactly, so the client can't drift from the source
of truth; and the app never claims certainty about P&C data it can't actually
verify — an unparseable requisite clause shows as "verify on P&C" rather than
being silently dropped or silently assumed true.

Most of that is enforced, not just aspired to: `spec/invariants.test.ts` runs
axe and the CI deploy probes against every route; the domain layer
(`src/lib/domain/**`) is unit-tested against real scraped course data, not
fixtures invented to make the tests pass; and `spec/*.test.ts` drives the
built server over HTTP, including the requisite parser, the allocation
solver, and — for this phase — the runtime P&C fetch and search. What's a
judgement call rather than a checked rule: the exact wording of a suggestion
("Place X in S1 2028" vs. "Move X to..."), the visual design of the timeline,
and which of two equally-defensible readings of an ambiguous P&C sentence the
requisite parser takes.

## Where this diverges from the original brief

The brief assumed a course could double-count toward more than one
requirement group. This app replaces that with **strict single allocation**:
each placed course counts toward at most one group, chosen by an optimal
solver that maximises satisfied units, with pinning available when the
student disagrees with the automatic choice. Double-counting would have let
the same 6 units silently satisfy two different totals, overstating real
progress toward the 192-unit program; single allocation is the one that
can't lie about how many units a student has actually earned toward the
degree as a whole. Filter-based requirement groups (e.g. "12 units of
3000/4000-level COMP") are supported in this v1, alongside explicit course
lists.

## Limitations

- **Offerings for 2029–30 are projected**, not scraped: they copy the most
  recent year P&C actually published sessions for, and are visibly marked
  "projected" wherever shown. P&C simply hasn't published that far ahead yet.
- **A course with no published offering at all is marked "unknown"**, not
  hard-blocked — the app can't tell the difference between "not running" and
  "not yet on P&C", so it stays placeable with a "No published offering —
  verify on P&C" badge rather than refusing it outright.
- **TDP (Targeted Delivery Program) tracking is untracked, not "0 of 12
  units"**: the scrape task spent a time-boxed hour searching for a
  machine-readable TD tag on P&C's course search API and found none. No TD
  status is ever guessed, so the program check shows as "not tracked — verify
  on P&C" instead of a number that could be quietly wrong.
- **The Machine Learning specialisation was merged into ARIN from 2027**, per
  P&C, so the specialisation options here are ARIN, HCCC, SYAR and THCS — an
  ML major from an earlier cohort year won't appear.
- **The requisite parser is deliberately over-strict in at least one known
  case**: COMP4350's "either A or B and C" phrasing parses with the wrong
  precedence (unparenthesised OR is treated as binding tighter than AND,
  which matches most P&C phrasing but not this one). This is accepted rather
  than special-cased, because an over-strict parse only ever produces a false
  *soft*-block — never a false hard-block, and never a false "satisfied" —
  so the failure mode is "you may need to double-check this one on P&C", not
  a wrongly-permitted enrolment.
- **P&C's licence is unconfirmed.** Scraped and live-fetched course data is
  republished here for a non-commercial student project, with attribution
  below; if that turns out not to be permitted, the data will need to come
  down.

Out of scope entirely for v1: authentication and accounts (a plan's only
protection is its unguessable URL); any program, cohort year or starting
semester other than AACOM/2027/Semester 1; summer, winter and spring
sessions; repeated or failed courses, part-time study, leave and credit;
checking WAM, marks, permission codes or supervisor approval (these show as
"verify on P&C" instead); and live sync between browser tabs (the SSE
endpoint is a heartbeat only).

## Data attribution

Course, program and requisite data is sourced from
[programsandcourses.anu.edu.au](https://programsandcourses.anu.edu.au),
© The Australian National University, scraped via
[`anu-pandc`](https://github.com/smcclab/anu-pandc) (used with permission)
and committed under `data/2027/` (see `data/2027/SOURCE.md` for the exact
command and date). A course searched for and not already in that seeded set
is fetched live, on demand, from the same site, with a self-identifying
`User-Agent` and a 10-second timeout, and cached from then on.
