import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { EXAMPLE_PLAN } from "../data/example-plan";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { actedOn, actionFor, changesNothing, historyStep, knockOnText, newlyBroken } from "./plan-actions";
import { groupPath } from "./planner-logic";

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

// The example plan with COMP2100 pinned to Compulsory.
const pinned = buildPlanView(cat, AACOM_2027, {
  ...EXAMPLE_PLAN,
  placements: EXAMPLE_PLAN.placements.map((p) => (p.code === "COMP2100" ? { ...p, pinnedGroupId: "compulsory" } : p)),
});

// The first placed course with a manual check (MATH1115 or MATH1116), and
// that check.
const checked = view.placements.find((p) => p.checks.length)!;
const check = checked.checks[0];

// A specialisation other than the example's chosen one ("arin").
const specGroup = groupPath(view, "spec").at(-1)!;
const otherSpec = specGroup.options.find((o) => o.id !== specGroup.chosenId)!;

describe("changesNothing", () => {
  it("is true for a move to the term the course is already in", () => {
    expect(changesNothing(view, { kind: "move", code: "COMP2100", term: 2 })).toBe(true);
  });

  it("is false for a real move, a place or a remove", () => {
    expect(changesNothing(view, { kind: "move", code: "COMP2100", term: 3 })).toBe(false);
    expect(changesNothing(view, { kind: "place", code: "COMP4680", term: 4 })).toBe(false);
    expect(changesNothing(view, { kind: "remove", code: "COMP2100" })).toBe(false);
  });

  it("is true for a pin to what it already counts toward", () => {
    expect(changesNothing(view, { kind: "pin", code: "COMP2100", groupId: null })).toBe(true);
    expect(changesNothing(pinned, { kind: "pin", code: "COMP2100", groupId: "compulsory" })).toBe(true);
  });

  it("is true for the current check answer, choice or cutoff", () => {
    expect(changesNothing(view, { kind: "check", code: checked.code, item: check.item, answer: check.answer })).toBe(
      true,
    );
    expect(changesNothing(view, { kind: "choice", groupId: "spec", childId: specGroup.chosenId })).toBe(true);
    expect(changesNothing(view, { kind: "cutoff", cutoff: view.plan.cutoff })).toBe(true);
  });

  it("is false for each kind with a different value", () => {
    expect(changesNothing(view, { kind: "pin", code: "COMP2100", groupId: "electives" })).toBe(false);
    expect(changesNothing(pinned, { kind: "pin", code: "COMP2100", groupId: null })).toBe(false);
    const other = check.answer === "met" ? "not-met" : "met";
    expect(changesNothing(view, { kind: "check", code: checked.code, item: check.item, answer: other })).toBe(false);
    expect(changesNothing(view, { kind: "choice", groupId: "spec", childId: otherSpec.id })).toBe(false);
    expect(changesNothing(view, { kind: "cutoff", cutoff: view.plan.cutoff + 1 })).toBe(false);
  });
});

