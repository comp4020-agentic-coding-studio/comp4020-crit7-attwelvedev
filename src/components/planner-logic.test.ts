import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView, type GroupView } from "../lib/domain/view";
import {
  completedReadout,
  cutoffOptions,
  dropTargets,
  FAMILY_LABELS,
  FAMILY_ORDER,
  familyOf,
  groupBarTarget,
  groupLeafIds,
  groupPath,
  menuTargets,
  outstandingItems,
  outstandingTarget,
  overlayEdges,
  placedStatus,
  progressBarNumbers,
  progressSegments,
  termBarLabel,
  termBarWidths,
  termFamilyUnits,
  unitsLabel,
  unplacedCount,
  verifyBadgeText,
} from "./planner-logic";

function loadRealCatalogue(): Catalogue {
  const files = readdirSync("data/2027/courses").filter((f) => f.endsWith(".json"));
  const courses = new Map<string, CatalogueCourse>();
  const all: CatalogueCourse[] = [];
  for (const file of files) {
    const json: PandcCourseJson = JSON.parse(readFileSync(`data/2027/courses/${file}`, "utf-8"));
    if (!isUndergrad(json.code)) continue;
    const course = fromPandc(json, null, parseRequisites);
    all.push(course);
    courses.set(course.code, course);
  }
  let horizonYear = 0;
  for (const c of all) for (const o of c.offerings) if (o.year > horizonYear) horizonYear = o.year;
  return { courses, horizonYear };
}

const cat = loadRealCatalogue();

function emptyPlan(): PlanState {
  return { id: "p", readOnly: false, cutoff: 0, choices: {}, placements: [] };
}

describe("dropTargets", () => {
  it("matches courses[code].hardBlocked for each of the 8 terms", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const targets = dropTargets(view, "COMP3630");
    const hardBlocked = view.courses.COMP3630.hardBlocked;

    expect(targets).toHaveLength(8);
    for (const target of targets) {
      const reason = hardBlocked[target.term] ?? null;
      expect(target.reason).toBe(reason);
      expect(target.allowed).toBe(reason === null);
    }
    expect(targets[0].allowed).toBe(false);
    expect(targets[0].reason).toBeTruthy();
  });

  it("readOnly disables every target", () => {
    const view = buildPlanView(cat, AACOM_2027, { ...emptyPlan(), readOnly: true });
    const targets = dropTargets(view, "COMP1130");
    expect(targets.every((t) => t.allowed === false)).toBe(true);
    expect(targets.every((t) => typeof t.reason === "string")).toBe(true);
  });

  it("uses a given hardBlockedOverride instead of view.courses[code] — for a search result not (yet) in the plan's tree", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    // PSYC1004 isn't in the AACOM tree, so it isn't in view.courses at all;
    // dropTargets must not silently treat that as "every term allowed".
    expect(view.courses.PSYC1004).toBeUndefined();
    const targets = dropTargets(view, "PSYC1004", { 0: "not offered in S1 2027" });
    expect(targets[0]).toEqual({ term: 0, allowed: false, reason: "not offered in S1 2027" });
    expect(targets[1]).toEqual({ term: 1, allowed: true, reason: null });
  });
});

describe("progressSegments", () => {
  it("returns percentages clamped to 100 in total", () => {
    const under = progressSegments(6, 6, 24);
    expect(under.completedPct + under.plannedPct).toBeLessThanOrEqual(100);
    expect(under.completedPct).toBeCloseTo(25);
    expect(under.plannedPct).toBeCloseTo(25);

    const over = progressSegments(18, 18, 24);
    expect(over.completedPct + over.plannedPct).toBeLessThanOrEqual(100);
    expect(over.completedPct).toBeCloseTo(75);
    expect(over.plannedPct).toBeCloseTo(25);
  });

  it("handles a zero-required check without dividing by zero", () => {
    const result = progressSegments(0, 0, 0);
    expect(result.completedPct).toBe(0);
    expect(result.plannedPct).toBe(0);
  });
});

