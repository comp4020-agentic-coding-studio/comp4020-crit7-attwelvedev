import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseFilter, ReqExpr } from "./types";
import { isUndergrad } from "../catalogue/from-pandc";
import { parseRequisites } from "./requisites";

interface RawCourse {
  code: string;
  prerequisites: string;
  incompatibilities: string;
}

function loadRaw(code: string): RawCourse {
  return JSON.parse(readFileSync(`data/2027/courses/${code}.json`, "utf-8"));
}

function parse(code: string) {
  const raw = loadRaw(code);
  return parseRequisites({ prerequisites: raw.prerequisites, incompatibilities: raw.incompatibilities });
}

// Strips fields the fixture table's compact notation deliberately doesn't
// pin down (free-text `name`/`text`), so tests assert structure without
// being brittle to exact prose.
function normalize(node: ReqExpr | null): unknown {
  if (node === null) return null;
  switch (node.kind) {
    case "and":
    case "or":
      return { kind: node.kind, items: node.items.map(normalize) };
    case "course":
      return { kind: "course", code: node.code, concurrent: node.concurrent };
    case "units":
      return { kind: "units", units: node.units, filter: node.filter };
    case "program":
      return { kind: "program", code: node.code, satisfied: node.satisfied };
    case "unverifiable":
      return { kind: "unverifiable" };
  }
}

const C = (code: string) => ({ kind: "course", code, concurrent: false });
const Cc = (code: string) => ({ kind: "course", code, concurrent: true });
const AND = (...items: unknown[]) => ({ kind: "and", items });
const OR = (...items: unknown[]) => ({ kind: "or", items });
const U = (units: number, filter: CourseFilter) => ({ kind: "units", units, filter });
const P = (code: string | null, satisfied: boolean) => ({ kind: "program", code, satisfied });

function expectPrereq(code: string, expected: unknown) {
  expect(normalize(parse(code).prereq)).toEqual(expected);
}

