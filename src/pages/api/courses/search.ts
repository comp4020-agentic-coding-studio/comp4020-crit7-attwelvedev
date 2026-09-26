import type { APIRoute } from "astro";
import { fetchCourseFromPandc, type FetchOutcome } from "../../../lib/catalogue/fetch-pandc";
import { db } from "../../../lib/db";
import { courseCard } from "../../../lib/domain/view";
import { getPlan, invalidateCatalogue, loadCatalogue, loadProgram, searchCourses, upsertFetchedCourse } from "../../../lib/repo";

const CODE_PATTERN = /^[A-Z]{4}\d{4}$/;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

// At most one in-flight P&C fetch per code, shared across concurrent
// requests for the same unknown code — a second search for it while the
// first is still fetching awaits the same promise instead of hitting P&C
// again.
const inFlightFetches = new Map<string, Promise<FetchOutcome>>();

function fetchOnce(code: string): Promise<FetchOutcome> {
  let promise = inFlightFetches.get(code);
  if (!promise) {
    promise = fetchCourseFromPandc(code).finally(() => inFlightFetches.delete(code));
    inFlightFetches.set(code, promise);
  }
  return promise;
}

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return json({ status: "invalid", courses: [], message: "q is required" });

  const planId = url.searchParams.get("plan");
  const plan = planId ? getPlan(db, planId) : null;
  const choices = plan?.choices ?? {};
  const program = loadProgram(db);

  const dbMatches = searchCourses(db, q);
  if (dbMatches.length > 0) {
    const catalogue = loadCatalogue(db);
    const cards = dbMatches.map((course) => courseCard(catalogue, program, choices, course.code));
    return json({ status: "found", courses: cards });
  }

  const code = q.toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return json({ status: "not_found", courses: [] });
  }

  const outcome = await fetchOnce(code);
  if (outcome.status === "not_found") return json({ status: "not_found", courses: [] });
  if (outcome.status === "error") return json({ status: "error", courses: [], message: outcome.message });

  upsertFetchedCourse(db, outcome.course);
  invalidateCatalogue(db);
  const card = courseCard(loadCatalogue(db), program, choices, outcome.course.code);
  return json({ status: "fetched", courses: [card] });
};
