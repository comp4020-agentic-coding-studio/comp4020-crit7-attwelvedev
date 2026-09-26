import { AACOM_2027 } from "../data/aacom-2027";
import { EXAMPLE_PLAN } from "../data/example-plan";
import type { PandcCourseJson } from "./catalogue/from-pandc";
import type { SeedInput } from "./seed";

// Scraped course JSON is bundled via import.meta.glob so the Dockerfile
// doesn't need to copy data/ into the runtime image — see Dockerfile, which
// only copies node_modules, dist and drizzle.
const courseModules = import.meta.glob("/data/2027/courses/*.json", {
  eager: true,
  import: "default",
}) as Record<string, PandcCourseJson>;

export function loadSeedInput(): SeedInput {
  return {
    courses: Object.values(courseModules),
    program: AACOM_2027,
    example: EXAMPLE_PLAN,
  };
}
