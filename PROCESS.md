# Process overview

## What I built

An ANU degree planner for the 2027 Bachelor of Advanced Computing (Honours).
Students drag courses onto an 8-semester timeline and see whether each one is
available, and why, from a recursive check against P&C's own requisite data.

## How I got here

**Budgeting the check instead of accepting it.** `pnpm check` had crept up to
about seven minutes. Rather than blame "more tests" or slow waits, I measured.
A JSON-reporter run showed that one file, `spec/layout.test.ts`, took 416 of roughly 420 seconds, and vitest runs a
file's tests serially. So I split it into eight area files, balanced by
measured time
([`404caf9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/commit/404caf9)).
Every block moved byte-for-byte (827 tests), and three runs went green in
66–69s. A split only holds if nothing grows back, so
[`8b86423`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/commit/8b86423)
adds `spec/suite-size.test.ts`, which I proved red on the pre-split file, and
the "Test speed" rule in `CLAUDE.md`. I also changed my global `plan-feature`
and `execute-plan` skills. Plans now split browser tests into area files with
runner parallelism in mind, and execution tracks the check's time against a
baseline, so the bottleneck can't quietly return.

**An invariant that passed while blind.** The parser's "no silent drops"
invariant passed, yet eleven courses had real codes stuck in unverifiable prose
and could never show as available. It counted codes inside prose as found.
Instead of patching each phrasing, I tightened the invariant first, then added
one fixture per phrasing, each red before the fix
([`b8a9cf0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/commit/b8a9cf0)).
Diffing every parsed tree before and after caught a regression the tests
missed. Then COMP4500 had every code present but joined wrongly, which a
presence check can't see. A second invariant now fails on any program code
left in prose
([`09b79ac...4ff0f9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/compare/09b79ac...4ff0f9c)).
Run against the old parser, it flagged exactly COMP4500 and an unreported
COMP3500.
