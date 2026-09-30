import type { APIRoute } from "astro";
import { getWhatIf } from "../../../../lib/plan-service";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const GET: APIRoute = ({ params, url }) => {
  const { id } = params;
  if (!id) return json({ error: "missing plan id" }, 400);

  const groupId = url.searchParams.get("group");
  const optionId = url.searchParams.get("option");
  if (!groupId || !optionId) return json({ error: "group and option are required" }, 400);

  const result = getWhatIf(id, groupId, optionId);
  if (result.status === 200) return json(result.whatIf, 200);
  return json({ error: result.error }, result.status);
};
