import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../catalogue/from-pandc";
import { AACOM_2027 } from "../../data/aacom-2027";
import { EXAMPLE_PLAN } from "../../data/example-plan";
import { parseRequisites } from "./requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "./types";
import { buildPlanView, courseCard } from "./view";

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

function findGroup(views: ReturnType<typeof buildPlanView>["groups"], id: string): (typeof views)[number] | undefined {
  for (const g of views) {
    if (g.id === id) return g;
    const found = findGroup(g.children, id);
    if (found) return found;
  }
  return undefined;
}

describe("courseCard", () => {
  it("COMP3630 has hardBlocked[0] set and offeredLabel 'S1'", () => {
    const card = courseCard(cat, AACOM_2027, {}, "COMP3630");
    expect(card.hardBlocked[0]).toBeDefined();
    expect(card.offeredLabel).toBe("S1");
  });
});

describe("buildPlanView (example plan)", () => {
  const view = buildPlanView(cat, AACOM_2027, EXAMPLE_PLAN);

  it("completed vs planned is split by cutoff", () => {
    const compulsory = findGroup(view.groups, "compulsory")!;
    expect(compulsory.completed).toBe(0);
    expect(compulsory.planned).toBe(48);

    const progA = findGroup(view.groups, "prog-a")!;
    expect(progA.completed).toBe(6);
  });

  it("the total is 192 planned+completed", () => {
    expect(view.total.completed + view.total.planned).toBe(192);
    expect(view.total.required).toBe(192);
  });

  it("program checks", () => {
    const lvl1000 = view.checks.find((c) => c.id === "lvl1000-max")!;
    expect(lvl1000.completed + lvl1000.planned).toBe(48);
    expect(lvl1000.ok).toBe(true);

    const comp4000 = view.checks.find((c) => c.id === "comp4000-min")!;
    expect(comp4000.ok).toBe(true);

    const tdp = view.checks.find((c) => c.id === "tdp-min")!;
    expect(tdp.ok).toBeNull();
  });

  it("no placement is hard", () => {
    expect(view.placements.every((p) => p.state !== "hard")).toBe(true);
  });

  it("countsToward and pinned appear on placements", () => {
    const comp1130 = view.placements.find((p) => p.code === "COMP1130")!;
    expect(comp1130.countsToward).toBe("prog-a");
    expect(comp1130.pinned).toBe(false);
  });

  it("a rule-based group (no predefined courses list) lists the placed courses allocated to it", () => {
    const compUpper = findGroup(view.groups, "comp-upper")!;
    expect(compUpper.filterLabel).not.toBeNull();
    const placedHere = view.placements.filter((p) => p.countsToward === "comp-upper").map((p) => p.code);
    expect(placedHere.length).toBeGreaterThan(0);
    for (const code of placedHere) expect(compUpper.courses).toContain(code);
  });

  it("performance: building the example plan's view takes under 50ms (median of 5 runs)", () => {
    const durations: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      buildPlanView(cat, AACOM_2027, EXAMPLE_PLAN);
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    expect(durations[2]).toBeLessThan(50);
  });
});

describe("buildPlanView (empty plan)", () => {
  const view = buildPlanView(cat, AACOM_2027, emptyPlan());

  it("every group is 0/0 and unsatisfied", () => {
    function checkAll(groups: typeof view.groups): void {
      for (const g of groups) {
        expect(g.completed).toBe(0);
        expect(g.planned).toBe(0);
        expect(g.satisfied).toBe(false);
        checkAll(g.children);
      }
    }
    checkAll(view.groups);
  });

  it("selectable group view lists options and chosenId", () => {
    const spec = findGroup(view.groups, "spec")!;
    expect(spec.selectable).toBe(true);
    expect(spec.chosenId).toBeNull();
    expect(spec.options.map((o) => o.id).sort()).toEqual(["arin", "hccc", "syar", "thcs"]);
    expect(spec.children).toHaveLength(0);
  });
});

describe("buildPlanView (a chosen specialisation)", () => {
  it("selectable group view reports the chosen id and descends into it", () => {
    const plan: PlanState = { id: "p", readOnly: false, cutoff: 0, choices: { spec: "arin" }, placements: [] };
    const view = buildPlanView(cat, AACOM_2027, plan);
    const spec = findGroup(view.groups, "spec")!;
    expect(spec.chosenId).toBe("arin");
    expect(spec.children).toHaveLength(1);
    expect(spec.children[0]!.id).toBe("arin");
    expect(findGroup(view.groups, "arin-a")).toBeDefined();
    expect(findGroup(view.groups, "hccc-core")).toBeUndefined();
  });

  it("nested groups inherit their top-level family", () => {
    const plan: PlanState = { id: "p", readOnly: false, cutoff: 0, choices: { spec: "arin" }, placements: [] };
    const view = buildPlanView(cat, AACOM_2027, plan);
    const spec = findGroup(view.groups, "spec")!;
    const descendants = (g: typeof spec): (typeof spec)[] => g.children.flatMap((c) => [c, ...descendants(c)]);
    expect(spec.family).toBe("specialisation");
    expect(spec.children[0]!.family).toBe("specialisation");
    const all = descendants(spec);
    expect(all.length).toBeGreaterThan(1);
    for (const g of all) expect(g.family, g.id).toBe("specialisation");
    expect(findGroup(view.groups, "electives")!.family).toBe("neutral");
  });
});

describe("buildPlanView: pins and unchosen options", () => {
  it("Pin to lists no group from a capstone option that isn't chosen", () => {
    const plan: PlanState = { ...emptyPlan(), placements: [{ code: "COMP4500", term: 6, pinnedGroupId: null }] };
    const view = buildPlanView(cat, AACOM_2027, plan);
    expect(view.courses.COMP4500!.eligibleGroups.filter((id) => id.startsWith("cap-"))).toEqual([]);
  });

  it("a pin left on a no-longer-chosen option is ignored, not thrown on", () => {
    // Pinned while cap-team was chosen, then the capstone switched: the
    // allocator used to throw IneligiblePinError, and the plan 500'd for good.
    const plan: PlanState = {
      ...emptyPlan(),
      choices: { capstone: "cap-research" },
      placements: [{ code: "COMP4500", term: 6, pinnedGroupId: "cap-team-proj" }],
    };
    const view = buildPlanView(cat, AACOM_2027, plan);
    const placement = view.placements.find((p) => p.code === "COMP4500")!;
    expect(placement.pinned).toBe(false);
    expect(placement.countsToward).not.toBe("cap-team-proj");
  });
});
