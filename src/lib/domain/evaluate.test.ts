import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromPandc, isUndergrad, type PandcCourseJson } from "../catalogue/from-pandc";
import { EXAMPLE_PLAN } from "../../data/example-plan";
import { createFeasibility } from "./feasibility";
import { parseRequisites } from "./requisites";
import type { Catalogue, CatalogueCourse, PlanChecks, PlanState, ReqExpr } from "./types";
import { evaluatePlan } from "./evaluate";

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

function plan(placements: { code: string; term: number }[], cutoff = 0, checks: PlanChecks = {}): PlanState {
  return {
    id: "p",
    readOnly: false,
    cutoff,
    choices: {},
    placements: placements.map((p) => ({ code: p.code, term: p.term, pinnedGroupId: null })),
    checks,
  };
}

interface SyntheticOpts {
  units?: number;
  offerings?: { year: number; session: string }[];
  twoSemester?: boolean;
  prereq?: ReqExpr | null;
  incompatible?: string[];
  unverifiable?: string[];
}

function synthetic(code: string, opts: SyntheticOpts = {}): CatalogueCourse {
  return {
    code,
    title: code,
    units: opts.units ?? 6,
    level: 1000,
    description: "",
    url: "",
    offerings: opts.offerings ?? [{ year: 2027, session: "First Semester" }, { year: 2027, session: "Second Semester" }],
    requisites: {
      prereq: opts.prereq ?? null,
      incompatible: opts.incompatible ?? [],
      unverifiable: opts.unverifiable ?? [],
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

function syntheticCatalogue(courses: CatalogueCourse[]): Catalogue {
  return { courses: new Map(courses.map((c) => [c.code, c])), horizonYear: 2028 };
}

describe("evaluatePlan (real 2027 catalogue)", () => {
  const cat = loadRealCatalogue();
  const feas = createFeasibility(cat);

  it("COMP2100 alone in S1 2028 is soft-blocked with suggestions for COMP1110 and COMP1140", () => {
    const result = evaluatePlan(cat, feas, plan([{ code: "COMP2100", term: 2 }]));
    const p = result.placements[0]!;
    expect(p.state).toBe("soft");
    expect(p.suggestions).toContainEqual(expect.objectContaining({ code: "COMP1140", action: "place", term: 1 }));
    expect(p.suggestions).toContainEqual(expect.objectContaining({ code: "COMP1110", action: "place" }));
    expect(p.reasons.some((r) => r.includes("6") && r.includes("MATH"))).toBe(true);
  });

  it("placing COMP1140 in S2 2027 and MATH1115 in S1 2027 makes COMP2100 available", () => {
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP1140", term: 1 },
        { code: "MATH1115", term: 0 },
        { code: "COMP2100", term: 2 },
      ]),
    );
    const p = result.placements.find((p) => p.code === "COMP2100")!;
    expect(p.state).toBe("available");
  });

  it("a satisfied OR branch isn't re-suggested once its sibling is placed", () => {
    // COMP1140 is placed, satisfying the (COMP1110 OR COMP1140) branch; only
    // the still-unmet MATH units leaf should drive suggestions/reasons.
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP1140", term: 1 },
        { code: "COMP2100", term: 2 },
      ]),
    );
    const p = result.placements.find((p) => p.code === "COMP2100")!;
    expect(p.state).toBe("soft");
    expect(p.suggestions.some((s) => s.code === "COMP1110")).toBe(false);
    expect(p.reasons.some((r) => r.includes("MATH"))).toBe(true);
  });

  it("doesn't suggest a course incompatible with one already placed", () => {
    // COMP1130 is placed, satisfying the (COMP1100 OR COMP1130 OR COMP1730)
    // branch, but even the unsatisfied MATH leaf shouldn't surface COMP1100
    // as a fix since it's incompatible with the already-placed COMP1130.
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP1130", term: 0 },
        { code: "COMP2300", term: 3 },
      ]),
    );
    const p = result.placements.find((p) => p.code === "COMP2300")!;
    expect(p.suggestions.some((s) => s.code === "COMP1100")).toBe(false);
  });

  it("a prereq placed in the same term only satisfies concurrent leaves", () => {
    const concurrent = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP1140", term: 1 },
        { code: "MATH1115", term: 0 },
        { code: "COMP2100", term: 3 },
        { code: "COMP2120", term: 3 },
      ]),
    );
    expect(concurrent.placements.find((p) => p.code === "COMP2120")!.state).toBe("available");

    const nonConcurrent = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP2300", term: 3 },
        { code: "COMP2310", term: 3 },
      ]),
    );
    expect(nonConcurrent.placements.find((p) => p.code === "COMP2310")!.state).toBe("soft");
  });

  it("a prereq placed too late yields a 'move' suggestion", () => {
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP2310", term: 3 },
        { code: "COMP1140", term: 5 },
      ]),
    );
    const p = result.placements.find((p) => p.code === "COMP2310")!;
    expect(p.suggestions).toContainEqual(expect.objectContaining({ code: "COMP1140", action: "move" }));
  });

  it("COMP1100 + COMP1130 conflict, tie broken alphabetically", () => {
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP1100", term: 0 },
        { code: "COMP1130", term: 0 },
      ]),
    );
    const a = result.placements.find((p) => p.code === "COMP1100")!;
    const b = result.placements.find((p) => p.code === "COMP1130")!;
    expect(a.conflictWith).toContain("COMP1130");
    expect(b.conflictWith).toContain("COMP1100");
    expect(b.loser).toBe(true);
    expect(a.loser).toBe(false);
  });

  it("every hard-blocked placement keeps state 'hard' and its reasons", () => {
    const result = evaluatePlan(cat, feas, plan([{ code: "COMP1140", term: 0 }])); // S1 2027: not offered
    const p = result.placements[0]!;
    expect(p.state).toBe("hard");
    expect(p.reasons[0]).toContain("isn't offered");
  });

  it("two-semester course occupies t and t+1", () => {
    const result = evaluatePlan(cat, feas, plan([{ code: "COMP4550", term: 6 }], 7));
    const p = result.placements[0]!;
    expect(p.lastTerm).toBe(7);
    expect(p.completed).toBe(false);
    expect(result.termUnits[6]).toBe(12);
    expect(result.termUnits[7]).toBe(12);
  });

  it("counts each part before the cutoff as completed", () => {
    const at = (cutoff: number) => evaluatePlan(cat, feas, plan([{ code: "COMP4550", term: 4 }], cutoff)).placements[0]!;
    expect(at(4).completedParts).toBe(0);
    expect(at(5).completedParts).toBe(1);
    expect(at(5).completed).toBe(false);
    expect(at(6).completedParts).toBe(2);
    expect(at(6).completed).toBe(true);

    const single = evaluatePlan(cat, feas, plan([{ code: "COMP1100", term: 0 }], 1)).placements[0]!;
    expect(single.completedParts).toBe(1);
  });
});

