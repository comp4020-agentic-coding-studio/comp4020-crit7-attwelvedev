import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { specialisationByCode } from "../data/specialisations";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse, PlanState } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { groupLabel, placedStatus } from "./planner-logic";
import { chosenSpecGroup, courseLineStatus, linkCodes } from "./spec-logic";

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