describe("parseRequisites: prereq fixtures", () => {
  it("COMP1100: no prereq", () => {
    expectPrereq("COMP1100", null);
  });

  it("COMP1110: or of three codes", () => {
    expectPrereq("COMP1110", OR(C("COMP1100"), C("COMP1130"), C("COMP1730")));
  });

  it("COMP1600: units and course-or", () => {
    expectPrereq("COMP1600", AND(U(6, { prefixes: ["MATH"] }), OR(C("COMP1100"), C("COMP1130"))));
  });

  it("COMP2100: or-of-codes and a 1000-level MATH units clause", () => {
    expectPrereq(
      "COMP2100",
      AND(OR(C("COMP1110"), C("COMP1140")), U(6, { prefixes: ["MATH"], minLevel: 1000, maxLevel: 1000 })),
    );
  });

  it("COMP2120: concurrent leaf", () => {
    expectPrereq("COMP2120", Cc("COMP2100"));
  });

  it("COMP2310: and of two or-groups", () => {
    expectPrereq(
      "COMP2310",
      AND(OR(C("COMP1110"), C("COMP1140")), OR(C("COMP2300"), C("ENGN2219"))),
    );
  });

  it("COMP3242: units-with-code-list and or-of-codes", () => {
    expectPrereq(
      "COMP3242",
      AND(
        U(6, { codes: ["COMP3670", "MATH1013", "MATH1014", "MATH1115", "MATH1116"] }),
        OR(C("COMP1110"), C("COMP1140")),
      ),
    );
  });

  it("COMP3310: or-of-codes and a 2000-level COMP units clause", () => {
    expectPrereq(
      "COMP3310",
      AND(OR(C("COMP2100"), C("COMP2300")), U(6, { prefixes: ["COMP"], minLevel: 2000, maxLevel: 2000 })),
    );
  });

  it("COMP3320: or-group and (course-or-units) group", () => {
    expectPrereq(
      "COMP3320",
      AND(
        OR(C("COMP2100"), C("COMP2300"), C("ENGN2219")),
        OR(C("COMP1600"), U(6, { prefixes: ["MATH"], excludeCodes: ["MATH1003"] })),
      ),
    );
  });

  it("COMP3600: units and (units-or-course)", () => {
    expectPrereq(
      "COMP3600",
      AND(U(24, { prefixes: ["COMP"] }), OR(U(6, { prefixes: ["MATH"] }), C("COMP1600"))),
    );
  });

  it("COMP3620: /1140 shorthand and concurrent", () => {
    expectPrereq("COMP3620", AND(OR(C("COMP1110"), C("COMP1140")), Cc("COMP2620")));
  });

  it("COMP4011: units clause plus at least one unverifiable leaf", () => {
    const result = parse("COMP4011");
    const norm = normalize(result.prereq) as { kind: string; items: unknown[] };
    expect(norm.kind).toBe("and");
    expect(norm.items[0]).toEqual(U(12, { prefixes: ["COMP"], minLevel: 3000, maxLevel: 4000 }));
    expect(result.parseStatus === "partial" || result.unverifiable.length >= 1).toBe(true);
  });

  it("COMP4450: or of program leaves, one branch AND'd with a units clause", () => {
    expectPrereq(
      "COMP4450",
      OR(
        P("HCOMP", false),
        P("HADAN", false),
        P("COMP-HSPC", false),
        AND(P("AACOM", true), U(24, { prefixes: ["COMP"] })),
      ),
    );
  });

  it("COMP4550: or of course/concurrent, AND'd with unverifiable clauses", () => {
    const result = parse("COMP4550");
    const norm = normalize(result.prereq) as { kind: string; items: unknown[] };
    expect(norm.kind).toBe("and");
    expect(norm.items[0]).toEqual(OR(C("COMP2550"), Cc("COMP4450")));
    expect(norm.items.length).toBeGreaterThanOrEqual(3);
    expect(result.incompatible).toEqual(
      expect.arrayContaining(["COMP4500", "COMP4560", "COMP4810", "COMP4820"]),
    );
    expect(result.unverifiable.some((t) => /permission code/i.test(t))).toBe(true);
    // "including" only joins a code or "either" (MATH2307) — here it's prose.
    expect(result.unverifiable.some((t) => /student projects including completing/.test(t))).toBe(true);
  });

  it("COMP4650: units clause with two prefixes", () => {
    expectPrereq(
      "COMP4650",
      AND(OR(C("COMP1600"), C("COMP2100")), U(12, { prefixes: ["COMP", "INFS"], minLevel: 3000, maxLevel: 4000 })),
    );
  });

  it("COMP4670: or of course / (and of or-groups)", () => {
    expectPrereq(
      "COMP4670",
      OR(C("COMP3670"), AND(OR(C("COMP1110"), C("COMP1140")), OR(C("MATH1014"), C("MATH1115"), C("MATH1116")))),
    );
  });

  it("COMP4820: program leaf, course leaf and a units clause", () => {
    expectPrereq(
      "COMP4820",
      AND(P(null, true), C("COMP2100"), U(12, { prefixes: ["COMP"], minLevel: 3000, maxLevel: 3000 })),
    );
  });

  it("MATH1005: no prereq (incompatibility text lived in the wrong field)", () => {
    const result = parse("MATH1005");
    expect(result.prereq).toBeNull();
    expect(result.incompatible).toEqual(["MATH6005"]);
  });

  it("MATH1116: or of (course + mark-clause) pairs", () => {
    const result = parse("MATH1116");
    const norm = normalize(result.prereq) as { kind: string; items: unknown[] };
    expect(norm.kind).toBe("or");
    expect(norm.items.length).toBe(2);
    for (const item of norm.items as { kind: string; items: unknown[] }[]) {
      expect(item.kind).toBe("and");
      expect((item.items[0] as { kind: string }).kind).toBe("course");
      expect((item.items[1] as { kind: string }).kind).toBe("unverifiable");
    }
  });

  it("ENVS2015: units towards a degree, empty filter", () => {
    expectPrereq("ENVS2015", U(24, {}));
  });

  it('COMP4880: ", or you must have completed all of the following:" splits the whole sentence', () => {
    // COMP3670 alone is enough — the MATH clause belongs to the second route only.
    expectPrereq(
      "COMP4880",
      OR(C("COMP3670"), AND(OR(C("COMP1110"), C("COMP1140")), OR(C("MATH1014"), C("MATH1115")))),
    );
  });

  it('COMP2700: "6 units MATH code course" (no "of")', () => {
    expectPrereq("COMP2700", AND(OR(C("COMP1100"), C("COMP1130")), OR(C("COMP1600"), U(6, { prefixes: ["MATH"] }))));
  });

  it('COMP3610: "MATHS excluding MATH1003" without parens, inside a group', () => {
    expectPrereq(
      "COMP3610",
      AND(C("COMP2100"), OR(C("COMP1600"), U(6, { prefixes: ["MATH"], excludeCodes: ["MATH1003"] }))),
    );
  });

  it('COMP3425: "6 units from A or B or C ; AND D"', () => {
    expectPrereq("COMP3425", AND(U(6, { codes: ["COMP1100", "COMP1130", "COMP1730"] }), C("COMP2400")));
  });

  it("COMP3430: a lead-in in the second sentence, spaced codes, two units-from lists", () => {
    const norm = normalize(parse("COMP3430").prereq) as { kind: string; items: unknown[] };
    expect(norm.kind).toBe("and");
    // Before these, only the prose sentence about "introductory courses".
    expect(norm.items.slice(-3)).toEqual([
      U(6, { codes: ["COMP1030", "COMP1100", "COMP1130", "COMP1730"] }),
      U(6, { codes: ["COMP1040", "COMP1110", "COMP1140"] }),
      C("COMP2400"),
    ]);
  });

  it('COMP4528: "either A or B ..."', () => {
    expectPrereq("COMP4528", OR(C("ENGN2228"), C("COMP2120"), C("COMP3600"), C("COMP3670")));
  });

  it('COMP4350: "either:" and a comma-listed subject pool', () => {
    // Over-strict on "either A or B and C" as accepted in overview §2.4.
    expectPrereq(
      "COMP4350",
      AND(
        OR(
          U(12, { prefixes: ["COMP"], minLevel: 2000, maxLevel: 2000 }),
          U(12, { prefixes: ["MUSI", "DESN", "ARTV"], minLevel: 2000, maxLevel: 2000 }),
        ),
        C("COMP1720"),
      ),
    );
  });

  it.each([
    ["INFS2024", ["INFS1001", "COMP1100", "COMP1720", "COMP1730"]],
    ["INFS3002", ["INFS2005", "INFS2024", "COMP2400"]],
    ["INFS3024", ["INFS2024", "COMP2400"]],
  ])('%s: "at least one of the following courses: CODE - Title ..."', (code, options) => {
    expectPrereq(code, OR(...options.map(C)));
  });

  it("COMP4500: two degree routes, each with its own conditions, after a shared eligibility sentence", () => {
    // "... You also must be studying: <AACOM> AND have completed: COMP2120
    // AND 12 units of 3000 and/or 4000 level courses. OR <AENSE> AND have
    // completed: COMP3500" — the sentence-opening OR joins the two routes,
    // not the whole requisite; neither route's conditions bleed into the other.
    expectPrereq(
      "COMP4500",
      AND(
        { kind: "unverifiable" },
        OR(
          AND(P("AACOM", true), C("COMP2120"), U(12, { minLevel: 3000, maxLevel: 4000 })),
          AND(P("AENSE", false), C("COMP3500")),
        ),
      ),
    );
  });

  it('COMP3500: "You must also be studying:" opens a later sentence', () => {
    expectPrereq(
      "COMP3500",
      AND({ kind: "unverifiable" }, OR(P("AENSE", false), P("BCOMP", false)), C("COMP2100"), C("COMP2120")),
    );
  });

  it("COMP4500: an all-prose sentence stays one verify line, not comma fragments", () => {
    expect(parse("COMP4500").unverifiable).toEqual([
      "meet the eligibility criteria, which includes membership of a student project group before the end of week 1, where the project has been approved by the convener",
    ]);
  });

  it('MATH2307: "units of 1000 levels Mathematics (MATH) courses including either A or B"', () => {
    expectPrereq(
      "MATH2307",
      AND(U(12, { prefixes: ["MATH"], minLevel: 1000, maxLevel: 1000 }), OR(C("MATH1014"), C("MATH1116"))),
    );
  });
});

