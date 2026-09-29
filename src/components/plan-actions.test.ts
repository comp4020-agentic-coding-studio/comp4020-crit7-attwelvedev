import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { EXAMPLE_PLAN } from "../data/example-plan";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { actionFor, changesNothing, knockOnText, newlyBroken, undoEntry } from "./plan-actions";

function loadRealCatalogue(): Catalogue {
  const files = readdirSync("data/2027/courses").filter((f) => f.endsWith(".json"));
  const courses = new Map<string, CatalogueCourse>();
  let horizonYear = 0;
  for (const file of files) {
    const json: PandcCourseJson = JSON.parse(readFileSync(`data/2027/courses/${file}`, "utf-8"));
    if (!isUndergrad(json.code)) continue;
    const course = fromPandc(json, null, parseRequisites);
    courses.set(course.code, course);
    for (const o of course.offerings) if (o.year > horizonYear) horizonYear = o.year;
  }
  return { courses, horizonYear };
}

const cat = loadRealCatalogue();
const view = buildPlanView(cat, AACOM_2027, EXAMPLE_PLAN);

describe("actionFor", () => {
  it("moves a placed course", () => {
    expect(actionFor(view, "COMP2100", 3)).toEqual({ kind: "move", code: "COMP2100", term: 3 });
  });

  it("places one that isn't placed", () => {
    expect(actionFor(view, "COMP4680", 4)).toEqual({ kind: "place", code: "COMP4680", term: 4 });
  });
});

describe("changesNothing", () => {
  it("is true for a move to the term the course is already in", () => {
    expect(changesNothing(view, { kind: "move", code: "COMP2100", term: 2 })).toBe(true);
  });

  it("is false for a real move, a place or a remove", () => {
    expect(changesNothing(view, { kind: "move", code: "COMP2100", term: 3 })).toBe(false);
    expect(changesNothing(view, { kind: "place", code: "COMP4680", term: 4 })).toBe(false);
    expect(changesNothing(view, { kind: "remove", code: "COMP2100" })).toBe(false);
  });
});

describe("undoEntry", () => {
  it("undoes a move by moving back", () => {
    expect(undoEntry(view, { kind: "move", code: "COMP2100", term: 3 })).toEqual({
      message: "Moved COMP2100 to S2 2028",
      undo: { kind: "move", code: "COMP2100", term: 2 },
      restorePin: null,
    });
  });

  it("undoes a place by removing", () => {
    const entry = undoEntry(view, { kind: "place", code: "COMP4680", term: 4 });
    expect(entry.undo).toEqual({ kind: "remove", code: "COMP4680" });
    expect(entry.message).toBe("Placed COMP4680 in S1 2029");
  });

  it("undoes removing a pinned course by placing it back and restoring its pin", () => {
    const pinned = buildPlanView(cat, AACOM_2027, {
      ...EXAMPLE_PLAN,
      placements: EXAMPLE_PLAN.placements.map((p) => (p.code === "COMP2100" ? { ...p, pinnedGroupId: "compulsory" } : p)),
    });
    const placement = pinned.placements.find((p) => p.code === "COMP2100")!;
    expect(placement.pinned).toBe(true);
    expect(undoEntry(pinned, { kind: "remove", code: "COMP2100" })).toEqual({
      message: "Removed COMP2100 — Software Construction",
      undo: { kind: "place", code: "COMP2100", term: 2 },
      restorePin: placement.countsToward,
    });
  });
});

describe("newlyBroken", () => {
  const at = (placements: [string, number][]) => {
    const plan: PlanState = {
      id: "p",
      readOnly: false,
      cutoff: 0,
      choices: {},
      placements: placements.map(([code, term]) => ({ code, term, pinnedGroupId: null })),
    };
    return buildPlanView(cat, AACOM_2027, plan);
  };
  const stateOf = (v: ReturnType<typeof at>, code: string) => v.placements.find((p) => p.code === code)!.state;

  it("names a course that now misses a prerequisite", () => {
    const before = at([["COMP2100", 2], ["COMP2120", 3]]);
    const after = at([["COMP2100", 4], ["COMP2120", 3]]);
    expect(["available", "check"]).toContain(stateOf(before, "COMP2120"));
    expect(stateOf(after, "COMP2120")).toBe("soft");
    expect(newlyBroken(before, after, "COMP2100")).toEqual(["COMP2120"]);
  });

  it("leaves out the course acted on", () => {
    // Moving COMP2120 ahead of COMP2100 breaks COMP2120 itself.
    const before = at([["COMP2100", 5], ["COMP2120", 5]]);
    const after = at([["COMP2100", 5], ["COMP2120", 3]]);
    expect(["available", "check"]).toContain(stateOf(before, "COMP2120"));
    expect(stateOf(after, "COMP2120")).toBe("soft");
    expect(newlyBroken(before, after, "COMP2120")).toEqual([]);
  });

  it("ignores courses already missing a prerequisite, or blocked", () => {
    const soft = [at([["COMP2100", 4], ["COMP2120", 3]]), at([["COMP2100", 5], ["COMP2120", 3]])] as const;
    expect(stateOf(soft[0], "COMP2120")).toBe("soft");
    expect(newlyBroken(soft[0], soft[1], "COMP2100")).toEqual([]);

    // COMP2120 doesn't run in S1 2029.
    const hard = [at([["COMP2100", 2], ["COMP2120", 4]]), at([["COMP2100", 5], ["COMP2120", 4]])] as const;
    expect(stateOf(hard[0], "COMP2120")).toBe("hard");
    expect(newlyBroken(hard[0], hard[1], "COMP2100")).toEqual([]);
  });
});

describe("knockOnText", () => {
  it("names a single course", () => {
    expect(knockOnText(["COMP2120"])).toBe(" COMP2120 now misses a prerequisite.");
  });

  it("counts several, naming the first", () => {
    expect(knockOnText(["COMP2120", "COMP4528", "COMP3320"])).toBe(
      " 3 courses now miss a prerequisite, including COMP2120.",
    );
  });

  it("says nothing when nothing broke", () => {
    expect(knockOnText([])).toBe("");
  });
});
