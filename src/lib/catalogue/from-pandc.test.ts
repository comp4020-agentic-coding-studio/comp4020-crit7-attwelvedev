import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromPandc, isUndergrad, type PandcCourseJson } from "./from-pandc";

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
});
