import type { APIRoute } from "astro";
import { removeCourse } from "../../../../../lib/plan-service";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const DELETE: APIRoute = ({ params }) => {
  const { id, code } = params;
  if (!id || !code) return json({ error: "missing plan id or course code" }, 400);

  const result = removeCourse(id, code);
  if (result.status === 200) return json(result.view, 200);
  return json({ error: result.error }, result.status);
};