describe("progressBarNumbers", () => {
  it("reads a met minimum as-is", () => {
    expect(progressBarNumbers(6, 0, 6, "min")).toEqual({ valueNow: 6, valueMax: 6, text: "6 completed, 0 planned of 6" });
  });

  it("clamps valueNow over a minimum, keeping the true numbers in the text", () => {
    const n = progressBarNumbers(0, 60, 48, "min");
    expect(n.valueNow).toBe(48);
    expect(n.valueMax).toBe(48);
    expect(n.text).toBe("0 completed, 60 planned of 48 — 12 units more than the 48-unit minimum, already covered");
  });

  it("reads a max bound as \"of up to N\"", () => {
    expect(progressBarNumbers(48, 0, 60, "max")).toEqual({ valueNow: 48, valueMax: 60, text: "48 completed, 0 planned of up to 60" });
  });

  it("clamps valueNow over a max and notes the overage", () => {
    const n = progressBarNumbers(0, 66, 60, "max");
    expect(n.valueNow).toBe(60);
    expect(n.text).toBe("0 completed, 66 planned of up to 60 — 6 units over the 60-unit limit");
  });

  it("uses the singular for one unit over", () => {
    expect(progressBarNumbers(0, 61, 60, "max").text).toMatch(/— 1 unit over the 60-unit limit$/);
  });
});

describe("groupBarTarget", () => {
  it("measures a cap-only group toward its cap", () => {
    expect(groupBarTarget({ unitsRequired: 0, unitsMax: 12 })).toEqual({ required: 12, bound: "max" });
  });

  it("measures a minimum-only group toward its minimum", () => {
    expect(groupBarTarget({ unitsRequired: 6, unitsMax: null })).toEqual({ required: 6, bound: "min" });
  });

  it("measures a group with both toward its minimum", () => {
    expect(groupBarTarget({ unitsRequired: 24, unitsMax: 24 })).toEqual({ required: 24, bound: "min" });
  });

  it.each(["arin", "hccc", "syar", "thcs"])("gives every group a non-zero target with %s chosen", (choice) => {
    const view = buildPlanView(cat, AACOM_2027, { ...emptyPlan(), choices: { spec: choice } });
    let visited = 0;
    const walk = (groups: GroupView[]) => {
      for (const group of groups) {
        visited++;
        expect(groupBarTarget(group).required, group.id).toBeGreaterThan(0);
        walk(group.children);
      }
    };
    walk(view.groups);
    expect(visited).toBeGreaterThan(0);
  });
});

function placed(...entries: [string, number][]): PlanState {
  return { ...emptyPlan(), placements: entries.map(([code, term]) => ({ code, term, pinnedGroupId: null })) };
}