describe("evaluatePlan (synthetic catalogues)", () => {
  it("losers don't count toward unit leaves", () => {
    const cat = syntheticCatalogue([
      synthetic("ZZAA1000", { units: 6, incompatible: ["ZZAA1001"] }),
      synthetic("ZZAA1001", { units: 6, incompatible: ["ZZAA1000"] }),
      synthetic("ZZAA2000", {
        prereq: { kind: "units", units: 12, filter: { prefixes: ["ZZAA"] }, text: "12 units of ZZAA" },
      }),
    ]);
    const feas = createFeasibility(cat);
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "ZZAA1000", term: 0 },
        { code: "ZZAA1001", term: 0 },
        { code: "ZZAA2000", term: 1 },
      ]),
    );
    const p = result.placements.find((p) => p.code === "ZZAA2000")!;
    // ZZAA1001 is the loser (tie, alphabetically later), so only ZZAA1000's
    // 6 units count -- 6 < 12, still soft.
    expect(p.state).toBe("soft");
  });

  it("load over 24 flags overload", () => {
    const cat = syntheticCatalogue([
      synthetic("ZZBB1000", { units: 20 }),
      synthetic("ZZBB1001", { units: 10 }),
    ]);
    const feas = createFeasibility(cat);
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "ZZBB1000", term: 0 },
        { code: "ZZBB1001", term: 0 },
      ]),
    );
    expect(result.termUnits[0]).toBeGreaterThan(24);
  });

  it("suggests a two-semester prereq as a range", () => {
    // Explicit 2028 rows: the horizon is 2028, so without them term 3 would
    // be not-offered and hard-blocked.
    const offerings = [2027, 2028].flatMap((year) => [
      { year, session: "First Semester" },
      { year, session: "Second Semester" },
    ]);
    const cat = syntheticCatalogue([
      synthetic("ZZAA1000", { twoSemester: true, offerings }),
      synthetic("ZZAA2000", { offerings, prereq: { kind: "course", code: "ZZAA1000", concurrent: false } }),
    ]);
    const feas = createFeasibility(cat);
    const result = evaluatePlan(cat, feas, plan([{ code: "ZZAA2000", term: 3 }]));
    const p = result.placements[0]!;
    expect(p.suggestions).toContainEqual({
      code: "ZZAA1000",
      action: "place",
      term: 0,
      text: "Place ZZAA1000 in S1 2027 – S2 2027",
    });
  });

  it("requisiteStatus marks leaves ok/false/null (null for unverifiable)", () => {
    const okLeaf: ReqExpr = { kind: "course", code: "ZZCC1000", concurrent: false };
    const failLeaf: ReqExpr = { kind: "course", code: "ZZCC1001", concurrent: false };
    const unverifiable: ReqExpr = { kind: "unverifiable", text: "a mark of 60 or above" };
    const cat = syntheticCatalogue([
      synthetic("ZZCC1000"),
      synthetic("ZZCC1001"),
      synthetic("ZZCC2000", { prereq: { kind: "and", items: [okLeaf, failLeaf, unverifiable] } }),
    ]);
    const feas = createFeasibility(cat);
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "ZZCC1000", term: 0 },
        { code: "ZZCC2000", term: 1 },
      ]),
    );
    const status = result.placements.find((p) => p.code === "ZZCC2000")!.requisiteStatus!;
    expect(status.kind).toBe("and");
    if (status.kind !== "and") throw new Error("expected and");
    expect(status.ok).toBe(false);
    const [ok, fail, unverif] = status.items;
    expect(ok!.ok).toBe(true);
    expect(fail!.ok).toBe(false);
    expect(unverif!.ok).toBe(null);
  });

  // Kleene logic: an unverifiable leaf is "unknown", not "unmet" — so a
  // course whose every checkable requirement is met lands in "check", not
  // a "soft" it could never leave (COMP4550's permission code, MATH1116's
  // mark), while a genuinely unmet requirement still wins.
  describe("unverifiable leaves", () => {
    const met: ReqExpr = { kind: "course", code: "ZZDD1000", concurrent: false };
    const unmet: ReqExpr = { kind: "course", code: "ZZDD1001", concurrent: false };
    const unknown: ReqExpr = { kind: "unverifiable", text: "request a permission code" };

    function stateOf(prereq: ReqExpr) {
      const cat = syntheticCatalogue([synthetic("ZZDD1000"), synthetic("ZZDD1001"), synthetic("ZZDD2000", { prereq })]);
      const result = evaluatePlan(cat, createFeasibility(cat), plan([{ code: "ZZDD1000", term: 0 }, { code: "ZZDD2000", term: 1 }]));
      const p = result.placements.find((p) => p.code === "ZZDD2000")!;
      return { state: p.state, ok: p.requisiteStatus!.ok };
    }

    it.each([
      ["met AND unknown", "check", null, { kind: "and", items: [met, unknown] }],
      ["unmet AND unknown", "soft", false, { kind: "and", items: [unmet, unknown] }],
      ["met OR unknown", "available", true, { kind: "or", items: [met, unknown] }],
      ["unmet OR unknown", "check", null, { kind: "or", items: [unmet, unknown] }],
      ["unknown alone", "check", null, unknown],
    ] as [string, string, boolean | null, ReqExpr][])("%s → %s", (_label, state, ok, prereq) => {
      expect(stateOf(prereq)).toEqual({ state, ok });
    });
  });

  // A student's own answer stands in for the check the app can't make.
  describe("manual checks", () => {
    const met: ReqExpr = { kind: "course", code: "ZZDD1000", concurrent: false };
    const unknown: ReqExpr = { kind: "unverifiable", text: "request a permission code" };

    function evalWith(checks: PlanChecks) {
      const cat = syntheticCatalogue([
        synthetic("ZZDD1000"),
        synthetic("ZZDD2000", { prereq: { kind: "and", items: [met, unknown] }, unverifiable: ["request a permission code"] }),
      ]);
      const result = evaluatePlan(
        cat,
        createFeasibility(cat),
        plan([{ code: "ZZDD1000", term: 0 }, { code: "ZZDD2000", term: 1 }], 0, checks),
      );
      return result.placements.find((p) => p.code === "ZZDD2000")!;
    }

    it("Met on the only unknown makes met AND unknown available, with no verify line", () => {
      const p = evalWith({ ZZDD2000: { "request a permission code": "met" } });
      expect(p.state).toBe("available");
      expect(p.verify).toEqual([]);
    });

    it("Not met gives soft with a 'You marked … as not met' reason", () => {
      const p = evalWith({ ZZDD2000: { "request a permission code": "not-met" } });
      expect(p.state).toBe("soft");
      // Labelled with its course (FR 5): the AND is exactly ZZDD1000 + the item.
      expect(p.reasons).toContain('You marked "ZZDD1000 request a permission code" as not met');
    });

    it("Not sure stays check, and verify lists it", () => {
      const p = evalWith({});
      expect(p.state).toBe("check");
      expect(p.verify).toEqual(["ZZDD1000 request a permission code"]);
    });

    it("a stored answer for text the course no longer has is ignored", () => {
      const p = evalWith({ ZZDD2000: { "old wording": "met" } });
      expect(p.state).toBe("check");
      expect(p.checks[0]!.answer).toBeNull();
    });
  });
});

