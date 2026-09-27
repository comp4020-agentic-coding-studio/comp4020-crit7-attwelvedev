import type { APIRoute } from "astro";
import { setCheck } from "../../../../lib/plan-service";

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

  const { code, item, answer } = (body ?? {}) as { code?: unknown; item?: unknown; answer?: unknown };
  if (typeof code !== "string" || typeof item !== "string" || !(answer === null || answer === "met" || answer === "not-met")) {
    return json({ error: 'code (string), item (string) and answer ("met", "not-met" or null) are required' }, 400);
  }

  const result = setCheck(id, code, item, answer);
  if (result.status === 200) return json(result.view, 200);
  return json({ error: result.error }, result.status);
};