describe("overlayEdges", () => {
  it("returns an edge only for a prereq placed in an earlier term", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [
        { code: "COMP1140", term: 1, pinnedGroupId: null },
        { code: "COMP2100", term: 2, pinnedGroupId: null },
      ],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    const edges = overlayEdges(view, "COMP2100");
    expect(edges).toContainEqual({ from: "COMP1140", to: "COMP2100", kind: "option" });
    expect(edges.some((e) => e.from === "COMP1110")).toBe(false);
  });

  it("marks a course named outright on an all-AND path as required", () => {
    // COMP3300: "completed COMP2310".
    const view = buildPlanView(cat, AACOM_2027, placed(["COMP2310", 2], ["COMP3300", 4]));
    expect(overlayEdges(view, "COMP3300")).toEqual([{ from: "COMP2310", to: "COMP3300", kind: "required" }]);
  });

  it("links a course in an 'N units of (A or B ...)' list as an option", () => {
    // COMP3242: "6 units of ( COMP3670 or MATH1013 or ... ) and ( COMP1110 or COMP1140 )".
    const view = buildPlanView(cat, AACOM_2027, placed(["MATH1013", 0], ["COMP1110", 1], ["COMP3242", 4]));
    const edges = overlayEdges(view, "COMP3242");
    expect(edges).toContainEqual({ from: "MATH1013", to: "COMP3242", kind: "option" });
    expect(edges).toContainEqual({ from: "COMP1110", to: "COMP3242", kind: "option" });
  });

  it("links every placed course matching an 'N units of <level> <subject>' pool as an option", () => {
    // COMP2300: "( COMP1100 OR ... ) AND 6 units of 1000-level MATH courses" —
    // both MATH courses qualify, so both are drawn; MATH2222 is the wrong level.
    const view = buildPlanView(
      cat,
      AACOM_2027,
      placed(["MATH1013", 0], ["MATH1014", 1], ["MATH2222", 1], ["COMP1100", 0], ["COMP2300", 2]),
    );
    const edges = overlayEdges(view, "COMP2300");
    expect(edges).toContainEqual({ from: "MATH1013", to: "COMP2300", kind: "option" });
    expect(edges).toContainEqual({ from: "MATH1014", to: "COMP2300", kind: "option" });
    expect(edges.some((e) => e.from === "MATH2222")).toBe(false);
  });

  it("waits for a two-semester prereq's last term, as the requisite check does", () => {
    // COMP4550 spans two terms and counts toward COMP4620's "12 units of
    // 3000 and/or 4000 level COMP courses" only once both are done.
    const overlapping = buildPlanView(cat, AACOM_2027, placed(["COMP4550", 4], ["COMP4620", 5]));
    expect(overlayEdges(overlapping, "COMP4620")).toEqual([]);
    const after = buildPlanView(cat, AACOM_2027, placed(["COMP4550", 4], ["COMP4620", 6]));
    expect(overlayEdges(after, "COMP4620")).toContainEqual({ from: "COMP4550", to: "COMP4620", kind: "option" });
  });

  it("links a concurrent prereq in the same term", () => {
    // COMP2120: "completed or be currently studying COMP2100".
    const view = buildPlanView(cat, AACOM_2027, placed(["COMP2100", 2], ["COMP2120", 2]));
    expect(overlayEdges(view, "COMP2120")).toEqual([{ from: "COMP2100", to: "COMP2120", kind: "required" }]);
  });

  it("excludes a prereq placed in the same or a later term unless concurrent", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [
        { code: "COMP1140", term: 2, pinnedGroupId: null },
        { code: "COMP2100", term: 2, pinnedGroupId: null },
      ],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(overlayEdges(view, "COMP2100")).toEqual([]);
  });

  it("returns nothing for an unplaced course", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(overlayEdges(view, "COMP2100")).toEqual([]);
  });
});

// "N prerequisites not placed" is the fewest more courses that would have
// to be placed — not every code the requisite mentions, which counted both
// sides of an OR ("2 not placed" for COMP1110 or COMP1140) and even the
// unneeded side of one already satisfied.
describe("unplacedCount", () => {
  it.each([
    // (COMP1110 or COMP1140) and 6 units of MATH: one course; the units
    // pool has its own "Needs 6 more units" reason.
    ["COMP2100", [["COMP2100", 2]], 1],
    // (COMP1110 or COMP1140) and (COMP2300 or ENGN2219).
    ["COMP2310", [["COMP2310", 3]], 2],
    // COMP3670, or both (COMP1110 or COMP1140) and (MATH1014 or MATH1115).
    ["COMP4880", [["COMP4880", 6]], 1],
    // COMP1140 satisfies its OR; COMP1110 isn't still "not placed".
    ["COMP2310", [["COMP1140", 1], ["COMP2310", 3]], 1],
    // Placed, just too late: a "Move" suggestion, not an unplaced course.
    ["COMP3300", [["COMP2310", 5], ["COMP3300", 3]], 0],
  ] as [string, [string, number][], number][])("%s with %j → %i", (code, placements, expected) => {
    const view = buildPlanView(cat, AACOM_2027, placed(...placements));
    expect(unplacedCount(view, code)).toBe(expected);
  });

  it("is 0 for a course that isn't placed", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(unplacedCount(view, "COMP2100")).toBe(0);
  });
});

