import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRequisites } from "../domain/requisites";
import { extrasFromPandc, fromPandc, isUndergrad, type PandcCourseJson } from "./from-pandc";

function loadCourse(code: string): PandcCourseJson {
  return JSON.parse(readFileSync(`data/2027/courses/${code}.json`, "utf-8"));
}

describe("fromPandc", () => {
  it("COMP2100 maps units, level, offerings", () => {
    const course = fromPandc(loadCourse("COMP2100"), null);
    expect(course.units).toBe(6);
    expect(course.level).toBe(2000);
    expect(course.offerings).toContainEqual({ year: 2027, session: "First Semester" });
    expect(course.url).toMatch(/\/2027\/course\/COMP2100$/);
  });

  it("COMP4550 is two-semester, 12 units per part", () => {
    const course = fromPandc(loadCourse("COMP4550"), null);
    expect(course.twoSemester).toBe(true);
    expect(course.units).toBe(12);
  });

  it("COMP4500 is two-semester; COMP2100 is not", () => {
    expect(fromPandc(loadCourse("COMP4500"), null).twoSemester).toBe(true);
    expect(fromPandc(loadCourse("COMP2100"), null).twoSemester).toBe(false);
  });

  it("isUndergrad", () => {
    expect(isUndergrad("COMP4550")).toBe(true);
    expect(isUndergrad("COMP8280")).toBe(false);
  });

  it("COMP4600 has no offerings", () => {
    expect(fromPandc(loadCourse("COMP4600"), null).offerings).toEqual([]);
  });

  it("isTdp follows the given tdp list", () => {
    expect(fromPandc(loadCourse("COMP4500"), ["COMP4500"]).isTdp).toBe(true);
    expect(fromPandc(loadCourse("COMP2100"), ["COMP4500"]).isTdp).toBe(false);
    expect(fromPandc(loadCourse("COMP2100"), null).isTdp).toBe(false);
  });

  // MATH1116's incompatibility sentence names the course itself ("You may
  // not enrol in MATH1116 if ... MATH1014"), which the code-extracting
  // parser read as MATH1116 conflicting with itself — on its card, in
  // Details, and in the conflict check.
  it("MATH1116 isn't incompatible with itself, only MATH1014", () => {
    expect(fromPandc(loadCourse("MATH1116"), null, parseRequisites).requisites.incompatible).toEqual(["MATH1014"]);
  });

  it("no catalogue course is incompatible with itself", () => {
    for (const file of globSync("data/2027/courses/*.json")) {
      const course = fromPandc(JSON.parse(readFileSync(file, "utf-8")), null, parseRequisites);
      expect(course.requisites.incompatible, course.code).not.toContain(course.code);
    }
  });
});

describe("extrasFromPandc", () => {
  it("carries learning outcomes, assessment and co-taught codes", () => {
    const extras = extrasFromPandc(loadCourse("COMP2100"));
    expect(extras.learningOutcomes).toHaveLength(6);
    expect(extras.learningOutcomes[0]).toBe("Apply object-oriented programming concepts for medium-scale software projects");
    expect(extras.assessment).toEqual([
      { task: "Assignments", weight: "30" },
      { task: "Labs and Video Assignments", weight: "25" },
      { task: "Final Exam", weight: "45" },
    ]);
    expect(extras.cotaught).toEqual(["COMP6442"]);
  });

  it("keeps every class with its mode and class number", () => {
    const json = loadCourse("COMP2100");
    const extras = extrasFromPandc(json);
    expect(extras.classes[0]).toEqual({ year: 2027, session: "First Semester", mode: "In Person", classNumber: "5103" });
    expect(extras.classes).toHaveLength(json.offerings.length);
  });

  it("defaults missing fields", () => {
    const json = {
      ...loadCourse("COMP2100"),
      learning_outcomes: undefined,
      assessment: undefined,
      cotaught: undefined,
      offerings: [{ year: "2027", semester: "First Semester", mode: "Online" }],
    };
    expect(extrasFromPandc(json)).toEqual({
      learningOutcomes: [],
      assessment: [],
      cotaught: [],
      classes: [{ year: 2027, session: "First Semester", mode: "Online", classNumber: null }],
    });
  });

  it("drops the course's own code from co-taught", () => {
    const json = { ...loadCourse("COMP2100"), cotaught: ["COMP2100", "COMP6442"] };
    expect(extrasFromPandc(json).cotaught).toEqual(["COMP6442"]);
  });
});
