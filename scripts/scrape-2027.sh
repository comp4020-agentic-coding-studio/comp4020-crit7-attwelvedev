#!/usr/bin/env bash
# Offline scrape of ANU 2027 course/program data with anu-pandc. Not run in CI
# or on boot — data/2027/** is committed and read as fixtures/seed data.
set -u

P=.venv/bin/anu-pandc

"$P" get AACOM ARIN-SPEC HCCC-SPEC SYAR-SPEC THCS-SPEC --year 2027 --save data --recursive --format json --format md || true
node scripts/merge-subplans.ts
"$P" catalogue COMP --year 2027 --save data --format json || true
"$P" courses --year 2027 --save data --format json || true

if [ ! -f data/2027/programs/AACOM.json ]; then
  echo "[scrape-2027] fatal: data/2027/programs/AACOM.json missing" >&2
  exit 1
fi

cat > data/2027/SOURCE.md <<'EOF'
# Source

- Site: https://programsandcourses.anu.edu.au (P&C), 2027 catalogue year.
- Scraped: 2026-09-26, via `anu-pandc` 0.3.1.
- Command: `bash scripts/scrape-2027.sh`
  (`anu-pandc get AACOM ARIN-SPEC HCCC-SPEC SYAR-SPEC THCS-SPEC --year 2027 --save data --recursive --format json --format md`,
  `anu-pandc catalogue COMP --year 2027 --save data --format json`,
  `anu-pandc courses --year 2027 --save data --format json`)
- © The Australian National University; republished for a non-commercial
  student project; licence unconfirmed.
EOF

cat > data/2027/tdp.json <<'EOF'
{
  "source": null,
  "courses": null,
  "note": "No machine-readable TD tag found on P&C (searched 2026-09-26); TDP check is untracked."
}
EOF