describe("outstandingItems", () => {
  it("gives an unsatisfied leaf group's unit shortfall, not its missing courses", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const items = outstandingItems(view);
    const progItem = items.find((i) => i.id === "group-prog-a");
    // "needs COMP1100, COMP1130" would read as "you need both", when
    // placing either one alone (6 of the 6 required units) satisfies it —
    // naming specific courses overclaims for anything but an ALL-rule group.
    expect(progItem?.text).toBe("Programming as Problem Solving: 6 more units needed");
    expect(progItem?.text).not.toContain("COMP1100");
  });

  it("drops a group once it's satisfied", () => {
    const plan: PlanState = {
      ...emptyPlan(),
      placements: [{ code: "COMP1100", term: 0, pinnedGroupId: null }],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(view.groups.some((g) => g.id === "prog-a" && g.satisfied)).toBe(true);
    expect(outstandingItems(view).some((i) => i.id === "group-prog-a")).toBe(false);
  });

  it("flags a selectable group with no choice made yet", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(outstandingItems(view)).toContainEqual({ id: "choice-spec", text: "Choose your Specialisation" });
  });

  it("drops the choice item once one is made", () => {
    const plan: PlanState = { ...emptyPlan(), choices: { spec: "arin" } };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(outstandingItems(view).some((i) => i.id === "choice-spec")).toBe(false);
  });

  it("gives a filter-based group (no fixed course list at all) the same unit-shortfall treatment", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const electives = outstandingItems(view).find((i) => i.id === "group-electives");
    expect(electives?.text).toMatch(/\d+ more units? needed/);
  });

  it("reports a failing check as not yet satisfied, and an untracked one separately", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const items = outstandingItems(view);
    expect(items).toContainEqual({
      id: "check-comp4000-min",
      text: "At least 48 units of 4000-level COMP: not yet satisfied",
    });
    expect(items).toContainEqual({
      id: "check-tdp-min",
      text: "At least 12 units of TDP-tagged courses — not tracked, verify on P&C",
    });
  });
});

describe("completedReadout", () => {
  const terms = [{ label: "S1 2027" }, { label: "S2 2027" }, { label: "S1 2028" }];

  it("reads as nothing completed at 0", () => {
    expect(completedReadout(0, terms)).toEqual({
      short: "Nothing completed yet",
      full: "Nothing on the timeline counts as completed yet. The gold line on the timeline marks that boundary.",
    });
  });

  it("treats a negative cutoff the same as 0", () => {
    expect(completedReadout(-1, terms)).toEqual(completedReadout(0, terms));
  });

  it("reads as all completed at or past the last term", () => {
    const all = {
      short: "All semesters completed",
      full: "Every semester on the timeline counts as completed. The gold line on the timeline marks that boundary.",
    };
    expect(completedReadout(3, terms)).toEqual(all);
    expect(completedReadout(9, terms)).toEqual(all);
  });

  it("names the last completed term inside the timeline", () => {
    expect(completedReadout(2, terms)).toEqual({
      short: "Completed through S2 2027",
      full: "Completed through S2 2027 — planned from S1 2028 onward. The gold line on the timeline marks that boundary.",
    });
  });
});

describe("cutoffOptions", () => {
  const terms = ["S1 2027", "S2 2027", "S1 2028", "S2 2028", "S1 2029", "S2 2029", "S1 2030", "S2 2030"].map(
    (label) => ({ label }),
  );

  it("offers nothing, each term, then all semesters", () => {
    const options = cutoffOptions(terms);
    expect(options).toHaveLength(9);
    expect(options[0]).toEqual({ value: 0, label: "Nothing yet" });
    expect(options[1]).toEqual({ value: 1, label: "S1 2027" });
    expect(options[7]).toEqual({ value: 7, label: "S1 2030" });
    expect(options[8]).toEqual({ value: 8, label: "All semesters" });
  });

  it("names the last option All semesters however many terms there are", () => {
    const options = cutoffOptions(terms.slice(0, 3));
    expect(options.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect(options[3].label).toBe("All semesters");
  });
});

describe("unitsLabel", () => {
  it("abbreviates a one-semester course and spells it out in full", () => {
    expect(unitsLabel({ units: 6, twoSemester: false })).toEqual({ short: "6u", full: "6 units" });
  });

  it("shows a two-semester course's per-semester units twice", () => {
    expect(unitsLabel({ units: 12, twoSemester: true })).toEqual({ short: "12+12u", full: "12+12 units" });
  });

  it("uses the singular for a single unit", () => {
    expect(unitsLabel({ units: 1, twoSemester: false })).toEqual({ short: "1u", full: "1 unit" });
  });
});

describe("menuTargets", () => {
  it("offers only reachable terms other than the current one", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const { targets } = menuTargets(view, "COMP3630", { currentTerm: 2 });
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.map((t) => t.term)).not.toContain(0);
    expect(targets.map((t) => t.term)).not.toContain(2);
    expect(targets.every((t) => t.allowed)).toBe(true);
  });

  it("gives each blocked term's reason once", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const { blockedReasons } = menuTargets(view, "COMP3630", { currentTerm: 2 });
    expect(new Set(blockedReasons).size).toBe(blockedReasons.length);
    expect(blockedReasons).toContain(view.courses.COMP3630.hardBlocked[0]);
  });

  it("uses a caller's hardBlocked map for a course outside the plan", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    const { blockedReasons } = menuTargets(view, "PSYC1004", { hardBlockedOverride: { 0: "x", 1: "x" } });
    expect(blockedReasons).toEqual(["x"]);
  });
});

