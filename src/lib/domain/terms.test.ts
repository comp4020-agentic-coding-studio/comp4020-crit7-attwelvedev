import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromPandc, type PandcCourseJson } from "../catalogue/from-pandc";
import type { CatalogueCourse } from "./types";
import { horizonYear, offeredLabel, offeringStatus, TERMS, termLabel } from "./terms";

function loadCourse(code: string): CatalogueCourse {
  const json: PandcCourseJson = JSON.parse(readFileSync(`data/2027/courses/${code}.json`, "utf-8"));
  return fromPandc(json, null);
}

function term(index: number) {
  const t = TERMS[index];
  if (!t) throw new RangeError(`term index out of range: ${index}`);
  return t;
}

describe("TERMS", () => {
  it("has 8 terms S1 2027 … S2 2030", () => {
    expect(TERMS.map((t) => t.label)).toEqual([
      "S1 2027", "S2 2027", "S1 2028", "S2 2028",
      "S1 2029", "S2 2029", "S1 2030", "S2 2030",
    ]);
    expect(TERMS[3]).toEqual({ index: 3, year: 2028, session: "S2", label: "S2 2028" });
  });

  it("termLabel(8) throws RangeError", () => {
    expect(() => termLabel(8)).toThrow(RangeError);
  });
});

describe("horizonYear", () => {
  it("is 2028 for the real 2027 catalogue", () => {
    const courses = ["COMP2100", "COMP3670", "COMP4045", "ENGN1211", "COMP4600"].map(loadCourse);
    expect(horizonYear(courses)).toBe(2028);
  });
});

describe("offeringStatus", () => {
  const horizon = 2028;

  it("COMP3670: S1 2027 not-offered, S2 2027 offered", () => {
    const c = loadCourse("COMP3670");
    expect(offeringStatus(c, term(0), horizon)).toBe("not-offered"); // S1 2027
    expect(offeringStatus(c, term(1), horizon)).toBe("offered"); // S2 2027
  });

  it("COMP4045: S2 2029 projected (from 2028 S2), S1 2029 not-offered", () => {
    const c = loadCourse("COMP4045");
    expect(offeringStatus(c, term(5), horizon)).toBe("projected"); // S2 2029
    expect(offeringStatus(c, term(4), horizon)).toBe("not-offered"); // S1 2029
  });

  it("ENGN1211: S1 2028 not-offered (horizon data), S1 2029 projected (from 2027)", () => {
    const c = loadCourse("ENGN1211");
    expect(offeringStatus(c, term(2), horizon)).toBe("not-offered"); // S1 2028
    expect(offeringStatus(c, term(4), horizon)).toBe("projected"); // S1 2029
  });

  it("COMP4600: unknown in every term", () => {
    const c = loadCourse("COMP4600");
    for (const t of TERMS) {
      expect(offeringStatus(c, t, horizon)).toBe("unknown");
    }
  });

  it("a course offered only in an out-of-scope session (e.g. Winter) is unknown, not not-offered", () => {
    // Real shape: P&C published rows, but none in First/Second Semester —
    // e.g. CRIM2010, offered only in Winter Session. `offerings` is
    // non-empty, so this must not fall through to "not-offered".
    const c = loadCourse("COMP2100");
    const winterOnly = { ...c, offerings: [{ year: 2027, session: "Winter Session" }] };
    for (const t of TERMS) {
      expect(offeringStatus(winterOnly, t, horizon)).toBe("unknown");
    }
  });
});

describe("offeredLabel", () => {
  it("COMP2100 gives 'S1, S2'", () => {
    expect(offeredLabel(loadCourse("COMP2100"))).toBe("S1, S2");
  });

  it("COMP4600 gives 'No published offering'", () => {
    expect(offeredLabel(loadCourse("COMP4600"))).toBe("No published offering");
  });
});
