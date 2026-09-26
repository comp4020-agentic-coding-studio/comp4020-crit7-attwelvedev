import type { APIRoute } from "astro";
import { placeCourse } from "../../../../lib/plan-service";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const POST: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id) return json({ error: "missing plan id" }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const { code, term } = (body ?? {}) as { code?: unknown; term?: unknown };
  if (typeof code !== "string" || typeof term !== "number") {
    return json({ error: "code (string) and term (number) are required" }, 400);
  }

  const result = placeCourse(id, code, term);
  if (result.status === 200) return json(result.view, 200);
  return json({ error: result.error }, result.status);
};