describe("verifyBadgeText", () => {
  it("counts one item in the singular", () => {
    expect(verifyBadgeText(1)).toBe("Verify on P&C: 1 item");
  });

  it("counts several items in the plural", () => {
    expect(verifyBadgeText(2)).toBe("Verify on P&C: 2 items");
  });
});

describe("placedStatus", () => {
  const view = buildPlanView(cat, AACOM_2027, {
    ...emptyPlan(),
    cutoff: 1,
    placements: [
      { code: "COMP1100", term: 0, pinnedGroupId: null },
      { code: "COMP1110", term: 1, pinnedGroupId: null },
    ],
  });
  const placement = (code: string) => view.placements.find((p) => p.code === code)!;

  it("says a placement before the cutoff is completed, in its term", () => {
    expect(placedStatus(view, placement("COMP1100"))).toEqual({ word: "Completed", termLabel: "S1 2027" });
  });

  it("says a placement from the cutoff on is planned, in its term", () => {
    expect(placedStatus(view, placement("COMP1110"))).toEqual({ word: "Planned", termLabel: "S2 2027" });
  });
});

describe("familyOf", () => {
  const view = buildPlanView(cat, AACOM_2027, { ...emptyPlan(), choices: { spec: "arin" } });

  it("finds a nested group's inherited family", () => {
    expect(familyOf(view, "arin-a")).toBe("specialisation");
  });

  it("finds a top-level group's own family", () => {
    expect(familyOf(view, "compulsory")).toBe("foundations");
  });

  it("falls back to neutral for no group or an unknown one", () => {
    expect(familyOf(view, null)).toBe("neutral");
    expect(familyOf(view, "nope")).toBe("neutral");
  });

  it("orders and labels every family", () => {
    expect(FAMILY_ORDER).toEqual(["foundations", "specialisation", "advanced", "ict", "capstone", "neutral"]);
    expect(new Set(Object.keys(FAMILY_LABELS))).toEqual(new Set(FAMILY_ORDER));
  });
});

