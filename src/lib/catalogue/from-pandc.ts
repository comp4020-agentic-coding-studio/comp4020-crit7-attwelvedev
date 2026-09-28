import type { CatalogueCourse, CourseExtras, Offering, ParsedRequisites } from "../domain/types";

export interface PandcCourseJson {
  code: string;
  url: string;
  title: string;
  units: string;
  level: string;
  prerequisites: string;
  incompatibilities: string;
  requisite_raw: string;
  description: string;
  scraped_at: string;
  offerings: { year: string; semester: string; mode: string; class_number?: string | null }[];
  learning_outcomes?: string[];
  assessment?: { task: string; weight: string }[];
  cotaught?: string[];
}

const TWO_SEMESTER_PATTERN = /completed twice,? in consecutive semesters/i;

export function isUndergrad(code: string): boolean {
  const level = code.match(/\d/)?.[0];
  return level !== undefined && level >= "1" && level <= "4";
}

export const emptyParse = (_p: { prerequisites: string; incompatibilities: string }): ParsedRequisites => ({
  prereq: null,
  incompatible: [],
  unverifiable: [],
  otherPrograms: [],
  parseStatus: "ok",
});

export function fromPandc(
  json: PandcCourseJson,
  tdpCourses: string[] | null,
  parse: (p: { prerequisites: string; incompatibilities: string }) => ParsedRequisites = emptyParse,
): CatalogueCourse {
  const offerings: Offering[] = [];
  const seen = new Set<string>();
  for (const o of json.offerings) {
    const key = `${o.year}\u0000${o.semester}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offerings.push({ year: Number(o.year), session: o.semester });
  }

  const parsed = parse({ prerequisites: json.prerequisites, incompatibilities: json.incompatibilities });
  // The parser pulls every code out of an incompatibility sentence, and
  // MATH1116's names the course itself ("You may not enrol in MATH1116 if
  // ... MATH1014") — only here is the course's own code known to drop.
  const requisites = { ...parsed, incompatible: parsed.incompatible.filter((code) => code !== json.code) };

  return {
    code: json.code,
    title: json.title,
    units: Number(json.units),
    level: Number(json.level),
    description: json.description,
    url: json.url,
    offerings,
    requisites,
    requisiteRaw: json.requisite_raw,
    twoSemester: TWO_SEMESTER_PATTERN.test(json.description),
    isTdp: tdpCourses?.includes(json.code) ?? false,
    isStub: false,
    scrapedAt: json.scraped_at,
  };
}

// Unlike fromPandc's offerings, classes aren't deduplicated by session:
// Details lists every class P&C does, each with its own mode and number.
export function extrasFromPandc(json: PandcCourseJson): CourseExtras {
  return {
    learningOutcomes: (json.learning_outcomes ?? []).map((outcome) => outcome.trim()),
    assessment: (json.assessment ?? []).map((item) => ({ task: item.task.trim(), weight: item.weight.trim() })),
    cotaught: (json.cotaught ?? []).map((code) => code.trim()).filter((code) => code !== json.code),
    classes: json.offerings.map((o) => ({
      year: Number(o.year),
      session: o.semester.trim(),
      mode: o.mode.trim(),
      classNumber: o.class_number?.trim() ?? null,
    })),
  };
}
