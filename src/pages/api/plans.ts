import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { createPlan } from "../../lib/repo";

// A plain HTML form POST, so starting a plan needs no client-side JS: the
// 303 redirect lands the browser straight on the new plan's page.
export const POST: APIRoute = ({ redirect }) => {
  const id = createPlan(db);
  return redirect(`/plan/${id}`, 303);
};
