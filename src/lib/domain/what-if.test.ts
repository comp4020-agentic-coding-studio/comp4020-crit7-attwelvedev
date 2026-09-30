import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../../data/aacom-2027";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../catalogue/from-pandc";
import { parseRequisites } from "./requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "./types";
import { buildPlanView, type GroupView } from "./view";
import { whatIfChoice } from "./what-if";

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

function plan(placements: [string, number][], choices: Record<string, string> = {}): PlanState {
  return {
    id: "p",
    readOnly: false,
    cutoff: 0,
    choices,
    placements: placements.map(([code, term]) => ({ code, term, pinnedGroupId: null })),
  };
}

function leaves(groups: GroupView[]): GroupView[] {
  return groups.flatMap((g) => (g.children.length === 0 ? [g] : leaves(g.children)));
}

const aiPlan = () =>
  plan([
    ["COMP3620", 4],
    ["COMP3670", 4],
    ["COMP4620", 6],
  ]);

describe("whatIfChoice", () => {
  it("an empty plan has nothing toward the option and nothing to lose", () => {
    const w = whatIfChoice(cat, AACOM_2027, plan([]), "spec", "arin");
    expect(w).toMatchObject({ groupId: "spec", optionId: "arin", completed: 0, planned: 0, required: 24 });
    expect(w.moves).toEqual([]);
    expect(w.leaving).toEqual([]);
    expect(w.shortfalls).toEqual([]);
    expect(w.lists.map((l) => l.groupId)).toEqual(["arin-a", "arin-b"]);
  });

  it("moves placed AI courses out of 3000/4000-level COMP and reports what that leaves short", () => {
    const w = whatIfChoice(cat, AACOM_2027, aiPlan(), "spec", "arin");
    expect(w.moves.map((m) => [m.code, m.from?.id, m.to.id])).toEqual([
      ["COMP3620", "comp-upper", "arin-a"],
      ["COMP3670", "comp-upper", "arin-a"],
      ["COMP4620", "comp-upper", "arin-b"],
    ]);
    expect(w.completed + w.planned).toBe(18);
    expect(Object.fromEntries(w.lists.map((l) => [l.groupId, l.completed + l.planned]))).toEqual({
      "arin-a": 12,
      "arin-b": 6,
    });
    expect(w.shortfalls).toEqual([
      { groupId: "comp-upper", label: "3000/4000-level COMP", completed: 0, planned: 0, required: 18 },
    ]);
    expect(w.leaving).toEqual([]);
  });

  it("lists what would stop counting toward the spec already chosen", () => {
    const p = plan([["COMP3310", 4]], { spec: "syar" });
    const w = whatIfChoice(cat, AACOM_2027, p, "spec", "arin");
    const after = buildPlanView(cat, AACOM_2027, { ...p, choices: { spec: "arin" } });
    const afterId = after.placements.find((x) => x.code === "COMP3310")!.countsToward;
    const entry = w.leaving.find((l) => l.code === "COMP3310");
    expect(entry?.from.id).toBe("syar-a");
    expect(entry?.to?.id ?? null).toBe(afterId);
  });

  it("reports exactly the leaves satisfied now and unsatisfied after the swap", () => {
    const p = aiPlan();
    const before = leaves(buildPlanView(cat, AACOM_2027, p).groups);
    const after = new Map(
      leaves(buildPlanView(cat, AACOM_2027, { ...p, choices: { spec: "arin" } }).groups).map((g) => [g.id, g]),
    );
    const optionIds = new Set(["arin", "arin-a", "arin-b"]);
    const expected = before
      .filter((g) => !optionIds.has(g.id) && g.satisfied && after.get(g.id)?.satisfied === false)
      .map((g) => g.id);
    expect(whatIfChoice(cat, AACOM_2027, p, "spec", "arin").shortfalls.map((s) => s.groupId)).toEqual(expected);
  });

  it("leaves the input plan's choices alone", () => {
    const p = plan([["COMP3310", 4]], { spec: "syar" });
    whatIfChoice(cat, AACOM_2027, p, "spec", "arin");
    expect(p.choices).toEqual({ spec: "syar" });
  });
});