describe("historyStep", () => {
  it("undoes a move by moving back", () => {
    const action = { kind: "move", code: "COMP2100", term: 3 } as const;
    expect(historyStep(view, action)).toEqual({
      message: "Moved COMP2100 to S2 2028",
      redo: action,
      undo: [{ kind: "move", code: "COMP2100", term: 2 }],
    });
  });

  it("undoes a place by removing", () => {
    const step = historyStep(view, { kind: "place", code: "COMP4680", term: 4 });
    expect(step.undo).toEqual([{ kind: "remove", code: "COMP4680" }]);
    expect(step.message).toBe("Placed COMP4680 in S1 2029");
  });

  it("undoes removing a pinned course by placing it back and restoring its pin", () => {
    const placement = pinned.placements.find((p) => p.code === "COMP2100")!;
    expect(placement.pinned).toBe(true);
    expect(historyStep(pinned, { kind: "remove", code: "COMP2100" })).toEqual({
      message: "Removed COMP2100 — Software Construction",
      redo: { kind: "remove", code: "COMP2100" },
      undo: [
        { kind: "place", code: "COMP2100", term: 2 },
        { kind: "pin", code: "COMP2100", groupId: placement.countsToward },
      ],
    });
  });

  it("undoes removing an unpinned course with just a place", () => {
    expect(historyStep(view, { kind: "remove", code: "COMP2100" }).undo).toEqual([
      { kind: "place", code: "COMP2100", term: 2 },
    ]);
  });

  it("undoes a pin by setting the previous one back", () => {
    const step = historyStep(view, { kind: "pin", code: "COMP2100", groupId: "electives" });
    expect(step.message).toBe("COMP2100 now counts toward Electives");
    expect(step.undo).toEqual([{ kind: "pin", code: "COMP2100", groupId: null }]);

    const automatic = historyStep(pinned, { kind: "pin", code: "COMP2100", groupId: null });
    expect(automatic.message).toBe("COMP2100 now counts automatically");
    expect(automatic.undo).toEqual([{ kind: "pin", code: "COMP2100", groupId: "compulsory" }]);
  });

  it("undoes a check answer by setting the previous answer back", () => {
    const step = historyStep(view, { kind: "check", code: checked.code, item: check.item, answer: "met" });
    expect(step.message).toBe(`${checked.code}: '${check.label}' marked Met`);
    expect(step.undo).toEqual([{ kind: "check", code: checked.code, item: check.item, answer: check.answer }]);
    expect(historyStep(view, { kind: "check", code: checked.code, item: check.item, answer: "not-met" }).message).toBe(
      `${checked.code}: '${check.label}' marked Not met`,
    );
    expect(historyStep(view, { kind: "check", code: checked.code, item: check.item, answer: null }).message).toBe(
      `${checked.code}: '${check.label}' marked Not sure`,
    );
  });

  it("undoes a choice by choosing the previous option back", () => {
    const step = historyStep(view, { kind: "choice", groupId: "spec", childId: otherSpec.id });
    expect(step.message).toBe(`Switched Specialisation from Artificial Intelligence to ${otherSpec.label}`);
    expect(step.undo).toEqual([{ kind: "choice", groupId: "spec", childId: "arin" }]);
  });

  it("a first choice says Chose", () => {
    const fresh = buildPlanView(cat, AACOM_2027, { ...EXAMPLE_PLAN, choices: {} });
    const option = groupPath(fresh, "spec").at(-1)!.options.find((o) => o.id === otherSpec.id)!;
    const step = historyStep(fresh, { kind: "choice", groupId: "spec", childId: option.id });
    expect(step.message).toBe(`Chose ${option.label} for Specialisation`);
    expect(step.undo).toEqual([{ kind: "choice", groupId: "spec", childId: null }]);
  });

  it("undoes a cutoff by setting the previous one back", () => {
    // A cutoff of 3 completes the first three semesters, through S1 2028.
    const step = historyStep(view, { kind: "cutoff", cutoff: 3 });
    expect(step.message).toBe("Completed through S1 2028");
    expect(step.undo).toEqual([{ kind: "cutoff", cutoff: 2 }]);
    expect(historyStep(view, { kind: "cutoff", cutoff: 0 }).message).toBe("Nothing completed yet");
    expect(historyStep(view, { kind: "cutoff", cutoff: 8 }).message).toBe("All semesters completed");
  });
});

describe("actedOn", () => {
  it("is the course for a course's own change", () => {
    expect(actedOn({ kind: "place", code: "COMP4680", term: 4 })).toBe("COMP4680");
    expect(actedOn({ kind: "move", code: "COMP2100", term: 3 })).toBe("COMP2100");
    expect(actedOn({ kind: "remove", code: "COMP2100" })).toBe("COMP2100");
    expect(actedOn({ kind: "pin", code: "COMP2100", groupId: null })).toBe("COMP2100");
    expect(actedOn({ kind: "check", code: "MATH1116", item: "x", answer: "met" })).toBe("MATH1116");
  });

  it("is null for a change to the whole plan", () => {
    expect(actedOn({ kind: "choice", groupId: "spec", childId: null })).toBeNull();
    expect(actedOn({ kind: "cutoff", cutoff: 3 })).toBeNull();
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

  it("leaves nothing out when no course was acted on", () => {
    const before = at([["COMP2100", 5], ["COMP2120", 5]]);
    const after = at([["COMP2100", 5], ["COMP2120", 3]]);
    expect(newlyBroken(before, after, null)).toEqual(["COMP2120"]);
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
