import type { Placement, PlanState } from "../lib/domain/types";

// A fixed walkthrough of AACOM 2027 with the AI specialisation and the
// research capstone, reset from this file on every boot (seed.ts). It exists
// so a first-time visitor sees a full, working plan before starting their own.
function placements(byTerm: [number, string[]][]): Placement[] {
  return byTerm.flatMap(([term, codes]) => codes.map((code) => ({ code, term, pinnedGroupId: null })));
}

export const EXAMPLE_PLAN: PlanState = {
  id: "example",
  readOnly: true,
  cutoff: 2,
  choices: { spec: "arin", capstone: "cap-research" },
  placements: placements([
    [0, ["COMP1130", "MATH1005", "MATH1115", "INFS1001"]],
    [1, ["COMP1140", "COMP1600", "MATH1116", "STAT1008"]],
    [2, ["COMP2100", "COMP2300", "COMP2400", "COMP2620"]],
    [3, ["COMP2120", "COMP2310", "COMP3600", "COMP3670"]],
    [4, ["COMP3630", "COMP3620", "COMP3242", "COMP4450"]],
    [5, ["COMP4620", "COMP4650", "COMP3900", "COMP3320"]],
    [6, ["COMP4550", "COMP4670", "COMP4528"]], // COMP4550 is 12+12, spans T6–T7
    [7, ["COMP4011", "SCOM3029"]],
  ]),
};
