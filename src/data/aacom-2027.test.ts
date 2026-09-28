import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GroupDef } from "../lib/domain/types";
import { AACOM_2027, KNOWN_MISSING } from "./aacom-2027";

function flattenGroups(groups: GroupDef[]): GroupDef[] {
  return groups.flatMap((g) => [g, ...(g.children ? flattenGroups(g.children) : [])]);
}

function allGroups(): GroupDef[] {
  return flattenGroups(AACOM_2027.groups);
}

function allListedCourses(): string[] {
  return allGroups().flatMap((g) => g.courses ?? []);
}

describe("AACOM_2027", () => {
  it("group ids are unique", () => {
    const ids = allGroups().map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("top-level units sum to 192", () => {
    const sum = AACOM_2027.groups.reduce((total, g) => total + g.unitsRequired, 0);
    expect(sum).toBe(192);
    expect(AACOM_2027.totalUnits).toBe(192);
  });

  it("every listed course has scraped data", () => {
    expect(KNOWN_MISSING).toEqual([]);
    for (const code of allListedCourses()) {
      if (KNOWN_MISSING.includes(code)) continue;
      expect(existsSync(`data/2027/courses/${code}.json`), code).toBe(true);
    }
  });

  it("specialisation options are ARIN, HCCC, SYAR, THCS", () => {
    const spec = AACOM_2027.groups.find((g) => g.id === "spec")!;
    expect(spec.children?.map((c) => c.id)).toEqual(["arin", "hccc", "syar", "thcs"]);
  });

  it("capstone options are research, team, internship", () => {
    const capstone = AACOM_2027.groups.find((g) => g.id === "capstone")!;
    expect(capstone.children?.map((c) => c.id)).toEqual(["cap-research", "cap-team", "cap-intern"]);
  });

  it("ARIN caps match P&C 2027", () => {
    const arin = AACOM_2027.groups.find((g) => g.id === "spec")!.children!.find((c) => c.id === "arin")!;
    const arinA = arin.children!.find((c) => c.id === "arin-a")!;
    const arinB = arin.children!.find((c) => c.id === "arin-b")!;
    expect(arinA.unitsMax).toBe(12);
    expect(arinB.unitsRequired).toBe(12);
  });

  it("tdpCourses mirrors data/2027/tdp.json", () => {
    const tdp = JSON.parse(readFileSync("data/2027/tdp.json", "utf-8"));
    expect(AACOM_2027.tdpCourses).toEqual(tdp.courses);
  });

  it("top-level groups carry the agreed families", () => {
    expect(Object.fromEntries(AACOM_2027.groups.map((g) => [g.id, g.family]))).toEqual({
      "prog-a": "foundations",
      "prog-b": "foundations",
      "math-disc": "foundations",
      compulsory: "foundations",
      spec: "specialisation",
      "comp-upper": "advanced",
      ict: "ict",
      capstone: "capstone",
      electives: "neutral",
    });
    const nested = AACOM_2027.groups.flatMap((g) => flattenGroups(g.children ?? []));
    expect(nested.length).toBeGreaterThan(0);
    expect(nested.filter((g) => g.family !== undefined).map((g) => g.id)).toEqual([]);
  });
});