describe("parseRequisites: incompatibilities and other-program routing", () => {
  it("COMP1100: incompatible with COMP1130", () => {
    expect(parse("COMP1100").incompatible).toEqual(["COMP1130"]);
  });

  it("COMP1110: incompatible list", () => {
    expect(parse("COMP1110").incompatible).toEqual(["COMP1140", "COMP6710", "COMP7710"]);
  });

  it("COMP1600: incompatibility moved out of prereq text", () => {
    expect(parse("COMP1600").incompatible).toContain("COMP6260");
  });

  it("COMP2100: routes the other-program sentence, doesn't evaluate it", () => {
    expect(parse("COMP2100").otherPrograms.length).toBe(1);
  });

  it("COMP2120: incompatible list", () => {
    expect(parse("COMP2120").incompatible).toEqual(["COMP2130", "COMP6120", "COMP6311"]);
  });

  it("COMP3600: incompatible with COMP6466", () => {
    expect(parse("COMP3600").incompatible).toEqual(["COMP6466"]);
  });

  it("COMP4450: incompatible list", () => {
    expect(parse("COMP4450").incompatible).toEqual(["COMP2550", "COMP6445"]);
  });
});

describe("parseRequisites: invariants over the whole catalogue", () => {
  it('"None" -> prereq null, empty everything', () => {
    const result = parseRequisites({ prerequisites: "None", incompatibilities: "None" });
    expect(result.prereq).toBeNull();
    expect(result.incompatible).toEqual([]);
    expect(result.unverifiable).toEqual([]);
    expect(result.parseStatus).toBe("ok");
  });

  it("never throws on any catalogue course", () => {
    const files = globSync("data/2027/courses/*.json");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw: RawCourse = JSON.parse(readFileSync(file, "utf-8"));
      expect(() => parseRequisites({ prerequisites: raw.prerequisites, incompatibilities: raw.incompatibilities })).not.toThrow();
    }
  });

  function collectCodes(node: ReqExpr | null, out: Set<string>): void {
    if (node === null) return;
    switch (node.kind) {
      case "and":
      case "or":
        for (const item of node.items) collectCodes(item, out);
        return;
      case "course":
        out.add(node.code);
        return;
      case "units":
        for (const c of node.filter.codes ?? []) out.add(c);
        for (const c of node.filter.excludeCodes ?? []) out.add(c);
        // A level clause like "COMP2000 -level" folds a pseudo-code into a
        // prefix+level filter; the raw text still carries it verbatim.
        for (const m of node.text.matchAll(/\b[A-Z]{4}\d{4}\b/g)) out.add(m[0]);
        return;
      case "program":
      case "unverifiable":
        return;
    }
  }

  it("no silent drops: every course code in the prerequisite text ends up somewhere in the result", () => {
    const files = globSync("data/2027/courses/*.json");
    const codeRe = /\b[A-Z]{4}\d{4}\b/g;
    for (const file of files) {
      const raw: RawCourse = JSON.parse(readFileSync(file, "utf-8"));
      const sourceCodes = new Set(Array.from(raw.prerequisites.matchAll(codeRe), (m) => m[0]));
      if (sourceCodes.size === 0) continue;
      const result = parseRequisites({ prerequisites: raw.prerequisites, incompatibilities: raw.incompatibilities });

      const found = new Set<string>();
      collectCodes(result.prereq, found);
      for (const c of result.incompatible) found.add(c);
      const textBlob = [...result.unverifiable, ...result.otherPrograms].join(" ");
      for (const m of textBlob.matchAll(codeRe)) found.add(m[0]);

      for (const code of sourceCodes) {
        expect(found.has(code), `${raw.code}: ${code} missing from parsed result`).toBe(true);
      }
    }
  });

  // The check above counts a code sitting inside unverifiable text as
  // "not dropped" — which is how COMP4880's COMP1110 and COMP3425's whole
  // units list went unchecked and unlinked: kept as prose, never evaluated.
  // For the courses the planner loads, a code in an unverifiable leaf is a
  // parser gap unless the sentence genuinely isn't a checkable requisite.
  const PROSE_WITH_CODES: Record<string, string> = {
    MATH1115: "a convener-permission condition on having done MATH1013/MATH1113, not a prerequisite",
    MATH2222: "advice prose plus per-course mark thresholds the plan can't know",
    SOCY2166: "a conditional concurrency clause (if SOCY2038 not completed, take it alongside)",
  };

  it("no course code is left inside an unverifiable leaf, for the courses the planner loads", () => {
    const codeRe = /\b[A-Z]{4}\s?\d{4}\b/;
    const offenders: string[] = [];
    for (const file of globSync("data/2027/courses/*.json")) {
      const raw: RawCourse = JSON.parse(readFileSync(file, "utf-8"));
      if (!isUndergrad(raw.code) || raw.code in PROSE_WITH_CODES) continue;
      const result = parseRequisites({ prerequisites: raw.prerequisites, incompatibilities: raw.incompatibilities });
      for (const text of result.unverifiable) if (codeRe.test(text)) offenders.push(`${raw.code}: "${text}"`);
    }
    expect(offenders).toEqual([]);
  });
});
