import type { APIRoute } from "astro";
import { setChoice } from "../../../../lib/plan-service";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id) return json({ error: "missing plan id" }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const { groupId, childId } = (body ?? {}) as { groupId?: unknown; childId?: unknown };
  if (typeof groupId !== "string" || (childId !== null && typeof childId !== "string")) {
    return json({ error: "groupId (string) and childId (string or null) are required" }, 400);
  }

  const result = setChoice(id, groupId, childId);
  if (result.status === 200) return json(result.view, 200);
  return json({ error: result.error }, result.status);
};
