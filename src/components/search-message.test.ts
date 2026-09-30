import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { fromPandc } from "../lib/catalogue/from-pandc";
import { parseRequisites } from "../lib/domain/requisites";
import type { Catalogue } from "../lib/domain/types";
import { courseCard } from "../lib/domain/view";
import type { SearchResult } from "./api";
import { outcomeMessage } from "./search-message";

describe("outcomeMessage — not_found", () => {
  const notFound: SearchResult = { status: "not_found", courses: [] };

  it("suggests an exact course code after a title search misses", () => {
    expect(outcomeMessage(notFound, "software eng")).toBe(
      'No course found for "software eng". Try entering the exact course code, e.g. COMP1100.',
    );
  });

  it("asks to check the code when the query already is one", () => {
    expect(outcomeMessage(notFound, "comp9999")).toBe('No course found for "comp9999". Check the code is correct.');
  });
});

describe("outcomeMessage — with specialisations", () => {
  const codes = ["COMP3620", "COMP3670"];
  const courses = codes.map((code) => fromPandc(JSON.parse(readFileSync(`data/2027/courses/${code}.json`, "utf-8")), null, parseRequisites));
  const cat: Catalogue = { courses: new Map(courses.map((c) => [c.code, c])), horizonYear: 2030 };
  const found: SearchResult = { status: "found", courses: codes.map((code) => courseCard(cat, AACOM_2027, {}, code)) };

  it("counts only the specialisation when no course matched", () => {
    expect(outcomeMessage({ status: "not_found", courses: [] }, "ARIN", 1)).toBe('Found 1 specialisation matching "ARIN"');
  });

  it("counts both kinds when both matched", () => {
    expect(outcomeMessage(found, "artificial intelligence", 1)).toBe(
      'Found 2 courses and 1 specialisation matching "artificial intelligence"',
    );
  });
});