describe("termFamilyUnits", () => {
  const view = buildPlanView(cat, AACOM_2027, {
    ...emptyPlan(),
    choices: { spec: "arin" },
    placements: [
      { code: "COMP1100", term: 0, pinnedGroupId: null },
      // Incompatible with COMP1100, so the loser counts toward nothing.
      { code: "COMP1130", term: 0, pinnedGroupId: null },
      { code: "INFS1001", term: 0, pinnedGroupId: null },
      // Two semesters: occupies terms 5 and 6.
      { code: "COMP4550", term: 5, pinnedGroupId: null },
    ],
  });

  it("accounts for every unit a term holds", () => {
    expect(view.terms).toHaveLength(8);
    for (const term of view.terms) {
      const sum = termFamilyUnits(view, term.index).reduce((total, s) => total + s.units, 0);
      expect(sum, term.label).toBe(term.units);
    }
  });

  it("splits a term by family, with a loser under none", () => {
    const segments = termFamilyUnits(view, 0);
    expect(segments).toContainEqual({ key: "foundations", units: 6 });
    expect(segments).toContainEqual({ key: "none", units: 6 });
  });

  it("counts a two-semester course in both of its terms", () => {
    const placement = view.placements.find((p) => p.code === "COMP4550")!;
    const key = familyOf(view, placement.countsToward);
    const units = view.courses.COMP4550!.units;
    expect(termFamilyUnits(view, 5)).toContainEqual({ key, units });
    expect(termFamilyUnits(view, 6)).toContainEqual({ key, units });
  });

  it("orders keys by family, then none, and omits empty ones", () => {
    const order = [...FAMILY_ORDER, "none"];
    for (const term of view.terms) {
      const segments = termFamilyUnits(view, term.index);
      const positions = segments.map((s) => order.indexOf(s.key));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(segments.filter((s) => s.units === 0)).toEqual([]);
    }
    expect(termFamilyUnits(view, 1)).toEqual([]);
  });
});

describe("termBarWidths", () => {
  it("measures against a normal 24-unit term", () => {
    expect(termBarWidths([{ units: 12 }, { units: 6 }], 18)).toEqual([50, 25]);
  });

  it("scales an overloaded term to its own total", () => {
    expect(termBarWidths([{ units: 18 }, { units: 12 }], 30)).toEqual([60, 40]);
  });
});

describe("termBarLabel", () => {
  it("reads out each segment, with none as not counting", () => {
    expect(
      termBarLabel([
        { key: "foundations", units: 12 },
        { key: "ict", units: 6 },
        { key: "none", units: 6 },
      ]),
    ).toBe("12 units Foundations, 6 units ICT, 6 units not counting");
  });

  it("says an empty term has nothing planned", () => {
    expect(termBarLabel([])).toBe("No units planned");
  });

  it("labels neutral as Electives", () => {
    expect(termBarLabel([{ key: "neutral", units: 6 }])).toBe("6 units Electives");
  });
});

describe("groupPath", () => {
  const view = buildPlanView(cat, AACOM_2027, { ...emptyPlan(), choices: { spec: "arin" } });

  it("returns the root-to-target chain for a nested group", () => {
    expect(groupPath(view, "arin-a").map((g) => g.id)).toEqual(["spec", "arin", "arin-a"]);
  });

  it("returns just the group for a top-level one", () => {
    expect(groupPath(view, "prog-a").map((g) => g.id)).toEqual(["prog-a"]);
  });

  it("returns nothing for an unknown group", () => {
    expect(groupPath(view, "nope")).toEqual([]);
  });
});

describe("outstandingTarget", () => {
  it("maps a leaf group item to its group", () => {
    expect(outstandingTarget("group-prog-a")).toEqual({ kind: "group", id: "prog-a" });
  });

  it("maps an open choice to its group", () => {
    expect(outstandingTarget("choice-spec")).toEqual({ kind: "group", id: "spec" });
  });

  it("maps a check item to its check", () => {
    expect(outstandingTarget("check-tdp-min")).toEqual({ kind: "check", id: "tdp-min" });
  });

  it("gives nothing for any other id", () => {
    expect(outstandingTarget("other")).toBeNull();
  });

  it("finds a target for every item a fresh plan lists", () => {
    const items = outstandingItems(buildPlanView(cat, AACOM_2027, emptyPlan()));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(outstandingTarget(item.id), item.id).not.toBeNull();
  });
});

describe("groupLeafIds", () => {
  const view = buildPlanView(cat, AACOM_2027, { ...emptyPlan(), choices: { spec: "arin" } });

  it("holds a group and every group nested under it", () => {
    const ids = groupLeafIds(view, "spec");
    for (const id of ["spec", "arin", "arin-a"]) expect(ids.has(id), id).toBe(true);
  });

  it("holds just the group when it has no children", () => {
    expect(groupLeafIds(view, "prog-a")).toEqual(new Set(["prog-a"]));
  });

  it("is empty for an unknown group", () => {
    expect(groupLeafIds(view, "nope")).toEqual(new Set());
  });
});
