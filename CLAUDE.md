# Working method

## Before pushing

- `pnpm check` (types, build, `spec/` tests) must be green.
- Verify visual changes by running the app and checking both marking
  viewports (`1920 1080`, `390 844`) — the render is the truth, not the
  source.

## Generated files

Never hand-edit `dist/`, `.astro/`, or generated `api/*.json`; fix the
source and rebuild.

## Secrets

Never widen `.gitignore` around `.claude/settings*.json`, `.env*`, or
commit a key. `.claude/skills/**` is the only carve-out.

## Commits

One commit per unit of work once `pnpm check` passes — no mega-commits,
no bundling unrelated changes. Messages say what changed and why, not
"fixed things".

## PROCESS.md and PROCESS_LOG.md

`PROCESS.md` is the graded account of **my** decisions for this crit: 1-2
moments, 150-300 words, each citing a commit/range that actually resolves
(`pnpm check:evidence` checks this — never cite before committing). A
moment qualifies only if it says why the call beat the obvious one and
how I knew the result was right — not just "it worked"; the strongest
moments land the correction in the harness itself (a rule here, a check
added to `spec/`/`scripts/`) rather than a one-off fix.

Log every qualifying moment to `PROCESS_LOG.md` (append-only, repo root)
as it happens, in the format its own header comment shows — pick the
best 1-2 for `PROCESS.md` later.
