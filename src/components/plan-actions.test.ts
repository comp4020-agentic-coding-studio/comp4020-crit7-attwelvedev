import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { EXAMPLE_PLAN } from "../data/example-plan";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue, CatalogueCourse } from "../lib/domain/types";
import { buildPlanView } from "../lib/domain/view";
import { actionFor, undoEntry } from "./plan-actions";

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
