import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const AACOM_TREE_COURSES = [
  "COMP1100", "COMP1110", "COMP1130", "COMP1140", "COMP2100", "COMP2120",
  "COMP2300", "COMP2310", "COMP2400", "COMP3600", "COMP3630", "COMP4450",
  "COMP4500", "COMP4550", "COMP4820", "MATH1005", "MATH2222",
];

describe("2027 scraped data", () => {
  it("every AACOM tree course has a scraped JSON", () => {
    for (const code of AACOM_TREE_COURSES) {
      expect(existsSync(`data/2027/courses/${code}.json`), code).toBe(true);
    }
  });

  it("subplans exist", () => {
    for (const spec of ["ARIN-SPEC", "HCCC-SPEC", "SYAR-SPEC", "THCS-SPEC"]) {
      expect(existsSync(`data/2027/subplans/${spec}.json`), spec).toBe(true);
    }
  });

  it("catalogue exists", () => {
    const catalogue = JSON.parse(readFileSync("data/2027/catalogue-COMP.json", "utf-8"));
    expect(Array.isArray(catalogue)).toBe(true);
    expect(catalogue.length).toBeGreaterThan(100);
  });

  it("tdp.json has a valid shape", () => {
    const tdp = JSON.parse(readFileSync("data/2027/tdp.json", "utf-8"));
    expect(tdp.source === null || typeof tdp.source === "string").toBe(true);
    expect(tdp.courses === null || Array.isArray(tdp.courses)).toBe(true);
    expect(typeof tdp.note).toBe("string");
  });
});
