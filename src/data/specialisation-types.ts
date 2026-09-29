// Types only: scripts/merge-subplans.ts imports these with `import type`,
// which Node erases when it strips types, so nothing here may be a value.

/** One `data/2027/subplans/*.json` file as anu-pandc 0.3.1 writes it. */
export interface ScrapedSubplan {
  kind: "subplan";
  year: string;
  scraped_at: string;
  code: string;
  url: string;
  title: string;
  min_units: number;
  introduction: string;
  learning_outcomes: string[];
  requirements: (
    | { type: "text"; content: string }
    | { type: "group"; heading: string; courses: { code: string; title: string; units: number | null }[] }
  )[];
  specialisations: unknown[];
  all_course_codes: string[];
}

/** What the scrape lost from one P&C page, hand-copied. */
export interface SupplementEntry {
  topics?: string[];
  otherInformation: string[];
  relevantDegrees: string[];
  /** Scraped text entries that are headings on P&C. */
  headings?: string[];
}

export interface SubplanSupplement {
  source: string;
  specialisations: Record<string, SupplementEntry>;
}

export type SpecBlock =
  | { type: "text"; content: string }
  | { type: "heading"; content: string }
  | { type: "and" }
  | { type: "list"; heading: string; courses: string[] };

export interface SpecialisationData {
  code: string; // "ARIN-SPEC"
  title: string; // P&C's title
  url: string;
  year: string; // "2027"
  scrapedAt: string; // ISO, from the scrape
  minUnits: number; // 24
  introduction: string[]; // paragraphs
  topics: string[]; // SYAR's list; [] elsewhere
  learningOutcomes: string[];
  requirements: SpecBlock[];
  otherInformation: string[]; // paragraphs
  relevantDegrees: string[];
}

export interface SpecialisationsFile {
  generatedBy: string;
  specialisations: SpecialisationData[];
}
