import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { specialisationByCode } from "../data/specialisations";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { groupLabel, placedStatus } from "./planner-logic";
import type { WhatIfView } from "../lib/domain/what-if";
import { chosenSpecGroup, courseLineStatus, fitFigures, fitSummary, linkCodes, shortfallText } from "./spec-logic";

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

const withComp3670 = (choices: PlanState["choices"]): PlanState => ({
  ...emptyPlan(),
  choices,
  placements: [{ code: "COMP3670", term: 4, pinnedGroupId: null }],
});

describe("chosenSpecGroup", () => {
  it("is null with nothing chosen, and the option's group once one is", () => {
    expect(chosenSpecGroup(buildPlanView(cat, AACOM_2027, emptyPlan()))).toBeNull();
    expect(chosenSpecGroup(buildPlanView(cat, AACOM_2027, { ...emptyPlan(), choices: { spec: "arin" } }))).toBe("arin");
  });
});

describe("linkCodes", () => {
  it("splits course codes out of prose", () => {
    expect(linkCodes("complete MATH1013 or MATH1115 early", () => true)).toEqual([
      "complete ",
      { code: "MATH1013" },
      " or ",
      { code: "MATH1115" },
      " early",
    ]);
  });

  it("leaves a code it can't open inside the text", () => {
    expect(linkCodes("complete MATH1013 or MATH1115 early", (c) => c === "MATH1115")).toEqual([
      "complete MATH1013 or ",
      { code: "MATH1115" },
      " early",
    ]);
  });
});

describe("courseLineStatus", () => {
  const arin = specialisationByCode("ARIN-SPEC")!;
  const hccc = specialisationByCode("HCCC-SPEC")!;

  it("says an unplaced course isn't in the plan", () => {
    const view = buildPlanView(cat, AACOM_2027, emptyPlan());
    expect(courseLineStatus(view, "COMP3670", arin, arin.lists[0].groupId)).toBe("Not in your plan");
  });

  it("adds where a chosen spec's course counts", () => {
    const view = buildPlanView(cat, AACOM_2027, withComp3670({ spec: "arin" }));
    const placement = view.placements.find((p) => p.code === "COMP3670")!;
    const status = placedStatus(view, placement);
    const base = `${status.word} ${status.parts[0].termLabel}`;
    const listGroupId = arin.lists[0].groupId;
    const suffix =
      placement.countsToward === listGroupId
        ? ", counts here"
        : placement.countsToward
          ? `, counts toward ${groupLabel(view, placement.countsToward)}`
          : ", not counting toward anything";
    expect(courseLineStatus(view, "COMP3670", arin, listGroupId)).toBe(base + suffix);
  });

  it("gives an unchosen spec's line the plain status", () => {
    const view = buildPlanView(cat, AACOM_2027, withComp3670({ spec: "arin" }));
    const placement = view.placements.find((p) => p.code === "COMP3670")!;
    const status = placedStatus(view, placement);
    expect(courseLineStatus(view, "COMP3670", hccc, hccc.lists[2].groupId)).toBe(
      `${status.word} ${status.parts[0].termLabel}`,
    );
  });
});

function whatIf(overrides: Partial<WhatIfView>): WhatIfView {
  return {
    groupId: "spec",
    optionId: "arin",
    completed: 0,
    planned: 0,
    required: 24,
    moves: [],
    leaving: [],
    shortfalls: [],
    countsToward: {},
    lists: [],
    ...overrides,
  };
}

const ref = (id: string, label: string) => ({ id, label, family: "specialisation" as const });
const to = ref("arin-a", "Artificial Intelligence — foundations (max 12)");

describe("fitFigures", () => {
  // The bar above it already prints the figures, so this says only what's left.
  it("says what's left, or that it's covered", () => {
    expect(fitFigures(whatIf({ completed: 12, planned: 6 }))).toBe("6 units to go.");
    expect(fitFigures(whatIf({ completed: 18, planned: 6 }))).toBe("Covered.");
  });
});

describe("fitSummary", () => {
  it("has a sentence for no moves, fresh courses, and moved ones", () => {
    expect(fitSummary(whatIf({}))).toBe(
      "None of your courses would count toward it yet, so all 24 units are still to go.",
    );
    expect(
      fitSummary(
        whatIf({
          moves: [
            { code: "COMP3620", from: null, to },
            { code: "COMP3670", from: null, to },
          ],
        }),
      ),
    ).toBe("2 of your courses would count here.");
    const electives = ref("electives", "Electives");
    const syar = ref("syar-a", "Systems & Architecture — foundations (max 12)");
    expect(
      fitSummary(
        whatIf({
          moves: [
            { code: "COMP3620", from: electives, to },
            { code: "COMP3670", from: electives, to },
            { code: "COMP4620", from: syar, to },
          ],
        }),
      ),
    ).toBe("3 of your courses would move here, from Electives and Systems & Architecture — foundations (max 12).");
  });
});

describe("shortfallText", () => {
  it("names the requirement and where it would drop to", () => {
    expect(shortfallText({ groupId: "electives", label: "Electives", completed: 30, planned: 6, required: 48 })).toBe(
      "Electives would drop to 36 of 48",
    );
  });
});

describe("courseLineStatus with a what-if", () => {
  const arin = specialisationByCode("ARIN-SPEC")!;
  const view = buildPlanView(cat, AACOM_2027, withComp3670({}));
  const placement = view.placements.find((p) => p.code === "COMP3670")!;
  const status = placedStatus(view, placement);
  const base = `${status.word} ${status.parts[0].termLabel}`;
  const list = arin.lists[0];

  it("says a course would count toward the list it would land in", () => {
    const w = whatIf({ countsToward: { COMP3670: list.groupId } });
    expect(courseLineStatus(view, "COMP3670", arin, list.groupId, w)).toBe(`${base}, would count`);
  });

  it("says it wouldn't, and why when the list is full", () => {
    const full = whatIf({
      countsToward: { COMP3670: "comp-upper" },
      lists: [{ groupId: list.groupId, completed: 6, planned: 6, unitsMax: 12 }],
    });
    expect(courseLineStatus(view, "COMP3670", arin, list.groupId, full)).toBe(
      `${base}, wouldn't count here, over the 12-unit limit`,
    );
    const room = whatIf({
      countsToward: { COMP3670: "comp-upper" },
      lists: [{ groupId: list.groupId, completed: 0, planned: 6, unitsMax: 12 }],
    });
    expect(courseLineStatus(view, "COMP3670", arin, list.groupId, room)).toBe(`${base}, wouldn't count here`);
  });
});
