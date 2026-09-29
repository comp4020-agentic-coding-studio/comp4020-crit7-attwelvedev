// Merges the anu-pandc scrape of each specialisation page
// (data/2027/subplans/*.json) with the hand-copied sections it loses
// (data/2027/subplans-supplement.json) into data/2027/specialisations.json,
// which the app imports statically. Run after scripts/scrape-2027.sh or an
// edit to the supplement: `node scripts/merge-subplans.ts`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ScrapedSubplan,
  SpecBlock,
  SpecialisationData,
  SpecialisationsFile,
  SubplanSupplement,
  SupplementEntry,
} from "../src/data/specialisation-types.ts";

const GENERATED_BY =
  "scripts/merge-subplans.ts from data/2027/subplans/*.json and data/2027/subplans-supplement.json. Don't hand-edit: change the supplement and re-run.";

export function mergeSubplan(scraped: ScrapedSubplan, extra: SupplementEntry): SpecialisationData {
  const headings = new Set(extra.headings ?? []);
  const texts = new Set(scraped.requirements.flatMap((r) => (r.type === "text" ? [r.content] : [])));
  // A re-scrape that rewords a heading would otherwise quietly turn it back
  // into body text.
  for (const h of headings) {
    if (!texts.has(h)) throw new Error(`${scraped.code}: supplement heading "${h}" matches no scraped text`);
  }

  const requirements = scraped.requirements.map((r): SpecBlock => {
    if (r.type === "group") return { type: "list", heading: r.heading, courses: r.courses.map((c) => c.code) };
    if (r.content === "AND") return { type: "and" };
    if (headings.has(r.content)) return { type: "heading", content: r.content };
    return { type: "text", content: r.content };
  });

  return {
    code: scraped.code,
    title: scraped.title,
    url: scraped.url,
    year: scraped.year,
    scrapedAt: scraped.scraped_at,
    minUnits: scraped.min_units,
    introduction: scraped.introduction
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p !== ""),
    topics: extra.topics ?? [],
    learningOutcomes: scraped.learning_outcomes,
    requirements,
    otherInformation: extra.otherInformation,
    relevantDegrees: extra.relevantDegrees,
  };
}

export function mergeAll(scraped: ScrapedSubplan[], supplement: SubplanSupplement): SpecialisationsFile {
  const scrapedCodes = new Set(scraped.map((s) => s.code));
  for (const code of Object.keys(supplement.specialisations)) {
    if (!scrapedCodes.has(code)) throw new Error(`${code}: in the supplement but not scraped`);
  }
  const specialisations = scraped
    .map((s) => {
      const extra = supplement.specialisations[s.code];
      if (!extra) throw new Error(`${s.code}: scraped but has no supplement entry`);
      return mergeSubplan(s, extra);
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  return { generatedBy: GENERATED_BY, specialisations };
}

export function readInputs(root = "."): { scraped: ScrapedSubplan[]; supplement: SubplanSupplement } {
  const dir = join(root, "data/2027/subplans");
  const scraped = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ScrapedSubplan);
  const supplement = JSON.parse(
    readFileSync(join(root, "data/2027/subplans-supplement.json"), "utf8"),
  ) as SubplanSupplement;
  return { scraped, supplement };
}

function main(): void {
  const { scraped, supplement } = readInputs();
  const file = mergeAll(scraped, supplement);
  writeFileSync("data/2027/specialisations.json", JSON.stringify(file, null, 2) + "\n");
  console.log(`[merge-subplans] wrote ${file.specialisations.length} specialisations`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
