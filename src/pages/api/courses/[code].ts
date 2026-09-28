import type { APIRoute } from "astro";
import { getCourseDetails } from "../../../lib/plan-service";

const CODE_PATTERN = /^[A-Z]{4}\d{4}$/;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Unlike search, this never live-fetches from P&C: Details only opens
// courses already in the catalogue, so an unknown code is a plain 404.
export const GET: APIRoute = ({ params, url }) => {
  const code = params.code ?? "";
  if (!CODE_PATTERN.test(code)) return json({ error: `${code} isn't a course code like COMP2100` }, 400);

  const details = getCourseDetails(code, url.searchParams.get("plan"));
  if (!details) return json({ error: `No course ${code} in the catalogue` }, 404);
  return json(details, 200);
};
