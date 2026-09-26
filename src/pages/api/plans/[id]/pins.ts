import type { APIRoute } from "astro";
import { setPin } from "../../../../lib/plan-service";

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

  const { code, groupId } = (body ?? {}) as { code?: unknown; groupId?: unknown };
  if (typeof code !== "string" || (groupId !== null && typeof groupId !== "string")) {
    return json({ error: "code (string) and groupId (string or null) are required" }, 400);
  }

  const result = setPin(id, code, groupId);
  if (result.status === 200) return json(result.view, 200);
  return json({ error: result.error }, result.status);
};
