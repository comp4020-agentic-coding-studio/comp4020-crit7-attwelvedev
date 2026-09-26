import type { CourseCard, PlanView } from "../lib/domain/view";

export type ApiResult = PlanView | { error: string };

export type SearchResult = {
  status: "found" | "fetched" | "not_found" | "error" | "invalid";
  courses: CourseCard[];
  message?: string;
};

async function request(path: string, init: RequestInit): Promise<ApiResult> {
  const res = await fetch(path, init);
  const body = (await res.json()) as PlanView | { error: string };
  if (!res.ok) return { error: "error" in body ? body.error : "Request failed" };
  return body;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function placeCourse(planId: string, code: string, term: number): Promise<ApiResult> {
  return request(`/api/plans/${planId}/placements`, jsonInit("POST", { code, term }));
}

export function removeCourse(planId: string, code: string): Promise<ApiResult> {
  return request(`/api/plans/${planId}/placements/${code}`, { method: "DELETE" });
}

export function setCutoff(planId: string, cutoff: number): Promise<ApiResult> {
  return request(`/api/plans/${planId}/cutoff`, jsonInit("PUT", { cutoff }));
}

export function setChoice(planId: string, groupId: string, childId: string | null): Promise<ApiResult> {
  return request(`/api/plans/${planId}/choices`, jsonInit("PUT", { groupId, childId }));
}

export function setPin(planId: string, code: string, groupId: string | null): Promise<ApiResult> {
  return request(`/api/plans/${planId}/pins`, jsonInit("PUT", { code, groupId }));
}

export function isError(result: ApiResult): result is { error: string } {
  return "error" in result;
}

export async function searchCourses(q: string, planId?: string): Promise<SearchResult> {
  const params = new URLSearchParams({ q });
  if (planId) params.set("plan", planId);
  const res = await fetch(`/api/courses/search?${params.toString()}`);
  return (await res.json()) as SearchResult;
}
