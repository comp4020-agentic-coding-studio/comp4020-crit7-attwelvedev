import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../catalogue/from-pandc";
import { parseRequisites } from "./requisites";
import type { Catalogue, CatalogueCourse, ReqExpr } from "./types";
import { horizonYear } from "./terms";
import { createFeasibility } from "./feasibility";

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
  return { courses, horizonYear: horizonYear(all) };
}

function catalogueWith(extra: CatalogueCourse[]): Catalogue {
  const cat = loadRealCatalogue();
  const courses = new Map(cat.courses);
  for (const c of extra) courses.set(c.code, c);
  return { courses, horizonYear: cat.horizonYear };
}

function synthetic(code: string, opts: Partial<CatalogueCourse> & { prereq?: ReqExpr | null } = {}): CatalogueCourse {
  return {
    code,
    title: code,
    units: 6,
    level: 1000,
    description: "",
    url: "",
    offerings: opts.offerings ?? [{ year: 2027, session: "First Semester" }, { year: 2027, session: "Second Semester" }],
    requisites: {
      prereq: opts.prereq ?? null,
      incompatible: [],
      unverifiable: [],
      otherPrograms: [],
      parseStatus: "ok",
    },
    requisiteRaw: "",
    twoSemester: opts.twoSemester ?? false,
    isTdp: false,
    isStub: false,
    scrapedAt: "",
  };
}

describe("createFeasibility (real 2027 catalogue)", () => {
  const cat = loadRealCatalogue();
  const feas = createFeasibility(cat);

  it("COMP3630 in S1 2027 is hard-blocked by the 24-unit clause", () => {
    const reason = feas.hardBlock("COMP3630", 0);
    expect(reason).not.toBeNull();
    expect(reason).toContain("24 units of COMP");
    expect(reason).toContain("S1 2027");
  });

  it("COMP3600 in S1 2028 is not offered", () => {
    const reason = feas.hardBlock("COMP3600", 2);
    expect(reason).toContain("isn't offered in S1 2028");
  });

  it("COMP3600 in S2 2028 is not hard-blocked", () => {
    expect(feas.hardBlock("COMP3600", 3)).toBeNull();
  });

  it("multi-hop chain: COMP3300 <- COMP2310 <- (COMP1110|COMP1140) <- (COMP1100|COMP1130)", () => {
    expect(feas.earliestTerm("COMP1110")).toBe(1);
    expect(feas.earliestTerm("COMP2310")).toBe(3);
    const blockedAt3 = feas.hardBlock("COMP3300", 3);
    expect(blockedAt3).toContain("COMP2310");
    expect(blockedAt3).toContain("S2 2028");
    expect(feas.hardBlock("COMP3300", 5)).toBeNull();
  });

  it("COMP4550 in S2 2030 is hard-blocked (no following semester)", () => {
    const reason = feas.hardBlock("COMP4550", 7);
    expect(reason).not.toBeNull();
    expect(reason).toContain("COMP4550");
    expect(reason).toContain("no semester after S2 2030");
  });

  it("COMP4600 (unknown offering) is never hard-blocked on offering (FR34)", () => {
    for (let t = 0; t < 8; t++) {
      const reason = feas.hardBlock("COMP4600", t);
      if (reason) expect(reason).not.toContain("isn't offered");
    }
  });
});

describe("createFeasibility (synthetic catalogues)", () => {
  it("cycles terminate: A needs B and B needs A", () => {
    const a: ReqExpr = { kind: "course", code: "ZZAA1000", concurrent: false };
    const b: ReqExpr = { kind: "course", code: "ZZAA1001", concurrent: false };
    const cat = catalogueWith([
      synthetic("ZZAA1000", { prereq: { kind: "and", items: [b] } }),
      synthetic("ZZAA1001", { prereq: { kind: "and", items: [a] } }),
    ]);
    const feas = createFeasibility(cat);
    expect(feas.earliestTerm("ZZAA1000")).toBe(Infinity);
    expect(feas.earliestTerm("ZZAA1001")).toBe(Infinity);
    const reason = feas.hardBlock("ZZAA1000", 7);
    expect(reason).toContain("ZZAA1001");
  });

  it("unknown prereq codes don't hard-block", () => {
    const cat = catalogueWith([
      synthetic("ZZAA1002", {
        prereq: { kind: "or", items: [{ kind: "course", code: "ZZZZ1111", concurrent: false }] },
      }),
    ]);
    const feas = createFeasibility(cat);
    expect(feas.hardBlock("ZZAA1002", 1)).toBeNull();
  });
});