describe("evaluatePlan: 'check' on the real catalogue", () => {
  const cat = loadRealCatalogue();
  const feas = createFeasibility(cat);

  it("MATH1116 is 'check' (the mark) once MATH1115 is placed, 'soft' without it", () => {
    const withIt = evaluatePlan(cat, feas, plan([{ code: "MATH1115", term: 0 }, { code: "MATH1116", term: 1 }]));
    expect(withIt.placements.find((p) => p.code === "MATH1116")!.state).toBe("check");
    const without = evaluatePlan(cat, feas, plan([{ code: "MATH1116", term: 1 }]));
    expect(without.placements[0]!.state).toBe("soft");
  });

  it("COMP4500's AACOM route needs only its own conditions, then the eligibility check", () => {
    // AACOM route: COMP2120 and 12 units of 3000/4000-level courses — not
    // AENSE's COMP3500. With both met only the eligibility prose is left.
    const met = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP2120", term: 3 },
        { code: "COMP3600", term: 3 },
        { code: "COMP3620", term: 4 },
        { code: "COMP4500", term: 6 },
      ]),
    );
    expect(met.placements.find((p) => p.code === "COMP4500")!.state).toBe("check");
    const missing = evaluatePlan(cat, feas, plan([{ code: "COMP3600", term: 3 }, { code: "COMP3620", term: 4 }, { code: "COMP4500", term: 6 }]));
    expect(missing.placements.find((p) => p.code === "COMP4500")!.state).toBe("soft");
  });

  it("COMP4820 with its courses met is 'check' until its permission items are answered", () => {
    const result = evaluatePlan(
      cat,
      feas,
      plan([
        { code: "COMP2100", term: 2 },
        { code: "COMP3600", term: 3 },
        { code: "COMP3620", term: 4 },
        { code: "COMP4820", term: 6 },
      ]),
    );
    expect(result.placements.find((p) => p.code === "COMP4820")!.state).toBe("check");
  });

  it("MATH1116: Met on the MATH1115 mark is Available with the MATH1113 item blank", () => {
    const result = evaluatePlan(
      cat,
      feas,
      plan([{ code: "MATH1115", term: 0 }, { code: "MATH1116", term: 1 }], 0, {
        MATH1116: { "with a mark of 60 or above": "met" },
      }),
    );
    const p = result.placements.find((p) => p.code === "MATH1116")!;
    expect(p.state).toBe("available");
    expect(p.checks.map((c) => c.label)).toEqual(["MATH1115 with a mark of 60 or above", "MATH1113 with a mark of 80 or above"]);
  });

  it("the same sentence on two courses is answered separately", () => {
    const item = "You will need to contact the School of Computing to request a permission code to enrol in this course";
    const result = evaluatePlan(
      cat,
      feas,
      plan([{ code: "COMP4011", term: 5 }, { code: "COMP4020", term: 7 }], 0, { COMP4011: { [item]: "met" } }),
    );
    const answerOn = (code: string) =>
      result.placements.find((p) => p.code === code)!.checks.find((c) => c.item === item)!.answer;
    expect(answerOn("COMP4011")).toBe("met");
    expect(answerOn("COMP4020")).toBeNull();
  });

  it("the example plan — a complete, working plan — has nothing still flagged 'soft'", () => {
    const result = evaluatePlan(cat, feas, EXAMPLE_PLAN);
    expect(result.placements.filter((p) => p.state === "soft").map((p) => p.code)).toEqual([]);
    expect(result.placements.find((p) => p.code === "COMP4550")!.state).toBe("check");
  });
});
